# SDR-006A — Final Research Result Persistence and Recovery

## 1. Task ID and status

- **Task ID:** SDR-006A
- **Title:** Final Research Result Persistence and Recovery
- **Status:** `DONE` — accepted by the architect on 2026-11-26 (§23). The first approved proof
  failed on a test-local identifier typo and is preserved as history (§17.1, Appendix B); after the
  owner-authorized correction and guard strengthening the newly approved proof passed **26/26 tests**
  with exit code `0` (§17.2, Appendix C); the controlled historical recovery was executed once and
  verified (§22). Final aggregate state: 42 researches, 37 completed, **4** with company profiles,
  **223** company profiles, **449** offers.
- **Registry:** [README.md](README.md)
- **Checkpoint at start:** `88041f86f8c8538294d44726c1bcd5b044617824`
  (`docs: reconcile research data and document persistence gaps`), clean tracked tree, 18 excluded
  untracked artifacts present.
- **Execution mode:** standard `workspace-write`. No privilege escalation.

## 2. Objective

Ensure that every newly completed full research has its actual final company profiles durably
persisted in PostgreSQL, through one shared versioned contract used by both the normal and the
resumed completion path, without changing any research decision logic and without breaking the
readability of historical records.

## 3. Authorization and freeze exception

The owner accepted the SDR-006 persistence finding, delegated the persistence/data-structure
decisions to the project architect, and granted a narrow Research Implementation Freeze exception
covering only: final research-result construction, passing the existing stage-04 output to the
persistence boundary, normal and resumed final-result persistence, a versioned final-result
contract, completion-state consistency, focused persistence regression tests, and preparation of a
controlled historical recovery procedure. Research decision logic remains frozen.

## 4. Authorized file scope (confirmed by inspection)

| File | Change | Why it is required |
| --- | --- | --- |
| `apps/api/src/modules/research/final-result.ts` | new | The single final-result contract, builder and recovery guard |
| `apps/api/src/modules/research/research.service.ts` | modified | Both completion writes route through the builder and one atomic persistence method |
| `apps/api/test/research-final-result-persistence.test.ts` | new | The twelve required regression cases plus the strengthened recovery guards |
| `apps/api/test/research.result.test.ts` | modified | Pre-existing regression file aligned with the corrected contract (§17.3) |
| `docs/system/research.md` | modified | §7, §8 and §11 statements that described the corrected defect |
| `docs/tasks/SDR-006A-final-research-result-persistence.md` | new | This record |
| `docs/tasks/README.md` | modified | Task registration |
| `README.md` | modified | One obsolete statement about the normal path corrected |

No stage-04 source file was changed: the profiling service already returned the complete result
(§7), so no change was needed to pass it on. No Prisma schema, migration, prompt, provider,
dependency or configuration change is included. In the follow-up round, production code changed only
inside `final-result.ts` (the recovery guard); `research.service.ts` is unchanged from the first
round.

## 5. Explicit exclusions

None of the following was done: research decision logic, accuracy or performance changes; prompt or
provider changes; schema or migration changes; applied migrations; import of the historical
77-profile result; any database record modification; paid research runs; temporary-artifact
changes; deletion of historical files; a research-result frontend; new stage endpoints;
communication features; `.env` or service changes; dependency installation; privilege escalation;
staging, commit or push; SDR-007.

## 6. Acceptance criteria

Every newly completed full research persists its complete stage-04 profiles; normal and resumed
paths share one versioned contract; the complete profile payload is preserved unmodified; optional
metadata is only what is genuinely available; a zero-company completion persists `companies: []`
while a missing stage-04 result cannot produce a successful completion; persistence and the
COMPLETED state are atomic and ownership-guarded; historical envelopes stay readable; the API
neither strips nor truncates profiles; focused tests exercise the production paths; the recovery
procedure is prepared with hard guards and is not executed.

## 7. Focused source inspection (before implementation)

| Area | Confirmed before state |
| --- | --- |
| Normal orchestration | `ResearchService.runResearch` (`research.service.ts:189-309`) calls 01→02→03→04 in memory and then writes COMPLETED |
| Normal completion write | `research.service.ts:278-296` built `{ completedThrough: '04-company-profiling', resultsPerQuery }` from a literal and **never referenced `profiledCompanies`** (computed at `:273`) |
| Resume orchestration | `ResearchService.runResume` (`:422-500`) re-runs stage 03 pages and stage 04, then writes COMPLETED |
| Resume completion write | `:469-487` built `{ completedThrough: '04-company-profiling', companies: profiledCompanies.domains }` |
| Stage-04 service | `CompanyProfilingService.profile` (`company-profiling.service.ts:43-69`) already returns `CompanyProfilingResult` = `{ promptVersion, createdAt, targetCountry, targetLanguage, product, domains, diagnostics, summary }` (`company-profiling.batch.ts:95-106`) |
| Final-result types | none existed; the result was an untyped object literal at each write site |
| Completion/error persistence | COMPLETED and FAILED are both `research.updateMany({ where: { id, executionToken } })`; the catch clears the token and writes `error` |
| Ownership protection | every progress and terminal write is filtered by `executionToken`; a zero count throws "execution lease lost" |
| API contract | `research.controller.ts` returns the row from `getById`/`getAll`; `getById` removes only `executionToken` and `executionLeaseUntil` |
| Existing tests | `research.resume.test.ts`, `research.04.integration.test.ts` (untracked fixture consumer), `research.result.test.ts` (statically stale per `docs/system/research.md` §10); mocking is plain constructor injection with `vi.fn()` |

## 8. Confirmed root cause

The defect is a **duplicated, hand-written result literal at the completion write**, not a stage-04
fault, not a serialization fault, not a transaction fault and not a truncation fault:

- `runResearch` already holds the complete stage-04 result in `profiledCompanies` but builds its
  persisted result from a literal that omits `companies` entirely.
- `runResume` builds a different literal from the same value and copies only `.domains`.
- Two independent literals for one logical result meant neither could be complete, and the two
  paths silently diverged. The stage-04 output itself was always produced and always returned.

## 9. Final-result contract (implemented)

```ts
export const FINAL_RESULT_SCHEMA_VERSION = 1;
export const FINAL_RESULT_COMPLETED_THROUGH = '04-company-profiling';

export type FinalResearchResult = {
  schemaVersion: typeof FINAL_RESULT_SCHEMA_VERSION;   // always 1
  completedThrough: typeof FINAL_RESULT_COMPLETED_THROUGH;
  companies: CompanyProfile[];                          // always present; [] is valid
  summary?: ProfilingBatchSummary;                      // when the stage-04 summary exists
  resultsPerQuery?: number;                             // normal path only
};
```

Design decisions, recorded for architect review:

- **`companies` is required and never omitted.** A genuine zero-company completion persists
  `companies: []`; a missing or non-array stage-04 result throws instead of persisting an empty
  success.
- **`summary` is persisted.** It is a small counts object produced by every stage-04 run and it is
  the company/offer count SDR-007 needs; it is not derived or invented.
- **`diagnostics` is deliberately not persisted.** It carries the raw second-call model output and
  per-domain page text, grows with run size (the 77-domain dump is 504 KB, mostly diagnostics), and
  duplicates the stage-04 temp dump. It remains available there. Promoting it later is a one-line
  change in the builder if the architect wants it.
- **`resultsPerQuery` stays optional** because only the normal path reads the settings registry; the
  resume path must not invent it.
- **No validation of profile internals.** The builder checks only that the profile list exists and is
  an array, so legitimate output with dynamic trait keys, nulls and older optional fields is never
  rejected or rewritten.
- The payload is passed through by reference: no filtering, deduplication, reclassification or
  regeneration.

The full source is in Appendix A.

## 10. Normal path: before and after

Before (`research.service.ts:278-296`):

```ts
const completed = await this.prismaService.research.updateMany({
  where: { id: jobId, executionToken },
  data: {
    status: 'COMPLETED',
    stage: null,
    executionToken: null,
    executionLeaseUntil: null,
    result: asJson({ completedThrough: '04-company-profiling', resultsPerQuery }),
  },
});
```

After:

```ts
await this.completeResearch(
  jobId,
  executionToken,
  buildFinalResearchResult({ profiling: profiledCompanies, resultsPerQuery }),
);
```

## 11. Resumed path: before and after

Before (`:469-487`): an equivalent `updateMany` whose result was
`{ completedThrough: '04-company-profiling', companies: profiledCompanies.domains }`.

After:

```ts
await this.completeResearch(
  jobId,
  executionToken,
  buildFinalResearchResult({ profiling: profiledCompanies }),
);
```

Both paths now produce the same required fields with the same semantics; only the genuinely
unavailable `resultsPerQuery` differs.

## 12. Atomic completion state and execution ownership

`completeResearch` performs exactly one conditional write:

```ts
const completed = await this.prismaService.research.updateMany({
  where: { id: jobId, executionToken },
  data: { status: 'COMPLETED', stage: null, executionToken: null,
          executionLeaseUntil: null, result: asJson(result) },
});
if (completed.count !== 1) throw new Error(`Execution lease lost for job ${jobId}; …`);
```

- **Atomic:** the result and the COMPLETED state are set by the same statement; there is no window
  in which one exists without the other.
- **Ownership:** the `executionToken` filter is evaluated by the database, so a stale or superseded
  executor matches zero rows, writes nothing and throws. The catch's FAILED write uses the same
  filter, so it also writes nothing for a lost lease — the other execution's row is untouched.
- **No false completion:** a validation error (missing stage-04 output) or a database error in the
  completion write propagates to the existing handler, which records FAILED and leaves `result`
  unchanged.
- No retries, background jobs or new orchestration were introduced.

## 13. Zero-company versus missing-result semantics

| Situation | Persisted result | Status |
| --- | --- | --- |
| Stage 04 ran and produced no profiles | `{ schemaVersion, completedThrough, companies: [] }` | `COMPLETED` |
| Stage 04 ran and produced profiles | full contract with every profile | `COMPLETED` |
| Stage 04 output absent / not an array | nothing written | `FAILED`, `error` explains the refusal |
| Completion write fails | nothing written; previous value kept | `FAILED` |
| Lease lost before the write | owner's row untouched | unchanged (still `RUNNING` with the new owner) |

## 14. API compatibility

`GET /research/:jobId` and `GET /research` are unchanged: same envelope, the `researches` row with
`executionToken` and `executionLeaseUntil` removed, `result` returned verbatim. The final result is
not truncated, mapped or filtered. Historical rows are returned exactly as stored; no
`schemaVersion` is required to read them. No new endpoints were added.

## 15. Historical records

All 42 existing rows are untouched. Seven historical envelope shapes remain readable because the
reader contract is "return `result` verbatim"; only `schemaVersion: 1` rows carry the new marker,
and nothing validates or migrates the old ones.

## 16. Regression tests

`apps/api/test/research-final-result-persistence.test.ts` — 18 tests, exercising the production
`start` → `runResearch` and `resume` → `runResume` paths with injected stage doubles and a Prisma
double that mirrors conditional-token writes and JSON column round-tripping.

| Required case | Test |
| --- | --- |
| 1 normal persists complete stage-04 profiles | "persists the complete stage-04 company profiles on the normal completion path" |
| 2 resumed persists the same versioned contract | "persists the same versioned contract on the resumed completion path" |
| 3 content preserved without modification | "preserves every nested profile field without reclassification or filtering" |
| 4 metadata preserved | `summary` and `resultsPerQuery` asserted in cases 1 and 2 |
| 5 zero-company result | "persists an empty companies array for a completed run that found no companies" |
| 6 missing/invalid output cannot complete | "marks the run FAILED when the stage-04 output is missing instead of reporting a false completion" |
| 7 persistence failure cannot complete | "keeps FAILED when writing the final result fails" |
| 8 token/stale-execution protection | "never overwrites another execution result when the lease was lost" |
| 9 existing failure/incomplete semantics | "keeps the existing failure semantics when a stage throws"; "keeps resume rejection semantics for a run without stage-01/stage-02 state" |
| 10 historical unversioned readable via API | "serves historical unversioned results unchanged" |
| 11 API mapper does not strip or truncate | "returns every persisted company profile through the API without truncation" (77 profiles) |
| 12 recovery rejects mismatched targets | "prepared historical recovery guards" — 13 cases: the confirmed happy path, and refusals for a different job id, a non-completed target, an artifact fingerprint mismatch, an empty artifact, a profile-count mismatch, existing profiles, a legitimate empty `companies` array, an already recovered record, a changed pre-recovery result, a wrong completion label, a stage-03 domain-count mismatch and an unapproved target fingerprint |
| 12b existing regression file compatibility | `apps/api/test/research.result.test.ts` — 2 tests, now driving the production completion path with synthetic data and asserting the corrected envelope |

All data is synthetic and uses the reserved `.example` TLD. No real contact data is used and no
excluded fixture is restored.

### 16.1 Actual results

- **First approved proof (original run): FAILED.** Build PASS; 18 tests with 12 passed and 6
  failed. The six recovery *rejection* cases all failed with
  `prepareHistoricalRecovery is not defined` — a test-local identifier typo, not a production
  defect. Preserved verbatim in §17.1 and Appendix B.
- **Newly approved proof (this follow-up): PASSED.** Build PASS; **26 tests, 26 passed, 0 failed**
  across the two files the proof now runs — 24 in this task's file (11 orchestration/API, 13
  recovery-guard) and 2 in the aligned `research.result.test.ts`. Exit code `0`, expected final line
  printed. Full output: §17.2 and Appendix C.

## 17. Approved proofs

### 17.1 First approved proof (original run) — FAILED, preserved

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run build -w @sdr-assistant/api
    if ($LASTEXITCODE -ne 0) {
        throw 'API build failed'
    }

    npm.cmd run test -w @sdr-assistant/api -- test/research-final-result-persistence.test.ts
    if ($LASTEXITCODE -ne 0) {
        throw 'Final research result persistence tests failed'
    }

    Write-Output 'PASS: SDR-006A final research result persistence'
}
```

- Build step: PASS.
- Test step: **FAIL** — 18 tests, 12 passed, 6 failed.
- Exit code: **1**. The expected final line was not printed; the block threw
  `Final research result persistence tests failed`.
- Cause: six call sites in the new test file named `prepareHistoricalRecovery` while the module
  exports `prepareHistoricalResultRecovery`; no assertion was reached.
- This outcome is recorded as history and is not rewritten. Full output: Appendix B.

### 17.2 Newly approved proof (this follow-up)

The owner authorized the mechanical name correction, the recovery-guard strengthening and one new
proof execution that also runs the aligned existing regression file.

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run build -w @sdr-assistant/api
    if ($LASTEXITCODE -ne 0) {
        throw 'API build failed'
    }

    npm.cmd run test -w @sdr-assistant/api -- test/research-final-result-persistence.test.ts test/research.result.test.ts
    if ($LASTEXITCODE -ne 0) {
        throw 'Research result persistence regression tests failed'
    }

    Write-Output 'PASS: SDR-006A final result persistence and recovery guards'
}
```

Executed once, after every authorized correction. Result: **build PASS, 26/26 tests passed, exit
code 0**, final line `PASS: SDR-006A final result persistence and recovery guards`. Output:
Appendix C.

### 17.3 Corrections applied before the new proof

1. **Test defect corrected.** All six references in
   `apps/api/test/research-final-result-persistence.test.ts` now call
   `prepareHistoricalResultRecovery`. No assertion, scenario or expected outcome was changed,
   removed, skipped or weakened.
2. **Recovery guards strengthened** (production, inside the authorized persistence scope,
   `final-result.ts` only):
   - the guard now takes the **exact verified pre-recovery result** (`expectedOriginalResult`) and a
     **target fingerprint** (`expectedTargetFingerprint`, computed by the exported
     `targetRecoveryFingerprint`) covering job id, status, result and stage-03 domain count;
   - an existing `companies` field is refused **before** any comparison, with distinct messages for
     non-empty profiles and for a legitimate empty array — `companies: []` is a valid completed
     result and is never treated as missing data;
   - the result must be structurally identical to the verified original, so a changed or already
     recovered row is refused;
   - the identifier, status, completion label, artifact fingerprint, profile count and stage-03
     domain count must all match;
   - the compare-and-set now exists in two layers: these application guards, and the SQL predicate
     in §19.3 which itself requires the exact original `result` value.
3. **Existing regression file aligned.** `apps/api/test/research.result.test.ts` drove a pipeline
   shape that no longer exists (empty stage stubs, an unconditional `update` for completion, a temp
   file that is not in the tree) and asserted the retired `04-company-discovery` label. It now uses
   a deterministic synthetic stage-04 result, drives the production `start` → `runResearch` path,
   and asserts the corrected envelope. Every content assertion and count is preserved verbatim
   (25 profiles, 78 offers, 3 `profiled` / 22 `needs_review`, four target-market companies, the same
   named company with two target offers). Only the completion label and the inspected completion
   statement changed. Diff: Appendix A.3.
4. **Documentation reconciled**: §5 of this record, `docs/system/research.md` §7/§8/§11 and
   `README.md`.

Both test files are fully mocked/synthetic: injected stage doubles, an in-memory Prisma double, no
network client, no temp file, no provider call and no real research execution. The proof therefore
cannot spend credit or start a run.

## 18. Preservation and sensitivity review

- Research decision logic: unchanged. The only production files touched are the new contract module
  and the two completion writes; no stage, prompt, provider, evidence or ordering change.
