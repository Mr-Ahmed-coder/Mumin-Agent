import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { accountBalanceMinor, flows, minorUnits, operationSchema, quoteMovement, reverseLegs } from '../services/movementMath.service';
import { assertLedgerActor, atomicLedgerRequest, fingerprint, postAccountOperation, reverseAccountOperation } from '../services/movementLedger.service';
import { FinancialOperation } from '../models/FinancialOperation';
import { CashSession } from '../models/CashSession';
import { CustomerDeposit } from '../models/CustomerDeposit';
import { InternetCredit } from '../models/InternetCredit';
import { Expense } from '../models/Expense';
import { ExchangeRate } from '../models/ExchangeRate';
import { AuditLog } from '../models/AuditLog';
import { Transaction } from '../models/Transaction';
import { Customer } from '../models/Customer';
import { FeeService } from '../services/fee.service';
import { WalletProvider } from '../constants/wallets';
import { UserRole } from '../constants/roles';
import { env } from '../config/env';

const wallet = { id: 'HORMUUD_EVC_PLUS', kind: 'WALLET' as const, currency: 'USD' as const };
const usd = { id: 'CASH_USD', kind: 'CASH' as const, currency: 'USD' as const };
const ugx = { id: 'CASH_UGX', kind: 'CASH' as const, currency: 'UGX' as const };
const actor = { id: new Types.ObjectId().toString(), role: UserRole.CASHIER, email: 'test@example.com', name: 'Test cashier' };

test('production rejects new posting and reversal before any database work', async () => {
  const previous = env.NODE_ENV;
  env.NODE_ENV = 'production';
  try {
    await assert.rejects(() => postAccountOperation(actor, {}), (error: any) => error.statusCode === 404);
    await assert.rejects(() => reverseAccountOperation(actor, {}), (error: any) => error.statusCode === 404);
  } finally { env.NODE_ENV = previous; }
});

test('both confirmed USD-to-UGX flows record receipt and net payout with a separate 1% fee', async () => {
  for (const incoming of [wallet, usd]) {
    const quote = quoteMovement(incoming.kind === 'WALLET' ? flows[0] : flows[2], incoming, ugx, 200, 3800);
    assert.deepEqual(quote.legs, [
      { accountId: incoming.id, currency: 'USD', direction: 'IN', amountMinor: 20000 },
      { accountId: ugx.id, currency: 'UGX', direction: 'OUT', amountMinor: 752400 },
    ]);
    assert.equal(quote.feeUSD, 2); assert.equal(quote.feeUGX, 7600);
    assert.equal(quote.legs.length, 2, 'fee must not add a second outflow');
  }
  assert.equal(await FeeService.calculateFee(500, WalletProvider.TELESOM_ZAAD), 5);
  assert.equal(await FeeService.calculateFee(1.01, WalletProvider.TELESOM_ZAAD), 0.0101);
});

test('all three deferred flows refuse an unconfirmed fee instead of assuming zero or 1%', () => {
  const secondWallet = { ...wallet, id: 'TELESOM_ZAAD' };
  assert.throws(() => quoteMovement(flows[1], ugx, wallet, 380000, 3800), /unconfirmed/);
  assert.throws(() => quoteMovement(flows[3], wallet, secondWallet, 100, 3800), /unconfirmed/);
  assert.throws(() => quoteMovement(flows[4], usd, wallet, 100, 3800), /unconfirmed/);
});

test('balances stay in each account currency and reversals exactly negate original movements', () => {
  const quote = quoteMovement(flows[0], wallet, ugx, 100, 3800);
  assert.equal(accountBalanceMinor(20, wallet, quote.legs), 12000);
  assert.equal(accountBalanceMinor(500000, ugx, quote.legs), 123800);
  const roundTrip = [...quote.legs, ...reverseLegs(quote.legs)];
  assert.equal(accountBalanceMinor(20, wallet, roundTrip), 2000);
  assert.equal(accountBalanceMinor(500000, ugx, roundTrip), 500000);
  assert.equal(accountBalanceMinor(20, { ...wallet, id: 'SALAAM_BANK' }, quote.legs), 2000);
  assert.throws(() => accountBalanceMinor(20, wallet, [{ ...quote.legs[0], currency: 'UGX' }]));
});

