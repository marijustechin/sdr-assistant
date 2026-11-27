# SDR-009 — Initial Email and Automatic Recipient Queue

## 1. Task ID and status

- **Task ID:** SDR-009
- **Title:** Initial Email and Automatic Recipient Queue
- **Status:** `DONE / HUMAN_APPROVED` — implementation, the single canonical proof, the
  owner-authorized live deployment and the owner's live acceptance are complete (§14).
- **Registry:** [README.md](README.md)
- **Checkpoint at start:** `366ee84` (`feat: add research email account assignment`), the
  accepted SDR-008 scope. The working tree is the implementation baseline; it contains the
  30 pre-existing untracked research/tooling artifacts recorded in [SDR-008 §8](SDR-008-research-email-account-assignment.md#8-excluded-artifact-baseline-before-implementation).
- **Execution mode:** standard session environment. No dependency installation, no live
  database change or deployment, no paid provider call, no SMTP/IMAP connection and no email
  send.
- **Research Implementation Freeze:** fully active. No Stage 01–05 algorithm, prompt,
  provider, stage-orchestration, classification or research-result change is authorized.

## 2. Objective

Let the user author the research's initial outreach email in the existing Settings tab, and
automatically prepare a persisted recipient queue from the current published Stage 05 Contact
Discovery result. The prepared queue is displayed in the activated Communication tab. One
company, one initial email; prepared recipients are not marked as authorized or sent.

## 3. Authorized scope and paths

- Extend the research Settings tab with an **Initial email** section: subject, plain-text
  message body and a save action. Persist both in the research communication settings and
  restore them after reopening the research.
- Add one additive Prisma migration: three nullable columns on the existing
  `research_communication_settings` table and a new prepared-recipient table with two enums.
  No existing column, row or table is altered.
- Add the minimal backend behavior: initial-email read/write, deterministic recipient
  selection from the published Stage 05 result, idempotent queue preparation, and a read
  endpoint with server-side search and pagination.
- Activate the existing Communication tab in the research detail page, placed before
  Settings. Display only the prepared queue: totals, company/domain, primary email,
  expandable alternatives, queue status, search and pagination, plus missing-publication and
  empty states. No sending controls and no simulated history.
- Add the minimal frontend entity schema/client, same-origin route handler, server action and
  UI with loading, empty, error and terminal states.
- Extend the existing Playwright mock API and add synthetic rendered scenarios; adjust the
  existing tab assertions that the new tab necessarily changes.
- Add focused backend and frontend tests for the new behavior.
- Record the task in `docs/tasks/README.md` and this task document.

Planned path scope (the final exact inventory is recorded in §10):

- `apps/api/prisma/schema.prisma` and one new additive migration
- `apps/api/src/modules/research-communication/**`
- `apps/api/test/research-communication.test.ts`
- `apps/api/test/research-recipient-queue.test.ts`
- `apps/web/entities/research/**`
- `apps/web/features/track-research/**`
- `apps/web/_pages/research/**`
- `apps/web/app/api/research/[jobId]/recipient-queue/route.ts`
- `apps/web/e2e/mock-api.mjs`
- `apps/web/e2e/research-communication.spec.ts`
- `apps/web/e2e/research-results.spec.ts` (tab-label assertions only)
- `docs/tasks/README.md`
- `docs/tasks/SDR-009-initial-email-and-recipient-queue.md`

## 4. Explicit exclusions

- No email sending, SMTP or IMAP connection, mailbox synchronization, mailbox check, sending
  scheduler or delivery simulation.
- No live provider call, no LLM call and no research rerun.
- No Stage 01–05 algorithm, prompt, provider, research-execution, research-result or
  research-orchestration change; `apps/api/src/modules/research` is not modified.
- No live database migration deployment, no database row modification and no database
  connection in the canonical proof.
- No rich-text editor, AI generation, personalization variables, attachments, templates,
  scheduling settings, daily limits or placeholder controls for future features.
- No manual company-by-company approval or per-recipient editing.
- No credential duplication or credential exposure in research APIs.
- No new dependencies, dependency upgrades or architecture change.
- No unrelated refactoring, formatting of unrelated files or repository-wide tooling.
- No deletion, move, formatting or modification of the pre-existing untracked artifacts.
- No commit or push before human acceptance.

## 5. Acceptance criteria

- Initial email subject and body survive page reload.
- Recipient queue is generated automatically.
- Each company has at most one primary recipient.
- Alternative contacts are preserved.
- Repeated queue preparation does not produce duplicates.
- Partner and excluded-company contacts cannot enter the queue.
- No recipient is falsely marked as sent or authorized for sending.
- Existing research, Contacts and email account functionality remains unchanged.

## 6. Design decisions

### Persistence

- The initial email lives in the existing one-row-per-research
  `research_communication_settings` table as nullable `initialEmailSubject` and
  `initialEmailBody`. `null` means "not configured"; no separate table or JSON blob is needed.
- The queue lives in one new `research_recipients` table: research, source publication run,
  source Stage 05 result, source company index, normalized company domain, company name,
  primary email, alternative email addresses (`text[]`), selection reason, queue status and
  timestamps. Unique `(researchId, domain)` prevents two queue entries for one company and
  unique `(researchId, primaryEmail)` prevents a duplicate primary address in one research.
- `RecipientQueueStatus` currently has exactly one value, `PREPARED`. It deliberately has no
  sent/authorized/eligible state: a prepared recipient is not evidence of permission to send.
- The queue-preparation marker is the nullable `recipientQueueSourceRunId` on the settings row,
  so preparation can be skipped without a second state table.

### When preparation occurs

- Preparation is ensured server-side by the research page render, before the Communication
  tab data is read. The page calls an idempotent prepare endpoint; the same request returns
  the first queue page. No background scheduler, pipeline hook or research-stage change is
  involved (the freeze forbids orchestration changes), and the user never approves companies.
- The prepare endpoint compares the marker with the current published run and reconciles only
  when they differ. Repeated page loads or repeated prepare calls therefore perform no writes
  and create no duplicates. A read-only GET never mutates anything.
- A new published Stage 05 result is reconciled on the next research page load: the prepared
  set is replaced transactionally with the new selection and the new source run, because V1
  has no delivery history to preserve. Rows are only displayed when their source run equals
  the current published run, so a superseded publication never appears as the current queue.
- With no published Stage 05 result, preparation changes nothing and the tab renders the
  missing-publication state. Existing rows are not deleted while no publication exists.

### Deterministic recipient selection

- Source: published `LeadQualificationRun` for the research, its `ACCEPTED` results, and the
  `metadata.contactDiscovery.emails` entries whose `ownership` is `usable`. Partner,
  distributor and uncertain addresses never enter the primary or alternative lists, and
  excluded companies are never read into the selection at all.
- Stage 05 V1 does not persist department/person metadata (`employeeAssociation` is always
  `unknown`, `employeeName` and `employeePosition` are null), so the priority is derived from
  the published mailbox local part with a documented, deterministic token table:
  1. sales/commercial local part (`sales`, `pardavim…`, `commerc…`, `export`, `wholesale`,
     `b2b`, `trade`, …) → `SALES_DEPARTMENT`;
  2. general company mailbox (`info`, `office`, `contact`/`kontakt…`, `hello`, `mail`, …) →
     `GENERAL_MAILBOX`;
  3. any other usable company-association address → `INDIVIDUAL_CONTACT`.
  This classifies mailboxes, not people: no employee identity or position is inferred.
- Tie-break within one priority tier: prefer an address on the company's own domain, then the
  lexicographically smallest normalized address. This is stable regardless of discovery order.
- Companies are processed by source company index. If two companies select the same primary
  address, the later company falls through to its next candidate; a company with no unused
  usable address is skipped rather than duplicating a primary. All remaining usable addresses
  for the company are preserved, deterministically sorted, as alternative contacts.

### Future safety and eligibility

- A publicly discovered address is not permission to send. V1 exposes only the `PREPARED`
  state and the UI states explicitly that the queue is prepared, not eligible or authorized
  for sending.
- Suppression, eligibility and delivery-failure handling are future concerns. They can
  reference the recipient id without changing this table; the preserved alternatives are the
  future fallback input for a failed primary address.
- Before sending is introduced, delivery records must be stored separately and be immutable.
  Queue reconciliation must then preserve a recipient that has delivery history (for example
  by marking it superseded) instead of replacing it. V1 replaces only because no delivery
  record can exist yet.

### API and frontend

- `GET /research/:jobId/communication` is extended additively with
  `initialEmail: { subject, body } | null`; `PATCH /research/:jobId/communication/initial-email`
  saves both fields. Assignment behavior is unchanged.
- `POST /research/:jobId/communication/recipient-queue/prepare` ensures preparation and
  returns the current queue page; `GET .../recipient-queue` reads the persisted queue with
  `q`, `page` and `pageSize`. Both return the publication, prepared flag, global totals and a
  paginated item list, so thousands of companies are never silently truncated.
- The web page renders the first queue page on the server; search and page changes call a
  same-origin route handler. The browser never calls the API directly, every payload is
  parsed with zod and failures are values.

## 7. Single proof command

The canonical proof is:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run build --workspace @sdr-assistant/api
    if ($LASTEXITCODE -ne 0) { throw 'API build failed' }

    npm.cmd run test --workspace @sdr-assistant/api -- test/research-communication.test.ts test/research-recipient-queue.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'Backend recipient queue tests failed' }

    npm.cmd run verify:web
    if ($LASTEXITCODE -ne 0) { throw 'Frontend verification failed' }

    npm.cmd run e2e:web
    if ($LASTEXITCODE -ne 0) { throw 'Playwright verification failed' }

    Write-Output 'PASS: SDR-009 initial email and recipient queue'
}
```

The proof uses synthetic fixtures and the mock API only. It performs no SMTP/IMAP connection,
no email send, no mailbox synchronization, no paid provider call and no live database change.
It includes the mandatory `verify:web` gate and the rendered-behaviour Playwright gate.

## 8. Excluded-artifact baseline (before implementation)

The working tree contains the same 30 untracked artifacts recorded in
[SDR-008 §8](SDR-008-research-email-account-assignment.md#8-excluded-artifact-baseline-before-implementation)
with the same SHA-256 values; they were confirmed unchanged at implementation start. They are
not part of this task and remain untouched.

Re-hash after the canonical proof: **30/30 artifacts unchanged, 0 mismatches**. Combined
manifest SHA-256 (sorted per-file SHA-256 values, joined with LF):
`176250A3AD9CAC9F12044FAB71CE885F9B2481A733B2D99C9858E36184905D30`. The working tree has
45 untracked entries: these 30 preserved artifacts plus 15 new SDR-009 source/test/task files.

## 9. Verification result

**PASS.** The single canonical proof command in §7 was executed against the final
implementation on 2026-11-27 (started 21:44 Europe/Vilnius) with **exit code 0** and final line
`PASS: SDR-009 initial email and recipient queue`.

| Gate | Result |
| --- | --- |
| API build (`prisma generate` + `tsc -p tsconfig.json`) | **PASS** — Prisma Client generated for the new models; TypeScript compiled |
| Focused backend tests | **PASS — 44/44** tests in 2 files (23 recipient queue + 21 communication) |
| `verify:web` | **PASS** — `next typegen`/`tsc --noEmit`, ESLint (0 warnings), **194/194** Vitest tests in 25 files, Prettier |
| `e2e:web` | **PASS — 48/48** Playwright scenarios, 0 failed, 0 skipped, **1.5m** |

The 48 rendered scenarios comprise the 45 preserved SDR-004/005/007/007A/008 scenarios plus
three new SDR-009 scenarios:

1. The Communication tab shows the automatically prepared queue: totals 3 / 3 / 1, the
   sales-first primary for Alpha, the expandable `info@` alternative, a prepared-only notice,
   no partner or excluded-company address, no send control and no `mailto:` link, plus search.
2. The initial email is saved and restored after a full reload; the Email account section
   remains present and unchanged.
3. A research without a published Stage 05 result renders the missing-publication state.

Rendered evidence (git-ignored `apps/web/test-results/`):

- `research-communication-sho-2ad5b-ly-prepared-recipient-queue-chromium/sdr-009-recipient-queue-desktop.png`
- `research-communication-sav-e631b-nd-restores-it-after-reload-chromium/sdr-009-initial-email-desktop.png`

A first canonical run also passed (48/48) on the pre-refinement code. The rendered evidence then
showed a redundant first-mount queue read under React development StrictMode (a transient
"Loading recipients…" label). That behaviour was removed with a request-key guard so a mount
never re-reads the server-rendered page; the proof was then re-executed on the final code and the
result above is the evidence. Before the canonical proof, development checks used the same
focused commands (API build, focused backend tests, web typecheck/unit tests and the focused
Playwright spec). The first focused Playwright run exposed that alternative contacts sit inside a
collapsed disclosure; the new spec was corrected to expand it before asserting. The canonical
proof itself was executed once against the final code.

No live database change, SMTP/IMAP connection, email send, mailbox synchronization, research
rerun or paid provider call occurred during the proof.

## 10. Implementation record and changed files

### Backend

- Extended `ResearchCommunicationSettings` with nullable `initialEmailSubject`,
  `initialEmailBody` and `recipientQueueSourceRunId`; added the `ResearchRecipient` model and the
  `RecipientSelectionReason` / `RecipientQueueStatus` enums. `RecipientQueueStatus` has exactly
  one value, `PREPARED`, so no row can claim sending eligibility, authorization or delivery.
- Added the additive migration `20261127220000_add_research_recipients` (three nullable columns,
  one table, two enums, two unique indexes, one index, one cascade foreign key). It alters no
  existing row and is **not deployed**.
- Added `research-recipient-selection.ts`: the pure deterministic selector. It reads only
  `ACCEPTED` results and `ownership: usable` addresses, classifies the published mailbox local
  part into the documented sales / general / individual tiers, tie-breaks by the company domain
  then the lexicographically smallest normalized address, processes companies by source index,
  never reuses a primary within one research and preserves every remaining usable address as a
  deterministically sorted alternative.
- Added `research-recipient-queue.query.ts` and the initial-email DTO; extended the service with
  settings read/write, idempotent preparation (marker + transactional replace), and a read model
  with SQL search and pagination. Extended the controller with
  `PATCH .../communication/initial-email`, `POST .../communication/recipient-queue/prepare` and
  `GET .../communication/recipient-queue`; the existing assignment endpoints are unchanged.
- Extended `test/research-communication.test.ts` for the extended settings response and initial
  email, and added `test/research-recipient-queue.test.ts` (selection priority, tie-breaks,
  partner/uncertain/excluded exclusion, duplicate-primary handling, idempotency, newer
  publication, missing publication, 2,000-company pagination/search, query validation).

### Frontend

- Extended the research communication schema with `initialEmail` and added the recipient-queue
  wire schema, server client, browser client and same-origin read route handler.
- Added the **Initial email** section to the Settings tab (subject, plain-text message, save
  action, pending/validation/failure states) and the server action. The saved values are held
  above tab content and restored from the server after reload.
- Activated the **Communication** tab before Settings and removed the `Communication — Planned`
  marker. It renders the server-prepared first page: total companies, prepared primary
  recipients, alternative contact count, company/domain, primary email, queue status, selection
  reason, expandable alternatives, search, pagination and missing/empty/error/loading states. It
  contains no sending controls, eligibility claims or simulated history.
- The research page ensures preparation server-side before rendering the tab; the browser only
  reads later pages.

### Changed files

```text
M  apps/api/prisma/schema.prisma
A  apps/api/prisma/migrations/20261127220000_add_research_recipients/migration.sql
M  apps/api/src/modules/research-communication/research-communication.controller.ts
M  apps/api/src/modules/research-communication/research-communication.service.ts
A  apps/api/src/modules/research-communication/dto/update-research-initial-email.dto.ts
A  apps/api/src/modules/research-communication/research-recipient-queue.query.ts
A  apps/api/src/modules/research-communication/research-recipient-selection.ts
M  apps/api/test/research-communication.test.ts
A  apps/api/test/research-recipient-queue.test.ts
M  apps/web/_pages/research/ui/research-page.tsx
A  apps/web/app/api/research/[jobId]/recipient-queue/route.ts
M  apps/web/e2e/mock-api.mjs
A  apps/web/e2e/research-communication.spec.ts
M  apps/web/e2e/research-results.spec.ts
M  apps/web/entities/research/api/research.server.ts
A  apps/web/entities/research/api/recipient-queue.client.ts
M  apps/web/entities/research/client.ts
M  apps/web/entities/research/index.ts
M  apps/web/entities/research/model/communication.ts
A  apps/web/entities/research/model/recipient-queue.ts
A  apps/web/features/track-research/api/update-initial-email-action.ts
M  apps/web/features/track-research/index.ts
A  apps/web/features/track-research/model/recipient-queue.test.ts
A  apps/web/features/track-research/model/recipient-queue.ts
M  apps/web/features/track-research/model/research-settings.ts
M  apps/web/features/track-research/model/sections.ts
A  apps/web/features/track-research/ui/research-communication.test.tsx
A  apps/web/features/track-research/ui/research-communication.tsx
M  apps/web/features/track-research/ui/research-settings.test.tsx
M  apps/web/features/track-research/ui/research-settings.tsx
M  apps/web/features/track-research/ui/research-tabs.tsx
M  apps/web/features/track-research/ui/research-workspace.tsx
M  docs/tasks/README.md
A  docs/tasks/SDR-009-initial-email-and-recipient-queue.md
```

`apps/api/src/modules/research`, all Stage 01–05 code, prompts, providers and research-result
handling are untouched. The generated Prisma client, Next.js generated files and Playwright
results are git-ignored and not part of the change set.

## 11. Remaining limitations or blockers

> **Update 2026-11-27:** limitation 1 below was resolved by the owner-authorized live deployment
> recorded in §13 (protected backup, `migrate deploy`, stack restart and live acceptance
> preparation all executed). The original verification-time statements are preserved below.

1. **Migration not deployed.** The additive migration is authored, Prisma-validated by the API
   build, and reversible in principle, but it has not been applied to the live database. Live
   persistence needs the owner-authorized protected backup and `prisma migrate deploy`, followed
   by an API restart. Until then a live API call to the new endpoints fails and the Settings and
   Communication tabs render their error states while every other research section keeps working.
2. **No live-API/live-database acceptance run.** Queue and initial-email behaviour was verified
   with synthetic fixtures, an in-memory Prisma stand-in and the Playwright mock API, not against
   the running NestJS API and PostgreSQL. The live acceptance remains for the owner after
   deployment.
3. **Preparation trigger.** Preparation is ensured during the research page render, not by a
   background job or a Stage 05 publication hook: the Research Implementation Freeze forbids
   orchestration changes. A publication that arrives while a research page stays open is
   reconciled on the next page load; the tab shows the current publication it was prepared from.
4. **Mailbox classification is heuristic.** Stage 05 Contact Discovery V1 persists no department
   or person metadata (`employeeAssociation` is always `unknown`; employee name/position are
   null). The sales/general tiers therefore come from the documented local-part token lists, not
   from verified roles. Unusual languages or local parts fall into the individual tier. No
   employee identity or position is inferred.
5. **Duplicate-primary edge case.** If every usable address of a later company is already another
   company's primary, that company receives no queue entry rather than a duplicate primary. The
   current published data does not exercise this case; the rule is deterministic and tested.
6. **New-publication reconciliation replaces the prepared set.** This is safe because no delivery
   history exists yet. Before sending is introduced, reconciliation must preserve recipients with
   delivery history (for example by marking them superseded) instead of deleting them, and
   delivery records must live in separate immutable storage. This requirement is recorded in the
   schema and task design.
7. **Search scope.** Search covers company name, domain and primary email. Alternative addresses
   are preserved and displayed but are not searched.
8. **Prepared is not eligible.** The queue is prepared only; recipient eligibility, suppression,
   opt-outs, invalid-address handling and delivery are not implemented. The UI states this
   explicitly and no recipient is marked as authorized or sent.
9. **No manual per-recipient editing or company approval** by design; the queue is automatic.
10. The currently running live services (if any) were not restarted or redeployed by this task.

## 12. Final status

`READY_FOR_HUMAN_REVIEW` — the implementation and the single canonical proof are complete, the
migration is authored but not deployed, and nothing was committed or pushed. Human acceptance is
required before any closure, deployment or commit.

> **Update 2026-11-27:** the owner accepted practical verification, authorized the live
> deployment (§13) and then granted final acceptance (§14). The status at acceptance is
> `DONE / HUMAN_APPROVED`; this section is preserved as the pre-deployment record.

## 13. Live deployment and acceptance preparation — 2026-11-27

Authorized by the human owner after accepting the implementation and the canonical proof. No
code, test, dependency or configuration change; no research rerun; no provider call; no
SMTP/IMAP connection; no email send; **no initial email was created or saved by the agent**.

### 13.1 Preflight

- Target confirmed: PostgreSQL **17.11** container `sdr-assistant-db`, database `sdr_assistant`,
  user `sdr`, published only on `127.0.0.1:5433`.
- Migration ledger: **12 applied, 0 unfinished, 0 rolled back**; 13 migration directories and
  exactly one pending migration: `20261127220000_add_research_recipients`.
- Baseline counts and full-row MD5 fingerprints: researches 4 (`38ac2da5…`), stage01 2
  (`7598050e…`), stage02 2 (`0c46e074…`), stage03 3 (`f2da4d52…`), products 5 (`b08db99b…`),
  settings 1 (`a5fb91bf…`), email_accounts 2 (`97f6e1d5…`), lead runs 2 (`47cb8b58…`), lead
  results 154 (`385b61a1…`), communication settings 1 (`cdd28362…`); `research_recipients` did
  not exist.
- Published Stage 05 run `cmwyyy1dj0000z8sw0rfmunfg`: `COMPLETED`, published
  2026-11-27 12:39:49.874, **71 accepted / 6 excluded / 77 companies**, **138 usable
  retained-company email pairs**. Target research `cmww8smxb0000z4swhooukamv` is `COMPLETED`
  with 77 company profiles.
- SDR-008 assignment present (one row, enabled account); initial email absent (`null`).

### 13.2 Protected backup

- Directory:
  `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261127-215035`.
- Dump `sdr_assistant_full_20261127-215035.dump`: **2,553,127 bytes**; container and host
  SHA-256 both `6d64e07718fa572b2f4020592b289a90d19ecf7544c60570db7c71df3f599003`.
- `pg_restore -l`: **74 archive entries, 11 `TABLE DATA` entries**; complete archive read
  (`pg_restore -f /dev/null`) succeeded. The container temporary dump was removed.
- ACL inheritance removed; only `NT AUTHORITY\SYSTEM`, `BUILTIN\Administrators` and
  `ALFASISDEV\msmig` have FullControl on the directory and both files. `backup-verification.json`
  records size, hash, entry counts and the pending migration.

### 13.3 Migration result

- `prisma migrate deploy` — exit 0; applied only
  `20261127220000_add_research_recipients`.
- `prisma migrate status` — `Database schema is up to date!`, exit 0.
- Ledger now **13 applied / 0 unfinished / 0 rolled back**. Applied checksum
  `90096276b3bc36d830b2edec10d725fe922aeeb416f8dae3625edbc0b12803bf` equals the repository
  migration file SHA-256.
- Schema verified: the 13 columns, `RecipientSelectionReason` and `RecipientQueueStatus`
  (`PREPARED` only), primary key, both unique indexes, the status index and the cascade foreign
  key to `researches` all exist. `research_recipients` had **0 rows** after deployment.
- Preservation: all nine pre-existing table fingerprints are **identical** to preflight. The
  `research_communication_settings` full-row fingerprint changed only because the row gained the
  three new nullable columns; its existing values are unchanged (same research, same assigned
  account, same `createdAt`). The assigned account is enabled and both protocols remain
  `VERIFIED`; no account or assignment was modified by the deployment.

### 13.4 Service restart and readiness

- The previous detached dev stack (launcher PID 53976, the SDR-008 stack) was stopped; ports
  3000/4000 were free and no project process remained.
- A fresh detached `npm run dev` stack was started. Launcher PID 105896; logs
  `apps/api/.runs/sdr-009-dev-20261127-215134.log` and `.err.log`.
- API `127.0.0.1:4000` PID 101888, `GET /health` → `{"status":"ok"}`; web `127.0.0.1:3000`
  PID 46176, root and research page return 200. The TypeScript watcher reports 0 errors and the
  run log contains no error-level entries.
- Application URL: `http://localhost:3000/researches/cmww8smxb0000z4swhooukamv`.

