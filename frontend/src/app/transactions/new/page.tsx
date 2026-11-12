'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import WalletExchangeForm, { WalletShift } from '@/components/cash-sessions/WalletExchangeForm';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/lib/api';

export default function NewTransactionPage() {
  const { user, isLoading } = useAuth();
  const shift = useQuery({
    queryKey: ['activeCashSession', user?._id, 'quick-wallet-exchange'],
    queryFn: async () => (await api.get('/cash-sessions/current')).data.data as WalletShift | null,
    enabled: Boolean(user),
  });
  const activeShift = shift.isError ? undefined : shift.data;
  const unavailable = isLoading || (user && shift.isLoading) ? 'Checking your shift…'
    : !user ? 'Sign in to record an exchange.'
    : shift.isError ? 'Could not check your shift. Reload this page to try again.'
    : !activeShift ? 'Open a shift before recording an exchange.'
    : activeShift.ledgerVersion !== 1 ? 'This shift requires a verified customer record. Four digits are not enough to save.'
    : undefined;

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Navbar />
        <main className="mx-auto w-full max-w-lg p-4 sm:p-6">
          <WalletExchangeForm key={activeShift?._id ?? 'no-shift'} shift={activeShift ?? undefined} unavailable={unavailable} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {!isLoading && user && !shift.isLoading && !shift.isError && !activeShift && <Link href="/cash-sessions" className="font-semibold text-blue-700 underline">Open shift</Link>}
            {activeShift && <Link href="/transactions/new/full" className="font-semibold text-blue-700 underline">
              {activeShift.ledgerVersion === 1 ? 'USD cash or full payment reference' : 'Use full transaction form'}
            </Link>}
          </div>
        </main>
      </div>
    </div>
  );
}
