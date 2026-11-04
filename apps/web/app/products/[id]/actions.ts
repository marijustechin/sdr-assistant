'use server'

import { apiUrl } from '@/lib/api'

export type ResearchFormState = {
  status: 'idle' | 'success' | 'error'
  message?: string
}

export async function startResearch(
  _prevState: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const country = String(formData.get('country') ?? '').trim()

  if (!country) {
    return { status: 'error', message: 'Country is required.' }
  }

  try {
    const response = await fetch(`${apiUrl}/research`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description, country }),
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        status: 'error',
        message: `The API responded with HTTP ${response.status}.`,
      }
    }
  } catch {
    return { status: 'error', message: 'Could not reach the API. Is it running?' }
  }

  return {
    status: 'success',
    message: `Research completed for ${country}.`,
  }
}
