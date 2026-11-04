import { z } from 'zod';

const accountSchema = z.object({
  id: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['CASH', 'WALLET']),
  currency: z.enum(['USD', 'UGX']),
}).strict();

const defaults = [
  { id: 'CASH_USD', name: 'USD Cash', kind: 'CASH', currency: 'USD' },
  { id: 'CASH_UGX', name: 'Shilling Cash', kind: 'CASH', currency: 'UGX' },
  ...[
    ['TELESOM_ZAAD', 'Telesom'], ['HORMUUD_EVC_PLUS', 'Hormuud'],
    ['SALAAM_BANK', 'Salaam Bank'], ['GOLIS_SAHAL', 'Golis'],
    ['MPESA', 'M-Pesa'], ['EDAHAB', 'E-Dahab'], ['MOBILE_MONEY', 'Mobile Money'],
  ].map(([id, name]) => ({ id, name, kind: 'WALLET', currency: 'USD' })),
];

export type OpeningAccount = z.infer<typeof accountSchema>;
export const getOpeningAccountCatalog = (configuration = process.env.OPENING_ACCOUNTS_JSON): OpeningAccount[] => {
  const accounts = z.array(accountSchema).min(2).max(50).parse(configuration ? JSON.parse(configuration) : defaults);
  if (new Set(accounts.map(a => a.id)).size !== accounts.length ||
      !accounts.some(a => a.id === 'CASH_USD' && a.kind === 'CASH' && a.currency === 'USD') ||
      !accounts.some(a => a.id === 'CASH_UGX' && a.kind === 'CASH' && a.currency === 'UGX') ||
      accounts.some(a => a.kind === 'WALLET' && a.currency !== 'USD')) {
    throw new Error('Account configuration requires unique IDs, CASH_USD, CASH_UGX and USD wallets');
  }
  return accounts;
};

export const expandedOpeningSchema = z.object({
  accounts: z.array(z.object({
    accountId: z.string().min(1),
    amount: z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER),
  }).strict()).min(2).max(50),
  exchangeRateId: z.string().regex(/^[a-f\d]{24}$/i),
}).strict();

export const prepareOpeningAccounts = (input: unknown, catalog = getOpeningAccountCatalog()) => {
  const request = expandedOpeningSchema.parse(input);
  if (new Set(request.accounts.map(a => a.accountId)).size !== request.accounts.length) {
    throw new Error('Select each account only once');
  }
  if (!['CASH_USD', 'CASH_UGX'].every(id => request.accounts.some(a => a.accountId === id))) {
    throw new Error('Both cash accounts are required');
  }
  return request.accounts.map(balance => {
    const definition = catalog.find(a => a.id === balance.accountId);
    if (!definition) throw new Error('Unknown or disabled opening account');
    if (definition.currency === 'UGX' && !Number.isSafeInteger(balance.amount)) {
      throw new Error('Shilling Cash requires whole UGX');
    }
    if (definition.currency === 'USD' && (!Number.isSafeInteger(Math.round(balance.amount * 100)) || Math.abs(balance.amount * 100 - Math.round(balance.amount * 100)) > 0.000001)) {
      throw new Error('USD opening balances require at most two decimal places');
    }
    return { ...definition, amount: balance.amount };
  });
};

// Only a complete, account-scoped ledger may be used. The application does not
// yet capture USD cash movements, so callers must not assert completeness.
export const reconcileUSDCash = (opening: number, actual: number, movements: {
  accountId: string; currency: string; direction: 'IN' | 'OUT'; amount: number;
  authorized: boolean; reference: string;
}[], ledgerComplete: boolean) => {
  if (!ledgerComplete) throw new Error('USD Cash movement ledger is incomplete; closing is blocked');
  const cents = (amount: number) => {
    if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100)) ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) throw new Error('Invalid USD amount');
    return Math.round(amount * 100);
  };
  const refs = new Set<string>();
  const expectedCents = movements.reduce((balance, movement) => {
    if (movement.accountId !== 'CASH_USD' || movement.currency !== 'USD' || !movement.authorized ||
        !movement.reference || refs.has(movement.reference) || !['IN', 'OUT'].includes(movement.direction)) {
      throw new Error('Invalid, duplicate or unauthorized USD Cash movement');
    }
    refs.add(movement.reference);
    const result = balance + (movement.direction === 'IN' ? 1 : -1) * cents(movement.amount);
    if (!Number.isSafeInteger(result)) throw new Error('USD balance exceeds supported precision');
    return result;
  }, cents(opening));
  const difference = (cents(actual) - expectedCents) / 100;
  return { expectedClosingBalance: expectedCents / 100, actualClosingBalance: actual, difference,
    status: difference === 0 ? 'BALANCED' : difference < 0 ? 'SHORTAGE' : 'OVERAGE' };
};
