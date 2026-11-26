# SDR-006 — Research Data Reconciliation

## 1. Task ID and status

- **Task ID:** SDR-006
- **Title:** Research Data Reconciliation
- **Status:** `DONE` — the inventory, reconciliation and read-only proof were accepted by the human
  owner on 2026-11-26; historical data preservation, the authorized cleanup and closure were
  executed under a separate explicit authorization (§22–§25).
- **Registry:** [README.md](README.md)
- **Execution mode:** standard `workspace-write` for the inventory. Full Access was used only for
  the two protected-archive operations outside the repository (§22.4), as the follow-up
  authorization required.
- **Nature:** the original reconciliation was read-only. The follow-up authorization permitted
  exactly one archive creation and exactly three file deletions (§23); no application file,
  database record or other research artifact was changed.

## 2. Objective

Establish the actual state, completeness, storage locations and usability of the existing
research data, then prepare an evidence-based cleanup proposal and a factual data contract for
the upcoming research-results UI (SDR-007). PostgreSQL is the intended authoritative source for
persisted research results; this task measures how far that is true today.

## 3. Authorized scope and paths

Only these paths were created or modified:

- `docs/tasks/SDR-006-research-data-reconciliation.md` (this record)
- `docs/tasks/README.md` (SDR-006 registration)
- `README.md` (one narrow migration-status documentation correction, §19)

One temporary read-only inventory script inside the repository was used for the single proof. It
was removed after the proof and its exact content is preserved verbatim in Appendix A.

Nothing else in the repository was created, modified, moved or deleted.

## 4. Explicit exclusions

No research code, prompt, schema, setting or behaviour was modified. No application source code
was modified. No database record or schema was modified, and no migration was applied. No
historical result was imported. No research artifact was deleted or moved. No fixture or test was
modified. No research job was executed. No paid API was called. No SMTP/IMAP server was
contacted. No real email-account credential was accessed. `.env` and service configuration were
not modified. No service was restarted. No dependency was installed. Nothing was staged,
committed or pushed. SDR-007 was not started.

## 5. Acceptance criteria

- The current Git checkpoint and working-tree state are confirmed.
- SDR-006 is registered and this task document exists.
- The real Prisma schema and the real PostgreSQL inventory are recorded, reconciled and
  explained, including where stage-04 output actually lives.
- The persistence behaviour of all four stages is traced read-only, distinguishing confirmed
  behaviour from assumptions.
- All relevant repository research artifacts, including the 21 previously excluded untracked
  artifacts and relevant git-ignored files, are inventoried with path, type, size, date, state,
  purpose, code references, database presence, uniqueness, sensitivity and removal impact.
- Artifacts are classified and a cleanup manifest with exact paths is proposed; nothing is
  executed.
- A factual research-results data contract for SDR-007 is documented, with field-group
  availability and sanitized structural examples.
- The existing frontend research-result presentation is assessed read-only.
- The outdated root README migration statement is corrected and the revised roadmap is recorded.
- One reproducible read-only proof command is defined, executed once, and its exact output and
  exit code are recorded.
- No research data was modified or deleted. Research Implementation Freeze remains intact.

## 6. One proof command

```text
node apps/api/tmp-sdr006-inventory.mjs --mode=proof
```

Executed once from the repository root in standard `workspace-write`, after all substantive
documentation changes were complete. The script opens one `READ ONLY` `REPEATABLE READ`
transaction for every database access, writes no file, and prints one `CHECK n …: PASS|FAIL`
line per check plus before/after protection fingerprints.

The script was created only for this proof and removed after the run, as the task requires. To
reproduce the command, recreate `apps/api/tmp-sdr006-inventory.mjs` byte-for-byte from
Appendix A; nothing else is needed.

## 7. Verification result

### 7.1 Executed proof

- **Command:** `node apps/api/tmp-sdr006-inventory.mjs --mode=proof`, run once from the
  repository root, in standard `workspace-write`, after all substantive documentation changes.
- **Exit code:** `0`.
- **Final line:** `PASS: SDR-006 research data inventory and preservation verified`.
- **Full output:** Appendix B, verbatim.

| # | Check | Result | What it establishes |
| --- | --- | --- | --- |
| 1 | `database-reachable-read-only` | PASS | The intended PostgreSQL database `sdr_assistant` (17.11) is reachable and every statement ran with `transaction_read_only=on` |
| 2 | `ten-migrations-applied-and-checksums` | PASS | 10 recorded, 10 finished, 0 rolled back, 0 error logs, 10/10 ledger checksums equal the SHA-256 of the repository migration files |
| 3 | `database-inventory-totals` | PASS | products 5, researches 42, stage01 5, stage02 3, stage03 5, settings 1, email_accounts 2; no stage table exceeds the research count |
| 4 | `research-status-counts-reconcile` | PASS | COMPLETED 37 + FAILED 3 + INTERRUPTED 2 + QUEUED 0 + RUNNING 0 = 42 = `count(*)` |
| 5 | `stage-and-final-result-coverage` | PASS | 37 non-empty results, 3 records with companies, 146 profiles (111/35), 276 offers, 5 stage-03 rows / 254 domains / 524 pages / 1,358 decisions, 7 historical result formats (25/3/3/2/2/1/1) |
| 6 | `file-based-research-artifacts-inventoried` | PASS | 21 excluded artifacts (650,012 bytes), 15 ignored research dumps (6,956,146 bytes), 4 ignored `.runs` scripts (17,593 bytes), 6 legacy dumps; the stage-04 dump's 77-profile domain set matches the persisted stage-03 set of `cmww8smxb…` |
| 7 | `twenty-one-excluded-artifacts-intact` | PASS | 21/21 present, SHA-256 identical to the pre-task baseline, 0 changed, 0 missing |
| 8 | `no-database-records-modified` | PASS | Aggregate fingerprint before = after = baseline `2c20af50…` over all seven tables |
| 9 | `no-research-artifact-modified-or-deleted` | PASS | The 21 excluded artifacts and all 15 ignored dumps are byte-identical and present after the inventory |
| 10 | `research-freeze-intact` | PASS | The 64-file `apps/api/src/modules/research` tree hash `73b6fb11…` is unchanged before/after and versus baseline; `.env` fingerprint `c63cbbb1…` unchanged |

Two correlation lines printed by the same run are evidence for §10.7 and §13.2:

- `tmp-04-real-result.json` profile payload is identical to persisted research
  `cmwv2nvzp0000ooswc85ycpck` (16 profiles, 16 offers).
- `04-profiling-result-dailylen-2026-11-25-18-10-11.json` (77 profiles, 173 offers) matches the
  persisted stage-03 domain set of `cmww8smxb0000z4swhooukamv`, whose `researches.result` contains
  no companies.

The 650,012-byte figure from check 6 reconciles exactly with the class totals in §14.1. The proof
establishes inventory, coverage and preservation. It does not establish research quality, provider
behaviour, test results or live-pipeline behaviour, and no such claim is made.

## 8. Remaining blockers or limitations

- The proof establishes inventory, preservation and coverage facts. It does not establish research
  quality, provider behaviour, cost or live-pipeline behaviour; no research was executed.
- No historical result was imported, so the 77 stored-only-in-a-file company profiles remain
  outside PostgreSQL (§15).
- Cleanup classification was a proposal. The eight archival and three deletion decisions were
  later authorized and executed (§22–§23); everything else in §14 remains an unexecuted proposal,
  and deletion, archival, import or migration of any remaining artifact still requires separate
  explicit owner authorization.
- The reconciliation proof records the state at reconciliation time (§7); the executed
  preservation and cleanup are verified separately by the compound proof in Appendix C.
- The stage 01/02/03 tables are not exposed by any HTTP endpoint; presenting them in SDR-007 would
  need an authorized API change inside the protected research module (§16.9).
- Whether the owner considers the historical intermediate dumps worth retaining is a product
  decision, not an evidence question.

## 9. Preparation and baseline state

Documents read before any change: `AGENTS.md`, `PRODUCT.md`, `README.md`,
`docs/system/harness.md`, `docs/system/environment.md`, `docs/system/research.md`,
`docs/system/frontend.md`, `docs/decisions/ADR-001-research-pipeline.md` (draft status noted),
`docs/tasks/README.md`, the SDR-003 baseline-preservation record (all phases, including the
21 excluded artifacts), SDR-004 §13–§18, SDR-005 §30–§34 and ENV-003 §6–§9.

Baseline confirmed before work:

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `286647d5bc5c53a00dab539cf587118b4130d4f2` |
| Commit | `feat: verify email connections and restrict local service exposure` |
| Upstream | `origin/main`, ahead/behind `0/0` |
| Staged changes | none |
| Modified/deleted tracked files | none |
| Stash entries | none |
| Untracked files | exactly the 21 previously excluded research/tooling artifacts |
| Database | PostgreSQL 17.11, database `sdr_assistant`, reachable on loopback `127.0.0.1:5433` |

The working tree, not `HEAD`, is the implementation baseline. The 21 untracked artifacts were
already present at the start; this task added no untracked artifact permanently.

Environment note: the Docker CLI could not be used during this task (`permission denied while
trying to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`). This is the
documented Windows named-pipe boundary of the sandbox, not a database problem: PostgreSQL was
reached directly over TCP on `127.0.0.1:5433` with a read-only client. No container was started,
stopped or inspected.

## 10. Database inventory and reconciliation

### 10.1 Actual storage

Public tables in `sdr_assistant`: `_prisma_migrations`, `email_accounts`, `products`,
`research_stage_01_results`, `research_stage_02_results`, `research_stage_03_results`,
`researches`, `settings`.

The research pipeline therefore uses **four** tables and **three** stage tables. There is no
`research_stage_04_results` table and no stage-04 column anywhere in the schema. Table names
partially, not directly, correspond to the four stages.

All ten recorded migrations are applied: `20261031115714_add_product`,
`20261106133236_add_general_categories`,
`20261110120000_rename_general_categories_to_possible_search_terms`,
`20261113110533_add_research`, `20261117190641_add_setting`,
`20261124123231_add_stage_results`, `20261124123609_stage01_identified_and_prepared`,
`20261124144445_stage03_resume_state`, `20261125230000_add_email_account`,
`20261126120000_add_email_account_verification`. Ten finished, zero unfinished, zero rolled back,
zero with error logs; each ledger checksum equals the SHA-256 of the corresponding
`apps/api/prisma/migrations/<name>/migration.sql`.

Column naming detail confirmed from the migrations and `information_schema`: Prisma created
quoted camelCase columns (`"jobId"`, `"createdAt"`, `"productId"`, `"decidedPages"`, …) and
snake_case table names (`@@map`). A read-only inventory query must quote those identifiers;
unquoted snake_case column names do not exist. `timestamp(3)` columns are `timestamp without time
zone`; the values are UTC as written by the application.

### 10.2 Inventory totals

| Table | Rows |
| --- | --- |
| `products` | 5 |
| `researches` | 42 |
| `research_stage_01_results` | 5 |
| `research_stage_02_results` | 3 |
| `research_stage_03_results` | 5 |
| `settings` | 1 (`research.pageCollection.resultsPerQuery`, number) |
| `email_accounts` | 2 (SDR-004/SDR-005 scope, not research data) |

### 10.3 Research status

| Status | Count |
| --- | --- |
| `COMPLETED` | 37 |
| `FAILED` | 3 |
| `INTERRUPTED` | 2 |
| `QUEUED` | 0 |
| `RUNNING` | 0 |
| **Total** | **42** |

37 + 3 + 2 = 42, which equals `count(*)` on `researches`; no status is unaccounted for. No run is
active, so no in-flight research state can be disturbed by inspection.

### 10.4 Date range and provenance

- `"createdAt"` range: `2026-11-18 13:47:21.597` → `2026-11-25 14:52:15.503` (stored UTC).
- `"updatedAt"` range: `2026-11-18 13:49:59.895` → `2026-11-25 16:10:11.242` (stored UTC).
- All 42 rows carry `lastHeartbeatAt`; none carries `executionToken` or `executionLeaseUntil`.
- 3 rows carry a non-null `stage`; all three are `FAILED` (§12).
- One country (`Lithuania`) and two of the five products are referenced by research rows.

### 10.5 Result coverage

| Measure | Count |
| --- | --- |
| Records with a non-null `result` | 37 |
| Records with a non-empty `result` | 37 |
| Records with `result.companies` | **3** |
| Records with `result.companies` and the current stage label | 2 |
| Records without any `result` | 5 (3 `FAILED`, 2 `INTERRUPTED`) |

Every `COMPLETED` record has a non-empty result; no non-completed record has one. A non-empty
result therefore means "the run reached a completion write", not "the run produced profiles".

### 10.6 Stage-result coverage

| Stage table | Rows | Records with this row |
| --- | --- | --- |
| stage 01 | 5 | 5 |
| stage 02 | 3 | 3 |
| stage 03 | 5 | 5 |

- Rows in each stage table whose `jobId` has no `researches` row (**orphans**): 0, 0, 0. The
  foreign keys are present and enforced.
- `researches` without a stage-01 row: 37; without stage-02: 39; without stage-03: 37.
- Records with the full 01 + 02 + 03 chain: 3 (`cmwuq1ba8000050swpz1nrjaf`,
  `cmwvzov2a0000h0swtjwaracp`, `cmww8smxb0000z4swhooukamv`).
- Stage-03 rows without a stage-02 row: 2 (`cmwv1wth9…`, `cmwv2nvzp…`). Stage-01 rows without
  stage-02 or stage-03: 2 (`cmww8fvj1…`, `cmww8jv32…`).

No stage table holds a stage-04 row, because none exists.

### 10.7 Final company profiles

Three records contain final company profiles in `researches.result.companies`:

| Research | Profiles | `profiled` | `needs_review` | Offers | `completedThrough` |
| --- | --- | --- | --- | --- | --- |
| `cmwufvywl000054swzi6g3hrh` | 25 | 7 | 18 | 62 | `04-company-discovery` |
| `cmwv2nvzp0000ooswc85ycpck` | 16 | 13 | 3 | 16 | `04-company-profiling` |
| `cmwvzov2a0000h0swtjwaracp` | 105 | 91 | 14 | 198 | `04-company-profiling` |
| **Total** | **146** | **111** | **35** | **276** | |

146 profiles cover 132 distinct domains. No `rejected` and no `error` profile status occurs.
`cmwufvywl…` uses the retired company-discovery profile format (§16.2–§16.4).

Provenance of the two current-format records is **not the same**:

- `cmwvzov2a…` has stage-01/02/03 rows and a `{ completedThrough, companies }` result, which is
  exactly the literal written by the resume path
  ([research.service.ts:476-479](../../apps/api/src/modules/research/research.service.ts#L476-L479)).
- `cmwv2nvzp…` has **no** stage-01 and **no** stage-02 row, so the API resume endpoint could not
  have produced it (it rejects that state,
  [research.service.ts:335-339](../../apps/api/src/modules/research/research.service.ts#L335-L339)).
  Its `companies` were written by the untracked one-off script
  `apps/api/tmp-run-real-04.mjs`, which reads the saved stage-03 row and runs a direct
  `update researches set … result = …` (script lines 42–56). Three independent facts agree: that
  script's hardcoded job id is exactly this record, the script writes `tmp-04-real-result.json`
  with profiles whose domain set and offer counts are fingerprint-identical to the stored
  `companies`, and the file's modification time (`2026-11-25 11:16:41`) matches the row's
  `"updatedAt"` (`11:16:41`).

This is a data-provenance fact, not an accusation of a defect: the profiles are real research
output, but they entered PostgreSQL through a manual script rather than through the application.

### 10.8 Historical result formats

Seven distinct result shapes exist among the 37 completed records:

| # | Keys | `completedThrough` | Records |
| --- | --- | --- | --- |
| 1 | `completedThrough`, `identificationPageCount`, `resultsPerQuery`, `selectedPageCount` | `02-page-collection` | 25 |
| 2 | same four keys | `03-page-collection` | 3 |
| 3 | `completedThrough` only | `03-page-assessment` | 1 |
| 4 | `completedThrough`, `resultsPerQuery` | `04-company-discovery` | 2 |
| 5 | `completedThrough`, `resultsPerQuery` | `04-company-profiling` | 3 |
| 6 | `companies`, `completedThrough`, `resultsPerQuery` | `04-company-discovery` | 1 |
| 7 | `companies`, `completedThrough` | `04-company-profiling` | 2 |

`completedThrough` labels in use: `02-page-collection` (25), `03-page-collection` (3),
`04-company-profiling` (5), `04-company-discovery` (3), `03-page-assessment` (1). Two of those
labels (`03-page-collection`, `04-company-discovery`) name stages that no longer exist in the code;
the rest are historical completion points rather than stage identifiers. There is no schema
version field.

**Answer to the reconciliation question:** historical completed records do use different result
formats, and the difference is not cosmetic — it changes which facts a client can find at all.

### 10.9 Relationship between records, stage results and final profiles

```text
products 1 ──< researches                    (FK, ON DELETE RESTRICT)
researches 1 ──0..1 research_stage_01_results  ("jobId" unique, ON DELETE CASCADE)
researches 1 ──0..1 research_stage_02_results  ("jobId" unique, ON DELETE CASCADE)
researches 1 ──0..1 research_stage_03_results  ("jobId" unique, ON DELETE CASCADE)
researches.result  ──►  optional JSON envelope; only place a final company profile can live
```

Stage 01 stores the identified product plus the prepared candidate pages; stage 02 stores the
collected page list; stage 03 stores the study criteria, the prompt version, the cumulative
per-page decisions and the accepted-domain result; stage 04 has no row of its own. The final
profiles reach PostgreSQL only when `ResearchService` copies `profiledCompanies.domains` into
`researches.result.companies`, which the current code does only on the resume path. Every stage
row is a snapshot of that stage's input or output; the `researches` row is the only join point and
the only carrier of the final result.

**Where stage-04 output actually is stored:** (a) on the resume path, as
`researches.result.companies`; (b) on every completed path, as a diagnostic JSON file
`src/modules/research/temp/04-profiling-result-<slug>-<timestamp>.json` relative to the API
process working directory; (c) otherwise nowhere. No table, no column, no API field.

## 11. Research persistence map across all four stages

`ResearchService.runResearch` runs the four stages in order, passing each result to the next
**in memory**
([research.service.ts:236-276](../../apps/api/src/modules/research/research.service.ts#L236-L276));
no stage reads a previous stage back from the database during a normal run.

| Stage | Input received from | Persisted | When persistence happens | Mechanism | Lost on failure |
| --- | --- | --- | --- | --- | --- |
| 01 product identification | `CreateResearchDto` + target language + `updateStage` | `identifiedProduct`, `preparedCandidates` | once, after all 01 work, immediately before return | Prisma `researchStage01.upsert` → `research_stage_01_results`; four temp dumps written before it | everything, if it fails before the single upsert |
| 02 page collection | in-memory stage-01 response + DTO + `resultsPerQuery` | full page list including page text | once, after search/fetch, before return | Prisma `researchStage02.upsert` → `research_stage_02_results`; two temp dumps | everything |
| 03 page assessment | in-memory stage-01 product + stage-02 pages assembled by the service | `criteria`, `promptVersion`, `decisions`, `decidedPages`, `errorPages`, `result` | criteria before the first page; decisions every 5 pages; final `result` after the loop | Prisma `researchStage03.upsert` / `update`, token-gated, lease renewed in the same transaction | at most four decisions, plus the final result |
| 04 company profiling | in-memory stage-03 result | **nothing in PostgreSQL** | n/a | one temp dump after all domains finish | everything; no DB trace at all |

Confirmed by source inspection, with one citation per claim:

- Stage 01 upsert at
  [product-identification.service.ts:92](../../apps/api/src/modules/research/stages/01-product-identification/product-identification.service.ts#L92);
  temp dumps at lines 49–84.
- Stage 02 upsert at
  [page-collection.service.ts:144](../../apps/api/src/modules/research/stages/02-page-collection/page-collection.service.ts#L144);
  temp dumps at lines 100 and 137.
- Stage 03 criteria upsert at
  [page-assessment.service.ts:327](../../apps/api/src/modules/research/stages/03-page-assessment/page-assessment.service.ts#L327);
  checkpoint write at 411 and the token-gated lease-plus-checkpoint transaction at 418–441; resume
  read at 353; the empty-page-list shortcut upsert at 98.
- Stage 04 service has no Prisma dependency in its constructor
  ([company-profiling.service.ts:36-49](../../apps/api/src/modules/research/stages/04-company-profiling/company-profiling.service.ts#L36-L49))
  and writes only one dump at lines 61–66.

### 11.1 What is stored in `researches.result`

- Normal completion
  ([research.service.ts:285-288](../../apps/api/src/modules/research/research.service.ts#L285-L288)):
  `{ "completedThrough": "04-company-profiling", "resultsPerQuery": <number> }`.
- Resume completion
  ([research.service.ts:476-479](../../apps/api/src/modules/research/research.service.ts#L476-L479)):
  `{ "completedThrough": "04-company-profiling", "companies": <CompanyProfile[]> }`.

The asymmetry is the central defect for SDR-007: a **normal** completed run reports success while
storing no company profiles, and the **resume** path stores profiles but not `resultsPerQuery`,
`diagnostics` or `summary`. `result` is never cleared on failure or restart, so an older result
can survive next to a newer `error`.

### 11.2 How results are exposed over HTTP

| Route | Handler | Returns |
| --- | --- | --- |
| `POST /research` | `start` | `202 { jobId, status }` |
| `POST /research/:jobId/resume` | `resume` | `202 { jobId, status: 'RUNNING' }` |
| `GET /research/:jobId` | `getById` | the `Research` row with `executionToken` and `executionLeaseUntil` removed |
| `GET /research` | `getAll` | array of the same, no ordering, no pagination |

The three stage tables are **never** exposed. In the two read endpoints, neither `findUnique` nor
`findMany` loads the stage relations: `getById` selects no relation
([research.service.ts:114-118](../../apps/api/src/modules/research/research.service.ts#L114-L118))
and `getAll` selects no relation and adds no ordering or pagination
([research.service.ts:134](../../apps/api/src/modules/research/research.service.ts#L134)).
`resume()` does load them for its own validation
([research.service.ts:319-327](../../apps/api/src/modules/research/research.service.ts#L319-L327))
but returns only `{ jobId, status }`. `result` and `error` are returned verbatim. Correction of a
stale note elsewhere: the web schema comment claiming that stage 02 "currently returns the literal
string `completed`" does not describe the current service, which writes an object.

### 11.3 Temporary JSON files and snapshots

Path resolution is `process.cwd()/src/modules/research/temp/<name>.json`
([utils.ts:21-30](../../apps/api/src/modules/research/lib/utils.ts#L21-L30)), so the location
depends on the working directory of the API process, not on the module location. That is why the
same feature produced artifacts under both `apps/api/src/modules/research/temp/` (process started
in `apps/api`) and the repository-root `src/modules/research/stages/01-product-identification/temp/`
(older process started at the repository root).

| Stage | File-name prefixes written |
| --- | --- |
| 01 | `01.1-term-candidates-`, `01.2-searched-term-candidates-`, `01.3-prepared-candidates-`, `01.1-identified-product-` |
| 02 | `02.1-search-terms-`, `02.4-response-` |
| 03 | `03.1-criteria-`, `03.1-raw-failure-<3-digit index>-`, `03.1-assessed-pages-`, `03.2-assessment-result-` |
| 04 | `04-profiling-result-` |

Additional prefixes `04.1-profiling-input-`, `04.2-first-call-`, `04.3-gap-fill-`, `04.3-after-`,
`04.4-company-profile-`, `04.4-company-summary-` exist in `CompanyProfilingService` but belong to
developer methods (`profileDomain`, `profileFirstCall`, `fillGaps`, `buildProfile`) that have no
production caller; they do not run on the pipeline.

**Are they ever read?** No. `writeJsonFile` is called from the pipeline; `readJsonFile` and
`readIdentificationFixture` exist but have **zero call sites** in `apps/api/src` and
`apps/api/test` (a test mocks `writeJsonFile` only). Production execution, resumption and recovery
read exclusively from Prisma. "Snapshots" in the code are in-memory `MarketSnapshot` literals in
stage 04.3, never files.

`TERMINOLOGY_SNAPSHOT_DIR` is present in `apps/api/.env` but referenced by **no** source file; no
terminology-snapshot artifact type exists in this repository.

### 11.4 Can a completed research be used from the database alone?

- Through stage 03: **yes**. The product identity, page set, criteria, decisions and accepted
  domains are all in PostgreSQL (where the rows exist).
- Stage 04: **no** on the normal path. The profiles, the per-domain diagnostics and the batch
  summary exist only in the temp file. They cannot be reconstructed from stored rows; they can only
  be regenerated by re-running stage 04.1–04.4, which performs new scrapes and LLM calls.
- On the resume path: **yes**, for `companies` only; `diagnostics` and `summary` are dropped.
- Resumption does not need any file: `resume()` reads stage-01, stage-02, stage-03 and the product
  from PostgreSQL only. Recovery therefore does **not** depend on temp files; completeness of the
  final result does.

## 12. Research result completeness assessment

Distinct consistency checks, all measured on the live data:

| Check | Records |
| --- | --- |
| `COMPLETED` without `result.companies` | 34 of 37 |
| `COMPLETED` whose `completedThrough` is not the current label `04-company-profiling` | 32 of 37 |
| `COMPLETED` through `04-company-profiling` but without `companies` | 3 of 5 |
| `COMPLETED` without a persisted stage-03 row | 32 of 37 |
| Stage-03 result with domains but no persisted stage-04 profiles | 3 (15, 41 and 77 domains) |
| Stage-03 row without its stage-02 input | 2 |
| Stage-01 row without stage-02 and stage-03 | 2 |
| `FAILED` row that still carries a non-null `stage` label | 3 |
| Orphaned stage rows | 0 |

The `FAILED`-with-stage item is a real historical inconsistency, not a paraphrase: the current
failure handler clears `stage`
([research.service.ts:298-307](../../apps/api/src/modules/research/research.service.ts#L298-L307)),
so the three `FAILED` rows that still show `2.1 Searching terms...`, `03.1 Assessing pages...` and
`product-identification` cannot have been produced by the current handler. `INTERRUPTED` rows have
`stage = NULL`, which matches the current stale-run sweep.

Only **one** record (`cmwvzov2a…`) is simultaneously current-format, complete through all four
stages and carrying its profiles in PostgreSQL. A second (`cmwv2nvzp…`) carries profiles but is
missing its stage-01 and stage-02 rows. A third (`cmwufvywl…`) is complete but in the retired
company-discovery format. A fourth (`cmww8smxb…`) is current-format and complete through stage 03,
but its 77 profiles exist only in a temp file.

## 13. File-based research artifact inventory

All paths are exact. Sizes are bytes. Times are file modification times in the host time zone
(`Europe/Vilnius`, UTC+2). "State" is the Git classification. No file content is reproduced here;
sensitive groups are flagged, not quoted.

### 13.1 The 21 previously excluded untracked artifacts

| # | Path | Bytes | Modified | State | Classification |
| --- | --- | --- | --- | --- | --- |
| 1 | `apps/api/src/modules/research/stages/04-company-profiling/SPEC.md` | 30,359 | 2026-11-23 23:11 | untracked | KEEP_REFERENCE |
| 2 | `apps/api/test/company-profiling.batch.test.ts` | 4,957 | 2026-11-25 10:23 | untracked | KEEP_TEST |
| 3 | `apps/api/test/company-profiling.first-call.test.ts` | 25,867 | 2026-11-25 11:39 | untracked | KEEP_TEST |
| 4 | `apps/api/test/company-profiling.gap-fill.test.ts` | 6,847 | 2026-11-25 10:24 | untracked | KEEP_TEST |
| 5 | `apps/api/test/company-profiling.input.test.ts` | 6,466 | 2026-11-25 10:23 | untracked | KEEP_TEST |
| 6 | `apps/api/test/company-profiling.profile.test.ts` | 9,127 | 2026-11-25 12:12 | untracked | KEEP_TEST |
| 7 | `apps/api/test/fixtures/v5-16-domains.json` | 107,222 | 2026-11-25 10:05 | untracked | KEEP_TEST |
| 8 | `apps/api/test/research.04.integration.test.ts` | 7,170 | 2026-11-25 12:13 | untracked | KEEP_TEST |
| 9 | `apps/api/tmp-04-real-result.json` | 110,794 | 2026-11-25 11:16 | untracked | ARCHIVE_UNIQUE_DATA |
| 10 | `apps/api/tmp-04-summary.json` | 15,650 | 2026-11-25 11:16 | untracked | DELETE_CANDIDATE |
| 11 | `apps/api/tmp-inspect-small-run.json` | 41,310 | 2026-11-24 20:57 | untracked | DELETE_CANDIDATE |
| 12 | `apps/api/tmp-inspect.json` | 29,719 | 2026-11-24 22:11 | untracked | DELETE_CANDIDATE |
| 13 | `apps/api/tmp-run-real-04.mjs` | 2,024 | 2026-11-25 11:14 | untracked | UNKNOWN |
| 14 | `pnpm-lock.yaml` | 230,166 | 2026-11-18 10:41 | untracked | DELETE_CANDIDATE |
| 15 | `pnpm-workspace.yaml` | 132 | 2026-11-18 10:42 | untracked | DELETE_CANDIDATE |
| 16 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json` | 1,422 | 2026-11-15 14:01 | untracked | ARCHIVE_UNIQUE_DATA |
| 17 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json` | 1,447 | 2026-11-15 14:01 | untracked | ARCHIVE_UNIQUE_DATA |
| 18 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json` | 5,645 | 2026-11-15 14:15 | untracked | ARCHIVE_UNIQUE_DATA |
| 19 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json` | 2,520 | 2026-11-15 14:25 | untracked | ARCHIVE_UNIQUE_DATA |
| 20 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json` | 4,491 | 2026-11-15 14:25 | untracked | ARCHIVE_UNIQUE_DATA |
| 21 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json` | 6,677 | 2026-11-15 14:46 | untracked | ARCHIVE_UNIQUE_DATA |

None of the 21 is git-ignored; all are untracked and would be lost by a `git clean`. All 21 were
present and unmodified at the end of the reconciliation (Appendix B, check 7).

At the time of writing, this table records the state **at inventory time**. A later, separately
authorized follow-up archived the eight `ARCHIVE_UNIQUE_DATA` artifacts and removed the three
`DELETE_CANDIDATE` files listed here; the table is preserved as the historical record of what was
inventoried. See §22–§23 for the executed result and Appendix C for its proof.

### 13.2 Per-artifact findings

**#1 `04-company-profiling/SPEC.md`** — Markdown design specification for stage 04 (draft, 670
lines). Not referenced by code; contains no result payload. It does contain non-example
email/phone literals in its examples (SDR-003 sensitivity review), so it must not be committed
without sanitization. Removing it would not affect execution, tests or recovery.
`KEEP_REFERENCE`.

**#2–#8 tests and fixture** — the six company-profiling/integration tests and
`test/fixtures/v5-16-domains.json` (16 domains / 16 offers). The fixture is read by static and
integration tests, not by the runtime pipeline. The fixture and several tests contain non-example
contact literals, which is exactly why SDR-003 excluded them from the checkpoint. They are
required by tests. Removing them would silently reduce test coverage and break
`research.04.integration.test.ts`. `KEEP_TEST`.

**#9 `tmp-04-real-result.json`** — a full stage-04 `CompanyProfilingResult` for research
`cmwv2nvzp…`: `{promptVersion, createdAt, targetCountry, targetLanguage, product, domains[16],
diagnostics[16], summary}`. The 16 profile objects are **preserved in PostgreSQL** — identical
domain set hash (`9a7489125c3b4833`), identical status counts (13 `profiled`, 3 `needs_review`),
identical offer total and per-domain offer fingerprint (`182d0c7f3e1e8212`). What is **not** in
PostgreSQL: `promptVersion`, `createdAt`, the per-domain `diagnostics` (gap-fill trace, reused
flag, selected pages, second-call outcome) and the batch `summary`. It contains real company and
contact data. Removing it loses only the diagnostics/summary provenance of that run.
`ARCHIVE_UNIQUE_DATA`.

**#10 `tmp-04-summary.json`** — a derived aggregate of the same 16 profiles
(`counts` + `rows[16]` with domain, company, emails, market and `aPrices` columns). Every value in
it is derivable from `researches.result.companies` of `cmwv2nvzp…`; it is a rendered view, not
independent research output. Contains real company/contact data. Removing it cannot affect
execution, tests or recovery. `DELETE_CANDIDATE`, owner decision.

**#11 `tmp-inspect-small-run.json`** — an inspection view of the stage-03 data of a 15-domain run:
`{criteria, decisions, decisionCounts, targetPages[5], allDecisions[25], resultPages[15]}`. The 25
decisions and 15 result pages match the persisted stage-03 row of `cmwv1wth9…` (25 decisions,
15 domains). It is a flattened re-projection of stored data plus counts. Contains page/company
data. `DELETE_CANDIDATE`, owner decision.

**#12 `tmp-inspect.json`** — the same inspection shape for the 16-domain run:
`{criteria, decisions, counts, target[1], all[25], resultPages[16]}`; matches the persisted
stage-03 row of `cmwv2nvzp…` (25 decisions, 16 domains). Derived projection of stored data.
`DELETE_CANDIDATE`, owner decision.

**#13 `tmp-run-real-04.mjs`** — a 77-line one-off Node replay. It `import`s the **built** `dist/`
stage-04 modules, reads the saved stage-03 result of a hardcoded job id (`cmwv2nvzp…`), calls
Firecrawl and the LLM, writes `tmp-04-real-result.json`, and then executes a direct
`UPDATE researches SET status='COMPLETED', result = {completedThrough, companies} …`. It is the
provenance of the 16-profile result in §10.7. It contains no research payload and no credential
(value comes from `process.env`). Executing it would rewrite a research row — forbidden under the
freeze. Removing it would not affect execution, tests or recovery but would erase the provenance
record. `UNKNOWN` — owner decision, archive rather than delete is recommended.

**#14–#15 `pnpm-lock.yaml`, `pnpm-workspace.yaml`** — generated lockfile (v9, three importers) and a
six-line workspace file whose `allowBuilds` entries are still the literal placeholders
`set this to true or false`. The repository uses npm (`package.json`, `package-lock.json`, npm
scripts, README); nothing references pnpm. `pnpm-workspace.yaml` could not even drive a working
install as written. Removing them changes no command, test or runtime path.
`DELETE_CANDIDATE`, owner decision.

**#16–#21 six `companies-*.json` dumps** — company-discovery results from
`promptVersion` `company-discovery-v5`, `-v6` and `-v7`, written 2026-11-15 between 14:01 and
14:46, under the old root-`src` path. Each is
`{promptVersion, createdAt, product{productName, categoryName, generalCategoryName}, results[...]}`
with 1, 1, 3, 2, 2 and 1 company records (10 total) carrying
`{domain, name, legalName, companyCode, vatCode, address, city, country, emails, people, offers?,
verdict, confidence, sources, notes, status}`. The `people` array is empty in all ten records.

These records **cannot** be in PostgreSQL: the earliest research row is `2026-11-18 13:47:21`, three
days after these files; no table stores company-discovery results; and the only `result.companies`
payloads in the database are the 146 profiles listed in §10.7, which belong to research runs of
2026-11-24 and 2026-11-25 and use the `04-company-profiling` / `04-company-discovery` schema, not
the `{promptVersion, product, results[]}` shape stored in these files. They are unique historical
output of a stage that no longer exists. All six share one product identity hash
(`be71803af377739e`), which coincides with the stage-01 product identity of the 2026-11-24 research
`cmwuq1ba8…` — the same product was researched again later, but that is a different run with a
different pipeline. They contain real company and contact data. `ARCHIVE_UNIQUE_DATA`.

### 13.3 Git-ignored research artifacts

| Path / group | Files | Bytes | State | Findings |
| --- | --- | --- | --- | --- |
| `apps/api/src/modules/research/temp/` | 15 | 6,956,146 | ignored | Runtime dumps: `01.1-*` (2), `01.2-*` (1), `01.3-*` (1), `02.1-*` (1), `02.4-*` (1), `03.1-criteria-*` (1), `03.1-raw-failure-*` (5), `03.1-assessed-pages-*` (1), `03.2-assessment-result-*` (1), `04-profiling-result-*` (1) |
| `apps/api/.runs/` | 4 | 17,593 | ignored | One-off `.mjs` diagnostic scripts dated 2026-11-18 (`loss-audit.mjs`, `loss-audit2.mjs`, `v18-clothing.mjs`, `v19-smoke.mjs`); no contact data, no URLs; two reference `process.env` |
| `apps/api/.env` | 1 | — | ignored | Credentials and configuration. Fingerprinted only (SHA-256 `c63cbbb1…`); never read, printed or copied |
| build output (`.next/`, `dist/`, `apps/web/next-env.d.ts`, `*.tsbuildinfo`, `test-results/`) | many | — | ignored | Generated artifacts, not research data; outside this cleanup scope |

The 15 temp dumps are all from **one** run: research `cmww8smxb…`, started
`2026-11-25 16:52:15` local and completed `18:10:11` local. Evidence: the file-name timestamps
match that row's `"createdAt"`/`"updatedAt"`, `01.3-prepared-candidates` has 141 items exactly
matching that row's `preparedCandidates` length, `03.1-assessed-pages` has 387 items matching that
row's `decidedPages` = 387, `03.2-assessment-result` has 77 domains whose set hash
(`7b0a44a3afa5d218`) equals the stored stage-03 domain set, and `04-profiling-result` has the same
77-domain set hash.

Artifacts of earlier runs are absent from that directory, so only the final run's diagnostics
survive. That is an observation about the current directory content; this task did not attempt to
establish who removed the others.

**`04-profiling-result-dailylen-2026-11-25-18-10-11.json`** (504,244 bytes) is the most important
ignored artifact: it holds the only copy of 77 company profiles (69 `profiled`, 8 `needs_review`,
173 offers) for a `COMPLETED` research whose PostgreSQL `result` contains no companies.
`ARCHIVE_UNIQUE_DATA` — this file is the single strongest argument against deleting the temp
directory.

### 13.4 Artifact classes that do not exist

- No terminology-snapshot files and no code referencing `TERMINOLOGY_SNAPSHOT_DIR` (§11.3).
- No `discovery-*.json`, `crawl-results.json`, `firecrawl-preview.json` or `profile-*.json` files,
  although `.gitignore` reserves those names.
- No separate page-assessment output outside the temp directory and the stage-03 row.
- No research fixture other than `apps/api/test/fixtures/v5-16-domains.json`.

## 14. Cleanup classification and proposed manifest

Taxonomy used: `KEEP_RUNTIME`, `KEEP_TEST`, `KEEP_REFERENCE`, `ARCHIVE_UNIQUE_DATA`,
`DELETE_CANDIDATE`, `UNKNOWN`.

### 14.1 Classification totals

| Class | Files | Bytes |
| --- | --- | --- |
| KEEP_RUNTIME | 0 (no existing file is read by the pipeline; the 15 temp dumps are written, never read) | 0 |
| KEEP_TEST | 7 (six tests + fixture) | 167,656 |
| KEEP_REFERENCE | 1 (`SPEC.md`) | 30,359 |
| ARCHIVE_UNIQUE_DATA | 8 (7 untracked + 1 ignored: `tmp-04-real-result.json`, six legacy dumps, the ignored `04-profiling-result-*` dump) | 132,996 untracked + 504,244 ignored = 637,240 |
| DELETE_CANDIDATE | 5 (`tmp-04-summary.json`, `tmp-inspect.json`, `tmp-inspect-small-run.json`, both pnpm files) | 316,977 |
| UNKNOWN | 1 (`tmp-run-real-04.mjs`) + 4 ignored `.runs/*.mjs` | 2,024 + 17,593 |

`KEEP_RUNTIME` count is zero because no existing file is read by the current implementation. The
15 ignored temp dumps are *written* by runtime code but are not required for execution, resumption
or recovery (§11.3, §11.4); they are therefore classified by content, not by their author.

### 14.2 Proposed cleanup manifest (not executed)

**Proposed to keep, unchanged:**

```text
apps/api/src/modules/research/stages/04-company-profiling/SPEC.md
apps/api/test/company-profiling.batch.test.ts
apps/api/test/company-profiling.first-call.test.ts
apps/api/test/company-profiling.gap-fill.test.ts
apps/api/test/company-profiling.input.test.ts
apps/api/test/company-profiling.profile.test.ts
apps/api/test/fixtures/v5-16-domains.json
apps/api/test/research.04.integration.test.ts
```

**Proposed to archive outside the repository (after an owner-approved preservation step):**

```text
apps/api/tmp-04-real-result.json
apps/api/src/modules/research/temp/04-profiling-result-dailylen-2026-11-25-18-10-11.json
src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json
src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json
src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json
src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json
src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json
src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json
```

**Proposed for deletion, only after separate explicit owner authorization:**

```text
apps/api/tmp-04-summary.json
apps/api/tmp-inspect.json
apps/api/tmp-inspect-small-run.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

**Requires an owner decision on retention; not proposed for deletion:**

```text
apps/api/tmp-run-real-04.mjs
apps/api/.runs/loss-audit.mjs
apps/api/.runs/loss-audit2.mjs
apps/api/.runs/v18-clothing.mjs
apps/api/.runs/v19-smoke.mjs
```

**Not part of this manifest:** the other 14 files in `apps/api/src/modules/research/temp/`
(intermediate dumps whose final results are in PostgreSQL). They are neither required nor proposed
for deletion; they are covered by the group recommendation in §13.3. If the owner wants the
temp directory cleaned, the safe rule is: archive the `04-profiling-result-*` file first, then the
rest may go, because everything else is reproducible only by re-running paid work but is already
reflected in persisted stage rows.

Justifications are in §13.2 and §13.3. **Nothing in this manifest was executed** at reconciliation
time; the later authorized follow-up executed the archive set and the three-file deletion only
(§22–§23). No file was deleted, moved, renamed, imported, archived or rewritten, and no database
record was touched by the reconciliation itself.

## 15. Unique historical data requiring owner decisions

1. **77 company profiles outside PostgreSQL.** Research `cmww8smxb…` is `COMPLETED` with
   `result = {completedThrough, resultsPerQuery}`. Its stage-04 output — 77 profiles, 173 offers,
   69 `profiled`, 8 `needs_review`, plus 77 diagnostics and a summary — exists only in
   `apps/api/src/modules/research/temp/04-profiling-result-dailylen-2026-11-25-18-10-11.json`. The
   record cannot be resumed (the resume endpoint rejects `COMPLETED`), and the normal path will
   never add the profiles. Preserving it requires an import or a re-run, both separately
   authorized.
2. **Ten legacy company-discovery records.** The six `src/.../companies-2026-11-15-*.json` dumps
   predate every research row, use three retired prompt versions and have no database
   representation. Nothing else contains them.
3. **Stage-04 diagnostics and summary for the 16-profile run.** Artifact 9 in §13.1: the profiles
   themselves are in PostgreSQL; the gap-fill trace, selected pages, second-call outcome, prompt
   version and batch summary are only in `apps/api/tmp-04-real-result.json`.
4. **Raw stage-01/02 intermediate data.** `01.2-searched-term-candidates` (40 term searches with
   raw provider results) and `02.1-search-terms` (generated queries) are not persisted anywhere:
   stage 01 stores only `identifiedProduct` + `preparedCandidates`, stage 02 only the page list.
5. **Raw model failures.** The five `03.1-raw-failure-*.json` files keep the model's raw text for
   pages that failed assessment; only the error string survives in `decisions`.

Items 1 and 3 are the only ones where "not in PostgreSQL" changes what SDR-007 can show. Items 2,
4 and 5 are historical diagnostics whose loss would not change any presentable result.

## 16. Research-results data contract for SDR-007

Everything below was read from the actual JSON values in PostgreSQL, from the file artifacts and
from the TypeScript types. No field is invented. Counts are over the 146 persisted profiles and
276 persisted offers unless stated otherwise.

### 16.1 Envelope

`GET /research/:jobId` and `GET /research` return the `researches` row:

```text
{
  id: string
  productId: string
  country: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED'
  stage: string | null            // free-text progress label, not an enum
  result: unknown                 // open JSON; see 16.2-16.6
  error: string | null            // provider/exception message, untyped
  lastHeartbeatAt: string | null  // ISO timestamp
  createdAt: string
  updatedAt: string
}
```

`executionToken` and `executionLeaseUntil` exist in the table and are removed before the response.
`result` is `null` for 5 records, an object for 37, and never an array or string.

Three `result` envelopes occur:

```text
A. { completedThrough: string, resultsPerQuery?: number }
B. { completedThrough: string, identificationPageCount?: number, selectedPageCount?: number,
     resultsPerQuery?: number }                                    // legacy, 28 records
C. { completedThrough: string, companies: CompanyProfile[] }      // 3 records
```

### 16.2 `CompanyProfile` (only inside `result.companies`)

Type from
[company-profiling.types.ts:138-146](../../apps/api/src/modules/research/stages/04-company-profiling/company-profiling.types.ts#L138-L146),
confirmed against stored values:

```text
{
  domain: string
  registrableDomain: string
  status: 'profiled' | 'needs_review' | 'rejected' | 'error'
  error?: { code: 'fetch_failed' | 'llm_failed' | 'schema_invalid' | 'no_sources',
            message: string }                    // never observed in stored data
  company: CompanyProfileCompany                 // see 16.3
  offers: CompanyProfileOffer[]                  // see 16.4
  usage: { llmCalls: number, promptTokens: number | null,
           completionTokens: number | null, fetches: number,
           fetchCredits: number | null, durationMs: number | null }
}
```

`domain`, `registrableDomain`, `status`, `company`, `offers` and `usage` are present on all 146
profiles. `error` is absent everywhere.

### 16.3 `company` (identity, legal and contact block)

```text
{
  name: string | null          // 129 / 146 non-empty
  legalName: string | null     //  58 / 146
  code: string | null          //  16 / 146   (company registry code)
  vat: string | null           //  13 / 146
  address: string | null       //  64 / 146
  city: string | null          //  68 / 146
  country: string | null       //  44 / 146
  contactFormUrl: string | null//   9 / 146
  emails: Array<{ value: string, label: 'sales' | 'general' | null, sourceUrl: string }>
                               //  96 / 146 profiles, 133 values
  phones: Array<{ value: string, normalised: string | null,
                  label: 'sales' | 'general' | null, sourceUrl: string }>
                               //  85 / 146 profiles, 150 values
  sources: string[]            // 142 / 146 non-empty
}
```

**There is no contact-person field.** No `people`, `contacts`, `persons`, `firstName`,
`lastName`, `role` or `position` key exists in any stored profile. The retired company-discovery
format had a `people` array, but it is empty in all ten legacy records.

### 16.4 `offers[]`

```text
{
  id: string                        // synthesized by stage 04 from the stage-03 position
                                    // ('03-0001', …; docs/system/research.md §11)
  item: string                      // 276 / 276
  verdict: 'a' | 'b'                // 30 'a', 246 'b'
  traits: Record<string, 'confirmed' | 'differs' | 'unknown'>   // keys are study-specific
  pageIds: string[]
  sourceUrl: string                 // 214 / 276; all 62 legacy-format offers lack it
  marketFrom03: { status: 'target' | 'other' | 'unclear',
                  note: string | null, sourceUrl: string, quote: string | null }
                                    // object in 214 offers, plain string in the 62 legacy ones
  market: {
    status: 'target' | 'other' | 'unclear'      // 44 'target', 232 'unclear'
    resolvedBy: 'evidence' | 'none'
    basis?: '03' | '04' | 'none'                // 138 / 1 / 75; absent in 62 legacy offers
    diagnostics?: string[]
    evidence: Array<{ channel: 'delivery' | 'pickup' | 'purchase',
                      direction: 'allows' | 'restricts',
                      scope: 'domain' | 'offer', appliesTo: string[],
                      quote: string, sourceUrl: string }>   // non-empty in 46 / 276
    channels: Record<'delivery' | 'pickup' | 'purchase', 'open' | 'closed' | 'unknown'>
    conflict: boolean
  }
  prices: CompanyProfilePrice[]      // non-empty in 12 / 276 offers, 14 price values
}
```

`traits` keys are the study's own trait names and differ per run — observed keys include
Lithuanian study terms such as `medienos_rusis`, `apdorojimas`, `gaminio_tipas` and, in the legacy
record, `material` / `treatment`. **They must not be hardcoded.**

### 16.5 `prices[]`

```text
{
  amount: number
  currency: string | null      // observed: 'EUR' only (14 / 14)
  unit: 'm2' | 'm' | 'pc' | 'pack' | null
  vatIncluded: boolean | null
  priceType: 'exact' | 'from'  // 12 'exact', 2 'from'
  variant: string | null
  quote: string
  sourceUrl: string
}
```

Price coverage is very sparse: 12 of 276 offers (4.3%). A price is optional evidence, which
matches `PRODUCT.md`; a results view must render "no published price" as a normal state.

### 16.6 Stage-03 data (intermediate, in `research_stage_03_results`)

```text
criteria: { language: string, traits: Array<{ name: string, expected: string }> }
        | { category: string, traits: [...] }      // promptVersion page-assessment-v4.1
promptVersion: string                              // 'page-assessment-v5' (4), '…-v4.1' (1)
decisions: Array<{
  url: string, canonicalUrl: string, pageIndex: number,
  status: 'decided' | 'error',
  verdict: 'a' | 'b' | 'none' | null,
  reason: string, error: string | null,
  excludedFrom04: 'offer_language_mismatch' | null,
  facts: { note: string,
           offer: { item: string, quote: string, evidence_type: string },
           market: { note: string, status: string },
           traits: Record<string, { match: string, value: string | null }>,
           category: { match: string, quote: string },
           publisher: string, offerLanguage: string } | null
}>
result: { targetCountry: string, targetLanguage: string,
          product: { productName, categoryName, generalCategoryName, description },
          domains: Array<{ domain: string,
                           pages: Array<{ page: { url, canonicalUrl, domain, title,
                                                  highlights[], snippets[], summary, content },
                                          verdict: 'a' | 'b',
                                          reason: string, facts: (same as above) }> }> }
decidedPages: number, errorPages: number
```

Measured: 1,358 decisions (1,338 with `facts`, 1,338 with `reason`, 20 `status = error`), 524
stage-03 pages across 5 rows. Verdict distribution over decisions: `none` 766, `b` 457, `a` 115,
error 20. `excludedFrom04 = offer_language_mismatch` on 97 decisions. `result.domains` embed the
**full page content**, which is why these rows reach 1.3 MB.

### 16.7 Stage-01 data (intermediate)

```text
identifiedProduct: { productName: string, categoryName: string,
                     generalCategoryName: string, understanding: string, notes: string }
preparedCandidates: Array<{ url, canonicalUrl, domain, title, highlights[], snippets[],
                            summary: string | null, content: string | null }>
```

5 rows, 701 prepared candidates in total; all five have non-empty `productName`,
`categoryName` and `understanding`.

### 16.8 Field-group availability

| Field group | In persisted results | Only in intermediate stage rows | Only in file artifacts | Missing | Inconsistent across history |
| --- | --- | --- | --- | --- | --- |
| Research overview and metadata | yes (`id`, `country`, `status`, `stage`, `error`, timestamps, `completedThrough`) | — | — | schema version; per-run product text snapshot | no |
| Identified product and local terminology | no | yes (stage 01 `identifiedProduct`) | — | in `researches.result` | no |
| Company counts | derivable only (`companies.length`) | yes (`result.domains.length`) | batch `summary` | no persisted count; no confirmed-seller count | yes |
| Company matching and classification | yes (`status`, offer `verdict`, `market.status`) | yes (decision `verdict`) | — | `rejected`/`error` statuses never observed | yes (legacy offer shape) |
| Company names and domains | yes (146 domains; 129 names) | yes | yes | — | no |
| Legal company details | partially (`legalName` 58, `code` 16, `vat` 13) | — | legacy `companyCode`/`vatCode` | most are null | yes (legacy key names) |
| Addresses and countries | partially (`address` 64, `city` 68, `country` 44) | — | — | most are null | no |
| Contact persons | **no** | no | legacy `people` (always empty) | entirely absent | — |
| Email addresses | yes (96 profiles, 133 values) | — | legacy `emails` | — | yes (legacy entries lack `label`) |
| Telephone numbers | yes (85 profiles, 150 values) | — | — | — | yes (legacy entries lack `normalised`) |
| Discovered products | yes (`offers[].item` 276/276, traits, pageIds) | yes | — | — | yes (trait key names) |
| Prices and currencies | yes but sparse (12 offers, EUR only) | no | no | most offers have none | yes (legacy `prices` absent) |
| Source URLs | yes (`sourceUrl` 214/276) | yes (page urls) | yes | 62 legacy offers | yes |
| Evidence and relevance explanations | yes (`market.evidence` 46/276, `marketFrom03`, `reason` in stage 03) | yes (quote/publisher facts) | stage-04 diagnostics | offer-level quote text outside stage-03 rows | yes (`marketFrom03` string vs object) |
| Research completion and error information | yes (`status`, `error`, `completedThrough`) | — | — | no per-stage or per-company error record in stored data | yes (5 `completedThrough` labels, 3 stale `stage` labels) |

### 16.9 Can SDR-007 present existing results without changing the research implementation?

**Yes, for what PostgreSQL already holds**, with these facts a UI must handle honestly:

- Read `result.companies` from `GET /research/:jobId`; it exists for 3 of 42 records. Two use the
  current format (16 and 105 profiles) and one the retired format (25).
- 34 of 37 `COMPLETED` records have no profiles. The view must distinguish "completed, profiles not
  persisted by that run's path" from "empty result" and from "failed", rather than showing an
  error or an empty table as if the research found nothing.
- The result envelope has no schema version and 7 historical shapes; a client must discriminate by
  key presence, and `completedThrough` is not a reliable stage indicator for older rows.
- Trait keys inside offers are study-specific and must be rendered data-driven.
- `price`, `legalName`, `vat`, `code`, `address`, `city`, `country`, `contactFormUrl` and both
  contact arrays are frequently null/empty; "unknown" is the normal state.
- A raw-JSON view does not scale to these payloads: the 105-profile record serializes far beyond
  the current 20,000-character truncation (§17), so SDR-007 needs a typed renderer, not a bigger
  `<pre>`.

**Genuine data-availability blockers, stated separately:**

1. **Stage-04 output is not persisted on the normal path** (§7 of `docs/system/research.md`, §11.4
   here). SDR-007 can display only the three records that happen to carry `companies`.
2. **Stage 01/02/03 rows are not exposed by the API** (§11.2). Identified product/terminology,
   criteria, per-page decisions and per-page offers therefore cannot reach the UI without adding a
   read-only endpoint or expanding the research response — a change inside
   `apps/api/src/modules/research`, which the freeze prohibits without explicit authorization.
3. **The 77 profiles of `cmww8smxb…` are outside PostgreSQL** (§15.1). Presenting them requires an
   authorized import or re-run.
4. **Contact persons are not captured at all.** No UI can present what no stage stores.

Blockers 2–4 are data/interface availability limits, not SDR-007 implementation difficulties.
Blockers 1 and 3 are consequences of the frozen persistence behaviour, not SDR-007 scope.

### 16.10 Sanitized structural example

A trimmed structural sample (no real values):

```json
{
  "completedThrough": "04-company-profiling",
  "companies": [
    {
      "domain": "<domain>",
      "registrableDomain": "<registrable-domain>",
      "status": "profiled",
      "company": {
        "name": "<company-name-or-null>",
        "legalName": null,
        "code": null,
        "vat": null,
        "address": "<address-or-null>",
        "city": "<city-or-null>",
        "country": null,
        "emails": [{ "value": "<email>", "label": "sales", "sourceUrl": "<url>" }],
        "phones": [{ "value": "<phone>", "normalised": "<e164-or-null>",
                     "label": null, "sourceUrl": "<url>" }],
        "contactFormUrl": null,
        "sources": ["<url>"]
      },
      "offers": [
        {
          "id": "03-0001",
          "item": "<offer-item>",
          "verdict": "b",
          "traits": { "<study-trait>": "differs" },
          "pageIds": ["03-0001"],
          "sourceUrl": "<url>",
          "marketFrom03": { "status": "unclear", "note": "<note>",
                            "sourceUrl": "<url>", "quote": "<verbatim-quote>" },
          "market": {
            "status": "unclear", "resolvedBy": "evidence", "basis": "03",
            "evidence": [{ "channel": "delivery", "direction": "restricts",
                           "scope": "domain", "appliesTo": ["03-0001"],
                           "quote": "<verbatim-quote>", "sourceUrl": "<url>" }],
            "channels": { "delivery": "closed", "pickup": "unknown", "purchase": "unknown" },
            "conflict": false
          },
          "prices": []
        }
      ],
      "usage": { "llmCalls": 2, "promptTokens": 0, "completionTokens": 0,
                 "fetches": 1, "fetchCredits": null, "durationMs": 0 }
    }
  ]
}
```

## 17. Existing frontend presentation assessment

Read-only inspection of `apps/web`.

**Routes.** `/researches` (list of all jobs), `/researches/[jobId]` (one job), `/products/[id]`
(one product plus its five newest researches) and `/`. Only `/researches/[jobId]` renders a
result.

**Rendering.** `app/researches/[jobId]/page.tsx` → `_pages/research/ui/research-page.tsx` →
`features/track-research/ui/research-details.tsx`, which renders status badge, spinner, raw `stage`
text, status line, stale hint, resume action, `error` in a `<pre>`, and then the always-mounted
`ResearchResultView`
([research-result-view.tsx:47-87](../../apps/web/features/track-research/ui/research-result-view.tsx#L47-L87)).
That component has exactly three branches: null → "No result yet."; string → the string; anything
else → a `<details>` containing `JSON.stringify(result, null, 2)` truncated at 20,000 characters,
with a copy button. There is no COMPLETED-specific block: the same ternary runs for every status.

**Consumed API.** `GET /research/:jobId` and `GET /research` through
`entities/research/api/research.server.ts:13-24`; polling via
`entities/research/api/research.client.ts:19-28` through the same-origin
`app/api/research/[jobId]/route.ts`; resume via `POST /api/research/[jobId]/resume`;
`POST /research` for creation. The wire schema types `result` as `z.unknown()`
([schema.ts:27](../../apps/web/entities/research/model/schema.ts#L27)) — deliberately, with a
comment that is now stale (it claims stage 02 returns the literal string `completed`).

**Are final company profiles accessible?** Not as data. No company, offer, market, price or
contact schema, entity, formatter or component exists in `apps/web`; the string `companies` appears
only in marketing copy and settings help text. An object result reaches the user only as truncated
raw JSON. The UI therefore stops at status + stage + error + raw blob.

**Reusable for SDR-007.** `.card` / `.card-header` and the `ResearchResultView` shell
(`research-result-view.tsx:51-53`); `ResearchStatusBadge`
(`features/track-research/ui/research-status-badge.tsx:19-25`) with `.status` / `.dot` / `.ok` /
`.error` / `.muted`; `.button` variants and `.actions`; the list pattern
`.product-list` / `.product-item` used on `/researches` and `/products/[id]`; date and id formatting
in `shared/lib/format.ts:38-81` (`formatDateTime`, `formatDate`, `formatTime`, `shortenId`) with the
fixed `Europe/Vilnius` zone; `shared/lib/toast`; the error/empty/loading patterns in
`app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx` and the `.muted` / `.hint` / `.error` /
`.form-error` classes.

**Current limitations.** No typed result contract and an explicit "do not narrow it" instruction in
the code; no table primitive or table styles anywhere in `app/globals.css`; raw JSON truncated at
20,000 characters (the 105-profile record exceeds that); no per-stage view; no formatting for
counts, money, markets, traits or contacts; `stage` rendered as an unparsed string; the list and
product-history views show only country, date and badge.

Observation only, not a change: `research-result-view.tsx:39-46` and `entities/research/model/schema.ts:13-20`
carry stale comments about a string result. Fixing them is not authorized here.

## 18. SDR-007 readiness assessment

- SDR-007 can be scoped against **real, persisted data** for the research overview, company
  identity, domains, offers, market decisions, contacts, sparse prices, source URLs and evidence.
- SDR-007 can be implemented **without modifying the research implementation or its persistence
  behaviour** if it presents `researches.result` and tolerates the three records that carry
  companies plus the 34 that do not. No research code change is required to read that.
- SDR-007 should plan for the historical formats: 7 result shapes, 5 `completedThrough` labels, 2
  offer shapes (`marketFrom03` object vs string, `sourceUrl` present vs absent), study-specific
  trait keys, and nullable identity/contact fields.
- SDR-007 must surface "completed without persisted company profiles" explicitly. It is the normal
  outcome for 34 of 37 completions today, not an error case.
- If SDR-007 needs stage-01 terminology or stage-03 page-level evidence, that is a **separate
  authorization**: an API addition inside the protected research module, or an import of stage
  data into a readable form. SDR-006 does not authorize either.
- If the owner wants the 77 profiles of `cmww8smxb…` visible, an import or a re-run must be
  authorized first; the UI cannot manufacture them.

**Conclusion:** SDR-007 is not blocked for the data that PostgreSQL already contains. It is blocked
only for the stage-04 completeness gap, the unexposed stage tables and the absent contact-person
field — each a separate owner decision, listed in §8 and §15.

## 19. Documentation reconciliation

One confirmed documentation inconsistency was corrected, in `README.md` only, under "Email
accounts":

- Before: the verification migration "has not been applied", and until then connection
  verification "can only be exercised against the mock API".
- After: both migrations are recorded **and applied** to the local database (10 of 10), and
  real-provider verification was completed on 2026-11-26 for the configured account, so it no
  longer depends on the mock API.
- Evidence: [SDR-005 §32](SDR-005-email-connection-testing.md#32-database-deployment-protected-backup-and-final-deployment-proof-2026-11-26)
  (migration applied, ledger 10/10/0/0) and
  [SDR-005 §34](SDR-005-email-connection-testing.md#34-final-human-acceptance-and-closure-2026-11-26)
  (real-provider SMTP and IMAP `VERIFIED`).

No other README statement was touched. `PRODUCT.md`, `AGENTS.md`, the ADRs and the system
documentation were not modified.

Other observed documentation inconsistencies were **reported, not fixed**, because they are outside
this task's authorized correction: the stale stage-02 "returns the literal string" comments in
`apps/web` (§17), and `docs/system/research.md` §12's open questions about applied migrations and
historical rows, which §10 of this document now answers.

## 20. Revised product roadmap

Recorded as approved by the human owner; it is not execution authorization for any later task.

| Task | Title | Position |
| --- | --- | --- |
| SDR-006 | Research Data Reconciliation | this task; read-only inventory and data contract |
| SDR-007 | Research Results Presentation | next; consumes §16 |
| SDR-008 | Email Account Assignment to Research | after results presentation |
| SDR-009 | Initial Email and Recipient Selection | after assignment |
| SDR-010 | Email Sending and Communication History | after selection |
| SDR-011 | Incoming Email and Reply Management | after sending/history |
| SDR-012 | AI-Assisted Communication | deferred until the basic communication workflow works |

The initial communication MVP uses an owner-written subject and message, shared by all selected
recipients and sent individually. AI-generated initial messages and personalisation are deferred.
The Research Implementation Freeze remains fully active; SDR-007–SDR-012 do not lift it.

## 21. Freeze and read-only confirmation

- Research Implementation Freeze was active for the whole task. No file under
  `apps/api/src/modules/research` was modified; the 64-file research tree hash recorded at
  baseline is unchanged at the end (Appendix B, check 10).
- No application source, prompt, schema, test, fixture, configuration or `.env` was modified.
- All database access used a single `READ ONLY` `REPEATABLE READ` transaction per inspection; no
  `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` or migration was executed.
- No record count, fingerprint or checksum differs before and after the proof (Appendix B,
  check 8).
- All 21 previously excluded artifacts were byte-identical to their baseline hashes at the end of
  the reconciliation (Appendix B, check 7). The later authorized follow-up archived eight of them
  and removed three, leaving 18 (Appendix C, checks 1–4).
- The reconciliation itself deleted nothing, moved nothing, imported nothing and archived nothing.
- No research job, provider call, SMTP/IMAP connection or service restart occurred.
- Nothing was staged, committed or pushed.
- SDR-006 is not marked `DONE`; SDR-007 was not started.

## 22. Historical research data preservation (executed)

### 22.1 Authorization

The human owner accepted the SDR-006 inventory and authorized, in a separate follow-up: one
timestamped archive of the eight `ARCHIVE_UNIQUE_DATA` artifacts under the existing protected
backup root, restricted access, and — only after successful verification — the removal of exactly
three named redundant derived files. The final company-profile persistence defect was explicitly
**not** to be corrected here; it is to be handled under a separately authorized Research
Implementation Freeze exception (§24).

### 22.2 Archive

| Item | Value |
| --- | --- |
| Root | `C:\Users\msmig\Projektai\_backupsForProjects` (existing protected backup root) |
| Archive directory | `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-research-20261126-134911` |
| Created | 2026-11-26 13:49:11 local time (`Europe/Vilnius`) |
| Layout | repository-relative paths preserved beneath the archive directory |
| Files | 8 |
| Archived data | 637,240 bytes |
| Manifest | `manifest.csv`, 1,339 bytes, SHA-256 `9ece5459a1f55ab175ac1c81e6982a0e4157d64f608dcf9a29e9473a48eef7db` |
| Manifest columns | `RelativePath`, `Bytes`, `Sha256` |
| Access | inheritance removed on the archive directory; explicit FullControl only for `NT AUTHORITY\SYSTEM`, `BUILTIN\Administrators` and `ALFASISDEV\msmig`; 0 inherited ACEs; 0 `CodexSandboxUsers` ACEs |
| Access scope | applied only to the newly created archive directory and its contents; the parent root and the two earlier database backups were not touched |

`_backupsForProjects` is outside the Git working tree, so no archive content can enter the
repository.

### 22.3 Contents

| # | Relative path | Bytes | SHA-256 |
| --- | --- | --- | --- |
| 1 | `apps/api/tmp-04-real-result.json` | 110,794 | `b1c1f76c…432568` |
| 2 | `apps/api/src/modules/research/temp/04-profiling-result-dailylen-2026-11-25-18-10-11.json` | 504,244 | `0a15a59e…5258de` |
| 3 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json` | 1,422 | `6f51c248…2156e832` |
| 4 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json` | 1,447 | `6e0d7e03…c694b8ee` |
| 5 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json` | 5,645 | `b81a0ea4…d9f505df` |
| 6 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json` | 2,520 | `df871261…6fabcff6` |
| 7 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json` | 4,491 | `0b7c46aa…597eff15c` |
| 8 | `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json` | 6,677 | `798b3a2e…612abfaa` |

The values in §13.1 are the full fingerprints; the same hashes are embedded in Appendix C's
script and re-verified by the proof. The 77-profile stage-04 result (#2) and the six legacy
company-discovery dumps (#3–#8) are the only copies of that data outside the source tree.

### 22.4 Execution notes

- Full Access was required only because the protected backup root is outside the workspace. It was
  used for exactly two commands: creating the archive directory with its contents and ACL, and
  correcting the ACL. Both are recorded here; no other command ran with wider access.
- The first `icacls` invocation did not apply: PowerShell parsed the `DOMAIN\user:(OI)(CI)F`
  argument's colon as part of a scoped variable, so the statement failed with
  `Invalid parameter "ALFASISDEV\(OI)(CI)F"`. The copy step in the same command had already
  succeeded and every copied file matched its original, but the directory still carried inherited
  ACEs, including `CodexSandboxUsers`.
- The corrected invocation removed inheritance and granted FullControl to the three principals, but
  `(OI)(CI)` grants do not apply to files, so the eight archived files temporarily ended with empty
  DACLs (unreadable — `Get-FileHash` returned "Access is denied").
- The final correction restored inheritance on the archive children (`icacls … /reset /T`), so the
  files now carry exactly the three inherited FullControl ACEs from the restricted root. This state
  was verified by reading every file and comparing hashes, and is re-verified by proof check 2.
- No original was deleted, moved or modified: the six legacy dumps, the 16-profile run output and
  the 77-profile stage-04 result all remain in place, as the owner required for the later
  controlled recovery.

### 22.5 Verification

All eight archived copies were hashed against both the manifest entry and the still-present
original: **8/8 byte-identical**, zero mismatches. The manifest itself was hashed, and every
archived file is readable by the owner with the restricted ACL in place. Proof check 1 and check 2
re-establish this after the cleanup.

## 23. Authorized cleanup (executed)

### 23.1 Reconfirmation before removal

Removal was conditional on reconfirming the SDR-006 `DELETE_CANDIDATE` classification. All four
prechecks passed (exact output: §23.4):

| Reconfirmation | Result |
| --- | --- |
| The file is still the artifact that was inventoried (SHA-256 equals the SDR-006 baseline) | 3/3 PASS |
| No code, test, fixture or configuration references it (documentation mentions excluded) | 0 matches outside `docs/` |
| The database still holds the data it renders | PASS — 16-profile source row: 16 companies, 16 offers, 25 decisions, 16 domains; 15-domain source row: 25 decisions, 15 domains |
| Its content is a derived projection of those rows | PASS — summary 16 rows / 16 domains vs DB 16/16; inspect 25 decisions / 16 pages vs DB 25/16; small-run 25 decisions / 15 pages vs DB 25/15 |

Because all four held, the removal proceeded. Had any failed, the affected file would have been
preserved and a blocker reported.

### 23.2 Removed paths

| Path | Bytes | SHA-256 at removal |
| --- | --- | --- |
| `apps/api/tmp-04-summary.json` | 15,650 | `969c71a7041ee6f67b12663545d08ac5ea049ab50575e136730f6442581343ff` |
| `apps/api/tmp-inspect.json` | 29,719 | `2b51ad7d3fe6433bcae4e44b024c081a6eee913f06378d5b1ec70c6dfa23c167` |
| `apps/api/tmp-inspect-small-run.json` | 41,310 | `b8a1071d7d6f57a5575236f0579fb227f135d0388d9aee19b423b6fdaf8cf3aa` |

87,679 bytes in total. Each resolved absolute path was confirmed to lie inside the repository and
to match its recorded hash immediately before deletion.

### 23.3 Explicitly preserved

Not deleted: any unique historical research data, any database research record, tests or fixtures,
research implementation files, experimental scripts (`apps/api/tmp-run-real-04.mjs` and the four
ignored `apps/api/.runs/*.mjs`), unknown artifacts, `pnpm-lock.yaml` and `pnpm-workspace.yaml`.

The previously excluded set therefore drops from **21 to 18** untracked artifacts, all byte-identical
to their SDR-006 baseline (proof check 4). The seven kept test/fixture artifacts and the archived
originals remain untouched.

### 23.4 Pre-cleanup reconfirmation output

```text
SDR-006 pre-cleanup reconfirmation (read-only)

PRECHECK identity apps/api/tmp-04-summary.json: PASS (sha256 969c71a7041ee6f67b12663545d08ac5ea049ab50575e136730f6442581343ff)
PRECHECK identity apps/api/tmp-inspect.json: PASS (sha256 2b51ad7d3fe6433bcae4e44b024c081a6eee913f06378d5b1ec70c6dfa23c167)
PRECHECK identity apps/api/tmp-inspect-small-run.json: PASS (sha256 b8a1071d7d6f57a5575236f0579fb227f135d0388d9aee19b423b6fdaf8cf3aa)
PRECHECK no-code-test-config-reference: PASS (0 matches outside docs)
PRECHECK database-redundancy: PASS — 16-profile source row (companies 16, offers 16, decisions 25, domains 16); 15-domain source row (decisions 25, domains 15)
PRECHECK derived-content: PASS — summary 16 rows / 16 domains (db 16/16); inspect 25 decisions / 16 pages (db 25/16); small-run 25 decisions / 15 pages (db 25/15)

PRECLEANUP: all three DELETE_CANDIDATE classifications reconfirmed
```

Exit code `0`. (An earlier run reported three reference matches; they were the verification tool's
own filename table. The tool now excludes itself, and the rerun above is the recorded result.)

## 24. Confirmed persistence blocker and proposed next task

### 24.1 Normal completion versus resumed completion

The two completion paths are different code, and only one persists the final company profiles:

| | Normal completion (`runResearch`) | Resumed completion (`runResume`) |
| --- | --- | --- |
| Trigger | `POST /research` | `POST /research/:jobId/resume` |
| Writes | `{ completedThrough: '04-company-profiling', resultsPerQuery }` | `{ completedThrough: '04-company-profiling', companies: CompanyProfile[] }` |
| Final profiles in PostgreSQL | **no** | yes |
| `resultsPerQuery` | yes | no |
| Stage-04 `diagnostics` / `summary` / `promptVersion` | no | no |
| Location | [research.service.ts:278-290](../../apps/api/src/modules/research/research.service.ts#L278-L290) | [research.service.ts:469-481](../../apps/api/src/modules/research/research.service.ts#L469-L481) |

Confirmed consequence: a research created and completed through the normal API path reports
`COMPLETED` while storing no company profiles at all. This is the confirmed defect the owner
accepted; it is **not** corrected here.

### 24.2 Recorded facts

1. **Normal-path persistence defect.** 34 of the 37 `COMPLETED` records carry no
   `result.companies`; 3 of the 5 records that completed through `04-company-profiling` have no
   profiles. Only `cmwvzov2a…` is current-format, complete through all four stages and carrying its
   profiles in PostgreSQL, and it used the resume path. `cmwv2nvzp…` carries profiles that were
   written by a one-off script, not by the service (§10.7).
2. **File-only 77-profile result requiring controlled recovery.** Research
   `cmww8smxb0000z4swhooukamv` (completed 2026-11-25) has 77 accepted domains in
   `research_stage_03_results`, but its stage-04 output — 77 profiles (69 `profiled`, 8
   `needs_review`), 173 offers, 77 diagnostics and a batch summary — exists only in
   `apps/api/src/modules/research/temp/04-profiling-result-dailylen-2026-11-25-18-10-11.json`.
   The run is `COMPLETED`, so the resume endpoint refuses it, and the normal path will never add
   the profiles. The file is now also preserved in the archive (§22). Recovery requires an
   authorized import from this archived or original file; nothing was imported in SDR-006.
3. **Seven historical result envelope shapes.** The 37 completed records use seven distinct key
   combinations across five `completedThrough` labels, two of which (`03-page-collection`,
   `04-company-discovery`) name stages that no longer exist. There is no schema-version field, so a
   consumer must discriminate by key presence.
4. **No contact-person data anywhere.** No stored profile has a person, contact-person, role or
   position field; the retired company-discovery format carried a `people` array but it is empty in
   all ten legacy records. Emails and phones exist; people do not.
5. **Stage results are not exposed by the API.** `GET /research` and `GET /research/:jobId` return
   only the `researches` row, with `executionToken` and `executionLeaseUntil` removed. The three
   stage tables — product identity and terminology, the page set, the study criteria and the
   per-page decisions — are never returned. Presenting them would require an authorized change
   inside `apps/api/src/modules/research`.

### 24.3 Proposed next task

**SDR-006A — Final Research Result Persistence and Recovery** (proposed only; **not registered**,
**not started**).

Scope sketch for the owner's consideration: correct the normal completion path so stage-04 profiles
are persisted for every completed research; decide the storage shape (existing `result.companies` or
a dedicated stage-04 record); define a controlled, idempotent recovery for the file-only 77-profile
result and for the already-completed records; and decide whether stage results should become
readable through the API. The task is a Research Implementation Freeze exception candidate and needs
its own explicit authorization, its own proof command and its own database/migration approval. It
must not be started from this record.

## 25. Closure

- The human owner accepted the SDR-006 inventory, reconciliation and read-only proof on 2026-11-26.
- Historical data preservation and the authorized cleanup were executed and verified by the single
  compound proof in Appendix C; the originals remain in place.
- SDR-006 is **DONE**. The version-control record for this closure (commit hash, staged manifest and
  remote verification) is reported in the completion report rather than retroactively inserted into
  this committed document.
- Outstanding requirements carried forward, all separately authorized work: the persistence defect
  (SDR-006A proposal), the controlled recovery of the 77 profiles, and any decision about exposing
  stage results. Research Implementation Freeze remains fully active; SDR-006A and SDR-007 were not
  started.

## Appendix A — exact content of the temporary inventory script

The script below is the exact content that produced Appendix B. It was created inside the repository for this proof only and removed after the run. It reads `apps/api/.env` only to obtain `DATABASE_URL` and never prints that value or any research data.

```js
/**
 * SDR-006 — Research Data Reconciliation: single read-only inventory proof.
 *
 * Usage (from the repository root, Node.js 22+):
 *   node apps/api/tmp-sdr006-inventory.mjs --mode=proof
 *
 * READ-ONLY CONTRACT
 * - Every database statement runs inside an explicit `READ ONLY` transaction.
 * - No file is created, modified, moved or deleted; artifacts are only read and hashed.
 * - No research job, provider call, migration or service operation is performed.
 * - No company name, domain, contact value, price or page text is printed. Only counts,
 *   key names, hashes and structural types are emitted.
 *
 * The `--mode=baseline` output was used once, before the documentation was written, to record
 * the expected values embedded in `BASELINE` below. `--mode=proof` is the task's single proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const MODE = (process.argv.find((a) => a.startsWith('--mode=')) ?? '--mode=proof').slice(7);

/** Values recorded from the pre-change inventory baseline. */
const BASELINE = {
  database: 'sdr_assistant',
  serverMajor: 17,
  counts: {
    products: 5,
    researches: 42,
    stage01: 5,
    stage02: 3,
    stage03: 5,
    settings: 1,
    email_accounts: 2,
  },
  status: { COMPLETED: 37, FAILED: 3, INTERRUPTED: 2, QUEUED: 0, RUNNING: 0 },
  coverage: {
    nonEmptyResults: 37,
    recordsWithCompanies: 3,
    profiles: 146,
    profilesProfiled: 111,
    profilesNeedsReview: 35,
    offers: 276,
    stage03Rows: 5,
    stage03Domains: 254,
    stage03Pages: 524,
    decisions: 1358,
    resultFormats: 7,
    formatCounts: [25, 3, 3, 2, 2, 1, 1],
  },
  migrations: [
    '20261031115714_add_product',
    '20261106133236_add_general_categories',
    '20261110120000_rename_general_categories_to_possible_search_terms',
    '20261113110533_add_research',
    '20261117190641_add_setting',
    '20261124123231_add_stage_results',
    '20261124123609_stage01_identified_and_prepared',
    '20261124144445_stage03_resume_state',
    '20261125230000_add_email_account',
    '20261126120000_add_email_account_verification',
  ],
  /** SHA-256 of the 21 previously excluded untracked research/tooling artifacts. */
  artifacts: {
    'apps/api/src/modules/research/stages/04-company-profiling/SPEC.md':
      'bbb2ddf7cf3aa24d9a2bdb27de51da02544787fa4fe84302898481c57912d157',
    'apps/api/test/company-profiling.batch.test.ts':
      '6e2dd698ca42fd2c2329beba8d8291fc12effbde12dd27ddf1a3e59c6b75a8c4',
    'apps/api/test/company-profiling.first-call.test.ts':
      '4b128b815fb2827f4f83d220ce130c0975086cc48c2aaa9ea84fd69987fd19d6',
    'apps/api/test/company-profiling.gap-fill.test.ts':
      '5921e3266040ab593717e2a94b6876f017fe2da192840bb5d6f8753daa19ed0e',
    'apps/api/test/company-profiling.input.test.ts':
      '7c972c6eb1d1cdef15524e282d43f4ae03fc929d2d9d61189a00143b937c356f',
    'apps/api/test/company-profiling.profile.test.ts':
      '0f9a34fec2acbfee62d18d7cfa54db865b7c340a4ceb2c62905b3033c92752e6',
    'apps/api/test/fixtures/v5-16-domains.json':
      'cf1003e55e17e521ba0551c18725aafe6e9162fd41cb5f0f3690e68bfb23ba7e',
    'apps/api/test/research.04.integration.test.ts':
      '3420cb66026da01c326c7c82e8401a06adfd1bd8d4e52f68c44ced835ee589f2',
    'apps/api/tmp-04-real-result.json':
      'b1c1f76c4ab18925d7fd69f9617b22248d6b53dac0abcf11364b01d661432568',
    'apps/api/tmp-04-summary.json':
      '969c71a7041ee6f67b12663545d08ac5ea049ab50575e136730f6442581343ff',
    'apps/api/tmp-inspect-small-run.json':
      'b8a1071d7d6f57a5575236f0579fb227f135d0388d9aee19b423b6fdaf8cf3aa',
    'apps/api/tmp-inspect.json':
      '2b51ad7d3fe6433bcae4e44b024c081a6eee913f06378d5b1ec70c6dfa23c167',
    'apps/api/tmp-run-real-04.mjs':
      '1514cd42508f7a539ef32b6f638cb666dee82073061dc4f66853aa18cfdaa8b1',
    'pnpm-lock.yaml': '0b399756d0e971cf42cdbc16138228a870713fde65e85ac8597354c6b34a7455',
    'pnpm-workspace.yaml': '78f085945c4e7a2220aa6389114b25f91cca9ca464954ee8f0705b9a466be05b',
    'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json':
      '6f51c24844ae7aceeea526901afbe375b92f8629c07853f41aa4de9c2156e832',
    'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json':
      '6e0d7e0334f95841b34a6870534d3fd00b61873ab22dea56431a55cfc694b8ee',
    'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json':
      'b81a0ea47429d28a5e03f4051f41af0504d2b37a7ca86268a30b5933d9f505df',
    'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json':
      'df871261bfea33f61ae0cbb279b4d8d35e54d7b09bc43ef9eda39e9e6fabcff6',
    'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json':
      '0b7c46aa5d3ac861bb6dde90bb724220a871735f0ed53f4200757e4159eff15c',
    'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json':
      '798b3a2e3f55c4ca3b2bafd4873925e31b001293c49c81b52119376a612abfaa',
  },
  /** SHA-256 of "relative/path sha256" lines over apps/api/src/modules/research (64 files). */
  researchTree: {
    files: 64,
    sha256: '73b6fb113534c8cb78a82ac2730a08ab0b063416342f2066863eea371361e0bf',
  },
  /** Fingerprint only; the file content was never read, printed or copied. */
  envSha256: 'c63cbbb15c4b2adfe53b3b07ffff3d47eb26fca41ca7f0d5dfe59641b2ca24b8',
  /** Aggregate database fingerprint recorded at baseline. */
  dbFingerprint: '2c20af5050c4972faf13ae2a0f52018f',
};

// ---------------------------------------------------------------------------------------------

const results = [];
let failures = 0;

function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures += 1;
  console.log(`CHECK ${results.length} ${name}: ${condition ? 'PASS' : 'FAIL'}${detail ? ` — ${detail}` : ''}`);
}

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const sha256Short = (value) => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const md5 = (value) => crypto.createHash('md5').update(String(value)).digest('hex');
const fileSha = (abs) => sha256(fs.readFileSync(abs));
const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, '/');

function readDatabaseUrl() {
  const raw = fs.readFileSync(path.join(ROOT, 'apps', 'api', '.env'), 'utf8');
  const line = raw.split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
  if (!line) throw new Error('DATABASE_URL is missing from apps/api/.env');
  let value = line.slice(line.indexOf('=') + 1).trim();
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
  const url = new URL(value);
  url.search = ''; // drop the Prisma-only ?schema=public parameter
  return url.toString();
}

async function withReadOnlyTransaction(client, fn) {
  await client.query('BEGIN TRANSACTION READ ONLY ISOLATION LEVEL REPEATABLE READ');
  try {
    return await fn(client);
  } finally {
    await client.query('COMMIT');
  }
}

/** One aggregate database fingerprint: counts plus per-row content hashes. */
async function dbFingerprint(client) {
  const { rows } = await client.query(`
    select md5(string_agg(line, E'\\n' order by line)) as fp from (
      select 'products|' || count(*) || '|' || coalesce(md5(string_agg(
               id || ':' || md5(name || '|' || description || '|' ||
                                array_to_string("possibleSearchTerms", '|')) || ':' || "updatedAt"::text,
               ',' order by id)), '') as line
        from products
      union all
      select 'researches|' || count(*) || '|' || coalesce(md5(string_agg(
               id || ':' || status::text || ':' || "updatedAt"::text || ':' ||
               coalesce(length(result::text), -1) || ':' || coalesce(md5(result::text), '-'),
               ',' order by id)), '')
        from researches
      union all
      select 'stage01|' || count(*) || '|' || coalesce(md5(string_agg(
               "jobId" || ':' || md5("identifiedProduct"::text || "preparedCandidates"::text),
               ',' order by "jobId")), '')
        from research_stage_01_results
      union all
      select 'stage02|' || count(*) || '|' || coalesce(md5(string_agg(
               "jobId" || ':' || md5(result::text), ',' order by "jobId")), '')
        from research_stage_02_results
      union all
      select 'stage03|' || count(*) || '|' || coalesce(md5(string_agg(
               "jobId" || ':' || md5(coalesce(result::text, '') || coalesce(decisions::text, '') ||
                                     coalesce(criteria::text, '') || coalesce("promptVersion", '')),
               ',' order by "jobId")), '')
        from research_stage_03_results
      union all
      select 'settings|' || count(*) || '|' || coalesce(md5(string_agg(
               key || ':' || md5(value::text), ',' order by key)), '')
        from settings
      union all
      select 'email_accounts|' || count(*) || '|' || coalesce(md5(string_agg(
               id || ':' || enabled::text || ':' || "smtpVerificationStatus"::text || ':' ||
               "imapVerificationStatus"::text || ':' || "updatedAt"::text,
               ',' order by id)), '')
        from email_accounts
    ) s`);
  return rows[0].fp;
}

function researchTreeFingerprint() {
  const base = path.join(ROOT, 'apps', 'api', 'src', 'modules', 'research');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else files.push(abs);
    }
  };
  walk(base);
  const lines = files.map((abs) => `${rel(abs)} ${fileSha(abs)}`).sort();
  return { files: files.length, sha256: sha256(lines.join('\n')) };
}

function resultFormatKey(keys, completedThrough) {
  return `${[...(keys ?? [])].sort().join('+')} :: ${completedThrough ?? '<none>'}`;
}

const { default: pg } = await import('pg');

async function main() {
  console.log('SDR-006 research data reconciliation — read-only inventory proof');
  console.log(`mode: ${MODE}`);
  console.log('');

  const treeBefore = researchTreeFingerprint();
  const envSha = fileSha(path.join(ROOT, 'apps', 'api', '.env'));
  const artifactsBefore = Object.fromEntries(
    Object.keys(BASELINE.artifacts).map((p) => [p, fs.existsSync(path.join(ROOT, p)) ? fileSha(path.join(ROOT, p)) : null]),
  );

  const client = new pg.Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  // ---- CHECK 1: reachable and read-only ------------------------------------------------------
  const identity = await withReadOnlyTransaction(client, async () => {
    const ro = (await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only;
    const info = (
      await client.query(
        'select current_database() as db, current_setting($1) as version',
        ['server_version'],
      )
    ).rows[0];
    return { ro, db: info.db, version: info.version };
  });
  check(
    'database-reachable-read-only',
    identity.ro === 'on' && identity.db === BASELINE.database,
    `${identity.db}, PostgreSQL ${identity.version}, transaction_read_only=${identity.ro}`,
  );

  // ---- CHECK 2: ten migrations applied, checksums match the repository ------------------------
  const migrations = await withReadOnlyTransaction(client, async () =>
    (await client.query(
      `select migration_name, finished_at is not null as finished,
              rolled_back_at is not null as rolled_back, logs is not null as has_logs, checksum
         from _prisma_migrations order by started_at`,
    )).rows,
  );
  const migrationNames = migrations.map((m) => m.migration_name);
  const checksumMatch = migrations.filter((m) => {
    const abs = path.join(ROOT, 'apps', 'api', 'prisma', 'migrations', m.migration_name, 'migration.sql');
    return fs.existsSync(abs) && fileSha(abs) === m.checksum;
  }).length;
  check(
    'ten-migrations-applied-and-checksums',
    migrations.length === 10 &&
      migrationNames.every((n, i) => n === BASELINE.migrations[i]) &&
      migrations.every((m) => m.finished && !m.rolled_back && !m.has_logs) &&
      checksumMatch === 10,
    `${migrations.length} recorded, ${migrations.filter((m) => m.finished).length} finished, ` +
      `${migrations.filter((m) => m.rolled_back).length} rolled back, ${checksumMatch}/10 checksums match repo files`,
  );

  // ---- CHECK 3: inventory totals reconcile ---------------------------------------------------
  const counts = await withReadOnlyTransaction(client, async () =>
    (await client.query(
      `select (select count(*) from products)::int as products,
              (select count(*) from researches)::int as researches,
              (select count(*) from research_stage_01_results)::int as stage01,
              (select count(*) from research_stage_02_results)::int as stage02,
              (select count(*) from research_stage_03_results)::int as stage03,
              (select count(*) from settings)::int as settings,
              (select count(*) from email_accounts)::int as email_accounts`,
    )).rows[0],
  );
  const totalsOk = Object.entries(BASELINE.counts).every(([k, v]) => counts[k] === v);
  check(
    'database-inventory-totals',
    totalsOk &&
      counts.stage01 <= counts.researches &&
      counts.stage02 <= counts.researches &&
      counts.stage03 <= counts.researches,
    `products ${counts.products}, researches ${counts.researches}, stage01 ${counts.stage01}, ` +
      `stage02 ${counts.stage02}, stage03 ${counts.stage03}, settings ${counts.settings}, ` +
      `email_accounts ${counts.email_accounts}`,
  );

  // ---- CHECK 4: status counts reconcile with the research total ------------------------------
  const status = await withReadOnlyTransaction(client, async () =>
    (await client.query(
      `select status::text as status, count(*)::int as n from researches group by 1`,
    )).rows,
  );
  const statusMap = Object.fromEntries(Object.keys(BASELINE.status).map((k) => [k, 0]));
  for (const row of status) statusMap[row.status] = row.n;
  const statusSum = Object.values(statusMap).reduce((a, b) => a + b, 0);
  check(
    'research-status-counts-reconcile',
    statusSum === counts.researches &&
      Object.entries(BASELINE.status).every(([k, v]) => statusMap[k] === v),
    `${Object.entries(statusMap).map(([k, v]) => `${k} ${v}`).join(', ')}; sum ${statusSum} = ${counts.researches} researches`,
  );

  // ---- CHECK 5: stage-result and final-result coverage ---------------------------------------
  const coverage = await withReadOnlyTransaction(client, async () => {
    const row = (await client.query(`
      select
        (select count(*) from researches where result is not null
           and result::text not in ('null', '{}', '[]', '""'))::int as non_empty_results,
        (select count(*) from researches where jsonb_typeof(result->'companies') = 'array')::int as with_companies,
        (select coalesce(sum(jsonb_array_length(result->'companies')), 0)::int
           from researches where jsonb_typeof(result->'companies') = 'array')::int as profiles,
        (select count(*)::int from researches r, jsonb_array_elements(r.result->'companies') c
          where jsonb_typeof(r.result->'companies') = 'array' and c->>'status' = 'profiled') as profiled,
        (select count(*)::int from researches r, jsonb_array_elements(r.result->'companies') c
          where jsonb_typeof(r.result->'companies') = 'array' and c->>'status' = 'needs_review') as needs_review,
        (select count(*)::int from researches r, jsonb_array_elements(r.result->'companies') c,
                jsonb_array_elements(c->'offers') o
          where jsonb_typeof(r.result->'companies') = 'array') as offers,
        (select count(*) from research_stage_03_results)::int as stage03_rows,
        (select coalesce(sum(jsonb_array_length(result->'domains')), 0)::int
           from research_stage_03_results where jsonb_typeof(result->'domains') = 'array') as stage03_domains,
        (select count(*)::int from research_stage_03_results s, jsonb_array_elements(s.result->'domains') d,
                jsonb_array_elements(d->'pages') p) as stage03_pages,
        (select count(*)::int from research_stage_03_results s,
                jsonb_array_elements(case when jsonb_typeof(s.decisions) = 'array' then s.decisions else '[]'::jsonb end) d) as decisions
    `)).rows[0];
    const formats = (await client.query(`
      select (select array_agg(k order by k) from jsonb_object_keys(result) k) as keys,
             result->>'completedThrough' as completed_through, count(*)::int as n
        from researches where status = 'COMPLETED'
       group by 1, 2 order by n desc, 2
    `)).rows;
    const companyKeys = (await client.query(`
      select array_agg(distinct k order by k) as keys
        from researches r, jsonb_array_elements(r.result->'companies') c, jsonb_object_keys(c) k
       where jsonb_typeof(r.result->'companies') = 'array'
    `)).rows[0].keys;
    const offerKeys = (await client.query(`
      select array_agg(distinct k order by k) as keys
        from researches r, jsonb_array_elements(r.result->'companies') c,
             jsonb_array_elements(c->'offers') o, jsonb_object_keys(o) k
       where jsonb_typeof(r.result->'companies') = 'array'
    `)).rows[0].keys;
    const priceKeys = (await client.query(`
      select array_agg(distinct k order by k) as keys
        from researches r, jsonb_array_elements(r.result->'companies') c,
             jsonb_array_elements(c->'offers') o, jsonb_array_elements(o->'prices') p, jsonb_object_keys(p) k
       where jsonb_typeof(r.result->'companies') = 'array'
    `)).rows[0].keys;
    const marketFrom03Types = (await client.query(`
      select jsonb_typeof(o->'marketFrom03') as t, count(*)::int as n
        from researches r, jsonb_array_elements(r.result->'companies') c, jsonb_array_elements(c->'offers') o
       where jsonb_typeof(r.result->'companies') = 'array'
       group by 1 order by 2 desc
    `)).rows;
    const traitKeyCount = (await client.query(`
      select count(distinct k)::int as n
        from researches r, jsonb_array_elements(r.result->'companies') c, jsonb_array_elements(c->'offers') o,
             jsonb_object_keys(o->'traits') k
       where jsonb_typeof(r.result->'companies') = 'array'
    `)).rows[0].n;
    const stage03DomainSets = (await client.query(`
      select s."jobId",
             coalesce((select string_agg(d->>'domain', E'\\n' order by d->>'domain')
                         from jsonb_array_elements(s.result->'domains') d), '') as joined
        from research_stage_03_results s
    `)).rows;
    return { row, formats, companyKeys, offerKeys, priceKeys, marketFrom03Types, traitKeyCount, stage03DomainSets };
  });

  const c = coverage.row;
  const formatCounts = coverage.formats.map((f) => f.n);
  const coverageOk =
    c.non_empty_results === BASELINE.coverage.nonEmptyResults &&
    c.with_companies === BASELINE.coverage.recordsWithCompanies &&
    c.profiles === BASELINE.coverage.profiles &&
    c.profiled === BASELINE.coverage.profilesProfiled &&
    c.needs_review === BASELINE.coverage.profilesNeedsReview &&
    c.offers === BASELINE.coverage.offers &&
    c.stage03_rows === BASELINE.coverage.stage03Rows &&
    c.stage03_domains === BASELINE.coverage.stage03Domains &&
    c.stage03_pages === BASELINE.coverage.stage03Pages &&
    c.decisions === BASELINE.coverage.decisions &&
    coverage.formats.length === BASELINE.coverage.resultFormats &&
    formatCounts.every((n, i) => n === BASELINE.coverage.formatCounts[i]);
  check(
    'stage-and-final-result-coverage',
    coverageOk,
    `non-empty results ${c.non_empty_results}; records with companies ${c.with_companies}; ` +
      `profiles ${c.profiles} (${c.profiled} profiled, ${c.needs_review} needs_review); offers ${c.offers}; ` +
      `stage-03 rows ${c.stage03_rows}, domains ${c.stage03_domains}, pages ${c.stage03_pages}, ` +
      `decisions ${c.decisions}; ${coverage.formats.length} historical result formats (${formatCounts.join('/')})`,
  );
  console.log(`  result formats: ${coverage.formats.map((f) => `[${(f.keys ?? []).join(',')}] ${f.completed_through} x${f.n}`).join(' | ')}`);
  console.log(`  company keys: ${coverage.companyKeys.join(', ')}`);
  console.log(`  offer keys: ${coverage.offerKeys.join(', ')}`);
  console.log(`  price keys: ${(coverage.priceKeys ?? []).join(', ')}`);
  console.log(`  marketFrom03 JSON types: ${coverage.marketFrom03Types.map((m) => `${m.t}=${m.n}`).join(', ')}; distinct trait keys: ${coverage.traitKeyCount}`);

  // ---- CHECK 6: file-based research artifacts inventoried ------------------------------------
  const present = Object.keys(BASELINE.artifacts).filter((p) => artifactsBefore[p] !== null);
  const excludedBytes = Object.keys(BASELINE.artifacts).reduce((sum, p) => {
    const abs = path.join(ROOT, p);
    return sum + (fs.existsSync(abs) ? fs.statSync(abs).size : 0);
  }, 0);
  const tempDir = path.join(ROOT, 'apps', 'api', 'src', 'modules', 'research', 'temp');
  const tempFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith('.json'));
  const tempBytes = tempFiles.reduce((sum, f) => sum + fs.statSync(path.join(tempDir, f)).size, 0);
  const runsDir = path.join(ROOT, 'apps', 'api', '.runs');
  const runFiles = fs.existsSync(runsDir) ? fs.readdirSync(runsDir) : [];
  const runBytes = runFiles.reduce((sum, f) => sum + fs.statSync(path.join(runsDir, f)).size, 0);
  const prof = tempFiles.find((f) => f.startsWith('04-profiling-result-'));
  const profJson = prof ? JSON.parse(fs.readFileSync(path.join(tempDir, prof), 'utf8')) : null;
  const profDomainSet = profJson ? sha256Short(profJson.domains.map((d) => d.domain).sort().join('\n')) : null;
  const matchingStage03 = coverage.stage03DomainSets.find(
    (s) => sha256Short(s.joined) === profDomainSet,
  );
  const legacyFiles = fs
    .readdirSync(path.join(ROOT, 'src/modules/research/stages/01-product-identification/temp'))
    .filter((f) => f.endsWith('.json'));
  check(
    'file-based-research-artifacts-inventoried',
    present.length === 21 &&
      tempFiles.length === 15 &&
      tempBytes === 6956146 &&
      runFiles.length === 4 &&
      runBytes === 17593 &&
      legacyFiles.length === 6 &&
      Boolean(prof) &&
      Boolean(matchingStage03),
    `21 excluded artifacts (${excludedBytes} bytes); ${tempFiles.length} ignored research/temp dumps (${tempBytes} bytes); ` +
      `${runFiles.length} ignored .runs scripts (${runBytes} bytes); ${legacyFiles.length} legacy company dumps`,
  );
  console.log(
    `  stage-04 dump ${prof} (${profJson?.domains?.length} profiles, ${profJson?.domains?.reduce((n, d) => n + d.offers.length, 0)} offers) ` +
      `matches persisted stage-03 domain set of ${matchingStage03?.jobId ?? '<no match>'}`,
  );

  // ---- CHECK 7: the 21 previously excluded artifacts are intact ------------------------------
  const changed = Object.entries(BASELINE.artifacts).filter(([p, h]) => artifactsBefore[p] !== h);
  check(
    'twenty-one-excluded-artifacts-intact',
    changed.length === 0,
    changed.length === 0
      ? '21/21 present, SHA-256 identical to baseline, 0 changed, 0 missing'
      : `${changed.length} differ: ${changed.map(([p]) => p).join(', ')}`,
  );

  // ---- CHECK 6b (correlation): tmp-04-real-result.json duplicates a persisted record ---------
  const tmp04 = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', 'api', 'tmp-04-real-result.json'), 'utf8'));
  const tmpCompanies = tmp04.domains;
  const statusSignature = (companies) =>
    Object.entries(
      companies.reduce((a, d) => ((a[d.status] = (a[d.status] ?? 0) + 1), a), {}),
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  const tmpFingerprint = {
    domainSet: sha256Short(tmpCompanies.map((d) => d.domain).sort().join('\n')),
    statuses: statusSignature(tmpCompanies),
    offers: tmpCompanies.reduce((n, d) => n + d.offers.length, 0),
    offerShape: sha256Short(
      tmpCompanies.map((d) => `${d.domain}:${d.offers.length}`).sort().join('|'),
    ),
  };
  const dbCompanies = await withReadOnlyTransaction(client, async () =>
    (await client.query(
      `select id, result->'companies' as companies from researches
        where jsonb_typeof(result->'companies') = 'array' order by "createdAt"`,
    )).rows,
  );
  const duplicate = dbCompanies.find((row) => {
    const cs = row.companies;
    const fp = {
      domainSet: sha256Short(cs.map((x) => x.domain).sort().join('\n')),
      statuses: statusSignature(cs),
      offers: cs.reduce((n, x) => n + x.offers.length, 0),
      offerShape: sha256Short(cs.map((x) => `${x.domain}:${x.offers.length}`).sort().join('|')),
    };
    return (
      fp.domainSet === tmpFingerprint.domainSet &&
      fp.offers === tmpFingerprint.offers &&
      fp.offerShape === tmpFingerprint.offerShape &&
      fp.statuses === tmpFingerprint.statuses
    );
  });
  console.log(
    `  tmp-04-real-result.json profile payload is identical to persisted research ${duplicate?.id ?? '<no match>'} ` +
      `(${tmpCompanies.length} profiles, ${tmpFingerprint.offers} offers)`,
  );

  // ---- CHECK 8: no database record was modified ---------------------------------------------
  const fingerprintBefore = await withReadOnlyTransaction(client, dbFingerprint);
  const fingerprintAfter = await withReadOnlyTransaction(client, dbFingerprint);
  check(
    'no-database-records-modified',
    fingerprintBefore === fingerprintAfter && fingerprintBefore === BASELINE.dbFingerprint,
    `before ${fingerprintBefore} = after ${fingerprintAfter} = baseline`,
  );
  await client.end();

  // ---- CHECK 9: no research artifact modified or deleted ------------------------------------
  const artifactsAfter = Object.fromEntries(
    Object.keys(BASELINE.artifacts).map((p) => [p, fs.existsSync(path.join(ROOT, p)) ? fileSha(path.join(ROOT, p)) : null]),
  );
  const artifactsStable = Object.keys(BASELINE.artifacts).every(
    (p) => artifactsAfter[p] === artifactsBefore[p] && artifactsAfter[p] === BASELINE.artifacts[p],
  );
  const tempAfter = fs.readdirSync(tempDir).filter((f) => f.endsWith('.json'));
  const tempStable = tempAfter.length === tempFiles.length && tempAfter.every((f) => tempFiles.includes(f));
  check(
    'no-research-artifact-modified-or-deleted',
    artifactsStable && tempStable,
    'all 21 excluded artifacts and all 15 ignored dumps unchanged and present after the inventory',
  );

  // ---- CHECK 10: Research Implementation Freeze intact --------------------------------------
  const treeAfter = researchTreeFingerprint();
  const envAfter = fileSha(path.join(ROOT, 'apps', 'api', '.env'));
  check(
    'research-freeze-intact',
    treeAfter.files === BASELINE.researchTree.files &&
      treeAfter.sha256 === BASELINE.researchTree.sha256 &&
      treeBefore.sha256 === treeAfter.sha256 &&
      envAfter === BASELINE.envSha256,
    `${treeAfter.files}-file research tree hash ${treeAfter.sha256.slice(0, 16)}… unchanged; ` +
      `.env fingerprint ${envAfter.slice(0, 8)}… unchanged`,
  );

  console.log('');
  if (failures === 0) {
    console.log('PASS: SDR-006 research data inventory and preservation verified');
    process.exitCode = 0;
  } else {
    console.log(`FAIL: ${failures} of ${results.length} checks failed`);
    process.exitCode = 1;
  }
}

if (MODE === 'baseline') {
  const client = new pg.Client({ connectionString: readDatabaseUrl() });
  await client.connect();
  const fp = await withReadOnlyTransaction(client, dbFingerprint);
  await client.end();
  console.log(JSON.stringify({ dbFingerprint: fp, researchTree: researchTreeFingerprint() }, null, 2));
} else {
  await main();
}
```

## Appendix B — proof output

Exact output of the single proof run (`node apps/api/tmp-sdr006-inventory.mjs --mode=proof`),
copied verbatim including the exit code. Elapsed time was a few seconds; the command printed no
warning and wrote no file.

```text
SDR-006 research data reconciliation — read-only inventory proof
mode: proof

CHECK 1 database-reachable-read-only: PASS — sdr_assistant, PostgreSQL 17.11, transaction_read_only=on
CHECK 2 ten-migrations-applied-and-checksums: PASS — 10 recorded, 10 finished, 0 rolled back, 10/10 checksums match repo files
CHECK 3 database-inventory-totals: PASS — products 5, researches 42, stage01 5, stage02 3, stage03 5, settings 1, email_accounts 2
CHECK 4 research-status-counts-reconcile: PASS — COMPLETED 37, FAILED 3, INTERRUPTED 2, QUEUED 0, RUNNING 0; sum 42 = 42 researches
CHECK 5 stage-and-final-result-coverage: PASS — non-empty results 37; records with companies 3; profiles 146 (111 profiled, 35 needs_review); offers 276; stage-03 rows 5, domains 254, pages 524, decisions 1358; 7 historical result formats (25/3/3/2/2/1/1)
  result formats: [completedThrough,identificationPageCount,resultsPerQuery,selectedPageCount] 02-page-collection x25 | [completedThrough,identificationPageCount,resultsPerQuery,selectedPageCount] 03-page-collection x3 | [completedThrough,resultsPerQuery] 04-company-profiling x3 | [completedThrough,resultsPerQuery] 04-company-discovery x2 | [companies,completedThrough] 04-company-profiling x2 | [completedThrough] 03-page-assessment x1 | [companies,completedThrough,resultsPerQuery] 04-company-discovery x1
  company keys: company, domain, offers, registrableDomain, status, usage
  offer keys: id, item, market, marketFrom03, pageIds, prices, sourceUrl, traits, verdict
  price keys: amount, currency, priceType, quote, sourceUrl, unit, variant, vatIncluded
  marketFrom03 JSON types: object=214, string=62; distinct trait keys: 5
CHECK 6 file-based-research-artifacts-inventoried: PASS — 21 excluded artifacts (650012 bytes); 15 ignored research/temp dumps (6956146 bytes); 4 ignored .runs scripts (17593 bytes); 6 legacy company dumps
  stage-04 dump 04-profiling-result-dailylen-2026-11-25-18-10-11.json (77 profiles, 173 offers) matches persisted stage-03 domain set of cmww8smxb0000z4swhooukamv
CHECK 7 twenty-one-excluded-artifacts-intact: PASS — 21/21 present, SHA-256 identical to baseline, 0 changed, 0 missing
  tmp-04-real-result.json profile payload is identical to persisted research cmwv2nvzp0000ooswc85ycpck (16 profiles, 16 offers)
CHECK 8 no-database-records-modified: PASS — before 2c20af5050c4972faf13ae2a0f52018f = after 2c20af5050c4972faf13ae2a0f52018f = baseline
CHECK 9 no-research-artifact-modified-or-deleted: PASS — all 21 excluded artifacts and all 15 ignored dumps unchanged and present after the inventory
CHECK 10 research-freeze-intact: PASS — 64-file research tree hash 73b6fb113534c8cb… unchanged; .env fingerprint c63cbbb1… unchanged

PASS: SDR-006 research data inventory and preservation verified
```

```text
EXIT=0
```

## Appendix C — preservation and authorized-cleanup proof

The procedure below was prepared for this follow-up, executed once, and then removed together with the temporary script. It is different from the reconciliation proof in Appendix B and does not repeat it.

### C.1 Exact content of the temporary cleanup proof script

The script below is the exact content that produced the output in C.2. It reads `apps/api/.env` only to obtain `DATABASE_URL` and prints no research data.

```js
/**
 * SDR-006 — Historical artifact preservation, authorized cleanup and closure.
 * Single compound verification procedure (plus the two setup modes it needs).
 *
 * Usage, from the repository root:
 *   node apps/api/tmp-sdr006-cleanup-proof.mjs --mode=baseline     (once, before cleanup)
 *   node apps/api/tmp-sdr006-cleanup-proof.mjs --mode=precleanup   (once, before removal)
 *   node apps/api/tmp-sdr006-cleanup-proof.mjs --mode=proof        (once, after cleanup)
 *
 * READ-ONLY CONTRACT for every mode: the tool creates, modifies and deletes no repository file
 * (the only write is an OS temp file used to capture `icacls` output, removed immediately), and
 * every database statement runs inside an explicit READ ONLY transaction. No company name,
 * domain, contact value, price or page text is printed — only counts, paths, key names and hashes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const MODE = (process.argv.find((a) => a.startsWith('--mode=')) ?? '--mode=proof').slice(7);

const ARCHIVE = 'C:\\Users\\msmig\\Projektai\\_backupsForProjects\\sdr-assistant-research-20261126-134911';
const ARCHIVE_MANIFEST_SHA = '9ece5459a1f55ab175ac1c81e6982a0e4157d64f608dcf9a29e9473a48eef7db';

/** The eight ARCHIVE_UNIQUE_DATA artifacts, exact relative paths and recorded SHA-256. */
const ARCHIVE_FILES = {
  'apps/api/tmp-04-real-result.json':
    'b1c1f76c4ab18925d7fd69f9617b22248d6b53dac0abcf11364b01d661432568',
  'apps/api/src/modules/research/temp/04-profiling-result-dailylen-2026-11-25-18-10-11.json':
    '0a15a59e03363a54e65018ca4f43fa1d807d610fe7ce81bc6dc44a5f205258de',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json':
    '6f51c24844ae7aceeea526901afbe375b92f8629c07853f41aa4de9c2156e832',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json':
    '6e0d7e0334f95841b34a6870534d3fd00b61873ab22dea56431a55cfc694b8ee',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json':
    'b81a0ea47429d28a5e03f4051f41af0504d2b37a7ca86268a30b5933d9f505df',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json':
    'df871261bfea33f61ae0cbb279b4d8d35e54d7b09bc43ef9eda39e9e6fabcff6',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json':
    '0b7c46aa5d3ac861bb6dde90bb724220a871735f0ed53f4200757e4159eff15c',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json':
    '798b3a2e3f55c4ca3b2bafd4873925e31b001293c49c81b52119376a612abfaa',
};

/** The three artifacts this task is authorized to remove, with their recorded hashes. */
const DELETED3 = {
  'apps/api/tmp-04-summary.json': '969c71a7041ee6f67b12663545d08ac5ea049ab50575e136730f6442581343ff',
  'apps/api/tmp-inspect.json': '2b51ad7d3fe6433bcae4e44b024c081a6eee913f06378d5b1ec70c6dfa23c167',
  'apps/api/tmp-inspect-small-run.json': 'b8a1071d7d6f57a5575236f0579fb227f135d0388d9aee19b423b6fdaf8cf3aa',
};

/** The other 18 previously excluded artifacts, recorded in the SDR-006 inventory. */
const KEPT18 = {
  'apps/api/src/modules/research/stages/04-company-profiling/SPEC.md':
    'bbb2ddf7cf3aa24d9a2bdb27de51da02544787fa4fe84302898481c57912d157',
  'apps/api/test/company-profiling.batch.test.ts':
    '6e2dd698ca42fd2c2329beba8d8291fc12effbde12dd27ddf1a3e59c6b75a8c4',
  'apps/api/test/company-profiling.first-call.test.ts':
    '4b128b815fb2827f4f83d220ce130c0975086cc48c2aaa9ea84fd69987fd19d6',
  'apps/api/test/company-profiling.gap-fill.test.ts':
    '5921e3266040ab593717e2a94b6876f017fe2da192840bb5d6f8753daa19ed0e',
  'apps/api/test/company-profiling.input.test.ts':
    '7c972c6eb1d1cdef15524e282d43f4ae03fc929d2d9d61189a00143b937c356f',
  'apps/api/test/company-profiling.profile.test.ts':
    '0f9a34fec2acbfee62d18d7cfa54db865b7c340a4ceb2c62905b3033c92752e6',
  'apps/api/test/fixtures/v5-16-domains.json':
    'cf1003e55e17e521ba0551c18725aafe6e9162fd41cb5f0f3690e68bfb23ba7e',
  'apps/api/test/research.04.integration.test.ts':
    '3420cb66026da01c326c7c82e8401a06adfd1bd8d4e52f68c44ced835ee589f2',
  'apps/api/tmp-04-real-result.json':
    'b1c1f76c4ab18925d7fd69f9617b22248d6b53dac0abcf11364b01d661432568',
  'apps/api/tmp-run-real-04.mjs':
    '1514cd42508f7a539ef32b6f638cb666dee82073061dc4f66853aa18cfdaa8b1',
  'pnpm-lock.yaml': '0b399756d0e971cf42cdbc16138228a870713fde65e85ac8597354c6b34a7455',
  'pnpm-workspace.yaml': '78f085945c4e7a2220aa6389114b25f91cca9ca464954ee8f0705b9a466be05b',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json':
    '6f51c24844ae7aceeea526901afbe375b92f8629c07853f41aa4de9c2156e832',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json':
    '6e0d7e0334f95841b34a6870534d3fd00b61873ab22dea56431a55cfc694b8ee',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json':
    'b81a0ea47429d28a5e03f4051f41af0504d2b37a7ca86268a30b5933d9f505df',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json':
    'df871261bfea33f61ae0cbb279b4d8d35e54d7b09bc43ef9eda39e9e6fabcff6',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json':
    '0b7c46aa5d3ac861bb6dde90bb724220a871735f0ed53f4200757e4159eff15c',
  'src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json':
    '798b3a2e3f55c4ca3b2bafd4873925e31b001293c49c81b52119376a612abfaa',
};

const DOC_PATHS = [
  'README.md',
  'docs/tasks/README.md',
  'docs/tasks/SDR-006-research-data-reconciliation.md',
];
const SCRIPT_PATH = 'apps/api/tmp-sdr006-cleanup-proof.mjs';

const BASELINE = {
  researchTree: {
    files: 64,
    sha256: '73b6fb113534c8cb78a82ac2730a08ab0b063416342f2066863eea371361e0bf',
  },
  envSha256: 'c63cbbb15c4b2adfe53b3b07ffff3d47eb26fca41ca7f0d5dfe59641b2ca24b8',
  dbFingerprint: '2c20af5050c4972faf13ae2a0f52018f',
  migrations: [
    '20261031115714_add_product',
    '20261106133236_add_general_categories',
    '20261110120000_rename_general_categories_to_possible_search_terms',
    '20261113110533_add_research',
    '20261117190641_add_setting',
    '20261124123231_add_stage_results',
    '20261124123609_stage01_identified_and_prepared',
    '20261124144445_stage03_resume_state',
    '20261125230000_add_email_account',
    '20261126120000_add_email_account_verification',
  ],
  /** Filled from --mode=baseline before the cleanup. */
  configHashes: {
    'apps/api/.env.example': '241dec6f7ea9384a6952956abdc43efe27ec8edc387b66d4938bcfce51241247',
    'apps/api/prisma/schema.prisma': '53de3953c02e8e47f541092d6fec638751b20ee8af7d1eb7996c2cb885a4d496',
    'apps/api/package.json': '3680e6ccdb58ba835b74a4e1c28cdbad341a60e3053e0246fd94d86991b75e01',
    'apps/web/package.json': '964b2b4bc9e64044254c1cf2c33eefc02b34b6568c28e9d6b94df631f4c2da47',
    'package.json': '2c6f564932b505364094de5568913d591009805dcf7c9c9e939be69832d87c3f',
    'package-lock.json': '12a3075306102fefb0a56a647a7fd0e892f62ae4942faec01961a7a5202147cc',
    'docker-compose.yml': '40260d48221c27bd953b56b4005f53a1d0f12fe8f9a83f3f12d45561f56cf8b0',
    '.gitignore': 'c11f0fa6687d5b5ea485218ef20ad2a15166dc5657b7f47b6464c10c1f130295',
  },
  protectedTree: {
    files: 288,
    sha256: '3ea93afbb5f4e7b043694e9ba0a6bc9f64fbeb4bc4f11ad23f0b7fddfe328d2c',
  },
};

// ---------------------------------------------------------------------------------------------

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const fileSha = (abs) => sha256(fs.readFileSync(abs));
const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, '/');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const SKIP_SEGMENTS = new Set(['.git', 'node_modules', '.next', '.next-e2e', 'test-results', 'playwright-report']);
const SKIP_PREFIXES = ['dist/', 'apps/api/dist/', 'apps/api/src/generated/'];
const SKIP_FILES = new Set([...Object.keys(DELETED3), ...DOC_PATHS, SCRIPT_PATH, 'apps/web/next-env.d.ts']);

/** Deterministic fingerprint of every repository file this task must not change. */
function protectedTree() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const r = rel(abs);
      if (entry.isDirectory()) {
        if (SKIP_SEGMENTS.has(entry.name)) continue;
        if (SKIP_PREFIXES.some((p) => `${r}/`.startsWith(p))) continue;
        walk(abs);
      } else {
        if (SKIP_FILES.has(r)) continue;
        if (r.endsWith('.tsbuildinfo')) continue;
        files.push(abs);
      }
    }
  };
  walk(ROOT);
  const lines = files.map((abs) => `${rel(abs)} ${fileSha(abs)}`).sort();
  return { files: files.length, sha256: sha256(lines.join('\n')) };
}

function researchTreeFingerprint() {
  const base = path.join(ROOT, 'apps', 'api', 'src', 'modules', 'research');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else files.push(abs);
    }
  };
  walk(base);
  const lines = files.map((abs) => `${rel(abs)} ${fileSha(abs)}`).sort();
  return { files: files.length, sha256: sha256(lines.join('\n')) };
}

/** Runs a command and captures its output through file handles (pipes are sandbox-blocked). */
function runCapture(command, args) {
  const out = path.join(os.tmpdir(), `sdr006-capture-${process.pid}-${Date.now()}.txt`);
  const fd = fs.openSync(out, 'w');
  try {
    const result = spawnSync(command, args, { stdio: ['ignore', fd, fd] });
    fs.closeSync(fd);
    return { status: result.status, text: fs.readFileSync(out, 'utf8') };
  } finally {
    try {
      if (fs.existsSync(out)) fs.unlinkSync(out);
    } catch {
      /* capture file cleanup is best effort only */
    }
  }
}

function readDatabaseUrl() {
  const raw = fs.readFileSync(path.join(ROOT, 'apps', 'api', '.env'), 'utf8');
  const line = raw.split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
  if (!line) throw new Error('DATABASE_URL is missing from apps/api/.env');
  let value = line.slice(line.indexOf('=') + 1).trim();
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
  const url = new URL(value);
  url.search = '';
  return url.toString();
}

async function withReadOnlyTransaction(client, fn) {
  await client.query('BEGIN TRANSACTION READ ONLY ISOLATION LEVEL REPEATABLE READ');
  try {
    return await fn(client);
  } finally {
    await client.query('COMMIT');
  }
}

async function dbFingerprint(client) {
  const { rows } = await client.query(`
    select md5(string_agg(line, E'\\n' order by line)) as fp from (
      select 'products|' || count(*) || '|' || coalesce(md5(string_agg(
               id || ':' || md5(name || '|' || description || '|' ||
                                array_to_string("possibleSearchTerms", '|')) || ':' || "updatedAt"::text,
               ',' order by id)), '') as line
        from products
      union all
      select 'researches|' || count(*) || '|' || coalesce(md5(string_agg(
               id || ':' || status::text || ':' || "updatedAt"::text || ':' ||
               coalesce(length(result::text), -1) || ':' || coalesce(md5(result::text), '-'),
               ',' order by id)), '')
        from researches
      union all
      select 'stage01|' || count(*) || '|' || coalesce(md5(string_agg(
               "jobId" || ':' || md5("identifiedProduct"::text || "preparedCandidates"::text),
               ',' order by "jobId")), '')
        from research_stage_01_results
      union all
      select 'stage02|' || count(*) || '|' || coalesce(md5(string_agg(
               "jobId" || ':' || md5(result::text), ',' order by "jobId")), '')
        from research_stage_02_results
      union all
      select 'stage03|' || count(*) || '|' || coalesce(md5(string_agg(
               "jobId" || ':' || md5(coalesce(result::text, '') || coalesce(decisions::text, '') ||
                                     coalesce(criteria::text, '') || coalesce("promptVersion", '')),
               ',' order by "jobId")), '')
        from research_stage_03_results
      union all
      select 'settings|' || count(*) || '|' || coalesce(md5(string_agg(
               key || ':' || md5(value::text), ',' order by key)), '')
        from settings
      union all
      select 'email_accounts|' || count(*) || '|' || coalesce(md5(string_agg(
               id || ':' || enabled::text || ':' || "smtpVerificationStatus"::text || ':' ||
               "imapVerificationStatus"::text || ':' || "updatedAt"::text,
               ',' order by id)), '')
        from email_accounts
    ) s`);
  return rows[0].fp;
}

const CONFIG_FILES = [
  'apps/api/.env.example',
  'apps/api/prisma/schema.prisma',
  'apps/api/package.json',
  'apps/web/package.json',
  'package.json',
  'package-lock.json',
  'docker-compose.yml',
  '.gitignore',
];

const TEST_FILES = [
  'apps/api/test/company-profiling.batch.test.ts',
  'apps/api/test/company-profiling.first-call.test.ts',
  'apps/api/test/company-profiling.gap-fill.test.ts',
  'apps/api/test/company-profiling.input.test.ts',
  'apps/api/test/company-profiling.profile.test.ts',
  'apps/api/test/company-profiling.geography.test.ts',
  'apps/api/test/company-profiling.market.test.ts',
  'apps/api/test/page-assessment.input.test.ts',
  'apps/api/test/page-assessment.resume.test.ts',
  'apps/api/test/research.result.test.ts',
  'apps/api/test/research.resume.test.ts',
  'apps/api/test/research.04.integration.test.ts',
];

const { default: pg } = await import('pg');

async function ensureClient() {
  const client = new pg.Client({ connectionString: readDatabaseUrl() });
  await client.connect();
  return client;
}

// ---------------------------------------------------------------------------------------------

function baselineMode() {
  const configHashes = Object.fromEntries(CONFIG_FILES.map((p) => [p, fileSha(path.join(ROOT, p))]));
  console.log(JSON.stringify({ configHashes, protectedTree: protectedTree() }, null, 2));
}

async function precleanupMode() {
  console.log('SDR-006 pre-cleanup reconfirmation (read-only)');
  console.log('');
  let problems = 0;

  for (const [p, expected] of Object.entries(DELETED3)) {
    const actual = exists(p) ? fileSha(path.join(ROOT, p)) : null;
    const ok = actual === expected;
    if (!ok) problems += 1;
    console.log(`PRECHECK identity ${p}: ${ok ? 'PASS' : 'FAIL'} (sha256 ${actual ?? 'missing'})`);
  }

  const refs = [];
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const r = rel(abs);
      if (entry.isDirectory()) {
        if (SKIP_SEGMENTS.has(entry.name) || r === 'docs') continue;
        if (SKIP_PREFIXES.some((p) => `${r}/`.startsWith(p))) continue;
        scan(abs);
      } else if (r === SCRIPT_PATH) {
        // this verification tool necessarily names the artifacts it checks
        continue;
      } else if (['.ts', '.tsx', '.js', '.mjs', '.json', '.yml', '.yaml', '.sql'].includes(path.extname(entry.name))) {
        const text = fs.readFileSync(abs, 'utf8');
        for (const name of Object.keys(DELETED3)) {
          if (text.includes(path.basename(name))) refs.push(`${r} -> ${path.basename(name)}`);
        }
      }
    }
  };
  scan(ROOT);
  if (refs.length > 0) problems += 1;
  console.log(
    `PRECHECK no-code-test-config-reference: ${refs.length === 0 ? 'PASS' : 'FAIL'} (${refs.length} matches outside docs)` +
      (refs.length ? ` — ${refs.join('; ')}` : ''),
  );

  const client = await ensureClient();
  const sources = await withReadOnlyTransaction(client, async () =>
    (await client.query(`
      select r.id,
             case when jsonb_typeof(r.result->'companies') = 'array'
                  then jsonb_array_length(r.result->'companies') end as companies,
             (select coalesce(sum(jsonb_array_length(c->'offers')), 0)::int
                from jsonb_array_elements(r.result->'companies') c) as offers,
             (select jsonb_array_length(s.decisions) from research_stage_03_results s
               where s."jobId" = r.id) as decisions,
             (select coalesce(jsonb_array_length(s.result->'domains'), 0) from research_stage_03_results s
               where s."jobId" = r.id) as domains,
             (select count(*)::int from research_stage_03_results s where s."jobId" = r.id) as stage03_rows
        from researches r
       where r.id in ('cmwv2nvzp0000ooswc85ycpck', 'cmwv1wth90000k4swa7xcdkzb')
       order by r.id`)).rows,
  );
  await client.end();
  const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
  const a = byId['cmwv2nvzp0000ooswc85ycpck'];
  const b = byId['cmwv1wth90000k4swa7xcdkzb'];
  const okA = a && a.companies === 16 && a.offers === 16 && a.decisions === 25 && a.domains === 16;
  const okB = b && b.decisions === 25 && b.domains === 15 && b.stage03_rows === 1;
  if (!okA || !okB) problems += 1;
  console.log(
    `PRECHECK database-redundancy: ${okA && okB ? 'PASS' : 'FAIL'} — 16-profile source row ` +
      `(companies ${a?.companies}, offers ${a?.offers}, decisions ${a?.decisions}, domains ${a?.domains}); ` +
      `15-domain source row (decisions ${b?.decisions}, domains ${b?.domains})`,
  );

  const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/^\uFEFF/, ''));
  const summary = readJson('apps/api/tmp-04-summary.json');
  const inspect = readJson('apps/api/tmp-inspect.json');
  const small = readJson('apps/api/tmp-inspect-small-run.json');
  const okSummary = summary.rows.length === 16 && summary.counts.domains === 16;
  const okInspect = inspect.all.length === 25 && inspect.resultPages.length === 16;
  const okSmall = small.allDecisions.length === 25 && small.resultPages.length === 15;
  if (!okSummary || !okInspect || !okSmall) problems += 1;
  console.log(
    `PRECHECK derived-content: ${okSummary && okInspect && okSmall ? 'PASS' : 'FAIL'} — ` +
      `summary ${summary.rows.length} rows / ${summary.counts.domains} domains (db 16/16); ` +
      `inspect ${inspect.all.length} decisions / ${inspect.resultPages.length} pages (db 25/16); ` +
      `small-run ${small.allDecisions.length} decisions / ${small.resultPages.length} pages (db 25/15)`,
  );

  console.log('');
  console.log(
    problems === 0
      ? 'PRECLEANUP: all three DELETE_CANDIDATE classifications reconfirmed'
      : 'PRECLEANUP: RECONFIRMATION FAILED — preserve the affected files',
  );
  process.exitCode = problems === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------

const checks = [];
let failures = 0;
function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) failures += 1;
  console.log(`CHECK ${checks.length} ${name}: ${condition ? 'PASS' : 'FAIL'}${detail ? ` — ${detail}` : ''}`);
}

async function proofMode() {
  console.log('SDR-006 historical data preservation and authorized cleanup proof');
  console.log(`mode: ${MODE}`);
  console.log('');

  // ---- CHECK 1: all eight archived artifacts present and SHA-256 identical ------------------
  const manifestPath = path.join(ARCHIVE, 'manifest.csv');
  const manifestRows = fs.readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/).slice(1);
  const archiveOk = Object.entries(ARCHIVE_FILES).every(([p, h]) => {
    const copy = path.join(ARCHIVE, p);
    const original = path.join(ROOT, p);
    return fs.existsSync(copy) && fs.existsSync(original) && fileSha(copy) === h && fileSha(original) === h;
  });
  check(
    'archived-artifacts-preserved',
    archiveOk && Object.keys(ARCHIVE_FILES).length === 8 && manifestRows.length === 8 &&
      fileSha(manifestPath) === ARCHIVE_MANIFEST_SHA,
    `8/8 copies byte-identical to originals; manifest 8 rows, SHA-256 ${ARCHIVE_MANIFEST_SHA.slice(0, 16)}…`,
  );

  // ---- CHECK 2: archive access is restricted ------------------------------------------------
  const archiveRootAcl = runCapture('icacls', [ARCHIVE]);
  const sampleFile = path.join(ARCHIVE, 'apps', 'api', 'tmp-04-real-result.json');
  const sampleAcl = runCapture('icacls', [sampleFile]);
  const aclText = archiveRootAcl.text;
  const explicitGrants = (aclText.match(/\(OI\)\(CI\)\(F\)/g) ?? []).length;
  const inheritedAces = (aclText.match(/\(I\)/g) ?? []).length;
  const codexAces = (aclText.match(/CodexSandboxUsers/gi) ?? []).length;
  const principals = ['NT AUTHORITY\\SYSTEM', 'BUILTIN\\Administrators', 'ALFASISDEV\\msmig'];
  const principalsOk = principals.every((p) => aclText.toLowerCase().includes(p.toLowerCase()));
  const sampleInherited = (sampleAcl.text.match(/\(I\)/g) ?? []).length;
  const sampleReadable = fileSha(sampleFile) === ARCHIVE_FILES['apps/api/tmp-04-real-result.json'];
  check(
    'archive-access-restricted',
    archiveRootAcl.status === 0 && explicitGrants === 3 && inheritedAces === 0 && codexAces === 0 &&
      principalsOk && sampleAcl.status === 0 && sampleInherited === 3 && sampleReadable,
    `root: 3 explicit FullControl grants (SYSTEM, Administrators, owner), 0 inherited ACEs, ` +
      `0 CodexSandboxUsers ACEs; nested file readable with ${sampleInherited} inherited ACEs`,
  );

  // ---- CHECK 3: the three authorized redundant files are absent -----------------------------
  const stillPresent = Object.keys(DELETED3).filter((p) => exists(p));
  check(
    'three-redundant-artifacts-removed',
    stillPresent.length === 0,
    stillPresent.length === 0 ? `3/3 absent (${Object.keys(DELETED3).join(', ')})` : `present: ${stillPresent.join(', ')}`,
  );

  // ---- CHECK 4: all other previously excluded artifacts remain byte-identical ---------------
  const changedKept = Object.entries(KEPT18).filter(([p, h]) => !exists(p) || fileSha(path.join(ROOT, p)) !== h);
  check(
    'remaining-excluded-artifacts-intact',
    changedKept.length === 0 && Object.keys(KEPT18).length === 18,
    changedKept.length === 0
      ? '18/18 present and SHA-256 identical to the SDR-006 baseline, 0 changed, 0 missing'
      : `${changedKept.length} differ: ${changedKept.map(([p]) => p).join(', ')}`,
  );

  // ---- CHECK 5: research and email-account database records unchanged -----------------------
  const client = await ensureClient();
  const fp = await withReadOnlyTransaction(client, (c) => dbFingerprint(c));
  const counts = await withReadOnlyTransaction(client, async (c) =>
    (await c.query(`
      select (select count(*) from products)::int as products,
             (select count(*) from researches)::int as researches,
             (select count(*) from research_stage_01_results)::int as stage01,
             (select count(*) from research_stage_02_results)::int as stage02,
             (select count(*) from research_stage_03_results)::int as stage03,
             (select count(*) from settings)::int as settings,
             (select count(*) from email_accounts)::int as emails,
             (select count(*) from researches where result->>'completedThrough' = '04-company-profiling')::int as current_runs,
             (select count(*) from researches where jsonb_typeof(result->'companies') = 'array')::int as with_companies`)).rows[0],
  );
  const countsOk =
    counts.products === 5 && counts.researches === 42 && counts.stage01 === 5 && counts.stage02 === 3 &&
    counts.stage03 === 5 && counts.settings === 1 && counts.emails === 2 && counts.current_runs === 5 &&
    counts.with_companies === 3;
  check(
    'database-records-unchanged',
    fp === BASELINE.dbFingerprint && countsOk,
    `fingerprint ${fp} = baseline; products ${counts.products}, researches ${counts.researches}, ` +
      `stage 01/02/03 ${counts.stage01}/${counts.stage02}/${counts.stage03}, settings ${counts.settings}, ` +
      `email_accounts ${counts.emails}`,
  );

  // ---- CHECK 6: all ten migrations remain applied ------------------------------------------
  const migrations = await withReadOnlyTransaction(client, async (c) =>
    (await c.query(
      `select migration_name, finished_at is not null as finished,
              rolled_back_at is not null as rolled_back, logs is not null as has_logs, checksum
         from _prisma_migrations order by started_at`,
    )).rows,
  );
  const checksumMatch = migrations.filter((m) => {
    const abs = path.join(ROOT, 'apps', 'api', 'prisma', 'migrations', m.migration_name, 'migration.sql');
    return fs.existsSync(abs) && fileSha(abs) === m.checksum;
  }).length;
  check(
    'ten-migrations-applied',
    migrations.length === 10 &&
      migrations.map((m) => m.migration_name).every((n, i) => n === BASELINE.migrations[i]) &&
      migrations.every((m) => m.finished && !m.rolled_back && !m.has_logs) &&
      checksumMatch === 10,
    `10 recorded, 10 finished, 0 rolled back, ${checksumMatch}/10 checksums match repo files`,
  );
  await client.end();

  // ---- CHECK 7: research source, tests, fixtures and configuration unchanged ----------------
  const tree = researchTreeFingerprint();
  const envSha = fileSha(path.join(ROOT, 'apps/api/.env'));
  const configChanged = Object.entries(BASELINE.configHashes).filter(
    ([p, h]) => !exists(p) || fileSha(path.join(ROOT, p)) !== h,
  );
  const testsMissing = TEST_FILES.filter((t) => !exists(t));
  const fixtureOk = fileSha(path.join(ROOT, 'apps/api/test/fixtures/v5-16-domains.json')) ===
    KEPT18['apps/api/test/fixtures/v5-16-domains.json'];
  check(
    'research-source-tests-fixtures-config-unchanged',
    tree.files === BASELINE.researchTree.files &&
      tree.sha256 === BASELINE.researchTree.sha256 &&
      envSha === BASELINE.envSha256 &&
      configChanged.length === 0 &&
      testsMissing.length === 0 &&
      fixtureOk,
    `research tree ${tree.files} files ${tree.sha256.slice(0, 16)}… unchanged; .env fingerprint unchanged; ` +
      `${Object.keys(BASELINE.configHashes).length} config files unchanged; ${TEST_FILES.length} test files present; ` +
      'fixture unchanged',
  );

  // ---- CHECK 8: no unauthorized file deleted, moved or modified -----------------------------
  const treeNow = protectedTree();
  const protectedOk =
    treeNow.files === BASELINE.protectedTree.files && treeNow.sha256 === BASELINE.protectedTree.sha256;
  check(
    'no-unauthorized-file-changes',
    protectedOk,
    `${treeNow.files}-file protected tree hash ${treeNow.sha256.slice(0, 16)}… ` +
      `${protectedOk ? 'equals' : 'differs from'} the pre-cleanup baseline`,
  );

  console.log('');
  if (failures === 0) {
    console.log('PASS: SDR-006 historical data preservation and authorized cleanup verified');
    process.exitCode = 0;
  } else {
    console.log(`FAIL: ${failures} of ${checks.length} checks failed`);
    process.exitCode = 1;
  }
}

if (MODE === 'baseline') baselineMode();
else if (MODE === 'precleanup') await precleanupMode();
else await proofMode();
```

### C.2 Executed proof

- **Command:** `node apps/api/tmp-sdr006-cleanup-proof.mjs --mode=proof`, run once from the
  repository root after the archive, the reconfirmation and the three removals.
- **Exit code:** `0`.
- **Final line:** `PASS: SDR-006 historical data preservation and authorized cleanup verified`.

```text
SDR-006 historical data preservation and authorized cleanup proof
mode: proof

CHECK 1 archived-artifacts-preserved: PASS — 8/8 copies byte-identical to originals; manifest 8 rows, SHA-256 9ece5459a1f55ab1…
CHECK 2 archive-access-restricted: PASS — root: 3 explicit FullControl grants (SYSTEM, Administrators, owner), 0 inherited ACEs, 0 CodexSandboxUsers ACEs; nested file readable with 3 inherited ACEs
CHECK 3 three-redundant-artifacts-removed: PASS — 3/3 absent (apps/api/tmp-04-summary.json, apps/api/tmp-inspect.json, apps/api/tmp-inspect-small-run.json)
CHECK 4 remaining-excluded-artifacts-intact: PASS — 18/18 present and SHA-256 identical to the SDR-006 baseline, 0 changed, 0 missing
CHECK 5 database-records-unchanged: PASS — fingerprint 2c20af5050c4972faf13ae2a0f52018f = baseline; products 5, researches 42, stage 01/02/03 5/3/5, settings 1, email_accounts 2
CHECK 6 ten-migrations-applied: PASS — 10 recorded, 10 finished, 0 rolled back, 10/10 checksums match repo files
CHECK 7 research-source-tests-fixtures-config-unchanged: PASS — research tree 64 files 73b6fb113534c8cb… unchanged; .env fingerprint unchanged; 8 config files unchanged; 12 test files present; fixture unchanged
CHECK 8 no-unauthorized-file-changes: PASS — 288-file protected tree hash 3ea93afbb5f4e7b0… equals the pre-cleanup baseline

PASS: SDR-006 historical data preservation and authorized cleanup verified
```

What the eight checks establish:

| # | Requirement from the authorization | Evidence |
| --- | --- | --- |
| 1 | All eight archived artifacts present and SHA-256 identical to their originals | each archive copy, each original and each manifest row agree; manifest hash matches |
| 2 | Archive access is restricted | root ACL: three explicit FullControl grants, no inherited ACEs, no `CodexSandboxUsers`; nested file readable only through inherited owner/Administrators/SYSTEM grants |
| 3 | The three authorized redundant files are absent | 3/3 absent |
| 4 | All other previously excluded artifacts remain byte-identical | 18/18 unchanged |
| 5 | Research and email-account records unchanged | aggregate fingerprint equals the SDR-006 baseline; row counts unchanged |
| 6 | All ten migrations remain applied | 10 finished, 0 rolled back, 10/10 checksums match the repository files |
| 7 | Research source, tests, fixtures and configuration unchanged | 64-file research tree hash, `.env`, 8 config files, 12 test files and the fixture all unchanged |
| 8 | No unauthorized file deleted, moved or modified | 288-file protected tree hash equals the pre-cleanup baseline |

The proof excludes the three authorized deletions, the three authorized documentation paths and the
proof tool itself from the protected tree, so check 8 measures everything else in the repository.
It establishes preservation and authorized removal only; it does not establish research quality or
runtime behaviour, and no runtime claim is made.
