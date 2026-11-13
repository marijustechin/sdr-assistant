import { z } from 'zod';

export const dsResponseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string().min(1),
      title: z.string(),
      snippet: z.string(),
      summary: z.string(),
      content: z.string(),
    }),
  ),
});
