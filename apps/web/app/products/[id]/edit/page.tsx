import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { fetchProduct } from '@/lib/products'

import { EditProductForm } from './edit-product-form'

export const metadata: Metadata = {
  title: 'Edit product | SDR Assistant',
}

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
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
        <Link href={`/products/${product.id}`}>← {product.name}</Link>
      </p>

      <h1>Edit product</h1>
      <p className="muted">Update the product name and description.</p>

      <section className="card">
        <EditProductForm
          productId={product.id}
          name={product.name}
          description={product.description}
        />
      </section>
    </main>
  )
}
