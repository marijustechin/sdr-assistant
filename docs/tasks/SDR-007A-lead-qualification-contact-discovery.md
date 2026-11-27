# SDR-007A — Stage 05 Contact Discovery (revised scope)

## 1. Task ID and status

- **Task ID:** SDR-007A
- **Title:** Stage 05 Contact Discovery — homepage and contact-page collection (revised from lead qualification)
- **Status:** `DONE / HUMAN_APPROVED` — accepted by the human owner on 2026-11-27.
  Stage 05 Contact Discovery V1 is integrated and automatically starts after successful Stage 04
  completion. The final published result contains **77 processed companies**, **71 retained
  companies**, **138 retained-company usable email pairs**, **6 excluded companies**, **5 partner
  pairs**, **4 missing-email exclusions** and **2 foreign-telephone exclusions**. The Contacts tab
  reads the published result and displays execution status/progress. The durable launch marker,
  startup recovery and bounded retry are recorded in §35. SDR-007A is closed; SDR-008 was not
  started.
- **Registry:** [README.md](README.md)
- **Checkpoint at start:** `7810d5d9d2ab1fb230f95e971d564a0728e6df01`
- **Mode:** design, implementation and synthetic verification. No live migration deployment,
  database write, real website/provider request, frontend or communication implementation was
  performed.

This document designs Stage 05. It does not authorize implementation. All later work remains
subject to the Research Implementation Freeze and to separate explicit owner authorization.

## 2. Objective

Design Stage 05 as an autonomous downstream module that consumes the persisted Stage 04 company
profiles of a completed research and produces a strict, commercially useful lead list.

The normal future workflow runs Stage 05 automatically after Stage 04 completion. For development
and historical data, Stage 05 must also run independently against an existing persisted research
result without re-running stages 01–04.

A company is accepted only when every mandatory criterion passes. There is no mandatory human
review, no terminal `NEEDS_REVIEW` state and no aggregate score that can compensate for a failed
mandatory criterion. Precision takes priority over recall.

### 2.1 Owner-approved qualification principles (input for this design)

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

These are requirements for SDR-007A, not authorization to implement Stage 05 or to modify stages
01–04.

## 3. Authorization, scope and exclusions

Authorized for this assignment:

- read-only inspection of the repository and PostgreSQL;
- `docs/tasks/SDR-007A-lead-qualification-contact-discovery.md`;
- `docs/tasks/README.md`;
- synthetic examples in this document.

Explicitly not authorized or performed: Stage 05 code; changes to stages 01–04 or the protected
research module; prompts/providers/models; Prisma schema or migrations; database writes; research
execution; external website requests; paid API calls; SMTP/IMAP; dependency installation;
environment changes; the 18 excluded artifacts; SDR-008; staging, commit or push.

## 4. Checkpoint and preconditions confirmed

- Current branch is `main`; accepted HEAD is
  `7810d5d9d2ab1fb230f95e971d564a0728e6df01`.
- SDR-001–SDR-007, SDR-006A and ENV-003 are `DONE`.
- Stages 01–04 are implemented and frozen.
- PostgreSQL is the authoritative persisted research-result source.
- The accepted SDR-006A final-result contract is `schemaVersion: 1`,
  `completedThrough: '04-company-profiling'`, required `companies: CompanyProfile[]`, optional
  `summary` and `resultsPerQuery`.
- Historical completed rows may contain unversioned `companies` envelopes or no companies at all.
- The target baseline research is `cmww8smxb0000z4swhooukamv`: `COMPLETED`, country Lithuania,
  schema version 1, 77 company profiles.
- The 18 excluded untracked artifacts were not read as runtime data, modified or staged.

## 5. Existing capability and source-code inventory

### 5.1 Persisted Stage 04 contract

`CompanyProfile` (`apps/api/src/modules/research/stages/04-company-profiling/
company-profiling.types.ts`) contains:

- `domain`, `registrableDomain`, `status` (`profiled | needs_review | rejected | error`);
- optional `error` (`fetch_failed | llm_failed | schema_invalid | no_sources`);
- `company`: `name`, `legalName`, `code`, `vat`, `address`, `city`, `country`,
  `emails[{value,label,sourceUrl}]`, `phones[{value,normalised,label,sourceUrl}]`,
  `contactFormUrl`, `sources[]`;
- `offers[]`: `id`, `item`, `verdict` (`a | b`), dynamic `traits`, `pageIds`, `sourceUrl`,
  `marketFrom03`, derived `market` decision and `prices[]`;
- `prices[]`: `amount`, `currency`, `unit`, `vatIncluded`, `priceType`, `variant`, `quote`,
  `sourceUrl`;
- `usage`: LLM calls, tokens, fetches, credits and duration.

The persisted `research.result.companies` array is the complete profile array. There is no
`research_stage_04_results` table, no Stage 05 table and no website-validation result in the
database.

### 5.2 Provider and fetch capabilities

| Capability | Current implementation | Usable for Stage 05 |
| --- | --- | --- |
| Firecrawl scrape | `scrapePage(url)` returns markdown + links; 60 s timeout | Optional fallback for contact/imprint pages; already paid |
| Firecrawl map | `mapSite(url, limit)` returns discovered URLs; 90 s | Optional link discovery, not needed by default |
| Exa search | `searchExa(query, count, country)` returns URLs/highlights | Bounded extended-contact search |
| Exa contents | `fetchExaContents(url)` returns clean text for a known URL; 12k chars | Optional page-text fallback |
| DeepSeek search | `dsSearch(query, count, language)` returns snippets/content | Not proposed for Stage 05; Exa is sufficient and cheaper to reason about |
| LLM chat | `llmChat(config, systemPrompt, userContent, provider)` with 90 s timeout, DeepSeek flash default | One bounded semantic call per ambiguous company |
| HTTP fetch deadline | `fetchWithTimeout` adds an abort deadline only | Reusable timeout pattern, **not SSRF-safe** |
| Public-destination guard | `mail-destination.ts` resolves mail hosts, rejects private/loopback/link-local/CGNAT/multicast/reserved ranges and pins the resolved address | Pattern to reuse; mail-specific and not an HTTP client |
| Concurrency | Stage 02 search batches of 4, triage batches of 6; stages 03/04 are sequential | New bounded pool is required |
| Persistence/orchestration | In-process `ResearchService`, token/lease conditional writes, no queue framework | Use the same simple pattern; no workflow framework |

### 5.3 Existing SSRF and TLS behaviour

- The mail destination resolver is a good reference for public-address classification and DNS
  pinning, but it is specific to mail sockets and returns mail destinations.
- `fetchWithTimeout` performs no URL classification, no DNS pinning and no redirect policy. It must
  not be used directly for untrusted Stage 05 URLs.
- Certificate validation is not disabled anywhere in mail verification; Stage 05 must preserve
  `rejectUnauthorized: true`.
- There is no generic HTML parser, no phone-country library, no parked-domain classifier and no
  website check in the current code.

### 5.4 API, persistence and frontend capabilities

- Current API modules: health, products, research, settings, email-accounts, prisma.
- No authentication; loopback-bound local deployment. Stage 05 must not assume public deployment.
- Current Prisma models relevant to Stage 05: `Research`, `ResearchStage01/02/03`, `Product`,
  `Setting`, `EmailAccount`. There is no Stage 05 relation.
- `GET /research/:jobId` returns the full persisted result verbatim; the frontend has a typed
  SDR-007 result compatibility layer and workspace tabs.
- Existing frontend patterns: server components for reads, client polling through same-origin route
  handlers, server actions for mutations, `Result` values, Zod at the wire boundary, Lite FSD
  (`entities/lead-qualification`, a future `features/qualify-research` and a future tab would fit
  the accepted architecture).

### 5.5 Gaps that Stage 05 must fill

1. No website reachability/HTTPS/certificate/redirect/parked check.
2. No source-validated address/country fields. Stage 04 validates contacts, prices and market
   quotes against page text, but **does not validate `name`, `address`, `city` or `country`**.
3. No phone-country parsing beyond a simple E.164 normalisation in profile building.
4. No job-level Stage 05 run, progress, lease, recovery or published-result concept.
5. No extended contact discovery; Stage 04 only fills one contact-page gap when it has a supplied
   contact link.
6. No bounded concurrency for thousands of companies.
7. No website/HTTPS or activity fields in the persisted result.

## 6. Read-only baseline analysis

### 6.1 Method

All database access used:

```sql
BEGIN TRANSACTION READ ONLY;
-- aggregate JSONB queries only
ROLLBACK;
```

No contact value, email address, telephone number, address or raw company profile was copied to
this document or exported. Only counts, booleans and the three owner-provided domains are stated.
No website request, DNS lookup, search or provider call was made.

### 6.2 Research baseline

| Measure | Value |
| --- | ---: |
| Research | `cmww8smxb0000z4swhooukamv` |
| Target country | Lithuania |
| Status | `COMPLETED` |
| Result schema | `schemaVersion: 1`, `completedThrough: 04-company-profiling` |
| Company profiles | 77 |
| Distinct domains / registrable domains | 77 / 77 |
| Offers | 173 |
| Offers with structured prices | 7 |
| Companies with structured prices | 5 |

This matches the owner-accepted SDR-007 Market confirmation: 173 offers, 7 offers with structured
prices, 5 companies with structured prices.

### 6.3 Profile field coverage (77 profiles)

| Field | Profiles with a usable value |
| --- | ---: |
| Company name | 69 |
| Legal name | 31 |
| Registration code | 14 |
| VAT number | 12 |
| Address | 41 |
| City | 40 |
| Country | 22 |
| Email (at least one) | 51 |
| Telephone (at least one) | 50 |
| Contact form URL | 6 |
| Profile source URLs | 74 |
| At least one offer | 77 |

Profile status distribution: **69 `profiled`, 8 `needs_review`, 0 `rejected`, 0 `error`**.

Contact entry counts: **63 email values**, **81 telephone entries**; all 63 email entries and all
81 telephone entries carry a source URL. The 81 phone entries contain 79 distinct normalised
values; two entries were not normalised. This is consistent with the SDR-007 UI's 63 unique email
values.

### 6.4 Offer, relevance and existing market information

| Measure | Value |
| --- | ---: |
| Offers | 173 |
| `a` offers / `b` offers | 16 / 157 |
| Offers with derived `market.status = target` | 4 |
| Offers with derived `market.status = unclear` | 169 |
| Offers with derived `market.status = other` | 0 |
| Offers with at least one market-evidence quote | 42 |
| Offers with `market.conflict = true` | 0 |
| Offers with `marketFrom03.status = target` | 159 |
| Offers with `marketFrom03.status = unclear` | 14 |
| Offers where `marketFrom03.status` differs from derived `market.status` | 155 |
| Companies with at least one `a` offer | 6 |
| Companies with at least one `b` offer | 75 |
| Companies with both `a` and `b` | 4 |
| Companies with at least one target-market offer | 4 |
| Companies with at least one market-evidence offer | 15 |
| Companies with at least one structured price | 5 |
| Companies with any market disagreement | 68 |

The existing data therefore does **not** show 159 confirmed target-market offers. It shows 159
Stage-03 target estimates that Stage 04 did not confirm; only 4 offers (4 companies) have a derived
target market. Stage 05 must not treat `marketFrom03.status = target` as a qualified local sale.

Offer-count distribution per company: 41 companies have 1 offer, 25 have 2–3, 10 have 4–9, 1 has
10+ (maximum 13).

**Commercial activity evidence is not persisted as a boolean.** The available proxies are:
77 companies with offers, 74 with at least one profile source URL, 69 `profiled`, 5 with a
structured price and 15 with market evidence. None of these is a website/HTTPS/active-business
check. Stage 05 must add the missing checks. Persisted baselines show **0 verified operational
websites and 0 verified valid-HTTPS websites**.

### 6.5 Geographic evidence coverage

`company.country` values in this research were 14 “lietuva”, 8 “lithuania” and 55 missing. There
was **no explicit foreign country value** in the persisted `country` field. This is an observation
about the field, not a claim that no company is foreign.

| Measure | Companies |
| --- | ---: |
| Explicit target country (Lithuania variants) | 22 |
| Explicit foreign country | 0 |
| Missing country | 55 |
| Address present | 41 |
| Address text mentioning Lithuania | 3 |
| At least one `+370` local phone | 48 |
| At least one non-`+370` international phone | 1 |
| Target country + local phone | 18 |
| Target country + no phone | 4 |
| Missing country + local phone | 30 |
| Missing country + no phone | 23 |
| Missing country + foreign phone | 1 |

This means the persisted geographic evidence is weak: 55 of 77 companies have no country field,
and only 18 have both an explicit target country and a local telephone. Stage 05 must validate
address/telephone evidence against fetched pages and perform bounded discovery; it must not infer
local operations from language, translation, `.eu`/`.com` domain or web presence.

### 6.6 Existing conflicting information

- 155 offers, belonging to 68 companies, have a Stage-03 market status different from the derived
  Stage-04 status.
- 0 offers have `market.conflict = true`; the conflict is mostly the expected
  `target (stage 03) → unclear (stage 04)` downgrade.
- Stage 04 profile status is not a product qualification: 69 `profiled` and 8 `needs_review`;
  0 `rejected`/`error`.
- Address/country fields are not individually source-validated; contact and price values are
  source-validated by Stage 04.

### 6.7 Duplicate baseline

Within the 77-company result:

- 77 distinct domains and 77 distinct registrable domains;
- 0 duplicate normalised company-name groups;
- 0 duplicate legal-name groups;
- 0 email values shared across different domains;
- 0 normalised telephone values shared across different domains.

This is a clean baseline but does not justify weak duplicate rules. Stage 05 still needs
deterministic cross-company duplicate keys (domain, registration/VAT, normalized phone plus name,
and strong name+address combinations) for other research runs.

### 6.8 Owner-provided acceptance cases (structural facts only)

No external request was made. Website/HTTPS status is therefore **not determined** for these
cases; only persisted structural coverage is reported.

| Domain | Name | Address/city | Country | Email | Phone | Sources | Offers (a/b) | Target/unclear | Prices | Stage 04 status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `brolistimber.eu` | yes | yes / yes | lietuva | 0 | 3 | 1 | 3 (0/3) | 0 / 3 | 0 | profiled |
| `dailylentes.eu` | no | yes / yes | missing | 0 | 0 | 1 | 1 (0/1) | 0 / 1 | 0 | needs_review |
| `decormania.eu` | yes | no / no | missing | 0 | 0 | 1 | 1 (0/1) | 0 / 1 | 0 | profiled |

Interpretation for design:

- **dailylentes.eu** is the website/HTTPS and commercial-website case. Its persisted profile has no
  name, country, email or telephone; Stage 05 must determine website/HTTPS/commercial activity and
  run bounded contact/geographic discovery. It must not pass on address/city alone.
- **Brolis Timber (`brolistimber.eu`)** is the missing-email case. It has a local country, address,
  city, three telephone entries and three `b` offers, but no email. Extended contact discovery is
  required; no email may be inferred from the domain.
- **decormania.eu** is the geographic-qualification case. It has no address, city, country, email
  or phone. Stage 05 must run bounded geographic/contact discovery and otherwise exclude with
  `COUNTRY_UNCONFIRMED`/`EMAIL_NOT_FOUND` rather than infer local operations.

These cases are acceptance inputs, not hardcoded rules or expected outcomes.

## 7. Proposed Stage 05 architecture

### 7.1 Module boundary

Proposed new API module, implemented later:

```text
apps/api/src/modules/lead-qualification/
├── lead-qualification.module.ts
├── lead-qualification.controller.ts
├── lead-qualification.service.ts          start/read/resume/publish orchestration
├── lead-qualification.runner.ts           bounded run loop + lease/heartbeat
├── lead-qualification.persistence.ts      Prisma access + atomic result writes
├── lead-qualification.prompt.ts           lead-qualification-semantic-v1
├── model/
│   ├── qualification.types.ts             versioned result contract
│   ├── qualification.schema.ts            Zod wire/storage schemas
│   ├── decision.ts                        pure mandatory-check decision table
│   ├── geography.ts                       address/country/phone rules
│   ├── duplicate.ts                       deterministic duplicate keys
│   └── fingerprint.ts                     canonical input/profile hashes
├── pipeline/
│   ├── public-url.ts                      SSRF-safe URL/DNS/redirect policy
│   ├── website-check.ts                   HTTPS/reachability/parked check
│   ├── contact-discovery.ts               existing contacts first, bounded pages/search
│   ├── evidence.ts                        URL + quote validation, no raw page text
│   └── semantic-review.ts                 at most one LLM call per company
└── (focused tests next to each pure module)
```

No generic workflow engine, queue library or new provider abstraction is proposed. The existing
Nest module, Prisma, `llmChat`, Exa and Firecrawl boundaries are sufficient; the run loop is a
small bounded concurrency pool.

### 7.2 Isolation from stages 01–04

- Stage 05 reads the persisted `Research.result`; it never calls stage 01/02/03/04 services and never
  writes to `researches.result`, stage tables or temp files.
- It does not modify shared utilities, prompts, provider configuration or research decision code.
- Its own URL guard, phone/address logic, contact extractor, prompts and settings are new and
  scoped to the module.
- A future automatic trigger will be a small post-completion call from the research completion
  path (or an equivalent launcher) that must never change the research COMPLETED outcome if Stage
  05 fails. That trigger is a separate authorization; this design only specifies it.

### 7.3 Automatic and independent execution

