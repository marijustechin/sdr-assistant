import type { Metadata } from 'next'
import Link from 'next/link'

import { ProductForm } from './product-form'

export const metadata: Metadata = {
  title: 'New product | SDR Assistant',
}

export default function NewProductPage() {
  return (
    <main>
      <p className="breadcrumb">
        <Link href="/products">← Products</Link>
      </p>
      <h1>New product</h1>
      <p className="muted">Add a product to the catalog.</p>

      <section className="card">
        <ProductForm />
      </section>
    </main>
  )
}
