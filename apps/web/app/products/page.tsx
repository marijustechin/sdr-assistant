import type { Metadata } from 'next';
import Link from 'next/link';

import { fetchProducts } from '@/lib/products';
import { formatDateTime } from '@/shared/lib/format';

export const metadata: Metadata = {
  title: 'Products | SDR Assistant',
};

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const result = await fetchProducts();

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p className="muted">Products stored in PostgreSQL.</p>
        </div>
        <Link href="/products/new" className="button">
          New product
        </Link>
      </div>

      <section className="card">
        {!result.ok ? (
          <>
            <div className="status error">
              <span className="dot" aria-hidden="true" />
              Could not load products
            </div>
            <pre>{result.message}</pre>
          </>
        ) : result.data.length === 0 ? (
          <p className="muted">
            No products yet.{' '}
            <Link href="/products/new">Create the first one →</Link>
          </p>
        ) : (
          <ul className="product-list">
            {result.data.map((product) => (
              <li key={product.id} className="product-item">
                <div>
                  <h2>
                    <Link href={`/products/${product.id}`}>{product.name}</Link>
                  </h2>
                  {product.description ? (
                    <p>{product.description}</p>
                  ) : (
                    <p className="muted">No description</p>
                  )}
                </div>
                <time className="muted" dateTime={product.createdAt}>
                  {formatDateTime(product.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted page-footer">
        <Link href="/">← Home</Link>
      </p>
    </main>
  );
}
