import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import express from 'express';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'node:net';

test('disposable replica: concurrent postings, rollback, projection and reversal', { skip: process.env.RUN_LEDGER_REPLICA_TESTS !== '1', timeout: 600000 }, async () => {
  Object.assign(process.env, {
    NODE_ENV: 'development', MONGO_URI: 'mongodb://127.0.0.1:1/unused',
    JWT_ACCESS_SECRET: 'test-access-secret-only', JWT_REFRESH_SECRET: 'test-refresh-secret-only',
    CORS_ORIGIN: 'http://localhost:3000',
  });
  const { CashSession } = await import('../models/CashSession.js');
  const { ExchangeRate } = await import('../models/ExchangeRate.js');
  const { Transaction } = await import('../models/Transaction.js');
  const { FinancialOperation } = await import('../models/FinancialOperation.js');
  const { AuditLog } = await import('../models/AuditLog.js');
  const { CustomerDeposit } = await import('../models/CustomerDeposit.js');
  const { InternetCredit } = await import('../models/InternetCredit.js');
  const { ledgerMigrationDryRun, ledgerMovementTotals, readLedgerBalances } = await import('../services/ledgerRead.service.js');
  const { UserRole } = await import('../constants/roles.js');
  const { postAccountOperation, reverseAccountOperation } = await import('../services/movementLedger.service.js');
  const { postLegacyFinancialRequest, cancelLegacyFinancialRequest } = await import('../services/legacyLedgerAdapter.service.js');
  const { closeLedgerShift, previewLedgerClose, reopenLedgerShift } = await import('../services/ledgerClosing.service.js');
  const repl = await MongoMemoryReplSet.create({ binary: { version: '8.0.12' }, replSet: { count: 1, ip: '127.0.0.1' } });
  try {
    await mongoose.connect(repl.getUri('ledger_task03b_test'));
    const actor = { id: String(new Types.ObjectId()), role: UserRole.CASHIER, name: 'Cashier', email: 'cashier@example.invalid' };
    const rate = await ExchangeRate.create({ rate: 3800 });
    const shift = await CashSession.create({ cashierId: actor.id, sessionNumber: 'CS-REPLICA', ledgerVersion: 1, openingVersion: 2, openingCash: 500000,
      openingExchangeRate: { rateId: rate._id, rate: rate.rate, baseCurrency: 'USD', targetCurrency: 'UGX', recordedAt: new Date() },
      accountOpenings: [
        { id: 'CASH_UGX', name: 'Shilling Cash', kind: 'CASH', currency: 'UGX', amount: 500000 },
        { id: 'CASH_USD', name: 'USD Cash', kind: 'CASH', currency: 'USD', amount: 0 },
        { id: 'WALLET_TEST', name: 'Test wallet', kind: 'WALLET', currency: 'USD', amount: 0 },
        { id: 'SECOND_WALLET', name: 'Second wallet', kind: 'WALLET', currency: 'USD', amount: 12.34 },
      ] });
    const input = { shiftId: String(shift._id), exchangeRateId: String(rate._id), accountId: 'WALLET_TEST',
      outgoingAccountId: 'CASH_UGX', amount: 100, category: 'WALLET_USD_TO_CASH_UGX', requestKey: 'wallet-request-1', reference: 'wallet-reference-1' };
    await assert.rejects(postAccountOperation({ ...actor, id: String(new Types.ObjectId()) }, input), /own|access|forbidden/i);
    const [first, retry] = await Promise.all([postAccountOperation(actor, input), postAccountOperation(actor, input)]);
    assert.equal(String(first._id), String(retry._id));
    assert.equal(await Transaction.countDocuments(), 1);
    assert.equal(await Transaction.countDocuments({ operationId: first._id, serviceFeeUSD: 1, cashPaidUGX: 376200 }), 1);
    const cashInput = { ...input, category: 'CASH_USD_TO_CASH_UGX', accountId: 'CASH_USD', amount: 30 };
    const competing = await Promise.allSettled([1, 2].map(i => postAccountOperation(actor, { ...cashInput, requestKey: `cash-request-${i}`, reference: `cash-reference-${i}` })));
    assert.equal(competing.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await FinancialOperation.countDocuments(), 2);
    const createAudit = AuditLog.create;
    try {
      AuditLog.create = (async () => { throw new Error('Injected audit failure'); }) as typeof AuditLog.create;
      await assert.rejects(postAccountOperation(actor, { ...input, amount: 1, requestKey: 'rollback-request', reference: 'rollback-reference' }), /Injected audit failure/);
    } finally { AuditLog.create = createAudit; }
    assert.equal(await Transaction.countDocuments(), 2);
    assert.equal(await FinancialOperation.countDocuments(), 2);
    await reverseAccountOperation(actor, { requestKey: 'reversal-request', operationId: String(first._id), reason: 'Verified correction' });
    assert.equal(await Transaction.countDocuments({ status: 'COMPLETED' }), 1);
    assert.equal(await Transaction.countDocuments({ status: 'CANCELLED', operationId: first._id }), 1);
    assert.equal(await FinancialOperation.countDocuments({ reversesOperationId: first._id }), 1);
    const manager = { ...actor, id: String(new Types.ObjectId()), role: UserRole.MANAGER };
    const credit = await InternetCredit.create({ customerName: 'Credit customer', createdBy: actor.id, originalAmountUGX: 15000, remainingBalanceUGX: 15000 });
    const cashMovement = { shiftId: String(shift._id), accountId: 'CASH_UGX', amount: 5000, reason: 'Recorded in drawer' };
    const deposit = await postAccountOperation(actor, { ...cashMovement, category: 'CUSTOMER_DEPOSIT', requestKey: 'deposit-request', reference: 'deposit-ref',
      customerName: 'Deposit customer', phone: '+256700000001' });
    await import('../models/User.js');
    const archiveApp = express();
    archiveApp.use('/customer-deposits', require('../routes/customerDeposit.routes').default);
    archiveApp.use(require('../middlewares/errorHandler').errorHandler);
    const server = await new Promise<ReturnType<typeof archiveApp.listen>>((resolve, reject) => {
      const listener = archiveApp.listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/customer-deposits/archive`;
      const archiveRequest = (role?: string) => fetch(url, {
        headers: role ? { Authorization: `Bearer ${jwt.sign({ ...actor, role }, process.env.JWT_ACCESS_SECRET!)}` } : {},
      });
      for (const [role, status] of [[undefined, 401], [UserRole.CASHIER, 403], [UserRole.MANAGER, 403]] as const) {
        const response = await archiveRequest(role);
        assert.equal(response.status, status);
        await response.text();
      }
      const response = await archiveRequest(UserRole.ADMIN);
      assert.equal(response.status, 200);
      const archive = await response.json() as { data: { records: { currentBalanceUGX: number; ledger: unknown[] }[]; summary: { held: number } } };
      assert.equal(archive.data.summary.held, 5000);
      assert.equal(archive.data.records[0].currentBalanceUGX, 5000);
      assert.equal(archive.data.records[0].ledger.length, 1);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
    const payment = await postAccountOperation(actor, { ...cashMovement, category: 'CREDIT_REPAYMENT', requestKey: 'payment-request', reference: 'payment-ref', recordId: String(credit._id) });
    await assert.rejects(reverseAccountOperation(actor, { requestKey: 'cashier-deposit-reversal', operationId: String(deposit._id), reason: 'Not authorized' }), /authorization/i);
    const before = await readLedgerBalances(shift);
    assert.equal(before?.find(a => a.id === 'CASH_UGX')?.balance, 397140);
    await reverseAccountOperation(manager, { requestKey: 'deposit-reversal', operationId: String(deposit._id), reason: 'Correct deposit' });
    await reverseAccountOperation(manager, { requestKey: 'payment-reversal', operationId: String(payment._id), reason: 'Correct repayment' });
    assert.equal((await CustomerDeposit.findById(deposit.recordId))?.currentBalanceUGX, 0);
    assert.deepEqual((await InternetCredit.findById(credit._id))?.payments.map(item => item.kind ?? 'PAYMENT'), ['PAYMENT', 'REVERSAL']);
    assert.equal((await readLedgerBalances(shift))?.find(a => a.id === 'CASH_UGX')?.balance, 387140);
    assert.equal(await Transaction.countDocuments({ status: 'COMPLETED' }), 1, 'safekeeping and repayments are not exchange revenue');
    assert.ok((await ledgerMovementTotals()).some(row => row.category === 'CREDIT_REPAYMENT' && row.amount === 5000 && row.currency === 'UGX'));
    const request = (key: string, body: object, id?: string) => ({ user: actor, body, params: { id }, get: () => key }) as any;
    const legacyRequest = request('legacy-exchange-request', { amountReceivedUSD: 10, walletProvider: 'WALLET_TEST', referenceNumber: 'legacy-ref' });
    const projected = await postLegacyFinancialRequest(legacyRequest, 'WALLET_USD_TO_CASH_UGX');
    assert.ok(projected && 'operationId' in projected && projected.operationId);
    await assert.rejects(postAccountOperation(actor, { ...input, amount: 1, requestKey: 'duplicate-provider-ref' }), /Duplicate financial reference/i);
    await ExchangeRate.updateOne({ _id: rate._id }, { status: 'INACTIVE' });
    assert.equal(String((await postLegacyFinancialRequest(legacyRequest, 'WALLET_USD_TO_CASH_UGX'))?._id), String(projected._id));
    await cancelLegacyFinancialRequest(request('legacy-exchange-cancel', { cancellationReason: 'Verified refund' }, String(projected._id)));
    assert.equal((await Transaction.findById(projected._id))?.status, 'CANCELLED');
    const { getComprehensiveReport } = await import('../controllers/report.controller.js');
    const report = await new Promise<any>((resolve, reject) => {
      getComprehensiveReport({ query: {} } as any, { status: () => ({ json: resolve }) } as any, reject);
    });
    assert.equal(report.data.summary.totalTransactionsCount, 1);
    assert.equal(report.data.summary.totalServiceFeesUSD, 0.3);
    assert.equal(report.data.summary.totalCashPaidOutUGX, 112860);
    assert.ok(report.data.accountMovements.some((row: any) => row.category === 'CUSTOMER_DEPOSIT'));
    // Simulate a row written before today's model validation existed.
    await CashSession.collection.insertOne({ cashierId: new Types.ObjectId(actor.id), sessionNumber: 'HISTORICAL-REPLICA', openingCash: 0, status: 'CLOSED' });
    const operationCount = await FinancialOperation.countDocuments();
    const inventory = await ledgerMigrationDryRun();
    assert.equal(inventory.historicalShifts, 1);
    assert.equal(inventory.imported, 0);
    assert.equal(await FinancialOperation.countDocuments(), operationCount);

    const id = String(shift._id);
    const unchanged = await previewLedgerClose(id, actor);
    assert.deepEqual(Object.fromEntries(unchanged.accounts.map(a => [a.accountId, a.expectedClosingBalance])),
      { CASH_UGX: 387140, CASH_USD: 30, WALLET_TEST: 0, SECOND_WALLET: 12.34 });
    await assert.rejects(previewLedgerClose(id, manager), /own cash session/);
    const balanced = (preview: typeof unchanged) => ({
      revision: preview.revision,
      actualBalances: preview.accounts.map(account => ({ accountId: account.accountId, amount: account.expectedClosingBalance })),
    });
    await assert.rejects(closeLedgerShift(id, manager, balanced(unchanged)), /own cash session/);
    await assert.rejects(closeLedgerShift(id, actor, { ...balanced(unchanged), actualBalances: balanced(unchanged).actualBalances.slice(1) }), /each opened account/);
    await ExchangeRate.updateOne({ _id: rate._id }, { status: 'ACTIVE' });
    await postAccountOperation(actor, { ...input, accountId: 'SECOND_WALLET', amount: 2, requestKey: 'second-wallet-close', reference: 'second-wallet-receipt' });
    await postAccountOperation({ ...actor, role: UserRole.MANAGER }, { shiftId: id, accountId: 'CASH_USD',
      category: 'ADJUSTMENT', direction: 'IN', amount: 1.02, requestKey: 'closing-adjustment', reference: 'closing-adjustment', reason: 'Verified cash adjustment' });
    await assert.rejects(closeLedgerShift(id, actor, balanced(unchanged)), /movements changed/i);
    const updated = await previewLedgerClose(id, actor);
    assert.deepEqual(Object.fromEntries(updated.accounts.map(a => [a.accountId, a.expectedClosingBalance])),
      { CASH_UGX: 379616, CASH_USD: 31.02, WALLET_TEST: 0, SECOND_WALLET: 14.34 });
    const requestWithDifferences = balanced(updated);
    requestWithDifferences.actualBalances.find(a => a.accountId === 'CASH_UGX')!.amount -= 1;
    requestWithDifferences.actualBalances.find(a => a.accountId === 'CASH_USD')!.amount = 31.03;
    try {
      AuditLog.create = (async () => { throw new Error('Closing audit failed'); }) as typeof AuditLog.create;
      await assert.rejects(closeLedgerShift(id, actor, requestWithDifferences), /Closing audit failed/);
    } finally { AuditLog.create = createAudit; }
    assert.equal((await CashSession.findById(id))?.status, 'OPEN');
    assert.equal((await CashSession.findById(id))?.closingHistory.length, 0);
    const closingAttempts = await Promise.allSettled([closeLedgerShift(id, actor, requestWithDifferences), closeLedgerShift(id, actor, requestWithDifferences)]);
    assert.equal(closingAttempts.filter(result => result.status === 'fulfilled').length, 1);
    const closed = (await CashSession.findById(id))!;
    assert.equal(closed.status, 'CLOSED');
    assert.equal(closed.closingHistory.length, 1);
    assert.deepEqual(closed.closingHistory[0].accounts.map(a => [a.accountId, a.difference, a.status]), [
      ['CASH_UGX', -1, 'SHORTAGE'], ['CASH_USD', 0.01, 'OVERAGE'], ['WALLET_TEST', 0, 'BALANCED'], ['SECOND_WALLET', 0, 'BALANCED'],
    ]);
    assert.equal(await AuditLog.countDocuments({ resourceId: id, action: 'SHIFT_CLOSED_RECONCILED' }), 1);
    await assert.rejects(postAccountOperation(actor, { ...input, requestKey: 'after-shift-closed', reference: 'after-shift-closed' }), /closed/i);
    await assert.rejects(reopenLedgerShift(id, actor), /forbidden/i);
    await reopenLedgerShift(id, manager);
    await assert.rejects(closeLedgerShift(id, actor, requestWithDifferences), /movements changed/i);
    const reopened = await previewLedgerClose(id, actor);
    const reclosed = await closeLedgerShift(id, actor, balanced(reopened));
    assert.equal(reclosed?.closingHistory.length, 2);
    assert.equal(reclosed?.closingHistory[0].accounts[0].status, 'SHORTAGE');
    assert.ok(reclosed?.closingHistory[1].accounts.every(a => a.status === 'BALANCED'));

    const legacy = await CashSession.collection.insertOne({ cashierId: new Types.ObjectId(actor.id), sessionNumber: 'INCOMPLETE-LEDGER',
      status: 'OPEN', openingCash: 10, ledgerVersion: 1 });
    await assert.rejects(previewLedgerClose(String(legacy.insertedId), actor), /no complete opening snapshot/i);
  } finally {
    await mongoose.disconnect();
    await repl.stop();
  }
});
