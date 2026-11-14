'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  applyTheme,
  getPreferenceSnapshot,
  getServerPreferenceSnapshot,
  storePreference,
  subscribeToPreference,
  subscribeToSystemTheme,
  type ThemePreference,
} from '../model/theme';

type ThemeOption = {
  value: ThemePreference;
  label: string;
};

const OPTIONS: readonly ThemeOption[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function ThemeIcon({ name }: { name: ThemePreference }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'light' && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}

      {name === 'dark' && (
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
      )}

      {name === 'system' && (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </>
      )}
    </svg>
  );
}

/**
 * Light / dark / system switch.
 *
 * The initial theme is applied before paint by `THEME_INIT_SCRIPT`; the stored
 * preference is read through `useSyncExternalStore`, so this component never
 * writes state from an effect. `storePreference` notifies same-tab listeners,
 * and the `storage` event covers other tabs.
 */
export function ThemeToggle() {
  const preference = useSyncExternalStore(
    subscribeToPreference,
    getPreferenceSnapshot,
    getServerPreferenceSnapshot,
  );

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') {
      return;
    }

    return subscribeToSystemTheme(() => {
      applyTheme('system');
    });
  }, [preference]);

  const choose = useCallback((value: ThemePreference) => {
    storePreference(value);
  }, []);

  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="theme-option"
          aria-pressed={preference === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => choose(option.value)}
        >
          <ThemeIcon name={option.value} />
        </button>
      ))}
    </div>
  );
}
