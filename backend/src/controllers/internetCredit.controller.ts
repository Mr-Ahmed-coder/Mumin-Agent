import { Request, Response } from 'express';
import { InternetCredit } from '../models/InternetCredit';
import { AuditLog } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';

const auditContext = (req: Request) => ({
  userId: req.user?.id,
  userName: req.user?.name,
  userRole: req.user?.role,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

export const listInternetCredits = asyncHandler(async (req: Request, res: Response) => {
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const query: Record<string, any> = {};

  if (search) {
    query.$or = [
      { customerName: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  if (status) query.status = status;

  const [records, totals] = await Promise.all([
    InternetCredit.find(query)
      .populate('createdBy', 'name email role')
      .populate('payments.recordedBy', 'name email role')
      .sort({ dateGiven: -1, createdAt: -1 }),
    InternetCredit.aggregate([
      { $group: { _id: null, original: { $sum: '$originalAmountUGX' }, paid: { $sum: '$amountPaidUGX' }, outstanding: { $sum: '$remainingBalanceUGX' } } },
    ]),
  ]);

  return ApiResponse.success(res, 'Internet credits retrieved', {
    records,
    summary: totals[0] || { original: 0, paid: 0, outstanding: 0 },
  });
});

export const getInternetCredit = asyncHandler(async (req: Request, res: Response) => {
  const record = await InternetCredit.findById(req.params.id)
    .populate('createdBy', 'name email role')
    .populate('payments.recordedBy', 'name email role');
  if (!record) throw ApiError.notFound('Internet credit record not found');
  return ApiResponse.success(res, 'Internet credit retrieved', record);
});

export const createInternetCredit = asyncHandler(async (req: Request, res: Response) => {
  const amountUGX = Number(req.body.amountUGX);
  const record = await InternetCredit.create({
    customerName: req.body.customerName,
    phone: req.body.phone || undefined,
    originalAmountUGX: amountUGX,
    amountPaidUGX: 0,
    remainingBalanceUGX: amountUGX,
    description: req.body.description,
    dateGiven: req.body.dateGiven ? new Date(req.body.dateGiven) : new Date(),
    status: 'UNPAID',
    createdBy: req.user?.id,
  });

  await AuditLog.create({
    ...auditContext(req),
    action: 'INTERNET_CREDIT_CREATED',
    resource: 'internet-credits',
    resourceId: String(record._id),
    details: { customerName: record.customerName, amountUGX, currency: 'UGX' },
  });

  return ApiResponse.created(res, 'Internet credit created successfully', record);
});

export const recordInternetCreditPayment = asyncHandler(async (req: Request, res: Response) => {
  const amountUGX = Number(req.body.amountUGX);
  const record = await InternetCredit.findById(req.params.id);
  if (!record) throw ApiError.notFound('Internet credit record not found');
  if (record.status === 'PAID' || record.remainingBalanceUGX === 0) {
    throw ApiError.badRequest('Paid internet credit records cannot receive additional payments');
  }
  if (amountUGX > record.remainingBalanceUGX) {
    throw ApiError.badRequest('Payment cannot exceed the remaining UGX balance');
  }

  const newPaid = record.amountPaidUGX + amountUGX;
  const newRemaining = record.originalAmountUGX - newPaid;
  record.amountPaidUGX = newPaid;
  record.remainingBalanceUGX = newRemaining;
  record.status = newRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
  record.payments.push({
    amountUGX,
    paidAt: new Date(),
    recordedBy: req.user?.id as any,
    notes: req.body.notes,
    balanceAfterPaymentUGX: newRemaining,
  });
  await record.save();

  await AuditLog.create({
    ...auditContext(req),
    action: 'INTERNET_CREDIT_PAYMENT_RECORDED',
    resource: 'internet-credits',
    resourceId: String(record._id),
    details: { amountUGX, remainingBalanceUGX: newRemaining, status: record.status, currency: 'UGX' },
  });

  return ApiResponse.success(res, 'Internet credit payment recorded successfully', record);
});