**Automatic (future):** after the final result and COMPLETED state are atomically persisted, the
research service (or a dedicated launcher called after it) creates a Stage 05 run with
`trigger = AUTO`. Stage 05 failure is recorded in its own run and never rolls back a completed
research. The trigger must be idempotent: a retry or duplicate completion cannot create a second
active run.

**Independent (development/historical):**

- `POST /research/:jobId/lead-qualification` creates a run from the already-persisted result.
- It does not re-run stages 01–04, does not use temp files, and does not start a paid research run.
- Only `COMPLETED` research with a readable `companies` array is eligible. The 33 historical
  completed rows without profiles return a clear `422`/input error; they cannot be qualified
  without a separately authorized recovery/import.

## 8. Exact processing flow and decision table

### 8.1 Per-run flow

1. **Input check:** research exists; status `COMPLETED`; result is an object with a valid
   `companies` array (versioned or historical unversioned). Parse each profile with the same
   compatibility discipline as SDR-007; malformed individual profiles become
   `PROCESSING_FAILED`, not a run crash.
2. **Run creation:** canonical `inputFingerprint` over target country, company keys/profile hashes,
   qualification version, prompt version and settings snapshot. Unique run per research+fingerprint;
   one active run per research (partial unique index). Claim `executionToken`/`leaseUntil`.
3. **Deterministic duplicate pass:** create identity keys and choose canonical companies.
4. **Per-company pipeline**, bounded concurrency:
   1. duplicate outcome;
   2. website/HTTPS/reachability check;
   3. if website passes, collect existing Stage 04 contacts/address/phone and run one bounded
      discovery bundle (contact/imprint/about/sales pages, then search fallback);
   4. deterministic geography, activity and relevance checks from Stage 04 + fetched evidence;
   5. at most one semantic LLM call only for unresolved semantic questions;
   6. mandatory decision and result persistence.
5. **Persist each result atomically** (result + run counters/progress). A company failure never
   aborts the run.
6. **Complete run:** all companies are terminal; set `COMPLETED`, `completedAt`, publish the run
   (one published run per research). A run-level input/DB/infrastructure failure sets `FAILED`; an
   expired lease sets `INTERRUPTED` and can be resumed.

### 8.2 Mandatory gates

A company is `ACCEPTED` only if every gate is `PASS`:

| Gate | PASS | FAIL | Technical / unresolved |
| --- | --- | --- | --- |
| Website | reachable, final valid HTTPS, certificate valid, active commercial site | confirmed dead/parked/abandoned | repeated timeouts/5xx/403/429, unsafe destination, TLS handshake failure that is not a confirmed certificate issue |
| Commercial activity | operational website content and/or source-backed offer evidence show an active business | parked, for-sale, expired, under-construction, no commercial content | ambiguous after bounded discovery → INSUFFICIENT_EVIDENCE; provider failure → PROCESSING_FAILED |
| Target country | address and telephone country confirmed consistent with target, or verified local branch/subsidiary | confirmed matching foreign address + foreign phone with no local branch | missing/conflicting evidence after discovery → COUNTRY_UNCONFIRMED |
| Business/product relevance | at least one source-backed Stage 03/04 offer in the researched product/category, with business identity | no relevant offer/assortment | ambiguous after one semantic review → INSUFFICIENT_EVIDENCE |
| Email | at least one source-backed business email | none after bounded discovery | provider failure → PROCESSING_FAILED |
| Duplicate | unique within the run | duplicate of a stronger record | duplicate detection unavailable → PROCESSING_FAILED (conservative) |

There is no weighted score. Any failed gate → `EXCLUDED`, with every confirmed reason retained.
No `NEEDS_REVIEW` exists in the contract.

### 8.3 Exclusion reason priority

All reasons are stored; one deterministic `primaryExclusionReason` is chosen for UI grouping:

1. `DUPLICATE_COMPANY`
2. `WEBSITE_UNAVAILABLE`
3. `NO_VALID_HTTPS`
4. `INACTIVE_BUSINESS`
5. `COUNTRY_MISMATCH`
6. `COUNTRY_UNCONFIRMED`
7. `IRRELEVANT_BUSINESS`
8. `EMAIL_NOT_FOUND`
9. `INSUFFICIENT_EVIDENCE`
10. `PROCESSING_FAILED` (only when no higher-confidence business reason exists)

`PROCESSING_FAILED` sets `metadata.technicalFailure = true`; it is never presented as a confirmed
business rejection.

### 8.4 Website decision table

| Observation | Outcome |
| --- | --- |
| DNS NXDOMAIN / no A/AAAA | `WEBSITE_UNAVAILABLE` (confirmed) |
| Root returns 404/410 | `WEBSITE_UNAVAILABLE` (confirmed) |
| HTTP only, no HTTPS endpoint | `NO_VALID_HTTPS` |
| TLS certificate invalid/expired/self-signed/wrong host | `NO_VALID_HTTPS` |
| Valid HTTPS final URL, active commercial content | website PASS |
| Parked/for-sale/expired/suspended/under-construction markers | `INACTIVE_BUSINESS` |
| Temporary timeout/reset/5xx/403/429 after bounded retries | `PROCESSING_FAILED` (technical) |
| Unsafe redirect, private IP, non-HTTP(S), credentials in URL | `PROCESSING_FAILED` (technical/security) |
| Ambiguous content after bounded semantic review | `INSUFFICIENT_EVIDENCE` |

Valid HTTPS is a product rule, not a claim that every HTTP-only business is inactive. Certificate
validation is never disabled. HTTP → HTTPS redirects are accepted only when the final destination
is valid HTTPS. Cross-registrable redirects are followed only for identity-preserving cases; a
redirect to a marketplace/parking page is not the company's website.

### 8.5 Deterministic target-country rules

Definitions:

- **Local address:** an address whose country is the target country and whose street/address and
  city are present (or a legal-imprint page supplies the full address).
- **Foreign address:** a confirmed address in a different country.
- **Local phone / foreign phone:** E.164 phone parsed to a country; a phone with no reliable
  international form is unknown, not local.
- **Local branch:** an explicitly company-attributed page showing a local address and local phone
  (branch, subsidiary, showroom, local distributor tied to the company).
- **Translated site / language / `.eu` or `.com` / country-language content:** never geographic
  evidence by itself.

| Address | Phone | Rule |
| --- | --- | --- |
| Local | Local | PASS (after page/source validation when possible) |
| Local | Missing | Bounded discovery for a local phone or branch. If none: `COUNTRY_UNCONFIRMED` |
| Local | Foreign | Conflict discovery. If a local branch/local address plus local phone is verified: PASS; otherwise `COUNTRY_UNCONFIRMED` |
| Foreign | Foreign | Matching foreign is a strong exclusion signal. Run bounded local-branch discovery; if a verified local branch exists: PASS; otherwise `COUNTRY_MISMATCH` |
| Foreign | Local | Conflict discovery. If the local address can be verified: PASS; otherwise `COUNTRY_UNCONFIRMED` |
| Missing | Local | Discovery for a local address/legal imprint. If verified: PASS; otherwise `COUNTRY_UNCONFIRMED` |
| Missing | Foreign | Discovery; if a local branch is verified: PASS; otherwise `COUNTRY_UNCONFIRMED` |
| Missing | Missing | Discovery; if local address+phone are verified: PASS; otherwise `COUNTRY_UNCONFIRMED` |
| Multiple locations | Any | PASS if at least one verified local operational branch/subsidiary has local address and local phone and is explicitly attributed to the company; a foreign HQ alone does not disqualify |
| Conflicting local/foreign evidence unresolved | Any | `COUNTRY_UNCONFIRMED`; do not invent local operations |

Address/country normalisation uses `i18n-iso-countries` (already present) plus a locale-aware
country-name matcher. Phone parsing should use a maintained E.164 library such as
`libphonenumber-js` (new dependency requires separate approval) or an equivalent reviewed static
calling-code table. Shared calling codes (for example NANP) must be handled as multiple candidate
countries, not guessed. Address/country/phone values are revalidated against fetched page evidence;
Stage 04 fields are not individually source-validated.

## 9. Programmatic versus LLM responsibilities

### 9.1 Deterministic code (preferred)

- Read/validate persisted result; profile hashing and canonical fingerprints.
- Domain, email, phone, VAT/code and address normalisation where possible.
- Country parsing and phone-country parsing.
- Duplicate keys and canonical selection.
- URL safety, DNS pinning, redirect validation, TLS/certificate handling, timeouts and retries.
- HTTP status, parked/abandoned marker checks, body/empty checks.
- Email extraction from fetched text/mailto links; source URL validation; role extraction.
- Existing Stage 04 contacts first; source-backed evidence only.
- Relevance from Stage 03/04 offer verdict/item/source; target-country evidence from
  address/phone/local branch.
- All decision-table gates, exclusion reasons, counts, persistence, publication, progress.
- No LLM for anything that can be decided by these rules.

### 9.2 One bounded semantic call per ambiguous company

A single call (`lead-qualification-semantic-v1`, DeepSeek flash, temperature 0, JSON output) is
allowed only when deterministic checks leave a semantic question unresolved, for example:

- the website is reachable but content is ambiguous between active commercial and abandoned;
- a local branch/imprint statement needs interpretation;
- Stage 04 offers are category-only (`b`) and the assortment relevance to the researched category
  is genuinely ambiguous.

It is **not** called when a deterministic gate already excludes the company (e.g. missing email,
confirmed foreign address+phone, no valid HTTPS) or when Stage 04 evidence already decides the
question. Maximum **one LLM call per company**, zero for most companies. Prompt input is bounded to
about 16,000 characters: target country/language, product/category, company identity, Stage 04 offer
summary, and at most three short page excerpts. The model may only classify and quote supplied
text; it may not invent emails, phones, addresses, URLs or facts.

## 10. Prompt responsibilities and output contract

Prompt version: `lead-qualification-semantic-v1`.

**Responsibilities:**

1. Classify active commercial activity as `active | inactive | unclear`, with verbatim quotes and
   supplied source URLs.
2. Classify local/foreign/unclear geographic presence, including local branch/subsidiary evidence,
   with verbatim quotes and supplied URLs.
3. Classify commercial relevance to the product/category as `relevant | irrelevant | unclear`,
   referencing supplied Stage 03/04 offer ids and quotes.
4. Return optional page/link choices for bounded follow-up only when the answer depends on them.
5. Never extract or invent contact values, addresses, prices, certificates or HTTP facts; those
   are deterministic.

**Typed output (Zod-validated; all quotes must occur verbatim in the supplied text and all URLs
must be supplied URLs):**

```json
{
  "activity": "active | inactive | unclear",
  "activityEvidence": [
    { "quote": "<verbatim>", "sourceUrl": "<supplied URL>" }
  ],
  "geography": "local | foreign | unclear",
  "geographyEvidence": [
    {
      "kind": "address | branch | legal | pickup",
      "quote": "<verbatim>",
      "sourceUrl": "<supplied URL>"
    }
  ],
  "localBranch": {
    "present": true,
    "quote": "<verbatim>",
    "sourceUrl": "<supplied URL>"
  },
  "relevance": "relevant | irrelevant | unclear",
  "relevanceEvidence": [
    {
      "offerId": "<supplied offer id or null>",
      "quote": "<verbatim>",
      "sourceUrl": "<supplied URL>"
    }
  ],
  "followUpLinks": [
    { "url": "<supplied URL>", "kind": "contact | imprint | about | products" }
  ],
  "notes": "<one short sentence or null>"
}
```

`localBranch` is nullable/absent when not applicable. A malformed answer, provider error or quote
that cannot be validated is a technical failure for that company, not a business rejection.

## 11. Versioned Stage 05 data contract

### 11.1 Constants and enums

```ts
export const LEAD_QUALIFICATION_SCHEMA_VERSION = 1;
export const LEAD_QUALIFICATION_VERSION = 'lead-qualification-v1';
export const LEAD_QUALIFICATION_PROMPT_VERSION = 'lead-qualification-semantic-v1';

type Decision = 'ACCEPTED' | 'EXCLUDED';
type CheckStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_RUN';
type ExclusionReason =
  | 'WEBSITE_UNAVAILABLE'
  | 'NO_VALID_HTTPS'
  | 'INACTIVE_BUSINESS'
  | 'COUNTRY_MISMATCH'
  | 'COUNTRY_UNCONFIRMED'
  | 'IRRELEVANT_BUSINESS'
  | 'EMAIL_NOT_FOUND'
  | 'DUPLICATE_COMPANY'
  | 'INSUFFICIENT_EVIDENCE'
  | 'PROCESSING_FAILED';
```

### 11.2 Result shape

```ts
type QualificationCheck = {
  status: CheckStatus;
  reason: ExclusionReason | null;
  evidence: EvidenceRef[];
  details?: Record<string, unknown>; // validated per check schema, no raw page text
};

type EvidenceRef = {
  url: string; // validated HTTP(S)
  kind: 'website' | 'address' | 'phone' | 'email' | 'offer' | 'legal' | 'search';
  quote?: string; // max 500 chars, verbatim when supplied
  source: 'stage04' | 'http' | 'firecrawl' | 'exa' | 'semantic';
  observedAt: string;
};

type ContactRecord = {
  value: string;
  role: 'sales' | 'general' | null;
  sourceUrl: string;
  discoveredBy: 'stage04' | 'contact-page' | 'imprint' | 'about' | 'search' | 'directory';
};

type LeadQualificationResult = {
  schemaVersion: 1;
  source: {
    researchId: string;
    companyKey: string; // stable domain key
    sourceIndex: number; // index in research.result.companies
    domain: string;
    profileHash: string; // SHA-256 of canonical source profile
  };
  decision: Decision;
  primaryExclusionReason: ExclusionReason | null;
  exclusionReasons: ExclusionReason[];
  checks: {
    website: QualificationCheck & {
      finalUrl: string | null;
      httpStatus: number | null;
      httpsValid: boolean;
      certificateValid: boolean;
      redirects: number;
      temporary: boolean;
    };
    activity: QualificationCheck;
    geography: QualificationCheck & {
      addressCountry: string | null;
      phoneCountries: string[];
      localPresence: boolean;
      foreignPresence: boolean;
      conflict: boolean;
    };
    relevance: QualificationCheck & {
      matchedOfferIds: string[];
      aOffers: number;
      bOffers: number;
      targetMarketOffers: number;
    };
    email: QualificationCheck & { addresses: ContactRecord[] };
    duplicate: QualificationCheck & {
      canonicalCompanyKey: string | null;
      matchedOn: ('domain' | 'vat' | 'registration' | 'phone' | 'name+address')[];
    };
  };
  contacts: {
    emails: ContactRecord[];
    phones: ContactRecord[];
  };
  evidenceSources: EvidenceRef[];
  metadata: {
    qualificationVersion: string;
    promptVersion: string | null;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    fetches: number;
    searches: number;
    llmCalls: number;
    promptTokens: number | null;
    completionTokens: number | null;
    retries: number;
    limitReached: boolean;
    technicalFailure: boolean;
  };
};
```

The original `CompanyProfile` is never modified or deleted. The result references it by
`researchId`, `sourceIndex`, `domain`, `companyKey` and `profileHash`; the run stores the full
`inputFingerprint` and the source result schema version. `profileHash` changes if the source profile
changes, which invalidates the run fingerprint. Full source profiles are not duplicated into
Stage 05.

`contacts` contains only source-backed values. It does not contain a verification or deliverability
claim and does not contain marketing permission. Downstream communication eligibility remains a
separate gate (SDR-008/SDR-009).

## 12. Persistence architecture

### 12.1 Proposed Prisma models

The current schema has no Stage 05 models. Implementation will require a separately authorized
additive migration. Preferred two-table design:

```prisma
enum LeadQualificationRunStatus {
  QUEUED
  RUNNING
  COMPLETED
  INTERRUPTED
  FAILED
}

enum LeadQualificationTrigger {
  AUTO
  MANUAL
}

enum LeadQualificationDecision {
  ACCEPTED
  EXCLUDED
}

model LeadQualificationRun {
  id                      String                      @id @default(cuid())
  researchId              String
  research                Research                    @relation(fields: [researchId], references: [id], onDelete: Cascade)
  status                  LeadQualificationRunStatus  @default(QUEUED)
  trigger                 LeadQualificationTrigger
  targetCountry           String
  qualificationVersion    String
  promptVersion           String?
  inputFingerprint        String
  sourceResultSchemaVersion Int?
  companyCount            Int                         @default(0)
  processedCount          Int                         @default(0)
  acceptedCount           Int                         @default(0)
  excludedCount           Int                         @default(0)
  technicalFailureCount   Int                         @default(0)
  executionToken          String?
  executionLeaseUntil     DateTime?
  lastHeartbeatAt         DateTime?
  startedAt               DateTime?
  completedAt             DateTime?
  publishedAt             DateTime?
  error                   String?
  createdAt               DateTime                    @default(now())
  updatedAt               DateTime                    @updatedAt
  results                 LeadQualificationResult[]

  @@unique([researchId, inputFingerprint])
  @@index([researchId, createdAt])
  @@index([status, executionLeaseUntil])
  @@map("lead_qualification_runs")
}

model LeadQualificationResult {
  id                    String                      @id @default(cuid())
  runId                 String
  run                   LeadQualificationRun        @relation(fields: [runId], references: [id], onDelete: Cascade)
  sourceCompanyIndex    Int
  sourceCompanyKey      String
  domain                String
  companyName           String?
  legalName             String?
  country               String?
  profileHash           String
  decision              LeadQualificationDecision
  primaryExclusionReason String?
  exclusionReasons      String[]                    @default([])
  checks                Json
  contacts              Json
  evidenceSources       Json
  metadata              Json
  createdAt             DateTime                    @default(now())
  updatedAt             DateTime                    @updatedAt

  @@unique([runId, sourceCompanyIndex])
  @@index([runId, decision])
  @@index([runId, primaryExclusionReason])
  @@map("lead_qualification_results")
}
```

