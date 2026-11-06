import { z } from 'zod';

const firecrawlResponseSchema = z.object({
  success: z.literal(true),

  data: z.object({
    markdown: z.string(),
    html: z.string().optional(),

    metadata: z
      .looseObject({
        title: z.string().nullish(),
        sourceURL: z.string().nullish(),
        url: z.string().nullish(),
        statusCode: z.number().nullish(),
      })
      .optional(),
  }),
});

export async function scrapePage(url: string) {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is missing');
  }

  const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',

    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
      onlyMainContent: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Firecrawl API error ${response.status}: ${await response.text()}`,
    );
  }

  const rawData: unknown = await response.json();
  const { data } = firecrawlResponseSchema.parse(rawData);

  const pageStatus = data.metadata?.statusCode;

  if (pageStatus != null && pageStatus >= 400) {
    throw new Error(`Firecrawl received page error ${pageStatus} for ${url}`);
  }

  if (!data.markdown.trim()) {
    throw new Error(`Firecrawl returned empty content for ${url}`);
  }

  return {
    provider: 'firecrawl' as const,
    requestedUrl: url,
    retrievedAt: new Date().toISOString(),
    markdown: data.markdown,
    html: data.html ?? null,
    metadata: data.metadata ?? null,
  };
}
