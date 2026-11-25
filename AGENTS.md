# Agent notes

## Agent Execution Policy v1.0

This policy governs every agent working in this repository. It is the root execution
authority; nested instructions and operational documentation may add constraints but must
not grant authority prohibited here. If a conflict prevents safe execution of an assigned
task, report it and stop.

### Roles and authority

- The human owner and the project architect define requirements, architecture, priorities,
  task scope and acceptance criteria.
- The implementation agent executes explicitly assigned tasks. The agent may decide **how**
  to implement an approved requirement but must not independently decide **what**
  additional work should be implemented.
- The agent may challenge requirements, identify risks and propose alternatives. Proposals
  do not constitute authorization to implement them.
- Only the human owner approves changes to requirements, architecture, product semantics
  and task scope.
- A backlog entry, TODO, recommendation, previous task or historical note does not
  constitute authorization.

### Scope control

- Implement only explicitly assigned requirements.
- Make the smallest sufficient set of changes.
- Do not introduce speculative improvements.
- Do not refactor unrelated code.
- Do not add unrequested features.
- Do not rename, move, delete or reformat unrelated files.
- Do not change architecture, dependencies, technology versions or configuration without
  explicit approval.
- Preserve existing uncommitted changes.
- Report unrelated problems instead of fixing them.
- Do not bypass a restriction by modifying another module, a test, a fixture or a
  configuration file.

### Environment and sandbox restrictions

- Do not modify files outside the project repository.
- Do not modify operating system settings, permissions, ACLs, security policies, global
  configurations or agent runtime configurations.
- Exceptions require a separate human-approved environment maintenance task that explicitly
  authorizes the exact actions. Such a task grants no general permission and does not by
  itself authorize privilege escalation or a less restrictive sandbox mode.
- Do not escalate execution privileges or switch to a less restrictive sandbox mode
  without explicit human authorization, even for read-only commands.
- Commands requiring dependency installation, database changes, application startup, paid
  API calls or a broader sandbox environment need explicit task authorization. They are
  not implied by ordinary workspace access.

### Policy protection

The agent must not independently modify:

- `AGENTS.md` or nested agent instruction files;
- `PRODUCT.md`;
- harness and system documentation;
- approved architectural decisions;
- approved task scope;
- acceptance criteria;
- verification requirements.

Modifications to these documents require an explicit task authorizing the specific
changes. The root policy governs the entire repository. No subordinate document may grant
authority prohibited here.

If a conflict prevents safe execution of an assigned task, report it and stop.

### Diagnostic budget

- Perform no more than three focused diagnostic attempts per blocker.
- If the blocker persists, stop and report `BLOCKED`.
- If solving a problem requires exceeding the assigned scope, stop immediately, regardless
  of the remaining diagnostic budget.
- Do not repeatedly attempt equivalent solutions.
- Distinguish confirmed facts from hypotheses.
- Never present an unverified hypothesis as a confirmed root cause.

### Verification

- Every implementation task must define exactly one explicit proof command.
- Execute only the proof command explicitly specified in the approved task.
- A proof command may invoke an existing script containing multiple checks.
- Mandatory project-specific gates must be included in the approved task's proof command.
- If the approved proof command conflicts with a mandatory project requirement, report the
  conflict and stop. Do not independently add verification commands or weaken the
  requirement.
- Necessary read-only repository inspection is not an additional proof command.
- Do not perform additional verification simply because it is possible.
- Do not modify tests or acceptance criteria to conceal failures.
- Do not substitute a weaker verification command.
- Do not introduce universal build, API, GUI or live-research verification requirements.
- If verification requires additional permissions, environment modifications or human
  interaction, report the blocker.
- Never claim successful verification without evidence.

### Task registry and lifecycle

[docs/tasks/README.md](docs/tasks/README.md) is the authoritative task registry. It records
each task ID, title, status and link to its task document. The task document is the
authoritative statement of objective, scope and acceptance criteria.

