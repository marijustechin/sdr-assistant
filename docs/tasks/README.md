# Task registry

Authoritative registry for SDR Assistant implementation tasks. The root execution policy
is [AGENTS.md](../../AGENTS.md).

Only a task explicitly assigned by the human owner is active. A task document is the
authoritative statement of its objective, scope and acceptance criteria; this registry
tracks identity, status and location only.

## Lifecycle

`TODO → IN_PROGRESS → READY_FOR_HUMAN_REVIEW → DONE`

`BLOCKED` indicates a concrete obstacle preventing completion. A blocked task may resume
only after the human authorizes continuation.

Rules:

- Only a task explicitly assigned by the human is active.
- A task awaiting human review is not active.
- The agent must not select the next task independently.
- Only the human owner can authorize `DONE`.
- Completed task records must be preserved.
- The approved objective, scope and acceptance criteria must not be rewritten by the
  implementation agent. Execution notes, observed results and verification evidence may
  be appended to the assigned task document.
- Every subsequent implementation task document must contain: task ID and status;
  objective; authorized scope and paths; explicit exclusions; acceptance criteria; one
  proof command; verification result; remaining blockers or limitations.

## Tasks

| Task ID | Title | Status | Document |
| --- | --- | --- | --- |
| SDR-001 | Agent Execution Policy and Task Lifecycle | DONE | [SDR-001-agent-execution-policy.md](SDR-001-agent-execution-policy.md) |
| SDR-002 | Harness and Documentation Reconciliation | DONE | [SDR-002-harness-reconciliation.md](SDR-002-harness-reconciliation.md) |
| SDR-003 | Working Tree Inventory and Baseline Preservation | DONE | [SDR-003-baseline-preservation.md](SDR-003-baseline-preservation.md) |
| SDR-004 | Email Account Management | DONE | [SDR-004-email-account-management.md](SDR-004-email-account-management.md) |
| SDR-005 | Email Connection Testing and Account Form UX | DONE | [SDR-005-email-connection-testing.md](SDR-005-email-connection-testing.md) |
| ENV-003 | Restrict local SDR Assistant service exposure | DONE | [ENV-003-local-service-isolation.md](ENV-003-local-service-isolation.md) |
| SDR-006 | Research Data Reconciliation | DONE | [SDR-006-research-data-reconciliation.md](SDR-006-research-data-reconciliation.md) |
| SDR-006A | Final Research Result Persistence and Recovery | DONE | [SDR-006A-final-research-result-persistence.md](SDR-006A-final-research-result-persistence.md) |
| SDR-007 | Research Results Presentation | DONE | [SDR-007-research-results-presentation.md](SDR-007-research-results-presentation.md) |
| SDR-007A | Stage 05 Contact Discovery — Revised Scope | DONE / HUMAN_APPROVED | [SDR-007A-lead-qualification-contact-discovery.md](SDR-007A-lead-qualification-contact-discovery.md) |
| SDR-008 | Research Email Account Assignment | DONE / HUMAN_APPROVED | [SDR-008-research-email-account-assignment.md](SDR-008-research-email-account-assignment.md) |
| SDR-009 | Initial Email and Automatic Recipient Queue | DONE / HUMAN_APPROVED | [SDR-009-initial-email-and-recipient-queue.md](SDR-009-initial-email-and-recipient-queue.md) |
| SDR-010 | Email Composition Completion | DONE / HUMAN_APPROVED | [SDR-010-email-composition-completion.md](SDR-010-email-composition-completion.md) |

