import { describe, expect, it } from 'vitest';

import { formatDate, formatDateTime, formatTime, shortenId } from './format';

describe('formatDate / formatTime', () => {
  it('renders Lithuanian winter time (UTC+2)', () => {
    const value = '2026-11-14T18:34:00.000Z';

    expect(formatDate(value)).toBe('2026-11-14');
    expect(formatTime(value)).toBe('20:34');
    expect(formatDateTime(value)).toBe('2026-11-14 20:34');
  });

  it('follows the summer offset (UTC+3)', () => {
    const value = '2026-07-01T18:34:00.000Z';

    expect(formatDateTime(value)).toBe('2026-07-01 21:34');
  });

  it('rolls the date across midnight in local time', () => {
    expect(formatDateTime('2026-11-14T22:30:00.000Z')).toBe('2026-11-15 00:30');
  });

  it('pads single-digit hours and minutes', () => {
    expect(formatTime('2026-11-14T06:05:00.000Z')).toBe('08:05');
  });

  it('accepts a Date instance', () => {
    expect(formatDateTime(new Date('2026-11-14T18:34:00.000Z'))).toBe(
      '2026-11-14 20:34',
    );
  });

  it('returns a dash for an invalid value', () => {
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatTime('not-a-date')).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
  });
});

describe('shortenId', () => {
  it('keeps short ids intact and truncates long ones', () => {
    expect(shortenId('abc')).toBe('abc');
    expect(shortenId('cm3k9x2b10000abcdef', 8)).toBe('cm3k9x2b…');
  });
});
