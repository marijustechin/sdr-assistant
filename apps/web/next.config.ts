import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // E2E runs get their own output directory so they can run next to `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
