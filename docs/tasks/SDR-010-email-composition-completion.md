# SDR-010 — Email Composition Completion

## 1. Task ID and status

- **Task ID:** SDR-010
- **Title:** Email Composition Completion
- **Status:** `DONE / HUMAN_APPROVED` — implementation, focused proofs, the two additive
  migrations and one owner-performed real test email were accepted by the human owner on
  2026-11-28; see §15.
- **Registry:** [README.md](README.md)
- **Checkpoint at start:** `04a2074` (`feat: add initial email settings and automatic recipient
  queue`), the accepted SDR-009 scope. The working tree is the implementation baseline; it
  contains the same 30 pre-existing untracked research/tooling artifacts recorded in
  [SDR-009 §8](SDR-009-initial-email-and-recipient-queue.md#8-excluded-artifact-baseline-before-implementation).
- **Execution mode at implementation (preserved):** standard session environment. No dependency
  installation, no live database change or deployment, no paid provider call, no SMTP/IMAP
  connection and no email send. Later owner-approved steps deployed the two additive migrations
  locally (§12, §14.4); the owner performed the only real test send (§15).
- **Research Implementation Freeze:** fully active. No Stage 01–05 algorithm, prompt, provider,
  stage-orchestration, classification or research-result change was made.

## 2. Objective

Complete the existing initial email composition with a reusable signature owned by the email
account and with attachments owned by the research, and preview the complete composed email
(subject, message, signature and attachment list) before any sending exists.

## 3. Authorized scope and paths

- Extend the global **Email accounts** settings with an optional, reusable signature: name,
  company name, telephone number, website link, WhatsApp link and additional text. All fields are
  optional; website and WhatsApp are validated HTTP(S) links; the signature is plain text, so no
  rich-text editor or new dependency is introduced.
- Extend the research **Settings → Initial email** section with: a preview of the assigned
  account's signature, attachment upload, an attachment list with filename and size, attachment
  removal, and a preview of the complete initial email including signature and attachment list.
  The existing subject/message functionality and recipient queue are preserved.
- Persist research attachments (metadata and file bytes) using PostgreSQL; validate uploads and
  enforce configurable per-file, per-research count and total-size limits; keep attachment
  content private and out of the Git repository.
- Add one additive Prisma migration: six nullable columns on `email_accounts` and one new
  `research_attachments` table. No existing column, row or table is altered.
- Extend the existing Playwright mock API and add rendered scenarios; add focused backend and
  frontend tests.
- Record the approved product direction in `PRODUCT.md`, this task in `docs/tasks/README.md` and
  the implemented behaviour in `README.md`.

Planned path scope (the final exact inventory is recorded in §9):

- `apps/api/prisma/schema.prisma` and one new additive migration
- `apps/api/src/modules/email-accounts/**`
- `apps/api/src/modules/research-communication/**`
- `apps/api/src/main.ts`
- `apps/api/.env.example`
- `apps/api/test/email-accounts.test.ts`
- `apps/api/test/research-attachments.test.ts`
- `apps/web/app/globals.css`
- `apps/web/next.config.ts`
- `apps/web/shared/api/http.ts`
- `apps/web/entities/email-account/**`
- `apps/web/entities/research/**`
- `apps/web/features/manage-email-account/**`
- `apps/web/features/track-research/**`
- `apps/web/_pages/research/**`
- `apps/web/e2e/mock-api.mjs`
- `apps/web/e2e/research-email-composition.spec.ts`
- `PRODUCT.md`, `README.md`, `docs/tasks/README.md`, this document

## 4. Explicit exclusions

- No email sending, SMTP or IMAP connection, mailbox synchronization, mailbox check, first-contact
  scheduler or delivery simulation.
- No mailbox-history inspection before outreach and no previous-communication awareness: these
  belong to SDR-011 and are recorded only as product direction in `PRODUCT.md`.
- No live provider call, no LLM call and no research rerun.
- No Stage 01–05 algorithm, prompt, provider, research-execution, research-result or
  research-orchestration change; `apps/api/src/modules/research` is not modified.
- No live database migration deployment, no database row modification and no database connection
  in the canonical proof.
- No attachment content analysis, file-content preview, download endpoint or public file serving.
- No rich-text editor, template variables, AI generation, scheduling settings or placeholder
  controls for future features.
- No new dependencies, dependency upgrades or architecture change.
- No unrelated refactoring, formatting of unrelated files or repository-wide tooling.
- No deletion, move, formatting or modification of the pre-existing untracked artifacts.
- No commit or push before human acceptance.

## 5. Acceptance criteria

- Signature settings persist after reload.
- The assigned account signature appears in the research email preview.
- Website and WhatsApp links are clickable.
- Attachments can be added, listed and removed.
- Attachments persist across application restart.
- Existing initial email settings and recipient queue remain functional.
- No real email is sent.
- No private attachment or credential is exposed.

## 6. Design decisions

### Signature storage and rendering

- The signature is six nullable text columns on `email_accounts` (`signatureName`,
  `signatureCompany`, `signaturePhone`, `signatureWebsite`, `signatureWhatsapp`,
  `signatureText`). It belongs to the account and is reused by every research assigned to that
  account; a research stores no copy, so editing the account signature changes every preview
  consistently.
- The wire contract keeps the existing flat account DTO (`signatureName`, …) and returns a nested
  `signature: { name, companyName, phone, website, whatsapp, text }` object where every unset
  field is `null`. The explicit mapper lists each field, so no credential column can leak through
  a spread.
- A blank form value is transformed to `null`; a `PATCH` field that is absent is left unchanged.
  Signature edits never touch SMTP/IMAP configuration, so they never invalidate a verification
  result.
- Website and WhatsApp are validated as `http`/`https` URLs by class-validator in the API and
  again by zod before submission. The client re-validates the stored value with `toHttpUrl` before
  rendering an anchor, so a malformed value can never become a `javascript:` link. The
  signature text is rendered as React text; there is no HTML or rich-text storage, no editor
  dependency and no injection surface.
- The preview shows the signature lines in a fixed order (name, company, phone, website,
  WhatsApp, additional text) and repeats the same block inside the complete email preview.

### Attachment storage and lifecycle

- An attachment is one row in `research_attachments`: research id, sanitised display filename,
  media type, size, SHA-256 integrity value, the raw bytes (`bytea`) and timestamps. Metadata and
  content are written and deleted in one row, so there is no orphaned file, no partial write and
  no second source of truth.
- **Why PostgreSQL instead of a filesystem:** the task asks for safe file access and warns about
  path traversal and unintended public exposure. Storing the bytes in the database removes that
  entire class of bug — the filename is display metadata and is never used as a path, there is no
  upload directory to misconfigure or accidentally serve, the file survives an application
  restart, and it is included in the existing database backup. With a handful of small documents
  per research the database is also the simpler operational choice: no new configuration, no
  cleanup job and no new dependency.
- Uploads travel as a raw `application/octet-stream` body. The filename and media type are
  percent-encoded headers, because the body is the file itself. Nest keeps its normal JSON and
  form limits; only this one media type gets a configured body limit of the per-file limit plus
  envelope headroom. No multipart dependency is added.
- Validation: empty body rejected; per-file limit enforced by the transport parser and again by
  the service; attachment count and total size enforced inside the insert transaction; the
  filename must be non-empty, at most 200 characters and free of path separators, control
  characters and the bare `.`/`..`; a malformed media type becomes `application/octet-stream`.
  Limits are configurable through `ATTACHMENT_MAX_FILE_BYTES`, `ATTACHMENT_MAX_ATTACHMENTS` and
  `ATTACHMENT_MAX_TOTAL_BYTES` (defaults 10 MiB, 5 and 25 MiB; hard ceilings 50 MiB, 20 and
  100 MiB). Invalid values fall back to the defaults.
- The API exposes attachment **metadata only**. No endpoint selects or returns `content`, so the
  file bytes are unreachable from the browser. Removal is scoped to the research: an id from
  another research is reported as not found.

### Complete preview and future SMTP construction

- The preview is composed on the client from the saved subject and message, the assigned
  account's signature and the attachment metadata already loaded by the page. It renders exactly
  what the future message builder will use: plain-text body, structured signature with clickable
  links, and the attachment list. It never renders HTML and never claims a message was sent.
- The persisted plain-text message plus the structured signature columns are sufficient for SMTP
  construction: the future sender can serialize `body`, the ordered signature fields and the
  attachment rows without parsing any markup. No minimal-HTML representation was introduced
  because nothing in this task needs HTML and HTML would add an escaping surface.
- Attachment bytes are deliberately not exposed over HTTP; a future SMTP builder will read them
  server-side through the same persistence layer.

### API and frontend shape

- `GET/PATCH /research/:jobId/communication` is unchanged, so the SDR-009 settings and queue
  contract stays intact. Attachments use a dedicated additive resource:
  `GET/POST /research/:jobId/communication/attachments` and
  `DELETE .../attachments/:attachmentId`. The account list already travels to the research page,
  so the signature needs no new research endpoint.
- The research page loads communication settings, accounts, attachments and the prepared queue in
  parallel; each failure renders inside its own block. Attachments and the initial email are
  lifted above the tab content so an upload or save survives tab switching.
- Uploads and removals are Server Actions (the project convention for mutations). The action body
  limit is raised to 52 MB in `next.config.ts` so the API remains the authoritative limit rather
  than the framework silently rejecting a file the API would accept.

## 7. Single proof command

The canonical proof is:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run build --workspace @sdr-assistant/api
    if ($LASTEXITCODE -ne 0) { throw 'API build failed' }

    npm.cmd run test --workspace @sdr-assistant/api -- test/email-accounts.test.ts test/research-attachments.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'Backend signature and attachment tests failed' }

    npm.cmd run verify:web
    if ($LASTEXITCODE -ne 0) { throw 'Frontend verification failed' }

    npm.cmd run e2e:web
    if ($LASTEXITCODE -ne 0) { throw 'Playwright verification failed' }

    Write-Output 'PASS: SDR-010 email composition, signatures and attachments'
}
```

The proof uses synthetic fixtures and the mock API only. It performs no SMTP/IMAP connection, no
email send, no mailbox synchronization, no paid provider call and no live database change. It
includes the mandatory `verify:web` gate and the rendered-behaviour Playwright gate.

## 8. Verification result

**PASS.** The single canonical proof command in §7 was executed against the final implementation
on 2026-11-27 (started 22:52 Europe/Vilnius) with **exit code 0** and final line
`PASS: SDR-010 email composition, signatures and attachments`.

The command was first executed at 22:48 and passed with 57/57 backend tests. One
fresh-service-instance persistence test was then added to strengthen the application-restart
acceptance criterion, and the canonical proof was re-executed on the final code; the result below
(58/58) is the evidence. Before the canonical runs, development checks used the same focused
commands and the focused Playwright spec.

| Gate | Result |
| --- | --- |
| API build (`prisma generate` + `tsc -p tsconfig.json`) | **PASS** — Prisma Client generated for the signature columns and the attachment model; TypeScript compiled |
| Focused backend tests | **PASS — 58/58** tests in 2 files (31 email-account + 27 attachment) |
| `verify:web` | **PASS** — `next typegen`/`tsc --noEmit`, ESLint (0 warnings), **223/223** Vitest tests in 26 files, Prettier |
| `e2e:web` | **PASS — 51/51** Playwright scenarios, 0 failed, 0 skipped, **1.6m** |

The 51 rendered scenarios comprise the 48 preserved SDR-004/005/007/007A/008/009 scenarios plus
three new SDR-010 scenarios:

1. The account signature is edited in the global email-account form, persists across a full
   reload, and appears in the research Settings tab both as a signature preview and inside the
   complete email preview, with clickable website and WhatsApp links; the subject and message
   preview is shown and no sending control exists.
2. Two synthetic attachments are uploaded, listed with filename and size, counted in the preview
   and persist across full reloads; one is removed and the removal also survives a reload.
3. An attachment above the configured per-file limit is rejected before upload and the list
   stays empty.

Rendered evidence (git-ignored `apps/web/test-results/`):

- `research-email-composition-…/sdr-010-signature-preview-desktop.png`
- `research-email-composition-…/sdr-010-attachments-desktop.png`

No live database change, SMTP/IMAP connection, email send, mailbox synchronization, research
rerun or paid provider call occurred during the proof. The running `node --watch` dev API
restarted its child process when the build wrote `dist/`; see §10 item 10 for the resulting local
state.

All 30 pre-existing untracked artifacts were re-hashed after the proof against the
[SDR-008 §8](SDR-008-research-email-account-assignment.md#8-excluded-artifact-baseline-before-implementation)
SHA-256 baseline: **30/30 unchanged, 0 mismatches**. The working tree contains those 30 artifacts
plus the new SDR-010 source, test and task files.

## 9. Implementation record and changed files

### Backend

- Added the six nullable signature columns to `EmailAccount` and the `ResearchAttachment` model
  (research relation, filename, media type, size, SHA-256, `bytea` content, timestamps, research
  index, cascade delete). The additive migration
  `20261127233000_add_signature_and_research_attachments` creates exactly those columns, the
  table, its index and its foreign key; it was **not deployed**.
- Extended the email-account create/update DTOs, service and mapper with the optional signature.
  Blank values become `null`, absent `PATCH` fields stay unchanged, URLs are validated, and a
  signature edit never resets a protocol verification.
- Added `attachment-limits.ts` (configurable limits, hard ceilings, transport body limit, size
  formatting) and `research-attachments.service.ts` (metadata listing, validated transactional
  upload, research-scoped removal with SHA-256 integrity metadata, content never returned).
  Registered the service and added the three attachment endpoints to the
  research-communication controller; the existing endpoints are unchanged.
- Registered the raw `application/octet-stream` content-type parser with the configured body
  limit in `apps/api/src/main.ts`.
- Extended `test/email-accounts.test.ts` (signature mapping, DTO validation, create/update,
  verification preservation) and added `test/research-attachments.test.ts` (limits, validation,
  unsafe filenames, count/total enforcement, metadata-only responses, research isolation,
  removal, and reading a persisted attachment through a fresh service instance as the
  application-restart path).

### Frontend

- Extended the email-account wire schema and form reader with the optional signature, its length
  and URL validation, and a `hasSignatureContent` helper. Added the **Signature** card to the
  create/edit account form.
- Added the research attachment wire schema, server-side API calls (raw upload, delete), browser
  types, and the upload/remove Server Actions.
- Extended the research Settings tab with the signature preview, the attachment manager (upload,
  filename/size list, removal, limits hint, error and empty states) and the complete email
  preview. The existing email-account assignment and initial-email save behavior is unchanged.
- Lifted the attachments state beside the existing communication state so tab switching keeps
  uploads and removals visible; the research page loads attachments in parallel with the other
  communication data.
- Added component classes for signatures, previews and attachment rows to `globals.css`, and
  raised the Server Action body limit in `next.config.ts` with an explanatory comment.
- Added `initial-email-preview` model tests and extended the account schema, account form and
  research Settings tests.

### E2E

- Extended the mock API with account signatures, research attachment metadata/limits, raw upload
  and removal endpoints, and reset support.
- Added `research-email-composition.spec.ts` with the three scenarios listed in §8.

### Documentation

- `PRODUCT.md`: replaced the previous autonomous-direction section with the owner-approved
  simplified model (one initial contact per company, no automatic follow-ups, communication only
  after a response, prior-mailbox-history check, immediate or scheduled first contact, X-minute
  interval, no campaign calendar, twice-daily global sync, per-mailbox **Check mail now**,
  persistent history and response statistics) and the revised SDR-010…SDR-013 roadmap.
- `docs/tasks/README.md`: registered SDR-010.
- `README.md`: documented the signature, the research attachments and their limits.
- This task document.

### Changed files

```text
M  apps/api/prisma/schema.prisma
A  apps/api/prisma/migrations/20261127233000_add_signature_and_research_attachments/migration.sql
M  apps/api/src/main.ts
M  apps/api/src/modules/email-accounts/dto/create-email-account.dto.ts
M  apps/api/src/modules/email-accounts/dto/update-email-account.dto.ts
M  apps/api/src/modules/email-accounts/email-accounts.mapper.ts
M  apps/api/src/modules/email-accounts/email-accounts.service.ts
M  apps/api/src/modules/research-communication/research-communication.controller.ts
M  apps/api/src/modules/research-communication/research-communication.module.ts
A  apps/api/src/modules/research-communication/attachment-limits.ts
A  apps/api/src/modules/research-communication/research-attachments.service.ts
M  apps/api/.env.example
M  apps/api/test/email-accounts.test.ts
A  apps/api/test/research-attachments.test.ts
M  apps/web/_pages/research/ui/research-page.tsx
M  apps/web/app/globals.css
M  apps/web/e2e/mock-api.mjs
A  apps/web/e2e/research-email-composition.spec.ts
M  apps/web/entities/email-account/client.ts
M  apps/web/entities/email-account/index.ts
M  apps/web/entities/email-account/model/schema.ts
M  apps/web/entities/email-account/model/schema.test.ts
A  apps/web/entities/research/api/attachments.server.ts
M  apps/web/entities/research/client.ts
M  apps/web/entities/research/index.ts
A  apps/web/entities/research/model/attachments.ts
M  apps/web/features/manage-email-account/ui/email-account-form.test.tsx
M  apps/web/features/manage-email-account/ui/email-account-form.tsx
A  apps/web/features/track-research/api/attachment-actions.ts
M  apps/web/features/track-research/index.ts
A  apps/web/features/track-research/model/initial-email-preview.test.ts
A  apps/web/features/track-research/model/initial-email-preview.ts
M  apps/web/features/track-research/model/research-settings.test.ts
M  apps/web/features/track-research/model/research-settings.ts
A  apps/web/features/track-research/ui/initial-email-preview.tsx
M  apps/web/features/track-research/ui/research-settings.test.tsx
M  apps/web/features/track-research/ui/research-settings.tsx
M  apps/web/features/track-research/ui/research-workspace.tsx
M  apps/web/next.config.ts
M  apps/web/shared/api/http.ts
M  PRODUCT.md
M  README.md
M  docs/tasks/README.md
A  docs/tasks/SDR-010-email-composition-completion.md
```

`apps/api/src/modules/research`, all Stage 01–05 code, prompts, providers and research-result
handling are untouched. Generated Prisma/Next outputs and Playwright results are git-ignored and
are not part of the change set.

## 10. Remaining limitations or blockers

1. **Migration not deployed.** The additive migration is authored and validated by the Prisma
   generation in the API build but has not been applied to the live database. The generated Prisma
   client selects the new signature columns, so the new code must not be started before
   `prisma migrate deploy` applies this migration; starting it first would make email-account
   queries fail with a missing-column error. Live persistence of the signature and attachments
   needs the owner-authorized protected backup, `prisma migrate deploy` and then an API restart.
2. **No live-API/live-database acceptance run.** Signature and attachment behaviour was verified
   with synthetic fixtures, an in-memory Prisma stand-in and the Playwright mock API, not against
   the running NestJS API and PostgreSQL. Live acceptance remains for the owner after deployment.
3. **Restart persistence is verified at the persistence layer.** The bytes live in PostgreSQL, so
   they survive an application restart and a database backup. A backend test reads an uploaded
   attachment through a fresh service instance over the same persisted store, which is the
   application-restart path, but the canonical proof did not restart PostgreSQL. A live
   deployment followed by an API restart remains the acceptance step.
4. **No file download or content preview.** Only metadata is exposed by design; the owner cannot
   inspect attachment contents in the application yet. There is no attachment content analysis.
5. **Limits are global.** The same three configurable limits apply to every research; there are
   no per-research overrides. The web Server Action body limit is fixed at 52 MB while the API
   limit is environment-configurable up to 50 MiB.
6. **Upload limits are enforced per request.** The count and total checks run inside the insert
   transaction, so concurrent uploads serialize on the database; the transaction does not use a
   serializable isolation level, so a pathological concurrent burst could still be reported as a
   limit failure rather than a partial write. No file is written outside the database.
7. **Signature reuse is by reference.** Editing an account signature changes the preview of every
   research assigned to that account, including historical ones. There is no per-research
   signature snapshot; that belongs to the future first-contact history if it is needed.
8. **Preview is not a send simulation.** It composes subject, message, signature and attachment
   metadata; it does not render HTML, resolve variables or create a message record.
9. The agent did not stop, restart or redeploy the running local services. The running API on
   `127.0.0.1:4000` is a `node --watch` development process; its watcher restarted the child when
   the proof built `dist/`, which is the behaviour described in item 10.
10. **Local dev API is temporarily incompatible with the live schema.** The proof's API build
    replaced `apps/api/dist`, and the already-running `node --watch` dev API restarted at
    22:48:04 (process creation time; `GET /health` still returns 200). Because the additive
    migration is not applied, `GET /email-accounts` on `127.0.0.1:4000` now returns a generic
    HTTP 500; the signature columns are the only schema change in this build, which is the
    consistent explanation (not independently confirmed against the database, because no
    connection was made). The research endpoints and the web server on port 3000 still run. The
    owner must apply the additive migration and restart the API to restore email-account and
    communication persistence; alternatively stop the dev stack until then. No migration was
    applied and no database row or schema was modified by this task.

## 11. Final status

`READY_FOR_HUMAN_REVIEW` — the implementation and the single canonical proof are complete, the
migration is authored and (as of 2026-11-28) applied locally, and nothing was committed or pushed.
Human acceptance is required before any closure, deployment or commit.

> **Update 2026-11-28:** the additive migration is applied in the local database (14/14, schema up
> to date), the live signature UI was confirmed reachable, and the stale dev stack was stopped;
> §10 items 1 and 10 are resolved locally. See §12. A signature display-order correction was then
> applied and verified with a focused proof; see §13. Finally the owner requested and approved a
> single-message **Send test email** feature; see §14 (its additive migration is applied locally).
> The owner then performed a real test send and accepted the task as `DONE / HUMAN_APPROVED`;
> see §15.

## 12. Local environment reconciliation — 2026-11-28

After a human review message reported that live signature testing was blocked, the local
development state was inspected (read-only where possible) and cleaned up. No source, test,
migration or database content was changed by this step.

- `prisma migrate status`: **14 migrations found**, `Database schema is up to date!` — the
  additive `20261127233000_add_signature_and_research_attachments` migration is applied in the
  local `sdr_assistant` database. This resolves §10 item 1 for the local environment; the
  deployment itself was not performed by this task.
- The live API on `127.0.0.1:4000` answered `GET /health` 200 and `GET /email-accounts` 200 with
  a `signature` object for each account. The live web app served
  `/settings/email-accounts/:id/edit` 200 with the **Signature name**, **Website link**,
  **WhatsApp link** and **Additional signature text** fields. The signature feature is therefore
  reachable for live testing.
- A stale detached `npm run dev` stack from 2026-11-27 21:51 (launcher PID 105896, web PID 24236,
  API watcher PID 72156) was still running and occupying ports 3000/4000; its API child had
  restarted at 22:48 during the SDR-010 proof. The whole process tree was stopped on 2026-11-28.
  Ports 3000 and 4000 are free; only PostgreSQL on `127.0.0.1:5433` remains listening, and no
  other `sdr-assistant` node/cmd process remains.
- §10 item 10 (local dev API returning 500 for email-account reads) is therefore resolved.
- Process discipline adopted for future work: after any build, dev-server or verification run,
  leave **both** the frontend and the backend running or **neither** — never one of them. The
  final report must state which processes are running and on which ports.
- SDR-010 remains `READY_FOR_HUMAN_REVIEW`; no commit or push was performed.

## 13. Signature display-order correction — 2026-11-28

Authorized by the owner after practical verification ("practical verification passed, with one
minor signature correction"). No schema change, no backend change, no unrelated change and no full
regression suite.

### 13.1 Diagnosis

The live account row had a closing greeting stored in `signatureName`, a non-empty `senderName`,
and additional text still containing the owner's exploratory note.

- `signatureName` was not missing from the renderer: it was displayed as the first signature line.
- The actual gap was that the account's existing **`senderName`** was never part of the signature,
  so no person's name appeared between the greeting and the company.
- Because the form had no separate closing-greeting slot, the owner had stored the greeting in
  `signatureName`.

### 13.2 Correction

- `signatureName` now carries the closing greeting: the form label is **Closing greeting** and it
  renders first. The existing column is reused — no new field and no migration.
- The sender name renders second from the account's existing **`senderName`** field (the one in
  the General section); no second, signature-only name field was introduced.
- Order: closing greeting → sender name → company name → telephone → website → WhatsApp →
  additional signature text.
- One builder (`signatureLines(signature, senderName)`) feeds both the signature preview and the
  complete email preview, so the order and content are identical by construction.
- An account with no configured signature still renders no block; a lone sender name never
  becomes a signature.

### 13.3 Focused verification

The owner scoped verification to focused checks; the full `verify:web`, the full `e2e:web` suite
and backend tests were intentionally not run. The single focused proof command was:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run typecheck --workspace @sdr-assistant/web
    if ($LASTEXITCODE -ne 0) { throw 'Web typecheck failed' }

    npm.cmd run lint --workspace @sdr-assistant/web
    if ($LASTEXITCODE -ne 0) { throw 'Web lint failed' }

    npm.cmd run test --workspace @sdr-assistant/web -- features/track-research/model/initial-email-preview.test.ts features/track-research/ui/research-settings.test.tsx features/manage-email-account/ui/email-account-form.test.tsx entities/email-account/model/schema.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'Focused web tests failed' }

    npm.cmd run format:check --workspace @sdr-assistant/web
    if ($LASTEXITCODE -ne 0) { throw 'Web format check failed' }

    npm.cmd run e2e --workspace @sdr-assistant/web -- e2e/research-email-composition.spec.ts
    if ($LASTEXITCODE -ne 0) { throw 'Focused Playwright verification failed' }

    Write-Output 'PASS: SDR-010 signature order correction'
}
```

