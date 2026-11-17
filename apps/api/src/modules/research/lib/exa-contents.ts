import { exaContentsResponseSchema } from './exa-response.schema.js';
import { fetchWithTimeout } from './fetch-with-timeout.js';

const EXA_CONTENTS_TIMEOUT_MS = 30_000;
const EXA_CONTENTS_MAX_CHARS = 12_000;

export type ExaPageContent = {
  url: string;
  title: string | null;
  text: string | null;
};

/**
 * Extracts the clean markdown body of one known URL via Exa's contents endpoint.
 *
 * `/contents` takes its options at the top level — unlike `/search`, where they
 * sit under `contents`. A URL Exa could not extract comes back without text.
 */
export async function fetchExaContents(url: string): Promise<ExaPageContent> {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error('EXA_API_KEY is missing');
  }

  const response = await fetchWithTimeout(
    'https://api.exa.ai/contents',
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [url],
        text: {
          maxCharacters: EXA_CONTENTS_MAX_CHARS,
        },
      }),
    },
    { label: 'Exa contents', timeoutMs: EXA_CONTENTS_TIMEOUT_MS },
  );

  if (!response.ok) {
    throw new Error(
      `Exa contents error ${response.status}: ${await response.text()}`,
    );
  }

  const data = exaContentsResponseSchema.parse(await response.json());

  const failed = data.statuses?.find(
    (status) => status.status !== undefined && status.status !== 'success',
  );

  if (failed) {
    throw new Error(
      `Exa contents failed for ${url}: ${failed.error ?? failed.status}`,
    );
  }

  const result = data.results.find((item) => item.url === url) ?? data.results[0];

  return {
    url,
    title: result?.title ?? null,
    text: result?.text?.trim() || null,
  };
}
