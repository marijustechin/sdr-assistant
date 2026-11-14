'use client';

import Link from 'next/link';
import { useEffect } from 'react';

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <main>
      <h1>Something went wrong</h1>
      <p className="muted">
        The page could not be rendered. The rest of the app still works.
      </p>

      <section className="card">
        <div className="status error">
          <span className="dot" aria-hidden="true" />
          Unexpected error
        </div>
        <p className="muted">{error.message}</p>

        <div className="actions">
          <button type="button" className="button" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="button secondary">
            Go home
          </Link>
        </div>
      </section>
    </main>
  );
}
