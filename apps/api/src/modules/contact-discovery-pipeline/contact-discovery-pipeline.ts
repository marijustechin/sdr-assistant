import {
  normalisePhone,
  phoneCountryCandidates,
  resolveCountryCode,
} from '../lead-qualification/lead-qualification.geography.js';
import type {
  ContactCandidate,
  ContactDiscoveryResult,
} from '../contact-discovery/contact-discovery.types.js';
import type {
  ContactDiscoveryCompanyResult,
  ContactDiscoveryLimits,
  ContactDiscoveryPorts,
  ContactDiscoveryPipelineResult,
  ContactEvidenceOrigin,
  ContactPageEvidence,
  ContactSource,
  EvidenceCandidate,
  CompanyContactEvidence,
  FetchedContactPage,
  ClassifiedEmail,
  ExaQueryEvidence,
  RemovedContact,
} from './contact-discovery-pipeline.types.js';
import {
  DEFAULT_CONTACT_DISCOVERY_LIMITS,
} from './contact-discovery-pipeline.types.js';
import type {
  SourceCompany,
  SourceStudy,
} from '../lead-qualification/lead-qualification.types.js';

const PARTNER_PATH =
  /(?:partner|distributor|dealer|reseller|representative|atstov|filial|branch|where-to-buy|network|agent|import)/i;
const OFFICIAL_PATH =
  /(?:contact|kontakt|about|apie|legal|imprint|impressum|team|people|employee|management|vadov|company|imone|rekvizitai|susisiek)/i;
const CONTACT_CONTEXT =
  /\b(?:contact|kontakt|email|e-mail|mail|telefon|phone|tel\.?|susisiek|rašyk|general|sales|office)\b/i;
const FREE_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
]);
const EXAMPLE_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'example.test',
  'test',
  'invalid',
  'localhost',
]);
const SERVICE_DOMAINS = new Set([
  'sentry.io',
  'wixpress.com',
  'shopify.com',
  'myshopify.com',
  'wordpress.com',
  'judge.me',
  'cloudflare.com',
]);
const PLACEHOLDER_LOCALS = new Set([
  'name',
  'email',
  'your',
  'user',
  'test',
  'example',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'notifications',
  'notify',
]);
const LOCAL_CONTACT_TERMS: Record<string, string> = {
  lithuania: 'kontaktai susisiekite el. paštas telefonas',
  lietuva: 'kontaktai susisiekite el. paštas telefonas',
  latvia: 'kontakti sazināties e-pasts tālrunis',
  estonia: 'kontaktid võtke ühendust e-post telefon',
  poland: 'kontakt e-mail telefon',
  germany: 'kontakt e-mail telefon',
  netherlands: 'contact e-mail telefoon',
  hungary: 'kapcsolat e-mail telefon',
  france: 'contact e-mail téléphone',
  spain: 'contacto correo electrónico teléfono',
  italy: 'contatto e-mail telefono',
  denmark: 'kontakt e-mail telefon',
  sweden: 'kontakt e-post telefon',
  finland: 'yhteystiedot sähköposti puhelin',
  norway: 'kontakt e-post telefon',
  czechia: 'kontakt e-mail telefon',
  slovakia: 'kontakt e-mail telefón',
  austria: 'kontakt e-mail telefon',
  belgium: 'contact e-mail téléphone',
  ireland: 'contact email phone',
  unitedkingdom: 'contact email phone',
  'united kingdom': 'contact email phone',
};

const SUPPORTED_PHONE_METHODS = new Set([
  'stage04',
  'tel',
  'visible_text',
  'json_ld',
]);

