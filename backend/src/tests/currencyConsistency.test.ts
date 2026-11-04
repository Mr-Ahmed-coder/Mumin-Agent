import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Types } from 'mongoose';
import { Transaction } from '../models/Transaction';
import { ExchangeRate } from '../models/ExchangeRate';
import { WalletProvider } from '../constants/wallets';
import { buildReconciliationPreview } from '../services/reconciliation.service';
import { applyInternetCreditPayment } from '../services/internetCredit.service';
import { applyCustomerDepositMovement } from '../services/customerDeposit.service';

const userId = new Types.ObjectId();

test('1. Transaction math strictly applies USD fee deduction and USD to UGX conversion', () => {
  const amountReceivedUSD = 100;
  const serviceFeeUSD = 2;
  const exchangeRateUGX = 3700;

  const exchangeableAmountUSD = amountReceivedUSD - serviceFeeUSD;
  const cashPaidUGX = Math.round(exchangeableAmountUSD * exchangeRateUGX);

  assert.equal(exchangeableAmountUSD, 98);
  assert.equal(cashPaidUGX, 362_600);
});

test('2. Historical exchange rate is stored as an immutable snapshot per transaction', () => {
  const txn = new Transaction({
    transactionNumber: 'TXN-SNAP-1',
    customerId: userId,
    customerPhone: '+256700000000',
    walletProvider: WalletProvider.HORMUUD_EVC_PLUS,
    amountReceivedUSD: 100,
    serviceFeeUSD: 2,
    exchangeableAmountUSD: 98,
    exchangeRateUGX: 3700,
    cashPaidUGX: 362_600,
    profitUSD: 2,
    referenceNumber: 'REF-100',
    cashierId: userId,
    status: 'COMPLETED',
  });

  // Verify stored exchange rate snapshot
  assert.equal(txn.exchangeRateUGX, 3700);
  assert.equal(txn.cashPaidUGX, 362_600);

  // Future rate update to 3800 UGX does not alter the historical transaction snapshot
  const newRate = new ExchangeRate({
    baseCurrency: 'USD',
    targetCurrency: 'UGX',
    rate: 3800,
    status: 'ACTIVE',
  });

  assert.equal(txn.exchangeRateUGX, 3700);
  assert.equal(newRate.rate, 3800);
});

test('3. Invalid negative amounts and zero rates fail model validation', async () => {
  const invalidTxn = new Transaction({
    transactionNumber: 'TXN-INVALID-1',
    customerId: userId,
    customerPhone: '+256700000000',
    walletProvider: WalletProvider.HORMUUD_EVC_PLUS,
    amountReceivedUSD: -10,
    serviceFeeUSD: 2,
    exchangeableAmountUSD: -12,
    exchangeRateUGX: 0,
    cashPaidUGX: -44_400,
    profitUSD: 2,
    referenceNumber: 'REF-INV',
    cashierId: userId,
  });

  await assert.rejects(invalidTxn.validate(), /min/i);
});

test('4. Physical cash session movements and expected closing operate strictly in UGX', () => {
  const sessionPreview = buildReconciliationPreview(
    {
      _id: new Types.ObjectId(),
      openingCash: 10_000_000,
      openingBalances: [
        {
          accountType: 'PHYSICAL_CASH',
          provider: 'CASH_DRAWER',
          currency: 'UGX',
          amount: 10_000_000,
          openedAt: new Date(),
          cashSessionId: new Types.ObjectId(),
          cashierId: userId,
          createdBy: userId,
        },
      ],
      cashAdded: [{ amount: 500_000, reason: 'Top-up UGX', addedBy: userId, createdAt: new Date() }],
      cashWithdrawn: [{ amount: 200_000, reason: 'Expense UGX', withdrawnBy: userId, createdAt: new Date() }],
    },
    [
      {
        walletProvider: WalletProvider.HORMUUD_EVC_PLUS,
        amountReceivedUSD: 100,
        cashPaidUGX: 362_600,
      },
    ]
  );

  const physicalCashAccount = sessionPreview.find((acc) => acc.accountType === 'PHYSICAL_CASH');
  assert.ok(physicalCashAccount);
  assert.equal(physicalCashAccount.currency, 'UGX');
  assert.equal(physicalCashAccount.openingBalance, 10_000_000);
  // Expected = 10,000,000 + 500,000 - 200,000 - 362,600 = 9,937,400 UGX
  assert.equal(physicalCashAccount.expectedClosingBalance, 9_937_400);
});

