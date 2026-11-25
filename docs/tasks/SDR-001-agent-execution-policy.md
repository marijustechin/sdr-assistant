# SDR-001 — Agent Execution Policy and Task Lifecycle

## 1. Task ID and status

- **Task ID:** SDR-001
- **Status:** DONE
- **Registry:** [README.md](README.md)
- **Human acceptance:** accepted by the human owner on 2026-11-25.

## 2. Objective

Establish a controlled agent execution policy and a persistent task registry for the SDR
Assistant project.

This is a documentation-only task. Do not modify application code or research behavior.

## 3. Authorized scope and paths

Only the following files may be created or modified:

- `AGENTS.md`
- `docs/tasks/README.md`
- `docs/tasks/SDR-001-agent-execution-policy.md`

No other file modifications are authorized. The root `AGENTS.md` contains Agent Execution
Policy v1.0 and references `docs/tasks/README.md` as the authoritative task registry. The
registry records task ID, title, status and a link to the task document. Only SDR-001 is
registered.

## 4. Explicit exclusions

- Application source code.
- Research pipeline and prompts.
- Existing tests and fixtures.
- Harness document modifications.
- Existing ADR modifications.
- Existing task history modifications.
- Dependency installation.
- Database operations.
- API calls.
- Build, typecheck, lint and application startup.
- Git commit and push.
- Environment or permission modifications.

## 5. Acceptance criteria

- Root `AGENTS.md` contains a coherent Agent Execution Policy v1.0.
- Existing valid SDR-specific restrictions are preserved.
- The agent cannot authorize additional work or modify its own rules.
- The three-attempt diagnostic limit is explicit.
- The single-proof-command rule is explicit.
- The task registry exists and SDR-001 is registered.
- The task lifecycle and human acceptance requirement are unambiguous.
- The new registry is authoritative for task assignment and tracking.
- No files outside the authorized scope have been modified by the agent.
- No application code, research behavior or environment configuration has changed.
- SDR-001 awaits human review and is not marked `DONE`.

## 6. One proof command

```text
git diff --check HEAD
```

## 7. Verification result

- **Date:** 2026-11-25.
- **Working directory:** `C:\Users\msmig\Projektai\sdr-assistant`.
- **Sandbox mode:** standard `workspace-write`; no escalation.
- **Exit code:** 0.
- **stdout:** empty (no whitespace errors reported).
- **stderr:** Git `core.autocrlf` warnings ("LF will be replaced by CRLF") for tracked
  files; these are not errors.
- The command checks tracked changes only. The two newly created task documents are
  untracked; they were read back and inspected manually for content and authorized scope.
  Nothing was staged.
- Initial working-tree baseline was recorded before editing: `HEAD`
  `70cef8f371ab618f2afbc6584656b18db67f0cc3`, branch `main`, 16 modified tracked files,
  6 deleted tracked files and 46 untracked paths. `AGENTS.md` was already modified by the
  pre-existing 15-line "Market research" section; that section was preserved.
- The `AGENTS.md` baseline content was read in full before editing. The pre-existing
  "Market research" section is unchanged; the policy, registry reference, historical
  notes and documentation-reconciliation section were added around it.
- No files were staged, committed, stashed, reset, cleaned or normalized.

## 8. Remaining blockers or limitations

- SDR-001 is not `DONE`; it awaits human review and acceptance by the human owner.
- Pre-existing uncommitted changes remain untouched, including the pre-existing
  `AGENTS.md` "Market research" section and the research-module work in the working tree.
- Documentation contradictions are flagged in `AGENTS.md` under "Documentation
  reconciliation" and require a separate explicitly assigned task: `docs/system/harness.md`
  §8/§5.5/§5, `ops/current.md`, `TODO.md`, `ops/backlog.md`, `HANDOVER.md`, and the
  historical "Current research flow"/"Legacy notes" sections.
- SDR-001 made no application, research, dependency, database, API, build or environment
  change. ENV-001 (accepted separately) changed the PowerShell installation before
  SDR-001; that environment change is outside this task.
- SDR-002 has not been started.

## Execution notes

- ENV-001 restored PowerShell 7.6.6. The human owner explicitly resumed SDR-001 from the
  beginning under `workspace-write`.
