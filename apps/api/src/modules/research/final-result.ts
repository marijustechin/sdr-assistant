import { createHash } from 'node:crypto';

import type { CompanyProfile } from './stages/04-company-profiling/company-profiling.types.js';
import type { ProfilingBatchSummary } from './stages/04-company-profiling/company-profiling.batch.js';

/**
 * Versioned contract for the persisted final result of a completed full research.
 *
 * One construction function serves both completion paths so they cannot drift:
 * `ResearchService.runResearch` and `ResearchService.runResume` pass the stage-04
 * result they already hold to `buildFinalResearchResult`, then persist it together
 * with the COMPLETED state in a single token-guarded write.
 *
 * Historical rows keep their own older envelopes. Readers must discriminate by
 * key presence and must not require `schemaVersion` for them.
 */
export const FINAL_RESULT_SCHEMA_VERSION = 1;
export const FINAL_RESULT_COMPLETED_THROUGH = '04-company-profiling';

/**
 * The complete real stage-04 output of the run, unchanged.
 *
 * `companies` is the stage-04 `CompanyProfile[]` exactly as produced: company
 * identity and legal data, contacts, offers, prices, market evidence, source URLs,
 * dynamic trait keys and every existing optional/nullable/nested field. Nothing is
 * filtered, deduplicated, reclassified or regenerated.
 *
 * `summary` is the stage-04 batch summary (per-run counts). `resultsPerQuery` is
 * the run's configured query depth, available on the normal path only.
 */
export type FinalResearchResult = {
  schemaVersion: typeof FINAL_RESULT_SCHEMA_VERSION;
  completedThrough: typeof FINAL_RESULT_COMPLETED_THROUGH;
  companies: CompanyProfile[];
  summary?: ProfilingBatchSummary;
  resultsPerQuery?: number;
};

/** The part of the stage-04 result the final-result contract consumes. */
export type FinalResultSource = {
  domains: CompanyProfile[];
  summary?: ProfilingBatchSummary | null;
};

/**
 * Builds the persisted final result from the stage-04 output that the completion
 * path already holds.
 *
 * A missing profile list is a hard error, not an empty success: a run may complete
 * with zero companies (the stage genuinely found none), but it may never be marked
 * completed through stage 04 without the stage-04 result. Optional metadata is added
 * only when it is genuinely available; no field is invented.
 */
export function buildFinalResearchResult(input: {
  profiling: FinalResultSource | null | undefined;
  resultsPerQuery?: number | null;
}): FinalResearchResult {
  const profiling = input.profiling;

  if (!profiling || !Array.isArray(profiling.domains)) {
    throw new Error(
      'Final research result requires the stage-04 company profile list; refusing to persist a completed research without it.',
    );
  }

  const result: FinalResearchResult = {
    schemaVersion: FINAL_RESULT_SCHEMA_VERSION,
    completedThrough: FINAL_RESULT_COMPLETED_THROUGH,
    companies: profiling.domains,
  };

  const summary = profiling.summary;
  if (summary !== null && summary !== undefined && typeof summary === 'object' && !Array.isArray(summary)) {
    result.summary = summary;
  }

  if (
    typeof input.resultsPerQuery === 'number' &&
    Number.isFinite(input.resultsPerQuery)
  ) {
    result.resultsPerQuery = input.resultsPerQuery;
  }

  return result;
}

/** Read-only description of one candidate historical research row. */
export type RecoveryTarget = {
  jobId: string;
  status: string;
  /** The persisted `researches.result` value as stored, untouched. */
  result: unknown;
  /** Number of domains in the row's persisted stage-03 result, or null if absent. */
  stage03DomainCount: number | null;
};

/** Read-only description of the historical stage-04 artifact to recover. */
export type RecoveryArtifact = {
  /** SHA-256 of the artifact file, as read from disk. */
  sha256: string;
  /** The artifact's stage-04 profile list. */
  domains: CompanyProfile[];
  summary?: ProfilingBatchSummary | null;
};

export type HistoricalRecoveryPlan = {
  jobId: string;
  artifactSha256: string;
  finalResult: FinalResearchResult;
};

