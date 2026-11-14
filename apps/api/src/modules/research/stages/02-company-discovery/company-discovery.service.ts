import { Injectable, Logger } from '@nestjs/common';
import { type IdentifiedProduct } from '../01-product-identification/product-identification.schema.js';
import {
  writeJsonFile,
  type IdentificationFixture,
} from '../../lib/research-fixture.lib.js';
import { llmChat } from '../../lib/llm-chat.js';
import { LLM_CONFIG, LLM_CONFIG_FLASH } from '../../config/llm-config.js';
import { COMPANY_DISCOVERY_PROMPT } from './company-discovery.prompt.js';
import { resolve } from 'node:path';

@Injectable()
export class CompanyDiscoveryService {
  private readonly logger = new Logger('CompanyDiscovery');

  async discover(
    product: IdentificationFixture,
    onStage?: (stage: string) => Promise<void>,
  ) {
    const userContent = {
      sourceProduct: {
        name: product.input.name,
        description: product.input.description ?? '',
      },
      targetCountry: product.input.country,
      targetLanguage: product.targetLanguage,
      identifiedProduct: product.product,
      pages: product.pages,
    };
    await onStage?.('First discovery step...');
    const discovered = await llmChat(
      { ...LLM_CONFIG_FLASH, max_tokens: 12_000 },
      COMPANY_DISCOVERY_PROMPT,
      userContent,
    );

    await onStage?.('Writing response to file...');
    await writeJsonFile(
      resolve(
        process.cwd(),
        'src',
        'modules',
        'research',
        'stages',
        '01-product-identification',
        'temp',
        'latest-response.json',
      ),
      discovered,
    );
    this.logger.log('Response writed to file');
    return 'completed';
  }
}
