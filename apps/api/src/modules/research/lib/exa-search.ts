import countries from 'i18n-iso-countries';
import { exaResponseSchema } from './exa-response.schema.js';

export async function searchExa(
  query: string,
  resultsPerQuery: number,
  country: string,
) {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error('EXA_API_KEY is missing');
  }

  const countryCode = countries.getAlpha2Code(country, 'en');

  if (!countryCode) {
    throw new Error(`Could not resolve country code: ${country}`);
  }

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      type: 'auto',
      numResults: resultsPerQuery,
      userLocation: countryCode,
      contents: {
        highlights: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Exa search error ${response.status}: ${await response.text()}`,
    );
  }

  const rawData: unknown = await response.json();
  const data = exaResponseSchema.parse(rawData);

  return {
    provider: 'exa' as const,
    query,
    country,
    userLocation: countryCode,
    searchedAt: new Date().toISOString(),
    requestId: data.requestId ?? null,

    results: data.results.map((result) => ({
      url: result.url,
      title: result.title ?? null,
      highlights: result.highlights ?? [],
    })),
  };
}
