'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ExchangeRate } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { RefreshCw, DollarSign, TrendingUp, History, CheckCircle, ShieldAlert } from 'lucide-react';

export default function ExchangeRatePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newRate, setNewRate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Active Rate Query
  const { data: activeData, isLoading: isActiveLoading } = useQuery<{ data: ExchangeRate }>({
    queryKey: ['activeExchangeRate'],
    queryFn: async () => {
      const res = await api.get('/exchange-rates/active');
      return res.data;
    },
  });

  // History Rate Query
  const { data: historyData, isLoading: isHistoryLoading } = useQuery<{ data: ExchangeRate[] }>({
    queryKey: ['exchangeRateHistory'],
    queryFn: async () => {
      const res = await api.get('/exchange-rates/history');
      return res.data;
    },
    enabled: isAdminOrManager,
  });

  const activeRate = activeData?.data;
  const historyList = historyData?.data || [];

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/exchange-rates', { rate: Number(newRate) });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeExchangeRate'] });
      queryClient.invalidateQueries({ queryKey: ['exchangeRateHistory'] });
      setSuccess(`Exchange rate updated successfully to 1 USD = ${Number(newRate).toLocaleString()} UGX`);
      setError('');
      setNewRate('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update exchange rate');
      setSuccess('');
    },
  });

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-8 flex-1 max-w-5xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-brand-600" />
                Exchange Rate Management (USD &rarr; UGX)
              </h1>
              <p className="text-sm text-slate-400">
                Set and maintain active USD to UGX conversion rates for agent cash payouts
              </p>
            </div>
          </div>

          {/* Alerts */}
          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-2xl flex items-center gap-2">
              <CheckCircle className="w-5 h-5 shrink-0" />
              {success}
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-2xl flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {/* Active Exchange Rate Banner */}
          <div className="p-8 rounded-2xl bg-white border border-line shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active Market Conversion Rate
                </span>
                <h2 className="text-4xl font-extrabold text-white tracking-tight mt-3">
                  1 USD = {isActiveLoading ? '...' : (activeRate?.rate || 3700).toLocaleString()} UGX
                </h2>
                <p className="text-xs text-slate-400 mt-2">
                  Effective Since:{' '}
                  <span className="text-slate-200 font-medium">
                    {activeRate?.effectiveDate ? new Date(activeRate.effectiveDate).toLocaleString() : 'N/A'}
                  </span>
                </p>
              </div>

              <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-2xl text-right space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Pair Currency</span>
                <div className="text-lg font-bold text-brand-600">USD / UGX</div>
                <div className="text-[11px] text-slate-500">Digital USD &rarr; Cash UGX</div>
              </div>
            </div>

            {/* Admin Update Rate Form */}
            {isAdminOrManager ? (
              <div className="pt-6 border-t border-slate-800/80 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Update Today's Exchange Rate
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateMutation.mutate();
                  }}
                  className="flex flex-col sm:flex-row items-center gap-4"
                >
                  <div className="relative flex-1 w-full">
                    <span className="absolute left-3.5 top-3 text-slate-500 text-xs font-bold">UGX / 1 USD:</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                      placeholder="e.g. 3700"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-32 pr-4 text-white text-sm font-extrabold focus:outline-none focus:border-brand-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-[#ffffff] font-bold text-sm shadow-lg shadow-brand-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${updateMutation.isPending ? 'animate-spin' : ''}`} />
                    {updateMutation.isPending ? 'Updating Rate...' : 'Set Active Rate'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">
                Only Owners, Managers, and Admins can update the daily exchange rate. Cashiers cannot modify rates manually.
              </div>
            )}
          </div>

          {/* Historical Rate Audit Log (Admin Only) */}
          {isAdminOrManager && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-brand-600" />
                Exchange Rate Audit History
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold bg-slate-950/50">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Currency Pair</th>
                      <th className="py-3 px-4 text-right">Exchange Rate</th>
                      <th className="py-3 px-4">Updated By</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {isHistoryLoading ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          Loading rate history...
                        </td>
                      </tr>
                    ) : historyList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          No historical rate changes recorded.
                        </td>
                      </tr>
                    ) : (
                      historyList.map((h) => (
                        <tr key={h._id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 text-slate-300 font-sans text-xs">
                            {new Date(h.effectiveDate || h.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            {h.baseCurrency} &rarr; {h.targetCurrency}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-brand-600">
                            1 USD = {h.rate.toLocaleString()} UGX
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-sans text-xs">
                            {(h.updatedBy as any)?.name || 'System Auto'}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span
                              className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                                h.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {h.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
