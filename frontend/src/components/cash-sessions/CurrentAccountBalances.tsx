import Link from 'next/link';

export type RecordedBalance = { id: string; name: string; currency: 'UGX' | 'USD'; balance: number };

export default function CurrentAccountBalances({ balances, shiftId, loading, error }: {
  balances?: RecordedBalance[];
  shiftId?: string;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <section aria-labelledby="account-balances-heading" className="min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="account-balances-heading" className="font-bold text-[#17254b]">Current account balances</h2>
        {shiftId && <Link href={`/cash-sessions/${shiftId}`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline focus-visible:outline-blue-700">Shift details</Link>}
      </div>
      {loading ? <p role="status" className="mt-2 text-sm text-[#475569]">Loading account balances…</p>
        : error ? <p role="status" className="mt-2 text-sm text-[#475569]">Could not load current account balances.</p>
        : !balances?.length ? <p className="mt-2 text-sm text-[#475569]">Current balances by account are not available for this shift. Opening amounts are listed in shift details.</p>
        : <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(['UGX', 'USD'] as const).map(currency => {
            const accounts = balances.filter(account => account.currency === currency);
            if (!accounts.length) return null;
            return <div key={currency} className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
              <h3 className="mb-1 text-xs font-bold tracking-wide text-[#475569]">{currency} accounts</h3>
              <dl className="divide-y divide-blue-100">
                {accounts.map(account => <div key={account.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <dt className="min-w-0 break-words text-sm text-[#17254b]">{account.name}</dt>
                  <dd className="break-all text-sm font-bold tabular-nums text-[#17254b]">{currency} {Number.isFinite(account.balance) ? account.balance.toLocaleString(undefined, { maximumFractionDigits: currency === 'USD' ? 2 : 0 }) : 'Unavailable'}</dd>
                </div>)}
              </dl>
            </div>;
          })}
        </div>}
    </section>
  );
}
