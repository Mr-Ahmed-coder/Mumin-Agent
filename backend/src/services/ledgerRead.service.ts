import { CashSession, ICashSession } from '../models/CashSession';
import { FinancialOperation } from '../models/FinancialOperation';
import { Transaction } from '../models/Transaction';
import { CustomerDeposit } from '../models/CustomerDeposit';
import { InternetCredit } from '../models/InternetCredit';
import { Expense } from '../models/Expense';
import { accountBalanceMinor } from './movementMath.service';
import { Types } from 'mongoose';

export async function ledgerMovementTotals(dates?: Record<string, Date>, cashierId?: string) {
  const shiftIds = cashierId ? await CashSession.distinct('_id', { cashierId: new Types.ObjectId(cashierId) }) : undefined;
  const rows = await FinancialOperation.aggregate<{
    _id: { accountId: string; currency: 'USD' | 'UGX'; category: string; direction: 'IN' | 'OUT' };
    totalMinor: number;
  }>([
    { $match: { ...(dates ? { occurredAt: dates } : {}), ...(shiftIds ? { shiftId: { $in: shiftIds } } : {}) } },
    { $unwind: '$legs' },
    { $group: { _id: { accountId: '$legs.accountId', currency: '$legs.currency', category: '$category', direction: '$legs.direction' },
      totalMinor: { $sum: '$legs.amountMinor' } } },
    { $sort: { '_id.accountId': 1, '_id.category': 1, '_id.direction': 1 } },
  ]);
  return rows.map(({ _id, totalMinor }) => ({ ..._id, amount: totalMinor / (_id.currency === 'USD' ? 100 : 1) }));
}

export async function readLedgerBalances(shift: ICashSession) {
  if (shift.ledgerVersion !== 1 || !shift.accountOpenings?.length) return undefined;
  const operations = await FinancialOperation.find({ shiftId: shift._id }).lean();
  const legs = operations.flatMap(operation => operation.legs);
  return shift.accountOpenings.map(account => ({
    id: account.id, name: account.name, kind: account.kind, currency: account.currency, amount: account.amount,
    balance: accountBalanceMinor(account.amount, account, legs) / (account.currency === 'USD' ? 100 : 1),
  }));
}

export async function ledgerMigrationDryRun() {
  const [historicalShifts, historicalTransactions, unlinkedExchanges, deposits, repayments, expenses] = await Promise.all([
    CashSession.countDocuments({ ledgerVersion: { $ne: 1 } }),
    Transaction.aggregate<{ _id: string; count: number }>([
      { $match: { operationId: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    FinancialOperation.countDocuments({
      category: { $in: ['WALLET_USD_TO_CASH_UGX', 'CASH_USD_TO_CASH_UGX'] }, transactionId: null,
    }),
    CustomerDeposit.countDocuments({ ledger: { $elemMatch: { operationId: null } } }),
    InternetCredit.countDocuments({ payments: { $elemMatch: { operationId: null } } }),
    Expense.countDocuments({ operationId: null }),
  ]);
  return {
    historicalShifts, historicalTransactions, unlinkedExchanges, imported: 0,
    profilesWithUnlinkedDepositMovements: deposits, creditsWithUnlinkedRepayments: repayments, unlinkedExpenses: expenses,
    blockers: [
      'Verify each historical receipt and payout against original account IDs, amounts, rates and reversals.',
      'Verify tender accounts for historical deposits, repayments and expenses before attributing movements.',
      'Review ledger-only exchanges and their reversals before linking them to transaction reports.',
    ],
  };
}
