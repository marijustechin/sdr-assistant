'use client';

import { useActionState } from 'react';

import { COUNTRIES } from '@/lib/countries';

import { startResearch, type ResearchFormState } from './actions';

const initialState: ResearchFormState = { status: 'idle' };

type ResearchFormProps = {
  readonly name: string;
  readonly description: string;
  readonly productId: string;
};

export function ResearchForm({
  name,
  description,
  productId,
}: ResearchFormProps) {
  const [state, formAction, pending] = useActionState(
    startResearch,
    initialState,
  );

  return (
    <form action={formAction} className="form">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="productId" value={productId} />

      <div className="field">
        <label htmlFor="country">Country</label>
        <select id="country" name="country" required defaultValue="">
          <option value="" disabled>
            Select a country
          </option>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name} ({country.code})
            </option>
          ))}
        </select>
      </div>

      <div className="actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Starting…' : 'Start research'}
        </button>

        {state.status === 'error' && (
          <p className="form-error" role="alert">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
