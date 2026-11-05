import { Logger } from '@nestjs/common';
import { LLM_CONFIG } from '../../config/llm-config.js';
import { llmChat } from '../../lib/llm-chat.js';
import { PRODUCT_PROFILE_PROMPT } from './product-profile.prompt.js';
import { productProfileSchema } from './product-profile.schema.js';

export async function createProductProfile(userContent: object) {
  const logger = new Logger('ProductProfile');
  const data = await llmChat(LLM_CONFIG, PRODUCT_PROFILE_PROMPT, userContent);

  const profileText = data.choices[0]?.message.content;
  logger.log(`RAW product profile:\n${profileText ?? '(missing content)'}`);

  if (!profileText?.trim()) {
    throw new Error('DeepSeek returned no product profile');
  }

  const parsedJson: unknown = JSON.parse(profileText);
  const profile = productProfileSchema.parse(parsedJson);

  logger.log('Product profile structure validated');
  logger.log(`Parsed product name: ${profile.canonicalName}`);
  logger.log(`Product profile:\n${JSON.stringify(profile, null, 2)}`);

  return profile;
}
