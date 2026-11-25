# SDR-003 — Working Tree Inventory and Baseline Preservation

## 1. Task ID and status

- **Task ID:** SDR-003
- **Phase:** A accepted; B local checkpoint accepted; remote push pending at documentation time
- **Status:** DONE
- **Registry:** [README.md](README.md)
- **Human acceptance:** local checkpoint `61302c7f9c48a8d2757638271d0381d9db2951d4` accepted on 2026-11-25; ENV-002 accepted as `DONE`. Remote push is a separate operation and was still pending when this documentation commit was prepared.

## 2. Objective

Prepare a safe version-control checkpoint proposal for the current SDR Assistant
implementation without changing behavior. The research implementation is frozen. This phase
inventories the working tree, classifies every changed/untracked file, proposes an exact
staging manifest, and identifies artifacts that must be preserved outside Git or require a
human decision.

## 3. Authorized scope and paths

Only these files may be modified or created:

- `docs/tasks/README.md`
- `docs/tasks/SDR-002-harness-reconciliation.md`
- `docs/tasks/SDR-003-baseline-preservation.md`

All other repository inspection is read-only. No application, research, test, fixture,
documentation, configuration or environment file was modified by this task.

## 4. Explicit exclusions

- Application code modifications.
- Research implementation, prompt, schema, provider, setting or orchestration changes.
- Test or fixture modifications.
- Dependency installation.
- Package manifest or lockfile modifications.
- `.gitignore` modifications.
- File deletion, relocation or cleanup.
- Database operations.
- Build, typecheck, lint and tests.
- Application startup.
- External API calls.
- Environment modifications.
- Sandbox privilege escalation.
- Git staging, commit, push, reset, stash, checkout or clean.
- Remote repository operations.
- Automatic execution of Phase B.

## 5. Acceptance criteria

- SDR-002 is recorded as DONE.
- SDR-003 is registered.
- All modified, deleted and untracked files are inventoried.
- Important ignored research artifacts are identified.
- The proposed Git staging manifest is explicit.
- Files recommended for exclusion are listed with reasons.
- Uncertainties and human decisions are clearly identified.
- Potentially sensitive files are flagged without exposing their contents.
- A separate artifact preservation approach is proposed.
- No existing application file or research artifact has been modified or deleted.
- No Git write operation has been performed.
- Phase B has not started.

## 6. One proof command

```text
git status --short --untracked-files=all
```

## 7. Verification result

- **Initial state:** recorded before edits in §9; 23 modified tracked, 6 deleted tracked,
  51 untracked; no staged changes; 74 existing modified/untracked files fingerprinted
  (SHA-256 manifest `%TEMP%\dsh-ViI8sD\sdr003-initial-hashes.tsv`, manifest SHA-256
  `5284AF477D905CE41E3808E0D3171B1E5065C9AEFAD4A9919CDBBB3CFF36B35F`).
- **Proof command:** `git status --short --untracked-files=all`, executed **once** after
  all substantive inventory documentation, in standard `workspace-write`.
- **Actual output (exit code 0):**

```text
 M AGENTS.md
 M HANDOVER.md
 M README.md
 M TODO.md
 M apps/api/prisma/schema.prisma
 M apps/api/src/modules/research/lib/llm-chat.ts
 M apps/api/src/modules/research/research.controller.ts
 M apps/api/src/modules/research/research.module.ts
 M apps/api/src/modules/research/research.service.ts
 M apps/api/src/modules/research/stages/01-product-identification/product-identification.service.ts
 M apps/api/src/modules/research/stages/02-page-collection/page-collection.service.ts
 M apps/api/src/modules/research/stages/03-page-assessment/page-assessment.prompt.ts
 M apps/api/src/modules/research/stages/03-page-assessment/page-assessment.schema.ts
 M apps/api/src/modules/research/stages/03-page-assessment/page-assessment.service.ts
 D apps/api/src/modules/research/stages/03-page-assessment/page-assessment.spec.ts
 M apps/api/src/modules/research/stages/03-page-assessment/page-assessment.verdict.ts
 D apps/api/src/modules/research/stages/04-company-discovery/company-discovery.prompt.ts
 D apps/api/src/modules/research/stages/04-company-discovery/company-discovery.schema.ts
 D apps/api/src/modules/research/stages/04-company-discovery/company-discovery.service.ts
 D apps/api/src/modules/research/stages/04-company-discovery/contact-page-picker.prompt.ts
 D apps/api/src/modules/research/stages/04-company-discovery/contact-page-picker.schema.ts
 M apps/api/src/modules/research/types.ts
 M apps/web/entities/research/api/research.client.ts
 M apps/web/entities/research/client.ts
 M apps/web/features/track-research/ui/research-details.tsx
 M docs/system/frontend.md
 M docs/system/harness.md
 M ops/backlog.md
 M ops/current.md
?? PRODUCT.md
?? apps/api/prisma/migrations/20261124123231_add_stage_results/migration.sql
?? apps/api/prisma/migrations/20261124123609_stage01_identified_and_prepared/migration.sql
?? apps/api/prisma/migrations/20261124144445_stage03_resume_state/migration.sql
?? apps/api/src/modules/research/lib/parse-json-object.ts
?? apps/api/src/modules/research/stages/03-page-assessment/page-assessment-result.ts
?? apps/api/src/modules/research/stages/03-page-assessment/page-assessment.checkpoint.ts
?? apps/api/src/modules/research/stages/04-company-profiling/SPEC.md
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.batch.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.first-call.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.gap-fill.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.geography.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.input.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.market.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.profile.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.prompt.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.schema.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.service.ts
?? apps/api/src/modules/research/stages/04-company-profiling/company-profiling.types.ts
?? apps/api/test/company-profiling.batch.test.ts
?? apps/api/test/company-profiling.first-call.test.ts
?? apps/api/test/company-profiling.gap-fill.test.ts
?? apps/api/test/company-profiling.geography.test.ts
?? apps/api/test/company-profiling.input.test.ts
?? apps/api/test/company-profiling.market.test.ts
?? apps/api/test/company-profiling.profile.test.ts
?? apps/api/test/fixtures/v5-16-domains.json
?? apps/api/test/page-assessment.input.test.ts
?? apps/api/test/page-assessment.resume.test.ts
?? apps/api/test/research.04.integration.test.ts
?? apps/api/test/research.result.test.ts
?? apps/api/test/research.resume.test.ts
?? apps/api/tmp-04-real-result.json
?? apps/api/tmp-04-summary.json
?? apps/api/tmp-inspect-small-run.json
?? apps/api/tmp-inspect.json
?? apps/api/tmp-run-real-04.mjs
?? apps/web/app/api/research/[jobId]/resume/route.ts
?? docs/system/environment.md
?? docs/system/research.md
?? docs/tasks/README.md
?? docs/tasks/SDR-001-agent-execution-policy.md
?? docs/tasks/SDR-002-harness-reconciliation.md
?? docs/tasks/SDR-003-baseline-preservation.md
?? pnpm-lock.yaml
?? pnpm-workspace.yaml
?? src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json
?? src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json
?? src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json
?? src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json
?? src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json
?? src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json
```

