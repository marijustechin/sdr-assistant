import { z } from 'zod';

/** The three outcomes `PAGE_ASSESSMENT_PROMPT` allows. */
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
