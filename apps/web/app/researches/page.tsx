import { ResearchesPage } from '@/_pages/researches';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Researches | SDR Assistant',
};

export const dynamic = 'force-dynamic';

export default function Page() {
  return <ResearchesPage />;
}