- **Exit code:** 0.
- **Fingerprint comparison:** of the 74 existing modified/untracked files fingerprinted
  before the task, 72 are unchanged, 0 are missing, and exactly 2 changed:
  `docs/tasks/README.md` and `docs/tasks/SDR-002-harness-reconciliation.md`. The only new
  file is `docs/tasks/SDR-003-baseline-preservation.md`. These are the three authorized
  task-document changes. No application or research file changed.
- **Final status:** 23 modified tracked, 6 deleted tracked, 52 untracked (51 initial + the
  new SDR-003 document). `AGENTS.md` remains 280 lines. No staged changes and no Git write
  operation.
- **Manual review:** the three authorized task documents were reviewed; internal links
  checked with 0 broken links; no trailing whitespace found. The proof establishes
  repository status only, not application correctness, test results or runtime behavior.

Phase B has not started.

## 8. Remaining blockers or limitations

- SDR-003 Phase A awaits human review; it is not `DONE`.
- Phase B (staging/commit/push) requires separate explicit human authorization.
- The research implementation remains frozen; this document does not authorize a fix.
- Potentially sensitive research artifacts were classified by path/metadata only; contents
  were not printed or committed.
- No application correctness, test result or runtime behavior is claimed.

## 9. Repository state at inventory start

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `70cef8f371ab618f2afbc6584656b18db67f0cc3` |
| Upstream | `origin/main`, ahead/behind `0/0` |
| Remote | `origin` → `https://github.com/marijustechin/sdr-assistant.git` |
| Staged changes | none |
| Modified tracked | 23 |
| Deleted tracked | 6 |
| Untracked | 51 |
| AGENTS.md | 280 lines |
| Initial fingerprint manifest | 74 existing modified/untracked files, SHA-256 |
| Manifest file | `%TEMP%\dsh-ViI8sD\sdr003-initial-hashes.tsv` (outside repo) |
| Manifest SHA-256 | `5284AF477D905CE41E3808E0D3171B1E5065C9AEFAD4A9919CDBBB3CFF36B35F` |

No files were staged. The working tree, not HEAD, is the implementation baseline.

## 10. Exact manifest

Action values: **STAGE** = proposed for the checkpoint; **EXCLUDE** = not staged; **DECIDE**
= needs a human decision before staging or excluding. See §13 for grouping rationale and
§14 for the proposed checkpoint.

### 10.1 Modified tracked files (23)

| Path | Status | Group | Purpose / change | Action |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | M | B | Agent authority: policy, research freeze, restored constraints, documentation map | STAGE |
| `README.md` | M | B | Human-facing four-stage overview, scripts, documentation links | STAGE |
| `docs/system/harness.md` | M | B | Operational harness; freeze reference; mandatory E2E conflict rule | STAGE |
| `docs/system/frontend.md` | M | B | Frontend policy/reference corrections; current-vs-planned note | STAGE |
| `ops/current.md` | M | B | Historical-record notice and current-doc links | STAGE |
| `ops/backlog.md` | M | B | Historical-backlog notice and current-doc links | STAGE |
| `TODO.md` | M | B | Historical-record notice and current-doc links | STAGE |
| `HANDOVER.md` | M | B | Historical-handover notice and current-doc links | STAGE |
| `apps/api/prisma/schema.prisma` | M | D | Research stage 01/02/03 models, heartbeat/lease fields | STAGE |
| `apps/api/src/modules/research/lib/llm-chat.ts` | M | A | 90 s timeout, provider error details, insufficient-balance detection | STAGE |
| `apps/api/src/modules/research/research.controller.ts` | M | A | Stage-03/04 resume endpoint | STAGE |
| `apps/api/src/modules/research/research.module.ts` | M | A | Assessment and profiling providers | STAGE |
| `apps/api/src/modules/research/research.service.ts` | M | A | Four-stage orchestration, lease/heartbeat/resume/result | STAGE |
| `apps/api/src/modules/research/stages/01-product-identification/product-identification.service.ts` | M | A | Live identification, search, preparation and stage-01 persistence | STAGE |
| `apps/api/src/modules/research/stages/02-page-collection/page-collection.service.ts` | M | A | Live query/search/fetch collection; triage is not in the main path | STAGE |
| `apps/api/src/modules/research/stages/03-page-assessment/page-assessment.prompt.ts` | M | A | Current page-assessment prompt/version chain | STAGE |
| `apps/api/src/modules/research/stages/03-page-assessment/page-assessment.schema.ts` | M | A | Study criteria and page-facts schemas | STAGE |
| `apps/api/src/modules/research/stages/03-page-assessment/page-assessment.service.ts` | M | A | Per-page assessment, checkpoints and resume | STAGE |
| `apps/api/src/modules/research/stages/03-page-assessment/page-assessment.verdict.ts` | M | A | Deterministic `a`/`b`/`none` derivation | STAGE |
| `apps/api/src/modules/research/types.ts` | M | A | Research/page assessment types | STAGE |
| `apps/web/entities/research/api/research.client.ts` | M | A | Browser resume request | STAGE |
| `apps/web/entities/research/client.ts` | M | A | Client barrel export for resume | STAGE |
| `apps/web/features/track-research/ui/research-details.tsx` | M | A | Resume action in the research detail UI | STAGE |

