# SDR-002 — Harness and Documentation Reconciliation

## 1. Task ID and status

- **Task ID:** SDR-002
- **Status:** DONE
- **Registry:** [README.md](README.md)
- **Human acceptance:** accepted by the human owner on 2026-11-25.

## 2. Objective

Reconcile SDR Assistant documentation with Agent Execution Policy v1.0 and the actual
current repository implementation. Establish a concise, consistent documentation system
with clearly separated responsibilities.

This is a documentation-only task. The purpose is to document the project, not to change
how the project works.

## 3. Authorized scope and paths

Only the following files may be modified or created:

- `AGENTS.md`
- `README.md`
- `docs/system/harness.md`
- `docs/system/environment.md`
- `docs/system/research.md`
- `docs/system/frontend.md`
- `ops/current.md`
- `ops/backlog.md`
- `TODO.md`
- `HANDOVER.md`
- `docs/tasks/README.md`
- `docs/tasks/SDR-001-agent-execution-policy.md`
- `docs/tasks/SDR-002-harness-reconciliation.md`

SDR-002 is registered in the authoritative task registry. No subsequent task is created.

## 4. Explicit exclusions

- `PRODUCT.md` modifications.
- Existing ADR modifications.
- Application source code.
- Research prompts, schemas and implementation.
- Tests and fixtures.
- `package.json` and lockfiles.
- Dependency installation.
- Database schema, migrations or data.
- Live research runs.
- External API calls.
- Build, typecheck, lint, tests and application startup.
- Environment modifications.
- Sandbox privilege escalation.
- Git staging, commit, push, reset, stash or clean.
- New architecture decisions.
- Implementation of defects discovered during inspection.
- Changes outside the authorized paths above.

## 5. Acceptance criteria

- SDR-001 is recorded as DONE following human acceptance.
- SDR-002 is registered and documented.
- AGENTS.md is concise and preserves all approved execution restrictions.
- Harness instructions no longer conflict with Agent Execution Policy v1.0.
- Operational commands match existing package scripts.
- Environment documentation includes the verified ENV-001 resolution and its limitations.
- Research documentation accurately describes all four stages and their actual integration
  status.
- Current implementation, approved requirements, historical information and future
  proposals are clearly separated.
- Legacy documents retain their historical content but no longer act as execution
  authorities.
- Existing frontend quality requirements and architecture rules are preserved.
- Newly introduced or modified internal documentation links point to existing files.
- No application behavior or environment configuration has changed.
- No files outside the authorized scope have been modified.
- SDR-002 remains READY_FOR_HUMAN_REVIEW pending human acceptance.

## 6. One proof command

```text
git diff --check HEAD
```

## 7. Verification result

- **Initial working-tree state (before SDR-002):** `HEAD`
  `70cef8f371ab618f2afbc6584656b18db67f0cc3`, branch `main`; 16 modified tracked files,
  6 deleted tracked files and 48 untracked paths. `AGENTS.md` was 316 lines.
- **Proof command:** `git diff --check HEAD`, executed **once** after all substantive
  documentation changes, in standard `workspace-write`.
- **Actual output:** stdout empty. stderr contained Git `core.autocrlf` warnings
  ("LF will be replaced by CRLF") for tracked modified files; no whitespace errors.
- **Exit code:** 0.
- **Manual review:** all changed and new documentation was read and reviewed; internal
  links were checked (0 broken), no trailing whitespace was found, and the final file set
  contains only the authorized paths. The task registry, SDR-001 record and SDR-002 record
  were reviewed for status consistency.
- **Final change counts:** 23 modified tracked files, 6 deleted tracked files and 51
  untracked paths. Relative to the initial baseline, SDR-002 added 7 modified tracked
  documentation files and 3 new documentation files; no application, test, dependency,
  database, environment or ADR file was changed by SDR-002.
- **What this establishes:** the tracked diff, including the modified tracked docs, has no
  whitespace errors and the single proof command exits 0. The new untracked docs are not
  covered by `git diff --check HEAD`; their content and links were reviewed manually.
- **Not established:** runtime behavior, test/build results, database migration state and
  provider behavior; see [research.md](../system/research.md) §12.
