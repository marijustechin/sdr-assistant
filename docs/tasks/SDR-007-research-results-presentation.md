# SDR-007 — Research Results Presentation

## 1. Task ID and status

- **Task ID:** SDR-007
- **Title:** Research Results Presentation
- **Status:** `DONE` — accepted by the human owner on 2026-11-26 (§16.1). The accepted deliverable
  covers the initial typed workspace, the locator correction and the Market/final-UX extension.
  All previous verification attempts and evidence remain preserved in §11–§15.
- **Registry:** [README.md](README.md)
- **Checkpoint at start:** `63798e22bd4e9d0f37e83eb9db3ae712b3955b16`
  (`fix: persist complete research results and recover historical profiles`), confirmed with
  `git rev-parse HEAD`.
- **Execution mode:** standard `workspace-write`. No privilege escalation.
- **Implementation freeze:** Research Implementation Freeze fully active. No research backend,
  prompt, provider, model, schema, migration, algorithm or database change is authorized.

## 2. Objective

Replace the raw JSON research-result presentation with a practical, typed research workspace.
Users must be able to browse researches, inspect discovered companies, review offers and prices,
inspect available contacts, and follow evidence source links. Communication actions are not part
of this task; the future Communication location may only be reserved without a non-functional
control. The existing English interface, visual design conventions, light/dark themes and desktop
and mobile usability must be preserved.

## 3. Preconditions confirmed

- SDR-001 through SDR-006A and ENV-003 are `DONE`.
- Accepted checkpoint `63798e22bd4e9d0f37e83eb9db3ae712b3955b16` is the current `HEAD`.
- The PostgreSQL inventory at task start is the accepted SDR-006A state: 42 researches,
  37 completed, 4 researches with persisted company profiles, 223 company profiles, 449 offers
  and 33 historical completed researches without persisted profiles.
- The 18 excluded untracked artifacts were hashed before implementation (§10) and must remain
  byte-identical.
- `GET /research` and `GET /research/:jobId` both return the complete Prisma research row, so the
  research list already contains `result`; company and offer counts can be derived from the list
  payload without an N+1 detail-fetch pattern.

## 4. Data-source constraints

- The only runtime data source is the existing PostgreSQL-backed research API
  (`GET /research`, `GET /research/:jobId`) plus the existing product endpoints used for names.
- Temporary JSON output files, historical artifacts and local fixtures are never consumed at
  runtime.
- No research backend, API contract, database schema, migration or persisted row is changed.
- Intermediate-stage result API exposure is deferred: stage 01/02/03 tables are not exposed and
  the task does not add endpoints.
- No essential presentation-required fact is invented when the API does not provide it;
  limitations are recorded in §12.

## 5. Authorized scope and paths

Frontend files under `apps/web` strictly necessary for research list presentation, typed research
result parsing and research detail presentation; relevant web unit tests; relevant Playwright
tests and extensions to the existing mock API; and the two documentation files listed below.

Planned path scope (final exact scope is recorded in §14 after implementation):

- `apps/web/entities/research/model/result.ts` (new typed result compatibility layer)
- `apps/web/entities/research/model/result.test.ts` (new)
- `apps/web/entities/research/model/schema.ts` (comment/typing alignment only)
- `apps/web/entities/research/index.ts`, `apps/web/entities/research/client.ts` (exports)
- `apps/web/shared/lib/url.ts`, `apps/web/shared/lib/url.test.ts` (new validated HTTP(S) helper)
- `apps/web/_pages/researches/ui/researches-page.tsx` (list route composition)
- `apps/web/_pages/researches/ui/researches-explorer.tsx` (new list search/filter/sort)
- `apps/web/_pages/researches/model/research-list.ts`, `.test.ts` (new pure list logic)
- `apps/web/_pages/research/ui/research-page.tsx` (detail route composition)
- `apps/web/features/track-research/ui/*` (new workspace, overview, companies, company detail,
  contacts, tabs, safe source link; old raw result view removed)
- `apps/web/features/track-research/model/*` (new pure company/contact browsing and presentation
  helpers, plus tests)
- `apps/web/features/track-research/index.ts` (public exports)
- `apps/web/app/globals.css` (research workspace component classes only, tokens only)
- `apps/web/e2e/mock-api.mjs` (synthetic research result fixtures and resume endpoint)
- `apps/web/e2e/research-results.spec.ts` (new rendered-behaviour coverage; desktop and mobile)
- `docs/tasks/SDR-007-research-results-presentation.md` (this record)
- `docs/tasks/README.md` (task registration)

## 6. Explicit exclusions

No research implementation, prompt, provider, model, stage orchestration, classification,
algorithm, API endpoint, database schema, migration, seed, persisted row or `.env` change. No
research execution, no paid provider call, no historical data import or deletion, no email
account assignment, no communication functionality, no SMTP/IMAP connection, no dependency
change, no environment or service change, no unrelated refactoring, no changes under
`apps/api/src/modules/research`, no changes to the 18 excluded artifacts, no privilege escalation,
no staging, commit or push, and no SDR-008 work.

## 7. Acceptance criteria

1. The research list shows product name, target country, research date, execution status, result
   availability and company/offer counts when available, with search, filtering by product,
   country, status and result availability, and useful sorting with newest first by default.
   Existing new-research, detail and resume behaviour is preserved and unavailable counts are
   never shown as zero.
2. The research detail route shows a structured header, four summary metrics derived from the
   displayed data, and Overview, Companies and Contacts sections, with the future Communication
   location reserved without a non-functional action control.
3. The typed compatibility layer distinguishes: company profiles available; a valid empty
   `companies` array; a historical completed result without company profiles; a research not
   completed; and unsupported or malformed result data. It supports `schemaVersion: 1`,
   historical unversioned and partial-stage envelopes, null results, unknown formats and
   historical offer-shape variations, and it never interprets a missing profiles field as zero
   discovered companies.
4. A malformed optional field or individual company profile does not crash the page; the
   unreadable data is reported and valid siblings remain visible.
