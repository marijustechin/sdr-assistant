import Link from 'next/link';

import { fetchResearches } from '@/entities/research';
import { ResearchStatusBadge } from '@/features/track-research';
import { fetchProducts } from '@/lib/products';
import { formatDateTime, shortenId } from '@/shared/lib/format';

export async function ResearchesPage() {
  const [researchesResult, productsResult] = await Promise.all([
    fetchResearches(),
    fetchProducts(),
  ]);

  const productNames = new Map<string, string>();

  if (productsResult.ok) {
    for (const product of productsResult.data) {
      productNames.set(product.id, product.name);
    }
  }

  const researches = researchesResult.ok
    ? [...researchesResult.data].sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      )
    : [];

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Researches</h1>
          <p className="muted">One run per product and market.</p>
        </div>
        <Link href="/products" className="button secondary">
          Products
        </Link>
      </div>

      <section className="card">
        {!researchesResult.ok ? (
          <>
            <div className="status error">
              <span className="dot" aria-hidden="true" />
              Could not load researches
            </div>
            <pre>{researchesResult.message}</pre>
          </>
        ) : researches.length === 0 ? (
          <p className="muted">
            No research yet. Open a product and start a run from its page.{' '}
            <Link href="/products">Products →</Link>
          </p>
        ) : (
          <ul className="product-list">
            {researches.map((research) => (
              <li key={research.id} className="product-item">
                <div>
                  <h2>
                    <Link href={`/researches/${research.id}`}>
                      {productNames.get(research.productId) ??
                        shortenId(research.productId)}
                    </Link>
                  </h2>
                  <p className="muted">
                    {research.country} · {formatDateTime(research.createdAt)}
                  </p>
                </div>
                <ResearchStatusBadge status={research.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted">
        <Link href="/">← Home</Link>
      </p>
    </main>
  );
}