function hostOf(value: string | null): string | null {
  if (value === null) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function pathOf(value: string | null): string {
  if (value === null) return '';
  try {
    return new URL(value).pathname.toLowerCase();
  } catch {
    return '';
  }
}

function isCompanyHost(value: string | null, domain: string): boolean {
  const host = hostOf(value);
  if (host === null) return false;
  const base = domain.toLowerCase().replace(/^www\./, '');
  return host === base || host.endsWith(`.${base}`);
}

function isPartnerSource(source: ContactSource): boolean {
  return PARTNER_PATH.test(pathOf(source.sourceUrl));
}

function hasCompanyAssociation(
  source: ContactSource,
  company: SourceCompany,
): boolean {
  if (isCompanyHost(source.sourceUrl, company.domain)) return true;
  const evidence =
    typeof source.evidence === 'object' && source.evidence !== null
      ? (source.evidence as Record<string, unknown>)
      : {};
  const context = [evidence.quote, evidence.context, evidence.jsonPath]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  const normalizedContext = context.replace(/[^a-z0-9]/g, '');
  const candidates = [
    company.name?.toLowerCase(),
    company.legalName?.toLowerCase(),
    company.code?.toLowerCase(),
    company.vat?.toLowerCase(),
    company.domain.toLowerCase(),
  ].filter(
    (value): value is string =>
      typeof value === 'string' && value.length >= 4,
  );
  return candidates.some((candidate) => {
    const normalized = candidate.replace(/[^a-z0-9]/g, '');
    return (
      context.includes(candidate) ||
      (normalized.length >= 4 && normalizedContext.includes(normalized))
    );
  });
}

/**
 * An email on a third-party page can belong to the page operator rather than
 * the subject company. Treat exact-host matches and same-brand domains as
 * source-operator mailboxes; they never confirm company ownership.
 */
export function isSourceOperatorMailbox(
  value: string,
  source: ContactSource,
  company: SourceCompany,
): boolean {
  if (source.sourceUrl === null) return false;
  if (isCompanyHost(source.sourceUrl, company.domain)) return false;
  const emailHost = hostOf(`https://${value.split('@').at(-1) ?? ''}`);
  const sourceHost = hostOf(source.sourceUrl);
  if (emailHost === null || sourceHost === null) return false;
  const emailBrand = emailHost.split('.')[0] ?? '';
  const sourceBrand = sourceHost.split('.')[0] ?? '';
  const companyNames = [company.name, company.legalName]
    .map((name) => name?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '')
    .filter((name) => name.length >= 4);
  if (companyNames.some((name) => sourceBrand.includes(name))) {
    return false;
  }
  if (emailHost === sourceHost) return true;
  if (
    emailBrand.length < 4 ||
    sourceBrand.length < 4 ||
    emailBrand !== sourceBrand
  ) {
    return false;
  }
  return true;
}

function isUsableSource(
  source: ContactSource,
  company: SourceCompany,
): boolean {
  if (typeof source.sourceUrl !== 'string' || isPartnerSource(source)) return false;
  const hostedByCompany = isCompanyHost(source.sourceUrl, company.domain);
  if (hostedByCompany) {
    return (
      OFFICIAL_PATH.test(pathOf(source.sourceUrl)) ||
      source.method === 'json_ld' ||
      CONTACT_CONTEXT.test(
        typeof source.evidence === 'object' && source.evidence !== null
          ? JSON.stringify(source.evidence)
          : '',
      )
    );
  }
  if (source.origin === 'exa') {
    return (
      source.companyIdentityVerified === true ||
      hasCompanyAssociation(source, company)
    );
  }
  return hasCompanyAssociation(source, company);
}

function normalizeEmail(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/^mailto:/i, '')
    .split('?')[0]
    .replace(/[),.;:]+$/, '')
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function emailRemovalReason(value: string): string | null {
  const email = value.slice(value.lastIndexOf('@') + 1);
  const local = value.slice(0, value.lastIndexOf('@'));
  if (
    EXAMPLE_DOMAINS.has(email) ||
    email.endsWith('.test') ||
    email.endsWith('.invalid')
  ) {
    return 'placeholder_or_example_domain';
  }
  if (PLACEHOLDER_LOCALS.has(local)) return 'placeholder_local_part';
  if (
    SERVICE_DOMAINS.has(email) ||
    [...SERVICE_DOMAINS].some((domain) => email.endsWith(`.${domain}`))
  ) {
    return 'unrelated_service_or_widget_domain';
  }
  return null;
}

