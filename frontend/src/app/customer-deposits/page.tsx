'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/lib/api';
import { CustomerDeposit } from '@/types';

type DepositArchive = { records: CustomerDeposit[]; summary: { held: number } };
const money = (value: number) => `UGX ${value.toLocaleString()}`;
const panel = 'rounded-xl border border-blue-100 bg-white p-4 text-[#17254b]';

export default function DepositArchivePage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(true);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['depositArchive', user?._id],
    queryFn: async () => (await api.get('/customer-deposits/archive')).data.data as DepositArchive,
    enabled: isAdmin && !isAuthLoading,
  });

  const needle = search.trim().toLowerCase();
  const records = data?.records.filter(record =>
    (!outstandingOnly || record.currentBalanceUGX > 0) &&
    (!needle || record.customerName.toLowerCase().includes(needle) || record.phone.includes(needle))
  );

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Navbar />
        <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8">
          <header className={panel}>
            <h1 className="text-2xl font-bold">Deposit Archive</h1>
            <p className="mt-1 text-sm text-[#475569]">Read-only records of UGX held for customers. These balances are liabilities, not business income.</p>
          </header>
          {isAuthLoading ? <p className={panel} role="status">Checking access…</p>
            : !isAdmin ? <p className={panel}>Administrator access only. <Link href="/dashboard" className="text-blue-700 underline">Back to dashboard</Link></p>
            : isLoading ? <p className={panel} role="status">Loading deposit records…</p>
            : isError || !data ? <div className={panel} role="alert">
              Deposit records could not be loaded. <button type="button" onClick={() => void refetch()} className="font-semibold text-blue-700 underline">Retry</button>
            </div>
            : <>
              <div className={panel}>
                <p className="text-sm text-[#475569]">Total still held for customers</p>
                <p className="text-xl font-bold tabular-nums">{money(data.summary.held)}</p>
              </div>
              <div className={`${panel} flex flex-wrap items-end gap-4`}>
                <label className="min-w-0 flex-1 text-sm font-semibold">Find a record
                  <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or phone" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal focus-visible:outline focus-visible:outline-blue-700" />
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={outstandingOnly} onChange={event => setOutstandingOnly(event.target.checked)} />
                  Outstanding balances only
                </label>
              </div>
              {!records?.length && <p className={panel}>{outstandingOnly ? 'No matching outstanding balances.' : 'No matching deposit records.'}</p>}
              {records?.map(record => (
                <details key={record._id} className={panel}>
                  <summary className="min-h-11 cursor-pointer break-words py-2 font-semibold focus-visible:outline focus-visible:outline-blue-700">
                    {record.customerName} · {money(record.currentBalanceUGX)}
                  </summary>
                  <div className="mt-2 space-y-3 border-t border-blue-100 pt-3 text-sm">
                    <p className="break-words text-[#475569]">{record.phone} · Created by {typeof record.createdBy === 'object' && record.createdBy?.name ? record.createdBy.name : 'Not recorded'}</p>
                    <p>Deposited: <strong>{money(record.totalDepositedUGX)}</strong> · Withdrawn: <strong>{money(record.totalWithdrawnUGX)}</strong></p>
                    {record.notes && <p className="break-words text-[#475569]">{record.notes}</p>}
                    <h2 className="font-semibold">Movement history</h2>
                    {record.ledger.length === 0 && <p className="text-[#475569]">No recorded movements.</p>}
                    <ol className="space-y-2">
                      {record.ledger.map(movement => (
                        <li key={movement._id} className="space-y-1 rounded-lg bg-blue-50 p-3">
                          <p className="font-semibold">{movement.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} · {money(movement.amountUGX)}</p>
                          <p className="text-[#475569]">{new Date(movement.occurredAt).toLocaleString()} · Recorded by {typeof movement.recordedBy === 'object' && movement.recordedBy?.name ? movement.recordedBy.name : 'Not recorded'}</p>
                          <p>Balance after: {money(movement.balanceAfterTransactionUGX)}</p>
                          {movement.notes && <p className="break-words text-[#475569]">{movement.notes}</p>}
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
              ))}
            </>}
        </main>
      </div>
    </div>
  );
}
