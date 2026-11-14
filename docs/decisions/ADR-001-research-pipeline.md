# ADR-001 — Research pipeline (01 → 02)

- **Status:** draft — **owned by the research workstream**, not by the frontend workstream
- **Date:** 2026-11-14
- **Source of truth:** `apps/api/src/modules/research/**` and [HANDOVER.md](../../HANDOVER.md).
  If this document disagrees with the code, the code wins.

> This draft records only what the frontend depends on. Do not extend it with pipeline
> decisions made elsewhere without the owner's review.

## Context

A research run answers one question: which companies in **one market** are relevant to
**one product**. The input is `name`, `description`, `country` (English country name); the
country determines the single target language for the run. Runs are asynchronous: `POST
/research` creates a job and the client polls `GET /research/:jobId`.

Stages:

- **01-product-identification** — English product name/description + country →
  `productName`, `categoryName`, `generalCategoryName`, plus candidate pages gathered with
  Exa and DeepSeek Search (deduplicated and merged).
- **02-company-discovery** — consumes an identification fixture and is expected to produce
  the company discovery result. Currently a skeleton; not validated or hardened.

Temporary state (2026-11-14): the live stage-01 call is commented out in `ResearchService`;
the service reads the local `abachi-lt` fixture and calls `CompanyDiscoveryService`. Fixtures
live in a git-ignored `temp/` directory and are never committed.

## Decisions recorded so far

1. One run = one product + one market/language. No language lists, no per-language batching.
2. Both Exa and DeepSeek Search are used; they complement each other.
3. Stage 01 returns three names: product, category, broader general category.
4. No per-page evidence taxonomy in the current flow.
5. Fixtures exist for stage-02 development; raw page content stays out of git.
6. The final-answer schema and the prompt must stay in sync.
7. `POST /research` is **idempotent for an active run**: before creating, the service looks
   for an existing run with the same `productId` + `country` in `QUEUED`/`RUNNING` and returns
   its `jobId` (`research.service.ts:29-47`). A submit retried after a lost response therefore
   reopens the same job instead of paying for a second run. It is **not** idempotent after a
   terminal status — a new run is created, which is the intended behaviour.
   Limitation: the check is read-then-create without a unique constraint, so two concurrent
   requests can still create two runs. A partial unique index on
   `(productId, country) WHERE status IN ('QUEUED','RUNNING')` would close that; it is a
   backend change, tracked in `ops/backlog.md`.

## Consequences for the frontend

- `research.result` is an open JSON value. Stage 02 currently returns the literal string
  `"completed"` (`company-discovery.service.ts:59`), so the web app types it as `unknown` and
  renders it defensively (plan §2.3). A typed renderer waits for a stable stage-02 schema.
- `POST /research` returns `202` with `{ jobId, status }`; the client redirects to
  `/researches/{jobId}` and polls. `POST` is idempotent while a run for the same
  product + country is `QUEUED`/`RUNNING` — it returns the existing job id.
- `INTERRUPTED` exists in the status enum but is never written, and `lastHeartbeatAt` is
  never updated, so a crashed run stays `RUNNING`. The frontend shows a stale hint from
  `updatedAt` meanwhile (plan 2.8). This is a backend gap, tracked in `ops/backlog.md`.
- `GET /research` returns rows without ordering, pagination or product data; the frontend
  sorts locally and joins against `/products` until the API changes.

## Open questions for the owner

1. What is the stable output schema of stage 02, and when does it become contractual?
2. Should `result` be a JSON object (current column type allows it) or a JSON string?
3. Will the heartbeat / `INTERRUPTED` reconciliation be implemented, or should the frontend
   stop polling after a timeout?
4. Does `GET /research` get `orderBy`/pagination, and does it include the product?
5. Should the API accept a country code instead of an English country name (the web app
   currently sends the name)?
