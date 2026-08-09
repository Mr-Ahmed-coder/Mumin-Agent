import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { CashSession } from '../models/CashSession';
import { Customer } from '../models/Customer';
import { ExchangeRate } from '../models/ExchangeRate';
import { Expense } from '../models/Expense';
import { FeeRule } from '../models/FeeRule';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const resetDevelopmentData = asyncHandler(async (_req: Request, res: Response) => {
  if (env.NODE_ENV !== 'development') {
    throw ApiError.forbidden('Development data reset is unavailable outside development mode');
  }

  const transactions = await Transaction.deleteMany({});
  const customers = await Customer.deleteMany({});
  const cashSessions = await CashSession.deleteMany({});
  const expenses = await Expense.deleteMany({});
  const auditLogs = await AuditLog.deleteMany({});
  const feeRules = await FeeRule.deleteMany({});
  const exchangeRates = await ExchangeRate.deleteMany({});
  const refreshTokens = await User.updateMany({}, { $unset: { refreshTokenHash: 1 } });

  return ApiResponse.success(res, 'Development database reset complete', {
    deleted: {
      transactions: transactions.deletedCount,
      customers: customers.deletedCount,
      cashSessions: cashSessions.deletedCount,
      expenses: expenses.deletedCount,
      auditLogs: auditLogs.deletedCount,
      feeRules: feeRules.deletedCount,
      exchangeRates: exchangeRates.deletedCount,
    },
    refreshTokensCleared: refreshTokens.modifiedCount,
    usersPreserved: await User.countDocuments(),
  });
});
