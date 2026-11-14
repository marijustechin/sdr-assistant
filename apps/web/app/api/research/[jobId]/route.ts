import { apiUrl } from '@/lib/api';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const response = await fetch(
    `${apiUrl}/research/${encodeURIComponent(jobId)}`,
    { cache: 'no-store' },
  );

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
