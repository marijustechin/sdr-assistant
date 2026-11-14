'use client';

import { toast } from '@/shared/lib/toast';

const MAX_RENDERED_LENGTH = 20_000;

function toText(result: unknown): string | null {
  if (result === null || result === undefined) {
    return null;
  }

  if (typeof result === 'string') {
    return result;
  }

  return JSON.stringify(result, null, 2) ?? null;
}

async function copyResult(value: string): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      throw new Error('Clipboard is not available');
    }

    await navigator.clipboard.writeText(value);
    toast.success('Result copied to clipboard');
  } catch {
    toast.error('Could not copy the result', {
      action: {
        label: 'Try again',
        onClick: () => {
          void copyResult(value);
        },
      },
    });
  }
}

/**
 * Renders `research.result` without assuming its shape.
 *
 * Stage 02 is still in development: the value is a log string today and may
 * become an object later. This component must survive both, and must not be
 * replaced by a typed renderer until the API publishes a stable schema
 * (see docs/decisions/ADR-001-research-pipeline.md).
 */
export function ResearchResultView({ result }: { result: unknown }) {
  const text = toText(result);

  return (
    <section className="card">
      <div className="card-header">
        <h2>Result</h2>

        {text !== null && (
          <button
            type="button"
            className="button secondary small"
            onClick={() => {
              void copyResult(text);
            }}
          >
            Copy
          </button>
        )}
      </div>

      {result === null || result === undefined ? (
        <p className="muted">No result yet.</p>
      ) : typeof result === 'string' ? (
        <p>{result}</p>
      ) : (
        <details open>
          <summary className="muted">
            Raw result (
            {Array.isArray(result) ? `${result.length} items` : 'object'})
          </summary>
          <pre>
            {text !== null && text.length > MAX_RENDERED_LENGTH
              ? `${text.slice(0, MAX_RENDERED_LENGTH)}\n… truncated`
              : text}
          </pre>
        </details>
      )}
    </section>
  );
}