- Database: read-only queries only, in `READ ONLY` transactions. No record was modified.
- Migrations: none added or applied; the ten applied migrations and their checksums are unchanged.
- Excluded artifacts: the 18 untracked artifacts are byte-identical to their SDR-006 baselines.
- Archived historical artifacts: intact; the archive was read, never written.
- Sensitivity: documentation and tests contain no real company names, domains, contacts, prices,
  page text or credentials. The recovery evidence is counts, hashes and timestamps only. Test data
  uses invented `.example` domains.

Diff-based scope argument: `git diff` shows exactly two removed statements' worth of duplicate
completion logic replaced by one shared method, plus one import; the new module is self-contained
and type-only-imported. Nothing in the diff touches identification, terminology, collection,
assessment, classification, prompts, providers or evidence rules.

## 19. Historical recovery preparation

> **Status update:** the preparation below was accepted by the architect and the recovery was
> **executed once** on 2026-11-26 under a separate owner authorization. See §22 for the preflight,
> backup, transaction outcome, proof and API evidence. This section is preserved as the approved
> procedure that was followed.

### 19.1 Correlation evidence

Artifact: `apps/api/src/modules/research/temp/04-profiling-result-dailylen-2026-11-25-18-10-11.json`
(SHA-256 `0a15a59e03363a54e65018ca4f43fa1d807d610fe7ce81bc6dc44a5f205258de`, 504,244 bytes),
also present in the protected archive with the identical size and hash.

Candidate target: `cmww8smxb0000z4swhooukamv`.

| Evidence | Artifact | Target row / stage rows | Verdict |
| --- | --- | --- | --- |
| Product identity (productName\|categoryName\|generalCategoryName) | `b0a5afb01a361190` | stage 01 `b0a5afb01a361190`; stage 03 md5 `e8339a478f01d2e58255c2c71d22163c` matches stage 01 | match |
| Country / language | `Lithuania` / `Lithuanian` | row `country` `Lithuania`; stage-03 `targetCountry`/`targetLanguage` identical | match |
| Domain set | 77 domains, sorted-set SHA-256 `7b0a44a3afa5d218` | stage-03 result: 77 domains, same set hash; it is unique among all five stage-03 rows (`0261170d…`, `9a748912…`, `0eb826a8…`, `738988ec…` are the others) | match, unique |
| Page/offer volume | 173 offers | stage-03 result: 173 accepted pages | match |
| Timing | artifact `createdAt` `2026-11-25T16:10:11.169Z` | row `updatedAt` `2026-11-25 16:10:11.242` (UTC), heartbeat `16:10:08.5` | file written 73 ms before the row's completion write, the expected order |
| Artifact fingerprint | original = archived = `0a15a59e…` | — | byte-identical |
| Current persisted result | — | `{"completedThrough":"04-company-profiling","resultsPerQuery":40}`, 67 bytes, no `companies` key, `status` `COMPLETED` | the known incomplete envelope |
| Other rows at pre-recovery baseline | — | 41 rows, fingerprint `e4094de2f93341f4b81b3a70f12444ce` | preservation baseline |
| Guarded-update projection | — | exactly **1** row matches the intended write predicate | single-row target confirmed |

No conflicting evidence was found: every independent link (identity, market, domain set, volume,
timing) points to the same single research record, and the domain set is unique among all stage-03
results. The artifact's `promptVersion` is `company-profiling-v1` and its summary reports
77 domains / 69 `profiled` / 8 `needs_review` / 173 offers, consistent with the stage-03 volume.

### 19.2 Prepared procedure (requires separate authorization; **not executed**)

`prepareHistoricalResultRecovery` in `final-result.ts` is the guard layer: pure, no I/O, and it
throws on any mismatch before a payload is produced. The procedure below uses it and performs one
compare-and-set row update. It is deliberately not runnable from the application.

**Approved baseline values** (recorded from the read-only correlation in §19.1):

| Value | Baseline |
| --- | --- |
| Target job id | `cmww8smxb0000z4swhooukamv` |
| Expected original result | `{"completedThrough":"04-company-profiling","resultsPerQuery":40}` |
| Artifact SHA-256 | `0a15a59e03363a54e65018ca4f43fa1d807d610fe7ce81bc6dc44a5f205258de` |
| Expected profile count | 77 |
| Stage-03 domain count | 77 (set hash `7b0a44a3afa5d218`) |
| Target approval fingerprint | computed by `targetRecoveryFingerprint(target)` and approved before execution |
| Other 41 rows | fingerprint `e4094de2f93341f4b81b3a70f12444ce` |

**Preconditions**

1. Owner authorization for a one-row data change (this task does not grant it).
2. A verified protected database backup created under the accepted convention, with a manifest and
   SHA-256 verification, taken immediately before the recovery.
3. No research is active: `QUEUED` and `RUNNING` counts are both 0.
4. The artifact is present at the recorded path, or in the archive, with SHA-256 `0a15a59e…`.
5. The target row still matches §19.1 and the 41 other rows still hash to `e4094de2…`.

**Step 1 — read-only preflight.** Re-run the correlation queries used for §19.1 and require: target
status `COMPLETED`, `completedThrough = '04-company-profiling'`, **no `companies` key at all**,
stage-03 domain count 77 with set hash `7b0a44a3afa5d218`, artifact hash `0a15a59e…`, the exact
original result above, and `would_update = 1`.

**Step 2 — build the payload.** Call

```ts
prepareHistoricalResultRecovery({
  expectedJobId: 'cmww8smxb0000z4swhooukamv',
  expectedOriginalResult: { completedThrough: '04-company-profiling', resultsPerQuery: 40 },
  expectedTargetFingerprint: '<approved targetRecoveryFingerprint(target)>',
  expectedArtifactSha256: '0a15a59e…',
  expectedCompanyCount: 77,
  target,      // jobId, status, result, stage03DomainCount as read
  artifact,    // sha256, domains[], summary
});
```

It refuses, in order: a wrong job id; a non-completed row; an artifact whose fingerprint is not the
archived file; an empty artifact; a profile count that is not the confirmed count; a result that is
not an object; **any existing `companies` field** — with a distinct message for a legitimate empty
array, which is a valid completed result and is never treated as missing data; a result that is not
structurally identical to the verified original (so a changed or already recovered row is refused);
a completion label that is not `04-company-profiling`; a stage-03 domain count that disagrees with
the artifact; and a target fingerprint that differs from the approved baseline. On success it
returns the final result with `resultsPerQuery: 40` preserved from the original envelope.

**Step 3 — single guarded write (compare-and-set).** One statement, in its own transaction, bound
to three parameters: `$1` target id, `$2` the expected original result, `$3` the built final result.

```sql
BEGIN;

UPDATE researches
   SET result = $3::jsonb
 WHERE id = $1
   AND status = 'COMPLETED'
   AND result = $2::jsonb                          -- exact approved original, enforced by the database
   AND result->>'completedThrough' = '04-company-profiling'
   AND NOT (result ? 'companies')                  -- never overwrite any persisted profile list
RETURNING id, status, "createdAt", "updatedAt";

-- exactly one row must come back; otherwise ROLLBACK and abort.
COMMIT;
```

The predicate, not the application check, is the authority: if the stored result is no longer
byte-for-byte the approved original — because another operator already recovered it, because it
changed, or because it now carries `companies: []` or a non-empty list — the statement updates
**zero** rows and the transaction is rolled back. `jsonb` equality is structural, so key order in
the stored value is irrelevant.

The statement does not touch `status`, `createdAt`, `updatedAt`, `stage`, `error`,
`executionToken` or `executionLeaseUntil`, so the historical completion time, status and
timestamps are preserved. Only the `result` column changes.

**Step 4 — post-checks.** Target: `schemaVersion` 1, `completedThrough` `04-company-profiling`,
`companies` length 77, 173 offers, `resultsPerQuery` 40, `summary` present; `status` still
`COMPLETED`; `createdAt`/`updatedAt` unchanged. All 41 other rows must still hash to `e4094de2…`.
Stage tables must be unchanged. No `QUEUED`/`RUNNING` rows.

**Step 5 — rollback.** Restore the single row's `result` from the backup taken in precondition 2
(targeted table restore or the original 67-byte JSON value), or restore the full dump. No
application migration is involved.

**Step 6 — idempotency and tamper resistance.** Re-running Step 3 after success affects **0** rows,
because the stored result is no longer equal to `$2` and now contains `companies`; re-running Step 2
throws ("already contains company profiles"). A second execution therefore cannot overwrite
persisted profiles. Editing the target between approval and execution invalidates the fingerprint
and the CAS predicate together.

**Explicit non-goals.** No import of the other historical rows, no normalization of the seven
envelope shapes, no backfill of any other record, no schema change, no application code path that
performs recovery, and no generalized recovery infrastructure — the guard is one pure function used
by the documented procedure.

## 20. Remaining limitations

- Historical rows other than the recovery target keep their old envelopes; only new completions use
  `schemaVersion: 1`. There are now eight envelope shapes in the database after the next
  completion (seven historical plus the versioned one).
