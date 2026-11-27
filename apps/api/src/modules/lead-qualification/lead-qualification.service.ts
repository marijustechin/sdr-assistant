import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  DEFAULT_LEAD_QUALIFICATION_LIMITS,
  LEAD_QUALIFICATION_POLICY_VERSION,
  LEAD_QUALIFICATION_PROMPT_VERSION,
  LEAD_QUALIFICATION_VERSION,
} from './lead-qualification.constants.js';
import {
  decideQualification,
  duplicateKeys,
  findDuplicateGroups,
  markDuplicate,
  representativeScore,
} from './lead-qualification.decision.js';
import {
  LeadQualificationInputError,
  parseResearchSource,
} from './lead-qualification.input.js';
import {
  LEAD_QUALIFICATION_ENGINE,
  RunBudget,
  type CompanyQualifier,
} from './lead-qualification.engine.js';
import {
  LEAD_QUALIFICATION_STORE,
  type QualificationStore,
  type ResultRecord,
  type RunCounts,
  type RunRecord,
  type SaveResultInput,
} from './lead-qualification.repository.js';
import {
  LostLeaseError,
  RunWideError,
  type EmailContact,
  type EvidenceRef,
  type ExclusionReason,
  type LeadQualificationLimits,
  type PhoneContact,
  type QualificationChecks,
  type QualificationDecision,
  type QualificationDraft,
  type RunUsage,
  type InvalidSourceProfile,
  type SourceCompany,
  type SourceStudy,
} from './lead-qualification.types.js';

export type RunView = {
  id: string;
  researchId: string;
  status: string;
  trigger: string;
  targetCountry: string;
  qualificationVersion: string;
  policyVersion: string;
  promptVersion: string | null;
  inputFingerprint: string;
  companyCount: number;
  processedCount: number;
  acceptedCount: number;
  excludedCount: number;
  technicalFailureCount: number;
  usage: RunUsage;
  startedAt: string | null;
  completedAt: string | null;
  publishedAt: string | null;
  supersededAt: string | null;
  error: string | null;
};

export type ResultView = {
  id: string;
  runId: string;
  source: {
    researchId: string;
    sourceCompanyIndex: number;
    sourceCompanyKey: string;
    domain: string;
    profileHash: string;
    name: string | null;
    legalName: string | null;
    country: string | null;
  };
  decision: QualificationDecision;
  primaryExclusionReason: ExclusionReason | null;
  exclusionReasons: ExclusionReason[];
  technicalFailure: boolean;
  checks: QualificationChecks;
  contacts: {
    emails: EmailContact[];
    phones: PhoneContact[];
  };
  evidenceSources: EvidenceRef[];
  metadata: ResultRecord['metadata'];
  createdAt: string;
  updatedAt: string;
};

export type StartOptions = {
  idempotencyKey?: string;
  trigger?: 'AUTO' | 'MANUAL';
  autoStart?: boolean;
  qualificationVersion?: string;
  policyVersion?: string;
  promptVersion?: string | null;
};

export type ListOptions = {
  decision?: QualificationDecision;
  reason?: ExclusionReason;
  technicalFailure?: boolean;
  q?: string;
  cursor?: string;
  limit?: number;
};

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function runView(run: RunRecord): RunView {
  return {
    id: run.id,
    researchId: run.researchId,
    status: run.status,
    trigger: run.trigger,
    targetCountry: run.targetCountry,
    qualificationVersion: run.qualificationVersion,
    policyVersion: run.policyVersion,
    promptVersion: run.promptVersion,
    inputFingerprint: run.inputFingerprint,
    companyCount: run.companyCount,
    processedCount: run.processedCount,
    acceptedCount: run.acceptedCount,
    excludedCount: run.excludedCount,
    technicalFailureCount: run.technicalFailureCount,
    usage: run.usage,
    startedAt: toIso(run.startedAt),
    completedAt: toIso(run.completedAt),
    publishedAt: toIso(run.publishedAt),
    supersededAt: toIso(run.supersededAt),
    error: run.error === null ? null : 'The qualification run did not complete.',
  };
}

