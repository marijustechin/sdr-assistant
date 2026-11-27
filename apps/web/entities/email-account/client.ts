/**
 * Browser-safe entry point for `entities/email-account`.
 *
 * A Client Component imports this file, never the barrel: the barrel also
 * re-exports the `server-only` HTTP queries.
 */
export {
  connectionVerificationResultSchema,
  describeVerificationFailure,
  emailAccountListSchema,
  emailAccountSchema,
  emailConnectionProtocolSchema,
  emailSecurityModeSchema,
  emailVerificationStatusSchema,
  readEmailAccountForm,
  verificationStatusLabel,
} from './model/schema';
export { EmailAccountVerificationStatus } from './ui/email-account-verification-status';
export type {
  ConnectionVerificationResult,
  EmailAccount,
  EmailAccountFormMode,
  EmailAccountFormResult,
  EmailAccountInput,
  EmailConnectionProtocol,
  EmailSecurityMode,
  EmailVerificationStatus,
} from './model/schema';
