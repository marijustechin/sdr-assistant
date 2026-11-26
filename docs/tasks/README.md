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

SDR-001, SDR-002 and SDR-003 are `DONE`. SDR-004 is registered; its implementation and all
mandatory proof gates are complete, the read-only preflight and authorized database
deployment have been executed, database-backed credential/account acceptance passed, and the
human owner accepted it on 2026-11-26 — see
[SDR-004 §14](SDR-004-email-account-management.md#14-resumed-e2e-verification-human-authorized-continuation-2026-11-25),
[§15](SDR-004-email-account-management.md#15-database-migration-and-manual-acceptance-preflight-read-only-2026-11-25),
[§16](SDR-004-email-account-management.md#16-database-deployment-and-manual-acceptance-preparation-executed-2026-11-26),
[§17](SDR-004-email-account-management.md#17-database-backed-acceptance-executed-2026-11-26)
and [§18](SDR-004-email-account-management.md#18-final-human-acceptance-and-repository-preservation-2026-11-26).
SDR-004 is `DONE`. No subsequent task is created or scheduled.

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
- Historical records in `ops/current.md`, `ops/backlog.md`, `TODO.md` and `HANDOVER.md` are
  not task authorization or authoritative status.
