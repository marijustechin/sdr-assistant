import { isInsufficientBalanceError } from '../research/lib/llm-chat.js';
import {
  assessActivity,
  assessRelevance,
  decideQualification,
} from './lead-qualification.decision.js';
import {
  buildGeographySignals,
  evaluateGeography,
  extractAddressEvidence,
  type GeographySignals,
} from './lead-qualification.geography.js';
import { mergeContacts } from './lead-qualification.contacts.js';
import type {
  ActivityCheck,
  DiscoveryResult,
  DuplicateCheck,
  EmailCheck,
  EmailContact,
  EvidenceRef,
  GeographicCheck,
  LeadQualificationLimits,
  PhoneContact,
  QualificationChecks,
  QualificationDraft,
  QualificationContext,
  RunUsage,
  RelevanceCheck,
  SourceCompany,
  WebsiteCheck,
} from './lead-qualification.types.js';
import { RunWideError as RunWideFailure } from './lead-qualification.types.js';
import type { DiscoveryInput } from './lead-qualification.discovery.js';
import type {
  SemanticAssessmentResult,
  SemanticAssessor,
} from './lead-qualification.semantic.js';
import { LEAD_QUALIFICATION_PROMPT_VERSION } from './lead-qualification.constants.js';

export const LEAD_QUALIFICATION_ENGINE = Symbol('LEAD_QUALIFICATION_ENGINE');

export interface WebsiteValidatorPort {
  validate(domain: string): Promise<WebsiteCheck>;
}

export interface ContactDiscoveryPort {
  discover(input: DiscoveryInput): Promise<DiscoveryResult>;
}

export interface CompanyQualifier {
  qualify(
    company: SourceCompany,
    context: QualificationContext,
    budget: RunBudget,
  ): Promise<QualificationDraft>;
}

export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= Math.max(1, this.limit)) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}

export class RunBudget {
  readonly usage: RunUsage;
  readonly search: ConcurrencyLimiter;
  readonly llm: ConcurrencyLimiter;

  constructor(
    readonly limits: LeadQualificationLimits,
    initialUsage: RunUsage = {
      llmCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      fetches: 0,
      searches: 0,
      retries: 0,
    },
  ) {
    this.usage = { ...initialUsage };
    this.search = new ConcurrencyLimiter(limits.searchConcurrency);
    this.llm = new ConcurrencyLimiter(limits.llmConcurrency);
  }

  consumeLlm(): void {
    if (this.usage.llmCalls >= this.limits.llmCallsPerRun) {
      throw new RunWideFailure(
        'LLM_BUDGET_EXHAUSTED',
        'The run-wide semantic-call budget was exhausted.',
      );
    }
    this.usage.llmCalls += 1;
  }
}

function notEvaluatedCheck(reason: QualificationChecks['website']['reason'] = null) {
  return {
    status: 'NOT_EVALUATED' as const,
    reason,
    evidence: [] as EvidenceRef[],
    detail: null,
    technicalFailure: false,
  };
}