function normalizeAddress(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function originalSourceUrl(
  company: SourceCompany,
  sourceUrl: string | null,
  homepageUrl: string | null,
): string {
  return sourceUrl ?? homepageUrl ?? `https://${company.domain}/`;
}

function classifyEmail(
  value: string,
  sources: ContactSource[],
  company: SourceCompany,
): ClassifiedEmail {
  const usable = sources.some((source) => {
    if (!isUsableSource(source, company)) return false;
    return !isSourceOperatorMailbox(value, source, company);
  });
  const partner = sources.some((source) => isPartnerSource(source));
  return {
    value,
    ownership: usable ? 'usable' : partner ? 'partner' : 'uncertain',
    employeeName: null,
    employeePosition: null,
    employeeAssociation: 'unknown',
    sources,
  };
}

function sourceFromCandidate(
  origin: ContactEvidenceOrigin,
  candidate: ContactCandidate,
  fallbackSourceUrl: string | null,
  companyIdentityVerified?: boolean,
): ContactSource {
  return {
    origin,
    method: candidate.method,
    sourceUrl: candidate.sourceUrl ?? fallbackSourceUrl,
    evidence: candidate.evidence,
    ...(companyIdentityVerified === undefined
      ? {}
      : { companyIdentityVerified }),
  };
}

function originalEmailCandidate(
  company: SourceCompany,
  email: { value: string; sourceUrl: string | null },
  homepageUrl: string | null,
): EvidenceCandidate {
  const sourceUrl = originalSourceUrl(company, email.sourceUrl, homepageUrl);
  return {
    origin: 'stage04',
    candidate: {
      kind: 'email',
      value: email.value,
      normalized: normalizeEmail(email.value),
      companyName: company.name,
      method: 'stage04',
      sourceUrl,
      evidence: {
        method: 'stage04',
        sourceUrl,
        quote: email.value,
        context: 'Stage 04 profile contact',
        offset: null,
        offsetScope: 'html',
      },
    },
  };
}

function originalPhoneCandidate(
  company: SourceCompany,
  phone: { value: string; normalised: string | null; sourceUrl: string | null },
  homepageUrl: string | null,
): EvidenceCandidate {
  const sourceUrl = originalSourceUrl(company, phone.sourceUrl, homepageUrl);
  return {
    origin: 'stage04',
    candidate: {
      kind: 'phone',
      value: phone.value,
      normalized: phone.normalised,
      companyName: company.name,
      method: 'stage04',
      sourceUrl,
      evidence: {
        method: 'stage04',
        sourceUrl,
        quote: phone.value,
        context: 'Stage 04 profile contact',
        offset: null,
        offsetScope: 'html',
      },
    },
  };
}

function originalAddressCandidate(
  company: SourceCompany,
  evidence: CompanyContactEvidence,
): EvidenceCandidate | null {
  if (
    typeof evidence.original.address !== 'string' ||
    evidence.original.address.trim().length === 0
  ) {
    return null;
  }
  const sourceUrl = originalSourceUrl(company, null, evidence.homepage.url);
  return {
    origin: 'stage04',
    candidate: {
      kind: 'postal_address',
      value: evidence.original.address,
      normalized: null,
      companyName: company.name,
      method: 'stage04',
      sourceUrl,
      structured: {
        streetAddress: evidence.original.address,
        ...(evidence.original.city
          ? { addressLocality: evidence.original.city }
          : {}),
        ...(evidence.original.country
          ? { addressCountry: evidence.original.country }
          : {}),
      },
      evidence: {
        method: 'stage04',
        sourceUrl,
        quote: evidence.original.address,
        context: 'Stage 04 profile address',
        offset: null,
        offsetScope: 'html',
      },
    },
  };
}

function originalRegistrationCandidates(
  company: SourceCompany,
  evidence: CompanyContactEvidence,
): EvidenceCandidate[] {
  const sourceUrl = originalSourceUrl(company, null, evidence.homepage.url);
  return evidence.original.registrationIdentifiers.map((value) => ({
    origin: 'stage04' as const,
    candidate: {
      kind: 'registration_identifier' as const,
      value,
      normalized: null,
      companyName: company.name,
      method: 'stage04' as const,
      sourceUrl,
      identifierKind: 'stage04_identifier',
      evidence: {
        method: 'stage04',
        sourceUrl,
        quote: value,
        context: 'Stage 04 registration identity',
        offset: null,
        offsetScope: 'html' as const,
      },
    },
  }));
}

function allCandidates(evidence: CompanyContactEvidence): EvidenceCandidate[] {
  return [
    ...evidence.homepage.candidates,
    ...evidence.contactPages.flatMap((page) => page.candidates),
    ...(evidence.exa?.pages.flatMap((page) => page.candidates) ?? []),
  ];
}

function compactSource(source: ContactSource): ContactSource {
  return source;
}

/**
 * Consolidates already-collected evidence into the accepted V1 contact result.
 * This is the reference-safe path: no fetch, extraction or Exa decisions occur.
 */
export function consolidateContactEvidence(
  company: SourceCompany,
  evidence: CompanyContactEvidence,
  targetCountry: string,
  targetCountryCode: string,
  limits: ContactDiscoveryLimits = DEFAULT_CONTACT_DISCOVERY_LIMITS,
): ContactDiscoveryCompanyResult {
  const homepageUrl = evidence.homepage.url;
  const candidates = [
    ...evidence.original.emails.map((email) =>
      originalEmailCandidate(company, email, homepageUrl),
    ),
    ...evidence.original.phones.map((phone) =>
      originalPhoneCandidate(company, phone, homepageUrl),
    ),
    ...(originalAddressCandidate(company, evidence)
      ? [originalAddressCandidate(company, evidence) as EvidenceCandidate]
      : []),
    ...originalRegistrationCandidates(company, evidence),
    ...allCandidates(evidence),
  ];

  const emailMap = new Map<string, { sources: ContactSource[] }>();
  const removedContacts: RemovedContact[] = [];
  for (const item of candidates) {
    const candidate = item.candidate;
    if (candidate.kind === 'email') {
      const value = normalizeEmail(candidate.value);
      if (value === null) {
        removedContacts.push({
          kind: 'email',
          value: candidate.value,
          reason: 'invalid_syntax',
          sourceUrl: candidate.sourceUrl,
        });
        continue;
      }
      const reason = emailRemovalReason(value);
      if (reason !== null) {
        removedContacts.push({
          kind: 'email',
          value,
          reason,
          sourceUrl: candidate.sourceUrl,
        });
        continue;
      }
      const record = emailMap.get(value) ?? { sources: [] };
      record.sources.push(
        sourceFromCandidate(
          item.origin,
          candidate,
          homepageUrl,
          item.companyIdentityVerified,
        ),
      );
      emailMap.set(value, record);
    }
  }

  const emails = [...emailMap.entries()]
    .map(([value, record]) =>
      classifyEmail(value, record.sources, company),
    )
    .sort((left, right) => left.value.localeCompare(right.value));
  const usableEmails = emails.filter((email) => email.ownership === 'usable');
  const partnerEmails = emails.filter((email) => email.ownership === 'partner');
  const uncertainEmails = emails.filter((email) => email.ownership === 'uncertain');

  const phoneMap = new Map<
    string,
    { originals: string[]; sources: ContactSource[]; countries: string[] }
  >();
  for (const item of candidates) {
    if (item.candidate.kind !== 'phone') continue;
    const candidate = item.candidate;
    const normalized =
      candidate.normalized ?? normalisePhone(candidate.value);
    if (normalized === null) {
      removedContacts.push({
        kind: 'phone',
        value: candidate.value,
        reason: 'invalid_syntax',
        sourceUrl: candidate.sourceUrl,
      });
      continue;
    }
    const record = phoneMap.get(normalized) ?? {
      originals: [],
      sources: [],
      countries: phoneCountryCandidates(normalized),
    };
    if (!record.originals.includes(candidate.value)) {
      record.originals.push(candidate.value);
    }
    record.sources.push(sourceFromCandidate(item.origin, candidate, homepageUrl));
    phoneMap.set(normalized, record);
  }
  const phones = [...phoneMap.entries()]
    .map(([normalized, record]) => ({
      normalized,
      originalValues: record.originals,
      countries: record.countries,
      local: record.countries.includes(targetCountryCode),
      reliableForeign:
        !record.countries.includes(targetCountryCode) &&
        record.countries.length === 1,
      ambiguous:
        !record.countries.includes(targetCountryCode) &&
        record.countries.length !== 1,
      sources: record.sources,
    }))
    .sort((left, right) => left.normalized.localeCompare(right.normalized));

  const addressMap = new Map<
    string,
    { value: string; structured: Record<string, string> | null; sources: ContactSource[] }
  >();
  for (const item of candidates) {
    if (item.candidate.kind !== 'postal_address') continue;
    const candidate = item.candidate;
    const value = candidate.value.trim();
    if (value.length === 0) continue;
    const key = normalizeAddress(value);
    const record = addressMap.get(key) ?? {
      value,
      structured: candidate.structured ?? null,
      sources: [],
    };
    record.sources.push(sourceFromCandidate(item.origin, candidate, homepageUrl));
    addressMap.set(key, record);
  }
  const addresses = [...addressMap.values()];

  const registrationMap = new Map<
    string,
    { value: string; kind: string; sources: ContactSource[] }
  >();
  for (const item of candidates) {
    if (item.candidate.kind !== 'registration_identifier') continue;
    const candidate = item.candidate;
    const kind = candidate.identifierKind ?? 'identifier';
    const key = `${kind}|${candidate.value.toLowerCase()}`;
    const record = registrationMap.get(key) ?? {
      value: String(candidate.value),
      kind,
      sources: [],
    };
    record.sources.push(sourceFromCandidate(item.origin, candidate, homepageUrl));
    registrationMap.set(key, record);
  }
  const registrationIdentifiers = [...registrationMap.values()];

  const targetAddressEvidence = addresses.some((address) => {
    const country = address.structured?.addressCountry;
    return (
      typeof country === 'string' &&
      resolveCountryCode(country) === targetCountryCode
    );
  });
  const targetTelephoneEvidence = phones.some((phone) => phone.local);
  const foreignPhones = phones.filter(
    (phone) => phone.countries.length > 0 && !phone.local,
  );
  const reliableForeignPhones = phones.filter((phone) => phone.reliableForeign);
  const ambiguousPhones = phones.filter((phone) => phone.ambiguous);
  const foreignTelephoneEvidence =
    usableEmails.length > 0 &&
    !targetTelephoneEvidence &&
    !targetAddressEvidence &&
    phones.length > 0 &&
    foreignPhones.length === phones.length &&
    reliableForeignPhones.length === phones.length &&
    ambiguousPhones.length === 0;

  const exclusionReason =
    usableEmails.length === 0
      ? 'MISSING_USABLE_COMPANY_EMAIL'
      : foreignTelephoneEvidence
        ? 'FOREIGN_TELEPHONE_NO_TARGET_ESTABLISHMENT'
        : null;

  return {
    domain: company.domain,
    companyName: company.name,
    targetCountry,
    targetCountryCode,
    retained: exclusionReason === null,
    exclusionReason,
    emails,
    usableEmails,
    partnerEmails,
    uncertainEmails,
    phones,
    addresses,
    registrationIdentifiers,
    removedContacts,
    targetAddressEvidence,
    targetTelephoneEvidence,
    foreignTelephoneEvidence,
    diagnostics: {
      homepage: evidence.homepage,
      contactPages: evidence.contactPages,
      exa: evidence.exa,
      fetches:
        (evidence.homepage.url === null ? 0 : 1) +
        evidence.contactPages.reduce(
          (sum, page) => sum + (page.attempts ?? 1),
          0,
        ) +
        (evidence.exa?.pages.length ?? 0),
      searches:
        evidence.exa === null
          ? 0
          : (evidence.exa.queries?.length ?? 1),
    },
  };
}

function maskHidden(html: string): string {
  const mask = (value: string): string => ' '.repeat(value.length);
  return html
    .replace(/<!--[\s\S]*?-->/g, mask)
    .replace(/<script\b[\s\S]*?<\/script>/gi, mask)
    .replace(/<style\b[\s\S]*?<\/style>/gi, mask)
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, mask);
}

