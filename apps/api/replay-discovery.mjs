import { readFile, writeFile } from 'node:fs/promises';

import { SEARCH_EXECUTION_CONFIG } from './dist/modules/research/config/search-execution.config.js';
import { runSearches } from './dist/modules/research/stages/03-discovery/run-searches.js';
import { collectPageCandidates } from './dist/modules/research/stages/04-normalization/collect-page-candidates.js';
import { groupPagesBySite } from './dist/modules/research/stages/04-normalization/group-pages-by-site.js';

const sourceFile = 'discovery-2026-11-06T10-19-42.119Z.json';

const previous = JSON.parse(await readFile(sourceFile, 'utf8'));

const { searchRuns, deferred } = await runSearches(
  previous.plan,
  previous.input.country,
);

const candidates = collectPageCandidates(searchRuns);
const siteGroups = groupPagesBySite(candidates);

const createdAt = new Date().toISOString();
const outputFile = `discovery-${createdAt.replaceAll(':', '-')}.json`;

await writeFile(
  outputFile,
  JSON.stringify(
    {
      ...previous,
      createdAt,
      runMode: 'search-replay',
      basedOn: sourceFile,
      config: {
        ...previous.config,
        search: SEARCH_EXECUTION_CONFIG,
      },
      searchRuns,
      deferredSearches: deferred,
      siteGroups,
    },
    null,
    2,
  ),
  'utf8',
);

console.log({
  outputFile,
  queries: searchRuns.length,
  results: searchRuns.reduce((total, run) => total + run.results.length, 0),
  pages: candidates.length,
  sites: siteGroups.length,
});