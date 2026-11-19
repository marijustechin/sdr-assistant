import Link from 'next/link';

export function SettingsPage() {
  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">
            Stored in PostgreSQL and applied by the API. One group now, more
            later.
          </p>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Research</h2>
          <Link href="/settings/research" className="button small">
            Open
          </Link>
        </div>
        <p className="muted">
          Search and page-collection behaviour of the research pipeline.
        </p>
      </section>

      <p className="muted page-footer">
        <Link href="/">← Home</Link>
      </p>
    </main>
  );
}