function textFromHtml(html: string): string {
  return maskHidden(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function linkScore(url: URL, anchor: string): number {
  const text = `${anchor} ${url.pathname} ${url.search}`;
  let score = 0;
  if (/(?:contact|kontakt|susisiek)/i.test(text)) score += 100;
  if (/(?:about|company|apie|imone|legal|imprint|team|people|employee|management|vadov)/i.test(text)) {
    score += 70;
  }
  if (/(?:sales|pardavim|export|eksport|wholesale|didmen|b2b|business|procurement)/i.test(text)) {
    score += 55;
  }
  if (/(?:branch|office|filial|atstov|representative|dealer)/i.test(text)) {
    score += 45;
  }
  return score;
}

export function discoverContactLinks(
  html: string,
  baseUrl: string,
  company: SourceCompany,
  max: number,
): Array<{ url: string; anchorText: string; score: number }> {
  const base = new URL(baseUrl);
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const found = new Map<string, { url: string; anchorText: string; score: number }>();
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(maskHidden(html))) !== null) {
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
      match[1] ?? '',
    );
    const rawHref = href?.[1] ?? href?.[2] ?? href?.[3];
    if (!rawHref) continue;
    if (/^(?:mailto|tel|javascript|data):/i.test(rawHref)) continue;
    let url: URL;
    try {
      url = new URL(rawHref, base);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    if (!isCompanyHost(url.href, company.domain)) continue;
    if (/\.(?:jpg|jpeg|png|gif|webp|svg|ico|css|js|pdf|zip|docx?|xlsx?|pptx?|mp4|mp3|woff2?|ttf)$/i.test(url.pathname)) continue;
    url.hash = '';
    if (url.pathname === '/' || url.pathname === '') continue;
    const anchorText = textFromHtml(match[2] ?? '');
    const score = linkScore(url, anchorText);
    if (score === 0) continue;
    const previous = found.get(url.href);
    if (previous === undefined || previous.score < score) {
      found.set(url.href, { url: url.href, anchorText, score });
    }
  }
  return [...found.values()]
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
    .slice(0, max);
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.href;
  } catch {
    return null;
  }
}

