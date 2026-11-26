'use client';

import { useId, useMemo, useState } from 'react';

import type { ResearchResultView } from '@/entities/research/client';

import { paginate } from '../model/company-browser';
import {
  DEFAULT_MARKET_FILTER,
  buildMarketRows,
  buildMarketSummary,
  canCompareMarketPrices,
  filterAndSortMarketRows,
  marketPriceOptions,
  type MarketFilter,
  type MarketMatchFilter,
  type MarketPriceAvailability,
  type MarketRow,
  type MarketSort,
} from '../model/market-view';
import {
  formatPriceAmount,
  productMatchLabel,
  resultAvailabilityMessage,
  unitLabel,
  unreadableDataMessage,
  vatLabel,
} from '../model/presentation';
import { SourceLink } from './source-link';

const PAGE_SIZE = 20;

function toPriceAvailability(value: string): MarketPriceAvailability {
  return value === 'all' ? 'all' : 'priced';
}

function toMatch(value: string): MarketMatchFilter {
  switch (value) {
    case 'a':
    case 'b':
    case 'none':
      return value;
    default:
      return 'all';
  }
}

function toSort(value: string): MarketSort {
  switch (value) {
    case 'product':
    case 'price-asc':
    case 'price-desc':
      return value;
    default:
      return 'company';
  }
}

function MarketEvidence({ row }: { row: MarketRow }) {
  const { offer, price } = row;
  const marketFrom03 = offer.marketFrom03;
  const marketEvidence = offer.market?.evidence ?? [];
  const primarySource = price?.sourceUrl ?? offer.sourceUrl;
  const hasEvidence =
    (price?.quote ?? null) !== null ||
    marketFrom03 !== null ||
    marketEvidence.length > 0 ||
    (offer.sourceUrl !== null && offer.sourceUrl !== primarySource);

  return (
    <details className="market-evidence">
      <summary>Evidence</summary>
      <div className="market-evidence-body">
        <p className="hint">
          Text is shown as recorded. It is not converted into a structured
          price.
        </p>

        {price?.quote !== null && price?.quote !== undefined && (
          <p className="evidence-quote">{price.quote}</p>
        )}

        {marketFrom03?.kind === 'text' && (
          <p className="evidence-quote">{marketFrom03.text}</p>
        )}

        {marketFrom03?.kind === 'details' && (
          <div className="market-note">
            {marketFrom03.status !== null && (
              <p className="hint">
                Recorded stage-03 status: {marketFrom03.status}
              </p>
            )}
            {marketFrom03.note !== null && (
              <p className="evidence-quote">{marketFrom03.note}</p>
            )}
            {marketFrom03.quote !== null && (
              <p className="evidence-quote">{marketFrom03.quote}</p>
            )}
            {marketFrom03.sourceUrl !== null && (
              <SourceLink url={marketFrom03.sourceUrl} />
            )}
          </div>
        )}

        {marketEvidence.length > 0 && (
          <ul className="evidence-list">
            {marketEvidence.map((evidence, index) => (
              <li
                key={`${index}-${evidence.quote ?? ''}`}
                className="evidence-card"
              >
                <p className="hint">
                  {evidence.channel} · {evidence.direction} · {evidence.scope}
                </p>
                {evidence.quote !== null && (
                  <p className="evidence-quote">{evidence.quote}</p>
                )}
                {evidence.sourceUrl !== null && (
                  <SourceLink url={evidence.sourceUrl} />
                )}
              </li>
            ))}
          </ul>
        )}

        {offer.sourceUrl !== null && offer.sourceUrl !== primarySource && (
          <p className="hint">
            Offer source: <SourceLink url={offer.sourceUrl} />
          </p>
        )}

        {!hasEvidence && (
          <p className="hint">No additional textual evidence recorded.</p>
        )}
      </div>
    </details>
  );
}