Why this is sufficient and why no extra tables:

- One run row holds orchestration, ownership, progress, versions, fingerprint, publication and
  aggregate counts.
- One result row per source company holds the complete typed payload. Checks/contacts/evidence are
  JSON because they are read as a unit, validated by Zod on write/read, and would otherwise create
  many join tables for no query need. Decision and primary reason are scalar columns for filtering.
- No separate contacts table: contacts are few per company and always presented with their result;
  the communication module can query `contacts` JSON or a future derived view if needed.
- No separate evidence table: evidence is immutable per result and bounded.
- No Stage 05 table replaces or copies the research result.
- No modification to `Research` beyond a future relation field; source result remains the authority.

### 12.2 Constraints and concurrency

Required raw partial unique indexes (created in the future migration, since Prisma cannot express
them directly):

```sql
CREATE UNIQUE INDEX lead_qualification_one_active_run_per_research
ON lead_qualification_runs (research_id)
WHERE status IN ('QUEUED', 'RUNNING');

CREATE UNIQUE INDEX lead_qualification_one_published_run_per_research
ON lead_qualification_runs (research_id)
WHERE published_at IS NOT NULL;
```

- `@@unique([researchId, inputFingerprint])` prevents duplicate work for the same input and
  version. A retry uses the existing run; a new algorithm/prompt/config version creates a new
  fingerprint and a new run.
- The partial active-run index prevents conflicting concurrent runs; the execution token and
  lease make writes ownership-guarded like the research lease.
- Per-company `@@unique([runId, sourceCompanyIndex])` makes incremental processing idempotent.
- `profileHash` plus `inputFingerprint` binds results to the exact source profiles.
- `publishedAt` identifies the one downstream result per research. A later completed run may
  replace it only by clearing the previous published marker and setting the new one in one
  transaction; the partial unique index enforces “one published”.

### 12.3 Run states and recovery

| State | Meaning |
| --- | --- |
| `QUEUED` | Run created, not yet processing |
| `RUNNING` | Processing with a live token/lease and heartbeat |
| `COMPLETED` | Every company reached a terminal result; safely publishable |
| `INTERRUPTED` | Lease expired/process stopped; results already written are durable and can resume |
| `FAILED` | Run-level input/persistence failure; no publish |

Per-company `PROCESSING_FAILED` results are terminal exclusions with `technicalFailure = true`;
they do not make the whole run `FAILED`. Resume processes only companies without a result or with a
technical failure; it never reprocesses committed business decisions. The heartbeat and lease use
the existing research pattern, without changing research code.

### 12.4 Publication

When all companies have a persisted result, the runner sets `COMPLETED`, `completedAt`, counters
and `publishedAt` in one transaction (clearing the previous published run for the research). The
published run is the only Stage 05 result downstream communication may read. A run with zero
accepted leads is still a valid completed/published result (empty lead list). A run-level failure
is never published.

## 13. Proposed API and frontend integration

### 13.1 API endpoints (future, not implemented)

| Method / path | Purpose |
| --- | --- |
| `POST /research/:jobId/lead-qualification` | Create or return the idempotent Stage 05 run for a completed research; `202 { runId, status }` |
| `GET /research/:jobId/lead-qualification` | Latest or published run summary for a research |
| `GET /lead-qualification-runs/:runId` | Run status, progress, counts, versions, error |
| `POST /lead-qualification-runs/:runId/resume` | Resume an `INTERRUPTED` run; retry pending/technical-failed companies; `202` |
| `GET /lead-qualification-runs/:runId/results` | Paginated results; filters `decision`, `primaryExclusionReason`, `technicalFailure`, `q`; cursor/limit (default 50, max 100) |
| `GET /lead-qualification-runs/:runId/results/:resultId` | One result with checks, contacts and evidence |

Error semantics:

- 404 research/run not found.
- 409 research not `COMPLETED`, no readable company profiles, or an active run conflict.
- 422 completed historical research without `companies` (input unavailable).
- 409 resume when the run is not resumable or has no pending work.
- All responses are Zod-typed; the browser never calls the API directly (same-origin proxy/server
  action as in the existing architecture).

Run response:

```json
{
  "id": "run_...",
  "researchId": "...",
  "status": "RUNNING",
  "trigger": "MANUAL",
  "targetCountry": "Lithuania",
  "qualificationVersion": "lead-qualification-v1",
  "promptVersion": "lead-qualification-semantic-v1",
  "inputFingerprint": "<sha256>",
  "companyCount": 77,
  "processedCount": 40,
  "acceptedCount": 12,
  "excludedCount": 28,
  "technicalFailureCount": 1,
  "lastHeartbeatAt": "<ISO>",
  "startedAt": "<ISO>",
  "completedAt": null,
  "publishedAt": null,
  "error": null
}
```

Result response shape follows §11.2. The wire contract must not include raw page text, tokens,
secrets or the full source profile.

### 13.2 Frontend integration (future)

- New `entities/lead-qualification`: Zod wire schemas (`runSchema`, `resultSchema`, filters,
  pagination), server client + browser client, types inferred from Zod.
- New `features/qualify-research`: server action to start; client polling hook through a
  same-origin route handler (same pattern as research polling; stop on terminal run status, retry
  transport/5xx only, abort on unmount).
- Research workspace gains a **Leads** tab (proposed order: Overview, Companies, Market, Leads,
  Contacts, Communication planned). The tab is shown only when the research has profiles; otherwise
  the existing result-availability explanation applies. No non-functional button.
- Read-only content:
  - run status/progress and trigger source;
  - accepted count, excluded count and exclusion-reason breakdown;
  - accepted lead table: company, domain, country, source-backed email/phone, product-match/offer
    evidence, website/HTTPS state, qualification version;
  - excluded ledger with reason filter and expandable checks/evidence; technical failures marked
    separately;
  - no NEEDS_REVIEW queue, no per-company review action, no recipient selection, no email editing,
    no account assignment, no sending.
- Accepted contacts display source URLs/roles, not a deliverability or permission claim.
- Empty states: no run, run in progress, no accepted leads, no excluded results, input unavailable.
- UI uses existing tokens/components; no new design system or component library.
- Downstream SDR-008/009 will read the published run; this design does not implement it.

## 14. Proposed resource limits for 2,000 companies

Baseline research has 77 companies; target scale is 2,000. Defaults are configurable and snapshotted
per run (new `leadQualification.*` settings, added only in the implementation authorization).

| Limit | Proposed default |
| --- | --- |
| Maximum companies per run | 5,000 (hard); default expected 2,000 |
| Maximum source result bytes | 50 MB |
| Website check attempts | 2 per company (one retry for transient only) |
| Website timeout / redirects / body cap | 10 s / 5 / 256 KB |
| Website concurrency | 8 |
| Existing Stage 04 contacts | Reused first; no fetch if email exists |
| Extra pages per missing-contact company | 3 (homepage, contact/imprint, about/sales) |
| Firecrawl fallback pages per company | 1 (only when direct fetch yields no usable text) |
| Exa search queries per company | 2 (only after page discovery fails) |
| Exa results per query / fetched results | 5 / 2 |
| Search concurrency | 4 |
| LLM calls per company | 1 maximum, only if ambiguous |
| LLM calls per run | 400 hard cap (20% of 2,000) |
| LLM input / output cap | 16,000 chars / 2,000 tokens |
| LLM concurrency | 3 |
| LLM retry | 1 transient retry; no repeated semantic retries |
| Run heartbeat / lease | 30 s / 2 min |
| Maximum run duration | 120 min; unfinished companies become PROCESSING_FAILED, run may resume |
| Evidence quotes per company | 20; quote max 500 chars |
| Result JSON per company | 100 KB hard cap; trims evidence, never truncates a decision |

Expected 2,000-company workload: 2,000 website checks; contact discovery only for companies
lacking email (roughly 34% in the baseline, about 680) with at most 3 pages and 2 searches each;
LLM only for unresolved semantic cases, hard-capped at 400. This is practical with the existing
providers and no queue framework.

Processing metadata records actual `fetches`, `searches`, `llmCalls`, prompt/completion tokens,
retries, duration, `limitReached` and technical failures. Actual provider charges are taken from
provider billing/usage, not invented; no cost estimate is fabricated when a provider exposes none.

## 15. Regression and real-world validation plan

### Phase 1 — deterministic and synthetic unit tests

- URL safety: private/loopback/link-local/CGNAT/reserved addresses, IPv4-mapped IPv6, credential
  URLs, non-HTTP(S), redirect chains, DNS pinning, no certificate validation bypass.
- Website classification: valid HTTPS, HTTP-only, expired/self-signed certificate, 404/410, DNS
  failure, timeouts, 5xx/403/429, parked/abandoned markers, cross-registrable redirect.
- Geography: local/foreign/missing address and phone, conflicts, multiple locations, local branch,
  translated site not evidence, shared calling codes, unnormalised phones.
- Contact extraction: source-backed email, role, duplicate values, placeholder/fabricated patterns,
  no domain-pattern inference, missing email.
- Duplicate keys and canonical selection.
- Mandatory decision table: every exclusion code, multiple reasons, technical vs business failure,
  no NEEDS_REVIEW, no score.
- Versioned contract Zod, fingerprint stability, source profile hash, run/result wire schemas.
- Resource-limit and retry behavior with mocked clocks.

### Phase 2 — mocked integration tests

Mock safe HTTP server responses, Exa, Firecrawl, LLM and Prisma/DB boundaries:

- run start/idempotency/active-run conflict;
- per-company durable writes and counters;
- one company failing without aborting the run;
- resume after interruption skips committed results;
- published run uniqueness;
- full result API filters/pagination;
- frontend polling and empty/error/technical states.

### Phase 3 — small controlled real-company pilot

Separately authorized, bounded real providers (10–20 companies, including the owner cases but
without hardcoded outcomes):

- dailylentes.eu — website/HTTPS/commercial activity;
- Brolis Timber — missing email discovery;
- decormania.eu — geographic discovery;
- a few companies with local address/phone, a foreign company, and a missing-contact company.

Capture decisions, reasons, sources, usage, cost, duration and false positives/negatives.

### Phase 4 — full run against the existing 77-company research

Separately authorized real execution against `cmww8smxb0000z4swhooukamv` via the independent
endpoint. Verify:

- 77 results persisted separately; research result unchanged;
- accepted/excluded counts and reason breakdown;
- newly discovered source-backed emails;
- geographic validation outcomes;
- no duplicate/source fabrication;
- actual search/fetch/LLM usage, cost and duration;
- resume/idempotency and published run.

### Phase 5 — scalability assessment

Synthetic 2,000-profile run with mocked providers, plus a bounded real subset if authorized.
Measure throughput, memory, DB write latency, retry behavior and cap handling. Do not infer real
provider cost from synthetic runs.

Measurable outcomes: accepted/excluded counts; exclusions by reason; new source-backed emails;
geographic validation results; search/fetch/LLM usage; actual processing cost; duration; duplicate
detection; processing failures/technical rate; false-positive/false-negative review of the pilot.

## 16. Smallest practical implementation sequence

Implementation is not authorized now. The smallest ordered sequence after approval:

1. **Pure contract and rules:** versioned types/Zod, decision table, duplicate keys, geography
   normalization, fingerprint. Synthetic unit tests. No network, no DB.
2. **Safe URL/website checker:** new public-address/URL guard and `website-check.ts`, with mocked
   TLS/HTTP tests. No changes to stages 01–04.
3. **Contact discovery and evidence:** existing Stage 04 contacts first, bounded page/search
   discovery, deterministic email extraction/source validation, one-page Firecrawl fallback.
4. **Semantic reviewer:** one-call prompt, strict quote/URL validation, provider failure handling.
5. **Persistence contract:** additive Prisma models/migration (separate authorization), run/result
   repository, atomic per-company writes, lease/heartbeat, partial unique indexes.
6. **Run orchestration and API:** runner, idempotent start, resume, result queries; tests.
7. **Automatic post-Stage-04 trigger:** isolated launcher after persisted completion (separate
   ResearchService authorization).
8. **Frontend Leads tab:** entity schemas, server action, polling, accepted/excluded read-only UI.
9. **Pilot and full baseline evaluation** with separate provider/data authorization.
10. **Scalability tuning** only after measured pilot data.

No generic workflow engine, queue framework or speculative multi-table redesign is included.

## 17. Risks and unresolved decisions

### Risks

1. **Stage 04 geographic data is sparse and not field-validated.** 55/77 lack country; 36 lack
   address; address/country are not quote-validated. Stage 05 discovery may exclude many companies,
   especially under strict precision.
2. **Stage 04 market status is unreliable for qualification.** 155 offers/68 companies disagree
   with Stage 03; only 4 target offers. Stage 05 must independently validate local presence.
3. **Website validation is inherently adversarial.** Bot protection, JS-heavy sites, CDNs,
   parking and expired certificates can produce false negatives; temporary failures must remain
   technical, not business rejection.
4. **Phone-country parsing needs a reviewed library/table.** Shared calling codes and local-format
   numbers can be ambiguous; no local inference is allowed.
5. **Email discovery is cost/time sensitive.** Firecrawl/Exa/LLM calls at 2,000 companies need hard
   caps and measurement; public contact discovery does not establish marketing permission.
6. **Duplicate detection can wrongly merge companies.** Use only high-confidence keys; prefer
   exclusion/duplicate review by evidence over aggressive merging; no human review queue.
7. **Automatic trigger changes the frozen research completion path.** It must be isolated,
   idempotent and never roll back a valid COMPLETED research.
8. **Historical research without companies cannot be qualified.** 33 completed rows need separate
   recovery/import authorization.
9. **No authentication** on the current API; Stage 05 result/contact exposure must remain local and
   later protected with the broader security work.
10. **Budget caps reached** produce technical failures; they must not silently become business
    exclusions.

### Unresolved owner/architect decisions

1. Dependency approval for `libphonenumber-js` (or an approved static calling-code alternative).
2. Whether local address **without** a telephone may ever be accepted after discovery; this design
   recommends `COUNTRY_UNCONFIRMED` for precision unless a local branch supplies both.
3. Whether a foreign address+phone may be overridden by a local branch/subsidiary; this design
   allows it only with explicit company-attributed local address + local phone evidence.
4. Exact acceptance of a `b`-only category offer for relevance, and whether one semantic review is
   required when no `a` offer exists.
5. Whether directory-hosted emails are acceptable, or only company-controlled pages/imprints.
6. Exact LLM/search/fetch budgets and acceptable cost for 2,000 companies.
7. Whether Stage 05 runs automatically for every new completion immediately or via a separate
   worker/trigger after deployment.
8. Publication policy if some companies have technical failures; this design publishes accepted
   results from a COMPLETED run and keeps technical exclusions distinguishable.
9. Historical profile recovery strategy for the 33 rows without companies (not authorized here).
10. Frontend tab placement and whether a run can be manually retried by the owner; no mandatory
    per-company review is implied.

## 18. Changed files, preservation and verification

Authorized changes for this design assignment:

- new `docs/tasks/SDR-007A-lead-qualification-contact-discovery.md`;
- `docs/tasks/README.md` registration/status.

No production code, test, mock API, Prisma schema, migration, prompt, provider, `.env`, dependency
or environment file was changed. No database write, research execution, external website request,
provider call or paid API call was made. The 18 excluded untracked artifacts were re-hashed after
this documentation write: **18/18 unchanged**, zero missing, and they remain unstaged.

The design content is complete and the cleanup operation is verified in §19.8. The task is
`READY_FOR_HUMAN_REVIEW`, not `DONE`; the Stage 05 backend implementation remains pending and
SDR-008 was not started.

## 19. Historical incomplete-research cleanup (2026-11-26)

This section records the separately authorized maintenance operation. It does not authorize Stage
05 implementation, schema changes or any further deletion.

### 19.1 Preflight

Read-only preflight matched the owner's expected baseline exactly:

| Measure | Actual |
| --- | ---: |
| Research records | 42 |
| COMPLETED | 37 |
| FAILED | 3 |
| INTERRUPTED | 2 |
| Researches with `companies` array | 4 |
| Non-empty company-profile arrays | 4 |
| Empty `companies` arrays | 0 |
| Completed without a companies array | 33 |
| Company profiles | 223 |
| Offers | 449 |
| Stage-01 / stage-02 / stage-03 rows | 5 / 3 / 5 |
| Products / settings / email accounts | 5 / 1 / 2 |
| Active research (`QUEUED`/`RUNNING`) | 0 |
| Active leases | 0 |
| Lead-qualification tables | 0 |
| Migration records / finished | 10 / 10 |

Foreign-key inspection confirmed only the three stage-result tables reference `researches`, each
with `ON DELETE CASCADE`; 0 orphan stage rows existed. No other table references a research.

### 19.2 Retained completed researches

These four rows are the only completed records with a persisted `companies` array; all are
retained:

| Research | Profiles | Result MD5 |
| --- | ---: | --- |
| `cmwufvywl000054swzi6g3hrh` | 25 | `dd94a0f863635f0d064b47cba7de8a5f` |
| `cmwv2nvzp0000ooswc85ycpck` | 16 | `0f3cace554a18212de1d6a5610ccd707` |
| `cmwvzov2a0000h0swtjwaracp` | 105 | `f8a0dbcaa939a175db1bceae03958beb` |
| `cmww8smxb0000z4swhooukamv` | 77 | `3a4444046729b05090eb326ba05d5af1` |

