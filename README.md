# sdr-assistant

SDR Assistant researches one product in one target market: it identifies the product and
its local category, collects candidate pages, assesses each page, and builds company
profiles from the resulting offers. Runs are asynchronous: the web client starts a job and
polls its status.

This is a documentation-first, ESM monorepo with a NestJS/Fastify API and a Next.js web
app. The approved product requirements are in [PRODUCT.md](PRODUCT.md); the actual
four-stage implementation and its known discrepancies are in
[docs/system/research.md](docs/system/research.md).

## Stack

| Layer | Choice |
| --- | --- |
| API | NestJS 11 on Fastify, TypeScript 5.9, NodeNext ESM |
| Database | PostgreSQL 17 (Docker Compose) + Prisma 7 with `@prisma/adapter-pg` |
| Web | Next.js 16.4.5 App Router, React 19, Tailwind CSS 4, zod 4 |
| Tests | Vitest (API and web), Playwright (web rendered scenarios) |
| Tooling | ESLint 10 + `eslint-config-next`, Prettier 3; web tooling is workspace-local |
| Runtime | Node.js >= 22; npm workspaces `apps/api`, `apps/web` |

## Layout

```text
.
├── apps/
│   ├── api/                  NestJS + Fastify + Prisma; research pipeline
│   │   ├── prisma/           schema and migrations
│   │   └── src/modules/      health, products, research, settings, prisma
│   └── web/                  Next.js App Router
│       ├── app/              routes, polling proxy, styles
│       ├── _pages/           non-routable page compositions
│       ├── entities/         research and settings data layers
│       ├── features/         user actions (track-research, update-settings)
│       ├── widgets/          app shell
│       └── shared/           HTTP, config, formatting, UI primitives
├── docs/
│   ├── system/               harness, environment, research, frontend
│   ├── decisions/            ADR-001 (draft) and ADR-002 (accepted)
│   ├── tasks/                authoritative task registry and task records
│   ├── audits/               read-only observations
│   └── plans/                proposals, not execution authorization
├── ops/                      legacy operational records (not task authority)
├── PRODUCT.md                approved product requirements
├── AGENTS.md                 agent authority and execution restrictions
├── docker-compose.yml        PostgreSQL 17 on host port 5433
├── TODO.md                   legacy record
└── HANDOVER.md               legacy handover record
```

## Prerequisites

- Node.js 22 or newer
- Docker (or another PostgreSQL 17 server)

## Setup

```bash
npm install
docker compose up -d                      # PostgreSQL on localhost:5433
copy apps\api\.env.example apps\api\.env  # Windows; cp on macOS/Linux
npm run db:check                          # API build + database connectivity
```

`npm install` installs dependencies and runs the API `postinstall` (`prisma generate`).
`db:check` requires a running database. See
[docs/system/harness.md](docs/system/harness.md) for prerequisites, side effects and the
authorization required for dependency, database, build and startup commands.

## Run

```bash
npm run dev        # API on http://localhost:4000, web on http://localhost:3000
```

Or run one side: `npm run dev:api` / `npm run dev:web`.

### API endpoints

| Endpoint | Result |
| --- | --- |
| `GET /health` | `200` with `{"status":"ok"}` |
| `GET /products` / `GET /products/:id` | List or one product |
| `POST /products` / `PATCH /products/:id` | Create/update a product |
| `POST /research` | `202 { jobId, status }`; starts a run for `name`, `description`, `country`, `productId` |
| `POST /research/:jobId/resume` | `202`; resumes a stopped stage-03/04 run |
| `GET /research` | Research jobs |
| `GET /research/:jobId` | Job status, stage, result and error |
| `GET /settings` / `PATCH /settings` | Settings registry and validated updates |

The web app reads `API_URL` (default `http://localhost:4000`). The API has no CORS;
browser requests go through same-origin Next.js route handlers.

### Research flow

1. **01 product identification** — generate local product/category terms, search Exa and
   DeepSeek Search, prepare pages, and identify the local product and category names.
2. **02 page collection** — generate additional queries, search both providers, merge
   pages, and fetch missing text.
3. **03 page assessment** — derive study criteria once, assess every page, and produce
   `a`/`b`/`none` decisions with offer facts.
4. **04 company profiling** — profile each selected domain with Firecrawl homepage/contact
   pages and DeepSeek calls; build company, offer, market, price and contact records.

All four stages are connected in the current service. The normal completion path currently
stores a result without the company profiles, while the resume path stores `companies`;
see [research.md](docs/system/research.md) for the exact status and API implications. Do
not treat old fixture/replay or 02-company-discovery descriptions as current.

## Verification

```bash
npm run verify:web     # frontend gate: typecheck + lint + tests + format check
npm run e2e:web        # Playwright rendered scenarios against the mock API
npm run build          # API build + Next build; requires explicit authorization
```

`verify:web` is the mandatory gate for a frontend change. Include `e2e:web` in a task's
approved proof when the change affects rendered behavior. `build` and the dev servers need
explicit task authorization and may need a broader environment; they are not universal
“done” requirements. No command in this README was executed during SDR-002.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` / `dev:api` / `dev:web` | Run the app(s) |
| `npm run verify:web` | Frontend typecheck, lint, tests and format check |
| `npm run e2e:web` | Playwright against the mock API |
| `npm run build` | Build API and web |
| `npm run db:up` / `db:down` | PostgreSQL container |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Prisma migration |
| `npm run db:check` | Build API + database connectivity |

Workspace scripts (`typecheck`, `lint`, `test`, `format`, `format:check`, `e2e`) live in
`apps/web/package.json`; the API has its own `test` and database scripts. See
[harness.md](docs/system/harness.md) for the full command/prerequisite table.

## Documentation

- [PRODUCT.md](PRODUCT.md) — approved product requirements.
- [AGENTS.md](AGENTS.md) — agent authority and execution restrictions.
- [docs/system/harness.md](docs/system/harness.md) — operational workflow and commands.
- [docs/system/research.md](docs/system/research.md) — actual research implementation and
  known limitations.
- [docs/system/frontend.md](docs/system/frontend.md) — frontend conventions.
- [docs/system/environment.md](docs/system/environment.md) — environment observations.
- [docs/tasks/README.md](docs/tasks/README.md) — authoritative task registry.

`ops/current.md`, `ops/backlog.md`, `TODO.md` and `HANDOVER.md` are historical records, not
execution authorization or authoritative status. See the task registry for current work.
