export type LeadQualificationRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'INTERRUPTED'
  | 'FAILED';

export type LeadQualificationTrigger = 'AUTO' | 'MANUAL';

export type QualificationDecision = 'ACCEPTED' | 'EXCLUDED';

export type CheckStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_EVALUATED';

export type ExclusionReason =
  | 'WEBSITE_UNAVAILABLE'
  | 'NO_VALID_HTTPS'
  | 'INACTIVE_BUSINESS'
  | 'COUNTRY_MISMATCH'
  | 'COUNTRY_UNCONFIRMED'
  | 'IRRELEVANT_BUSINESS'
  | 'EMAIL_NOT_FOUND'
  | 'DUPLICATE_COMPANY'
  | 'INSUFFICIENT_EVIDENCE'
  | 'PROCESSING_FAILED';

export type EvidenceKind =
  | 'website'
  | 'address'
  | 'phone'
  | 'email'
  | 'offer'
  | 'legal'
  | 'search'
  | 'activity'
  | 'relevance';

export type EvidenceSource = 'stage04' | 'http' | 'search' | 'semantic';

export type EvidenceRef = {
  url: string;
  kind: EvidenceKind;
  quote: string | null;
  source: EvidenceSource;
  observedAt: string;
};

export type ContactRole = 'sales' | 'general' | null;

export type ContactDiscoverySource =
  | 'stage04'
  | 'contact-page'
  | 'imprint'
  | 'about'
  | 'search'
  | 'directory';

export type EmailContact = {
  value: string;
  role: ContactRole;
  sourceUrl: string | null;
  discoveredBy: ContactDiscoverySource;
};

export type PhoneContact = {
  value: string;
  normalised: string | null;
  role: ContactRole;
  sourceUrl: string | null;
  discoveredBy: ContactDiscoverySource;
};

export type SourceEmail = {
  value: string;
  label: string | null;
  sourceUrl: string | null;
};

export type SourcePhone = {
  value: string;
  normalised: string | null;
  label: string | null;
  sourceUrl: string | null;
};

export type SourceOffer = {
  id: string | null;
  item: string;
  verdict: 'a' | 'b' | null;
  sourceUrl: string | null;
};

export type SourceCompany = {
  sourceIndex: number;
  key: string;
  domain: string;
  registrableDomain: string | null;
  name: string | null;
  legalName: string | null;
  code: string | null;
  vat: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  emails: SourceEmail[];
  phones: SourcePhone[];
  sources: string[];
  offers: SourceOffer[];
  profileHash: string;
};

export type InvalidSourceProfile = {
  sourceIndex: number;
  profileHash: string;
};

export type SourceStudy = {
  id: string;
  targetCountry: string;
  targetCountryCode: string | null;
  productName: string;
  productDescription: string;
  resultSchemaVersion: number | null;
  companies: SourceCompany[];
  invalidProfiles: InvalidSourceProfile[];
  skippedProfiles: number;
  rawCompanyCount: number;
  inputFingerprint: string;
};

export type CheckBase = {
  status: CheckStatus;
  reason: ExclusionReason | null;
  evidence: EvidenceRef[];
  detail: string | null;
  technicalFailure: boolean;
};

export type WebsiteCheck = CheckBase & {
  finalUrl: string | null;
  https: boolean;
  certificateValid: boolean;
  httpStatus: number | null;
  redirects: number;
  temporary: boolean;
  failureKind: string | null;
  bodyText: string;
};

export type ActivityCheck = CheckBase;

export type GeographicCheck = CheckBase & {
  addressCountry: string | null;
  phoneCountries: string[];
  localPresence: boolean;
  foreignPresence: boolean;
  conflict: boolean;
  discoveryAttempted: boolean;
};

export type RelevanceCheck = CheckBase & {
  matchedOfferIds: string[];
  aOffers: number;
  bOffers: number;
  targetMarketOffers: number;
};

export type EmailCheck = CheckBase & {
  addresses: EmailContact[];
};

export type DuplicateCheck = CheckBase & {
  canonicalCompanyKey: string | null;
  matchedOn: string[];
};

export type QualificationChecks = {
  website: WebsiteCheck;
  activity: ActivityCheck;
  geography: GeographicCheck;
  relevance: RelevanceCheck;
  email: EmailCheck;
  duplicate: DuplicateCheck;
};

