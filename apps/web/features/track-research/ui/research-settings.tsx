'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import {
  EmailAccountVerificationStatus,
  hasSignatureContent,
  type EmailAccount,
} from '@/entities/email-account/client';
import type {
  ResearchAttachment,
  ResearchInitialEmail,
  TestEmailSendResult,
} from '@/entities/research/client';
import { toast } from '@/shared/lib/toast';

import {
  removeResearchAttachmentAction,
  uploadResearchAttachmentAction,
} from '../api/attachment-actions';
import { sendTestEmailAction } from '../api/send-test-email-action';
import { updateResearchEmailAccountAction } from '../api/update-email-account-action';
import { updateResearchInitialEmailAction } from '../api/update-initial-email-action';
import {
  checkAttachmentSelection,
  formatAttachmentSize,
} from '../model/initial-email-preview';
import {
  assignableEmailAccounts,
  resolveAssignedEmailAccount,
  type ResearchAttachmentsData,
  type ResearchCommunicationSettingsData,
} from '../model/research-settings';
import { parseTestRecipient } from '../model/test-email';
import { InitialEmailPreview, SignatureBlock } from './initial-email-preview';

const ACCOUNTS_PATH = '/settings/email-accounts';

type ResearchSettingsProps = {
  readonly researchId: string;
  readonly communication: ResearchCommunicationSettingsData;
  readonly attachments: ResearchAttachmentsData;
  readonly onEmailAccountChange: (emailAccountId: string | null) => void;
  readonly onInitialEmailChange: (initialEmail: ResearchInitialEmail) => void;
  readonly onAttachmentsChange: (
    attachments: readonly ResearchAttachment[],
  ) => void;
};

/**
 * Research communication settings: the email account assignment, the
 * owner-authored plain-text initial email, the assigned account's reusable
 * signature, the research-owned attachments and a complete email preview.
 *
 * The signature is defined on the email account and reused here. Attachments
 * belong to the research and only their metadata reaches this view: the API
 * never returns file bytes. Nothing in this tab sends email or touches a
 * mailbox.
 */