function uniqueEvidence(evidence: readonly EvidenceRef[], limit: number): EvidenceRef[] {
  const seen = new Set<string>();
  const result: EvidenceRef[] = [];

  for (const item of evidence) {
    if (item.url.length === 0) continue;
    const key = `${item.kind}:${item.url}:${item.quote ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}

function noDuplicate(): DuplicateCheck {
  return {
    status: 'PASS',
    reason: null,
    evidence: [],
    detail: 'No duplicate identity detected in the run.',
    technicalFailure: false,
    canonicalCompanyKey: null,
    matchedOn: [],
  };
}

function emptyActivity(): ActivityCheck {
  return notEvaluatedCheck();
}

function emptyGeo(): GeographicCheck {
  return {
    ...notEvaluatedCheck(),
    addressCountry: null,
    phoneCountries: [],
    localPresence: false,
    foreignPresence: false,
    conflict: false,
    discoveryAttempted: false,
  };
}

function emptyRelevance(): RelevanceCheck {
  return {
    ...notEvaluatedCheck(),
    matchedOfferIds: [],
    aOffers: 0,
    bOffers: 0,
    targetMarketOffers: 0,
  };
}

function emptyEmail(): EmailCheck {
  return {
    ...notEvaluatedCheck(),
    addresses: [],
  };
}

function emailCheck(
  emails: readonly EmailContact[],
  discoveryAttempted: boolean,
  discoveryTechnicalFailure: boolean,
): EmailCheck {
  if (emails.length > 0) {
    return {
      status: 'PASS',
      reason: null,
      evidence: emails
        .filter((email) => email.sourceUrl !== null)
        .map((email) => ({
          url: email.sourceUrl as string,
          kind: 'email' as const,
          quote: null,
          source: email.discoveredBy === 'stage04' ? ('stage04' as const) : ('http' as const),
          observedAt: new Date().toISOString(),
        })),
      detail: 'Source-backed public business email found.',
      technicalFailure: false,
      addresses: [...emails],
    };
  }

  if (discoveryTechnicalFailure) {
    return {
      status: 'UNKNOWN',
      reason: 'PROCESSING_FAILED',
      evidence: [],
      detail: 'Contact discovery failed technically.',
      technicalFailure: true,
      addresses: [],
    };
  }

  if (discoveryAttempted) {
    return {
      status: 'FAIL',
      reason: 'EMAIL_NOT_FOUND',
      evidence: [],
      detail: 'No acceptable source-backed business email after bounded discovery.',
      technicalFailure: false,
      addresses: [],
    };
  }

  return emptyEmail();
}

function pageRank(url: string): number {
  return /(contact|kontakt|kontaktai|susisiek|imprint|impressum|legal|about|apie)/i.test(
    url,
  )
    ? 0
    : /(sales|wholesale|pardav|product|catalog)/i.test(url)
      ? 2
      : 1;
}

function semanticRequest(
  company: SourceCompany,
  context: QualificationContext,
  website: WebsiteCheck,
  discovery: DiscoveryResult | null,
  checks: QualificationChecks,
) {
  const pages = new Map<string, string>();
  if (website.bodyText.trim().length > 0 && website.finalUrl !== null) {
    pages.set(website.finalUrl, website.bodyText);
  }
  for (const page of discovery?.pages ?? []) {
    if (page.text.trim().length > 0) pages.set(page.url, page.text);
  }

  const focus: Array<'activity' | 'geography' | 'relevance'> = [];
  if (checks.activity.status === 'UNKNOWN') focus.push('activity');
  if (
    checks.geography.status === 'UNKNOWN' ||
    (checks.geography.status === 'FAIL' &&
      checks.geography.reason === 'COUNTRY_UNCONFIRMED')
  ) {
    focus.push('geography');
  }
  if (checks.relevance.status === 'UNKNOWN') focus.push('relevance');

  return {
    targetCountry: context.study.targetCountry,
    productName: context.study.productName,
    productDescription: context.study.productDescription,
    company: {
      name: company.name,
      domain: company.domain,
      address: company.address,
      city: company.city,
      country: company.country,
      offers: company.offers.map((offer) => ({
        id: offer.id,
        item: offer.item,
        verdict: offer.verdict,
        sourceUrl: offer.sourceUrl,
      })),
    },
    focus,
    pages: [...pages.entries()]
      .sort(([left], [right]) => pageRank(left) - pageRank(right))
      .slice(0, 4)
      .map(([url, text]) => ({ url, text })),
    existingEvidence: [
      ...checks.geography.evidence,
      ...checks.email.evidence,
    ].slice(0, 6),
  };
}

function semanticEvidenceForAssessment(assessment: SemanticAssessmentResult['assessment']): EvidenceRef[] {
  return [
    ...assessment.activityEvidence.map((item) => ({
      url: item.sourceUrl,
      kind: 'activity' as const,
      quote: item.quote,
      source: 'semantic' as const,
      observedAt: new Date().toISOString(),
    })),
    ...assessment.geographyEvidence.map((item) => ({
      url: item.sourceUrl,
      kind: 'address' as const,
      quote: item.quote,
      source: 'semantic' as const,
      observedAt: new Date().toISOString(),
    })),
    ...assessment.relevanceEvidence.map((item) => ({
      url: item.sourceUrl,
      kind: 'relevance' as const,
      quote: item.quote,
      source: 'semantic' as const,
      observedAt: new Date().toISOString(),
    })),
  ];
}

function applySemantic(
  checks: QualificationChecks,
  assessment: SemanticAssessmentResult['assessment'],
  targetCountryCode: string | null,
  signals: GeographySignals,
): QualificationChecks {
  let activity = checks.activity;
  let geography = checks.geography;
  let relevance = checks.relevance;
  const activityEvidence: EvidenceRef[] = assessment.activityEvidence.map((item) => ({
    url: item.sourceUrl,
    kind: 'activity',
    quote: item.quote,
    source: 'semantic',
    observedAt: new Date().toISOString(),
  }));
  const geographyEvidence: EvidenceRef[] = assessment.geographyEvidence.map((item) => ({
    url: item.sourceUrl,
    kind: 'address',
    quote: item.quote,
    source: 'semantic',
    observedAt: new Date().toISOString(),
  }));
  const relevanceEvidence: EvidenceRef[] = assessment.relevanceEvidence.map((item) => ({
    url: item.sourceUrl,
    kind: 'relevance',
    quote: item.quote,
    source: 'semantic',
    observedAt: new Date().toISOString(),
  }));

  if (checks.activity.status === 'UNKNOWN') {
    if (assessment.activity === 'active') {
      activity = {
        ...checks.activity,
        status: 'PASS',
        reason: null,
        detail: 'Semantic review found active commercial content.',
        evidence: [...checks.activity.evidence, ...activityEvidence],
      };
    } else if (assessment.activity === 'inactive') {
      activity = {
        ...checks.activity,
        status: 'FAIL',
        reason: 'INACTIVE_BUSINESS',
        detail: 'Semantic review found inactive or noncommercial content.',
        evidence: [...checks.activity.evidence, ...activityEvidence],
      };
    }
  }

  const geographyUnresolved =
    checks.geography.status === 'UNKNOWN' ||
    (checks.geography.status === 'FAIL' &&
      checks.geography.reason === 'COUNTRY_UNCONFIRMED');
  if (geographyUnresolved) {
    if (assessment.localBranch?.present === true) {
      signals = {
        ...signals,
        localBranchEvidence: [
          ...signals.localBranchEvidence,
          {
            url: assessment.localBranch.sourceUrl ?? '',
            kind: 'address' as const,
            quote: assessment.localBranch.quote,
            source: 'semantic' as const,
            observedAt: new Date().toISOString(),
          },
        ].filter((item) => item.url.length > 0),
      };
      geography = evaluateGeography(signals, targetCountryCode);
    } else if (assessment.geography === 'local') {
      signals = {
        ...signals,
        localAddressEvidence: [
          ...signals.localAddressEvidence,
          ...geographyEvidence,
        ],
      };
      geography = evaluateGeography(signals, targetCountryCode);
    } else if (assessment.geography === 'foreign') {
      geography = {
        ...checks.geography,
        status: 'FAIL',
        reason: 'COUNTRY_MISMATCH',
        detail: 'Semantic review found foreign establishment without local evidence.',
        evidence: [...checks.geography.evidence, ...geographyEvidence],
        localPresence: false,
        foreignPresence: true,
      };
    }
  }

  if (checks.relevance.status === 'UNKNOWN') {
    if (assessment.relevance === 'relevant') {
      relevance = {
        ...checks.relevance,
        status: 'PASS',
        reason: null,
        detail: 'Semantic review found relevant commercial assortment.',
        evidence: [...checks.relevance.evidence, ...relevanceEvidence],
      };
    } else if (assessment.relevance === 'irrelevant') {
      relevance = {
        ...checks.relevance,
        status: 'FAIL',
        reason: 'IRRELEVANT_BUSINESS',
        detail: 'Semantic review found unrelated commercial assortment.',
        evidence: [...checks.relevance.evidence, ...relevanceEvidence],
      };
    }
  }

  return {
    ...checks,
    activity,
    geography,
    relevance,
  };
}
export class LeadQualificationEngine implements CompanyQualifier {
  constructor(
    private readonly websiteValidator: WebsiteValidatorPort,
    private readonly discovery: ContactDiscoveryPort,
    private readonly semantic: SemanticAssessor | null,
    private readonly limits: LeadQualificationLimits,
  ) {}

  async qualify(
    company: SourceCompany,
    context: QualificationContext,
    budget: RunBudget,
  ): Promise<QualificationDraft> {
    const startedAt = new Date();
    let website: WebsiteCheck;

    try {
      website = await this.websiteValidator.validate(company.domain);
    } catch {
      website = {
        status: 'UNKNOWN',
        reason: 'PROCESSING_FAILED',
        evidence: [],
        detail: 'Website validation threw a technical error.',
        technicalFailure: true,
        finalUrl: null,
        https: false,
        certificateValid: false,
        httpStatus: null,
        redirects: 0,
        temporary: true,
        failureKind: 'transient',
        bodyText: '',
      };
    }

    const existing = mergeContacts(company, [], []);
    let contacts: { emails: EmailContact[]; phones: PhoneContact[] } = existing;
    let discovery: DiscoveryResult | null = null;
    let discoveryAttempted = false;
    let discoveryTechnicalFailure = false;
    let semanticFailed = false;
    let semanticUsed = false;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let limitsReached = false;
    let initialSignals = buildGeographySignals(
      company,
      context.study.targetCountryCode,
    );
    if (website.status === 'PASS' && website.finalUrl !== null) {
      const homepageAddress = extractAddressEvidence(
        website.finalUrl,
        website.bodyText,
        company,
        context.study.targetCountryCode,
      );
      initialSignals = {
        ...initialSignals,
        localAddressEvidence: homepageAddress.local,
        foreignAddressEvidence: homepageAddress.foreign,
        foreignAddressCountries: homepageAddress.foreignCountries,
      };
    }
    let geography = evaluateGeography(
      initialSignals,
      context.study.targetCountryCode,
    );
    let activity = assessActivity(website, company);
    let relevance = assessRelevance(company);

    const confirmedExclusion =
      website.status !== 'PASS' ||
      activity.status === 'FAIL' ||
      (geography.status === 'FAIL' && geography.reason === 'COUNTRY_MISMATCH') ||
      relevance.status === 'FAIL';

    if (!confirmedExclusion) {
      const needEmail = existing.emails.length === 0;
      const needGeography = geography.status !== 'PASS';

      if (needEmail || needGeography) {
        discoveryAttempted = true;
        try {
          discovery = await this.discovery.discover({
            company,
            searchLimiter: budget.search,
            website,
            targetCountry: context.study.targetCountry,
            targetCountryCode: context.study.targetCountryCode,
            needEmail,
            needGeography,
          });
          contacts = mergeContacts(
            company,
            discovery.emails,
            discovery.phones,
          );
          discoveryTechnicalFailure = discovery.technicalFailure;
          limitsReached = discovery.limitReached;
          budget.usage.fetches += discovery.fetches;
          budget.usage.searches += discovery.searches;
          initialSignals = {
            ...initialSignals,
            localAddressEvidence: [
              ...initialSignals.localAddressEvidence,
              ...discovery.localAddressEvidence,
            ],
            foreignAddressEvidence: [
              ...initialSignals.foreignAddressEvidence,
              ...discovery.foreignAddressEvidence,
            ],
            foreignAddressCountries: [
              ...new Set([
                ...initialSignals.foreignAddressCountries,
                ...discovery.foreignAddressCountries,
              ]),
            ],
            localBranchEvidence: [
              ...initialSignals.localBranchEvidence,
              ...discovery.localBranchEvidence,
            ],
            phones: [
              ...initialSignals.phones,
              ...discovery.phones.map((phone) => ({
                normalised: phone.normalised,
                sourceUrl: phone.sourceUrl,
              })),
            ],
            discoveryAttempted: true,
            discoveryTechnicalFailure,
          };
          geography = evaluateGeography(
            initialSignals,
            context.study.targetCountryCode,
          );
        } catch (error) {
          if (error instanceof RunWideFailure) throw error;
          discoveryAttempted = true;
          discoveryTechnicalFailure = true;
          initialSignals = {
            ...initialSignals,
            discoveryAttempted: true,
            discoveryTechnicalFailure: true,
          };
          geography = evaluateGeography(
            initialSignals,
            context.study.targetCountryCode,
          );
        }
      }

      if (discovery !== null) {
        activity = assessActivity(
          {
            ...website,
            bodyText: [website.bodyText, ...(discovery.pages ?? []).map((page) => page.text)].join('\n'),
          },
          company,
        );
        relevance = assessRelevance(company);
      }
    }

    let email = emailCheck(
      contacts.emails,
      discoveryAttempted,
      discoveryTechnicalFailure,
    );
    const unresolved =
      activity.status === 'UNKNOWN' ||
      geography.status === 'UNKNOWN' ||
      (geography.status === 'FAIL' &&
        geography.reason === 'COUNTRY_UNCONFIRMED') ||
      relevance.status === 'UNKNOWN';
    const confirmedExclusionBeforeSemantic =
      website.status !== 'PASS' ||
      activity.status === 'FAIL' ||
      (geography.status === 'FAIL' &&
        geography.reason !== 'COUNTRY_UNCONFIRMED') ||
      relevance.status === 'FAIL' ||
      email.status !== 'PASS';
    const semanticNeeded =
      !confirmedExclusionBeforeSemantic &&
      !geography.technicalFailure &&
      unresolved;

    let semanticEvidence: EvidenceRef[] = [];
    let semanticModel: string | null = null;
    if (semanticNeeded && this.semantic !== null) {
      try {
        budget.consumeLlm();
        semanticUsed = true;
        const checksForSemantic: QualificationChecks = {
          website,
          activity,
          geography,
          relevance,
          email,
          duplicate: noDuplicate(),
        };
        const result = await budget.llm.run(() =>
          this.semantic!.assess(
            semanticRequest(company, context, website, discovery, checksForSemantic),
          ),
        );
        semanticModel = result.model;
        budget.usage.promptTokens += result.promptTokens ?? 0;
        budget.usage.completionTokens += result.completionTokens ?? 0;
        promptTokens = result.promptTokens;
        completionTokens = result.completionTokens;
        const updated = applySemantic(
          checksForSemantic,
          result.assessment,
          context.study.targetCountryCode,
          initialSignals,
        );
        activity = updated.activity;
        geography = updated.geography;
        relevance = updated.relevance;
        semanticEvidence = semanticEvidenceForAssessment(result.assessment);
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === 'RunWideError' ||
            isInsufficientBalanceError(error))
        ) {
          throw new RunWideFailure(
            isInsufficientBalanceError(error)
              ? 'PROVIDER_BALANCE'
              : 'LLM_BUDGET_EXHAUSTED',
            'Semantic assessment cannot continue for the run.',
          );
        }
        semanticFailed = true;
      }
    }
    if (semanticFailed) {
      if (activity.status === 'UNKNOWN') {
        activity = {
          ...activity,
          reason: 'PROCESSING_FAILED',
          technicalFailure: true,
        };
      }
      if (geography.status === 'UNKNOWN') {
        geography = {
          ...geography,
          reason: 'PROCESSING_FAILED',
          technicalFailure: true,
        };
      }
      if (relevance.status === 'UNKNOWN') {
        relevance = {
          ...relevance,
          reason: 'PROCESSING_FAILED',
          technicalFailure: true,
        };
      }
    }

    const checks: QualificationChecks = {
      website,
      activity,
      geography,
      relevance,
      email,
      duplicate: noDuplicate(),
    };
    const decision = decideQualification(checks);
    const evidence = uniqueEvidence(
      [
        ...website.evidence,
        ...activity.evidence,
        ...geography.evidence,
        ...relevance.evidence,
        ...email.evidence,
        ...semanticEvidence,
      ],
      this.limits.maxEvidencePerResult,
    );
    const completedAt = new Date();

    return {
      decision: decision.decision,
      primaryExclusionReason: decision.primaryExclusionReason,
      exclusionReasons: decision.exclusionReasons,
      checks,
      contacts,
      evidenceSources: evidence,
      metadata: {
        algorithmVersion: 'lead-qualification-v1',
        policyVersion: 'lead-qualification-policy-v1',
        promptVersion: semanticUsed ? LEAD_QUALIFICATION_PROMPT_VERSION : null,
        semanticModel,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        fetches: (website.httpStatus === null ? 0 : 1) + (discovery?.fetches ?? 0),
        searches: discovery?.searches ?? 0,
        llmCalls: semanticUsed ? 1 : 0,
        promptTokens,
        completionTokens,
        retries: 0,
        limited: limitsReached,
        technicalFailure:
          decision.technicalFailure || discoveryTechnicalFailure || semanticFailed,
        error: semanticFailed
          ? 'Semantic assessment failed technically.'
          : null,
      },
    };
  }
}