Associated retained stage rows: 2 stage-01, 2 stage-02, 3 stage-03.

### 19.3 Exact deletion manifest

All 38 were deleted. Thirty-three were `COMPLETED` rows without any `companies` array; three were
`FAILED`; two were `INTERRUPTED`:

```text
cmwm6e7p900003wswdtgxia1j  COMPLETED
cmwm7j14b0000vsswahlk9ccd  COMPLETED
cmwmj5bg80000r0sw0m2ekeol  COMPLETED
cmwneme8f0000t8swrg5r9e04  COMPLETED
cmwney05h0000gcswho6prf6x  COMPLETED
cmwng22ni0000jgswrvac17px  COMPLETED
cmwng2apr0001jgsw04ul94x8  COMPLETED
cmwng9mo30000y0swaz3pp7hy  COMPLETED
cmwnhzq3m0000assw1cnqeq40  COMPLETED
cmwni8g0i00009cswqe503ov7  COMPLETED
cmwnj79ei0000roswvkqet7hk  COMPLETED
cmwnjruoh0000gkswu8tnqdku  COMPLETED
cmwnkp2dz00007wsw3r4lw3jr  COMPLETED
cmwnkq3dn00017wswj6d4c33s  COMPLETED
cmwnktd0b0000b4swgnw8i2pw  COMPLETED
cmwnoh4r6000064swevekjiox  COMPLETED
cmwnoi2o00000fkswlfrlmdyh  COMPLETED
cmwnoljne000024sw3unzodn9  COMPLETED
cmwnpi3pd0000k4swmcem4qrz  COMPLETED
cmwnq0jjx0000lcswja9aicua  COMPLETED
cmwnql1xh0000u8swvyznwev9  COMPLETED
cmwnr3qv30000asswsctip6dp  COMPLETED
cmwnred9j0000xoswa919bd3s  COMPLETED
cmwnwfmwl00006kswf3c4bs7p  COMPLETED
cmwnyqvqo0000rcswheb8szxa  COMPLETED
cmwoyi7hs0000h4swfo3847np  COMPLETED
cmwt2hmmc000068swyg7cg9gj  COMPLETED
cmwt7fcqy0000h0sw6e9wn19q  COMPLETED
cmwtrrja7000030swjrazhjfp  COMPLETED
cmwuq1ba8000050swpz1nrjaf  COMPLETED
cmwv1wth90000k4swa7xcdkzb  COMPLETED
cmww8fvj10000jsswie0qoq6r  COMPLETED
cmww8jv320000soswev0zfdrg  COMPLETED
cmwmj43vc000050swyeh3o16x  FAILED
cmwnp9nik0000e0swoijsqm85  FAILED
cmwtrnu0t00002cswb35kd50d  FAILED
cmwt361k50000awsw9cxb6c35  INTERRUPTED
cmwulexw20000pkswrnv11r86  INTERRUPTED
```

### 19.4 Protected backup

| Item | Value |
| --- | --- |
| Directory | `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-164739` |
| Archive | `sdr_assistant_full_20261126-164739.dump` |
| Size | 3,828,210 bytes |
| SHA-256 | `191c235ea0d4b0b8c549bbbbe1ef26eca89aaa5b3d5ef748fe802802dd7acaf7` |
| Format | PostgreSQL custom (`pg_dump -Fc`), exit 0 |
| ACL | inheritance disabled; explicit FullControl only for `ALFASISDEV\msmig`, `BUILTIN\Administrators` and `NT AUTHORITY\SYSTEM`; 0 `CodexSandboxUsers` ACEs |
| Table-data sections | exactly 8: `_prisma_migrations`, `email_accounts`, `products`, three research-stage tables, `researches`, `settings` |
| Complete read | `pg_restore --file=-` exit 0; no live restore |
| Container/host | size and SHA-256 equal; container temp dump removed |

No `.env`, encryption key or plaintext credential was backed up or copied.

### 19.5 Deletion transaction

One transaction, with temp candidate table and assertions before and after deletion:

- `stage-01` deleted: **3**
- `stage-02` deleted: **1**
- `stage-03` deleted: **2**
- `researches` deleted: **38**
- Post-transaction research count: **4**
- Post-transaction stage counts: **2 / 2 / 3**
- Products/settings/email accounts: **5 / 1 / 2**
- Orphans: **0**

The transaction committed only after those assertions passed. No product, setting, email account or
retained research/stage row was deleted.

### 19.6 Single read-only proof attempted

Command (executed once; not rerun):

```powershell
node "C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-164739\verify-cleanup.mjs"
```

Exit code: **1**. The proof passed the first **23** checks, including the exact deletion manifest,
affected counts, post-deletion counts, 223 profiles, 449 offers, retained result hashes and stage
counts, products/settings/email counts, active-run absence and retained-result structural equality.
It then failed before completing the remaining checks because the proof harness contained an extra
closing parenthesis in the retained-stage hash `stage03` subquery:

```text
PASS retained research result structure/hashes unchanged
ERROR:  syntax error at or near ")"
LINE 5: )::text;
...
PROOF_EXIT=1
```

This is a **proof-script defect**, not a database assertion failure; the command was not rerun and
no substitute proof was executed. The actual output before the harness failure was:

```text
SDR-007A historical incomplete research cleanup — read-only proof
checkpoint: 7810d5d9d2ab1fb230f95e971d564a0728e6df01
backup: C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-164739\sdr_assistant_full_20261126-164739.dump
baseline captured: 2026-11-26T14:49:57.894Z
deletion executed: 2026-11-26T14:50:20.779Z

PASS approved deletion manifest has 38 candidates
PASS 3 candidate stage-01 rows deleted
PASS 1 candidate stage-02 row deleted
PASS 2 candidate stage-03 rows deleted
PASS 38 incomplete researches deleted
PASS deletion transaction ended with 4 researches
PASS deletion transaction ended with no orphans
PASS 4 research records remain — 4
PASS all 4 retained researches are COMPLETED
PASS no failed/interrupted research remains
PASS all retained results have a companies array
PASS no retained result lost its profiles to an empty array
PASS 223 company profiles remain — 223
PASS 449 offers remain — 449
PASS 2 retained stage-01 rows — 2
PASS 2 retained stage-02 rows — 2
PASS 3 retained stage-03 rows — 3
PASS 5 products preserved
PASS 1 setting preserved
PASS 2 email accounts preserved
PASS no active research runs
PASS no qualification tables or runs exist
PASS retained research result structure/hashes unchanged
ERROR:  syntax error at or near ")"
LINE 5: )::text;
PROOF_EXIT=1
```

Consequently the following proof checks did not execute against the post-deletion state: retained
stage-row hash equality, FK/orphan re-check, candidate-row absence beyond the transaction
assertions, product/settings/email table hashes, schema fingerprint, source-tree/artifact hashes,
backup re-verification and final PASS marker. The pre-deletion baseline and the deletion
transaction's post assertions remain available as evidence in the backup directory
(`cleanup-baseline.json`, `deletion-result.json`, `backup-verification.json`,
`delete-incomplete.sql`).

The current database observable state is 4 researches, 223 profiles and 449 offers, with 2/2/3
retained stage rows and 0 active research runs. The 18 excluded artifacts remain byte-identical.
No code, schema, migration, product, setting, email account, historical file or artifact was
modified by the cleanup.

**Remaining action:** a corrected execution was authorized and attempted; it is recorded in §19.7
below and did not complete. A further corrected execution would require new owner authorization.
No further deletion or correction was performed at this point. The blocker was subsequently
cleared by the final proof in §19.8.

### 19.7 Authorized corrected proof — one attempt, not passed

The original failed proof script remains preserved as
`verify-cleanup.failed-evidence.mjs` in the backup directory, SHA-256
`823eb12bf5a4c1413eca72e50c5d27e08b4c4f13b11b825f5198d6451147471a`. The only script correction
was removal of one extra closing parenthesis from the `stage03` retained-stage hash subquery,
matching the already-correct `stage01`/`stage02` arguments. No assertion, baseline value or
expected result was changed; the original pre-deletion baseline was reused unchanged.

The corrected proof passed **51** assertions, covering every database deletion, retention, stage,
product, setting, email-account, schema, foreign-key, source-tree and 18-artifact check. It then
failed at the final backup SHA-256 assertion because the proof harness's `sha256File()` helper
resolved the absolute backup path against the repository root, producing a concatenated
non-existent path. The backup-size assertion immediately before it passed. The backup SHA-256,
`pg_restore` table-data count, full-archive read and final PASS marker did not execute.

Command executed exactly once:

```powershell
node "C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-164739\verify-cleanup.mjs"
```

Exit code: **1**.

Complete output:

```text
SDR-007A historical incomplete research cleanup — read-only proof
checkpoint: 7810d5d9d2ab1fb230f95e971d564a0728e6df01
backup: C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-164739\sdr_assistant_full_20261126-164739.dump
baseline captured: 2026-11-26T14:49:57.894Z
deletion executed: 2026-11-26T14:50:20.779Z

PASS approved deletion manifest has 38 candidates
PASS 3 candidate stage-01 rows deleted
PASS 1 candidate stage-02 row deleted
PASS 2 candidate stage-03 rows deleted
PASS 38 incomplete researches deleted
PASS deletion transaction ended with 4 researches
PASS deletion transaction ended with no orphans
PASS 4 research records remain — 4
PASS all 4 retained researches are COMPLETED
PASS no failed/interrupted research remains
PASS all retained results have a companies array
PASS no retained result lost its profiles to an empty array
PASS 223 company profiles remain — 223
PASS 449 offers remain — 449
PASS 2 retained stage-01 rows — 2
PASS 2 retained stage-02 rows — 2
PASS 3 retained stage-03 rows — 3
PASS 5 products preserved
PASS 1 setting preserved
PASS 2 email accounts preserved
PASS no active research runs
PASS no qualification tables or runs exist
PASS retained research result structure/hashes unchanged
PASS retained intermediate-stage row hashes unchanged
PASS no orphaned intermediate-stage rows
PASS all public foreign-key constraints validated
PASS all 38 deletion-candidate researches and stage rows are absent — 38 candidate IDs checked
PASS products, settings, email accounts and migration ledger unchanged
PASS database schema fingerprint unchanged — 9cb8d70682eac34978a489994c3fa6b3
PASS research foreign-key definitions unchanged
PASS research decision source tree unchanged — a9203348e6fe8ad431a6fc9d6be47c70fd56c467be589d51f519fa1b85cedc06
PASS historical research temp JSON artifacts unchanged — eb0787246be7e51fe826b2662e434081b63ed074780bf6c25cbee172718d9163
PASS excluded artifact unchanged: apps/api/src/modules/research/stages/04-company-profiling/SPEC.md
PASS excluded artifact unchanged: apps/api/test/company-profiling.batch.test.ts
PASS excluded artifact unchanged: apps/api/test/company-profiling.first-call.test.ts
PASS excluded artifact unchanged: apps/api/test/company-profiling.gap-fill.test.ts
PASS excluded artifact unchanged: apps/api/test/company-profiling.input.test.ts
PASS excluded artifact unchanged: apps/api/test/company-profiling.profile.test.ts
PASS excluded artifact unchanged: apps/api/test/fixtures/v5-16-domains.json
PASS excluded artifact unchanged: apps/api/test/research.04.integration.test.ts
PASS excluded artifact unchanged: apps/api/tmp-04-real-result.json
PASS excluded artifact unchanged: apps/api/tmp-run-real-04.mjs
PASS excluded artifact unchanged: pnpm-lock.yaml
PASS excluded artifact unchanged: pnpm-workspace.yaml
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json
PASS backup size unchanged — 3828210 bytes
node:fs:622
  return binding.open(
                 ^

Error: ENOENT: no such file or directory, open 'C:\Users\msmig\Projektai\sdr-assistant\C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-164739\sdr_assistant_full_20261126-164739.dump'
    at Object.openSync (node:fs:622:18)
    at Object.readFileSync (node:fs:488:35)
    at sha256File (file:///C:/Users/msmig/Projektai/_backupsForProjects/sdr-assistant-db-20261126-164739/verify-cleanup.mjs:82:13)
    at file:///C:/Users/msmig/Projektai/_backupsForProjects/sdr-assistant-db-20261126-164739/verify-cleanup.mjs:300:8
PROOF_EXIT=1
```

Assessment:

- All expected data results passed: 4 completed researches, 223 profiles, 449 offers, stage rows
  2/2/3, retained result and stage hashes unchanged, products/settings/email accounts unchanged,
  no orphans, schema and migration ledger unchanged, source tree and all 18 excluded artifacts
  unchanged.
- The proof did not complete the final backup re-verification. The backup was independently
  verified at creation (size, SHA-256, 8 table-data sections, complete read, protected ACL), but
  the corrected proof's backup SHA-256, restore-list and full-read checks did not execute.
- This is a proof-harness path defect, not a database assertion failure. Per the one-attempt
  restriction, the corrected proof was not rerun and no assertion was skipped or weakened.
- The associated cleanup blocker remained after this attempt. A final correction and proof were
  subsequently authorized and passed; see §19.8. SDR-007A remains unfinished and is not `DONE`.

### 19.8 Final authorized proof — passed

#### Preserved prior evidence

- Original SQL-failure harness: `verify-cleanup.failed-evidence.mjs`, SHA-256
  `823eb12bf5a4c1413eca72e50c5d27e08b4c4f13b11b825f5198d6451147471a`.
- Second failed harness: `verify-cleanup.path-failure-evidence.mjs`, SHA-256
  `caf4ff500e21f06faf5971cb10f1a6afa8fceeaf164d89d26e8b0c359851bfd8`.
- Second failed output: `proof-path-failure-output.txt`, 4,263 bytes, SHA-256
  `6d0e618f9eec415507d8b73f346661ab008e346e40a537ec43b3bad06de5139b`.
- The earlier proof evidence and output in §19.6/§19.7 remain unchanged.
- The original pre-deletion baseline (`cleanup-baseline.json`) was reused; it was not regenerated.

#### Exact harness corrections

1. Removed the single extra closing parenthesis from the retained-stage `stage03` subquery
   (§19.7). No assertion, expected value or baseline was changed.
2. Corrected only the absolute/relative path handling in `sha256File()`:

```js
import { isAbsolute, join, relative, resolve } from 'node:path';

function sha256File(path) {
  const absolute = isAbsolute(path) ? path : resolve(repo, path);
  return createHash('sha256')
    .update(readFileSync(absolute))
    .digest('hex');
}
```

This keeps absolute backup paths absolute and resolves relative artifact/source paths against the
repository root. No assertion semantics, expected hashes, expected counts or the baseline changed.

Before execution, the remaining backup assertions were inspected: expected SHA-256
`191c235ea0d4b0b8c549bbbbe1ef26eca89aaa5b3d5ef748fe802802dd7acaf7`, expected size 3,828,210
bytes, exactly 8 `TABLE DATA` sections, full `pg_restore --file=-` read, argv-array command
quoting, absolute backup/relative artifact path handling and non-zero-exit propagation. No further
harness defect was found.

Final harness SHA-256: `3ba68fe32d8471e3109f8f677c6236d80bc2d26bb40156c2e4902cec464de8d2`.

#### Proof command and result

Command executed exactly once:

```powershell
node "C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-164739\verify-cleanup.mjs"
```

Exit code: **0**.

Complete output:

```text
SDR-007A historical incomplete research cleanup — read-only proof
checkpoint: 7810d5d9d2ab1fb230f95e971d564a0728e6df01
backup: C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-164739\sdr_assistant_full_20261126-164739.dump
baseline captured: 2026-11-26T14:49:57.894Z
deletion executed: 2026-11-26T14:50:20.779Z

PASS approved deletion manifest has 38 candidates
PASS 3 candidate stage-01 rows deleted
PASS 1 candidate stage-02 row deleted
PASS 2 candidate stage-03 rows deleted
PASS 38 incomplete researches deleted
PASS deletion transaction ended with 4 researches
PASS deletion transaction ended with no orphans
PASS 4 research records remain — 4
PASS all 4 retained researches are COMPLETED
PASS no failed/interrupted research remains
PASS all retained results have a companies array
PASS no retained result lost its profiles to an empty array
PASS 223 company profiles remain — 223
PASS 449 offers remain — 449
PASS 2 retained stage-01 rows — 2
PASS 2 retained stage-02 rows — 2
PASS 3 retained stage-03 rows — 3
PASS 5 products preserved
PASS 1 setting preserved
PASS 2 email accounts preserved
PASS no active research runs
PASS no qualification tables or runs exist
PASS retained research result structure/hashes unchanged
PASS retained intermediate-stage row hashes unchanged
PASS no orphaned intermediate-stage rows
PASS all public foreign-key constraints validated
PASS all 38 deletion-candidate researches and stage rows are absent — 38 candidate IDs checked
PASS products, settings, email accounts and migration ledger unchanged
PASS database schema fingerprint unchanged — 9cb8d70682eac34978a489994c3fa6b3
PASS research foreign-key definitions unchanged
PASS research decision source tree unchanged — a9203348e6fe8ad431a6fc9d6be47c70fd56c467be589d51f519fa1b85cedc06
PASS historical research temp JSON artifacts unchanged — eb0787246be7e51fe826b2662e434081b63ed074780bf6c25cbee172718d9163
PASS excluded artifact unchanged: apps/api/src/modules/research/stages/04-company-profiling/SPEC.md
PASS excluded artifact unchanged: apps/api/test/company-profiling.batch.test.ts
PASS excluded artifact unchanged: apps/api/test/company-profiling.first-call.test.ts
PASS excluded artifact unchanged: apps/api/test/company-profiling.gap-fill.test.ts
PASS excluded artifact unchanged: apps/api/test/company-profiling.input.test.ts
PASS excluded artifact unchanged: apps/api/test/company-profiling.profile.test.ts
PASS excluded artifact unchanged: apps/api/test/fixtures/v5-16-domains.json
PASS excluded artifact unchanged: apps/api/test/research.04.integration.test.ts
PASS excluded artifact unchanged: apps/api/tmp-04-real-result.json
PASS excluded artifact unchanged: apps/api/tmp-run-real-04.mjs
PASS excluded artifact unchanged: pnpm-lock.yaml
PASS excluded artifact unchanged: pnpm-workspace.yaml
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json
PASS excluded artifact unchanged: src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json
PASS backup size unchanged — 3828210 bytes
PASS backup SHA-256 unchanged
PASS backup contains exactly 8 table-data sections — 8
PASS backup is fully readable by pg_restore

PASS: SDR-007A historical incomplete research cleanup
```

