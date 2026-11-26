import Link from 'next/link';

import { fetchEmailAccounts } from '@/entities/email-account';
import {
  EmailAccountTestConnectionsButton,
  EmailAccountToggle,
  EmailAccountVerificationStatus,
} from '@/features/manage-email-account';
import { formatDateTime } from '@/shared/lib/format';

export async function EmailAccountsPage() {
  const result = await fetchEmailAccounts();

  if (!result.ok) {
    return (
      <main>
        <p className="breadcrumb">
          <Link href="/settings">← Settings</Link>
        </p>

        <div className="status error">
          <span className="dot" aria-hidden="true" />
          Could not load the email accounts
        </div>
        <pre>{result.message}</pre>
      </main>
    );
  }

  const accounts = result.data;

  return (
    <main>
      <p className="breadcrumb">
        <Link href="/settings">← Settings</Link>
      </p>

      <div className="page-header">
        <div>
          <h1>Email accounts</h1>
          <p className="muted">
            Mailboxes available for future communication with discovered
            companies. Credentials are stored encrypted.
          </p>
        </div>
        <Link href="/settings/email-accounts/new" className="button">
          Add account
        </Link>
      </div>

      <section className="card">
        {accounts.length === 0 ? (
          <p className="muted">
            No email accounts yet.{' '}
            <Link href="/settings/email-accounts/new">
              Add the first account
            </Link>
            .
          </p>
        ) : (
          <ul className="product-list">
            {accounts.map((account) => (
              <li key={account.id} className="product-item">
                <div>
                  <h2>{account.name}</h2>
                  <p className="muted">
                    {account.emailAddress} · {account.senderName}
                  </p>
                  <p className="muted">
                    SMTP {account.smtpHost}:{account.smtpPort}{' '}
                    {account.smtpSecurity} · IMAP {account.imapHost}:
                    {account.imapPort} {account.imapSecurity} · Updated{' '}
                    {formatDateTime(account.updatedAt)}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                    <EmailAccountVerificationStatus
                      protocol="SMTP"
                      status={account.smtpVerificationStatus}
                      lastCheckedAt={account.smtpLastCheckedAt}
                      failureCode={account.smtpVerificationFailureCode}
                    />
                    <EmailAccountVerificationStatus
                      protocol="IMAP"
                      status={account.imapVerificationStatus}
                      lastCheckedAt={account.imapLastCheckedAt}
                      failureCode={account.imapVerificationFailureCode}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={account.enabled ? 'status ok' : 'status muted'}
                  >
                    <span className="dot" aria-hidden="true" />
                    {account.enabled ? 'Enabled' : 'Disabled'}
                  </span>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <EmailAccountTestConnectionsButton
                      accountId={account.id}
                      enabled={account.enabled}
                    />
                    <Link
                      href={`/settings/email-accounts/${encodeURIComponent(account.id)}/edit`}
                      className="button small secondary"
                    >
                      Edit
                    </Link>
                    <EmailAccountToggle account={account} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted page-footer">
        <Link href="/settings">← Settings</Link>
      </p>
    </main>
  );
}
