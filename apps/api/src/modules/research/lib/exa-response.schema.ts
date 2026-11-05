import { z } from 'zod';

export const exaResponseSchema = z.object({
  requestId: z.string().optional(),

  results: z.array(
    z.object({
      url: z.string().min(1),
      title: z.string().nullish(),
      highlights: z.array(z.string()).nullish(),
    }),
  ),
});
