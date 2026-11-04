import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { fetchProduct } from '@/lib/products'

import { ResearchForm } from './research-form'

export const metadata: Metadata = {
  title: 'Product | SDR Assistant',
}

export const dynamic = 'force-dynamic'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await fetchProduct(id)

  if (!result.ok && result.status === 404) {
    notFound()
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
    )
  }

  const product = result.product

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
        <Link
          href={`/products/${product.id}/edit`}
          className="button secondary"
        >
          Edit product
        </Link>
      </div>

      <section className="card">
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {product.description || 'No description'}
        </p>
      </section>

      <section className="card">
        <h2>Start research</h2>
        <p className="muted">Choose a country for the research.</p>
        <ResearchForm name={product.name} description={product.description} />
      </section>
    </main>
  )
}
