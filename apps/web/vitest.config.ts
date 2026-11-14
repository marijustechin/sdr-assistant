import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Tests run on Node by default. Files that need the DOM opt in with a
 * `// @vitest-environment jsdom` docblock.
 *
 * `pool: 'threads'` keeps the runner inside worker threads instead of forking
 * child processes, which is the only pool that starts in a file-sandboxed
 * environment (forking fails with `spawn EPERM`).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    pool: 'threads',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
});
