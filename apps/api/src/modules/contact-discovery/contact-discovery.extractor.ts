import type {
  ContactCandidate,
  ContactDiscoveryResult,
  ContactEvidence,
  ContactExtractionMethod,
  PostalAddress,
} from './contact-discovery.types.js';

const EMAIL_PATTERN =
  /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi;
const PHONE_PATTERN = /(?:\+|00)\d[\d\s().-]{5,}\d/g;
const VISIBLE_EMAIL_CONTEXT =
  /\b(?:e-?mail|mail|el\.?\s*pašt\w*|contact|kontakt\w*|rašyk\w*|susisie\w*)\b/i;
const VISIBLE_PHONE_CONTEXT =
  /\b(?:tel\.?|telefon\w*|phone|mob\.?|call|contact|kontakt\w*|rašyk\w*|susisie\w*)\b/i;
const ORGANIZATION_TYPE =
  /^(?:Organization|Corporation|LocalBusiness|Store|OnlineStore|ProfessionalService|HomeAndConstructionBusiness|GeneralContractor|RetailStore)$/i;
const REGISTRATION_KEY =
  /^(?:vat(?:id|number)?|tax(?:id|number)?|registration(?:number)?|company(?:registration)?(?:number|code)?|identifier)$/i;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function maskHiddenHtml(html: string): string {
  const mask = (value: string): string => ' '.repeat(value.length);
  return html
    .replace(/<!--[\s\S]*?-->/g, mask)
    .replace(/<script\b[\s\S]*?<\/script>/gi, mask)
    .replace(/<style\b[\s\S]*?<\/style>/gi, mask)
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, mask);
}

function visibleText(html: string): string {
  return decodeEntities(
    maskHiddenHtml(html)
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article|header|footer|nav|table|ul|ol)\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function attribute(attributes: string, name: string): string | null {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  );
  const match = pattern.exec(attributes);
  if (match === null) return null;
  return decodeEntities(match[1] ?? match[2] ?? match[3] ?? '');
}

function normalizeEmail(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/^mailto:/i, '')
    .split('?')[0]
    .replace(/[),.;:]+$/, '')
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function normalizePhone(value: string): string | null {
  const trimmed = value.trim().replace(/^tel:/i, '');
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (!plus && !trimmed.startsWith('00')) return null;
  return `+${digits.replace(/^00/, '')}`;
}

function contextWindow(
  text: string,
  offset: number,
  length: number,
  radius = 140,
): string {
  return text
    .slice(Math.max(0, offset - radius), Math.min(text.length, offset + length + radius))
    .replace(/\s+/g, ' ')
    .trim();
}

function addCandidate(
  candidates: ContactCandidate[],
  seen: Set<string>,
  candidate: ContactCandidate,
): void {
  const key = [
    candidate.kind,
    candidate.normalized ?? candidate.value,
    candidate.method,
    candidate.sourceUrl,
  ].join('|');
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push(candidate);
}

function addressValue(address: JsonObject): {
  value: string;
  structured: PostalAddress;
} | null {
  const fields = [
    'streetAddress',
    'postalCode',
    'addressLocality',
    'addressRegion',
    'addressCountry',
  ] as const;
  const structured: PostalAddress = {};
  for (const field of fields) {
    const value = asString(address[field]);
    if (value !== null) structured[field] = value;
  }
  if (Object.keys(structured).length === 0) return null;

  const line2 = [
    structured.postalCode,
    structured.addressLocality,
    structured.addressRegion,
  ]
    .filter(Boolean)
    .join(' ');
  const value = [
    structured.streetAddress,
    line2,
    structured.addressCountry,
  ]
    .filter(Boolean)
    .join(', ');
  return { value, structured };
}

function registrationValue(
  key: string,
  value: unknown,
): { value: string; identifierKind: string } | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return { value: String(value), identifierKind: key };
  }
  if (
    isObject(value) &&
    (typeof value.value === 'string' || typeof value.value === 'number')
  ) {
    return {
      value: String(value.value),
      identifierKind:
        asString(value.propertyID) ?? asString(value.name) ?? key,
    };
  }
  return null;
}