Result: **PASS**, exit code 0, final line `PASS: SDR-010 signature order correction`.

| Gate | Result |
| --- | --- |
| `typecheck` | **PASS** |
| `lint` | **PASS** — 0 warnings |
| Focused Vitest (4 files) | **PASS — 74/74** tests |
| `format:check` | **PASS** — all matched files use Prettier |
| Focused Playwright (`research-email-composition.spec.ts`) | **PASS — 3/3** scenarios |

The Playwright scenario fills **Closing greeting** = `Best regards,`, reloads to prove persistence,
assigns the account to the research and asserts that both `.email-signature` blocks contain the
values in the approved order (greeting, sender name, company, phone, website, WhatsApp, additional
text). The refreshed rendered evidence is
`apps/web/test-results/research-email-composition-…/sdr-010-signature-preview-desktop.png`.

No backend test, database change, migration, provider call, email send or SMTP/IMAP connection was
made. No process on ports 3000/4000 was started by this correction; Playwright's own 3100/4100
servers are stopped automatically by the test runner.

### 13.4 Remaining limitations

- The display order is fixed in code; it is not configurable by the owner.
- A missing sender name simply omits that line; the value is never invented.
- The live account's `signatureText` still contains the owner's exploratory note and must be
  edited by the owner; no data was changed by this correction.
