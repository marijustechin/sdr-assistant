import { writeFile } from 'node:fs/promises';

import { scrapePage } from './firecrawl-scrape.js';

const url =
  'https://www.pirtele.lt/prekes-ir-paslaugos/dailylente-termo-abachi-sts-18x140';

const page = await scrapePage(url);

await writeFile(
  'firecrawl-preview.json',
  JSON.stringify(page, null, 2),
  'utf8',
);

console.log({
  requestedUrl: page.requestedUrl,
  statusCode: page.metadata?.statusCode,
  title: page.metadata?.title,
  markdownCharacters: page.markdown.length,
  htmlCharacters: page.html?.length ?? 0,
});

console.log('Saved: firecrawl-preview.json');