Final proof output: `proof-output.txt`, 3,842 bytes, SHA-256
`b0216978cb5d9058868a0998287a5ba4a7fc8a66e64806d9d9c598a02587d2eb`.
`proof-result.json` records the final inventory and hashes.

#### Closure

The historical incomplete-research cleanup maintenance operation is **successfully verified**.
The associated cleanup blocker is cleared. The database is in the verified final state: 4 completed
researches, 223 company profiles, 449 offers, stage rows 2/2/3, products 5, settings 1, email
accounts 2, no orphans, no active research or qualification runs. The protected backup at
`C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-164739` is intact and fully
readable, with SHA-256
`191c235ea0d4b0b8c549bbbbe1ef26eca89aaa5b3d5ef748fe802802dd7acaf7`.

No database write, deletion, restoration, baseline regeneration, application-code change,
research execution or provider call occurred during this final verification. No commit or push was
made. All 18 excluded artifacts are unchanged.

SDR-007A remains unfinished. The Stage 05 backend implementation is still pending separate
authorization; SDR-007A is `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 20. Stage 05 backend implementation attempt (2026-11-26)

### 20.1 Scope implemented

An isolated module was added under `apps/api/src/modules/lead-qualification` with:

- versioned contracts, source parser/fingerprint and input errors;
- deterministic activity, relevance, geography, decision and duplicate rules;
- static E.164 calling-code data and telephone-country classification;
- SSRF-safe public URL/DNS-pinning HTTP client and deterministic website validation;
- bounded contact/geographic discovery adapters over safe HTTP, Exa and Firecrawl;
- a versioned semantic prompt and quote/URL-validated one-call assessor;
- per-company qualification engine and run budget;
- additive `LeadQualificationRun` / `LeadQualificationResult` Prisma models;
- one additive migration under
  `apps/api/prisma/migrations/20261126173000_add_lead_qualification`;
- Prisma store, run lifecycle, lease/recovery/publication logic;
- read-only result and independent execution endpoints;
- `LeadQualificationModule` registration in `app.module.ts`;
- synthetic tests under `apps/api/test/lead-qualification/`.

No frontend, automatic ResearchService launching, live migration deployment, channel execution,
research-stage change or provider configuration change was made.

### 20.2 Single proof command and failed result

Command executed once:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run build -w @sdr-assistant/api
    if ($LASTEXITCODE -ne 0) {
        throw 'API build failed'
    }

    npm.cmd run test -w @sdr-assistant/api -- test/lead-qualification/
    if ($LASTEXITCODE -ne 0) {
        throw 'Stage 05 backend tests failed'
    }

    Write-Output 'PASS: SDR-007A Stage 05 backend implementation'
}
```

Exit code: **1**. Prisma Client generation succeeded; TypeScript failed before tests:

```text
src/modules/lead-qualification/lead-qualification.repository.ts(399,24): error TS1003: Identifier expected.
src/modules/lead-qualification/lead-qualification.repository.ts(474,24): error TS1003: Identifier expected.
npm error Lifecycle script `build` failed with error:
npm error code 2
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c prisma generate && tsc -p tsconfig.json
Exception: API build failed
```

Root cause: a text-replacement step changed both intended `this.prisma.$transaction(async (tx) =>`
calls into `this.prisma.(async (tx) =>`. After the failed proof, those two known expressions were
corrected to `this.prisma.$transaction(async (tx) =>`. **The approved proof was not rerun and the
test suite has not run.** The correction is unverified.

### 20.3 Consequences and remaining work

- The implementation files are present but the build is not proven after the correction.
- No test count or test PASS can be claimed.
- No migration was applied to the live database; no DB write or migration deployment occurred.
- No real provider request, website request, research execution, SMTP/IMAP action, frontend change,
  automatic launcher, commit or push occurred.
- The 18 excluded untracked artifacts remain byte-identical (18/18).
- The next authorized proof attempt must rerun the exact approved command. Further type or test
  failures may remain and must be reported without weakening the proof.

### 20.4 Changed inventory for this attempt

Modified:

- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `docs/tasks/README.md`

Added:

- the 18 files under `apps/api/src/modules/lead-qualification/`;
- `apps/api/prisma/migrations/20261126173000_add_lead_qualification/migration.sql`;
- the 10 files under `apps/api/test/lead-qualification/`.

No other tracked application file was modified. The task is `BLOCKED`, not `DONE`, pending an
authorized proof rerun.

### 20.5 Second authorized proof attempt (2026-11-26)

The two malformed `$transaction` expressions were inspected in context and correctly read
`this.prisma.$transaction(async (tx) => ...)`. A scan found no other accidental `$`-method
corruption. The Prisma schema generated successfully, and the Vitest directory filter selected all
nine Stage 05 test files (66 tests).

The same approved compound proof was executed once. Prisma Client generation and the API build
passed. The test phase failed with **40 passed / 26 failed / 0 skipped** (5 of 9 files failed):

| Test file | Result |
| --- | --- |
| `website.test.ts` | 11 tests, 2 failed |
| `input.test.ts` | 10 tests, 4 failed |
| `run.test.ts` | 11 tests, 10 failed |
| `large-run.test.ts` | 1 test, 1 failed |
| `engine.test.ts` | 9 tests, 9 failed |
| `semantic.test.ts` | 7 tests, passed |
| `geography.test.ts` | 8 tests, passed |
| `api.test.ts` | 4 tests, passed |
| `contacts.test.ts` | 5 tests, passed |

Representative failure causes:

1. **Test-fixture shape defect (24 tests).** `researchRecord()` placed flat `SourceCompany`
   objects directly into the persisted result. The production parser correctly expects the real
   persisted shape `{ company: {...}, offers: [...] }`, so it rejected every fixture as malformed.
   This affected input, engine, run and large-run tests.
2. **IPv4-mapped blocklist defect (2 tests).** The IPv6 subnet `::ffff:0:0/96` caused Node's
   `BlockList.check()` to classify ordinary public IPv4 addresses as blocked. Public
   `93.184.216.34` was reported private, which also broke the DNS-pinning test.

Corrections applied after the failed proof (not rerun):

- Added a test-only `persistedProfile()` conversion and used it in the input, engine, run, large-run
  and historical fixtures. No production parser behavior was changed.
- Removed the broad `::ffff:0:0/96` IPv6 blocklist entry and added explicit dotted IPv4-mapped
  address handling in `isPublicAddress()`.
- Deduplicated discovered emails/phones before returning discovery results (confirmed
  implementation defect, no test weakening).

The proof was **not rerun**; the test results above are the actual proof result. The corrections are
unverified. No test was skipped, removed or weakened. No migration was applied, no database write
or external request occurred, and the 18 excluded artifacts remain byte-identical.

A new authorized proof rerun is required to establish whether these corrections resolve all 26
failures and to obtain a final Stage 05 verification result. SDR-007A is `BLOCKED`, not `DONE`.

### 20.6 Third authorized proof attempt (2026-11-26)

The corrected persisted fixtures now mirror the frozen Stage 04 `CompanyProfile` nesting:
`domain`, `registrableDomain`, `status`, `company` (identity, contacts, `contactFormUrl`, `sources`),
full offer objects (`test` traits, page ids, `marketFrom03`, derived market decision and prices) and
`usage`. The production parser was not changed to accommodate fixtures.

The IP review identified the concrete cause of the remaining failures: one `net.BlockList` held
both IPv4 and IPv6 rules, and Node's IPv4 check consulted the IPv6 `::/3` rule, so public IPv4 was
classified as blocked. The proof result confirmed this before the correction:

```text
Test Files  1 failed | 8 passed (9)
     Tests  3 failed | 68 passed (71)
  Duration  1.62s
```

All failures were in `website.test.ts`:
`classifies public and reserved IPv4/IPv6 ranges`,
`classifies IPv4-mapped IPv6 in dotted and hexadecimal forms`, and
`returns the validated public DNS answer for pinning`. The input, engine, run, large-run, contacts,
semantic, geography and API files all passed. Exit code: **1**.

Corrections applied after the failed proof (not rerun):

- Split `BLOCKED_V4` and `BLOCKED_V6` and check each family against its own list.
- Removed the broad IPv4-mapped IPv6 subnet and added explicit dotted/hex mapped conversion.
- Added regression coverage for public/private IPv4, loopback, link-local, CGNAT, documentation,
  multicast, public/private IPv6, mapped dotted/hex forms, unsafe redirect targets, unsafe DNS
  answers, strict TLS options, DNS pinning and contact deduplication.
- Confirmed fixture structure against the frozen Stage 04 contract.
- Confirmed contact deduplication is scoped to one company's discovery result and preserves the
  first valid role/source evidence; it does not merge companies or discard distinct contacts.

The proof was not rerun. The post-proof separation correction is unverified; a new authorization is
required. No test was skipped, removed or weakened.

Contact-deduplication justification: discovery may read the homepage, contact/imprint/about/sales
pages and bounded search results for one company. Before the fix, the same published email or phone
could be appended once per page, producing duplicate contacts and duplicate source evidence in the
`DiscoveryResult`; `mergeContacts` deduplicated later, but the intermediate result and metadata were
inflated. `dedupeEmails`/`dedupePhones` now normalize and retain the first valid occurrence within a
single company, preserving its role and source URL. No contacts are merged across companies.

SDR-007A remains `BLOCKED`, not `DONE`.

## 21. Architect code-review corrections (2026-11-26)

### 21.1 Resolutions

| Architect finding | Resolution | Regression evidence |
| --- | --- | --- |
| Arbitrary two-letter words treated as ISO codes | `extractCountryCodes()` now indexes country names only; explicit identity fields still use `resolveCountryCode()` for real alpha-2 values | `geography.test.ts` → “does not treat a standalone two-letter word…” |
| Stored country/address treated as verified | `buildGeographySignals()` marks fields unverified; only source-backed page address evidence becomes local/foreign address evidence | “does not describe stored address/country fields…”, “passes a source-backed target address…” |
| Unsourced telephone proof | Phone signals require a source URL; unsourced values are discarded from geographic evidence | “does not use an unsourced telephone…” |
| Foreign match must exclude without search | Stage/verified foreign address signal + matching foreign phone + no local evidence/branch produces `COUNTRY_MISMATCH`; engine skips discovery/semantic | Engine “excludes foreign address plus foreign telephone…” |
| Conflicting foreign countries | Different foreign address and phone countries are conflicting evidence and require discovery | “treats a different foreign telephone country as conflicting evidence” |
| Multiple locations | Only source-backed local address or semantic local-branch evidence can pass; country mentions alone cannot | `geography.test.ts`, local-branch and conflicting tests |
| Empty geographic discovery | Discovery now extracts address evidence from source pages; engine uses homepage and discovery pages and drives discovery by missing evidence | Engine “performs geographic discovery even when an email already exists”; discovery contact/imprint tests |
| Contact-page priority | Discovered contact/imprint/legal/about/sales links and contact-like sources precede speculative paths and product sources | `contacts.test.ts` → “prioritizes discovered contact pages over product source pages” |
| Public directory contacts | Directory-like results are fetched with same-domain/directory destination checks; operator-domain emails and unrelated associations are rejected | “accepts a source-backed contact from a public business directory” |
| Fetch/search limits | Fetch attempts include failures; search-result fetch count is global per company; early stop when sufficient | “counts unsuccessful fetches…”, “stops discovery when…” |
| Firecrawl fallback | Only used when email/geography is still missing and a safe, unattempted contact URL exists; not based on all pages absent | “uses the scraper fallback only when evidence is still missing” |
| Semantic overrides confirmed FAIL | `semanticNeeded` is restricted to unresolved gates; `applySemantic` only changes UNKNOWN/unresolved `COUNTRY_UNCONFIRMED`; confirmed FAIL is preserved | Engine “does not let semantic acceptance override a confirmed relevance failure” |
| Large homepage starves contact/legal input | Semantic pages are prioritized and receipt budget is allocated per page; complete request is capped; focus and offer source URLs included; model recorded | `semantic.test.ts` → “allocates bounded input…” |
| Follow-up output unused | Removed `followUpLinks` from v2 prompt/schema/contract; prompt version is `lead-qualification-semantic-v2` | semantic tests, build |
| Contradictory semantics | Local-branch + foreign geography is rejected | “rejects a local branch that contradicts…” |
| Over-permissive activity | Historical offer URLs/arbitrary text length no longer pass; requires independent current commercial signals; coming-soon/under-construction alone is UNKNOWN, not parked | Engine “accepts an active commercial page containing a coming-soon announcement” |
| Operational failures | Discovery rethrows run-wide provider errors; semantic provider failures already propagate; business reasons are not assigned to provider outages | Engine “propagates a run-wide discovery provider failure”; service run-wide test |
| Duplicate identity | Legal-name-only matches no longer merge; domain/VAT/registration signals retained; legal identity is not described as confirmed | `run.test.ts` → “does not merge companies on unverified legal-name strings alone” |
| IP blocklist separation | Separate IPv4 and IPv6 `BlockList`; dotted/hex IPv4-mapped forms handled explicitly; strict TLS/redirect/DNS checks retained | `website.test.ts` (15 tests) |

### 21.2 Final proof

```text
✔ Generated Prisma Client (7.10.1) to .\src\generated\prisma in 198ms

 ✓ website.test.ts         (15 tests)
 ✓ geography.test.ts       (12 tests)
 ✓ input.test.ts           (10 tests)
 ✓ api.test.ts             (4 tests)
 ✓ engine.test.ts          (13 tests)
 ✓ run.test.ts             (12 tests)
 ✓ semantic.test.ts        (9 tests)
 ✓ contacts.test.ts        (11 tests)
 ✓ large-run.test.ts       (1 test)

 Test Files  9 passed (9)
      Tests  87 passed (87)
   Duration  2.70s

PASS: SDR-007A Stage 05 backend implementation
```

Exit code: **0**. No tests skipped.

### 21.3 Remaining limitations

- All tests are synthetic/mocked; no live website, Exa, Firecrawl or LLM validation was performed.
- Firecrawl fallback validates the requested/final URL association in code, but provider-side redirect behavior cannot be fully controlled; it remains optional and bounded.
- The migration is not applied and Prisma repository behavior was build-checked, not integration-tested against PostgreSQL.
- Public-directory detection is a bounded hostname heuristic; unsupported directories are not discovered.
- Deterministic address extraction requires the printed address to match the profile address and the page to name a country; otherwise semantic interpretation or exclusion is used.
- Frontend, automatic launching and communication remain out of scope; API has no authentication beyond the existing local deployment model.

### 21.4 Changed paths

Production module and tests:

