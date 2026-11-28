import type { EmailSecurityMode } from './email-accounts.constants.js';
import type { EmailVerificationStatus } from './email-connection.constants.js';

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
  readonly smtpVerificationStatus: EmailVerificationStatus;
  readonly smtpLastCheckedAt: Date | null;
  readonly smtpVerificationFailureCode: string | null;
  readonly imapVerificationStatus: EmailVerificationStatus;
  readonly imapLastCheckedAt: Date | null;
  readonly imapVerificationFailureCode: string | null;
  readonly signatureName: string | null;
  readonly signatureCompany: string | null;
  readonly signaturePhone: string | null;
  readonly signatureWebsite: string | null;
  readonly signatureWhatsapp: string | null;
  readonly signatureText: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * The reusable signature block of one account. Every field is optional; an
 * unconfigured field is `null`. Website and WhatsApp are validated HTTP(S)
 * links, so the client may render them as clickable anchors.
 */
export type EmailAccountSignature = {
  readonly name: string | null;
  readonly companyName: string | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly whatsapp: string | null;
  readonly text: string | null;
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
  readonly smtpVerificationStatus: EmailVerificationStatus;
  readonly smtpLastCheckedAt: string | null;
  readonly smtpVerificationFailureCode: string | null;
  readonly imapVerificationStatus: EmailVerificationStatus;
  readonly imapLastCheckedAt: string | null;
  readonly imapVerificationFailureCode: string | null;
  readonly signature: EmailAccountSignature;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function toIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/**
 * Explicit safe mapping from a database row to the wire response.
 *
 * Every returned field is listed individually, so a credential column can
 * never leak through a spread. Only the presence booleans are derived from the
 * encrypted password columns; neither ciphertext, IV nor authentication tag is
 * part of the result. Verification metadata is safe by construction: a status, a
 * timestamp and an enumerable failure code, never a provider response.
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
    smtpVerificationStatus: row.smtpVerificationStatus,
    smtpLastCheckedAt: toIsoString(row.smtpLastCheckedAt),
    smtpVerificationFailureCode: row.smtpVerificationFailureCode,
    imapVerificationStatus: row.imapVerificationStatus,
    imapLastCheckedAt: toIsoString(row.imapLastCheckedAt),
    imapVerificationFailureCode: row.imapVerificationFailureCode,
    signature: {
      name: row.signatureName,
      companyName: row.signatureCompany,
      phone: row.signaturePhone,
      website: row.signatureWebsite,
      whatsapp: row.signatureWhatsapp,
      text: row.signatureText,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
