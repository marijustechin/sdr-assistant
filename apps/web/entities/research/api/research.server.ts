import { apiUrl } from '@/lib/api';
import { type ResearchResponse } from '../model/types';

export async function fetchResearch(jobId: string): Promise<ResearchResponse> {
  const response = await fetch(`${apiUrl}/research/${jobId}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Could not load researches: HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchResearches(): Promise<ResearchResponse[]> {
  const response = await fetch(`${apiUrl}/research`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Could not load researches: HTTP ${response.status}`);
  }

  return response.json();
}
