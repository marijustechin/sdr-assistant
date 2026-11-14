# sdr-assistant

Monorepo with a **NestJS (Fastify)** API and a **Next.js** web app, backed by
**PostgreSQL** through **Prisma ORM 7**. Everything is **ESM-only**.

The app researches one product in one market: stage 01 identifies the product and
collects candidate pages, stage 02 discovers companies. Runs are asynchronous — the web
client starts a job and polls it.

## Stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------- |
| API      | NestJS 11 on Fastify, ESM (`"type": "module"`, NodeNext)       |
| Database | PostgreSQL 17 (Docker Compose) + Prisma ORM 7 (`@prisma/adapter-pg`) |
| Web      | Next.js 16 (App Router, Turbopack) + Tailwind CSS 4 + zod 4    |
| Tooling  | ESLint 10 (`eslint-config-next`) + Prettier 3, scoped to `apps/web` |
| Runtime  | Node.js >= 22 (tested on Node 24)                             |

## Layout

```text
.
├── docker-compose.yml        # PostgreSQL 17 on localhost:5433
├── apps/
│   ├── api/                  # NestJS + Fastify + Prisma
│   │   ├── prisma/schema.prisma
│   │   ├── prisma.config.ts  # Prisma CLI config (schema, migrations, datasource URL)
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── modules/health/     # GET /health
│   │       ├── modules/products/   # /products (create, list, get, update)
│   │       ├── modules/research/   # /research (start job, list, get) + pipeline stages
│   │       ├── modules/prisma/     # PrismaService / PrismaModule
│   │       └── scripts/            # check-db.ts
│   └── web/                  # Next.js
│       ├── app/              # routes, the polling proxy, globals.css
│       │   ├── api/research/[jobId]/route.ts   # same-origin proxy for the poller
│       │   ├── products/     # list, new, [id] (+ research form), [id]/edit
│       │   ├── researches/   # job list, [jobId] detail
│       │   └── health/
│       ├── _pages/           # FSD pages layer (not routable): research, researches
│       ├── entities/research/# api + model (zod schemas, types)
│       └── lib/              # api base URL, products, countries
├── docs/                     # system docs, decisions, audits, plans
├── ops/                      # current task + backlog
└── package.json              # npm workspaces + root scripts
```

Frontend conventions: [docs/system/frontend.md](docs/system/frontend.md).
Operating manual: [docs/system/harness.md](docs/system/harness.md).

## Prerequisites

- Node.js 22 or newer
- Docker (for PostgreSQL) — or any PostgreSQL server

## Setup

```bash
npm install
docker compose up -d          # starts PostgreSQL on localhost:5433
copy apps/api\.env.example apps/api\.env   # Windows (macOS/Linux: cp)
npm run db:check              # builds the API and verifies the DB connection
```

`npm install` runs `prisma generate` for the API workspace (the generated
client is written to `apps/api/src/generated/prisma` and is git-ignored).

Set `DEEPSEEK_API_KEY` (and the Exa/DeepSeek search keys) in `apps/api/.env` to run the
research pipeline.

> Port `5433` is used on the host to avoid clashing with an existing PostgreSQL
> on `5432`. Change `docker-compose.yml` and `DATABASE_URL` together if needed.

## Run

```bash
npm run dev        # API on http://localhost:4000, web on http://localhost:3000
```

or run each app separately:

```bash
npm run dev:api
npm run dev:web
```

### API endpoints

| Endpoint | Result |
| --- | --- |
| `GET /health` | `200` with `{"status":"ok"}` |
| `GET /products` | List products (newest first) |
| `GET /products/:id` | One product, or `404` |
| `POST /products` | Create a product (`name`, `description`) |
| `PATCH /products/:id` | Update a product (`name`, `description`) |
| `POST /research` | `202` with `{ jobId, status }`; starts an async run for `name`, `description`, `country`, `productId` |
| `GET /research` | List research jobs |
| `GET /research/:jobId` | One job: `status`, `stage`, `result`, `error` |

### Web routes

