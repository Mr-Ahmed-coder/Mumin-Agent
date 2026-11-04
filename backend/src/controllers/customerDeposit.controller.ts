import { Request, Response } from 'express';
import { CustomerDeposit } from '../models/CustomerDeposit';
import { CashSession } from '../models/CashSession';
import { AuditLog } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { UserRole } from '../constants/roles';
import { Types } from 'mongoose';
import { applyCustomerDepositMovement } from '../services/customerDeposit.service';
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

const saveWithConcurrencyMessage = async (record: InstanceType<typeof CustomerDeposit>) => {
  try {
    await record.save();
  } catch (error) {
    if ((error as any)?.name === 'VersionError') {
      throw ApiError.badRequest(
        'This customer balance changed while the movement was being recorded. Reload and try again.'
      );
    }
    throw error;
  }
};

export const listCustomerDeposits = asyncHandler(async (req: Request, res: Response) => {
  const search = String(req.query.search || '').trim();
  const safeSearch = escapeRegex(search);
  const query = search
    ? { $or: [{ customerName: { $regex: safeSearch, $options: 'i' } }, { phone: { $regex: safeSearch, $options: 'i' } }] }
    : {};

  const [records, totals] = await Promise.all([
    CustomerDeposit.find(query)
      .populate('createdBy', 'name email role')
      .populate('ledger.recordedBy', 'name email role')
      .sort({ updatedAt: -1 }),
    CustomerDeposit.aggregate([
      { $group: { _id: null, deposited: { $sum: '$totalDepositedUGX' }, withdrawn: { $sum: '$totalWithdrawnUGX' }, held: { $sum: '$currentBalanceUGX' } } },
    ]),
  ]);

  return ApiResponse.success(res, 'Customer deposits retrieved', {
    records,
    summary: totals[0] || { deposited: 0, withdrawn: 0, held: 0 },
  });
});

export const getCustomerDeposit = asyncHandler(async (req: Request, res: Response) => {
  const record = await CustomerDeposit.findById(req.params.id)
    .populate('createdBy', 'name email role')
    .populate('ledger.recordedBy', 'name email role');
  if (!record) throw ApiError.notFound('Customer deposit profile not found');
  return ApiResponse.success(res, 'Customer deposit profile retrieved', record);
});

export const recordCustomerDeposit = asyncHandler(async (req: Request, res: Response) => {
  if (useLedgerIntegration()) return ApiResponse.created(res, 'Deposit and cash movement recorded', await postLegacyFinancialRequest(req, 'CUSTOMER_DEPOSIT'));
  await rejectExpandedLegacyWrite(req.user?.id);
  if (req.user?.role === UserRole.CASHIER) {
    const activeSession = await CashSession.findOne({ cashierId: req.user.id, status: 'OPEN' });
    if (!activeSession) {
      throw ApiError.badRequest('You must have an active open cash shift to record customer deposits.');
    }
  }

  const amountUGX = Number(req.body.amountUGX);
  const phone = String(req.body.phone).trim();
  let record = await CustomerDeposit.findOne({ phone });

  if (!record) {
    const newRecord = {
      customerName: req.body.customerName,
      phone,
      totalDepositedUGX: 0,
      totalWithdrawnUGX: 0,
      currentBalanceUGX: 0,
      notes: req.body.notes,
      createdBy: req.user?.id,
      ledger: [],
    };
    applyCustomerDepositMovement(newRecord, {
      type: 'DEPOSIT',
      amountUGX,
      recordedBy: new Types.ObjectId(req.user?.id),
      notes: req.body.notes,
    });
    record = await CustomerDeposit.create(newRecord);
  } else {
    record.customerName = req.body.customerName;
    if (req.body.notes) record.notes = req.body.notes;
    applyCustomerDepositMovement(record, {
      type: 'DEPOSIT',
      amountUGX,
      recordedBy: new Types.ObjectId(req.user?.id),
      notes: req.body.notes,
    });
    await saveWithConcurrencyMessage(record);
  }

  await AuditLog.create({
    ...auditContext(req),
    action: 'CUSTOMER_DEPOSIT_RECORDED',
    resource: 'customer-deposits',
    resourceId: String(record._id),
    details: { customerName: record.customerName, amountUGX, currentBalanceUGX: record.currentBalanceUGX, currency: 'UGX' },
  });

  return ApiResponse.created(res, 'Customer deposit recorded successfully', record);
});

export const recordCustomerWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  if (useLedgerIntegration()) return ApiResponse.success(res, 'Withdrawal and cash movement recorded', await postLegacyFinancialRequest(req, 'CUSTOMER_WITHDRAWAL'));
  await rejectExpandedLegacyWrite(req.user?.id);
  if (req.user?.role === UserRole.CASHIER) {
    const activeSession = await CashSession.findOne({ cashierId: req.user.id, status: 'OPEN' });
    if (!activeSession) {
      throw ApiError.badRequest('You must have an active open cash shift to record customer deposit withdrawals.');
    }
  }

  const amountUGX = Number(req.body.amountUGX);
  const record = await CustomerDeposit.findById(req.params.id);
  if (!record) throw ApiError.notFound('Customer deposit profile not found');
  const movement = applyCustomerDepositMovement(record, {
    type: 'WITHDRAWAL',
    amountUGX,
    recordedBy: new Types.ObjectId(req.user?.id),
    notes: req.body.notes,
  });
  await saveWithConcurrencyMessage(record);

  await AuditLog.create({
    ...auditContext(req),
    action: 'CUSTOMER_WITHDRAWAL_RECORDED',
    resource: 'customer-deposits',
    resourceId: String(record._id),
    details: { amountUGX, currentBalanceUGX: movement.balanceAfterTransactionUGX, currency: 'UGX' },
  });

  return ApiResponse.success(res, 'Customer withdrawal recorded successfully', record);
});