test('invalid amounts, unsupported precision, currencies, accounts and forged request fields are rejected', () => {
  for (const amount of [-1, Infinity, NaN, 0.001]) assert.throws(() => minorUnits(amount, 'USD'));
  assert.throws(() => minorUnits(1.5, 'UGX'));
  assert.throws(() => quoteMovement(flows[0], wallet, wallet, 100, 3800));
  assert.throws(() => quoteMovement(flows[0], wallet, ugx, 100, 0));
  assert.throws(() => quoteMovement(flows[0], wallet, ugx, 0, 3800));
  assert.equal(operationSchema.safeParse({ cashierId: 'forged' }).success, false);
});

test('posting requires a supported role, own open expanded shift; legacy sessions are not fabricated', () => {
  assert.doesNotThrow(() => assertLedgerActor(actor, { cashierId: actor.id, status: 'OPEN', openingVersion: 2, ledgerVersion: 1 }));
  for (const shift of [
    { cashierId: 'another', status: 'OPEN', openingVersion: 2 },
    { cashierId: actor.id, status: 'CLOSED', openingVersion: 2 },
    { cashierId: actor.id, status: 'OPEN' },
    { cashierId: actor.id, status: 'OPEN', openingVersion: 2 },
  ]) assert.throws(() => assertLedgerActor(actor, shift));
  assert.throws(() => assertLedgerActor({ ...actor, role: 'UNKNOWN' as any }, { cashierId: actor.id, status: 'OPEN', openingVersion: 2 }));
});

