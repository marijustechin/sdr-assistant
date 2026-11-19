import Link from 'next/link';

import { fetchSettings } from '@/entities/settings';
import { SettingsForm } from '@/features/update-settings';

export async function ResearchSettingsPage() {
  const result = await fetchSettings();

  if (!result.ok) {
    return (
      <main>
        <p className="breadcrumb">
          <Link href="/settings">← Settings</Link>
        </p>

        <div className="status error">
          <span className="dot" aria-hidden="true" />
          Could not load the settings
        </div>
        <pre>{result.message}</pre>
      </main>
    );
  }

  const groups = result.data.groups;
  const hasSettings = groups.some((group) => group.items.length > 0);

  return (
    <main>
      <p className="breadcrumb">
        <Link href="/settings">← Settings</Link>
      </p>

      <div className="page-header">
        <div>
          <h1>Research settings</h1>
          <p className="muted">
            Stored centrally. Stage 02&apos;s live search is currently replayed
            from dumps, so these values take effect when it is re-enabled.
          </p>
        </div>
      </div>

      {hasSettings ? (
        <SettingsForm groups={groups} />
      ) : (
        <section className="card">
          <h2>No settings yet</h2>
          <p className="muted">
            No research settings are registered in the API.
          </p>
        </section>
      )}

      <p className="muted page-footer">
        <Link href="/settings">← Settings</Link>
      </p>
    </main>
  );
}
