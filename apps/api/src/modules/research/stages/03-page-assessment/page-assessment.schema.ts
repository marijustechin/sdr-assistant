import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* v1 — one verdict per page. Kept for revert; the service now uses the facts.  */
/* -------------------------------------------------------------------------- */

/** The three outcomes `PAGE_ASSESSMENT_PROMPT` v1 allowed. */
export const pageAssessmentVerdictSchema = z.enum(['a', 'b', 'none']);

/**
 * One page assessment, matching `PAGE_ASSESSMENT_PROMPT` v1.
 *
 * `verdict` is strict: it is the only field stage 03 exists to produce, so a
 * missing or invented value fails the page instead of becoming a quiet "none".
 * `reason` and `evidence` are tolerant — a usable verdict must not be thrown
 * away over a missing or empty quote. The prompt's cross-field rule (a quote
 * for "a" and "b", null for "none") is not re-checked here: the schema records
 * what the model said, and any extra field it invents is dropped.
 */
export const pageAssessmentSchema = z.object({
  verdict: pageAssessmentVerdictSchema,
  reason: z.string().trim().catch(''),
  evidence: z
    .string()
    .trim()
    .nullable()
    .catch(null)
    .transform((value) => (value === '' ? null : value)),
});

export type PageAssessmentVerdict = z.infer<
  typeof pageAssessmentVerdictSchema
>;
export type PageAssessment = z.infer<typeof pageAssessmentSchema>;

/* -------------------------------------------------------------------------- */
/* v2 — facts only. `deriveVerdict()` turns them into a/b/none.                  */
/* -------------------------------------------------------------------------- */

/** Who publishes the page. Only `seller` can reach a or b. */
export const pagePublisherSchema = z.enum([
  'seller',
  'third_party',
  'mass_market_retailer',
  'unclear',
]);

/**
 * What proves the offer. `label_only` is a category name in a menu or a
 * product-group label and is never an offer; `none` means no offer at all.
 */
export const pageOfferEvidenceSchema = z.enum([
  'catalogue',
  'price',
  'sale_statement',
  'spec',
  'label_only',
  'none',
]);

/** Does the concrete offered item belong to the category from the study spec? */
export const pageCategoryMatchSchema = z.enum(['yes', 'no', 'unknown']);

/** `other` is only used when the page itself limits the offer to another market. */
export const pageMarketStatusSchema = z.enum(['target', 'other', 'unclear']);

/** One exact-product trait as the page shows it. */
export const pageTraitMatchSchema = z.enum([
  'confirmed',
  'differs',
  'unknown',
]);

export const pageTraitFactSchema = z.object({
  match: pageTraitMatchSchema,
  /** The page's own wording for this trait, e.g. "ayous" or "termo pušis". */
  value: z.string().trim().nullable().catch(null),
});

export const pageOfferSchema = z.object({
  /** What the publisher itself offers on this page, or null. */
  item: z.string().trim().nullable().catch(null),
  /** Verbatim evidence for the offer, or null. */
  quote: z.string().trim().nullable().catch(null),
  evidence_type: pageOfferEvidenceSchema,
});

export const pageCategorySchema = z.object({
  match: pageCategoryMatchSchema,
  /** Verbatim evidence for the category decision, or null. */
  quote: z.string().trim().nullable().catch(null),
});

export const pageMarketSchema = z.object({
  status: pageMarketStatusSchema,
  note: z.string().trim().nullable().catch(null),
});

/**
 * Facts for one page, matching `PAGE_ASSESSMENT_PROMPT` v2.
 *
 * The traits object is built from the study spec: it requires exactly the
 * declared trait names and rejects anything else, so a missing trait is an
 * invalid answer instead of a silently shorter list. Enums are strict for the
 * same reason — an invented publisher, evidence type or match fails the page.
 * Free text is tolerant; a usable answer must not be lost over a null quote.
 */
export function buildPageFactsSchema(traitNames: readonly string[]) {
  const traitShape = Object.fromEntries(
    traitNames.map((name) => [name, pageTraitFactSchema]),
  );

  return z.object({
    publisher: pagePublisherSchema,
    offer: pageOfferSchema,
    category: pageCategorySchema,
    traits: z.strictObject(traitShape),
    market: pageMarketSchema,
    note: z.string().trim().catch(''),
  });
}

export type PageTraitFact = z.infer<typeof pageTraitFactSchema>;
export type PageFacts = z.infer<ReturnType<typeof buildPageFactsSchema>>;
