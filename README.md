# sdr-assistant

SDR Assistant researches one product in one target market: it identifies the product and
its local category, collects candidate pages, assesses each page, and builds company
profiles from the resulting offers. After a successful Stage 04 result, Stage 05 Contact
Discovery V1 automatically discovers and publishes usable company contact data. Runs are
asynchronous: the web client starts a job and polls its status.

This is a documentation-first, ESM monorepo with a NestJS/Fastify API and a Next.js web
app. The approved product requirements are in [PRODUCT.md](PRODUCT.md); the actual
four-stage research implementation, automatic Stage 05 integration and known discrepancies
are in [docs/system/research.md](docs/system/research.md).

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
│   │   └── src/modules/      health, products, research, settings, email-accounts, prisma
│   └── web/                  Next.js App Router
│       ├── app/              routes, polling proxy, styles
│       ├── _pages/           non-routable page compositions
│       ├── entities/         research, settings and email-account data layers
│       ├── features/         user actions (track-research, update-settings, manage-email-account)
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
| `GET /research/:jobId/lead-qualification` | Latest Stage 05 run for a research |
| `GET /research/:jobId/lead-qualification/published` | Current published Stage 05 run |
| `GET /lead-qualification-runs/:runId` | One Stage 05 run and its status |
| `POST /lead-qualification-runs/:runId/resume` | Recover an interrupted Stage 05 run |
| `GET /lead-qualification-runs/:runId/results` | Cursor-paginated retained/excluded Stage 05 results |
| `GET /settings` / `PATCH /settings` | Settings registry and validated updates |
| `GET /email-accounts` / `GET /email-accounts/:id` | Configured email accounts (no credentials) |
| `POST /email-accounts` / `PATCH /email-accounts/:id` | Create/update an email account, including enable/disable and the optional reusable signature |
| `POST /email-accounts/:id/test-smtp` / `POST /email-accounts/:id/test-imap` | Verify the saved SMTP or IMAP configuration (no sending, no mailbox access) |
| `GET /research/:jobId/communication/attachments` | Attachment metadata and the active limits (never the file bytes) |
| `POST /research/:jobId/communication/attachments` | Upload one attachment as a raw `application/octet-stream` body |
| `DELETE /research/:jobId/communication/attachments/:attachmentId` | Remove one research attachment |
| `POST /research/:jobId/communication/test-email` | Send one test email to a validated manual recipient through the assigned account |

The web app reads `API_URL` (default `http://localhost:4000`). The API has no CORS;
browser requests go through same-origin Next.js route handlers.

### Contacts

The research-detail Contacts tab reads the published Stage 05 Contact Discovery V1 result.
It shows retained companies, all usable company emails, expandable telephones, addresses,
registration identifiers and source links, with partner/distributor contacts kept separate.
Excluded companies and their actual exclusion reasons are available in a separate view.
Search and local pagination operate on the complete cursor-paginated API result.

Stage 05 starts automatically after a successful Stage 04 result. Its progress and failure
state are visible in Contacts. A Stage 05 failure never invalidates or replaces the Stage 04
result, and previous published Stage 05 results remain until a new complete result publishes.

### Email accounts

**Settings → Email accounts** manages the mailboxes that future outreach will use. Each
account has its own sender identity, SMTP settings, IMAP settings and an optional reusable
signature. Accounts can be created, edited, enabled and disabled; there is no hard deletion, no
sending and no incoming-mail synchronization.

The signature is optional and belongs to the account: closing greeting, company name, telephone
number, website link, WhatsApp link and additional text. The sender name is not a separate
signature field — it is taken from the account's existing **Sender name** field. Blank fields are
stored as unset, and the rendered order is closing greeting, sender name, company name, telephone,
website, WhatsApp and finally the additional text. Website and WhatsApp must be full `http://` or
`https://` links, so the research preview can render them as clickable anchors. The signature is
plain text — there is no rich-text editor — and it is reused by every research assigned to that
account.

Each protocol can be tested from the account list or the edit form. A test uses only the
saved configuration and requires a connection, TLS negotiation and authentication before it
reports **Verified**. Verification never sends an email and never opens, lists or reads a
mailbox. SMTP tests accept only ports 465 and 587; IMAP tests only 993 and 143. The
destination must resolve to a public address: loopback, private, link-local, reserved and
other non-public addresses are rejected, and the client connects to the validated address
while still validating the certificate against the configured host name.

