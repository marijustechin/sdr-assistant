import { LLMConfig } from '../types.js';

export const LLM_CONFIG: LLMConfig = {
  model: 'deepseek-v4-pro',
  max_tokens: 3000,
  temperature: 0,
  thinking: {
    type: 'disabled',
  },
};
