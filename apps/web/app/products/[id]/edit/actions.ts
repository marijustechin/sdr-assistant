'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { updateProduct as updateProductRequest } from '@/lib/products';

export type UpdateProductFormState = {
  message?: string;
  fieldErrors?: {
    name?: string[];
    description?: string[];
  };
};

export async function updateProduct(
  productId: string,
  _prevState: UpdateProductFormState,
  formData: FormData,
): Promise<UpdateProductFormState> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  const fieldErrors: NonNullable<UpdateProductFormState['fieldErrors']> = {};

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

  const result = await updateProductRequest(productId, { name, description });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  redirect(`/products/${productId}`);
}