### 13.5 Live recipient queue verification

- Preparation was triggered only through the implemented application flow: loading the live
  research page (HTTP 200 in 2.7 s) made the server render call the prepare endpoint, which
  inserted the queue. No manual SQL insert was used.
- Result: source publication `cmwyyy1dj0000z8sw0rfmunfg`; **71 prepared primary recipients**;
  **67 alternative contacts**; 71 + 67 = **138 usable pairs**; 71 distinct domains and 71
  distinct primary addresses.
- Selection reasons: 9 sales/commercial, 46 general company mailboxes, 16 individual contacts.
- **0 companies skipped for duplicate addresses** (71 retained = 71 prepared).
- Integrity checks: 0 excluded-company entries; 0 partner/uncertain primaries; 0 primaries not
  `usable`; 0 alternatives not `usable`; 0 duplicate primary addresses; 0 duplicate companies.
- Brolis Timber resolved to its general company mailbox with four usable individual
  alternatives; its five partner/distributor addresses were excluded. Exact addresses are
  deliberately not recorded in this repository.
- Repeated loading: two further page loads returned 200; the queue row count (71) and full-row
  MD5 (`c605f3dc…`) were unchanged, the preparation marker stayed on the same source run and its
  `updatedAt` did not change, and all rows share one creation batch (2026-11-27 19:52:18.361).
  **All 71 entries remain `PREPARED`**; no sent, eligible or authorized state exists.

