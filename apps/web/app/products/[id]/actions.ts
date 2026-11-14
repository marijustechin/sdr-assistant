'use server';

import { redirect } from 'next/navigation';

import { startResearchResponseSchema } from '@/entities/research';
import { postJson } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';
import { findCountry } from '@/lib/countries';

export type ResearchFormState = {
  status: 'idle' | 'error';
  message?: string;
};

export async function startResearch(
  _prevState: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const country = findCountry(String(formData.get('country') ?? '').trim());
  const productId = String(formData.get('productId') ?? '').trim();

  if (!productId) {
    return { status: 'error', message: 'Product ID is missing.' };
  }

  if (!name) {
    return { status: 'error', message: 'Product name is missing.' };
  }

  if (!country) {
    return { status: 'error', message: 'Choose a country.' };
  }

  const result = await postJson(
    `${apiUrl}/research`,
    { name, description, productId, country: country.name },
    startResearchResponseSchema,
  );

  if (!result.ok) {
    return { status: 'error', message: result.message };
  }

  // `redirect` throws; success never returns a state object.
  redirect(`/researches/${encodeURIComponent(result.data.jobId)}`);
}
