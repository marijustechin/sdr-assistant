import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchResearch } from '@/entities/research';
import { ResearchWorkspace } from '@/features/track-research';
import { fetchProduct } from '@/lib/products';
import { shortenId } from '@/shared/lib/format';

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

      {/* key: navigating between jobs must reset the polling state. */}
      <ResearchWorkspace
        key={research.id}
        initialResearch={research}
        productName={productName}
      />
    </main>
  );
}
