import type { EmailVerificationFailureCode } from '../email-accounts/email-connection.constants.js';

/**
 * One attachment as the SMTP transport needs it. The bytes come from the
 * research-owned attachment row; they are never exposed over HTTP.
 */
export type OutreachAttachment = {
  readonly filename: string;
  readonly contentType: string;
  readonly content: Uint8Array;
};

/**
 * The reusable signature block. `greeting` is the account's `signatureName`
 * column (the closing greeting) and the sender name is supplied separately from
 * the account's existing `senderName`, so no signature-only name field exists.
 */
export type OutreachSignature = {
  readonly greeting: string | null;
  readonly companyName: string | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly whatsapp: string | null;
  readonly text: string | null;
};

export type OutreachMessageInput = {
  readonly senderName: string;
  readonly senderEmail: string;
  readonly recipient: string;
  readonly subject: string;
  readonly body: string;
  readonly signature: OutreachSignature;
  readonly attachments: readonly OutreachAttachment[];
};

/**
 * A fully composed message, independent of SMTP. This is the contract future
 * first-contact sending (SDR-012) should reuse: compose once, then hand the
 * result to the transport.
 */
export type ComposedOutreachEmail = {
  readonly from: { readonly name: string; readonly address: string };
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly attachments: readonly OutreachAttachment[];
};

/**
 * Safe failure codes for a test send. The verification codes cover everything
 * that can fail before a message is accepted; `SMTP_REJECTED` means the server
 * explicitly refused the message and `SMTP_ACCEPTANCE_UNCERTAIN` means the
 * transport failed without a definitive server answer, so delivery is unknown.
 */
export type TestEmailFailureCode =
  | EmailVerificationFailureCode
  | 'SMTP_REJECTED'
  | 'SMTP_ACCEPTANCE_UNCERTAIN';

/** Safe, user-facing failure text; raw provider responses are never included. */
export function testEmailFailureMessage(
  failureCode: TestEmailFailureCode,
  smtpResponseCode?: number,
): string {
  switch (failureCode) {
    case 'AUTHENTICATION_FAILED':
      return 'The mail server rejected the saved username or password.';
    case 'CONNECTION_TIMEOUT':
      return 'The mail server did not respond in time.';
    case 'DNS_FAILURE':
      return 'The mail server host name could not be resolved.';
    case 'CONNECTION_REFUSED':
      return 'The mail server refused the connection.';
    case 'TLS_FAILURE':
      return 'TLS could not be established or the certificate was rejected.';
    case 'INVALID_CONFIGURATION':
      return 'The saved SMTP settings cannot be used for sending.';
    case 'UNSAFE_DESTINATION':
      return 'The mail server host does not resolve to a public address.';
    case 'CREDENTIAL_UNAVAILABLE':
      return 'The saved password could not be decrypted.';
    case 'CONNECTION_FAILED':
      return 'The connection to the mail server failed.';
    case 'SMTP_REJECTED':
      return smtpResponseCode === undefined
        ? 'The mail server rejected the test message.'
        : `The mail server rejected the test message (SMTP ${smtpResponseCode}).`;
    case 'SMTP_ACCEPTANCE_UNCERTAIN':
      return 'The mail server did not confirm acceptance. The message may or may not have been delivered; check the mailbox before sending another test.';
  }
}
