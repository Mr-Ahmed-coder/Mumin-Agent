'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Transaction, WALLET_LABELS, WalletProvider } from '@/types';
import {
  ArrowLeftRight,
  Search,
  Filter,
  Eye,
  XCircle,
  Calendar,
  X,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

export default function TransactionsListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [walletFilter, setWalletFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [cancelModalTxn, setCancelModalTxn] = useState<Transaction | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const { data, isLoading } = useQuery<{ data: Transaction[] }>({
    queryKey: ['transactions', search, walletFilter, statusFilter],
    queryFn: async () => {
      const res = await api.get('/transactions', {
        params: { search, walletProvider: walletFilter || undefined, status: statusFilter || undefined },
      });
      return res.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelModalTxn) return;
      const res = await api.post(`/transactions/${cancelModalTxn._id}/cancel`, {
        cancellationReason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setCancelModalTxn(null);
      setCancellationReason('');
      setCancelError('');
    },
    onError: (err: any) => {
      setCancelError(err.response?.data?.message || 'Failed to cancel transaction');
    },
  });

  const transactions = data?.data || [];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-6 flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Transactions Ledger</h1>
              <p className="text-sm text-slate-400">
                Complete history of digital balance to cash exchanges
              </p>
            </div>
            <Link
              href="/transactions/new"
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-emerald-600/20 transition-all self-start"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Process New Exchange
            </Link>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by transaction number, reference number or phone..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm"
              />
            </div>

            <select
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-slate-300 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Wallet Providers</option>
              {Object.entries(WALLET_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-slate-300 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Transactions Data Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold bg-slate-950/50">
                    <th className="py-3.5 px-4">Txn No.</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Wallet</th>
                    <th className="py-3.5 px-4">Ref No.</th>
                    <th className="py-3.5 px-4 text-right">Received (USD)</th>
                    <th className="py-3.5 px-4 text-right">Fee (USD)</th>
                    <th className="py-3.5 px-4 text-right">Rate (UGX)</th>
                    <th className="py-3.5 px-4 text-right">Cash Paid (UGX)</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500">
                        Loading transactions...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500">
                        No transactions found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn) => (
                      <tr key={txn._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-emerald-400 text-xs">
                          {txn.transactionNumber}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {new Date(txn.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-200">
                          {(txn.customerId as any)?.name || 'N/A'}
                          <div className="text-xs text-slate-500 font-mono">{txn.customerPhone}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-medium">
                            {String(txn.walletProvider) === 'CASH_USD' ? 'USD Cash' : WALLET_LABELS[txn.walletProvider] || txn.walletProvider}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300 text-xs">{txn.referenceNumber}</td>
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-100 font-mono">
                          ${(txn.amountReceivedUSD || txn.amountReceived).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-teal-400 font-mono">
                          ${(txn.serviceFeeUSD || txn.serviceFee).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-400 font-mono">
                          {(txn.exchangeRateUGX || 3700).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-400 font-mono">
                          UGX {(txn.cashPaidUGX || txn.cashPaid).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                              txn.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {txn.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center space-x-1">
                          <button
                            onClick={() => setSelectedTxn(txn)}
                            className="p-1.5 inline-block text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Receipt"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {txn.status === 'COMPLETED' && (
                            <button
                              onClick={() => {
                                setCancelError('');
                                setCancellationReason('');
                                setCancelModalTxn(txn);
                              }}
                              className="p-1.5 inline-block text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Cancel Transaction"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Transaction Details Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {selectedTxn.transactionNumber}
                </span>
                <h3 className="text-lg font-bold text-white">Transaction Details</h3>
              </div>
              <button
                onClick={() => setSelectedTxn(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-white">{(selectedTxn.customerId as any)?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Phone:</span>
                <span className="font-mono text-slate-300">{selectedTxn.customerPhone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Wallet:</span>
                <span className="font-semibold text-slate-300">{String(selectedTxn.walletProvider) === 'CASH_USD' ? 'USD Cash' : WALLET_LABELS[selectedTxn.walletProvider] || selectedTxn.walletProvider}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Reference No.:</span>
                <span className="font-mono text-slate-300">{selectedTxn.referenceNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Amount Received:</span>
                <span className="font-semibold text-slate-100">${selectedTxn.amountReceived.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Service Fee:</span>
                <span className="font-semibold text-teal-400">${selectedTxn.serviceFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Cash Paid Out:</span>
                <span className="font-bold text-emerald-400">${selectedTxn.cashPaid.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setSelectedTxn(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Transaction Modal */}
      {cancelModalTxn && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Cancel Transaction
              </h3>
              <button
                onClick={() => setCancelModalTxn(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cancelError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {cancelError}
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Are you sure you want to cancel transaction <strong className="text-emerald-400">{cancelModalTxn.transactionNumber}</strong>?
                This will reverse customer volume statistics.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Reason for Cancellation *
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="State why this exchange is being revoked..."
                  rows={3}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 text-xs focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
              <button
                onClick={() => setCancelModalTxn(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-xs font-semibold"
              >
                Keep Transaction
              </button>
              <button
                disabled={!cancellationReason.trim() || cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
