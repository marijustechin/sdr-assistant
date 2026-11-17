import { z } from 'zod';

/**
 * Response of `POST https://api.firecrawl.dev/v2/scrape`.
 *
 * Only the fields we use are modelled; everything else is ignored, so a
 * Firecrawl addition cannot break the stage.
 */
export const firecrawlScrapeResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().nullish(),
  data: z
    .object({
      markdown: z.string().nullish(),
      links: z.array(z.string()).nullish(),
      metadata: z
        .object({
          title: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

/**
 * Response of `POST https://api.firecrawl.dev/v2/map`.
 *
 * `links` may be plain strings or objects with a `url`, depending on options.
 */
export const firecrawlMapResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().nullish(),
  links: z
    .array(
      z.union([
        z.string(),
        z.object({
          url: z.string(),
          title: z.string().nullish(),
        }),
      ]),
    )
    .nullish(),
});
