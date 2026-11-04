'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Account = { id: string; name: string; currency: 'USD' | 'UGX'; balance: number };
type Quote = { category: string; exchangeRateId: string; rate: number; feeUSD: number; payoutUGX: number };

export default function LedgerExchangeForm({ shift }: { shift: { _id: string; accountBalances?: Account[] } }) {
  const queryClient = useQueryClient();
  const [accountId, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [quote, setQuote] = useState<Quote>();
  const [requestKey, setKey] = useState('');
  const [completed, setCompleted] = useState(false);
  const preview = useMutation({
    mutationFn: async () => (await api.post('/account-operations/quote', { shiftId: shift._id, accountId, amount: Number(amount) })).data.data as Quote,
    onSuccess: (result) => { setQuote(result); setKey(crypto.randomUUID()); },
  });
  const post = useMutation({
    mutationFn: () => api.post('/account-operations', { shiftId: shift._id, accountId, amount: Number(amount), reference,
      requestKey, category: quote!.category, exchangeRateId: quote!.exchangeRateId, outgoingAccountId: 'CASH_UGX',
      customerName: customerName.trim() || undefined, phone: phone.trim() || undefined }),
    onSuccess: () => { setCompleted(true); void queryClient.invalidateQueries(); },
  });
  const error = (post.error || preview.error) as { response?: { data?: { message?: string } } } | null;
  const drawer = shift.accountBalances?.find(account => account.id === 'CASH_UGX');
  const field = 'w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900';
  const button = 'rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50';
  if (completed) return <section className="rounded-xl border bg-white p-6 text-slate-900">
    <h1 className="font-bold">Exchange recorded</h1><Link className="text-blue-700 underline" href="/transactions">View transaction history</Link>
  </section>;
  return <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-white p-6 text-slate-900">
    <h1 className="text-xl font-bold">USD to UGX exchange</h1>
    <p className="text-sm text-slate-600">Drawer: {drawer ? `UGX ${drawer.balance.toLocaleString()}` : 'Unavailable'}. Other exchange directions are not enabled.</p>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!quote) preview.mutate(); }}>
      <fieldset disabled={Boolean(quote) || preview.isPending} className="space-y-3">
        <label className="block">Receive into<select required value={accountId} onChange={e => setAccount(e.target.value)} className={field}>
          <option value="">Select USD account</option>
          {shift.accountBalances?.filter(a => a.currency === 'USD').map(a => <option key={a.id} value={a.id}>{a.name} · USD {a.balance.toLocaleString()}</option>)}
        </select></label>
        <label className="block">Amount received (USD)<input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={field} /></label>
        <label className="block">Payment reference<input required maxLength={100} value={reference} onChange={e => setReference(e.target.value)} className={field} /></label>
        <label className="block">Customer name (optional)<input required={Boolean(phone.trim())} maxLength={100} value={customerName} onChange={e => setCustomerName(e.target.value)} className={field} /></label>
        <label className="block">Customer phone (optional)<input required={Boolean(customerName.trim())} type="tel" minLength={3} maxLength={40} value={phone} onChange={e => setPhone(e.target.value)} className={field} /></label>
      </fieldset>
      {!quote && <button className={button} disabled={preview.isPending || !reference.trim()}>Review exchange</button>}
    </form>
    {quote && <div className="space-y-3 rounded-lg bg-blue-50 p-4">
      <p>Rate: UGX {quote.rate.toLocaleString()} per USD 1</p>
      <p>Service fee: USD {quote.feeUSD.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
      <p className="font-bold">Pay customer: UGX {quote.payoutUGX.toLocaleString()}</p>
      <p className="text-sm">Confirm only after you’ve verified the USD payment in the selected account.</p>
      <button type="button" className={button} disabled={post.isPending || !drawer || drawer.balance < quote.payoutUGX} onClick={() => post.mutate()}>
        {post.isPending ? 'Recording…' : post.isError ? 'Retry same exchange' : 'Confirm exchange'}
      </button>
      <button type="button" className="ml-3 text-blue-800 underline" disabled={post.isPending || (post.isError && !error?.response)} onClick={() => { setQuote(undefined); post.reset(); }}>Edit</button>
    </div>}
    {error && <p role="alert" className="text-red-800">{error.response?.data?.message || 'Could not confirm the result. Retry the same exchange if posting was interrupted.'}</p>}
  </section>;
}
