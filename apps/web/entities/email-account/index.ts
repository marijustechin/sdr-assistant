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
  emailAccountSignatureSchema,
  emailConnectionProtocolSchema,
  emailSecurityModeSchema,
  emailVerificationStatusSchema,
  hasSignatureContent,
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
  EmailAccountSignature,
  EmailConnectionProtocol,
  EmailSecurityMode,
  EmailVerificationStatus,
} from './model/schema';