5. Overview shows genuine metadata only: product, country, status, timestamps, completion label,
   result schema version, query depth, profiling summary statistics and result availability or
   error information. No stage timing, cost, page count or other missing metric is invented, and a
   stage-04 completion label is not treated as proof that intermediate stage results were
   persisted.
6. Companies default to the primary section when profiles are available; the list supports search
   by name/domain/identity, profiling-status filtering, email/phone availability filtering,
   sorting, visible filtered and total counts and pagination. Classification values are only the
   documented source values; offer verdicts, market statuses and dynamic traits are shown
   neutrally and no semantics are invented.
7. Company details present identity, legal data, contact information, profiling status and
   metadata, offers, dynamic traits, prices/currencies, source URLs and relevance evidence when
   present. Missing prices are never shown as zero, contact persons are never fabricated, legal
   country is never inferred from the research target country, and source links use validated
   HTTP(S) URLs with plain-text content.
8. Contacts are a read-only company-associated overview with company, domain, emails and phones,
   search and contact-type filtering, preserved company relationship, and a visible distinction
   between contact-value counts and unique-contact counts. Discovered addresses are not presented
   as verified or deliverable.
9. The UI is keyboard accessible, supports light and dark themes, has usable desktop and mobile
   layouts, and provides loading, error, empty and terminal states. No raw JSON is the primary
   result presentation and no final result content is truncated at 20,000 characters. A secondary
   developer/debug view, if present, exposes no additional internal fields.
10. Synthetic-data frontend regression coverage exercises all required result formats, list and
    detail behaviour, company detail access, contact presentation, large result sets, safe source
    links, existing polling/status/resume behaviour and desktop/mobile usability. Existing
    unrelated research tests are not modified or weakened.
11. The single approved proof command in §9 is executed exactly once and its actual output and exit
    code are recorded. No research execution or paid provider call is performed.

## 8. Result compatibility model (design, confirmed against persisted data)

At the API boundary `researchResponseSchema.result` remains `z.unknown()` because the exported
API contract deliberately returns historical envelopes verbatim. The compatibility layer parses
only the fields needed for presentation and returns a typed discriminated state:

- `profiles` — a readable `companies` array with at least one readable profile. The array is the
  complete stage-04 `CompanyProfile[]`; dynamic trait keys, optional price fields and historical
  offer variations are preserved.
- `empty` — a present, valid `companies: []`, a genuine completed result with zero companies.
- `historical` — a completed result with a recognizable envelope (`completedThrough`, optional
  legacy metadata, or a legacy string note) but no `companies` field. Displayed as "profiles were
  not persisted", never as zero companies.
- `not-completed` — `QUEUED`, `RUNNING`, `FAILED` or `INTERRUPTED`. No final result is presented;
  status, stage, error, polling and resume behaviour remain the source of truth.
- `unsupported` — a completed result whose data cannot be interpreted: null result, unknown
  object shape, unsupported `schemaVersion`, non-array `companies`, or a profiles array with no
  readable profile. The reason is reported accurately.

Individual profiles and offers are parsed with per-entry `safeParse`; unreadable entries are
counted and reported. `schemaVersion: 1` requires `companies`; absent `schemaVersion` is treated
as a historical envelope. Offer `marketFrom03` accepts the documented object and legacy string
representations. Prices are optional per offer; a zero amount is rendered as recorded, an absent
price list as "No published price".

## 9. Single approved proof