- `apps/api/src/modules/lead-qualification/` (18 files)
- `apps/api/test/lead-qualification/` (10 files)
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20261126173000_add_lead_qualification/migration.sql`
- `apps/api/src/app.module.ts`
- `docs/tasks/README.md`
- this task document

No Stage 01–04 source, ResearchService, frontend, dependency, environment or excluded artifact was changed.

Source-only review archive (regenerated after the passing proof):
`C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-stage05-source-20261126.zip`
— 72,844 bytes, SHA-256 `3a087612e193f4383286de71f517ff34ff19a930f4c6f068ecc9d61adbe2dad0`.

SDR-007A is `READY_FOR_HUMAN_REVIEW`, not `DONE`.




## 22. Pre-pilot correctness fixes (2026-11-26)

### 22.1 Confirmed defects and corrections

| Defect | Correction | Regression |
| --- | --- | --- |
| Address country association used the whole page | Country names are extracted only from the local sentence/fragment containing the printed address; shipping/unrelated country mentions are excluded | `geography.test.ts` shipping-destination and source-backed-address tests |
| Stored address/phone described as verified | Persisted fields are unverified signals; only page-backed address evidence can pass; phones require source URLs | geography stored-vs-source and unsourced-phone tests |
| Conflicting locations could pass | Local address+phone cannot pass while local/foreign evidence conflicts; only source-backed local-branch evidence resolves multiple locations | geography conflict/local-branch tests; engine conflict test |
| Foreign match policy weakened | Foreign address signal + matching foreign phone with no local evidence/branch → `COUNTRY_MISMATCH`, no search/LLM | engine foreign-pair test |
| Directory contacts not owned | Directory contacts must appear in a ±300-character fragment with the company name; operator-domain emails rejected; phones use digit-window association | contacts multi-company-directory and directory tests |
| Directory content established activity/geography | Directory pages are not trusted page evidence and do not produce address evidence | discovery directory test |
| Discovery used any address as resolved geography | Discovery evaluates geographic decision readiness (PASS or definitive mismatch), including conflicts, before stopping | discovery early-stop/failure-budget tests |
| Failed fetches/paths budget | Attempts include failures; search-result fetch count is per-company global; non-2xx `SafePageFetcher` responses cannot provide contacts | contacts failure-budget/non-success tests |
| Firecrawl pilot fallback | Module wiring passes `null` scraper for the initial pilot; fallback remains injectable/tested | contacts scraper fallback test |
| Semantic could override FAIL | Semantic changes only UNKNOWN/unresolved `COUNTRY_UNCONFIRMED`; confirmed FAIL/gate precedence is enforced | engine confirmed-relevance-failure test |
| Semantic input starvation | Up to four prioritized pages, per-page allocation, total request cap, focus and offer source URLs; v2 contract | semantic bounded-input test |
| Over-permissive activity | Offer URLs/length no longer suffice; independent current signals required; announcement alone is UNKNOWN, not parked | engine coming-soon/active test |
| Unverified legal identity merged | Legal-name-only duplicates no longer merge; domain/VAT/registration only; legal identity not claimed as confirmed | run legal-name-only test |
| Fingerprint omitted product/order/invalid entries | Fingerprint includes product metadata, target country, versions, semantic model, ordered raw inputs and malformed hashes; invalid profiles become explicit technical results | input product/reorder/malformed tests; run malformed-accounting test |
| Run budget reset on resume | Run `usage` JSON is persisted and reloaded; failed semantic attempts consume calls; search/LLM limiters implemented | run durable-budget test; engine failed-semantic test |
| Unbounded result/semantic payloads | Serialized result-size bound with evidence/contact trimming and reserve; complete semantic request cap | run result-size test; semantic bounded-input test |
| Stale workers could write/publish | Result writes/publication lock the run row with `SELECT … FOR UPDATE` plus token/status/unexpired-lease predicates; progress/heartbeat require unexpired lease | source preflight; PostgreSQL plan below |
| Publication history overwritten | Previous published run gets `supersededAt`; separate `/published` lookup | source preflight; PostgreSQL plan below |
| HTTP limits/deadlines | Byte-based body cap with early termination; absolute request deadline including DNS; DNS all-address callback; temporary DNS transient; strict TLS; final-domain association | `http.test.ts`, website redirect/TLS tests |
| Incomplete source accounting | Company count is raw input count; invalid profiles become `PROCESSING_FAILED` results; valid siblings preserved | input malformed test; run malformed-accounting test |

### 22.2 Final proof

```text
✔ Generated Prisma Client (7.10.1) to .\src\generated\prisma in 170ms

 ✓ http.test.ts         (3 tests)
 ✓ website.test.ts      (16 tests)
 ✓ semantic.test.ts      (9 tests)
 ✓ geography.test.ts    (13 tests)
 ✓ input.test.ts        (10 tests)
 ✓ engine.test.ts       (15 tests)
 ✓ contacts.test.ts     (13 tests)
 ✓ api.test.ts           (4 tests)
 ✓ large-run.test.ts     (1 test)
 ✓ run.test.ts          (15 tests)

 Test Files  10 passed (10)
      Tests  99 passed (99)
   Duration  1.76s

PASS: SDR-007A Stage 05 backend implementation
```

Exit code: **0**. No failed or skipped tests.

### 22.3 PostgreSQL ownership/publication integration test plan

This plan is **not executed** in this assignment and the migration is not deployed.

1. Use a disposable PostgreSQL 17 database/schema, apply the additive migration and seed one product/completed profile fixture; never connect production.
2. Workers A and B: A claims/writes a result, lease expires, B claims. A's `saveResult`, `updateResult`, `updateProgress` and `completeAndPublish` must fail/no-op without changing B's data or publishing.
3. Assert stale token/expired lease rejection and that committed result count equals progress count.
4. Concurrent starts with the same `startKey`: exactly one run; both return it. Different keys while active: one run and one controlled `409`.
5. Publish A, then complete B. Assert B is the sole `publishedAt` run, A retains `supersededAt`, `/published` returns B, and partial unique indexes hold.
6. Interrupt/resume mid-flight; verify durable usage, no duplicate result rows, no budget reset, no publication before completion.
7. Simulate provider outage; assert failed run is unpublished, historical runs remain, no orphan result rows.
8. Force a result-write failure; assert transaction rollback leaves no partial row and progress remains consistent.

### 22.4 Pilot limitations

- All 99 tests are synthetic/mocked; no live site, DNS, Exa, Firecrawl or LLM call occurred.
- Real PostgreSQL ownership/publication behavior is planned but unexecuted; migration remains unapplied.
- Firecrawl fallback is disabled in pilot wiring, so JS-only/blocked contact pages may be missed.
- Directory discovery uses a conservative hostname heuristic/local-fragment association and will miss some directories.
- Deterministic address evidence requires exact printed-address and same-fragment country association; otherwise semantic interpretation or exclusion applies.
- Prompt v2 is not live-validated; model behavior remains probabilistic.
- Bot protection, unusual certificates, DNS edge cases and provider quotas are not live-validated.
- API authentication and frontend/automatic-launch integration remain out of scope.

SDR-007A is `READY_FOR_HUMAN_REVIEW`, not `DONE`.

### 22.5 Updated source archive

`C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-stage05-source-20261126.zip`

- 32 entries, 78,516 bytes
- SHA-256 `c45429aa41c09214cacfa04280c85643dfadb4c220cf26e9aa439a55fdb3ffed`
- Contains the complete Stage 05 module, 11 test files, Prisma schema and additive migration; no `.env`, credentials, generated client, real research data or excluded artifacts.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 23. Real PostgreSQL integration verification attempt (2026-11-26)

### 23.1 Result

**BLOCKED before migration deployment.** The isolated container started successfully and was
bound only to loopback with a tmpfs data directory, but the harness database-identity query
returned an empty result. The proof stopped before `prisma migrate deploy`; no migration or
integration test executed.

The query concatenated `current_database()`, `current_user` and `inet_server_addr()`. Over the
container’s Unix-socket `psql` connection, `inet_server_addr()` is NULL, so the entire `||`
concatenation was NULL. The database was not reached incorrectly; the identity assertion itself
was defective. This is a harness defect, not a confirmed Stage 05 application or migration defect.

### 23.2 Actual proof output

```text
ISOLATED_CONTAINER=sdr007a-it-20261126190721-5554
ISOLATED_DATABASE=sdr007a_it_20261126190721_5554
ISOLATED_USER=sdr_it
ISOLATED_PORT=127.0.0.1:55439
ISOLATED_PORT_BINDING=127.0.0.1:55439 -> 5432/tcp
DATABASE_IDENTITY=
PROOF_FAILURE=Temporary database identity verification failed.
CLEANUP_CONTAINER_STILL_PRESENT=
LIVE_DB_FINAL_IDENTITY=11dde430c389817eb51e45d5e1619ffb28d40f969b682a166447e819c27ac6dd|2026-11-26T11:11:48.474902604Z
PROOF_EXIT=1
PROOF_EXIT=1
```

### 23.3 Isolation and cleanup evidence

- Unique container: `sdr007a-it-20261126190721-5554`
- Unique database: `sdr007a_it_20261126190721_5554`
- User: `sdr_it`
- Port binding: `127.0.0.1:55439 -> 5432/tcp` only
- Data directory: tmpfs; no named or existing volume
- No connection to `sdr-assistant-db`; the only live-database operation was read-only inspection
- `CLEANUP_CONTAINER_STILL_PRESENT=` is empty: the temporary container was removed
- Live database final identity observed without modification
- No migration, integration test, synthetic test rerun or provider request occurred in this proof

### 23.4 Changed files in this attempt

- `apps/api/test/postgres-integration/stage05.repository.test.ts` — real-Prisma integration tests,
  not executed because migration deployment did not run
- `apps/api/test/postgres-integration/run-proof.ps1` — disposable-container proof harness
- this task document and `docs/tasks/README.md`

No Stage 01–04, ResearchService, Stage 05 production source, qualification algorithm, prompt,
migration SQL, schema, dependency or excluded artifact was changed.

### 23.5 Blocker and next authorized step

The identity query must be corrected before another proof, for example:

```sql
SELECT current_database() || '|' || current_user || '|' ||
       coalesce(inet_server_addr()::text, 'local-socket')
```

After explicit authorization, rerun the complete compound proof once. Migration deployment,
repository ownership/publication tests, transaction rollback and cleanup have **not** been
verified against PostgreSQL. The prior synthetic evidence remains valid at 99/99 tests.

SDR-007A is `BLOCKED`, not `DONE`.

## 24. Real PostgreSQL integration verification (2026-11-26)

### 24.1 Harness corrections

The previously failed proof exposed a harness defect, not a Stage 05 defect. The corrections were
limited to the integration harness:

1. Replaced the NULL-sensitive identity expression with
   `COALESCE(inet_server_addr()::text, 'local-socket')`.
2. Added an explicit assertion that the temporary container is absent after cleanup.
3. Made the read-only image/live-container inspection silent and exit-code checked so harness
   output and failure detection are deterministic.

No isolation safeguard, migration, production Stage 05 source or qualification expectation was
weakened.

### 24.2 Proof result

Command:

```powershell
& 'apps\api\test\postgres-integration\run-proof.ps1'
```

Key output:

```text
ISOLATED_CONTAINER=sdr007a-it-20261126205149-4779
ISOLATED_DATABASE=sdr007a_it_20261126205149_4779
ISOLATED_PORT_BINDING=127.0.0.1:55439 -> 5432/tcp
DATABASE_IDENTITY=sdr007a_it_20261126205149_4779|sdr_it|local-socket
MIGRATIONS_APPLIED=11
STAGE05_TABLES=lead_qualification_results,lead_qualification_runs
PARTIAL_UNIQUE_INDEXES=lead_qualification_one_active_run_per_research,lead_qualification_one_published_run_per_research
BUILD_PASS
 Test Files  10 passed (10)
      Tests  99 passed (99)
SYNTHETIC_TESTS_PASS
 ✓ test/postgres-integration/stage05.repository.test.ts (5 tests)
 Test Files  1 passed (1)
      Tests  5 passed (5)
POSTGRES_INTEGRATION_TESTS_PASS
LIVE_DB_IDENTITY_BEFORE=11dde430c389817eb51e45d5e1619ffb28d40f969b682a166447e819c27ac6dd|2026-11-26T11:11:48.474902604Z
LIVE_DB_IDENTITY_AFTER=11dde430c389817eb51e45d5e1619ffb28d40f969b682a166447e819c27ac6dd|2026-11-26T11:11:48.474902604Z
CLEANUP_CONTAINER_STILL_PRESENT=
PASS: SDR-007A real PostgreSQL integration verification
PROOF_EXIT=0
```

**Exit code: 0.**

### 24.3 Migration verification

- All **11** migrations applied successfully to the empty disposable database.
- Existing product/research/stage tables were created.
- Both Stage 05 tables exist.
- Foreign-key checks passed for runs/results and the existing stage results.
- Partial unique indexes for active runs and published runs were present.
- Prisma Client was regenerated by the build and used by the integration tests.
- The Stage 05 migration contained no `DROP TABLE` and no alteration of `researches` or
  `research_stage_*` tables.
- No live migration was deployed.

### 24.4 Real repository scenarios (5/5 passed)

1. **Execution ownership:** Worker A claimed a run and saved a result; its lease was expired; Worker
   B claimed. A could not insert/update results, update progress or publish. B retained ownership,
   completed and published the run with exactly two results.
2. **Concurrent starts:** Two concurrent requests with the same `startKey` produced exactly one run
   and returned the same identity. A different key while active produced a controlled conflict. A
   deliberate new run was possible after completion.
3. **Durable recovery/accounting:** An interrupted run resumed after one committed company result
   without duplication; malformed input produced an explicit technical result; valid siblings were
   preserved; usage started from persisted value and ended at 2 LLM calls.
4. **Publication history:** A completed run became published; a newer completed run superseded it
   while the older row retained `supersededAt`; `findPublishedRun` returned the current run.
5. **Transaction integrity:** A forced invalid-decision result write rolled back with zero result
   rows, unchanged progress and no orphan results.

### 24.5 Isolation and cleanup

- Container `sdr007a-it-20261126205149-4779`; database
  `sdr007a_it_20261126205149_4779`; user `sdr_it`.
- Loopback-only binding `127.0.0.1:55439`; tmpfs data directory; no named or existing volume.
- Live database was only inspected read-only; its identity before/after/final was identical.
- `CLEANUP_CONTAINER_STILL_PRESENT=` empty; no `sdr007a-it-*` container remains.
- No live database migration or write; no real provider call.

### 24.6 Changed files in this verification

- `apps/api/test/postgres-integration/stage05.repository.test.ts`
- `apps/api/test/postgres-integration/run-proof.ps1`
- this task document and `docs/tasks/README.md`

No production Stage 05 source, migration SQL, schema, Stage 01–04 code, ResearchService,
dependency, `.env`, excluded artifact, frontend or communication code was changed. The 18 excluded
artifacts remain byte-identical.

### 24.7 Remaining blocker before live deployment

The migration is verified only on a disposable database and remains **not deployed**. Human review
must authorize any live migration/deployment and subsequent production smoke verification. The
synthetic and integration proofs make no real provider, DNS, website or LLM call.

SDR-007A is `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 25. Authorized repeat PostgreSQL verification (2026-11-26)

A second authorized execution used the same corrected harness with no source, migration, test or
harness changes. It passed again.

```text
ISOLATED_CONTAINER=sdr007a-it-20261126210805-3431
ISOLATED_DATABASE=sdr007a_it_20261126210805_3431
DATABASE_IDENTITY=sdr007a_it_20261126210805_3431|sdr_it|local-socket
MIGRATIONS_APPLIED=11
STAGE05_TABLES=lead_qualification_results,lead_qualification_runs
PARTIAL_UNIQUE_INDEXES=lead_qualification_one_active_run_per_research,lead_qualification_one_published_run_per_research
BUILD_PASS
 Test Files  10 passed (10)
      Tests  99 passed (99)
SYNTHETIC_TESTS_PASS
 ✓ test/postgres-integration/stage05.repository.test.ts (5 tests)
 Test Files  1 passed (1)
      Tests  5 passed (5)
POSTGRES_INTEGRATION_TESTS_PASS
LIVE_DB_IDENTITY_BEFORE=11dde430c389817eb51e45d5e1619ffb28d40f969b682a166447e819c27ac6dd|2026-11-26T11:11:48.474902604Z
LIVE_DB_IDENTITY_AFTER=11dde430c389817eb51e45d5e1619ffb28d40f969b682a166447e819c27ac6dd|2026-11-26T11:11:48.474902604Z
CLEANUP_CONTAINER_STILL_PRESENT=
PASS: SDR-007A real PostgreSQL integration verification
PROOF_EXIT=0
```

The temporary container was removed; the live database identity was unchanged. The earlier failed
attempt remains recorded in §23, and the first successful corrected proof remains recorded in §24.

SDR-007A is `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 26. Live migration and three-company pilot preparation (2026-11-26)

### 26.1 Protected pre-migration backup

- Path: `C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-live-pre-stage05-20261126-211452.dump`
- Size: 2,412,049 bytes
- SHA-256: `ec93ee47c242428319e5d43c8619a0d923f204b6069d004ae1723381b23e87ef`
- Sidecar: `.dump.sha256`
- `pg_restore --list` succeeded.
- Archive contains 8 table-data sections including `researches`, `products`, `settings`, `email_accounts`,
  the three stage-result tables and `_prisma_migrations`; it contains no Stage 05 table data.
- Temporary files inside the live container were removed.

### 26.2 Live migration result

Live identity: database `sdr_assistant`, user `sdr`, container `sdr-assistant-db`
(`11dde430c389817eb51e45d5e1619ffb28d40f969b682a166447e819c27ac6dd`) on
`127.0.0.1:5433`.

Preconditions: 0 active research executions; Stage 05 tables absent; baseline confirmed.

Deployment used only:

```powershell
Push-Location 'apps\api'
& '..\..\node_modules\.bin\prisma.cmd' migrate deploy
Pop-Location
```

`prisma db push`, `migrate reset` and destructive synchronization were not used. Result:

- 11/11 migrations applied; `prisma migrate status` reports schema up to date.
- Stage 05 tables created: `lead_qualification_runs`, `lead_qualification_results`.
- 2 Stage 05 foreign keys present.
- Both partial unique indexes present.
- 0 Stage 05 run/result rows.

### 26.3 Database preservation

Post-migration values match the pre-migration baseline:

| Check | Before | After |
| --- | --- | --- |
| Migrations | 10 | 11 |
| Researches | 4 total / 4 completed | 4 / 4 |
| Active research | 0 | 0 |
| Company profiles | 223 | 223 |
| Offers | 449 | 449 |
| Products | 5 | 5 |
| Settings | 1 | 1 |
| Email accounts | 2 | 2 |
| Stage 01/02/03 rows | 2 / 2 / 3 | 2 / 2 / 3 |
| Research fingerprint | `caab4e8b244c90d6e56e1afe05fefcf8` | identical |
| Stage 01 fingerprint | `8c8b2103ad5e492a43efd404de5ec86c` | identical |
| Stage 02 fingerprint | `052a17fede17f91959eabe367153b6a5` | identical |
| Stage 03 fingerprint | `7936c1e4ca4c17505c867dfb7d4e8941` | identical |
| Products fingerprint | `018a354c0df2e76f0d4b628255cdeb7b` | identical |
| Settings fingerprint | `a5fb91bf9317969fb493b58f87baf8e2` | identical |
| Email fingerprint | `9dd296b9936078637a771d72094b0701` | identical |

The original 77-company research result was not modified.

### 26.4 API smoke verification

No restart was required; the running API already serves the Stage 05 routes and queries the
migrated tables.

- `GET http://127.0.0.1:4000/health` → **200** `{"status":"ok"}`.
- `GET /research/cmww8smxb0000z4swhooukamv/lead-qualification` → **404**
  `No qualification run exists for this research.` (expected, database query succeeded).
