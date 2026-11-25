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
| SDR-003 | Working Tree Inventory and Baseline Preservation | READY_FOR_HUMAN_REVIEW | [SDR-003-baseline-preservation.md](SDR-003-baseline-preservation.md) |

SDR-001, SDR-002 and SDR-003 are registered. No subsequent task is created or scheduled.

## Notes

- SDR-001 was previously blocked by unavailable shell execution; ENV-001 restored
  PowerShell execution. The human owner explicitly resumed SDR-001 and accepted it as
  `DONE` on 2026-11-25.
- SDR-002 was accepted by the human owner and is `DONE`.
- SDR-003 Phase A was accepted. ENV-002 is accepted and `DONE`; its 36-file backup was
  verified. Phase B resumed under the revised 60-path manifest with eight explicit
  exclusions for sensitive/fixture-dependent files. The checkpoint is experimental and has
  not been validated through tests or builds.
- Historical records in `ops/current.md`, `ops/backlog.md`, `TODO.md` and `HANDOVER.md` are
  not task authorization or authoritative status.
