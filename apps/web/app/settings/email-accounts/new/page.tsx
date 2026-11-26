import type { Metadata } from 'next';

import { NewEmailAccountPage } from '@/_pages/email-accounts';

export const metadata: Metadata = {
  title: 'New email account | SDR Assistant',
};

export default function Page() {
  return <NewEmailAccountPage />;
}
