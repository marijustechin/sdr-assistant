import type {
  CompanyOfferView,
  CompanyPrice,
  CompanyProfileView,
} from '@/entities/research/client';

import { companyDisplayName, unitLabel } from './presentation';

export type MarketPriceAvailability = 'priced' | 'all';
export type MarketMatchFilter = 'all' | 'a' | 'b' | 'none';
export type MarketSort = 'company' | 'product' | 'price-asc' | 'price-desc';

export type MarketFilter = {
  query: string;
  priceAvailability: MarketPriceAvailability;
  match: MarketMatchFilter;
  currency: string;
  unit: string;
  sort: MarketSort;
};

export const DEFAULT_MARKET_FILTER: MarketFilter = {
  query: '',
  priceAvailability: 'priced',
  match: 'all',
  currency: 'all',
  unit: 'all',
  sort: 'company',
};

export type MarketRow = {
  key: string;
  companyKey: string;
  companyName: string;
  domain: string;
  offer: CompanyOfferView;
  /** `null` represents an offer without a structured price. */
  price: CompanyPrice | null;
};

export type MarketSummary = {
  totalOffers: number;
  offersWithPrices: number;
  companiesWithPrices: number;
};

export type MarketOption = {
  value: string;
  label: string;
};

export function buildMarketSummary(
  companies: readonly CompanyProfileView[],
): MarketSummary {
  let totalOffers = 0;
  let offersWithPrices = 0;
  let companiesWithPrices = 0;

  for (const company of companies) {
    totalOffers += company.offers.length;
    let companyHasPrice = false;

    for (const offer of company.offers) {
      if (offer.prices.length > 0) {
        offersWithPrices += 1;
        companyHasPrice = true;
      }
    }

    if (companyHasPrice) {
      companiesWithPrices += 1;
    }
  }

  return { totalOffers, offersWithPrices, companiesWithPrices };
}

/**
 * Flattens offers into one row per structured price entry.
 *
 * An offer without any price becomes one `price: null` row only when all offers
 * are requested. A genuine `amount: 0` remains a structured price, never a
 * missing one.
 */
export function buildMarketRows(
  companies: readonly CompanyProfileView[],
  availability: MarketPriceAvailability,
): MarketRow[] {
  const rows: MarketRow[] = [];

  for (const company of companies) {
    const companyName = companyDisplayName(company);

    for (const offer of company.offers) {
      if (offer.prices.length === 0) {
        if (availability === 'all') {
          rows.push({
            key: `${company.key}#${offer.key}#no-price`,
            companyKey: company.key,
            companyName,
            domain: company.domain,
            offer,
            price: null,
          });
        }

        continue;
      }

      for (const [index, price] of offer.prices.entries()) {
        rows.push({
          key: `${company.key}#${offer.key}#price-${index}`,
          companyKey: company.key,
          companyName,
          domain: company.domain,
          offer,
          price,
        });
      }
    }
  }

  return rows;
}

function compareText(left: string, right: string): number {
  const normalisedLeft = left.toLocaleLowerCase('en');
  const normalisedRight = right.toLocaleLowerCase('en');

  if (normalisedLeft < normalisedRight) {
    return -1;
  }

  return normalisedLeft > normalisedRight ? 1 : 0;
}

function currencyValue(price: CompanyPrice): string {
  return price.currency ?? 'none';
}

function unitValue(price: CompanyPrice): string {
  return price.unit ?? 'none';
}

/** A numeric comparison is meaningful only inside one currency and one unit. */
export function canCompareMarketPrices(filter: MarketFilter): boolean {
  return (
    filter.currency !== 'all' &&
    filter.currency !== 'none' &&
    filter.unit !== 'all' &&
    filter.unit !== 'none'
  );
}

/**
 * Currency and unit options that actually occur in structured prices.
 * `none` is the honest option for a price whose field is null.
 */
