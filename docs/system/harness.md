# Harness — operational procedures

Operational manual for this repository. Agent authority is defined only by
[AGENTS.md](../../AGENTS.md); task assignment and status are authoritative only in
[docs/tasks/README.md](../tasks/README.md). This document describes how to work, not what
work is authorized.

SDR-002 is documentation-only. Command names and purposes below were checked against the
current root and workspace `package.json` files by static inspection. **SDR-002 did not run
these commands**, so this document does not claim that any command currently passes.

## 1. Repository at a glance

```text
sdr-assistant/
├── apps/api/                 NestJS 11 + Fastify, Prisma 7, ESM (research pipeline)
├── apps/web/                 Next.js 16 App Router + Tailwind 4 (frontend)
├── docs/
│   ├── system/               harness, environment, research, frontend
│   ├── decisions/            approved ADRs
│   ├── tasks/                authoritative task registry and task records
│   ├── audits/               read-only observations
│   └── plans/                proposals, not execution authorization
├── ops/                      legacy operational records (not task authority)
├── docker-compose.yml        PostgreSQL 17 on host port 5433
├── PRODUCT.md                approved product requirements
├── README.md                 human-facing project overview
├── AGENTS.md                 agent authority and execution restrictions
├── TODO.md                   legacy record
└── HANDOVER.md               legacy handover record
```

All workspaces are ESM. npm workspaces are `apps/api` and `apps/web`; the root scripts
delegate to them. Node.js 22 or newer is required by `package.json`.

## 2. Stack and workspace layout

| Area | Current stack |
| --- | --- |
| API | NestJS 11 on Fastify, TypeScript 5.9, NodeNext ESM, Prisma 7 with `@prisma/adapter-pg` |
| Database | PostgreSQL 17 via Docker Compose; Prisma schema/migrations in `apps/api/prisma` |
| Web | Next.js 16.4.5 App Router, React 19, Tailwind CSS 4, zod 4, TypeScript 5.9 |
| Tests | Vitest for API and web; Playwright for web rendered scenarios |
| Tooling | ESLint 10 + `eslint-config-next`, Prettier 3; web tooling is workspace-local |

The API owns the research pipeline. The web app consumes it over HTTP only; the browser
talks to same-origin `/api/*` route handlers because the API has no CORS.

## 3. Setup

Run setup commands only when the assigned task authorizes dependency installation,
database changes or application startup.

```bash
npm install
docker compose up -d                      # PostgreSQL 17 on localhost:5433
copy apps\api\.env.example apps\api\.env  # Windows; cp on macOS/Linux
npm run db:check                          # API build + database connectivity
```

- `npm install` installs workspace dependencies and runs the API `postinstall`
  (`prisma generate`). This is a dependency installation and generated-code change.
- `docker compose up -d` starts the database container; `npm run db:up` is the scripted
  equivalent. This changes the local environment.
- `copy`/`cp` creates local environment files. Do not commit secrets or real credentials.
- `npm run db:check` builds the API and connects to PostgreSQL. It requires a running
  database and produces build output.

The web app reads `API_URL` (default `http://localhost:4000`); see
`apps/web/.env.example`. The API reads its own environment from `apps/api/.env`; required
provider keys are described in [research.md](research.md), not repeated here with values.

## 4. Command reference

Command names are exactly those in `package.json`. “Authorization” means the task must
explicitly permit the action; ordinary workspace access is not permission.

### Root commands

