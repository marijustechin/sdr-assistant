import countries from 'i18n-iso-countries';

import {
  CALLING_CODE_COUNTRIES,
  COUNTRY_CALLING_CODES,
} from './phone-calling-codes.js';
import type {
  EvidenceRef,
  GeographicCheck,
  SourceCompany,
  SourcePhone,
} from './lead-qualification.types.js';

const DISPLAY_LOCALES = [
  'en',
  'lt',
  'lv',
  'pl',
  'et',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'fi',
  'sv',
  'da',
  'no',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'uk',
  'ru',
];

function normaliseCountryText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Text extraction deliberately contains country *names* only. A standalone
 * two-letter token in an address is not an ISO country declaration.
 */
const COUNTRY_NAME_INDEX = new Map<string, Set<string>>();

for (const code of Object.keys(countries.getAlpha2Codes())) {
  const names = new Set<string>();
  for (const locale of DISPLAY_LOCALES) {
    try {
      const display = new Intl.DisplayNames([locale], { type: 'region' });
      const name = display.of(code);
      if (name) names.add(name);
    } catch {
      // An unavailable locale must not break the country table.
    }
  }
  const english = countries.getName(code, 'en');
  if (english) names.add(english);

  for (const name of names) {
    const normalised = normaliseCountryText(name);
    if (normalised.length < 3) continue;
    const existing = COUNTRY_NAME_INDEX.get(normalised) ?? new Set<string>();
    existing.add(code);
    COUNTRY_NAME_INDEX.set(normalised, existing);
  }
}

/** Resolves an explicit alpha-2 code, English or common local country name. */
export function resolveCountryCode(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (/^[a-z]{2}$/i.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    if (countries.getName(upper, 'en')) return upper;
  }

  const alpha2 = countries.getAlpha2Code(trimmed, 'en');
  if (alpha2) return alpha2;
  const matches = COUNTRY_NAME_INDEX.get(normaliseCountryText(trimmed));
  return matches?.size === 1 ? [...matches][0] ?? null : null;
}

/** Extracts known country names from unstructured text; never 2-letter words. */
export function extractCountryCodes(text: string): string[] {
  if (text.trim().length === 0) return [];
  const haystack = ` ${normaliseCountryText(text)} `;
  const found = new Set<string>();

  for (const [name, codes] of COUNTRY_NAME_INDEX) {
    if (haystack.includes(` ${name} `)) {
      for (const code of codes) found.add(code);
    }
  }

  return [...found].sort();
}

export function callingCodeForCountry(countryCode: string | null): string | null {
  if (countryCode === null) return null;
  return COUNTRY_CALLING_CODES[countryCode.toUpperCase()] ?? null;
}

export function normalisePhone(value: string): string | null {
  const trimmed = value.trim().replace(/^tel:/i, '');
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (!plus && !trimmed.startsWith('00')) return null;
  return `+${digits.replace(/^00/, '')}`;
}

export function phoneCountryCandidates(e164: string | null): string[] {
  if (e164 === null || !e164.startsWith('+')) return [];
  const digits = e164.slice(1);
  let best: string[] = [];

  for (let length = 1; length <= 3 && length <= digits.length; length += 1) {
    const candidates = CALLING_CODE_COUNTRIES[digits.slice(0, length)];
    if (candidates && candidates.length > 0) best = [...candidates];
  }

  return best;
}

export type PhoneSignal = {
  normalised: string | null;
  sourceUrl: string | null;
};

export type GeographySignals = {
  addressCountry: string | null;
  targetAddress: boolean;
  foreignAddress: boolean;
  unverifiedTargetAddress: boolean;
  unverifiedForeignAddress: boolean;
  unverifiedAddressCountry: string | null;
  foreignAddressCountries: string[];
  localAddressEvidence: EvidenceRef[];
  foreignAddressEvidence: EvidenceRef[];
  localBranchEvidence: EvidenceRef[];
  phones: PhoneSignal[];
  discoveryAttempted: boolean;
  discoveryTechnicalFailure: boolean;
};

export type AddressEvidence = {
  local: EvidenceRef[];
  foreign: EvidenceRef[];
  localCountries: string[];
  foreignCountries: string[];
};

function phoneSignals(phones: SourcePhone[]): PhoneSignal[] {
  return phones
    .filter((phone) => phone.sourceUrl !== null)
    .map((phone) => ({
      normalised: phone.normalised ?? normalisePhone(phone.value),
      sourceUrl: phone.sourceUrl,
    }))
    .filter((phone) => phone.normalised !== null);
}

