import { z } from 'zod';

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

/**
 * Same-origin proxy for the browser poller.
 *
 * The API has no CORS, so client components read through this handler. It
 * validates the id, forwards the upstream status and body unchanged, and always
 * answers with JSON — including when the API is unreachable.
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
    const upstream = await fetchWithTimeout(
      `${apiUrl}/research/${encodeURIComponent(jobId)}`,
      { signal: request.signal, timeoutMs: 10_000 },
    );

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return jsonError('Could not reach the research API.', 502);
  }
}