export function marketPriceOptions(companies: readonly CompanyProfileView[]): {
  currencies: MarketOption[];
  units: MarketOption[];
} {
  const currencies = new Set<string>();
  const units = new Set<NonNullable<CompanyPrice['unit']>>();
  let hasUnknownCurrency = false;
  let hasUnknownUnit = false;

  for (const company of companies) {
    for (const offer of company.offers) {
      for (const price of offer.prices) {
        if (price.currency === null) {
          hasUnknownCurrency = true;
        } else {
          currencies.add(price.currency);
        }

        if (price.unit === null) {
          hasUnknownUnit = true;
        } else {
          units.add(price.unit);
        }
      }
    }
  }

  const currencyOptions: MarketOption[] = [...currencies]
    .sort(compareText)
    .map((currency) => ({ value: currency, label: currency }));

  if (hasUnknownCurrency) {
    currencyOptions.push({ value: 'none', label: 'Not recorded' });
  }

  const unitOptions: MarketOption[] = [...units]
    .sort(compareText)
    .map((unit) => ({ value: unit, label: unitLabel(unit) }));

  if (hasUnknownUnit) {
    unitOptions.push({ value: 'none', label: 'Not recorded' });
  }

  return { currencies: currencyOptions, units: unitOptions };
}

function matchesQuery(row: MarketRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('en');

  if (needle === '') {
    return true;
  }

  return [row.companyName, row.domain, row.offer.item, row.offer.id ?? ''].some(
    (value) => value.toLocaleLowerCase('en').includes(needle),
  );
}

function compareCompanyRows(left: MarketRow, right: MarketRow): number {
  return (
    compareText(left.companyName, right.companyName) ||
    compareText(left.offer.item, right.offer.item) ||
    compareText(left.key, right.key)
  );
}

function compareProductRows(left: MarketRow, right: MarketRow): number {
  return (
    compareText(left.offer.item, right.offer.item) ||
    compareText(left.companyName, right.companyName) ||
    compareText(left.key, right.key)
  );
}

function comparePriceRows(left: MarketRow, right: MarketRow): number {
  if (left.price === null && right.price === null) {
    return compareCompanyRows(left, right);
  }

  if (left.price === null) {
    return 1;
  }

  if (right.price === null) {
    return -1;
  }

  return (
    left.price.amount - right.price.amount || compareCompanyRows(left, right)
  );
}

function comparePriceRowsDescending(left: MarketRow, right: MarketRow): number {
  if (left.price === null && right.price === null) {
    return compareCompanyRows(left, right);
  }

  if (left.price === null) {
    return 1;
  }

  if (right.price === null) {
    return -1;
  }

  return (
    right.price.amount - left.price.amount || compareCompanyRows(left, right)
  );
}

function sortMarketRows(rows: MarketRow[], filter: MarketFilter): MarketRow[] {
  const sorted = [...rows];

  switch (filter.sort) {
    case 'product':
      return sorted.sort(compareProductRows);
    case 'price-asc':
      return canCompareMarketPrices(filter)
        ? sorted.sort(comparePriceRows)
        : sorted.sort(compareCompanyRows);
    case 'price-desc':
      return canCompareMarketPrices(filter)
        ? sorted.sort(comparePriceRowsDescending)
        : sorted.sort(compareCompanyRows);
    case 'company':
      return sorted.sort(compareCompanyRows);
  }
}

export function filterAndSortMarketRows(
  rows: readonly MarketRow[],
  filter: MarketFilter,
): MarketRow[] {
  const filtered = rows.filter((row) => {
    if (filter.priceAvailability === 'priced' && row.price === null) {
      return false;
    }

    if (!matchesQuery(row, filter.query)) {
      return false;
    }

    if (
      filter.match !== 'all' &&
      (row.offer.verdict ?? 'none') !== filter.match
    ) {
      return false;
    }

    if (
      filter.currency !== 'all' &&
      (row.price === null || currencyValue(row.price) !== filter.currency)
    ) {
      return false;
    }

    if (
      filter.unit !== 'all' &&
      (row.price === null || unitValue(row.price) !== filter.unit)
    ) {
      return false;
    }

    return true;
  });

  return sortMarketRows(filtered, filter);
}
