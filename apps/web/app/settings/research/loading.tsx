export default function Loading() {
  return (
    <main>
      <p className="breadcrumb">Settings</p>

      <div className="page-header">
        <div>
          <h1>Research settings</h1>
          <p className="muted">Loading the registered settings…</p>
        </div>
      </div>

      <section className="card" aria-busy="true">
        <p className="muted" role="status">
          Loading settings…
        </p>
      </section>
    </main>
  );
}
