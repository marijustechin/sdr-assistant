import { createHash } from 'node:crypto';

import countries from 'i18n-iso-countries';
import { z } from 'zod';

import {
  LEAD_QUALIFICATION_POLICY_VERSION,
  LEAD_QUALIFICATION_PROMPT_VERSION,
  LEAD_QUALIFICATION_SCHEMA_VERSION,
  LEAD_QUALIFICATION_SEMANTIC_MODEL,
  LEAD_QUALIFICATION_VERSION,
} from './lead-qualification.constants.js';
import type {
  SourceCompany,
  SourceEmail,
  SourceOffer,
  SourcePhone,
  SourceStudy,
} from './lead-qualification.types.js';

export type InputErrorCode =
  | 'INCOMPLETE_RESEARCH'
  | 'MISSING_COMPANY_PROFILES'
  | 'UNSUPPORTED_RESULT'
  | 'MALFORMED_COMPANIES'
  | 'SOURCE_TOO_LARGE';

export class LeadQualificationInputError extends Error {
  readonly code: InputErrorCode;

  constructor(code: InputErrorCode, message: string) {
    super(message);
    this.name = 'LeadQualificationInputError';
    this.code = code;
  }
}

const sourceEmailSchema = z.object({
  value: z.string().min(3),
  label: z.string().nullish(),
  sourceUrl: z.string().nullish(),
});

const sourcePhoneSchema = z.object({
  value: z.string().min(3),
  normalised: z.string().nullish(),
  label: z.string().nullish(),
  sourceUrl: z.string().nullish(),
});

const sourceOfferSchema = z.object({
  id: z.string().nullish(),
  item: z.string().min(1),
  verdict: z.enum(['a', 'b']).nullish(),
  sourceUrl: z.string().nullish(),
});

const sourceCompanySchema = z.object({
  domain: z.string().min(1),
  registrableDomain: z.string().nullish(),
  status: z.string().nullish(),
  company: z.object({
    name: z.string().nullish(),
    legalName: z.string().nullish(),
    code: z.string().nullish(),
    vat: z.string().nullish(),
    address: z.string().nullish(),
    city: z.string().nullish(),
    country: z.string().nullish(),
    emails: z.array(sourceEmailSchema).default([]),
    phones: z.array(sourcePhoneSchema).default([]),
    contactFormUrl: z.string().nullish(),
    sources: z.array(z.string()).default([]),
  }),
  offers: z.array(sourceOfferSchema).default([]),
});

export type ResearchSourceRecord = {
  id: string;
  status: string;
  country: string;
  result: unknown;
  productName: string;
  productDescription: string;
};

