import { Request, Response } from 'express';
import { FeeRule } from '../models/FeeRule';
import { ExchangeRate } from '../models/ExchangeRate';
import { FeeService } from '../services/fee.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';

export const getFeeRules = asyncHandler(async (req: Request, res: Response) => {
  const rules = await FeeRule.find().sort({ walletProvider: 1, minAmount: 1 });
  return ApiResponse.success(res, 'Fee rules retrieved', rules);
});

export const createFeeRule = asyncHandler(async (req: Request, res: Response) => {
  const ruleData = {
    ...req.body,
    createdBy: req.user?.id,
  };
  const rule = await FeeRule.create(ruleData);
  return ApiResponse.created(res, 'Fee rule created successfully', rule);
});

export const updateFeeRule = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const rule = await FeeRule.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
  if (!rule) {
    throw ApiError.notFound('Fee rule not found');
  }
  return ApiResponse.success(res, 'Fee rule updated successfully', rule);
});

export const deleteFeeRule = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const rule = await FeeRule.findByIdAndDelete(id);
  if (!rule) {
    throw ApiError.notFound('Fee rule not found');
  }
  return ApiResponse.success(res, 'Fee rule deleted successfully');
});

export const calculateFeeHandler = asyncHandler(async (req: Request, res: Response) => {
  const amountUSD = Number(req.body.amountReceivedUSD || req.body.amount);
  const walletProvider = req.body.walletProvider;

  if (isNaN(amountUSD) || amountUSD <= 0) {
    throw ApiError.badRequest('Amount received in USD must be positive');
  }

  // Exchange rates are business configuration and must be set explicitly by management.
  const activeRate = await ExchangeRate.findOne({
    baseCurrency: 'USD',
    targetCurrency: 'UGX',
    status: 'ACTIVE',
  }).sort({ effectiveDate: -1 });

  if (!activeRate) {
    throw ApiError.badRequest(
      'No active USD/UGX exchange rate found. Contact Manager/Admin to set today\'s rate.'
    );
  }

  const exchangeRateUGX = activeRate.rate;
  const serviceFeeUSD = await FeeService.calculateFee(amountUSD, walletProvider);

  if (serviceFeeUSD >= amountUSD) {
    throw ApiError.badRequest('Calculated service fee exceeds or equals the received USD amount');
  }

  const exchangeableAmountUSD = amountUSD - serviceFeeUSD;
  const cashPaidUGX = Math.round(exchangeableAmountUSD * exchangeRateUGX);

  return ApiResponse.success(res, 'Dual currency exchange calculated successfully', {
    amountReceivedUSD: amountUSD,
    serviceFeeUSD,
    exchangeableAmountUSD,
    exchangeRateUGX,
    cashPaidUGX,
    profitUSD: serviceFeeUSD,

    // Backward compatibility properties
    amountReceived: amountUSD,
    fee: serviceFeeUSD,
    cashToGive: cashPaidUGX,
  });
});
