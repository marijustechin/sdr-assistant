export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
  /** `0` keeps the toast until it is dismissed. */
  durationMs: number;
};

export type ToastOptions = {
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  durationMs?: number;
};

const MAX_TOASTS = 4;

/** How long a toast stays before it dismisses itself. */
const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  info: 6_000,
  success: 6_000,
  warning: 10_000,
  error: 12_000,
};

const EMPTY_TOASTS: readonly Toast[] = [];

let toasts: readonly Toast[] = EMPTY_TOASTS;
let sequence = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setToasts(next: readonly Toast[]): void {
  toasts = next;
  emit();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Snapshot for `useSyncExternalStore`. The array reference only changes when the
 * list changes, which is what the hook requires.
 */
export function getToasts(): readonly Toast[] {
  return toasts;
}

/** No toasts during server rendering, so hydration always matches. */
export function getServerToasts(): readonly Toast[] {
  return EMPTY_TOASTS;
}

export function pushToast(title: string, options: ToastOptions = {}): string {
  const variant = options.variant ?? 'info';
  const id = `toast-${++sequence}`;

  const toast: Toast = {
    id,
    title,
    variant,
    description: options.description,
    action: options.action,
    durationMs: options.durationMs ?? DEFAULT_DURATIONS[variant],
  };

  // Newest first, oldest dropped beyond the limit.
  setToasts([toast, ...toasts].slice(0, MAX_TOASTS));

  return id;
}

export function dismissToast(id: string): void {
  setToasts(toasts.filter((toast) => toast.id !== id));
}

export function clearToasts(): void {
  setToasts(EMPTY_TOASTS);
}

/**
 * Imperative API for any Client Component:
 *
 *   toast.success('Copied')
 *   toast.error('Could not start the run', { action: { label: 'Retry', onClick } })
 */
export const toast = {
  success: (title: string, options: Omit<ToastOptions, 'variant'> = {}) =>
    pushToast(title, { ...options, variant: 'success' }),
  error: (title: string, options: Omit<ToastOptions, 'variant'> = {}) =>
    pushToast(title, { ...options, variant: 'error' }),
  info: (title: string, options: Omit<ToastOptions, 'variant'> = {}) =>
    pushToast(title, { ...options, variant: 'info' }),
  warning: (title: string, options: Omit<ToastOptions, 'variant'> = {}) =>
    pushToast(title, { ...options, variant: 'warning' }),
  dismiss: dismissToast,
  clear: clearToasts,
};
