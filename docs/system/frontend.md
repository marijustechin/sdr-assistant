# Frontend architecture and conventions

Rules for `apps/web`. They are enforceable, not aspirational: each section names the check
that backs it. Read this before touching the app; read
[harness.md](harness.md) before running anything.

Decision record: [ADR-002 Lite FSD](../decisions/ADR-002-frontend-lite-fsd.md).
Migration order: [plan](../plans/frontend-action-plan-2026-11-14.md) §2.

---

## 1. Scope

- Stack: Next.js 16.4 (App Router, Turbopack), React 19, Tailwind CSS 4, zod 4, TypeScript 5.9
  (strict), ESM.
- One research run = one product + one market. The UI never offers multiple languages.
- The API (`apps/api`) is consumed over HTTP only. The web app never imports server code.

---

## 2. Structure

### Today (after Phase 1–2: data layer + research P0)

```text
apps/web/
├── app/                     routes, route handler, error/not-found/loading, globals.css
├── _pages/                  research, researches            (FSD pages layer, not routable)
├── features/track-research/ model/use-research-polling.ts + ui/ (details, badge, result)
├── entities/research/       api/{server,client}.ts, model/schema.ts, index.ts, client.ts
├── shared/                  api/{http,errors}.ts, config/env.ts, lib/format.ts
├── widgets/app-shell/       sidebar, section tabs, navigation model (+ tests)
├── lib/                     products.ts (transitional product API), countries.ts
```

### Target (end of Phase 4)

```text
apps/web/
├── app/                     routing only: metadata, params, one view component
│   ├── api/research/[jobId]/route.ts
│   ├── error.tsx  not-found.tsx  loading.tsx
│   └── layout.tsx  globals.css
├── _pages/                  compositions per route
├── features/                user actions: create-product, edit-product, start-research,
│                            track-research (form + server action / hook)
├── entities/                product, research — api (server/client) + model (schema, types)
├── widgets/                 cross-page chrome (app-shell) and shared composites
└── shared/                  api (http, errors), config (env), lib (countries, format),
                             ui (primitives, only when a third consumer appears)
```

`lib/` is transitional and disappears as the target lands: `lib/products.ts` → `entities/product`,
`lib/countries.ts` → `shared/lib/countries.ts`. `widgets/` exists for the app shell only; add
another widget when a second page needs the same composite.

---

## 3. Layers and import direction

Imports flow **down only**. No upward imports, no sibling feature-to-feature imports.

| Layer | May import | May not |
| --- | --- | --- |
| `app/` | widgets, `_pages`, shared | features, entities |
| `_pages/` | widgets, features, entities, shared | app |
| `widgets/` | features, entities, shared | app, _pages |
| `features/` | entities, shared | _pages, app, other features |
| `entities/` | shared | features, _pages, app |
| `shared/` | nothing internal | everything above |

Every slice exposes one public `index.ts`. Cross-slice imports go through it; never
`@/entities/research/api/research.server` from a page.

**Enforcement:** `npm run lint` (ESLint) today; import-boundary rules in Phase 4.4. Until then
this is a review rule.

---

## 4. Server and client boundary

- Pages are React Server Components by default. `'use client'` only where there is
  interaction: forms, the polling hook.
- Client components may not import `shared/config/env.ts`, `apiUrl`, Prisma, or any
  `*.server.ts` module — the API URL is server-only.
- Browser code talks to same-origin `/api/*` route handlers. The API has no CORS, so calling
  `${apiUrl}` from the browser is a bug.
- Mark the boundary in the filename: `*.server.ts` (may use env, never imported by a client
  component) and `*.client.ts` (browser fetch, no secrets).
- A slice that is read from both worlds exposes **two entry points**: `index.ts` (server
  queries + types) and `client.ts` (browser queries). A Client Component imports the
  `client.ts` entry, never the barrel — the barrel re-exports server code.
- Server-only modules start with `import 'server-only'` (`shared/config/env.ts`,
  `entities/*/api/*.server.ts`). Importing them from a Client Component is then a build
  error instead of a leaked `API_URL`.

**Check:** a `'use client'` file that imports `@/shared/config/env`, a `*.server` module or an
entity barrel is a defect.

---

## 5. Data layer

One path for HTTP, one shape for failures, one schema per payload.

```ts
// shared/api/http.ts — the only place that calls fetch
type ApiFailureReason = 'network' | 'timeout' | 'http' | 'invalid-response'

type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false
      status: number      // 0 for network/timeout, the HTTP status otherwise
      reason: ApiFailureReason
      message: string     // safe to show to a user
      detail?: string     // technical diagnostics, never rendered
    };

getJson<T>(url: string, schema: ZodType<T>, opts?: { signal?: AbortSignal }): Promise<Result<T>>
```

Rules:

1. **No `fetch(` outside `shared/api/**` and the `/api/*` route handler.** Verified: the only
   call site is `shared/api/http.ts`.
