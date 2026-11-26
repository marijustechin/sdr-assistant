import type {
  ResearchListItem,
  ResearchResultAvailability,
  ResearchStatus,
} from '@/entities/research/client';

export type ResearchSort =
  'newest' | 'oldest' | 'product' | 'companies' | 'offers';

export type ResearchListFilter = {
  query: string;
  productId: 'all' | string;
  country: 'all' | string;
  status: 'all' | ResearchStatus;
  availability: 'all' | ResearchResultAvailability;
};

export const DEFAULT_RESEARCH_FILTER: ResearchListFilter = {
  query: '',
  productId: 'all',
  country: 'all',
  status: 'all',
  availability: 'all',
};

function normalise(value: string): string {
  return value.toLocaleLowerCase('en');
}

function matchesQuery(item: ResearchListItem, query: string): boolean {
  const needle = normalise(query.trim());

  if (needle === '') {
    return true;
  }

  return [
    item.productName ?? '',
    item.productId,
    item.country,
    item.id,
    item.status,
  ].some((value) => normalise(value).includes(needle));
}

export function filterResearches(
  items: readonly ResearchListItem[],
  filter: ResearchListFilter,
): ResearchListItem[] {
  return items.filter((item) => {
    if (!matchesQuery(item, filter.query)) {
      return false;
    }

    if (filter.productId !== 'all' && item.productId !== filter.productId) {
      return false;
    }

    if (filter.country !== 'all' && item.country !== filter.country) {
      return false;
    }

    if (filter.status !== 'all' && item.status !== filter.status) {
      return false;
    }

    if (
      filter.availability !== 'all' &&
      item.resultState !== filter.availability
    ) {
      return false;
    }

    return true;
  });
}

function compareNewest(
  left: ResearchListItem,
  right: ResearchListItem,
): number {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function compareText(left: string, right: string): number {
  const normalisedLeft = normalise(left);
  const normalisedRight = normalise(right);

  if (normalisedLeft < normalisedRight) {
    return -1;
  }

  return normalisedLeft > normalisedRight ? 1 : 0;
}

export function sortResearches(
  items: readonly ResearchListItem[],
  sort: ResearchSort,
): ResearchListItem[] {
  const sorted = [...items];

  switch (sort) {
    case 'oldest':
      return sorted.sort(
        (left, right) =>
          Date.parse(left.createdAt) - Date.parse(right.createdAt),
      );
    case 'product':
      return sorted.sort(
        (left, right) =>
          compareText(
            left.productName ?? left.productId,
            right.productName ?? right.productId,
          ) || compareNewest(left, right),
      );
    case 'companies':
      return sorted.sort(
        (left, right) =>
          (right.companyCount ?? -1) - (left.companyCount ?? -1) ||
          compareNewest(left, right),
      );
    case 'offers':
      return sorted.sort(
        (left, right) =>
          (right.offerCount ?? -1) - (left.offerCount ?? -1) ||
          compareNewest(left, right),
      );
    case 'newest':
      return sorted.sort(compareNewest);
  }
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** One-line result availability for a list row; unavailable counts stay absent. */
export function researchResultSummary(item: ResearchListItem): string {
  switch (item.resultState) {
    case 'profiles': {
      const base = `${countLabel(
        item.companyCount ?? 0,
        'company profile',
        'company profiles',
      )} · ${countLabel(item.offerCount ?? 0, 'offer', 'offers')}`;

      return item.unreadableProfiles === 0
        ? base
        : `${base} · ${countLabel(
            item.unreadableProfiles,
            'unreadable profile',
            'unreadable profiles',
          )}`;
    }
    case 'empty':
      return '0 company profiles · 0 offers';
    case 'historical':
      return 'Completed without persisted company profiles';
    case 'not-completed':
      return 'No final result yet';
    case 'unsupported':
      return 'Result unavailable';
  }
}
