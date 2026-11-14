import { fetchResearches } from '@/entities/research';
import Link from 'next/link';

export async function ResearchesPage() {
  const researches = await fetchResearches();

  return (
    <main>
      <h1>Researches</h1>
      {researches.map((research) => (
        <div className='flex' key={research.id}>
          <Link href={`/researches/${research.id}`}>{research.id}</Link>
          <p>Status: {research.status}</p>
        </div>
      ))}
    </main>
  );
}
