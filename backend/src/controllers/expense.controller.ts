import { Request, Response } from 'express';
import { Expense } from '../models/Expense';
import { CashSession } from '../models/CashSession';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../constants/roles';
import { rejectExpandedLegacyWrite } from '../services/legacyMovementGuard.service';
import { useLedgerIntegration, postLegacyFinancialRequest } from '../services/legacyLedgerAdapter.service';

export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const query: any = {};
  if (req.user?.role === UserRole.CASHIER) {
    query.recordedBy = req.user.id;
  }

  const [expenses, total] = await Promise.all([
    Expense.find(query)
      .populate('recordedBy', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Expense.countDocuments(query),
  ]);

  return ApiResponse.success(res, 'Expenses retrieved', expenses, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  if (useLedgerIntegration()) return ApiResponse.created(res, 'Expense and cash movement recorded', await postLegacyFinancialRequest(req, 'EXPENSE'));
  await rejectExpandedLegacyWrite(req.user?.id);
  const { title, amount, category, notes } = req.body;
  const recordedBy = req.user?.id;

  const activeSession = await CashSession.findOne({ cashierId: recordedBy, status: 'OPEN' });

  if (req.user?.role === UserRole.CASHIER && !activeSession) {
    throw ApiError.badRequest('You must have an active open cash shift to record shop expenses.');
  }

  const expense = await Expense.create({
    title,
    amount,
    category: category || 'MISC',
    cashSessionId: activeSession ? activeSession._id : undefined,
    recordedBy,
    notes,
  });

  return ApiResponse.created(res, 'Expense recorded successfully', expense);
});
