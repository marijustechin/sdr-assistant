# TODO — SDR Assistant

Updated: 2026-11-14

> Update this file after every completed task or audit. Keep one active item in
> "Now"; move completed items to "Done" with a short evidence note.

## Now

- [ ] **Project harness and docs**
  - [ ] Refresh `AGENTS.md`: current architecture, protected research area,
        commands, workflow.
  - [ ] Add `docs/system/harness.md`: how to run, test, use fixtures, stop rules,
        and what "done" means.
  - [ ] Add `docs/decisions/ADR-001-research-pipeline.md`: 01 → 02 flow,
        Exa + DeepSeek, fixtures, why no per-page evidence taxonomy.
  - [ ] Add `ops/current.md`, `ops/backlog.md`, `ops/done/` for one active task.
  - [ ] Update `README.md` with quickstart and current research flow.

- [ ] **Frontend audit (read-only)**
  - [ ] Inventory routes: `products/[id]`, `researches`, `_pages`, `entities`,
        `app/api/research/[jobId]`.
  - [ ] Determine the canonical research flow; identify dead/duplicate old form
        and API clients.
  - [ ] Check polling states: queued/running/completed/failed, retry, empty,
        abort on unmount.
  - [ ] Check API/web type alignment and error handling.
  - [ ] Check Tailwind/PostCSS setup and styling consistency.
  - [ ] Write findings to `docs/audits/frontend-2026-11-14.md`.
  - [ ] Do not change code during the audit.

- [ ] **Frontend refactor (after audit)**
  - [ ] Remove or redirect the obsolete research form/routes.
  - [ ] Consolidate API client/types.
  - [ ] Small commits, typecheck after each.

- [ ] **02-company-discovery validation**
  - [ ] Run against the `abachi-lt` fixture.
  - [ ] Review company extraction, domain vs company identity, marketplace
        sellers, deduplication, and evidence.
  - [ ] Add one bounded extra search round only after the first pass is clean.

## Protected area

- `apps/api/src/modules/research` code is **frozen** unless the user gives an
  explicit, specific request/permission. Documentation and non-research code
  may be changed as part of project maintenance.

## Done

- [x] Baseline research/web commit `072a5a8`.
- [x] Raw fixture directory excluded from Git.
- [x] Handover and this TODO created.
