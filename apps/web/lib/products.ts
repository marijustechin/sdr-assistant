import { apiUrl } from './api'

export type Product = {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export type ProductResult =
  | { ok: true; product: Product }
  | { ok: false; status?: number; error: string }

export async function fetchProduct(id: string): Promise<ProductResult> {
  try {
    const response = await fetch(
      `${apiUrl}/products/${encodeURIComponent(id)}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      },
    )

    if (response.status === 404) {
      return { ok: false, status: 404, error: 'Product not found.' }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `The API responded with HTTP ${response.status}.`,
      }
    }

    return { ok: true, product: (await response.json()) as Product }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
