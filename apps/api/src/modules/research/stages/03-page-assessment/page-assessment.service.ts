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
  buildPageFactsSchema,
  type PageFacts,
} from './page-assessment.schema.js';
import { resolveStudySpec } from './page-assessment.spec.js';
import {
  deriveVerdict,
  type AssessmentOutcome,
} from './page-assessment.verdict.js';

/** One row of the assessment dump: the derived verdict plus the facts behind it. */
type AssessedPage = AssessmentOutcome & {
  url: string;
  facts: PageFacts;
};

@Injectable()
export class PageAssessmentService {
  private readonly logger = new Logger('PageAssessment');

  async assessPages(
    data: PageAssessmentInput,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<PageForAssessment[]> {
    const { targetCountry, targetLanguage, product, pages } = data;
    const runTag = `${slugify(product.generalCategoryName)}-${PAGE_ASSESSMENT_PROMPT_VERSION}-${timestampForFileName()}`;

    // Fail before the first paid call when the study has no definition for this
    // category: without the boundary and the traits every page answer would be
    // judged against nothing.
    const spec = resolveStudySpec(product.generalCategoryName);
    const factsSchema = buildPageFactsSchema(
      spec.traits.map((trait) => trait.name),
    );

    const assessed: AssessedPage[] = [];

    for (const [index, page] of pages.entries()) {
      // Progress doubles as the run heartbeat: stage 02 marks a run
      // INTERRUPTED when no update arrives for five minutes.
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
        spec,
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
        const facts = factsSchema.parse(parseJsonObject(raw));
        const outcome = deriveVerdict(facts, spec);

        assessed.push({ url: page.url, ...outcome, facts });
      } catch (error) {
        // A dirty answer is a page failure, not a run failure: keep the raw
        // text so the malformed answer can be inspected after the run.
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(`Assessment failed for ${page.url}: ${message}`);

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
