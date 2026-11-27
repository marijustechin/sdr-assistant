import {
  LeadQualificationService,
  type ListOptions,
  type ResultView,
  type RunView,
  type StartOptions,
} from '../../src/modules/lead-qualification/lead-qualification.service.js';
import type { CompanyQualifier, RunBudget } from '../../src/modules/lead-qualification/lead-qualification.engine.js';
import type { QualificationStore, ResearchRecord, ResultRecord, RunCounts, RunRecord, SaveResultInput } from '../../src/modules/lead-qualification/lead-qualification.repository.js';
import {
  LostLeaseError,
  RunWideError,
  type ActivityCheck,
  type DiscoveryResult,
  type EmailContact,
  type ExclusionReason,
  type GeographicCheck,
  type LeadQualificationLimits,
  type PhoneContact,
  type QualificationChecks,
  type QualificationContext,
  type QualificationDraft,
  type RelevanceCheck,
  type SemanticAssessment,
  type SemanticRequest,
  type SourceCompany,
  type SourceStudy,
  type WebsiteCheck,
} from '../../src/modules/lead-qualification/lead-qualification.types.js';

export function sourceCompany(
  overrides: Partial<SourceCompany> = {},
): SourceCompany {
  const domain = overrides.domain ?? 'alpha.test';
  return {
    sourceIndex: 0,
    key: domain,
    domain,
    registrableDomain: domain,
    name: 'Alpha UAB',
    legalName: `Alpha UAB ${domain}`,
    code: null,
    vat: null,
    address: 'Test Street 1',
    city: 'Vilnius',
    country: 'Lithuania',
    emails: [
      {
        value: `info@${domain}`,
        label: 'general',
        sourceUrl: `https://${domain}/contact`,
      },
    ],
    phones: [
      {
        value: '+37060000000',
        normalised: '+37060000000',
        label: 'sales',
        sourceUrl: `https://${domain}/contact`,
      },
    ],
    sources: [`https://${domain}/`],
    offers: [
      {
        id: 'offer-1',
        item: 'Researched product',
        verdict: 'a',
        sourceUrl: `https://${domain}/product`,
      },
    ],
    profileHash: `hash-${domain}`,
    ...overrides,
  };
}

export function persistedProfile(company: SourceCompany): object {
  const contactUrl = `https://${company.domain}/contact`;
  return {
    domain: company.domain,
    registrableDomain: company.registrableDomain,
    status: 'profiled',
    company: {
      name: company.name,
      legalName: company.legalName,
      code: company.code,
      vat: company.vat,
      address: company.address,
      city: company.city,
      country: company.country,
      emails: company.emails.map((email) => ({
        value: email.value,
        label:
          email.label === 'sales' || email.label === 'general'
            ? email.label
            : null,
        sourceUrl: email.sourceUrl ?? contactUrl,
      })),
      phones: company.phones.map((phone) => ({
        value: phone.value,
        normalised: phone.normalised,
        label:
          phone.label === 'sales' || phone.label === 'general'
            ? phone.label
            : null,
        sourceUrl: phone.sourceUrl ?? contactUrl,
      })),
      contactFormUrl: null,
      sources: company.sources,
    },
    offers: company.offers.map((offer, index) => ({
      id: offer.id ?? `offer-${index + 1}`,
      item: offer.item,
      verdict: offer.verdict ?? 'a',
      traits: {},
      pageIds: [],
      sourceUrl: offer.sourceUrl ?? `https://${company.domain}/product`,
      marketFrom03: {
        status: 'unclear',
        note: null,
        sourceUrl: offer.sourceUrl ?? `https://${company.domain}/product`,
        quote: null,
      },
      market: {
        status: 'unclear',
        resolvedBy: 'none',
        basis: 'none',
        evidence: [],
        channels: {
          delivery: 'unknown',
          pickup: 'unknown',
          purchase: 'unknown',
        },
        conflict: false,
      },
      prices: [],
    })),
    usage: {
      llmCalls: 1,
      promptTokens: 10,
      completionTokens: 5,
      fetches: 0,
      fetchCredits: null,
      durationMs: 5,
    },
  };
}

