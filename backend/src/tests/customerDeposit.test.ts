import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Types } from 'mongoose';
import { UserRole } from '../constants/roles';
import { recordCustomerDepositSchema, recordCustomerWithdrawalSchema } from '../dtos/customerDeposit.dto';
import { authorize } from '../middlewares/auth';
import { CustomerDeposit } from '../models/CustomerDeposit';
import {
  applyCustomerDepositMovement,
  CustomerDepositMovementTarget,
} from '../services/customerDeposit.service';

const userId = new Types.ObjectId();
const createBalance = (): CustomerDepositMovementTarget => ({
  totalDepositedUGX: 0,
  totalWithdrawnUGX: 0,
  currentBalanceUGX: 0,
  ledger: [],
});

test('multiple deposits append movements and increase the customer-owned balance', () => {
  const balance = createBalance();
  applyCustomerDepositMovement(balance, {
    type: 'DEPOSIT',
    amountUGX: 500_000,
    recordedBy: userId,
    notes: 'Initial safekeeping deposit',
  });
  const firstMovementSnapshot = { ...balance.ledger[0] };
  applyCustomerDepositMovement(balance, {
    type: 'DEPOSIT',
    amountUGX: 100_000,
    recordedBy: userId,
  });

  assert.equal(balance.totalDepositedUGX, 600_000);
  assert.equal(balance.currentBalanceUGX, 600_000);
  assert.equal(balance.ledger.length, 2);
  assert.deepEqual(balance.ledger[0], firstMovementSnapshot);
  assert.deepEqual(balance.ledger.map((item) => item.balanceAfterTransactionUGX), [500_000, 600_000]);
});

test('partial withdrawal records the example balance without changing deposit history', () => {
  const balance = createBalance();
  applyCustomerDepositMovement(balance, { type: 'DEPOSIT', amountUGX: 500_000, recordedBy: userId });
  const depositSnapshot = { ...balance.ledger[0] };
  applyCustomerDepositMovement(balance, { type: 'WITHDRAWAL', amountUGX: 200_000, recordedBy: userId });

  assert.equal(balance.totalDepositedUGX, 500_000);
  assert.equal(balance.totalWithdrawnUGX, 200_000);
  assert.equal(balance.currentBalanceUGX, 300_000);
  assert.equal(balance.ledger[1].type, 'WITHDRAWAL');
  assert.equal(balance.ledger[1].balanceAfterTransactionUGX, 300_000);
  assert.deepEqual(balance.ledger[0], depositSnapshot);
});

test('full withdrawal reaches zero and keeps the complete movement ledger', () => {
  const balance = createBalance();
  applyCustomerDepositMovement(balance, { type: 'DEPOSIT', amountUGX: 500_000, recordedBy: userId });
  applyCustomerDepositMovement(balance, { type: 'WITHDRAWAL', amountUGX: 200_000, recordedBy: userId });
  applyCustomerDepositMovement(balance, { type: 'WITHDRAWAL', amountUGX: 300_000, recordedBy: userId });

  assert.equal(balance.currentBalanceUGX, 0);
  assert.equal(balance.totalWithdrawnUGX, 500_000);
  assert.equal(balance.ledger.length, 3);
  assert.equal(balance.ledger[2].balanceAfterTransactionUGX, 0);
});

test('insufficient balance and invalid UGX amounts are rejected without a movement', () => {
  const balance = createBalance();
  applyCustomerDepositMovement(balance, { type: 'DEPOSIT', amountUGX: 500_000, recordedBy: userId });
  const before = JSON.stringify(balance);

  assert.throws(
    () => applyCustomerDepositMovement(balance, { type: 'WITHDRAWAL', amountUGX: 500_001, recordedBy: userId }),
    /cannot exceed/
  );
  assert.equal(JSON.stringify(balance), before);
  assert.throws(
    () => applyCustomerDepositMovement(balance, { type: 'DEPOSIT', amountUGX: -1, recordedBy: userId }),
    /positive whole UGX/
  );
  assert.throws(
    () => applyCustomerDepositMovement(balance, { type: 'WITHDRAWAL', amountUGX: 1.5, recordedBy: userId }),
    /positive whole UGX/
  );
});

test('request and model validation enforce whole UGX and consistent balances', async () => {
  assert.equal(recordCustomerDepositSchema.safeParse({ body: { customerName: 'Customer', phone: '256700000000', amountUGX: -1 } }).success, false);
  assert.equal(recordCustomerWithdrawalSchema.safeParse({ params: { id: 'id' }, body: { amountUGX: 1.5 } }).success, false);

  const inconsistent = new CustomerDeposit({
    customerName: 'Customer',
    phone: '256700000000',
    totalDepositedUGX: 500_000,
    totalWithdrawnUGX: 200_000,
    currentBalanceUGX: 500_000,
    createdBy: userId,
  });
  await assert.rejects(inconsistent.validate(), /Current balance/);
});

test('unknown and unauthenticated roles cannot invoke deposit mutations', () => {
  const middleware = authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER);
  let unauthenticatedError: any;
  middleware({} as any, {} as any, (error?: any) => { unauthenticatedError = error; });
  assert.equal(unauthenticatedError?.statusCode, 401);

  let unauthorizedError: any;
  middleware(
    { user: { id: 'id', name: 'Unknown', email: 'unknown@example.com', role: 'UNKNOWN' } } as any,
    {} as any,
    (error?: any) => { unauthorizedError = error; }
  );
  assert.equal(unauthorizedError?.statusCode, 403);
});

test('business reporting and dashboard aggregation do not import customer deposits', () => {
  const reportController = readFileSync(require.resolve('../controllers/report.controller'), 'utf8');
  const dashboardController = readFileSync(require.resolve('../controllers/dashboard.controller'), 'utf8');
  assert.doesNotMatch(reportController, /CustomerDeposit|customer-deposits/);
  assert.doesNotMatch(dashboardController, /CustomerDeposit|customer-deposits/);
});
