'use client';

import { isAxiosError } from 'axios';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type WalletShift = {
  _id: string;
  ledgerVersion?: number;
  accountOpenings?: { id: string; name: string; kind: 'CASH' | 'WALLET'; currency: 'USD' | 'UGX' }[];
};

const category = 'WALLET_USD_TO_CASH_UGX';
type SaveRequest = {
  shiftId: string; accountId: string; outgoingAccountId: string; amount: number;
  category: typeof category; exchangeRateId: string; requestKey: string; reference: string;
};
const field = 'mt-1.5 block min-h-11 w-full rounded-lg border border-[#94a3b8] bg-[#ffffff] px-3 text-base text-[#162447] outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:bg-[#F4F7FC]';

export default function WalletExchangeForm({ shift, unavailable }: { shift?: WalletShift; unavailable?: string }) {
  const client = useQueryClient();
  const [digits, setDigits] = useState('');
  const [wallet, setWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<SaveRequest>();
  const busy = useRef(false);
  const accounts = shift?.accountOpenings ?? [];
  const wallets = accounts.filter(account => account.kind === 'WALLET' && account.currency === 'USD');
  const drawer = accounts.find(account => account.id === 'CASH_UGX' && account.kind === 'CASH' && account.currency === 'UGX');
  const blocker = unavailable || (!wallets.length ? 'No USD wallets are configured for this shift.'
    : !drawer ? 'No UGX cash drawer was opened for this shift.' : undefined);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || (!request.current && blocker) || !shift || !drawer) return;
    setNotice('');
    const value = Number(amount);
    if (!request.current) {
      if (!/^[0-9]{4}$/.test(digits)) { setError('Enter exactly four digits.'); return; }
      if (!wallets.some(account => account.id === wallet)) { setError('Select a USD wallet.'); return; }
      if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || value <= 0 || !Number.isSafeInteger(Math.round(value * 100))) {
        setError('Enter a positive USD amount with up to two decimal places.');
        return;
      }
    }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      if (!request.current) {
        const { data } = await api.post('/account-operations/quote', { shiftId: shift._id, accountId: wallet, amount: value });
        if (data.data?.category !== category || typeof data.data.exchangeRateId !== 'string') {
          setError('Could not verify the wallet exchange and its current rate.');
          return;
        }
        const requestKey = crypto.randomUUID();
        request.current = {
          shiftId: shift._id, accountId: wallet, outgoingAccountId: drawer.id, amount: value, category,
          exchangeRateId: data.data.exchangeRateId, requestKey, reference: `WALLET-${requestKey}-LAST4-${digits}`,
        };
      }
      const { data } = await api.post('/account-operations', request.current);
      const payout = data.data?.legs?.find((leg: { accountId: string; currency: string; direction: string }) =>
        leg.accountId === drawer.id && leg.currency === 'UGX' && leg.direction === 'OUT')?.amountMinor;
      request.current = undefined;
      setRetry(false);
      setDigits('');
      setAmount('');
      setNotice(typeof payout === 'number' ? `Saved. Cash payout: UGX ${payout.toLocaleString()}.` : 'Transaction saved.');
      void client.invalidateQueries();
    } catch (failure) {
      const response = isAxiosError(failure) ? failure.response : undefined;
      // If posting may have succeeded, preserve the exact request and rate on retry.
      const uncertain = Boolean(request.current && ![400, 401, 403, 404, 422, 429].includes(response?.status ?? 0));
      setRetry(uncertain);
      if (!uncertain) request.current = undefined;
      const message = response?.data?.message;
      setError(uncertain ? 'Save could not be confirmed. Retry here without entering the transaction again.'
        : typeof message === 'string' ? message : 'Could not save the transaction. Try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="new-wallet-exchange" className="rounded-2xl border border-blue-100 bg-[#ffffff] p-4 text-[#162447] shadow-sm sm:p-5">
      <h1 id="new-wallet-exchange" className="text-xl font-bold">New Transaction</h1>
      <p className="mt-1 text-sm text-[#6B7A99]">USD wallet to UGX cash. Verify the wallet payment before saving.</p>
      <form className="mt-4 space-y-3" onSubmit={save} noValidate aria-busy={saving}>
        <fieldset className="space-y-3" disabled={saving || retry || Boolean(blocker)}>
          <label className="block text-sm font-semibold">Last 4 Digits of Customer Number
            <input className={field} type="text" inputMode="numeric" autoComplete="off" maxLength={4}
              pattern="[0-9]{4}" required value={digits} onChange={event => setDigits(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold">Wallet Type
            <select className={field} required value={wallet} onChange={event => setWallet(event.target.value)}>
              <option value="">Select a wallet</option>
              {wallets.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Amount (USD)
            <input className={field} type="number" inputMode="decimal" min="0.01" step="0.01" required
              value={amount} onChange={event => setAmount(event.target.value)} />
          </label>
        </fieldset>
        {blocker && !retry && <p className="text-sm text-[#6B7A99]" role="status">{blocker}</p>}
        {error && <p className="break-words text-sm text-red-800" role="alert">{error}</p>}
        {notice && <p className="text-sm font-semibold text-emerald-800" role="status">{notice}</p>}
        <button type="submit" disabled={saving || (Boolean(blocker) && !retry)}
          className="min-h-11 w-full rounded-lg bg-[#2F63F5] px-4 py-2.5 font-semibold text-[#ffffff] hover:bg-[#2452D6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-[#64748b]">
          {saving ? 'Saving…' : retry ? 'Retry Save Transaction' : 'Save Transaction'}
        </button>
      </form>
    </section>
  );
}
