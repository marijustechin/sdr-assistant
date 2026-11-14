import type { Metadata } from 'next';
import { z } from 'zod';

import { formatDateTime } from '@/shared/lib/format';
import { getJson } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

export const metadata: Metadata = {
  title: 'Backend health | SDR Assistant',
};

export const dynamic = 'force-dynamic';

const healthSchema = z.object({ status: z.string() });

type HealthBody = z.infer<typeof healthSchema>;

type HealthResult =
  | { ok: true; body: HealthBody; latencyMs: number }
  | { ok: false; error: string };

async function fetchHealth(): Promise<HealthResult> {
  const startedAt = performance.now();
  const result = await getJson(`${apiUrl}/health`, healthSchema);

  if (!result.ok) {
    return { ok: false, error: result.message };
  }

  return {
    ok: true,
    body: result.data,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}

export default async function HealthPage() {
  const health = await fetchHealth();

  return (
    <main>
      <h1>Backend health</h1>
      <p className="muted">
        Live result fetched from the NestJS API (<code>{apiUrl}/health</code>).
      </p>

      <section className="card">
        {health.ok ? (
          <>
            <div className="status ok">
              <span className="dot" />
              {health.body.status === 'ok'
                ? 'API is healthy'
                : `Unexpected status: ${health.body.status}`}
            </div>
            <pre>{JSON.stringify(health.body, null, 2)}</pre>
          </>
        ) : (
          <>
            <div className="status error">
              <span className="dot" />
              API is unreachable
            </div>
            <pre>{health.error}</pre>
          </>
        )}

        <dl>
          <dt>Endpoint</dt>
          <dd>{apiUrl}/health</dd>
          <dt>Checked</dt>
          <dd>{formatDateTime(new Date())}</dd>
          {health.ok && (
            <>
              <dt>Latency</dt>
              <dd>{health.latencyMs} ms</dd>
            </>
          )}
        </dl>
      </section>

      <p className="muted page-footer">
        <a href="/health">Refresh</a>
      </p>
    </main>
  );
}
