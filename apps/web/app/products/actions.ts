'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { apiUrl } from '@/lib/api'

export type ProductFormState = {
  message?: string
  fieldErrors?: {
    name?: string[]
    description?: string[]
  }
}

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  const fieldErrors: NonNullable<ProductFormState['fieldErrors']> = {}

  if (!name) {
    fieldErrors.name = ['Name is required.']
  } else if (name.length > 200) {
    fieldErrors.name = ['Name must be 200 characters or fewer.']
  }

  if (description.length > 2000) {
    fieldErrors.description = ['Description must be 2000 characters or fewer.']
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  let response: Response

  try {
    response = await fetch(`${apiUrl}/products`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description }),
      cache: 'no-store',
    })
  } catch {
    return { message: 'Could not reach the API. Is it running?' }
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[]
    } | null

    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : payload?.message

    return {
      message: message ?? `The API responded with HTTP ${response.status}.`,
    }
  }

  revalidatePath('/products')
  redirect('/products')
}