- `GET /research/cmww8smxb0000z4swhooukamv/lead-qualification/published` → **404**
  `No published qualification run exists.` (expected).
- No qualification run was started and no provider call was made.

### 26.5 Pilot harness

`apps/api/scripts/stage05-pilot-3.mjs` is a read-only, explicitly non-published diagnostic:

- Loads research `cmww8smxb0000z4swhooukamv` and selects only `dailylentes.eu`,
  `brolistimber.eu`, `decormania.eu`.
- Parses the selected Stage 04 profiles through the implemented Stage 05 input parser.
- Invokes the actual `LeadQualificationEngine`, website validator, HTTP discovery, Exa provider and
  DeepSeek semantic assessor.
- Uses Firecrawl `null` (disabled).
- Writes only the JSON artifact; it does not create a `LeadQualificationRun`, write a result or
  publish anything.
- The original research is never updated.

Exact command (not executed):

```powershell
npm.cmd run build -w @sdr-assistant/api
node apps/api/scripts/stage05-pilot-3.mjs `
  --research cmww8smxb0000z4swhooukamv `
  --domains dailylentes.eu,brolistimber.eu,decormania.eu `
  --out C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-pilot-3.json
```

Provider configuration:

- DeepSeek `deepseek-flash`; temperature 0; thinking disabled; max output 2,000 tokens;
  max input 16,000 characters per call; one call per company maximum.
- Exa search; `type: auto`, 5 results per query, target-country user location, 2 queries per
  company maximum.
- Website/Discovery via strict HTTPS `SafeHttpClient`; 10 s deadline, 5 redirects, 256 KiB body
  limit, 2 attempts per endpoint.
- Firecrawl disabled.

Maximum expected resource consumption for three companies:

| Resource | Hard maximum |
| --- | --- |
| Website HTTP client requests | 4 per company (2 HTTPS + 2 HTTP attempts) → 12 |
| Website network hops including redirects | 24 per company → 72 |
| Discovery page/search-result fetches | 5 per company (3 direct + 2 search results) → 15 |
| Discovery hops including redirects | 30 per company → 90 |
| Total company/page HTTP hops | 162 |
| Exa queries | 2 per company → **6** |
| Exa result URLs | 5 per query → 30; fetched URLs capped at 2 per company |
| LLM calls | 1 per company → **3** |
| LLM input characters | 16,000 per call → **48,000** |
| LLM output tokens | 2,000 per call → **6,000** |
| Firecrawl requests | **0** |
| Total external HTTP/API requests | 162 page hops + 6 Exa + 3 LLM = **171** |

Estimated maximum cost is not asserted because the current DeepSeek price schedule was not
verified; the hard token bound is 48,000 input characters and 6,000 output tokens. No paid call is
authorized by this preparation.

Output artifact (created only on approved execution):

`C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-pilot-3.json`

### 26.6 Changed files

- `apps/api/scripts/stage05-pilot-3.mjs` (new pilot harness; not executed)
- this task document and `docs/tasks/README.md`

No Stage 01–04, ResearchService, qualification algorithm/prompt, migration, production source,
frontend, email or excluded artifact was changed. No staging, commit or push occurred.

### 26.7 Remaining blockers

- Owner approval of the reported provider budget is required before the pilot command is executed.
- No paid provider request, pilot result or Stage 05 qualification run exists yet.
- The live migration is applied and smoke-tested, but no full 77-company qualification or
  production-scale acceptance has been performed.
- No rollback/restore rehearsal was performed; the verified pre-migration backup is available.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 27. Three-company live pilot execution (2026-11-26)

### 27.1 Result

The authorized pilot executed once with exit code **0**. Three profiles were processed; no full
77-company run was started and no provider request was made outside the approved scope.

| Scenario | Decision | Primary reason |
| --- | --- | --- |
| HTTP-only candidate | EXCLUDED | `NO_VALID_HTTPS` |
| Parked-site candidate | EXCLUDED | `INACTIVE_BUSINESS` |
| Strict-country candidate | EXCLUDED | `COUNTRY_UNCONFIRMED` |

These are recorded outcomes, not hardcoded expectations. The HTTP-only candidate reached HTTP 200
but not valid HTTPS. The parked candidate reached valid HTTPS but was classified as parked. The
strict-country candidate passed website, activity, email and duplicate gates but retained a
target-country conflict after bounded discovery and semantic review.

### 27.2 Actual resource consumption

| Resource | Actual |
| --- | --- |
| Page/fetch operations | 8 tracked (1 + 1 + 6) |
| Tracked website redirects | 2 (0 + 1 + 1) |
| Discovery fetches counted by run budget | 5 |
| Exa queries | 2 |
| LLM calls | 1 |
| Provider prompt tokens | 6,169 |
| Provider completion tokens | 77 |
| Retries | 0 |
| Processing duration | 13,359 ms total (296 + 2,113 + 10,950) |
| Firecrawl requests | 0 |
| Approved budget | 162 hops / 6 Exa / 3 LLM; actual well within |

The global run budget counts discovery fetch requests, while each company metadata includes website
plus discovery fetch operations. Redirect hops are not fully exposed by the discovery client; the
tracked count is the conservative available evidence. No retry or provider-outage occurrence was
reported.

### 27.3 Semantic invocation

Semantic review was invoked only for the strict-country candidate:

- model: `deepseek-flash`
- prompt version: `lead-qualification-semantic-v2`
- calls: 1
- provider token usage: 6,169 prompt / 77 completion
- final applied state: website PASS, activity PASS, geography FAIL `COUNTRY_UNCONFIRMED`,
  relevance UNKNOWN, email PASS, duplicate PASS

The raw semantic request/response was not persisted by the harness; only the applied check state,
model/prompt version and provider token usage are retained. This is a diagnostic limitation.

### 27.4 No database or research mutation

- `lead_qualification_runs`: 0
- `lead_qualification_results`: 0
- Research fingerprint: `caab4e8b244c90d6e56e1afe05fefcf8` (unchanged)
- Stage 01/02/03 fingerprints unchanged: `8c8b2103ad5e492a43efd404de5ec86c`,
  `052a17fede17f91959eabe367153b6a5`, `7936c1e4ca4c17505c867dfb7d4e8941`
- The original 77-company research result was not modified.

### 27.5 Output artifact

The diagnostic JSON is outside the repository:

`C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-pilot-3.json`

- Size: 555,347 bytes
- SHA-256: `f6f971c8f3590632d22701fd969075c235b3b6d0862db9ac42f0f8d126b6c871`
- Marked `published: false`; it contains no qualification-run persistence.

### 27.6 Diagnostic observations and limitations

- The HTTP-only candidate demonstrates the mandatory HTTPS gate before discovery or semantic work.
- The parked candidate did not exercise extended email discovery because the website gate failed
  first; this is an execution-order observation, not an email-discovery result.
- The strict-country candidate's discovered telephone extraction produced implausible numeric
  fragments; the geography gate remained unresolved and did not accept them as local presence.
- Additional search-query strings and the exact fetched-page list were not persisted; observed
  counts, final URLs and evidence references are retained.
- No algorithm, prompt, source, migration or infrastructure correction was made in response to
  these outcomes.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 28. Revised scope — Stage 05 Contact Discovery (05.1.2)

### 28.1 Scope change

Stage 05 is now **Contact Discovery**, not Lead Qualification. The existing qualification
implementation, tests and historical evidence remain preserved but are not the active product
scope. Contact discovery does not perform activity, relevance, geography or final qualification
decisions.

### 28.2 Inputs reused

- Research: `cmww8smxb0000z4swhooukamv`
- 05.1.2 result:
  `C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-05.1.2-homepages\2026-11-26T21-25-02-555Z\result.json`
- 75 saved homepage HTML files from that run
- Original Stage 04 profiles embedded in the result

No homepage was downloaded again. No Exa, LLM or Firecrawl request was made.

### 28.3 Contact-page collection

Actual internal links were extracted from the saved homepages, prioritized for contact, company,
legal/imprint, team, management, sales, export, wholesale/B2B and branch pages. The run used the
existing safe HTTP client and fetched at most five pages per company.

Aggregate result:

| Metric | Result |
| --- | ---: |
| Companies processed | 77 |
| Homepages reused | 75 |
| Companies with discoverable relevant links | 60 |
| Contact-page attempts | 136 |
| Contact pages fetched successfully | 134 |
| Contact pages failed (HTTP 404) | 2 |
| Raw contact-page HTML files | 136 |
| Raw HTML size | 17,192,269 bytes |

### 28.4 Email coverage

| Metric | Result |
| --- | ---: |
| Companies with at least one email | 66 |
| Total unique company-email pairs | 189 |
| Newly discovered emails | 126 |
| General email classification | 84 |
| Department email classification | 9 |
| Named-employee email classification | 0 |
| Uncertain email associations | 96 |

Email-count distribution:

| Emails per company | Companies |
| --- | ---: |
| 0 | 11 |
| 1 | 39 |
| 2–3 | 20 |
| 4–5 | 1 |
| 6+ | 6 |

Telephone coverage: 68 companies. Address coverage: 51 companies.

Candidates by extraction method:

| Method | Candidates |
| --- | ---: |
| `json_ld` | 387 |
| `mailto` | 207 |
| `tel` | 378 |
| `visible_text` | 416 |

### 28.5 Output artifacts

Result JSON:

`C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-05.1.2-contact-pages\2026-11-27T08-13-13-568Z\result.json`

- 2,013,145 bytes
- SHA-256 `ca15d24d7d53b9a8a220e8a9028cee146b608d8d2d65738131b46f3038c80084`
- Raw HTML directory:
  `...\2026-11-27T08-13-13-568Z\html`
- 136 HTML files, 17,192,269 bytes total

The result preserves original Stage 04 contacts, homepage contacts, contact-page contacts,
source evidence, fetched URLs, retrieval errors and raw HTML references. Real contact data remains
outside the repository.

### 28.6 Failures and limitations

- Two contact pages returned HTTP 404:
  - `https://www.medzioturas.lt/%22//gdpr//cookie-consent/%22`
  - `https://www.gedrimeda.lt/apie-mus`
- Two homepages were unavailable in the preceding run due to invalid HTTPS certificates; no
  contact-page links could be derived for them.
- Email classification is a conservative local-part heuristic: general and department labels are
  not authoritative. **Named-employee classification is 0 because the existing extractor does not
  preserve explicit employee-name/position associations.** The 96 uncertain associations are
  reported separately and were not classified by guessing.
- Contact-page discovery is limited to five actual links per company; no Exa, LLM, Firecrawl or
  additional contact-page retrieval was performed.
- No qualification, activity, geography, parked-site or final-decision processing was performed.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 29. 05.1.3 Exa-assisted contact discovery (2026-11-27)

### 29.1 Scope and input

Processed the 50 companies with zero or one email in the 05.1.2 contact-page result:
11 zero-email companies and 39 one-email companies. The prior result and all prior artifacts were
reused unchanged. One targeted Exa query was executed per company using the company name/domain
and Lithuanian contact terms. No homepage was downloaded again.

### 29.2 Actual resource use

| Resource | Actual | Budget |
| --- | ---: | ---: |
| Exa queries | 50 | 50 |
| Search results | 250 | 250 |
| Contact-page fetch attempts | 83 | 150 |
| Contact pages returned HTTP 200 | 75 | — |
| Retrieval failures | 8 | — |
| LLM calls | 0 | 0 |
| Firecrawl calls | 0 | 0 |

The 83 page attempts produced 80 saved HTML files (11,515,491 bytes); three attempts failed before
a response body was available. Page failures: 3 HTTP 403, 2 HTTP 999 and 3 invalid-certificate
failures. There were no Exa search errors. Fifteen external-directory candidates were rejected for
lacking a company-associated contact window.

### 29.3 Before and after

| Metric | Before | After |
| --- | ---: | ---: |
| Companies with email | 66 | 67 |
| Companies without email | 11 | 10 |
| Unique company-email pairs | 189 | 196 |
| New raw email candidates | — | 7 |

After distribution:

| Emails per company | Companies |
| --- | ---: |
| 0 | 10 |
| 1 | 35 |
| 2–3 | 25 |
| 4–5 | 1 |
| 6+ | 6 |

Discovery yield:

- Zero-email companies: 1 of 11 companies gained a new email; 1 new email.
- One-email companies: 5 of 39 companies gained new emails; 6 new raw emails.

### 29.4 Data-quality caveat

The raw count of 7 includes `name@example.com`, a confirmed placeholder extracted from the
DecorMania contact-information page's widget-localization text. It must not be counted as a real
contact. Excluding it gives **6 new email candidates** and **195 unique company-email pairs**.
One further candidate, an external representative-domain address, appears on a Tempsi page in an explicitly named
external/representative-company block; its company association remains uncertain and is preserved
as such rather than asserted.

No algorithm or extractor correction was made during or after the run.

### 29.5 Clarification of the previous 126

The 05.1.2 figure of **126 newly discovered emails** was measured against the **original Stage 04
email set**, not against the homepage-only extraction. It counted unique company-email pairs found
on homepages plus contact pages that were absent from Stage 04. The 05.1.3 figure of 7 is measured
against the 05.1.2 result's existing 189 unique company-email pairs. The two figures are therefore
not directly comparable.

### 29.6 Artifacts

`C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-05.1.3-exa\2026-11-27T08-58-26-889Z\result.json`

- Result size: 995,755 bytes
- SHA-256: `2d550f9529287a91d4d238ccd145cdd116a94651aec1650568983c70fe43d773`
- Raw HTML directory: `...\2026-11-27T08-58-26-889Z\html`
- Raw HTML: 80 files, 11,515,491 bytes

The artifact preserves actual search queries, full search results, selected/fetched URLs, raw HTML
references, extraction evidence, rejected external candidates, retrieval failures, per-company
durations and aggregate counts. Real contact data remains outside the repository.

### 29.7 Limitations

- 8 page retrievals failed (HTTP 403/999 or invalid certificate).
- The existing extractor accepts placeholder email text; `name@example.com` is a confirmed false
  positive and is not a valid contact.
- The extractor does not extract employee names/positions; explicit name/role context is preserved
  in evidence but not converted into an authoritative association.
- One external representative contact remains uncertain.
- No qualification, geographic filtering, activity assessment, LLM or Firecrawl processing was
  performed.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 30. 05.1.4 Contact normalization and consolidation (2026-11-27)

### 30.1 Result

Offline consolidation of Stage 04, homepage, contact-page and Exa artifacts processed all 77
companies. No HTTP, provider, database or extractor changes were made.

| Metric | Result |
| --- | ---: |
| Companies | 77 |
| Companies with email | 67 |
| Companies without email | 10 |
| Unique company-email pairs | 195 |
| Placeholder/example email occurrences removed | 2 (one unique address) |
| Unrelated service/widget emails removed | 0 |
| Invalid email occurrences removed | 0 |
| Uncertain-ownership contacts | 98 (all emails) |
| Companies with telephone | 70 |
| Companies without telephone | 7 |
| Companies with foreign telephone codes | 10 |
| Companies with both local and foreign telephone codes | 7 |
| Address records | 131 |
| Registration/VAT records | 43 |

The removed placeholder is `name@example.com` from DecorMania widget-localization text. Free-mail
addresses were retained. Two invalid Stage 04 telephone strings were removed with reasons.

### 30.2 Artifact

`C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-05.1.4-consolidated\2026-11-27T09-38-48-074Z\result.json`

- Size: 2,518,719 bytes
- SHA-256: `9a6823373e3b4f7506e704618d8ebb0828ad9db34cff1eb5f6479c0abd52bfcd`
- Contains company identities, unique emails, phones, addresses, registration identifiers,
  provenance, removed contacts/reasons, uncertain contacts and foreign telephone cases.
- Real contact data remains outside the repository.

### 30.3 Limitations

- Uncertain ownership currently consists solely of email addresses; telephone/address records from
  external sources did not enter the consolidation as uncertain.
- Foreign-telephone classification uses calling-code candidates against Lithuania; it is not a
  geographic exclusion.
- Large global contact sets (notably Thermory) produce many foreign-code telephone records and
  require human inspection.
- The `name@example.com` placeholder demonstrates that upstream extraction still permits widget
  localization text; it is removed here but the extractor was not changed.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 31. 05.1.5 Final contact filtering (2026-11-27)

### 31.1 Result

Offline final filtering used the research target country **Lithuania** (`LT`) and the 05.1.4
consolidated artifact. No HTTP, Exa, LLM, Firecrawl, database or qualification processing occurred.

| Metric | Result |
| --- | ---: |
| Companies processed | 77 |
| Retained companies | **55** |
| Excluded — missing usable company email | **20** |
| Excluded — foreign telephone evidence | **2** |
| Communication-ready unique company-email pairs | **95** |
| Uncertain email pairs | **98** |
| Companies with foreign telephone codes | 10 |
| Companies with both local and foreign telephone codes | 7 |
| Companies without telephone | 7 |

