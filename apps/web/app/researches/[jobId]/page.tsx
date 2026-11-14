import { ResearchPage } from '@/_pages/research';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Research | SDR Assistant',
};

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ jobId: string }>;
}>) {
  const { jobId } = await params;

  return <ResearchPage jobId={jobId} />;
}
