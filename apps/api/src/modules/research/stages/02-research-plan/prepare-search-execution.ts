import { SEARCH_EXECUTION_CONFIG } from '../../config/search-execution.config.js';
import { ResearchPlan } from './research-plan.schema.js';

type DirectionKind = ResearchPlan['directions'][number]['kind'];

export type SearchTask = {
  id: string;
  kind: DirectionKind;
  direction: string;
  language: string;
  query: string;
  resultsPerQuery: number;
};

// Iš kiekvieno sąrašo paeiliui paima po vieną elementą.
function roundRobin<T>(groups: T[][]): T[] {
  const result: T[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < longest; index++) {
    for (const group of groups) {
      const item = group[index];

      if (item !== undefined) {
        result.push(item);
      }
    }
  }

  return result;
}

export function prepareSearchExecution(plan: ResearchPlan) {
  const directions = plan.directions.map((direction, directionIndex) => {
    const byLanguage = new Map<string, SearchTask[]>();

    direction.queries.forEach((query, queryIndex) => {
      const task: SearchTask = {
        id: `d${directionIndex + 1}-q${queryIndex + 1}`,
        kind: direction.kind,
        direction: direction.description,
        language: query.language,
        query: query.query,
        resultsPerQuery: SEARCH_EXECUTION_CONFIG.resultsPerQuery,
      };

      const group = byLanguage.get(task.language) ?? [];

      group.push(task);
      byLanguage.set(task.language, group);
    });

    return {
      kind: direction.kind,
      tasks: roundRobin([...byLanguage.values()]),
    };
  });

  const selected: SearchTask[] = [];
  const deferred: SearchTask[] = [];

  const kinds = ['exact_product', 'product_category', 'application'] as const;

  for (const kind of kinds) {
    const groups = directions
      .filter((direction) => direction.kind === kind)
      .map((direction) => direction.tasks);

    const tasks = roundRobin(groups);
    const limit = SEARCH_EXECUTION_CONFIG.maxQueriesByKind[kind];

    selected.push(...tasks.slice(0, limit));
    deferred.push(...tasks.slice(limit));
  }

  return { selected, deferred };
}