### 10.2 Deleted tracked files (6)

These are intentional current-working-tree deletions, not cleanup performed by SDR-003.

| Path | Status | Group | Purpose / relationship | Action |
| --- | --- | --- | --- | --- |
| `apps/api/src/modules/research/stages/03-page-assessment/page-assessment.spec.ts` | D | C | Old stage-03 spec removed | STAGE deletion |
| `apps/api/src/modules/research/stages/04-company-discovery/company-discovery.prompt.ts` | D | A | Old company-discovery prompt removed | STAGE deletion |
| `apps/api/src/modules/research/stages/04-company-discovery/company-discovery.schema.ts` | D | A | Old company-discovery schema removed | STAGE deletion |
| `apps/api/src/modules/research/stages/04-company-discovery/company-discovery.service.ts` | D | A | Old company-discovery service removed | STAGE deletion |
| `apps/api/src/modules/research/stages/04-company-discovery/contact-page-picker.prompt.ts` | D | A | Old contact-page picker prompt removed | STAGE deletion |
| `apps/api/src/modules/research/stages/04-company-discovery/contact-page-picker.schema.ts` | D | A | Old contact-page picker schema removed | STAGE deletion |

### 10.3 Untracked files (51 before this task; 52 after SDR-003)

All untracked paths are exact from `git status --short --untracked-files=all`.

#### A — application implementation (15)

