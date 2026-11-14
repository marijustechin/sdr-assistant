# Frontend action plan — 2026-11-14

**Scope:** `apps/web` only. No changes under `apps/api/src/modules/research` — that
workstream is owned by the user.
**Input:** [docs/audits/frontend-2026-11-14.md](../audits/frontend-2026-11-14.md) (read-only
audit, findings referenced as §2.1 … §2.17).
**Goal:** bring the frontend to a state where the research flow is usable, the code has an
enforceable structure, and every phase is verifiable in one command.

Current size: 29 files / 1466 lines. Every phase below is cheap now and expensive later —
that is the main reason to sequence strictly.

---

## 0. How to read this plan

- **The order was revised on 2026-11-14 after an external review:** verification and tests
  come before structure. Styling and FSD moves are now *after* the runtime matrix and the
  regression tests — see §2a.
- **Phases are ordered; do not reorder again without recording the reason here.**
- **One step = one commit.** Each step lists its own acceptance check.
- **No behaviour change** in Phase 0–1 unless the step says so. Behaviour changes start in
  Phase 2.
- Size estimates are rough (`S` ≈ ≤2 h, `M` ≈ half a day, `L` ≈ 1 day).

---

## 2a. Revised order after the external review (2026-11-14)

The review's conclusion: the foundation is sound, and the biggest gap is that the end-to-end
research flow has never been exercised — not the architecture. Fewer structural moves, earlier
real scenarios.

1. **Exercise the flow** (QUEUED → RUNNING → COMPLETED, failure, API loss, back/forward) in a
   real environment. Checklist in `ops/current.md`. This is the only step that cannot be done
   in the agent sandbox.
2. **Cover the behaviour with tests before moving files**: HTTP failure classification and the
   polling hook are done; the missing pieces are a rendering test for the result view and an
   integration test for the detail page.
3. **Fix product reliability before structure**: timeouts and schema validation on every
   product request — done, there is no raw `fetch` left outside `shared/api`.
4. **Confirm duplicate-run protection**: `POST /research` returns the existing job while a run
   for the same product + country is `QUEUED`/`RUNNING`; a concurrent race still needs a DB
   constraint, which belongs to the backend workstream (ADR-001 §4, `ops/backlog.md`).
5. **Only then** styling (`@layer components`, `shared/ui`) and the product/research navigation
   polish.

---

## 1. What "best practice" means for this app

Concrete, checkable rules — not slogans. Each is enforced by a step below.

| Practice | Rule in this repo | Enforced by |
| --- | --- | --- |
| Server-first rendering | `app/**` pages are RSC; `'use client'` only for interaction (forms, poller) | Phase 4 lint boundary + review |
| Thin routes | `app/**` contains metadata, `params`, one view component; no `fetch`, no validation, no JSX trees | Phase 4.2 |
| One data path | All HTTP goes through `shared/api`; no `fetch(` in pages/entities/features | Phase 1.1, grep in DoD |
| Schema-first types | Every wire payload is a zod schema; TS types are `z.infer`; no `as` on `response.json()` | Phase 1.3–1.5 |
| Explicit failures | Data functions return a `Result` union; UI maps it to a rendered state; nothing throws into the render tree | Phase 1.1–1.2 |
| Mutations | Server Actions only; they live next to the form in `features/*`, validate input, then `redirect`/`revalidatePath` | Phase 4.1 |
| Client reads | Client components read same-origin `/api/*` route handlers (API has no CORS) | Phase 1.6 |
| Auth of state | Every async UI has `loading`, `empty`, `error`, and success/terminal states | Phase 2 |
| Polling | Bounded, backoff, abortable, terminal-aware, announces changes to AT | Phase 2.1–2.2 |
| Styling | One system: Tailwind utilities + `@layer components` for shared pieces; no inline `style` | Phase 3 |
| Accessibility | Semantic HTML, labelled fields, `aria-live` for async status, visible focus, 360 px min | Phase 2.8, 3.5 |
| Tests | Logic unit-tested, one integration test per critical page, one E2E smoke | Phase 5 |
| Gates | `typecheck` + `lint` + `format:check` + `test` in one command, before every commit | Phase 0.6 |