function walkJsonLd(
  value: unknown,
  path: string,
  inheritedCompanyName: string | null,
  script: { content: string; contentStart: number },
  sourceUrl: string,
  candidates: ContactCandidate[],
  seen: Set<string>,
  companyNames: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkJsonLd(
        item,
        `${path}[${index}]`,
        inheritedCompanyName,
        script,
        sourceUrl,
        candidates,
        seen,
        companyNames,
      ),
    );
    return;
  }
  if (!isObject(value)) return;

  const typeValue = value['@type'];
  const types = Array.isArray(typeValue)
    ? typeValue.filter((item): item is string => typeof item === 'string')
    : typeof typeValue === 'string'
      ? [typeValue]
      : [];
  const isOrganization = types.some((type) => ORGANIZATION_TYPE.test(type));
  const ownName = asString(value.name);
  const companyName =
    inheritedCompanyName ?? (isOrganization ? ownName ?? '' : null);

  if (companyName !== null) {
    if (ownName !== null) companyNames.add(ownName);

    const addJsonEvidence = (
      kind: ContactCandidate['kind'],
      rawValue: string,
      normalized: string | null,
      quote: string,
      jsonPath: string,
      extra: Partial<ContactCandidate> = {},
    ): void => {
      addCandidate(candidates, seen, {
        kind,
        value: rawValue,
        normalized,
        companyName: companyName || null,
        method: 'json_ld',
        sourceUrl,
        evidence: {
          method: 'json_ld',
          sourceUrl,
          quote,
          context: `JSON-LD ${types.join(', ') || 'object'} at ${jsonPath}`,
          offset:
            script.content.indexOf(quote) >= 0
              ? script.contentStart + script.content.indexOf(quote)
              : null,
          offsetScope: 'html',
          jsonPath,
          tag: 'script',
          attribute: 'application/ld+json',
        },
        ...extra,
      });
    };

    const email = asString(value.email);
    if (email !== null) {
      const normalized = normalizeEmail(email);
      if (normalized !== null) {
        addJsonEvidence(
          'email',
          normalized,
          normalized,
          JSON.stringify(value.email),
          `${path}.email`,
        );
      }
    }

    const telephone = asString(value.telephone);
    if (telephone !== null) {
      const normalized = normalizePhone(telephone);
      if (normalized !== null) {
        addJsonEvidence(
          'phone',
          telephone,
          normalized,
          JSON.stringify(value.telephone),
          `${path}.telephone`,
        );
      }
    }

    if (isObject(value.address)) {
      const address = addressValue(value.address);
      if (address !== null) {
        addJsonEvidence(
          'postal_address',
          address.value,
          null,
          JSON.stringify(value.address),
          `${path}.address`,
          { structured: address.structured },
        );
      }
    }

    for (const [key, child] of Object.entries(value)) {
      if (!REGISTRATION_KEY.test(key)) continue;
      const registration = registrationValue(key, child);
      if (registration !== null) {
        addJsonEvidence(
          'registration_identifier',
          registration.value,
          null,
          JSON.stringify(child),
          `${path}.${key}`,
          { identifierKind: registration.identifierKind },
        );
      }
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'email' || key === 'telephone' || key === 'address') continue;
    if (key === '@context') continue;
    if (isObject(child) || Array.isArray(child)) {
      walkJsonLd(
        child,
        `${path}.${key}`,
        companyName,
        script,
        sourceUrl,
        candidates,
        seen,
        companyNames,
      );
    }
  }
}

function extractJsonLd(
  html: string,
  sourceUrl: string,
  candidates: ContactCandidate[],
  seen: Set<string>,
  companyNames: Set<string>,
): void {
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    const type = attribute(match[1] ?? '', 'type')?.trim().toLowerCase();
    if (type !== 'application/ld+json') continue;
    const content = match[2] ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }
    const contentStart = html.indexOf('>', match.index) + 1;
    walkJsonLd(
      parsed,
      '$',
      null,
      { content, contentStart },
      sourceUrl,
      candidates,
      seen,
      companyNames,
    );
  }
}

function extractLinks(
  html: string,
  sourceUrl: string,
  candidates: ContactCandidate[],
  seen: Set<string>,
): void {
  const masked = maskHiddenHtml(html);
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(masked)) !== null) {
    const href = attribute(match[1] ?? '', 'href');
    if (href === null) continue;
    const anchorText = visibleText(match[2] ?? '');
    const outer = html.slice(match.index, anchorPattern.lastIndex);
    const context = `${anchorText} | ${outer}`.slice(0, 500);

    if (/^mailto:/i.test(href)) {
      const values = href
        .slice(7)
        .split('?')[0]
        .split(',')
        .map((value) => normalizeEmail(value))
        .filter((value): value is string => value !== null);
      for (const value of values) {
        addCandidate(candidates, seen, {
          kind: 'email',
          value,
          normalized: value,
          companyName: null,
          method: 'mailto',
          sourceUrl,
          evidence: {
            method: 'mailto',
            sourceUrl,
            quote: href,
            context,
            offset: match.index,
            offsetScope: 'html',
            tag: 'a',
            attribute: 'href',
          },
        });
      }
    }

    if (/^tel:/i.test(href)) {
      const raw = href.slice(4).split('?')[0];
      const normalized = normalizePhone(raw);
      if (normalized !== null) {
        addCandidate(candidates, seen, {
          kind: 'phone',
          value: raw,
          normalized,
          companyName: null,
          method: 'tel',
          sourceUrl,
          evidence: {
            method: 'tel',
            sourceUrl,
            quote: href,
            context,
            offset: match.index,
            offsetScope: 'html',
            tag: 'a',
            attribute: 'href',
          },
        });
      }
    }
  }
}

