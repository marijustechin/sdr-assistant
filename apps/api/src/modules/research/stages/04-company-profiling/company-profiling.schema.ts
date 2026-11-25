import { z } from 'zod';

/**
 * The shape the model returns for the first company-profiling call.
 *
 * The model reports facts only: identity, public contacts, quoted market
 * evidence, prices for exact-product offers and one optional next page. It
 * never returns a verdict, traits or a market status — those are inherited from
 * stage 03 and derived by code.
 */

/** One quoted market rule. `coerce` is deliberately not used: a bad channel is dropped later. */
export const marketEvidenceItemSchema = z.object({
  channel: z.enum(['delivery', 'pickup', 'purchase']),
  direction: z.enum(['allows', 'restricts']),
  scope: z.enum(['domain', 'offer']),
  appliesTo: z.array(z.string().trim().min(1)).min(1),
  quote: z.string().trim().min(1),
  sourceUrl: z.string().trim().min(1),
});

export const priceItemSchema = z.object({
  amount: z.coerce.number(),
  currency: z.string().trim().nullable().catch(null),
  unit: z.enum(['m2', 'm', 'pc', 'pack']).nullable().catch(null),
  vatIncluded: z.boolean().nullable().catch(null),
  priceType: z.enum(['exact', 'from']).catch('exact'),
  variant: z.string().trim().nullable().catch(null),
  quote: z.string().trim().min(1),
  sourceUrl: z.string().trim().min(1),
});

export const emailItemSchema = z.object({
  value: z.string().trim().min(3),
  label: z.enum(['sales', 'general']).nullable().catch(null),
  sourceUrl: z.string().trim().min(1),
});

export const phoneItemSchema = z.object({
  value: z.string().trim().min(3),
  label: z.enum(['sales', 'general']).nullable().catch(null),
  sourceUrl: z.string().trim().min(1),
});

const companySchema = z.object({
  name: z.string().trim().nullable().catch(null),
  legalName: z.string().trim().nullable().catch(null),
  code: z.string().trim().nullable().catch(null),
  vat: z.string().trim().nullable().catch(null),
  address: z.string().trim().nullable().catch(null),
  city: z.string().trim().nullable().catch(null),
  country: z.string().trim().nullable().catch(null),
  // Items are parsed one by one during validation so one broken email does not
  // discard the valid ones.
  emails: z.array(z.unknown()).catch([]),
  phones: z.array(z.unknown()).catch([]),
  contactFormUrl: z.string().trim().nullable().catch(null),
});

const answerOfferSchema = z.object({
  id: z.string().trim().min(1),
  marketEvidence: z.array(z.unknown()).catch([]),
  prices: z.array(z.unknown()).catch([]),
});

const answerOfferListSchema = z
  .array(answerOfferSchema.nullable().catch(null))
  .transform((items) =>
    items.filter(
      (item): item is z.infer<typeof answerOfferSchema> => item !== null,
    ),
  )
  .catch([]);

export const companyProfilingAnswerSchema = z.object({
  company: companySchema,
  offers: answerOfferListSchema,
  nextPage: z
    .object({
      id: z.string().trim().min(1),
      kind: z.enum(['contact']),
    })
    .nullable()
    .catch(null),
  notes: z.string().trim().nullable().catch(null),
});

export type CompanyProfilingAnswer = z.infer<
  typeof companyProfilingAnswerSchema
>;

export type CompanyProfilingAnswerOffer = z.infer<typeof answerOfferSchema>;
