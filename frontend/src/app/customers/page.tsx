'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Customer, Transaction, WALLET_LABELS, WalletProvider } from '@/types';
import {
  Users,
  Search,
  UserPlus,
  History,
  X,
  Wallet,
  Clock,
  TrendingUp,
  DollarSign,
  ArrowLeftRight,
} from 'lucide-react';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Customers Registry Query
  const { data, isLoading } = useQuery<{ data: Customer[] }>({
    queryKey: ['customers', search],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { search } });
      return res.data;
    },
  });

  // Selected Customer Detailed Profile Query
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['customerProfile', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return null;
      const res = await api.get(`/customers/${selectedCustomerId}`);
      return res.data.data;
    },
    enabled: !!selectedCustomerId,
  });

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/customers', {
        name,
        phone,
        nationalId: nationalId || undefined,
        address: address || undefined,
        notes: notes || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to register customer');
    },
  });

  const resetForm = () => {
    setName('');
    setPhone('');
    setNationalId('');
    setAddress('');
    setNotes('');
    setError('');
  };

  const customers = data?.data || [];
  const profileCustomer: Customer = profileData?.customer;
  const profileTransactions: Transaction[] = profileData?.transactions || [];
  const profileWalletHistory: any[] = profileData?.walletHistory || [];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-6 flex-1">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Customer Database</h1>
              <p className="text-sm text-slate-400">
                Primary customer directory, lifetime exchange metrics & wallet activity
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-emerald-600/20 transition-all self-start"
            >
              <UserPlus className="w-4 h-4" />
              Register New Customer
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-lg">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone number, customer ID or txn number (e.g. TXN-12345)..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm shadow-inner"
            />
          </div>

          {/* Customers Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold bg-slate-950/50">
                    <th className="py-3.5 px-4">Cust No.</th>
                    <th className="py-3.5 px-4">Customer Name</th>
                    <th className="py-3.5 px-4">Phone Number</th>
                    <th className="py-3.5 px-4">National ID</th>
                    <th className="py-3.5 px-4 text-right">Total Exchanges</th>
                    <th className="py-3.5 px-4 text-right">Lifetime Volume</th>
                    <th className="py-3.5 px-4 text-right">Fees Generated</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        Loading customer registry...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No customers found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    customers.map((cust) => (
                      <tr key={cust._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-emerald-400 font-semibold text-xs">
                          {cust.customerNumber}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-100">
                          {cust.name}
                          {cust.address && <div className="text-xs text-slate-500">{cust.address}</div>}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">{cust.phone}</td>
                        <td className="py-3.5 px-4 text-slate-400 text-xs font-mono">
                          {cust.nationalId || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-300">
                          {cust.stats?.totalTransactions || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                          ${cust.stats?.totalAmountExchanged?.toLocaleString() || '0'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-teal-400">
                          ${cust.stats?.totalProfitGenerated?.toLocaleString() || '0'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                              cust.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {cust.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedCustomerId(cust._id)}
                            className="p-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors"
                          >
                            <History className="w-3.5 h-3.5" />
                            Profile & Ledger
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

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Register New Customer
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">{error}</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCustomerMutation.mutate();
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Abdi Hassan Mohamud"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +252615888999"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    National ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="NID-12345"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Mogadishu"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Client notes..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCustomerMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20"
                >
                  {createCustomerMutation.isPending ? 'Saving...' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL CUSTOMER PROFILE & TRANSACTION LEDGER MODAL */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {profileCustomer?.customerNumber}
                </span>
                <h3 className="text-xl font-bold text-white">{profileCustomer?.name}</h3>
                <p className="text-xs text-slate-400">{profileCustomer?.phone}</p>
              </div>
              <button onClick={() => setSelectedCustomerId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isProfileLoading ? (
              <div className="py-8 text-center text-slate-500">Loading customer profile...</div>
            ) : (
              <div className="space-y-6">
                {/* Metrics Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Lifetime Volume</span>
                    <p className="text-base font-extrabold text-emerald-400 mt-0.5">
                      ${profileCustomer?.stats?.totalAmountExchanged?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Fees Generated</span>
                    <p className="text-base font-extrabold text-teal-400 mt-0.5">
                      ${profileCustomer?.stats?.totalProfitGenerated?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Exchanges Count</span>
                    <p className="text-base font-extrabold text-white mt-0.5">
                      {profileCustomer?.stats?.totalTransactions || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Average Exchange</span>
                    <p className="text-base font-extrabold text-blue-400 mt-0.5">
                      ${profileCustomer?.stats?.averageTransactionAmount?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Last Visit</span>
                    <p className="text-xs font-semibold text-slate-300 mt-1">
                      {profileCustomer?.stats?.lastVisitAt
                        ? new Date(profileCustomer.stats.lastVisitAt).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Wallet Usage Distribution History */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    Digital Wallet Channel Usage History
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {profileWalletHistory.length === 0 ? (
                      <div className="col-span-4 text-center text-slate-500 text-xs py-2">No wallet transactions recorded</div>
                    ) : (
                      profileWalletHistory.map((w: any) => (
                        <div key={w._id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                          <span className="font-semibold text-slate-300">
                            {WALLET_LABELS[w._id as WalletProvider] || w._id}
                          </span>
                          <div className="mt-1 flex justify-between">
                            <span className="text-slate-400">{w.count} Txn(s)</span>
                            <strong className="text-emerald-400">${w.totalVolume.toLocaleString()}</strong>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Transaction Ledger Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                    Customer Transactions Ledger
                  </h4>

                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400 font-semibold bg-slate-900/50">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Txn No.</th>
                          <th className="py-2.5 px-3">Wallet</th>
                          <th className="py-2.5 px-3 text-right">Received</th>
                          <th className="py-2.5 px-3 text-right">Fee</th>
                          <th className="py-2.5 px-3 text-right">Cash Given</th>
                          <th className="py-2.5 px-3">Cashier</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                        {profileTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-500">
                              No transactions recorded for this customer.
                            </td>
                          </tr>
                        ) : (
                          profileTransactions.map((t) => (
                            <tr key={t._id} className="hover:bg-slate-900/50">
                              <td className="py-2.5 px-3 text-slate-400">
                                {new Date(t.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3 text-emerald-400 font-bold">{t.transactionNumber}</td>
                              <td className="py-2.5 px-3 text-slate-300">
                                {WALLET_LABELS[t.walletProvider] || t.walletProvider}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-100">${t.amountReceived.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right text-teal-400">${t.serviceFee.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-400">${t.cashPaid.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-slate-300 font-sans">{(t.cashierId as any)?.name || 'Cashier'}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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

                <div className="pt-2 flex justify-end border-t border-slate-800">
                  <button
                    onClick={() => setSelectedCustomerId(null)}
                    className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                  >
                    Close Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
