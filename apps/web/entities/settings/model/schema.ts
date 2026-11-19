import { z } from 'zod';

/**
 * Wire contract of `GET /settings` and `PATCH /settings`.
 *
 * The API owns the registry: groups, labels, types, bounds and defaults all
 * come from the server. The form is rendered from this metadata, so adding a
 * setting needs no change here.
 */

export const settingTypeSchema = z.enum(['integer', 'string', 'boolean']);

export type SettingType = z.infer<typeof settingTypeSchema>;

export const settingItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  type: settingTypeSchema,
  /** Already validated by the API against the registry. */
  value: z.unknown(),
  default: z.unknown(),
  min: z.number().nullable(),
  max: z.number().nullable(),
});

export type SettingItem = z.infer<typeof settingItemSchema>;

export const settingsGroupSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  items: z.array(settingItemSchema),
});

export type SettingsGroup = z.infer<typeof settingsGroupSchema>;

export const settingsResponseSchema = z.object({
  groups: z.array(settingsGroupSchema),
});

export type SettingsResponse = z.infer<typeof settingsResponseSchema>;

/** Request body of `PATCH /settings`: one record of key → value. */
export const settingsUpdatesSchema = z.record(z.string().min(1), z.unknown());

export type SettingInputValue = string | number | boolean;

export type SettingInput =
  { ok: true; value: SettingInputValue } | { ok: false; message: string };

/** Renders an API value into the controlled string the form keeps. */
export function toSettingInputValue(item: SettingItem): string {
  if (typeof item.value === 'boolean') {
    return item.value ? 'true' : 'false';
  }

  if (typeof item.value === 'string') {
    return item.value;
  }

  if (typeof item.value === 'number') {
    return String(item.value);
  }

  return '';
}

/** Human range hint, or `null` when the type has no bounds. */
export function describeSettingRange(item: SettingItem): string | null {
  if (item.min !== null && item.max !== null) {
    return `${item.min}–${item.max}`;
  }

  if (item.min !== null) {
    return `at least ${item.min}`;
  }

  if (item.max !== null) {
    return `at most ${item.max}`;
  }

  return null;
}

/**
 * Validates one form value against the metadata returned by the API.
 * This is the client-side half of the validation; the API validates again
 * against the same registry and its error is surfaced in the form.
 */
export function readSettingInput(item: SettingItem, raw: string): SettingInput {
  switch (item.type) {
    case 'integer': {
      const trimmed = raw.trim();

      if (trimmed === '') {
        return { ok: false, message: `${item.label} is required.` };
      }

      if (!/^-?\d+$/.test(trimmed)) {
        return { ok: false, message: `${item.label} must be a whole number.` };
      }

      const value = Number(trimmed);

      if (!Number.isSafeInteger(value)) {
        return { ok: false, message: `${item.label} is too large.` };
      }

      if (item.min !== null && value < item.min) {
        return {
          ok: false,
          message: `${item.label} must be at least ${item.min}.`,
        };
      }

      if (item.max !== null && value > item.max) {
        return {
          ok: false,
          message: `${item.label} must be at most ${item.max}.`,
        };
      }

      return { ok: true, value };
    }

    case 'string': {
      if (raw.trim() === '') {
        return { ok: false, message: `${item.label} is required.` };
      }

      return { ok: true, value: raw };
    }

    case 'boolean': {
      if (raw === 'true') {
        return { ok: true, value: true };
      }

      if (raw === 'false') {
        return { ok: true, value: false };
      }

      return { ok: false, message: `${item.label} must be true or false.` };
    }

    default: {
      const exhaustive: never = item.type;
      return {
        ok: false,
        message: `Unsupported setting type: ${String(exhaustive)}`,
      };
    }
  }
}
