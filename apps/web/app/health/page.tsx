import type { Metadata } from 'next'

import { apiUrl } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Backend health | SDR Assistant',
}

export const dynamic = 'force-dynamic'

type HealthBody = { status: string }

type HealthResult =
  | { ok: true; body: HealthBody; latencyMs: number }
  | { ok: false; error: string }

async function fetchHealth(): Promise<HealthResult> {
  const startedAt = performance.now()

  try {
    const response = await fetch(`${apiUrl}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })

    if (!response.ok) {
      return { ok: false, error: `Backend responded with HTTP ${response.status}` }
    }

    return {
      ok: true,
      body: (await response.json()) as HealthBody,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export default async function HealthPage() {
  const health = await fetchHealth()

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
              {health.body.status === 'ok' ? 'API is healthy' : `Unexpected status: ${health.body.status}`}
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
          <dd>{new Date().toLocaleString()}</dd>
          {health.ok && (
            <>
              <dt>Latency</dt>
              <dd>{health.latencyMs} ms</dd>
            </>
          )}
        </dl>
      </section>

      <p className="muted" style={{ marginTop: '1.5rem' }}>
        <a href="/health">Refresh</a>
      </p>
    </main>
  )
}
