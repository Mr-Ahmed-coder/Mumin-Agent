import { Request, Response } from 'express';
import { Transaction } from '../models/Transaction';
import { Customer } from '../models/Customer';
import { CashSession } from '../models/CashSession';
import { ExchangeRate } from '../models/ExchangeRate';
import { calculateUSDToUGX } from '../services/movementMath.service';
import { AuditLog } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../constants/roles';
import { assertOpenSessionModification } from '../services/reconciliation.service';
import { useLedgerIntegration, postLegacyFinancialRequest, cancelLegacyFinancialRequest } from '../services/legacyLedgerAdapter.service';

export const createTransaction = asyncHandler(async (req: Request, res: Response) => {
  if (useLedgerIntegration()) return ApiResponse.created(res, 'Transaction and movements recorded atomically', await postLegacyFinancialRequest(req, 'WALLET_USD_TO_CASH_UGX'));
  const cashierId = req.user?.id;
  const { customerId, walletProvider, referenceNumber, notes } = req.body;

  const amountReceivedUSD = Number(req.body.amountReceivedUSD || req.body.amountReceived);

  if (isNaN(amountReceivedUSD) || amountReceivedUSD <= 0) {
    throw ApiError.badRequest('Amount received in USD must be positive');
  }

  // 1. Verify active cash session
  const activeSession = await CashSession.findOne({ cashierId, status: 'OPEN' });
  if (!activeSession) {
    throw ApiError.badRequest(
      'You cannot create a transaction without an open cash session. Please open your cash shift first.'
    );
  }

  // 2. Fetch Active Exchange Rate (USD -> UGX)
  if (activeSession.openingVersion === 2 || activeSession.ledgerVersion === 1) throw ApiError.badRequest('Use the development account-operations API for this ledger shift');
  let activeRate = await ExchangeRate.findOne({ status: 'ACTIVE' }).sort({ createdAt: -1 });

  if (!activeRate || activeRate.rate <= 0) {
    throw ApiError.badRequest('No active exchange rate found. Contact Manager/Admin to set today\'s USD/UGX rate.');
  }

  const exchangeRateUGX = activeRate.rate;

  // 3. Fetch Customer
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  if (customer.status === 'BLOCKED') {
    throw ApiError.forbidden('This customer is blocked and cannot perform transactions.');
  }

  // 4. Calculate USD service fee
  let calculation;
  try { calculation = calculateUSDToUGX(amountReceivedUSD, exchangeRateUGX); }
  catch (error) { throw ApiError.badRequest(error instanceof Error ? error.message : 'Invalid exchange amount or rate'); }
  const { serviceFeeUSD, serviceFeeUGX, exchangeableAmountUSD, cashPaidUGX } = calculation;

  if (serviceFeeUSD >= amountReceivedUSD) {
    throw ApiError.badRequest('Calculated service fee exceeds or equals the received USD amount');
  }

  // 5. Dual Currency Conversion Math
  const profitUSD = serviceFeeUSD;

  if (cashPaidUGX <= 0) {
    throw ApiError.badRequest('Calculated UGX cash to give must be greater than zero');
  }

  // 6. Duplicate reference number validation
  const refNum = referenceNumber && referenceNumber.trim() !== '' ? referenceNumber.trim() : `REF-${Math.floor(100000 + Math.random() * 900000)}`;

  if (referenceNumber && referenceNumber.trim() !== '') {
    const existingRef = await Transaction.findOne({ referenceNumber: referenceNumber.trim(), walletProvider });
    if (existingRef) {
      throw ApiError.badRequest('A transaction with this reference number already exists for this wallet');
    }
  }

  // Generate unique transaction number e.g. TXN-948201
  const randomStr = Math.floor(100000 + Math.random() * 900000);
  const transactionNumber = `TXN-${randomStr}`;

  // 7. Save Dual Currency Transaction
  const transaction = await Transaction.create({
    transactionNumber,
    cashSessionId: activeSession._id,
    customerId: customer._id,
    customerPhone: customer.phone,
    walletProvider,

    // Dual Currency Engine Fields
    amountReceivedUSD,
    serviceFeeUSD,
    serviceFeeUGX,
    feeRatePercent: 1,
    exchangeableAmountUSD,
    exchangeRateUGX,
    cashPaidUGX,
    profitUSD,

    // Legacy Fallback Properties
    amountReceived: amountReceivedUSD,
    serviceFee: serviceFeeUSD,
    cashPaid: cashPaidUGX,
    profit: profitUSD,

    referenceNumber: refNum,
    cashierId,
    status: 'COMPLETED',
    notes,
  });

  // 8. Update Customer stats in USD
  const totalTxns = customer.stats.totalTransactions + 1;
  const totalExchangedUSD = customer.stats.totalAmountExchanged + amountReceivedUSD;
  const totalProfitUSD = customer.stats.totalProfitGenerated + profitUSD;
  const avgAmountUSD = totalExchangedUSD / totalTxns;

  customer.stats.totalTransactions = totalTxns;
  customer.stats.totalAmountExchanged = totalExchangedUSD;
  customer.stats.totalProfitGenerated = totalProfitUSD;
  customer.stats.lastVisitAt = new Date();
  customer.stats.averageTransactionAmount = Math.round(avgAmountUSD * 100) / 100;
  await customer.save();

  // 9. Audit Log
  await AuditLog.create({
    userId: cashierId,
    userName: req.user?.name,
    userRole: req.user?.role,
    action: 'TXN_CREATE',
    resource: 'transactions',
    resourceId: (transaction._id as any).toString(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: {
      transactionNumber,
      amountReceivedUSD,
      serviceFeeUSD,
      exchangeableAmountUSD,
      exchangeRateUGX,
      cashPaidUGX,
      customerName: customer.name,
      walletProvider,
    },
  });

  return ApiResponse.created(res, 'Transaction created successfully', transaction);
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const walletProvider = req.query.walletProvider as string;
  const status = req.query.status as string;
  const cashierId = req.query.cashierId as string;
  const customerId = req.query.customerId as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  const query: any = {};
  if (walletProvider) query.walletProvider = walletProvider;
  if (status) query.status = status;
  if (customerId) query.customerId = customerId;

  // Cashiers are strictly scoped to their own transactions
  if (req.user?.role === UserRole.CASHIER) {
    query.cashierId = req.user.id;
  } else if (cashierId) {
    query.cashierId = cashierId;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (search) {
    query.$or = [
      { transactionNumber: { $regex: search, $options: 'i' } },
      { referenceNumber: { $regex: search, $options: 'i' } },
      { customerPhone: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('customerId', 'name phone customerNumber')
      .populate('cashierId', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Transaction.countDocuments(query),
  ]);

  return ApiResponse.success(res, 'Transactions retrieved', transactions, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const getTransactionById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const transaction = await Transaction.findById(id)
    .populate('customerId', 'name phone customerNumber nationalId address')
    .populate('cashierId', 'name email');

  if (!transaction) {
    throw ApiError.notFound('Transaction not found');
  }

  // Cashiers can only view details of their own transactions
  const txnCashierId = ((transaction.cashierId as any)?._id || transaction.cashierId).toString();
  if (req.user?.role === UserRole.CASHIER && txnCashierId !== req.user.id) {
    throw ApiError.forbidden('Cashiers may only review their own transactions');
  }

  return ApiResponse.success(res, 'Transaction details retrieved', transaction);
});

export const cancelTransaction = asyncHandler(async (req: Request, res: Response) => {
  if (useLedgerIntegration()) return ApiResponse.success(res, 'Compensating reversal recorded', await cancelLegacyFinancialRequest(req));
  const { id } = req.params;
  const { cancellationReason } = req.body;
  const user = req.user;

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    throw ApiError.notFound('Transaction not found');
  }

  if (transaction.status === 'CANCELLED') {
    throw ApiError.badRequest('Transaction is already cancelled');
  }
  if (transaction.operationId) throw ApiError.badRequest('Ledger transactions must be corrected with a compensating entry');

  if (user?.role === UserRole.CASHIER && transaction.cashSessionId) {
    const owningSession = await CashSession.findById(transaction.cashSessionId).select('status cashierId');
    if (owningSession) {
      assertOpenSessionModification(
        owningSession.status,
        owningSession.cashierId.toString(),
        user.id
      );
    }
  }

  if (user?.role === UserRole.CASHIER && transaction.cashierId.toString() !== user.id) {
    throw ApiError.forbidden('Cashiers may only modify their own transactions');
  }

  // Cashiers can only cancel within 30 minutes, Manager/Admin anytime
  if (user?.role === UserRole.CASHIER) {
    const minutesPassed = (Date.now() - new Date(transaction.createdAt).getTime()) / (1000 * 60);
    if (minutesPassed > 30) {
      throw ApiError.forbidden('Cashiers can only cancel transactions created within the last 30 minutes. Contact Manager.');
    }
  }

  transaction.status = 'CANCELLED';
  transaction.cancellationReason = cancellationReason;
  transaction.cancelledBy = user?.id as any;
  transaction.cancelledAt = new Date();
  await transaction.save();

  // Revert Customer USD stats
  const customer = await Customer.findById(transaction.customerId);
  if (customer) {
    const amountUSD = transaction.amountReceivedUSD || transaction.amountReceived || 0;
    const profitUSD = transaction.profitUSD || transaction.profit || 0;
    customer.stats.totalTransactions = Math.max(0, customer.stats.totalTransactions - 1);
    customer.stats.totalAmountExchanged = Math.max(0, customer.stats.totalAmountExchanged - amountUSD);
    customer.stats.totalProfitGenerated = Math.max(0, customer.stats.totalProfitGenerated - profitUSD);
    if (customer.stats.totalTransactions > 0) {
      customer.stats.averageTransactionAmount = customer.stats.totalAmountExchanged / customer.stats.totalTransactions;
    } else {
      customer.stats.averageTransactionAmount = 0;
    }
    await customer.save();
  }

  // Audit Log
  await AuditLog.create({
    userId: user?.id,
    userName: user?.name,
    userRole: user?.role,
    action: 'TXN_CANCEL',
    resource: 'transactions',
    resourceId: (transaction._id as any).toString(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: {
      transactionNumber: transaction.transactionNumber,
      cancellationReason,
    },
  });

  return ApiResponse.success(res, 'Transaction cancelled successfully', transaction);
});