- **Status:** `READY_FOR_HUMAN_REVIEW`; not `DONE`; human acceptance remains pending.

## 8. Remaining blockers or limitations

- SDR-002 awaits human review; it is not `DONE`.
- Known implementation discrepancies are recorded in
  [docs/system/research.md](../system/research.md); they are observations, not authorized
  fixes.
- SDR-002 did not run application, build, test, database or provider commands.
- SDR-003 has not been started.

## Execution notes

- Initial baseline before SDR-002: `HEAD`
  `70cef8f371ab618f2afbc6584656b18db67f0cc3`, branch `main`; 16 modified tracked files,
  6 deleted tracked files and 48 untracked paths. `AGENTS.md` was 316 lines.
- Final `AGENTS.md` is 242 lines. The reduction comes from moving commands/environment
  caveats to the system docs, moving historical research descriptions to
  [research.md](../system/research.md), and removing the temporary reconciliation section.
- Documentation map established by SDR-002:
  - `AGENTS.md` — agent authority and execution restrictions.
  - `PRODUCT.md` — approved product requirements (not modified).
  - `README.md` — human-facing project overview.
  - `docs/system/harness.md` — operational commands, workflow and verification.
  - `docs/system/environment.md` — environment observations and approved solutions.
  - `docs/system/research.md` — actual research implementation and known limitations.
  - `docs/system/frontend.md` — approved frontend conventions.
  - `docs/decisions/` — approved ADRs (not modified).
  - `docs/tasks/README.md` — authoritative task registry.
  - Task documents — approved task scope, acceptance criteria and execution evidence.
  - `docs/audits/` and `docs/plans/` — observations and proposals, not authority.
- Obsolete or contradictory instructions resolved:
  - harness self-fix-on-failure instruction removed;
  - independent task selection from `ops/current.md` removed;
  - universal build/API/GUI/live-research completion requirements removed;
  - duplicate verification paragraphs and stale test counts removed;
  - automatic unrestricted-sandbox implications removed;
  - AGENTS command/environment duplication and historical research flow moved out;
  - README's two-stage/fixture/triage description replaced with the current four-stage
    description and result caveat;
  - legacy operational docs marked historical and linked to the current registry/docs;
  - frontend `result`/E2E/harness references corrected without changing architecture.
- Research discrepancies recorded (details and source references in
  [research.md](../system/research.md)): normal completion omits `companies`; profile
  statuses do not require target-market evidence and never produce `rejected`; no
  confirmed-seller count/list; limited country/language map; `productId` is an extra input
  source; stage-01 term candidates omit `targetLanguage`; stage 02 triage is disconnected;
  stage 03 empty-input resume edge; stage 04 gap fill is contact-only and its `nextPage`
  schema/prompt disagree; several tests are stale.
- Facts not established by static inspection: runtime provider behavior, test/build
  results, database migration state, actual API/server behavior and prompt quality. These
  are listed in [research.md](../system/research.md) §12.
- `PRODUCT.md`, ADR-001 and ADR-002 were not modified. No application behavior, dependency,
  database or environment configuration was changed by SDR-002.

## Human-review corrections (2026-11-25)

The human owner accepted the SDR-002 documentation structure in principle but required the
narrow corrections below and declared a temporary freeze of the existing research
implementation. SDR-002 was resumed only for these corrections.

Corrections applied:

1. **Research Implementation Freeze.** Added the binding freeze section to `AGENTS.md` under
   the project-specific research constraints, covering direct and indirect behavior
   changes, stage enable/disable/reorder, unused code, audit findings, test/fixture
   authorization, live/paid calls, version-control preservation, the explicit exception
   rule and the rule that an exception does not lift the freeze for unrelated work. No
   Agent Execution Policy v1.0 restriction was weakened.
2. **Restored research constraints.** Restored the category-boundary/defined-traits rule,
   PRODUCT.md acceptance-case checks for authorized future work, the no-hardcoded-categories
   rule, product/language scoping and the sense-spec/term-family rule. They are explicitly
   framed as preserved future-work requirements, not authorization to change the frozen
   implementation.