function resultView(result: ResultRecord, researchId: string): ResultView {
  return {
    id: result.id,
    runId: result.runId,
    source: {
      researchId,
      sourceCompanyIndex: result.sourceCompanyIndex,
      sourceCompanyKey: result.sourceCompanyKey,
      domain: result.domain,
      profileHash: result.profileHash,
      name: result.companyName,
      legalName: result.legalName,
      country: result.country,
    },
    decision: result.decision,
    primaryExclusionReason: result.primaryExclusionReason,
    exclusionReasons: result.exclusionReasons,
    technicalFailure: result.technicalFailure,
    checks: result.checks,
    contacts: result.contacts,
    evidenceSources: result.evidenceSources,
    metadata: result.metadata,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

function counts(results: Iterable<ResultRecord>): RunCounts {
  let processedCount = 0;
  let acceptedCount = 0;
  let excludedCount = 0;
  let technicalFailureCount = 0;

  for (const result of results) {
    processedCount += 1;
    if (result.decision === 'ACCEPTED') acceptedCount += 1;
    else excludedCount += 1;
    if (result.technicalFailure) technicalFailureCount += 1;
  }

  return {
    processedCount,
    acceptedCount,
    excludedCount,
    technicalFailureCount,
  };
}

function emptyCheck(): {
  status: 'NOT_EVALUATED';
  reason: null;
  evidence: EvidenceRef[];
  detail: null;
  technicalFailure: false;
} {
  return {
    status: 'NOT_EVALUATED',
    reason: null,
    evidence: [],
    detail: null,
    technicalFailure: false,
  };
}

function processingFailureDraft(startedAt: Date): QualificationDraft {
  const completedAt = new Date();
  const website: QualificationChecks['website'] = {
    status: 'UNKNOWN',
    reason: 'PROCESSING_FAILED',
    evidence: [],
    detail: 'Company processing failed technically.',
    technicalFailure: true,
    finalUrl: null,
    https: false,
    certificateValid: false,
    httpStatus: null,
    redirects: 0,
    temporary: true,
    failureKind: 'processing',
    bodyText: '',
  };
  const checks: QualificationChecks = {
    website,
    activity: emptyCheck(),
    geography: {
      ...emptyCheck(),
      addressCountry: null,
      phoneCountries: [],
      localPresence: false,
      foreignPresence: false,
      conflict: false,
      discoveryAttempted: false,
    },
    relevance: {
      ...emptyCheck(),
      matchedOfferIds: [],
      aOffers: 0,
      bOffers: 0,
      targetMarketOffers: 0,
    },
    email: { ...emptyCheck(), addresses: [] },
    duplicate: {
      status: 'PASS',
      reason: null,
      evidence: [],
      detail: 'No duplicate identity detected in the run.',
      technicalFailure: false,
      canonicalCompanyKey: null,
      matchedOn: [],
    },
  };

  return {
    decision: 'EXCLUDED',
    primaryExclusionReason: 'PROCESSING_FAILED',
    exclusionReasons: ['PROCESSING_FAILED'],
    checks,
    contacts: { emails: [], phones: [] },
    evidenceSources: [],
    metadata: {
      algorithmVersion: LEAD_QUALIFICATION_VERSION,
      policyVersion: LEAD_QUALIFICATION_POLICY_VERSION,
      promptVersion: null,
      semanticModel: null,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      fetches: 0,
      searches: 0,
      llmCalls: 0,
      promptTokens: null,
      completionTokens: null,
      retries: 0,
      limited: false,
      technicalFailure: true,
      error: 'Company processing failed technically.',
    },
  };
}

function invalidCompany(profile: InvalidSourceProfile): SourceCompany {
  return {
    sourceIndex: profile.sourceIndex,
    key: `invalid:${profile.sourceIndex}`,
    domain: `invalid:${profile.sourceIndex}`,
    registrableDomain: null,
    name: null,
    legalName: null,
    code: null,
    vat: null,
    address: null,
    city: null,
    country: null,
    emails: [],
    phones: [],
    sources: [],
    offers: [],
    profileHash: profile.profileHash,
  };
}

function boundDraftSize(
  draft: QualificationDraft,
  limit: number,
): QualificationDraft | null {
  const candidate: QualificationDraft = {
    ...draft,
    contacts: {
      emails: [...draft.contacts.emails],
      phones: [...draft.contacts.phones],
    },
    evidenceSources: [...draft.evidenceSources],
  };
  const size = (value: QualificationDraft): number =>
    Buffer.byteLength(JSON.stringify(value));

  while (size(candidate) > limit && candidate.evidenceSources.length > 0) {
    candidate.evidenceSources.pop();
  }
  while (size(candidate) > limit && candidate.contacts.emails.length > 0) {
    candidate.contacts.emails.pop();
  }
  while (size(candidate) > limit && candidate.contacts.phones.length > 0) {
    candidate.contacts.phones.pop();
  }
  return size(candidate) <= limit ? candidate : null;
}

function draftFromResult(result: ResultRecord): QualificationDraft {
  return {
    decision: result.decision,
    primaryExclusionReason: result.primaryExclusionReason,
    exclusionReasons: result.exclusionReasons,
    checks: result.checks,
    contacts: result.contacts,
    evidenceSources: result.evidenceSources,
    metadata: result.metadata,
  };
}

function saveInput(
  runId: string,
  source: {
    sourceCompanyIndex: number;
    sourceCompanyKey: string;
    domain: string;
    companyName: string | null;
    legalName: string | null;
    country: string | null;
    profileHash: string;
  },
  draft: QualificationDraft,
): SaveResultInput {
  return {
    runId,
    sourceCompanyIndex: source.sourceCompanyIndex,
    sourceCompanyKey: source.sourceCompanyKey,
    domain: source.domain,
    companyName: source.companyName,
    legalName: source.legalName,
    country: source.country,
    profileHash: source.profileHash,
    decision: draft.decision,
    primaryExclusionReason: draft.primaryExclusionReason,
    exclusionReasons: draft.exclusionReasons,
    technicalFailure: draft.metadata.technicalFailure,
    checks: draft.checks,
    contacts: draft.contacts,
    evidenceSources: draft.evidenceSources,
    metadata: draft.metadata,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  let failure: unknown = null;

  const runWorker = async (): Promise<void> => {
    for (;;) {
      if (failure !== null) return;
      const index = next;
      next += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        failure = error;
        return;
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, items.length)) },
      () => runWorker(),
    ),
  );

  if (failure !== null) throw failure;
  return results;
}

