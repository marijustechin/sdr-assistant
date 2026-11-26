export default function Loading() {
  return (
    <main>
      <p className="breadcrumb">Settings</p>

      <div className="page-header">
        <div>
          <h1>Email accounts</h1>
          <p className="muted">Loading the configured accounts…</p>
        </div>
      </div>

      <section className="card" aria-busy="true">
        <p className="muted" role="status">
          Loading email accounts…
        </p>
      </section>
    </main>
  );
}
