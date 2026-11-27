export type ContactKind =
  | 'email'
  | 'phone'
  | 'postal_address'
  | 'registration_identifier';

export type ContactExtractionMethod =
  | 'stage04'
  | 'json_ld'
  | 'mailto'
  | 'tel'
  | 'visible_text'
  | 'cf_email';

export type ContactEvidence = {
  method: ContactExtractionMethod;
  sourceUrl: string;
  quote: string;
  context: string;
  offset: number | null;
  offsetScope: 'html' | 'visible_text';
  jsonPath?: string;
  tag?: string;
  attribute?: string;
};

export type PostalAddress = {
  [key: string]: string;
};

export type ContactCandidate = {
  kind: ContactKind;
  value: string;
  normalized: string | null;
  companyName: string | null;
  method: ContactExtractionMethod;
  sourceUrl: string;
  evidence: ContactEvidence;
  structured?: PostalAddress;
  identifierKind?: string;
};

export type ContactDiscoveryResult = {
  sourceUrl: string;
  candidates: ContactCandidate[];
  companyNames: string[];
};