3. **Research documentation accuracy.** Added the authority hierarchy (source code for
   actual behavior, PRODUCT.md for approved requirements, AGENTS.md for restrictions,
   discrepancies as observations), the freeze status, and a read-only current
   `research.service.ts` call-path check. All four stages are connected and awaited; no
   stage call in the current `runResearch` is commented out or disabled. The earlier
   commented-out snapshot is labeled historical. Previously identified discrepancies were
   preserved. The historical ladder-level and candidate-expansion notes were restored to the
   research historical section and clearly labeled historical.
4. **Harness alignment.** Added a concise Research Implementation Freeze reference to
   research artifact handling and clarified that `e2e:web` is mandatory for rendered-behavior
   changes even if an approved proof omits it; such an omission must be reported as a
   conflict and execution must stop, not be treated as permission to skip the gate.

Current integration status (read-only inspection, no source change):

- 01 product identification: `productIdentificationService.identify` at
  `research.service.ts:236–242`;
- 02 page collection: `pageCollectionService.collect` at
  `research.service.ts:245–252`;
- 03 page assessment: `pageAssessmentService.assessPages` at
  `research.service.ts:255–270`;
- 04 company profiling: `companyProfilingService.profile` at
  `research.service.ts:273–276`.

All four calls are unconditional awaited calls in the current `runResearch`. The earlier
project snapshot with 02–04 commented out is historical and does not describe the current
file. No research implementation file, test or fixture was changed.

`AGENTS.md` was 316 lines at the original SDR-002 baseline, 242 lines before this
correction pass, and 280 lines after the freeze and restored constraints — still shorter
than the original baseline. Only `AGENTS.md`, `docs/system/research.md`,
`docs/system/harness.md` and this task document were changed in this correction pass.

## Verification after corrections (2026-11-25)

- **Initial working-tree state recorded before corrections:** `HEAD`
  `70cef8f371ab618f2afbc6584656b18db67f0cc3`, branch `main`; 23 modified tracked files,
  6 deleted tracked files and 51 untracked paths. `AGENTS.md` was 242 lines. No changes were
  staged.
- **Order of operations:** all substantive documentation corrections were completed before
  the proof command. The proof command was executed exactly once; this section records that
  result.
- **Proof command:** `git diff --check HEAD`.
- **Actual output:** stdout empty. stderr contained Git `core.autocrlf` warnings
  ("LF will be replaced by CRLF") for tracked modified files; no whitespace errors.
- **Exit code:** 0.
- **Actual current stage integration status:** all four stages are connected and awaited in
  the current `research.service.ts` `runResearch`: 01 at lines 236–242, 02 at 245–252, 03 at
  255–270, 04 at 273–276. No stage call is commented out or disabled. The earlier snapshot
  with 02–04 commented out is historical; it does not describe the current file.
- **Manual review:** all four authorized files were read and reviewed. `AGENTS.md` contains
  the Research Implementation Freeze and the restored research constraints without weakening
  Agent Execution Policy v1.0. `research.md` contains the authority hierarchy, freeze status,
  integration check, preserved discrepancies and restored historical ladder/candidate notes.
  `harness.md` contains the concise freeze reference and the mandatory `e2e:web`
  conflict/stop rule. Internal links were checked with 0 broken links; no trailing
  whitespace was found.
- **Final change counts:** 23 modified tracked files, 6 deleted tracked files and 51
  untracked paths — unchanged from the correction baseline. `AGENTS.md` is 280 lines. No
  research implementation file, research prompt/schema, test, fixture, PRODUCT.md, ADR,
  package manifest, lockfile, database or environment configuration was modified by this
  correction pass; pre-existing uncommitted research changes remain untouched.
- **Status:** `READY_FOR_HUMAN_REVIEW`; not `DONE`; human acceptance remains pending.

## Human acceptance (2026-11-25)

- The human owner accepted SDR-002 on 2026-11-25.
- The task is now `DONE`.
- This acceptance records the decision only; the original objective, acceptance criteria,
  correction record and both verification histories above are preserved unchanged.
- SDR-003 Phase A was separately authorized after this acceptance. Its inventory and
  proposed baseline checkpoint are recorded in
  [SDR-003-baseline-preservation.md](SDR-003-baseline-preservation.md).
