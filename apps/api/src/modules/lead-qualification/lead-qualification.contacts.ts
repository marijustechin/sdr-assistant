import {
  normalisePhone,
  phoneCountryCandidates,
  resolveCountryCode,
} from './lead-qualification.geography.js';
import type {
  ContactRole,
  EmailContact,
  PhoneContact,
  SourceCompany,
  SourceEmail,
  SourcePhone,
} from './lead-qualification.types.js';

const EMAIL_PATTERN =
  /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi;
const PHONE_PATTERN = /(?:\+|00)\d[\d\s().-]{5,}\d/g;
const COMMON_FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
]);

const PLACEHOLDER_PATTERN =
  /^(?:example|test|email|your|domain|name|user)@|@(?:example|test|localhost|invalid|domain)\.|(?:no-?reply|do-?not-?reply|sentry|wixpress|wordpress)@/i;

export function normaliseEmail(value: string): string | null {
  const email = value.trim().replace(/^mailto:/i, '').replace(/[),.;:]+$/, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (PLACEHOLDER_PATTERN.test(email)) return null;
  return email.toLowerCase();
}

export function labelToRole(label: string | null): ContactRole {
  if (label === null) return null;
  const value = label.toLowerCase();
  if (/(sales|pardav|komerci|wholesale|purchas|procure)/.test(value)) {
    return 'sales';
  }
  if (/(general|info|contact|kontakt|office|biuras)/.test(value)) {
    return 'general';
  }
  return null;
}

