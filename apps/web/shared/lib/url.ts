/**
 * Returns a canonical `http:`/`https:` URL, or `null` for anything else.
 *
 * Research source links come from scraped pages and model output, so they are
 * untrusted. Only validated HTTP(S) URLs may become anchors; every other value is
 * rendered as plain text by the caller.
 */
export function toHttpUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
