import { z } from 'zod';

/** What a query is expected to return; splitting on this yields the two search lists. */
export const termQueryKindSchema = z.enum(['product', 'category']);

/**
 * Which trait of the product the query adds. `trade_alias` and `supply_form`
 * overlap in practice — a board or panel word is often both — so the label is
 * analysis material, not a rule the pipeline enforces.
 */
export const termQueryFamilySchema = z.enum([
  'application',
  'material',
  'treatment',
  'supply_form',
  'trade_alias',
  'channel',
]);

/**
 * One additional search query, matching `TERM_GENERATION_PROMPT` v4.
 *
 * `query` is the only field the pipeline cannot work without, so it is strict:
 * an item without text makes the whole answer unusable and the array falls
 * back to empty. The rest is tolerant — a kind the model invents becomes
 * `category` (the broader of the two buckets, so a query is never promoted to
 * "offers this exact product"), an unknown family becomes `null`, and a
 * missing `why` becomes an empty string. Those fields label the query for
 * analysis; they must not fail a run or quietly rename what the model said.
 */
export const termQuerySchema = z.object({
  query: z.string().trim().min(1),
  kind: termQueryKindSchema.catch('category'),
  family: termQueryFamilySchema.nullable().catch(null),
  why: z.string().trim().catch(''),
});

/**
 * The whole answer of `TERM_GENERATION_PROMPT`: the queries the seed names do
 * not cover, in the model's order of usefulness.
 *
 * The prompt asks for at most five and for an empty array when nothing passes
 * its test, so an empty answer is a valid result, not an error. The length is
 * not capped here; a longer answer is kept whole and the caller decides how
 * many terms it is willing to search.
 */
export const termGenerationSchema = z.object({
  queries: z.array(termQuerySchema).catch([]),
});

export type TermQuery = z.infer<typeof termQuerySchema>;
export type TermGeneration = z.infer<typeof termGenerationSchema>;