export function ResearchMarket({ result }: { result: ResearchResultView }) {
  const id = useId();
  const [filter, setFilter] = useState<MarketFilter>(DEFAULT_MARKET_FILTER);
  const [page, setPage] = useState(1);

  const companies = result.companies;
  const summary = useMemo(() => buildMarketSummary(companies), [companies]);
  const options = useMemo(() => marketPriceOptions(companies), [companies]);
  const rows = useMemo(
    () => buildMarketRows(companies, filter.priceAvailability),
    [companies, filter.priceAvailability],
  );
  const filtered = useMemo(
    () => filterAndSortMarketRows(rows, filter),
    [rows, filter],
  );
  const pageData = paginate(filtered, page, PAGE_SIZE);
  const pricesComparable = canCompareMarketPrices(filter);

  if (result.state !== 'profiles' && result.state !== 'empty') {
    return (
      <section className="card">
        <h2>Market</h2>
        <p>{resultAvailabilityMessage(result)}</p>
      </section>
    );
  }

  const unreadable = unreadableDataMessage(result);
  const hasStructuredEmpty =
    summary.offersWithPrices === 0 &&
    filter.priceAvailability === 'priced' &&
    summary.totalOffers > 0;
  const hasNoOffers = summary.totalOffers === 0;
  const hasActiveFilters =
    filter.query.trim() !== '' ||
    filter.priceAvailability !== DEFAULT_MARKET_FILTER.priceAvailability ||
    filter.match !== DEFAULT_MARKET_FILTER.match ||
    filter.currency !== DEFAULT_MARKET_FILTER.currency ||
    filter.unit !== DEFAULT_MARKET_FILTER.unit ||
    filter.sort !== DEFAULT_MARKET_FILTER.sort;

  function updateFilter(patch: Partial<MarketFilter>): void {
    const next = { ...filter, ...patch };

    if (
      (next.sort === 'price-asc' || next.sort === 'price-desc') &&
      !canCompareMarketPrices(next)
    ) {
      next.sort = 'company';
    }

    setFilter(next);
    setPage(1);
  }

  function clearFilters(): void {
    setFilter(DEFAULT_MARKET_FILTER);
    setPage(1);
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Market</h2>
        <span className="muted">
          {summary.totalOffers === 1
            ? '1 offer'
            : `${summary.totalOffers} offers`}
        </span>
      </div>

      <p className="hint">
        Read-only overview of recorded offers and published prices. Numeric
        price comparisons are available only within one currency and one unit.
      </p>

      {unreadable !== null && <p className="hint">{unreadable}</p>}

      <dl
        className="metric-grid market-metric-grid"
        aria-label="Market summary"
      >
        <div className="metric">
          <dt className="metric-label">Total discovered offers</dt>
          <dd className="metric-value">{summary.totalOffers}</dd>
        </div>
        <div className="metric">
          <dt className="metric-label">Offers with structured prices</dt>
          <dd className="metric-value">{summary.offersWithPrices}</dd>
        </div>
        <div className="metric">
          <dt className="metric-label">Companies with structured prices</dt>
          <dd className="metric-value">{summary.companiesWithPrices}</dd>
        </div>
      </dl>

      {hasNoOffers ? (
        <p className="muted" role="status">
          No product offers were recorded for this research.
        </p>
      ) : hasStructuredEmpty ? (
        <div className="market-empty">
          <p className="muted" role="status">
            No structured prices were found for this research. Offers may still
            contain price evidence as text.
          </p>
          <button
            type="button"
            className="button secondary small"
            onClick={() => updateFilter({ priceAvailability: 'all' })}
          >
            Show all offers
          </button>
        </div>
      ) : (
        <>
          <div className="filter-row">
            <div className="field filter-search">
              <label htmlFor={`${id}-search`}>Search market</label>
              <input
                id={`${id}-search`}
                type="search"
                value={filter.query}
                placeholder="Company, domain or product"
                onChange={(event) =>
                  updateFilter({ query: event.target.value })
                }
              />
            </div>

            <div className="field">
              <label htmlFor={`${id}-availability`}>Price availability</label>
              <select
                id={`${id}-availability`}
                value={filter.priceAvailability}
                onChange={(event) =>
                  updateFilter({
                    priceAvailability: toPriceAvailability(event.target.value),
                  })
                }
              >
                <option value="priced">Offers with prices</option>
                <option value="all">All offers</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor={`${id}-match`}>Product match</label>
              <select
                id={`${id}-match`}
                value={filter.match}
                onChange={(event) =>
                  updateFilter({ match: toMatch(event.target.value) })
                }
              >
                <option value="all">All matches</option>
                <option value="a">Exact product (a)</option>
                <option value="b">Category match (b)</option>
                <option value="none">Not recorded</option>
              </select>
            </div>

            {options.currencies.length > 0 && (
              <div className="field">
                <label htmlFor={`${id}-currency`}>Currency</label>
                <select
                  id={`${id}-currency`}
                  value={filter.currency}
                  onChange={(event) =>
                    updateFilter({ currency: event.target.value })
                  }
                >
                  <option value="all">All currencies</option>
                  {options.currencies.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {options.units.length > 0 && (
              <div className="field">
                <label htmlFor={`${id}-unit`}>Unit</label>
                <select
                  id={`${id}-unit`}
                  value={filter.unit}
                  onChange={(event) =>
                    updateFilter({ unit: event.target.value })
                  }
                >
                  <option value="all">All units</option>
                  {options.units.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor={`${id}-sort`}>Sort market</label>
              <select
                id={`${id}-sort`}
                value={filter.sort}
                onChange={(event) =>
                  updateFilter({ sort: toSort(event.target.value) })
                }
              >
                <option value="company">Company A–Z</option>
                <option value="product">Product A–Z</option>
                <option value="price-asc" disabled={!pricesComparable}>
                  Price low–high
                </option>
                <option value="price-desc" disabled={!pricesComparable}>
                  Price high–low
                </option>
              </select>
            </div>
          </div>

          {(options.currencies.length > 0 || options.units.length > 0) &&
            !pricesComparable && (
              <p className="hint">
                Select one currency and one unit to enable price sorting.
              </p>
            )}

          <div className="list-toolbar">
            <p className="muted" role="status" aria-live="polite">
              Showing {pageData.from}–{pageData.to} of {pageData.total} rows ·{' '}
              {summary.offersWithPrices} of {summary.totalOffers} offers with
              structured prices
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="button secondary small"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>

          {pageData.items.length === 0 ? (
            <p className="muted">
              No market rows match these filters.{' '}
              <button
                type="button"
                className="link-button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </p>
          ) : (
            <>
              <div className="market-table-wrap">
                <table className="market-table">
                  <caption className="sr-only">
                    Discovered offers and published prices
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Company</th>
                      <th scope="col">Product</th>
                      <th scope="col">Product match</th>
                      <th scope="col">Price</th>
                      <th scope="col">Currency</th>
                      <th scope="col">Unit</th>
                      <th scope="col">VAT</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.items.map((row) => {
                      const price = row.price;
                      const sourceUrl = price?.sourceUrl ?? row.offer.sourceUrl;

                      return (
                        <tr
                          key={row.key}
                          className={
                            price === null ? 'market-row-unpriced' : undefined
                          }
                        >
                          <td>
                            <span className="market-company-name">
                              {row.companyName}
                            </span>
                            <span className="company-domain">{row.domain}</span>
                          </td>
                          <td>{row.offer.item}</td>
                          <td>{productMatchLabel(row.offer.verdict)}</td>
                          <td>
                            {price === null ? (
                              <span className="market-unavailable">
                                Not published
                              </span>
                            ) : (
                              <>
                                <span className="market-price">
                                  {formatPriceAmount(price)}
                                </span>
                                {price.variant !== null && (
                                  <span className="hint">
                                    {' '}
                                    · {price.variant}
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td>
                            {price === null
                              ? '—'
                              : (price.currency ?? 'Not recorded')}
                          </td>
                          <td>
                            {price === null ? '—' : unitLabel(price.unit)}
                          </td>
                          <td>
                            {price === null ? '—' : vatLabel(price.vatIncluded)}
                          </td>
                          <td className="market-source">
                            {sourceUrl === null ? (
                              <span className="hint">
                                No source URL recorded.
                              </span>
                            ) : (
                              <SourceLink url={sourceUrl} />
                            )}
                            <MarketEvidence row={row} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pageData.pageCount > 1 && (
                <nav className="pagination" aria-label="Market pages">
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={pageData.page === 1}
                    onClick={() => setPage(pageData.page - 1)}
                  >
                    Previous page
                  </button>
                  <span className="muted">
                    Page {pageData.page} of {pageData.pageCount}
                  </span>
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={pageData.page === pageData.pageCount}
                    onClick={() => setPage(pageData.page + 1)}
                  >
                    Next page
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
