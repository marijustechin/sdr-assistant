import { z } from 'zod';

const emailSchema = z.object({
  value: z.string().min(1),
  sourceUrl: z.string().nullable().catch(null),
});

const personSchema = z.object({
  name: z.string().nullable().catch(null),
  role: z.string().nullable().catch(null),
  email: z.string().nullable().catch(null),
  sourceUrl: z.string().nullable().catch(null),
});

const offerSchema = z.object({
  price: z.string().min(1),
  currency: z.string().nullable().catch(null),
  unit: z.string().nullable().catch(null),
  sourceUrl: z.string().nullable().catch(null),
});

/**
 * Answer of `COMPANY_DISCOVERY_PROMPT` (v9).
 *
 * `verdict` is strict — a company without a usable a/b verdict is recorded as a
 * failure instead of being guessed at. Everything else is tolerant so one stray
 * field cannot throw away a usable profile. Phone numbers are deliberately not
 * collected, and contact pages are chosen by `CONTACT_PAGE_PICKER_PROMPT`, so
 * this answer carries no follow-up URLs.
 */
export const companyDiscoveryAnswerSchema = z.object({
  name: z.string().nullable().catch(null),
  legalName: z.string().nullable().catch(null),
  companyCode: z.string().nullable().catch(null),
  vatCode: z.string().nullable().catch(null),
  address: z.string().nullable().catch(null),
  city: z.string().nullable().catch(null),
  country: z.string().nullable().catch(null),
  emails: z.array(emailSchema).catch([]),
  people: z.array(personSchema).catch([]),
  offers: z.array(offerSchema).catch([]),
  verdict: z.enum(['a', 'b', 'none', 'unclear']),
  confidence: z.enum(['high', 'medium', 'low']).catch('low'),
  notes: z.string().nullable().catch(null),
});

export type CompanyDiscoveryAnswer = z.infer<
  typeof companyDiscoveryAnswerSchema
>;
