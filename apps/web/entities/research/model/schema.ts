import { z } from 'zod';

export const researchStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'INTERRUPTED',
]);

export type ResearchStatus = z.infer<typeof researchStatusSchema>;

/**
 * Wire shape of `GET /research/:jobId`.
 *
 * `result` stays `unknown` on purpose: stage 02 is still in development and
 * currently returns the literal string `"completed"`. Do not narrow it until
 * the API publishes a stable schema — see
 * docs/decisions/ADR-001-research-pipeline.md.
 */
export const researchResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  country: z.string(),
  status: researchStatusSchema,
  stage: z.string().nullable(),
  result: z.unknown(),
  error: z.string().nullable(),
  lastHeartbeatAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ResearchResponse = z.infer<typeof researchResponseSchema>;

export const researchListSchema = z.array(researchResponseSchema);

/** Response of `POST /research` (202 Accepted). */
export const startResearchResponseSchema = z.object({
  jobId: z.string().min(1),
  status: researchStatusSchema,
});

export type StartResearchResponse = z.infer<typeof startResearchResponseSchema>;
