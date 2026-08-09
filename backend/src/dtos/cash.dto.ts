import { z } from 'zod';

export const openCashSessionSchema = z.object({
  body: z.object({
    openingCash: z.number().int('Opening cash must be entered in whole UGX').min(0, 'Opening cash (UGX) must be non-negative'),
    notes: z.string().optional(),
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
    closingCashActual: z.number().int('Closing cash must be entered in whole UGX').min(0, 'Actual closing cash (UGX) must be non-negative'),
    notes: z.string().optional(),
  }),
});
