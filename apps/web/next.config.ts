import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // E2E runs get their own output directory so they can run next to `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  experimental: {
    serverActions: {
      // Attachment uploads travel through a Server Action. This framework cap
      // must sit above the API's configurable attachment ceiling (50 MiB) so the
      // API remains the authoritative limit; a smaller cap here would silently
      // reject a file the API would accept.
      bodySizeLimit: '52mb',
    },
  },
};

export default nextConfig;
