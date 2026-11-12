'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';

type Account = { accountId: string; accountName: string; currency: 'USD' | 'UGX'; expectedClosingBalance: number };
type Preview = { revision: string; accounts: Account[] };
const message = (error: unknown, fallback: string) => isAxiosError(error) && typeof error.response?.data?.message === 'string' ? error.response.data.message : fallback;
const money = (currency: Account['currency'], amount: number) =>
  `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: currency === 'USD' ? 2 : 0 })}`;
const toMinor = (text: string, currency: Account['currency']) => {
  if (!(currency === 'USD' ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/).test(text)) return undefined;
  const value = Math.round(Number(text) * (currency === 'USD' ? 100 : 1));
  return Number.isSafeInteger(value) ? value : undefined;
};

function ClosingForm({ preview, shiftId, reload }: { preview: Preview; shiftId: string; reload: () => void }) {
  const client = useQueryClient();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState('');
  const close = useMutation({
    mutationFn: (actualBalances: { accountId: string; amount: number }[]) =>
      api.post(`/cash-sessions/${shiftId}/ledger-close`, { revision: preview.revision, actualBalances }),
    onSuccess: () => {
      router.replace(`/cash-sessions/${shiftId}`);
      void client.invalidateQueries();
    },
  });
  const stale = isAxiosError(close.error) && close.error.response?.status === 409;
  const pending = close.isPending || close.isSuccess;
  return (
    <form className="space-y-4" noValidate onSubmit={event => {
      event.preventDefault();
      if (pending || stale) return;
      const actualBalances: { accountId: string; amount: number }[] = [];
      for (const account of preview.accounts) {
        const amount = toMinor(counts[account.accountId] ?? '', account.currency);
        if (amount === undefined) { setProblem(`Enter a valid ${account.currency} count for ${account.accountName}.`); return; }
        actualBalances.push({ accountId: account.accountId, amount: amount / (account.currency === 'USD' ? 100 : 1) });
      }
      setProblem('');
      close.mutate(actualBalances);
    }}>
      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={pending || stale}>
        {preview.accounts.map(account => {
          const scale = account.currency === 'USD' ? 100 : 1;
          const actual = toMinor(counts[account.accountId] ?? '', account.currency);
          const difference = actual === undefined ? undefined : (actual - Math.round(account.expectedClosingBalance * scale)) / scale;
          return (
            <section key={account.accountId} className="min-w-0 space-y-3 rounded-xl border border-blue-100 bg-white p-4 text-[#162447]">
              <h2 className="break-words font-bold">{account.accountName} ({account.currency})</h2>
              <p className="text-sm text-[#6B7A99]">Expected <strong className="text-[#162447]">{money(account.currency, account.expectedClosingBalance)}</strong></p>
              <label className="block text-sm font-medium">Actual ({account.currency})
                <input type="text" inputMode={account.currency === 'USD' ? 'decimal' : 'numeric'} required
                  aria-label={`Actual balance for ${account.accountName} in ${account.currency}`}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-[#162447] focus-visible:outline focus-visible:outline-blue-700"
                  value={counts[account.accountId] ?? ''} onChange={event => setCounts(current => ({ ...current, [account.accountId]: event.target.value }))} />
              </label>
              <p aria-live="polite" className={`text-sm font-semibold ${difference === undefined ? 'text-[#6B7A99]' : difference === 0 ? 'text-emerald-800' : difference < 0 ? 'text-red-800' : 'text-amber-900'}`}>
                {difference === undefined ? 'Difference: —'
                  : `${difference === 0 ? 'BALANCED' : difference < 0 ? 'SHORTAGE' : 'OVERAGE'} · ${money(account.currency, difference)}`}
              </p>
            </section>
          );
        })}
      </fieldset>
      {problem && <p role="alert" className="text-sm text-red-800">{problem}</p>}
      {close.isError && <p role="alert" className="text-sm text-red-800">{message(close.error, 'Could not confirm closing. Check the shift details before retrying.')}</p>}
      {stale && <button type="button" onClick={reload} className="block text-sm font-semibold text-blue-700 underline">Reload closing balances</button>}
      <button type="submit" disabled={pending || stale} className="min-h-11 w-full rounded-lg bg-blue-700 px-5 py-2 font-semibold text-[#ffffff] focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 sm:w-auto">
        {pending ? 'Closing shift…' : 'Confirm Close Shift'}
      </button>
    </form>
  );
}

export default function CloseShiftPage() {
  const { user, isLoading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [reload, setReload] = useState(0);
  const preview = useQuery({
    queryKey: ['ledgerClosePreview', user?._id, id, reload],
    queryFn: async () => (await api.get(`/cash-sessions/${id}/ledger-close`)).data.data as Preview,
    enabled: Boolean(user && id),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Navbar />
        <main className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
          <header className="rounded-xl border border-blue-100 bg-white p-4 text-[#162447]">
            <Link href="/cash-sessions" className="text-sm font-semibold text-blue-700 underline">Back to shifts</Link>
            <h1 className="mt-2 text-2xl font-bold">Close Shift</h1>
            <p className="text-sm text-[#6B7A99]">Enter the actual amount in each account. Differences are recorded when you close.</p>
          </header>
          {isLoading || preview.isLoading ? <p role="status" className="rounded-lg bg-white p-4 text-[#6B7A99]">Checking closing balances…</p>
            : preview.isError || !preview.data ? <p role="alert" className="rounded-lg bg-white p-4 text-red-800">{message(preview.error, 'Verified closing balances are unavailable.')}</p>
            : <ClosingForm key={`${preview.data.revision}:${reload}`} preview={preview.data} shiftId={id} reload={() => setReload(current => current + 1)} />}
        </main>
      </div>
    </div>
  );
}
