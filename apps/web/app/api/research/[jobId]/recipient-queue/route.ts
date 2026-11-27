import { z } from 'zod';

import { fetchWithTimeout } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

const jobIdSchema = z.string().min(1).max(64);
const searchSchema = z.string().max(200);
const positiveIntegerSchema = z.string().regex(/^[1-9][0-9]*$/);

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
 * Same-origin recipient-queue page for the Communication tab.
 *
 * The API has no CORS, so the browser cannot call it directly. This read-only
 * handler forwards the validated search/pagination query and returns the
 * upstream payload unchanged; the browser parses it with the shared zod schema.
 * It never prepares, mutates or invents queue data.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;
  if (!jobIdSchema.safeParse(jobId).success) {
    return jsonError('Invalid research job id.', 400);
  }

  const incoming = new URL(request.url).searchParams;
  const q = incoming.get('q') ?? '';
  const page = incoming.get('page') ?? '1';
  const pageSize = incoming.get('pageSize') ?? '25';

  if (
    !searchSchema.safeParse(q).success ||
    !positiveIntegerSchema.safeParse(page).success ||
    !positiveIntegerSchema.safeParse(pageSize).success
  ) {
    return jsonError('Invalid recipient queue query.', 400);
  }

  const upstream = new URLSearchParams({ page, pageSize });
  if (q !== '') upstream.set('q', q);

  try {
    const response = await fetchWithTimeout(
      `${apiUrl}/research/${encodeURIComponent(jobId)}/communication/recipient-queue?${upstream.toString()}`,
      { signal: request.signal, timeoutMs: 15_000 },
    );
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return jsonError('Could not reach the research API.', 502);
  }
}
