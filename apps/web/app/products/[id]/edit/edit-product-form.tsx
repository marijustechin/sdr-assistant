'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { updateProduct, type UpdateProductFormState } from './actions'

const initialState: UpdateProductFormState = {}

type EditProductFormProps = {
  productId: string
  name: string
  description: string
}

export function EditProductForm({
  productId,
  name,
  description,
}: EditProductFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProduct.bind(null, productId),
    initialState,
  )

  return (
    <form action={formAction} className="form" noValidate>
      <div className="field">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          maxLength={200}
          required
          defaultValue={name}
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          aria-describedby={state.fieldErrors?.name ? 'name-error' : undefined}
        />
        {state.fieldErrors?.name && (
          <p className="field-error" id="name-error">
            {state.fieldErrors.name[0]}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={2000}
          defaultValue={description}
          aria-invalid={state.fieldErrors?.description ? true : undefined}
          aria-describedby={
            state.fieldErrors?.description ? 'description-error' : undefined
          }
        />
        {state.fieldErrors?.description && (
          <p className="field-error" id="description-error">
            {state.fieldErrors.description[0]}
          </p>
        )}
      </div>

      {state.message && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <Link href={`/products/${productId}`} className="button secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
