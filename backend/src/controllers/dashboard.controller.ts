import { Request, Response } from 'express';
import { Transaction } from '../models/Transaction';
import { Customer } from '../models/Customer';
import { CashSession } from '../models/CashSession';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Today's Transactions & Today's Profit
  const todayTransactions = await Transaction.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    status: 'COMPLETED',
  });

  const todayCount = todayTransactions.length;
  const todayVolume = todayTransactions.reduce((acc, t) => acc + t.amountReceived, 0);
  const todayProfit = todayTransactions.reduce((acc, t) => acc + t.profit, 0);
  const todayCashPaid = todayTransactions.reduce(
    (acc, t) => acc + (t.cashPaidUGX ?? t.cashPaid ?? 0),
    0
  );

  // Today's New Customers
  const todayNewCustomers = await Customer.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  // Active Open Cash Sessions Detail
  const activeSessions = await CashSession.find({ status: 'OPEN' }).populate('cashierId', 'name email role');
  const openCashiersCount = activeSessions.length;
  const totalOpeningCash = activeSessions.reduce((acc, s) => acc + s.openingCash, 0);
  const totalCashAdded = activeSessions.reduce(
    (total, session) => total + session.cashAdded.reduce((sum, adjustment) => sum + adjustment.amount, 0),
    0
  );
  const totalCashWithdrawn = activeSessions.reduce(
    (total, session) => total + session.cashWithdrawn.reduce((sum, adjustment) => sum + adjustment.amount, 0),
    0
  );

  const activeSessionIds = activeSessions.map((s) => s._id);
  const sessionTxns = await Transaction.find({
    cashSessionId: { $in: activeSessionIds },
    status: 'COMPLETED',
  });
  const sessionCashPaidOut = sessionTxns.reduce(
    (acc, t) => acc + (t.cashPaidUGX ?? t.cashPaid ?? 0),
    0
  );

  const cashAvailable = Math.max(
    0,
    totalOpeningCash + totalCashAdded - totalCashWithdrawn - sessionCashPaidOut
  );

  return ApiResponse.success(res, 'Dashboard stats retrieved', {
    todayTransactionsCount: todayCount,
    todayVolume,
    todayProfit,
    todayCashPaidOut: todayCashPaid,
    todayNewCustomers,
    openCashiersCount,
    cashAvailable,
    activeSessions,
  });
});

export const getDashboardCharts = asyncHandler(async (req: Request, res: Response) => {
  // Aggregate last 7 days daily profit & transaction volume
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const dailyAggregation = await Transaction.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
        status: 'COMPLETED',
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        volume: { $sum: '$amountReceived' },
        profit: { $sum: '$profit' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Wallet breakdown distribution
  const walletBreakdown = await Transaction.aggregate([
    { $match: { status: 'COMPLETED' } },
    {
      $group: {
        _id: '$walletProvider',
        volume: { $sum: '$amountReceived' },
        profit: { $sum: '$profit' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Top Customers Leaderboard
  const topCustomers = await Customer.find({ 'stats.totalTransactions': { $gt: 0 } })
    .sort({ 'stats.totalAmountExchanged': -1 })
    .limit(5);

  return ApiResponse.success(res, 'Dashboard charts data retrieved', {
    dailyStats: dailyAggregation,
    walletBreakdown,
    topCustomers,
  });
});

export const getRecentTransactions = asyncHandler(async (req: Request, res: Response) => {
  const recent = await Transaction.find()
    .populate('customerId', 'name phone')
    .populate('cashierId', 'name')
    .sort({ createdAt: -1 })
    .limit(8);

  return ApiResponse.success(res, 'Recent transactions retrieved', recent);
});
