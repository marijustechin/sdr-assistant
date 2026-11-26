'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from 'react';

import {
  readEmailAccountForm,
  type EmailAccount,
  type EmailConnectionProtocol,
} from '@/entities/email-account/client';
import { toast } from '@/shared/lib/toast';

import {
  createEmailAccountAction,
  testEmailAccountConnectionAction,
  updateEmailAccountAction,
  type EmailAccountFormState,
} from '../api/action';
import { notifyConnectionTestSummary } from '../model/connection-test-feedback';
import { EmailAccountVerificationStatus } from './email-account-verification-status';

const initialState: EmailAccountFormState = { status: 'idle' };

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SMTP_SECURITY = 'STARTTLS';
const DEFAULT_IMAP_PORT = 993;
const DEFAULT_IMAP_SECURITY = 'TLS';

const ACCOUNTS_PATH = '/settings/email-accounts';

export type EmailAccountFormProps =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly account: EmailAccount };

function passwordHint(
  label: 'SMTP' | 'IMAP',
  mode: 'create' | 'edit',
  configured: boolean,
): string {
  if (mode === 'create') {
    return `The ${label} password is stored encrypted and never displayed again.`;
  }

  return configured
    ? `The ${label} password is configured. Leave this field empty to keep it.`
    : `No ${label} password is configured. Enter one to store it.`;
}

/**
 * The same form composes both account creation and editing. It is uncontrolled
 * on purpose for every field except the email address and the two usernames:
 * password inputs start empty and are never populated from an API response, so
 * no stored credential can reach the browser.
 *
 * On creation only, changing the email address proposes it as both usernames
 * while each username field still matches the user's own edits. Editing an
 * existing account never rewrites its usernames.
 */
