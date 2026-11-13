import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1);

export const identifiedProductSchema = z.object({
  understanding: z.string().optional(),
  productName: nonEmptyText,
  categoryName: nonEmptyText,
  generalCategoryName: nonEmptyText,
  notes: z.string().optional(),
});

export type IdentifiedProduct = z.infer<typeof identifiedProductSchema>;
