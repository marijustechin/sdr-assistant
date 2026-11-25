import countries from 'i18n-iso-countries';

export type GeographyEffect = 'allow' | 'deny' | 'unknown';

export type GeographyScope = 'target' | 'global' | 'foreign' | 'none';

export type GeographyDecision = {
  effect: GeographyEffect;
  supported: boolean;
  detail: string;
};

const GEO_LOCALES = [
  'en',
  'lt',
  'lv',
  'pl',
  'de',
  'et',
  'fi',
  'sv',
  'da',
  'fr',
  'es',
  'it',
  'pt',
  'nl',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'uk',
  'ru',
] as const;

const GLOBAL_SCOPE =
  /\b(?:es|eu|europe|european union|europos|europaische union|unie europejska|unia europejska|visas es salis|visame pasaulyje|pasaulio|worldwide|world|global|international)\b/u;

const NEGATIVE_ACTION =
  /\b(?:nepristat\w*|neissiun\w*|neparduod\w*|negalim\w*|neimanom\w*|nie wysyl\w*|nie dostarcz\w*|niedost\w*|do not deliver|cannot deliver|no delivery|nicht\w*|kein\w*)\b/u;

const EXCLUSION =
  /\b(?:isskyrus|neiskaiciuojant|neiskaitant|except|excluding|with the exception of|oprocz)\b/u;

const EXPLICIT_ONLY =
  /\b(?:tik|tylko|jedynie|only|exclusively|nur|tikai|vain|wylacznie|ausschliesslich)\b/u;

const PICKUP_LOCATION =
  /(?:[Aa]tsiėmim[\p{L}]*|[Aa]tsiemim[\p{L}]*|[Aa]tsiim[\p{L}]*|[Pp]ickup|[Cc]ollection|[Pp]arduotuv[\p{L}]*|[Vv]eikal[\p{L}]*|[Ss]klep[\p{L}]*|[Ss]hop|[Ss]tore)\s+[^\n]{0,35}?\b([A-ZÀ-Ý][\p{L}-]{3,})/u;

type CountryGeo = {
  target: RegExp | null;
  foreign: RegExp | null;
};

const countryNames = new Map<string, string[]>();
let namesLoaded = false;
const geoCache = new Map<string, CountryGeo>();

