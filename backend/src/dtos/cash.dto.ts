import { z } from 'zod';
import { WalletProvider } from '../constants/wallets';

const digitalOpeningBalance = z
  .number()
  .finite('Opening balance must be a finite amount')
  .min(0, 'Opening balance must be non-negative');

export const openCashSessionSchema = z.object({
  body: z.object({
    openingCash: z.number().int('Opening cash must be entered in whole UGX').min(0, 'Opening cash (UGX) must be non-negative'),
    evcOpeningBalanceUSD: digitalOpeningBalance,
    mobileMoneyOpeningBalanceUSD: digitalOpeningBalance,
    mobileMoneyProvider: z.nativeEnum(WalletProvider).refine(
      (provider) => provider !== WalletProvider.HORMUUD_EVC_PLUS,
      'Select a Mobile Money provider other than Hormuud EVC Plus'
    ),
    notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
  }),
});

export const adjustCashSchema = z.object({
  body: z.object({
    amount: z.number().int('Cash adjustment must be entered in whole UGX').positive('Cash adjustment (UGX) must be positive'),
    reason: z.string().min(2, 'Reason is required'),
  }),
});

export const closeCashSessionSchema = z.object({
  body: z.object({
    actualBalances: z
      .array(
        z
          .object({
            accountId: z.string().min(1).optional(),
            accountType: z.enum(['PHYSICAL_CASH', 'EVC', 'MOBILE_MONEY']),
            provider: z.union([z.literal('CASH_DRAWER'), z.nativeEnum(WalletProvider)]),
            currency: z.enum(['UGX', 'USD']),
            amount: z.number().finite('Actual closing balance must be finite').min(0),
          })
          .superRefine((balance, ctx) => {
            if (balance.accountType === 'PHYSICAL_CASH') {
              if (balance.provider !== 'CASH_DRAWER' || balance.currency !== 'UGX') {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Physical Cash must use CASH_DRAWER and UGX' });
              }
              if (!Number.isInteger(balance.amount)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Physical Cash must be entered in whole UGX' });
              }
            }
            if (balance.accountType === 'EVC' && (
              balance.provider !== WalletProvider.HORMUUD_EVC_PLUS || balance.currency !== 'USD'
            )) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'EVC must use Hormuud EVC Plus and USD' });
            }
            if (balance.accountType === 'MOBILE_MONEY' && (
              balance.provider === 'CASH_DRAWER' ||
              balance.provider === WalletProvider.HORMUUD_EVC_PLUS ||
              balance.currency !== 'USD'
            )) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Mobile Money must use its selected USD provider' });
            }
          })
      )
      .min(1, 'At least one actual closing balance is required')
      .superRefine((balances, ctx) => {
        const keys = balances.map((balance) => `${balance.accountType}:${balance.provider}:${balance.currency}`);
        if (new Set(keys).size !== keys.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Actual closing balances cannot contain duplicates' });
        }
      }),
    notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
  }).strict(),
});
