import Link from 'next/link'

export default function HomePage() {
  return (
    <main>
      <h1>SDR Assistant</h1>
      <p className="muted">Web app is running.</p>
      <p>
        <Link href="/health">View backend health →</Link>
      </p>
    </main>
  )
}
