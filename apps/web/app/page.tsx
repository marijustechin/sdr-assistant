import Link from 'next/link'

const links = [
  { href: '/products', label: 'Products', description: 'Browse the catalog' },
  { href: '/products/new', label: 'New product', description: 'Add a product' },
  { href: '/health', label: 'Backend health', description: 'Check the API status' },
]

export default function HomePage() {
  return (
    <main>
      <h1>SDR Assistant</h1>
      <p className="muted">Web app is running.</p>

      <ul className="link-list" style={{ marginTop: '2rem' }}>
        {links.map((link) => (
          <li key={link.href} className="link-item">
            <div>
              <h2>
                <Link href={link.href}>{link.label}</Link>
              </h2>
              <p className="muted">{link.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