export function isSameRegistrableDomain(
  url: string | null,
  company: SourceCompany,
): boolean {
  if (url === null) return false;

  try {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
    const domains = new Set(
      [company.domain, company.registrableDomain]
        .filter((value): value is string => value !== null)
        .map((value) => value.toLowerCase().replace(/^www\./, '')),
    );

    return [...domains].some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export function isCompanyControlledPage(
  url: string | null,
  company: SourceCompany,
): boolean {
  return isSameRegistrableDomain(url, company);
}

function normaliseFragment(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isAssociatedContact(
  pageText: string,
  companyName: string | null,
  contactValue: string,
): boolean {
  if (companyName === null || pageText.length === 0) return false;
  const text = normaliseFragment(pageText);
  const name = normaliseFragment(companyName);
  const contact = normaliseFragment(contactValue);
  if (name.length === 0 || contact.length === 0) return false;

  let index = text.indexOf(name);
  if (index < 0) return false;

  while (index >= 0) {
    const window = text.slice(Math.max(0, index - 300), index + name.length + 300);
    if (window.includes(contact)) return true;
    index = text.indexOf(name, index + name.length);
  }

  return false;
}

function isAssociatedPhone(
  pageText: string,
  companyName: string | null,
  phone: string,
): boolean {
  if (companyName === null || pageText.length === 0) return false;
  const text = normaliseFragment(pageText);
  const name = normaliseFragment(companyName);
  const digits = phone.replace(/\\D/g, '');
  if (name.length === 0 || digits.length < 7) return false;
  let index = text.indexOf(name);
  while (index >= 0) {
    const window = text.slice(Math.max(0, index - 300), index + name.length + 300);
    if (window.replace(/\\D/g, '').includes(digits)) return true;
    index = text.indexOf(name, index + name.length);
  }
  return false;
}

function isCompanyEmailDomain(
  emailDomain: string,
  company: SourceCompany,
): boolean {
  const domains = [company.domain, company.registrableDomain]
    .filter((value): value is string => value !== null)
    .map((value) => value.toLowerCase().replace(/^www\./, ''));
  return (
    domains.includes(emailDomain) ||
    COMMON_FREE_EMAIL_DOMAINS.has(emailDomain)
  );
}

export function isAcceptableEmail(
  email: string,
  sourceUrl: string | null,
  company: SourceCompany,
  pageText = '',
): boolean {
  if (normaliseEmail(email) === null || sourceUrl === null) return false;

  const emailDomain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  const companyDomains = [company.domain, company.registrableDomain]
    .filter((value): value is string => value !== null)
    .map((value) => value.toLowerCase().replace(/^www\./, ''));
  const associated = isAssociatedContact(pageText, company.name, email);

  if (isCompanyControlledPage(sourceUrl, company)) {
    if (companyDomains.includes(emailDomain)) return true;
    // A free mailbox can legitimately belong to a small company, but only
    // when the company is explicitly named next to the contact on the page.
    return COMMON_FREE_EMAIL_DOMAINS.has(emailDomain) && associated;
  }

  // A public directory is usable only when the page itself contains the
  // company name in the same local fragment as the contact. An address on the
  // directory's own domain is the operator, not the company contact.
  let sourceHost = '';
  try {
    sourceHost = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  if (emailDomain === sourceHost) return false;
  return associated;
}

export function extractEmails(
  text: string,
  sourceUrl: string,
  company: SourceCompany,
  pageText = text,
): EmailContact[] {
  const found = new Map<string, EmailContact>();
  const values = text.match(EMAIL_PATTERN) ?? [];

  for (const raw of values) {
    const value = normaliseEmail(raw);
    if (value === null) continue;
    if (!isAcceptableEmail(value, sourceUrl, company, pageText)) continue;
    if (found.has(value)) continue;
    found.set(value, {
      value,
      role: null,
      sourceUrl,
      discoveredBy: 'contact-page',
    });
  }

  return [...found.values()];
}

export function extractPhones(
  text: string,
  sourceUrl: string,
  company: SourceCompany,
  pageText = text,
): PhoneContact[] {
  const found = new Map<string, PhoneContact>();
  const values = text.match(PHONE_PATTERN) ?? [];
  const controlled = isCompanyControlledPage(sourceUrl, company);

  for (const raw of values) {
    const normalised = normalisePhone(raw);
    if (normalised === null) continue;
    if (!controlled && !isAssociatedPhone(pageText, company.name, normalised)) {
      continue;
    }
    if (found.has(normalised)) continue;
    found.set(normalised, {
      value: raw.trim(),
      normalised,
      role: null,
      sourceUrl,
      discoveredBy: 'contact-page',
    });
  }

  return [...found.values()];
}

export function sourceEmailContacts(company: SourceCompany): EmailContact[] {
  const found = new Map<string, EmailContact>();

  for (const email of company.emails) {
    if (email.sourceUrl === null) continue;
    if (!isCompanyControlledPage(email.sourceUrl, company)) continue;
    const value = normaliseEmail(email.value);
    if (value === null || found.has(value)) continue;
    const domain = value.slice(value.lastIndexOf('@') + 1);
    if (!isCompanyEmailDomain(domain, company)) continue;
    found.set(value, {
      value,
      role: labelToRole(email.label),
      sourceUrl: email.sourceUrl,
      discoveredBy: 'stage04',
    });
  }

  return [...found.values()];
}

export function sourcePhoneContacts(company: SourceCompany): PhoneContact[] {
  const found = new Map<string, PhoneContact>();

  for (const phone of company.phones) {
    if (phone.sourceUrl === null) continue;
    if (!isCompanyControlledPage(phone.sourceUrl, company)) continue;
    const normalised = phone.normalised
      ? normalisePhone(phone.normalised)
      : normalisePhone(phone.value);
    const key = normalised ?? phone.value.trim();
    if (key.length === 0 || found.has(key)) continue;
    found.set(key, {
      value: phone.value.trim(),
      normalised,
      role: labelToRole(phone.label),
      sourceUrl: phone.sourceUrl,
      discoveredBy: 'stage04',
    });
  }

  return [...found.values()];
}

export function dedupeEmails(contacts: readonly EmailContact[]): EmailContact[] {
  const found = new Map<string, EmailContact>();

  for (const contact of contacts) {
    const value = normaliseEmail(contact.value);
    if (value === null || found.has(value)) continue;
    found.set(value, {
      ...contact,
      value,
    });
  }

  return [...found.values()];
}

export function dedupePhones(contacts: readonly PhoneContact[]): PhoneContact[] {
  const found = new Map<string, PhoneContact>();

  for (const contact of contacts) {
    const key = contact.normalised ?? contact.value.trim();
    if (key.length === 0 || found.has(key)) continue;
    found.set(key, contact);
  }

  return [...found.values()];
}

export function mergeContacts(
  company: SourceCompany,
  discoveredEmails: readonly EmailContact[],
  discoveredPhones: readonly PhoneContact[],
): { emails: EmailContact[]; phones: PhoneContact[] } {
  return {
    emails: dedupeEmails([
      ...sourceEmailContacts(company),
      ...discoveredEmails,
    ]),
    phones: dedupePhones([
      ...sourcePhoneContacts(company),
      ...discoveredPhones,
    ]),
  };
}

export function targetCountryCodeForPhone(
  phone: PhoneContact,
  targetCountryCode: string | null,
): 'local' | 'foreign' | 'ambiguous' | 'unknown' {
  const candidates = phoneCountryCandidates(phone.normalised);
  const target = targetCountryCode?.toUpperCase() ?? null;

  if (candidates.length === 0 || target === null) return 'unknown';
  if (!candidates.includes(target)) return 'foreign';
  return candidates.length === 1 ? 'local' : 'ambiguous';
}

export function countryCodeOfEmail(email: string): string | null {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  const tld = domain.slice(domain.lastIndexOf('.') + 1).toUpperCase();
  return tld.length === 2 ? resolveCountryCode(tld) : null;
}

export type RawContacts = {
  emails: SourceEmail[];
  phones: SourcePhone[];
};