| Route | Result |
| --- | --- |
| `/` | Home with links |
| `/health` | API health, fetched live |
| `/products` | Product list |
| `/products/new` | Create-product form |
| `/products/:id` | Product detail + "Start research" form |
| `/products/:id/edit` | Edit-product form |
| `/researches` | Research job list |
| `/researches/:jobId` | Job detail; polls while `QUEUED`/`RUNNING` |
| `/api/research/:jobId` | Same-origin proxy used by the poller (the API has no CORS) |

The web app reads the API base URL from `API_URL` (default `http://localhost:4000`) — see
`apps/web/.env.example`. Writes go through Next.js server actions, so the API does not need
CORS; the browser only talks to same-origin route handlers.

### Research flow

1. `POST /research` validates the payload, creates a `Research` row (`QUEUED`) and returns
   `202 { jobId, status }`. While a run for the same product + country is `QUEUED`/`RUNNING`,
   the existing job id is returned instead of starting a second one.
2. The API starts the pipeline in-process and updates `status`, `stage` and finally `result`
   or `error`.
3. The detail page renders the server-side job and polls `GET /api/research/:jobId` every two
   seconds while it is `QUEUED`/`RUNNING`. Polling backs off on transport errors, stops on
   4xx and at a terminal status, and renders the result from the same job object — no second
   request is needed to show the output.

During stage-02 development the live stage-01 call is commented out in `ResearchService` and
the service reads the local `abachi-lt` identification fixture. Fixtures are git-ignored — see
[docs/system/harness.md](docs/system/harness.md) §6.

### Product API

```bash
curl -X POST http://localhost:4000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Analytics Suite","description":"Product analytics for SDR teams"}'
```

Validation (via `class-validator`): `name` is required, max 200 chars;
`description` is optional, max 2000 chars. `possibleSearchTerms` is an optional array of up to
50 strings (100 chars each) and is accepted by the API, but no current form sends it. Unknown
fields are rejected.

## Verification

```bash
npm run verify:web     # typegen + tsc + eslint --max-warnings=0 + vitest + prettier --check
npm run build          # API tsc + next build
```

`verify:web` is the gate for every frontend change. Tests cover the HTTP failure model, the
polling hook, navigation, theme, scroll, toasts and date formatting; page-level assertions are
the next step of the frontend plan. `npm run build` needs an unrestricted environment — in the
restricted DSH sandbox it compiles and then fails with `spawn EPERM` (see
[harness §4](docs/system/harness.md)); with full access it completes and lists the routes.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run API and web together |
| `npm run dev:api` / `npm run dev:web` | Run one side |
| `npm run verify:web` | Typecheck, lint, test and format-check `apps/web` |
| `npm run build` | Build API (`tsc`) and web (`next build`) |
| `npm run db:up` | Start PostgreSQL container |
| `npm run db:down` | Stop PostgreSQL container |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create/apply a Prisma migration |
| `npm run db:check` | Verify the PostgreSQL connection via Prisma |

Frontend-only scripts live in `apps/web/package.json` (`typecheck`, `lint`, `format`,
`format:check`) and are workspace-local on purpose: `apps/api` is owned by another workstream
and must not be reformatted.

## Prisma 7 notes

- `prisma.config.ts` is the source of truth for the CLI: schema location,
  migrations path and the datasource URL (`env("DATABASE_URL")`).
  Prisma 7 no longer auto-loads `.env`, so the config imports `dotenv/config`.
- The `datasource` block in `schema.prisma` contains only the provider.
- The generated client uses the new `prisma-client` generator with an explicit
  `output` (`src/generated/prisma`) and ESM imports (`.js` extensions).
- At runtime, `PrismaClient` is constructed with the `PrismaPg` driver adapter
  (the Rust query engine is gone in Prisma 7).
- Add models to `apps/api/prisma/schema.prisma`, then run
  `npm run db:migrate` and `npm run db:generate`.

## ESM notes

- Root and workspace `package.json` files set `"type": "module"`.
- The API compiles with `module`/`moduleResolution: NodeNext` and imports local
  files with explicit `.js` extensions.
- The API dev script runs `tsc --watch` alongside `node --watch dist/main.js`,
  so no CommonJS bundler or `ts-node` is involved.
