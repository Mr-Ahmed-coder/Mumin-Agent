'use client';

import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AuditLog } from '@/types';
import { ShieldAlert, Search } from 'lucide-react';
import { useState } from 'react';

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ data: AuditLog[] }>({
    queryKey: ['auditLogs', search],
    queryFn: async () => {
      const res = await api.get('/audit-logs', { params: { search } });
      return res.data;
    },
  });

  const logs = data?.data || [];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-6 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">System Audit Trail</h1>
              <p className="text-sm text-slate-400">
                Security log tracking all logins, exchanges, cancellations, and staff actions
              </p>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter audit logs..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold bg-slate-950/50">
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Resource</th>
                    <th className="py-3.5 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm font-mono text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Loading audit logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No audit logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 font-semibold text-slate-200">{log.userName || 'System'}</td>
                        <td className="py-3 px-4 text-slate-400">{log.userRole || '—'}</td>
                        <td className="py-3 px-4 font-bold text-emerald-400">{log.action}</td>
                        <td className="py-3 px-4 text-slate-300">{log.resource}</td>
                        <td className="py-3 px-4 text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