- `diagnostics` is not persisted (documented decision, §9). If SDR-007 needs per-domain provenance it
  must come from the temp dump or an authorized contract change.
- The recovery described here was **executed** on 2026-11-26 (§22). The 77 profiles are now in
  PostgreSQL; §22.7 lists what remains unrecovered.
- Stage 01/02/03 data is still not exposed by the API; SDR-007 cannot read it without a separate
  authorization.
- `docs/system/research.md` §7, §8 and §11 still describe the normal-path omission as current. It is
  now stale; this task is not authorized to modify system documentation. Reported, not fixed.
- `apps/api/test/research.result.test.ts` remains statically stale (it expects
  `04-company-discovery` and reads a temp file that no longer exists). It was not modified; the
  proof does not run it.

## 21. Freeze and read-only confirmation

- Research decision logic, prompts, providers, evidence rules, collection and assessment were not
  modified: the production diff is confined to the completion write and the new contract module.
- No database record was modified; every query ran in a `READ ONLY` transaction.
- No migration, schema, dependency, `.env` or service change.
- No research execution, paid call, SMTP/IMAP connection or temporary-artifact change.
- No staging, commit or push. SDR-007 was not started.

## 22. Controlled historical recovery (executed 2026-11-26)

The architect accepted the persistence implementation (API build PASS, 24/24 final-result tests,
2/2 existing regression tests, 26/26 total) and the owner authorized exactly one guarded historical
recovery. No production code changed for this operation; the only database mutation is the single
`researches.result` update described below.

### 22.1 Preflight (read-only, 16 checks, all PASS)

| Item | Observed |
| --- | --- |
| HEAD / branch | `88041f86f8c8538294d44726c1bcd5b044617824` / `main`, 5 authorized tracked modifications, 0 staged |
| Database | `sdr_assistant`, PostgreSQL 17.11, healthy |
| Migrations | 10 recorded, 10 finished, 0 rolled back, 0 with logs, 10/10 checksums match the repository files |
| Active research | 0 `QUEUED`, 0 `RUNNING` |
| Artifact | 504,244 bytes, SHA-256 `0a15a59e03363a54e65018ca4f43fa1d807d610fe7ce81bc6dc44a5f205258de` |
| Archived copy | identical size and SHA-256 |
| Artifact payload | 77 profiles, 173 offers |
| Domain-set correlation | **exact**: full sorted-set SHA-256 identical on both sides, and the 77-element sorted arrays compare equal element by element |
| Domain-set SHA-256 | `7b0a44a3afa5d21862be927780c4d43d680447854ae05726631561f1890165c5` (artifact = stage 03) |
| Target | `cmww8smxb0000z4swhooukamv`, `COMPLETED`, result `{"completedThrough":"04-company-profiling","resultsPerQuery":40}`, no `companies` key |
| Target approval fingerprint | `85d6516e63d7dc14c7c74f3d32789f517d0e39930163e478d3fd224cc6ee2763` |
| Pre-recovery aggregates | 42 researches, 37 completed, 3 with companies, 146 profiles, 276 offers, 5 products, 5/3/5 stage rows, 1 setting, 2 email accounts |
| Non-target rows | 41 rows, fingerprint `e4094de2f93341f4b81b3a70f12444ce` |
| Schema | `723bc49a6a0a2d6f5f48672020534eeb` |
| Research source | 65 files, `9661be677d219e1e91fb802761c478a8f4a2cbf1e7bf34a0904418b42c7ec520` |
| Excluded artifacts | 18/18 byte-identical |

The artifact was read once; the SHA-256 was computed from those bytes and the same bytes were
parsed for the recovery.

### 22.2 Protected database backup

| Item | Value |
| --- | --- |
| Directory | `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-141758` |
| Archive | `sdr_assistant_full_20261126-141758.dump` |
| Format / size | PostgreSQL custom (`pg_dump -Fc`) / 3,808,110 bytes |
| SHA-256 | `68a9fdda8e8706b990fd73353be4317561c3b71bd3732521f936e0d6895fa71e` |
| Container vs host | identical size and SHA-256 |
| ACL | inheritance removed; explicit FullControl only for `NT AUTHORITY\SYSTEM`, `BUILTIN\Administrators` and `ALFASISDEV\msmig`; 0 inherited ACEs, 0 `CodexSandboxUsers` ACEs at the root; the dump file carries the three inherited FullControl ACEs |
| `pg_restore -l` | exit 0; exactly **8** `TABLE DATA` entries — `_prisma_migrations`, `email_accounts`, `products`, `research_stage_01_results`, `research_stage_02_results`, `research_stage_03_results`, `researches`, `settings` |
| Complete read | `pg_restore --file=-` generated 479 lines of SQL, exit 0, no restore performed |
| Cleanup | the container temporary dump was removed; no `sdr006a` path remains in the container |
| Not copied | `.env` and the encryption key were never read or copied |

No previous backup was overwritten.

### 22.3 Transaction outcome

One transaction, in this order: `BEGIN`; `SELECT … FOR UPDATE` on the target research row **and** its
stage-03 row; re-verify status, exact original result, absence of `companies`, timestamps and token
state against the approved baseline; recompute the stage-03 domain set and require exact array
equality plus the full SHA-256 match; build the plan with the tested, compiled
`prepareHistoricalResultRecovery`; verify the plan's 77 profiles / 173 offers and canonical equality
with the artifact; execute one parameterized compare-and-set `UPDATE`; re-read and verify; `COMMIT`.

| Item | Value |
| --- | --- |
| Rows affected | **1** |
| Contract written | `schemaVersion: 1`, `completedThrough: "04-company-profiling"`, `companies` (77), `summary` (artifact batch summary), `resultsPerQuery: 40` |
| Diagnostics | not persisted |
| Untouched target fields | `status`, `stage`, `error`, `executionToken`, `executionLeaseUntil`, `createdAt` (`2026-11-25 14:52:15.503`), `updatedAt` (`2026-11-25 16:10:11.242`), `lastHeartbeatAt` |

Pre-commit verification (all passed, otherwise rollback): exactly one row returned; persisted
companies canonically identical to the artifact; 77 profiles / 173 offers; `summary` equal to the
artifact summary; no `diagnostics` key; non-result target fields unchanged; aggregates exactly 42 /
37 / 4 / 223 / 449; the 41 non-target rows' fingerprint unchanged; stage-01/02/03 fingerprints
unchanged; schema, settings and email-account fingerprints unchanged.

Before → after aggregates: researches 42 → 42, completed 37 → 37, records with company profiles
3 → **4**, profiles 146 → **223**, offers 276 → **449**.

### 22.4 Final recovery proof (executed once, read-only)

`node apps/api/tmp-sdr006a-recovery.mjs --mode=proof` — exit code **0**, 17/17 checks PASS, ending
`PASS: SDR-006A historical research result recovery and preservation verified`.

```text
SDR-006A final recovery verification (read-only)

CHECK 1 database-connectivity-and-migrations: PASS — 10 applied, 10/10 checksums match
CHECK 2 research-totals: PASS — researches 42, completed 37
CHECK 3 records-with-company-profiles: PASS — 4 records
CHECK 4 aggregate-company-profiles: PASS — 223 profiles
CHECK 5 aggregate-offers: PASS — 449 offers
CHECK 6 recovered-target-contract: PASS — schemaVersion 1, 77 profiles, 173 offers
CHECK 7 structural-equality-with-artifact: PASS — recovered profiles == artifact profiles (canonical JSON)
CHECK 8 preserved-metadata: PASS — resultsPerQuery 40, artifact summary preserved, diagnostics absent
CHECK 9 target-non-result-fields-unchanged: PASS — status COMPLETED, timestamps 2026-11-25 14:52:15.503 / 2026-11-25 16:10:11.242
CHECK 10 non-target-research-records-unchanged: PASS — 41 rows e4094de2f93341f4b81b3a70f12444ce
CHECK 11 stage-records-unchanged: PASS — stage 01/02/03 fingerprints identical
CHECK 12 products-settings-email-schema-unchanged: PASS — products 5, settings 1, emails 2, schema 723bc49a6a0a2d6f…
CHECK 13 artifacts-unchanged: PASS — original and archived SHA-256 0a15a59e03363a54…
CHECK 14 backup-intact: PASS — sdr_assistant_full_20261126-141758.dump 3808110 bytes 68a9fdda8e8706b9…
CHECK 15 excluded-artifacts-unchanged: PASS — 18/18 byte-identical
CHECK 16 research-source-unchanged: PASS — 65 files 9661be677d219e1e…
CHECK 17 planner-refuses-recovered-target: PASS — Recovery refused: target research already contains company profiles

PASS: SDR-006A historical research result recovery and preservation verified
```

The historical `UPDATE` was **not** re-executed to demonstrate idempotency; check 17 proves the
planner now refuses the recovered target, and the compare-and-set predicate would match zero rows.

### 22.5 API acceptance (read-only)

