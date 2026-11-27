'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  EmailAccountVerificationStatus,
  type EmailAccount,
} from '@/entities/email-account/client';
import type { ResearchInitialEmail } from '@/entities/research/client';
import { toast } from '@/shared/lib/toast';

import { updateResearchEmailAccountAction } from '../api/update-email-account-action';
import { updateResearchInitialEmailAction } from '../api/update-initial-email-action';
import {
  assignableEmailAccounts,
  resolveAssignedEmailAccount,
  type ResearchCommunicationSettingsData,
} from '../model/research-settings';

const ACCOUNTS_PATH = '/settings/email-accounts';

type ResearchSettingsProps = {
  readonly researchId: string;
  readonly communication: ResearchCommunicationSettingsData;
  readonly onEmailAccountChange: (emailAccountId: string | null) => void;
  readonly onInitialEmailChange: (initialEmail: ResearchInitialEmail) => void;
};

/**
 * Research communication settings: the email account assignment and the
 * owner-authored plain-text initial email.
 *
 * The saved assignment is resolved against the complete account list, so a
 * disabled account remains visible and removable and is never replaced
 * automatically. The initial email is restored from the server on reload and
 * shared by every prepared recipient; no personalization, rich text or
 * attachment is supported.
 */
export function ResearchSettings({
  researchId,
  communication,
  onEmailAccountChange,
  onInitialEmailChange,
}: ResearchSettingsProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState('');
  const [pending, startTransition] = useTransition();
  const [emailPending, startEmailTransition] = useTransition();

  const savedInitialEmail =
    communication.state === 'ready' ? communication.initialEmail : null;
  const [subject, setSubject] = useState(savedInitialEmail?.subject ?? '');
  const [body, setBody] = useState(savedInitialEmail?.body ?? '');

  function save(emailAccountId: string | null, message: string): void {
    startTransition(async () => {
      const result = await updateResearchEmailAccountAction(
        researchId,
        emailAccountId,
      );

      if (!result.ok) {
        toast.error('Could not update the email account assignment', {
          description: result.message,
        });
        return;
      }

      onEmailAccountChange(result.emailAccountId);
      setSelectedId('');
      toast.success(message);
    });
  }

  function saveInitialEmail(): void {
    startEmailTransition(async () => {
      const result = await updateResearchInitialEmailAction(
        researchId,
        subject,
        body,
      );

      if (!result.ok) {
        toast.error('Could not save the initial email', {
          description: result.message,
        });
        return;
      }

      setSubject(result.initialEmail.subject);
      setBody(result.initialEmail.body);
      onInitialEmailChange(result.initialEmail);
      toast.success('Initial email saved');
    });
  }

  if (communication.state === 'error') {
    return (
      <section className="card">
        <h2>Email account</h2>
        <p className="form-error" role="alert">
          Could not load the communication settings.
        </p>
        <p className="hint">{communication.message}</p>
        <div className="actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => router.refresh()}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  const current = resolveAssignedEmailAccount(
    communication.accounts,
    communication.emailAccountId,
  );
  const available = assignableEmailAccounts(communication.accounts);
  const canRemove = current.state !== 'none';
  const assignLabel =
    current.state === 'none'
      ? 'Assign an email account'
      : 'Change the assigned email account';
  const assignButtonLabel =
    current.state === 'none' ? 'Assign account' : 'Change account';
  const canSaveInitialEmail =
    !emailPending && subject.trim() !== '' && body.trim() !== '';

  return (
    <>
      <section className="card">
        <h2>Email account</h2>
        <p className="muted">
          The mailbox this research will use for communication. Credentials are
          managed in <Link href={ACCOUNTS_PATH}>Email accounts</Link>.
        </p>

        <div className="mt-4 border-t border-border pt-4">
          <p className="hint">Current assignment</p>

          {current.state === 'none' && (
            <p className="muted">
              No email account is assigned to this research.
            </p>
          )}

          {current.state === 'missing' && (
            <>
              <p className="form-error" role="alert">
                The assigned email account is no longer available.
              </p>
              <p className="hint">
                The saved assignment was kept. Choose another enabled account or
                remove it.
              </p>
            </>
          )}

          {current.state === 'assigned' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <strong>{current.account.name}</strong>
                <span
                  className={
                    current.account.enabled ? 'status ok' : 'status muted'
                  }
                >
                  <span className="dot" aria-hidden="true" />
                  {current.account.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="muted">{current.account.emailAddress}</p>

              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                <EmailAccountVerificationStatus
                  protocol="SMTP"
                  status={current.account.smtpVerificationStatus}
                  lastCheckedAt={current.account.smtpLastCheckedAt}
                  failureCode={current.account.smtpVerificationFailureCode}
                />
                <EmailAccountVerificationStatus
                  protocol="IMAP"
                  status={current.account.imapVerificationStatus}
                  lastCheckedAt={current.account.imapLastCheckedAt}
                  failureCode={current.account.imapVerificationFailureCode}
                />
              </div>

              {!current.account.enabled && (
                <p className="hint mt-2">
                  This account is disabled. It stays assigned until you change
                  or remove it; enable it in Email accounts before communication
                  is possible.
                </p>
              )}
            </>
          )}

          {canRemove && (
            <div className="actions">
              <button
                type="button"
                className="button small secondary"
                disabled={pending}
                aria-busy={pending}
                onClick={() => {
                  save(null, 'Email account assignment removed');
                }}
              >
                Remove assignment
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-border pt-4">
          {available.length === 0 ? (
            <p className="hint">
              {communication.accounts.length === 0
                ? 'No email accounts are configured yet. '
                : 'No enabled email accounts are available. '}
              <Link href={ACCOUNTS_PATH}>Manage email accounts</Link>.
            </p>
          ) : (
            <div className="field">
              <label htmlFor="research-email-account">{assignLabel}</label>
              <select
                id="research-email-account"
                value={selectedId}
                disabled={pending}
                onChange={(event) => setSelectedId(event.currentTarget.value)}
              >
                <option value="">Select an enabled email account</option>
                {available.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} — {account.emailAddress}
                  </option>
                ))}
              </select>
              <p className="hint">
                Only enabled accounts can be assigned. The current account stays
                assigned until you save a change.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="button"
                  disabled={pending || selectedId === ''}
                  aria-busy={pending}
                  onClick={() => {
                    const selected = available.find(
                      (account: EmailAccount) => account.id === selectedId,
                    );

                    if (selected === undefined) {
                      return;
                    }

                    save(
                      selected.id,
                      current.state === 'none'
                        ? 'Email account assigned'
                        : 'Email account changed',
                    );
                  }}
                >
                  {pending ? 'Saving…' : assignButtonLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Initial email</h2>
        <p className="muted">
          The same plain-text message will later be sent individually to each
          prepared recipient.
        </p>

        <div className="field">
          <label htmlFor="research-initial-email-subject">Subject</label>
          <input
            id="research-initial-email-subject"
            type="text"
            value={subject}
            maxLength={300}
            disabled={emailPending}
            onChange={(event) => setSubject(event.currentTarget.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="research-initial-email-body">Message</label>
          <textarea
            id="research-initial-email-body"
            rows={10}
            value={body}
            maxLength={20_000}
            disabled={emailPending}
            onChange={(event) => setBody(event.currentTarget.value)}
          />
        </div>

        <p className="hint">
          Plain text only. Subject and message are required and are saved in the
          research communication settings.
        </p>

        <div className="actions">
          <button
            type="button"
            className="button"
            disabled={!canSaveInitialEmail}
            aria-busy={emailPending}
            onClick={saveInitialEmail}
          >
            {emailPending ? 'Saving…' : 'Save initial email'}
          </button>
        </div>
      </section>
    </>
  );
}
