/**
 * Display formatting. Dates and times are always shown in Lithuanian time
 * (`Europe/Vilnius`), independent of the server's or the browser's own zone, so
 * the server and the client render exactly the same string.
 */
const TIME_ZONE = 'Europe/Vilnius';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const INVALID = '—';

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function partValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

/** `2026-11-14` in Lithuanian time. */
export function formatDate(value: string | Date): string {
  const date = toDate(value);

  if (date === null) {
    return INVALID;
  }

  const parts = dateFormatter.formatToParts(date);

  return [
    partValue(parts, 'year'),
    partValue(parts, 'month'),
    partValue(parts, 'day'),
  ].join('-');
}

/** `20:34` (24-hour) in Lithuanian time. */
export function formatTime(value: string | Date): string {
  const date = toDate(value);

  if (date === null) {
    return INVALID;
  }

  const parts = timeFormatter.formatToParts(date);

  return `${partValue(parts, 'hour')}:${partValue(parts, 'minute')}`;
}

/** `2026-11-14 20:34` in Lithuanian time. */
export function formatDateTime(value: string | Date): string {
  const date = toDate(value);

  if (date === null) {
    return INVALID;
  }

  return `${formatDate(date)} ${formatTime(date)}`;
}

/** Shortens a cuid for display: `cm3k9x2b10000…`. */
export function shortenId(id: string, length = 8): string {
  return id.length > length ? `${id.slice(0, length)}…` : id;
}
