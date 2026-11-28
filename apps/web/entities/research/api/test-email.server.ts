import 'server-only';

import { postJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

import {
  testEmailSendResultSchema,
  type TestEmailSendResult,
} from '../model/test-email';

/**
 * Sends one owner-triggered test email to a manually entered recipient.
 *
 * The API composes the message from the saved composition and sends it through
 * the research's assigned account. The request carries only the recipient: no
 * body, credentials or account configuration travel from the browser. One SMTP
 * attempt can take up to a minute, so the transport timeout is raised.
 */
export function sendTestEmail(
  jobId: string,
  recipient: string,
): Promise<ApiResult<TestEmailSendResult>> {
  return postJson(
    `${apiUrl}/research/${encodeURIComponent(jobId)}/communication/test-email`,
    { recipient },
    testEmailSendResultSchema,
    { timeoutMs: 90_000 },
  );
}
