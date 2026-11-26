import { toHttpUrl } from '@/shared/lib/url';

type SourceLinkProps = {
  url: string | null;
  /** Optional visible label; defaults to the compact source hostname. */
  label?: string;
};

/**
 * Renders one validated HTTP(S) source link.
 *
 * Scraped and model-produced values are untrusted: only a validated HTTP(S) URL
 * becomes an anchor, everything else stays plain text.
 */
export function SourceLink({ url, label }: SourceLinkProps) {
  if (url === null) {
    return null;
  }

  const href = toHttpUrl(url);

  if (href === null) {
    return (
      <span className="source-invalid muted">Source link unavailable</span>
    );
  }

  const visibleLabel = label ?? sourceText(href);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="source-link"
      title={href}
    >
      {visibleLabel}
    </a>
  );
}

function sourceText(href: string): string {
  try {
    return new URL(href).hostname;
  } catch {
    return href;
  }
}
