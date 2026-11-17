import { dsResponseSchema } from './ds-response.schema.js';
import { fetchWithTimeout } from './fetch-with-timeout.js';

const DEEPSEEK_TIMEOUT_MS = 45_000;

export async function dsSearch(query: string, resultsPerQuery = 5) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is missing');
  }

  const response = await fetchWithTimeout(
    'https://api.deepseek.com/v1/tools/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        count: resultsPerQuery,
        need_content: true,
      }),
    },
    { label: 'DeepSeek search', timeoutMs: DEEPSEEK_TIMEOUT_MS },
  );

  if (!response.ok) {
    throw new Error(
      `DeepSeek Search error ${response.status}: ${await response.text()}`,
    );
  }

  const rawData: unknown = await response.json();
  const data = dsResponseSchema.parse(rawData);

  return {
    provider: 'deepseek' as const,
    query,
    searchedAt: new Date().toISOString(),

    results: data.results.map((result) => ({
      url: result.url,
      title: result.title,
      snippet: result.snippet,
      summary: result.summary,
      content: result.content,
    })),
  };
}
