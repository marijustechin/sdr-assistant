import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1);

export const researchPlanSchema = z.object({
  directions: z
    .array(
      z.object({
        kind: z.enum(['exact_product', 'product_category', 'application']),

        description: nonEmptyText,

        queries: z
          .array(
            z.object({
              language: nonEmptyText,
              query: nonEmptyText,
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type ResearchPlan = z.infer<typeof researchPlanSchema>;