| Path | Status | Purpose / content | Action |
| --- | --- | --- | --- |
| `apps/api/src/modules/research/lib/parse-json-object.ts` | ?? | LLM JSON-object extraction helper | STAGE |
| `apps/api/src/modules/research/stages/03-page-assessment/page-assessment-result.ts` | ?? | Groups accepted 03 pages by domain | STAGE |
| `apps/api/src/modules/research/stages/03-page-assessment/page-assessment.checkpoint.ts` | ?? | Assessment decisions/checkpoint result builder | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.batch.ts` | ?? | Batch profiling: 04.1–04.4 orchestration | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.first-call.ts` | ?? | First profiling call, validation and price/contact checks | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.gap-fill.ts` | ?? | Contact-gap fetch and follow-up merge | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.geography.ts` | ?? | Market geography evidence rules | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.input.ts` | ?? | 04.1 input preparation, excerpts/links | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.market.ts` | ?? | Code-derived market decision | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.profile.ts` | ?? | Deterministic profile/summary builder | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.prompt.ts` | ?? | Company-profiling prompt v1 | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.schema.ts` | ?? | Profiling answer schemas | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.service.ts` | ?? | Stage-04 service entry | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/company-profiling.types.ts` | ?? | Profile/market/price/contact types | STAGE |
| `apps/web/app/api/research/[jobId]/resume/route.ts` | ?? | Same-origin resume proxy | STAGE |

#### B — documentation and task records (8)

| Path | Status | Purpose / content | Action |
| --- | --- | --- | --- |
| `PRODUCT.md` | ?? | Approved product requirements; pre-existing untracked owner file | STAGE with confirmation |
| `docs/system/environment.md` | ?? | Environment observations and ENV-001 resolution | STAGE |
| `docs/system/research.md` | ?? | Actual research implementation, discrepancies, freeze status | STAGE |
| `docs/tasks/README.md` | ?? | Authoritative task registry; SDR-002 DONE and SDR-003 registered | STAGE |
| `docs/tasks/SDR-001-agent-execution-policy.md` | ?? | Accepted policy task record | STAGE |
| `docs/tasks/SDR-002-harness-reconciliation.md` | ?? | Accepted documentation task record | STAGE |
| `docs/tasks/SDR-003-baseline-preservation.md` | ?? | This Phase A inventory record | STAGE |
| `apps/api/src/modules/research/stages/04-company-profiling/SPEC.md` | ?? | Draft stage-04 spec (670 lines); not current behavior contract | STAGE with confirmation |

#### C — tests and test fixture (13)

| Path | Status | Purpose / content | Action |
| --- | --- | --- | --- |
| `apps/api/test/company-profiling.batch.test.ts` | ?? | Batch/domain outcomes | STAGE |
| `apps/api/test/company-profiling.first-call.test.ts` | ?? | First-call validation, contacts, prices | STAGE |
| `apps/api/test/company-profiling.gap-fill.test.ts` | ?? | Contact gap and follow-up call | STAGE |
| `apps/api/test/company-profiling.geography.test.ts` | ?? | Market geography rules | STAGE |
| `apps/api/test/company-profiling.input.test.ts` | ?? | 04.1 input preparation | STAGE |
| `apps/api/test/company-profiling.market.test.ts` | ?? | Market decision rules | STAGE |
| `apps/api/test/company-profiling.profile.test.ts` | ?? | Profile build and status behavior | STAGE |
| `apps/api/test/page-assessment.input.test.ts` | ?? | Stage-03 input and verdict | STAGE |
| `apps/api/test/page-assessment.resume.test.ts` | ?? | Stage-03 checkpoint/resume | STAGE |
| `apps/api/test/research.04.integration.test.ts` | ?? | Stage-04 integration/API row | STAGE |
| `apps/api/test/research.result.test.ts` | ?? | Result-persistence expectation; statically stale per research.md | STAGE; do not claim it passes |
| `apps/api/test/research.resume.test.ts` | ?? | Resume lease and 01/02 skip | STAGE |
| `apps/api/test/fixtures/v5-16-domains.json` | ?? | 16-domain/16-offer stage-03 test fixture; may contain research/company data | STAGE after sensitivity review |

#### D — database (3)

| Path | Status | Purpose / content | Action |
| --- | --- | --- | --- |
| `apps/api/prisma/migrations/20261124123231_add_stage_results/migration.sql` | ?? | Creates stage 01/02/03 result tables and FKs | STAGE; do not apply in Phase A |
| `apps/api/prisma/migrations/20261124123609_stage01_identified_and_prepared/migration.sql` | ?? | Replaces stage-01 result with identifiedProduct/preparedCandidates; contains destructive warnings | STAGE; review before apply |
| `apps/api/prisma/migrations/20261124144445_stage03_resume_state/migration.sql` | ?? | Adds stage-03 resume fields and execution lease/token | STAGE; do not apply in Phase A |

#### E — temporary research outputs (10)

| Path | Status | Purpose / content | Action |
| --- | --- | --- | --- |
| `apps/api/tmp-04-real-result.json` | ?? | 16-domain/16-offer stage-04 experimental result (110 KB) | EXCLUDE; preserve separately |
| `apps/api/tmp-04-summary.json` | ?? | Stage-04 summary counts (15 KB) | EXCLUDE; preserve separately |
| `apps/api/tmp-inspect-small-run.json` | ?? | Criteria/decision inspection dump (41 KB) | EXCLUDE; preserve separately |
| `apps/api/tmp-inspect.json` | ?? | Criteria/decision inspection dump (30 KB) | EXCLUDE; preserve separately |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json` | ?? | Older company-discovery result dump (1.4 KB) | EXCLUDE; human decision |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json` | ?? | Older company-discovery result dump (1.4 KB) | EXCLUDE; human decision |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json` | ?? | Older company-discovery result dump (5.6 KB) | EXCLUDE; human decision |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json` | ?? | Older company-discovery result dump (2.5 KB) | EXCLUDE; human decision |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json` | ?? | Older company-discovery result dump (4.5 KB) | EXCLUDE; human decision |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json` | ?? | Older company-discovery result dump (6.7 KB) | EXCLUDE; human decision |

#### F — temporary diagnostic script (1)

| Path | Status | Purpose / content | Action |
| --- | --- | --- | --- |
| `apps/api/tmp-run-real-04.mjs` | ?? | One-off stage-04 replay that reads the database, calls Firecrawl/LLM, writes `tmp-04-real-result.json` and updates a research row; contains a hardcoded job id | EXCLUDE; human decision; never execute in Phase A |

#### G — generated/duplicate tooling (2)

| Path | Status | Purpose / content | Action |
| --- | --- | --- | --- |
| `pnpm-lock.yaml` | ?? | Untracked pnpm lockfile v9 with importers `.`, `apps/api`, `apps/web`; not used by npm scripts | EXCLUDE; human decision |
| `pnpm-workspace.yaml` | ?? | Untracked pnpm workspace file with incomplete `allowBuilds` placeholders | EXCLUDE; human decision |

### 10.4 Ignored research and sensitive artifacts

These are not in `git status` and must not be staged unless a separate human authorization
changes that.

| Path / group | Kind | Handling |
| --- | --- | --- |
| `apps/api/.env` | Ignored environment file; may contain credentials | Never stage or print; preserve securely outside Git |
| `apps/api/src/modules/research/temp/` — 15 files (6.9 MB) | Ignored stage 01–04 dumps, raw failures and `04-profiling-result-*` | Preserve outside Git; do not commit |
| `apps/api/src/modules/research/stages/01-product-identification/temp/` | Directory not present at inventory time | No action |
| `node_modules/**/.env` and `.env.example` copies | Ignored dependency copies, not repository artifacts | Do not stage |

The ignored `apps/api/src/modules/research/temp/` files are:

```text
01.1-identified-product-thermo-a-2026-11-25-16-52-15.json
01.1-term-candidates-thermo-a-2026-11-25-16-52-15.json
01.2-searched-term-candidates-thermo-a-2026-11-25-16-52-15.json
01.3-prepared-candidates-thermo-a-2026-11-25-16-52-15.json
02.1-search-terms-qc40-dailylen-2026-11-25-16-52-44.json
02.4-response-qc40-dailylen-2026-11-25-16-52-44.json
03.1-assessed-pages-gem-dailylen-page-assessment-v5-2026-11-25-16-53-00.json
03.1-criteria-gem-dailylen-page-assessment-v5-2026-11-25-16-53-00.json
03.1-raw-failure-019-gem-dailylen-page-assessment-v5-2026-11-25-16-53-00.json
03.1-raw-failure-041-gem-dailylen-page-assessment-v5-2026-11-25-16-53-00.json
03.1-raw-failure-044-gem-dailylen-page-assessment-v5-2026-11-25-16-53-00.json
03.1-raw-failure-217-gem-dailylen-page-assessment-v5-2026-11-25-16-53-00.json
03.1-raw-failure-294-gem-dailylen-page-assessment-v5-2026-11-25-16-53-00.json
03.2-assessment-result-gem-dailylen-page-assessment-v5-2026-11-25-16-53-00.json
04-profiling-result-dailylen-2026-11-25-18-10-11.json
```

## 11. Classification summary

| Group | Meaning | Exact files/groups | Relationship and recommendation |
| --- | --- | --- | --- |
| A | Application implementation | 15 modified tracked application files (excluding schema), 15 untracked application files, 6 deletions | Preserve current implementation exactly; STAGE in the research/web commits; do not change behavior |
| B | Documentation/harness | 8 modified docs; PRODUCT.md, environment.md, research.md, task records, SPEC.md | STAGE in docs commit; PRODUCT/SPEC confirmation; no content rewrite |
| C | Tests/fixtures | 12 untracked tests + 16-domain fixture + 1 deleted old test | STAGE current test state; do not claim tests pass; review fixture sensitivity |
| D | DB schema/migrations | schema.prisma + 3 migrations | STAGE; do not apply; migration 2 has destructive warnings |
| E | Temporary research outputs | 4 `tmp-*.json`, 6 root `src/` company dumps, 15 ignored `temp/` files | EXCLUDE; preserve outside Git; human retention decision |
| F | Temporary diagnostic script | `apps/api/tmp-run-real-04.mjs` | EXCLUDE; human decision; never execute |
| G | Generated/duplicate tooling | pnpm lock/workspace | EXCLUDE; human decision; npm remains package manager |
| H | Sensitive | `apps/api/.env`; research dumps/fixture may contain company/contact data | Never stage secrets; review fixture before publishing |
| I | Uncertain | PRODUCT.md, SPEC.md, pnpm files, root `src/` dumps, tmp outputs/script, fixture sensitivity | Human decisions in §12 |

## 12. Special attention findings

- **Root `src/`.** Six untracked JSON files under `src/modules/research/stages/01-product-identification/temp/` (22 KB total). They contain older company-discovery-style results (`promptVersion`, `createdAt`, `product`, `results`) and are not referenced by the current API build or runtime path. Recommend EXCLUDE and preserve as an external artifact; removal needs a separate human decision.
- **`pnpm-lock.yaml` and `pnpm-workspace.yaml`.** Both untracked; pnpm lock is v9 with importers `.`, `apps/api`, `apps/web`; workspace has incomplete `allowBuilds` placeholders. The project uses npm (`package-lock.json`, npm scripts); pnpm files are generated/duplicate tooling. Recommend EXCLUDE; human decision on keeping them outside Git or deleting later.
- **npm lock consistency.** `package-lock.json` is tracked, lockfileVersion 3, 784 packages, root workspaces `apps/api,apps/web`; static versions include Next 16.4.5, NestJS core 11.2.8, Prisma 7.10.1 and TypeScript 5.9.3. This is structurally consistent with the current package manifests by static inspection; no install/audit was run, so exact resolution is not claimed.
- **New Prisma migrations.** Three untracked migrations add stage-result tables, stage-01 fields and stage-03 resume/lease columns. The second has explicit destructive warnings (drops `result`, adds required columns); do not apply in Phase A. They belong with the schema in the checkpoint.
- **Deleted company-discovery implementation.** The five deleted `04-company-discovery` files (plus one deleted stage-03 spec) represent the replacement by company profiling/current assessment. Stage the deletions explicitly so the checkpoint records the current tree; do not restore the old implementation.
- **New company-profiling implementation.** 11 untracked source files + draft `SPEC.md` under `04-company-profiling/`; this is the current stage-04 implementation and must be preserved. The spec is a draft, not a behavior contract.
- **Tests and fixtures.** 12 untracked tests + `v5-16-domains.json` (16 domains/16 offers). Some tests are statically stale per `research.md`; stage the current state, do not claim green. The fixture may contain research/company data; review before publishing.
- **`tmp-*.json` outputs.** 4 untracked research result/inspection dumps (30–111 KB); likely contain company/contact research data. Exclude from Git and preserve separately.
- **`tmp-run-real-04.mjs`.** One-off diagnostic replay using the database, Firecrawl and LLM, with a hardcoded job id and a DB update; exclude, do not execute, human decision on retention.
- **Gitignored `temp/`.** 15 files (6.9 MB) of stage 01–04 dumps and raw failures; exclude and back up separately if the owner wants to retain experiment evidence.
- **`PRODUCT.md`.** Untracked approved product requirements; recommend staging in the docs commit after the owner confirms the file is the approved version. Do not edit.
- **New harness/task docs.** `environment.md`, `research.md`, registry, SDR-001/SDR-002/SDR-003 records are the current documentation baseline; stage them in the docs commit. SDR-003 is new in this Phase A.
- **Existing npm-managed project.** `package.json`, `package-lock.json`, `.gitignore`, dependencies and scripts are unchanged; no dependency/install operations were performed.

## 13. Proposed checkpoint

### 13.1 Exact staging manifest

The proposed staging manifest is the union of every table row marked **STAGE**:

- **23 modified tracked files** in §10.1.
- **6 intentional deletions** in §10.2 (stage the deletion, do not restore).
- **39 untracked files** in §10.3 groups A, B, C and D:
  - 15 application files;
  - 8 documentation/task files (including PRODUCT.md and SPEC.md, subject to confirmation);
  - 13 test/fixture files (fixture subject to sensitivity review);
  - 3 database migration files.
- No other paths.

Total proposed staged paths: **68** (23 modified + 6 deleted + 39 untracked). No staging
was performed.

### 13.2 Exact exclusions

Do not stage:

- 4 `apps/api/tmp-*.json` research outputs;
- 1 `apps/api/tmp-run-real-04.mjs` diagnostic script;
- 6 root `src/.../temp/companies-*.json` dumps;
- `pnpm-lock.yaml` and `pnpm-workspace.yaml`;
- `apps/api/.env`;
- the 15 ignored `apps/api/src/modules/research/temp/` files;
- ignored `node_modules` environment copies.

These are temporary, generated, duplicate, sensitive or tooling-uncertain artifacts. They
remain in the working tree untouched.

### 13.3 Human decisions required

1. Confirm `PRODUCT.md` is the approved product requirements version and may be committed.
2. Confirm `apps/api/test/fixtures/v5-16-domains.json` may be committed; it may contain
   research company/contact data.
3. Confirm the draft `04-company-profiling/SPEC.md` should be committed as documentation.
4. Decide whether to retain `pnpm-lock.yaml` / `pnpm-workspace.yaml` outside Git, or delete
   them later; do not stage without a pnpm decision.
5. Decide whether the six root `src/` company dumps are stale duplicates to archive or
   remove later; do not stage or delete now.
6. Decide whether to retain the `tmp-*.json` research outputs and `tmp-run-real-04.mjs`
   outside Git, and where.
7. Confirm the 15 ignored research `temp/` artifacts should be preserved in a separate
   backup; never commit them.
8. Confirm that staging the current experimental research implementation is intended as a
   checkpoint, not an assertion that tests/builds pass.

### 13.4 Backup approach

Before Phase B (and without executing it in this phase):

- Create an external, access-controlled archive of the ignored `research/temp/` directory,
  root `src/.../temp/` dumps, `tmp-*.json` outputs and `tmp-run-real-04.mjs`.
- Store a SHA-256 manifest beside the archive; do not put archive contents or secrets in
  Git or the report.
- Exclude `apps/api/.env` from ordinary archives; preserve credentials in the owner's
  secure secret storage, never in the repository.
- Treat research outputs as potentially containing company/contact data; restrict access.
- Do not delete the originals during Phase A.

### 13.5 Proposed commit grouping and messages

If the owner prefers a reviewable checkpoint rather than one large commit:

1. **`research: checkpoint current four-stage implementation and schema`** — 12 modified
   application/schema files, 14 new research source files, 6 intentional deletions, 12
   tests, 1 fixture and 3 migrations (48 paths). No behavior change; tests not claimed
   green.
2. **`web: preserve research resume flow`** — 3 modified web files + the new resume route
   (4 paths).
3. **`docs: reconcile policy, harness, research and task records`** — 8 modified
   documentation files + 8 untracked documentation/task files, including PRODUCT.md,
   SPEC.md and SDR-003 (16 paths).

A single checkpoint commit (`chore: checkpoint current implementation and documentation`)
is also acceptable if the owner prefers a straightforward baseline; the grouping above is a
proposal, not a reconstructed history. Do not commit or push in Phase A.

### 13.6 Risks

| Risk | Mitigation |
| --- | --- |
| Research implementation is experimental; including it may look production-ready | Label the checkpoint as a baseline; do not claim test/build success |
| Migration 2 is destructive and may fail on non-empty data | Do not apply; review before any DB operation |
| Test fixture/temp dumps may contain company or contact data | Review before publishing; exclude temp; restrict backup access |
| Excluding `tmp-*`/ignored dumps could lose experiment evidence | Back up outside Git first; do not delete |
| pnpm files are incomplete/duplicate tooling | Exclude; human decision; npm remains canonical |
| Root `src/` dumps are stale/unreferenced | Exclude/backup; human decision on removal |
| PRODUCT.md/SPEC.md content may not be intended for commit | Human confirmation in §13.3 |
| Staging deletions may be mistaken for cleanup | Intentional deletion manifest; old implementation remains in Git history |
| Pre-existing uncommitted changes could be lost by checkout/reset | No Git write in Phase A; Phase B must stage, not reset |

## 14. Freeze and read-only confirmation

- The Research Implementation Freeze was in effect throughout Phase A.
- No research source, prompt, schema, provider, setting, orchestration, test or fixture was
  modified by SDR-003.
- No application code, dependency, database, package manifest, lockfile, `.gitignore` or
  environment file was modified.
- No Git staging, commit, push, reset, stash, checkout or clean was performed.
- No build, typecheck, lint, test, startup, external API call or live research run was
  performed.
- Phase B had not started at Phase A completion.

## Phase B authorization and pre-staging block (2026-11-25)

The human owner accepted Phase A and authorized Phase B under the Phase B restrictions. A
local checkpoint was not created.

### Baseline check

- Branch `main`, HEAD `70cef8f371ab618f2afbc6584656b18db67f0cc3`, upstream `origin/main`,
  ahead/behind `0/0`; no staged changes.
- Working tree: 23 modified tracked, 6 deleted tracked, 52 untracked.
- Phase B pre-staging fingerprints: 62 approved existing files + 28 backup-set artifacts +
  1 `.env` fingerprint-only entry = 91 hashes. The private manifest is
  `%TEMP%\dsh-ViI8sD\sdr003-phaseb-pre.tsv`; its SHA-256 is
  `7916276D6396A66736C9AE638B54B0FE5D0DF0BA34A38271E903989F57E35C09`.
- Comparison with the Phase A inventory found no unexpected application or research
  changes; only the authorized task-document content differs.

### Sensitivity review result

- Credential scan: no hardcoded secret or credential literal was found in the proposed
  staged content. The only `token`-pattern match is the `executionToken`/`executionLeaseUntil`
  destructuring in `research.service.ts`, which is a code identifier, not a credential. The
  excluded `.env` was not backed up, staged or printed; its content was not inspected beyond
  an opaque SHA-256 fingerprint.
- Data sensitivity: `apps/api/test/fixtures/v5-16-domains.json` contains **12 email
  literals across 4 non-example domains** and **36 phone-label occurrences**. The staged
  `SPEC.md` and the staged `company-profiling.*.test.ts` files also contain non-example
  email literals. Only counts are reported; no addresses, numbers, page text or research
  contents are reproduced.
- This is potentially personal or confidential research data. The Phase B condition for
  staging `v5-16-domains.json` — "only if the sensitivity review passes" — is therefore
  **not met**.

### Stop

- No backup was created. No approved external backup destination was established, and the
  sensitivity block occurred before the backup step; no files were copied and no
  permissions or environment settings were changed.
- No Git staging, commit, push, reset, stash, checkout or clean was performed.
- No commit hash exists; the final proof `git show --format=fuller --name-status HEAD` was
  not executed because no checkpoint commit was created.
- Status is `BLOCKED` pending a human decision:
  1. explicitly authorize committing the reviewed fixture and the affected staged test/spec
     data after privacy review; or
  2. authorize a sanitized/synthetic replacement (separate fixture-modification
     authorization); or
  3. explicitly authorize excluding the fixture and affected tests from the checkpoint and
     revising the approved manifest (not done silently).
- No files outside the authorized task-document paths were changed. The research
  implementation remains frozen.

## ENV-002 acceptance and Phase B resumption (2026-11-25)

- ENV-002 is accepted and considered `DONE` by the human owner.
- Accepted backup location:
  `C:\Users\msmig\AppData\Local\SDR-Backups\sdr-assistant-20261125-223538`.
- Accepted manifest SHA-256:
  `F530D26E8234C4379BFF58A948B3F2B4BE1053DD999F90E8AED168E443C23D11`.
- Accepted verification: `PASS: All 36 backup files verified`, exit code 0.
- The backup contains 36 original files plus `manifest.csv`; it was not recreated or
  modified during this resumption.

### Revised 60-path manifest

The human owner approved the original 68-path manifest with eight explicit exclusions:

1. `apps/api/test/fixtures/v5-16-domains.json`
2. `apps/api/test/company-profiling.first-call.test.ts`
3. `apps/api/test/company-profiling.gap-fill.test.ts`
4. `apps/api/test/company-profiling.profile.test.ts`
5. `apps/api/test/company-profiling.batch.test.ts`
6. `apps/api/test/company-profiling.input.test.ts`
7. `apps/api/test/research.04.integration.test.ts`
8. `apps/api/src/modules/research/stages/04-company-profiling/SPEC.md`

Reasons: the fixture, its six directly dependent company-profiling/integration tests, and
the draft SPEC contain non-example email/phone research data identified by the Phase B
sensitivity review. All eight are preserved in the accepted ENV-002 backup and remain
present, unchanged, in the working tree.

The revised approved manifest is exactly:

- 23 modified tracked files;
- 6 existing intentional deletions;
- 31 untracked files;
- **60 paths total**.

All original Phase B exclusions remain in effect. No excluded file may be modified,
deleted, relocated, sanitized or regenerated.

### Resumption and experimental status

- Phase B resumed under standard `workspace-write` intent; the accepted backup was not
  recreated and its permissions were not modified.
- The checkpoint is an **experimental baseline**. It has not been validated through tests,
  builds, application startup, database operations or live provider calls.
- Git hooks/configuration were inspected read-only: `core.hooksPath` is unset,
  `commit.gpgsign` is unset, and `.git/hooks` contains only `*.sample` files with no active
  hooks. A commit would not trigger unauthorized builds, tests, network operations or
  application changes through repository hooks.
- Only `docs/tasks/README.md`, this task document, and the exact revised manifest are
  authorized for content changes/staging; `SDR-002` and other completed task records are
  not modified.

## Post-commit verification evidence (pending documentation change)

This section was added after commit `61302c7` and is **not part of that commit**. It is a
pending documentation change; no second commit was created automatically.

- **Commit:** `61302c7f9c48a8d2757638271d0381d9db2951d4`
- **Message:** `chore: checkpoint current implementation and documentation`
- **Committed paths:** 60 (23 modified, 31 added, 6 deleted).
- **Intentional deletions committed:** all 6 (one old stage-03 spec and five old
  company-discovery files).
- **Excluded paths committed:** 0.
- **Remaining working tree:** 21 untracked excluded artifacts (8 additional exclusions +
  13 artifact exclusions); no staged changes. This task document is the only post-commit
  modified tracked file, as a pending documentation change.
- **Proof command:** `git show --format=fuller --name-status --no-renames HEAD`
- **Exit code:** 0
- **Actual output:**

```text
commit 61302c7f9c48a8d2757638271d0381d9db2951d4
Author:     marijustechin <m.smiginas@gmail.com>
AuthorDate: Wed Nov 25 22:43:22 2026 +0200
Commit:     marijustechin <m.smiginas@gmail.com>
CommitDate: Wed Nov 25 22:43:22 2026 +0200

    chore: checkpoint current implementation and documentation

