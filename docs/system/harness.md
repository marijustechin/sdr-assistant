# Harness — how to work in this repo

Operational manual for humans and agents. If a command here fails, fix this file in the same
change — an inaccurate harness is worse than none.

Related: [frontend conventions](frontend.md) · [ADR-002 Lite FSD](../decisions/ADR-002-frontend-lite-fsd.md)
· [current task](../../ops/current.md) · [audit](../audits/frontend-2026-11-14.md)
· [plan](../plans/frontend-action-plan-2026-11-14.md).

---

## 1. Repo at a glance

```text
sdr-assistant/
├── apps/api/            NestJS 11 + Fastify, Prisma 7, ESM (source of the research pipeline)
├── apps/web/            Next.js 16 App Router + Tailwind 4 (all frontend work)
├── docs/                audits, plans, decisions, system docs
├── ops/                 current task + backlog
├── docker-compose.yml   PostgreSQL 17 on localhost:5433
├── AGENTS.md            agent rules (protected area, research flow)
├── HANDOVER.md          what works, temporary state
└── TODO.md              one active item, everything else in ops/backlog.md
```

All packages are ESM. Node >= 22 (verified on 24.20.0). npm workspaces: `apps/api`,
`apps/web`.

---

## 2. Setup

```bash
npm install
docker compose up -d                      # PostgreSQL 17 on localhost:5433
copy apps\api\.env.example apps\api\.env  # Windows; cp elsewhere
npm run db:check                          # builds the API and verifies the DB connection
```

The web app reads `API_URL` (default `http://localhost:4000`) — see
`apps/web/.env.example`. The API has no CORS: browser code may only call same-origin
`/api/*` route handlers.

---

## 3. Commands

| Command | What it does | Verified |
| --- | --- | --- |
| `npm run dev` | API (4000) + web (3000) together | not in this environment |
| `npm run dev:api` / `npm run dev:web` | one side only | not in this environment |
| `npm run verify:web` | `typecheck && lint && format:check` for `apps/web` | yes, exit 0 |
| `npm run typecheck -w @sdr-assistant/web` | `next typegen && tsc --noEmit` | yes |
| `npm run lint -w @sdr-assistant/web` | `eslint . --max-warnings=0` | yes |
| `npm run test -w @sdr-assistant/web` | `vitest run` (HTTP layer + polling hook) | yes |
| `npm run format -w @sdr-assistant/web` | `prettier --write .` (web only) | yes |
| `npm run build` | API `tsc` + `next build` | compile passes; see §4 |
| `npm run db:up` / `db:down` | PostgreSQL container | no |
| `npm run db:migrate` | Prisma migrate dev | no |
| `npm run db:generate` | Prisma client | no |
| `npm run db:check` | build + DB connectivity check | no |

`verify:web` is the gate for every frontend change. It deliberately does **not** run a
production build — that needs a normal terminal (§4).

---

## 4. Windows / DSH sandbox caveats

These are verified facts in this environment, not guesses. They cost hours if rediscovered.

1. **Use `npm.cmd` / `npx.cmd` in PowerShell, not `npm` / `npx`.**
   The `.ps1` shims spawn `node.exe` through a pipe and fail with
   `Access to the path '\\.\pipe\LOCAL\...' is denied`. `npm.cmd` and `npx.cmd` work.
2. **Never pipe a native executable's output into a PowerShell cmdlet.**
   `git status | Select-Object …`, `node … | Select-Object …` and similar fail with the same
   named-pipe error. Redirect to a file or let the tool capture the output.
3. **`next build` needs the unrestricted sandbox.** Under `workspace-write` it compiles and
   then dies at `Running TypeScript …` with `spawn EPERM` (exit 1) because it cannot fork its
   workers. With `danger-full-access` the whole build completes — verified 2026-11-14: 11
   routes, static and dynamic. `next typegen` and `tsc` work under both.
4. **npm's default cache is outside the workspace** (`%LOCALAPPDATA%\npm-cache`) and is
   blocked by the file sandbox. Installing from inside the sandbox needs a workspace-safe
   cache, e.g. `npm.cmd install … --cache "$env:TEMP\npm-cache-sdr"`.
5. **`next-env.d.ts` is generated and git-ignored.** It is written by `next typegen`,
   `next dev` and `next build`, and it imports `.next/types/*`. Do not edit or commit it.
6. **`tsc` without `.next/types` still exits 0** because `skipLibCheck` hides the missing
   import, but route validation is then silently skipped. Always let `typecheck` run
   `next typegen` first.
