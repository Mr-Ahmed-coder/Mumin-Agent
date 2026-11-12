import {
  AccountReconciliation,
  AccountReconciliationPreview,
  WALLET_LABELS,
  WalletProvider,
} from '@/types';
import { reconciliationAccountId } from '@/lib/reconciliation';
import { AlertTriangle, CheckCircle, Landmark, Smartphone, Wallet } from 'lucide-react';

interface ReconciliationAccountsProps {
  accounts: (AccountReconciliation | AccountReconciliationPreview)[];
  actualValues?: Record<string, number | ''>;
  onActualChange?: (accountType: string, value: number | '') => void;
}

const accountLabels = {
  PHYSICAL_CASH: 'Physical Cash',
  EVC: 'EVC',
  MOBILE_MONEY: 'Mobile Money',
  LEDGER_CASH: 'Cash',
  LEDGER_WALLET: 'Wallet',
};

const movementLabels = {
  CASH_ADDED: 'Cash added',
  CASH_WITHDRAWN: 'Cash withdrawn',
  CASH_PAID_OUT: 'Customer cash payouts',
  WALLET_RECEIVED: 'Customer wallet receipts',
  EXCHANGE: 'Exchanges',
  REVERSAL: 'Reversals',
  ADJUSTMENT: 'Authorized adjustments',
  EXPENSE: 'Expenses',
  CUSTOMER_DEPOSIT: 'Customer deposits',
  CUSTOMER_WITHDRAWAL: 'Customer withdrawals',
  CREDIT_REPAYMENT: 'Credit repayments',
};

const accountIcons = {
  PHYSICAL_CASH: Wallet,
  EVC: Smartphone,
  MOBILE_MONEY: Landmark,
  LEDGER_CASH: Wallet,
  LEDGER_WALLET: Smartphone,
};

const formatAmount = (currency: string, amount: number) =>
  `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: currency === 'UGX' ? 0 : 2 })}`;

const hasActualBalance = (
  account: AccountReconciliation | AccountReconciliationPreview
): account is AccountReconciliation => 'actualClosingBalance' in account;

export default function ReconciliationAccounts({
  accounts,
  actualValues,
  onActualChange,
}: ReconciliationAccountsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {accounts.map((account) => {
        const Icon = accountIcons[account.accountType];
        const accountId = reconciliationAccountId(account);
        const enteredActual = actualValues?.[accountId];
        const actual = hasActualBalance(account) ? account.actualClosingBalance : enteredActual;
        const difference = hasActualBalance(account) ? account.difference : typeof actual === 'number' ? actual - account.expectedClosingBalance : undefined;
        const status =
          hasActualBalance(account)
            ? account.status
            : difference === undefined
              ? undefined
              : difference === 0
                ? 'BALANCED'
                : difference < 0
                  ? 'SHORTAGE'
                  : 'OVERAGE';

        return (
          <section key={accountId} className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-800 p-2 text-brand-600"><Icon className="h-5 w-5" /></div>
                <div>
                  <h4 className="font-bold text-white">{account.accountName || accountLabels[account.accountType]} ({account.currency})</h4>
                  <p className="text-[11px] text-slate-500">
                    {account.provider === 'CASH_DRAWER' ? 'Cash Drawer' : WALLET_LABELS[account.provider as WalletProvider] || account.provider}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-300">{account.currency}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-slate-500">Opening Balance</p>
                <p className="mt-1 font-bold text-slate-200">{formatAmount(account.currency, account.openingBalance)}</p>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <p className="text-brand-600">Expected Closing</p>
                <p className="mt-1 font-bold text-emerald-300">{formatAmount(account.currency, account.expectedClosingBalance)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Confirmed movements</p>
              {account.confirmedMovements.map((item) => (
                <div key={`${item.movementType}:${item.direction}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">{movementLabels[item.movementType]} ({item.transactionCount})</span>
                  <span className={item.direction === 'IN' ? 'font-semibold text-brand-600' : 'font-semibold text-amber-400'}>
                    {item.direction === 'IN' ? '+' : '-'}{formatAmount(item.currency, item.amount)}
                  </span>
                </div>
              ))}
            </div>

            {onActualChange ? (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Actual Closing Balance ({account.currency}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step={account.currency === 'UGX' ? '1' : '0.01'}
                  value={enteredActual ?? ''}
                  onChange={(event) => onActualChange(accountId, event.target.value === '' ? '' : Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-bold text-white outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  aria-label={`Actual closing balance for ${accountLabels[account.accountType]} in ${account.currency}`}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs">
                <p className="text-slate-500">Actual Closing</p>
                <p className="mt-1 font-bold text-white">{formatAmount(account.currency, Number(actual ?? 0))}</p>
              </div>
            )}

            {status && difference !== undefined && (
              <div className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                status === 'BALANCED'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : status === 'SHORTAGE'
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}>
                <span className="flex items-center gap-1.5 font-bold">
                  {status === 'BALANCED' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {status}
                </span>
                <span className="font-bold">Difference: {difference > 0 ? '+' : ''}{formatAmount(account.currency, difference)}</span>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
