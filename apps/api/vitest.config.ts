import { defineConfig } from 'vitest/config'

/**
 * API tests stay outside `src/` so `tsc -p tsconfig.json` does not emit them.
 * `threads` is the only pool that also starts under the DSH file sandbox.
 */
export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    include: ['test/**/*.test.ts'],
  },
})