- SDR-010 remains `READY_FOR_HUMAN_REVIEW`; nothing was committed or pushed.

## 14. Send test email — 2026-11-28

Authorized by the owner before closing SDR-010. Adds an explicit single-message test send to a
manually entered recipient, built on a reusable outreach message builder and SMTP sender intended
for the future first-contact execution (SDR-012).

### 14.1 Scope and behaviour

- The research **Settings → Initial email → Preview** block has a **Send test email** button below
  the complete preview. It reveals a validated recipient field with **Send test** and **Cancel**.
- Sending is possible only from a **saved** composition (unsaved subject/body changes block it),
  with an assigned, enabled account and loaded attachments.
- One SMTP attempt is made; the UI shows `Sending…` and then the actual result. A definitive
  failure is reported as failed. If the transport ends without a server answer, the result says
  the message may or may not have been delivered and is **never retried automatically**.
- The message uses the saved subject, message, the account's closing greeting, the account's
  existing `senderName`, the remaining signature fields in the accepted order and every research
  attachment. A plain-text part and a minimal escaped HTML part are produced; website and WhatsApp
  are real anchors in the HTML part and full URLs in the text part.
- A double click cannot produce two messages: the UI synchronously guards and disables the action,
  and the API rejects a second in-flight send for the same research.
