import { dsResponseSchema } from './ds-response.schema.js';
import { fetchWithTimeout } from './fetch-with-timeout.js';

const DEEPSEEK_TIMEOUT_MS = 45_000;

export type DsSearchOptions = {
  /**
   * ISO 639-1 code of the run's target language, applied as the `lang:` query
   * operator. The Search API has no language field — `localization` takes an
   * IP address — so the operator is the only way to keep results inside the
   * market's language. A missing code searches without it.
   */
  language?: string;
};

export async function dsSearch(
  query: string,
  resultsPerQuery = 5,
  options: DsSearchOptions = {},
) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is missing');
  }

  const language = options.language?.trim();
  const searchQuery = language ? `${query} lang:${language}` : query;

  const response = await fetchWithTimeout(
    'https://api.deepseek.com/v1/tools/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
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
    query: searchQuery,
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

