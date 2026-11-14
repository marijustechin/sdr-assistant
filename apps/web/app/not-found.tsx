import Link from 'next/link';

export default function NotFound() {
  return (
    <main>
      <h1>Not found</h1>
      <p className="muted">
        This page does not exist, or the resource has been deleted.
      </p>

      <div className="actions">
        <Link href="/" className="button">
          Home
        </Link>
        <Link href="/researches" className="button secondary">
          Researches
        </Link>
        <Link href="/products" className="button secondary">
          Products
        </Link>
      </div>
    </main>
  );
}
