import { Injectable, Logger } from '@nestjs/common';

import { LLM_CONFIG_FLASH } from '../../config/llm-config.js';
import { CreateResearchDto } from '../../dto/create-research.dto.js';
import { preparePagesForAssessment } from '../../pipeline/page-preparation.js';
import { searchTermCandidates } from '../../pipeline/term-search.js';
import { llmChat } from '../../lib/llm-chat.js';
import { stripCodeFence } from '../../lib/strip-code.fense.js';
import { PAGE_ASSESSMENT_PROMPT } from './page-assessment.prompt.js';
import {
  type IdentifiedProduct,
  identifiedProductSchema,
} from './product-identification.schema.js';
import {
  type PageForAssessment,
  type ProductIdentificationResponse,
  type TermCandidates,
} from '../../types.js';
import {
  resolveFileName,
  slugify,
  timestampForFileName,
  writeJsonFile,
} from '../../lib/utils.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { Prisma } from '../../../../generated/prisma/client.js';

@Injectable()
export class ProductIdentificationService {
  constructor(private readonly prismaService: PrismaService) {}
  private readonly logger = new Logger('CompanyDiscovery');

  async identify(
    dto: CreateResearchDto,
    targetLanguage: string,
    jobId: string,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<ProductIdentificationResponse> {
    const targetCountry = dto.country;
    const runTag = `${slugify(dto.name)}-${timestampForFileName()}`;

    await onStage?.('1.1 Generating term candidates...');
    const termCandidates = await this.generateTermCandidates(
      targetLanguage,
      targetCountry,
      dto.name,
      dto.description,
    );
    await writeJsonFile(
      resolveFileName(`01.1-term-candidates-${runTag}`),
      termCandidates,
    );

    await onStage?.('1.2 Searching term candidates...');
    const searchedTermCandidates = await searchTermCandidates(termCandidates, {
      country: targetCountry,
      resultsPerQuery: 5,
    });
    await writeJsonFile(
      resolveFileName(`01.2-searched-term-candidates-${runTag}`),
      searchedTermCandidates,
    );

    await onStage?.('1.3 Preparing pages for assessment...');
    const preparedCandidates = preparePagesForAssessment(
      searchedTermCandidates,
    );
    await writeJsonFile(
      resolveFileName(`01.3-prepared-candidates-${runTag}`),
      preparedCandidates,
    );

    await onStage?.('1.4 Identifying the product...');
    const identifiedProduct = await this.identifyProduct(
      preparedCandidates,
      targetLanguage,
      targetCountry,
      dto.name,
      dto.description,
    );
    await writeJsonFile(
      resolveFileName(`01.1-identified-product-${runTag}`),
      identifiedProduct,
    );

    const productIdentified = structuredClone(
      identifiedProduct,
    ) as Prisma.InputJsonValue;
    const candidatePages = structuredClone(
      preparedCandidates,
    ) as Prisma.InputJsonValue;
    await this.prismaService.researchStage01.upsert({
      where: { jobId },
      create: {
        jobId,
        identifiedProduct: productIdentified,
        preparedCandidates: candidatePages,
      },
      update: {
        identifiedProduct: productIdentified,
        preparedCandidates: candidatePages,
      },
    });

    return { product: identifiedProduct, sourcePages: preparedCandidates };
  }

  /**
   * ***********************************************************************************
   * @param targetLanguage
   * @param targetCountry
   * @param productName
   * @param productDescription
   * @returns
   */
  private async generateTermCandidates(
    targetLanguage: string,
    targetCountry: string,
    productName: string,
    productDescription?: string,
  ): Promise<TermCandidates> {
    const systemPrompt = `
You suggest natural commercial product and category names
in ${targetLanguage} for the ${targetCountry} market.

The source product name and description are in English.
Preserve the product's meaning while adapting its names to the target market.
Prefer natural commercial wording over word-for-word translation.

Return valid JSON only, with exactly this shape:
{
  "productNames": ["..."],
  "categoryNames": ["..."],
  "notes": "..."
}

Rules:
- productNames: names for the described product, preserving its identity,
  material and treatment where relevant.
- categoryNames: general product categories that sellers of this product
  would use, without requiring its particular material or treatment.
- Include the general category without an application restriction where
  a natural commercial term exists.
- Keep categories relevant to the product. Avoid excessively broad terms
  such as "building materials".
- Include useful synonyms, alternative commercial names and spelling variants.
- Do not fill the lists with mechanical singular/plural combinations.
- Do not include adjacent products or applications unsupported by the input.
- Return up to 15 productNames and up to 10 categoryNames.
  Fewer good candidates are better than filling a quota.
- Order candidates by likely commercial usefulness.
- All names must be in the target market's language; established borrowed
  product and material names are allowed.
- These are candidates for subsequent web verification.
  Do not claim that you searched the web, verified usage or measured popularity.
- If terminology is uncertain, explain that briefly in notes.
- notes must be short and in English.
`.trim();

    const userContent = {
      sourceLanguage: 'English',
      productName,
      description: productDescription ?? '',
      targetLanguage,
      targetCountry,
    };

    const response = await llmChat(LLM_CONFIG_FLASH, systemPrompt, userContent);
    const raw = response.choices[0]?.message.content ?? '';
    const content = stripCodeFence(raw);

    let parsed: TermCandidates;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Term candidates JSON parse failed: ${String(error)}`);
    }

    if (
      !Array.isArray(parsed.productNames) ||
      !Array.isArray(parsed.categoryNames)
    ) {
      throw new TypeError('Term candidates JSON has invalid shape');
    }

    return parsed;
  }

  /**
   * ****************************************************************************************
   * @param pages
   * @param targetLanguage
   * @param targetCountry
   * @param productName
   * @param productDescription
   * @returns
   */
  private async identifyProduct(
    pages: PageForAssessment[],
    targetLanguage: string,
    targetCountry: string,
    productName: string,
    productDescription?: string,
  ): Promise<IdentifiedProduct> {
    const systemPrompt = `${PAGE_ASSESSMENT_PROMPT}

Use ${targetLanguage} commercial product and category names for ${targetCountry}.
Do not choose a different output language from the source pages.
Established borrowed material names are allowed. Keep explanations in English.`;

    const response = await llmChat(LLM_CONFIG_FLASH, systemPrompt, {
      targetLanguage,
      targetCountry,
      product: {
        name: productName,
        description: productDescription ?? '',
      },
      pages,
    });

    const choice = response.choices[0];

    if (!choice) {
      throw new Error('Product identification: LLM returned no choice');
    }

    if (choice.finish_reason !== 'stop') {
      throw new Error(
        `Product identification: incomplete LLM response (${choice.finish_reason})`,
      );
    }

    const content = stripCodeFence(choice.message.content ?? '').trim();

    if (!content) {
      throw new Error('Product identification: LLM returned empty content');
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error('Product identification: invalid JSON', {
        cause: error,
      });
    }

    return identifiedProductSchema.parse(parsed);
  }
}
