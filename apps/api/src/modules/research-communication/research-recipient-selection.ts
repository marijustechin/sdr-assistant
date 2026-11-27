/**
 * Deterministic primary-recipient selection for the prepared outreach queue.
 *
 * Stage 05 Contact Discovery V1 does not persist department or person metadata:
 * `employeeAssociation` is always `unknown` and the employee name/position
 * fields are always null. The priority is therefore derived from the published
 * mailbox local part with the documented token tables below. This classifies
 * mailboxes, not people: no employee identity or position is inferred.
 *
 * Only addresses the Stage 05 result marks as `usable` are considered. Partner,
 * distributor and uncertain addresses are never candidates, and excluded
 * companies are not passed to this module at all.
 */

export type RecipientSelectionReason =
  | 'SALES_DEPARTMENT'
  | 'GENERAL_MAILBOX'
  | 'INDIVIDUAL_CONTACT';

export type PublishedCompanyRow = {
  /** Stage 05 result id, kept as provenance on the prepared recipient. */
  readonly id: string;
  readonly sourceCompanyIndex: number;
  readonly domain: string;
  readonly companyName: string | null;
  readonly metadata: unknown;
};

export type PreparedRecipient = {
  readonly sourceResultId: string;
  readonly sourceCompanyIndex: number;
  readonly domain: string;
  readonly companyName: string | null;
  readonly primaryEmail: string;
  readonly alternativeEmails: string[];
  readonly selectionReason: RecipientSelectionReason;
  readonly status: 'PREPARED';
};

/**
 * Local-part stems treated as a sales or commercial department mailbox.
 * Matching is prefix-based on alphanumeric tokens, so `sales.lt`, `salesdept`
 * and `pardavimai` all match.
 */
export const SALES_LOCAL_PART_STEMS: readonly string[] = [
  'sales',
  'pardavim',
  'commerc',
  'export',
  'eksport',
  'wholesale',
  'didmen',
  'b2b',
  'trade',
  'vertrieb',
  'verkauf',
];

/**
 * Local-part stems treated as a general company mailbox (the `info@` /
 * `office@` tier). Kept deliberately small and documented.
 */
export const GENERAL_LOCAL_PART_STEMS: readonly string[] = [
  'info',
  'office',
  'contact',
  'kontakt',
  'hello',
  'team',
  'mail',
  'email',
  'enquir',
  'inquir',
  'admin',
  'sekretor',
  'biuro',
  'buero',
  'buro',
  'central',
  'general',
  'reception',
  'post',
  'uzsakym',
];

const REASON_RANK: Record<RecipientSelectionReason, number> = {
  SALES_DEPARTMENT: 0,
  GENERAL_MAILBOX: 1,
  INDIVIDUAL_CONTACT: 2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lowercases and validates one published email value. */
export function normalizePublishedEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

/** Lowercases a published company domain and drops an accidental scheme/path. */
export function normalizeCompanyDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/\.$/, '');
}

function emailDomain(value: string): string {
  return value.slice(value.lastIndexOf('@') + 1);
}

function stripWww(domain: string): string {
  return domain.replace(/^www\./, '');
}

function localPartTokens(localPart: string): string[] {
  const withoutTags = localPart.split('+')[0] ?? '';
  return withoutTags.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
}

function matchesStems(
  tokens: readonly string[],
  stems: readonly string[],
): boolean {
  return tokens.some((token) =>
    stems.some((stem) => token.startsWith(stem)),
  );
}

/** Classifies one mailbox local part into the documented priority tier. */
export function classifyMailbox(
  email: string,
): RecipientSelectionReason {
  const localPart = email.slice(0, Math.max(0, email.lastIndexOf('@')));
  const tokens = localPartTokens(localPart);

  if (matchesStems(tokens, SALES_LOCAL_PART_STEMS)) {
    return 'SALES_DEPARTMENT';
  }
  if (matchesStems(tokens, GENERAL_LOCAL_PART_STEMS)) {
    return 'GENERAL_MAILBOX';
  }
  return 'INDIVIDUAL_CONTACT';
}

/**
 * Reads the usable company-associated addresses from a Stage 05 result's
 * `metadata.contactDiscovery` payload. Returns a de-duplicated, normalized list
 * in published order.
 */
export function usablePublishedEmails(metadata: unknown): string[] {
  if (!isRecord(metadata)) return [];
  const contact = metadata.contactDiscovery;
  if (!isRecord(contact)) return [];
  const emails = contact.emails;
  if (!Array.isArray(emails)) return [];

  const seen = new Set<string>();
  for (const entry of emails) {
    if (!isRecord(entry)) continue;
    if (entry.ownership !== 'usable') continue;
    const value = normalizePublishedEmail(entry.value);
    if (value !== null) seen.add(value);
  }
  return [...seen];
}

type Candidate = {
  readonly value: string;
  readonly reason: RecipientSelectionReason;
  readonly sameDomain: boolean;
};

function compareCandidates(left: Candidate, right: Candidate): number {
  const rankDifference =
    REASON_RANK[left.reason] - REASON_RANK[right.reason];
  if (rankDifference !== 0) return rankDifference;

  if (left.sameDomain !== right.sameDomain) {
    return left.sameDomain ? -1 : 1;
  }

  if (left.value < right.value) return -1;
  if (left.value > right.value) return 1;
  return 0;
}

/**
 * Selects exactly one primary recipient per retained company.
 *
 * Selection priority: sales/commercial mailbox, then general company mailbox,
 * then any other usable company address. Within one tier an address on the
 * company's own domain wins, then the lexicographically smallest normalized
 * address. Companies are processed by `sourceCompanyIndex`; a primary address
 * is never reused within one research, so a later company falls through to its
 * next candidate and a company with no unused usable address is skipped instead
 * of duplicating a primary. Every remaining usable address is preserved as a
 * deterministically sorted alternative.
 */
export function selectRecipients(
  rows: readonly PublishedCompanyRow[],
): PreparedRecipient[] {
  const ordered = [...rows].sort(
    (left, right) => left.sourceCompanyIndex - right.sourceCompanyIndex,
  );
  const usedPrimaryEmails = new Set<string>();
  const usedDomains = new Set<string>();
  const selected: PreparedRecipient[] = [];

  for (const row of ordered) {
    const domain = normalizeCompanyDomain(row.domain);
    if (domain === '' || usedDomains.has(domain)) continue;

    const emails = usablePublishedEmails(row.metadata);
    if (emails.length === 0) continue;

    const companyDomain = stripWww(domain);
    const candidates: Candidate[] = emails
      .map((value) => ({
        value,
        reason: classifyMailbox(value),
        sameDomain: stripWww(emailDomain(value)) === companyDomain,
      }))
      .sort(compareCandidates);

    const primaryIndex = candidates.findIndex(
      (candidate) => !usedPrimaryEmails.has(candidate.value),
    );
    if (primaryIndex === -1) continue;

    const primary = candidates[primaryIndex];
    if (primary === undefined) continue;

    const alternativeEmails = candidates
      .filter((_candidate, index) => index !== primaryIndex)
      .map((candidate) => candidate.value);

    usedPrimaryEmails.add(primary.value);
    usedDomains.add(domain);

    selected.push({
      sourceResultId: row.id,
      sourceCompanyIndex: row.sourceCompanyIndex,
      domain,
      companyName: row.companyName,
      primaryEmail: primary.value,
      alternativeEmails,
      selectionReason: primary.reason,
      status: 'PREPARED',
    });
  }

  return selected;
}
