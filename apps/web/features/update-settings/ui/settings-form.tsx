'use client';

import { useActionState, useEffect, useState, type FormEvent } from 'react';

import {
  describeSettingRange,
  readSettingInput,
  toSettingInputValue,
  type SettingItem,
  type SettingsGroup,
} from '@/entities/settings/client';
import { toast } from '@/shared/lib/toast';

import { saveSettings, type SettingsFormState } from '../api/action';

const initialState: SettingsFormState = { status: 'idle' };

function initialValues(
  groups: readonly SettingsGroup[],
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const group of groups) {
    for (const item of group.items) {
      values[item.key] = toSettingInputValue(item);
    }
  }

  return values;
}

function fieldId(key: string): string {
  return `setting-${key.replace(/\./g, '-')}`;
}

function displayValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'on' : 'off';
  }

  if (value === null || value === undefined) {
    return '—';
  }

  return String(value);
}

type SettingsFormProps = {
  readonly groups: readonly SettingsGroup[];
};

/**
 * Rendered entirely from the API's registry metadata: adding a setting on the
 * server needs no field list here. Only the input control is chosen by type.
 */
export function SettingsForm({ groups }: SettingsFormProps) {
  const items = groups.flatMap((group) => group.items);
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(groups),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(
    saveSettings,
    initialState,
  );

  useEffect(() => {
    if (state.status === 'saved') {
      toast.success('Settings saved');
    } else if (state.status === 'error') {
      toast.error('Settings were not saved', {
        description: state.message,
      });
    }
  }, [state]);

  const updates: Record<string, string | number | boolean> = {};

  for (const item of items) {
    const parsed = readSettingInput(item, values[item.key] ?? '');

    if (parsed.ok) {
      updates[item.key] = parsed.value;
    }
  }

  function handleChange(key: string, value: string): void {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (current[key] === undefined) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    const nextErrors: Record<string, string> = {};

    for (const item of items) {
      const parsed = readSettingInput(item, values[item.key] ?? '');

      if (!parsed.ok) {
        nextErrors[item.key] = parsed.message;
      }
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      event.preventDefault();
      toast.error('Check the highlighted settings', {
        description: 'No values were saved.',
      });
    }
  }

  return (
    <form
      action={formAction}
      className="form"
      noValidate
      aria-busy={pending}
      onSubmit={handleSubmit}
    >
      {/* The fields are generated, so their typed values travel as one payload. */}
      <input
        type="hidden"
        name="updates"
        value={JSON.stringify(updates)}
        readOnly
      />

      {groups.map((group) => (
        <section key={group.key} className="card">
          <h2>{group.label}</h2>
          <p className="muted">{group.description}</p>

          <div className="mt-4 grid gap-5">
            {group.items.map((item) => (
              <SettingField
                key={item.key}
                item={item}
                value={values[item.key] ?? ''}
                error={fieldErrors[item.key]}
                onChange={handleChange}
              />
            ))}
          </div>
        </section>
      ))}

      {state.status === 'error' && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

type SettingFieldProps = {
  readonly item: SettingItem;
  readonly value: string;
  readonly error?: string;
  readonly onChange: (key: string, value: string) => void;
};

function SettingField({ item, value, error, onChange }: SettingFieldProps) {
  const id = fieldId(item.key);
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const range = describeSettingRange(item);
  const describedBy =
    error === undefined ? descriptionId : `${descriptionId} ${errorId}`;
  const invalid = error === undefined ? undefined : true;

  return (
    <div className="field">
      <label htmlFor={id}>{item.label}</label>
      <p className="hint" id={descriptionId}>
        {item.description}
      </p>

      {item.type === 'integer' && (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          step={1}
          min={item.min ?? undefined}
          max={item.max ?? undefined}
          value={value}
          onChange={(event) => onChange(item.key, event.target.value)}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}

      {item.type === 'string' && (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(item.key, event.target.value)}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}

      {item.type === 'boolean' && (
        <input
          id={id}
          type="checkbox"
          checked={value === 'true'}
          onChange={(event) =>
            onChange(item.key, event.target.checked ? 'true' : 'false')
          }
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}

      <p className="hint">
        Default {displayValue(item.default)}
        {range === null ? '' : ` · Allowed ${range}`}
      </p>

      {error !== undefined && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