export function EmailAccountForm(props: EmailAccountFormProps) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';
  const account = props.mode === 'edit' ? props.account : null;
  const action: (
    state: EmailAccountFormState,
    formData: FormData,
  ) => Promise<EmailAccountFormState> = isEdit
    ? updateEmailAccountAction
    : createEmailAccountAction;
  const [state, formAction, pending] = useActionState<
    EmailAccountFormState,
    FormData
  >(action, initialState);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [emailAddress, setEmailAddress] = useState(account?.emailAddress ?? '');
  const [smtpUsername, setSmtpUsername] = useState(account?.smtpUsername ?? '');
  const [imapUsername, setImapUsername] = useState(account?.imapUsername ?? '');
  // In edit mode the saved usernames are already user-owned values: changing
  // the email address must never rewrite them.
  const [smtpUsernameCustom, setSmtpUsernameCustom] = useState(isEdit);
  const [imapUsernameCustom, setImapUsernameCustom] = useState(isEdit);
  const [dirty, setDirty] = useState(false);
  const [testing, setTesting] = useState<EmailConnectionProtocol | null>(null);
  const [testPending, startTestTransition] = useTransition();

  useEffect(() => {
    if (state.status === 'saved') {
      toast.success(state.message);
      router.push(ACCOUNTS_PATH);
    } else if (state.status === 'error' && state.message !== undefined) {
      toast.error('The email account was not saved', {
        description: state.message,
      });
    }
  }, [state, router]);

  const serverErrors =
    state.status === 'error' && state.fieldErrors !== undefined
      ? state.fieldErrors
      : {};
  const errors: Record<string, string> = {
    ...serverErrors,
    ...clientErrors,
  };

  const smtpPasswordHint = passwordHint(
    'SMTP',
    props.mode,
    account?.smtpPasswordConfigured ?? false,
  );
  const imapPasswordHint = passwordHint(
    'IMAP',
    props.mode,
    account?.imapPasswordConfigured ?? false,
  );

  const testUnavailableReason =
    account === null
      ? 'Save this account before testing the connections.'
      : !account.enabled
        ? 'Enable the account before testing the connections.'
        : dirty
          ? 'Save your changes before testing the connections.'
          : null;
  const testDisabled =
    account === null || !account.enabled || dirty || testPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    const result = readEmailAccountForm(
      new FormData(event.currentTarget),
      props.mode,
    );

    if (result.ok) {
      setClientErrors({});
      return;
    }

    event.preventDefault();
    setClientErrors(result.fieldErrors);
    toast.error('Check the highlighted fields', {
      description: 'The email account was not saved.',
    });
  }

  function handleEmailChange(value: string): void {
    setEmailAddress(value);
    setDirty(true);

    if (account !== null) {
      return;
    }

    const derived = value.trim();

    if (!smtpUsernameCustom) {
      setSmtpUsername(derived);
    }

    if (!imapUsernameCustom) {
      setImapUsername(derived);
    }
  }

  function handleSmtpUsernameChange(value: string): void {
    setSmtpUsername(value);
    setSmtpUsernameCustom(true);
    setDirty(true);
  }

  function handleImapUsernameChange(value: string): void {
    setImapUsername(value);
    setImapUsernameCustom(true);
    setDirty(true);
  }

  function runProtocolTest(protocol: EmailConnectionProtocol): void {
    if (account === null || testDisabled) {
      return;
    }

    startTestTransition(async () => {
      setTesting(protocol);

      try {
        const summary = await testEmailAccountConnectionAction(
          account.id,
          protocol,
        );

        notifyConnectionTestSummary(summary);

        // The saved verification result is server data: refresh this route so
        // the displayed result belongs to the configuration that was tested.
        router.refresh();
      } finally {
        setTesting(null);
      }
    });
  }

  return (
    <form
      action={formAction}
      className="form"
      noValidate
      aria-busy={pending || testPending}
      onChange={() => setDirty(true)}
      onSubmit={handleSubmit}
    >
      {account !== null && <input type="hidden" name="id" value={account.id} />}

      <section className="card">
        <h2>General</h2>

        <div className="mt-4 grid gap-5">
          <TextField
            id="email-account-name"
            name="name"
            label="Account name"
            defaultValue={account?.name ?? ''}
            maxLength={200}
            error={errors.name}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="email-account-sender-name"
              name="senderName"
              label="Sender name"
              defaultValue={account?.senderName ?? ''}
              maxLength={200}
              error={errors.senderName}
            />

            <TextField
              id="email-account-email-address"
              name="emailAddress"
              label="Email address"
              type="email"
              value={emailAddress}
              onChange={handleEmailChange}
              maxLength={320}
              autoComplete="email"
              error={errors.emailAddress}
            />
          </div>

          <div className="field">
            <div className="flex items-center gap-2">
              <input
                id="email-account-enabled"
                name="enabled"
                type="checkbox"
                className="w-auto"
                defaultChecked={account?.enabled ?? true}
              />
              <label htmlFor="email-account-enabled">Enabled</label>
            </div>
            <p className="hint">
              Disabled accounts are kept, but are not available for future
              communication.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card mt-0">
          <h2>Outgoing mail (SMTP)</h2>

          <div className="mt-4 grid gap-4">
            <TextField
              id="email-account-smtp-host"
              name="smtpHost"
              label="SMTP host"
              defaultValue={account?.smtpHost ?? ''}
              maxLength={253}
              error={errors.smtpHost}
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="email-account-smtp-port"
                name="smtpPort"
                label="SMTP port"
                type="number"
                inputMode="numeric"
                min={1}
                max={65535}
                defaultValue={account?.smtpPort ?? DEFAULT_SMTP_PORT}
                error={errors.smtpPort}
              />

              <SelectField
                id="email-account-smtp-security"
                name="smtpSecurity"
                label="SMTP security"
                defaultValue={account?.smtpSecurity ?? DEFAULT_SMTP_SECURITY}
                error={errors.smtpSecurity}
              />
            </div>

            <TextField
              id="email-account-smtp-username"
              name="smtpUsername"
              label="SMTP username"
              value={smtpUsername}
              onChange={handleSmtpUsernameChange}
              maxLength={320}
              autoComplete="username"
              error={errors.smtpUsername}
            />

            <TextField
              id="email-account-smtp-password"
              name="smtpPassword"
              label="SMTP password"
              type="password"
              autoComplete="new-password"
              hint={smtpPasswordHint}
              error={errors.smtpPassword}
            />

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="hint">Saved verification result</p>

              {account === null ? (
                <p className="hint">Not tested yet.</p>
              ) : (
                <EmailAccountVerificationStatus
                  protocol="SMTP"
                  status={account.smtpVerificationStatus}
                  lastCheckedAt={account.smtpLastCheckedAt}
                  failureCode={account.smtpVerificationFailureCode}
                />
              )}

              <div className="actions">
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() => runProtocolTest('SMTP')}
                  disabled={testDisabled || testing !== null}
                  aria-busy={testing === 'SMTP'}
                  title={testUnavailableReason ?? undefined}
                >
                  {testing === 'SMTP'
                    ? 'Testing SMTP…'
                    : 'Test SMTP connection'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card mt-0">
          <h2>Incoming mail (IMAP)</h2>

          <div className="mt-4 grid gap-4">
            <TextField
              id="email-account-imap-host"
              name="imapHost"
              label="IMAP host"
              defaultValue={account?.imapHost ?? ''}
              maxLength={253}
              error={errors.imapHost}
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="email-account-imap-port"
                name="imapPort"
                label="IMAP port"
                type="number"
                inputMode="numeric"
                min={1}
                max={65535}
                defaultValue={account?.imapPort ?? DEFAULT_IMAP_PORT}
                error={errors.imapPort}
              />

              <SelectField
                id="email-account-imap-security"
                name="imapSecurity"
                label="IMAP security"
                defaultValue={account?.imapSecurity ?? DEFAULT_IMAP_SECURITY}
                error={errors.imapSecurity}
              />
            </div>

            <TextField
              id="email-account-imap-username"
              name="imapUsername"
              label="IMAP username"
              value={imapUsername}
              onChange={handleImapUsernameChange}
              maxLength={320}
              autoComplete="username"
              error={errors.imapUsername}
            />

            <TextField
              id="email-account-imap-password"
              name="imapPassword"
              label="IMAP password"
              type="password"
              autoComplete="new-password"
              hint={imapPasswordHint}
              error={errors.imapPassword}
            />

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="hint">Saved verification result</p>

              {account === null ? (
                <p className="hint">Not tested yet.</p>
              ) : (
                <EmailAccountVerificationStatus
                  protocol="IMAP"
                  status={account.imapVerificationStatus}
                  lastCheckedAt={account.imapLastCheckedAt}
                  failureCode={account.imapVerificationFailureCode}
                />
              )}

              <div className="actions">
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() => runProtocolTest('IMAP')}
                  disabled={testDisabled || testing !== null}
                  aria-busy={testing === 'IMAP'}
                  title={testUnavailableReason ?? undefined}
                >
                  {testing === 'IMAP'
                    ? 'Testing IMAP…'
                    : 'Test IMAP connection'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {state.status === 'error' && state.message !== undefined && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      {testUnavailableReason !== null && (
        <p className="hint">{testUnavailableReason}</p>
      )}

      <div className="actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Saving…' : 'Save account'}
        </button>
        <Link href={ACCOUNTS_PATH} className="button secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

type TextFieldProps = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly type?: 'text' | 'email' | 'password' | 'number';
  readonly defaultValue?: string | number;
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly inputMode?: 'numeric';
  readonly autoComplete?: string;
  readonly min?: number;
  readonly max?: number;
  readonly maxLength?: number;
  readonly hint?: string;
  readonly error?: string;
};

function TextField({
  id,
  name,
  label,
  type = 'text',
  defaultValue,
  value,
  onChange,
  inputMode,
  autoComplete,
  min,
  max,
  maxLength,
  hint,
  error,
}: TextFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    hint !== undefined && error !== undefined
      ? `${hintId} ${errorId}`
      : hint !== undefined
        ? hintId
        : error !== undefined
          ? errorId
          : undefined;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={onChange === undefined ? undefined : value}
        defaultValue={onChange === undefined ? defaultValue : undefined}
        onChange={
          onChange === undefined
            ? undefined
            : (event) => {
                if (onChange !== undefined) {
                  onChange(event.currentTarget.value);
                }
              }
        }
        inputMode={inputMode}
        autoComplete={autoComplete}
        min={min}
        max={max}
        maxLength={maxLength}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy}
      />
      {hint !== undefined && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

type SelectFieldProps = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly error?: string;
};

function SelectField({
  id,
  name,
  label,
  defaultValue,
  error,
}: SelectFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
      >
        <option value="TLS">TLS</option>
        <option value="STARTTLS">STARTTLS</option>
      </select>
      {error !== undefined && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
