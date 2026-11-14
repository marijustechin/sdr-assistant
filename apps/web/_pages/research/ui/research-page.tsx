import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchResearch } from '@/entities/research';
import { ResearchDetails } from '@/features/track-research';
import { fetchProduct } from '@/lib/products';
import { formatDateTime, shortenId } from '@/shared/lib/format';

type ResearchPageProps = {
  readonly jobId: string;
};

export async function ResearchPage({ jobId }: ResearchPageProps) {
  const result = await fetchResearch(jobId);

  if (!result.ok) {
    if (result.status === 404) {
      notFound();
    }

    return (
      <main>
        <p className="breadcrumb">
          <Link href="/researches">← Researches</Link>
        </p>
        <div className="status error">
          <span className="dot" aria-hidden="true" />
          Could not load the research
        </div>
        <pre>{result.message}</pre>
      </main>
    );
  }

  const research = result.data;
  const productResult = await fetchProduct(research.productId);
  const productName = productResult.ok
    ? productResult.product.name
    : shortenId(research.productId);

  return (
    <main>
      <p className="breadcrumb">
        <Link href="/researches">← Researches</Link>
      </p>

      <div className="page-header">
        <div>
          <h1>{productName}</h1>
          <p className="muted">
            {research.country} · started {formatDateTime(research.createdAt)} ·
            job {shortenId(research.id)}
          </p>
        </div>
        <Link
          href={`/products/${research.productId}`}
          className="button secondary"
        >
          Product page
        </Link>
      </div>

      {/* key: navigating between jobs must reset the polling state. */}
      <ResearchDetails key={research.id} initialResearch={research} />
    </main>
  );
}
