/**
 * Injection tokens for the verification collaborators. Interfaces cannot be
 * Nest providers, so the module binds these tokens to the production adapters
 * and the tests construct the service with fakes.
 */
export const MAIL_DESTINATION_RESOLVER = 'MAIL_DESTINATION_RESOLVER';

export const SMTP_CONNECTION_VERIFIER = 'SMTP_CONNECTION_VERIFIER';

export const IMAP_CONNECTION_VERIFIER = 'IMAP_CONNECTION_VERIFIER';
