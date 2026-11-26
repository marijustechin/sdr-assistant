'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, type FormEvent } from 'react';

import {
  readEmailAccountForm,
  type EmailAccount,
} from '@/entities/email-account/client';
import { toast } from '@/shared/lib/toast';

import {
  createEmailAccountAction,
  updateEmailAccountAction,
  type EmailAccountFormState,
} from '../api/action';

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
 * on purpose: password inputs start empty and are never populated from an API
 * response, so no stored credential can reach the browser.
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

  return (
    <form
      action={formAction}
      className="form"
      noValidate
      aria-busy={pending}
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
            defaultValue={account?.emailAddress ?? ''}
            maxLength={320}
            autoComplete="email"
            error={errors.emailAddress}
          />

          <div className="field">
            <label htmlFor="email-account-enabled">Enabled</label>
            <input
              id="email-account-enabled"
              name="enabled"
              type="checkbox"
              className="w-auto"
              defaultChecked={account?.enabled ?? true}
            />
            <p className="hint">
              Disabled accounts are kept, but are not available for future
              communication.
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Outgoing mail (SMTP)</h2>

        <div className="mt-4 grid gap-5">
          <TextField
            id="email-account-smtp-host"
            name="smtpHost"
            label="SMTP host"
            defaultValue={account?.smtpHost ?? ''}
            maxLength={253}
            error={errors.smtpHost}
          />

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

          <TextField
            id="email-account-smtp-username"
            name="smtpUsername"
            label="SMTP username"
            defaultValue={account?.smtpUsername ?? ''}
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
        </div>
      </section>

      <section className="card">
        <h2>Incoming mail (IMAP)</h2>

        <div className="mt-4 grid gap-5">
          <TextField
            id="email-account-imap-host"
            name="imapHost"
            label="IMAP host"
            defaultValue={account?.imapHost ?? ''}
            maxLength={253}
            error={errors.imapHost}
          />

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

          <TextField
            id="email-account-imap-username"
            name="imapUsername"
            label="IMAP username"
            defaultValue={account?.imapUsername ?? ''}
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
        </div>
      </section>

      {state.status === 'error' && state.message !== undefined && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
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
        defaultValue={defaultValue}
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
