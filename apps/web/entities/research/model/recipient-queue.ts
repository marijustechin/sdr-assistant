import { z } from 'zod';

/**
 * Wire shape of the prepared recipient queue.
 *
 * `publication` is the current published Stage 05 run, or `null` when none
 * exists. Only recipients prepared from that run are ever included, so a
 * superseded publication never appears as the current queue. `totals` are
 * global, `totalItems` is the filtered result count, and `items` is one page.
 */
export const recipientSelectionReasonSchema = z.enum([
  'SALES_DEPARTMENT',
  'GENERAL_MAILBOX',
  'INDIVIDUAL_CONTACT',
]);

export const recipientQueueStatusSchema = z.enum(['PREPARED']);

export const recipientQueuePublicationSchema = z.object({
  runId: z.string().min(1),
  publishedAt: z.string(),
});

export const recipientQueueItemSchema = z.object({
  id: z.string().min(1),
  companyName: z.string().nullable(),
  domain: z.string(),
  primaryEmail: z.string(),
  alternativeEmails: z.array(z.string()),
  selectionReason: recipientSelectionReasonSchema,
  status: recipientQueueStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const recipientQueueTotalsSchema = z.object({
  retainedCompanies: z.number().int().min(0),
  preparedRecipients: z.number().int().min(0),
  alternativeContacts: z.number().int().min(0),
});

export const recipientQueueSchema = z.object({
  publication: recipientQueuePublicationSchema.nullable(),
  prepared: z.boolean(),
  totals: recipientQueueTotalsSchema,
  items: z.array(recipientQueueItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalItems: z.number().int().min(0),
});

export type RecipientSelectionReason = z.infer<
  typeof recipientSelectionReasonSchema
>;
export type RecipientQueueStatus = z.infer<typeof recipientQueueStatusSchema>;
export type RecipientQueuePublication = z.infer<
  typeof recipientQueuePublicationSchema
>;
export type RecipientQueueItem = z.infer<typeof recipientQueueItemSchema>;
export type RecipientQueueTotals = z.infer<typeof recipientQueueTotalsSchema>;
export type RecipientQueue = z.infer<typeof recipientQueueSchema>;
