import { z } from 'zod';

/**
 * Validation shared by the test-email form and its Server Action. The API
 * validates the same field again; the client copy exists for immediate
 * feedback.
 */
const recipientSchema = z
  .string()
  .trim()
  .min(1, 'Enter a test recipient email address.')
  .max(320, 'The test recipient must be 320 characters or fewer.')
  .pipe(z.email('Enter a valid email address.'));

export type TestRecipientParseResult =
  | { readonly ok: true; readonly recipient: string }
  | { readonly ok: false; readonly message: string };

export function parseTestRecipient(value: string): TestRecipientParseResult {
  const parsed = recipientSchema.safeParse(value);

  if (parsed.success) {
    return { ok: true, recipient: parsed.data };
  }

  return {
    ok: false,
    message: parsed.error.issues[0]?.message ?? 'Enter a valid email address.',
  };
}
