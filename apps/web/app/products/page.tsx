import type { Metadata } from 'next'
import Link from 'next/link'

import { apiUrl } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Products | SDR Assistant',
}

export const dynamic = 'force-dynamic'

type Product = {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

type ProductsResult =
  | { ok: true; products: Product[] }
  | { ok: false; error: string }

async function fetchProducts(): Promise<ProductsResult> {
  try {
    const response = await fetch(`${apiUrl}/products`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })

    if (!response.ok) {
      return { ok: false, error: `The API responded with HTTP ${response.status}.` }
    }

    return { ok: true, products: (await response.json()) as Product[] }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default async function ProductsPage() {
  const result = await fetchProducts()

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
              <span className="dot" />
              Could not load products
            </div>
            <pre>{result.error}</pre>
          </>
        ) : result.products.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No products yet. <Link href="/products/new">Create the first one →</Link>
          </p>
        ) : (
          <ul className="product-list">
            {result.products.map((product) => (
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
                  {formatDate(product.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted" style={{ marginTop: '1.5rem' }}>
        <Link href="/">← Home</Link>
      </p>
    </main>
  )
}
