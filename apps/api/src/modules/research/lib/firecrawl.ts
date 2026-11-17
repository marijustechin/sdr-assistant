import {
  firecrawlMapResponseSchema,
  firecrawlScrapeResponseSchema,
} from './firecrawl-response.schema.js';
import { fetchWithTimeout } from './fetch-with-timeout.js';

const FIRECRAWL_SCRAPE_TIMEOUT_MS = 60_000;
const FIRECRAWL_MAP_TIMEOUT_MS = 90_000;
const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v2';

export type FirecrawlPage = {
  url: string;
  title: string | null;
  markdown: string;
  links: string[];
};

function apiKey(): string {
  const key = process.env.FIRECRAWL_API_KEY;

  if (!key) {
    throw new Error('FIRECRAWL_API_KEY is missing');
  }

  return key;
}

async function postFirecrawl(path: string, body: object, timeoutMs: number) {
  return fetchWithTimeout(
    `${FIRECRAWL_BASE_URL}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    { label: `Firecrawl ${path}`, timeoutMs },
  );
}

/** Scrapes one URL into clean markdown plus the links found on the page. */
export async function scrapePage(url: string): Promise<FirecrawlPage> {
  const response = await postFirecrawl(
    'scrape',
    { url, formats: ['markdown', 'links'] },
    FIRECRAWL_SCRAPE_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(
      `Firecrawl scrape error ${response.status}: ${await response.text()}`,
    );
  }

  const data = firecrawlScrapeResponseSchema.parse(await response.json());

  if (data.success === false) {
    throw new Error(`Firecrawl scrape failed: ${data.error ?? 'unknown error'}`);
  }

  const markdown = data.data?.markdown?.trim() ?? '';

  if (!markdown) {
    throw new Error('Firecrawl scrape returned no markdown');
  }

  return {
    url,
    title: data.data?.metadata?.title ?? null,
    markdown,
    links: data.data?.links ?? [],
  };
}

/** Lists the URLs Firecrawl can discover on a site. */
export async function mapSite(url: string, limit = 300): Promise<string[]> {
  const response = await postFirecrawl(
    'map',
    { url, limit },
    FIRECRAWL_MAP_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(
      `Firecrawl map error ${response.status}: ${await response.text()}`,
    );
  }

  const data = firecrawlMapResponseSchema.parse(await response.json());

  if (data.success === false) {
    throw new Error(`Firecrawl map failed: ${data.error ?? 'unknown error'}`);
  }

  return (data.links ?? [])
    .map((link) => (typeof link === 'string' ? link : link.url))
    .filter((link) => typeof link === 'string' && link.length > 0);
}
