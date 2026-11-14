'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  dismissToast,
  getServerToasts,
  getToasts,
  subscribeToasts,
  type Toast,
} from '@/shared/lib/toast';

/**
 * Global notification viewport. Mounted once in the root layout; any Client
 * Component can push a toast through `@/shared/lib/toast`.
 *
 * Errors use `role="alert"` (assertive); everything else uses `role="status"`.
 * A toast pauses its timer while hovered or focused, and Escape dismisses it.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(
    subscribeToasts,
    getToasts,
    getServerToasts,
  );

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toaster" role="region" aria-label="Notifications">
      {toasts.map((item) => (
        <ToastItem key={item.id} toast={item} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || toast.durationMs <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      dismissToast(toast.id);
    }, toast.durationMs);

    return () => {
      clearTimeout(timer);
    };
  }, [paused, toast.id, toast.durationMs]);

  const runAction = (): void => {
    toast.action?.onClick();
    dismissToast(toast.id);
  };

  return (
    <div
      className={`toast toast--${toast.variant}`}
      role={
        toast.variant === 'error' || toast.variant === 'warning'
          ? 'alert'
          : 'status'
      }
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          dismissToast(toast.id);
        }
      }}
    >
      <div className="toast-body">
        <p className="toast-title">{toast.title}</p>

        {toast.description !== undefined && (
          <p className="toast-description">{toast.description}</p>
        )}

        {toast.action !== undefined && (
          <div className="toast-actions">
            <button type="button" className="toast-action" onClick={runAction}>
              {toast.action.label}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(toast.id)}
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
