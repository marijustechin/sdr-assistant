'use client'

import { useActionState } from 'react'

import { startResearch, type ResearchFormState } from './actions'

const initialState: ResearchFormState = { status: 'idle' }

type ResearchFormProps = {
  name: string
  description: string
}

export function ResearchForm({ name, description }: ResearchFormProps) {
  const [state, formAction, pending] = useActionState(
    startResearch,
    initialState,
  )

  return (
    <form action={formAction} className="form">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="description" value={description} />

      <div className="field">
        <label htmlFor="country">Country</label>
        <input
          id="country"
          name="country"
          type="text"
          maxLength={100}
          required
          placeholder="e.g. Lithuania"
        />
      </div>

      <div className="actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Starting…' : 'Start research'}
        </button>

        {state.status === 'success' && (
          <p className="form-success" role="status">
            {state.message}
          </p>
        )}
        {state.status === 'error' && (
          <p className="form-error" role="alert">
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
