import type { Metadata } from 'next';

import { EmailAccountsPage } from '@/_pages/email-accounts';

export const metadata: Metadata = {
  title: 'Email accounts | SDR Assistant',
};

export const dynamic = 'force-dynamic';

export default function Page() {
  return <EmailAccountsPage />;
}