function normalize(value: string): string {
  return value
    .replace(/×/g, 'x')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

function loadCountryNames(): void {
  if (namesLoaded) return;

  namesLoaded = true;
  const codes = Object.keys(countries.getAlpha2Codes());

  for (const code of codes) countryNames.set(code, []);

  for (const locale of GEO_LOCALES) {
    let display: Intl.DisplayNames;

    try {
      display = new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      continue;
    }

    for (const code of codes) {
      const name = display.of(code);

      if (name) countryNames.get(code)?.push(name);
    }
  }
}

function countryCodeFor(country: string): string | null {
  const direct = countries.getAlpha2Code(country, 'en');

  if (direct) return direct;

  loadCountryNames();
  const wanted = normalize(country).trim();

  for (const [code, names] of countryNames) {
    if (names.some((name) => normalize(name).trim() === wanted)) return code;
  }

  return null;
}

function stemsFor(code: string): string[] {
  loadCountryNames();
  const stems = new Set<string>();

  for (const name of countryNames.get(code) ?? []) {
    const value = normalize(name)
      .replace(/^the\s+/, '')
      .trim();

    if (value.length < 4) continue;

    stems.add(value.slice(0, Math.min(5, value.length)));

    for (const word of value.split(/\s+/)) {
      if (word.length >= 5) stems.add(word.slice(0, Math.min(5, word.length)));
    }
  }

  return [...stems].filter((stem) => stem.length >= 4);
}

function alternation(stems: string[]): RegExp | null {
  if (stems.length === 0) return null;

  const body = stems
    .map((stem) => stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((left, right) => right.length - left.length)
    .join('|');

  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${body})`, 'u');
}

function geoFor(targetCode: string): CountryGeo {
  const cached = geoCache.get(targetCode);

  if (cached) return cached;

  const target = alternation(stemsFor(targetCode));
  const foreignStems: string[] = [];

  for (const code of Object.keys(countries.getAlpha2Codes())) {
    if (code !== targetCode) foreignStems.push(...stemsFor(code));
  }

  const geo = {
    target,
    foreign: alternation([...new Set(foreignStems)]),
  };

  geoCache.set(targetCode, geo);
  return geo;
}

function scopeOf(text: string, targetCode: string): GeographyScope {
  const value = normalize(text);
  const geo = geoFor(targetCode);

  if (geo.target?.test(value)) return 'target';
  if (GLOBAL_SCOPE.test(value)) return 'global';
  if (geo.foreign?.test(value)) return 'foreign';

  return 'none';
}

function matchIndex(regex: RegExp | null, text: string): number | null {
  if (!regex) return null;

  const match = regex.exec(text);
  return match ? (match.index ?? 0) : null;
}

function near(
  regex: RegExp,
  text: string,
  index: number,
  before = 80,
  after = 100,
): boolean {
  return regex.test(
    text.slice(Math.max(0, index - before), Math.min(text.length, index + after)),
  );
}

function targetPickupLocation(
  sourceText: string,
  sourceUrl: string,
  targetCode: string,
  sourceScope: GeographyScope,
): boolean {
  if (sourceScope === 'foreign') return false;
  if (!PICKUP_LOCATION.test(sourceText)) return false;
  if (sourceScope === 'target') return true;

  let host: string;

  try {
    host = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return false;
  }

  return (host.split('.').pop() ?? '') === targetCode.toLowerCase();
}

function decision(
  effect: GeographyEffect,
  detail: string,
): GeographyDecision {
  return { effect, supported: effect !== 'unknown', detail };
}

/**
 * What the statement does for a buyer in targetCountry, not merely which
 * country names it contains. Foreign-only allows are unknown; explicit
 * foreign-only restrictions and target exclusions are denials; "not to
 * Lithuania" is a denial, "not to Latvia" is unknown; a location-free
 * delivery/purchase statement is unknown.
 */
export function decideEvidenceGeography(input: {
  channel: 'delivery' | 'pickup' | 'purchase';
  direction: 'allows' | 'restricts';
  quote: string;
  sourceText: string;
  sourceUrl: string;
  targetCountry: string;
}): GeographyDecision {
  const targetCode = countryCodeFor(input.targetCountry);

  if (!targetCode) return decision('allow', '');

  const quote = normalize(input.quote);
  const geo = geoFor(targetCode);
  const quoteScope = scopeOf(input.quote, targetCode);
  const sourceScope = scopeOf(input.sourceText, targetCode);
  const targetIndex = matchIndex(geo.target, quote);
  const foreignIndex = matchIndex(geo.foreign, quote);
  const targetExcluded =
    targetIndex !== null && near(EXCLUSION, quote, targetIndex);
  const targetNegated =
    targetIndex !== null && near(NEGATIVE_ACTION, quote, targetIndex);
  const foreignNegated =
    foreignIndex !== null && near(NEGATIVE_ACTION, quote, foreignIndex);
  const explicitOnly = EXPLICIT_ONLY.test(quote);

  if (input.channel === 'pickup') {
    if (quoteScope === 'target' || quoteScope === 'global') {
      if (targetExcluded || targetNegated) {
        return decision(
          'deny',
          `Pickup is denied in the target country: ${input.quote}`,
        );
      }

      return decision('allow', '');
    }

    if (quoteScope === 'foreign') {
      if (foreignNegated) {
        return decision(
          'unknown',
          `Pickup exclusion names only another country: ${input.quote}`,
        );
      }

      if (explicitOnly) {
        return decision(
          'deny',
          `Pickup is explicitly limited to another country: ${input.quote}`,
        );
      }

      return decision(
        'unknown',
        `Pickup statement is about another country: ${input.quote}`,
      );
    }

    if (
      targetPickupLocation(
        input.sourceText,
        input.sourceUrl,
        targetCode,
        sourceScope,
      )
    ) {
      return decision('allow', '');
    }

    return decision(
      'unknown',
      `Pickup location is not tied to ${input.targetCountry}: ${input.quote}`,
    );
  }

  if (quoteScope === 'target' || quoteScope === 'global') {
    if (targetExcluded) {
      return decision(
        'deny',
        `The target country is explicitly excluded: ${input.quote}`,
      );
    }

    if (targetNegated) {
      return decision(
        'deny',
        `The statement explicitly denies the target country: ${input.quote}`,
      );
    }

    return decision('allow', '');
  }

  if (quoteScope === 'foreign') {
    if (foreignNegated) {
      return decision(
        'unknown',
        `The named country is excluded, but the target country is not: ${input.quote}`,
      );
    }

    if (explicitOnly) {
      return decision(
        'deny',
        `The statement is explicitly limited to another country: ${input.quote}`,
      );
    }

    return decision(
      'unknown',
      `The statement is about another country only: ${input.quote}`,
    );
  }

  return decision(
    'unknown',
    `The statement has no country-specific location: ${input.quote}`,
  );
}
