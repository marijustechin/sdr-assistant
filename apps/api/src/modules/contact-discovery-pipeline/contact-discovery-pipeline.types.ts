import type {
  ContactCandidate,
  ContactDiscoveryResult,
} from '../contact-discovery/contact-discovery.types.js';
import type {
  SourceCompany,
  SourceEmail,
  SourcePhone,
} from '../lead-qualification/lead-qualification.types.js';

export type ContactEvidenceOrigin =
  | 'stage04'
  | 'homepage'
  | 'contact_page'
  | 'exa';

export type ContactPageFailureKind =
  | 'timeout'
  | 'network'
  | 'tls'
  | 'dns'
  | 'unsafe'
  | 'redirects'
  | 'retrieval'
  | null;

export type EvidenceCandidate = {
  origin: ContactEvidenceOrigin;
  candidate: ContactCandidate;
  companyIdentityVerified?: boolean;
};

export type FetchedContactPage = {
  url: string;
  status: number | null;
  body: string;
  redirects: number;
  error: string | null;
  failureKind?: ContactPageFailureKind;
};

export type ContactPageEvidence = {
  url: string;
  status: number | null;
  candidates: EvidenceCandidate[];
  error: string | null;
  failureKind?: ContactPageFailureKind;
  attempts?: number;
  retried?: boolean;
};

export type ExaQueryEvidence = {
  query: string;
  results: Array<{ url: string; title: string; snippet: string }>;
  pages: ContactPageEvidence[];
  error: string | null;
};

export type ExaEvidence = {
  query: string;
  results: Array<{ url: string; title: string; snippet: string }>;
  pages: ContactPageEvidence[];
  error: string | null;
  queries?: ExaQueryEvidence[];
};

export type CompanyContactEvidence = {
  original: {
    emails: SourceEmail[];
    phones: SourcePhone[];
    address: string | null;
    city: string | null;
    country: string | null;
    registrationIdentifiers: string[];
  };
  homepage: {
    url: string | null;
    status: number | null;
    candidates: EvidenceCandidate[];
    error: string | null;
  };
  contactPages: ContactPageEvidence[];
  exa: ExaEvidence | null;
};

export type ContactOwnership = 'usable' | 'partner' | 'uncertain';

export type ContactSource = {
  origin: ContactEvidenceOrigin;
  method: string;
  sourceUrl: string | null;
  evidence: unknown;
  companyIdentityVerified?: boolean;
};

export type ClassifiedEmail = {
  value: string;
  ownership: ContactOwnership;
  employeeName: null;
  employeePosition: null;
  employeeAssociation: 'unknown';
  sources: ContactSource[];
};

export type CompanyTelephone = {
  normalized: string;
  originalValues: string[];
  countries: string[];
  local: boolean;
  reliableForeign: boolean;
  ambiguous: boolean;
  sources: ContactSource[];
};

export type CompanyAddress = {
  value: string;
  structured: Record<string, string> | null;
  sources: ContactSource[];
};

export type CompanyRegistration = {
  value: string;
  kind: string;
  sources: ContactSource[];
};

export type RemovedContact = {
  kind: 'email' | 'phone';
  value: string;
  reason: string;
  sourceUrl: string | null;
};

export type ContactDiscoveryCompanyResult = {
  domain: string;
  companyName: string | null;
  targetCountry: string;
  targetCountryCode: string;
  retained: boolean;
  exclusionReason:
    | 'MISSING_USABLE_COMPANY_EMAIL'
    | 'FOREIGN_TELEPHONE_NO_TARGET_ESTABLISHMENT'
    | null;
  emails: ClassifiedEmail[];
  usableEmails: ClassifiedEmail[];
  partnerEmails: ClassifiedEmail[];
  uncertainEmails: ClassifiedEmail[];
  phones: CompanyTelephone[];
  addresses: CompanyAddress[];
  registrationIdentifiers: CompanyRegistration[];
  removedContacts: RemovedContact[];
  targetAddressEvidence: boolean;
  targetTelephoneEvidence: boolean;
  foreignTelephoneEvidence: boolean;
  diagnostics: {
    homepage: CompanyContactEvidence['homepage'];
    contactPages: ContactPageEvidence[];
    exa: ExaEvidence | null;
    fetches: number;
    searches: number;
  };
};

export type ContactDiscoveryPorts = {
  homepage: {
    fetch(domain: string): Promise<FetchedContactPage>;
  };
  page: {
    fetch(url: string): Promise<FetchedContactPage>;
  };
  exa: {
    search(
      query: string,
      results: number,
      country: string,
    ): Promise<{
      query: string;
      results: Array<{ url: string; title: string; snippet: string }>;
    }>;
  };
};

export type ContactDiscoveryLimits = {
  maxContactPages: number;
  maxExaPages: number;
  exaResults: number;
  maxFetches: number;
  maxSearches: number;
};

export const DEFAULT_CONTACT_DISCOVERY_LIMITS: ContactDiscoveryLimits = {
  maxContactPages: 5,
  maxExaPages: 3,
  exaResults: 5,
  maxFetches: 150,
  maxSearches: 50,
};

export type ContactDiscoveryPipelineResult = {
  sourceCompanyCount: number;
  retainedCompanies: ContactDiscoveryCompanyResult[];
  excludedCompanies: ContactDiscoveryCompanyResult[];
  summary: {
    retainedCompanies: number;
    excludedCompanies: number;
    exclusionsMissingUsableEmail: number;
    exclusionsForeignTelephone: number;
    companiesWithUsableEmail: number;
    usableUniqueCompanyEmailPairs: number;
    partnerDistributorEmailPairs: number;
    uncertainEmailPairs: number;
  };
};

export type ExtractContactCandidates = (input: {
  html: string;
  sourceUrl: string;
}) => ContactDiscoveryResult;

export type ContactDiscoveryPipelineOptions = {
  extract: ExtractContactCandidates;
  limits?: ContactDiscoveryLimits;
};

export type SourceCompanyLike = SourceCompany;
