'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CashSession, Transaction, WALLET_LABELS } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import {
  Wallet,
  ArrowLeft,
  Lock,
  RefreshCw,
  Clock,
  User,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import OpeningBalancesGrid from '@/components/cash-sessions/OpeningBalancesGrid';
import ReconciliationAccounts from '@/components/cash-sessions/ReconciliationAccounts';
import ShiftLedger from '@/components/cash-sessions/ShiftLedger';

export default function SessionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const id = params.id as string;

  const [reopenError, setReopenError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['cashSessionDetails', id],
    queryFn: async () => {
      const res = await api.get(`/cash-sessions/${id}`);
      return res.data.data;
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/cash-sessions/${id}/reopen`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashSessionDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['activeCashSession'] });
      queryClient.invalidateQueries({ queryKey: ['cashSessionsList'] });
      setReopenError('');
    },
    onError: (err: any) => {
      setReopenError(err.response?.data?.message || 'Failed to reopen session');
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <div className="p-8 text-center text-slate-500">Loading session details...</div>
        </div>
      </div>
    );
  }

  const session: CashSession = data?.session;
  const transactions: Transaction[] = data?.transactions || [];
  const totalCashPaidOut: number = data?.totalCashPaidOut || 0;
  const totalCashAdded: number = data?.totalCashAdded || 0;
  const totalCashWithdrawn: number = data?.totalCashWithdrawn || 0;
  const expectedClosingCash: number = data?.expectedClosingCash || 0;

  if (!session) {
    return (
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <div className="p-8 text-center text-slate-500">Session not found.</div>
        </div>
      </div>
    );
  }

  const isManagerOrAdmin = user && (user.role === 'ADMIN' || user.role === 'MANAGER');
  const closingRecords = session.closingHistory || [];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-8 flex-1 max-w-6xl mx-auto w-full">
          {/* Header & Back Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div className="flex items-center gap-4">
              <Link
                href="/cash-sessions"
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-brand-600 font-bold">
                    {session.sessionNumber}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-full border uppercase ${
                      session.status === 'OPEN'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
                  Cash Shift Audit & Details
                </h1>
              </div>
            </div>

            {/* Reopen Action Button for Admin/Manager */}
            {session.status === 'CLOSED' && isManagerOrAdmin && (
              <button
                disabled={reopenMutation.isPending}
                onClick={() => reopenMutation.mutate()}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-[#ffffff] font-bold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-brand-600/20 transition-all self-start"
              >
                <RefreshCw className="w-4 h-4" />
                {reopenMutation.isPending ? 'Reopening...' : 'Reopen Session (Manager)'}
              </button>
            )}
          </div>

          {reopenError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl">
              {reopenError}
            </div>
          )}

          {/* Session Overview Card */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <User className="w-5 h-5 text-brand-600 shrink-0" />
                <div>
                  <span className="text-slate-400">Cashier:</span>
                  <div className="font-bold text-white text-sm">{(session.cashierId as any)?.name || 'Cashier'}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{(session.cashierId as any)?.role}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <Clock className="w-5 h-5 text-ink shrink-0" />
                <div>
                  <span className="text-slate-400">Opened Time:</span>
                  <div className="font-bold text-slate-200">{new Date(session.openedAt).toLocaleString()}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <span className="text-slate-400">Closed Time:</span>
                  <div className="font-bold text-slate-200">
                    {session.closedAt ? new Date(session.closedAt).toLocaleString() : 'Still Active'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Opening Balances</h2>
              <p className="mt-1 text-xs text-slate-500">
                Separate balances recorded when this shift was opened.
              </p>
            </div>
            <OpeningBalancesGrid session={session} />
          </section>

          {/* Financial Breakdown Cards */}
          {session.ledgerVersion === 1 && <ShiftLedger shiftId={id} canCorrect={session.status === 'OPEN' && (user?.role === 'ADMIN' || user?.role === 'MANAGER')} />}
          {!session.ledgerVersion && session.openingVersion !== 2 && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase">Total Cash Paid Out</span>
              <p className="text-2xl font-extrabold text-blue-400">UGX {totalCashPaidOut.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500">{transactions.length} Transactions processed</p>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase">In-Shift Cash Adjustments (UGX)</span>
              <p className="text-sm font-bold text-brand-600">UGX +{totalCashAdded.toLocaleString()} Added</p>
              <p className="text-sm font-bold text-ink">UGX -{totalCashWithdrawn.toLocaleString()} Withdrawn</p>
            </div>

            <div className="p-5 bg-slate-900 border border-line rounded-2xl shadow-xl space-y-1">
              <span className="text-xs font-semibold text-brand-600 uppercase">Expected Closing Cash (UGX)</span>
              <p className="text-2xl font-extrabold text-brand-600">UGX {expectedClosingCash.toLocaleString()}</p>
            </div>
          </div>}

          {closingRecords.length > 0 && (
            <section className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-white">Closing & Reconciliation History</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Preserved closing snapshots. Reopening a shift does not overwrite earlier records.
                </p>
              </div>
              {[...closingRecords].reverse().map((record, index) => (
                <div key={record._id || record.closedAt} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
                        {index === 0 ? 'Latest Closing Record' : 'Previous Closing Record'}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">Closed {new Date(record.closedAt).toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                      Closed by: <span className="font-semibold text-white">{(record.closedBy as any)?.name || 'Authorized user'}</span>
                    </p>
                  </div>
                  <ReconciliationAccounts accounts={record.accounts} />
                  {record.notes && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                      <span className="font-semibold text-slate-500">Closing notes: </span>{record.notes}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Legacy sessions closed before per-account reconciliation was introduced */}
          {session.status === 'CLOSED' && closingRecords.length === 0 && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white">Reconciliation Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Expected Closing Cash (UGX):</span>
                  <p className="text-xl font-bold text-slate-200 mt-1">
                    UGX {(session.closingCashSystem ?? expectedClosingCash).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Actual Closing Cash (UGX):</span>
                  <p className="text-xl font-bold text-brand-600 mt-1">
                    UGX {(session.closingCashActual ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Cash Difference (UGX):</span>
                  <p className="text-xl font-extrabold mt-1">
                    {session.discrepancy === undefined || session.discrepancy === 0 ? (
                      <span className="text-emerald-400">UGX 0 (Perfect Match)</span>
                    ) : session.discrepancy < 0 ? (
                      <span className="text-red-400">UGX -{Math.abs(session.discrepancy).toLocaleString()} (Shortage)</span>
                    ) : (
                      <span className="text-amber-400">UGX +{session.discrepancy.toLocaleString()} (Overage)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transactions Belonging to Session */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Shift Transactions Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold bg-slate-950/50">
                    <th className="py-3 px-4">Txn No.</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Wallet Provider</th>
                    <th className="py-3 px-4 text-right">Received (USD)</th>
                    <th className="py-3 px-4 text-right">Fee (USD)</th>
                    <th className="py-3 px-4 text-right">Cash Paid (UGX)</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">
                        No transactions recorded during this shift.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-brand-600 font-semibold text-xs">
                          {t.transactionNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-200">
                          {(t.customerId as any)?.name || 'Customer'}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-xs">
                            {WALLET_LABELS[t.walletProvider] || t.walletProvider}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-100">
                          USD {(t.amountReceivedUSD ?? t.amountReceived).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-ink">
                          USD {(t.serviceFeeUSD ?? t.serviceFee).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-brand-600">
                          UGX {(t.cashPaidUGX ?? t.cashPaid).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
