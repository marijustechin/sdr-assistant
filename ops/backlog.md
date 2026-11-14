# Backlog — SDR Assistant

Not scheduled. Ordered roughly by value. The plan is in
[docs/plans/frontend-action-plan-2026-11-14.md](../docs/plans/frontend-action-plan-2026-11-14.md).

## Frontend

- [ ] **Phase 1.4–1.5 — `entities/product`** — remove the duplicate `Product` type and the
      inline fetch in `app/products/page.tsx`; port both actions onto the shared schema.
      Deferred by the fast track only.
- [ ] **Phase 3 — styling system** — `@layer components` for the legacy CSS, `shared/ui`
      primitives, page-by-page migration, remove the 6 inline styles, a11y pass.
      Needs a design review of the two new research pages.
- [ ] **Phase 4 — structure** — `features/{create-product,edit-product,start-research}`,
      thin `app/**`, `_pages` slice renames, import-boundary lint
      (`eslint-plugin-boundaries`), optional `noUncheckedIndexedAccess`.
- [ ] **Phase 5 — tests and CI** — vitest + jsdom + testing-library + MSW; hook, schema and
      `shared/api` tests; one integration test for the research page; optional Playwright
      smoke; GitHub Actions running `verify:web` + `build`.
- [ ] **0.9 — CI workflow** — optional, unverified in this sandbox.
- [ ] **Country data** — replace the hardcoded 7 countries in `lib/countries.ts` with a real
      dataset (`i18n-iso-countries` is already an API dependency). Requires agreeing with the
      backend owner whether the API should receive a code or an English name.
- [ ] **Observability** — `instrumentation.ts` + structured logging for server-side fetch
      failures once the data layer exists.

## Decisions to revisit

- [ ] **`cacheComponents: true` (Next 16 PPR)** — would replace `force-dynamic` and require
      Suspense boundaries around uncached data. Revisit after Phase 3, as its own ADR.
- [ ] **Shared API contract** (`packages/contracts` or OpenAPI + codegen) — needs the API
      DTOs to import it, which is out of the frontend scope today. Revisit with the backend
      owner; until then the web keeps zod schemas + a payload fixture test.
- [ ] **TanStack Query / SWR** — only if the number of client-side query surfaces grows past
      ~3; the hand-rolled polling hook is enough for one.
- [ ] **`shadcn/ui`** — revisit when `shared/ui` exceeds ~10 primitives.
- [ ] **Move layers under `src/`** — churn without benefit; FSD does not require it.

## Backend (owned by the user — not this workstream)

- [ ] `GET /research` ordering + pagination.
- [ ] `INTERRUPTED` status + `lastHeartbeatAt` heartbeat, so crashed runs are observable.
- [ ] `GET /research` product include/select, to drop the frontend join.
- [ ] Stable `result` schema for stage 02, then a typed result renderer in the web app.

## Docs

- [ ] `ADR-001-research-pipeline` is a draft; the research workstream owns its content.
- [ ] Update `HANDOVER.md` once the research stages change.