Lifecycle: `TODO → IN_PROGRESS → READY_FOR_HUMAN_REVIEW → DONE`. `BLOCKED` indicates a
concrete obstacle preventing completion.

- Only a task explicitly assigned by the human is active.
- A task awaiting human review is not active.
- A blocked task may resume only after the human authorizes continuation.
- The agent must not select the next task independently.
- Only the human can authorize `DONE`.
- Completed task records must be preserved.
- The approved objective, scope and acceptance criteria must not be rewritten by the
  implementation agent. Execution notes, observed results and verification evidence may be
  appended to the assigned task document.
- Every subsequent implementation task document must contain: task ID and status;
  objective; authorized scope and paths; explicit exclusions; acceptance criteria; one
  proof command; verification result; remaining blockers or limitations.
- Register only tasks the human explicitly assigns. Do not create or schedule tasks without
  explicit human assignment.

### SDR-specific restrictions

The **Protected research area** section below remains in force without relaxation. In
addition, separate explicit authorization is required for:

- research prompts and prompt versions;
- LLM providers, models and settings;
- research stage execution and orchestration;
- product identification and classification semantics;
- seller eligibility and market evidence rules;
- database schema, migrations and data modifications;
- live research runs;
- external API calls that consume credits or money;
- dependency installation and upgrades;
- Git commit, push, reset, stash or clean operations.

The paid API budget is zero unless explicitly authorized by the task.

[PRODUCT.md](PRODUCT.md) contains the approved product requirements. If the implementation
contradicts it, document the discrepancy in
[docs/system/research.md](docs/system/research.md) rather than changing either silently.
Preserve the binding research and frontend constraints below. Historical descriptions in
the system documentation are not current requirements.

### Completion

- Stop immediately after satisfying the acceptance criteria.
- Do not continue searching for additional improvements.
- Do not commit or push changes unless explicitly instructed.
- Only the human owner can accept a task and authorize its transition to `DONE`.
- Do not start another task automatically.

Every task completion report must contain:

- Task ID.
- Summary of implemented changes.
- Changed files.
- Proof command, actual output and exit code.
- What the verification establishes.
- Scope compliance.
- Remaining limitations or blockers.
- Final status: `READY_FOR_HUMAN_REVIEW` or `BLOCKED`.

## Start here

- [README.md](README.md) — human-facing project overview.
- [PRODUCT.md](PRODUCT.md) — approved product requirements.
- [docs/system/harness.md](docs/system/harness.md) — commands, workflow and verification.
- [docs/system/environment.md](docs/system/environment.md) — environment observations and
  approved solutions.
- [docs/system/research.md](docs/system/research.md) — actual research implementation and
  known limitations.
- [docs/system/frontend.md](docs/system/frontend.md) — approved frontend conventions.
- [docs/tasks/README.md](docs/tasks/README.md) — authoritative task registry.

## Project-specific constraints

### Protected research area

- **Do not modify code under `apps/api/src/modules/research` without an explicit, specific
  request from the user.** Documentation, README, TODO and non-research code may be changed
  only when an assigned task authorizes those specific changes.
- That module is being edited by the user: keep formatters, linters and codemods scoped to
  `apps/web`. Never run a repo-wide `prettier --write` or `eslint --fix`.
- Raw identification fixtures and run dumps under the research `temp/` directories are
  gitignored. Do not commit them.

### Research

- Read [PRODUCT.md](PRODUCT.md) before changing research code, prompts or tests. It is the
  approved product requirements document.
- One research run = one product + one market/language. The country determines the single
  target language for the run; never design for several languages in one run.
- Keep research logic generic. Do not introduce static category or trait maps,
  `STUDY_SPECS`, or product-specific branches.
- Establish the category boundary and defining traits once per study from the product name
  and description. Reuse that definition across stages.
