import { Request, Response } from 'express';
import { ExchangeRate } from '../models/ExchangeRate';
import { AuditLog } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

const CURRENCY_PAIR = { baseCurrency: 'USD', targetCurrency: 'UGX' } as const;

export const getActiveExchangeRate = asyncHandler(async (_req: Request, res: Response) => {
  const rate = await ExchangeRate.findOne({ ...CURRENCY_PAIR, status: 'ACTIVE' })
    .populate('updatedBy', 'name email role')
    .sort({ effectiveDate: -1 });

  return ApiResponse.success(
    res,
    rate ? 'Active exchange rate retrieved' : 'No active exchange rate configured',
    rate
  );
});

export const getExchangeRateHistory = asyncHandler(async (req: Request, res: Response) => {
  const requestedLimit = Number(req.query.limit) || 50;
  const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 200);

  const rates = await ExchangeRate.find(CURRENCY_PAIR)
    .populate('updatedBy', 'name email role')
    .sort({ effectiveDate: -1 })
    .limit(limit);

  return ApiResponse.success(res, 'Exchange rate history retrieved', rates);
});

export const setActiveExchangeRate = asyncHandler(async (req: Request, res: Response) => {
  const effectiveDate = new Date();

  await ExchangeRate.updateMany(
    { ...CURRENCY_PAIR, status: 'ACTIVE' },
    { $set: { status: 'INACTIVE' } }
  );

  const rate = await ExchangeRate.create({
    ...CURRENCY_PAIR,
    rate: req.body.rate,
    effectiveDate,
    status: 'ACTIVE',
    updatedBy: req.user?.id,
  });

  await AuditLog.create({
    userId: req.user?.id,
    userName: req.user?.name,
    userRole: req.user?.role,
    action: 'EXCHANGE_RATE_SET',
    resource: 'exchange-rates',
    resourceId: (rate._id as any).toString(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { ...CURRENCY_PAIR, rate: rate.rate, effectiveDate },
  });

  await rate.populate('updatedBy', 'name email role');
  return ApiResponse.created(res, 'Active exchange rate updated successfully', rate);
});
