'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createProduct as createProductRequest } from '@/lib/products';

export type ProductFormState = {
  message?: string;
  fieldErrors?: {
    name?: string[];
    description?: string[];
  };
};

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  const fieldErrors: NonNullable<ProductFormState['fieldErrors']> = {};

  if (!name) {
    fieldErrors.name = ['Name is required.'];
  } else if (name.length > 200) {
    fieldErrors.name = ['Name must be 200 characters or fewer.'];
  }

  if (description.length > 2000) {
    fieldErrors.description = ['Description must be 2000 characters or fewer.'];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const result = await createProductRequest({ name, description });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath('/products');
  redirect('/products');
}
