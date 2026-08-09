'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FeeRule, WALLET_LABELS, WalletProvider } from '@/types';
import { Calculator, Plus, Trash2, Edit3, X, Check } from 'lucide-react';

export default function FeeRulesPage() {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [walletProvider, setWalletProvider] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState<number | ''>(0);
  const [maxAmount, setMaxAmount] = useState<number | ''>('');
  const [feeType, setFeeType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [feeValue, setFeeValue] = useState<number | ''>('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<{ data: FeeRule[] }>({
    queryKey: ['feeRules'],
    queryFn: async () => {
      const res = await api.get('/fee-rules');
      return res.data;
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/fee-rules', {
        name,
        walletProvider,
        minAmount: Number(minAmount),
        maxAmount: maxAmount !== '' ? Number(maxAmount) : null,
        feeType,
        feeValue: Number(feeValue),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeRules'] });
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create fee rule');
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fee-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeRules'] });
    },
  });

  const resetForm = () => {
    setName('');
    setWalletProvider('ALL');
    setMinAmount(0);
    setMaxAmount('');
    setFeeType('FIXED');
    setFeeValue('');
    setError('');
  };

  const rules = data?.data || [];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-6 flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Dynamic Fee Rules Manager</h1>
              <p className="text-sm text-slate-400">
                Configure tier-based service fees per wallet provider. Cashiers never calculate manually.
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-emerald-600/20 transition-all self-start"
            >
              <Plus className="w-4 h-4" />
              New Tier Fee Rule
            </button>
          </div>

          {/* Rules Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold bg-slate-950/50">
                    <th className="py-3.5 px-4">Rule Name</th>
                    <th className="py-3.5 px-4">Wallet Provider</th>
                    <th className="py-3.5 px-4">Min Amount</th>
                    <th className="py-3.5 px-4">Max Amount</th>
                    <th className="py-3.5 px-4">Fee Structure</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Loading fee rules...
                      </td>
                    </tr>
                  ) : rules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No fee rules defined yet. Click "New Tier Fee Rule" to create one.
                      </td>
                    </tr>
                  ) : (
                    rules.map((rule) => (
                      <tr key={rule._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-100">{rule.name}</td>
                        <td className="py-3.5 px-4 text-slate-300">
                          <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-xs font-semibold">
                            {rule.walletProvider === 'ALL'
                              ? 'All Providers'
                              : WALLET_LABELS[rule.walletProvider as WalletProvider] || rule.walletProvider}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-200">${rule.minAmount.toLocaleString()}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-200">
                          {rule.maxAmount ? `$${rule.maxAmount.toLocaleString()}` : 'Infinity (500k+)'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">
                          {rule.feeType === 'FIXED' ? `$${rule.feeValue}` : `${rule.feeValue}%`}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {rule.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => deleteRuleMutation.mutate(rule._id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete Fee Rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Add Fee Rule Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-400" />
                Create Tiered Fee Rule
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createRuleMutation.mutate();
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 1 - 100k Standard Fee"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Wallet Provider
                </label>
                <select
                  value={walletProvider}
                  onChange={(e) => setWalletProvider(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Providers</option>
                  {Object.entries(WALLET_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Min Amount ($) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Max Amount ($) (Blank = Infinity)
                  </label>
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 500000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Fee Type
                  </label>
                  <select
                    value={feeType}
                    onChange={(e) => setFeeType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="FIXED">Fixed Amount ($)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Fee Value *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={feeValue}
                    onChange={(e) => setFeeValue(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 500 or 1.5"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRuleMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20"
                >
                  {createRuleMutation.isPending ? 'Saving...' : 'Save Fee Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
