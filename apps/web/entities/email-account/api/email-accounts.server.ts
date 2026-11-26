import 'server-only';

import { getJson, patchJson, postJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

import {
  connectionVerificationResultSchema,
  emailAccountListSchema,
  emailAccountSchema,
  type ConnectionVerificationResult,
  type EmailAccount,
  type EmailAccountInput,
  type EmailConnectionProtocol,
} from '../model/schema';

export function fetchEmailAccounts(): Promise<ApiResult<EmailAccount[]>> {
  return getJson(`${apiUrl}/email-accounts`, emailAccountListSchema);
}

export function fetchEmailAccount(
  id: string,
): Promise<ApiResult<EmailAccount>> {
  return getJson(
    `${apiUrl}/email-accounts/${encodeURIComponent(id)}`,
    emailAccountSchema,
  );
}

export function createEmailAccount(
  input: EmailAccountInput,
): Promise<ApiResult<EmailAccount>> {
  return postJson(`${apiUrl}/email-accounts`, input, emailAccountSchema);
}

/**
 * Sends only the fields that changed. An omitted password keeps the stored
 * credential; the API applies the same rule.
 */
export function updateEmailAccount(
  id: string,
  input: Partial<EmailAccountInput>,
): Promise<ApiResult<EmailAccount>> {
  return patchJson(
    `${apiUrl}/email-accounts/${encodeURIComponent(id)}`,
    input,
    emailAccountSchema,
  );
}

/**
 * Tests the saved configuration of one protocol. The request carries no
 * destination and no credential: the API uses the stored values only.
 */
export function testEmailAccountConnection(
  id: string,
  protocol: EmailConnectionProtocol,
): Promise<ApiResult<ConnectionVerificationResult>> {
  const path = protocol === 'SMTP' ? 'test-smtp' : 'test-imap';

  return postJson(
    `${apiUrl}/email-accounts/${encodeURIComponent(id)}/${path}`,
    undefined,
    connectionVerificationResultSchema,
  );
}
