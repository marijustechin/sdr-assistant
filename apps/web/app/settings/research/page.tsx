import type { Metadata } from 'next';

import { ResearchSettingsPage } from '@/_pages/research-settings';

export const metadata: Metadata = {
  title: 'Research settings | SDR Assistant',
};

export const dynamic = 'force-dynamic';

export default function Page() {
  return <ResearchSettingsPage />;
}
