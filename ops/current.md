# Current task — 2026-11-14

**Task:** Runtime verification of the research flow (P0)
**Source:** [docs/plans/frontend-action-plan-2026-11-14.md](../docs/plans/frontend-action-plan-2026-11-14.md)
§2 Phase 2 → state matrix, §2a revised order
**Scope:** `apps/web` only. `apps/api/src/modules/research` is frozen (user's workstream).
**Status:** implementation, tests, formatting, navigation, toaster and theme are done and
pushed (`5916863` on `main`); `npm run verify:web` is green with 55 tests. The production build
completes (11 routes) and the pages were smoke-tested over HTTP against both the live API and a
dead API — list, detail, health, 404 and the error cards all render, and the proxy answers
`502 {"error":"Could not reach the research API."}`. What remains is the **interactive** matrix
in a real browser: polling transitions, toasts, theme switch, keyboard.

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
  `shared/lib/format.test.ts` (7) and `shared/lib/toast.test.ts` (7) pin the behavioural rules.

## Remaining — interactive browser pass

- [ ] `npm run dev` with the API and PostgreSQL up.
- [ ] `npm run build -w @sdr-assistant/web` — 8 routes + the route handler.
- [ ] State matrix (plan §2 Phase 2, exit criteria):
  - [ ] queued → running → completed: result appears, polling and spinner stop.
  - [ ] failed: `error` text visible, retry works, no requests afterwards.
  - [ ] job 404 → app not-found page (no retry loop).
  - [ ] API down → inline error, bounded retries, manual retry.
  - [ ] back/forward between two job URLs → correct data, no stale flash.
  - [ ] product page: history list, "Product page" link, 360 px, keyboard-only.
  - [ ] navigation: sidebar active states on every route, Products and product section tabs,
        mobile top bar below 1024 px, skip link, focus ring.
  - [ ] visual: light and dark system themes, long product names, empty states.
  - [ ] toaster: top-right placement; copy a completed result (green "Result copied"), stop
        the API mid-run and wait for the polling cap (rose "Research updates stopped" +
        Retry), hover a toast (timer pauses), Escape closes, four-toast cap.
  - [ ] back-to-top: hidden on a short page, appears after scrolling a long one, smooth scroll,
        no button when the content fits.
- [ ] Fix whatever the matrix uncovers; record the result here and in `TODO.md`.

## Next after the matrix

- [ ] Rendering test for `ResearchDetails`/`ResearchResultView` and an integration test for the
      detail page with a mocked API (plan Phase 5 remainder).
- [ ] Styling: `@layer components`, `shared/ui` primitives (plan Phase 3).
- [ ] FSD moves and boundary lint (plan Phase 4).

## Decisions / notes

- Backend stays as is: no `orderBy`, no `INTERRUPTED`, no product include. The web sorts
  locally, joins `/products`, and tolerates an open `result` shape (plan §8).
- Product list and detail still fetch in route files until Phase 4; acceptable transitionally
  and recorded in `docs/system/frontend.md`.
- Tests must use the threads pool (`vitest.config.ts`); the default forks pool cannot start in
  a sandboxed environment.
