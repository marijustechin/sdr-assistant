export default function Loading() {
  return (
    <main>
      <div className="status muted" role="status" aria-live="polite">
        <span
          className="inline-block size-4 animate-spin rounded-full border-2 border-border border-t-text motion-reduce:animate-none"
          aria-hidden="true"
        />
        Loading…
      </div>
    </main>
  );
}
