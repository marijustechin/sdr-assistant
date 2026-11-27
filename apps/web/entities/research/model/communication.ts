import { z } from 'zod';

/**
 * Wire shape of the research communication settings:
 * `GET /research/:jobId/communication` and the assignment mutation.
 * Account configuration and credentials are read through the existing
 * email-account endpoints and never travel through this payload.
 */
export const researchInitialEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type ResearchInitialEmail = z.infer<typeof researchInitialEmailSchema>;

/** Wire shape of the assignment mutation, which returns the assignment only. */
export const researchEmailAccountAssignmentSchema = z.object({
  emailAccountId: z.string().min(1).nullable(),
});

export type ResearchEmailAccountAssignment = z.infer<
  typeof researchEmailAccountAssignmentSchema
>;

export const researchCommunicationSchema = z.object({
  emailAccountId: z.string().min(1).nullable(),
  initialEmail: researchInitialEmailSchema.nullable(),
});

export type ResearchCommunication = z.infer<typeof researchCommunicationSchema>;
