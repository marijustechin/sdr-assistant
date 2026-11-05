import { Logger } from '@nestjs/common';
import { llmChat } from '../../lib/llm-chat.js';
import { ProductProfile } from '../01-product-profile/product-profile.schema.js';
import { ResearchPlan, researchPlanSchema } from './research-plan.schema.js';
import { LLM_CONFIG } from '../../config/llm-config.js';
import { RESEARCH_PLAN_PROMPT } from './research-plan.prompt.js';

export async function createResearchPlan(
  profile: ProductProfile,
  country: string,
): Promise<ResearchPlan> {
  const logger = new Logger('ResearchPlan');
  logger.log(`Creating research plan for ${country}`);

  const data = await llmChat(LLM_CONFIG, RESEARCH_PLAN_PROMPT, {
    profile,
    country,
  });

  const planText = data.choices[0]?.message.content;

  logger.log(`RAW research plan:\n${planText ?? '(missing content)'}`);

  if (!planText?.trim()) {
    throw new Error('DeepSeek returned no research plan');
  }

  const parsedJson: unknown = JSON.parse(planText);
  const plan = researchPlanSchema.parse(parsedJson);

  logger.log('Research plan structure validated');

  return plan;
}
