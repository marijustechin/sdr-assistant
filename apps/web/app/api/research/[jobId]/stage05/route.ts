import { z } from 'zod';

import { collectResultPages } from '@/entities/research/api/stage05-pagination';
import { fetchWithTimeout } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

const jobIdSchema = z.string().min(1).max(64);

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

async function upstreamJson(
  url: string,
  signal: AbortSignal,
): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
  const response = await fetchWithTimeout(url, {
    signal,
    timeoutMs: 15_000,
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text.length === 0 ? null : JSON.parse(text);
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

/**
 * Same-origin Stage 05 aggregate:
 * latest run state + published run + retained/excluded result rows.
 *
 * The API has no CORS, so the browser cannot call it directly. This handler
 * forwards the upstream status and combines the two result decision lists for
 * the Contacts tab. It never invents a run or result.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;
  if (!jobIdSchema.safeParse(jobId).success) {
    return jsonError('Invalid research job id.', 400);
  }

  try {
    const latest = await upstreamJson(
      `${apiUrl}/research/${encodeURIComponent(jobId)}/lead-qualification`,
      request.signal,
    );
    if (latest.status === 404) {
      return jsonError('No Stage 05 result exists for this research.', 404);
    }
    if (!latest.ok) {
      return jsonError('Could not load the Stage 05 run.', latest.status);
    }

    const latestRun = latest.body as { id?: unknown; status?: unknown };
    if (
      typeof latestRun.id !== 'string' ||
      typeof latestRun.status !== 'string'
    ) {
      return jsonError('The Stage 05 run response is invalid.', 502);
    }

    if (latestRun.status !== 'COMPLETED') {
      return Response.json(
        { run: latest.body, results: [] },
        { status: 200, headers: { 'cache-control': 'no-store' } },
      );
    }

    const published = await upstreamJson(
      `${apiUrl}/research/${encodeURIComponent(jobId)}/lead-qualification/published`,
      request.signal,
    );
    if (published.status === 404) {
      return jsonError('No published Stage 05 result exists.', 404);
    }
    if (!published.ok) {
      return jsonError(
        'Could not load the published Stage 05 run.',
        published.status,
      );
    }

    const run = published.body as { id?: unknown };
    if (typeof run.id !== 'string') {
      return jsonError('The published Stage 05 run response is invalid.', 502);
    }

    const resultBase = `${apiUrl}/lead-qualification-runs/${encodeURIComponent(run.id)}/results`;
    const readDecision = (decision: 'ACCEPTED' | 'EXCLUDED') =>
      collectResultPages<{ id: string }>(async (cursor) => {
        const params = new URLSearchParams({
          decision,
          limit: '100',
        });
        if (cursor !== null) params.set('cursor', cursor);
        const response = await upstreamJson(
          `${resultBase}?${params.toString()}`,
          request.signal,
        );
        if (!response.ok) {
          throw new Error(`Could not load ${decision} results.`);
        }
        const body = response.body as {
          items?: unknown;
          nextCursor?: unknown;
        };
        if (
          !Array.isArray(body.items) ||
          (body.nextCursor !== null && typeof body.nextCursor !== 'string')
        ) {
          throw new Error('The Stage 05 result response is invalid.');
        }
        return {
          items: body.items as Array<{ id: string }>,
          nextCursor: body.nextCursor,
        };
      });

    const [accepted, excluded] = await Promise.all([
      readDecision('ACCEPTED'),
      readDecision('EXCLUDED'),
    ]);

    return Response.json(
      {
        run: published.body,
        results: [...accepted, ...excluded],
      },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return jsonError('Could not reach the research API.', 502);
  }
}
