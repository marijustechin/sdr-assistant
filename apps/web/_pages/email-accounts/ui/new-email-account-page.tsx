import Link from 'next/link';

import { EmailAccountForm } from '@/features/manage-email-account';

export function NewEmailAccountPage() {
  return (
    <main>
      <p className="breadcrumb">
        <Link href="/settings/email-accounts">← Email accounts</Link>
      </p>

      <div className="page-header">
        <div>
          <h1>New email account</h1>
          <p className="muted">
            Outgoing and incoming mail are configured separately. Both
            credentials are stored encrypted.
          </p>
        </div>
      </div>

      <EmailAccountForm mode="create" />
    </main>
  );
}
