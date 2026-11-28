import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchEmailAccounts } from '@/entities/email-account';
import {
  fetchResearch,
  fetchResearchAttachments,
  fetchResearchCommunication,
  prepareResearchRecipientQueue,
} from '@/entities/research';
import {
  ResearchWorkspace,
  type RecipientQueueData,
  type ResearchAttachmentsData,
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

  // Communication settings, the account list, the attachments and the recipient
  // queue fail independently: an unavailable section renders inside its own
  // panel and leaves the rest of the research intact.
  const [
    communicationResult,
    emailAccountsResult,
    attachmentsResult,
    queueResult,
  ] = await Promise.all([
    fetchResearchCommunication(research.id),
    fetchEmailAccounts(),
    fetchResearchAttachments(research.id),
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

  const attachments: ResearchAttachmentsData = attachmentsResult.ok
    ? {
        state: 'ready',
        limits: attachmentsResult.data.limits,
        attachments: attachmentsResult.data.items,
      }
    : { state: 'error', message: attachmentsResult.message };

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
        attachments={attachments}
        recipientQueue={recipientQueue}
      />
    </main>
  );
}
