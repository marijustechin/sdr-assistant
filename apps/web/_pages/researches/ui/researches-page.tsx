import Link from 'next/link';

import { fetchResearches, toResearchListItem } from '@/entities/research';
import { fetchProducts } from '@/lib/products';

import { ResearchesExplorer } from './researches-explorer';

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

  const researches = researchesResult.ok ? researchesResult.data : [];

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Researches</h1>
          <p className="muted">
            All research runs across products and markets. A product and market
            may have several historical runs.
          </p>
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
          <ResearchesExplorer
            items={researches.map((research) =>
              toResearchListItem(
                research,
                productNames.get(research.productId) ?? null,
              ),
            )}
          />
        )}
      </section>

      <p className="muted">
        <Link href="/">← Home</Link>
      </p>
    </main>
  );
}