The existing root scripts are named as expected (`verify:web`, `e2e:web`). The single proof is:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run verify:web
    if ($LASTEXITCODE -ne 0) {
        throw 'Frontend verification failed'
    }

    npm.cmd run e2e:web
    if ($LASTEXITCODE -ne 0) {
        throw 'Frontend E2E verification failed'
    }

    Write-Output 'PASS: SDR-007 research results presentation'
}
```

The proof uses only controlled synthetic/mock data. No real research execution or paid API call is
performed. If Playwright encounters the documented sandbox process-spawn restriction, the result
is recorded and the proof is not escalated, rerun or substituted.

## 10. Excluded-artifact baseline (before implementation)

18 untracked artifacts confirmed with `git status --porcelain=v1 -uall`. SHA-256 baseline:

| Artifact | SHA-256 |
| --- | --- |
| `apps/api/src/modules/research/stages/04-company-profiling/SPEC.md` | `BBB2DDF7CF3AA24D9A2BDB27DE51DA02544787FA4FE84302898481C57912D157` |
| `apps/api/test/company-profiling.batch.test.ts` | `6E2DD698CA42FD2C2329BEBA8D8291FC12EFFBDE12DD27DDF1A3E59C6B75A8C4` |
| `apps/api/test/company-profiling.first-call.test.ts` | `4B128B815FB2827F4F83D220CE130C0975086CC48C2AAA9EA84FD69987FD19D6` |
| `apps/api/test/company-profiling.gap-fill.test.ts` | `5921E3266040AB593717E2A94B6876F017FE2DA192840BB5D6F8753DAA19ED0E` |
| `apps/api/test/company-profiling.input.test.ts` | `7C972C6EB1D1CDEF15524E282D43F4AE03FC929D2D9D61189A00143B937C356F` |
| `apps/api/test/company-profiling.profile.test.ts` | `0F9A34FEC2ACBFEE62D18D7CFA54DB865B7C340A4CEB2C62905B3033C92752E6` |
| `apps/api/test/fixtures/v5-16-domains.json` | `CF1003E55E17E521BA0551C18725AAFE6E9162FD41CB5F0F3690E68BFB23BA7E` |
| `apps/api/test/research.04.integration.test.ts` | `3420CB66026DA01C326C7C82E8401A06ADFD1BD8D4E52F68C44CED835EE589F2` |
| `apps/api/tmp-04-real-result.json` | `B1C1F76C4AB18925D7FD69F9617B22248D6B53DAC0ABCF11364B01D661432568` |
| `apps/api/tmp-run-real-04.mjs` | `1514CD42508F7A539EF32B6F638CB666DEE82073061DC4F66853AA18CFDAA8B1` |
| `pnpm-lock.yaml` | `0B399756D0E971CF42CDBC16138228A870713FDE65E85AC8597354C6B34A7455` |
| `pnpm-workspace.yaml` | `78F085945C4E7A2220AA6389114B25F91CCA9CA464954EE8F0705B9A466BE05B` |
| `src/.../companies-2026-11-15-14-01-13.json` | `6F51C24844AE7ACEEEA526901AFBE375B92F8629C07853F41AA4DE9C2156E832` |
| `src/.../companies-2026-11-15-14-01-24.json` | `6E0D7E0334F95841B34A6870534D3FD00B61873AB22DEA56431A55CFC694B8EE` |
| `src/.../companies-2026-11-15-14-15-12.json` | `B81A0EA47429D28A5E03F4051F41AF0504D2B37A7CA86268A30B5933D9F505DF` |
| `src/.../companies-2026-11-15-14-25-14.json` | `DF871261BFEA33F61AE0CBB279B4D8D35E54D7B09BC43EF9EDA39E9E6FABCFF6` |
| `src/.../companies-2026-11-15-14-25-43.json` | `0B7C46AA5D3AC861BB6DDE90BB724220A871735F0ED53F4200757E4159EFF15C` |
| `src/.../companies-2026-11-15-14-46-33.json` | `798B3A2E3F55C4CA3B2BAFD4873925E31B001293C49C81B52119376A612ABFAA` |

## 11. Verification result

**Original proof attempt (preserved): blocked on the mandatory Playwright gate.** The original
approved compound proof was executed once. Its `verify:web` portion passed and its `e2e:web`
portion was blocked by the documented sandbox process-spawn restriction. The owner subsequently
authorized one Full Access continuation; that run executed and is recorded separately in §11.1,
and the final locator correction and passing proof are in §11.2. The original evidence below is
preserved unchanged.

Actual result:

- `npm.cmd run verify:web` — **PASS**. `next typegen`/`tsc --noEmit` passed, ESLint passed with
  `--max-warnings=0`, Vitest passed **138/138 tests in 18 files**, and Prettier
  `format:check` reported `All matched files use Prettier code style!`.
- `npm.cmd run e2e:web` — **FAILED before any test ran** with the documented sandbox
  process-spawn restriction:

```text
npm notice run sdr-assistant@0.0.0 e2e:web
npm notice run npm run e2e --workspace @sdr-assistant/web
npm notice run @sdr-assistant/web@0.0.0 e2e
npm notice run playwright test
npm error Lifecycle script `e2e` failed with error:
npm error code 1
npm error path C:\Users\msmig\Projektai\sdr-assistant\apps\web
npm error workspace @sdr-assistant/web@0.0.0
npm error location C:\Users\msmig\Projektai\sdr-assistant\apps\web
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c playwright test
Error: spawn EPERM
Exception:
Line |
  11 |          throw 'Frontend E2E verification failed'
     |          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     | Frontend E2E verification failed
[exit code: 1]
```

Per §9 and the task instructions, this EPERM result is recorded as-is. No privilege escalation,
environment change, rerun or weaker substitute was attempted, and no test assertion ran. The new
Playwright scenarios therefore remain **unverified**; the rest of the frontend verification is
green.

### 11.1 Owner-authorized Full Access Playwright continuation (2026-11-26)

The owner explicitly authorized one Full Access execution of the mandatory Playwright verification
to overcome the documented process-spawn restriction, with no implementation, test, mock API or
Playwright configuration change. The command was executed once:

```powershell
npm.cmd run e2e:web
```

Result: **34 passed, 1 failed, 0 skipped, 1.4m (Playwright-reported), exit code 1.** All 35
scenarios executed; no retries are configured for this non-CI run.

| Suite | Executed | Passed | Failed |
| --- | ---: | ---: | ---: |
| `app.spec.ts` (preserved) | 11 | 10 | 1 |
| `email-accounts.spec.ts` (preserved) | 17 | 17 | 0 |
| `research-results.spec.ts` (new SDR-007) | 7 | 7 | 0 |
| **Total** | **35** | **34** | **1** |

The seven new SDR-007 scenarios all passed:

1. `lists researches with status, result availability and honest counts`
2. `searches, filters and sorts the research list locally`
3. `presents the versioned company workspace, offers, prices and contacts`
4. `distinguishes empty, historical, unsupported, null and partially unreadable results`
5. `paginates a large result set and does not truncate long evidence`
6. `resumes a failed research and keeps polling`
7. `mobile layout › keeps the workspace usable on a narrow screen`

**The one failure is a preserved scenario, not one of the new SDR-007 scenarios.** Exact
assertion and error:

```text
1) [chromium] › e2e\app.spec.ts:135:1 › renders a failed run with its error and recovery

Error: expect(locator).toBeVisible() failed

Locator: getByText('Failed', { exact: true })
Expected: visible
Error: strict mode violation: getByText('Failed', { exact: true }) resolved to 2 elements:
    1) <span class="status error">…</span> aka locator('span').filter({ hasText: 'Failed' })
    2) <dd>Failed</dd> aka getByRole('tabpanel', { name: 'Overview' }).getByText('Failed', { exact: true })

