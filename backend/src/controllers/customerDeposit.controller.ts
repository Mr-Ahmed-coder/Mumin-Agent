import { Request, Response } from 'express';
import { CustomerDeposit } from '../models/CustomerDeposit';
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

export const listCustomerDeposits = asyncHandler(async (req: Request, res: Response) => {
  const search = String(req.query.search || '').trim();
  const query = search
    ? { $or: [{ customerName: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }] }
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
  const amountUGX = Number(req.body.amountUGX);
  const phone = String(req.body.phone).trim();
  let record = await CustomerDeposit.findOne({ phone });

  if (!record) {
    record = await CustomerDeposit.create({
      customerName: req.body.customerName,
      phone,
      totalDepositedUGX: amountUGX,
      totalWithdrawnUGX: 0,
      currentBalanceUGX: amountUGX,
      notes: req.body.notes,
      createdBy: req.user?.id,
      ledger: [{
        type: 'DEPOSIT',
        amountUGX,
        occurredAt: new Date(),
        recordedBy: req.user?.id,
        notes: req.body.notes,
        balanceAfterTransactionUGX: amountUGX,
      }],
    });
  } else {
    const newBalance = record.currentBalanceUGX + amountUGX;
    record.customerName = req.body.customerName;
    record.totalDepositedUGX += amountUGX;
    record.currentBalanceUGX = newBalance;
    if (req.body.notes) record.notes = req.body.notes;
    record.ledger.push({
      type: 'DEPOSIT',
      amountUGX,
      occurredAt: new Date(),
      recordedBy: req.user?.id as any,
      notes: req.body.notes,
      balanceAfterTransactionUGX: newBalance,
    });
    await record.save();
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
  const amountUGX = Number(req.body.amountUGX);
  const record = await CustomerDeposit.findById(req.params.id);
  if (!record) throw ApiError.notFound('Customer deposit profile not found');
  if (amountUGX > record.currentBalanceUGX) {
    throw ApiError.badRequest('Withdrawal cannot exceed the customer current UGX balance');
  }

  const newBalance = record.currentBalanceUGX - amountUGX;
  record.totalWithdrawnUGX += amountUGX;
  record.currentBalanceUGX = newBalance;
  record.ledger.push({
    type: 'WITHDRAWAL',
    amountUGX,
    occurredAt: new Date(),
    recordedBy: req.user?.id as any,
    notes: req.body.notes,
    balanceAfterTransactionUGX: newBalance,
  });
  await record.save();

  await AuditLog.create({
    ...auditContext(req),
    action: 'CUSTOMER_WITHDRAWAL_RECORDED',
    resource: 'customer-deposits',
    resourceId: String(record._id),
    details: { amountUGX, currentBalanceUGX: newBalance, currency: 'UGX' },
  });

  return ApiResponse.success(res, 'Customer withdrawal recorded successfully', record);
});