| Command | Purpose | Prerequisites | Side effects / authorization |
| --- | --- | --- | --- |
| `npm run dev` | Start API (4000) and web (3000) together | Dependencies, environment, database if API paths need it | Long-running servers; application startup. Requires task authorization and an environment that permits the dev servers. |
| `npm run dev:api` / `npm run dev:web` | Start one side | As above | Same startup/authorization conditions. |
| `npm run verify:web` | Frontend gate: typecheck, lint, unit tests, format check | Dependencies installed | Runs checks; does not start the app or paid APIs. This is the mandatory frontend gate when a task changes `apps/web`. |
| `npm run e2e:web` | Playwright rendered scenarios against the mock API | Dependencies, Playwright browsers, a dev server it starts | Starts a mock API and isolated Next dev server; must not target the paid API. Mandatory for any task that changes rendered behavior; the approved proof must include it. If the approved proof omits it, report the conflict and stop — it is not optional. |
| `npm run build` | API `prisma generate` + `tsc`, then web `next build` | Dependencies, database only if generation needs it | Generates/builds artifacts. Next build may need process-spawning permissions; requires explicit task authorization. Not a universal completion gate. |
| `npm run db:up` / `npm run db:down` | Start/stop the PostgreSQL container | Docker | Environment change; requires task authorization. |
| `npm run db:generate` | Generate Prisma Client | API dependencies | Writes generated code; requires authorization when the task permits it. |
| `npm run db:migrate` | Create/apply a Prisma migration | Running database, schema change authorization | Database and migration changes; requires explicit authorization. |
| `npm run db:check` | Build API + database connectivity check | Running database | Build output and a live database connection; authorization required. |

### Workspace-level commands

| Command | Purpose | Notes |
| --- | --- | --- |
| `npm run typecheck -w @sdr-assistant/web` | `next typegen && tsc --noEmit` | Part of `verify:web`; generates `.next/types` and `next-env.d.ts`. |
| `npm run lint -w @sdr-assistant/web` | `eslint . --max-warnings=0` | Part of `verify:web`; web only. |
| `npm run test -w @sdr-assistant/web` | Vitest web tests | Part of `verify:web`; jsdom/threads. |
| `npm run format:check -w @sdr-assistant/web` | Prettier check, no writes | Part of `verify:web`. |
| `npm run test -w @sdr-assistant/api` | Vitest API tests | Include in a proof only when the assigned task requires it; not a universal gate. |
| `npm run e2e -w @sdr-assistant/web` / `npm run e2e:headed -w @sdr-assistant/web` | Playwright, optionally headed | Same mock-API boundary as `e2e:web`. |
| `npm run format -w @sdr-assistant/web` | Prettier write, web only | Modifies files; run only with task authorization and keep it scoped to `apps/web`. |
| `npm run dev -w @sdr-assistant/api` / `npm run dev -w @sdr-assistant/web` | One workspace dev server | Startup authorization as above. |
| `npm run build -w @sdr-assistant/api` / `npm run build -w @sdr-assistant/web` | One workspace build | Same build/authorization caveats. |
| `npm run start -w @sdr-assistant/api` / `npm run start -w @sdr-assistant/web` | Run a built app | Startup authorization; not a verification substitute. |

Never run a repo-wide formatter or linter. Formatters and linting are scoped to
`apps/web`; `apps/api/src/modules/research` is a protected area.

## 5. Task execution workflow

1. Read [AGENTS.md](../../AGENTS.md) and the assigned task document registered in
   [docs/tasks/README.md](../tasks/README.md). Only an explicitly assigned task is active.
2. Read the relevant system document before work: this harness, [research.md](research.md),
   [frontend.md](frontend.md), [PRODUCT.md](../../PRODUCT.md), or an ADR.
3. Inspect the current working tree and preserve all existing uncommitted changes. Treat
   the working tree as the implementation baseline, not `HEAD`.
4. Implement only the authorized paths in the task. Do not select additional work.
5. Complete all substantive changes before the single proof command. Run exactly the proof
   command the approved task specifies.
6. Record the actual output and exit code, manually review changed/new files, and use the
   completion report format in [AGENTS.md](../../AGENTS.md).
7. Do not commit, push, reset, stash or clean unless the task explicitly authorizes it. Do
   not start the next task.

## 6. Verification

- Exactly one proof command is defined by the approved task; execute only that command.
- A proof command may invoke an existing script containing multiple checks.
- Mandatory project-specific gates must be included in the approved task's proof command.
  If the approved proof conflicts with a mandatory project requirement, report the conflict
  and stop; do not independently add verification commands or weaken the requirement.
