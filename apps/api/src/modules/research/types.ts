import { searchExa } from './lib/exa-search.js';
import { SearchTask } from './stages/02-research-plan/prepare-search-execution.js';

export type DeepSeekResponse = {
  choices: {
    message: {
      content: string;
    };
  }[];
};

export type LLMConfig = {
  model: 'deepseek-flash' | 'deepseek-v4-pro';
  max_tokens: number;
  temperature: number;
  thinking: {
    type: 'enabled' | 'disabled';
  };
};

export type SearchRun = Awaited<ReturnType<typeof searchExa>> & {
  task: SearchTask;
};

export type PageCandidate = {
  url: string;
  hostname: string;

  discoveries: {
    search: Omit<SearchRun, 'results'>;
    result: SearchRun['results'][number];
  }[];
};

export type SiteGroup = {
  hostname: string;
  pages: PageCandidate[];
};
