import type {
  ContactDiscoveryView,
  Stage05Email,
  Stage05Result,
} from '@/entities/research/client';

import { paginate } from './company-browser';

export type Stage05CompanyRow = {
  result: Stage05Result;
  contact: ContactDiscoveryView | null;
  displayName: string;
  domain: string;
  usableEmails: Stage05Email[];
  partnerEmails: Stage05Email[];
};

export type Stage05Totals = {
  retained: number;
  excluded: number;
  usableEmails: number;
  partnerEmails: number;
};

export function buildStage05Rows(
  results: readonly Stage05Result[],
): Stage05CompanyRow[] {
  return results.map((result) => {
    const contact = result.metadata.contactDiscovery ?? null;
    const emails = contact?.emails ?? [];
    const usableEmails = emails.filter((email) => email.ownership === 'usable');
    const partnerEmails = emails.filter(
      (email) => email.ownership === 'partner',
    );
    return {
      result,
      contact,
      displayName:
        contact?.companyName ?? result.source.name ?? result.source.domain,
      domain: contact?.domain ?? result.source.domain,
      usableEmails,
      partnerEmails,
    };
  });
}

export function stage05Totals(
  retained: readonly Stage05Result[],
  excluded: readonly Stage05Result[],
): Stage05Totals {
  const rows = buildStage05Rows(retained);
  return {
    retained: retained.length,
    excluded: excluded.length,
    usableEmails: rows.reduce((sum, row) => sum + row.usableEmails.length, 0),
    partnerEmails: rows.reduce((sum, row) => sum + row.partnerEmails.length, 0),
  };
}

export function filterStage05Rows(
  rows: readonly Stage05CompanyRow[],
  query: string,
): Stage05CompanyRow[] {
  const needle = query.trim().toLocaleLowerCase('en');
  if (needle === '') return [...rows];
  return rows.filter((row) =>
    [
      row.displayName,
      row.result.source.name ?? '',
      row.result.source.legalName ?? '',
      row.domain,
      ...row.usableEmails.map((email) => email.value),
      ...row.partnerEmails.map((email) => email.value),
    ].some((value) => value.toLocaleLowerCase('en').includes(needle)),
  );
}

export function stage05Page(
  rows: readonly Stage05CompanyRow[],
  page: number,
  pageSize: number,
) {
  return paginate(rows, page, pageSize);
}

const REASON_LABELS: Record<string, string> = {
  EMAIL_NOT_FOUND: 'No usable company email found',
  COUNTRY_MISMATCH:
    'Foreign telephone evidence with no target-country establishment',
};

export function stage05ReasonLabel(reason: string | null): string {
  if (reason === null || reason === '') return 'Not recorded';
  return REASON_LABELS[reason] ?? reason;
}

export function stage05SourceUrls(row: Stage05CompanyRow): string[] {
  const urls = new Set<string>();
  for (const email of [...row.usableEmails, ...row.partnerEmails]) {
    for (const source of email.sources) {
      if (source.sourceUrl !== null) urls.add(source.sourceUrl);
    }
  }
  for (const phone of row.contact?.phones ?? []) {
    for (const url of phone.sourceUrls) urls.add(url);
  }
  for (const address of row.contact?.addresses ?? []) {
    for (const url of address.sourceUrls) urls.add(url);
  }
  return [...urls];
}
