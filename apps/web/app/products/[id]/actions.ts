'use server';

import { apiUrl } from '@/lib/api';
import { findCountry } from '@/lib/countries';
import { startResearchResponseSchema } from '@/entities/research';
import { redirect } from 'next/navigation';

export type ResearchFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  jobId?: string;
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

  if (!country) {
    return { status: 'error', message: 'Choose a country.' };
  }

  let jobId: string;

  try {
    const response = await fetch(`${apiUrl}/research`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        productId,
        country: country.name,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        status: 'error',
        message: `The API responded with HTTP ${response.status}.`,
      };
    }

    const data: unknown = await response.json();
    const parsed = startResearchResponseSchema.safeParse(data);

    if (!parsed.success) {
      return {
        status: 'error',
        message: 'The API returned an unexpected response.',
      };
    }

    jobId = parsed.data.jobId;
  } catch {
    return {
      status: 'error',
      message: 'Could not reach the API. Is it running?',
    };
  }

  redirect(`/researches/${encodeURIComponent(jobId)}`);
}