M	AGENTS.md
M	HANDOVER.md
A	PRODUCT.md
M	README.md
M	TODO.md
A	apps/api/prisma/migrations/20261124123231_add_stage_results/migration.sql
A	apps/api/prisma/migrations/20261124123609_stage01_identified_and_prepared/migration.sql
A	apps/api/prisma/migrations/20261124144445_stage03_resume_state/migration.sql
M	apps/api/prisma/schema.prisma
M	apps/api/src/modules/research/lib/llm-chat.ts
A	apps/api/src/modules/research/lib/parse-json-object.ts
M	apps/api/src/modules/research/research.controller.ts
M	apps/api/src/modules/research/research.module.ts
M	apps/api/src/modules/research/research.service.ts
M	apps/api/src/modules/research/stages/01-product-identification/product-identification.service.ts
M	apps/api/src/modules/research/stages/02-page-collection/page-collection.service.ts
A	apps/api/src/modules/research/stages/03-page-assessment/page-assessment-result.ts
A	apps/api/src/modules/research/stages/03-page-assessment/page-assessment.checkpoint.ts
M	apps/api/src/modules/research/stages/03-page-assessment/page-assessment.prompt.ts
M	apps/api/src/modules/research/stages/03-page-assessment/page-assessment.schema.ts
M	apps/api/src/modules/research/stages/03-page-assessment/page-assessment.service.ts
D	apps/api/src/modules/research/stages/03-page-assessment/page-assessment.spec.ts
M	apps/api/src/modules/research/stages/03-page-assessment/page-assessment.verdict.ts
D	apps/api/src/modules/research/stages/04-company-discovery/company-discovery.prompt.ts
D	apps/api/src/modules/research/stages/04-company-discovery/company-discovery.schema.ts
D	apps/api/src/modules/research/stages/04-company-discovery/company-discovery.service.ts
D	apps/api/src/modules/research/stages/04-company-discovery/contact-page-picker.prompt.ts
D	apps/api/src/modules/research/stages/04-company-discovery/contact-page-picker.schema.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.batch.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.first-call.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.gap-fill.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.geography.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.input.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.market.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.profile.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.prompt.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.schema.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.service.ts
A	apps/api/src/modules/research/stages/04-company-profiling/company-profiling.types.ts
M	apps/api/src/modules/research/types.ts
A	apps/api/test/company-profiling.geography.test.ts
A	apps/api/test/company-profiling.market.test.ts
A	apps/api/test/page-assessment.input.test.ts
A	apps/api/test/page-assessment.resume.test.ts
A	apps/api/test/research.result.test.ts
A	apps/api/test/research.resume.test.ts
A	apps/web/app/api/research/[jobId]/resume/route.ts
M	apps/web/entities/research/api/research.client.ts
M	apps/web/entities/research/client.ts
M	apps/web/features/track-research/ui/research-details.tsx
A	docs/system/environment.md
M	docs/system/frontend.md
M	docs/system/harness.md
A	docs/system/research.md
A	docs/tasks/README.md
A	docs/tasks/SDR-001-agent-execution-policy.md
A	docs/tasks/SDR-002-harness-reconciliation.md
A	docs/tasks/SDR-003-baseline-preservation.md
M	ops/backlog.md
M	ops/current.md
```

### Final verification summary

- Staged-manifest comparison before commit: exactly 60 paths, 23 M / 31 A / 6 D; 0 excluded
  paths; no mismatches.
- Eight additional exclusions and all 13 artifact exclusions remain present and unstaged.
- The accepted ENV-002 backup remains at
  `C:\Users\msmig\AppData\Local\SDR-Backups\sdr-assistant-20261125-223538` with manifest
  SHA-256 `F530D26E8234C4379BFF58A948B3F2B4BE1053DD999F90E8AED168E443C23D11`; it was not
  recreated or modified.
- Approved-60 sensitivity scan: 0 email-literal files; the only token-pattern match remains
  the `executionToken` code identifier.
- No application or research content changed from the pre-task working tree.
- The checkpoint is experimental and has not been validated through tests or builds.
- Research Implementation Freeze remains active.
- SDR-003 remains `READY_FOR_HUMAN_REVIEW` and is not `DONE`; no push or SDR-004 start was
  performed.

## Final acceptance and remote baseline preservation (2026-11-25)

- The human owner accepted the local checkpoint
  `61302c7f9c48a8d2757638271d0381d9db2951d4` with message
  `chore: checkpoint current implementation and documentation`.
- The accepted checkpoint contains exactly 60 approved changed paths.
- ENV-002 remains accepted as `DONE`; its verified 36-file backup remains unchanged at
  `C:\Users\msmig\AppData\Local\SDR-Backups\sdr-assistant-20261125-223538`.
- SDR-003 is marked `DONE` for the accepted **local checkpoint**.
- Remote preservation (`git push origin main`) is a separate operation. At the time this
  documentation commit was prepared it was still pending; the push result and remote hash
  verification are recorded in the task completion report, not retroactively added to this
  commit.
- The checkpoint is experimental. Tests, builds, application startup, database operations
  and runtime behavior have not been validated.
- All 21 excluded untracked files remain present and unstaged. Research Implementation
  Freeze remains fully active. SDR-004 has not been started.