- The API process listening on `127.0.0.1:4000` (PID 34316) started at `14:11:36`, the same second
  the accepted SDR-006A build wrote `dist/main.js` and `dist/modules/research/*.js`, so it is running
  the accepted implementation. No restart was required and none was performed.
- Binding remains loopback-only (`127.0.0.1:4000`). `/health` returned `200 {"status":"ok"}`.

| Check | Result |
| --- | --- |
| `GET /research/cmww8smxb0000z4swhooukamv` | HTTP 200, 203,869 response bytes |
| Contract | `schemaVersion` 1, 77 profiles, 173 offers |
| Truncation | none — the response's companies are canonically identical to the artifact (canonical SHA-256 `6a17c4f39ce46e3b…`) |
| Metadata | `resultsPerQuery` 40, `summary` present |
| Internal fields | response exposes only `id, productId, country, status, stage, result, error, lastHeartbeatAt, createdAt, updatedAt` — no `executionToken`, no `executionLeaseUntil` |
| Historical current-format row | HTTP 200, 16 profiles, no `schemaVersion` (unchanged) |
| Historical legacy row | HTTP 200, `completedThrough: "02-page-collection"` (unchanged) |

No POST, no research execution, no provider call, no SMTP/IMAP connection was made.

### 22.6 Preservation summary

The only changed database value is the target's `result`. All 41 other research rows, all stage rows,
products, settings, email accounts, the schema, the ten migrations, the original and archived
artifacts, the fresh backup, the 18 excluded artifacts and the research source are byte- or
fingerprint-identical to the pre-recovery baseline. The Research Implementation Freeze remains fully
active; no production code changed.

### 22.7 Remaining limitations

- Only this one historical row was recovered. The other completed rows that lack profiles (34 at the
  SDR-006 inventory) keep their old envelopes and remain un-recovered; each would need its own
  evidence and authorization, and most have no surviving stage-04 artifact.
- The recovery was a one-off documented procedure, not a repeatable application feature.
- Stage 01/02/03 data is still not exposed by the API.
- `apps/api/test/research.result.test.ts` retains one pre-existing named-company assertion, now
  driven by synthetic data.

## 23. Final acceptance and closure (2026-11-26)

### 23.1 Human acceptance

The architect accepted the SDR-006A implementation and the controlled historical recovery on
2026-11-26. Accepted evidence:

- API build: PASS.
- Regression tests: **26/26** PASS.
- Recovery preflight: **16/16** PASS.
- Historical recovery proof: **17/17** PASS.
- Protected database backup: verified.
- Exactly one authorized database row updated.
- 77 recovered company profiles and 173 offers.
- Complete structural equality between the recovered profiles and the original artifact.
- All non-target research records, intermediate stage records, products, settings, email accounts,
  schema and the ten migrations preserved.
- The existing research detail endpoint returns the complete recovered result; historical responses
  remain readable.
- Research decision logic unchanged.

**SDR-006A is `DONE`.** The narrow persistence exception is complete. The Research Implementation
Freeze remains fully active for all other work.

### 23.2 Accepted technical decisions

1. **PostgreSQL is the authoritative persisted research-result source.** Temporary files remain
   diagnostics; consuming a completed result never depends on them.
2. **Newly completed full researches use `schemaVersion: 1`.**
3. **Normal and resumed execution share one final-result construction and one persistence
   mechanism** (`buildFinalResearchResult` + `completeResearch`).
4. **The final result and the COMPLETED state are written atomically** in one token-guarded
   statement.
5. **A legitimate empty `companies` array is distinct from a missing `companies` field.** `[]` is a
   valid completion; absence is a hard error that fails the run.
6. **Historical result envelopes remain unchanged**, except for the single authorized recovered row.
7. **Profiling diagnostics remain outside the final-result contract.** They stay in the stage-04
   temp dump.
8. **Communication data will not be embedded in research-result JSON.**

### 23.3 Final aggregate database state

| Measure | Value |
| --- | --- |
| Research records | 42 |
| COMPLETED | 37 |
| Records containing company profiles | 4 |
| Company profiles | 223 |
| Offers | 449 |
| Historical completed researches without persisted company profiles | 33 |

33 = 37 completed − 4 with profiles. Those rows keep their historical envelopes; each would need its
own surviving artifact and authorization to recover.

### 23.4 Verification history is preserved

The initial failed proof remains visible (§17.1 and Appendix B). The passing proof is §17.2 and
Appendix C. The controlled recovery is §22. The removed recovery tool's mutation path is Appendix D.
No earlier evidence was rewritten.

### 23.5 Remaining limitations

- Stage 01/02/03 results are not yet exposed through HTTP.
- Historical result formats vary (seven historical shapes plus the versioned one).
- A complete new paid research execution was not performed as part of this task, so the corrected
  normal path is verified by production-path tests with mocked stages, not by a live run.
- Historical recovery was a controlled one-off operation, not a repeatable feature.
- Contact persons are not captured by the current research implementation.
- The temporary recovery tool was removed; its mutation path and verification evidence remain
  documented.

## Appendix A — production source for architect review

### A.1 `apps/api/src/modules/research/final-result.ts` (new, complete)