function verifyPageIdentity(company: SourceCompany, html: string): boolean {
  const text = textFromHtml(html).toLowerCase();
  const normalizedText = text.replace(/[^a-z0-9]/g, '');
  const values = [
    company.legalName,
    company.name,
    company.code,
    company.vat,
    company.domain,
  ].filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length >= 2,
  );
  return values.some((value) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      text.includes(value.toLowerCase()) ||
      (normalized.length >= 4 && normalizedText.includes(normalized))
    );
  });
}

function buildEvidencePage(
  page: FetchedContactPage,
  company: SourceCompany,
  extract: (input: { html: string; sourceUrl: string }) => ContactDiscoveryResult,
  origin: ContactEvidenceOrigin,
): ContactPageEvidence {
  const inspected =
    page.status !== null && page.status >= 200 && page.status < 300;
  const identityVerified = inspected && verifyPageIdentity(company, page.body);
  const candidates = inspected
    ? extract({ html: page.body, sourceUrl: page.url }).candidates.map(
        (candidate) => ({ origin, candidate, companyIdentityVerified: identityVerified }),
      )
    : [];
  return {
    url: page.url,
    status: page.status,
    candidates,
    error: page.error,
    failureKind:
      page.failureKind ??
      (page.status === null || page.status < 200 || page.status >= 300
        ? 'retrieval'
        : null),
    attempts: 1,
    retried: false,
  };
}

