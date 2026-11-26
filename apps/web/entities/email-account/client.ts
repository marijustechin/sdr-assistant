/**
 * Browser-safe entry point for `entities/email-account`.
 *
 * A Client Component imports this file, never the barrel: the barrel also
 * re-exports the `server-only` HTTP queries.
 */
export {
  emailAccountListSchema,
  emailAccountSchema,
  emailSecurityModeSchema,
  readEmailAccountForm,
} from './model/schema';
export type {
  EmailAccount,
  EmailAccountFormMode,
  EmailAccountFormResult,
  EmailAccountInput,
  EmailSecurityMode,
} from './model/schema';
