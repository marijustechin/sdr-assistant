# sdr-assistant

Monorepo with a **NestJS (Fastify)** API and a **Next.js** web app, backed by
**PostgreSQL** through **Prisma ORM 7**. Everything is **ESM-only**.

## Stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------- |
| API      | NestJS 11 on Fastify, ESM (`"type": "module"`, NodeNext)       |
| Database | PostgreSQL 17 (Docker Compose) + Prisma ORM 7 (`@prisma/adapter-pg`) |
| Web      | Next.js 16 (App Router, Turbopack)                            |
| Runtime  | Node.js >= 22 (tested on Node 24)                             |

## Layout

```
.
├── docker-compose.yml        # PostgreSQL 17 on localhost:5433
├── apps/
│   ├── api/                  # NestJS + Fastify + Prisma
│   │   ├── prisma/schema.prisma
│   │   ├── prisma.config.ts  # Prisma CLI config (schema, migrations, datasource URL)
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── health/       # GET /health
│   │       ├── products/     # /products endpoint (create, list, get)
│   │       ├── research/     # POST /research (DeepSeek product profile)
│   │       ├── prisma/       # PrismaService / PrismaModule
│   │       └── scripts/      # check-db.ts
│   └── web/                  # Next.js
│       ├── lib/api.ts        # API base URL helper
│       └── app/
│           ├── page.tsx
│           ├── health/page.tsx
│           └── products/
│               ├── page.tsx          # product list
│               ├── actions.ts        # server action (create product)
│               ├── new/              # product form
│               └── [id]/             # product detail, research + edit form
└── package.json              # npm workspaces + root scripts
```

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

Set `DEEPSEEK_API_KEY` in `apps/api/.env` to enable `POST /research` (the API
calls DeepSeek and logs the generated product profile).

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

### Endpoints

| URL                              | Result                                  |
| -------------------------------- | --------------------------------------- |
| `GET http://localhost:4000/health` | `200` with `{"status":"ok"}`          |
| `GET http://localhost:4000/products` | List products (newest first)        |
| `GET http://localhost:4000/products/:id` | One product, or `404`          |
| `POST http://localhost:4000/products` | Create a product (`name`, `description`) |
| `PATCH http://localhost:4000/products/:id` | Update a product (`name`, `description`) |
| `POST http://localhost:4000/research` | Run DeepSeek research (`name`, `description`, `country`) |
| http://localhost:3000/health     | Page that fetches and shows API health  |
| http://localhost:3000/products   | Product list                            |
| http://localhost:3000/products/new | Create-product form                  |
| http://localhost:3000/products/:id | Product detail + "Start research" form |
| http://localhost:3000/products/:id/edit | Edit-product form                 |

The web app reads the API base URL from `API_URL` (default
`http://localhost:4000`) — see `apps/web/.env.example`. The create form posts
through a Next.js server action, so the API does not need CORS for it.

### Product API

```bash
curl -X POST http://localhost:4000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Analytics Suite","description":"Product analytics for SDR teams"}'
```

Validation (via `class-validator`): `name` is required, max 200 chars;
`description` is optional, max 2000 chars. Unknown fields are rejected.

The product detail page (`/products/:id`) has a **Start research** form. It posts
the product name, description and selected country to `POST /research`, which
asks DeepSeek (`deepseek-flash`) for a product profile, logs the result, and
returns `{ "status": "completed" }`.

## Scripts

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Run API and web together                          |
| `npm run build`     | Build API (`tsc`) and web (`next build`)          |
| `npm run db:up`     | Start PostgreSQL container                        |
| `npm run db:down`   | Stop PostgreSQL container                         |
| `npm run db:generate` | Generate Prisma Client                          |
| `npm run db:migrate`  | Create/apply a Prisma migration                 |
| `npm run db:check`    | Verify the PostgreSQL connection via Prisma     |

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
