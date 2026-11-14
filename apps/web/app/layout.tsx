import type { Metadata } from 'next';

import { Toaster } from '@/shared/ui';
import {
  SectionNav,
  Sidebar,
  THEME_INIT_SCRIPT,
  ToTopButton,
} from '@/widgets/app-shell';

import './globals.css';

export const metadata: Metadata = {
  title: 'SDR Assistant',
  description: 'SDR Assistant web app',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Applies the stored theme before first paint: no light flash on a dark system. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />

        <a className="skip-link" href="#content">
          Skip to content
        </a>

        <div className="app-shell">
          <Sidebar />

          <div className="app-body">
            <SectionNav />
            <div className="app-content" id="content" tabIndex={-1}>
              {children}
            </div>
          </div>
        </div>

        <Toaster />
        <ToTopButton />
      </body>
    </html>
  );
}