export type QualificationMetadata = {
  algorithmVersion: string;
  policyVersion: string;
  promptVersion: string | null;
  semanticModel: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  fetches: number;
  searches: number;
  llmCalls: number;
  promptTokens: number | null;
  completionTokens: number | null;
  retries: number;
  limited: boolean;
  technicalFailure: boolean;
  error: string | null;
  contactDiscovery?: Record<string, unknown>;
};

export type QualificationDraft = {
  decision: QualificationDecision;
  primaryExclusionReason: ExclusionReason | null;
  exclusionReasons: ExclusionReason[];
  checks: QualificationChecks;
  contacts: {
    emails: EmailContact[];
    phones: PhoneContact[];
  };
  evidenceSources: EvidenceRef[];
  metadata: QualificationMetadata;
};

export type DiscoveryPage = {
  url: string;
  text: string;
};

export type RunUsage = {
  llmCalls: number;
  promptTokens: number;
  completionTokens: number;
  fetches: number;
  searches: number;
  retries: number;
};

export type DiscoveryResult = {
  emails: EmailContact[];
  phones: PhoneContact[];
  countryCodes: string[];
  localAddressEvidence: EvidenceRef[];
  foreignAddressEvidence: EvidenceRef[];
  foreignAddressCountries: string[];
  localBranchEvidence: EvidenceRef[];
  pages: DiscoveryPage[];
  evidence: EvidenceRef[];
  fetches: number;
  searches: number;
  attemptedFetches: number;
  successfulFetches: number;
  technicalFailure: boolean;
  limitReached: boolean;
};

export type SemanticEvidence = {
  quote: string;
  sourceUrl: string;
};

export type SemanticGeographyEvidence = SemanticEvidence & {
  kind: 'address' | 'branch' | 'legal' | 'pickup';
};

export type SemanticRelevanceEvidence = SemanticEvidence & {
  offerId: string | null;
};

export type SemanticAssessment = {
  activity: 'active' | 'inactive' | 'unclear';
  activityEvidence: SemanticEvidence[];
  geography: 'local' | 'foreign' | 'unclear';
  geographyEvidence: SemanticGeographyEvidence[];
  localBranch: {
    present: boolean;
    quote: string | null;
    sourceUrl: string | null;
  } | null;
  relevance: 'relevant' | 'irrelevant' | 'unclear';
  relevanceEvidence: SemanticRelevanceEvidence[];
  notes: string | null;
};

export type SemanticRequest = {
  targetCountry: string;
  productName: string;
  productDescription: string;
  company: {
    name: string | null;
    domain: string;
    address: string | null;
    city: string | null;
    country: string | null;
    offers: Array<{
      id: string | null;
      item: string;
      verdict: 'a' | 'b' | null;
      sourceUrl: string | null;
    }>;
  };
  focus: Array<'activity' | 'geography' | 'relevance'>;
  pages: DiscoveryPage[];
  existingEvidence: EvidenceRef[];
};

export type LeadQualificationLimits = {
  maxCompaniesPerRun: number;
  maxSourceBytes: number;
  websiteAttempts: number;
  websiteTimeoutMs: number;
  websiteMaxRedirects: number;
  websiteMaxBodyBytes: number;
  websiteConcurrency: number;
  discoveryPages: number;
  discoverySearchQueries: number;
  discoverySearchResults: number;
  discoveryFetchedSearchResults: number;
  discoveryFirecrawlPages: number;
  searchConcurrency: number;
  llmCallsPerCompany: number;
  llmCallsPerRun: number;
  llmInputChars: number;
  llmOutputTokens: number;
  llmConcurrency: number;
  runDurationMs: number;
  leaseMs: number;
  heartbeatMs: number;
  maxEvidencePerResult: number;
  maxQuoteChars: number;
  maxResultJsonBytes: number;
};

export type QualificationContext = {
  study: SourceStudy;
  limits: LeadQualificationLimits;
  startedAt: Date;
};

export class RunWideError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RunWideError';
    this.code = code;
  }
}

export class LostLeaseError extends Error {
  constructor(message = 'The qualification run lease was lost') {
    super(message);
    this.name = 'LostLeaseError';
  }
}
