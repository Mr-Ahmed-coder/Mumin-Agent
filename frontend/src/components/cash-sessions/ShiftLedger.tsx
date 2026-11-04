'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Currency = 'USD' | 'UGX';
type Operation = { _id: string; category: string; occurredAt: string; reversesOperationId?: string;
  legs: { accountId: string; currency: Currency; direction: 'IN' | 'OUT'; amountMinor: number }[] };
type Ledger = { operations: Operation[]; accounts: { id: string; name: string; currency: Currency; balance: number }[] };

export default function ShiftLedger({ shiftId, canCorrect }: { shiftId: string; canCorrect: boolean }) {
  const client = useQueryClient();
  const [correction, setCorrection] = useState<{ id: string; requestKey: string }>();
  const [reason, setReason] = useState('');
  const { data, isError } = useQuery({ queryKey: ['shiftLedger', shiftId],
    queryFn: async () => (await api.get(`/account-operations/shift/${shiftId}`)).data.data as Ledger });
  const reversal = useMutation({
    mutationFn: () => api.post('/account-operations/reverse', { operationId: correction!.id, requestKey: correction!.requestKey, reason }),
    onSuccess: () => { setCorrection(undefined); setReason(''); void client.invalidateQueries(); },
  });
  if (!data) return <p role="status">{isError ? 'Account movements are unavailable.' : 'Loading account movements…'}</p>;
  const reversed = new Set(data.operations.map(operation => operation.reversesOperationId));
  return <section className="space-y-4 rounded-xl border bg-white p-5 text-slate-900">
    <h2 className="font-bold">Account balances and movements</h2>
    <p className="text-sm text-slate-600">Recorded balances only. Closing reconciliation is not enabled for this shift.</p>
    <ul className="grid gap-2 sm:grid-cols-2">{data.accounts.map(account => <li key={account.id} className="rounded-lg bg-blue-50 p-3">
      {account.name}: <strong>{account.currency} {account.balance.toLocaleString()}</strong>
    </li>)}</ul>
    {data.operations.length === 0 && <p>No movements recorded yet.</p>}
    <ul className="divide-y">{[...data.operations].reverse().map(operation => <li key={operation._id} className="space-y-2 py-3">
      <p className="font-semibold">{operation.category.replaceAll('_', ' ')} · <time>{new Date(operation.occurredAt).toLocaleString()}</time></p>
      {operation.legs.map((leg, index) => <p key={index} className="text-sm">
        {data.accounts.find(account => account.id === leg.accountId)?.name ?? leg.accountId}: {leg.direction === 'IN' ? '+' : '−'} {leg.currency} {(leg.amountMinor / (leg.currency === 'USD' ? 100 : 1)).toLocaleString()}
      </p>)}
      {reversed.has(operation._id) && <p className="text-sm">Reversed</p>}
      {canCorrect && !correction && !operation.reversesOperationId && !reversed.has(operation._id) && <button type="button" className="text-sm text-red-800 underline" onClick={() => {
        reversal.reset(); setCorrection({ id: operation._id, requestKey: crypto.randomUUID() });
      }}>Review reversal</button>}
      {correction?.id === operation._id && <form className="space-y-2" onSubmit={event => { event.preventDefault(); reversal.mutate(); }}>
        <label className="block">Reversal reason<input required minLength={3} maxLength={500} className="block w-full rounded border p-2"
          value={reason} disabled={reversal.isPending || reversal.isError} onChange={event => setReason(event.target.value)} /></label>
        <button className="rounded bg-red-800 px-3 py-2 text-white disabled:opacity-50" disabled={reversal.isPending || reason.trim().length < 3}>
          {reversal.isPending ? 'Recording…' : reversal.isError ? 'Retry reversal' : 'Confirm reversal'}
        </button>
        <button type="button" className="ml-3 underline" disabled={reversal.isPending} onClick={() => { setCorrection(undefined); setReason(''); }}>Cancel</button>
        {reversal.isError && <p role="alert" className="text-red-800">{(reversal.error as any)?.response?.data?.message || 'Result unknown. Retry the same reversal or reload the shift to check.'}</p>}
      </form>}
    </li>)}</ul>
  </section>;
}
