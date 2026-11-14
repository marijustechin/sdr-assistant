import Link from 'next/link';

const QUICK_LINKS = [
  {
    href: '/products',
    title: 'Products',
    description: 'Browse the catalogue and start a research run for a market.',
    cta: 'Open products',
  },
  {
    href: '/researches',
    title: 'Researches',
    description: 'Follow running jobs and read completed results.',
    cta: 'Open researches',
  },
  {
    href: '/health',
    title: 'API health',
    description: 'Check the NestJS API, its status and response time.',
    cta: 'Check health',
  },
] as const;

export default function HomePage() {
  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Research workspace</h1>
          <p className="muted">One product, one market, one run at a time.</p>
        </div>
        <Link href="/products" className="button">
          Start a research
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <section key={link.href} className="card mt-0">
            <h2>{link.title}</h2>
            <p className="muted">{link.description}</p>
            <p>
              <Link href={link.href}>{link.cta} →</Link>
            </p>
          </section>
        ))}
      </div>

      <section className="card">
        <h2>How a run works</h2>
        <ol>
          <li>
            Pick a product and a country — that is the whole scope of one run.
          </li>
          <li>
            Stage 01 identifies the product and collects candidate pages; stage
            02 discovers companies.
          </li>
          <li>
            The run continues in the background. Follow it on the research page;
            the result appears there when the run finishes.
          </li>
        </ol>
      </section>
    </main>
  );
}