### 13.6 Tab verification

Live Chromium verification against `http://localhost:3000` (read-only, no settings saved):

- Tabs: `Overview | Companies 77 | Market 173 | Contacts 71 | Communication 71 | Settings`;
  no page errors.
- Contacts still works: 71 retained / 138 usable emails / 6 excluded.
- Communication: totals 71 / 71 / 67, 25 rows on page 1 of 3, `Prepared` status and selection
  reason per company, Brolis disclosure shows four alternatives, search returns one row and
  clearing it restores 71; no sending control is present.
- Settings: the Email account section shows the existing SDR-008 assignment (enabled, SMTP and
  IMAP verified) with change/remove controls; the Initial email subject and message are empty and
  Save is disabled. The owner authors and saves that email manually.
- Screenshots (git-ignored): `apps/web/test-results/live-sdr-009/live-communication.png` and
  `live-settings.png`; the rendered page HTML is preserved there too.

### 13.7 Status

Deployment and live acceptance preparation are complete; the application is ready for the owner.
The migration is applied and the backup preserved. No commit or push was performed. Awaiting
human acceptance; the owner's initial-email entry and reload confirmation remain owner actions.

## 14. Human acceptance and closure — 2026-11-27

**Accepted by the human owner as `DONE / HUMAN_APPROVED` on 2026-11-27.** The owner confirmed
that the initial email settings work correctly in the live application.

- No additional implementation, tests, refactoring or database change was made for closure.
- Evidence preserved: the single canonical proof (§9), the protected pre-migration backup
  (§13.2), the applied migration and checksum (§13.3), the service restart and readiness
  (§13.4), the live prepared queue and idempotency checks (§13.5) and the live tab verification
  (§13.6).
- Commit scope: only the SDR-009 deliverables recorded in §10 plus these acceptance records.
  Excluded from the commit: credentials and `.env`, private email content, real contact data
  (including the git-ignored live screenshots and rendered HTML), generated Prisma/Next outputs,
  build/test/log artifacts, the 30 pre-existing untracked research/tooling artifacts and every
  unrelated file.
- The scope is committed with `feat: add initial email settings and automatic recipient queue`
  and pushed to `origin main` without force. The exact commit hash, staged-manifest review,
  remote verification and post-commit working-tree status are recorded in the completion report
  for this closure (a commit cannot contain its own hash).
- SDR-010 was not started.