> 145 |   await expect(page.getByText('Failed', { exact: true })).toBeVisible();
```

Cause, stated as a confirmed fact from the page snapshot: the new Overview "Research details"
definition list renders the execution status as `<dd>Failed</dd>`, so the preserved test's global
exact-text locator now matches two elements. The same snapshot shows the failed-run page itself is
present and correct: the status badge, `Research failed.` status, `pre.error` text, `Resume
research`, `Check again`, `Product page`, metrics marked `Not available`, and the Overview
result-availability explanation all render. This is a strict-locator ambiguity introduced by
additional legitimate UI text, not a functional failure of the failed-run state. It was **not**
fixed during the verification operation.

Available diagnostic evidence (git-ignored Playwright `test-results`):

- `apps/web/test-results/app-renders-a-failed-run-with-its-error-and-recovery-chromium/error-context.md`
  — full error, page snapshot and failing test source.
- `apps/web/test-results/app-renders-a-failed-run-with-its-error-and-recovery-chromium/trace.zip`
  — Playwright trace (804,980 bytes).
- Synthetic screenshots produced by the passing new scenarios:
  `sdr-007-research-list-desktop.png`, `sdr-007-research-companies-desktop.png` and
  `sdr-007-research-contacts-mobile.png` under `apps/web/test-results/`.

No production code, test, mock API, Playwright configuration, backend, database, dependency,
`.env` or service configuration was changed during this run; the command was not rerun; nothing
was staged, committed or pushed. The original EPERM proof above is preserved unchanged.

### 11.2 Owner-authorized locator correction and final Playwright proof (2026-11-26)

The architect accepted the §11.1 diagnosis: the Overview now legitimately renders the execution
status as `<dd>Failed</dd>` inside the tab panel, so the preserved test's global exact-text
locator was ambiguous. The owner authorized correcting only that assertion in
`apps/web/e2e/app.spec.ts`; no production UI, styling, mock API or Playwright configuration change
was permitted or made.

Exact before/after diff:

```diff
--- a/apps/web/e2e/app.spec.ts
+++ b/apps/web/e2e/app.spec.ts
@@ -142,7 +142,9 @@ test('renders a failed run with its error and recovery', async ({ page }) => {
   await expect(page.getByText('Research failed.')).toBeVisible({
     timeout: 30_000,
   });
-  await expect(page.getByText('Failed', { exact: true })).toBeVisible();
+  await expect(
+    page.locator('.research-header').getByText('Failed', { exact: true }),
+  ).toBeVisible();

   await expect(page.locator('pre.error')).toContainText(
     'Company discovery failed: upstream timeout.',
```

Why the new locator identifies the intended element:

- `.research-header` is the stable existing workspace header component that contains the
  execution status row and the `ResearchStatusBadge` (`<span class="status error">Failed</span>`).
- The only exact text `Failed` inside `.research-header` is that badge; the duplicated
  `<dd>Failed</dd>` is inside the Overview tab panel, outside the header.
- The assertion remains a visibility assertion, uses no `.first()`, `.last()`, `.nth()` or
  arbitrary wait, keeps every other assertion, and keeps the original scenario.

Single authorized command, executed once:

```powershell
npm.cmd run e2e:web
```

Result: **35 passed, 0 failed, 0 skipped, 1.3m (Playwright-reported), exit code 0.** All 35
scenarios executed (the complete suite, not only the previously failing scenario); all 28
preserved scenarios and all 7 new SDR-007 scenarios passed. `verify:web` was not rerun because no
application source or unit-test implementation changed. No scenario failed, so there was nothing
to correct or rerun. The previous EPERM and 34/35 evidence in §11 and §11.1 is preserved unchanged.



## 12. Remaining limitations

1. **Historical records without profiles.** 33 of 37 completed researches have no persisted
   `companies`; the workspace reports "Completed — profiles not persisted" and cannot display
   profiles that PostgreSQL does not hold.
2. **Intermediate stages remain unexposed.** Stage 01/02/03 rows are not available through the
   research API, so identified-product terminology, criteria, per-page decisions and page-level
   facts cannot be presented without a protected-backend change. This task deliberately adds no
   endpoint.
3. **No contact persons.** The pipeline records published emails and phones, not people; no
   contact person is presented or fabricated.
4. **Sparse prices.** Prices exist on a small minority of offers; "No published price" is a normal
   state, and an absent price is never rendered as zero.
5. **Communication is reserved only.** The "Communication" tab position is a non-interactive
   planned label; no recipient selection, account assignment, editing, sending or synchronization
   exists.
6. **Legacy/unknown result data.** Readable historical envelopes and offer variations are
   presented; a completely unknown format is reported as unavailable rather than partially
   guessed. Individual unreadable profiles/offers/prices are counted and reported.

## 13. Owner acceptance notes

Routes (with the local web app running, normally `http://127.0.0.1:3000`):

- `/researches` — browse the research list. Verify search, the Product / Country / Execution
  status / Result availability filters, and sorting (newest first by default). Rows with profiles
  show `Company profiles available` and genuine counts; historical rows show
  `Completed — profiles not persisted`; unsupported/null results show `Result unavailable`; the
  valid empty result shows `0 company profiles · 0 offers`.
- `/researches/<jobId>` — open a row. When profiles exist, Companies is the default section and
  the four metrics are derived from the displayed profiles. Use the company search, profiling
  status, email/phone availability and sort controls, open a company, and inspect identity,
  contacts, offers, dynamic traits, prices and evidence links.
- Companies section — confirm the visible filtered/total counts and pagination on a large result
  (for example the recovered 77-profile research). Confirm company detail rows omit unknown
  fields, show no fabricated contact person and never show a missing price as `0`.
- Overview section — confirm product, country, status, timestamps, completion label, schema
  version, query depth, genuine profiling summary statistics and the result-availability
  explanation. A stage-04 completion label must not be read as proof that intermediate stage rows
  exist.
- Contacts section — confirm company/domain relationship, email and phone columns, search,
  contact-type filtering, value-versus-unique counts, the not-verified notice, and the absence of
  `mailto:` or other communication actions.
- Theme and viewport — switch Light/Dark/System in the sidebar and resize to a narrow width; the
  workspace must remain usable and free of horizontal overflow.
- Historical/partial states — open a completed research with `Completed — profiles not persisted`
  and a failed research; confirm the Overview explanation, metrics `Not available` (not `0`) and
  preserved polling/resume behaviour.

The final owner-authorized Full Access Playwright run (`npm.cmd run e2e:web`) executed the complete
suite after the scoped locator correction in §11.2: **35 passed, 0 failed, 0 skipped, exit code 0**.
All 28 preserved scenarios and all 7 new SDR-007 scenarios pass, including the failed-run
scenario that previously collided. The synthetic screenshots from the passing scenarios are
available under the git-ignored `apps/web/test-results/`; the mock fixtures are E2E-only and are
not runtime product data. The task is `READY_FOR_HUMAN_REVIEW`; only the human owner can accept it
as `DONE`.

## 14. Execution record

### 14.1 Frontend architecture actually used

Lite FSD, unchanged import direction:

- `entities/research/model/result.ts` — pure, client-safe compatibility model and `z.infer` types;
  exposed through both `entities/research/index.ts` (server) and `entities/research/client.ts`
  (browser).
- `shared/lib/url.ts` — validated HTTP(S) URL helper for source links.
- `_pages/researches` — server list composition plus a client explorer (search/filter/sort) and a
  pure list model.
- `features/track-research` — all single-research presentation and interaction: workspace header,
  status/polling/actions, metrics, tabs, Overview, Companies, company detail, Contacts, safe source
  link. The feature still owns the existing polling hook and resume action.
- `_pages/research` — server detail composition; one client `ResearchWorkspace` receives the
  initial research and product name.
- `app/**` remains routing only; no new API route, no new fetch site, no server code imported by a
  client component.

### 14.2 Result compatibility model implemented

`parseResearchResult(research)` returns a typed five-state model:

| State | Condition | Presentation |
| --- | --- | --- |
| `profiles` | readable `companies` array with ≥1 readable profile | Companies default; metrics/counts from displayed profiles; unreadable entries reported |
| `empty` | present `companies: []` | valid completed zero-company result; counts are genuine `0` |
| `historical` | completed result with no `companies` but a recognisable envelope or legacy string | "profiles not persisted"; counts `Not available` |
| `not-completed` | `QUEUED`, `RUNNING`, `FAILED`, `INTERRUPTED` | status/stage/error/polling/resume only; no final result |
| `unsupported` | null result, unknown object/array, unsupported `schemaVersion`, non-array `companies`, or no readable profile | accurate "Result unavailable" reason |

Supported inputs: `schemaVersion: 1` with `companies`, optional `summary` and `resultsPerQuery`;
unversioned historical results containing `companies`; the seven documented unversioned envelope
shapes (`completedThrough`, legacy page-count/`resultsPerQuery` metadata); legacy string results;
null results; unknown formats; and historical offer variations (`marketFrom03` object or string,
absent offer `sourceUrl`, absent `prices`, optional contact labels/normalised values, dynamic trait
keys). Per-profile/offer/price `safeParse` keeps valid siblings visible and counts unreadable data.
No cast, `any`, invented field, fabricated count or database write is used.

### 14.3 Exact changed-file scope

Modified (10 web paths + registry):

- `apps/web/_pages/research/ui/research-page.tsx`
- `apps/web/_pages/researches/ui/researches-page.tsx`
- `apps/web/app/globals.css`
- `apps/web/e2e/mock-api.mjs`
- `apps/web/entities/research/client.ts`
- `apps/web/entities/research/index.ts`
- `apps/web/entities/research/model/schema.ts` (comment only)
- `apps/web/features/track-research/index.ts`
- `apps/web/features/track-research/ui/research-status-badge.tsx`
- `apps/web/e2e/app.spec.ts` (single scoped locator correction in the preserved failed-run scenario,
  §11.2)
- `docs/tasks/README.md`

Deleted (replaced by the typed workspace):

- `apps/web/features/track-research/ui/research-details.tsx`
- `apps/web/features/track-research/ui/research-result-view.tsx`

Added (23 frontend paths + this record):

- `apps/web/entities/research/model/result.ts`
- `apps/web/entities/research/model/result.test.ts`
- `apps/web/shared/lib/url.ts`
- `apps/web/shared/lib/url.test.ts`
- `apps/web/_pages/researches/model/research-list.ts`
- `apps/web/_pages/researches/model/research-list.test.ts`
- `apps/web/_pages/researches/ui/researches-explorer.tsx`
- `apps/web/features/track-research/model/company-browser.ts`
- `apps/web/features/track-research/model/company-browser.test.ts`
- `apps/web/features/track-research/model/contact-browser.ts`
- `apps/web/features/track-research/model/contact-browser.test.ts`
- `apps/web/features/track-research/model/presentation.ts`
- `apps/web/features/track-research/model/presentation.test.ts`
- `apps/web/features/track-research/model/sections.ts`
- `apps/web/features/track-research/ui/company-card.tsx`
- `apps/web/features/track-research/ui/research-companies.tsx`
- `apps/web/features/track-research/ui/research-contacts.tsx`
- `apps/web/features/track-research/ui/research-metrics.tsx`
- `apps/web/features/track-research/ui/research-overview.tsx`
- `apps/web/features/track-research/ui/research-tabs.tsx`
- `apps/web/features/track-research/ui/research-workspace.tsx`
- `apps/web/features/track-research/ui/source-link.tsx`
- `apps/web/e2e/research-results.spec.ts`
- `docs/tasks/SDR-007-research-results-presentation.md`

### 14.4 Verification evidence and preservation

- Original approved compound proof (exact §9 block) executed once at 2026-11-26 ~14:57
  Europe/Vilnius: `verify:web` **PASS** (typecheck, lint, **138/138** Vitest tests, format check);
  `e2e:web` **blocked before any test** by `Error: spawn EPERM`; exit code 1. This evidence is
  preserved in §11 and was not replaced.
- Owner-authorized Full Access continuation at 2026-11-26 ~15:07 Europe/Vilnius:
  `npm.cmd run e2e:web` executed **once**; all **35** scenarios ran; **34 passed, 1 failed,
  0 skipped**, Playwright-reported duration **1.4m**, **exit code 1**. All **7 new SDR-007
  scenarios passed**; the single failure is the preserved `app.spec.ts:135` strict-locator
  ambiguity documented in §11.1, with page snapshot, `error-context.md` and `trace.zip` retained
  under the git-ignored `apps/web/test-results/`. `verify:web` was not rerun.
- Owner-authorized locator correction and final proof, 2026-11-26 after the correction: only the
  §11.2 assertion in `apps/web/e2e/app.spec.ts` changed; `npm.cmd run e2e:web` executed **once**
  for the complete suite; **35 passed, 0 failed, 0 skipped**, Playwright-reported duration
  **1.3m**, **exit code 0**. `verify:web` was not rerun because no application source or unit-test
  implementation changed; the earlier **138/138** frontend unit-test evidence remains valid.
- The original `verify:web` evidence and both earlier E2E attempts (EPERM and 34/35) remain
  recorded unchanged in §11 and §11.1.
- No changes under `apps/api`, no Prisma schema/migration, no database command, no dependency
  change, no `.env` or service change. Only read-only research GETs were used during preparation.
- All 18 excluded untracked artifacts re-hashed: **18/18 unchanged**, zero missing. Their SHA-256
  values match §10.
- No production code, mock API or Playwright configuration was changed. The only test change was
  the explicitly authorized scoped locator correction in `apps/web/e2e/app.spec.ts` (§11.2). No
  staging, commit or push. SDR-007 is not `DONE`; SDR-008 was not started.

## 15. Market view, final UX refinements and autonomous product direction (2026-11-26)

### 15.1 Authorized extension

The owner accepted the existing SDR-007 architecture and authorized: a Market tab over the
existing typed result compatibility layer, final UX refinements, a narrow PRODUCT.md product
direction update, the agreed roadmap, focused synthetic tests and one new compound proof. No
backend, research stage, prompt, provider, price-extraction, database, dependency, communication
or Stage 05 implementation was authorized or performed. The Research Implementation Freeze
remains fully active.

### 15.2 Market implementation

The Market tab is placed after Companies and before Contacts; Communication remains a
non-interactive planned label.

**Data model.** `market-view.ts` derives everything from the already-parsed
`ResearchResultView` and performs no request:

- summary: total discovered offers, offers with at least one structured price, companies with at
  least one structured price;
- one market row per actual `prices[]` entry (multiple prices on one offer produce multiple rows);
- one `price: null` row per unpriced offer only when “All offers” is selected;
- currency/unit options from actual price values, plus an explicit “Not recorded” option when the
  field is null;
- search over company name, domain, product name and offer id;
- match filter using the PRODUCT.md `a`/`b` semantics, with “Not recorded” for null;
- currency and unit filters;
- sorting by company, product, or price only when one currency and one unit are selected. Price
  sorting is disabled otherwise, and falls back to company order; no averages or cross-currency/
  cross-unit numeric comparisons are calculated;
- 20-row pagination.

**Table.** Columns: Company, Product, Product match, Price, Currency, Unit, VAT, Source. Each
structured price row shows the recorded amount and “From” qualifier in Price, the recorded
currency, unit and VAT in their own columns, the variant under the amount, and the validated
source link. A missing price is “Not published” with “—” in currency/unit/VAT; a genuine zero
amount remains `0`. Product match is shown as “Exact product (a)” or “Category match (b)” per the
confirmed PRODUCT.md definitions. No currency, unit, VAT value, range or price is invented.

**Supported price fields.** `amount`, `currency`, `unit`, `vatIncluded`, `priceType`
(`exact`/`from`), `variant`, `quote`, `sourceUrl`. The persisted type has no range or
minimum/maximum field, so price ranges cannot be represented as structured ranges; the existing
“from” qualifier, variant and quote are preserved instead. Price text is never converted into a
structured price.

**Evidence.** Every row has a secondary “Evidence” disclosure containing any recorded price quote,
stage-03 market note/text, market evidence quotes and offer source. Offers without structured
prices keep their textual price-related evidence accessible through the same disclosure. Source
links use the existing validated HTTP(S) mechanism only; visible labels are compact hostnames,
with the full URL in the anchor.

**Empty states.** A research with no offers shows an honest zero-offer state; a research with
offers but no structured prices shows “No structured prices were found…” plus a functional “Show
all offers” action. Filter exhaustion shows a clear no-match state. Historical/unsupported/
not-completed results show the existing result-availability explanation instead of a fabricated
table.

### 15.3 Final UX refinements

- **Research list:** the misleading “One run per product and market” copy is replaced with an
  accurate description that multiple historical runs may exist for the same product and market.
  All existing search/filter/sort/pagination and actions are preserved. Search/filter controls use
  a compact wrapping row that fits on one desktop line where space allows.
- **Companies:** filters share the same compact row; each `<details>` summary now has a visible
  chevron that rotates when expanded, while native `<summary>` keyboard and expansion behavior is
  preserved.
- **Company details:** identity and contacts are primary and side by side on wide screens;
  offers, prices and product attributes remain primary below. Profiling status/error/sources are
  in a secondary “Technical profiling and sources” disclosure. Offer market/price quotes and
  detailed market evidence are in a secondary “Market and price evidence” disclosure. No
  information, classification, price, evidence or source was removed.
- **Contacts:** four compact count tiles instead of a tall definition list; compact contact rows;
  compact hostname source links; company association, contact types, values, value-versus-unique
  distinction and the not-verified notice are preserved. No `mailto:` or communication action was
  added.
- **Overview:** unchanged.
- **Themes/responsive:** light/dark tokens, mobile layout, keyboard operation, loading/empty/error
  states and the horizontal-scroll containment of the wide market table inside its card are
  preserved. No design-system refactor occurred.

### 15.4 PRODUCT.md update and roadmap

A single new PRODUCT.md section, “Autonomous product direction”, was appended before the existing
Acceptance criteria. Existing sections were not rewritten. It records:

- human inputs: product name, product description, target country;
- automatic stages 01–05, with Stage 05 planned and **not implemented**;
- owner-configured email account, initial subject/message and schedule, followed by automatic
  queue building, sending, outcome persistence, daily mailbox synchronization, reply association
  and history/statistics;
- no mandatory per-company manual review and no terminal `NEEDS_REVIEW` queue; uncertain cases are
  resolved by bounded discovery or excluded; conceptual outcomes `qualified`, `no_contact`,
  `insufficient_evidence`, `rejected`, `duplicate`, `processing_failed`;
- unchanged historical Stage 04 statuses and separate Stage 05 result storage; rejected companies
  remain inspectable;
- owner-authored shared initial email, deferred AI personalization, and eligibility restrictions
  covering outreach restrictions, suppression lists, opt-outs, invalid addresses and duplicates;
  public email discovery is not marketing permission;
- the core principle “Human configuration, machine execution.”

The agreed planned sequence is recorded in PRODUCT.md and is **not registered** in the task
registry:

- SDR-007 — Research Results Presentation and Market.
- SDR-007A — Automatic Lead Qualification and Contact Discovery.
- SDR-008 — Email Account Assignment.
- SDR-009 — Initial Email and Automatic Recipient Queue.
- SDR-010 — Scheduled Email Sending and Communication History.
- SDR-011 — Automatic Mailbox Synchronization.
- SDR-012 — AI-Assisted Reply Management, deferred.

### 15.5 Verification

Single compound proof, executed **once** after the extension, with full process-spawn capability
for Playwright only, using the existing configuration and synthetic mock API:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run verify:web
    if ($LASTEXITCODE -ne 0) {
        throw 'Frontend verification failed'
    }

    npm.cmd run e2e:web
    if ($LASTEXITCODE -ne 0) {
        throw 'Frontend E2E verification failed'
    }

    Write-Output 'PASS: SDR-007 Market and final UX refinements'
}
```

Result: **PASS, exit code 0.**

- `verify:web`: typecheck PASS, ESLint PASS, **153/153** Vitest tests in 19 files, Prettier PASS.
- `e2e:web`: **38/38** Playwright scenarios passed, 0 failed, 0 skipped, **1.5m**, exit code 0.
  This includes all 28 preserved scenarios and 10 new SDR-007 scenarios (Market table; Market
  empty state; Market pagination; plus the previous list/workspace/state/large/resume/mobile
  scenarios updated without weakening their assertion intent).
- New focused unit coverage: `market-view.test.ts` (13 tests) plus presentation label tests;
  synthetic fixtures cover multiple prices per offer, missing vs zero prices, different
  currencies/units, summary counts, search/filter/sort, comparability, empty data and historical
  market handling at the component level.
- New Playwright coverage: Market tab order/default priced view/metrics/rows, multiple prices,
  genuine zero, missing prices in “All offers”, search/match/currency/unit filters, price sort,
  compact source links, textual evidence access, empty Market and Market pagination; chevron
  collapsed/expanded state; desktop and mobile Market views.
- Synthetic screenshots are in the git-ignored `apps/web/test-results/`:
  `sdr-007-research-market-desktop.png`, `sdr-007-research-market-mobile.png`, plus regenerated
  list/companies/contacts screenshots. They contain `.test` fixtures only.
- `git diff --check` clean. All 18 excluded artifacts re-hashed: **18/18 unchanged**. No
  `apps/api`, Prisma, migration, database, dependency, `.env` or service changes; no research
  execution, provider call, communication action, SMTP/IMAP connection, staging, commit or push.
  No future task was registered.

### 15.6 Exact extension paths

New:

- `apps/web/features/track-research/model/market-view.ts`
- `apps/web/features/track-research/model/market-view.test.ts`
- `apps/web/features/track-research/ui/research-market.tsx`

Modified:

- `apps/web/features/track-research/model/sections.ts`
- `apps/web/features/track-research/model/presentation.ts`
- `apps/web/features/track-research/model/presentation.test.ts`
- `apps/web/features/track-research/ui/research-workspace.tsx`
- `apps/web/features/track-research/ui/company-card.tsx`
- `apps/web/features/track-research/ui/research-companies.tsx`
- `apps/web/features/track-research/ui/research-contacts.tsx`
- `apps/web/features/track-research/ui/source-link.tsx`
- `apps/web/_pages/researches/ui/researches-explorer.tsx`
- `apps/web/_pages/researches/ui/researches-page.tsx`
- `apps/web/app/globals.css`
- `apps/web/e2e/mock-api.mjs`
- `apps/web/e2e/research-results.spec.ts`
- `PRODUCT.md`
- `docs/tasks/SDR-007-research-results-presentation.md`
- `docs/tasks/README.md`

The earlier SDR-007 paths and the §11.2 `app.spec.ts` locator correction remain as recorded in
§14.3 and §11.2.

### 15.7 Remaining limitations

- Structured price ranges are not represented by the persisted price type; only the recorded
  `from` qualifier, variant option, quote and source are shown. Evidence text is never converted
  into structured prices.
- No averages, totals or cross-product/currency/unit price comparisons are calculated. Price
  sorting requires selecting one currency and one unit.
- Market data remains limited by what persisted profiles contain: 33 historical completed
  researches have no persisted company profiles, and intermediate stage rows are not exposed by
  the API.
- Product-match labels use the confirmed PRODUCT.md `a`/`b` definitions; no further inference is
  made from dynamic traits or market verdicts.
- The autonomous workflow, Stage 05, initial email, recipient queue and communication stages are
  product direction only and remain unimplemented.
- The Market table scrolls horizontally inside its card on narrow screens; the page itself does
  not overflow.
- **Observed visual limitation for owner acceptance:** at the 1280 px synthetic desktop capture,
  the five Market filter selects share one compact row and some closed labels are clipped (for
  example “Offers with p…” and “All currencie…”). The controls remain fully operable and their
  opened option lists show the complete labels; the list, company and contact filter rows show
  their labels in full. This was not corrected after the single approved proof, per the task's
  no-rerun rule. A follow-up may widen the Market-specific filter controls without changing the
  proof scope.
- SDR-007 is `READY_FOR_HUMAN_REVIEW`, not `DONE`; SDR-008 and SDR-007A were not started.

## 16. Final human acceptance, closure and SDR-007A input (2026-11-26)

### 16.1 Acceptance

The human owner accepted the Research Results Presentation, Market view and final UX refinements
on 2026-11-26, based on:

- TypeScript typecheck PASS, ESLint PASS, Prettier PASS.
- Frontend unit tests **153/153** PASS.
- Playwright E2E **38/38** PASS.
- Practical owner acceptance using actual persisted research results.
- Market view confirmed on a real research with **173 offers, 7 offers with structured prices and
  5 companies with structured prices**.
- Autonomous product direction documented in `PRODUCT.md`.

The observed minor Market filter-label clipping at the 1280 px synthetic capture is accepted by
the owner as a **non-blocking visual limitation**. No further implementation changes were
authorized after acceptance. SDR-007 is therefore `DONE`.

### 16.2 Authorized committed manifest

Exactly **41 paths** (12 modified tracked, 2 deleted, 27 added) were reconciled across the initial
implementation, the §11.2 locator correction and the §15 Market/UX extension. The two deleted
paths are removed from the repository by the commit; the remaining 39 are created or modified.

Modified (12):

- `PRODUCT.md`
- `apps/web/_pages/research/ui/research-page.tsx`
- `apps/web/_pages/researches/ui/researches-page.tsx`
- `apps/web/app/globals.css`
- `apps/web/e2e/app.spec.ts`
- `apps/web/e2e/mock-api.mjs`
- `apps/web/entities/research/client.ts`
- `apps/web/entities/research/index.ts`
- `apps/web/entities/research/model/schema.ts`
- `apps/web/features/track-research/index.ts`
- `apps/web/features/track-research/ui/research-status-badge.tsx`
- `docs/tasks/README.md`

Deleted (2):

- `apps/web/features/track-research/ui/research-details.tsx`
- `apps/web/features/track-research/ui/research-result-view.tsx`

Added (27):

- `apps/web/_pages/researches/model/research-list.test.ts`
- `apps/web/_pages/researches/model/research-list.ts`
- `apps/web/_pages/researches/ui/researches-explorer.tsx`
- `apps/web/e2e/research-results.spec.ts`
- `apps/web/entities/research/model/result.test.ts`
- `apps/web/entities/research/model/result.ts`
- `apps/web/features/track-research/model/company-browser.test.ts`
- `apps/web/features/track-research/model/company-browser.ts`
- `apps/web/features/track-research/model/contact-browser.test.ts`
- `apps/web/features/track-research/model/contact-browser.ts`
- `apps/web/features/track-research/model/market-view.test.ts`
- `apps/web/features/track-research/model/market-view.ts`
- `apps/web/features/track-research/model/presentation.test.ts`
- `apps/web/features/track-research/model/presentation.ts`
- `apps/web/features/track-research/model/sections.ts`
- `apps/web/features/track-research/ui/company-card.tsx`
- `apps/web/features/track-research/ui/research-companies.tsx`
- `apps/web/features/track-research/ui/research-contacts.tsx`
- `apps/web/features/track-research/ui/research-market.tsx`
- `apps/web/features/track-research/ui/research-metrics.tsx`
- `apps/web/features/track-research/ui/research-overview.tsx`
- `apps/web/features/track-research/ui/research-tabs.tsx`
- `apps/web/features/track-research/ui/research-workspace.tsx`
- `apps/web/features/track-research/ui/source-link.tsx`
- `apps/web/shared/lib/url.test.ts`
- `apps/web/shared/lib/url.ts`
- `docs/tasks/SDR-007-research-results-presentation.md`

No backend path, dependency manifest, environment file, screenshot, `test-results` artifact or
excluded artifact is part of this manifest.

### 16.3 Input for SDR-007A — Stage 05 qualification principles

These principles are recorded as requirements input for the separately authorized SDR-007A task.
They are **not** authorization to implement Stage 05 now and do not modify the Research
Implementation Freeze.

- No mandatory human review.
- Strict target-country qualification.
- Company address and contact telephone country are primary geographic evidence.
- Matching foreign address and foreign telephone country are grounds for exclusion.
- Conflicting or missing geographic evidence requires bounded automatic discovery.
- Website availability and valid HTTPS are required by the current commercial qualification
  policy.
- Missing email addresses require extended contact discovery.
- Unresolved cases are excluded automatically.
- Preserve original Stage 01–04 results.
- Store Stage 05 qualification separately.

### 16.4 Sensitivity review

Every proposed committed path was reviewed. The manifest contains application code, unit tests,
synthetic Playwright fixtures/mock data, styling, task documentation and the approved PRODUCT.md
direction section. Automated secret-pattern and email-address scans found no credentials, no
private research payloads and no non-`.test` email fixtures. The registry contains one pre-existing
environment-variable *name* (`EMAIL_ACCOUNT_ENCRYPTION_KEY`, no value) and one pre-existing
research identifier already present in the accepted public history; neither is new sensitive
material. Screenshots and `test-results` are git-ignored and were not staged. The 18 excluded
artifacts were re-hashed immediately before staging: **18/18 unchanged**.

### 16.5 Commit and push

- Branch: `main`; base accepted HEAD: `63798e22bd4e9d0f37e83eb9db3ae712b3955b16`.
- Staging used explicit literal pathspecs only; the staged manifest was confirmed against §16.2.
- `git diff --cached --check` was run before commit.
- Commit message: `feat: present research results and market intelligence`.
- Push: `git push origin main`, without force.
- Single final proof: `git ls-remote --exit-code origin refs/heads/main`; the remote `main` SHA
  must equal the new local HEAD. The exact commit hash, push output and remote proof are reported
  in the completion report; they are not embedded here to avoid a post-proof documentation commit.
