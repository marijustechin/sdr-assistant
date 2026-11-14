# Current task — 2026-11-14

**Task:** Runtime verification of the research flow (P0)
**Source:** [docs/plans/frontend-action-plan-2026-11-14.md](../docs/plans/frontend-action-plan-2026-11-14.md)
§2 Phase 2 → state matrix, §2a revised order
**Scope:** `apps/web` only. `apps/api/src/modules/research` is frozen (user's workstream).
**Status:** implementation, tests, formatting, navigation, toaster and theme are done and
pushed (`5916863` on `main`); `npm run verify:web` is green with 55 unit tests and
`npm run e2e` passes 10 Playwright scenarios in ~17 s. The production build completes (11
routes) and the pages were smoke-tested over HTTP against both the live API and a dead API.
What remains is a **human pass**: visual design, 360 px, keyboard-only, and one real (paid) run.

## What changed since the previous state

External review findings, all addressed except the ones that need a real environment:

1. **Product requests had no timeout and no validation** — fixed: `lib/products.ts` now owns
   the product schema and `fetchProducts`/`createProduct`/`updateProduct` go through
   `shared/api`. The product list, health page and both product actions were ported; there is
   no raw `fetch` left outside `shared/api/http.ts`.
2. **Completion depended on a second request** — fixed: `ResearchDetails` renders status,
   error and result from the polled object; `router.refresh()` was removed. A failed refresh
   can no longer turn a successful run into an error page.
3. **Duplicate runs** — verified: `POST /research` returns the existing `jobId` while a run for
   the same product + country is `QUEUED`/`RUNNING` (`research.service.ts:29-47`). Concurrent
   race still needs a DB constraint (backend, `ops/backlog.md`).
4. **Error normalisation** — fixed: every failure now carries a `reason`
   (`network` | `timeout` | `http` | `invalid-response`), a user-facing `message` and a
   technical `detail`; broken JSON is no longer reported as a network failure, and HTML or
   stack-trace bodies are never shown to a user.
5. **Missing product context** — fixed: the detail page shows the product name and links to the
   product; the product page lists its recent runs.
6. **Tests were missing** — fixed for the risky parts: 8 HTTP tests, 7 polling-hook tests,
   wired into `verify:web`.

## UI round (2026-11-14, done)

- `app/globals.css` rebuilt: light/dark tokens, `@layer base` + `@layer components`, modern
  buttons/cards/forms/status pills; utilities now correctly win over components.
- `widgets/app-shell`: sticky left sidebar with icons and active states, skip link, horizontal
  section tabs; responsive top bar below 1024 px (brand text hidden below 640 px).
- Home page is a small dashboard; product detail header simplified (Edit lives in the tabs).
- Theme switch (Light / Dark / System) in the sidebar: persisted, applied before first paint,
  follows the OS in System mode, syncs across tabs.
- Dates and times render in `Europe/Vilnius` as `2026-11-14` and `20:34` via
  `shared/lib/format.ts`.
- Global toaster (`shared/lib/toast` + `shared/ui/toaster`, mounted in the root layout):
  top-right, tinted per variant (info amber, success green, warning/error rose), actions,
  auto-dismiss with pause, Escape; wired to the research poller ("Retry") and to
  "copy result" ("Try again").
- Back-to-top button in `widgets/app-shell`, shown only on pages taller than the viewport.
- Tests: `widgets/app-shell/model/navigation.test.ts` (8), `theme.test.ts` (3),
  `theme.store.test.ts` (11, jsdom, including the pre-paint script), `scroll.test.ts` (4),
  `shared/lib/format.test.ts` (7), `shared/lib/toast.test.ts` (7), `shared/api/http.test.ts`
  (8) and `use-research-polling.test.ts` (7) — 55 unit tests.
- Playwright: `npm run e2e` (10 scenarios, ~17 s) with `e2e/mock-api.mjs` and a Next dev server
  on :3100 (`NEXT_DIST_DIR=.next-e2e`). Covers shell/nav, lists, product tabs, a run to
  completion, a failed run, a lost job + toast, 404, theme persistence, copy + toast and
  back-to-top. The real API is never called.

## Remaining — human pass

- [ ] `npm run verify:web` and `npm run e2e` green on your machine (both were here).
- [ ] `npm run build -w @sdr-assistant/web` — 11 routes.
- [ ] Visual review: spacing, contrast, light/dark, long names, empty states.
- [ ] 360 px and keyboard-only: focus order, skip link, toast Escape.
- [ ] One real run against the paid API when the research module is ready.
- [ ] Back/forward between two job URLs — not covered by E2E yet; verify by hand or add a test.

## Next after the human pass

- [ ] CI: `verify:web`, `e2e` and `build` on push.
- [ ] FSD moves and boundary lint (plan Phase 4).
- [ ] Country data decision with the backend owner.

## Decisions / notes

- Backend stays as is: no `orderBy`, no `INTERRUPTED`, no product include. The web sorts
  locally, joins `/products`, and tolerates an open `result` shape (plan §8).
- Product list and detail still fetch in route files until Phase 4; acceptable transitionally
  and recorded in `docs/system/frontend.md`.
- Unit tests must use the threads pool (`vitest.config.ts`); the default forks pool cannot start
  in a sandboxed environment.
- E2E uses a mock API and its own dev server (`NEXT_DIST_DIR=.next-e2e`), so it can run next to
  a normal `next dev`; never point it at the paid API.
- Playwright must reach the app on `localhost`, not `127.0.0.1` — Next dev blocks its dev
  resources by host name and hydration then fails silently.