- Test sends never touch the prepared recipient queue, never count towards first-contact
  statistics and never trigger automatic communication. They are recorded in the separate
  `research_test_email_sends` table.

### 14.2 Architecture

- New backend module `apps/api/src/modules/outreach-email/`:
  - `outreach-message.builder.ts` — pure composition (`buildOutreachEmail`) plus an injectable
    `OutreachMessageBuilder`. This is reusable by SDR-012.
  - `smtp-mail-sender.ts` — `SmtpMailSender` interface, `NodemailerSmtpMailSender` and safe
    `classifySendFailure` / `evaluateSendInfo`. The transport reuses the hardened destination
    resolver (validated public IP, TLS server name, certificate verification, required STARTTLS,
    forced authentication) and the existing credential decryption.
  - `test-email-send.service.ts` — preconditions, attachment content load, message build, single
    send, attempt recording, in-flight duplicate guard.
  - `test-email-send.controller.ts` — `POST /research/:jobId/communication/test-email` with a
    validated `{ recipient }` DTO.
- New additive table `research_test_email_sends` (`TestEmailSendStatus`: `SENT`, `FAILED`) with
  research/account/sender/recipient/subject/attachmentCount/status/failure code and message. No
  message body or attachment bytes are duplicated. The table is separate from any future
  first-contact communication record.
