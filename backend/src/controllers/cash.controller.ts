import { Request, Response } from 'express';
import { CashSession } from '../models/CashSession';
import { Transaction } from '../models/Transaction';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../constants/roles';

const cashPaidUGX = (transaction: any): number =>
  transaction.cashPaidUGX ?? transaction.cashPaid ?? 0;

export const getCurrentCashSession = asyncHandler(async (req: Request, res: Response) => {
  const cashierId = req.user?.id;
  const activeSession = await CashSession.findOne({ cashierId, status: 'OPEN' });

  if (!activeSession) {
    return ApiResponse.success(res, 'No active cash session', null);
  }

  // Calculate current system balance live
  const transactions = await Transaction.find({
    cashSessionId: activeSession._id,
    status: 'COMPLETED',
  });

  const totalCashPaidOut = transactions.reduce((acc, t) => acc + cashPaidUGX(t), 0);
  const totalCashAdded = activeSession.cashAdded.reduce((acc, a) => acc + a.amount, 0);
  const totalCashWithdrawn = activeSession.cashWithdrawn.reduce((acc, a) => acc + a.amount, 0);

  const currentCashBalance =
    activeSession.openingCash + totalCashAdded - totalCashWithdrawn - totalCashPaidOut;

  return ApiResponse.success(res, 'Active cash session retrieved', {
    ...activeSession.toObject(),
    currentCashBalance,
    totalTransactionsCount: transactions.length,
    totalCashPaidOut,
    totalCashAdded,
    totalCashWithdrawn,
  });
});

export const getCashSessionById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = await CashSession.findById(id)
    .populate('cashierId', 'name email role')
    .populate('cashAdded.addedBy', 'name')
    .populate('cashWithdrawn.withdrawnBy', 'name');

  if (!session) {
    throw ApiError.notFound('Cash session not found');
  }

  const transactions = await Transaction.find({ cashSessionId: session._id })
    .populate('customerId', 'name phone')
    .sort({ createdAt: -1 });

  const totalCashPaidOut = transactions
    .filter((t) => t.status === 'COMPLETED')
    .reduce((acc, t) => acc + cashPaidUGX(t), 0);

  const totalCashAdded = session.cashAdded.reduce((acc, a) => acc + a.amount, 0);
  const totalCashWithdrawn = session.cashWithdrawn.reduce((acc, a) => acc + a.amount, 0);
  const expectedClosingCash =
    session.openingCash + totalCashAdded - totalCashWithdrawn - totalCashPaidOut;

  return ApiResponse.success(res, 'Cash session details retrieved', {
    session,
    transactions,
    totalCashPaidOut,
    totalCashAdded,
    totalCashWithdrawn,
    expectedClosingCash,
  });
});

export const openCashSession = asyncHandler(async (req: Request, res: Response) => {
  const cashierId = req.user?.id;
  const openingCash = Number(req.body.openingCash);

  if (isNaN(openingCash) || openingCash < 0) {
    throw ApiError.badRequest('Opening cash (UGX) must be a non-negative whole amount');
  }

  const existing = await CashSession.findOne({ cashierId, status: 'OPEN' });

  if (existing) {
    throw ApiError.badRequest('You already have an open cash session. Please close it first.');
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const sessionNumber = `CS-${dateStr}-${randomSuffix}`;

  const session = await CashSession.create({
    cashierId,
    sessionNumber,
    currency: 'UGX',
    openingCash,
    closingCashSystem: openingCash,
    notes: req.body.notes,
  });

  return ApiResponse.created(res, 'Cash session opened successfully', session);
});

export const addCashToSession = asyncHandler(async (req: Request, res: Response) => {
  const cashierId = req.user?.id;
  const amount = Number(req.body.amount);

  if (isNaN(amount) || amount <= 0) {
    throw ApiError.badRequest('Cash added (UGX) must be a positive whole amount');
  }

  const session = await CashSession.findOne({ cashierId, status: 'OPEN' });

  if (!session) {
    throw ApiError.badRequest('No active open cash session found');
  }

  session.cashAdded.push({
    amount,
    reason: req.body.reason,
    addedBy: cashierId as any,
    createdAt: new Date(),
  });

  await session.save();
  return ApiResponse.success(res, 'Cash added to session successfully', session);
});

export const withdrawCashFromSession = asyncHandler(async (req: Request, res: Response) => {
  const cashierId = req.user?.id;
  const amount = Number(req.body.amount);

  if (isNaN(amount) || amount <= 0) {
    throw ApiError.badRequest('Cash withdrawn (UGX) must be a positive whole amount');
  }

  const session = await CashSession.findOne({ cashierId, status: 'OPEN' });

  if (!session) {
    throw ApiError.badRequest('No active open cash session found');
  }

  session.cashWithdrawn.push({
    amount,
    reason: req.body.reason,
    withdrawnBy: cashierId as any,
    createdAt: new Date(),
  });

  await session.save();
  return ApiResponse.success(res, 'Cash withdrawn from session successfully', session);
});

export const closeCashSession = asyncHandler(async (req: Request, res: Response) => {
  const cashierId = req.user?.id;
  const closingCashActual = Number(req.body.closingCashActual);

  if (isNaN(closingCashActual) || closingCashActual < 0) {
    throw ApiError.badRequest('Actual closing cash (UGX) must be a non-negative whole amount');
  }

  const session = await CashSession.findOne({ cashierId, status: 'OPEN' });

  if (!session) {
    throw ApiError.badRequest('No active open cash session found');
  }

  const transactions = await Transaction.find({
    cashSessionId: session._id,
    status: 'COMPLETED',
  });

  const totalCashPaidOut = transactions.reduce((acc, t) => acc + cashPaidUGX(t), 0);
  const totalCashAdded = session.cashAdded.reduce((acc, a) => acc + a.amount, 0);
  const totalCashWithdrawn = session.cashWithdrawn.reduce((acc, a) => acc + a.amount, 0);

  const closingCashSystem =
    session.openingCash + totalCashAdded - totalCashWithdrawn - totalCashPaidOut;
  const discrepancy = closingCashActual - closingCashSystem;

  session.status = 'CLOSED';
  session.closingCashSystem = closingCashSystem;
  session.closingCashActual = closingCashActual;
  session.discrepancy = discrepancy;
  session.closedAt = new Date();
  if (req.body.notes) session.notes = req.body.notes;

  await session.save();

  return ApiResponse.success(res, 'Cash session closed and reconciled successfully', session);
});

export const reopenCashSession = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = await CashSession.findById(id);

  if (!session) {
    throw ApiError.notFound('Cash session not found');
  }

  if (session.status === 'OPEN') {
    throw ApiError.badRequest('Session is already open');
  }

  // Check if cashier already has another open session
  const activeSession = await CashSession.findOne({ cashierId: session.cashierId, status: 'OPEN' });
  if (activeSession) {
    throw ApiError.badRequest('The cashier already has another active open cash session.');
  }

  session.status = 'OPEN';
  session.closedAt = undefined;
  session.closingCashActual = undefined;
  session.discrepancy = 0;
  await session.save();

  return ApiResponse.success(res, 'Cash session reopened successfully', session);
});

export const getCashSessionsList = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    CashSession.find()
      .populate('cashierId', 'name email role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    CashSession.countDocuments(),
  ]);

  return ApiResponse.success(res, 'Cash sessions list retrieved', sessions, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});