export function researchRecord(
  companies: SourceCompany[],
  overrides: Partial<ResearchRecord> = {},
): ResearchRecord {
  return {
    id: 'research-1',
    status: 'COMPLETED',
    country: 'Lithuania',
    productName: 'Researched product',
    productDescription: 'A synthetic product used by tests.',
    result: {
      schemaVersion: 1,
      completedThrough: '04-company-profiling',
      companies: companies.map(persistedProfile),
    },
    ...overrides,
  };
}

export function websiteCheck(
  overrides: Partial<WebsiteCheck> = {},
): WebsiteCheck {
  return {
    status: 'PASS',
    reason: null,
    evidence: [
      {
        url: 'https://alpha.test/',
        kind: 'website',
        quote: null,
        source: 'http',
        observedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    detail: 'Operational website.',
    technicalFailure: false,
    finalUrl: 'https://alpha.test/',
    https: true,
    certificateValid: true,
    httpStatus: 200,
    redirects: 0,
    temporary: false,
    failureKind: null,
    bodyText:
      'Alpha UAB contact phone email product catalogue shop about company. We sell products and accept orders. Test Street 1, Vilnius, Lithuania.',
    ...overrides,
  };
}

export function discoveryResult(
  overrides: Partial<DiscoveryResult> = {},
): DiscoveryResult {
  return {
    emails: [],
    phones: [],
    countryCodes: [],
    localAddressEvidence: [],
    foreignAddressEvidence: [],
    foreignAddressCountries: [],
    localBranchEvidence: [],
    pages: [],
    evidence: [],
    fetches: 0,
    searches: 0,
    attemptedFetches: 0,
    successfulFetches: 0,
    technicalFailure: false,
    limitReached: false,
    ...overrides,
  };
}

export function semanticAssessment(
  overrides: Partial<SemanticAssessment> = {},
): SemanticAssessment {
  return {
    activity: 'active',
    activityEvidence: [
      {
        quote: 'Alpha UAB product catalogue shop about company',
        sourceUrl: 'https://alpha.test/',
      },
    ],
    geography: 'local',
    geographyEvidence: [
      {
        kind: 'address',
        quote: 'Alpha UAB Test Street 1 Vilnius',
        sourceUrl: 'https://alpha.test/',
      },
    ],
    localBranch: null,
    relevance: 'relevant',
    relevanceEvidence: [
      {
        offerId: 'offer-1',
        quote: 'Researched product',
        sourceUrl: 'https://alpha.test/',
      },
    ],
    notes: null,
    ...overrides,
  };
}

export function acceptedDraft(company: SourceCompany): QualificationDraft {
  const checks: QualificationChecks = {
    website: websiteCheck(),
    activity: {
      status: 'PASS',
      reason: null,
      evidence: [],
      detail: 'Active.',
      technicalFailure: false,
    },
    geography: {
      status: 'PASS',
      reason: null,
      evidence: [],
      detail: 'Local.',
      technicalFailure: false,
      addressCountry: 'LT',
      phoneCountries: ['LT'],
      localPresence: true,
      foreignPresence: false,
      conflict: false,
      discoveryAttempted: false,
    },
    relevance: {
      status: 'PASS',
      reason: null,
      evidence: [],
      detail: 'Relevant.',
      technicalFailure: false,
      matchedOfferIds: ['offer-1'],
      aOffers: 1,
      bOffers: 0,
      targetMarketOffers: 0,
    },
    email: {
      status: 'PASS',
      reason: null,
      evidence: [],
      detail: 'Email.',
      technicalFailure: false,
      addresses: [
        {
          value: `info@${company.domain}`,
          role: 'general',
          sourceUrl: `https://${company.domain}/contact`,
          discoveredBy: 'stage04',
        },
      ],
    },
    duplicate: {
      status: 'PASS',
      reason: null,
      evidence: [],
      detail: 'Unique.',
      technicalFailure: false,
      canonicalCompanyKey: null,
      matchedOn: [],
    },
  };

  return {
    decision: 'ACCEPTED',
    primaryExclusionReason: null,
    exclusionReasons: [],
    checks,
    contacts: {
      emails: checks.email.addresses,
      phones: [
        {
          value: '+37060000000',
          normalised: '+37060000000',
          role: 'sales',
          sourceUrl: `https://${company.domain}/contact`,
          discoveredBy: 'stage04',
        },
      ],
    },
    evidenceSources: [],
    metadata: {
      algorithmVersion: 'lead-qualification-v1',
      policyVersion: 'lead-qualification-policy-v1',
      promptVersion: null,
      semanticModel: null,
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:00.010Z',
      durationMs: 10,
      fetches: 1,
      searches: 0,
      llmCalls: 0,
      promptTokens: null,
      completionTokens: null,
      retries: 0,
      limited: false,
      technicalFailure: false,
      error: null,
    },
  };
}

export function rejectedDraft(
  company: SourceCompany,
  reason: ExclusionReason,
): QualificationDraft {
  const emailStatus = reason === 'EMAIL_NOT_FOUND' ? 'FAIL' : 'PASS';
  return {
    ...acceptedDraft(company),
    decision: 'EXCLUDED',
    primaryExclusionReason: reason,
    exclusionReasons: [reason],
    checks: {
      ...acceptedDraft(company).checks,
      email: {
        ...acceptedDraft(company).checks.email,
        status: emailStatus,
        reason: emailStatus === 'FAIL' ? reason : null,
      },
    },
  };
}

class FakeWebsite {
  constructor(private readonly result: WebsiteCheck | Error) {}

  async validate(): Promise<WebsiteCheck> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

class FakeDiscovery {
  calls = 0;
  inputs: unknown[] = [];
  constructor(private readonly result: DiscoveryResult | Error) {}

  async discover(input: unknown): Promise<DiscoveryResult> {
    this.calls += 1;
    this.inputs.push(input);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

class FakeSemantic {
  calls = 0;
  constructor(private readonly assessment: SemanticAssessment) {}

  async assess(): Promise<{ assessment: SemanticAssessment; promptTokens: number | null; completionTokens: number | null; model: string }> {
    this.calls += 1;
    return {
      assessment: this.assessment,
      promptTokens: 10,
      completionTokens: 5,
      model: 'deepseek-flash',
    };
  }
}

export { FakeWebsite, FakeDiscovery, FakeSemantic };

export class FakeQualifier implements CompanyQualifier {
  calls = 0;
  active = 0;
  maxActive = 0;
  constructor(
    private readonly handler: (
      company: SourceCompany,
      index: number,
      budget: RunBudget,
    ) => Promise<QualificationDraft> = async (company) => acceptedDraft(company),
  ) {}

  async qualify(
    company: SourceCompany,
    _context: QualificationContext,
    budget: RunBudget,
  ): Promise<QualificationDraft> {
    this.calls += 1;
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      await new Promise((resolve) => setImmediate(resolve));
      return await this.handler(company, this.calls, budget);
    } finally {
      this.active -= 1;
    }
  }
}

type InternalRun = {
  record: RunRecord;
  token: string | null;
  leaseUntil: Date | null;
};

export class FakeStore implements QualificationStore {
  readonly research: ResearchRecord;
  readonly runs = new Map<string, InternalRun>();
  readonly results = new Map<string, Map<number, ResultRecord>>();
  readonly completeCalls: string[] = [];
  readonly failCalls: string[] = [];
  readonly interruptCalls: string[] = [];
  forceLeaseLoss = false;
  private nextRun = 1;
  private nextResult = 1;

  constructor(research: ResearchRecord) {
    this.research = research;
  }

  async findResearch(): Promise<ResearchRecord | null> {
    return this.research;
  }

  async findRun(id: string): Promise<RunRecord | null> {
    return this.runs.get(id)?.record ?? null;
  }

  async findLatestRun(researchId: string): Promise<RunRecord | null> {
    const matches = [...this.runs.values()]
      .filter((run) => run.record.researchId === researchId)
      .sort((left, right) => right.record.createdAt.getTime() - left.record.createdAt.getTime());
    return matches[0]?.record ?? null;
  }

  async findPublishedRun(researchId: string): Promise<RunRecord | null> {
    const matches = [...this.runs.values()]
      .filter((run) => run.record.researchId === researchId && run.record.publishedAt !== null)
      .sort((left, right) => (right.record.publishedAt?.getTime() ?? 0) - (left.record.publishedAt?.getTime() ?? 0));
    return matches[0]?.record ?? null;
  }

  async findRunByStartKey(
    researchId: string,
    startKey: string,
  ): Promise<RunRecord | null> {
    for (const run of this.runs.values()) {
      if (run.record.researchId === researchId && run.record.startKey === startKey) {
        return run.record;
      }
    }
    return null;
  }

  async findActiveRun(researchId: string): Promise<RunRecord | null> {
    for (const run of this.runs.values()) {
      if (
        run.record.researchId === researchId &&
        (run.record.status === 'QUEUED' || run.record.status === 'RUNNING')
      ) {
        return run.record;
      }
    }
    return null;
  }

  async createRun(input: {
    researchId: string;
    trigger: 'AUTO' | 'MANUAL';
    targetCountry: string;
    qualificationVersion: string;
    policyVersion: string;
    promptVersion: string | null;
    inputFingerprint: string;
    sourceResultSchemaVersion: number | null;
    companyCount: number;
    startKey: string | null;
  }): Promise<RunRecord> {
    const now = new Date();
    const record: RunRecord = {
      id: `run-${this.nextRun}`,
      researchId: input.researchId,
      status: 'QUEUED',
      trigger: input.trigger,
      targetCountry: input.targetCountry,
      qualificationVersion: input.qualificationVersion,
      policyVersion: input.policyVersion,
      promptVersion: input.promptVersion,
      inputFingerprint: input.inputFingerprint,
      sourceResultSchemaVersion: input.sourceResultSchemaVersion,
      companyCount: input.companyCount,
      processedCount: 0,
      acceptedCount: 0,
      excludedCount: 0,
      technicalFailureCount: 0,
      usage: { llmCalls: 0, promptTokens: 0, completionTokens: 0, fetches: 0, searches: 0, retries: 0 },
      startKey: input.startKey,
      startedAt: null,
      completedAt: null,
      publishedAt: null,
      supersededAt: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.nextRun += 1;
    this.runs.set(record.id, { record, token: null, leaseUntil: null });
    this.results.set(record.id, new Map());
    return record;
  }

  async claimRun(id: string, token: string, leaseMs: number): Promise<boolean> {
    const internal = this.runs.get(id);
    if (!internal) return false;
    const now = new Date();
    const claimable =
      internal.record.status !== 'RUNNING' ||
      internal.leaseUntil === null ||
      internal.leaseUntil.getTime() < now.getTime();
    if (!claimable) return false;
    internal.token = token;
    internal.leaseUntil = new Date(now.getTime() + leaseMs);
    internal.record.status = 'RUNNING';
    internal.record.startedAt = now;
    internal.record.updatedAt = now;
    return true;
  }

  async heartbeat(id: string, token: string, leaseMs: number): Promise<boolean> {
    const internal = this.runs.get(id);
    if (!internal || internal.token !== token) return false;
    internal.leaseUntil = new Date(Date.now() + leaseMs);
    return true;
  }

  async updateProgress(
    id: string,
    token: string,
    counts: RunCounts,
    usage: RunRecord['usage'],
  ): Promise<boolean> {
    const internal = this.runs.get(id);
    if (!internal || internal.token !== token) return false;
    Object.assign(internal.record, counts, { usage });
    return true;
  }

  async saveResult(input: SaveResultInput, token: string): Promise<ResultRecord> {
    const internal = this.runs.get(input.runId);
    if (!internal || internal.token !== token || this.forceLeaseLoss) {
      throw new LostLeaseError();
    }
    const now = new Date();
    const existing = this.results.get(input.runId)?.get(input.sourceCompanyIndex);
    const record: ResultRecord = {
      ...input,
      id: existing?.id ?? `result-${this.nextResult++}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.results.get(input.runId)?.set(input.sourceCompanyIndex, record);
    return record;
  }

  async findResultsForRun(runId: string): Promise<ResultRecord[]> {
    return [...(this.results.get(runId)?.values() ?? [])].sort(
      (left, right) => left.sourceCompanyIndex - right.sourceCompanyIndex,
    );
  }

  async listResults(
    runId: string,
    filter: {
      decision: 'ACCEPTED' | 'EXCLUDED';
      reason?: ExclusionReason;
      technicalFailure?: boolean;
      q?: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<{ items: ResultRecord[]; nextCursor: string | null }> {
    let rows = [...(this.results.get(runId)?.values() ?? [])]
      .filter((row) => row.decision === filter.decision)
      .sort((left, right) => left.id.localeCompare(right.id));
    if (filter.reason) rows = rows.filter((row) => row.primaryExclusionReason === filter.reason);
    if (filter.technicalFailure !== undefined) {
      rows = rows.filter((row) => row.technicalFailure === filter.technicalFailure);
    }
    if (filter.q) {
      rows = rows.filter(
        (row) =>
          row.companyName?.toLowerCase().includes(filter.q!.toLowerCase()) ||
          row.domain.toLowerCase().includes(filter.q!.toLowerCase()),
      );
    }
    if (filter.cursor) {
      const index = rows.findIndex((row) => row.id === filter.cursor);
      if (index >= 0) rows = rows.slice(index + 1);
    }
    const items = rows.slice(0, filter.limit);
    return {
      items,
      nextCursor: rows.length > filter.limit ? items[items.length - 1]?.id ?? null : null,
    };
  }

  async getResult(runId: string, resultId: string): Promise<ResultRecord | null> {
    for (const row of this.results.get(runId)?.values() ?? []) {
      if (row.id === resultId) return row;
    }
    return null;
  }

  async updateResult(input: SaveResultInput & { id: string }, token: string): Promise<ResultRecord> {
    const internal = this.runs.get(input.runId);
    if (!internal || internal.token !== token) throw new LostLeaseError();
    const existing = this.results.get(input.runId)?.get(input.sourceCompanyIndex);
    if (!existing || existing.id !== input.id) throw new Error('result not found');
    const record: ResultRecord = {
      ...input,
      id: input.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.results.get(input.runId)?.set(input.sourceCompanyIndex, record);
    return record;
  }

  async completeAndPublish(
    id: string,
    token: string,
    counts: RunCounts,
    usage: RunRecord['usage'],
  ): Promise<boolean> {
    const internal = this.runs.get(id);
    if (!internal || internal.token !== token || internal.record.status !== 'RUNNING') {
      return false;
    }
    for (const other of this.runs.values()) {
      if (other.record.researchId === internal.record.researchId && other.record.id !== id) {
        other.record.publishedAt = null;
        other.record.supersededAt = new Date();
      }
    }
    internal.record.status = 'COMPLETED';
    internal.record.completedAt = new Date();
    internal.record.publishedAt = new Date();
    internal.record.error = null;
    Object.assign(internal.record, counts, { usage });
    internal.token = null;
    internal.leaseUntil = null;
    this.completeCalls.push(id);
    return true;
  }

  async failRun(id: string, token: string, error: string): Promise<void> {
    const internal = this.runs.get(id);
    if (!internal || internal.token !== token) return;
    internal.record.status = 'FAILED';
    internal.record.error = error;
    internal.record.completedAt = new Date();
    internal.token = null;
    this.failCalls.push(id);
  }

  async markInterrupted(id: string, token: string, error: string): Promise<void> {
    const internal = this.runs.get(id);
    if (!internal || internal.token !== token) return;
    internal.record.status = 'INTERRUPTED';
    internal.record.error = error;
    internal.token = null;
    this.interruptCalls.push(id);
  }
}

export function makeService(store: FakeStore, qualifier: FakeQualifier): LeadQualificationService {
  return new LeadQualificationService(store, qualifier);
}

export type { ListOptions, ResultView, RunView, StartOptions, SourceStudy, LeadQualificationLimits };
