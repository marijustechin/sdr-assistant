import type {
  CompanyEmail,
  CompanyPhone,
  CompanyProfileView,
} from '@/entities/research/client';

import { companyDisplayName } from './presentation';

export type ContactTypeFilter = 'all' | 'email' | 'phone';

export type CompanyContactRow = {
  company: CompanyProfileView;
  displayName: string;
  emails: CompanyEmail[];
  phones: CompanyPhone[];
};

export type ContactTotals = {
  emailValues: number;
  uniqueEmails: number;
  phoneValues: number;
  uniquePhones: number;
  companiesWithEmail: number;
  companiesWithPhone: number;
};

function uniqueEmailKey(email: string): string {
  return email.trim().toLocaleLowerCase('en');
}

function uniquePhoneKey(phone: CompanyPhone): string {
  const value = phone.normalised ?? phone.value;

  return value.replace(/[\s()-]/g, '');
}

/**
 * Read-only contact rows. Only companies with at least one discovered contact are
 * listed; the company relationship is kept by construction.
 */
export function buildCompanyContactRows(
  companies: readonly CompanyProfileView[],
): CompanyContactRow[] {
  return companies
    .filter((company) => company.emails.length > 0 || company.phones.length > 0)
    .map((company) => ({
      company,
      displayName: companyDisplayName(company),
      emails: company.emails,
      phones: company.phones,
    }));
}

/** Contact-value counts versus distinct values. */
export function contactTotals(
  companies: readonly CompanyProfileView[],
): ContactTotals {
  const emails = companies.flatMap((company) => company.emails);
  const phones = companies.flatMap((company) => company.phones);

  return {
    emailValues: emails.length,
    uniqueEmails: new Set(emails.map((email) => uniqueEmailKey(email.value)))
      .size,
    phoneValues: phones.length,
    uniquePhones: new Set(phones.map((phone) => uniquePhoneKey(phone))).size,
    companiesWithEmail: companies.filter((company) => company.emails.length > 0)
      .length,
    companiesWithPhone: companies.filter((company) => company.phones.length > 0)
      .length,
  };
}

function matchesQuery(row: CompanyContactRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('en');

  if (needle === '') {
    return true;
  }

  const haystack = [
    row.displayName,
    row.company.name ?? '',
    row.company.legalName ?? '',
    row.company.domain,
    row.company.registrableDomain ?? '',
    ...row.emails.map((email) => email.value),
    ...row.phones.map((phone) => phone.value),
    ...row.phones.map((phone) => phone.normalised ?? ''),
  ];

  return haystack.some((value) =>
    value.toLocaleLowerCase('en').includes(needle),
  );
}

export function filterContactRows(
  rows: readonly CompanyContactRow[],
  query: string,
  type: ContactTypeFilter,
): CompanyContactRow[] {
  return rows.filter((row) => {
    if (!matchesQuery(row, query)) {
      return false;
    }

    if (type === 'email' && row.emails.length === 0) {
      return false;
    }

    if (type === 'phone' && row.phones.length === 0) {
      return false;
    }

    return true;
  });
}
