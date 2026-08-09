'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  ChevronRight,
  Clock3,
  History,
  Loader2,
  LockKeyhole,
  LogOut,
  ReceiptText,
  SlidersHorizontal,
  Settings,
  Trash2,
  UserRound,
  Users,
  Wallet,
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
import { api } from '@/lib/api';
import { CashSession, DashboardStats, Transaction, WALLET_LABELS } from '@/types';
import { useAuth } from '@/providers/AuthProvider';

const formatAmount = (value?: number) => (value || 0).toLocaleString();
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
  accent = 'emerald',
  unit,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof Wallet;
  accent?: 'emerald' | 'blue' | 'amber';
  unit?: string;
}) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <div className={`rounded-xl border p-2.5 ${colors[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 break-words text-xl font-extrabold leading-tight tracking-tight text-white 2xl:text-2xl">
        {value}{unit && <span className="ml-2 text-sm font-bold text-slate-400">{unit}</span>}
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </section>
  );
}

function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl shadow-black/10">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-bold text-white">Recent Transactions</h2>
          <p className="mt-1 text-xs text-slate-500">Latest customer exchanges recorded by the business.</p>
        </div>
        <Link href="/transactions" className="shrink-0 text-xs font-bold text-emerald-400 hover:text-emerald-300">
          View all
        </Link>
      </div>

      <div className="divide-y divide-slate-800 md:hidden">
        {transactions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No transactions recorded yet.</div>
        ) : (
          transactions.map((transaction) => (
            <div key={transaction._id} className="space-y-3 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-bold text-emerald-400">{transaction.transactionNumber}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{(transaction.customerId as any)?.name || 'Customer'}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-950/60 p-3 text-xs">
                <div>
                  <p className="text-slate-500">Received</p>
                  <p className="mt-1 font-bold text-white">USD {formatAmount(transaction.amountReceivedUSD ?? transaction.amountReceived)}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">Cash paid</p>
                  <p className="mt-1 font-bold text-emerald-400">UGX {formatAmount(transaction.cashPaidUGX ?? transaction.cashPaid)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">Transaction</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Fee</th>
              <th className="px-6 py-3 text-right">Cash Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                  No transactions recorded yet.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction._id} className="transition-colors hover:bg-slate-800/35">
                  <td className="px-6 py-4">
                    <p className="font-mono text-xs font-bold text-emerald-400">{transaction.transactionNumber}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-200">{(transaction.customerId as any)?.name || 'Customer'}</p>
                    <p className="mt-1 text-xs text-slate-500">{transaction.customerPhone}</p>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-300">
                    {WALLET_LABELS[transaction.walletProvider] || transaction.walletProvider}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-white">
                    USD {formatAmount(transaction.amountReceivedUSD ?? transaction.amountReceived)}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-blue-400">
                    USD {formatAmount(transaction.serviceFeeUSD ?? transaction.serviceFee)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-400">
                    UGX {formatAmount(transaction.cashPaidUGX ?? transaction.cashPaid)}
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
  const classes = `group flex min-h-32 w-full items-center gap-4 rounded-2xl border p-5 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
    disabled
      ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500 opacity-55'
      : primary
        ? 'border-emerald-500/50 bg-emerald-600 text-white shadow-lg shadow-emerald-950/40 hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-xl'
        : 'border-slate-800 bg-slate-900 text-white shadow-sm shadow-black/10 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-800/80'
  }`;

  const content = (
    <>
      <div className={`shrink-0 rounded-xl p-3 ${disabled ? 'bg-slate-800/70' : primary ? 'bg-white/15' : 'bg-slate-800 text-emerald-400'}`}>
        {loading ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <Icon className="h-6 w-6" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{loading ? 'Checking shift...' : label}</p>
        <p className={`mt-1 text-xs leading-5 ${primary && !disabled ? 'text-emerald-50' : 'text-slate-500'}`}>{description}</p>
      </div>
      {!disabled && !loading && <ChevronRight className="h-5 w-5 shrink-0 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />}
    </>
  );

  if (disabled || loading) {
    return <div className={classes} aria-disabled="true" aria-label={`${label}. ${description}`}>{content}</div>;
  }

  return <Link href={href} className={classes} aria-label={`${label}. ${description}`}>{content}</Link>;
}

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const queryClient = useQueryClient();
  const isCashier = user?.role === 'CASHIER';
  const showDevelopmentTools = isDevelopment && user?.role === 'ADMIN';
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetResult, setResetResult] = useState<DevelopmentResetResult | null>(null);
  const [resetError, setResetError] = useState('');

  const { data: statsData } = useQuery<{ data: DashboardStats & { activeSessions?: CashSession[] } }>({
    queryKey: ['dashboardStats'],
    queryFn: async () => (await api.get('/dashboard/stats')).data,
  });

  const { data: chartsData } = useQuery({
    queryKey: ['dashboardCharts'],
    queryFn: async () => (await api.get('/dashboard/charts')).data.data,
    enabled: Boolean(user && !isCashier),
  });

  const { data: sessionData, isLoading: isSessionLoading } = useQuery<{ data: CashSession | null }>({
    queryKey: ['activeCashSession'],
    queryFn: async () => (await api.get('/cash-sessions/current')).data,
  });

  const { data: recentData } = useQuery<{ data: Transaction[] }>({
    queryKey: ['recentTransactions'],
    queryFn: async () => (await api.get('/dashboard/recent')).data,
  });

  const stats = statsData?.data;
  const activeSession = sessionData?.data;
  const recentTransactions = recentData?.data || [];
  const activeSessions = stats?.activeSessions || [];
  const dailyStats = chartsData?.dailyStats || [];
  const drawerCash = isCashier
    ? activeSession?.currentCashBalance ?? activeSession?.openingCash ?? 0
    : stats?.cashAvailable ?? 0;

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
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-950">
      <div className="hidden lg:block"><Sidebar /></div>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-7 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 lg:hidden">
            <div>
              <p className="text-sm font-extrabold tracking-wide text-white">MUMIN AGENT</p>
              <p className="mt-0.5 text-xs text-slate-500">Cash Exchange Workspace</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">{user?.role}</span>
              <button
                type="button"
                onClick={logout}
                aria-label="Log out"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 outline-none transition hover:border-slate-700 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
                {isCashier ? 'Cashier workspace' : 'Business overview'}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {isCashier ? `Ready to serve, ${user?.name}` : 'Today at Mumin Agent'}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {isCashier
                  ? activeSession
                    ? 'Your shift is open and the drawer is ready.'
                    : 'Open a cash shift before serving customers.'
                  : 'Cash, shifts, and customer activity in one place.'}
              </p>
            </div>
            <span
              className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                isCashier ? activeSession : (stats?.openCashiersCount || 0) > 0
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  (isCashier ? activeSession : (stats?.openCashiersCount || 0) > 0) ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {isCashier
                ? activeSession ? 'Shift open' : 'No open shift'
                : `${stats?.openCashiersCount || 0} open cash session${stats?.openCashiersCount === 1 ? '' : 's'}`}
            </span>
          </header>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Current Drawer Cash (UGX)"
              value={`UGX ${formatAmount(drawerCash)}`}
              description="Physical UGX cash currently available to pay customers."
              icon={Wallet}
            />
            <MetricCard
              label="Today's Transactions"
              value={formatAmount(stats?.todayTransactionsCount)}
              unit="Transactions"
              description="Completed customer transactions today."
              icon={ReceiptText}
              accent="blue"
            />
            <MetricCard
              label="Today's Exchange Volume (USD)"
              value={`USD ${formatAmount(stats?.todayVolume)}`}
              description="Total digital USD received from customers today."
              icon={ArrowLeftRight}
              accent="blue"
            />
            <MetricCard
              label="Today's Service Fees (USD)"
              value={`USD ${formatAmount(stats?.todayProfit)}`}
              description="Total service fees collected today."
              icon={BarChart3}
              accent="amber"
            />

            {isCashier ? (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Shift</p>
                  <Clock3 className="h-5 w-5 text-emerald-400" />
                </div>
                <p className={`mt-3 text-2xl font-extrabold ${activeSession ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {activeSession ? 'Open' : 'Closed'}
                </p>
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <p>Cashier: <span className="text-slate-300">{user?.name || '—'}</span></p>
                  <p>
                    Opening time:{' '}
                    <span className="text-slate-300">
                      {activeSession?.openedAt
                        ? new Date(activeSession.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </span>
                  </p>
                </div>
              </section>
            ) : (
              <MetricCard
                label="Open Cash Sessions"
                value={formatAmount(stats?.openCashiersCount)}
                unit="Open"
                description="Cashier drawers currently serving customers."
                icon={Clock3}
              />
            )}
          </section>

          <section>
            <div className="mb-4">
              <h2 className="font-bold text-white">Quick Actions</h2>
              <p className="mt-1 text-xs text-slate-500">The most common tasks are one click away.</p>
            </div>
            {isCashier && !isSessionLoading && !activeSession && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p><span className="font-bold">Shift required.</span> Open a shift before recording transactions.</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ActionLink
                href="/transactions/new"
                label="New Transaction"
                description={activeSession ? 'Record a customer payment and cash payout.' : 'Open a shift before recording transactions.'}
                icon={ArrowLeftRight}
                primary={Boolean(activeSession)}
                disabled={!activeSession && !isSessionLoading}
                loading={isSessionLoading}
              />
              <ActionLink href="/transactions" label="Transaction History" description="Search and review previous exchanges." icon={History} />
              <ActionLink href="/customers" label="View Customers" description="Find customer details and transaction history." icon={UserRound} />
              {isCashier ? (
                activeSession ? (
                  <ActionLink href="/cash-sessions" label="Close Shift" description="Count cash and complete today’s reconciliation." icon={LockKeyhole} />
                ) : (
                  <ActionLink href="/cash-sessions" label="Open Shift" description="Enter your opening UGX drawer cash to begin." icon={Wallet} primary />
                )
              ) : (
                <>
                  <ActionLink href="/reports" label="View Reports" description="Review performance and financial summaries." icon={BarChart3} />
                  <ActionLink href="/cash-sessions" label="Cash Sessions" description="Review open cashier drawers." icon={Wallet} />
                  <ActionLink href="/users" label="Manage Users" description="Manage cashier and manager access." icon={Users} />
                  <ActionLink href="/fee-rules" label="Fee Rules" description="Review service fee configuration." icon={SlidersHorizontal} />
                  <ActionLink href="/exchange-rate" label="Exchange Rate" description="Maintain the active USD to UGX rate." icon={Settings} />
                </>
              )}
            </div>
          </section>

          <RecentTransactions transactions={recentTransactions} />

          {!isCashier && (
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10 xl:col-span-2 sm:p-6">
                <div className="mb-6">
                  <h2 className="font-bold text-white">7-Day Activity</h2>
                  <p className="mt-1 text-xs text-slate-500">USD exchange volume and service fees.</p>
                </div>
                <div className="h-72 w-full">
                  {dailyStats.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
                      No chart data available yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="_id" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12 }} />
                        <Area type="monotone" dataKey="volume" name="Volume (USD)" stroke="#10b981" fill="#10b981" fillOpacity={0.16} />
                        <Area type="monotone" dataKey="profit" name="Fees (USD)" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-white">Cashier Performance</h2>
                    <p className="mt-1 text-xs text-slate-500">Currently open cash sessions.</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                    {stats?.openCashiersCount || 0} Open
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {activeSessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-sm text-slate-500">
                      No cashier shifts are open.
                    </div>
                  ) : (
                    activeSessions.map((session) => (
                      <Link
                        key={session._id}
                        href={`/cash-sessions/${session._id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-4 hover:border-slate-700"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-200">{(session.cashierId as any)?.name || 'Cashier'}</p>
                          <p className="mt-1 font-mono text-[11px] text-slate-500">{session.sessionNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-emerald-400">OPEN</p>
                          <p className="mt-1 text-[11px] text-slate-500">UGX {formatAmount(session.openingCash)}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {showDevelopmentTools && (
            <section className="rounded-2xl border border-red-500/30 bg-red-950/15 p-5 shadow-sm shadow-black/10 sm:p-6">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-red-400">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Development Only
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-white">Development Tools</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Remove testing records while preserving every user account, role, permission, and application setting.
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
                  Database reset complete. Deleted {Object.values(resetResult.deleted).reduce((total, count) => total + count, 0)} business records; preserved {resetResult.usersPreserved} users.
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
                  <p className="text-xs font-extrabold uppercase tracking-wider text-red-400">Development Only</p>
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