function normaliseDomain(value: string): string | null {
  const cleaned = value.trim().toLowerCase();

  if (cleaned.length === 0) return null;

  try {
    const url = new URL(
      cleaned.includes('://') ? cleaned : `https://${cleaned}`,
    );
    const host = url.hostname.toLowerCase().replace(/\.$/, '');

    if (host.length === 0 || host.includes(' ')) return null;

    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function nullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function emailFromSource(value: z.infer<typeof sourceEmailSchema>): SourceEmail {
  return {
    value: value.value.trim(),
    label: nullableString(value.label),
    sourceUrl: nullableString(value.sourceUrl),
  };
}

function phoneFromSource(value: z.infer<typeof sourcePhoneSchema>): SourcePhone {
  return {
    value: value.value.trim(),
    normalised: nullableString(value.normalised),
    label: nullableString(value.label),
    sourceUrl: nullableString(value.sourceUrl),
  };
}

function offerFromSource(value: z.infer<typeof sourceOfferSchema>): SourceOffer {
  return {
    id: nullableString(value.id),
    item: value.item.trim(),
    verdict: value.verdict ?? null,
    sourceUrl: nullableString(value.sourceUrl),
  };
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function buildCompany(
  parsed: z.infer<typeof sourceCompanySchema>,
  raw: unknown,
  sourceIndex: number,
): SourceCompany | null {
  const domain = normaliseDomain(parsed.domain);

  if (domain === null) return null;

  const company = parsed.company;
  const registrableDomain = normaliseDomain(
    parsed.registrableDomain ?? domain,
  );
  const emails: SourceEmail[] = company.emails.map(emailFromSource);
  const phones: SourcePhone[] = company.phones.map(phoneFromSource);
  const offers: SourceOffer[] = parsed.offers.map(offerFromSource);

  return {
    sourceIndex,
    key: domain,
    domain,
    registrableDomain: registrableDomain ?? domain,
    name: nullableString(company.name),
    legalName: nullableString(company.legalName),
    code: nullableString(company.code),
    vat: nullableString(company.vat),
    address: nullableString(company.address),
    city: nullableString(company.city),
    country: nullableString(company.country),
    emails,
    phones,
    sources: company.sources
      .map((source) => source.trim())
      .filter((source) => source.length > 0),
    offers,
    profileHash: sha256(stableStringify(raw)),
  };
}

function readResultObject(result: unknown): {
  schemaVersion: number | null;
  companies: unknown[];
} {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    throw new LeadQualificationInputError(
      'MISSING_COMPANY_PROFILES',
      'The research result has no supported company-profile object.',
    );
  }

  const record = result as Record<string, unknown>;
  const schemaVersion =
    typeof record.schemaVersion === 'number' ? record.schemaVersion : null;

  if (schemaVersion !== null && schemaVersion !== LEAD_QUALIFICATION_SCHEMA_VERSION) {
    throw new LeadQualificationInputError(
      'UNSUPPORTED_RESULT',
      `Unsupported research result schemaVersion: ${schemaVersion}.`,
    );
  }

  if (!Array.isArray(record.companies)) {
    throw new LeadQualificationInputError(
      'MISSING_COMPANY_PROFILES',
      'The research result does not contain a companies array.',
    );
  }

  return { schemaVersion, companies: record.companies };
}

export function parseResearchSource(
  record: ResearchSourceRecord,
  maxSourceBytes: number,
): SourceStudy {
  if (record.status !== 'COMPLETED') {
    throw new LeadQualificationInputError(
      'INCOMPLETE_RESEARCH',
      'Only a completed research can be qualified.',
    );
  }

  let resultBytes: number;

  try {
    resultBytes = Buffer.byteLength(JSON.stringify(record.result) ?? '');
  } catch {
    throw new LeadQualificationInputError(
      'UNSUPPORTED_RESULT',
      'The research result is not JSON-serialisable.',
    );
  }

  if (resultBytes > maxSourceBytes) {
    throw new LeadQualificationInputError(
      'SOURCE_TOO_LARGE',
      `The research result exceeds ${maxSourceBytes} bytes.`,
    );
  }

  const { schemaVersion, companies: rawCompanies } = readResultObject(
    record.result,
  );
  const companies: SourceCompany[] = [];
  const invalidProfiles: SourceStudy['invalidProfiles'] = [];
  const orderedInput: Array<{
    sourceIndex: number;
    profileHash: string;
    valid: boolean;
    key: string | null;
  }> = [];

  for (let index = 0; index < rawCompanies.length; index += 1) {
    const raw = rawCompanies[index];
    const rawHash = sha256(stableStringify(raw));
    const parsed = sourceCompanySchema.safeParse(raw);
    const company =
      parsed.success ? buildCompany(parsed.data, raw, index) : null;

    if (company === null) {
      invalidProfiles.push({ sourceIndex: index, profileHash: rawHash });
      orderedInput.push({
        sourceIndex: index,
        profileHash: rawHash,
        valid: false,
        key: null,
      });
      continue;
    }

    companies.push(company);
    orderedInput.push({
      sourceIndex: index,
      profileHash: company.profileHash,
      valid: true,
      key: company.key,
    });
  }

  const targetCountryCode =
    countries.getAlpha2Code(record.country, 'en') ??
    (record.country.length === 2 ? record.country.toUpperCase() : null);
  const inputFingerprint = sha256(
    stableStringify({
      productName: record.productName,
      productDescription: record.productDescription,
      targetCountry: record.country,
      targetCountryCode,
      schemaVersion,
      qualificationVersion: LEAD_QUALIFICATION_VERSION,
      policyVersion: LEAD_QUALIFICATION_POLICY_VERSION,
      promptVersion: LEAD_QUALIFICATION_PROMPT_VERSION,
      semanticModel: LEAD_QUALIFICATION_SEMANTIC_MODEL,
      orderedInput,
    }),
  );

  return {
    id: record.id,
    targetCountry: record.country,
    targetCountryCode,
    productName: record.productName,
    productDescription: record.productDescription,
    resultSchemaVersion: schemaVersion,
    companies,
    invalidProfiles,
    skippedProfiles: invalidProfiles.length,
    rawCompanyCount: rawCompanies.length,
    inputFingerprint,
  };
}
