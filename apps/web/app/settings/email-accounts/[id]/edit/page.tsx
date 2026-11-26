import type { Metadata } from 'next';

import { EditEmailAccountPage } from '@/_pages/email-accounts';

export const metadata: Metadata = {
  title: 'Edit email account | SDR Assistant',
};

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return <EditEmailAccountPage id={id} />;
}
