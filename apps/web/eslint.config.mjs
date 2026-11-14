import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * ESLint is scoped to `apps/web`. It is never run from the repo root: `apps/api`
 * (and especially `apps/api/src/modules/research`) belongs to another workstream.
 *
 * Architecture rules (import direction, layer boundaries) are added here in
 * Phase 4 — see docs/system/frontend.md and docs/plans/frontend-action-plan-2026-11-14.md.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Keep the audit's warnings visible as errors where they are cheap to fix.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    '.next-e2e/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

export default eslintConfig;