2. **Every response is parsed with a zod schema** in `entities/*/model/schema.ts` (and
   `lib/products.ts` until the entity moves); the TS type is `z.infer` of it. No `as` on
   `response.json()`, no hand-written mirror types.
3. **Failures are values, not exceptions.** Data functions return `Result`; a thrown error
   from a fetch must never reach the render tree. The failure carries a `reason`, so callers
   can decide whether retrying is meaningful, and a technical `detail` that is logged or
   dropped but never shown to a user. Plain-text and HTML error bodies never become the
   user-facing message.
4. **Timeouts and `cache: 'no-store'`** are set inside `shared/api`, not per call site.
5. `result` from `GET /research/:jobId` is `z.unknown()` until stage 02 settles. Render it
   defensively; do not guess its shape.

---

## 6. Mutations

- Server Actions only (`'use server'`), never `fetch` from a client component for writes.
- An action lives in `features/<verb>/api/action.ts`, next to the form that calls it — not in
  `app/**`.
- Validation happens twice on purpose: client-side attributes for UX, and the same rules in
  the action (and again in the API DTO). The action returns a typed state object with
  `fieldErrors` / `message`; it never throws to the client.
- Success ends with `redirect()` or `revalidatePath()` — and the action's return type must
  reflect that (no `status: 'success'` branch that can never render).
- Form state type lives with the action (`ResearchFormState`), not in the component.

---

## 7. Async UI states

Every async surface renders exactly one of: `loading`, `empty`, `error`, `success/terminal`.

- App-level `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx` are the fallback; pages
  that load data still show their own inline error card.
- A 404 from the API is a rendered message, not an exception.
- Never render a raw `Error.message` to the user; map it through `shared/api/errors.ts`.

### Polling rules (`features/track-research`)

1. Poll only while the status is `QUEUED` or `RUNNING`.
2. Stop on any terminal status (`COMPLETED`, `FAILED`, `INTERRUPTED`). The hook owns the
   result, so nothing needs a server refresh: never re-fetch data you already have.
3. Retry only transport failures (`network`, `timeout`) and `5xx`, with exponential backoff
   (2→10 s) and an 8-attempt cap. Stop immediately on 4xx and on `invalid-response`, and show
   the message.
4. Abort on unmount (`AbortController`) and reset state when `jobId` changes (render the
   consumer with `key={research.id}`).
5. One component owns the status **and** the result; never render the same status twice from
   two sources.
6. Announce changes with `aria-live="polite"` / `role="status"`.

---

## 8. Styling

Tailwind CSS 4 via `@tailwindcss/postcss`; `app/globals.css` is the only stylesheet entry and
is imported by `app/layout.tsx`.

- **One system.** Utilities first; shared pieces are `@layer components` classes. There is no
  third convention and no CSS-in-JS.
- **Everything hand-written lives in a layer.** Tokens and element defaults in `@layer base`,
  classes in `@layer components`. Unlayered rules beat every utility, which is how the earlier
  `mt-0` / `p { margin }` conflict happened.
- **Tokens only.** Colours come from the CSS variables (`--background`, `--surface`, `--subtle`,
  `--border`, `--text`, `--muted`, `--accent`, `--ok`, `--error`) exposed to Tailwind through
  `@theme inline`. No hardcoded hex values in components.
- **Light first, dark automatic, user overridable.** `:root` defines the light palette;
  `:root[data-theme='dark']` overrides the same variables and `color-scheme`. An inline script
  in `app/layout.tsx` (`THEME_INIT_SCRIPT`) sets `data-theme` before the first paint, so a dark
  system never flashes white. The sidebar switch (Light / Dark / System) persists the choice in
  `localStorage` and reads it with `useSyncExternalStore`, which also syncs across tabs.
- **Dates and times only through `shared/lib/format.ts`.** Everything is rendered in Lithuanian
  time (`Europe/Vilnius`), independent of the server or browser zone: `formatDate` → `2026-11-14`,
  `formatTime` → `20:34`, `formatDateTime` → `2026-11-14 20:34`. No `toLocaleString()` and no
  ad-hoc `Intl.DateTimeFormat` in pages — the fixed zone also keeps server and client markup
  identical.
- **Global chrome** is mounted once in `app/layout.tsx`: `widgets/app-shell` owns the sidebar,
  the section tabs, the theme switch and the back-to-top button; `shared/ui` owns the toast
  viewport. A page never renders its own copy of these.
- **Notifications.** Any Client Component calls `toast.success` / `toast.warning` /
  `toast.error` / `toast.info` from `@/shared/lib/toast`. Toasts stack in the **top-right**
  corner, tinted by variant: info amber, success green, warning and error rose (each with its
  own accent bar and text colour, defined once per theme). The stack is capped at four, each
  toast auto-dismisses (6 s, 10 s for warnings, 12 s for errors), pauses while hovered or
  focused, and Escape dismisses. Errors and warnings use `role="alert"`, the rest
  `role="status"`. A toast may carry one action (`Retry`, `Try again`) — put the recovery
  there, not only in a paragraph.
