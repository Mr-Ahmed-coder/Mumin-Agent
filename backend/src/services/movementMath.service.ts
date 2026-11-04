import { z } from 'zod';

export const flows = ['WALLET_USD_TO_CASH_UGX', 'CASH_UGX_TO_WALLET_USD', 'CASH_USD_TO_CASH_UGX', 'WALLET_USD_TO_WALLET_USD', 'CASH_USD_TO_WALLET_USD'] as const;
export type Flow = typeof flows[number];
export type AccountDefinition = { id: string; kind: 'CASH' | 'WALLET'; currency: 'USD' | 'UGX' };
export type MovementLeg = { accountId: string; currency: 'USD' | 'UGX'; direction: 'IN' | 'OUT'; amountMinor: number };

export const minorUnits = (amount: number, currency: 'USD' | 'UGX'): number => {
  const scaled = amount * (currency === 'USD' ? 100 : 1);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 0.000001) throw new Error(`Invalid ${currency} amount`);
  return Math.round(scaled);
};
const roundRatio = (numerator: bigint, denominator: bigint) => {
  const result = Number((numerator * 2n + denominator) / (denominator * 2n));
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeds supported precision');
  return result;
};

export const quoteMovement = (flow: Flow, incoming: AccountDefinition, outgoing: AccountDefinition,
  amount: number, rate: number, otherFeeUSD?: number) => {
  if (incoming.id === outgoing.id) throw new Error('Choose distinct incoming and outgoing shop accounts');
  const wallet = (a: AccountDefinition) => a.kind === 'WALLET' && a.currency === 'USD';
  const cash = (a: AccountDefinition, currency: string) => a.kind === 'CASH' && a.currency === currency;
  const matches: Record<Flow, boolean> = {
    WALLET_USD_TO_CASH_UGX: wallet(incoming) && cash(outgoing, 'UGX'),
    CASH_UGX_TO_WALLET_USD: cash(incoming, 'UGX') && wallet(outgoing),
    CASH_USD_TO_CASH_UGX: cash(incoming, 'USD') && cash(outgoing, 'UGX'),
    WALLET_USD_TO_WALLET_USD: wallet(incoming) && wallet(outgoing),
    CASH_USD_TO_WALLET_USD: cash(incoming, 'USD') && wallet(outgoing),
  };
  if (!matches[flow]) throw new Error('Accounts do not match the requested flow');
  const receivedMinor = minorUnits(amount, incoming.currency);
  if (receivedMinor <= 0) throw new Error('Received amount must be positive');
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e9 || Math.abs(rate * 1e6 - Math.round(rate * 1e6)) > 0.000001) throw new Error('Invalid exchange rate precision');
  const r = BigInt(Math.round(rate * 1e6));
  const usdToUGX = outgoing.currency === 'UGX';
  let feeUGX = 0, feeUSD = 0, payoutMinor: number;
  if (usdToUGX) {
    const grossUGX = roundRatio(BigInt(receivedMinor) * r, 100000000n);
    feeUGX = roundRatio(BigInt(receivedMinor) * r, 10000000000n);
    // Exact 1% in USD for reporting (may include fractions of a cent).
    feeUSD = receivedMinor / 10000;
    payoutMinor = grossUGX - feeUGX;
  } else {
    if (otherFeeUSD === undefined) throw new Error('Fee policy for this flow is unconfirmed; posting is blocked');
    const feeMinor = minorUnits(otherFeeUSD, 'USD');
    feeUSD = otherFeeUSD;
    const grossMinor = incoming.currency === 'UGX'
      ? roundRatio(BigInt(receivedMinor) * 100000000n, r) : receivedMinor;
    payoutMinor = grossMinor - feeMinor;
  }
  if (payoutMinor <= 0) throw new Error('Payout must be positive after fees');
  const legs: MovementLeg[] = [
    { accountId: incoming.id, currency: incoming.currency, direction: 'IN', amountMinor: receivedMinor },
    { accountId: outgoing.id, currency: outgoing.currency, direction: 'OUT', amountMinor: payoutMinor },
  ];
  return { legs, feeUSD, feeUGX };
};

export const operationSchema = z.object({
  requestKey: z.string().trim().min(8).max(100),
  shiftId: z.string().regex(/^[a-f\d]{24}$/i),
  category: z.enum([...flows, 'CASH_ADDED', 'CASH_WITHDRAWN', 'ADJUSTMENT', 'EXPENSE', 'CUSTOMER_DEPOSIT', 'CUSTOMER_WITHDRAWAL', 'CREDIT_REPAYMENT']),
  accountId: z.string().min(1).max(64),
  outgoingAccountId: z.string().min(1).max(64).optional(),
  amount: z.number().finite().positive(),
  exchangeRateId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  reference: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(3).max(500).optional(),
  direction: z.enum(['IN', 'OUT']).optional(),
  recordId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  customerId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  customerName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  expenseCategory: z.enum(['RENT', 'UTILITIES', 'SALARY', 'SUPPLIES', 'MISC']).optional(),
  expenseNotes: z.string().trim().max(500).optional(),
}).strict();

export const calculateUSDToUGX = (amount: number, rate: number) => {
  const quote = quoteMovement('CASH_USD_TO_CASH_UGX', { id: 'CASH_USD', kind: 'CASH', currency: 'USD' },
    { id: 'CASH_UGX', kind: 'CASH', currency: 'UGX' }, amount, rate);
  return { serviceFeeUSD: quote.feeUSD, serviceFeeUGX: quote.feeUGX,
    cashPaidUGX: quote.legs[1].amountMinor, exchangeableAmountUSD: amount - quote.feeUSD };
};

export const reverseLegs = (legs: MovementLeg[]): MovementLeg[] => legs.map(leg => ({
  accountId: leg.accountId, currency: leg.currency, amountMinor: leg.amountMinor,
  direction: leg.direction === 'IN' ? 'OUT' : 'IN',
}));

export const accountBalanceMinor = (opening: number, account: AccountDefinition, legs: MovementLeg[]) => {
  let balance = minorUnits(opening, account.currency);
  for (const leg of legs) {
    if (leg.accountId !== account.id) continue;
    if (leg.currency !== account.currency || !Number.isSafeInteger(leg.amountMinor) || leg.amountMinor <= 0 || !['IN', 'OUT'].includes(leg.direction)) throw new Error('Invalid ledger movement');
    balance += (leg.direction === 'IN' ? 1 : -1) * leg.amountMinor;
    if (!Number.isSafeInteger(balance)) throw new Error('Account balance exceeds supported precision');
  }
  return balance;
};
