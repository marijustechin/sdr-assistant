import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchResearches } from '@/entities/research';
import { ResearchStatusBadge } from '@/features/track-research';
import { fetchProduct } from '@/lib/products';
import { formatDateTime } from '@/shared/lib/format';

import { ResearchForm } from './research-form';

export const metadata: Metadata = {
  title: 'Product | SDR Assistant',
};

export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 5;

export default async function ProductPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const result = await fetchProduct(id);

  if (!result.ok && result.status === 404) {
    notFound();
  }

  if (!result.ok) {
    return (
      <main>
        <p className="breadcrumb">
          <Link href="/products">← Products</Link>
        </p>
        <div className="status error">
          <span className="dot" />
          Could not load product
        </div>
        <pre>{result.error}</pre>
      </main>
    );
  }

  const product = result.product;

  // Product history is joined here because `GET /research` has no product filter.
  const researchesResult = await fetchResearches();
  const history = researchesResult.ok
    ? researchesResult.data
        .filter((research) => research.productId === product.id)
        .sort(
          (left, right) =>
            Date.parse(right.createdAt) - Date.parse(left.createdAt),
        )
        .slice(0, HISTORY_LIMIT)
    : null;

  return (
    <main>
      <p className="breadcrumb">
        <Link href="/products">← Products</Link>
      </p>

      <div className="page-header">
        <div>
          <h1>{product.name}</h1>
          <p className="muted">Product details</p>
        </div>
      </div>

      <section className="card">
        <p className="prose-block">{product.description || 'No description'}</p>
      </section>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">
        <section className="card mt-0">
          <h2>Start research</h2>
          <p className="muted">Choose a country for the research.</p>
          <ResearchForm
            name={product.name}
            description={product.description}
            productId={id}
          />
        </section>

        <section className="card mt-0">
          <div className="card-header">
            <h2>Research history</h2>
            <Link href="/researches" className="muted">
              All researches →
            </Link>
          </div>

          {history === null ? (
            <p className="muted">Could not load the research history.</p>
          ) : history.length === 0 ? (
            <p className="muted">No research yet for this product.</p>
          ) : (
            <ul className="product-list">
              {history.map((research) => (
                <li key={research.id} className="product-item">
                  <div>
                    <h2>
                      <Link href={`/researches/${research.id}`}>
                        {research.country}
                      </Link>
                    </h2>
                    <p className="muted">
                      {formatDateTime(research.createdAt)}
                    </p>
                  </div>
                  <ResearchStatusBadge status={research.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
