# Research implementation

Status: description of the **current working tree**. The original static description was
prepared during SDR-002; SDR-006A, SDR-007 and SDR-007A changed the implemented behaviour
recorded below. The research implementation remains **frozen** under
[AGENTS.md](../../AGENTS.md) (Research Implementation Freeze). Read-only inspection and
explicitly assigned documentation work are permitted; research code, prompts, schemas,
stages and behavior must not be changed.

Authority and interpretation:

- The current research source code is authoritative for describing **actual implemented
  behavior**.
- [PRODUCT.md](../../PRODUCT.md) remains authoritative for **approved product
  requirements**.
- [AGENTS.md](../../AGENTS.md) remains authoritative for **execution restrictions**,
  including the freeze.
- Known discrepancies below are **observations, not authorized fixes**. They must remain
  documented while the freeze is in effect.
- Historical notes are historical, not current requirements or execution instructions.

SDR-002 did not run the pipeline, the API, tests or any provider call. Statements below are
from source inspection unless marked as historical or inferred. No broad research audit
was performed for this correction; the stage integration check is limited to the current
`research.service.ts` call path.

## 1. One research run — four research stages plus Stage 05

One run = one product + one market/language. The API receives `name`, `description`,
`country` and `productId`; the country determines the single target language. `POST
/research` creates an asynchronous job and the client polls it.

The current `ResearchService.runResearch` calls four stages in order:

| # | Stage | Current entry | Connected? |
| --- | --- | --- | --- |
| 01 | Product identification | `ProductIdentificationService.identify` | yes |
| 02 | Page collection | `PageCollectionService.collect` | yes |
| 03 | Page assessment | `PageAssessmentService.assessPages` | yes |
| 04 | Company profiling | `CompanyProfilingService.profile` | yes |

A read-only check of the current
[research.service.ts](../../apps/api/src/modules/research/research.service.ts) on
2026-11-25 confirms all four calls are present and awaited in `runResearch`:

- 01: `productIdentificationService.identify` at lines 236–242;
- 02: `pageCollectionService.collect` at lines 245–252;
- 03: `pageAssessmentService.assessPages` at lines 255–270;
- 04: `companyProfilingService.profile` at lines 273–276.

No stage call in the current `runResearch` is commented out or disabled. An earlier project
snapshot had stages 02–04 commented out; that snapshot is historical and does not describe
the current file. This is a static call-path check, not a live run.

The older names `02-company-discovery` and `03-company-discovery` are historical. The
current implementation has page collection in 02, page assessment in 03 and company
profiling in 04.

## 2. Orchestration and job lifecycle

[research.service.ts](../../apps/api/src/modules/research/research.service.ts) owns the job:

- `start()` checks the product, reuses an existing `QUEUED`/`RUNNING` job for the same
  `productId` + `country`, or creates a new row and starts `runResearch()` in-process.
- `runResearch()` writes `RUNNING`, a random `executionToken`, `lastHeartbeatAt` and a
  5-minute `executionLeaseUntil`; it reads the `research.pageCollection.resultsPerQuery`
  setting, then runs 01 → 02 → 03 → 04.
- Every stage update goes through `updateMany({ id, executionToken })`; a zero count means
  the lease was lost and the process throws.
- On success the normal path writes `COMPLETED` with
  `result: { completedThrough: '04-company-profiling', resultsPerQuery }`.
- On failure it writes `FAILED`, clears the stage, token and lease, and stores the error.
- `failStaleRuns()` marks `QUEUED`/`RUNNING` rows with no heartbeat for five minutes as
  `INTERRUPTED`. It runs at module init, before `start()`, and on job reads.
- Stage 01/02 result upserts and the stage 03 criteria upsert are unconditional; they are
  not gated by `executionToken`. Stage 03 checkpoints and all progress/completion writes
  are token-gated. Stage 04 has no DB write or lease.
- Stage 02 reports progress only at 2.1–2.4; a long search/fetch can therefore be swept as
  stale even while it is working. Stage 03 reports per page; stage 04 reports per domain.