/** Recursively sorted JSON, so two structurally equal values always serialize identically. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

/**
 * Fingerprint of the exact pre-recovery target state that the owner approves before
 * execution. It binds the job id, status, persisted result and stage-03 domain count, so
 * a later change to any of them invalidates the approval.
 */
export function targetRecoveryFingerprint(target: RecoveryTarget): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        jobId: target.jobId,
        status: target.status,
        result: target.result,
        stage03DomainCount: target.stage03DomainCount,
      }),
    )
    .digest('hex');
}

/**
 * Guard layer of the prepared historical recovery procedure (SDR-006A §9–§19).
 *
 * Pure: it performs no I/O and never touches the database. It either returns the exact
 * final result that a separately authorized one-row compare-and-set would write, or it
 * throws. Every refusal is a reason the recovery must not proceed:
 *
 * - the row is not the confirmed target;
 * - the row is not a completed research;
 * - the artifact is not the archived file that was fingerprinted;
 * - the artifact is empty or its profile count is not the confirmed count;
 * - the row's result is not an object;
 * - the row already carries a `companies` field — non-empty profiles, or a legitimate
 *   empty array, which is a valid completion and is never treated as missing data;
 * - the row's result is not structurally identical (canonical JSON) to the verified
 *   pre-recovery result, so a changed or already recovered record is refused;
 * - the row's completion label is not the historical stage-04 completion;
 * - the artifact and the row disagree on the domain set size (correlation failure);
 * - the target fingerprint does not match the approved baseline.
 */
export function prepareHistoricalResultRecovery(input: {
  expectedJobId: string;
  expectedOriginalResult: unknown;
  expectedTargetFingerprint: string;
  expectedArtifactSha256: string;
  expectedCompanyCount: number;
  target: RecoveryTarget;
  artifact: RecoveryArtifact;
}): HistoricalRecoveryPlan {
  const { target, artifact } = input;

  if (target.jobId !== input.expectedJobId) {
    throw new Error('Recovery refused: target job id does not match the confirmed research');
  }

  if (target.status !== 'COMPLETED') {
    throw new Error('Recovery refused: target research is not COMPLETED');
  }

  if (artifact.sha256 !== input.expectedArtifactSha256) {
    throw new Error('Recovery refused: artifact fingerprint does not match the archived file');
  }

  if (!Array.isArray(artifact.domains) || artifact.domains.length === 0) {
    throw new Error('Recovery refused: artifact contains no company profiles');
  }

  if (artifact.domains.length !== input.expectedCompanyCount) {
    throw new Error('Recovery refused: artifact profile count does not match the confirmed count');
  }

  const existing =
    target.result !== null && typeof target.result === 'object' && !Array.isArray(target.result)
      ? (target.result as Record<string, unknown>)
      : null;

  if (existing === null) {
    throw new Error('Recovery refused: target research has no persisted result object');
  }

  if (Object.prototype.hasOwnProperty.call(existing, 'companies')) {
    const companies = existing.companies;
    if (Array.isArray(companies) && companies.length === 0) {
      throw new Error(
        'Recovery refused: target already contains an empty companies array, which is a valid completed result and must not be rewritten',
      );
    }
    throw new Error('Recovery refused: target research already contains company profiles');
  }

  if (canonicalJson(existing) !== canonicalJson(input.expectedOriginalResult)) {
    throw new Error(
      'Recovery refused: target result does not match the verified pre-recovery result',
    );
  }

  if (existing.completedThrough !== FINAL_RESULT_COMPLETED_THROUGH) {
    throw new Error(
      'Recovery refused: target result envelope is not the historical stage-04 completion',
    );
  }

  if (target.stage03DomainCount !== artifact.domains.length) {
    throw new Error(
      'Recovery refused: target stage-03 domain count does not match the artifact profile count',
    );
  }

  if (targetRecoveryFingerprint(target) !== input.expectedTargetFingerprint) {
    throw new Error('Recovery refused: target fingerprint does not match the approved baseline');
  }

  const finalResult = buildFinalResearchResult({
    profiling: { domains: artifact.domains, summary: artifact.summary ?? null },
    resultsPerQuery:
      typeof existing.resultsPerQuery === 'number' ? existing.resultsPerQuery : undefined,
  });

  return {
    jobId: target.jobId,
    artifactSha256: artifact.sha256,
    finalResult,
  };
}
