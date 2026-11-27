import type { RunBudget } from '../lead-qualification/lead-qualification.engine.js';
import type {
  CompanyQualifier,
} from '../lead-qualification/lead-qualification.engine.js';
import type {
  ContactDiscoveryCompanyResult,
  ContactSource,
} from './contact-discovery-pipeline.types.js';
import type { ContactDiscoveryPipeline } from './contact-discovery-pipeline.js';
import type {
  QualificationDraft,
  QualificationChecks,
  QualificationContext,
  SourceCompany,
} from '../lead-qualification/lead-qualification.types.js';

const CONTACT_DISCOVERY_VERSION = 'contact-discovery-v1';
const CONTACT_DISCOVERY_POLICY = 'contact-discovery-v1';

function evidenceRef(
  source: ContactSource,
  kind: 'email' | 'phone' | 'address' | 'legal',
) {
  const raw = source.evidence;
  const quote =
    typeof raw === 'object' && raw !== null && 'quote' in raw
      ? (raw as { quote?: unknown }).quote
      : null;
  return {
    url: source.sourceUrl ?? '',
    kind,
    quote: typeof quote === 'string' ? quote : null,
    source:
      source.origin === 'stage04'
        ? ('stage04' as const)
        : source.origin === 'exa'
          ? ('search' as const)
          : ('http' as const),
    observedAt: new Date().toISOString(),
  };
}

function compactEmail(email: ContactDiscoveryCompanyResult['emails'][number]) {
  return {
    value: email.value,
    ownership: email.ownership,
    employeeName: email.employeeName,
    employeePosition: email.employeePosition,
    employeeAssociation: email.employeeAssociation,
    sources: email.sources.map((source) => ({
      origin: source.origin,
      method: source.method,
      sourceUrl: source.sourceUrl,
    })),
  };
}

function compactCompany(result: ContactDiscoveryCompanyResult) {
  return {
    domain: result.domain,
    companyName: result.companyName,
    targetCountry: result.targetCountry,
    targetCountryCode: result.targetCountryCode,
    retained: result.retained,
    exclusionReason: result.exclusionReason,
    emails: result.emails.map(compactEmail),
    phones: result.phones.map((phone) => ({
      normalized: phone.normalized,
      originalValues: phone.originalValues,
      countries: phone.countries,
      local: phone.local,
      reliableForeign: phone.reliableForeign,
      ambiguous: phone.ambiguous,
      sourceUrls: [
        ...new Set(
          phone.sources
            .map((source) => source.sourceUrl)
            .filter((url): url is string => url !== null),
        ),
      ],
    })),
    addresses: result.addresses.map((address) => ({
      value: address.value,
      structured: address.structured,
      sourceUrls: [
        ...new Set(
          address.sources
            .map((source) => source.sourceUrl)
            .filter((url): url is string => url !== null),
        ),
      ],
    })),
    registrationIdentifiers: result.registrationIdentifiers.map((registration) => ({
      value: registration.value,
      kind: registration.kind,
    })),
    removedContacts: result.removedContacts,
    targetAddressEvidence: result.targetAddressEvidence,
    targetTelephoneEvidence: result.targetTelephoneEvidence,
    foreignTelephoneEvidence: result.foreignTelephoneEvidence,
    diagnostics: {
      homepage: {
        url: result.diagnostics.homepage.url,
        status: result.diagnostics.homepage.status,
        error: result.diagnostics.homepage.error,
      },
      contactPages: result.diagnostics.contactPages.map((page) => ({
        url: page.url,
        status: page.status,
        error: page.error,
        failureKind: page.failureKind ?? null,
        attempts: page.attempts ?? 1,
        retried: page.retried ?? false,
      })),
      exa:
        result.diagnostics.exa === null
          ? null
          : {
              query: result.diagnostics.exa.query,
              resultCount: result.diagnostics.exa.results.length,
              attempts:
                result.diagnostics.exa.queries?.map((query) => ({
                  query: query.query,
                  resultCount: query.results.length,
                  pageCount: query.pages.length,
                  error: query.error,
                })) ?? null,
              pages: result.diagnostics.exa.pages.map((page) => ({
                url: page.url,
                status: page.status,
                error: page.error,
              })),
              error: result.diagnostics.exa.error,
            },
      fetches: result.diagnostics.fetches,
      searches: result.diagnostics.searches,
    },
  };
}

