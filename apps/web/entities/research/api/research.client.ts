import { type ResearchResponse } from '../model/types';

export async function fetchResearchStatus(
  jobId: string,
  signal?: AbortSignal,
): Promise<ResearchResponse> {
  const response = await fetch(`/api/research/${encodeURIComponent(jobId)}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Could not load research status: HTTP ${response.status}`);
  }

  return response.json();
}
