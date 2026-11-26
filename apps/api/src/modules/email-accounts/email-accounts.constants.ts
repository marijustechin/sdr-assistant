/**
 * Transport security supported for outgoing (SMTP) and incoming (IMAP) mail.
 * Unencrypted authentication is deliberately not representable anywhere in the
 * email-account feature: no code path accepts it and the database enum only
 * knows these two values.
 */
export const EMAIL_SECURITY_MODES = ['TLS', 'STARTTLS'] as const;

export type EmailSecurityMode = (typeof EMAIL_SECURITY_MODES)[number];
