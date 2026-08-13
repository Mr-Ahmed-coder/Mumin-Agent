import { z } from 'zod';

const ugxAmount = z.number().int('Amount must be a whole UGX value').positive('Amount UGX must be greater than zero');

export const recordCustomerDepositSchema = z.object({
  body: z.object({
    customerName: z.string().trim().min(2, 'Customer name is required'),
    phone: z.string().trim().min(6, 'Phone number is required'),
    amountUGX: ugxAmount,
    notes: z.string().trim().max(500).optional(),
  }),
});

export const recordCustomerWithdrawalSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    amountUGX: ugxAmount,
    notes: z.string().trim().max(500).optional(),
  }),
});