function contactTerms(targetCountry: string): string {
  const key = targetCountry.trim().toLowerCase().replace(/\s+/g, '');
  return (
    LOCAL_CONTACT_TERMS[key] ??
    LOCAL_CONTACT_TERMS[targetCountry.trim().toLowerCase()] ??
    'contact email phone'
  );
}

function exaQueries(company: SourceCompany, targetCountry: string): string[] {
  const terms = contactTerms(targetCountry);
  const first = `${company.domain} ${terms}`;
  const identity =
    company.legalName?.trim() ||
    company.name?.trim() ||
    company.code?.trim() ||
    company.vat?.trim() ||
    '';
  return identity.length === 0 ? [first] : [first, `${identity} ${terms}`];
}

function pageRelevantToCompany(
  company: SourceCompany,
  result: { url: string; title: string; snippet: string },
): boolean {
  const text = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
  return [
    company.name,
    company.legalName,
    company.code,
    company.vat,
    company.domain,
    company.domain.split('.')[0],
  ]
    .filter((value): value is string => typeof value === 'string' && value.length >= 4)
    .some((value) => text.includes(value.toLowerCase()));
}

/**
 * Executes homepage, contact-page and conditionally Exa discovery for one
 * company. Exa is called only when the first two stages produce no usable
 * company email.
 */
