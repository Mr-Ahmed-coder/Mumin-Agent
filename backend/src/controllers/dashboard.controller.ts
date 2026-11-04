import { Request, Response } from 'express';
import { Transaction } from '../models/Transaction';
import { Customer } from '../models/Customer';
import { CashSession } from '../models/CashSession';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { UserRole } from '../constants/roles';
import { readLedgerBalances } from '../services/ledgerRead.service';

export const buildDashboardCashierScope = (role: UserRole | undefined, userId: string | undefined) =>
  role === UserRole.CASHIER ? { cashierId: userId } : {};

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Today's Transactions & Today's Volume/Fees
  const cashierTransactionScope = buildDashboardCashierScope(req.user?.role, req.user?.id);
  const todayTransactions = await Transaction.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    status: 'COMPLETED',
    ...cashierTransactionScope,
  });

  const todayCount = todayTransactions.length;
  const todayVolumeUSD = todayTransactions.reduce(
    (acc, t) => acc + (t.amountReceivedUSD ?? t.amountReceived ?? 0),
    0
  );
  const todayServiceFeesUSD = todayTransactions.reduce(
    (acc, t) => acc + (t.serviceFeeUSD ?? t.serviceFee ?? t.profitUSD ?? t.profit ?? 0),
    0
  );
  const todayCashPaidUGX = todayTransactions.reduce(
    (acc, t) => acc + (t.cashPaidUGX ?? t.cashPaid ?? 0),
    0
  );

  // Today's New Customers
  const todayNewCustomers = await Customer.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  // Active Open Cash Sessions Detail (Physical Cash UGX)
  const activeSessionScope =
    req.user?.role === UserRole.CASHIER
      ? { status: 'OPEN' as const, cashierId: req.user.id }
      : { status: 'OPEN' as const };
  const activeSessions = await CashSession.find(activeSessionScope).populate('cashierId', 'name email role');
  const openCashiersCount = activeSessions.length;
  const legacySessions = activeSessions.filter(s => s.ledgerVersion !== 1 && s.openingVersion !== 2);
  const totalOpeningCashUGX = legacySessions.reduce((acc, s) => acc + s.openingCash, 0);
  const totalCashAddedUGX = legacySessions.reduce(
    (total, session) => total + session.cashAdded.reduce((sum, adjustment) => sum + adjustment.amount, 0),
    0
  );
  const totalCashWithdrawnUGX = legacySessions.reduce(
    (total, session) => total + session.cashWithdrawn.reduce((sum, adjustment) => sum + adjustment.amount, 0),
    0
  );

  const activeSessionIds = legacySessions.map((s) => s._id);
  const sessionTxns = await Transaction.find({
    cashSessionId: { $in: activeSessionIds },
    status: 'COMPLETED',
  });
  const sessionCashPaidOutUGX = sessionTxns.reduce(
    (acc, t) => acc + (t.cashPaidUGX ?? t.cashPaid ?? 0),
    0
  );

  const ledgerDrawerBalances = await Promise.all(activeSessions.filter(s => !legacySessions.includes(s))
    .map(async s => (await readLedgerBalances(s))?.find(account => account.id === 'CASH_UGX')?.balance));
  const cashAvailableUGX = ledgerDrawerBalances.some(value => value === undefined) ? undefined : Math.max(
    0,
    totalOpeningCashUGX + totalCashAddedUGX - totalCashWithdrawnUGX - sessionCashPaidOutUGX
  ) + ledgerDrawerBalances.reduce<number>((sum, value) => sum + (value ?? 0), 0);

  return ApiResponse.success(res, 'Dashboard stats retrieved', {
    todayTransactionsCount: todayCount,
    todayVolumeUSD,
    todayServiceFeesUSD,
    todayCashPaidOutUGX: todayCashPaidUGX,
    todayNewCustomers,
    openCashiersCount,
    cashAvailableUGX,
    activeSessions,
    // Legacy aliases for backwards compatibility
    todayVolume: todayVolumeUSD,
    todayProfit: todayServiceFeesUSD,
    todayCashPaidOut: todayCashPaidUGX,
    cashAvailable: cashAvailableUGX,
  });
});

export const getDashboardCharts = asyncHandler(async (req: Request, res: Response) => {
  // Aggregate last 7 days daily service fees (USD) & transaction volume (USD)
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
        volumeUSD: { $sum: { $ifNull: ['$amountReceivedUSD', '$amountReceived'] } },
        serviceFeesUSD: { $sum: { $ifNull: ['$serviceFeeUSD', '$serviceFee'] } },
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
        volumeUSD: { $sum: { $ifNull: ['$amountReceivedUSD', '$amountReceived'] } },
        serviceFeesUSD: { $sum: { $ifNull: ['$serviceFeeUSD', '$serviceFee'] } },
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
  const query = buildDashboardCashierScope(req.user?.role, req.user?.id);
  const recent = await Transaction.find(query)
    .populate('customerId', 'name phone')
    .populate('cashierId', 'name')
    .sort({ createdAt: -1 })
    .limit(8);

  return ApiResponse.success(res, 'Recent transactions retrieved', recent);
});
