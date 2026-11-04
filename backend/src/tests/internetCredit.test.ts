import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { UserRole } from '../constants/roles';
import { createInternetCreditSchema, recordInternetCreditPaymentSchema } from '../dtos/internetCredit.dto';
import { authorize } from '../middlewares/auth';
import { InternetCredit } from '../models/InternetCredit';
import {
  applyInternetCreditPayment,
  InternetCreditPaymentTarget,
} from '../services/internetCredit.service';

const userId = new Types.ObjectId();
const createCredit = (): InternetCreditPaymentTarget => ({
  originalAmountUGX: 20_000,
  amountPaidUGX: 0,
  remainingBalanceUGX: 20_000,
  status: 'UNPAID',
  payments: [],
});

test('partial repayment updates totals, status, balance and ledger', () => {
  const credit = createCredit();
  applyInternetCreditPayment(credit, {
    amountUGX: 5_000,
    recordedBy: userId,
    paidAt: new Date('2026-08-19T10:00:00.000Z'),
    notes: 'First payment',
  });

  assert.equal(credit.amountPaidUGX, 5_000);
  assert.equal(credit.remainingBalanceUGX, 15_000);
  assert.equal(credit.status, 'PARTIALLY_PAID');
  assert.deepEqual(
    credit.payments.map((payment) => ({ amount: payment.amountUGX, balance: payment.balanceAfterPaymentUGX })),
    [{ amount: 5_000, balance: 15_000 }]
  );
});

test('full repayment marks the credit paid without overwriting prior payments', () => {
  const credit = createCredit();
  applyInternetCreditPayment(credit, { amountUGX: 5_000, recordedBy: userId });
  const firstPaymentSnapshot = { ...credit.payments[0] };
  applyInternetCreditPayment(credit, { amountUGX: 15_000, recordedBy: userId });

  assert.equal(credit.amountPaidUGX, 20_000);
  assert.equal(credit.remainingBalanceUGX, 0);
  assert.equal(credit.status, 'PAID');
  assert.equal(credit.payments.length, 2);
  assert.deepEqual(credit.payments[0], firstPaymentSnapshot);
  assert.equal(credit.payments[1].balanceAfterPaymentUGX, 0);
});

test('negative, fractional, overpayment and payment on paid credit are rejected', () => {
  assert.throws(() => applyInternetCreditPayment(createCredit(), { amountUGX: -1, recordedBy: userId }), /positive whole UGX/);
  assert.throws(() => applyInternetCreditPayment(createCredit(), { amountUGX: 1.5, recordedBy: userId }), /positive whole UGX/);
  assert.throws(() => applyInternetCreditPayment(createCredit(), { amountUGX: 20_001, recordedBy: userId }), /cannot exceed/);

  const paid = createCredit();
  applyInternetCreditPayment(paid, { amountUGX: 20_000, recordedBy: userId });
  assert.throws(() => applyInternetCreditPayment(paid, { amountUGX: 1, recordedBy: userId }), /cannot receive additional/);
});

test('request and model validation enforce whole positive UGX and balance consistency', async () => {
  assert.equal(createInternetCreditSchema.safeParse({ body: { customerName: 'Customer', amountUGX: -1 } }).success, false);
  assert.equal(recordInternetCreditPaymentSchema.safeParse({ params: { id: 'id' }, body: { amountUGX: 2.5 } }).success, false);

  const inconsistent = new InternetCredit({
    customerName: 'Customer',
    originalAmountUGX: 20_000,
    amountPaidUGX: 5_000,
    remainingBalanceUGX: 20_000,
    status: 'UNPAID',
    createdBy: userId,
  });
  await assert.rejects(inconsistent.validate(), /Remaining balance|Status/);
});

test('unknown and unauthenticated roles cannot invoke Internet Credit mutation authorization', () => {
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
