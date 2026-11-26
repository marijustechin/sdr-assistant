import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchEmailAccount } from '@/entities/email-account';
import { EmailAccountForm } from '@/features/manage-email-account';

type EditEmailAccountPageProps = {
  readonly id: string;
};

export async function EditEmailAccountPage({ id }: EditEmailAccountPageProps) {
  const result = await fetchEmailAccount(id);

  if (!result.ok && result.status === 404) {
    notFound();
  }

  if (!result.ok) {
    return (
      <main>
        <p className="breadcrumb">
          <Link href="/settings/email-accounts">← Email accounts</Link>
        </p>

        <div className="status error">
          <span className="dot" aria-hidden="true" />
          Could not load the email account
        </div>
        <pre>{result.message}</pre>
      </main>
    );
  }

  const account = result.data;

  return (
    <main>
      <p className="breadcrumb">
        <Link href="/settings/email-accounts">← Email accounts</Link>
      </p>

      <div className="page-header">
        <div>
          <h1>Edit email account</h1>
          <p className="muted">
            {account.name} · {account.emailAddress}
          </p>
        </div>
      </div>

      <EmailAccountForm mode="edit" account={account} />
    </main>
  );
}