```ts
import { createHash } from 'node:crypto';

import type { CompanyProfile } from './stages/04-company-profiling/company-profiling.types.js';
import type { ProfilingBatchSummary } from './stages/04-company-profiling/company-profiling.batch.js';

/**
 * Versioned contract for the persisted final result of a completed full research.
 *
 * One construction function serves both completion paths so they cannot drift:
 * `ResearchService.runResearch` and `ResearchService.runResume` pass the stage-04
 * result they already hold to `buildFinalResearchResult`, then persist it together
 * with the COMPLETED state in a single token-guarded write.
 *
 * Historical rows keep their own older envelopes. Readers must discriminate by
 * key presence and must not require `schemaVersion` for them.
 */
export const FINAL_RESULT_SCHEMA_VERSION = 1;
export const FINAL_RESULT_COMPLETED_THROUGH = '04-company-profiling';

/**
 * The complete real stage-04 output of the run, unchanged.
 *
 * `companies` is the stage-04 `CompanyProfile[]` exactly as produced: company
 * identity and legal data, contacts, offers, prices, market evidence, source URLs,
 * dynamic trait keys and every existing optional/nullable/nested field. Nothing is
 * filtered, deduplicated, reclassified or regenerated.
 *
 * `summary` is the stage-04 batch summary (per-run counts). `resultsPerQuery` is
 * the run's configured query depth, available on the normal path only.
 */
export type FinalResearchResult = {
  schemaVersion: typeof FINAL_RESULT_SCHEMA_VERSION;
  completedThrough: typeof FINAL_RESULT_COMPLETED_THROUGH;
  companies: CompanyProfile[];
  summary?: ProfilingBatchSummary;
  resultsPerQuery?: number;
};

/** The part of the stage-04 result the final-result contract consumes. */
export type FinalResultSource = {
  domains: CompanyProfile[];
  summary?: ProfilingBatchSummary | null;
};

/**
 * Builds the persisted final result from the stage-04 output that the completion
 * path already holds.
 *
 * A missing profile list is a hard error, not an empty success: a run may complete
 * with zero companies (the stage genuinely found none), but it may never be marked
 * completed through stage 04 without the stage-04 result. Optional metadata is added
 * only when it is genuinely available; no field is invented.
 */
export function buildFinalResearchResult(input: {
  profiling: FinalResultSource | null | undefined;
  resultsPerQuery?: number | null;
}): FinalResearchResult {
  const profiling = input.profiling;

  if (!profiling || !Array.isArray(profiling.domains)) {
    throw new Error(
      'Final research result requires the stage-04 company profile list; refusing to persist a completed research without it.',
    );
  }

  const result: FinalResearchResult = {
    schemaVersion: FINAL_RESULT_SCHEMA_VERSION,
    completedThrough: FINAL_RESULT_COMPLETED_THROUGH,
    companies: profiling.domains,
  };

  const summary = profiling.summary;
  if (summary !== null && summary !== undefined && typeof summary === 'object' && !Array.isArray(summary)) {
    result.summary = summary;
  }

  if (
    typeof input.resultsPerQuery === 'number' &&
    Number.isFinite(input.resultsPerQuery)
  ) {
    result.resultsPerQuery = input.resultsPerQuery;
  }

  return result;
}

/** Read-only description of one candidate historical research row. */
export type RecoveryTarget = {
  jobId: string;
  status: string;
  /** The persisted `researches.result` value as stored, untouched. */
  result: unknown;
  /** Number of domains in the row's persisted stage-03 result, or null if absent. */
  stage03DomainCount: number | null;
};

/** Read-only description of the historical stage-04 artifact to recover. */
export type RecoveryArtifact = {
  /** SHA-256 of the artifact file, as read from disk. */
  sha256: string;
  /** The artifact's stage-04 profile list. */
  domains: CompanyProfile[];
  summary?: ProfilingBatchSummary | null;
};

export type HistoricalRecoveryPlan = {
  jobId: string;
  artifactSha256: string;
  finalResult: FinalResearchResult;
};

/** Recursively sorted JSON, so two structurally equal values always serialize identically. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

/**
 * Fingerprint of the exact pre-recovery target state that the owner approves before
 * execution. It binds the job id, status, persisted result and stage-03 domain count, so
 * a later change to any of them invalidates the approval.
 */
export function targetRecoveryFingerprint(target: RecoveryTarget): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        jobId: target.jobId,
        status: target.status,
        result: target.result,
        stage03DomainCount: target.stage03DomainCount,
      }),
    )
    .digest('hex');
}

/**
 * Guard layer of the prepared historical recovery procedure (SDR-006A §9–§19).
 *
 * Pure: it performs no I/O and never touches the database. It either returns the exact
 * final result that a separately authorized one-row compare-and-set would write, or it
 * throws. Every refusal is a reason the recovery must not proceed:
 *
 * - the row is not the confirmed target;
 * - the row is not a completed research;
 * - the artifact is not the archived file that was fingerprinted;
 * - the artifact is empty or its profile count is not the confirmed count;
 * - the row's result is not an object;
 * - the row already carries a `companies` field — non-empty profiles, or a legitimate
 *   empty array, which is a valid completion and is never treated as missing data;
 * - the row's result is not structurally identical (canonical JSON) to the verified
 *   pre-recovery result, so a changed or already recovered record is refused;
 * - the row's completion label is not the historical stage-04 completion;
 * - the artifact and the row disagree on the domain set size (correlation failure);
 * - the target fingerprint does not match the approved baseline.
 */
export function prepareHistoricalResultRecovery(input: {
  expectedJobId: string;
  expectedOriginalResult: unknown;
  expectedTargetFingerprint: string;
  expectedArtifactSha256: string;
  expectedCompanyCount: number;
  target: RecoveryTarget;
  artifact: RecoveryArtifact;
}): HistoricalRecoveryPlan {
  const { target, artifact } = input;

  if (target.jobId !== input.expectedJobId) {
    throw new Error('Recovery refused: target job id does not match the confirmed research');
  }

  if (target.status !== 'COMPLETED') {
    throw new Error('Recovery refused: target research is not COMPLETED');
  }

  if (artifact.sha256 !== input.expectedArtifactSha256) {
    throw new Error('Recovery refused: artifact fingerprint does not match the archived file');
  }

  if (!Array.isArray(artifact.domains) || artifact.domains.length === 0) {
    throw new Error('Recovery refused: artifact contains no company profiles');
  }

  if (artifact.domains.length !== input.expectedCompanyCount) {
    throw new Error('Recovery refused: artifact profile count does not match the confirmed count');
  }

  const existing =
    target.result !== null && typeof target.result === 'object' && !Array.isArray(target.result)
      ? (target.result as Record<string, unknown>)
      : null;

  if (existing === null) {
    throw new Error('Recovery refused: target research has no persisted result object');
  }

  if (Object.prototype.hasOwnProperty.call(existing, 'companies')) {
    const companies = existing.companies;
    if (Array.isArray(companies) && companies.length === 0) {
      throw new Error(
        'Recovery refused: target already contains an empty companies array, which is a valid completed result and must not be rewritten',
      );
    }
    throw new Error('Recovery refused: target research already contains company profiles');
  }

  if (canonicalJson(existing) !== canonicalJson(input.expectedOriginalResult)) {
    throw new Error(
      'Recovery refused: target result does not match the verified pre-recovery result',
    );
  }

  if (existing.completedThrough !== FINAL_RESULT_COMPLETED_THROUGH) {
    throw new Error(
      'Recovery refused: target result envelope is not the historical stage-04 completion',
    );
  }

  if (target.stage03DomainCount !== artifact.domains.length) {
    throw new Error(
      'Recovery refused: target stage-03 domain count does not match the artifact profile count',
    );
  }

  if (targetRecoveryFingerprint(target) !== input.expectedTargetFingerprint) {
    throw new Error('Recovery refused: target fingerprint does not match the approved baseline');
  }

  const finalResult = buildFinalResearchResult({
    profiling: { domains: artifact.domains, summary: artifact.summary ?? null },
    resultsPerQuery:
      typeof existing.resultsPerQuery === 'number' ? existing.resultsPerQuery : undefined,
  });

  return {
    jobId: target.jobId,
    artifactSha256: artifact.sha256,
    finalResult,
  };
}
```

### A.2 `apps/api/src/modules/research/research.service.ts` (diff)

```diff
diff --git a/apps/api/src/modules/research/research.service.ts b/apps/api/src/modules/research/research.service.ts
index c4c59dc..d178a62 100644
--- a/apps/api/src/modules/research/research.service.ts
+++ b/apps/api/src/modules/research/research.service.ts
@@ -21,6 +21,10 @@ import { PageAssessmentService } from './stages/03-page-assessment/page-assessme
 import { PAGE_ASSESSMENT_PROMPT_VERSION } from './stages/03-page-assessment/page-assessment.prompt.js';
 import { languageByCountry } from './lib/utils.js';
 import { CompanyProfilingService } from './stages/04-company-profiling/company-profiling.service.js';
+import {
+  buildFinalResearchResult,
+  type FinalResearchResult,
+} from './final-result.js';
 import { PageForAssessment } from './types.js';
 import { IdentifiedProduct } from './stages/01-product-identification/product-identification.schema.js';
 
@@ -275,25 +279,11 @@ export class ResearchService implements OnModuleInit {
         updateStage,
       );
 
-      const completed = await this.prismaService.research.updateMany({
-        where: { id: jobId, executionToken },
-        data: {
-          status: 'COMPLETED',
-          stage: null,
-          executionToken: null,
-          executionLeaseUntil: null,
-          result: asJson({
-            completedThrough: '04-company-profiling',
-            resultsPerQuery,
-          }),
-        },
-      });
-
-      if (completed.count !== 1) {
-        throw new Error(
-          `Execution lease lost for job ${jobId}; this process must stop.`,
-        );
-      }
+      await this.completeResearch(
+        jobId,
+        executionToken,
+        buildFinalResearchResult({ profiling: profiledCompanies, resultsPerQuery }),
+      );
     } catch (error) {
       await this.prismaService.research.updateMany({
         where: { id: jobId, executionToken },
@@ -308,6 +298,38 @@ export class ResearchService implements OnModuleInit {
     }
   }
 
+  /**
+   * Persists the final result and the COMPLETED state in one write.
+   *
+   * The conditional `executionToken` filter is the ownership safeguard: a stale or
+   * superseded executor matches no row, writes nothing and throws, so it can never
+   * overwrite another execution's result. Because the result and the status are set
+   * by the same statement, a failure leaves the row running (and then FAILED from the
+   * caller's catch) rather than falsely completed.
+   */
+  private async completeResearch(
+    jobId: string,
+    executionToken: string,
+    result: FinalResearchResult,
+  ): Promise<void> {
+    const completed = await this.prismaService.research.updateMany({
+      where: { id: jobId, executionToken },
+      data: {
+        status: 'COMPLETED',
+        stage: null,
+        executionToken: null,
+        executionLeaseUntil: null,
+        result: asJson(result),
+      },
+    });
+
+    if (completed.count !== 1) {
+      throw new Error(
+        `Execution lease lost for job ${jobId}; this process must stop.`,
+      );
+    }
+  }
+
   /**
    * Resumes a stopped stage 03 without re-running 01/02 or regenerating criteria.
    *
@@ -466,25 +488,11 @@ export class ResearchService implements OnModuleInit {
         updateStage,
       );
 
-      const completed = await this.prismaService.research.updateMany({
-        where: { id: jobId, executionToken },
-        data: {
-          status: 'COMPLETED',
-          stage: null,
-          executionToken: null,
-          executionLeaseUntil: null,
-          result: asJson({
-            completedThrough: '04-company-profiling',
-            companies: profiledCompanies.domains,
-          }),
-        },
-      });
-
-      if (completed.count !== 1) {
-        throw new Error(
-          `Execution lease lost for job ${jobId}; this process must stop.`,
-        );
-      }
+      await this.completeResearch(
+        jobId,
+        executionToken,
+        buildFinalResearchResult({ profiling: profiledCompanies }),
+      );
     } catch (error) {
       await this.prismaService.research.updateMany({
         where: { id: jobId, executionToken },
```

### A.3 Corrected existing regression-test expectations (excerpt)

`apps/api/test/research.result.test.ts` was rewritten because its harness targeted a pipeline shape
that no longer exists (empty stage stubs, an unconditional `update` for completion, and a temp file
absent from the tree). Every data assertion and count is preserved; only the two expectations that
describe the previously defective final-result envelope changed, and the data source became
deterministic synthetic input. The relevant expectation changes:

```diff
-    expect(result.completedThrough).toBe('04-company-discovery');
+    expect(result.completedThrough).toBe('04-company-profiling');
```

