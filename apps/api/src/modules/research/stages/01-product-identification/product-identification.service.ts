import { Injectable, Logger } from '@nestjs/common';
import countries from 'i18n-iso-countries';

import { LLM_CONFIG } from '../../config/llm-config.js';
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
  getRandom,
  readJsonFile,
  resolveFileName,
  writeJsonFile,
} from '../../lib/utils.js';

@Injectable()
export class ProductIdentificationService {
  private readonly logger = new Logger('CompanyDiscovery');

  async identify(
    dto: CreateResearchDto,
    onStage?: (stage: string) => Promise<void>,
  ): Promise<ProductIdentificationResponse> {
    const countryCode = countries.getAlpha2Code(dto.country, 'en') ?? 'xx';
    const targetCountry = dto.country;

    const languageByCountry: Record<string, string> = {
      LT: 'Lithuanian',
      LV: 'Latvian',
      EE: 'Estonian',
      DE: 'German',
      HU: 'Hungarian',
      PL: 'Polish',
      ES: 'Spanish',
    };

    const targetLanguage = languageByCountry[countryCode.toUpperCase()];

    if (!targetLanguage) {
      throw new Error(`Target language is not configured for ${targetCountry}`);
    }

    // await onStage?.('1.1 Generating term candidates...');
    // const termCandidates = await this.generateTermCandidates(
    //   targetLanguage,
    //   targetCountry,
    //   dto.name,
    //   dto.description,
    // );

    // await onStage?.('1.2 Searching term candidates...');
    // const searchedTermCandidates = await searchTermCandidates(termCandidates, {
    //   country: targetCountry,
    //   resultsPerQuery: 5,
    // });

    // await onStage?.('1.3 Preparing pages for assessment...');
    // const preparedCandidates = preparePagesForAssessment(
    //   searchedTermCandidates,
    // );

    // await onStage?.('1.4 Identifying the product...');
    // const identifiedProduct = await this.identifyProduct(
    //   preparedCandidates,
    //   targetLanguage,
    //   targetCountry,
    //   dto.name,
    //   dto.description,
    // );

    // /* Laikinas: write data to files */
    // const fileNameForIdentifiedProduct = resolveFileName(
    //   '01.1-identified-product',
    // );
    // await writeJsonFile(fileNameForIdentifiedProduct, identifiedProduct);

    // const fileNameForCandidatePages = resolveFileName(
    //   '01.2-indentification-pages',
    // );
    // await writeJsonFile(fileNameForCandidatePages, preparedCandidates);
    // ///////////Laikinas: pabaiga //////////////////////////
    const fileNameForIdentifiedProduct = resolveFileName(
      'identified-product-dailylentes',
    );
    const identifiedProduct: IdentifiedProduct = await readJsonFile(
      fileNameForIdentifiedProduct,
    );
    const fileNameForCandidatePages = resolveFileName(
      'identification-pages-dailylentes25',
    );
    const preparedCandidates: PageForAssessment[] = await readJsonFile(
      fileNameForCandidatePages,
    );
    const random25Pages = getRandom(preparedCandidates, 25);
    return { product: identifiedProduct, sourcePages: random25Pages };
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

    const response = await llmChat(LLM_CONFIG, systemPrompt, userContent);
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

    const response = await llmChat(LLM_CONFIG, systemPrompt, {
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
