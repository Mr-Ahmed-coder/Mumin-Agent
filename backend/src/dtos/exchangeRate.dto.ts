import { z } from 'zod';

export const createExchangeRateSchema = z.object({
  body: z.object({
    rate: z.number().finite().positive('Exchange rate must be greater than zero'),
  }),
});