// Isolated transaction harness: exercises orchestration, rollback and retry
// without connecting to or modifying Atlas. Real replica-set tests still needed.
test('posting, idempotent retries, rollback, insufficient funds and append-only reversal orchestration', async () => {
  const originals: Array<() => void> = [];
  const replace = (target: any, key: string, value: any) => {
    const original = target[key]; originals.push(() => { target[key] = original; }); target[key] = value;
  };
  let events: any[] = [], revision = 0, audits = 0, failAudit = false;
  const shiftId = new Types.ObjectId(), rateId = new Types.ObjectId();
  const shift = { _id: shiftId, cashierId: actor.id, status: 'OPEN', openingVersion: 2, ledgerVersion: 1,
    accountOpenings: [{ ...wallet, name: 'Hormuud', amount: 0 }, { ...wallet, id: 'SALAAM_BANK', name: 'Salaam Bank', amount: 0 }, { ...usd, name: 'USD Cash', amount: 0 }, { ...ugx, name: 'Shilling Cash', amount: 1000000 }] };
  const query = (value: any) => ({ session: async () => value, then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject) });
  try {
    const transactions = new Map<string, any>();
    for (const model of [FinancialOperation, CustomerDeposit, InternetCredit, Expense, AuditLog, Transaction, Customer]) replace(model, 'init', async () => {});
    replace(Transaction, 'create', async ([data]: any[]) => {
      const row = { ...data, _id: data._id || new Types.ObjectId(), save: async () => {} };
      transactions.set(String(row._id), row);
      return [row];
    });
    replace(Transaction, 'findById', (id: unknown) => query(transactions.get(String(id))));
    replace(FinancialOperation, 'listIndexes', async () => FinancialOperation.schema.indexes().map(([key, options]) => ({ key, unique: options.unique })));
    replace(mongoose, 'startSession', async () => ({ endSession: async () => {}, withTransaction: async (work: any) => {
      const snapshot = [...events], previousRevision = revision, previousAudits = audits;
      try { await work(); } catch (error) { events = snapshot; revision = previousRevision; audits = previousAudits; throw error; }
    } }));
    replace(CashSession, 'findById', () => query(shift));
    replace(CashSession, 'updateOne', async () => { revision++; return { matchedCount: 1 }; });
    replace(ExchangeRate, 'findOne', () => query({ _id: rateId, rate: 3800 }));
    replace(FinancialOperation, 'findOne', (filter: any) => query(events.find(e => e.cashierId === filter.cashierId && e.requestKey === filter.requestKey) || null));
    replace(FinancialOperation, 'findById', (id: string) => query(events.find(e => String(e._id) === id)));
    replace(FinancialOperation, 'find', () => query(events));
    replace(FinancialOperation, 'exists', (filter: any) => query(events.find(e => e.reversesOperationId && String(e.reversesOperationId) === String(filter.reversesOperationId))));
    replace(FinancialOperation, 'create', async (values: any[]) => { const event = { ...values[0], _id: values[0]._id || new Types.ObjectId() }; events.push(event); return [event]; });
    replace(AuditLog, 'create', async () => { if (failAudit) throw new Error('Audit write failure'); audits++; });
    const input = { requestKey: 'request-0001', shiftId: String(shiftId), category: flows[0], accountId: wallet.id,
      outgoingAccountId: ugx.id, amount: 100, exchangeRateId: String(rateId), reference: 'external-001' };
    const event = await postAccountOperation(actor, input);
    assert.equal(events.length, 1); assert.equal(revision, 1); assert.equal(audits, 1);
    assert.equal(String((await postAccountOperation(actor, input))._id), String(event._id));
    assert.equal(events.length, 1); assert.equal(revision, 1);
    await assert.rejects(() => postAccountOperation(actor, { ...input, amount: 50 }), /different data/);
    await assert.rejects(() => postAccountOperation(actor, { ...input, requestKey: 'request-big', reference: 'big', amount: 10000 }), /Insufficient/);
    assert.equal(events.length, 1); assert.equal(revision, 1);
    failAudit = true;
    await assert.rejects(() => postAccountOperation(actor, { ...input, requestKey: 'request-fail', reference: 'fail' }), /Audit write failure/);
    assert.equal(events.length, 1); assert.equal(revision, 1);
    failAudit = false;
    const reversal = await reverseAccountOperation(actor, { requestKey: 'reversal-001', operationId: String(event._id), reason: 'Customer refund' });
    assert.equal(events.length, 2); assert.equal(reversal.feeUSD, -1);
    assert.deepEqual(reversal.legs, reverseLegs(event.legs));
    assert.equal(event.legs[0].direction, 'IN', 'original is unchanged');
    await assert.rejects(() => reverseAccountOperation(actor, { requestKey: 'reversal-002', operationId: String(event._id), reason: 'Repeat refund' }), /already been reversed/);
    assert.equal(events.length, 2);
    const depositId = new Types.ObjectId(), creditId = new Types.ObjectId();
    const deposit: any = { _id: depositId, totalDepositedUGX: 0, totalWithdrawnUGX: 0, currentBalanceUGX: 0, ledger: [], save: async () => {} };
    const credit: any = { _id: creditId, originalAmountUGX: 10000, amountPaidUGX: 0, remainingBalanceUGX: 10000, status: 'UNPAID', payments: [], save: async () => {} };
    replace(CustomerDeposit, 'findById', () => query(deposit));
    replace(InternetCredit, 'findById', () => query(credit));
    replace(Expense, 'create', async (values: any[]) => [{ _id: new Types.ObjectId(), ...values[0] }]);
    const depositInput = { requestKey: 'deposit-001', shiftId: String(shiftId), category: 'CUSTOMER_DEPOSIT', accountId: ugx.id, amount: 5000, reference: 'deposit001', reason: 'Customer safekeeping', recordId: String(depositId) };
    const deposited = await postAccountOperation(actor, depositInput);
    await postAccountOperation(actor, depositInput);
    assert.equal(deposit.currentBalanceUGX, 5000); assert.equal(deposit.ledger.length, 1);
    assert.equal(deposited.feeUSD, 0); assert.equal(deposited.legs[0].direction, 'IN');
    const withdrawn = await postAccountOperation(actor, { ...depositInput, requestKey: 'withdraw-001', reference: 'withdraw001', category: 'CUSTOMER_WITHDRAWAL', amount: 2000 });
    assert.equal(withdrawn.legs[0].direction, 'OUT'); assert.equal(deposit.currentBalanceUGX, 3000);
    await assert.rejects(() => postAccountOperation(actor, { ...depositInput, requestKey: 'withdraw-big', reference: 'withdrawbig', category: 'CUSTOMER_WITHDRAWAL', amount: 4000 }), /exceed/);
    const paid = await postAccountOperation(actor, { ...depositInput, requestKey: 'repayment-001', reference: 'repayment001', category: 'CREDIT_REPAYMENT', recordId: String(creditId), amount: 2500 });
    assert.equal(credit.remainingBalanceUGX, 7500); assert.equal(credit.payments.length, 1);
    assert.equal(paid.legs[0].direction, 'IN'); assert.equal(paid.feeUSD, 0); assert.equal(paid.feeUGX, 0);
    const cashAdded = await postAccountOperation(actor, { ...depositInput, requestKey: 'cash-added-001', reference: 'cashadded001', category: 'CASH_ADDED', accountId: usd.id, amount: 50 });
    assert.deepEqual(cashAdded.legs, [{ accountId: usd.id, currency: 'USD', direction: 'IN', amountMinor: 5000 }]);
    const expense = await postAccountOperation(actor, { ...depositInput, requestKey: 'expense-001', reference: 'expense001', category: 'EXPENSE', accountId: usd.id, amount: 10 });
    assert.equal(expense.legs[0].currency, 'USD'); assert.equal(expense.legs[0].direction, 'OUT');
    const cashExchange = await postAccountOperation(actor, { ...input, requestKey: 'cash-exchange-001', reference: 'cash-exchange001', category: flows[2], accountId: usd.id, amount: 20 });
    assert.equal(cashExchange.legs[0].accountId, usd.id); assert.equal(cashExchange.legs[1].amountMinor, 75240);
    const otherWallet = await postAccountOperation(actor, { ...input, requestKey: 'other-wallet-001', reference: 'other-wallet001', accountId: 'SALAAM_BANK', amount: 10 });
    assert.equal(otherWallet.legs[0].accountId, 'SALAAM_BANK'); assert.equal(otherWallet.legs[0].amountMinor, 1000);
    await assert.rejects(() => postAccountOperation(actor, { ...depositInput, requestKey: 'adjustment-001', reference: 'adjustment001', category: 'ADJUSTMENT', direction: 'IN' }), /authorization/);
    for (const category of [flows[1], flows[3], flows[4]]) await assert.rejects(() => postAccountOperation(actor, { ...input, requestKey: `deferred-${category}`, category, reference: category }), /deferred/);
    const prior = { fingerprint: fingerprint('same'), requestKey: 'once', cashierId: actor.id };
    events.push(prior);
    assert.equal(await atomicLedgerRequest(actor, 'once', fingerprint('same'), async () => { throw new Error('Must not run twice'); }), prior);
  } finally { for (const restore of originals.reverse()) restore(); }
});

test('operation schema enforces append-only records and idempotency/reversal indexes', async () => {
  const indexes = FinancialOperation.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.cashierId === 1 && fields.requestKey === 1 && options.unique));
  assert.ok(indexes.some(([fields, options]) => fields.reversesOperationId === 1 && options.unique));
  assert.equal(FinancialOperation.schema.path('legs').options.immutable, true);
  await assert.rejects(() => FinancialOperation.updateOne({}, { $set: { feeUSD: 0 } }), /append-only/);
  await assert.rejects(() => FinancialOperation.deleteMany({}), /append-only/);
});
