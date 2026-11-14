import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 3100;
const API_PORT = 4100;
// `localhost`, not 127.0.0.1: the Next dev server blocks dev resources for a
// different host name, which silently prevents hydration in the browser.
const baseURL = `http://localhost:${WEB_PORT}`;

/**
 * End-to-end suite.
 *
 * Two servers start automatically:
 * - `e2e/mock-api.mjs` on 4100 — deterministic API, never the paid one;
 * - Next on 3100 with `API_URL` pointing at the mock and its own `distDir`, so
 *   the suite runs alongside a normal `next dev` on 3000.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/mock-api.mjs',
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { MOCK_API_PORT: String(API_PORT) },
    },
    {
      command: `node ../../node_modules/next/dist/bin/next dev --port ${WEB_PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        API_URL: `http://127.0.0.1:${API_PORT}`,
        NEXT_DIST_DIR: '.next-e2e',
      },
    },
  ],
});
