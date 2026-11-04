'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  ChevronRight,
  History,
  Landmark,
  Loader2,
  LockKeyhole,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Trash2,
  UserRound,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import CurrentAccountBalances, { RecordedBalance } from '@/components/cash-sessions/CurrentAccountBalances';
import { api } from '@/lib/api';
import { CashSession, DashboardStats, Transaction, WALLET_LABELS } from '@/types';
import { useAuth } from '@/providers/AuthProvider';

const formatAmount = (value: number) => value.toLocaleString();
const formatMoney = (currency: 'USD' | 'UGX', value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? `${currency} ${formatAmount(value)}` : 'Unavailable';
const accountLabel = (provider: Transaction['walletProvider']) =>
  String(provider) === 'CASH_USD' ? 'USD Cash' : WALLET_LABELS[provider] || provider || 'Not recorded';
const statusStyle = (status: Transaction['status']) => status === 'COMPLETED'
  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
  : status === 'CANCELLED' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900';
const isDevelopment = process.env.NODE_ENV === 'development';

interface DevelopmentResetResult {
  deleted: {
    transactions: number;
    customers: number;
    cashSessions: number;
    expenses: number;
    auditLogs: number;
    feeRules: number;
    exchangeRates: number;
  };
  refreshTokensCleared: number;
  usersPreserved: number;
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  accent = 'blue',
  unit,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof Wallet;
  accent?: 'blue' | 'cyan' | 'amber';
  unit?: string;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">{label}</p>
        <div className={`rounded-xl border p-2.5 ${colors[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 break-words text-xl font-extrabold leading-tight tracking-tight text-[#17254b] 2xl:text-2xl">
        {value}
        {unit && <span className="ml-2 text-sm font-bold text-[#475569]">{unit}</span>}
      </p>
      <p className="mt-2 text-xs leading-5 text-[#475569]">{description}</p>
    </section>
  );
}

function MetricSkeleton() {
  return (
    <div className="min-h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-5" aria-hidden="true">
      <div className="h-3 w-28 rounded bg-slate-800" />
      <div className="mt-6 h-7 w-36 rounded bg-slate-800" />
      <div className="mt-5 h-3 w-full rounded bg-slate-800/70" />
      <div className="mt-2 h-3 w-2/3 rounded bg-slate-800/70" />
    </div>
  );
}

function RecentTransactions({
  transactions,
  isLoading,
  isError,
  onRetry,
  cashierView,
}: {
  transactions: Transaction[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  cashierView: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white text-[#17254b] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-bold text-[#17254b]">Recent Transactions</h2>
          <p className="mt-1 text-xs text-slate-500">
            {cashierView ? 'Your latest customer exchanges.' : 'Latest customer exchanges across the shop.'}
          </p>
        </div>
        <Link href="/transactions" className="shrink-0 rounded text-xs font-bold text-blue-700 hover:underline focus-visible:outline focus-visible:outline-blue-700">
          View history &rarr;
        </Link>
      </div>

      {/* Mobile Card List View */}
      <div className="divide-y divide-blue-100 xl:hidden">
        {isLoading ? (
          <div className="space-y-3 p-5" aria-label="Loading recent transactions">
            {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-800/70" />)}
          </div>
        ) : isError ? (
          <div className="px-5 py-10 text-center text-sm text-red-300">
            <p>Recent transactions could not be loaded.</p>
            <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-bold outline-none hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400">Retry</button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No recent transactions yet.</div>
        ) : (
          transactions.map((transaction) => (
            <div key={transaction._id} className="space-y-3 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-mono text-xs font-bold text-blue-700">{transaction.transactionNumber}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusStyle(transaction.status)}`}>{transaction.status.replace('_', ' ')}</span>
                  </div>
                  <p className="mt-1 break-words text-sm font-semibold text-[#17254b]">{(transaction.customerId as any)?.name || transaction.customerPhone || 'Walk-in Customer'}</p>
                  <p className="mt-0.5 break-words text-xs text-[#475569]">{accountLabel(transaction.walletProvider)}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-blue-50 p-3 text-xs">
                <div>
                  <p className="text-slate-500">Received (USD)</p>
                  <p className="mt-1 break-words font-bold text-[#17254b]">{formatMoney('USD', transaction.amountReceivedUSD ?? transaction.amountReceived)}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">Cash Paid (UGX)</p>
                  <p className="mt-1 break-words font-bold text-[#17254b]">{formatMoney('UGX', transaction.cashPaidUGX ?? transaction.cashPaid)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden overflow-x-auto xl:block" tabIndex={0} role="region" aria-label="Recent exchange transaction table">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-blue-50 text-[11px] uppercase tracking-wider text-[#475569]">
            <tr>
              <th className="px-6 py-3">Transaction</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Received into</th>
              <th className="px-4 py-3 text-right">Received (USD)</th>
              <th className="px-4 py-3 text-right">Fee (USD)</th>
              <th className="px-6 py-3 text-right">Cash Paid (UGX)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {isLoading ? (
              [0, 1, 2].map((item) => <tr key={item}><td colSpan={7} className="px-6 py-3"><div className="h-12 animate-pulse rounded-xl bg-slate-800/70" /></td></tr>)
            ) : isError ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-red-300">
                  Recent transactions could not be loaded.{' '}
                  <button type="button" onClick={onRetry} className="font-bold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-red-400">Retry</button>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                  No recent transactions yet.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction._id} className="transition-colors hover:bg-blue-50">
                  <td className="px-6 py-4">
                    <p className="max-w-36 break-all font-mono text-xs font-bold text-blue-700">{transaction.transactionNumber}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-[#17254b]">{(transaction.customerId as any)?.name || transaction.customerPhone || 'Walk-in Customer'}</p>
                    <p className="mt-1 text-xs text-slate-500">{transaction.customerPhone}</p>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-300">
                    <span className="inline-block rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#17254b]">
                      {accountLabel(transaction.walletProvider)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-semibold text-[#17254b]">
                    {formatMoney('USD', transaction.amountReceivedUSD ?? transaction.amountReceived)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-semibold text-blue-700">
                    {formatMoney('USD', transaction.serviceFeeUSD ?? transaction.serviceFee)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-[#17254b]">
                    {formatMoney('UGX', transaction.cashPaidUGX ?? transaction.cashPaid)}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle(transaction.status)}`}>{transaction.status.replace('_', ' ')}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionLink({
  href,
  label,
  description,
  icon: Icon,
  primary = false,
  disabled = false,
  loading = false,
}: {
  href: string;
  label: string;
  description: string;
  icon: typeof Wallet;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const classes = `group flex min-h-24 w-full items-center gap-3 rounded-2xl border p-4 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
    disabled || loading
      ? 'cursor-not-allowed border-slate-700 border-dashed bg-[#f1f5f9] text-[#475569]'
      : primary
        ? 'border-blue-700 bg-gradient-to-r from-[#1d4ed8] to-[#0e7490] text-[#ffffff] shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 hover:from-[#1e40af] hover:to-[#155e75] hover:shadow-xl'
        : 'border-slate-800 bg-white text-[#17254b] shadow-card hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50'
  }`;

  const content = (
    <>
      <div className={`shrink-0 rounded-xl p-3 ${disabled || loading ? 'bg-[#e2e8f0] text-[#475569]' : primary ? 'bg-white/15 text-[#ffffff]' : 'bg-blue-50 text-[#1d4ed8]'}`}>
        {loading ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <Icon className="h-6 w-6" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`break-words font-extrabold ${disabled || loading ? 'text-[#475569]' : primary ? 'text-[#ffffff]' : 'text-[#17254b]'}`}>{loading ? 'Checking shift...' : label}</p>
        <p className={`mt-1 text-xs leading-5 ${primary && !disabled && !loading ? 'text-[#ffffff]' : 'text-[#475569]'}`}>{description}</p>
      </div>
      {!disabled && !loading && <ChevronRight className={`h-5 w-5 shrink-0 transition group-hover:translate-x-0.5 ${primary ? 'text-[#ffffff]' : 'text-[#1d4ed8]'}`} aria-hidden="true" />}
    </>
  );

  if (disabled || loading) {
    return <div className={classes} aria-disabled="true" aria-label={`${label}. ${description}`}>{content}</div>;
  }

  return <Link href={href} className={classes} aria-label={`${label}. ${description}`}>{content}</Link>;
}

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const isCashier = user?.role === 'CASHIER';
  const showDevelopmentTools = isDevelopment && user?.role === 'ADMIN';
  const canReviewShop = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [selectedShiftId, setSelectedShiftId] = useState('');

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetResult, setResetResult] = useState<DevelopmentResetResult | null>(null);
  const [resetError, setResetError] = useState('');

  // Dashboard Stats Query
  const {
    data: statsData,
    isLoading: isStatsLoading,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
  } = useQuery<{ data: DashboardStats }>({
    queryKey: ['dashboardStats', user?._id, user?.role],
    queryFn: async () => (await api.get('/dashboard/stats')).data,
    enabled: Boolean(user),
  });

  // Admin Charts Query
  const {
    data: chartsData,
    isLoading: isChartsLoading,
    isError: isChartsError,
    refetch: refetchCharts,
  } = useQuery({
    queryKey: ['dashboardCharts', user?._id, user?.role],
    queryFn: async () => (await api.get('/dashboard/charts')).data.data,
    enabled: Boolean(user && !isCashier),
  });

  // Active Cash Session Query
  const {
    data: sessionData,
    isLoading: isSessionLoading,
    isError: isSessionError,
    error: sessionError,
    refetch: refetchSession,
  } = useQuery<{ data: (CashSession & { accountBalances?: RecordedBalance[] }) | null }>({
    queryKey: ['activeCashSession', user?._id],
    queryFn: async () => (await api.get('/cash-sessions/current')).data,
    enabled: Boolean(user && isCashier),
  });

  // Recent Transactions Query
  const {
    data: recentData,
    isLoading: isRecentLoading,
    isError: isRecentError,
    error: recentError,
    refetch: refetchRecent,
  } = useQuery<{ data: Transaction[] }>({
    queryKey: ['recentTransactions', user?._id, user?.role],
    queryFn: async () => (await api.get('/dashboard/recent')).data,
    enabled: Boolean(user),
  });

  const stats = statsData?.data;
  const activeSession = sessionData?.data;
  const recentTransactions = recentData?.data || [];
  const activeSessions = stats?.activeSessions || [];
  const dailyStats = chartsData?.dailyStats || [];
  const selectedShift = canReviewShop && !isStatsError
    ? activeSessions.find(session => session._id === selectedShiftId) ?? activeSessions[0]
    : undefined;
  const shiftBalances = useQuery<{ accountBalances?: RecordedBalance[] }>({
    queryKey: ['dashboardShiftBalances', user?._id, selectedShift?._id],
    queryFn: async () => (await api.get(`/cash-sessions/${selectedShift!._id}`)).data.data,
    enabled: Boolean(selectedShift?.ledgerVersion === 1),
  });
  const canOfferClosing = activeSession && activeSession.ledgerVersion !== 1 && activeSession.openingVersion !== 2;

  const isPermissionDenied = [statsError, sessionError, recentError].some(
    (error: any) => error?.response?.status === 403
  );

  const resetDevelopmentData = useMutation({
    mutationFn: async () => {
      const response = await api.post('/development/reset-data', { confirmation: resetConfirmation });
      return response.data.data as DevelopmentResetResult;
    },
    onSuccess: async (result) => {
      setResetResult(result);
      setResetError('');
      setResetConfirmation('');
      setIsResetDialogOpen(false);
      await queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      setResetError(error.response?.data?.message || 'Development data reset failed');
    },
  });

  if (isAuthLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 text-sm">Loading workspace...</div>;
  }

  const handleRetryAll = () => {
    refetchStats();
    if (isCashier) refetchSession();
    refetchRecent();
    if (!isCashier) refetchCharts();
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-7 p-4 sm:p-6 lg:p-8">
          <header className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 p-6 shadow-xl shadow-blue-500/20 sm:flex sm:items-end sm:justify-between sm:gap-6 lg:p-8">
            <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full border-[28px] border-white/10" />
            <div className="pointer-events-none absolute bottom-[-5rem] right-28 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-50">
                {isCashier ? 'Cashier Workspace' : 'Business Overview'}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {isCashier ? `Ready to serve, ${user?.name}` : 'Today at Mumin Agent'}
              </h1>
              {isCashier && activeSession?.openedAt && !isSessionError && (
                <p className="mt-2 text-sm text-white">Opened at {new Date(activeSession.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
            <span
              className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                isCashier
                  ? activeSession
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : isStatsLoading || isStatsError
                    ? 'border-white/20 bg-white/10 text-white'
                    : (stats?.openCashiersCount || 0) > 0
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  (!isCashier && (isStatsLoading || isStatsError))
                    ? 'bg-slate-500'
                    : (isCashier ? Boolean(activeSession) : (stats?.openCashiersCount || 0) > 0)
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                }`}
              />
              {isCashier
                ? isSessionLoading ? 'Checking Shift' : isSessionError ? 'Shift Unavailable' : activeSession ? 'Shift OPEN' : 'No Open Shift'
                : isStatsLoading
                  ? 'Checking Cash Sessions'
                  : isStatsError
                    ? 'Cash Sessions Unavailable'
                    : `${stats?.openCashiersCount || 0} Open Cash Session${stats?.openCashiersCount === 1 ? '' : 's'}`}
            </span>
          </header>

          {/* API Error Alert Banner */}
          {(isStatsError || isRecentError || (isCashier && isSessionError) || (!isCashier && isChartsError)) && (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 sm:flex-row sm:items-center sm:justify-between" role="alert">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                <span>{isPermissionDenied ? 'You do not have permission to view some dashboard information.' : 'Some dashboard information could not be loaded from the server.'}</span>
              </div>
              <button
                type="button"
                onClick={handleRetryAll}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-white outline-none hover:bg-red-500/30 focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}

          {/* Shift-Aware Quick Actions */}
          <section className="space-y-4">
            <div>
              <h2 className="font-bold text-white">Quick Actions</h2>
            </div>

            {isCashier ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {isSessionLoading ? (
                  <ActionLink href="/cash-sessions" label="Shift Status" description="Checking whether your shift is open." icon={Wallet} loading />
                ) : isSessionError ? (
                  <ActionLink href="/cash-sessions" label="Check Shift" description="Shift status unavailable. Open Cash Sessions to retry." icon={Wallet} />
                ) : activeSession ? (
                  <ActionLink href="/transactions/new" label="New Transaction" description="Record a customer payment and UGX cash payout." icon={PlusCircle} primary />
                ) : (
                  <ActionLink href="/cash-sessions" label="Open Shift" description="Enter opening balances and start serving customers." icon={Wallet} primary />
                )}

                {!activeSession && !isSessionLoading && !isSessionError && (
                  <ActionLink href="/transactions/new" label="New Transaction" description="Open a shift before recording transactions." icon={PlusCircle} disabled />
                )}
                <ActionLink href="/transactions" label="Transaction History" description="Search and review your previous exchanges." icon={History} />
                {activeSession && !isSessionError && (
                  <>
                    {canOfferClosing
                      ? <ActionLink href="/cash-sessions" label="Close Shift" description="Count cash and review the shift." icon={LockKeyhole} />
                      : <ActionLink href="/cash-sessions" label="Manage Shift" description="View balances or record cash movements." icon={Wallet} />}
                    <ActionLink href="/internet-credit" label="Internet Credit" description="Record UGX credit and repayments." icon={Wifi} />
                    <ActionLink href="/customer-deposits" label="Customer Deposits" description="Record UGX safekeeping movements." icon={Landmark} />
                  </>
                )}
                <ActionLink href="/customers" label="Customers" description="Find customers and review their activity." icon={UserRound} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <ActionLink href="/reports" label="Reports" description="Review financial and operational summaries." icon={BarChart3} primary />
                <ActionLink href="/cash-sessions" label="Cash Sessions" description="Review open shifts and closing reconciliations." icon={Wallet} />
                <ActionLink href="/transactions" label="Transactions" description="Review exchange activity across the shop." icon={History} />
                <ActionLink href="/customers" label="Customers" description="Review customer records and activity." icon={UserRound} />
                <ActionLink href="/internet-credit" label="Internet Credit" description="Review UGX credit and repayments." icon={Wifi} />
                <ActionLink href="/customer-deposits" label="Customer Deposits" description="Review customer-owned UGX balances." icon={Landmark} />
              </div>
            )}
          </section>

          {/* Metrics Grid */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Daily operational summary">
            {isStatsLoading || (isCashier && isSessionLoading) ? (
              [0, 1, 2, 3].map((item) => <MetricSkeleton key={item} />)
            ) : isStatsError ? (
              <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800" role="alert">
                Financial summary is unavailable. No substitute or estimated values are being shown.
              </div>
            ) : (
              <>
                <MetricCard
                  label="Available Cash (UGX)"
                  value={
                    isCashier
                      ? isSessionError
                        ? 'Unavailable'
                        : activeSession
                          ? formatMoney('UGX', activeSession.currentCashBalance)
                          : 'No open shift'
                      : typeof stats?.cashAvailableUGX === 'number'
                        ? `UGX ${formatAmount(stats.cashAvailableUGX)}`
                        : 'Unavailable'
                  }
                  description={isCashier && !activeSession ? 'Open a shift to establish the physical cash available.' : 'Physical UGX cash available in active drawers.'}
                  icon={Wallet}
                />
                <MetricCard
                  label="Today's Transactions"
                  value={typeof stats?.todayTransactionsCount === 'number' ? formatAmount(stats.todayTransactionsCount) : 'Unavailable'}
                  unit={typeof stats?.todayTransactionsCount === 'number' ? 'Exchanges' : undefined}
                  description={isCashier ? 'Your completed exchange transactions today.' : 'Completed exchange transactions across the shop today.'}
                  icon={ReceiptText}
                  accent="blue"
                />
                <MetricCard
                  label="Today's Exchange Volume (USD)"
                  value={typeof stats?.todayVolumeUSD === 'number' ? `USD ${formatAmount(stats.todayVolumeUSD)}` : 'Unavailable'}
                  description={isCashier ? 'USD received in your completed exchanges today.' : 'Total USD received in completed exchanges today.'}
                  icon={ArrowLeftRight}
                  accent="blue"
                />
                <MetricCard
                  label="Today's Service Fees (USD)"
                  value={typeof stats?.todayServiceFeesUSD === 'number' ? `USD ${formatAmount(stats.todayServiceFeesUSD)}` : 'Unavailable'}
                  description={isCashier ? 'USD service fees from your completed exchanges today.' : 'Total USD service fees collected today.'}
                  icon={BarChart3}
                  accent="amber"
                />

              </>
            )}
          </section>

          {isCashier && activeSession && !isSessionError && <CurrentAccountBalances balances={activeSession.accountBalances} shiftId={activeSession._id} />}
          {selectedShift && (
            <div className="space-y-3">
              {activeSessions.length > 1 && (
                <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#17254b]">
                  View balances for
                  <select value={selectedShift._id} onChange={event => setSelectedShiftId(event.target.value)} className="max-w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-[#17254b] focus-visible:outline focus-visible:outline-blue-700">
                    {activeSessions.map(session => <option key={session._id} value={session._id}>
                      {typeof session.cashierId === 'object' && session.cashierId?.name ? session.cashierId.name + ' · ' : ''}{session.sessionNumber}
                    </option>)}
                  </select>
                </label>
              )}
              <CurrentAccountBalances shiftId={selectedShift._id}
                balances={selectedShift.ledgerVersion === 1 ? shiftBalances.data?.accountBalances : undefined}
                loading={selectedShift.ledgerVersion === 1 && shiftBalances.isLoading}
                error={selectedShift.ledgerVersion === 1 && shiftBalances.isError} />
            </div>
          )}

          {/* Recent Transactions List */}
          <RecentTransactions
            transactions={recentTransactions}
            isLoading={isRecentLoading}
            isError={isRecentError}
            onRetry={refetchRecent}
            cashierView={isCashier}
          />

          {/* Admin / Manager Analytics Section */}
          {!isCashier && (
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10 xl:col-span-2 sm:p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-white">7-Day Activity Trend</h2>
                    <p className="mt-1 text-xs text-slate-500">Daily USD exchange volume & USD service fees collected.</p>
                  </div>
                </div>
                <div className="h-72 w-full">
                  {isChartsLoading ? (
                    <div className="h-full animate-pulse rounded-xl bg-slate-800/70" aria-label="Loading activity chart" />
                  ) : isChartsError ? (
                    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-red-500/25 bg-red-500/5 text-sm text-red-300">
                      <p>Activity chart could not be loaded.</p>
                      <button type="button" onClick={() => refetchCharts()} className="mt-3 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-bold outline-none hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400">Retry</button>
                    </div>
                  ) : dailyStats.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
                      No chart activity recorded in the last 7 days.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2eaf5" />
                        <XAxis dataKey="_id" stroke="#687895" fontSize={11} />
                        <YAxis stroke="#687895" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#dce8ff', borderRadius: 14, color: '#17254b', boxShadow: '0 16px 32px -20px rgba(48, 74, 135, 0.45)' }} />
                        <Area type="monotone" dataKey="volumeUSD" name="Volume (USD)" stroke="#3e5bff" fill="#3e5bff" fillOpacity={0.16} />
                        <Area type="monotone" dataKey="serviceFeesUSD" name="Service Fees (USD)" stroke="#20b9f5" fill="#20b9f5" fillOpacity={0.12} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-white">Cashier Activity</h2>
                    <p className="mt-1 text-xs text-slate-500">Currently open cash shift sessions.</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                    {isStatsLoading ? 'Checking…' : isStatsError ? 'Unavailable' : `${stats?.openCashiersCount ?? 0} Open`}
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {isStatsLoading ? (
                    [0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-800/70" />)
                  ) : isStatsError ? (
                    <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-10 text-center text-sm text-red-300">
                      Cashier activity is unavailable.
                    </div>
                  ) : activeSessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-sm text-slate-500">
                      No active cashier shifts.
                    </div>
                  ) : (
                    activeSessions.map((session) => (
                      <Link
                        key={session._id}
                        href={`/cash-sessions/${session._id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-4 hover:border-slate-700 transition-all"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-200">{(session.cashierId as any)?.name || 'Cashier'}</p>
                          <p className="mt-1 font-mono text-[11px] text-slate-500">{session.sessionNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-emerald-400">OPEN</p>
                          <p className="mt-1 text-[11px] text-slate-400 font-mono">UGX {formatAmount(session.openingCash)}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Development Tools Modal (Dev Mode & Admin Only) */}
          {showDevelopmentTools && (
            <section className="rounded-2xl border border-red-500/30 bg-red-950/15 p-5 shadow-sm shadow-black/10 sm:p-6">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-red-400">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Development Environment Only
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-white">Development Tools</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Reset development test data while preserving user accounts, roles, and permissions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResetConfirmation('');
                    setResetError('');
                    setIsResetDialogOpen(true);
                  }}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-300 outline-none transition hover:border-red-400/60 hover:bg-red-500/20 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Reset Development Data
                </button>
              </div>

              {resetResult && (
                <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">
                  Database reset complete. Deleted {Object.values(resetResult.deleted).reduce((total, count) => total + count, 0)} test records; preserved {resetResult.usersPreserved} users.
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {showDevelopmentTools && isResetDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-development-title"
            className="w-full max-w-lg rounded-2xl border border-red-500/35 bg-slate-900 p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-red-400">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-red-400">Development Environment Only</p>
                  <h2 id="reset-development-title" className="mt-1 text-xl font-bold text-white">Reset Development Data</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetDialogOpen(false)}
                aria-label="Close reset dialog"
                className="rounded-lg p-2 text-slate-500 outline-none transition hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
              <p>This will permanently delete all development test records.</p>
              <p className="font-semibold text-red-300">This action cannot be undone.</p>
              <p>Type <span className="font-mono font-bold text-white">RESET</span> to continue.</p>
            </div>

            <label htmlFor="reset-confirmation" className="mt-5 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Confirmation
            </label>
            <input
              id="reset-confirmation"
              type="text"
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value)}
              autoComplete="off"
              placeholder="Type RESET"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />

            {resetError && <p className="mt-3 text-sm text-red-400" role="alert">{resetError}</p>}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsResetDialogOpen(false)}
                disabled={resetDevelopmentData.isPending}
                className="min-h-11 rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-bold text-slate-300 outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resetDevelopmentData.mutate()}
                disabled={resetConfirmation !== 'RESET' || resetDevelopmentData.isPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-extrabold text-white outline-none transition hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:bg-red-950 disabled:text-red-500 disabled:opacity-60"
              >
                {resetDevelopmentData.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                {resetDevelopmentData.isPending ? 'Resetting...' : 'Reset Data'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
