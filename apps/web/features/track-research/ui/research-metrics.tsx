import type { ResearchResultView } from '@/entities/research/client';

import { buildCompanyContactRows } from '../model/contact-browser';

type Metric = {
  label: string;
  value: number | null;
};

export function ResearchMetrics({ result }: { result: ResearchResultView }) {
  const hasCompanyList =
    result.state === 'profiles' || result.state === 'empty';

  const metrics: Metric[] = [
    {
      label: 'Company profiles',
      value: hasCompanyList ? result.companies.length : null,
    },
    {
      label: 'Product offers',
      value: hasCompanyList
        ? result.companies.reduce(
            (total, company) => total + company.offers.length,
            0,
          )
        : null,
    },
    {
      label: 'Companies with email',
      value: hasCompanyList
        ? result.companies.filter((company) => company.emails.length > 0).length
        : null,
    },
    {
      label: 'Companies with phone',
      value: hasCompanyList
        ? result.companies.filter((company) => company.phones.length > 0).length
        : null,
    },
  ];

  return (
    <dl className="metric-grid" aria-label="Research summary">
      {metrics.map((metric) => (
        <div key={metric.label} className="metric">
          <dt className="metric-label">{metric.label}</dt>
          <dd className="metric-value">
            {metric.value === null ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="metric-note">Not available</span>
              </>
            ) : (
              metric.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function companiesWithContacts(
  result: ResearchResultView,
): number | null {
  return result.state === 'profiles' || result.state === 'empty'
    ? buildCompanyContactRows(result.companies).length
    : null;
}
