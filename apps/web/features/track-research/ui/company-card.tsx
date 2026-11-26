import { Fragment, type ReactNode } from 'react';

import type { CompanyProfileView } from '@/entities/research/client';

import {
  COMPANY_STATUS_LABELS,
  companyDisplayName,
  companyStatusTone,
  formatPrice,
  offersLabel,
} from '../model/presentation';
import { SourceLink } from './source-link';

function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function OfferClassification({
  offer,
}: {
  offer: CompanyProfileView['offers'][number];
}) {
  const parts: string[] = [];

  if (offer.market !== null) {
    parts.push(`Market status: ${offer.market.status} (as recorded)`);

    if (offer.market.resolvedBy !== null) {
      parts.push(`resolved by ${offer.market.resolvedBy}`);
    }

    if (offer.market.channels.length > 0) {
      parts.push(
        offer.market.channels
          .map((channel) => `${channel.channel}: ${channel.state}`)
          .join(', '),
      );
    }

    if (offer.market.conflict) {
      parts.push('evidence conflict recorded');
    }
  }

  return parts.length === 0 ? null : (
    <p className="offer-meta hint">{parts.join(' · ')}</p>
  );
}

export function CompanyCard({ company }: { company: CompanyProfileView }) {
  return (
    <details className="company-card">
      <summary className="company-summary">
        <span className="company-summary-main">
          <span className="company-name">{companyDisplayName(company)}</span>
          <span className="company-domain">{company.domain}</span>
        </span>
        <span className="company-summary-meta">
          <span className={`status ${companyStatusTone(company.status)}`}>
            <span className="dot" aria-hidden="true" />
            {COMPANY_STATUS_LABELS[company.status]}
          </span>
          <span className="hint">{offersLabel(company.offers.length)}</span>
          <span className="hint">
            {company.emails.length > 0 ? 'Email available' : 'No email'}
          </span>
          <span className="hint">
            {company.phones.length > 0 ? 'Phone available' : 'No phone'}
          </span>
          <span className="company-chevron" aria-hidden="true">
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              focusable="false"
            >
              <path d="M5 8l5 5 5-5" />
            </svg>
          </span>
        </span>
      </summary>

      <div className="company-body">
        <div className="company-primary-grid">
          <section>
            <h3 className="company-section-title">Company identity</h3>
            <dl className="data-list">
              <DataRow label="Trading name">
                {company.name ?? 'Not recorded'}
              </DataRow>
              <DataRow label="Domain">{company.domain}</DataRow>
              {company.registrableDomain !== null &&
                company.registrableDomain !== company.domain && (
                  <DataRow label="Registrable domain">
                    {company.registrableDomain}
                  </DataRow>
                )}
              {company.legalName !== null && (
                <DataRow label="Legal name">{company.legalName}</DataRow>
              )}
              {company.code !== null && (
                <DataRow label="Registration number">{company.code}</DataRow>
              )}
              {company.vat !== null && (
                <DataRow label="VAT number">{company.vat}</DataRow>
              )}
              {company.address !== null && (
                <DataRow label="Address">{company.address}</DataRow>
              )}
              {company.city !== null && (
                <DataRow label="City">{company.city}</DataRow>
              )}
              {company.country !== null && (
                <DataRow label="Country">{company.country}</DataRow>
              )}
              {company.contactFormUrl !== null && (
                <DataRow label="Contact form">
                  <SourceLink url={company.contactFormUrl} />
                </DataRow>
              )}
            </dl>
          </section>

          <section>
            <h3 className="company-section-title">Contacts</h3>
            <p className="hint">
              Published contact details, shown as discovered. They are not
              verified for deliverability.
            </p>

            <p className="company-subtitle">Email addresses</p>
            {company.emails.length === 0 ? (
              <p className="hint">No email address recorded.</p>
            ) : (
              <ul className="contact-values">
                {company.emails.map((email, index) => (
                  <li key={`${index}-${email.value}`} className="contact-value">
                    <span>{email.value}</span>
                    {email.label !== null && (
                      <span className="hint"> · {email.label}</span>
                    )}
                    {email.sourceUrl !== null && (
                      <span>
                        {' '}
                        · <SourceLink url={email.sourceUrl} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <p className="company-subtitle">Telephone numbers</p>
            {company.phones.length === 0 ? (
              <p className="hint">No telephone number recorded.</p>
            ) : (
              <ul className="contact-values">
                {company.phones.map((phone, index) => (
                  <li key={`${index}-${phone.value}`} className="contact-value">
                    <span>{phone.value}</span>
                    {phone.normalised !== null &&
                      phone.normalised !== phone.value && (
                        <span className="hint"> ({phone.normalised})</span>
                      )}
                    {phone.label !== null && (
                      <span className="hint"> · {phone.label}</span>
                    )}
                    {phone.sourceUrl !== null && (
                      <span>
                        {' '}
                        · <SourceLink url={phone.sourceUrl} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section>
          <h3 className="company-section-title">
            Product offers ({company.offers.length})
          </h3>
          {company.offers.length === 0 ? (
            <p className="hint">No offers recorded for this company.</p>
          ) : (
            <ul className="offer-list">
              {company.offers.map((offer) => {
                const hasEvidence =
                  offer.marketFrom03 !== null ||
                  (offer.market?.evidence.length ?? 0) > 0 ||
                  offer.prices.some((price) => price.quote !== null);

                return (
                  <li key={offer.key}>
                    <article className="offer-card">
                      <div className="offer-head">
                        <p className="offer-title">{offer.item}</p>
                        {offer.verdict !== null && (
                          <span className="status muted">
                            Verdict {offer.verdict}
                          </span>
                        )}
                        {offer.id !== null && (
                          <span className="hint">Record {offer.id}</span>
                        )}
                      </div>

                      <OfferClassification offer={offer} />

                      <p className="company-subtitle">Product attributes</p>
                      {offer.traits.length === 0 ? (
                        <p className="hint">No product attributes recorded.</p>
                      ) : (
                        <dl className="data-list">
                          {offer.traits.map((trait) => (
                            <Fragment key={trait.key}>
                              <dt>{trait.key}</dt>
                              <dd>{trait.value}</dd>
                            </Fragment>
                          ))}
                        </dl>
                      )}

                      <p className="company-subtitle">Prices</p>
                      {offer.prices.length === 0 ? (
                        <p className="hint">No published price.</p>
                      ) : (
                        <ul className="price-list">
                          {offer.prices.map((price, index) => (
                            <li key={index} className="price-card">
                              <p className="price-value">
                                {formatPrice(price)}
                              </p>
                              {price.sourceUrl !== null && (
                                <SourceLink url={price.sourceUrl} />
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <p className="hint">
                        Offer source:{' '}
                        {offer.sourceUrl === null ? (
                          'No offer source URL recorded.'
                        ) : (
                          <SourceLink url={offer.sourceUrl} />
                        )}
                      </p>

                      <details className="offer-evidence">
                        <summary>Market and price evidence</summary>
                        <div className="offer-evidence-body">
                          <p className="hint">
                            Text is shown as recorded. It is not converted into
                            a structured price.
                          </p>

                          {offer.marketFrom03?.kind === 'text' && (
                            <p className="evidence-quote">
                              {offer.marketFrom03.text}
                            </p>
                          )}

                          {offer.marketFrom03?.kind === 'details' && (
                            <div className="market-note">
                              <p className="company-subtitle">
                                Stage-03 market note
                              </p>
                              {offer.marketFrom03.status !== null && (
                                <p className="hint">
                                  Recorded status: {offer.marketFrom03.status}
                                </p>
                              )}
                              {offer.marketFrom03.note !== null && (
                                <p className="evidence-quote">
                                  {offer.marketFrom03.note}
                                </p>
                              )}
                              {offer.marketFrom03.quote !== null && (
                                <p className="evidence-quote">
                                  {offer.marketFrom03.quote}
                                </p>
                              )}
                              {offer.marketFrom03.sourceUrl !== null && (
                                <SourceLink
                                  url={offer.marketFrom03.sourceUrl}
                                />
                              )}
                            </div>
                          )}

                          {offer.market !== null &&
                            offer.market.evidence.length > 0 && (
                              <div>
                                <p className="company-subtitle">
                                  Market evidence
                                </p>
                                <ul className="evidence-list">
                                  {offer.market.evidence.map(
                                    (evidence, index) => (
                                      <li
                                        key={`${index}-${evidence.quote ?? ''}`}
                                        className="evidence-card"
                                      >
                                        <p className="hint">
                                          {evidence.channel} ·{' '}
                                          {evidence.direction} ·{' '}
                                          {evidence.scope}
                                        </p>
                                        {evidence.quote !== null && (
                                          <p className="evidence-quote">
                                            {evidence.quote}
                                          </p>
                                        )}
                                        {evidence.sourceUrl !== null && (
                                          <SourceLink
                                            url={evidence.sourceUrl}
                                          />
                                        )}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            )}

                          {offer.prices.some(
                            (price) => price.quote !== null,
                          ) && (
                            <div>
                              <p className="company-subtitle">Price quotes</p>
                              <ul className="evidence-list">
                                {offer.prices.map((price, index) =>
                                  price.quote === null ? null : (
                                    <li
                                      key={`price-quote-${index}`}
                                      className="evidence-card"
                                    >
                                      <p className="evidence-quote">
                                        {price.quote}
                                      </p>
                                      {price.sourceUrl !== null && (
                                        <SourceLink url={price.sourceUrl} />
                                      )}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}

                          {!hasEvidence && (
                            <p className="hint">
                              No additional textual evidence recorded.
                            </p>
                          )}
                        </div>
                      </details>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <details className="company-technical">
          <summary>Technical profiling and sources</summary>
          <div className="company-technical-body">
            <dl className="data-list">
              <DataRow label="Profile status">
                {COMPANY_STATUS_LABELS[company.status]}
              </DataRow>
              {company.error !== null && (
                <DataRow label="Profile error">
                  {company.error.message}{' '}
                  <span className="hint">({company.error.code})</span>
                </DataRow>
              )}
            </dl>

            <p className="company-subtitle">Profile sources</p>
            {company.sources.length === 0 ? (
              <p className="hint">No profile source pages recorded.</p>
            ) : (
              <ul className="source-list">
                {company.sources.map((source, index) => (
                  <li key={`${index}-${source}`}>
                    <SourceLink url={source} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>
    </details>
  );
}
