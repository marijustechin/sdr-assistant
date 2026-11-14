import { fetchResearch } from '@/entities/research';
import { ResearchProgres } from './research-progress';

type ResearchPageProps = {
  readonly jobId: string;
};

export async function ResearchPage({ jobId }: ResearchPageProps) {
  const research = await fetchResearch(jobId);

  return (
    <main>
      <h1>Research single</h1>
      <p>ID: {research.id}</p>
      <p>Country: {research.country}</p>
      <p>Status: {research.status}</p>
      <p>Stage: {research.stage}</p>
      <ResearchProgres initialResearch={research} />
    </main>
  );
}