```diff
-    expect(harness.researchUpdate).toHaveBeenCalledWith(
+    expect(harness.researchCompletion).toHaveBeenCalledWith(
       expect.objectContaining({
-        where: { id: 'job-1' },
+        where: expect.objectContaining({ id: 'job-1' }),
         data: expect.objectContaining({
           status: 'COMPLETED',
           result: expect.objectContaining({
             companies: saved.domains,
           }),
         }),
       }),
     );
```

Unchanged assertions (preserved verbatim): `started` equals `{ jobId: 'job-1', status: 'QUEUED' }`;
`profile` called once; `result.resultsPerQuery === 5`; `result.companies` equals `saved.domains` and
has length 25; 78 offers; statuses `{ profiled: 3, needs_review: 22 }`; exactly 4 companies with a
`target` offer; the named company is `needs_review` with 2 offers, both `target`; exactly one
COMPLETED write; the legacy row is returned unchanged.

Data-source change: `loadSavedResult()` (which read
`src/modules/research/temp/04-profiling-result-dailylen-2026-11-23-23-21-53.json`) was replaced by a
local deterministic generator producing exactly the same aggregate shape — 25 synthetic profiles,
78 synthetic offers, the same status distribution and the same named-company properties. No real
research payload is read.

## Appendix B — proof output

Exact output of the single proof run, copied verbatim. Exit code `1`.

```text
✔ Generated Prisma Client (7.10.1) to .\src\generated\prisma in 217ms

 RUN  v5.1.0 C:/Users/msmig/Projektai/sdr-assistant/apps/api

 ❯ test/research-final-result-persistence.test.ts (18 tests | 6 failed) 533ms
   ✓ final research result persistence (11)
     ✓ persists the complete stage-04 company profiles on the normal completion path 74ms
     ✓ preserves every nested profile field without reclassification or filtering 60ms
     ✓ persists the same versioned contract on the resumed completion path 56ms
     ✓ persists an empty companies array for a completed run that found no companies 66ms
     ✓ marks the run FAILED when the stage-04 output is missing instead of reporting a false completion 67ms
     ✓ keeps FAILED when writing the final result fails 65ms
     ✓ never overwrites another execution result when the lease was lost 63ms
     ✓ keeps the existing failure semantics when a stage throws 57ms
     ✓ keeps resume rejection semantics for a run without stage-01/stage-02 state 4ms
     ✓ serves historical unversioned results unchanged 1ms
     ✓ returns every persisted company profile through the API without truncation 1ms
   ❯ prepared historical recovery guards (7)
     ✓ produces the versioned result for the confirmed target and keeps its metadata 1ms
     × rejects a different research identifier 9ms
     × rejects an artifact whose fingerprint differs from the archived file 2ms
     × rejects a target that already carries company profiles 1ms
     × rejects a target whose result envelope is not the historical stage-04 completion 1ms
     × rejects a target whose stage-03 domain count disagrees with the artifact 1ms
     × rejects a non-completed target and an empty artifact 1ms

 Test Files  1 failed (1)
      Tests  6 failed | 12 passed (18)
   Start at  14:03:40
   Duration  4.25s (transform 42%, import 40%, tests 16%, worker 2%)

npm notice run @sdr-assistant/api@0.0.0 build
npm notice run prisma generate && tsc -p tsconfig.json
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma.
npm notice run @sdr-assistant/api@0.0.0 test
npm notice run vitest run test/research-final-result-persistence.test.ts

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/research-final-result-persistence.test.ts > prepared historical recovery guards > rejects a different research identifier
AssertionError: expected [Function] to throw error including 'job id does not match' but got 'prepareHistoricalRecovery is not defi…'

Expected: "job id does not match"
Received: "prepareHistoricalRecovery is not defined"

 ❯ test/research-final-result-persistence.test.ts:628:7
    626|         input({ target: { ...input().target, jobId: 'cmwvzov2a0000h0sw…
    627|       ),
    628|     ).toThrow('job id does not match');
       |       ^
    629|   });
    630|

[1/6]

 FAIL  test/research-final-result-persistence.test.ts > prepared historical recovery guards > rejects an artifact whose fingerprint differs from the archived file
AssertionError: expected [Function] to throw error including 'fingerprint does not match' but got 'prepareHistoricalRecovery is not defi…'

Expected: "fingerprint does not match"
Received: "prepareHistoricalRecovery is not defined"

 ❯ test/research-final-result-persistence.test.ts:636:7
    634|         input({ artifact: { ...input().artifact, sha256: 'ffffffff' } …
    635|       ),
    636|     ).toThrow('fingerprint does not match');
       |       ^
    637|   });

[2/6]

 FAIL  test/research-final-result-persistence.test.ts > prepared historical recovery guards > rejects a target that already carries company profiles
AssertionError: expected [Function] to throw error including 'already contains company profiles' but got 'prepareHistoricalRecovery is not defi…'

Expected: "already contains company profiles"
Received: "prepareHistoricalRecovery is not defined"

 ❯ test/research-final-result-persistence.test.ts:652:7
    650|         }),
    651|       ),
    652|     ).toThrow('already contains company profiles');
       |       ^
    653|   });

[3/6]

 FAIL  test/research-final-result-persistence.test.ts > prepared historical recovery guards > rejects a target whose result envelope is not the historical stage-04 completion
AssertionError: expected [Function] to throw error including 'not the historical stage-04 completion' but got 'prepareHistoricalRecovery is not defi…'

Expected: "not the historical stage-04 completion"
Received: "prepareHistoricalRecovery is not defined"

 ❯ test/research-final-result-persistence.test.ts:665:7
    663|         }),
    664|       ),
    665|     ).toThrow('not the historical stage-04 completion');
       |       ^
    666|   });

[4/6]

 FAIL  test/research-final-result-persistence.test.ts > prepared historical recovery guards > rejects a target whose stage-03 domain count disagrees with the artifact
AssertionError: expected [Function] to throw error including 'stage-03 domain count does not match' but got 'prepareHistoricalRecovery is not defi…'

Expected: "stage-03 domain count does not match"
Received: "prepareHistoricalRecovery is not defined"

 ❯ test/research-final-result-persistence.test.ts:673:7
    671|         input({ target: { ...input().target, stage03DomainCount: 76 } …
    672|       ),
    673|     ).toThrow('stage-03 domain count does not match');
       |       ^
    674|   });

[5/6]

 FAIL  test/research-final-result-persistence.test.ts > prepared historical recovery guards > rejects a non-completed target and an empty artifact
AssertionError: expected [Function] to throw error including 'not COMPLETED' but got 'prepareHistoricalRecovery is not defi…'

Expected: "not COMPLETED"
Received: "prepareHistoricalRecovery is not defined"

 ❯ test/research-final-result-persistence.test.ts:681:7
    679|         input({ target: { ...input().target, status: 'FAILED' } }),
    680|       ),
    681|     ).toThrow('not COMPLETED');
       |       ^
    682|   });
    683|
    684|     expect(() =>

[6/6]

npm error Lifecycle script `test` failed with error:
npm error code 1
npm error path C:\Users\msmig\Projektai\sdr-assistant\apps\api
npm error workspace @sdr-assistant/api@0.0.0
npm error location C:\Users\msmig\Projektai\sdr-assistant\apps\api
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c vitest run test/research-final-result-persistence.test.ts
Exception:
Line |
  11 |          throw 'Final research result persistence tests failed'
     |          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     | Final research result persistence tests failed
```

```text
EXIT=1
```

## Appendix C — newly approved proof output (this follow-up)

Executed once after the corrections, with no subsequent change to any production or test file.
Exit code `0`; the expected final line was printed.

```text
✔ Generated Prisma Client (7.10.1) to .\src\generated\prisma in 200ms

 RUN  v5.1.0 C:/Users/msmig/Projektai/sdr-assistant/apps/api

 ✓ test/research.result.test.ts (2 tests) 9ms
 ✓ test/research-final-result-persistence.test.ts (24 tests) 537ms

 Test Files  2 passed (2)
      Tests  26 passed (26)
   Start at  14:11:38
   Duration  1.55s (import 48%, tests 26%, transform 23%, worker 3%)

PASS: SDR-006A final result persistence and recovery guards
```

```text
EXIT=0
```

## Appendix D — temporary recovery tool (sanitized source)

The operation used one temporary tool inside the workspace, `apps/api/tmp-sdr006a-recovery.mjs` (868 lines, removed after completion). Its read-only modes (`preflight`, `proof`, `api`) produced the checks recorded in §22; the only mutation path is `recover()` below, reproduced verbatim. The tool read the artifact once, computed its SHA-256 from those bytes and parsed the same bytes, and printed no company, contact or raw profile data.

