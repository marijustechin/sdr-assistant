import { type IdentifiedProduct } from './stages/01-product-identification/product-identification.schema.js';
import { PageTriage } from './stages/02-page-collection/page-triage.schema.js';

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
  highlights: string[];
  snippets: string[];
  summary: string | null;
  content: string | null;
};

export type TermCandidates = {
  productNames: string[];
  categoryNames: string[];
  notes: string;
};

export type TermSearchRun = {
  term: string;
  kind: 'product' | 'category';
  provider: 'exa' | 'deepseek';
  country: string;
  searchedAt: string;
  results: TermSearchResult[];
  error?: string;
};

export type TermSearchResult = {
  url: string;
  title: string | null;
  highlights: string[];
  snippet: string | null;
  summary: string | null;
  content: string | null;
};

export type TriageReport = {
  promptVersion: string;
  createdAt: string;
  targetCountry: string;
  targetLanguage: string;
  product: {
    productName: string;
    categoryName: string;
    generalCategoryName: string;
  };
  results: Array<{
    url: string;
    domain: string;
    title: string | null;
    contentChars: number;
    verdict: PageTriage['verdict'] | null;
    reason: string | null;
    evidence: string | null;
    error: string | null;
  }>;
};

export type ProductIdentificationResponse = {
  product: IdentifiedProduct;
  sourcePages: PageForAssessment[];
};