- Necessary read-only repository inspection to understand or review a change is not an
  additional proof command.
- Do not add a universal build, API, GUI or live-research gate. Do not claim success
  without recorded evidence.

### Frontend quality requirements

Any task that changes `apps/web` must include the existing `npm run verify:web` gate in its
approved proof command. A change to rendered behaviour must include the appropriate
Playwright scenario in the approved proof. If the approved proof omits that mandatory gate,
report the conflict and stop; do not treat the omission as permission to skip it. Preserve
the rules in
[frontend.md](frontend.md): no `any`, no unsafe wire casts, no `fetch(` outside
`shared/api/**` and `app/api/**`, zod parsing for every payload, `Result` failures, and
loading/empty/error/terminal states.

### Build and environment

`npm run build` and the dev servers are not universal “done” steps. They require explicit
task authorization and may need a broader environment; see [environment.md](environment.md).
A build that could not run must be reported as not run, never described as passing.

## 7. Research artifact handling

- `apps/api/src/modules/research/**` is protected. Do not modify it, including prompts,
  tests, fixtures, schemas or formatting, without the explicit authorization described in
  [AGENTS.md](../../AGENTS.md).
- The current research implementation is frozen under
  [AGENTS.md](../../AGENTS.md) (Research Implementation Freeze). Read-only inspection and
  assigned documentation work are permitted; do not modify research code, prompts, schemas,
  stages, tests or behavior. This reference is a concise reminder, not a replacement for
  the binding freeze policy in `AGENTS.md`.
- `apps/api/src/modules/research/temp/` and the stage-01 `temp/` directory hold raw dumps and
  run artifacts; they are git-ignored. Do not commit them.
- Current stage persistence and the normal-path result limitation are documented in
  [research.md](research.md). Do not infer a stable result schema from an old dump.
- Live research runs and provider calls consume credits. The default paid API budget is
  zero unless a task explicitly authorizes the exact run or provider.
- Fixture and replay code exists for tests/development but is not the current main path;
  see [research.md](research.md) before using a dump as evidence.

## 8. Documentation responsibilities

| Document | Responsibility |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | Agent authority, execution restrictions, protected area and completion rules |
| [PRODUCT.md](../../PRODUCT.md) | Approved product requirements and acceptance criteria |
| [README.md](../../README.md) | Human-facing project overview and entry points |
| `docs/system/harness.md` | This operational manual: commands, workflow, verification |
| [docs/system/environment.md](environment.md) | Environment observations and approved solutions |
| [docs/system/research.md](research.md) | Actual research implementation, integration status and known discrepancies |
| [docs/system/frontend.md](frontend.md) | Approved frontend conventions and constraints |
| [docs/decisions/](../decisions/) | Approved architectural decisions (ADR-001 is draft, ADR-002 accepted) |
| [docs/tasks/README.md](../tasks/README.md) | Authoritative task registry |
| Task documents under `docs/tasks/` | Approved task scope, acceptance criteria and execution evidence |
| [docs/audits/](../audits/) and [docs/plans/](../plans/) | Observations and proposals, not execution authorization |

No subordinate document may grant authority prohibited by [AGENTS.md](../../AGENTS.md). If
the implementation contradicts `PRODUCT.md`, document the discrepancy in
[research.md](research.md) rather than changing either silently.

## 9. Environment notes

Use the standard `workspace-write` sandbox. Do not escalate privileges or switch to a less
restrictive mode without explicit human authorization, even for read-only commands.
Windows, PowerShell, DSH and historical Next.js/npm caveats live in
[environment.md](environment.md); this harness does not duplicate them.

## 10. Current limitations

- This manual was reconciled by static inspection during SDR-002; it was not produced by a
  fresh run of the commands.
- Known implementation/documentation discrepancies, including the normal-path research
  result, are recorded in [research.md](research.md).
- SDR-002 did not change application behavior, dependencies, database state, environment
  settings or sandbox permissions.
