import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchEmailAccounts } from '@/entities/email-account';
import { fetchResearch, fetchResearchCommunication } from '@/entities/research';
import {
  ResearchWorkspace,
  type ResearchCommunicationSettingsData,
} from '@/features/track-research';
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

  // Communication settings fail independently: an unavailable assignment or
  // account list renders inside the Settings tab and leaves the rest intact.
  const [communicationResult, emailAccountsResult] = await Promise.all([
    fetchResearchCommunication(research.id),
    fetchEmailAccounts(),
  ]);
  const communicationError = communicationResult.ok
    ? emailAccountsResult.ok
      ? null
      : emailAccountsResult.message
    : communicationResult.message;
  const communication: ResearchCommunicationSettingsData =
    communicationResult.ok && emailAccountsResult.ok
      ? {
          state: 'ready',
          emailAccountId: communicationResult.data.emailAccountId,
          accounts: emailAccountsResult.data,
        }
      : {
          state: 'error',
          message:
            communicationError ?? 'The communication settings are unavailable.',
        };

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
        communication={communication}
      />
    </main>
  );
}
