import { z } from 'zod';

/**
 * Wire contract of the research initial-email attachments:
 * `GET/POST /research/:jobId/communication/attachments` and
 * `DELETE .../attachments/:attachmentId`.
 *
 * Only metadata crosses the wire. The file bytes are private server-side data
 * and no response field, route or client helper returns them.
 */

export const attachmentLimitsSchema = z.object({
  maxFileBytes: z.number().int().positive(),
  maxAttachments: z.number().int().positive(),
  maxTotalBytes: z.number().int().positive(),
});

export type AttachmentLimits = z.infer<typeof attachmentLimitsSchema>;

export const researchAttachmentSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string(),
  createdAt: z.string(),
});

export type ResearchAttachment = z.infer<typeof researchAttachmentSchema>;

export const researchAttachmentListSchema = z.object({
  limits: attachmentLimitsSchema,
  items: z.array(researchAttachmentSchema),
});

export type ResearchAttachmentList = z.infer<
  typeof researchAttachmentListSchema
>;

export const removeResearchAttachmentResultSchema = z.object({
  removed: z.literal(true),
});

export type RemoveResearchAttachmentResult = z.infer<
  typeof removeResearchAttachmentResultSchema
>;

export type ResearchAttachmentUpload = {
  readonly filename: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
};
