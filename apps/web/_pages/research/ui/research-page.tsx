import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchEmailAccounts } from '@/entities/email-account';
import {
  fetchResearch,
  fetchResearchCommunication,
  prepareResearchRecipientQueue,
} from '@/entities/research';
import {
  ResearchWorkspace,
  type RecipientQueueData,
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

  // Communication settings, the account list and the recipient queue fail
  // independently: an unavailable assignment or queue renders inside its own
  // tab and leaves the rest of the research intact.
  const [communicationResult, emailAccountsResult, queueResult] =
    await Promise.all([
      fetchResearchCommunication(research.id),
      fetchEmailAccounts(),
      prepareResearchRecipientQueue(research.id),
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
          initialEmail: communicationResult.data.initialEmail,
          accounts: emailAccountsResult.data,
        }
      : {
          state: 'error',
          message:
            communicationError ?? 'The communication settings are unavailable.',
        };

  // The server ensures preparation (idempotent) and returns the first queue
  // page, so the Communication tab opens with data and never writes on read.
  const recipientQueue: RecipientQueueData = queueResult.ok
    ? { state: 'ready', queue: queueResult.data }
    : { state: 'error', message: queueResult.message };

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
        recipientQueue={recipientQueue}
      />
    </main>
  );
}
