'use server';

import { revalidatePath } from 'next/cache';

import {
  createEmailAccount as createEmailAccountRequest,
  readEmailAccountForm,
  updateEmailAccount as updateEmailAccountRequest,
} from '@/entities/email-account';

export type EmailAccountFormState =
  | { status: 'idle' }
  | { status: 'saved'; message: string }
  | {
      status: 'error';
      message?: string;
      fieldErrors?: Record<string, string>;
    };

export type EmailAccountToggleResult =
  { ok: true } | { ok: false; message: string };

const ACCOUNTS_PATH = '/settings/email-accounts';

function readId(formData: FormData): string | null {
  const value = formData.get('id');

  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * The form carries no typed state: the action reads the same fields the form
 * rendered and validates them again with the shared reader. The API validates
 * once more, so an invalid account is rejected even if a client is bypassed.
 */
export async function createEmailAccountAction(
  _previousState: EmailAccountFormState,
  formData: FormData,
): Promise<EmailAccountFormState> {
  const parsed = readEmailAccountForm(formData, 'create');

  if (!parsed.ok) {
    return { status: 'error', fieldErrors: parsed.fieldErrors };
  }

  const result = await createEmailAccountRequest(parsed.input);

  if (!result.ok) {
    return { status: 'error', message: result.message };
  }

  revalidatePath(ACCOUNTS_PATH);

  return { status: 'saved', message: 'Email account created' };
}

export async function updateEmailAccountAction(
  _previousState: EmailAccountFormState,
  formData: FormData,
): Promise<EmailAccountFormState> {
  const id = readId(formData);

  if (id === null) {
    return {
      status: 'error',
      message: 'The email account could not be identified.',
    };
  }

  const parsed = readEmailAccountForm(formData, 'edit');

  if (!parsed.ok) {
    return { status: 'error', fieldErrors: parsed.fieldErrors };
  }

  const result = await updateEmailAccountRequest(id, parsed.input);

  if (!result.ok) {
    return { status: 'error', message: result.message };
  }

  revalidatePath(ACCOUNTS_PATH);

  return { status: 'saved', message: 'Email account updated' };
}

/** Enable/disable from the list. Only the status column is written. */
export async function setEmailAccountEnabled(
  id: string,
  enabled: boolean,
): Promise<EmailAccountToggleResult> {
  const result = await updateEmailAccountRequest(id, { enabled });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath(ACCOUNTS_PATH);

  return { ok: true };
}
