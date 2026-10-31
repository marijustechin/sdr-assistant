'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { createProduct, type ProductFormState } from '../actions'

const initialState: ProductFormState = {}

export function ProductForm() {
  const [state, formAction, pending] = useActionState(
    createProduct,
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
          placeholder="e.g. Analytics Suite"
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
          placeholder="What does this product do?"
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
          {pending ? 'Creating…' : 'Create product'}
        </button>
        <Link href="/products" className="button secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
