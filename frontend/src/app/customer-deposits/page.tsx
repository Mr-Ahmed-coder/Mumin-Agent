'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus, Search, ArrowDownToLine, ArrowUpFromLine, History, X } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { api } from '@/lib/api';
import { CustomerDeposit } from '@/types';

const money = (value: number) => `UGX ${value.toLocaleString()}`;

export default function CustomerDepositsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawRecord, setWithdrawRecord] = useState<CustomerDeposit | null>(null);
  const [profile, setProfile] = useState<CustomerDeposit | null>(null);
  const [deposit, setDeposit] = useState({ customerName: '', phone: '', amountUGX: '', notes: '' });
  const [withdrawal, setWithdrawal] = useState({ amountUGX: '', notes: '' });
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customerDeposits', search],
    queryFn: async () => (await api.get('/customer-deposits', { params: { search: search || undefined } })).data.data,
  });
  const records: CustomerDeposit[] = data?.records || [];
  const summary = data?.summary || { deposited: 0, withdrawn: 0, held: 0 };

  const depositMutation = useMutation({
    mutationFn: () => api.post('/customer-deposits/deposit', { ...deposit, amountUGX: Number(deposit.amountUGX), notes: deposit.notes || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customerDeposits'] }); setDepositOpen(false); setDeposit({ customerName: '', phone: '', amountUGX: '', notes: '' }); setError(''); },
    onError: (err: any) => setError(err.response?.data?.message || 'Unable to record deposit'),
  });
  const withdrawalMutation = useMutation({
    mutationFn: () => api.post(`/customer-deposits/${withdrawRecord?._id}/withdrawals`, { amountUGX: Number(withdrawal.amountUGX), notes: withdrawal.notes || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customerDeposits'] }); setWithdrawRecord(null); setWithdrawal({ amountUGX: '', notes: '' }); setError(''); },
    onError: (err: any) => setError(err.response?.data?.message || 'Unable to record withdrawal'),
  });

  return <div className="flex min-h-screen bg-slate-950"><Sidebar /><div className="min-w-0 flex-1"><Navbar />
    <main className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Landmark className="text-emerald-400" /> Customer Deposits</h1><p className="mt-1 text-sm text-slate-400">UGX held for customers. These balances are liabilities, not revenue.</p></div><button onClick={() => { setDepositOpen(true); setError(''); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"><Plus className="h-4 w-4" /> Record Deposit</button></div>
      <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-blue-200">Customer deposits are kept separate from exchange volume, service fees, profit, and business income.</div>
      <section className="grid gap-4 sm:grid-cols-3">{[['Total Deposited', summary.deposited], ['Total Withdrawn', summary.withdrawn], ['Currently Held', summary.held]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold text-white">{money(Number(value))}</p></div>)}</section>
      <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer name or phone" className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-emerald-500" /></div>
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-950/60 text-xs uppercase text-slate-500"><tr><th className="p-4">Customer</th><th className="p-4">Total Deposited</th><th className="p-4">Total Withdrawn</th><th className="p-4">Current Balance</th><th className="p-4">Updated</th><th className="p-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">{isLoading ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading...</td></tr> : records.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No customer deposit profiles.</td></tr> : records.map((record) => <tr key={record._id} className="text-slate-300"><td className="p-4"><p className="font-bold text-white">{record.customerName}</p><p className="text-xs text-slate-500">{record.phone}</p></td><td className="p-4 font-mono text-emerald-400">{money(record.totalDepositedUGX)}</td><td className="p-4 font-mono text-amber-400">{money(record.totalWithdrawnUGX)}</td><td className="p-4 font-mono text-lg font-bold text-white">{money(record.currentBalanceUGX)}</td><td className="p-4 text-xs">{new Date(record.updatedAt).toLocaleString()}</td><td className="p-4"><div className="flex gap-2"><button onClick={() => setProfile(record)} className="rounded-lg border border-slate-700 p-2" aria-label="View deposit ledger"><History className="h-4 w-4" /></button><button onClick={() => { setDeposit({ customerName: record.customerName, phone: record.phone, amountUGX: '', notes: '' }); setDepositOpen(true); setError(''); }} className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400" aria-label="Add deposit"><ArrowDownToLine className="h-4 w-4" /></button><button disabled={record.currentBalanceUGX === 0} onClick={() => { setWithdrawRecord(record); setWithdrawal({ amountUGX: '', notes: '' }); setError(''); }} className="rounded-lg bg-amber-500/15 p-2 text-amber-400 disabled:opacity-30" aria-label="Record withdrawal"><ArrowUpFromLine className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div></section>
    </main></div>

    {depositOpen && <Modal title="Record Customer Deposit" close={() => setDepositOpen(false)} error={error}><Input label="Customer / Person Name" value={deposit.customerName} set={(v) => setDeposit({ ...deposit, customerName: v })} /><Input label="Phone Number" value={deposit.phone} set={(v) => setDeposit({ ...deposit, phone: v })} /><Input label="Amount Deposited (UGX)" value={deposit.amountUGX} set={(v) => setDeposit({ ...deposit, amountUGX: v })} type="number" /><Input label="Notes (Optional)" value={deposit.notes} set={(v) => setDeposit({ ...deposit, notes: v })} /><button disabled={!deposit.customerName || !deposit.phone || !deposit.amountUGX || depositMutation.isPending} onClick={() => depositMutation.mutate()} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-40">{depositMutation.isPending ? 'Saving...' : 'Record Deposit'}</button></Modal>}
    {withdrawRecord && <Modal title={`Withdraw — ${withdrawRecord.customerName}`} close={() => setWithdrawRecord(null)} error={error}><div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs text-slate-500">Available customer balance</p><p className="text-xl font-bold text-white">{money(withdrawRecord.currentBalanceUGX)}</p></div><Input label="Amount Withdrawn (UGX)" value={withdrawal.amountUGX} set={(v) => setWithdrawal({ ...withdrawal, amountUGX: v })} type="number" /><Input label="Notes (Optional)" value={withdrawal.notes} set={(v) => setWithdrawal({ ...withdrawal, notes: v })} /><button disabled={!withdrawal.amountUGX || withdrawalMutation.isPending} onClick={() => withdrawalMutation.mutate()} className="w-full rounded-xl bg-amber-600 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{withdrawalMutation.isPending ? 'Saving...' : 'Record Withdrawal'}</button></Modal>}
    {profile && <Modal title={`${profile.customerName} — Deposit Ledger`} close={() => setProfile(null)}><div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-slate-950 p-3"><p className="text-slate-500">Deposited</p><p className="mt-1 font-bold text-emerald-400">{money(profile.totalDepositedUGX)}</p></div><div className="rounded-lg bg-slate-950 p-3"><p className="text-slate-500">Withdrawn</p><p className="mt-1 font-bold text-amber-400">{money(profile.totalWithdrawnUGX)}</p></div><div className="rounded-lg bg-slate-950 p-3"><p className="text-slate-500">Balance</p><p className="mt-1 font-bold text-white">{money(profile.currentBalanceUGX)}</p></div></div><div className="max-h-80 space-y-3 overflow-y-auto">{profile.ledger.map((movement) => <div key={movement._id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex justify-between gap-4"><p className={`font-bold ${movement.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-amber-400'}`}>{movement.type} · {money(movement.amountUGX)}</p><p className="text-xs text-slate-500">{new Date(movement.occurredAt).toLocaleString()}</p></div><p className="mt-1 text-xs text-slate-400">Balance after: {money(movement.balanceAfterTransactionUGX)}</p>{movement.notes && <p className="mt-1 text-xs text-slate-500">{movement.notes}</p>}</div>)}</div></Modal>}
  </div>;
}

function Input({ label, value, set, type = 'text' }: { label: string; value: string; set: (value: string) => void; type?: string }) { return <label className="block text-xs font-bold uppercase text-slate-400">{label}<input type={type} min={type === 'number' ? 1 : undefined} step={type === 'number' ? 1 : undefined} value={value} onChange={(e) => set(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm normal-case text-white outline-none focus:border-emerald-500" /></label>; }
function Modal({ title, close, error, children }: { title: string; close: () => void; error?: string; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"><div className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-bold text-white">{title}</h2><button onClick={close} className="p-2 text-slate-500 hover:text-white"><X className="h-5 w-5" /></button></div>{error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}{children}</div></div>; }