function baseChecks(
  result: ContactDiscoveryCompanyResult,
  addresses: QualificationChecks['email']['addresses'],
): QualificationChecks {
  return {
    website: {
      status: 'NOT_EVALUATED',
      reason: null,
      evidence: [],
      detail: 'Contact discovery does not assess commercial website qualification.',
      technicalFailure: false,
      finalUrl: result.diagnostics.homepage.url,
      https: false,
      certificateValid: false,
      httpStatus: result.diagnostics.homepage.status,
      redirects: 0,
      temporary: false,
      failureKind: null,
      bodyText: '',
    },
    activity: {
      status: 'NOT_EVALUATED',
      reason: null,
      evidence: [],
      detail: 'Commercial activity is outside this stage.',
      technicalFailure: false,
    },
    geography: {
      status: 'NOT_EVALUATED',
      reason: null,
      evidence: [],
      detail: 'Only the minimal telephone-country rule is applied.',
      technicalFailure: false,
      addressCountry: null,
      phoneCountries: result.phones.flatMap((phone) => phone.countries),
      localPresence: result.targetTelephoneEvidence,
      foreignPresence: result.foreignTelephoneEvidence,
      conflict: false,
      discoveryAttempted: true,
    },
    relevance: {
      status: 'NOT_EVALUATED',
      reason: null,
      evidence: [],
      detail: 'Commercial relevance is outside this stage.',
      technicalFailure: false,
      matchedOfferIds: [],
      aOffers: 0,
      bOffers: 0,
      targetMarketOffers: 0,
    },
    email: {
      status: result.usableEmails.length > 0 ? 'PASS' : 'FAIL',
      reason:
        result.usableEmails.length > 0
          ? null
          : 'EMAIL_NOT_FOUND',
      evidence: [],
      detail:
        result.usableEmails.length > 0
          ? 'Usable company email addresses discovered.'
          : 'No usable company-associated email discovered.',
      technicalFailure: false,
      addresses,
    },
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
}

export class ContactDiscoveryQualifier implements CompanyQualifier {
  constructor(private readonly pipeline: ContactDiscoveryPipeline) {}

  async qualify(
    company: SourceCompany,
    context: QualificationContext,
    budget: RunBudget,
  ): Promise<QualificationDraft> {
    const targetCode = context.study.targetCountryCode ?? '';
    const result = await this.pipeline.collect(
      company,
      context.study.targetCountry,
      targetCode,
    );
    budget.usage.fetches += result.diagnostics.fetches;
    budget.usage.searches += result.diagnostics.searches;

    const addresses = result.usableEmails.map((email) => ({
      value: email.value,
      role: null,
      sourceUrl: email.sources[0]?.sourceUrl ?? null,
      discoveredBy: 'contact-page' as const,
    }));
    const phones = result.phones.map((phone) => ({
      value: phone.originalValues[0] ?? phone.normalized,
      normalised: phone.normalized,
      role: null,
      sourceUrl: phone.sources[0]?.sourceUrl ?? null,
      discoveredBy: 'contact-page' as const,
    }));
    const evidenceSources = [
      ...result.usableEmails.flatMap((email) =>
        email.sources.map((source) => evidenceRef(source, 'email')),
      ),
      ...result.partnerEmails.flatMap((email) =>
        email.sources.map((source) => evidenceRef(source, 'email')),
      ),
      ...result.phones.flatMap((phone) =>
        phone.sources.map((source) => evidenceRef(source, 'phone')),
      ),
      ...result.addresses.flatMap((address) =>
        address.sources.map((source) => evidenceRef(source, 'address')),
      ),
      ...result.registrationIdentifiers.flatMap((registration) =>
        registration.sources.map((source) => evidenceRef(source, 'legal')),
      ),
    ];

    return {
      decision: result.retained ? 'ACCEPTED' : 'EXCLUDED',
      primaryExclusionReason:
        result.exclusionReason === 'MISSING_USABLE_COMPANY_EMAIL'
          ? 'EMAIL_NOT_FOUND'
          : result.exclusionReason === 'FOREIGN_TELEPHONE_NO_TARGET_ESTABLISHMENT'
            ? 'COUNTRY_MISMATCH'
            : null,
      exclusionReasons:
        result.exclusionReason === 'MISSING_USABLE_COMPANY_EMAIL'
          ? ['EMAIL_NOT_FOUND']
          : result.exclusionReason === 'FOREIGN_TELEPHONE_NO_TARGET_ESTABLISHMENT'
            ? ['COUNTRY_MISMATCH']
            : [],
      checks: baseChecks(result, addresses),
      contacts: {
        emails: addresses,
        phones,
      },
      evidenceSources,
      metadata: {
        algorithmVersion: CONTACT_DISCOVERY_VERSION,
        policyVersion: CONTACT_DISCOVERY_POLICY,
        promptVersion: null,
        semanticModel: null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        fetches: result.diagnostics.fetches,
        searches: result.diagnostics.searches,
        llmCalls: 0,
        promptTokens: null,
        completionTokens: null,
        retries: 0,
        limited: false,
        technicalFailure: false,
        error: null,
        contactDiscovery: compactCompany(result),
      },
    };
  }
}

export { CONTACT_DISCOVERY_POLICY, CONTACT_DISCOVERY_VERSION };
