import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1);

export const productProfileSchema = z.object({
  canonicalName: nonEmptyText,
  definition: nonEmptyText,

  productType: z.object({
    name: nonEmptyText,
    synonyms: z
      .array(
        z.object({
          language: nonEmptyText,
          terms: z.array(nonEmptyText).min(1),
        }),
      )
      .min(1),
  }),

  synonyms: z
    .array(
      z.object({
        language: nonEmptyText,
        terms: z.array(nonEmptyText).min(1),
      }),
    )
    .min(1),

  attributeChecklist: z
    .array(
      z.object({
        attribute: nonEmptyText,
        specifiedValue: nonEmptyText.nullable(),
        appliesTo: z.array(nonEmptyText).min(1),
      }),
    )
    .min(1),

  uncertainties: z.array(nonEmptyText),

  scope: z.object({
    requiredCharacteristics: z
      .array(
        z.object({
          attribute: nonEmptyText,
          specifiedValue: nonEmptyText,
          appliesTo: z.array(nonEmptyText).min(1),
        }),
      )
      .min(1),
    variantAttributes: z.array(nonEmptyText),
    potentialSubstitutes: z.array(nonEmptyText),
    excludedFromTarget: z.array(nonEmptyText),
  }),

  applications: z.array(
    z.object({
      description: nonEmptyText,
      basis: z.enum(['input', 'hypothesis']),
      appliesTo: z.array(nonEmptyText).min(1),
    }),
  ),
});

export type ProductProfile = z.infer<typeof productProfileSchema>;
