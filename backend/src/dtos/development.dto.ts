import { z } from 'zod';

export const resetDevelopmentDataSchema = z.object({
  body: z.object({
    confirmation: z.literal('RESET', {
      errorMap: () => ({ message: 'Type RESET exactly to confirm the development data reset' }),
    }),
  }),
});
