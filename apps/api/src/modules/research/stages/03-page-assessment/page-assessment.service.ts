import { Injectable, Logger } from '@nestjs/common';
import {
  type PageAssessmentInput,
  type PageForAssessment,
} from '../../types.js';
import {
  resolveFileName,
  slugify,
  timestampForFileName,
  writeJsonFile,
} from '../../lib/utils.js';
import { llmChat } from '../../lib/llm-chat.js';
import { LLM_CONFIG_FLASH } from '../../config/llm-config.js';
import {
  PAGE_ASSESSMENT_PROMPT,
  PAGE_ASSESSMENT_PROMPT_VERSION,
} from './page-assessment.prompt.js';
import {
  pageAssessmentSchema,
  type PageAssessment,
} from './page-assessment.schema.js';

/** One row of the assessment dump: the verdict plus the page it belongs to. */
type AssessedPage = PageAssessment & { url: string };

@Injectable()
export class PageAssessmentService {
  private readonly logger = new Logger('PageAssessment');

  async assessPages(
    data: PageAssessmentInput,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<PageForAssessment[]> {
    const { targetCountry, targetLanguage, product, pages } = data;
    const runTag = `${slugify(product.generalCategoryName)}-${PAGE_ASSESSMENT_PROMPT_VERSION}-${timestampForFileName()}`;

    const assessed: AssessedPage[] = [];

    for (const [index, page] of pages.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await onStage?.(`03.1 Assessing pages ${index}/${pages.length}`);

      const content = page.content?.trim() ?? '';

      const excerpts = [...page.highlights, ...page.snippets]
        .map((text) => text.trim())
        .filter((text) => text.length > 0 && !content.includes(text));

      const input = {
        targetCountry,
        targetLanguage,
        product,
        page: {
          url: page.url,
          title: page.title,
          content,
          excerpts: [...new Set(excerpts)],
        },
      };

      // eslint-disable-next-line no-await-in-loop
      const response = await llmChat(
        LLM_CONFIG_FLASH,
        PAGE_ASSESSMENT_PROMPT,
        input,
      );

      const raw = response.choices[0]?.message.content ?? '';

      try {
        const parsed = pageAssessmentSchema.parse(parseJsonObject(raw));

        assessed.push({ url: page.url, ...parsed });
      } catch (error) {
        // A dirty answer is a page failure, not a run failure: keep the raw
        // text so the malformed answer can be inspected after the run.
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(`Assessment failed for ${page.url}: ${message}`);

        // eslint-disable-next-line no-await-in-loop
        await writeJsonFile(
          resolveFileName(
            `03.1-raw-failure-${String(index).padStart(3, '0')}-${runTag}`,
          ),
          { url: page.url, raw, input, error: message },
        );
      }
    }

    //laikinas
    await writeJsonFile(resolveFileName(`03.1-test-data-${runTag}`), assessed);
    ////// laikinas pabaiga

    return pages;
  }
}

/** First complete JSON object in a model answer; trailing text is ignored. */
function parseJsonObject(text: string): unknown {
  const start = text.indexOf('{');

  if (start === -1) {
    throw new Error('No JSON object in the answer');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1));
      }
    }
  }

  throw new Error('Unterminated JSON object in the answer');
}