- **Back to top** appears only on pages that actually overflow (document > viewport + 200 px)
  and only after 400 px of scrolling; the scroll listener is passive and rAF-throttled, and the
  smooth scroll is skipped under `prefers-reduced-motion`.
- **No inline `style={{ … }}`.** Verified: zero occurrences under `apps/web`.
- **Layout classes:** `.app-shell`, `.sidebar`, `.nav-item`, `.section-nav`, `.section-tab`,
  `.page-header`, `.card`, `.button`, `.status`, `.product-item`. The shell is a CSS grid
  (256 px sidebar + content) and collapses to a horizontal top bar below 1024 px.

**Check:** `grep -r "style={{" apps/web` returns nothing, and the built stylesheet keeps
`@layer components` before `@layer utilities` (utilities must win).

---

## 9. Accessibility baseline

- Semantic landmarks: one `<main>` per page, one `<nav aria-label>` for the sidebar and one for
  the section tabs; a skip link jumps to `#content`.
- Current page is marked with `aria-current="page"` in both navigations.
- The theme switch is a `role="group"` of three buttons with `aria-pressed` and an `aria-label`
  per option (Light / Dark / System) — icon-only, so the accessible name is explicit.
- Toasts never steal focus; the dismiss button and the optional action are reachable by Tab,
  and Escape closes the focused toast.
- The back-to-top button is a real `<button>` with `aria-label="Back to top"`, not a link.
- Every input has a `<label htmlFor>`; errors are linked with `aria-describedby` and
  `aria-invalid`.
- Async status changes are announced (`role="status"`, `aria-live="polite"`).
- Keyboard reachable: visible focus ring on every interactive element, no div-click handlers,
  no keyboard traps.
- Animation respects `prefers-reduced-motion`.
- Minimum supported width: 360 px.

---

## 10. Naming and files

| Kind | Convention | Example |
| --- | --- | --- |
| Route | Next folder convention | `app/researches/[jobId]/page.tsx` |
| Page slice | kebab-case, plural for lists | `_pages/researches`, `_pages/research` |
| Feature | verb-object | `features/start-research` |
| Entity | singular noun | `entities/research` |
| Widget | kebab-case, cross-page | `widgets/app-shell` |
| Segment | `ui`, `api`, `model` | `entities/research/api/research.server.ts` |
| Component | PascalCase export, kebab file | `research-status-card.tsx` → `ResearchStatusCard` |
| Schema | `*Schema` + `z.infer` type | `researchResponseSchema` / `ResearchResponse` |
| Server action | verb | `startResearch`, `updateProduct` |

No default exports for components; pages keep Next's default export signature.

---

## 11. Enforcement

| Rule | Checked by | Status |
| --- | --- | --- |
| Types, no `any` | `npm run typecheck`, `@typescript-eslint/no-explicit-any: error` | active |
| Lint, hooks, a11y basics | `npm run lint` (`eslint-config-next` core-web-vitals + typescript) | active |
| Formatting | `npm run format:check` | active |
| Server/client leaks | `server-only` + a separate `client.ts` entry per slice | active |
| HTTP failures and polling | `npm run test` (vitest: `shared/api/http`, `use-research-polling`) | active |
| Rendered behaviour | `npm run e2e` (Playwright, mock API) | active (10 scenarios) |
| Layer boundaries | `eslint-plugin-boundaries` | Phase 4.4 |
| No `fetch` outside `shared/api` | grep in DoD + review | active (single call site) |
| Page-level rendering | integration test / manual matrix | Phase 5 + manual |

All of them run together in `npm run verify:web`.

---

## 12. Anti-patterns already found here

Do not reintroduce these (each has an audit reference):

- Ad-hoc `fetch` with a local response type inside a page (`app/products/page.tsx`, fixed
  2026-11-14).
- Duplicated domain types (`Product` in two files, fixed 2026-11-14).
- A UI branch that can never render (`state.status === 'success'` in the research form).
- Two sources of truth for one status on one screen.
- Silent infinite retry in a poller.
- Re-fetching a completed result just to render it (`router.refresh()` after polling, removed
  2026-11-14).
- Hardcoded market list (`lib/countries.ts`) — conflicts with the "any country" rule.
- A route folder that contains business logic, validation and server actions.
- Generated files committed to git (`next-env.d.ts`).

---

## 13. Checklist — adding a feature

1. Decide the layer: is it a verb (feature), a domain query (entity) or a view (page)?
2. Schema first: `entities/<x>/model/schema.ts`; type derived from it.
3. Server fetch via `shared/api`; return `Result`.
4. Route file: metadata + `params` + one view component.
5. Interactive part only as `'use client'`; mutations via a server action in the feature.
6. Render all states: loading, empty, error, terminal.
7. `npm run verify:web`, then the manual checklist from [harness.md](harness.md) §5.