- `onModuleInit()` calls the same stale sweep: state is process-local, so a run cannot
  survive a process restart.

Statuses: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `INTERRUPTED`
([schema.prisma](../../apps/api/prisma/schema.prisma#L16-L22)). Stage strings are
progress labels such as `1.1 Generating term candidates...`, `2.4 Fetching missing page
content...`, `03.1 Assessing pages ...` and `04 Profiling ...`; they are not a separate
persisted stage enum.

### Resume

`POST /research/:jobId/resume` is limited to a stopped run with stored stage 01, stage 02
and stage 03 criteria. It does **not** re-run 01 or 02. It:

- rejects a completed run and a run without stage 01/02 results or stage 03
  criteria/prompt version;
- rejects a stored prompt version that differs from the current
  `PAGE_ASSESSMENT_PROMPT_VERSION`;
- atomically claims the job through `executionLeaseUntil` and a new `executionToken`;
- resumes the pending stage-03 pages from the saved decisions, then runs stage 04 again;
- on success stores `{ completedThrough: '04-company-profiling', companies: <domains> }`
  in the resume path.

Resume accepts any non-`COMPLETED` status if the lease is null or expired, including
`QUEUED`, `FAILED`, `INTERRUPTED` and stale `RUNNING`. It reconstructs stage-03 input from
the stage-01 row and `research.product.description`, while the normal run used the request
DTO description; those values can differ. Stage 04 has no independent checkpoint or resume
entry: the resume path re-runs it from the stage-03 result. A stage-04 failure is therefore
retried as part of a later resume, not from a saved stage-04 checkpoint. See
[research.service.ts](../../apps/api/src/modules/research/research.service.ts#L318-L500).

### Automatic Stage 05 contact discovery

SDR-007A added automatic Stage 05 Contact Discovery V1 after successful Stage 04
persistence. Stage 01–04 algorithms and their result contract are unchanged.

- Both completion paths write `status: COMPLETED`, the Stage 04 result, and the transient
  marker `stage: 05-contact-discovery-pending` in one token-guarded update.
- The public research API masks that marker as `stage: null`; the `COMPLETED` status and
  existing frontend behavior are preserved.
- A separate automation service starts Stage 05 with the stable key
  `stage05:contact-discovery-v1:<researchId>`, so repeated completion events do not create a
  second run.
- The marker is cleared only after `runtime.start` has returned a durably created run.
  Start failures receive three bounded in-process attempts (250 ms and 1,000 ms backoff);
  after that the marker remains for the next application startup.
- Startup recovery scans COMPLETED researches with the pending marker and starts/resumes
  their Stage 05 run. It also recovers AUTO Stage 05 runs in `QUEUED`, `INTERRUPTED`, or
  `RUNNING` with an expired lease. Manual and historical researches are not selected and
  are not backfilled.
- Stage 05 failure never changes the Stage 04 status or result. The previous published
  Stage 05 result remains until a new run has all source companies and publishes atomically.
- The Contacts tab reads the latest/published Stage 05 run and displays queued, running,
  failed, completed, no-result, loading, API-error, and empty states. Its tab count and
  summary are derived from the published API result.

## 3. Stage 01 — product identification

**Purpose.** Turn the English product name/description and the selected market into one
local `productName`, `categoryName` and `generalCategoryName`, using pages found in the
market as evidence.

**Input/output.** Input is `CreateResearchDto` plus target language; output is
`ProductIdentificationResponse { product, sourcePages }`
([types.ts](../../apps/api/src/modules/research/types.ts#L87-L90)). The product is validated
by `identifiedProductSchema`
([product-identification.schema.ts](../../apps/api/src/modules/research/stages/01-product-identification/product-identification.schema.ts)).

**Current flow** ([service](../../apps/api/src/modules/research/stages/01-product-identification/product-identification.service.ts)):

1. Generate term candidates with an inline DeepSeek prompt. The local
   [page-assessment.prompt.ts](../../apps/api/src/modules/research/stages/01-product-identification/page-assessment.prompt.ts)
   is the separate prompt used for the final product-identification call over the
   prepared pages.
2. Search every product/category term through **both** Exa and DeepSeek Search with a
   hardcoded `resultsPerQuery: 5`
   ([term-search.ts](../../apps/api/src/modules/research/pipeline/term-search.ts)). Each
   provider failure is recorded on that search run, not thrown.
3. Prepare/deduplicate pages and ask the LLM to identify the product.
4. Validate `finish_reason`, non-empty content, JSON and the zod schema; throw on failure.
5. Write `01.1`–`01.4` JSON artifacts under the research `temp/` directory and upsert
   `research_stage_01_results` (`identifiedProduct`, `preparedCandidates`). The term
   candidates and the identified product both use a `01.1-` prefix; the names differ.

**Model/configuration.** `LLM_CONFIG_FLASH` (`deepseek-flash`, max 6000, temperature 0,
thinking disabled) for 01 LLM calls; search keys are `EXA_API_KEY` and
`DEEPSEEK_API_KEY`. Stage 01 has no exported prompt-version constant.

**Current limitations.** The stage is live; it is not a fixture replay in the current
working tree. Its term-generation and identification prompts are inline/unversioned, and
there is no retry/backoff around a failed LLM call. Search failures are tolerated per
query, so a partial search can continue. The parsed term-candidate object is not assigned
the required `targetLanguage` before `searchTermCandidates()` receives it, so the DeepSeek
`lang:` operator is not applied from this path at runtime; the type requires the field but
the runtime object lacks it. The search depth is fixed at five.

## 4. Stage 02 — page collection

**Purpose.** Expand the candidate page set for the identified product/category, fetch text
where missing, and hand the pages to assessment.

**Input/output.** Input is the research DTO, stage-01 `ProductIdentificationResponse`,
target language, job id, stage callback and `resultsPerQuery`; output is
`PageForAssessment[]`. The result is persisted as `research_stage_02_results.result`
([page-collection.service.ts](../../apps/api/src/modules/research/stages/02-page-collection/page-collection.service.ts#L53-L156)).

**Current flow:**

1. Generate additional queries with **term-generation-v4**
   ([prompt](../../apps/api/src/modules/research/stages/02-page-collection/term-generation.prompt.ts#L302-L303));
   the prompt uses stage-01 category pages as market-wording evidence.
2. Search the seed names and generated queries through Exa and DeepSeek Search
   (`resultsPerQuery`, default from settings; Exa capped at 20).
3. Merge stage-01 source pages with new pages and deduplicate.
4. Fetch missing text through Exa's contents endpoint
   ([fetch-pages.ts](../../apps/api/src/modules/research/pipeline/fetch-pages.ts)); a failed
   page keeps its existing text and is a value, not a stage abort.
5. Write `02.1-search-terms-*` and `02.4-response-*` artifacts; upsert the stage-02 row.

**What is not in the main path.** `processPages()` and `triagePage()` in the same service
implement the older per-page triage with `PAGE_TRIAGE_PROMPT_VERSION =
'page-triage-v19'`. No caller invokes `processPages()`; the main `collect()` does not
triage. Therefore the current path sends all collected pages to stage 03, not only
`good` pages. `TriageReport` in `types.ts`, the triage prompt versions and
[research-fixture.lib.ts](../../apps/api/src/modules/research/lib/research-fixture.lib.ts)
are currently unused by the main path.

**Model/configuration.** `LLM_CONFIG_FLASH` via DeepSeek for query generation; Exa and
DeepSeek Search keys as in stage 01; Exa contents for fetching. Stage 02 does not use
Firecrawl. The term-generation prompt version is written to the `02.1` temp file but is
not stored in `research_stage_02_results` (the model has no prompt-version column).

**Current limitations.** No triage filter in the main path; dead triage/fixture code still
exists and the old `page-collection.test.ts` still tests it (see §10). `resultsPerQuery`
comes from the settings registry. Progress updates occur only at 2.1–2.4, not per page or
per search, so a long search/fetch phase can look stale to the five-minute sweep. The
`processPages()` triage path is called only by the stale test, not by production or
`ResearchService`. Current docs must not describe the old triage/replay flow as active.

## 5. Stage 03 — page assessment

**Purpose.** Assess each collected page against the study category and exact-product
traits, producing `a`/`b`/`none` and the offer facts used by company profiling.

**Input/output.**
`PageAssessmentInput { targetCountry, targetLanguage, product, pages }` → `PageAssessmentResult
{ targetCountry, targetLanguage, product, domains: [{ domain, pages: SelectedPage[] }] }`
([types.ts](../../apps/api/src/modules/research/types.ts#L92-L101),
[result.ts](../../apps/api/src/modules/research/stages/03-page-assessment/page-assessment-result.ts)).
Only `a`/`b` pages are grouped by domain; `none` pages are dropped.

**Current flow** ([service](../../apps/api/src/modules/research/stages/03-page-assessment/page-assessment.service.ts)):

1. Build the study criteria once with `STUDY_CRITERIA_PROMPT` (Gemini); the criteria carry
   the target language and the exact-product traits.
2. For each page, call the page-assessment prompt (Gemini), validate the facts schema
   built from the declared trait names, verify the market note is a verbatim page quote,
   derive the verdict in code, and record an assessment decision.
3. `deriveVerdict()` first rejects third-party, mass-market, unclear publisher, no offer,
   label-only, `market=other`, adjacent category and unknown category; only then do traits
   distinguish `a` from `b`
   ([verdict.ts](../../apps/api/src/modules/research/stages/03-page-assessment/page-assessment.verdict.ts#L37-L96)).
4. `offerLanguage=other` plus a non-target market is recorded as
   `excludedFrom04='offer_language_mismatch'` and omitted from the 03 result.
5. Decisions are checkpointed every five pages; each checkpoint renews the execution
   lease and heartbeat. `research_stage_03_results` stores criteria, prompt version,
   decisions, counts and result.
6. A page failure is stored as an `error` decision and the batch continues, except an
   insufficient provider balance, which aborts the stage. Raw failures are written under
   `temp/`.

**Prompt/version detail.** `PAGE_ASSESSMENT_PROMPT_VERSION = 'page-assessment-v5'`, but
the exported text is `PAGE_ASSESSMENT_PROMPT_V4`
([prompt.ts](../../apps/api/src/modules/research/stages/03-page-assessment/page-assessment.prompt.ts#L401-L404)).
The file comment says v5 removes a generated category; there is no separate V5 text
constant. `STUDY_CRITERIA_PROMPT` has no version constant. Treat this as a labeling
ambiguity to verify before changing prompts.

**Model/configuration.** Page assessment and criteria use the `gemini` provider via
`llmChat`: `GEMINI_API_KEY`, endpoint `generativelanguage.googleapis.com`, and
`GEMINI_MODEL` from the environment. No model id is hardcoded for this stage. The
`LLM_CONFIG` `deepseek-v4-pro` export exists but is unused in the current code.

**Resume and errors.** Resume requires the saved criteria, prompt version and stage 02
page list; page URL/canonical URL identity is checked. A changed prompt version cannot be
resumed. A page failure is not retried individually; the stage records it and continues.
An in-process `inFlight` guard prevents two stage-03 runs for the same job in one process.

**Current limitations.** With an empty page list in `new` mode, stage 03 saves an empty
result without generating criteria; a later resume then fails on the missing criteria.
Only the market note is verified against the page text; `offer.quote` and `category.quote`
are schema fields but are not checked against the source. The persisted result embeds full
page objects and content, not just assessment facts. V1–V3 prompts and the V1 schema are
retained but unused. The execution lock is in-process only; the database lease is the
cross-process guard. A checkpoint every five pages can lose up to four completed
assessments on a crash, although those pages are re-run from the saved decisions after a
resume.

## 6. Stage 04 — company profiling

**Purpose.** Build one company profile per selected domain from stage-03 offers, the
domain homepage and optional contact/evidence pages.

**Input/output.** Input is the stage-03 result (domains, pages, verdicts, facts).
Output is `CompanyProfilingResult { promptVersion, createdAt, targetCountry,
targetLanguage, product, domains: CompanyProfile[], diagnostics, summary }`
([batch.ts](../../apps/api/src/modules/research/stages/04-company-profiling/company-profiling.batch.ts#L95-L106)).
`CompanyProfile` carries status, company identity/contacts, offers, market decisions,
prices and usage
([types.ts](../../apps/api/src/modules/research/stages/04-company-profiling/company-profiling.types.ts)).

**Current flow:**

1. **04.1 input preparation** ([input.ts](../../apps/api/src/modules/research/stages/04-company-profiling/company-profiling.input.ts)):
   one entry per domain; every stage-03 offer is retained as a summary; up to five
   excerpts and 20,000 characters per domain; the homepage is reused from stage 03 when
   available, otherwise one **Firecrawl** scrape is attempted; contact links are
   shortlisted.
2. **04.2 first call** with **company-profiling-v1** (DeepSeek flash)
   ([prompt](../../apps/api/src/modules/research/stages/04-company-profiling/company-profiling.prompt.ts#L9-L11)):
   company identity/contacts, market evidence per offer id and prices for `a` offers. The
   prompt reports facts and quotes; code derives market status.
3. **04.3 gap fill** only implements the **contact** gap: `describeGaps()` reports
   `market: false` and `planGapFill()` selects at most one contact page. A market/delivery
   gap is not fetched in the current code. Fetch one contact page, make one follow-up call
   when at least 200 characters were fetched, and merge facts; a failed second call keeps
   the first-call profile and records an error diagnostic.
4. **04.4 profile build** (deterministic, no fetch/LLM): derive market status from quoted
   evidence, build offers/prices/contacts, compute a status and usage summary.
5. Write `04-profiling-result-<slug>-<timestamp>.json`; the full result is returned to
   `ResearchService`. There is no `research_stage_04_results` table.

**Status/decision logic.**
`deriveCompanyProfileStatus(name, offers)` returns `profiled` only when a company name is
present and at least one `a`/`b` offer exists; otherwise `needs_review`
([profile.ts](../../apps/api/src/modules/research/stages/04-company-profiling/company-profiling.profile.ts#L146-L153)).
It does **not** require a `target` market offer and never returns `rejected`.
`error` profiles are created for fetch/LLM failures and retain the input offers. Market
status is derived by `deriveMarket` from channel-scoped evidence; delivery alone never
establishes a target market.

**Prompt/configuration.** `company-profiling-v1`; DeepSeek flash for both calls;
`FIRECRAWL_API_KEY` for homepage/contact scraping. The model id is recorded in the input
and prompt version, but the provider/model are chosen in `company-profiling.service.ts`.

**Current limitations.** No stage-04 DB persistence or independent resume; normal
`ResearchService` completion does not persist the profiles (see §7); profile status is
company-name-plus-offer, not PRODUCT.md's confirmed-target-market status; `rejected` is not
derived; no confirmed-seller count/list is persisted. The developer methods
`profileDomain`, `profileFirstCall`, `fillGaps` and `buildProfile`, and the `precomputed`
reuse option, have no production caller. The prompt offers `nextPage` kinds `delivery |
contact`, while the schema and `ProfilingLink` accept only `contact`; the delivery option
is not implemented. Stage 04 has no job id, execution token or lease, and its temp output
is not a database checkpoint. The returned diagnostics and summary are not included in
`Research.result`.

## 7. Persistence and result storage

Prisma models ([schema.prisma](../../apps/api/prisma/schema.prisma#L36-L99)):

- `Research`: status, stage, result (JSON), error, lastHeartbeatAt, executionToken,
  executionLeaseUntil.
- `ResearchStage01`: identifiedProduct, preparedCandidates.
- `ResearchStage02`: result (page list).
- `ResearchStage03`: criteria, promptVersion, decisions, decidedPages, errorPages, result.
- No stage-04 table.

The API exposes:

- `POST /research` → `202 { jobId, status }`;
- `GET /research/:jobId` → job row without execution token/lease;
- `GET /research` → all jobs, no ordering/pagination;
- `POST /research/:jobId/resume` → `202 { jobId, status: 'RUNNING' }`.

The frontend polls through the same-origin
[GET proxy](../../apps/web/app/api/research/[jobId]/route.ts); the web schema types
`result` as `unknown`
([schema.ts](../../apps/web/entities/research/model/schema.ts)).

### Final-result persistence

Both completion paths — normal (`runResearch`) and resumed (`runResume`) — build the
persisted result with one shared constructor and write it together with the COMPLETED state
in a single token-guarded statement
([final-result.ts](../../apps/api/src/modules/research/final-result.ts),
[research.service.ts](../../apps/api/src/modules/research/research.service.ts)).

The versioned contract for newly completed rows is:

```json
{
  "schemaVersion": 1,
  "completedThrough": "04-company-profiling",
  "companies": [ "<the complete stage-04 CompanyProfile[]> " ],
  "summary": { "<stage-04 batch counts, when available>": 0 },
  "resultsPerQuery": 40
}
```

- `companies` is always present and is the stage-04 profile array unchanged: identity,
  legal data, contacts, offers, prices, market evidence, source URLs and the study's own
  trait keys. An intentionally empty result persists `companies: []` and still completes;
  a missing or non-array stage-04 result fails the run instead of reporting completion.
- `summary` is the stage-04 batch counts object. Stage-04 `diagnostics` is **not** persisted:
  it carries raw second-call model output and per-page text, grows with the run and
  duplicates the stage-04 temp dump.
- `resultsPerQuery` is written only by the normal path, the only one that reads the setting.
- Historical rows keep their own envelopes (seven shapes were in the database at the
  SDR-006 inventory); readers must discriminate by key presence and must not require
  `schemaVersion`.
- Result and COMPLETED state are one write filtered by the execution token, so a stale
  executor cannot overwrite another run and a failed write leaves the run FAILED rather
  than falsely completed.

Earlier revisions of this document described the pre-SDR-006A defect, where the normal path
stored `{ completedThrough, resultsPerQuery }` without `companies` while the resume path
stored only `{ completedThrough, companies }`. That description is historical: SDR-006A
corrected both paths. SDR-006A also prepared, but did not execute, a guarded one-row recovery
for the single historical row whose profiles exist only in a temp artifact.

### Stage 05 contact-discovery persistence

SDR-007A adds two independent tables and does not alter the four research stage tables:

- `LeadQualificationRun`: versioned run metadata, status, target country, counts, durable
  usage, execution token/lease, publication/supersession timestamps and stable `startKey`;
- `LeadQualificationResult`: one row per source company with profile identity, decision,
  exclusion reasons, checks, usable contacts, evidence sources and the persisted
  `contactDiscovery` metadata.

Run creation is idempotent by `(researchId, startKey)`. Results are unique by
`(runId, sourceCompanyIndex)`. Partial unique indexes permit at most one active run and one
published run per research. A run is published only after every source company has a result;
publication supersedes the previous published run without deleting its history. The
Contacts UI reads the latest and published Stage 05 API routes.

Stage 05 execution requires no LLM or Firecrawl. It uses bounded HTTP/contact-page discovery,
conditional Exa fallback, and deterministic ownership/telephone filtering. Provider failures
produce run/result diagnostics rather than modifying the Stage 04 result.

## 8. API exposure and status/result mismatch

- `COMPLETED` from SDR-006A onward means the four stages returned **and** the final result was
  persisted. Historical `COMPLETED` rows may still lack `companies` (34 of 37 at the SDR-006
  inventory).
- `INTERRUPTED` is written only by the stale-run sweep, not by a stage handler.
- `stage` is a progress label; it is cleared on terminal success/failure, except during the
  short automatic Stage 05 launch window, when the raw value is the internal
  `05-contact-discovery-pending` marker. The public research API maps that marker to `null`;
  the research status remains `COMPLETED` throughout.
- `result` is open JSON; the frontend intentionally does not type it and renders the raw
  value rather than a typed company-profile view.
- The current result includes the stage-04 `summary` and a `schemaVersion`, but not stage-04
  `diagnostics`, the stage-04 prompt version, or stage-03 criteria/decisions.
- The frontend schema comment says stage 02 returns the literal string `"completed"`;
  that comment is stale against the current service, which writes a versioned object. Do not
  rely on the comment as current behavior.
- `apps/api/test/research.result.test.ts` was aligned by SDR-006A: it now drives the
  production completion path with a controlled synthetic stage-04 result and asserts the
  versioned contract. It no longer reads a temp file.

## 9. Fixtures, replay and artifacts

- Runtime dumps are written under the research `temp/` directories and are git-ignored.
  They are diagnostics, not a stable API contract.
- `research-fixture.lib.ts` can read/write an `IdentificationFixture`, but no current main
  path calls it. It is legacy support code.
- The old `processPages()` triage path is unused; its `PAGE_TRIAGE_PROMPT` v19 is not in
  the current execution path.
- Test fixture `apps/api/test/fixtures/v5-16-domains.json` is used by static/integration
  tests, not by the runtime pipeline.
- The old replay claims in `ops/current.md`, `HANDOVER.md`, `TODO.md` and earlier README
  text are historical. Current stage 01/02 are live in the working tree.

## 10. Test/code mismatches (static inspection)

These are observations from reading tests; SDR-002 did not run them.

- `apps/api/test/research.result.test.ts` expects the normal completion to store
  `companies` and `completedThrough: '04-company-discovery'`; the current service stores no
  companies and uses `04-company-profiling`. It also reads a temp file that is not present
  and stubs stage 01/02/03 services as empty objects while `runResearch()` calls them. The
  test's expectation is inconsistent with the code and would fail unless the service/test
  is changed.
- `apps/api/test/page-collection.test.ts` drives `collect()` with an older argument list and
  as if it still triaged pages; current `collect()` has a different signature, generates
  queries, searches, fetches and writes `02.1`/`02.4`. Triage is the uncalled
  `processPages()` path. The test also constructs `PageCollectionService` without the
  Prisma dependency.
- `research.04.integration.test.ts` verifies a manually constructed `COMPLETED` row with
  `companies`; it does not exercise the normal `runResearch()` completion that omits them.
- `page-assessment.resume.test.ts` and `page-assessment.input.test.ts` exercise the current
  stage-03 decision/resume logic statically.
- Some stage-04 test fixtures use `marketFrom03` as a string while the current type expects
  an object; static type drift in test data. No test command was run.

## 11. Mismatches with PRODUCT.md

[PRODUCT.md](../../PRODUCT.md) is the approved product requirements document. The current
code does not satisfy all of it; these are observations, not authorized fixes.

- **Persisted study result.** PRODUCT.md requires one persisted study result with all
  profiles and offers. The normal completion path stored no companies until SDR-006A; both
  completion paths now persist the versioned result (§7). Historical rows are unchanged.
- **Company profile status.** PRODUCT.md defines `profiled` as a named company with at
  least one confirmed target-market offer. `deriveCompanyProfileStatus()` returns
  `profiled` for a name plus any `a`/`b` offer, without requiring `market.status ===
  'target'`.
- **Rejected status.** PRODUCT.md defines `rejected` for profiles whose offers are all
  outside the target market. The current derivation never returns `rejected`; it returns
  `profiled` or `needs_review`, while technical failures return `error`.
- **Confirmed seller list/count.** PRODUCT.md describes a confirmed seller list based on
  `a + target` or `b + target`. The current API returns all profiles and offers with their
  derived market status; no confirmed-seller count or list is persisted separately.
- **Assessment identity.** PRODUCT.md asks to preserve the assessment ID and verdict of
  every offer passed to profiling. Stage 04 synthesizes offer IDs from the position in the
  stage-03 result (`03-0001`, …) and preserves source URLs/verdicts; stage 03 does not
  store a separate assessment ID.
- **Result field semantics.** A `COMPLETED` status can overstate available result data on
  the normal path; see §7.
- **Market status basis.** PRODUCT.md treats a quoted source establishing local sale as
  `target`. Stage 04 preserves a stage-03 `other`, but it does not let a stage-03 `target`
  alone establish a confirmed target; it requires stage-04 evidence. This can report
  `unclear` where the stage-03 evidence met the product rule.
- **Quote verification.** PRODUCT.md requires a verbatim quote and source URL for product
  and market findings. Stage 03 verifies only the market note against page text; the offer
  and category quotes are validated structurally but not checked against the source.
- **Country coverage.** PRODUCT.md says a new country must work without a code change.
  `languageByCountry` currently maps only a small set of countries; an unsupported country
  throws before stage 01, so adding one requires a code change.
- **Input contract.** The API DTO additionally requires `productId`, and the normal run
  uses the DTO name/description while resume uses the stored Product description; this is
  an extra identifier and a second product-text source beyond PRODUCT.md's input description.
- **Offer totals.** PRODUCT.md's seller/offer counts and confirmed-seller list are not
  computed or persisted; the result contains individual profiles and offers.

## 12. Static-inspection uncertainties

The following could not be established without running the system:

- whether the current database has applied the untracked research migrations and what
  historical rows contain;
- live provider behavior, retries, rate limits and actual cost per run;
- whether the current stage 03/04 prompt versions produce acceptable product/market
  decisions on new samples;
- whether the normal completion omission of `companies` is a temporary work-in-progress or
  an accidental regression;
- whether the stale tests fail exactly as inferred; no test command was run during SDR-002;
- whether the environment actually provides the provider variables the current stages read.
  `apps/api/.env.example` documents only the database, port and DeepSeek key; the current
  code also reads `GEMINI_API_KEY`, `GEMINI_MODEL`, `EXA_API_KEY` and `FIRECRAWL_API_KEY`;
- whether test files are typechecked by the API build (the API tsconfig includes `src`, not
  the test directory), so some test-side type drift may be invisible to `tsc`.

## 13. Historical notes (not current implementation)

The following earlier descriptions are retained because they explain artifacts and old
docs. They are **historical**, not current requirements or execution instructions.

- The original pipeline was described as stage 01 product identification and stage 02
  company discovery. Stage 02 later became page collection and stage 03 page assessment;
  company discovery moved to stage 04 and was replaced by company profiling.
- Earlier development used fixture replay for stage 01 and the stage-02 search step, with
  `identified-product-*.json`, `identification-pages-*.json`, `02.1-merged-pages.json`,
  `02.2-tirage.json` and `02.3-page-collection-response.json` under `temp/`. The current
  code no longer reads those fixtures on the main path.
- The earlier stage 02 triage prompt evolved through v15-v19; v17 was the documented
  baseline and v19 exists in the tree. It is not called by current `collect()`.
- Earlier company discovery prompt `company-discovery-v9` and the `03-company-discovery`
  service were removed from the current tree; current stage 04 is `company-profiling-v1`.
- Older docs such as `ADR-001-research-pipeline.md` are draft/historical and do not
  describe the current four-stage implementation. Do not treat them as current code
  documentation.

### Historical ladder-level and candidate-expansion notes

These notes were previously kept in `AGENTS.md`. They are retained here as **historical**
notes, not current implementation requirements or authorization.

- Ladder levels are provisional priority hints, never eligibility filters. Evaluate family
  heads, term variants and discovered labels against product sense and specificity before
  assigning them to general, specific or broader.
- Stage 3 verifies seed candidates and extracts newly discovered relevant category labels
  with evidence URLs and context. Discovered candidates enter subsequent evaluation and
  bounded search expansion.
- The candidate set includes term variants, not only family heads; otherwise structured
  synonyms are lost.
- Inclusion in the candidate set does not assign a term to general. A material-specific
  subordinate compound may be a valid specific term; meaning and specificity, supported by
  source evidence, decide the assignment.
- Language fit follows commercial usage, international names and spelling variants; do not
  reject a variant as foreign on normative spelling alone.