export function ResearchSettings({
  researchId,
  communication,
  attachments,
  onEmailAccountChange,
  onInitialEmailChange,
  onAttachmentsChange,
}: ResearchSettingsProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState('');
  const [pending, startTransition] = useTransition();
  const [emailPending, startEmailTransition] = useTransition();
  const [uploadPending, startUploadTransition] = useTransition();
  const [removePending, startRemoveTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testRecipientError, setTestRecipientError] = useState<string | null>(
    null,
  );
  const [testRequestError, setTestRequestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestEmailSendResult | null>(
    null,
  );
  const [testPending, startTestTransition] = useTransition();
  // A transition state update is asynchronous; this guard makes a double click
  // synchronously impossible.
  const testInFlight = useRef(false);

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

  function selectFile(file: File | null): void {
    setSelectedFile(file);
  }

  function uploadAttachment(): void {
    if (selectedFile === null || attachments.state !== 'ready') {
      return;
    }

    const check = checkAttachmentSelection(
      attachments.attachments,
      attachments.limits,
      selectedFile.size,
    );

    if (!check.ok) {
      toast.error('The attachment was not uploaded', {
        description: check.message,
      });
      return;
    }

    const file = selectedFile;

    startUploadTransition(async () => {
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadResearchAttachmentAction(researchId, formData);

      if (!result.ok) {
        toast.error('The attachment was not uploaded', {
          description: result.message,
        });
        return;
      }

      onAttachmentsChange([...attachments.attachments, result.attachment]);
      setSelectedFile(null);

      if (fileInputRef.current !== null) {
        fileInputRef.current.value = '';
      }

      toast.success('Attachment uploaded');
    });
  }

  function removeAttachment(attachment: ResearchAttachment): void {
    if (attachments.state !== 'ready') {
      return;
    }

    setRemovingId(attachment.id);
    startRemoveTransition(async () => {
      const result = await removeResearchAttachmentAction(
        researchId,
        attachment.id,
      );

      setRemovingId(null);

      if (!result.ok) {
        toast.error('The attachment was not removed', {
          description: result.message,
        });
        return;
      }

      onAttachmentsChange(
        attachments.attachments.filter((item) => item.id !== attachment.id),
      );
      toast.success('Attachment removed');
    });
  }

  function openTestEmail(): void {
    setTestEmailOpen(true);
    setTestRecipientError(null);
    setTestRequestError(null);
    setTestResult(null);
  }

  function cancelTestEmail(): void {
    if (testPending) {
      return;
    }

    setTestEmailOpen(false);
    setTestRecipient('');
    setTestRecipientError(null);
    setTestRequestError(null);
    setTestResult(null);
  }

  function sendTestEmail(): void {
    if (testInFlight.current || testPending) {
      return;
    }

    const parsed = parseTestRecipient(testRecipient);

    if (!parsed.ok) {
      setTestRecipientError(parsed.message);
      return;
    }

    setTestRecipientError(null);
    setTestRequestError(null);
    setTestResult(null);
    testInFlight.current = true;

    startTestTransition(async () => {
      try {
        const result = await sendTestEmailAction(researchId, parsed.recipient);

        if (!result.ok) {
          setTestRequestError(result.message);
          return;
        }

        setTestResult(result.result);
      } finally {
        testInFlight.current = false;
      }
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
  const signature =
    current.state === 'assigned' ? current.account.signature : null;
  const senderName =
    current.state === 'assigned' ? current.account.senderName : null;
  const hasSignature = signature !== null && hasSignatureContent(signature);
  const attachmentItems =
    attachments.state === 'ready' ? attachments.attachments : [];
  const canUploadAttachment =
    !uploadPending && selectedFile !== null && attachments.state === 'ready';
  // Sending is only possible from a saved composition: the API composes from
  // the stored subject/body, not from unsaved form state.
  const compositionDirty =
    savedInitialEmail === null ||
    subject !== savedInitialEmail.subject ||
    body !== savedInitialEmail.body;
  const testEmailBlockedReason = compositionDirty
    ? 'Save the initial email before sending a test.'
    : current.state !== 'assigned'
      ? 'Assign an email account to send a test.'
      : !current.account.enabled
        ? 'Enable the assigned email account to send a test.'
        : attachments.state !== 'ready'
          ? 'Attachments must be available before sending a test.'
          : null;
  const canSendTestEmail = testEmailBlockedReason === null && !testPending;

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
          prepared recipient, followed by the assigned account&apos;s signature
          and this research&apos;s attachments.
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

        <div className="mt-4 border-t border-border pt-4">
          <h3 className="preview-heading">Signature</h3>

          {current.state === 'assigned' ? (
            hasSignature && signature !== null ? (
              <>
                <p className="hint">
                  Reused from {current.account.name}. It is appended to this
                  research&apos;s email.
                </p>
                <SignatureBlock signature={signature} senderName={senderName} />
              </>
            ) : (
              <>
                <p className="muted">
                  The assigned email account has no signature configured.
                </p>
                <p className="hint">
                  <Link
                    href={`/settings/email-accounts/${encodeURIComponent(
                      current.account.id,
                    )}/edit`}
                  >
                    Add a signature
                  </Link>{' '}
                  to include it in the email.
                </p>
              </>
            )
          ) : (
            <p className="muted">
              Assign an email account to reuse its signature in this email.
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <h3 className="preview-heading">Attachments</h3>
          <p className="hint">
            Attachments belong to this research, not to the email account, and
            are stored privately. They are never sent automatically; an explicit
            test send includes them.
          </p>

          {attachments.state === 'error' ? (
            <>
              <p className="form-error" role="alert">
                Could not load the attachments.
              </p>
              <p className="hint">{attachments.message}</p>
              <div className="actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => router.refresh()}
                >
                  Try again
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="research-attachment-file">
                  Attachment file
                </label>
                <input
                  id="research-attachment-file"
                  ref={fileInputRef}
                  type="file"
                  disabled={uploadPending}
                  onChange={(event) =>
                    selectFile(event.currentTarget.files?.[0] ?? null)
                  }
                />
                <p className="hint">
                  Up to {attachments.limits.maxAttachments} files,{' '}
                  {formatAttachmentSize(attachments.limits.maxFileBytes)} each
                  and {formatAttachmentSize(attachments.limits.maxTotalBytes)}{' '}
                  in total.
                </p>
                {selectedFile !== null && (
                  <p className="hint">
                    Selected: {selectedFile.name} ·{' '}
                    {formatAttachmentSize(selectedFile.size)}
                  </p>
                )}
              </div>

              <div className="actions">
                <button
                  type="button"
                  className="button"
                  disabled={!canUploadAttachment}
                  aria-busy={uploadPending}
                  onClick={uploadAttachment}
                >
                  {uploadPending ? 'Uploading…' : 'Upload attachment'}
                </button>
              </div>

              {attachmentItems.length === 0 ? (
                <p className="muted">No attachments yet.</p>
              ) : (
                <ul className="attachment-list">
                  {attachmentItems.map((attachment) => (
                    <li key={attachment.id} className="attachment-row">
                      <span className="attachment-name">
                        {attachment.filename}
                      </span>
                      <span className="muted">
                        {formatAttachmentSize(attachment.sizeBytes)}
                      </span>
                      <button
                        type="button"
                        className="button small secondary"
                        aria-label={`Remove ${attachment.filename}`}
                        disabled={removePending}
                        aria-busy={removingId === attachment.id}
                        onClick={() => removeAttachment(attachment)}
                      >
                        {removingId === attachment.id ? 'Removing…' : 'Remove'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <h3 className="preview-heading">Preview</h3>
          <p className="hint">
            The complete initial email: message, signature and attachment list.
            Preview only; a test email is sent only when you explicitly request
            it below.
          </p>

          <InitialEmailPreview
            subject={subject}
            body={body}
            signature={hasSignature ? signature : null}
            senderName={senderName}
            attachments={attachmentItems}
          />

          <div className="send-test-email">
            <div className="actions">
              <button
                type="button"
                className="button"
                disabled={!canSendTestEmail}
                onClick={openTestEmail}
              >
                Send test email
              </button>
            </div>

            {testEmailBlockedReason !== null && (
              <p className="hint">{testEmailBlockedReason}</p>
            )}

            {testEmailOpen && (
              <>
                <p className="hint">
                  Sends exactly one test message through the assigned account.
                  It is not added to the recipient queue and does not count
                  towards first-contact statistics.
                </p>

                <div className="field">
                  <label htmlFor="research-test-email-recipient">
                    Test recipient
                  </label>
                  <input
                    id="research-test-email-recipient"
                    type="email"
                    value={testRecipient}
                    maxLength={320}
                    autoComplete="email"
                    disabled={testPending}
                    aria-invalid={testRecipientError !== null}
                    aria-describedby={
                      testRecipientError === null
                        ? undefined
                        : 'research-test-email-recipient-error'
                    }
                    onChange={(event) => {
                      setTestRecipient(event.currentTarget.value);

                      if (testRecipientError !== null) {
                        setTestRecipientError(null);
                      }
                    }}
                  />
                  {testRecipientError !== null && (
                    <p
                      className="field-error"
                      id="research-test-email-recipient-error"
                    >
                      {testRecipientError}
                    </p>
                  )}
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="button"
                    disabled={!canSendTestEmail}
                    aria-busy={testPending}
                    onClick={sendTestEmail}
                  >
                    {testPending ? 'Sending…' : 'Send test'}
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={testPending}
                    onClick={cancelTestEmail}
                  >
                    Cancel
                  </button>
                </div>

                {testPending && (
                  <p className="hint" role="status" aria-live="polite">
                    Sending test email…
                  </p>
                )}

                {testRequestError !== null && (
                  <p className="form-error" role="alert">
                    {testRequestError}
                  </p>
                )}

                {testResult !== null && testResult.outcome === 'SENT' && (
                  <p className="status ok" role="status" aria-live="polite">
                    <span className="dot" aria-hidden="true" />
                    Test email sent to {testResult.recipient}.
                  </p>
                )}

                {testResult !== null && testResult.outcome === 'FAILED' && (
                  <p className="form-error" role="alert">
                    {testResult.message}
                  </p>
                )}

                {testResult !== null && !testResult.recorded && (
                  <p className="hint">
                    The attempt could not be recorded in the database.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
