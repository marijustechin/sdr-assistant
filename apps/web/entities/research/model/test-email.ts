import { z } from 'zod';

/**
 * Wire contract of `POST /research/:jobId/communication/test-email`.
 *
 * `SENT` means the SMTP server definitively accepted the message for the
 * recipient. `FAILED` may be definitive (`uncertain: false`) or may mean the
 * transport ended without a server answer (`uncertain: true`), in which case the
 * message may or may not have been delivered. Raw provider responses are never
 * part of the payload.
 */
export const testEmailSendResultSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('SENT'),
    recipient: z.string().min(1),
    recorded: z.boolean(),
    completedAt: z.string(),
  }),
  z.object({
    outcome: z.literal('FAILED'),
    recipient: z.string().min(1),
    failureCode: z.string().min(1),
    message: z.string().min(1),
    uncertain: z.boolean(),
    recorded: z.boolean(),
    completedAt: z.string(),
  }),
]);

export type TestEmailSendResult = z.infer<typeof testEmailSendResultSchema>;