function decodeCloudflareEmail(encoded: string): string | null {
  const value = encoded.trim().toLowerCase();
  if (value.length === 0 || value.length % 2 !== 0) return null;
  if (!/^[0-9a-f]+$/.test(value)) return null;
  const key = Number.parseInt(value.slice(0, 2), 16);
  if (!Number.isInteger(key)) return null;

  let decoded = '';
  for (let index = 2; index < value.length; index += 2) {
    const byte = Number.parseInt(value.slice(index, index + 2), 16);
    if (!Number.isInteger(byte)) return null;
    const code = byte ^ key;
    if (code < 32 || code > 126) return null;
    decoded += String.fromCharCode(code);
  }
  return normalizeEmail(decoded);
}

function extractCloudflareEmails(
  html: string,
  sourceUrl: string,
  candidates: ContactCandidate[],
  seen: Set<string>,
): void {
  const masked = maskHiddenHtml(html);
  const tagPattern = /<([a-z0-9]+)\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(masked)) !== null) {
    const tag = (match[1] ?? '').toLowerCase();
    const attributes = match[2] ?? '';
    const encoded = attribute(attributes, 'data-cfemail');
    if (encoded === null) continue;
    const className = attribute(attributes, 'class') ?? '';
    const href = attribute(attributes, 'href') ?? '';
    const protectedContext = html.slice(Math.max(0, match.index - 500), match.index);
    if (
      !className.toLowerCase().includes('__cf_email__') &&
      !href.toLowerCase().includes('/cdn-cgi/l/email-protection') &&
      !/\/cdn-cgi\/l\/email-protection/i.test(protectedContext)
    ) {
      continue;
    }

    const value = decodeCloudflareEmail(encoded);
    if (value === null) continue;

    const context = html
      .slice(Math.max(0, match.index - 140), match.index + match[0].length + 140)
      .replace(/\s+/g, ' ')
      .slice(0, 500);
    addCandidate(candidates, seen, {
      kind: 'email',
      value,
      normalized: value,
      companyName: null,
      method: 'cf_email',
      sourceUrl,
      evidence: {
        method: 'cf_email',
        sourceUrl,
        quote: `data-cfemail="${encoded}"`,
        context,
        offset: match.index,
        offsetScope: 'html',
        tag,
        attribute: 'data-cfemail',
      },
    });
  }
}

function extractVisible(
  html: string,
  sourceUrl: string,
  candidates: ContactCandidate[],
  seen: Set<string>,
): void {
  const text = visibleText(html);

  EMAIL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMAIL_PATTERN.exec(text)) !== null) {
    const value = normalizeEmail(match[0]);
    if (value === null) continue;
    const context = contextWindow(text, match.index, match[0].length);
    if (!VISIBLE_EMAIL_CONTEXT.test(context)) continue;
    addCandidate(candidates, seen, {
      kind: 'email',
      value,
      normalized: value,
      companyName: null,
      method: 'visible_text',
      sourceUrl,
      evidence: {
        method: 'visible_text',
        sourceUrl,
        quote: match[0],
        context,
        offset: match.index,
        offsetScope: 'visible_text',
      },
    });
  }

  PHONE_PATTERN.lastIndex = 0;
  while ((match = PHONE_PATTERN.exec(text)) !== null) {
    const normalized = normalizePhone(match[0]);
    if (normalized === null) continue;
    const context = contextWindow(text, match.index, match[0].length);
    if (!VISIBLE_PHONE_CONTEXT.test(context)) continue;
    addCandidate(candidates, seen, {
      kind: 'phone',
      value: match[0],
      normalized,
      companyName: null,
      method: 'visible_text',
      sourceUrl,
      evidence: {
        method: 'visible_text',
        sourceUrl,
        quote: match[0],
        context,
        offset: match.index,
        offsetScope: 'visible_text',
      },
    });
  }
}

/**
 * Extracts company-associated contact candidates from one saved page.
 *
 * Phone discovery is deliberately limited to visible text, tel: links and
 * structured JSON-LD fields. Generic phone regular expressions are never run
 * over raw HTML, so script/SVG/CSS/attribute/query-string fragments cannot
 * become contacts.
 */
export function extractContactCandidates(input: {
  html: string;
  sourceUrl: string;
}): ContactDiscoveryResult {
  const source = new URL(input.sourceUrl);
  if (source.protocol !== 'http:' && source.protocol !== 'https:') {
    throw new Error('Contact discovery requires an HTTP(S) source URL.');
  }

  const candidates: ContactCandidate[] = [];
  const seen = new Set<string>();
  const companyNames = new Set<string>();

  extractJsonLd(input.html, input.sourceUrl, candidates, seen, companyNames);
  extractLinks(input.html, input.sourceUrl, candidates, seen);
  extractCloudflareEmails(input.html, input.sourceUrl, candidates, seen);
  extractVisible(input.html, input.sourceUrl, candidates, seen);

  return {
    sourceUrl: input.sourceUrl,
    candidates,
    companyNames: [...companyNames].sort(),
  };
}

export type { ContactEvidence, ContactExtractionMethod };
