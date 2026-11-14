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

export type PageForAssessment = {
  url: string;
  canonicalUrl: string;
  domain: string;
  title: string | null;
  foundBy: Array<{
    term: string;
    kind: 'product' | 'category';
    provider: 'exa' | 'deepseek';
  }>;
  foundCount: number;
  highlights: string[];
  snippets: string[];
  summary: string | null;
  content: string | null;
};
