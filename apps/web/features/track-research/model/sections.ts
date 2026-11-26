export type ResearchSection = 'overview' | 'companies' | 'market' | 'contacts';

export const RESEARCH_SECTIONS: readonly {
  value: ResearchSection;
  label: string;
}[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'companies', label: 'Companies' },
  { value: 'market', label: 'Market' },
  { value: 'contacts', label: 'Contacts' },
];
