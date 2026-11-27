import { z } from 'zod';

/**
 * Wire shape of `GET /research/:jobId/communication` and the assignment
 * mutation. The endpoint returns the assignment only: account configuration
 * and credentials are read through the existing email-account endpoints.
 */
export const researchEmailAccountAssignmentSchema = z.object({
  emailAccountId: z.string().min(1).nullable(),
});

export type ResearchEmailAccountAssignment = z.infer<
  typeof researchEmailAccountAssignmentSchema
>;
