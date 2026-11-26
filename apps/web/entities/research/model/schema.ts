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
 * `result` stays `unknown` on purpose: the API returns historical envelopes
 * verbatim (seven unversioned shapes plus the versioned `schemaVersion: 1`
 * final result). The typed presentation model lives in `model/result.ts` and is
 * the only consumer that narrows this field — see docs/system/research.md §7.
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
