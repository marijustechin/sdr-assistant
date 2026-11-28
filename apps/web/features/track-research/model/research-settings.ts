import type { EmailAccount } from '@/entities/email-account/client';
import type {
  AttachmentLimits,
  ResearchAttachment,
  ResearchInitialEmail,
} from '@/entities/research/client';

/**
 * Research communication data loaded by the research page.
 *
 * Both the assignment and the account list must load for the Settings tab to
 * work; a failure is rendered inside the tab without affecting the research
 * overview, companies, market, contacts or communication queue.
 */
export type ResearchCommunicationSettingsData =
  | {
      readonly state: 'ready';
      readonly emailAccountId: string | null;
      readonly initialEmail: ResearchInitialEmail | null;
      readonly accounts: readonly EmailAccount[];
    }
  | { readonly state: 'error'; readonly message: string };

/**
 * The research-owned attachments and the active limits. Loaded independently
 * of the communication settings so an attachment failure never hides the
 * assignment or the initial email.
 */
export type ResearchAttachmentsData =
  | {
      readonly state: 'ready';
      readonly limits: AttachmentLimits;
      readonly attachments: readonly ResearchAttachment[];
    }
  | { readonly state: 'error'; readonly message: string };

export type AssignedEmailAccount =
  | { readonly state: 'assigned'; readonly account: EmailAccount }
  | { readonly state: 'missing'; readonly emailAccountId: string }
  | { readonly state: 'none' };

/**
 * Resolves the saved assignment against the complete account list, including
 * disabled accounts. A missing account is a distinct state: the assignment was
 * kept and must not be silently replaced.
 */
export function resolveAssignedEmailAccount(
  accounts: readonly EmailAccount[],
  emailAccountId: string | null,
): AssignedEmailAccount {
  if (emailAccountId === null) {
    return { state: 'none' };
  }

  const account = accounts.find((candidate) => candidate.id === emailAccountId);

  return account === undefined
    ? { state: 'missing', emailAccountId }
    : { state: 'assigned', account };
}

/** Accounts offered in the assignment select: enabled only, source order kept. */
export function assignableEmailAccounts(
  accounts: readonly EmailAccount[],
): EmailAccount[] {
  return accounts.filter((account) => account.enabled);
}
