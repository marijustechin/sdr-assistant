'use server';

import { revalidatePath } from 'next/cache';

import {
  settingsUpdatesSchema,
  updateSettings as updateSettingsRequest,
  type SettingsResponse,
} from '@/entities/settings';

export type SettingsFormState =
  | { status: 'idle' }
  | { status: 'saved'; settings: SettingsResponse }
  | { status: 'error'; message: string };

/**
 * The form serialises its values into the hidden `updates` field, because the
 * fields are generated from API metadata and typed there. The API validates
 * every key and value against the registry again and names the failing key in
 * its error, which the form surfaces.
 */
export async function saveSettings(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const raw = formData.get('updates');

  if (typeof raw !== 'string' || raw.length > 10_000) {
    return {
      status: 'error',
      message: 'The form was submitted without valid settings.',
    };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    return {
      status: 'error',
      message: 'The settings payload was not valid JSON.',
    };
  }

  const parsed = settingsUpdatesSchema.safeParse(payload);

  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return {
      status: 'error',
      message: 'There are no settings to save.',
    };
  }

  const result = await updateSettingsRequest(parsed.data);

  if (!result.ok) {
    return { status: 'error', message: result.message };
  }

  revalidatePath('/settings');
  revalidatePath('/settings/research');

  return { status: 'saved', settings: result.data };
}
