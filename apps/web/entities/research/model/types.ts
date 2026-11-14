import { z } from 'zod';

export const researchStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'INTERRUPTED',
]);

export type ResearchStatus = z.infer<typeof researchStatusSchema>;

export type ResearchResponse = {
  id: string;
  productId: string;
  country: string;
  status: ResearchStatus;
  stage: null | string;
  result: null | string;
  error: null | string;
  lastHeartbeatAt: null | string;
  createdAt: string;
  updatedAt: string;
};

/** Response of `POST /research` (202 Accepted). */
export const startResearchResponseSchema = z.object({
  jobId: z.string().min(1),
  status: researchStatusSchema,
});

export type StartResearchResponse = z.infer<typeof startResearchResponseSchema>;