export async function collectCompanyEvidence(
  company: SourceCompany,
  ports: ContactDiscoveryPorts,
  extract: (input: { html: string; sourceUrl: string }) => ContactDiscoveryResult,
  limits: ContactDiscoveryLimits = DEFAULT_CONTACT_DISCOVERY_LIMITS,
  targetCountry = '',
): Promise<CompanyContactEvidence> {
  const homepage = await ports.homepage.fetch(company.domain);
  const evidence: CompanyContactEvidence = {
    original: {
      emails: company.emails,
      phones: company.phones,
      address: company.address,
      city: company.city,
      country: company.country,
      registrationIdentifiers: [company.code, company.vat].filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      ),
    },
    homepage: {
      url: homepage.url,
      status: homepage.status,
      candidates:
        homepage.status !== null && homepage.status >= 200 && homepage.status < 300
          ? extract({ html: homepage.body, sourceUrl: homepage.url }).candidates.map(
              (candidate) => ({ origin: 'homepage', candidate }),
            )
          : [],
      error: homepage.error,
    },
    contactPages: [],
    exa: null,
  };

  if (homepage.status !== null && homepage.status >= 200 && homepage.status < 300) {
    const links = discoverContactLinks(
      homepage.body,
      homepage.url,
      company,
      limits.maxContactPages,
    );
    for (const link of links) {
      if (evidence.contactPages.length >= limits.maxContactPages) break;
      const page = await ports.page.fetch(link.url);
      evidence.contactPages.push(
        buildEvidencePage(page, company, extract, 'contact_page'),
      );
    }
  }

  let interim = consolidateContactEvidence(
    company,
    evidence,
    '',
    '',
    limits,
  );

  if (interim.usableEmails.length === 0) {
    const retryIndex = evidence.contactPages.findIndex(
      (page) =>
        page.status === null &&
        (page.failureKind === 'timeout' ||
          /\btimed out\b/i.test(page.error ?? '')),
    );
    if (retryIndex >= 0) {
      const previous = evidence.contactPages[retryIndex];
      if (previous !== undefined) {
        const page = await ports.page.fetch(previous.url);
        const retried = buildEvidencePage(
          page,
          company,
          extract,
          'contact_page',
        );
        retried.attempts = (previous.attempts ?? 1) + 1;
        retried.retried = true;
        evidence.contactPages[retryIndex] = retried;
        interim = consolidateContactEvidence(
          company,
          evidence,
          '',
          '',
          limits,
        );
      }
    }
  }

  if (interim.usableEmails.length === 0 && limits.maxSearches > 0) {
    const queries = exaQueries(company, targetCountry).slice(
      0,
      Math.min(2, limits.maxSearches),
    );
    const attempts: ExaQueryEvidence[] = [];
    const previouslyFetched = new Set(
      [homepage.url, ...evidence.contactPages.map((page) => page.url)]
        .map(normalizeUrl)
        .filter((value): value is string => value !== null),
    );

    for (const query of queries) {
      try {
        const search = await ports.exa.search(
          query,
          limits.exaResults,
          targetCountry,
        );
        const selected = search.results
          .filter((result) => {
            const normalized = normalizeUrl(result.url);
            return (
              normalized !== null &&
              !previouslyFetched.has(normalized) &&
              /^(?:https?:)/i.test(normalized) &&
              (isCompanyHost(result.url, company.domain) ||
                pageRelevantToCompany(company, result))
            );
          })
          .slice(0, limits.maxExaPages);
        const pages: ContactPageEvidence[] = [];
        for (const result of selected) {
          const page = await ports.page.fetch(result.url);
          pages.push(buildEvidencePage(page, company, extract, 'exa'));
          const normalized = normalizeUrl(page.url);
          if (normalized !== null) previouslyFetched.add(normalized);
        }
        attempts.push({
          query: search.query,
          results: search.results,
          pages,
          error: null,
        });
      } catch (error) {
        attempts.push({
          query,
          results: [],
          pages: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (attempts.length > 0) {
        const first = attempts[0];
        evidence.exa = {
          query: first?.query ?? query,
          results: attempts.flatMap((attempt) => attempt.results),
          pages: attempts.flatMap((attempt) => attempt.pages),
          error:
            attempts.find((attempt) => attempt.error !== null)?.error ?? null,
          queries: attempts,
        };
      }

      const afterSearch = consolidateContactEvidence(
        company,
        evidence,
        '',
        '',
        limits,
      );
      if (afterSearch.usableEmails.length > 0) break;
    }
  }
  return evidence;
}

export class ContactDiscoveryPipeline {
  constructor(
    private readonly ports: ContactDiscoveryPorts,
    private readonly extract: (input: {
      html: string;
      sourceUrl: string;
    }) => ContactDiscoveryResult,
    private readonly limits: ContactDiscoveryLimits = DEFAULT_CONTACT_DISCOVERY_LIMITS,
  ) {}

  async collect(
    company: SourceCompany,
    targetCountry: string,
    targetCountryCode: string,
  ): Promise<ContactDiscoveryCompanyResult> {
    const evidence = await collectCompanyEvidence(
      company,
      this.ports,
      this.extract,
      this.limits,
      targetCountry,
    );
    return consolidateContactEvidence(
      company,
      evidence,
      targetCountry,
      targetCountryCode,
      this.limits,
    );
  }

  async run(study: SourceStudy): Promise<ContactDiscoveryPipelineResult> {
    const companies: ContactDiscoveryCompanyResult[] = [];
    for (const company of study.companies) {
      companies.push(
        await this.collect(
          company,
          study.targetCountry,
          study.targetCountryCode ?? '',
        ),
      );
    }
    const retained = companies.filter((company) => company.retained);
    const excluded = companies.filter((company) => !company.retained);
    return {
      sourceCompanyCount: study.rawCompanyCount,
      retainedCompanies: retained,
      excludedCompanies: excluded,
      summary: {
        retainedCompanies: retained.length,
        excludedCompanies: excluded.length,
        exclusionsMissingUsableEmail: excluded.filter(
          (company) => company.exclusionReason === 'MISSING_USABLE_COMPANY_EMAIL',
        ).length,
        exclusionsForeignTelephone: excluded.filter(
          (company) =>
            company.exclusionReason ===
            'FOREIGN_TELEPHONE_NO_TARGET_ESTABLISHMENT',
        ).length,
        companiesWithUsableEmail: companies.filter(
          (company) => company.usableEmails.length > 0,
        ).length,
        usableUniqueCompanyEmailPairs: companies.reduce(
          (sum, company) => sum + company.usableEmails.length,
          0,
        ),
        partnerDistributorEmailPairs: companies.reduce(
          (sum, company) => sum + company.partnerEmails.length,
          0,
        ),
        uncertainEmailPairs: companies.reduce(
          (sum, company) => sum + company.uncertainEmails.length,
          0,
        ),
      },
    };
  }
}
