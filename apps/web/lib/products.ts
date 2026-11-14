import { z } from 'zod';

import { getJson, patchJson, postJson } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Product = z.infer<typeof productSchema>;

/** Shape the create/edit forms send. */
export type ProductInput = {
  name: string;
  description: string;
};

/**
 * Transitional result shape used by the product detail and edit pages.
 * Phase 1.4 of the frontend plan replaces it with `ApiResult`.
 */
export type ProductResult =
  | { ok: true; product: Product }
  | { ok: false; status?: number; error: string };

export async function fetchProduct(id: string): Promise<ProductResult> {
  const result = await getJson(
    `${apiUrl}/products/${encodeURIComponent(id)}`,
    productSchema,
  );

  if (!result.ok) {
    return { ok: false, status: result.status, error: result.message };
  }

  return { ok: true, product: result.data };
}

/** Product list, used to label research rows with a product name. */
export function fetchProducts(): Promise<ApiResult<Product[]>> {
  return getJson(`${apiUrl}/products`, z.array(productSchema));
}

export function createProduct(
  input: ProductInput,
): Promise<ApiResult<Product>> {
  return postJson(`${apiUrl}/products`, input, productSchema);
}

export function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ApiResult<Product>> {
  return patchJson(
    `${apiUrl}/products/${encodeURIComponent(id)}`,
    input,
    productSchema,
  );
}