SMTP and IMAP verification results are stored independently: `NOT_TESTED`, `VERIFIED` or
`FAILED`, with the last-checked time and a safe failure code (for example
`AUTHENTICATION_FAILED`, `CONNECTION_TIMEOUT`, `DNS_FAILURE` or `TLS_FAILURE`). The API
returns no raw provider response. Changing one protocol's host, port, security, username or
password resets only that protocol to `NOT_TESTED`; metadata edits and an empty password
field leave both results untouched. A result that arrives after its configuration changed is
discarded. Disabled accounts cannot be tested.

Passwords are encrypted with AES-256-GCM before they are written to PostgreSQL and are
never returned by the API — responses only carry `smtpPasswordConfigured` /
`imapPasswordConfigured`. Editing an account with an empty password field keeps the stored
credential; a non-empty value replaces it.

Encryption needs `EMAIL_ACCOUNT_ENCRYPTION_KEY` in `apps/api/.env`: exactly 32 random bytes
encoded as Base64. Generate it with:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
```

There is no default key and no plaintext fallback, so creating or updating an account fails
safely while the variable is missing or invalid. The value must never be committed.

The application has no end-user authentication yet. Email-account management and connection
testing therefore belong to the trusted local deployment only and must not be exposed
publicly.

The `email_accounts` table is created by the additive migration
`20261125230000_add_email_account`; the independent verification columns are added by the
additive migration `20261126120000_add_email_account_verification`. Both are recorded in the
repository and applied to the local database (15 of 15 migrations as of 2026-11-28). Real-provider connection
verification is a separate owner-authorized step; it was completed on 2026-11-26 for the
configured account, so connection verification no longer depends on the mock API.

### Initial email composition

The research **Settings → Initial email** section holds the owner-authored subject and plain-text
message, and shows exactly what will be composed: the assigned account's signature, the research's
attachments and a complete preview of subject, message, signature and attachment list. Nothing is
sent automatically; an explicit test send is described below.

Attachments belong to the research, not to the email account. They are uploaded through a Server
Action as a raw binary body, stored privately in PostgreSQL (`research_attachments`) together with
their filename, media type, size and SHA-256, and listed with filename and size. Only metadata is
ever returned by the API; the file bytes are never served over HTTP. Removal deletes metadata and
content together. The limits are configurable in `apps/api/.env`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `ATTACHMENT_MAX_FILE_BYTES` | 10 MiB | Maximum size of one attachment |
| `ATTACHMENT_MAX_ATTACHMENTS` | 5 | Maximum attachments per research |
| `ATTACHMENT_MAX_TOTAL_BYTES` | 25 MiB | Maximum total attachment bytes per research |

Uploads are validated on the client for immediate feedback and again by the API, which is
authoritative. The signature columns and the attachment table are added by the additive migration
`20261127233000_add_signature_and_research_attachments`, and the test-send audit table by
`20261128190000_add_research_test_email_sends`; both are applied to the local database (15 of 15
migrations as of 2026-11-28).

Below the complete preview, **Send test email** sends exactly one message to a manually entered
recipient through the assigned account, after the recipient is validated. Sending requires a saved
composition: unsaved subject or message changes block it. The message uses the saved subject,
message, the account's closing greeting and sender name, the remaining signature fields in the
accepted order and every research attachment. The screen shows sending progress and the actual
result — a definitive failure, or an uncertain acceptance that says the message may or may not
have been delivered. There is no automatic retry. Each attempt is recorded separately in
`research_test_email_sends`; the prepared recipient queue, first-contact statistics and automatic
communication are never touched. First-contact execution (SDR-012) remains planned.

### Research flow

1. **01 product identification** — generate local product/category terms, search Exa and
   DeepSeek Search, prepare pages, and identify the local product and category names.
2. **02 page collection** — generate additional queries, search both providers, merge
   pages, and fetch missing text.
3. **03 page assessment** — derive study criteria once, assess every page, and produce
   `a`/`b`/`none` decisions with offer facts.
4. **04 company profiling** — profile each selected domain with Firecrawl homepage/contact
   pages and DeepSeek calls; build company, offer, market, price and contact records.

All four stages are connected in the current service. Both the normal and the resumed completion
path persist the complete stage-04 company profiles under one versioned final-result contract
(`schemaVersion: 1`, `completedThrough`, `companies`, optional `summary` and `resultsPerQuery`);
older rows keep their historical envelopes. See
[SDR-006A](docs/tasks/SDR-006A-final-research-result-persistence.md) for the contract and
[research.md](docs/system/research.md) for the rest of the pipeline. Do not treat old
fixture/replay or 02-company-discovery descriptions as current.

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
