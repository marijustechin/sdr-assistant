export type DeepSeekResponse = {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string | null;
  }>;
};

export type LLMConfig = {
  model: 'deepseek-flash' | 'deepseek-v4-pro';
  max_tokens: number;
  temperature: number;
  thinking: {
    type: 'enabled' | 'disabled';
  };
};