function addressSegment(text: string, address: string): string | null {
  const normalisedAddress = normaliseCountryText(address);
  const segments = text
    .split(/\r?\n|(?<=[.!?;|])\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  return (
    segments.find((segment) =>
      normaliseCountryText(segment).includes(normalisedAddress),
    ) ?? null
  );
}

/**
 * Extracts source-backed address evidence only when the page repeats the
 * company's printed address and names a country in the same local fragment.
 * Country mentions elsewhere, shipping destinations and standalone two-letter
 * words are never associated with the address.
 */
export function extractAddressEvidence(
  pageUrl: string,
  text: string,
  company: SourceCompany,
  targetCountryCode: string | null,
): AddressEvidence {
  const empty: AddressEvidence = {
    local: [],
    foreign: [],
    localCountries: [],
    foreignCountries: [],
  };
  if (company.address === null || company.address.trim().length < 5) return empty;

  const segment = addressSegment(text, company.address);
  if (segment === null) return empty;

  const target = targetCountryCode?.toUpperCase() ?? null;
  const codes = extractCountryCodes(segment);
  if (target === null || codes.length === 0) return empty;

  const quote = segment.slice(0, 500);
  const local: EvidenceRef[] = [];
  const foreign: EvidenceRef[] = [];
  const localCountries: string[] = [];
  const foreignCountries: string[] = [];

  for (const code of codes) {
    const evidence: EvidenceRef = {
      url: pageUrl,
      kind: 'address',
      quote,
      source: 'http',
      observedAt: new Date().toISOString(),
    };
    if (code === target) {
      local.push(evidence);
      localCountries.push(code);
    } else {
      foreign.push(evidence);
      foreignCountries.push(code);
    }
  }

  return { local, foreign, localCountries, foreignCountries };
}
export function buildGeographySignals(
  company: SourceCompany,
  targetCountryCode: string | null,
): GeographySignals {
  const target = targetCountryCode?.toUpperCase() ?? null;
  const addressText = [company.address, company.city]
    .filter((value): value is string => value !== null && value.length > 0)
    .join(', ');
  const addressCodes = new Set(extractCountryCodes(addressText));
  const countryCode = resolveCountryCode(company.country);
  if (countryCode !== null) addressCodes.add(countryCode);

  const unverifiedTargetAddress =
    target !== null &&
    company.address !== null &&
    addressCodes.has(target);
  const unverifiedForeign = [...addressCodes].filter(
    (code) => target !== null && code !== target,
  );
  const unverifiedAddressCountry =
    unverifiedTargetAddress && unverifiedForeign.length > 0
      ? 'conflict'
      : unverifiedTargetAddress
        ? target
        : unverifiedForeign[0] ?? null;

  return {
    addressCountry: null,
    targetAddress: false,
    foreignAddress: false,
    unverifiedTargetAddress,
    unverifiedForeignAddress: unverifiedForeign.length > 0,
    unverifiedAddressCountry,
    foreignAddressCountries: [],
    localAddressEvidence: [],
    foreignAddressEvidence: [],
    localBranchEvidence: [],
    phones: phoneSignals(company.phones),
    discoveryAttempted: false,
    discoveryTechnicalFailure: false,
  };
}

function evidenceFor(
  urls: Array<string | null>,
  kind: 'address' | 'phone',
): EvidenceRef[] {
  return urls
    .filter((url): url is string => url !== null)
    .slice(0, 3)
    .map((url) => ({
      url,
      kind,
      quote: null,
      source: 'stage04' as const,
      observedAt: new Date().toISOString(),
    }));
}

function pass(
  signals: GeographySignals,
  detail: string,
  localPresence: boolean,
  foreignPresence: boolean,
  conflict: boolean,
  phoneCountries: string[],
): GeographicCheck {
  return {
    status: 'PASS',
    reason: null,
    evidence: [
      ...signals.localAddressEvidence,
      ...signals.foreignAddressEvidence,
      ...signals.localBranchEvidence,
      ...evidenceFor(signals.phones.map((phone) => phone.sourceUrl), 'phone'),
    ],
    detail,
    technicalFailure: false,
    addressCountry: signals.addressCountry,
    phoneCountries,
    localPresence,
    foreignPresence,
    conflict,
    discoveryAttempted: signals.discoveryAttempted,
  };
}

function fail(
  reason: 'COUNTRY_MISMATCH' | 'COUNTRY_UNCONFIRMED' | 'PROCESSING_FAILED',
  detail: string,
  signals: GeographySignals,
  localPresence: boolean,
  foreignPresence: boolean,
  conflict: boolean,
  phoneCountries: string[],
  technicalFailure = false,
): GeographicCheck {
  return {
    status: technicalFailure ? 'UNKNOWN' : 'FAIL',
    reason,
    evidence: [
      ...signals.localAddressEvidence,
      ...signals.foreignAddressEvidence,
      ...signals.localBranchEvidence,
      ...evidenceFor(signals.phones.map((phone) => phone.sourceUrl), 'phone'),
    ],
    detail,
    technicalFailure,
    addressCountry: signals.addressCountry,
    phoneCountries,
    localPresence,
    foreignPresence,
    conflict,
    discoveryAttempted: signals.discoveryAttempted,
  };
}

export function evaluateGeography(
  signals: GeographySignals,
  targetCountryCode: string | null,
): GeographicCheck {
  const target = targetCountryCode?.toUpperCase() ?? null;
  const localAddress = signals.localAddressEvidence.length > 0;
  const foreignAddress = signals.foreignAddressEvidence.length > 0;
  const localBranch = signals.localBranchEvidence.length > 0;
  const phoneCandidates = signals.phones.map((phone) =>
    phoneCountryCandidates(phone.normalised),
  );
  const phoneCountries = [
    ...new Set(phoneCandidates.flatMap((codes) => codes)),
  ].sort();
  const localPhone = phoneCandidates.some(
    (codes) => target !== null && codes.length === 1 && codes[0] === target,
  );
  const foreignPhoneCountries = new Set(
    phoneCandidates
      .filter(
        (codes) =>
          codes.length > 0 && (target === null || !codes.includes(target)),
      )
      .flatMap((codes) => codes),
  );
  const ambiguousPhone = phoneCandidates.some(
    (codes) => codes.length > 1 && target !== null && codes.includes(target),
  );
  const foreignAddressCountries = [
    ...new Set([
      ...signals.foreignAddressCountries,
      ...(signals.unverifiedForeignAddress && signals.unverifiedAddressCountry
        ? [signals.unverifiedAddressCountry]
        : []),
    ]),
  ].filter((code) => code !== 'conflict');
  const matchingForeignPhone = foreignAddressCountries.some((country) =>
    foreignPhoneCountries.has(country),
  );
  const foreignAddressOrSignal = foreignAddress || signals.unverifiedForeignAddress;
  const conflict =
    (localAddress && (foreignAddress || signals.unverifiedForeignAddress)) ||
    (localPhone && foreignPhoneCountries.size > 0) ||
    (foreignAddressOrSignal && localPhone) ||
    foreignPhoneCountries.size > 1 ||
    (foreignAddressOrSignal &&
      foreignPhoneCountries.size > 0 &&
      !matchingForeignPhone);

  if (target === null) {
    return fail(
      'COUNTRY_UNCONFIRMED',
      'No target-country calling-code mapping is available.',
      signals,
      false,
      foreignAddressOrSignal,
      false,
      phoneCountries,
    );
  }

  if (localAddress && localPhone && !conflict) {
    signals.addressCountry = target;
    return pass(
      signals,
      'Source-backed target-country address and matching local telephone.',
      true,
      foreignAddressOrSignal,
      conflict,
      phoneCountries,
    );
  }

  if (localBranch) {
    signals.addressCountry = target;
    return pass(
      signals,
      'Source-backed local branch or subsidiary evidence.',
      true,
      foreignAddressOrSignal,
      conflict,
      phoneCountries,
    );
  }

  if (
    foreignAddressOrSignal &&
    matchingForeignPhone &&
    foreignPhoneCountries.size > 0 &&
    !localAddress &&
    !localBranch &&
    !localPhone
  ) {
    signals.addressCountry = foreignAddressCountries[0] ?? null;
    return fail(
      'COUNTRY_MISMATCH',
      'Foreign address signal with a matching foreign telephone and no local establishment evidence.',
      signals,
      false,
      true,
      conflict,
      phoneCountries,
    );
  }

  if (
    localAddress &&
    !foreignAddressOrSignal &&
    !foreignPhoneCountries.size &&
    !ambiguousPhone
  ) {
    signals.addressCountry = target;
    return pass(
      signals,
      'Source-backed target-country business address; no conflicting foreign telephone.',
      true,
      false,
      false,
      phoneCountries,
    );
  }

  if (signals.discoveryTechnicalFailure) {
    return fail(
      'PROCESSING_FAILED',
      'Geographic discovery failed technically.',
      signals,
      localAddress,
      foreignAddressOrSignal,
      conflict,
      phoneCountries,
      true,
    );
  }

  if (signals.discoveryAttempted) {
    return fail(
      'COUNTRY_UNCONFIRMED',
      'Bounded discovery did not resolve the geographic evidence.',
      signals,
      localAddress,
      foreignAddressOrSignal,
      conflict,
      phoneCountries,
    );
  }

  return {
    status: 'UNKNOWN',
    reason: 'COUNTRY_UNCONFIRMED',
    evidence: [
      ...signals.localAddressEvidence,
      ...signals.foreignAddressEvidence,
      ...signals.localBranchEvidence,
      ...evidenceFor(signals.phones.map((phone) => phone.sourceUrl), 'phone'),
    ],
    detail: 'Geographic evidence is incomplete; bounded discovery is required.',
    technicalFailure: false,
    addressCountry: null,
    phoneCountries,
    localPresence: localAddress,
    foreignPresence: foreignAddressOrSignal,
    conflict,
    discoveryAttempted: false,
  };
}
