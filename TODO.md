# TODO — SDR Assistant

> **Historical record — not an active task list or authorization.** The instructions below
> are preserved history. Current work is assigned and tracked only through the
> authoritative [task registry](docs/tasks/README.md) and
> [harness](docs/system/harness.md).

Updated: 2026-11-17

> Update this file after every completed task or audit. Keep one active item in
> "Now"; move completed items to "Done" with a short evidence note. The detailed,
> ordered steps live in [docs/plans/frontend-action-plan-2026-11-14.md](docs/plans/frontend-action-plan-2026-11-14.md).

## Now

- [ ] **Settings — apply the migration and verify against Postgres** — start the database
      (`npm run db:up`) and run `npm run db:migrate`. The single `20261117190641_add_setting`
      migration is in the tree but was **not applied** during development (Postgres was down).
      Then exercise `GET/PATCH /settings` and the `/settings/research` form against the real API.
      See [ops/current.md](ops/current.md).

## Next

- [ ] **Settings follow-ups** (deliberately deferred; details in [ops/current.md](ops/current.md))
  - [ ] Wire `research.pageCollection.resultsPerQuery` into stage 02 when its live search is
        re-enabled. It is protected-area work and needs an explicit request.
  - [ ] Per-run snapshot of the settings a run used (schema decision: `researches` JSON column vs.
        `result.settings`); also needs research-module access.
  - [ ] Model-per-stage group (`research.models`).
  - [ ] More setting groups (triage, fetching, discovery) — one registry entry each.

- [ ] **Human pass over the UI** (parked while the research workstream runs) — everything
      behavioural is automated; what is left needs eyes and a real browser. `npm run build -w
      @sdr-assistant/web` is green (13 routes); pages were smoke-tested against a live and a dead
      API; `npm run e2e` passes 11 scenarios.
  - [ ] Visual review: spacing, contrast, light/dark, long names and empty states.
  - [ ] 360 px and keyboard-only pass (focus order, skip link, toast Escape).
  - [ ] One real run against the paid API.

- [ ] **Phase 4 — FSD-lite structure** — `features/{create-product,edit-product,start-research}`,
      `entities/product`, thin `app/**`, import-boundary lint.
- [ ] **CI** — run `verify:web`, `e2e` and `build` on push now that both pass locally.
- [ ] **Country data** — replace the hardcoded 7 countries in `lib/countries.ts`; needs a
      decision with the backend owner (code vs English name).
- [ ] **ADR-001 research pipeline** — draft only; the research workstream owns the content.
- [ ] **Research pipeline — next measurement round** — the flow runs end to end, with stages 01
      and the 02 search step fed from dumps. Next: re-enable the live 01 path and the 02
      search/merge (credits permitting), then measure the v9 price filter and the contact gap.
      Checklist and revert paths in the "Parked" section of [ops/current.md](ops/current.md).
- [ ] **Research follow-ups** (see [ops/current.md](ops/current.md))
  - [ ] Re-enable the live 01 path and the 02 search + merge; they are commented out while runs are
        fed from dumps.
  - [ ] Measure the v9 price filter end to end (prices must sit near the product name).
  - [ ] Contacts: 14 of 49 companies have no email; add the 02 page texts to `extractEmails`.
  - [ ] Company type: white-label storefronts of foreign platforms still get `b`.
  - [ ] `a` depends on which two evidence pages 03 picks; consider all product-matching pages.
- [ ] **API-side follow-ups** (protected area — needs an explicit request; plan §8)
  - [ ] `GET /research` has no `orderBy`/`take` (frontend sorts locally meanwhile).
  - [ ] `POST /research` read-then-create race needs a partial unique index on
        `(productId, country)` for active runs (ADR-001 §7).
  - [ ] `GET /research` returns only `productId` (frontend joins against `/products`).

## Protected area

- `apps/api/src/modules/research` code is **frozen** unless the user gives an
  explicit, specific request/permission. Documentation and non-research code
  may be changed as part of project maintenance.
