import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearToasts,
  dismissToast,
  getToasts,
  pushToast,
  subscribeToasts,
  toast,
} from './toast';

beforeEach(() => {
  clearToasts();
});

describe('toast store', () => {
  it('adds a toast and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToasts(listener);

    const id = pushToast('Saved');

    expect(id).toBe('toast-1');
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({
      title: 'Saved',
      variant: 'info',
      durationMs: 6_000,
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('keeps the newest first and caps the stack at four', () => {
    for (const title of ['one', 'two', 'three', 'four', 'five']) {
      pushToast(title);
    }

    const titles = getToasts().map((item) => item.title);

    expect(titles).toEqual(['five', 'four', 'three', 'two']);
  });

  it('dismisses one toast without touching the others', () => {
    const first = pushToast('first');
    pushToast('second');

    dismissToast(first);

    expect(getToasts().map((item) => item.title)).toEqual(['second']);
  });

  it('gives errors and warnings a longer lifetime than info', () => {
    pushToast('boom', { variant: 'error' });
    pushToast('careful', { variant: 'warning' });
    pushToast('fine');

    const durations = Object.fromEntries(
      getToasts().map((item) => [item.title, item.durationMs]),
    );

    expect(durations.boom).toBe(12_000);
    expect(durations.careful).toBe(10_000);
    expect(durations.fine).toBe(6_000);
  });

  it('keeps an explicit duration, including zero', () => {
    pushToast('sticky', { durationMs: 0 });
    expect(getToasts()[0].durationMs).toBe(0);
  });

  it('exposes the same behaviour through the `toast` helper', () => {
    toast.success('ok');
    toast.warning('careful');
    toast.error('nope', {
      action: { label: 'Retry', onClick: () => undefined },
    });

    expect(getToasts()[0]).toMatchObject({
      title: 'nope',
      variant: 'error',
      action: { label: 'Retry' },
    });
    expect(getToasts()[1]).toMatchObject({
      title: 'careful',
      variant: 'warning',
    });
    expect(getToasts()[2]).toMatchObject({ title: 'ok', variant: 'success' });
  });

  it('does not notify after unsubscribing', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToasts(listener);
    unsubscribe();

    pushToast('ignored');

    expect(listener).not.toHaveBeenCalled();
  });
});
