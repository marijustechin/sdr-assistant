// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyTheme,
  readStoredPreference,
  storePreference,
  subscribeToPreference,
  THEME_EVENT,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme';

function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

function runInitScript(): void {
  new Function(THEME_INIT_SCRIPT)();
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('theme storage', () => {
  it('falls back to system when nothing is stored', () => {
    expect(readStoredPreference()).toBe('system');
  });

  it('round-trips a stored preference and notifies listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPreference(listener);

    storePreference('dark');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredPreference()).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    storePreference('light');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readStoredPreference()).toBe('system');
  });

  it('reacts to a storage event from another tab', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPreference(listener);

    window.dispatchEvent(
      new StorageEvent('storage', { key: THEME_STORAGE_KEY }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('also notifies on its own custom event', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPreference(listener);

    window.dispatchEvent(new Event(THEME_EVENT));

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe('applyTheme', () => {
  it('writes the resolved theme to the document element', () => {
    expect(applyTheme('dark')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    expect(applyTheme('light')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('falls back to light for system when matchMedia is unavailable', () => {
    // jsdom has no matchMedia; the guard must not throw.
    expect(applyTheme('system')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  it('honours an explicit stored preference over a dark system', () => {
    stubMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    runInitScript();

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('follows a dark system when the preference is system', () => {
    stubMatchMedia(true);

    runInitScript();

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('follows a light system when the preference is system', () => {
    stubMatchMedia(false);

    runInitScript();

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('falls back to light when storage throws', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };

    try {
      runInitScript();
    } finally {
      Storage.prototype.getItem = original;
    }

    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
