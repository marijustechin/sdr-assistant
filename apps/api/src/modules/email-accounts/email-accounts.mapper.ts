import type { EmailSecurityMode } from './email-accounts.constants.js';

/**
 * The parts of one `email_accounts` row the API needs. The encrypted password
 * columns are present here only so the response can report whether a
 * credential is configured; their values never leave the backend.
 */
export type EmailAccountRow = {
  readonly id: string;
  readonly name: string;
  readonly senderName: string;
  readonly emailAddress: string;
  readonly enabled: boolean;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpSecurity: EmailSecurityMode;
  readonly smtpUsername: string;
  readonly smtpPasswordEncrypted: string;
  readonly imapHost: string;
  readonly imapPort: number;
  readonly imapSecurity: EmailSecurityMode;
  readonly imapUsername: string;
  readonly imapPasswordEncrypted: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** One email account as returned by every email-account endpoint. */
export type EmailAccountResponse = {
  readonly id: string;
  readonly name: string;
  readonly senderName: string;
  readonly emailAddress: string;
  readonly enabled: boolean;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpSecurity: EmailSecurityMode;
  readonly smtpUsername: string;
  readonly smtpPasswordConfigured: boolean;
  readonly imapHost: string;
  readonly imapPort: number;
  readonly imapSecurity: EmailSecurityMode;
  readonly imapUsername: string;
  readonly imapPasswordConfigured: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * Explicit safe mapping from a database row to the wire response.
 *
 * Every returned field is listed individually, so a credential column can
 * never leak through a spread. Only the presence booleans are derived from the
 * encrypted password columns; neither ciphertext, IV nor authentication tag is
 * part of the result.
 */
export function toEmailAccountResponse(
  row: EmailAccountRow,
): EmailAccountResponse {
  return {
    id: row.id,
    name: row.name,
    senderName: row.senderName,
    emailAddress: row.emailAddress,
    enabled: row.enabled,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecurity: row.smtpSecurity,
    smtpUsername: row.smtpUsername,
    smtpPasswordConfigured: row.smtpPasswordEncrypted.length > 0,
    imapHost: row.imapHost,
    imapPort: row.imapPort,
    imapSecurity: row.imapSecurity,
    imapUsername: row.imapUsername,
    imapPasswordConfigured: row.imapPasswordEncrypted.length > 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
