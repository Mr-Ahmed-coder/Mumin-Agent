import { z } from 'zod';

const ugxAmount = z.number().int('Amount must be a whole UGX value').positive('Amount UGX must be greater than zero');

export const createInternetCreditSchema = z.object({
  body: z.object({
    customerName: z.string().trim().min(2, 'Customer name is required'),
    phone: z.string().trim().min(6, 'Phone number is too short').optional().or(z.literal('')),
    amountUGX: ugxAmount,
    description: z.string().trim().max(500).optional(),
    dateGiven: z.string().datetime().optional(),
  }),
});

export const recordInternetCreditPaymentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    amountUGX: ugxAmount,
    notes: z.string().trim().max(500).optional(),
  }),
});

export const customerInternetCreditHistorySchema = z.object({
  query: z
    .object({
      phone: z.string().trim().min(6, 'Phone number is too short').optional(),
      customerName: z.string().trim().min(2, 'Customer name is required').optional(),
    })
    .refine((query) => Boolean(query.phone || query.customerName), {
      message: 'Phone number or customer name is required',
    }),
});
