import { z } from 'zod';

export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name is required'),
    phone: z.string().min(6, 'Valid phone number is required'),
    nationalId: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['ACTIVE', 'BLOCKED']).default('ACTIVE'),
  }),
});

export const updateCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(6).optional(),
    nationalId: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
  }),
});
