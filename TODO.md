# TODO — SDR Assistant

Updated: 2026-11-14

> Update this file after every completed task or audit. Keep one active item in
> "Now"; move completed items to "Done" with a short evidence note. The detailed,
> ordered steps live in [docs/plans/frontend-action-plan-2026-11-14.md](docs/plans/frontend-action-plan-2026-11-14.md).

## Now

- [ ] **Runtime verification of the research flow and the new UI** — implementation and tests
      are done (`npm run verify:web` green, 23 tests); the state matrix, the visual pass and
      the keyboard pass need the API, PostgreSQL and a browser outside the DSH sandbox.
      Checklist in [ops/current.md](ops/current.md).
  - [ ] `npm run dev` + `npm run build -w @sdr-assistant/web` (8 routes + the route handler).
  - [ ] queued → running → completed: result appears, polling and spinner stop.
  - [ ] failed: `error` visible, retry works, no requests afterwards.
  - [ ] job 404 → app not-found page; API down → inline error, bounded retries.
  - [ ] back/forward between two jobs; product page history + "Product page" link.
  - [ ] Navigation: sidebar active states, section tabs, mobile (<1024 px) top bar.
  - [ ] 360 px, keyboard-only, light and dark system themes.
  - [ ] Record the outcome here and in `ops/current.md`; fix what it uncovers.

## Next

- [ ] **Page-level tests** (plan Phase 5 remainder) — rendering test for
      `ResearchDetails`/`ResearchResultView`, integration test for the detail page with a
      mocked API. No new dependencies needed.
- [ ] **Phase 4 — FSD-lite structure** — `features/{create-product,edit-product,start-research}`,
      `entities/product`, thin `app/**`, import-boundary lint.
- [ ] **Country data** — replace the hardcoded 7 countries in `lib/countries.ts`; needs a
      decision with the backend owner (code vs English name).
- [ ] **ADR-001 research pipeline** — draft only; the research workstream owns the content.
- [ ] **02-company-discovery validation**
  - [ ] Run against the `abachi-lt` fixture.
  - [ ] Review company extraction, domain vs company identity, marketplace sellers,
        deduplication, and evidence.
  - [ ] Add one bounded extra search round only after the first pass is clean.
- [ ] **API-side follow-ups** (protected area — needs an explicit request; plan §8)
  - [ ] `GET /research` has no `orderBy`/`take` (frontend sorts locally meanwhile).
  - [ ] `INTERRUPTED` and `lastHeartbeatAt` are never written; a crashed run stays `RUNNING`
        (the web shows a stale hint from `updatedAt` meanwhile).
  - [ ] `GET /research` returns only `productId` (frontend joins against `/products`).
  - [ ] Partial unique index on `(productId, country)` for active runs, to close the
        read-then-create race in `POST /research` (ADR-001 §7).

## Protected area

- `apps/api/src/modules/research` code is **frozen** unless the user gives an
  explicit, specific request/permission. Documentation and non-research code
  may be changed as part of project maintenance.
- That area is being edited by the user right now: keep every tooling/format command
  scoped to `apps/web`, and do not run repo-wide formatters.

## Done

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
