'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Wifi, Plus, X, History } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { api } from '@/lib/api';
import { InternetCredit } from '@/types';

const money = (value: number) => `UGX ${value.toLocaleString()}`;

export default function InternetCreditPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentRecord, setPaymentRecord] = useState<InternetCredit | null>(null);
  const [historyRecord, setHistoryRecord] = useState<InternetCredit | null>(null);
  const [form, setForm] = useState({ customerName: '', phone: '', amountUGX: '', description: '', dateGiven: new Date().toISOString().slice(0, 10) });
  const [payment, setPayment] = useState({ amountUGX: '', notes: '' });
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['internetCredits', search, status],
    queryFn: async () => (await api.get('/internet-credits', { params: { search: search || undefined, status: status || undefined } })).data.data,
  });
  const records: InternetCredit[] = data?.records || [];
  const summary = data?.summary || { original: 0, paid: 0, outstanding: 0 };

  const createMutation = useMutation({
    mutationFn: () => api.post('/internet-credits', { ...form, amountUGX: Number(form.amountUGX), phone: form.phone || undefined, dateGiven: new Date(`${form.dateGiven}T00:00:00.000Z`).toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['internetCredits'] }); setCreateOpen(false); setForm({ customerName: '', phone: '', amountUGX: '', description: '', dateGiven: new Date().toISOString().slice(0, 10) }); setError(''); },
    onError: (err: any) => setError(err.response?.data?.message || 'Unable to create internet credit'),
  });

  const paymentMutation = useMutation({
    mutationFn: () => api.post(`/internet-credits/${paymentRecord?._id}/payments`, { amountUGX: Number(payment.amountUGX), notes: payment.notes || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['internetCredits'] }); setPaymentRecord(null); setPayment({ amountUGX: '', notes: '' }); setError(''); },
    onError: (err: any) => setError(err.response?.data?.message || 'Unable to record payment'),
  });

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="min-w-0 flex-1"><Navbar />
        <main className="space-y-6 p-4 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Wifi className="text-emerald-400" /> Internet Credit</h1><p className="mt-1 text-sm text-slate-400">Track UGX internet service credit and every repayment.</p></div>
            <button onClick={() => { setCreateOpen(true); setError(''); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"><Plus className="h-4 w-4" /> New Internet Credit</button>
          </div>

          <section className="grid gap-4 sm:grid-cols-3">
            {[['Original Credit', summary.original], ['Amount Paid', summary.paid], ['Outstanding', summary.outstanding]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold text-white">{money(Number(value))}</p></div>)}
          </section>

          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer or phone" className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-emerald-500" /></div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm text-white"><option value="">All statuses</option><option value="UNPAID">Unpaid</option><option value="PARTIALLY_PAID">Partially Paid</option><option value="PAID">Paid</option></select>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-950/60 text-xs uppercase text-slate-500"><tr><th className="p-4">Customer</th><th className="p-4">Original</th><th className="p-4">Paid</th><th className="p-4">Remaining</th><th className="p-4">Status</th><th className="p-4">Date Given</th><th className="p-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">{isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading...</td></tr> : records.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">No internet credit records.</td></tr> : records.map((record) => <tr key={record._id} className="text-slate-300"><td className="p-4"><p className="font-bold text-white">{record.customerName}</p><p className="text-xs text-slate-500">{record.phone || 'No phone'} · {record.description || 'No notes'}</p></td><td className="p-4 font-mono">{money(record.originalAmountUGX)}</td><td className="p-4 font-mono text-emerald-400">{money(record.amountPaidUGX)}</td><td className="p-4 font-mono font-bold text-amber-400">{money(record.remainingBalanceUGX)}</td><td className="p-4"><span className="rounded-full border border-slate-700 px-2 py-1 text-xs">{record.status.replace('_', ' ')}</span></td><td className="p-4 text-xs">{new Date(record.dateGiven).toLocaleDateString()}</td><td className="p-4"><div className="flex gap-2"><button onClick={() => setHistoryRecord(record)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="View repayment history"><History className="h-4 w-4" /></button><button disabled={record.status === 'PAID'} onClick={() => { setPaymentRecord(record); setPayment({ amountUGX: '', notes: '' }); setError(''); }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Record Payment</button></div></td></tr>)}</tbody></table></div>
          </section>
        </main>
      </div>

      {createOpen && <Modal title="New Internet Credit" close={() => setCreateOpen(false)} error={error}><Input label="Customer / Person Name" value={form.customerName} set={(v) => setForm({ ...form, customerName: v })} /><Input label="Phone Number (Optional)" value={form.phone} set={(v) => setForm({ ...form, phone: v })} /><Input label="Amount (UGX)" value={form.amountUGX} set={(v) => setForm({ ...form, amountUGX: v })} type="number" /><Input label="Date Given" value={form.dateGiven} set={(v) => setForm({ ...form, dateGiven: v })} type="date" /><Input label="Description / Package Notes" value={form.description} set={(v) => setForm({ ...form, description: v })} /><button disabled={!form.customerName || !form.amountUGX || !form.dateGiven || createMutation.isPending} onClick={() => createMutation.mutate()} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-40">{createMutation.isPending ? 'Saving...' : 'Create Credit'}</button></Modal>}
      {paymentRecord && <Modal title={`Payment — ${paymentRecord.customerName}`} close={() => setPaymentRecord(null)} error={error}><div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm"><p className="text-slate-500">Remaining balance</p><p className="text-xl font-bold text-amber-400">{money(paymentRecord.remainingBalanceUGX)}</p></div><Input label="Payment Amount (UGX)" value={payment.amountUGX} set={(v) => setPayment({ ...payment, amountUGX: v })} type="number" /><Input label="Payment Notes (Optional)" value={payment.notes} set={(v) => setPayment({ ...payment, notes: v })} /><button disabled={!payment.amountUGX || paymentMutation.isPending} onClick={() => paymentMutation.mutate()} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-40">{paymentMutation.isPending ? 'Saving...' : 'Record Payment'}</button></Modal>}
      {historyRecord && <Modal title={`Repayment History — ${historyRecord.customerName}`} close={() => setHistoryRecord(null)}><div className="max-h-80 space-y-3 overflow-y-auto">{historyRecord.payments.length === 0 ? <p className="text-sm text-slate-500">No repayments recorded.</p> : historyRecord.payments.map((item) => <div key={item._id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex justify-between"><p className="font-bold text-emerald-400">{money(item.amountUGX)}</p><p className="text-xs text-slate-500">{new Date(item.paidAt).toLocaleString()}</p></div><p className="mt-1 text-xs text-slate-400">Balance after: {money(item.balanceAfterPaymentUGX)}</p>{item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}</div>)}</div></Modal>}
    </div>
  );
}

function Input({ label, value, set, type = 'text' }: { label: string; value: string; set: (value: string) => void; type?: string }) { return <label className="block text-xs font-bold uppercase text-slate-400">{label}<input type={type} min={type === 'number' ? 1 : undefined} step={type === 'number' ? 1 : undefined} value={value} onChange={(e) => set(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm normal-case text-white outline-none focus:border-emerald-500" /></label>; }
function Modal({ title, close, error, children }: { title: string; close: () => void; error?: string; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"><div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-bold text-white">{title}</h2><button onClick={close} className="p-2 text-slate-500 hover:text-white"><X className="h-5 w-5" /></button></div>{error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}{children}</div></div>; }
