import { Request, Response } from 'express';
import { Expense } from '../models/Expense';
import { CashSession } from '../models/CashSession';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';

export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    Expense.find()
      .populate('recordedBy', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Expense.countDocuments(),
  ]);

  return ApiResponse.success(res, 'Expenses retrieved', expenses, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const { title, amount, category, notes } = req.body;
  const recordedBy = req.user?.id;

  const activeSession = await CashSession.findOne({ cashierId: recordedBy, status: 'OPEN' });

  const expense = await Expense.create({
    title,
    amount,
    category,
    cashSessionId: activeSession ? activeSession._id : undefined,
    recordedBy,
    notes,
  });

  return ApiResponse.created(res, 'Expense recorded successfully', expense);
});
