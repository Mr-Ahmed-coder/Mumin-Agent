import { z } from 'zod';
import { WalletProvider } from '../constants/wallets';

export const createFeeRuleSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name is required'),
    walletProvider: z.union([z.nativeEnum(WalletProvider), z.literal('ALL')]).default('ALL'),
    minAmount: z.number().min(0, 'Min amount must be >= 0'),
    maxAmount: z.number().nullable().optional(),
    feeType: z.enum(['FIXED', 'PERCENTAGE']),
    feeValue: z.number().min(0, 'Fee value must be >= 0'),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  }),
});

export const calculateFeeSchema = z.object({
  body: z.object({
    amount: z.number().positive('Amount must be positive'),
    walletProvider: z.nativeEnum(WalletProvider),
  }),
});