Communication-ready means confirmed company-associated ownership. Uncertain-ownership emails remain
preserved separately and are never placed in the communication-ready list. A company without a
confirmed usable email is excluded even when uncertain emails exist.

### 31.2 Foreign-telephone exclusions

Only two companies met all exclusion conditions: no target-country telephone, no target-country
address evidence, and every supported telephone unambiguously foreign.

- `decormania.eu` — PL telephone, no target address evidence
- `linkedinwoodwork.com` — CN telephones, no target address evidence

Other foreign-telephone cases were retained because they had a target-country telephone, target
address evidence, or ambiguous/shared telephone evidence. No domain was hardcoded in the rules.

### 31.3 Artifact

`C:\Users\msmig\Projektai\_backupsForProjects\SDR-007A-05.1.5-final\2026-11-27T09-50-26-560Z\result.json`

- Size: 1,845,865 bytes
- SHA-256: `57068af7710f0590934e5efc879a28dc63bbe37d379216dcac0f96a4b668fca4`
- Contains retained companies, excluded companies/reasons, all emails, communication-ready emails,
  uncertain contacts, phones, addresses, registration identifiers, provenance and foreign cases.

### 31.4 Limitations

- Exclusion due to missing email takes precedence over foreign-telephone exclusion; the two totals
  are mutually exclusive.
- Foreign-telephone classification is based on saved calling-code evidence and explicit/structured
  telephone context, not a new geographic assessment.
- Uncertain ownership is email-only in the consolidated input; no telephone/address ownership was
  marked uncertain.
- No manual-review queue was created.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 32. Stage 05 Contact Discovery V1 integration (2026-11-27)

### 32.1 Integrated processing

One reusable pipeline now composes the accepted stages:

- Homepage contact extraction.
- Actual internal contact-page discovery, maximum five pages.
- Exa-assisted discovery only when homepage/contact-page evidence has no usable company email.
- Contact normalization, ownership separation and minimal telephone-country filtering.

The pipeline consumes a persisted Stage 04 company study and target country, and preserves the
existing `LeadQualificationRun`/`LeadQualificationResult` execution, lease, recovery, progress,
publication, resource-accounting and historical-result infrastructure. No new tables or migration
were required. The optional `metadata.contactDiscovery` JSON field holds the contact-discovery
result without changing the schema.

### 32.2 Verification

Focused reference replay against the saved 05.1.2 and 05.1.3 evidence reproduced the accepted
result:

| Metric | Result |
| --- | ---: |
| Retained companies | **64** |
| Communication-ready unique company-email pairs | **128** |
| Usable ownership pairs before telephone exclusion | 130 |
| Partner/distributor email pairs | **65** |
| Missing-email exclusions | **11** |
| Foreign-telephone exclusions | **2** |
| Uncertain ownership pairs | **0** |

The 130 usable pairs include two usable emails belonging to the two foreign-telephone-excluded
companies; those are not in the 128 retained communication-ready total.

A separate synthetic test confirms the revised Exa policy:

- A company with a usable email after homepage/contact-page discovery triggers **0 Exa searches**.
- A company without usable email triggers **one Exa search**, and discovered contacts are merged.
- The test uses no live Exa request.

Persistence was exercised through the existing run service with an in-memory store: result
persistence, run completion and `metadata.contactDiscovery` were verified.

### 32.3 Proof

```text
✔ Generated Prisma Client (7.10.1)

 ✓ test/contact-discovery/extractor.test.ts (8 tests)
 ✓ test/lead-qualification/http.test.ts (3 tests)
 ✓ test/lead-qualification/website.test.ts (16 tests)
 ✓ test/lead-qualification/input.test.ts (10 tests)
 ✓ test/contact-discovery-pipeline/pipeline.test.ts (3 tests)
 ✓ test/lead-qualification/engine.test.ts (15 tests)
 ✓ test/lead-qualification/semantic.test.ts (9 tests)
 ✓ test/lead-qualification/geography.test.ts (13 tests)
 ✓ test/lead-qualification/contacts.test.ts (13 tests)
 ✓ test/lead-qualification/api.test.ts (4 tests)
 ✓ test/lead-qualification/large-run.test.ts (1 test)
 ✓ test/lead-qualification/run.test.ts (15 tests)

 Test Files  12 passed (12)
      Tests  110 passed (110)

PASS: Stage 05 Contact Discovery V1 integration
```

Exit code: **0**. No failed or skipped tests.

### 32.4 Changed paths

- `apps/api/src/modules/contact-discovery/contact-discovery.types.ts`
- `apps/api/src/modules/contact-discovery-pipeline/contact-discovery-pipeline.types.ts`
- `apps/api/src/modules/contact-discovery-pipeline/contact-discovery-pipeline.ts`
- `apps/api/src/modules/contact-discovery-pipeline/contact-discovery.qualifier.ts`
- `apps/api/src/modules/contact-discovery-pipeline/contact-discovery.runtime.ts`
- `apps/api/src/modules/lead-qualification/lead-qualification.types.ts`
- `apps/api/src/modules/lead-qualification/lead-qualification.service.ts`
- `apps/api/test/contact-discovery-pipeline/pipeline.test.ts`
- this task document and `docs/tasks/README.md`

No Stage 01–04 source, migration, provider configuration, frontend or communication code changed.

### 32.5 Limitations

- Exa, homepage and contact-page live adapters exist as ports but were not exercised against live
  services in this proof; historical evidence replay and synthetic ports were used.
- The pipeline is independently callable but is not yet wired into the Nest API module or automatic
  Stage 04 completion. No automatic launch is enabled.
- Persistence verification used the existing in-memory test store, not a live database write; the
  previously verified PostgreSQL infrastructure remains unchanged.
- Raw HTML is not persisted in the run database; page URLs, statuses and compact diagnostic
  evidence are preserved in metadata/evidence. Actual contact data and HTML remain outside the
  repository.
- Employee names/positions remain explicitly unknown; no ownership or role inference was added.
- The historical reference deployment used the pre-V1 Exa targeting set; the new targeting policy
  is verified separately and intentionally differs.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.


## 33. Integrated Contact Discovery V1 live execution (2026-11-27)

### 33.1 Actual execution

One live execution used the integrated `ContactDiscoveryRuntime`,
`ContactDiscoveryQualifier`, live safe-HTTP/Exa ports and the existing Prisma run/store/lease
infrastructure. The previous experimental discovery scripts were not used.

- Run ID: `cmwyvnwy000006osw2ydl32zx`
- Version labels: `contact-discovery-v1`
- Source companies: 77
- Persisted results: 77
- Status: COMPLETED
- Published: 2026-11-27T11:08:38.530Z
- Technical failures: 0
- Duration: 39,764 ms

### 33.2 Actual results

| Metric | Live result |
| --- | ---: |
| Retained companies | **68** |
| Excluded companies | **9** |
| Companies with usable email | **69** |
| Unique usable company-email pairs | **134** |
| Usable pairs in retained companies | **133** |
| Partner/distributor email pairs | **5** |
| Missing-email exclusions | **8** |
| Foreign-telephone exclusions | **1** |
| Technical failures | **0** |

Exclusions: 8 `EMAIL_NOT_FOUND` and 1 `COUNTRY_MISMATCH`.

### 33.3 Resource usage

| Resource | Actual | Limit |
| --- | ---: | ---: |
| Homepage operations | 77 | 77 |
| Contact-page fetches | 155 | ≤5 per company |
| Exa queries | 12 | 1 per eligible company |
| Exa results | 60 | 5 per query |
| Exa result-page fetches | 34 | 3 per eligible company |
| Total fetches | 266 | — |
| LLM calls | 0 | 0 |
| Firecrawl calls | 0 | 0 |

Maximum observed contact pages per company: 5. Maximum observed Exa pages per eligible company: 3.

### 33.4 Persistence/API verification

- One new `lead_qualification_runs` record.
- 77 `lead_qualification_results` records.
- All 77 results contain `metadata.contactDiscovery`.
- `metadata.algorithmVersion` is `contact-discovery-v1` for persisted results.
- Partner emails remain in `contactDiscovery.emails` with `ownership=partner`, separate from usable
  emails in `contacts.emails`.
- Published API endpoint returned HTTP 200 with the completed run.
- Results endpoint returned 68 accepted and 9 excluded results.
- Original research fingerprint remained `caab4e8b244c90d6e56e1afe05fefcf8`.
- No Stage 01–04 or schema changes.

The initial run label was persisted as `lead-qualification-v1` because the runtime's version options
were not wired into `LeadQualificationService.start`. The wiring was corrected and only the existing
run's version labels were updated to `contact-discovery-v1`; discovery was not rerun and results
were not changed.

### 33.5 Reference comparison

Saved-evidence reference: **64 retained, 128 communication-ready, 65 partner**.

Live: **68 retained, 133 retained-company communication-ready, 5 partner**.

Differences are explained by current live pages, actual link selection and the revised Exa policy:

- **Brolis Timber:** retained with 5 usable and 5 partner emails, matching the reference behavior.
- **NVG:** retained with only the Stage 04 company address; the two `nvgroup.lt` emails from the reference Exa run
  were not fetched because a usable Stage 04 email already existed, so revised Exa targeting skipped
  the query.
- **Thermory:** excluded with no usable or partner emails. The live contact-page selection visited
  `contact-us`, `company` and `thermory-team`, not the historical `partners-distributors` page;
  Exa found current contact/registry pages but no usable email. The reference's 60 Thermory partner
  pairs therefore did not appear, reducing total partner pairs from 65 to 5.
- Four previously missing/foreign reference companies now have usable emails through current pages
  (net retained +4, missing −3, foreign −1). No algorithm change was made during execution.

### 33.6 Proof after version correction

```text
✓ test/contact-discovery/extractor.test.ts (8 tests)
✓ test/contact-discovery-pipeline/pipeline.test.ts (3 tests)

Test Files  2 passed (2)
     Tests  11 passed (11)
PASS: post-run integration correction
```

Build passed; exit code 0.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 34. Contacts tab using published Stage 05 result (2026-11-27)

### 34.1 Implementation

The research-detail Contacts tab now reads the published Stage 05 Contact Discovery V1 result
instead of Stage 04 company contacts. The existing Stage 04 summary, Companies and Market tabs are
unchanged.

The new read path is:

`/api/research/[jobId]/stage05` → latest run check → published run → accepted/excluded result rows.

It parses the persisted `contactDiscovery` metadata contract with zod and never substitutes Stage 04
contact data. The tab count, summary counts, company rows, usable-email list, partner contacts and
excluded reasons are all derived from the API response.

### 34.2 Live acceptance against `cmww8smxb0000z4swhooukamv`

Browser verification against the existing published run:

- Tab label: **Contacts 68**
- Retained companies: **68**
- Usable email addresses: **133**
- Excluded companies: **9**
- Search `bro`: **Brolis Timber only**
- Brolis usable emails: **5**
- Partner contacts: separate expanded section; not counted as usable company emails
- Excluded view: **9** rows with their actual reasons

The Stage 04 summary metrics remained `77` company profiles, `173` offers, `51` companies with
email and `50` companies with phone. Companies and Market e2e coverage remained green.

### 34.3 States and separation

The Contacts UI supports:

- missing Stage 05 result;
- queued/running (quiet polling);
- failed/interrupted;
- completed;
- loading;
- API failure with retry;
- empty retained/excluded result sets.

Usable emails are rendered from `contactDiscovery.emails[].ownership=usable`; partner/distributor
emails use `ownership=partner` in a separate section. No partner address is counted or rendered as a
usable company email.

### 34.4 Proof

```text
npm run verify:web
→ typecheck passed
→ lint passed
→ 156/156 unit tests passed
→ Prettier check passed

npm run e2e -w @sdr-assistant/web -- research-results.spec.ts
→ 10/10 tests passed
→ PASS: Contacts UI verified against live published Stage 05 result
```

Exit code: **0**.

Screenshots (live API, existing published result):

- `apps/web/test-results/stage05-live/contacts-retained-overview.png`
- `apps/web/test-results/stage05-live/contacts-brolis-search.png`
- `apps/web/test-results/stage05-live/contacts-brolis-partner-details.png`
- `apps/web/test-results/stage05-live/contacts-excluded-view.png`

### 34.5 Changed files

- `apps/web/app/api/research/[jobId]/stage05/route.ts` (new)
- `apps/web/entities/research/api/stage05.client.ts` (new)
- `apps/web/entities/research/model/stage05.ts` (new)
- `apps/web/entities/research/client.ts`
- `apps/web/features/track-research/model/stage05-browser.ts` (new)
- `apps/web/features/track-research/model/stage05-browser.test.ts` (new)
- `apps/web/features/track-research/model/use-stage05-contacts.ts` (new)
- `apps/web/features/track-research/ui/research-contacts.tsx`
- `apps/web/features/track-research/ui/research-workspace.tsx`
- `apps/web/app/globals.css`
- `apps/web/e2e/mock-api.mjs`
- `apps/web/e2e/research-results.spec.ts`
- this task document and `docs/tasks/README.md`

### 34.6 Limitations

- All live acceptance evidence is from the single published Stage 05 result; no new run was started.
- No Stage 05 API endpoint or algorithm was changed.
- No backend, schema, provider or database modification was made for this task.
- The running/failed/API-error states are implemented but only the completed live state and the
  existing no-result paths are exercised by the current e2e suite.

SDR-007A remains `READY_FOR_HUMAN_REVIEW`, not `DONE`.


## 35. Final human acceptance and closure (2026-11-27)

### 35.1 Acceptance

The human owner accepted SDR-007A on 2026-11-27 and authorized the final status:

**`DONE / HUMAN_APPROVED`**

The accepted implementation covers Contact Discovery V1, selective reprocessing corrections,
the published Contacts result, and automatic Stage 05 execution after successful Stage 04
persistence.

### 35.2 Final published behavior

The final published Stage 05 result contains:

| Metric | Count |
| --- | ---: |
| Processed companies | **77** |
| Retained companies | **71** |
| Excluded companies | **6** |
| Retained-company usable email pairs | **138** |
| All usable email pairs | **186** |
| Partner/distributor pairs | **5** |
| Missing-email exclusions | **4** |
| Foreign-telephone exclusions | **2** |
| Technical failures | **0** |

The 186 all-usable total includes 48 usable pairs on excluded companies (Thermory 47,
LinkedIn Woodwork 1). The retained communication-ready count is 138, so the totals reconcile as
138 retained + 48 excluded = 186.

The accepted Contacts tab behavior is:

- published Stage 05 result, not Stage 04 contacts;
- tab and summary counts derived from the API;
- all usable emails visible per retained company;
- partner/distributor contacts separated;
- excluded companies and actual reasons in a separate view;
- search, local pagination and expandable contact details;
- explicit loading, no-result, running, failed, API-error and empty states.

### 35.3 Automatic Stage 05 execution

The final integration adds a durable launch intent on `Research.stage`:

```text
05-contact-discovery-pending
```

- The marker is written atomically with `COMPLETED` and the Stage 04 result.
- It is removed only after `runtime.start` has returned a durably created Stage 05 run.
- Startup recovery scans marked COMPLETED researches and starts/resumes their Stage 05 run.
- Start failures receive three bounded in-process attempts with 250 ms and 1,000 ms backoff.
- If the retry budget is exhausted, the marker remains for the next application startup.
- The stable start key is `stage05:contact-discovery-v1:<researchId>`.
- AUTO runs with queued/interrupted/expired leases are recovered on startup.
- Manual/historical researches are not selected and are not backfilled.
- The public research API masks the internal pending marker as `stage: null`; the research status
  remains `COMPLETED` and existing frontend behavior is preserved.
- Stage 05 already publishes only after all source companies are present and keeps the previous
  published result until a complete replacement publishes.

### 35.4 Final verification

The final focused proof command was:

```text
npm run build -w @sdr-assistant/api
npm run test -w @sdr-assistant/api -- test/contact-discovery.automation.test.ts test/research.result.test.ts test/contact-discovery/ test/contact-discovery-pipeline/
npm run verify:web
npm run e2e -w @sdr-assistant/web -- research-results.spec.ts
```

Actual results:

- API build passed.
- API focus: **30 passed, 2 optional artifact tests skipped, 0 failed**.
- Web: `verify:web` passed; **160/160 tests**, typecheck, lint and formatting.
- Playwright: **11/11 passed**, including the automatic Stage 05 running state.
- The durable-marker tests cover atomic completion, marker clearing only after run creation,
  startup recovery, bounded retries, exhausted retry budget and marker masking.
- The final live API/UI verification before closure reported the published 71/138/6 result.

### 35.5 Accepted limitations

- The durable launch marker reuses `Research.stage`; raw database clients can observe the transient
  pending value while the public API masks it.
- Recovery requires the application to start; there is no external scheduler or worker.
- In-process start retry is bounded to three attempts. After that, the marker waits for a later
  application startup.
- No historical backfill is performed; only new Stage 04 completions create a pending marker.
- The provider-facing live Stage 05 path is not exercised by the synthetic orchestration tests.
- A valid Stage 05 execution lease is recovered after expiry; until then the active owner is
  treated as authoritative.
- No new schema, dependency, contact-discovery algorithm or Stage 01–04 algorithm changes were made
  for the final launch-intent correction.

### 35.6 Closure

This task is closed as `DONE / HUMAN_APPROVED`. The human owner authorized the final commit and
push. No SDR-008 work was started in this session.