- That area is being edited by the user right now: keep every tooling/format command
  scoped to `apps/web`, and do not run repo-wide formatters.

## Done

- [x] **Settings foundation — API + research settings page** (2026-11-17). Evidence: `verify:web`
      green (65 tests); API `tsc --noEmit` exit 0; API vitest 10/10; E2E 11/11; `next build`
      13 routes. The single `20261117190641_add_setting` migration is committed but **not applied**
      (Postgres was down), so `GET/PATCH /settings` were not exercised against Postgres.
  - [x] API: `SettingsModule` (controller, service, registry, mapper), `Setting` Prisma model,
        default → DB precedence, grouped `GET /settings` and transactional `PATCH /settings`
        with a 400 that names every failing key.
  - [x] First setting `research.pageCollection.resultsPerQuery` (integer, default 20, 1–50).
        Stage 02 is unchanged: its search step is commented out, and the registry carries a TODO
        for the wiring point (protected area).
  - [x] Web: "Settings" sidebar item, `/settings` and `/settings/research`, a form generated from
        the API metadata with client validation, server error, loading/empty/error/pending states
        and save toasts. Server action in `features/update-settings`.
  - [x] Tests: registry defaults/bounds/unknown key/bad type, entity schema, rendered form
        validation error, plus an E2E settings scenario with the mock API.
  - [x] How to add a setting in one place and what is deliberately deferred (per-run snapshot,
        model-per-stage, more groups) are recorded in [ops/current.md](ops/current.md).

- [x] **Research pipeline, stages 02–03** (2026-11-17). Evidence: `tsc --noEmit` and the API build
      exit 0; three full runs on the same 132-page input produced 52/49/49 companies with 4–5 `a`
      and 80–91 emails each.
  - [x] **03-company-discovery** rebuilt and wired: one profile per good domain, `a`/`b`/`none`/
        `unclear` verdict, contacts, prices, `04-companies-<stamp>.json`, `result: {companies}`.
        49 companies, 4 `a` with 91 prices, 0 errors in ~6 min.
  - [x] **02-page-collection** replaces the old stage: search + merge + content fetch + triage, six
        pages at a time; triage prompt **v17** (v15 plus one rule 1 sentence about third-party
        platform listings) kept over the semantic v16, which lost real sellers. The code-side rule 2
        re-check (`verifyTriage`) was removed: stage 02 collects, stage 03 decides.
  - [x] **Run robustness**: `llmChat` has a 90 s timeout; every stage update writes
        `lastHeartbeatAt`; runs with no progress for 5 minutes are marked `INTERRUPTED` at boot and
        before each `start()`, so a dead run no longer blocks a re-run.
  - [x] **Dead weight removed**: `foundBy`/`foundCount` on pages, `contentFetched` in the triage
        report, and the always-false `overridden` flag.
  - [x] **Fixture replay** for 01 and the 02 search step, with stable dump names (`02.1`, `02.2`,
        `02.3`, `04-companies`); `temp/` is git-ignored.
- [x] **Next.js security bump** (2026-11-17) — `next` 16.4.3 → **16.4.5** (the November 2026
      patch: CVE-2026-119348, CVE-2026-119350, CVE-2026-119790). `npm run verify:web` is green
      (55 tests); `next build` compiles and reaches the type-check step, which the DSH sandbox
      blocks with `spawn EPERM`.
- [x] **Playwright E2E automation** (2026-11-14) — `npm run e2e` starts `e2e/mock-api.mjs` and
      an isolated Next dev server (`NEXT_DIST_DIR=.next-e2e`, `API_URL` → mock) and runs
      10 scenarios in ~17 s. The paid API is never touched. `npm run verify:web` stays the fast
      gate (55 unit tests); the harness explains when to run E2E.
