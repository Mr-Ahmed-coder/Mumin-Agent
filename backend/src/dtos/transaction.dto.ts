import { z } from 'zod';
import { WalletProvider } from '../constants/wallets';

export const createTransactionSchema = z.object({
  body: z.object({
    customerId: z.string().min(1, 'Customer ID is required'),
    walletProvider: z.nativeEnum(WalletProvider),
    amountReceivedUSD: z.number().positive('Amount received in USD must be positive').optional(),
    amountReceived: z.number().positive('Amount received must be positive').optional(),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
  }).refine((data) => data.amountReceivedUSD !== undefined || data.amountReceived !== undefined, {
    message: 'Amount received in USD is required',
    path: ['amountReceivedUSD'],
  }),
});

export const cancelTransactionSchema = z.object({
  body: z.object({
    cancellationReason: z.string().min(3, 'Reason for cancellation is required'),
  }),
});