Deliberately **not** adopted (see §7): Cache Components, TanStack Query/SWR, shadcn/ui,
`src/` move, shared contracts package.

---

## 2. Phases

### Phase 0 — Harness and guardrails (0.5–1 d)

**Status: done (2026-11-14).** Steps 0.1–0.8 landed; `npm run verify:web` exits 0. Step 0.9
(CI) is deferred to `ops/backlog.md`. Evidence in `TODO.md` → Done.

Purpose: make everything after it verifiable, and give future agent sessions a single place
to learn how this repo runs. No product behaviour changes.

| # | Step | Files | Size | Acceptance |
| --- | --- | --- | --- | --- |
| 0.1 | Minimal harness: operating manual (commands, verification ladder, sandbox caveats, fixtures, protected area, stop rules, definition of done) | `docs/system/harness.md` | S | Every command marked "verified" was actually run; the rest are labelled unverified |
| 0.2 | Frontend architecture + conventions (layers, import direction, server/client rules, contracts, styling, a11y) | `docs/system/frontend.md` | M | Matches Phase 1–4; no rule without an enforcement mechanism |
| 0.3 | ADR: Lite FSD decision, target tree, rejected alternatives (Next-native colocation, full FSD, `src/`) | `docs/decisions/ADR-002-frontend-lite-fsd.md` | S | States consequences, not just the choice |
| 0.4 | ADR: research pipeline 01 → 02, Exa + DeepSeek, fixtures, no per-page taxonomy | `docs/decisions/ADR-001-research-pipeline.md` | S | **Draft only** — content owned by the research workstream; link it from HANDOVER |
| 0.5 | Ops memory: one active task + backlog | `ops/current.md`, `ops/backlog.md` | S | `current.md` mirrors `TODO.md` "Now" and links Phase 2 steps |
| 0.6 | Tooling: `eslint`, `eslint-config-next`, `prettier` as **`apps/web` devDependencies**; `apps/web/eslint.config.mjs`; `.prettierrc`; scripts `typecheck` (`next typegen && tsc --noEmit`), `lint`, `format`, `format:check`; root `verify:web` = `typecheck && lint && format:check` (`test` joins it in Phase 5) | `apps/web/package.json`, `apps/web/eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `package.json` | M | All four scripts execute; `verify:web` goes green after 0.7 |
| 0.7 | One-shot format + lint sweep (**scoped to `apps/web` only**) | all `apps/web/**/*.{ts,tsx,css}` | S | Diff is mechanical only; `apps/api` untouched (`git status`) |
| 0.8 | Refresh `AGENTS.md` (add Frontend section + commands; keep research text, mark legacy block) and `README.md` (web tree, endpoints, async research, verification) | `AGENTS.md`, `README.md` | M | No statement contradicts the code; links to harness/ADR/audit |
| 0.9 | *(optional)* CI: `npm ci`, `npm run verify:web`, `npm run build --workspace @sdr-assistant/web` | `.github/workflows/ci.yml` | S | Green on push; build runs outside the DSH sandbox |

**Hard constraints for 0.6–0.7**

- Prettier/ESLint run **only on `apps/web`**. `.prettierignore` must also list `apps/api`,
  `.next`, `dist`, `node_modules`, `*.tsbuildinfo`, `next-env.d.ts`. The user is actively
  editing the research module; a repo-wide format would collide with that work.
- `eslint.config.mjs` (Next 16 flat config, per `next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`):

  ```js
  import { defineConfig, globalIgnores } from 'eslint/config'
  import nextVitals from 'eslint-config-next/core-web-vitals'

  export default defineConfig([
    ...nextVitals,
    globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  ])
  ```

- `typecheck` must run `next typegen` first. Without it, `tsc` silently skips route
  validation (`.next/types` absent, `skipLibCheck: true` hides the missing import).
- Add `apps/web/next-env.d.ts` to `.gitignore` and `git rm --cached` it: it is regenerated
  by `next typegen`/`dev`/`build` and currently imports `.next/types/*`, which churns the
  diff on every build.

**Exit criteria:** `npm run verify:web` green, harness docs exist, `apps/api` untouched.

---

### Phase 1 — Contracts and data layer (1–1.5 d)

**Status: all steps done (2026-11-14).** 1.4–1.5 landed as a reliability fix, not as a move:
`lib/products.ts` owns the product schema and `createProduct`/`updateProduct`/
`fetchProducts`, so no raw `fetch` is left. The `entities/product` relocation waits for
Phase 4. `npm run verify:web` exits 0.

Purpose: remove the three parallel fetch styles (§2.6, §2.9) and make the wire contract
typed. **No visual change.**

| # | Step | Files | Size | Acceptance |
| --- | --- | --- | --- | --- |
| 1.1 | `shared/api`: `Result<T>`, `getJson`, `postJson` — base URL, `no-store`, `AbortSignal.timeout`, never throws, maps timeout/network to `{ok:false,status:0}` | `shared/api/http.ts`, `shared/config/env.ts` | M | Unit-testable pure functions; no `throw` on the happy path |
| 1.2 | Error normalisation: Nest `{statusCode,message,error}` → human message (`string \| string[]`) | `shared/api/errors.ts` | S | Both shapes covered by a test |
| 1.3 | `entities/research/model/schema.ts`: `researchResponseSchema`, keep `startResearchResponseSchema`; `result` = `z.unknown()` with a code comment saying stage 02 is in flux | `entities/research/model/{schema,types}.ts` | S | `ResearchResponse = z.infer<…>`; no hand-written mirror |
| 1.4 | `entities/product`: new slice from `lib/products.ts`; delete the duplicate `Product` type and inline fetch in `app/products/page.tsx` | `entities/product/**`, `app/products/page.tsx` | M | One `Product` type; one list fetch |
| 1.5 | Port `entities/research/api/*` and product API onto `shared/api` + schemas; return `Result` | `entities/research/api/*.ts` | M | No `response.json()` cast left |
| 1.6 | Harden the proxy: param validation, `try/catch`, 10 s timeout, pass through `content-type`, JSON error body | `app/api/research/[jobId]/route.ts` | S | Upstream down → JSON 502, not HTML 500 |
| 1.7 | Delete dead code: `'success'` branch + `jobId` in `ResearchFormState` (§2.5), `ResearchProgres` barrel export, unused entity exports | `research-form.tsx`, `app/products/[id]/actions.ts`, `_pages/research/index.ts`, `entities/research/index.ts` | S | No unreachable branches; grep proves no consumers |

**Exit criteria:** `grep -r "fetch(" apps/web` returns only `shared/api/**` and the route
handler; `npm run verify:web` green; the app behaves exactly as before.

---

### Phase 2 — Research flow P0 (1.5–2 d)

**Status: implemented and unit-tested (2026-11-14).** All steps 2.1–2.8 are in the code,
15 tests cover the HTTP failure model and every polling transition, and `npm run verify:web`
exits 0. Two review findings were folded in: the result is now rendered from the polled
object (no `router.refresh()`, no second request) and retry is decided per failure reason.
**The manual state matrix below is still unverified** — the build and the server-rendered
pages were verified on 2026-11-14 (11 routes; list, detail, health and 404 against the live API;
error cards and a `502 {"error":…}` proxy response against a dead API), but the interactive
parts need a real browser. Tracked in `TODO.md` "Now".

Purpose: make the feature actually work for a user (§2.1, §2.2, §2.3, §2.7, §2.8).

| # | Step | Files | Size | Acceptance |
| --- | --- | --- | --- | --- |
| 2.1 | `use-research-polling` hook: explicit states, terminal detection, exponential backoff (2/3/5/8 s, cap 10 s), max ~15 attempts for transient errors, stop on 4xx, abort on unmount, reset on `jobId` change, single `router.refresh()` on terminal | `features/track-research/model/use-research-polling.ts` | L | Unit tests in the same commit (happy path, 404, 5xx retry cap, abort) |
| 2.2 | Status card: badge, stage, elapsed time, error message, retry button, `aria-live="polite"`, reduced-motion spinner | `features/track-research/ui/research-status-card.tsx` | M | Screen reader announces transitions; no frozen glyph after terminal |
| 2.3 | Result view: unknown-tolerant renderer (`string` → text block, object → `<details><pre>`, `null` → "No result") + explicit note that a typed renderer waits for the stage-02 schema | `features/track-research/ui/research-result-view.tsx` | S | Renders all three shapes without crashing |
| 2.4 | Research detail view: server shell + client poller, **one** status source (delete the duplicate lines in `research-page.tsx:14-17`) | `_pages/research/**` | M | After completion the whole page is consistent (no stale `RUNNING`) |
| 2.5 | Research list: empty state, error state, sort `createdAt` desc (API ordering is the user's §8.1 item), product-name join via `fetchProducts`, country/status/date, links | `_pages/researches/**` | M | Empty DB → helpful empty card; API down → inline error card, not Next's error page |
| 2.6 | Navigation: `/researches` link from home and product page, breadcrumbs on both research pages (the list is unreachable today, §1.5.4) | `app/page.tsx`, `app/products/[id]/page.tsx`, `_pages/**` | S | Reachable by clicks only |
| 2.7 | App boundaries: `error.tsx` (retry), `not-found.tsx`, `loading.tsx` | `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx` | S | Destroying the API shows the app's `.status.error` UI |
| 2.8 | Stale-run hint (frontend-only mitigation for the user's §8.2 item): when `RUNNING` and `updatedAt` older than ~2 min, show "no updates — the run may be interrupted" without stopping polling | same card | S | Uses only existing fields; no backend change |

**Exit criteria — manual state matrix (all verified once, recorded in the PR/commit note):**

1. queued → running → completed: result appears, polling stops, spinner stops.
2. failed: `error` text visible, retry offered, no requests afterwards.
3. job 404: message shown, no retry loop.
4. API down: friendly error, bounded retries, manual retry works.
5. back/forward between two job URLs: correct data, no stale flash.
6. throttled "slow 3G": no layout jump, no double polling.

---

### Phase 3 — Styling system and accessibility (1–1.5 d)

**Status: done for tokens, layers, shell, navigation, formatting and global UI
(2026-11-14).**
`globals.css` was rebuilt on light/dark tokens, every hand-written rule moved into
`@layer base` or `@layer components`, and the shipped stylesheet keeps components before
utilities (checked in the compiled CSS, so utilities win again). The app shell, left sidebar,
horizontal section tabs, the Light/Dark/System switch and a back-to-top button landed in
`widgets/app-shell`, and the toast viewport plus its imperative `toast` API in
`shared/lib/toast` + `shared/ui`; all of it is unit-tested. A pre-paint inline script prevents
a theme flash. Dates and times now render through `shared/lib/format.ts` in `Europe/Vilnius`
(`2026-11-14 20:34`), and inline styles are at zero.
Deliberately not done: `shared/ui` primitives — with a single consumer the component classes
are enough, and a primitive layer would have been a second convention for the same job.
Revisit when a second consumer appears. A keyboard and screen-reader pass still needs a real
browser.

Purpose: one styling system, one component vocabulary (§2.12, §2.11).

| # | Step | Files | Size | Acceptance |
| --- | --- | --- | --- | --- |
| 3.1 | Move hand-written CSS into `@layer components` (keep `:root` tokens and `@theme inline`) | `app/globals.css` | M | A utility (`mt-0`, `p-4`) can override the component layer; verified in built CSS |
| 3.2 | `shared/ui` primitives (Tailwind): `card`, `button`, `status-badge`, `page-header`, `breadcrumb`, `field`, `spinner` + `cn()` helper | `shared/ui/**`, `shared/lib/cn.ts` | L | No page composes raw `<div className="card">` after migration |
| 3.3 | Migrate pages one commit each: products → product detail → edit → new → researches → research | `app/**`, `_pages/**` | M | Visual parity; same information hierarchy |
| 3.4 | Remove the 6 inline `style` props; responsive pass at 360 px | `app/**`, `_pages/**` | S | `grep "style={{"` → 0 |
| 3.5 | A11y pass: labels, `aria-describedby` on errors (already good), visible focus, skip link, contrast of `--muted` on `--surface` | `globals.css`, `shared/ui/**` | S | Keyboard-only run of every flow |

**Decision point (3.2):** hand-rolled primitives vs `shadcn/ui`. Stay hand-rolled while the
component count stays under ~10; revisit if forms/tables/dialogs start repeating. Adopting
shadcn later is a mechanical migration from `shared/ui` because pages already use primitives.

---

### Phase 4 — Structure (FSD-lite) (0.5–1 d)

Purpose: make the layering enforceable rather than aspirational (audit §4).

| # | Step | Files | Size | Acceptance |
| --- | --- | --- | --- | --- |
| 4.1 | `features/{create-product,edit-product,start-research}`: move forms + server actions out of route folders | `features/**`, `app/**` | M | Actions live beside their form; no action in `app/` |
| 4.2 | Thin the routes: `app/**` = metadata + `params` + one view component | `app/**` | S | `app/` has no fetch/validation/JSX trees |
| 4.3 | Slice naming: `_pages/{products,product-detail,product-edit,researches,research-detail}` | `_pages/**` | S | One public `index.ts` per slice |
| 4.4 | Enforce import direction (`app → _pages → features → entities → shared`) with `eslint-plugin-boundaries` (or `no-restricted-imports`) | `apps/web/eslint.config.mjs` | M | Deliberate upward import fails `npm run lint` |
| 4.5 | *(optional strictness)* `noUncheckedIndexedAccess` in `apps/web/tsconfig.json` + fixes | `tsconfig.json`, few files | S | Typecheck green |

---

### Phase 5 — Tests and CI (1–1.5 d)

**Status: partially done (2026-11-14).** Runner installed (`vitest`, jsdom,
testing-library, threads pool for sandboxed environments); 55 tests cover the HTTP layer, the
polling hook, navigation, theme, scroll, toasts and formatting; `test` is part of `verify:web`.
Playwright is also in place: `npm run e2e` starts a mock API plus an isolated Next dev server
and asserts 10 rendered scenarios (shell, lists, product tabs, run to completion, failed run,
lost job, 404, theme persistence, copy + toast, back-to-top) in ~17 s. Still open: CI (0.9).

| # | Step | Files | Size | Acceptance |
| --- | --- | --- | --- | --- |
| 5.1 | Vitest + jsdom + `@testing-library/react` + MSW; add `test` to `verify:web` | `apps/web/vitest.config.ts`, `apps/web/test/**` | M | `npm run test` runs in watch and CI mode; `verify:web` now includes it |
| 5.2 | Unit tests: `shared/api/http` (timeout/network/HTTP mapping), schemas (real payload fixture), polling hook (fake timers) | `**/*.test.ts(x)` | M | ≥90 % branch coverage on the hook and http wrapper |
| 5.3 | Integration test: research page renders completed + failed from mocked API | `_pages/research/**/*.test.tsx` | M | Covers §2.1 regression permanently |
| 5.4 | *(optional)* Playwright smoke: create product → start research (mocked) → completed | `e2e/**` | M | One green path in CI |
| 5.5 | CI job running `verify:web` + build | `.github/workflows/ci.yml` | S | Required check before merge |

---

## 3. Harness — what "creating the project harness" should mean here

**Yes, it is needed, but keep it minimal.** The failure mode is a `docs/` tree with eight
files nobody opens. The harness should be the smallest set that makes an agent session
reproducible and removes rediscovery cost.

Recommended minimum (Phase 0.1–0.5), ~5 files:

1. **`docs/system/harness.md`** — the operating manual:
   - prerequisites, install, env (`apps/web/.env.example`, `API_URL`), DB (`docker compose`,
     port 5433), dev servers (3000/4000);
   - command table incl. `verify:web`, and the **sandbox facts** already discovered
     (`next build` → `spawn EPERM`; use `node node_modules/next/dist/bin/next`;
     `npx` fails through piped PowerShell stdio);
   - verification ladder: `typecheck` → `lint` → `test` → `build` outside sandbox;
   - fixtures: `abachi-lt` is local-only, git-ignored, never committed;
   - protected area + **stop rules**: stop and ask before touching
     `apps/api/src/modules/research`, before adding a dependency, before changing the wire
     contract, before a repo-wide format;
   - definition of done, per task and per phase.
2. **`docs/system/frontend.md`** — architecture + conventions (layers, import direction,
   server/client boundary, `Result` + zod, server actions, styling, a11y). This is the file
   that makes `eslint-plugin-boundaries` and code review agree.
3. **`docs/decisions/ADR-002-frontend-lite-fsd.md`** — the decision and its consequences.
4. **`ops/current.md`** — exactly one active task with checkboxes and a link to this plan.
   `ops/backlog.md` for the rest. Create `ops/done/` with the first completed task, not before.
5. **`AGENTS.md` + `README.md` refresh** — the entry points an agent actually reads.

Skip for now: `ops/done/` scaffolding, a separate harness for the API (user's area),
organisation-wide docs, and a docs site. `ADR-001` (research pipeline) stays a draft owned by
the research workstream.

---

## 4. Verification and definition of done

Single command (Phase 0.6; Phase 5 adds `vitest run` to it):

```bash
npm run verify:web     # next typegen && tsc --noEmit && eslint . && prettier --check .
```

A task is done when:

1. `verify:web` is green;
2. `npm run build --workspace @sdr-assistant/web` is green **outside the DSH sandbox** and the
   route table still lists 8 routes + 1 route handler;
3. the manual checklist for the touched flow is recorded in the commit note;
4. `TODO.md` reflects the new state (one active item in "Now");
5. no new `any`, no `as` casts on wire data, no `fetch(` outside `shared/api`.

Per phase: Phase 0 → tooling green; Phase 1 → behaviour identical (compare screenshots);
Phase 2 → state matrix passed; Phase 3 → zero inline styles and zero visual regressions;
Phase 4 → boundary lint green; Phase 5 → CI required.

---

## 5. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Formatting sweep collides with the user's in-flight research edits | Prettier/ESLint scoped to `apps/web` only; `apps/api` in `.prettierignore`; format commit has no other changes |
| Visual regressions during Phase 3 page migrations | one page per commit + before/after screenshots; primitives landed before migration |
| Deleting the `products/[id]` research form breaks run creation | never deleted; Phase 2.6 adds navigation and the form stays until a `features/start-research` page exists |
| Backend contract is moving (stage 02) | `result` typed as `unknown`; rendering adapter isolated in `research-result-view.tsx`; no schema guess |
| `next build` unverifiable in this sandbox | `typegen + tsc` locally, real build in a normal terminal/CI; documented in harness |
| Installing devDependencies needs network / rewrites the lockfile | dedicated commit; if the sandbox blocks npm, run it in a normal terminal and commit the lockfile alone |
| Scope creep into backend | §8 lists every backend dependency explicitly; the frontend must tolerate the current API, not change it |

---

## 6. Traceability — audit finding → step

| Audit | Finding | Step |
| --- | --- | --- |
| §2.1 | `result`/`error` never rendered | 2.2, 2.3, 2.4 |
| §2.2 | infinite silent polling | 2.1, 2.8 |
| §2.3 | `/researches` orphaned, no empty/error states | 2.5, 2.6, 2.7 |
| §2.4 | hardcoded 7-country list | 2.6 (replace with shared dataset; decide code vs name with backend owner) |
| §2.5 | dead `'success'` branch | 1.7 |
| §2.6 | unvalidated contracts, duplicate types | 1.1–1.5 |
| §2.7 | stale server-rendered status | 2.1, 2.4 |
| §2.8 | state not keyed by `jobId` | 2.1 |
| §2.9 | three error conventions | 1.1–1.5 |
| §2.10 | duplicated product validation | 1.4, 4.1 (single schema in `features/*/model`) |
| §2.11 | no `aria-live`, frozen spinner | 2.2, 3.5 |
| §2.12 | two styling systems, cascade layers | 3.1–3.4 |
| §2.13 | no lint/format, two code styles | 0.6, 0.7 |
| §2.14 | FSD drift | 1.4, 4.1–4.4 |
| §2.15 | fragile route handler | 1.6 |
| §2.16 | unordered list (API) | 2.5 locally; §8.1 for the API |
| §2.17 | stale README | 0.8 |

---

## 7. Deliberately deferred (with reasons)

| Option | Defer because |
| --- | --- |
| `cacheComponents: true` (Next 16 PPR) | Requires Suspense boundaries and removes `dynamic`/`revalidate` segment config; every page is a live dashboard. Revisit after Phase 3, as a separate ADR. |
| TanStack Query / SWR | One client-side query today. The hand-rolled hook is ~120 lines and testable. Revisit at ≥3 client query surfaces. |
| `shadcn/ui` | Adds Radix + CVA conventions. Seven primitives are cheaper by hand. Migrate later from `shared/ui` if the count grows. |
| `packages/contracts` | Requires the API DTOs to import it — out of scope (user's area). Until then, web-local zod schemas + a payload fixture test. |
| Moving layers under `src/` | Pure churn: alias, tsconfig, every import. FSD does not require it. |
| i18n / multi-language UI | One product = one market/language; UI stays English until there is a second UI language. |
| Full FSD (`processes`, `widgets` now) | No third page shares a composite yet; empty layers rot. |

---

## 8. Backend dependencies (owned by the user — frontend tolerates them)

Not part of this plan's edits; listed so the two workstreams do not deadlock.

1. **`GET /research` ordering/pagination** — `research.service.ts:79-82` has neither.
   Frontend sorts `createdAt` desc locally in Phase 2.5 and drops that when the API sorts.
2. **`INTERRUPTED` + `lastHeartbeatAt`** — never written, so a crashed run stays `RUNNING`.
   Frontend adds a stale hint from `updatedAt` (2.8) and keeps polling; a real heartbeat
   removes the hint.
3. **Product data in the list** — `GET /research` returns only `productId`. Frontend joins
   against `GET /products` (2.5); an `include`/`select` on the API would remove one request.
4. **Error body** — frontend parses Nest's `{message}` defensively (1.2), so changing the
   error envelope later is a one-file change.
5. **`result` shape** — rendered as `unknown` (2.3). When stage 02 has a stable schema, add
   `researchResultSchema` and a typed renderer in one commit.

---

## 9. Suggested first week

- **Day 1:** Phase 0 (harness + tooling + format sweep + docs refresh). Ship it even if
  nothing else moves — it is what makes every later step reviewable.
- **Day 2–3:** Phase 1 (data layer), then Phase 2.1–2.4 (the hook and the detail page).
- **Day 4:** Phase 2.5–2.8 (list, navigation, boundaries) + manual state matrix.
- **Day 5:** Phase 3.1–3.2 (CSS layers + primitives). Stop there and re-evaluate before the
  page-by-page migration; it is the phase most likely to need design input.

### Fast track (when the broken research flow is the priority)

If the P0 UX should land before the full data layer:

1. Phase 0.1–0.7 (harness + tooling + format sweep) — required either way.
2. Phase **1.1–1.3** (`shared/api`, error mapping, research schema) and **1.6–1.7**
   (proxy hardening, dead code) — the research path is then ready and will not be rewritten.
3. Phase **2.1–2.8** (the whole P0 UX).
4. Defer **1.4–1.5** (`entities/product`, products list) and Phase 3 to the next block.

This gets the feature usable in ~1.5–2 days after Phase 0, at the cost of touching the
products list twice later. Do not fast-track past 0.6 — the polling hook is the one place
where hand-verification is not enough.