- [x] **Committed and pushed** (2026-11-14) — `5916863` "Add frontend foundation: data layer,
      research flow and app shell" on `main`. 87 files; `apps/api/src/modules/research` left
      untouched in the working tree (user's own edits).
- [x] **Navigation shell and visual restyle** (2026-11-14). Evidence: `npm run verify:web`
      green (55 tests); the compiled stylesheet keeps `@layer components` before
      `@layer utilities`; zero inline styles in `apps/web`.
  - [x] Light/dark token system, fully layered CSS, modernised buttons, cards, forms, status
        pills, lists and empty states.
  - [x] Global toaster: `toast.success/warning/error/info` API in `shared/lib/toast`,
        viewport in `shared/ui/toaster` mounted once in the root layout, top-right with a
        tinted background per variant (info amber, success green, warning/error rose);
        stack of four, auto-dismiss with pause on hover/focus, Escape to close, one optional
        action per toast, `role="alert"` for errors and warnings. Wired to the research
        poller (Retry action) and to "copy result".
  - [x] Back-to-top button, mounted globally: appears only when the page overflows
        (document > viewport + 200 px) and after 400 px of scrolling; rAF-throttled listener,
        smooth scroll skipped under reduced motion.
  - [x] Theme switch (Light / Dark / System) in the sidebar, persisted in `localStorage`,
        applied before first paint so a dark system never flashes white; follows the OS in
        System mode and syncs across tabs.
  - [x] Date and time formatting pinned to Lithuanian time: `2026-11-14` and `20:34` through
        `shared/lib/format.ts`; no `toLocaleString()` or ad-hoc `Intl` calls left.
  - [x] App shell: 256 px left sidebar with icons and active states, skip link; collapses to a
        horizontal top bar below 1024 px, icon-only brand below 640 px.
  - [x] Horizontal child navigation: Products (All products | New product) and a product
        (Overview | Edit), driven by a tested pure `getSectionNav(pathname)`.
  - [x] Home page rebuilt as a small dashboard; the product detail header no longer duplicates
        the Edit action (it lives in the tabs).
- [x] **External review — fixes and tests** (2026-11-14). Evidence: `npm run verify:web`
      exits 0 with 15 tests; the only `fetch(` call site is `shared/api/http.ts`.
  - [x] Product reliability: product schema + `fetchProducts`/`createProduct`/`updateProduct`
        in `lib/products.ts`; product list, health page and both product actions ported onto
        `shared/api` (timeouts + schema validation, no `as Product[]`).
  - [x] Completion no longer needs a second request: `ResearchDetails` renders status, error
        and result from the polled object; `router.refresh()` removed.
  - [x] Error model: `reason` (`network`/`timeout`/`http`/`invalid-response`), user `message`
        vs technical `detail`, HTML/long bodies never shown, broken JSON no longer reported as
        a network failure.
  - [x] Polling retry decides per reason: transport + 5xx retried with backoff, 4xx and
        malformed payloads stop immediately.
  - [x] Product context: detail page shows the product name + link to the product; product
        page lists recent runs.
  - [x] Duplicate-run protection verified against the API (ADR-001 §7); concurrent race
        recorded as a backend follow-up.
  - [x] Vitest + jsdom + testing-library installed; threads pool (the default forks pool
        cannot start in a sandbox); `test` added to `verify:web`; 8 HTTP + 7 polling tests.
- [x] **Research flow P0 + data layer (fast track)** — plan §2 Phase 1.1–1.3, 1.6–1.7 and
      Phase 2. `shared/api`, zod contracts, `server-only`, split client entry, hardened proxy,
      bounded polling, rendered result/error, list states, app boundaries.
- [x] **Phase 0 — harness and guardrails** (plan §2 Phase 0): tooling, harness docs, ADRs,
      format sweep, docs refresh, `next-env.d.ts` untracked. (0.9 CI deferred to backlog.)
- [x] **Frontend action plan** — [docs/plans/frontend-action-plan-2026-11-14.md](docs/plans/frontend-action-plan-2026-11-14.md).
- [x] **Frontend audit (read-only)** — [docs/audits/frontend-2026-11-14.md](docs/audits/frontend-2026-11-14.md).
- [x] Baseline research/web commit `072a5a8`.
- [x] Raw fixture directory excluded from Git.
- [x] Handover and this TODO created.