7. **`next dev` / `next start` also need the unrestricted sandbox.** Under `workspace-write`
   they fork a server process and die with `spawn EPERM`; with `danger-full-access` both work
   (verified 2026-11-14). If `next dev` reports *"Another next dev server is already running"*,
   that is the developer's own server on :3000 — use another port, never kill it.
8. **Vitest must use the threads pool in the sandbox.** The default `forks` pool spawns child
   processes and fails with `spawn EPERM`; `apps/web/vitest.config.ts` pins
   `pool: 'threads'`, which works everywhere.

---

## 5. Verification ladder and definition of done

Run in this order; stop at the first failure.

1. `npm run verify:web` — typecheck, lint, formatting.
2. `npm run build --workspace @sdr-assistant/web` — must list the routes (currently 11:
   the pages, `/_not-found`, `/icon.svg` and the `/api/research/[jobId]` handler). Needs
   `danger-full-access` or a normal terminal, see §4.3.
3. `npm run dev` **outside the sandbox** — walk the manual state matrix for the touched flow
   (states, navigation, keyboard) and record it in the commit message or `ops/done/`.
4. `TODO.md` updated: one active item in "Now"; finished work moved to "Done" with evidence.

A task is done when all four hold. "It compiles" is not done.

Frontend-specific bar (see [frontend.md](frontend.md)): no `any`, no `as` casts on wire
data, no `fetch(` outside `shared/api` and the route handler, no unreachable UI branches.

---

## 6. Fixtures

- Raw identification fixtures live in
  `apps/api/src/modules/research/stages/01-product-identification/temp/` and are git-ignored.
- `abachi-lt` is the current local fixture used by `ResearchService` while stage 02 is being
  developed. It exists only on the machine that created it.
- `readIdentificationFixture` / `writeIdentificationFixture`
  (`apps/api/src/modules/research/lib/research-fixture.lib.ts`) are the only accessors.
- **Never commit fixture content** and never add raw page dumps to the repo.

---

## 7. Protected area and stop rules

**Frozen:** `apps/api/src/modules/research/**`. Do not modify it — not even formatting,
imports or a comment — without an explicit, specific request from the user. The user is
actively editing that module.

Stop and ask before:

1. touching anything in the protected area;
2. adding, upgrading or removing a dependency;
3. changing a wire contract (field name, type, status value, error envelope);
4. running a formatter or linter outside `apps/web` (`.prettierignore` protects `apps/api`,
   but do not rely on it — scope the command);
5. deleting the research form on `products/[id]` — it is still the only way to start a run;
6. claiming work is done when `next build` could not run (say so explicitly instead).

Do not "fix" an API-side problem from the web app. Record it in `ops/backlog.md` §Backend
and tolerate the current behaviour.

---

## 8. Task workflow

1. Pick the task from `ops/current.md` (it mirrors `TODO.md` "Now"). One task at a time.
2. Read [frontend.md](frontend.md) before touching `apps/web`, and the relevant Next.js guide
   in `node_modules/next/dist/docs/` before using a Next API — this Next version differs from
   older knowledge and `next lint` no longer exists.
3. Implement in small commits; run `npm run verify:web` before each.
4. Update `ops/current.md`, `TODO.md`, and `ops/backlog.md` when the state changes.
5. When a decision is not obvious and will outlive the task, write an ADR in `docs/decisions/`.

---

## 9. Document map

| Document | Purpose |
| --- | --- |
| `AGENTS.md` | Hard rules for agents: protected area, research semantics |
| `docs/system/harness.md` | This file: commands, caveats, done |
| `docs/system/frontend.md` | Frontend architecture and conventions |
| `docs/decisions/ADR-001-research-pipeline.md` | Research pipeline (draft, owned by the research workstream) |
| `docs/decisions/ADR-002-frontend-lite-fsd.md` | Frontend layering decision |
| `docs/audits/frontend-2026-11-14.md` | Read-only audit: facts, problems, evidence |
| `docs/plans/frontend-action-plan-2026-11-14.md` | Ordered phases with acceptance criteria |
| `ops/current.md` | Exactly one active task |
| `ops/backlog.md` | Everything not scheduled |

---

## 10. Known gaps

- Tests cover the HTTP failure model, the polling hook, navigation, theme, scroll, toasts and
  formatting; rendered pages are only smoke-tested over HTTP, not asserted in a test.
- No CI workflow yet (plan 0.9 is optional and unverified here).
- No lint rule for layer boundaries yet (Phase 4).
