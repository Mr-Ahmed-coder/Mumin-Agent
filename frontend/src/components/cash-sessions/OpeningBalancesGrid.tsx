import { CashSession, OpeningBalance, User, WALLET_LABELS, WalletProvider } from '@/types';

interface OpeningBalancesGridProps {
  session: CashSession;
}

const accountDefinitions: Array<{
  accountType: OpeningBalance['accountType'];
  label: string;
  expectedCurrency: OpeningBalance['currency'];
}> = [
  {
    accountType: 'PHYSICAL_CASH',
    label: 'Physical Cash Opening Balance',
    expectedCurrency: 'UGX',
  },
  {
    accountType: 'EVC',
    label: 'EVC Opening Balance',
    expectedCurrency: 'USD',
  },
  {
    accountType: 'MOBILE_MONEY',
    label: 'Mobile Money Opening Balance',
    expectedCurrency: 'USD',
  },
];

const personName = (person: User | string | undefined): string =>
  typeof person === 'object' && person?.name ? person.name : 'Current cashier';

const providerName = (
  provider: OpeningBalance['provider'] | undefined,
  accountType: OpeningBalance['accountType']
): string => {
  if (provider === 'CASH_DRAWER' || accountType === 'PHYSICAL_CASH') return 'Cash Drawer';
  if (provider) return WALLET_LABELS[provider as WalletProvider] || provider;
  if (accountType === 'EVC') return WALLET_LABELS.HORMUUD_EVC_PLUS;
  return 'Not recorded';
};

export default function OpeningBalancesGrid({ session }: OpeningBalancesGridProps) {
  if (session.openingVersion === 2) return (
    <section className="space-y-4">
      <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Development shift: account movement capture is incomplete. Closing is blocked; these are recorded opening balances, not reconciled current balances.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{session.accountOpenings?.map(account => (
        <div key={account.id} className="rounded-xl border border-slate-800 bg-white p-4">
          <p className="text-sm font-bold text-[#17254b]">{account.name} ({account.currency})</p>
          <p className="mt-2 text-xl font-bold text-[#17254b]">{account.currency} {account.amount.toLocaleString()}</p>
          <p className="mt-2 text-xs text-[#475569]">Opening · {new Date(session.openedAt).toLocaleString()}</p>
        </div>
      ))}</div>
      {session.openingExchangeRate && <p className="text-sm text-[#475569]">Opening rate: USD 1 = UGX {session.openingExchangeRate.rate.toLocaleString()}</p>}
    </section>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {accountDefinitions.map(({ accountType, label, expectedCurrency }) => {
        const recordedBalance = session.openingBalances?.find(
          (balance) => balance.accountType === accountType
        );
        const isLegacyPhysicalCash = accountType === 'PHYSICAL_CASH' && !recordedBalance;
        const amount = recordedBalance?.amount ?? (isLegacyPhysicalCash ? session.openingCash : undefined);
        const currency = recordedBalance?.currency ?? expectedCurrency;
        const openedAt = recordedBalance?.openedAt ?? session.openedAt;
        const createdBy = recordedBalance?.createdBy ?? session.cashierId;

        return (
          <div
            key={accountType}
            className="p-5 bg-slate-950/80 rounded-xl border border-slate-800 shadow-sm"
          >
            <p className="text-xs font-semibold text-slate-400 uppercase">{label} ({currency})</p>
            <p className="mt-2 text-2xl font-extrabold text-white">
              {amount === undefined ? 'Not recorded' : `${currency} ${amount.toLocaleString()}`}
            </p>
            <div className="mt-4 space-y-1 text-[11px] text-slate-500">
              <p>
                <span className="text-slate-400">Provider:</span>{' '}
                {providerName(recordedBalance?.provider, accountType)}
              </p>
              <p>
                <span className="text-slate-400">Opened:</span>{' '}
                {new Date(openedAt).toLocaleString()}
              </p>
              <p>
                <span className="text-slate-400">Created by:</span> {personName(createdBy)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