```js
async function recover() {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  const artifact = readArtifactOnce();

  if (artifact.sha256 !== EXPECTED_ARTIFACT_SHA || artifact.sha256 !== baseline.artifact.sha256) {
    throw new Error('artifact fingerprint changed since the approved baseline');
  }
  if (baseline.domainCorrelation.exactMatch !== true) {
    throw new Error('approved baseline does not record an exact domain-set correlation');
  }

  const client = await connect();
  const q = (sql, params) => client.query(sql, params).then((r) => r.rows);
  let committed = false;

  try {
    await client.query('BEGIN');

    // 1. Lock the target research row and its stage-03 row.
    const locked = (
      await client.query(
        `select id, "productId", country, status::text as status, stage, error, result,
                result::text as result_text,
                "createdAt"::text as created_at, "updatedAt"::text as updated_at,
                "lastHeartbeatAt"::text as heartbeat,
                "executionToken" as execution_token,
                "executionLeaseUntil"::text as execution_lease_until
           from researches where id = $1 for update`,
        [TARGET],
      )
    ).rows[0];
    const lockedStage = (
      await client.query(
        `select "jobId" from research_stage_03_results where "jobId" = $1 for update`,
        [TARGET],
      )
    ).rows[0];

    if (!locked) throw new Error('target row disappeared');
    if (!lockedStage) throw new Error('target stage-03 row disappeared');

    // 2. Re-read and verify against the approved baseline.
    if (locked.status !== 'COMPLETED') throw new Error('target is not COMPLETED');
    if (canonicalJson(locked.result) !== canonicalJson(EXPECTED_ORIGINAL_RESULT)) {
      throw new Error('target result is not the approved original result');
    }
    if (Object.prototype.hasOwnProperty.call(locked.result, 'companies')) {
      throw new Error('target already carries a companies key');
    }
    if (locked.created_at !== baseline.target.createdAt || locked.updated_at !== baseline.target.updatedAt) {
      throw new Error('target timestamps changed since the approved baseline');
    }
    if (locked.execution_token !== null || locked.execution_lease_until !== null) {
      throw new Error('target carries an execution token or lease');
    }

    // 3. Recompute the stage-03 domain set and require exact correlation.
    const dbDomains = await stage03Domains(q);
    const exact =
      dbDomains.length === artifact.sortedDomains.length &&
      dbDomains.every((domain, index) => domain === artifact.sortedDomains[index]);
    if (!exact) throw new Error('stage-03 domain set no longer matches the artifact');
    const dbSetSha = sha256(dbDomains.join('\n'));
    if (dbSetSha !== artifact.domainSetSha256) {
      throw new Error('stage-03 domain set fingerprint mismatch');
    }
    if (dbSetSha !== baseline.target.stage03DomainSetSha256) {
      throw new Error('stage-03 domain set changed since the approved baseline');
    }

    // 4. Build the plan with the tested, compiled guard function.
    const targetSnapshotInput = {
      jobId: locked.id,
      status: locked.status,
      result: locked.result,
      stage03DomainCount: dbDomains.length,
    };
    const plan = prepareHistoricalResultRecovery({
      expectedJobId: baseline.target.jobId,
      expectedOriginalResult: EXPECTED_ORIGINAL_RESULT,
      expectedTargetFingerprint: baseline.target.approvalFingerprint,
      expectedArtifactSha256: EXPECTED_ARTIFACT_SHA,
      expectedCompanyCount: EXPECTED_PROFILES,
      target: targetSnapshotInput,
      artifact: {
        sha256: artifact.sha256,
        domains: artifact.parsed.domains,
        summary: artifact.parsed.summary ?? null,
      },
    });

    // 5. Confirm the plan carries the artifact payload unchanged.
    const planCompanies = plan.finalResult.companies;
    const planOffers = planCompanies.reduce((n, profile) => n + profile.offers.length, 0);
    if (planCompanies.length !== EXPECTED_PROFILES) throw new Error('plan profile count');
    if (planOffers !== EXPECTED_OFFERS) throw new Error('plan offer count');
    if (canonicalJson(planCompanies) !== canonicalJson(artifact.parsed.domains)) {
      throw new Error('plan profiles are not structurally identical to the artifact');
    }
    if (plan.finalResult.schemaVersion !== 1) throw new Error('plan schemaVersion');
    if (plan.finalResult.completedThrough !== '04-company-profiling') throw new Error('plan label');
    if (plan.finalResult.resultsPerQuery !== 40) throw new Error('plan resultsPerQuery');

    // 6. One parameterized compare-and-set UPDATE.
    const updated = await client.query(
      `UPDATE researches
          SET result = $3::jsonb
        WHERE id = $1
          AND status = 'COMPLETED'
          AND result = $2::jsonb
          AND result->>'completedThrough' = '04-company-profiling'
          AND NOT (result ? 'companies')
        RETURNING id, status, "createdAt", "updatedAt"`,
      [TARGET, JSON.stringify(EXPECTED_ORIGINAL_RESULT), JSON.stringify(plan.finalResult)],
    );

    if (updated.rowCount !== 1) {
      throw new Error(`guarded UPDATE affected ${updated.rowCount} rows`);
    }

    // Pre-commit verification.
    const after = (await q(`select result from researches where id = $1`, [TARGET]))[0].result;
    const afterOffers = after.companies.reduce((n, profile) => n + profile.offers.length, 0);
    if (canonicalJson(after.companies) !== canonicalJson(artifact.parsed.domains)) {
      throw new Error('persisted profiles are not structurally identical to the artifact');
    }
    if (after.companies.length !== EXPECTED_PROFILES || afterOffers !== EXPECTED_OFFERS) {
      throw new Error('persisted counts do not match');
    }
    if (after.schemaVersion !== 1 || after.completedThrough !== '04-company-profiling' ||
        after.resultsPerQuery !== 40) {
      throw new Error('persisted contract fields do not match');
    }
    if (canonicalJson(after.summary) !== canonicalJson(artifact.parsed.summary)) {
      throw new Error('persisted summary is not the artifact summary');
    }
    if (Object.prototype.hasOwnProperty.call(after, 'diagnostics')) {
      throw new Error('diagnostics must not be persisted');
    }

    const targetAfter = await targetSnapshot(q);
    const nonResultFields = [
      targetAfter.id, targetAfter.productId, targetAfter.country, targetAfter.status,
      targetAfter.stage, targetAfter.error, targetAfter.created_at, targetAfter.updated_at,
      targetAfter.heartbeat, targetAfter.execution_token, targetAfter.execution_lease_until,
    ];
    const nonResultBefore = [
      locked.id, locked.productId, locked.country, locked.status, locked.stage, locked.error,
      locked.created_at, locked.updated_at, locked.heartbeat, locked.execution_token,
      locked.execution_lease_until,
    ];
    if (JSON.stringify(nonResultFields) !== JSON.stringify(nonResultBefore)) {
      throw new Error('non-result target fields changed');
    }

    const countsAfter = await aggregateCounts(q);
    if (countsAfter.researches !== EXPECTED.researches || countsAfter.completed !== EXPECTED.completed) {
      throw new Error('research aggregates changed');
    }
    if (countsAfter.with_companies !== EXPECTED.withCompaniesAfter ||
        countsAfter.profiles !== EXPECTED.profilesAfter || countsAfter.offers !== EXPECTED.offersAfter) {
      throw new Error('company-profile aggregates do not match the expected post-recovery values');
    }

    const otherRows = await researchesFingerprint(q, true);
    if (otherRows.fp !== baseline.otherRows.fp) throw new Error('non-target research rows changed');

    const stages = await stageFingerprints(q);
    if (JSON.stringify(stages) !== JSON.stringify(baseline.stages)) {
      throw new Error('stage records changed');
    }

    if ((await schemaFingerprint(q)) !== baseline.schema) throw new Error('schema metadata changed');
    if (JSON.stringify(await settingsFingerprint(q)) !== JSON.stringify(baseline.settings)) {
      throw new Error('settings changed');
    }
    if (JSON.stringify(await emailFingerprint(q)) !== JSON.stringify(baseline.emails)) {
      throw new Error('email accounts changed');
    }

    await client.query('COMMIT');
    committed = true;

    console.log('SDR-006A recovery transaction');
    console.log(`rows affected          : ${updated.rowCount}`);
    console.log(`target                 : ${TARGET}`);
    console.log(`profiles / offers      : ${after.companies.length} / ${afterOffers}`);
    console.log(`contract               : schemaVersion=${after.schemaVersion} completedThrough=${after.completedThrough} resultsPerQuery=${after.resultsPerQuery}`);
    console.log(`summary persisted      : ${after.summary !== undefined}`);
    console.log(`aggregates after       : ${JSON.stringify(countsAfter)}`);
    console.log(`non-target rows        : ${otherRows.n} unchanged (${otherRows.fp})`);
    console.log('COMMITTED: exactly one research result recovered');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* transaction already aborted */
    }
    console.error(`ROLLBACK: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }

  if (!committed) {
    console.error('Recovery NOT committed.');
  }
}
```