@Injectable()
export class LeadQualificationService {
  private readonly limits: LeadQualificationLimits =
    DEFAULT_LEAD_QUALIFICATION_LIMITS;

  constructor(
    @Inject(LEAD_QUALIFICATION_STORE)
    private readonly store: QualificationStore,
    @Inject(LEAD_QUALIFICATION_ENGINE)
    private readonly qualifier: CompanyQualifier,
  ) {}

  async start(researchId: string, options: StartOptions = {}): Promise<RunView> {
    const research = await this.store.findResearch(researchId);
    if (research === null) throw new NotFoundException('Research not found.');

    let study: SourceStudy;
    try {
      study = parseResearchSource(research, this.limits.maxSourceBytes);
    } catch (error) {
      if (error instanceof LeadQualificationInputError) {
        throw new UnprocessableEntityException({
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }

    if (study.rawCompanyCount > this.limits.maxCompaniesPerRun) {
      throw new UnprocessableEntityException({
        code: 'TOO_MANY_COMPANIES',
        message: 'The source exceeds the maximum company count.',
      });
    }

    const startKey = options.idempotencyKey?.trim() || null;
    if (startKey !== null) {
      const previous = await this.store.findRunByStartKey(researchId, startKey);
      if (previous !== null) return runView(previous);
    }

    const active = await this.store.findActiveRun(researchId);
    if (active !== null) {
      throw new ConflictException(
        'An active lead-qualification run already exists for this research.',
      );
    }

    let run: RunRecord;
    try {
      run = await this.store.createRun({
        researchId,
        trigger: options.trigger ?? 'MANUAL',
        targetCountry: study.targetCountry,
        qualificationVersion:
          options.qualificationVersion ?? LEAD_QUALIFICATION_VERSION,
        policyVersion:
          options.policyVersion ?? LEAD_QUALIFICATION_POLICY_VERSION,
        promptVersion:
          options.promptVersion ?? LEAD_QUALIFICATION_PROMPT_VERSION,
        inputFingerprint: study.inputFingerprint,
        sourceResultSchemaVersion: study.resultSchemaVersion,
        companyCount: study.rawCompanyCount,
        startKey,
      });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      if (startKey !== null) {
        const existing = await this.store.findRunByStartKey(researchId, startKey);
        if (existing !== null) return runView(existing);
      }
      const activeConflict = await this.store.findActiveRun(researchId);
      if (activeConflict !== null) {
        throw new ConflictException(
          'An active lead-qualification run already exists for this research.',
        );
      }
      throw new ConflictException('A conflicting qualification run already exists.');
    }

    if (options.autoStart !== false) {
      void this.execute(run.id).catch(() => undefined);
    }

    return runView(run);
  }

  async getRun(runId: string): Promise<RunView> {
    const run = await this.store.findRun(runId);
    if (run === null) throw new NotFoundException('Qualification run not found.');
    return runView(run);
  }

  async getLatest(researchId: string): Promise<RunView> {
    const run = await this.store.findLatestRun(researchId);
    if (run === null) {
      throw new NotFoundException('No qualification run exists for this research.');
    }
    return runView(run);
  }

  async getPublished(researchId: string): Promise<RunView> {
    const run = await this.store.findPublishedRun(researchId);
    if (run === null) {
      throw new NotFoundException('No published qualification run exists.');
    }
    return runView(run);
  }

  async resume(runId: string): Promise<RunView> {
    const run = await this.store.findRun(runId);
    if (run === null) throw new NotFoundException('Qualification run not found.');
    if (run.status === 'COMPLETED') {
      throw new ConflictException('A completed qualification run cannot be resumed.');
    }

    void this.execute(runId).catch(() => undefined);
    return runView(run);
  }

  async listResults(
    runId: string,
    options: ListOptions = {},
  ): Promise<{ items: ResultView[]; nextCursor: string | null }> {
    const run = await this.store.findRun(runId);
    if (run === null) throw new NotFoundException('Qualification run not found.');
    const page = await this.store.listResults(runId, {
      decision: options.decision ?? 'ACCEPTED',
      reason: options.reason,
      technicalFailure: options.technicalFailure,
      q: options.q,
      cursor: options.cursor,
      limit: Math.max(1, Math.min(100, options.limit ?? 50)),
    });
    return {
      items: page.items.map((result) => resultView(result, run.researchId)),
      nextCursor: page.nextCursor,
    };
  }

  async getResult(runId: string, resultId: string): Promise<ResultView> {
    const run = await this.store.findRun(runId);
    if (run === null) throw new NotFoundException('Qualification run not found.');
    const result = await this.store.getResult(runId, resultId);
    if (result === null) {
      throw new NotFoundException('Qualification result not found.');
    }
    return resultView(result, run.researchId);
  }

  async execute(runId: string): Promise<RunView> {
    const run = await this.store.findRun(runId);
    if (run === null) throw new NotFoundException('Qualification run not found.');
    if (run.status === 'COMPLETED') return runView(run);

    const token = randomUUID();
    const claimed = await this.store.claimRun(run.id, token, this.limits.leaseMs);
    if (!claimed) {
      throw new ConflictException(
        'The qualification run is active under another owner or cannot be claimed.',
      );
    }

    const startedAt = new Date();
    let leaseHeld = true;
    const heartbeat = setInterval(() => {
      void this.store
        .heartbeat(run.id, token, this.limits.leaseMs)
        .then((held) => {
          if (!held) leaseHeld = false;
        })
        .catch(() => {
          leaseHeld = false;
        });
    }, this.limits.heartbeatMs);
    heartbeat.unref();

    try {
      const research = await this.store.findResearch(run.researchId);
      if (research === null) {
        throw new UnprocessableEntityException('Research no longer exists.');
      }

      let study: SourceStudy;
      try {
        study = parseResearchSource(research, this.limits.maxSourceBytes);
      } catch (error) {
        if (error instanceof LeadQualificationInputError) {
          throw new UnprocessableEntityException({
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }

      if (study.inputFingerprint !== run.inputFingerprint) {
        throw new RunWideError(
          'INPUT_CHANGED',
          'The research input changed after the run was created.',
        );
      }
      if (study.rawCompanyCount > this.limits.maxCompaniesPerRun) {
        throw new RunWideError(
          'TOO_MANY_COMPANIES',
          'The company count changed after the run was created.',
        );
      }

      const existing = await this.store.findResultsForRun(run.id);
      const byIndex = new Map<number, ResultRecord>();
      for (const result of existing) byIndex.set(result.sourceCompanyIndex, result);

      const budget = new RunBudget(this.limits, run.usage);

      for (const profile of study.invalidProfiles) {
        const current = byIndex.get(profile.sourceIndex);
        if (current !== undefined && !current.technicalFailure) continue;
        const company = invalidCompany(profile);
        const failure = processingFailureDraft(startedAt);
        const saved = await this.store.saveResult(
          saveInput(run.id, {
            sourceCompanyIndex: company.sourceIndex,
            sourceCompanyKey: company.key,
            domain: company.domain,
            companyName: null,
            legalName: null,
            country: null,
            profileHash: company.profileHash,
          }, failure),
          token,
        );
        byIndex.set(company.sourceIndex, saved);
        const updated = await this.store.updateProgress(
          run.id,
          token,
          counts(byIndex.values()),
          budget.usage,
        );
        if (!updated) throw new LostLeaseError();
      }

      const pending = study.companies.filter((company) => {
        const current = byIndex.get(company.sourceIndex);
        return current === undefined || current.technicalFailure;
      });

      await mapWithConcurrency(
        pending,
        this.limits.websiteConcurrency,
        async (company) => {
          if (!leaseHeld) throw new LostLeaseError();
          if (Date.now() - startedAt.getTime() > this.limits.runDurationMs) {
            throw new RunWideError(
              'RUN_DURATION_EXCEEDED',
              'The qualification run exceeded its duration limit.',
            );
          }

          let draft: QualificationDraft;
          try {
            draft = await this.qualifier.qualify(
              company,
              { study, limits: this.limits, startedAt },
              budget,
            );
          } catch (error) {
            if (error instanceof RunWideError || error instanceof LostLeaseError) {
              throw error;
            }
            draft = processingFailureDraft(startedAt);
          }

          const bounded = boundDraftSize(
            draft,
            Math.max(1_024, this.limits.maxResultJsonBytes - 2_048),
          );
          draft = bounded ?? processingFailureDraft(startedAt);
          const saved = await this.store.saveResult(
            saveInput(
              run.id,
              {
                sourceCompanyIndex: company.sourceIndex,
                sourceCompanyKey: company.key,
                domain: company.domain,
                companyName: company.name,
                legalName: company.legalName,
                country: company.country,
                profileHash: company.profileHash,
              },
              draft,
            ),
            token,
          );
          byIndex.set(company.sourceIndex, saved);

          const updated = await this.store.updateProgress(
            run.id,
            token,
            counts(byIndex.values()),
            budget.usage,
          );
          if (!updated) throw new LostLeaseError();
        },
      );

      await this.reconcileDuplicates(run, study, byIndex, token, budget.usage);
      const all = [...byIndex.values()];
      if (all.length !== study.rawCompanyCount) {
        throw new RunWideError(
          'INCOMPLETE_RESULTS',
          'The qualification run did not persist every company.',
        );
      }

      const completed = await this.store.completeAndPublish(
        run.id,
        token,
        counts(all),
        budget.usage,
      );
      if (!completed) throw new LostLeaseError();

      const current = await this.store.findRun(run.id);
      return runView(current ?? run);
    } catch (error) {
      if (error instanceof LostLeaseError) {
        await this.store.markInterrupted(
          run.id,
          token,
          'Execution lease was lost.',
        );
        throw new ConflictException(
          'The qualification run lease was lost and the run was interrupted.',
        );
      }

      await this.store.failRun(
        run.id,
        token,
        error instanceof Error ? error.name : 'Qualification run failed.',
      );
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async reconcileDuplicates(
    run: RunRecord,
    study: SourceStudy,
    results: Map<number, ResultRecord>,
    token: string,
    usage: RunUsage,
  ): Promise<void> {
    const groups = findDuplicateGroups(study.companies);

    for (const group of groups) {
      const companies = study.companies.filter((company) =>
        group.companyKeys.includes(company.key),
      );
      const accepted = companies
        .map((company) => results.get(company.sourceIndex))
        .filter(
          (record): record is ResultRecord =>
            record !== undefined &&
            record.decision === 'ACCEPTED' &&
            !record.technicalFailure,
        );

      if (accepted.length < 2) continue;

      accepted.sort((left, right) => {
        const difference =
          representativeScore(draftFromResult(right)) -
          representativeScore(draftFromResult(left));
        return difference !== 0
          ? difference
          : left.domain.localeCompare(right.domain);
      });
      const representative = accepted[0];
      if (representative === undefined) continue;

      for (const duplicate of accepted.slice(1)) {
        const representativeCompany = companies.find(
          (company) => company.sourceIndex === representative.sourceCompanyIndex,
        );
        const duplicateCompany = companies.find(
          (company) => company.sourceIndex === duplicate.sourceCompanyIndex,
        );
        const shared =
          representativeCompany && duplicateCompany
            ? duplicateKeys(representativeCompany).filter((key) =>
                duplicateKeys(duplicateCompany).includes(key),
              )
            : [];
        const marked = markDuplicate(
          draftFromResult(duplicate),
          representative.sourceCompanyKey,
          [...new Set(shared.map((key) => key.split(':')[0] ?? 'identity'))],
        );
        const updated = await this.store.updateResult(
          {
            ...saveInput(
              run.id,
              {
                sourceCompanyIndex: duplicate.sourceCompanyIndex,
                sourceCompanyKey: duplicate.sourceCompanyKey,
                domain: duplicate.domain,
                companyName: duplicate.companyName,
                legalName: duplicate.legalName,
                country: duplicate.country,
                profileHash: duplicate.profileHash,
              },
              marked,
            ),
            id: duplicate.id,
          },
          token,
        );
        results.set(duplicate.sourceCompanyIndex, updated);
      }

      const updated = await this.store.updateProgress(
        run.id,
        token,
        counts(results.values()),
        usage,
      );
      if (!updated) throw new LostLeaseError();
    }
  }
}
