export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'sdr-theme';
export const THEME_EVENT = 'sdr-theme-change';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** `system` follows the OS; an explicit choice always wins. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return preference;
}

export function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_PREFERENCE;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function storePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode or a blocked storage quota: the theme still applies for this page.
  }

  window.dispatchEvent(new Event(THEME_EVENT));
}

function systemPrefersDark(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark());

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
  }

  return resolved;
}

/** Snapshot for `useSyncExternalStore`; a primitive, so it is always stable. */
export function getPreferenceSnapshot(): ThemePreference {
  return readStoredPreference();
}

/** Server render has no storage: assume `system`. */
export function getServerPreferenceSnapshot(): ThemePreference {
  return DEFAULT_THEME_PREFERENCE;
}

/**
 * Preference changes come from this tab (`THEME_EVENT`, dispatched by
 * `storePreference`) and from other tabs (`storage`).
 */
export function subscribeToPreference(onChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      onChange();
    }
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(THEME_EVENT, onChange);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/** Calls back when the OS theme changes; returns the unsubscribe function. */
export function subscribeToSystemTheme(onChange: () => void): () => void {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return () => undefined;
  }

  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

/**
 * Runs before the first paint (rendered as the first element inside `<body>`) so
 * there is no light flash on a dark system. Keep it dependency-free and small.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('sdr-theme');
    var preference =
      stored === 'light' || stored === 'dark' ? stored : 'system';
    var prefersDark =
      preference === 'dark' ||
      (preference === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
  } catch (error) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`.trim();