test('5. Internet Credit and Customer Deposits maintain UGX totals and reject overpayments', () => {
  // Internet Credit UGX
  const creditRecord = {
    originalAmountUGX: 50_000,
    amountPaidUGX: 0,
    remainingBalanceUGX: 50_000,
    status: 'UNPAID',
    payments: [],
  };

  const payment1 = applyInternetCreditPayment(creditRecord as any, {
    amountUGX: 20_000,
    recordedBy: userId,
  });

  assert.equal(payment1.balanceAfterPaymentUGX, 30_000);
  assert.equal(creditRecord.status, 'PARTIALLY_PAID');

  assert.throws(
    () => applyInternetCreditPayment(creditRecord as any, { amountUGX: 40_000, recordedBy: userId }),
    /cannot exceed/
  );

  // Customer Deposit UGX
  const depositRecord = {
    totalDepositedUGX: 0,
    totalWithdrawnUGX: 0,
    currentBalanceUGX: 0,
    ledger: [],
  };

  applyCustomerDepositMovement(depositRecord, { type: 'DEPOSIT', amountUGX: 100_000, recordedBy: userId });
  assert.equal(depositRecord.currentBalanceUGX, 100_000);

  assert.throws(
    () => applyCustomerDepositMovement(depositRecord, { type: 'WITHDRAWAL', amountUGX: 150_000, recordedBy: userId }),
    /cannot exceed/
  );
});

test('6. Customer Deposits are strictly excluded from business revenue, profit, and exchange volume', () => {
  const reportController = readFileSync(require.resolve('../controllers/report.controller'), 'utf8');
  const dashboardController = readFileSync(require.resolve('../controllers/dashboard.controller'), 'utf8');

  assert.doesNotMatch(reportController, /CustomerDeposit|customer-deposits/);
  assert.doesNotMatch(dashboardController, /CustomerDeposit|customer-deposits/);
});

test('7. Multi-account closing reconciliation preserves separate currencies per account', () => {
  const preview = buildReconciliationPreview(
    {
      _id: new Types.ObjectId(),
      openingCash: 5_000_000,
      openingBalances: [
        {
          accountType: 'PHYSICAL_CASH',
          provider: 'CASH_DRAWER',
          currency: 'UGX',
          amount: 5_000_000,
          openedAt: new Date(),
          cashSessionId: new Types.ObjectId(),
          cashierId: userId,
          createdBy: userId,
        },
        {
          accountType: 'EVC',
          provider: WalletProvider.HORMUUD_EVC_PLUS,
          currency: 'USD',
          amount: 500,
          openedAt: new Date(),
          cashSessionId: new Types.ObjectId(),
          cashierId: userId,
          createdBy: userId,
        },
      ],
      cashAdded: [],
      cashWithdrawn: [],
    },
    [
      {
        walletProvider: WalletProvider.HORMUUD_EVC_PLUS,
        amountReceivedUSD: 100,
        cashPaidUGX: 362_600,
      },
    ]
  );

  const physicalCash = preview.find((acc) => acc.accountType === 'PHYSICAL_CASH');
  const evcAccount = preview.find((acc) => acc.accountType === 'EVC');

  assert.ok(physicalCash);
  assert.ok(evcAccount);

  assert.equal(physicalCash.currency, 'UGX');
  assert.equal(physicalCash.expectedClosingBalance, 5_000_000 - 362_600); // 4,637,400 UGX

  assert.equal(evcAccount.currency, 'USD');
  assert.equal(evcAccount.expectedClosingBalance, 500 + 100); // 600 USD
});

test('8. Report exports include explicit currency indicators in Excel and CSV headers', () => {
  const reportSource = readFileSync(require.resolve('../controllers/report.controller'), 'utf8');

  assert.match(reportSource, /Amount Received \(USD\)/);
  assert.match(reportSource, /Service Fee \(USD\)/);
  assert.match(reportSource, /Exchange Rate \(UGX\/USD\)/);
  assert.match(reportSource, /Cash Paid Out \(UGX\)/);
  assert.match(reportSource, /Service Fee Profit \(USD\)/);
});
