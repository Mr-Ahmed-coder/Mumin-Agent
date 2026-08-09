'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CashSession } from '@/types';
import { Wallet, AlertTriangle, Plus, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function Navbar() {
  const { data: sessionData, refetch } = useQuery<{ data: CashSession | null }>({
    queryKey: ['activeCashSession'],
    queryFn: async () => {
      const res = await api.get('/cash-sessions/current');
      return res.data;
    },
  });

  const activeSession = sessionData?.data;

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Header Info */}
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-semibold text-slate-300">Agent Cash Exchange Workspace</h2>
      </div>

      {/* Cash Drawer Status Banner */}
      <div className="flex items-center gap-4">
        {activeSession ? (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="text-xs">
              <span className="text-slate-400">Available Cash (UGX): </span>
              <span className="font-bold text-emerald-400">
                UGX {(activeSession.currentCashBalance ?? activeSession.openingCash).toLocaleString()}
              </span>
            </div>
            <Link
              href="/cash-sessions"
              className="ml-2 text-xs font-semibold text-emerald-400 hover:underline"
            >
              Manage
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
            <span className="text-xs text-amber-300 font-medium">No Active Cash Shift</span>
            <Link
              href="/cash-sessions"
              className="ml-1 text-xs font-bold bg-amber-500 text-slate-950 px-2.5 py-1 rounded-lg hover:bg-amber-400 transition-colors"
            >
              Open Shift
            </Link>
          </div>
        )}

        {/* Quick Action Button */}
        <Link
          href="/transactions/new"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Exchange
        </Link>
      </div>
    </header>
  );
}