SDR-001, SDR-002 and SDR-003 are `DONE`. SDR-004 is registered; its implementation and all
mandatory proof gates are complete, the read-only preflight and authorized database
deployment have been executed, database-backed credential/account acceptance passed, and the
human owner accepted it on 2026-11-26 — see
[SDR-004 §14](SDR-004-email-account-management.md#14-resumed-e2e-verification-human-authorized-continuation-2026-11-25),
[§15](SDR-004-email-account-management.md#15-database-migration-and-manual-acceptance-preflight-read-only-2026-11-25),
[§16](SDR-004-email-account-management.md#16-database-deployment-and-manual-acceptance-preparation-executed-2026-11-26),
[§17](SDR-004-email-account-management.md#17-database-backed-acceptance-executed-2026-11-26)
and [§18](SDR-004-email-account-management.md#18-final-human-acceptance-and-repository-preservation-2026-11-26).
SDR-004 is `DONE`. SDR-005 is `DONE`: the Playwright gate passed 28/28, the three adapter
findings were corrected and the backend proof passed 76/76, the single migration was applied
after a verified protected backup with the ten-check deployment proof passing, and the owner
completed real-provider SMTP/IMAP verification and accepted the account-list/form UX.
ENV-003 is `DONE`: the local frontend, API and PostgreSQL host port were restricted to
loopback with all 12 checks passing and all data preserved. SDR-006 was registered on
2026-11-26, executed as a read-only reconciliation, accepted by the human owner, and its
follow-up preservation and authorized cleanup were completed on the same day; it is `DONE`.
SDR-006A is registered on 2026-11-26 under a narrow Research Implementation Freeze exception
limited to research result persistence; after one failed proof, an owner-authorized correction and
guard strengthening, and a verified one-row historical recovery, it was accepted by the architect
and is `DONE` (the narrow exception is complete; the freeze remains active).

## Notes

- SDR-001 was previously blocked by unavailable shell execution; ENV-001 restored
  PowerShell execution. The human owner explicitly resumed SDR-001 and accepted it as
  `DONE` on 2026-11-25.
- SDR-002 was accepted by the human owner and is `DONE`.
- SDR-003 Phase A was accepted. ENV-002 is accepted and `DONE`; its 36-file backup was
  verified. The Phase B local checkpoint `61302c7f9c48a8d2757638271d0381d9db2951d4` is
  accepted and SDR-003 is `DONE`. The checkpoint is experimental and has not been
  validated through tests or builds. Remote push was a separate operation pending when
  this documentation commit was prepared.
- SDR-004 implementation and documentation are complete, but the task is `BLOCKED` on
  verification: the approved proof ran once and its first three gates passed
  (Prisma generation, 23 backend tests, `verify:web`), while `npm run e2e:web` failed with
  Playwright's `Error: spawn EPERM` before any test ran. Playwright needs to fork workers
  with an `ipc` channel and start its web servers with piped stdio, which the authorized
  `workspace-write` sandbox denies (see
  [docs/system/environment.md](../system/environment.md) §3). The proof must be completed
  in a suitable environment or under a separately authorized exception; it must not be
  weakened.
- The human owner authorized resuming SDR-004 **only** to complete the Playwright E2E gate,
  with Full Access for that single operation. `npm.cmd run e2e:web` was executed once and
  passed: exit code 0, 17/17 tests, 0 failed, 0 skipped, including all six email-account
  rendered scenarios. No implementation, test, Playwright configuration, research file,
  dependency, `.env` or database state changed, and the temporary E2E servers/browsers were
  terminated. SDR-004 is now `READY_FOR_HUMAN_REVIEW`; database-backed manual acceptance
  remains pending the owner's migration and encryption-key authorization. Evidence:
  [SDR-004 §14](SDR-004-email-account-management.md#14-resumed-e2e-verification-human-authorized-continuation-2026-11-25).
- A read-only database migration preflight was completed on 2026-11-25. In the inspected
  `sdr_assistant` database all 8 recorded migrations are applied with matching checksums;
  only `20261125230000_add_email_account` is pending, and it is additive (one enum, one
  table, no research table reference). Research row baseline: products 5, researches 42,
  stage 01/02/03 results 5/3/5, settings 1. No migration, backup, encryption key or `.env`
  change was made, and no process was restarted. Evidence and the proposed backup/migration
  procedure:
  [SDR-004 §15](SDR-004-email-account-management.md#15-database-migration-and-manual-acceptance-preflight-read-only-2026-11-25).
  Database-backed acceptance still requires the owner's decisions and execution.
- On 2026-11-26 the human owner authorized the deployment. The agent created a protected
  backup (`C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-104437`,
  3,804,416 bytes, SHA-256 `5891a813…b8f13`), applied only the
  `20261125230000_add_email_account` migration (`migrate deploy`, exit 0; ledger 8→9
  applied, 0 failed), confirmed the six protected research tables and their deterministic
  content/schema fingerprints were unchanged, configured `EMAIL_ACCOUNT_ENCRYPTION_KEY` in
  the git-ignored `apps/api/.env` (32 bytes, canonical Base64; value never printed), and ran
  the single final proof: 7/7 checks PASS, exit code 0, ending
  `PASS: SDR-004 migration, backup, research preservation and encryption configuration verified`.
  No email account was created, no SMTP/IMAP connection was made and no application process
  was restarted. Evidence:
  [SDR-004 §16](SDR-004-email-account-management.md#16-database-deployment-and-manual-acceptance-preparation-executed-2026-11-26).
  Database-backed manual acceptance remains pending the owner's API restart and checks.
- On 2026-11-26 database-backed credential and account-management acceptance was executed
  once against the running local API and PostgreSQL: 12/12 checks PASS, exit code 0, ending
  `PASS: SDR-004 database-backed acceptance`. Encrypted persistence, plaintext absence,
  safe API responses, empty-password preservation, independent SMTP/IMAP replacement,
  enable/disable persistence and unchanged real accounts were verified; the synthetic
  account `SDR-004 acceptance test 20261126-111205` was left disabled. No implementation,
  `.env`, schema, dependency, research or process state was changed, and the temporary
  acceptance script was removed and never committed. Evidence:
  [SDR-004 §17](SDR-004-email-account-management.md#17-database-backed-acceptance-executed-2026-11-26).
- SDR-004 was accepted by the human owner on 2026-11-26 and is `DONE`. The approved 40-path
  manifest (§13 of the task document) was staged with explicit literal paths, committed as
  `feat: add encrypted email account management`, pushed to `origin main` without force-push,
  and remote `refs/heads/main` was verified with
  `git ls-remote --exit-code origin refs/heads/main`. All 21 previously excluded untracked
  research/tooling artifacts remain untouched, and the temporary acceptance proof script is
  absent. The commit hash, staged-manifest comparison and proof output are recorded in the
  completion report; SDR-005 was not registered or started.
- SDR-005 was registered on 2026-11-26 and is `BLOCKED`. Its implementation is complete and
  the single proof was executed once: Prisma generation, the API build, 69 focused backend
  tests and `verify:web` (95 web unit tests) passed; `npm run e2e:web` failed before any test
  with the documented Playwright `Error: spawn EPERM`, so the mandatory E2E gate is
  unverified. No escalation was used and the proof was not weakened. The additive
  verification migration is not applied, and no real SMTP/IMAP provider or database
  connection was made. Evidence:
  [SDR-005 §17](SDR-005-email-connection-testing.md#17-verification-result). SDR-005 is not
  `DONE`; SDR-006 was not started.
- On 2026-11-26 the human owner authorized completing SDR-005's remaining mandatory
  Playwright gate using Full Access exclusively for that verification operation. Preconditions
  confirmed unchanged implementation files (latest `2026-11-26 11:52:09`, before the original
  proof), an unmodified Playwright configuration targeting only the local mock API, free
  ports 3100/4100, and all 21 excluded artifacts. `npm.cmd run e2e:web` executed once:
  **28 tests, 24 passed, 4 failed, 0 skipped, 0 retried, exit code 1, 2.2 minutes**. The four
  failures are the account-list combined Test connections scenarios (SMTP status never
  rendered; one snapshot shows SMTP `Not tested` with IMAP `Verified`); all individual and
  sequential SDR-005 scenarios and all preserved SDR-004 scenarios passed. Per the
  authorization, no implementation, test, Playwright configuration, dependency, migration,
  `.env`, database or research change was made and no fix was attempted. Temporary E2E
  processes were cleaned up; owner processes on 3000/4000 were untouched. Evidence:
  [SDR-005 §28](SDR-005-email-connection-testing.md#28-resumed-e2e-verification-human-authorized-full-access-2026-11-26).
  SDR-005 remains `BLOCKED` and not `DONE`; SDR-006 was not started.
- On 2026-11-26 the human owner authorized a focused root-cause inspection and, only if the
  failure was exclusively in the mock API, a correction limited to
  `apps/web/e2e/mock-api.mjs`, followed by one full Playwright run under Full Access. The
  confirmed cause was the mock's connection-test handler reading the account before its
  artificial delay and later replacing the complete account with that stale snapshot, so the
  concurrent SMTP and IMAP writes lost one another. Production persistence was reviewed and
  is not vulnerable: the service writes only the requested protocol's verification fields
  with one atomic conditional `updateMany`; the frontend awaits both responses and re-fetches
  the list, so it introduces no ordering overwrite. The mock now re-reads the current account
  after the delay and merges only the requested protocol's fields; delay, failure simulation
  and concurrency are preserved. `npm.cmd run e2e:web` then passed **28/28, 0 failed, 0
  skipped, 0 retried, exit code 0, 58.8s**, including all four previously failing combined
  scenarios and all 17 preserved SDR-004 scenarios. No production code, assertion,
  Playwright configuration, dependency, migration, `.env`, database or research file was
  changed; temporary E2E processes were cleaned up. Evidence:
  [SDR-005 §29](SDR-005-email-connection-testing.md#29-concurrent-verification-lost-update-root-cause-correction-and-passing-proof-2026-11-26).
  SDR-005 is now `READY_FOR_HUMAN_REVIEW`, not `DONE`; the verification migration and
  real-provider acceptance remain pending, and SDR-006 was not started.
- On 2026-11-26 the human owner authorized a read-only focused security review of the installed
  Nodemailer 10.6.1 and ImapFlow 2.12.2 sources plus the application integration. Confirmed:
  the unconnected-socket SMTP path uses the validated IP, verifies TLS identity against the
  configured hostname, forces authentication through `verify()`/`forceAuth`, and cleans up via
  the adapter-owned socket; ImapFlow uses the validated IP, requires STARTTLS before auth when
  configured, and `verifyOnly`/`includeMailboxes: false` performs no mailbox selection or
  listing. One confirmed ImapFlow gap: a `PREAUTH` greeting under implicit TLS bypasses
  credential verification (STARTTLS rejects it). Two minor gaps: some uncommon TLS certificate
  error codes map to generic `CONNECTION_FAILED`, and a mid-flight disable does not prevent
  persistence because `enabled` is not in the conditional update. The NestJS providers and
  the atomic per-protocol conditional write were confirmed correct. No code, test,
  configuration, dependency, migration, `.env`, database or mail connection was touched and no
  test was rerun; smallest corrections are proposed for owner decision, with the PREAUTH guard
  recommended before live-provider acceptance. Evidence:
  [SDR-005 §30](SDR-005-email-connection-testing.md#30-focused-mail-adapter-security-review-read-only-2026-11-26).
  SDR-005 remains `READY_FOR_HUMAN_REVIEW`; SDR-006 was not started.
- On 2026-11-26 the human owner authorized correcting all three §30 gaps within a limited
  backend scope. Implemented: the IMAP adapter now rejects a `PREAUTH`
  `verifyOnly` connection when ImapFlow 2.12.2 leaves `greeting` undefined, using the existing
  authentication-failure classification; the TLS classifier recognizes the named OpenSSL
  certificate/CRL verification codes; and the conditional persistence now requires
  `enabled: true`, so a mid-flight disable persists nothing and returns
  `CONFIGURATION_CHANGED` while preserving the other protocol and never enabling the account.
  Seven focused tests were added. The single approved proof passed: **API build PASS; 76/76
  backend tests** (23 preserved + 53 focused), exit code 0, ending
  `PASS: SDR-005 final backend corrections`. No frontend, API contract, schema, migration,
  dependency, `.env`, database or mail-server change was made; frontend/Playwright evidence
  remains applicable and those gates were not rerun. Evidence:
  [SDR-005 §31](SDR-005-email-connection-testing.md#31-final-correctness-corrections-and-passing-backend-proof-2026-11-26).
  SDR-005 remains `READY_FOR_HUMAN_REVIEW`, not `DONE`; migration and real-provider acceptance
  remain pending; SDR-006 was not started.
- On 2026-11-26 the human owner authorized the database preflight, protected backup and
  application of the single SDR-005 migration. Preflight found 9 applied/0 unfinished/0
  rolled-back migrations, exactly one pending migration, no active research and 2 existing
  email accounts; all applied checksums matched. A 3,807,035-byte custom-format dump was
  created under
  `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-124535` with a
  restricted ACL, matching container/host SHA-256
  `76cb80af3b9bdb856c2446857aab897a8e572e3ec8a2598f7251e99a5cfd3a16`, 8 `TABLE DATA` entries,
  a successful complete archive read and no live restore. `prisma migrate deploy` applied
  only `20261126120000_add_email_account_verification` (exit 0); the ledger is now 10/10/0/0,
  the enum and six columns exist, and both existing accounts are `NOT_TESTED`/null on both
  protocols. The single compound proof passed all ten checks (exit 0) ending
  `PASS: SDR-005 migration, backup, research and email-account preservation verified`;
  research counts/fingerprints/schema metadata and the original email-account columns were
  unchanged, and the backup/env hashes remained identical. **Boundary blocker:** the API
  listens on `0.0.0.0:4000` (no `HOST` configured, no application authentication), the web app
  on `[::]:3000`, and PostgreSQL is published on all interfaces; enabled inbound node.exe
  firewall allow rules exist on the Private network, so the deployment is not demonstrably
  trusted-local. Live-provider testing must not proceed until the owner restricts the
  boundary. No application code, tests, `.env`, research or existing account configuration
  was changed and no service was restarted. Evidence:
  [SDR-005 §32](SDR-005-email-connection-testing.md#32-database-deployment-protected-backup-and-final-deployment-proof-2026-11-26).
  SDR-005 remains `READY_FOR_HUMAN_REVIEW`, not `DONE`; SDR-006 was not started.
- On 2026-11-26 the human owner authorized ENV-003 to restrict the local development
  deployment to loopback. Changes: `HOST=127.0.0.1` added to `apps/api/.env` (all other values
  unchanged), documented in `apps/api/.env.example`; web `dev` now runs
  `next dev --hostname 127.0.0.1 --port 3000`; Compose publishes
  `127.0.0.1:5433:5432`. Only the identified project dev tree and PostgreSQL container were
  restarted/recreated; the named volume `sdr-assistant_db-data` was reused. Listeners changed
  from `[::]:3000`, `0.0.0.0:4000`, wildcard `5433` to `127.0.0.1:3000`,
  `127.0.0.1:4000`, `127.0.0.1:5433`. The single 12-check proof passed (exit 0) ending
  `PASS: ENV-003 local service isolation and data preservation verified`; all 10 migrations,
  research/email fingerprints, the encryption key, all other env values and the SDR-005 backup
  were unchanged. No separate-device LAN test was performed. SDR-005 live-provider acceptance
  can now proceed under separate owner authorization. Evidence:
  [ENV-003 §7](ENV-003-local-service-isolation.md#7-verification-result).
  ENV-003 is `READY_FOR_HUMAN_REVIEW`, not `DONE`; SDR-006 was not started.
- On 2026-11-26 the human owner accepted **SDR-005** and **ENV-003** as `DONE`. At 13:19 local
  time the owner completed the combined **Test connections** action against the configured real
  account; read-only aggregate confirmation shows one enabled account with SMTP and IMAP
  `VERIFIED`, both timestamps populated and both failure codes null, plus one disabled
  synthetic account. The accepted screenshots show the initial `NOT_TESTED` states, the
  transition to `VERIFIED`, results in the edit form, the disabled account not testable from
  the list, empty password fields, and the accepted two-column layout. No account address,
  hostname, username, password, credential material or screenshot is committed. All 10
  migrations remain applied and the services remain loopback-bound. Evidence:
  [SDR-005 §34](SDR-005-email-connection-testing.md#34-final-human-acceptance-and-closure-2026-11-26)
  and [ENV-003 §9](ENV-003-local-service-isolation.md#9-final-human-acceptance-and-closure-2026-11-26).
  Remaining limitations: SMTP verification does not establish sender authorization or
  deliverability; email sending/mailbox synchronization and application authentication are not
  implemented; the boundary is the local loopback configuration; production deployment needs
  separate security preparation; the synthetic account remains disabled; encryption-key
  custody and backup retention remain owner responsibilities. SDR-006 was not started.
- SDR-006 was registered on 2026-11-26 and executed as a strictly read-only reconciliation of the
  existing research data. The single proof passed 10/10 checks, exit code 0, ending
  `PASS: SDR-006 research data inventory and preservation verified`. PostgreSQL (`sdr_assistant`)
  holds 5 products, 42 researches (37 `COMPLETED`, 3 `FAILED`, 2 `INTERRUPTED`), 5/3/5
  stage-01/02/03 rows and 2 email accounts; all 10 migrations are applied with matching checksums.
  Final company profiles are persisted in only 3 records (146 profiles) because the normal
  completion path stores no `companies`; there is no stage-04 table, so one completed run's 77
  profiles exist only in a git-ignored temp dump. All 21 previously excluded untracked artifacts
  remain byte-identical to their baseline. No database record, research artifact, application file,
  test, fixture or `.env` value changed, and no migration, research run, provider call or service
  restart occurred. The proposed cleanup was **not** executed at that point; the owner's acceptance
  and the executed follow-up are recorded in the next note. SDR-007 was not started.
  Evidence: [SDR-006](SDR-006-research-data-reconciliation.md).
- On 2026-11-26 the human owner accepted the SDR-006 inventory and authorized its follow-up:
  preserving the eight `ARCHIVE_UNIQUE_DATA` artifacts in a protected archive, and removing only
  the three named redundant derived files. Executed: archive
  `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-research-20261126-134911` (8 files,
  637,240 bytes, manifest SHA-256 `9ece5459…`, inheritance removed with three explicit FullControl
  grants and zero `CodexSandboxUsers` ACEs, all copies byte-identical to the originals, which were
  kept); removed `apps/api/tmp-04-summary.json`, `apps/api/tmp-inspect.json` and
  `apps/api/tmp-inspect-small-run.json` after reconfirming their classification. The remaining
  previously excluded artifacts drop from 21 to 18 and stay byte-identical; no database record,
  migration, research source, test, fixture or `.env` value changed. The single compound proof
  passed 8/8 checks, exit code 0, ending
  `PASS: SDR-006 historical data preservation and authorized cleanup verified`. The accepted
  persistence defect is recorded for a separate freeze exception; **SDR-006A — Final Research
  Result Persistence and Recovery** is proposed but not registered or started, and SDR-007 was not
  started. SDR-006 is `DONE`. Evidence:
  [SDR-006 §22–§25](SDR-006-research-data-reconciliation.md#22-historical-research-data-preservation-executed)
  and Appendix C.
- SDR-006A was registered on 2026-11-26 under a narrow Research Implementation Freeze exception
  limited to final research-result construction and persistence. Implemented: one versioned
  final-result contract (`schemaVersion: 1`, `completedThrough`, `companies`, optional `summary`
  and `resultsPerQuery`) built once and used by both the normal and the resumed completion path,
  persisted with the COMPLETED state in a single token-guarded write; a missing stage-04 result
  fails the run instead of producing a false completion; historical envelopes stay readable. Additive
  only: one new module, two completion call sites replaced, one new test file. No stage, prompt,
  provider, schema, migration or database record changed. A guarded one-row recovery procedure for
  the 77-profile file-only result is prepared but **not executed**. **First proof: FAILED** — build
  passed, then 18 tests with 12 passed and 6 failed, exit code 1, caused by six call sites in the new
  test file naming `prepareHistoricalRecovery` instead of `prepareHistoricalResultRecovery`. Per the
  task's §12 that run was not rerun, weakened or substituted; it is preserved in
  [SDR-006A §17.1](SDR-006A-final-research-result-persistence.md#171-first-approved-proof-original-run-failed-preserved)
  and Appendix B. The owner then authorized the mechanical correction, a strengthened recovery guard
  and one new proof that also runs `apps/api/test/research.result.test.ts`. **Newly approved proof:
  PASS** — build passed, **26/26 tests passed**, exit code 0, ending
  `PASS: SDR-006A final result persistence and recovery guards`. The guard now refuses any existing
  `companies` field (including a legitimate `companies: []`), a result that is not the exact
  approved pre-recovery value, a changed or already recovered row, and an unapproved target
  fingerprint; the database compare-and-set enforces the original result, and the procedure remains
  unexecuted. `docs/system/research.md` §7/§8/§11 and `README.md` were reconciled. SDR-006A is
  `READY_FOR_HUMAN_REVIEW`, not `DONE`; SDR-007 was not started. Evidence:
  [SDR-006A §17.2](SDR-006A-final-research-result-persistence.md#172-newly-approved-proof-this-follow-up)
  and Appendix C.
- On 2026-11-26 the architect accepted the SDR-006A persistence implementation and the owner
  authorized one controlled historical recovery. Executed for research
  `cmww8smxb0000z4swhooukamv`: preflight 16/16 PASS with **exact domain-set correlation** (full
  SHA-256 `7b0a44a3…165c5` on both sides); protected backup
  `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-141758` (custom dump,
  3,808,110 bytes, SHA-256 `68a9fdda…5fa71e`, 8 `TABLE DATA` entries, complete read, no restore,
  restricted ACL); one transaction with a compare-and-set predicate affected **exactly 1 row**.
  Before → after: researches 42 → 42, completed 37 → 37, records with company profiles 3 → **4**,
  profiles 146 → **223**, offers 276 → **449**. All 41 non-target research rows, all stage rows,
  products, settings, email accounts, schema metadata, the ten migrations, both artifacts, the new
  backup and the 18 excluded artifacts are unchanged; no production code changed and no service was
  restarted. Final proof 17/17 PASS, exit code 0, ending
  `PASS: SDR-006A historical research result recovery and preservation verified`; detail-API
  acceptance 10/10 (77 profiles, 173 offers, `schemaVersion: 1`, no tokens or leases, historical rows
  still readable). SDR-006A was then accepted by the architect and is `DONE`; the narrow persistence
  exception is complete, the Research Implementation Freeze remains fully active, and SDR-007 was
  not started. Final state: 42 researches, 37 completed, 4 with company profiles, 223 profiles,
  449 offers. Evidence:
  [SDR-006A §22](SDR-006A-final-research-result-persistence.md#22-controlled-historical-recovery-executed-2026-11-26)
  and §23.
- SDR-006A was accepted as `DONE` on 2026-11-26 (see previous note). Accepted decisions recorded in
  the task record: PostgreSQL is the authoritative persisted result source; new completions use
  `schemaVersion: 1`; normal and resumed execution share one construction and persistence mechanism;
  result and COMPLETED state are written atomically; a legitimate empty `companies` array is distinct
  from a missing `companies` field; historical envelopes remain unchanged except the single
  authorized recovered row; profiling diagnostics remain outside the final-result contract;
  communication data will not be embedded in research result JSON. The temporary recovery tool was
  removed; its mutation path remains documented in
  [SDR-006A Appendix D](SDR-006A-final-research-result-persistence.md#appendix-d--temporary-recovery-tool-sanitized-source).
- SDR-007 was registered on 2026-11-26. It replaces the raw research-result presentation with a
  typed research workspace (list search/filter/sort, detail Overview/Companies/Contacts, company
  offers/prices/evidence/contacts) using only the existing PostgreSQL-backed research API. The
  original approved compound proof passed `verify:web` (typecheck, lint, 138/138 unit tests,
  format check) and then hit the documented sandbox `Error: spawn EPERM` before any E2E test. The
  owner then authorized **one** Full Access `npm.cmd run e2e:web`: all 35 scenarios executed,
  **34 passed, 1 failed, 0 skipped, 1.4m, exit code 1**. The single failure was the preserved
  `app.spec.ts:135` scenario, whose global exact-text locator collided with the new Overview
  "Execution status" value. The architect accepted that diagnosis; the owner authorized correcting
  only that assertion to a deterministic locator scoped to `.research-header`, plus one more Full
  Access run. Final result: **35 passed, 0 failed, 0 skipped, 1.3m, exit code 0**. No production
  UI changed; only `apps/web/e2e/app.spec.ts` and these records changed. The earlier 138/138 unit
  evidence remains valid (`verify:web` was not rerun). SDR-007 is **READY_FOR_HUMAN_REVIEW**, not
  `DONE`. All 18 excluded artifacts remain byte-identical; no research backend, database, prompt,
  provider, dependency or `.env` change was made; the Research Implementation Freeze remains fully
  active. Evidence: [SDR-007 §11.2 and §14.4](SDR-007-research-results-presentation.md#112-owner-authorized-locator-correction-and-final-playwright-proof-2026-11-26).
  SDR-008 was not started.
- On 2026-11-26 the owner accepted the SDR-007 architecture and authorized the final Market tab,
  UX refinements, a narrow PRODUCT.md autonomous-product direction update and the agreed roadmap.
  Implemented: a read-only Market view over the existing typed result (offer/price summary metrics,
  one row per structured price, product match, currency/unit/VAT columns, comparable-only price
  sorting, textual evidence disclosure, default priced view and all-offers fallback, pagination);
  compact list/company/contact filters; a state-reflecting company chevron; identity/contacts
  primary company layout with secondary technical/evidence disclosures; compact contacts and
  source links. PRODUCT.md records the autonomous workflow, Stage 05 as planned only, no mandatory
  manual review, separate Stage 05 storage, owner-authored email, eligibility restrictions and the
  SDR-007→SDR-012 sequence; no future task was registered. The single approved compound proof
  passed: `verify:web` **153/153** unit tests (19 files), typecheck, lint and format; `e2e:web`
  **38/38** scenarios (28 preserved + 10 new), 0 failed, 0 skipped, 1.5m, exit code 0, ending
  `PASS: SDR-007 Market and final UX refinements`. No backend, database, prompt, provider,
  dependency, `.env` or communication change was made; all 18 excluded artifacts remain
  byte-identical. SDR-007 is **READY_FOR_HUMAN_REVIEW**, not `DONE`; SDR-007A and SDR-008 were not
  started. Evidence: [SDR-007 §15](SDR-007-research-results-presentation.md#15-market-view-final-ux-refinements-and-autonomous-product-direction-2026-11-26).
- On 2026-11-26 the human owner accepted SDR-007 and it is `DONE`. The accepted manifest is the
  exact 41 paths recorded in
  [SDR-007 §16.2](SDR-007-research-results-presentation.md#162-authorized-committed-manifest)
  (12 modified, 2 deleted, 27 added), including the approved PRODUCT.md autonomous direction. The
  owner accepted the minor Market filter-label clipping as non-blocking. Stage 05 qualification
  principles are recorded in
  [SDR-007 §16.3](SDR-007-research-results-presentation.md#163-input-for-sdr-007a--stage-05-qualification-principles)
  as input for SDR-007A; **SDR-007A was not registered or implemented**. Sensitivity review found
  no credentials, private research payloads or non-`.test` contact fixtures; the 18 excluded
  artifacts remained byte-identical. The manifest was committed as
  `feat: present research results and market intelligence` and `main` was pushed to `origin`
  without force; the exact commit hash and `git ls-remote --exit-code origin refs/heads/main`
  proof are in the completion report. SDR-008 was not started.
- SDR-007A was registered on 2026-11-26 as a design-only task. Its design content is complete and
  accepted in principle by the architect. The design covers the autonomous Stage 05 qualification
  flow, strict mandatory-gate decision table, target-country address/telephone rules, safe HTTPS
  website validation with SSRF protection, bounded extended contact discovery,
  programmatic-versus-LLM responsibilities, a single bounded semantic prompt, a versioned result
  contract, a two-table Prisma persistence design with idempotency/leasing/publication,
  API/frontend integration, resource limits for 2,000 companies, and a staged
  validation/implementation sequence. Read-only PostgreSQL inspection of
  `cmww8smxb0000z4swhooukamv` recorded only aggregates: 77 profiles, 173 offers, 7 priced offers,
  5 priced companies, 51 companies with email, 50 with telephone, 22 with explicit target country,
  55 missing country, 4 target-market offers and 68 companies with Stage-03/04 market
  disagreement.
- Separately authorized cleanup executed on 2026-11-26: 38 incomplete historical researches were
  deleted (33 completed without profile arrays, 3 failed, 2 interrupted), with 3 stage-01,
  1 stage-02 and 2 stage-03 dependent rows and no products, settings, email accounts or retained
  stage rows. A protected `pg_dump -Fc` backup of 3,828,210 bytes, SHA-256
  `191c235ea0d4b0b8c549bbbbe1ef26eca89aaa5b3d5ef748fe802802dd7acaf7`, was verified before deletion.
  Final database state: 4 researches, 223 company profiles, 449 offers, stage rows 2/2/3,
  products 5, settings 1, email accounts 2, no orphans, no active research or qualification runs.
  The single cleanup proof passed its first 23 checks and then failed on a proof-harness SQL
  parenthesis error; it was not rerun. One owner-authorized corrected proof then passed all 51
  database, stage, schema, source-tree and 18-artifact assertions, but failed at the final
  backup SHA-256 check because the harness resolved the absolute backup path against the
  repository root. A final authorized correction fixed the absolute/relative path handling; the
  complete proof then passed every assertion, including the backup SHA-256, 8 `TABLE DATA`
  sections and full `pg_restore` read, with exit code 0. The historical cleanup operation is
  successfully verified and its blocker is cleared. SDR-007A was `READY_FOR_HUMAN_REVIEW` before
  the later Stage 05 backend attempt recorded below; it is not `DONE` and SDR-008 was not started.
  Evidence:
  [SDR-007A §19](SDR-007A-lead-qualification-contact-discovery.md#19-historical-incomplete-research-cleanup-2026-11-26).
- Stage 05 backend implementation was attempted on 2026-11-26: an isolated API module, additive
  Prisma models/migration, read-only/independent-execution endpoints and synthetic tests were added.
  The first approved proof failed at the API build with two `TS1003` syntax errors in malformed
  `$transaction` expressions. After correction, the second authorized proof built successfully but
  failed its test phase: 40/66 tests passed and 26 failed, 0 skipped. The failures were traced to a
  test-fixture shape mismatch and an IPv4-mapped IPv6 blocklist entry that misclassified public IPv4
  addresses. After fixture and SSRF/contact-deduplication corrections, the third authorized proof
  built successfully and ran 71 tests: 68 passed, 3 failed, 0 skipped. The remaining failures were
  caused by a mixed IPv4/IPv6 `net.BlockList`; the lists were separated. The architect then reviewed
  the source and required targeted geography, discovery, gate-precedence, semantic-input,
  activity/relevance, operational-failure and duplicate-identity corrections. Those corrections
  and focused regressions were implemented; the fourth authorized proof passed **87/87 tests**,
  9/9 files, 0 skipped, exit code 0. The architect then required a final pre-pilot correctness pass
  covering geographic association, contact ownership, discovery readiness, PostgreSQL execution
  fencing, source fingerprint accounting, durable resource usage, HTTP bounds and focused
  regressions. That final pass was implemented and verified: build PASS, **99/99 tests**, 10/10
  files, 0 skipped, exit code 0. The subsequent real-PostgreSQL integration proof stopped before
  migration deployment because its temporary-database identity assertion returned empty; the
  harness query used NULL `inet_server_addr()` over a Unix socket. The container was cleaned up and
  no live database changed. The authorized corrected proof then passed: all **11 migrations**
  applied to an isolated PostgreSQL 17 container, build PASS, **99/99 synthetic tests**, and
  **5/5 real-Prisma integration tests** covering ownership fencing, concurrent starts, durable
  resume/usage, publication history and rollback. The temporary container was removed and the live
  database identity remained unchanged; the live migration is not deployed. SDR-007A is
  `READY_FOR_HUMAN_REVIEW`, not `DONE`. Evidence:
  [SDR-007A §24](SDR-007A-lead-qualification-contact-discovery.md#24-real-postgresql-integration-verification-2026-11-26).
  A second authorized isolated execution passed with the same counts and cleanup and is recorded in
  [SDR-007A §25](SDR-007A-lead-qualification-contact-discovery.md#25-authorized-repeat-postgresql-verification-2026-11-26).
- On 2026-11-26 the verified additive Stage 05 migration was deployed to the live local database
  after a verified pre-migration backup: 11/11 migrations, both tables, FKs and partial indexes
  present. Existing research/stage/product/settings/email data fingerprints remained identical, and
  the live API smoke queries returned expected results without a restart. A read-only,
  non-published three-company pilot harness exists for `dailylentes.eu`, `brolistimber.eu` and
  `decormania.eu`. The owner approved and the pilot executed once with exit code 0: all three were
  excluded (HTTP-only, parked site, target-country unconfirmed), using 1 LLM call (6,169 prompt /
  77 completion tokens), 2 Exa queries and 8 tracked page operations. No qualification run/result
  was persisted and the research fingerprints are unchanged. Pilot outcomes require human review.
  Evidence:
  [SDR-007A §27](SDR-007A-lead-qualification-contact-discovery.md#27-three-company-live-pilot-execution-2026-11-26).
- On 2026-11-27 the SDR-007A scope was revised: Stage 05 is **Contact Discovery**, not Lead
  Qualification. The existing qualification implementation remains preserved but is not the active
  scope. The 05.1.2 homepage/contact-page experiment processed all 77 profiles, reused 75 saved
  homepages, fetched 134/136 contact pages, and produced 189 unique company-email pairs, 126 newly
  discovered emails, 68 companies with telephone coverage and 51 with address coverage. Named-
  employee classification remains unclassified/uncertain because explicit name-position
  associations were not preserved. No provider, database or Stage 01–04 changes were made. Evidence:
  [SDR-007A §28](SDR-007A-lead-qualification-contact-discovery.md#28-revised-scope--stage-05-contact-discovery-0512).
- The 05.1.3 Exa-assisted run processed the 50 zero/one-email companies within budget: 50 queries,
  250 results, 83 page attempts and 7 raw new email candidates (6 after excluding a confirmed
  `name@example.com` placeholder). The raw result reports 67 companies with email and 196 unique
  pairs; the caveat and the distinction from the earlier 126 Stage-04-relative count are recorded in
  [SDR-007A §29](SDR-007A-lead-qualification-contact-discovery.md#29-0513-exa-assisted-contact-discovery-2026-11-27).
- The 05.1.4 offline consolidation produced the final contact inventory: 67 companies with email,
  195 unique company-email pairs after removing two placeholder occurrences, 98 uncertain-ownership
  contacts, 10 companies with foreign telephone codes and 7 with both local and foreign codes. No
  network, provider, database or Stage 01–04 changes were made. Real contact data remains outside
  the repository. Evidence:
  [SDR-007A §30](SDR-007A-lead-qualification-contact-discovery.md#30-0514-contact-normalization-and-consolidation-2026-11-27).
- The 05.1.5 offline final filter retained 55 companies, excluded 20 for missing usable company
  email and 2 for foreign-telephone evidence, and produced 95 communication-ready company-email
  pairs with 98 uncertain email pairs preserved separately. No HTTP/provider/database changes were
  made. Evidence:
  [SDR-007A §31](SDR-007A-lead-qualification-contact-discovery.md#31-0515-final-contact-filtering-2026-11-27).
- Stage 05 Contact Discovery V1 is integrated behind an independently callable pipeline using the
  existing run/result/lease infrastructure. Saved-evidence replay reproduces 64 retained, 128
  communication-ready, 65 partner, 11 missing-email and 2 foreign-telephone results; revised Exa
  targeting is covered separately. Build and **110/110 tests** pass without provider calls, database
  writes or schema changes. Automatic launch/frontend integration remains out of scope. Evidence:
  [SDR-007A §32](SDR-007A-lead-qualification-contact-discovery.md#32-stage-05-contact-discovery-v1-integration-2026-11-27).
- The integrated V1 live execution completed against PostgreSQL on 2026-11-27: 77/77 source
  companies, 68 retained, 133 retained-company usable pairs, 5 partner pairs, 8 missing-email and
  1 foreign-telephone exclusion, 0 technical failures, 12 Exa queries and 266 total fetches. The
  run is published and retrievable through the existing API; the original research is unchanged.
  Live results differ from the saved-evidence reference because of current pages, actual link
  selection and revised Exa eligibility. Evidence:
  [SDR-007A §33](SDR-007A-lead-qualification-contact-discovery.md#33-integrated-contact-discovery-v1-live-execution-2026-11-27).
- The research-detail Contacts tab now reads the published Stage 05 result. The existing research
  shows `Contacts 68`, 68 retained, 133 usable emails and 9 excluded; searching `bro` returns Brolis
  Timber with five usable emails, with partner contacts separated. `verify:web` (156/156 tests) and
  the focused 10/10 e2e suite pass. Evidence:
  [SDR-007A §34](SDR-007A-lead-qualification-contact-discovery.md#34-contacts-tab-using-published-stage-05-result-2026-11-27).
- The human owner accepted SDR-007A on 2026-11-27. The accepted final behaviour is Contact
  Discovery V1 with durable automatic Stage 05 launch after successful Stage 04 completion,
  bounded retry and startup recovery, and the published Contacts result. Final published totals:
  **71 retained, 6 excluded, 138 retained-usable, 5 partner, 4 missing-email, 2 foreign-phone**.
  The final orchestration proof passed 30/30 focused API tests (2 optional artifact tests skipped),
  `verify:web` 160/160, and 11/11 Playwright scenarios. SDR-007A is closed; SDR-008 was not
  started. Evidence:
  [SDR-007A §35](SDR-007A-lead-qualification-contact-discovery.md#35-final-human-acceptance-and-closure-2026-11-27).
- Historical records in `ops/current.md`, `ops/backlog.md`, `TODO.md` and `HANDOVER.md` are
  not task authorization or authoritative status.
- SDR-008 was registered and implemented on 2026-11-27. It adds a fifth **Settings** tab to the
  research detail page with only the **Email account** section: the current assignment (name,
  address, enabled state and stored SMTP/IMAP verification), assignment from enabled accounts,
  change and removal, and explicit disabled/missing/error states. Persistence is one additive
  `research_communication_settings` table/migration (one row per research, optional account
  relation, no credential column); the migration is authored and validated; at implementation
  time it was **not deployed** (the later owner-authorized deployment is recorded below). A new
  `research-communication` API module returns only
  `{ emailAccountId }`; `apps/api/src/modules/research` and Stage 01–05 were not changed. The
  existing `Communication — Planned` marker is preserved; no communication functionality,
  placeholder controls, email sending, mailbox checks or SMTP/IMAP connections were added. The
  single canonical proof passed with exit code 0: API build, **14/14** focused backend tests,
  `verify:web` **174/174** unit tests plus typecheck/lint/format, and `e2e:web` **45/45**
  scenarios (39 preserved + 6 new). All 30 pre-existing untracked artifacts remain byte-identical;
  no commit or push was performed. SDR-008 is `READY_FOR_HUMAN_REVIEW`; live migration deployment
  and live-database acceptance remain for the owner. Evidence:
  [SDR-008 §9–§11](SDR-008-research-email-account-assignment.md#9-verification-result).
- On 2026-11-27 the owner authorized the live deployment and acceptance preparation for SDR-008.
  Executed: a protected pre-migration backup at
  `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261127-204309`
  (2,550,159 bytes, matching container/host SHA-256 `8a9e5a50…175b79`, 10 `TABLE DATA` entries,
  protected ACL); the single pending migration `20261127170000_add_research_communication_settings`
  applied (`migrate deploy` exit 0; ledger 12/0/0; checksum matches the repository file); the
  `research_communication_settings` table, indexes and foreign keys verified. All nine full-row
  fingerprints and all counts for researches, stage results, products, settings, email accounts and
  Stage 05 runs/results were identical before and after; the published Stage 05 run and both email
  accounts are intact. The dev stack was restarted (API `127.0.0.1:4000` PID 50528, web
  `127.0.0.1:3000` PID 50404); health, the research page, the Settings tab payload and the live
  communication endpoint (`{"emailAccountId":null}`) were verified, and no account was assigned by
  the agent. SDR-008 remains `READY_FOR_HUMAN_REVIEW`; the owner's assignment and reload acceptance
  are pending. No code, test, dependency, research, provider, SMTP/IMAP, email or commit state
  changed. Evidence:
  [SDR-008 §13](SDR-008-research-email-account-assignment.md#13-live-deployment-and-acceptance-preparation--2026-11-27).
- On 2026-11-27 the human owner accepted SDR-008 as `DONE / HUMAN_APPROVED`. The owner assigned
  the real email account in the research Settings tab and confirmed that the assignment persists
  after closing and reopening the research; the read-only post-acceptance state is exactly one
  assignment row referencing an enabled account. The additive migration, protected pre-migration
  backup, deployment evidence and the single canonical proof are preserved in
  [SDR-008 §9–§14](SDR-008-research-email-account-assignment.md#9-verification-result). The
  SDR-008 scope was committed with `feat: add research email account assignment` and pushed to
  `origin main` without force; credentials, private data, `.env`, generated/build/test/log
  artifacts and the 30 pre-existing untracked artifacts were excluded. The exact commit hash,
  staged-manifest review, remote verification and final working-tree status are recorded in the
  completion report. SDR-009 was not started.
- SDR-009 was registered on 2026-11-27. It adds the research **Initial email** section (subject,
  plain-text message and save action) to the Settings tab and activates the **Communication** tab
  before Settings as a read-only prepared-recipient queue. Persistence is one additive migration:
  three nullable columns on `research_communication_settings` and a new `research_recipients`
  table whose status enum has exactly one value, `PREPARED`. The queue is prepared server-side
  during the research page render from the current published Stage 05 result, is idempotent via a
  source-run marker, selects one primary per retained company by the documented sales → general →
  individual mailbox priority with deterministic tie-breaks, preserves remaining usable addresses
  as alternatives, excludes partner/uncertain/excluded contacts, and is read with SQL search and
  pagination. The single canonical proof passed with exit code 0: API build, **44/44** focused
  backend tests, `verify:web` **194/194** unit tests plus typecheck/lint/format, and `e2e:web`
  **48/48** scenarios (45 preserved + 3 new), ending
  `PASS: SDR-009 initial email and recipient queue`. The additive migration is authored but **not
  deployed**; no email sending, SMTP/IMAP, mailbox synchronization, LLM, research rerun or
  database change occurred, all 30 pre-existing untracked artifacts remain byte-identical, and no
  commit or push was performed. SDR-009 is `READY_FOR_HUMAN_REVIEW`; live migration deployment
  and live acceptance remain for the owner. Evidence:
  [SDR-009 §9–§12](SDR-009-initial-email-and-recipient-queue.md#9-verification-result).
- On 2026-11-27 the owner authorized live deployment and acceptance preparation for SDR-009.
  Executed: preflight confirmed PostgreSQL 17.11, 12 applied/0 unfinished migrations and exactly
  the one pending SDR-009 migration, with the published Stage 05 baseline intact (71 accepted,
  138 usable pairs); a protected 2,553,127-byte custom backup was created at
  `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261127-215035` (container/host
  SHA-256 `6d64e077…599003`, 74 archive entries, 11 `TABLE DATA`, complete read, restricted ACL);
  `prisma migrate deploy` applied only `20261127220000_add_research_recipients` (exit 0; ledger
  13/0/0; checksum matches the repository file) and `prisma migrate status` reports up to date.
  The old dev stack was stopped and a fresh detached stack brought up (API `127.0.0.1:4000`
  PID 101888, web `127.0.0.1:3000` PID 46176; health `{"status":"ok"}`, research page 200, no
  error-level logs). All nine pre-existing table fingerprints are unchanged; the SDR-008
  assignment still references the same enabled account and the initial email remains unset. The
  live queue was prepared only through the application page render: **71 prepared primary
  recipients, 67 alternatives, 0 duplicate-skipped companies, all `PREPARED`**, 138 total usable
  pairs accounted for, no excluded/partner/uncertain contact in the queue, and Brolis Timber
  resolved to its general mailbox with four alternatives. Two further page loads left the queue
  fingerprint and marker unchanged; live browser checks confirmed the Communication and Settings
  tabs with no page errors. No code, configuration, email, SMTP/IMAP or provider action was
  taken, the owner's initial-email entry remains manual, and no commit or push was performed.
  SDR-009 remains `READY_FOR_HUMAN_REVIEW` pending human acceptance. Evidence:
  [SDR-009 §13](SDR-009-initial-email-and-recipient-queue.md#13-live-deployment-and-acceptance-preparation--2026-11-27).
- On 2026-11-27 the human owner accepted SDR-009 as `DONE / HUMAN_APPROVED` after confirming that
  the initial email settings work correctly in the live application. The accepted implementation
  proof, protected backup, applied migration, service restart, live queue verification and tab
  verification are preserved in the task record (§9, §13, §14). The closure scope is limited to
  the SDR-009 deliverables (19 modified and 15 added files: research-communication backend and
  additive migration, research/web communication entities and UI, tests, the Playwright mock and
  scenarios, and these task records), excluding credentials and `.env`, private email content,
  real contact data, the git-ignored live screenshots and rendered HTML, generated/build/test/log
  artifacts and the 30 pre-existing untracked research/tooling artifacts. The scope was committed
  with `feat: add initial email settings and automatic recipient queue` and pushed to `origin
  main` without force; the exact commit hash, staged-manifest comparison, remote verification and
  post-commit working-tree status are recorded in the completion report (a commit cannot contain
  its own hash). SDR-010 was not started.

- SDR-010 was registered and implemented on 2026-11-27. It completes the research initial-email
  composition with an optional reusable signature on each email account (name, company name,
  telephone, website link, WhatsApp link and additional text) and research-owned attachments
  (private PostgreSQL storage, filename/size list, removal, complete email preview). One additive
  migration adds six nullable `email_accounts` columns and the `research_attachments` table; it is
  **not deployed**, and the API must not be restarted before it is applied.
  `apps/api/src/modules/research` and Stage 01–05 were not changed. The single canonical proof
  passed with exit code 0:
  API build, **58/58** focused backend tests, `verify:web` **223/223** unit tests plus
  typecheck/lint/format, and `e2e:web` **51/51** scenarios (48 preserved + 3 new), ending
  `PASS: SDR-010 email composition, signatures and attachments`. `PRODUCT.md` now records the
  simplified autonomous model (one initial contact per company, no automatic follow-ups,
  communication only after a response, prior-mailbox-history awareness before outreach, immediate
  or scheduled first contact, X-minute interval, no campaign calendar, twice-daily global sync,
  per-mailbox **Check mail now**, persistent history and response statistics) and the revised
  SDR-010…SDR-013 roadmap. No email, SMTP/IMAP, mailbox synchronization, provider call, database
  change or commit occurred; all 30 pre-existing untracked artifacts remain byte-identical.
  SDR-010 is `READY_FOR_HUMAN_REVIEW`; live migration deployment and live persistence acceptance
  remain for the owner. The running `node --watch` dev API restarted when the proof built the API
  and now returns HTTP 500 for email-account reads until the additive migration is applied; the
  API must be restarted after `prisma migrate deploy` (see
  [SDR-010 §10](SDR-010-email-composition-completion.md#10-remaining-limitations-or-blockers)
  item 10). Evidence:
  [SDR-010 §8–§9](SDR-010-email-composition-completion.md#8-verification-result).

- On 2026-11-28 the local SDR-010 environment was reconciled. `prisma migrate status` reports 14
  migrations and `Database schema is up to date!`, so the additive signature/attachment migration
  is applied locally; the live API returns 200 for health and email-account reads (with the
  `signature` object), and the live edit form serves the signature inputs. The stale detached
  `npm run dev` stack from 2026-11-27 21:51 was stopped; ports 3000 and 4000 are free and no other
  `sdr-assistant` node/cmd process remains. No source, test, migration or database content was
  changed by this cleanup. The [SDR-010 §10](SDR-010-email-composition-completion.md#10-remaining-limitations-or-blockers)
  items 1 and 10 are resolved locally; SDR-010 remains `READY_FOR_HUMAN_REVIEW` pending human
  acceptance. Evidence:
  [SDR-010 §12](SDR-010-email-composition-completion.md#12-local-environment-reconciliation--2026-11-28).

- On 2026-11-28 a focused signature display-order correction was applied under SDR-010 after the
  owner's practical verification. The existing `signatureName` column is now the **closing
  greeting** (form label changed; no new field, no migration), the sender name is rendered from
  the account's existing `senderName`, and the order is closing greeting → sender name → company
  name → telephone → website → WhatsApp → additional signature text in both the signature preview
  and the complete email preview. No schema, backend or migration change was made. The single
  focused proof passed with exit code 0: web typecheck, lint, **74/74** focused web tests, format
  check and **3/3** focused Playwright scenarios, ending
  `PASS: SDR-010 signature order correction`. The full `verify:web`/`e2e:web` suites and backend
  tests were intentionally not run per the owner's scoped verification. No process on ports
  3000/4000 was started. SDR-010 remains `READY_FOR_HUMAN_REVIEW`. Evidence:
  [SDR-010 §13](SDR-010-email-composition-completion.md#13-signature-display-order-correction--2026-11-28).

- On 2026-11-28, before closing SDR-010, the owner requested and approved a focused **Send test
  email** feature. Implemented: a reusable outreach message builder and Nodemailer SMTP sender
  (`apps/api/src/modules/outreach-email`), `POST /research/:jobId/communication/test-email`, a
  validated manual recipient, saved-composition-only sending, I/O progress, an in-flight duplicate
  guard, definitive/uncertain failure reporting without automatic retry, and a separate
  `research_test_email_sends` audit table that never touches the prepared recipient queue or
  first-contact statistics. The frontend adds a Send test email control below the complete preview
  with recipient validation and result display. The additive migration
  `20261128190000_add_research_test_email_sends` was applied to the local database under explicit
  owner approval after a protected backup (2,623,584 bytes, SHA-256
  `2e87db78af551f3c6f662d3c8d5d59e4e0d4595deeba324a7f61c38e3cfd507b`, 13 `TABLE DATA` entries,
  complete archive read, restricted ACL; migration ledger 15/0/0; checksum matches the repository
  file; all baseline counts unchanged). The single focused proof passed with exit code 0: API
  build, **29/29** backend tests, web typecheck/lint, **47/47** focused web tests, format check and
  **4/4** focused Playwright scenarios, ending `PASS: SDR-010 send test email`. The proof uses a
  fake SMTP sender and the mock API only; **no real email was sent**, and the owner performs the
  first manual test. The full `verify:web`/`e2e:web` suites and unrelated backend tests were not
  run (focused scope). All 30 pre-existing untracked artifacts remain byte-identical. SDR-010
  remains `READY_FOR_HUMAN_REVIEW`; nothing was committed or pushed. Evidence:
  [SDR-010 §14](SDR-010-email-composition-completion.md#14-send-test-email--2026-11-28).

- On 2026-11-28 the human owner accepted SDR-010 as **`DONE / HUMAN_APPROVED`**. The owner
  performed a real test email send and confirmed receipt in Outlook with the correct sender name,
  subject, message formatting, signature, clickable links and attachment. Both SDR-010 migrations
  are verified applied: `20261127233000_add_signature_and_research_attachments` and
  `20261128190000_add_research_test_email_sends` (both finished, not rolled back, checksums match
  the repository files; 15 migrations, schema up to date). The acceptance, preserved evidence and
  closure scope are recorded in
  [SDR-010 §15](SDR-010-email-composition-completion.md#15-human-acceptance-and-closure--2026-11-28).
  The SDR-010 scope was committed with `feat: complete email composition and test email sending`
  and pushed to `origin main` without force; credentials and `.env`, real email content, recipient
  addresses, signature values, attachment files, screenshots, generated/build/test/log artifacts
  and the 30 pre-existing untracked research/tooling artifacts were excluded. The exact commit
  hash, staged-manifest review, remote verification and post-commit working-tree status are
  recorded in the completion report (a commit cannot contain its own hash). **SDR-011 was not
  started.**
