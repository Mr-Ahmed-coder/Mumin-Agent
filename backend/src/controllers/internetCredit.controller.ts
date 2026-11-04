import { Request, Response } from 'express';
import { InternetCredit } from '../models/InternetCredit';
import { CashSession } from '../models/CashSession';
import { AuditLog } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { UserRole } from '../constants/roles';
import { Types } from 'mongoose';
import { applyInternetCreditPayment } from '../services/internetCredit.service';
import { rejectExpandedLegacyWrite } from '../services/legacyMovementGuard.service';
import { useLedgerIntegration, postLegacyFinancialRequest } from '../services/legacyLedgerAdapter.service';

const auditContext = (req: Request) => ({
  userId: req.user?.id,
  userName: req.user?.name,
  userRole: req.user?.role,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listInternetCredits = asyncHandler(async (req: Request, res: Response) => {
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const query: Record<string, any> = {};

  if (search) {
    const safeSearch = escapeRegex(search);
    query.$or = [
      { customerName: { $regex: safeSearch, $options: 'i' } },
      { phone: { $regex: safeSearch, $options: 'i' } },
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

export const getCustomerInternetCreditHistory = asyncHandler(async (req: Request, res: Response) => {
  const phone = String(req.query.phone || '').trim();
  const customerName = String(req.query.customerName || '').trim();
  const identityQuery = phone
    ? { phone }
    : { customerName: { $regex: `^${escapeRegex(customerName)}$`, $options: 'i' } };

  const records = await InternetCredit.find(identityQuery)
    .populate('createdBy', 'name email role')
    .populate('payments.recordedBy', 'name email role')
    .sort({ dateGiven: -1, createdAt: -1 });

  const summary = records.reduce(
    (totals, record) => ({
      original: totals.original + record.originalAmountUGX,
      paid: totals.paid + record.amountPaidUGX,
      outstanding: totals.outstanding + record.remainingBalanceUGX,
    }),
    { original: 0, paid: 0, outstanding: 0 }
  );

  return ApiResponse.success(res, 'Customer internet credit history retrieved', {
    identity: phone ? { phone } : { customerName },
    records,
    summary,
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
  if (req.user?.role === UserRole.CASHIER) {
    const activeSession = await CashSession.findOne({ cashierId: req.user.id, status: 'OPEN' });
    if (!activeSession) {
      throw ApiError.badRequest('You must have an active open cash shift to issue internet credit.');
    }
  }

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
  if (useLedgerIntegration()) return ApiResponse.success(res, 'Repayment and cash movement recorded', await postLegacyFinancialRequest(req, 'CREDIT_REPAYMENT'));
  await rejectExpandedLegacyWrite(req.user?.id);
  if (req.user?.role === UserRole.CASHIER) {
    const activeSession = await CashSession.findOne({ cashierId: req.user.id, status: 'OPEN' });
    if (!activeSession) {
      throw ApiError.badRequest('You must have an active open cash shift to record internet credit repayments.');
    }
  }

  const amountUGX = Number(req.body.amountUGX);
  const record = await InternetCredit.findById(req.params.id);
  if (!record) throw ApiError.notFound('Internet credit record not found');

  const payment = applyInternetCreditPayment(record, {
    amountUGX,
    recordedBy: new Types.ObjectId(req.user?.id),
    notes: req.body.notes,
  });
  try {
    await record.save();
  } catch (error) {
    if ((error as any)?.name === 'VersionError') {
      throw ApiError.badRequest('This credit changed while the payment was being recorded. Reload and try again.');
    }
    throw error;
  }

  await AuditLog.create({
    ...auditContext(req),
    action: 'INTERNET_CREDIT_PAYMENT_RECORDED',
    resource: 'internet-credits',
    resourceId: String(record._id),
    details: {
      amountUGX,
      remainingBalanceUGX: payment.balanceAfterPaymentUGX,
      status: record.status,
      currency: 'UGX',
    },
  });

  return ApiResponse.success(res, 'Internet credit payment recorded successfully', record);
});
