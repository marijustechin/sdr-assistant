'use server';

import { sendTestEmail, type TestEmailSendResult } from '@/entities/research';

import { parseTestRecipient } from '../model/test-email';

export type SendTestEmailActionResult =
  | { readonly ok: true; readonly result: TestEmailSendResult }
  | { readonly ok: false; readonly message: string };

/**
 * Sends one test email to a manually entered recipient.
 *
 * No composition data travels from the browser: the API uses the saved
 * subject, body, account signature and research attachments. The action returns
 * the actual transport outcome, including an uncertain acceptance, and never
 * retries.
 */
export async function sendTestEmailAction(
  researchId: string,
  recipient: string,
): Promise<SendTestEmailActionResult> {
  const parsed = parseTestRecipient(recipient);

  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }

  const result = await sendTestEmail(researchId, parsed.recipient);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  return { ok: true, result: result.data };
}
