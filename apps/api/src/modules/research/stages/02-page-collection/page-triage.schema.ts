import { z } from 'zod';

export const triageVerdictSchema = z.enum(['good', 'none']);

/**
 * One page triage answer, matching `PAGE_TRIAGE_PROMPT` v17.
 *
 * `verdict` is strict; `evidence` and `reason` are tolerant, and any extra field
 * the model invents is dropped. The verdict is not re-checked in code: stage 02
 * collects candidates, and stage 03 decides whether the company offers the
 * product.
 */
export const pageTriageSchema = z.object({
  verdict: triageVerdictSchema,
  evidence: z.string().nullable().catch(null),
  reason: z.string().nullable().catch(null),
});

export type PageTriage = z.infer<typeof pageTriageSchema>;