- Frontend: wire schema and server-only API call in `entities/research`, recipient validation in
  `features/track-research/model/test-email.ts`, a Server Action, and the UI in
  `research-settings.tsx`. Only the recipient travels from the browser; composition, signature and
  attachments are read by the API.
- Migration `20261128190000_add_research_test_email_sends` is additive (one enum, one table, one
  index, one cascade FK). It was applied to the local database under explicit owner approval; see
  §14.4.

### 14.3 Focused verification

The single focused proof command was:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run build --workspace @sdr-assistant/api
    if ($LASTEXITCODE -ne 0) { throw 'API build failed' }

    npm.cmd run test --workspace @sdr-assistant/api -- test/outreach-message.builder.test.ts test/test-email-send.service.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'Backend outreach email tests failed' }

    npm.cmd run typecheck --workspace @sdr-assistant/web
    if ($LASTEXITCODE -ne 0) { throw 'Web typecheck failed' }

    npm.cmd run lint --workspace @sdr-assistant/web
    if ($LASTEXITCODE -ne 0) { throw 'Web lint failed' }

    npm.cmd run test --workspace @sdr-assistant/web -- features/track-research/ui/research-settings.test.tsx entities/research/model/test-email.test.ts features/track-research/model/test-email.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'Focused web tests failed' }

    npm.cmd run format:check --workspace @sdr-assistant/web
    if ($LASTEXITCODE -ne 0) { throw 'Web format check failed' }

    npm.cmd run e2e --workspace @sdr-assistant/web -- e2e/research-test-email.spec.ts
    if ($LASTEXITCODE -ne 0) { throw 'Focused Playwright verification failed' }

    Write-Output 'PASS: SDR-010 send test email'
}
```

Result: **PASS**, exit code 0, final line `PASS: SDR-010 send test email`.

| Gate | Result |
| --- | --- |
| API build (`prisma generate` + `tsc`) | **PASS** |
| Focused backend tests | **PASS — 29/29** (10 builder + 19 test-email service) |
| Web typecheck | **PASS** |
| Web lint | **PASS** — 0 warnings |
| Focused web tests | **PASS — 47/47** (37 research Settings UI + 7 recipient validation + 3 wire schema) |
| `format:check` | **PASS** |
| Focused Playwright (`research-test-email.spec.ts`) | **PASS — 4/4** scenarios |

The tests use a fake `SmtpMailSender` and an in-memory Prisma stand-in; no real SMTP connection,
email, DNS lookup or database write occurs in the proof. They assert the composed subject, sender
name and address, recipient, body, signature order, HTML anchors for website/WhatsApp, attachment
contents, definitive failure, uncertain acceptance, invalid recipients, unsaved-composition
blocking, disabled account, missing assignment, invalid port, unsafe destination, unavailable
credential, duplicate in-flight submissions and recording failure. The Playwright scenarios use
the mock API and cover success, client-side recipient validation, definitive and uncertain
failures, and the save-before-send rule.

### 14.4 Owner-approved local migration deployment

The owner explicitly approved applying the additive migration with a protected backup.

- **Preflight:** `prisma migrate status` reported exactly one pending migration
  (`20261128190000_add_research_test_email_sends`) with 14 applied. Baseline counts: researches 4,
  products 5, email accounts 2, settings 1, stage-01/02/03 rows 2/2/3, qualification runs 2,
  qualification results 154, communication settings 1, recipients 71, attachments 1,
  `_prisma_migrations` 14.
- **Protected backup:** `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261128-185235`.
  Custom-format dump `sdr_assistant_full_20261128-185235.dump`, **2,623,584 bytes**, container and
  host SHA-256 `2e87db78af551f3c6f662d3c8d5d59e4e0d4595deeba324a7f61c38e3cfd507b`, 13
  `TABLE DATA` entries, complete `pg_restore` archive read, container temporary dump removed. ACL
  inheritance removed; only `NT AUTHORITY\SYSTEM`, `BUILTIN\Administrators` and
  `ALFASISDEV\msmig` have FullControl on the directory, the dump and
  `backup-verification.json`. No restore was performed.
- **Migration result:** `prisma migrate deploy` exit 0, applied only
  `20261128190000_add_research_test_email_sends`. `prisma migrate status`:
  `Database schema is up to date!`; ledger **15 applied / 0 unfinished / 0 rolled back**. The
  applied checksum `46eec76633b1df77ddcfb8ea80079584bb02df1f87e6943532dcdbf7e61bed5c` equals the
  repository migration file SHA-256. The table, its two indexes, its foreign key and the
  `SENT`/`FAILED` enum values exist; the table has 0 rows.
- **Preservation:** all baseline counts are identical after deployment; recipients remain 71,
  attachments 1, communication settings 1, and all research/stage/account rows are unchanged.
- **Live route check (no email sent):** `GET /health` 200; `POST
  /research/any-job/communication/test-email` with an invalid recipient returned 400; the same
  endpoint on a research without an assigned account returned 409
  `Assign an email account to this research before sending a test.` Both checks stop before any
  SMTP connection.
- No service was manually stopped or restarted by this step. The owner's running `npm run dev`
  stack was left running; its file watcher rebuilt and restarted the API child after the proof
  builds, and the new route was verified on that instance after the migration. No web restart was
  needed.

### 14.5 Remaining limitations

- **No real email was sent by the agent.** The owner performs the first real test manually.
- A test send is recorded separately in `research_test_email_sends` but there is no history screen
  yet; the table is the audit record.
- The recipient validation is a standard email-address check; the SMTP server remains authoritative
  for whether an address is deliverable.
- Acceptance semantics: `SENT` means the SMTP server definitively accepted the message for the
  recipient; `FAILED` with `uncertain: true` means no definitive answer was received and the
  message may or may not have been delivered. No automatic retry is performed in either case.
- The duplicate guard is in-process (single local API instance). A multi-instance deployment would
  need a database-level guard before enabling concurrent sending.
- The message builder mirrors the web preview ordering in backend code; a future change to the
  signature order must update both and their tests.
- The HTML part is a minimal generated representation with inline styles; it does not use the
  owner's markup and is not a rich-text editor.
- Test sends do not use, modify or count prepared recipients. First-contact execution, scheduling,
  mailbox synchronization and reply handling remain future tasks (SDR-011…SDR-013).
- The migration is applied to the local database only; production deployment is separate.

### 14.6 Status

`READY_FOR_HUMAN_REVIEW` — implementation, focused proof and the owner-approved local migration are
complete. No real email was sent, and nothing was committed or pushed.

> **Update 2026-11-28:** accepted by the human owner as `DONE / HUMAN_APPROVED`; see §15.

## 15. Human acceptance and closure — 2026-11-28

**Accepted by the human owner as `DONE / HUMAN_APPROVED` on 2026-11-28.**

- The owner performed a real test email send and confirmed receipt in Outlook, including the
  correct sender name, subject, message formatting, signature, clickable website and WhatsApp
  links and the research attachment. That is the only real send in this task; the agent sent none.
- Acceptance covers the email composition and attachment work (§9), the signature display-order
  correction (§13) and the send test email feature (§14).
- Preserved evidence: the canonical SDR-010 proof (§9), the signature correction focused proof
  (§13.3), the send-test focused proof (§14.3), the local environment reconciliation (§12), the
  protected backups and both owner-approved local migration deployments (§12, §14.4), and the
  migration/schema verification in this section.
- **Both SDR-010 migrations verified applied:** `20261127233000_add_signature_and_research_attachments`
  (checksum `d302511bb966fd214fcead043e970995882d935051e30291aef9754b2c5b2d09`) and
  `20261128190000_add_research_test_email_sends` (checksum
  `46eec76633b1df77ddcfb8ea80079584bb02df1f87e6943532dcdbf7e61bed5c`); both finished, neither
  rolled back, and both checksums match the repository migration files. `prisma migrate status`
  reports 15 migrations and `Database schema is up to date!`; all six signature columns, the
  `research_attachments` table and the `research_test_email_sends` table exist. No database change
  was made for closure.
- **Commit scope:** only the SDR-010 deliverables (the modified tracked files and the new
  source/test/migration files) plus these documentation updates. Excluded: credentials and
  `.env`, real email content, recipient addresses, signature values, attachment files, screenshots,
  generated Prisma/Next outputs, build/test/log artifacts and the 30 pre-existing untracked
  research/tooling artifacts.
- The scope is committed with `feat: complete email composition and test email sending` and pushed
  to `origin main` without force. The exact commit hash, staged-manifest review, remote
  verification and post-commit working-tree status are recorded in the completion report for this
  closure (a commit cannot contain its own hash).
- SDR-011 was not started.
