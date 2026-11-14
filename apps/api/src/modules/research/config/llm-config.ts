import { LLMConfig } from '../types.js';

export const LLM_CONFIG: LLMConfig = {
  model: 'deepseek-v4-pro',
  max_tokens: 6000,
  temperature: 0,
  thinking: {
    type: 'disabled',
  },
};

export const LLM_CONFIG_FLASH: LLMConfig = {
  model: 'deepseek-flash',
  max_tokens: 6000,
  temperature: 0,
  thinking: {
    type: 'disabled',
  },
};
