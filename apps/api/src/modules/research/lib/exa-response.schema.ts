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

/** Response of `POST https://api.exa.ai/contents` (known URLs, not a search). */
export const exaContentsResponseSchema = z.object({
  requestId: z.string().optional(),

  results: z.array(
    z.object({
      url: z.string().min(1),
      title: z.string().nullish(),
      text: z.string().nullish(),
    }),
  ),

  statuses: z
    .array(
      z.object({
        id: z.string().optional(),
        status: z.string().optional(),
        error: z.string().nullish(),
      }),
    )
    .optional(),
});

