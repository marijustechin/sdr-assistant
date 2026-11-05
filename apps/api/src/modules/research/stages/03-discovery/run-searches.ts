import { Logger } from '@nestjs/common';
import { type ResearchPlan } from '../02-research-plan/research-plan.schema.js';
import { SEARCH_EXECUTION_CONFIG } from '../../config/search-execution.config.js';
import {
  prepareSearchExecution,
  type SearchTask,
} from '../02-research-plan/prepare-search-execution.js';
import { searchExa } from '../../lib/exa-search.js';
import { type SearchRun } from '../../types.js';

export async function runSearches(
  plan: ResearchPlan,
  country: string,
): Promise<{ searchRuns: SearchRun[]; deferred: SearchTask[] }> {
  const logger = new Logger('Discovery');
  logger.log(
    `Search execution config:\n${JSON.stringify(
      SEARCH_EXECUTION_CONFIG,
      null,
      2,
    )}`,
  );

  const execution = prepareSearchExecution(plan);

  logger.log(
    `Search queries: selected=${execution.selected.length}, deferred=${execution.deferred.length}`,
  );

  logger.log(
    `Prepared search execution:\n${JSON.stringify(execution, null, 2)}`,
  );

  ///////// Exa search
  const searchRuns = [];

  for (const task of execution.selected) {
    logger.log(
      `Searching [${task.id}] [${task.kind}] [${task.language}]: ${task.query}`,
    );

    // eslint-disable-next-line no-await-in-loop
    const response = await searchExa(task.query, task.resultsPerQuery, country);

    const run = {
      task,
      ...response,
    };

    searchRuns.push(run);

    logger.log(`Search result [${task.id}]:\n${JSON.stringify(run, null, 2)}`);
  }

  return { searchRuns, deferred: execution.deferred };
}
