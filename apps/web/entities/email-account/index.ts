export {
  createEmailAccount,
  fetchEmailAccount,
  fetchEmailAccounts,
  testEmailAccountConnection,
  updateEmailAccount,
} from './api/email-accounts.server';
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
