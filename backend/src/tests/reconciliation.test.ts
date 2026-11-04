import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { WalletProvider } from '../constants/wallets';
import { closeCashSessionSchema } from '../dtos/cash.dto';
import { createOpeningBalances } from '../services/openingBalance.service';
import {
  assertOpenSessionModification,
  buildReconciliationPreview,
  reconcileAccounts,
} from '../services/reconciliation.service';

const sessionId = new Types.ObjectId();
const cashierId = new Types.ObjectId();
const openingBalances = createOpeningBalances({
  cashSessionId: sessionId,
  cashierId,
  createdBy: cashierId,
  openedAt: new Date('2026-08-19T08:00:00.000Z'),
  openingCashUGX: 1_000,
  evcOpeningBalanceUSD: 100,
  mobileMoneyOpeningBalanceUSD: 200,
  mobileMoneyProvider: WalletProvider.TELESOM_ZAAD,
});

const preview = buildReconciliationPreview(
  {
    _id: sessionId,
    openingCash: 1_000,
    openingBalances,
    cashAdded: [{ amount: 200, reason: 'Top up', createdAt: new Date() }],
    cashWithdrawn: [{ amount: 50, reason: 'Bank deposit', createdAt: new Date() }],
  } as any,
  [
    { walletProvider: WalletProvider.HORMUUD_EVC_PLUS, amountReceivedUSD: 10, cashPaidUGX: 300 },
    { walletProvider: WalletProvider.TELESOM_ZAAD, amountReceivedUSD: 20, cashPaidUGX: 100 },
  ]
);

const balancedActuals = preview.map((account) => ({
  accountType: account.accountType,
  provider: account.provider,
  currency: account.currency,
  amount: account.expectedClosingBalance,
}));

test('expected closing balances use only the confirmed per-account movements', () => {
  const byAccount = new Map(preview.map((account) => [account.accountType, account]));
  assert.equal(byAccount.get('PHYSICAL_CASH')?.expectedClosingBalance, 750);
  assert.equal(byAccount.get('EVC')?.expectedClosingBalance, 110);
  assert.equal(byAccount.get('MOBILE_MONEY')?.expectedClosingBalance, 220);
});

test('normal closing marks every account balanced', () => {
  const reconciled = reconcileAccounts(preview, balancedActuals);
  assert.ok(reconciled.every((account) => account.status === 'BALANCED'));
  assert.ok(reconciled.every((account) => account.difference === 0));
});

test('shortage and overage use actual minus expected', () => {
  const actuals = balancedActuals.map((actual) => ({ ...actual }));
  actuals.find((actual) => actual.accountType === 'PHYSICAL_CASH')!.amount -= 50;
  actuals.find((actual) => actual.accountType === 'EVC')!.amount += 5;

  const reconciled = reconcileAccounts(preview, actuals);
  const byAccount = new Map(reconciled.map((account) => [account.accountType, account]));
  assert.deepEqual(
    { status: byAccount.get('PHYSICAL_CASH')?.status, difference: byAccount.get('PHYSICAL_CASH')?.difference },
    { status: 'SHORTAGE', difference: -50 }
  );
  assert.deepEqual(
    { status: byAccount.get('EVC')?.status, difference: byAccount.get('EVC')?.difference },
    { status: 'OVERAGE', difference: 5 }
  );
});

test('duplicate or incomplete actual balances are rejected', () => {
  assert.throws(() => reconcileAccounts(preview, [...balancedActuals, balancedActuals[0]]));
  assert.throws(() => reconcileAccounts(preview, balancedActuals.slice(0, 2)));

  const duplicateDto = closeCashSessionSchema.safeParse({
    body: { actualBalances: [balancedActuals[0], balancedActuals[0]] },
  });
  assert.equal(duplicateDto.success, false);
});

test('closed and non-owned sessions reject normal cashier modification', () => {
  assert.throws(
    () => assertOpenSessionModification('CLOSED', cashierId.toString(), cashierId.toString()),
    (error: any) => error.statusCode === 400 && /already been closed/.test(error.message)
  );
  assert.throws(
    () => assertOpenSessionModification('OPEN', cashierId.toString(), new Types.ObjectId().toString()),
    (error: any) => error.statusCode === 403 && /only modify their own/.test(error.message)
  );
});
