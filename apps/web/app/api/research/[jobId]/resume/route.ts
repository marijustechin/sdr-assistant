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
 * Same-origin proxy for the resume action.
 *
 * The API has no CORS, so the browser posts through this handler. The upstream
 * body and status are forwarded unchanged; a busy job is returned as 409 and
 * the UI can show the API message.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;

  if (!jobIdSchema.safeParse(jobId).success) {
    return jsonError('Invalid research job id.', 400);
  }

  try {
    const upstream = await fetchWithTimeout(
      `${apiUrl}/research/${encodeURIComponent(jobId)}/resume`,
      {
        method: 'POST',
        signal: request.signal,
        timeoutMs: 10_000,
      },
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