- Check authorized future research changes against the relevant acceptance cases in
  [PRODUCT.md](PRODUCT.md).
- Do not hardcode product categories, product-specific assumptions or a fixed country
  list.
- Scope all generation, evidence and output to the run's product and language.
- The sense spec's `form` is one category seed, not a constraint on stage 02. Stage 02
  must generate multiple meaningful term families from the full product description,
  including application, material, treatment and supply forms; never reduce it to one term
  per category.
- These are preserved requirements for separately authorized future research work. They do
  not authorize changes to the frozen implementation; any discrepancy must remain
  documented, not fixed.
- Use fixtures and `temp/` files only for testing and replay, not as current product
  evidence. If a change would alter which sellers qualify, get the owner's explicit
  approval for that behavior change.
- The actual current stages, integration status and known discrepancies are documented in
  [docs/system/research.md](docs/system/research.md). Do not treat historical descriptions
  as current implementation instructions.

### Research Implementation Freeze

The current research implementation is temporarily frozen.

- Do not modify research source code, prompts, schemas, provider configuration, model
  settings, stage orchestration, product identification, classification, search, filtering,
  evidence handling or result-processing logic.
- Do not enable, disable, replace or reorder research stages.
- Do not remove unused or experimental research code.
- Do not change research behavior indirectly through shared libraries, configuration, API
  contracts, database changes, dependencies or other modules.
- Audit findings, failing tests, documentation discrepancies and architectural
  recommendations do not authorize changes.
- Read-only inspection and explicitly assigned documentation work are permitted.
- Changes to research tests and fixtures require separate explicit human authorization.
- Live research execution and paid provider calls remain subject to their existing
  explicit authorization requirements.
- The freeze does not prevent separately authorized version-control preservation of the
  existing implementation.
- The freeze remains in effect until the human owner explicitly authorizes a specific
  exception or explicitly lifts it.
- Authorization of a specific exception does not lift the freeze for unrelated research
  work.

### Frontend

- Scope: everything under `apps/web`. The API is consumed over HTTP only.
- Next.js 16.4 — this is not the Next.js of older training data. Read the relevant guide in
  `node_modules/next/dist/docs/` before using a Next API. `next lint` no longer exists;
  linting is `eslint .`.
- Architecture and rules: [docs/system/frontend.md](docs/system/frontend.md). Decision:
  [ADR-002](docs/decisions/ADR-002-frontend-lite-fsd.md).
- Hard rules:
  - `app/**` is routing only — metadata, `params`, one view component.
  - No `fetch(` outside `shared/api/**` and `app/api/**` route handlers.
  - Every wire payload is parsed with a zod schema; types are `z.infer`. No `any`, no `as`
    on `response.json()`.
  - Failures are values (`Result`), not exceptions thrown into the render tree.
  - Every async surface has loading, empty, error and terminal states.
  - `next-env.d.ts` is generated and git-ignored — never edit or commit it.
- Any task that changes `apps/web` must include the existing `npm run verify:web` gate in
  its approved proof command. Preserve the frontend architecture requirements.

## Documentation authorities

- `AGENTS.md`: agent authority and execution restrictions.
- `PRODUCT.md`: approved product requirements.
- `README.md`: human-facing project overview.
- `docs/system/harness.md`: operational procedures and commands.
- `docs/system/environment.md`: environment observations and approved solutions.
- `docs/system/research.md`: actual research implementation and known limitations.
- `docs/system/frontend.md`: approved frontend conventions.
- `docs/decisions/`: approved architectural decisions.
- `docs/tasks/README.md`: authoritative task registry.
- Individual task documents: approved task scope, acceptance criteria and execution
  evidence.
- `docs/audits/` and `docs/plans/`: observations and proposals, not execution
  authorization.

No subordinate document may grant authority prohibited by this file. If the implementation
contradicts `PRODUCT.md`, document the discrepancy in
[docs/system/research.md](docs/system/research.md) rather than changing either document.