- The policy includes the additional explicit rule: "Do not escalate execution privileges
  or switch to a less restrictive sandbox mode without explicit human authorization, even
  for read-only commands."
- Files changed by SDR-001:
  - modified: `AGENTS.md` — added Agent Execution Policy v1.0, registry reference,
    historical-document notes and documentation reconciliation; preserved the pre-existing
    "Market research" section;
  - created: `docs/tasks/README.md`;
  - created: `docs/tasks/SDR-001-agent-execution-policy.md`.
- No other files were created or modified by SDR-001.

## Human-review corrections (2026-11-25)

The human owner accepted the overall approach but withheld final acceptance pending the
corrections below. SDR-001 was resumed exclusively for these corrections.

Corrections applied:

1. **Verification authority.** The policy now states that exactly one proof command must
   be defined in the approved task and only that command is executed. A proof command may
   invoke an existing script containing multiple checks. Mandatory project-specific gates
   must be included in the approved task's proof command. If the approved proof command
   conflicts with a mandatory project requirement, the agent must report the conflict and
   stop rather than add commands or weaken the requirement. Necessary read-only
   repository inspection is not an additional proof command. Existing frontend quality
   requirements are preserved unchanged.
2. **Permanent policy.** The task-specific statement granting SDR-001 permission to modify
   `AGENTS.md` was removed. General policy-protection rules are unchanged; modifications
   still require an explicitly authorizing task.
3. **Environment maintenance exception.** The policy now states that modifications
   outside the repository, operating-system settings, permissions, ACLs, security
   policies, global configurations and agent runtime configurations are forbidden unless
   the exact actions are explicitly authorized by a separate human-approved environment
   maintenance task. Such a task grants no general permission and does not by itself
   authorize privilege escalation or a less restrictive sandbox mode. The existing
   explicit sandbox privilege escalation restriction is preserved.
4. **Standard completion report.** The policy now requires every completion report to
   contain: task ID; summary of implemented changes; changed files; proof command, actual
   output and exit code; what the verification establishes; scope compliance; remaining
   limitations or blockers; and final status `READY_FOR_HUMAN_REVIEW` or `BLOCKED`.

Scope of this correction pass:

- Modified: `AGENTS.md`, this task document.
- Not modified: `docs/tasks/README.md` (its SDR-001 status was already correct), the task
  objective, acceptance criteria, previous verification history, research/frontend
  constraints, harness documents, application code, tests, dependencies or environment.

## Verification after corrections (2026-11-25)

- **Initial working-tree state recorded before corrections:** `HEAD`
  `70cef8f371ab618f2afbc6584656b18db67f0cc3`, branch `main`; 16 modified tracked files,
  6 deleted tracked files and 48 untracked paths (the 46 pre-existing paths plus
  `docs/tasks/README.md` and this task document). No changes were staged.
- **Order of operations:** all substantive document changes were completed before the
  proof command. The proof command was executed exactly once; this section records that
  result.
- **Proof command:** `git diff --check HEAD`.
- **Actual output:** stdout empty. stderr contained Git `core.autocrlf` warnings
  ("LF will be replaced by CRLF") for the tracked modified files. No whitespace errors.
- **Exit code:** 0.
- **Manual scope review:** both authorized files were read and reviewed after editing.
  `AGENTS.md` changes are limited to the four corrections above. This task document only
  appends the correction record and this verification evidence; the original objective,
  acceptance criteria and previous verification history are preserved.
  `docs/tasks/README.md` was not modified. No files outside the two authorized files were
  changed by this correction pass.
- **Status:** `READY_FOR_HUMAN_REVIEW`; not `DONE`; human acceptance remains pending.

## Human acceptance (2026-11-25)

- The human owner accepted SDR-001 on 2026-11-25.
- The task is now `DONE`.
- This acceptance records the decision only; the objective, acceptance criteria, execution
  notes and both prior verification histories above are preserved unchanged. Sections 7–8
  describe the pre-acceptance verification and remaining limitations; they remain
  historical evidence.
- SDR-002 was separately authorized after this acceptance. Its work and evidence are
  recorded in [SDR-002-harness-reconciliation.md](SDR-002-harness-reconciliation.md).
