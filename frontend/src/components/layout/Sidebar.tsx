'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Calculator,
  Wallet,
  FileBarChart,
  ShieldAlert,
  UserCog,
  LogOut,
  Building2,
  PlusCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isCashier = user?.role === 'CASHIER';

  const cashierNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'New Transaction', href: '/transactions/new', icon: PlusCircle },
    { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Cash Session', href: '/cash-sessions', icon: Wallet },
  ];

  const adminNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Cash Sessions', href: '/cash-sessions', icon: Wallet },
    { name: 'Exchange Rate', href: '/exchange-rate', icon: Calculator },
    { name: 'Fee Rules', href: '/fee-rules', icon: Calculator },
    { name: 'User Staff', href: '/users', icon: UserCog },
    { name: 'Reports', href: '/reports', icon: FileBarChart },
    { name: 'Audit Logs', href: '/audit-logs', icon: ShieldAlert },
  ];

  const activeNav = isCashier ? cashierNav : adminNav;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 min-h-screen flex flex-col justify-between select-none shrink-0">
      <div>
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-wide">MUMIN AGENT</h1>
            <p className="text-xs text-slate-400 font-medium">Cash Exchange System</p>
          </div>
        </div>

        {/* Role Badge Header */}
        <div className="px-6 pt-4 pb-2">
          <span className="inline-block px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {isCashier ? 'Cashier Menu' : 'Admin / Manager Menu'}
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1">
          {activeNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                )}
              >
                <Icon className={clsx('w-5 h-5', isActive ? 'text-emerald-400' : 'text-slate-400')} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="p-3 bg-slate-800/40 rounded-xl flex items-center justify-between border border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30 shrink-0">
              {user?.name.charAt(0)}
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-700 text-slate-300">
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
