# Agent notes

## Start here

- [docs/system/harness.md](docs/system/harness.md) — commands, sandbox caveats, verification
  ladder, stop rules.
- [docs/system/frontend.md](docs/system/frontend.md) — frontend layers, contracts, styling.
- [ops/current.md](ops/current.md) — the single active task.
- [TODO.md](TODO.md) — one item in "Now"; everything else in
  [ops/backlog.md](ops/backlog.md).
- Frontend plan: [docs/plans/frontend-action-plan-2026-11-14.md](docs/plans/frontend-action-plan-2026-11-14.md).

Commands (see harness for the full table):

```bash
npm run dev            # API 4000 + web 3000
npm run verify:web     # typecheck + lint + test + format:check  (gate for every web change)
npm run e2e:web        # Playwright: 10 rendered scenarios, mock API (never the paid one)
npm run build          # API tsc + next build (needs full access, harness §4)
```

## Protected area

- **Do not modify code under `apps/api/src/modules/research` without an
  explicit, specific request from the user.** Documentation, README, TODO and
  non-research code may be changed as part of project maintenance.
- That module is being edited by the user: keep formatters, linters and codemods scoped to
  `apps/web`. Never run a repo-wide `prettier --write` or `eslint --fix`.
- Raw identification fixtures and run dumps live in
  `apps/api/src/modules/research/temp/` and are gitignored. Do not commit them.

## Frontend

- Scope: everything under `apps/web`. The API is consumed over HTTP only.
- Next.js 16.4 — this is not the Next.js of older training data. Read the relevant guide in
  `node_modules/next/dist/docs/` before using a Next API. `next lint` no longer exists;
  linting is `eslint .`.
- Architecture and rules: [docs/system/frontend.md](docs/system/frontend.md).
  Decision: [ADR-002](docs/decisions/ADR-002-frontend-lite-fsd.md).
- Hard rules:
  - `app/**` is routing only — metadata, `params`, one view component.
  - No `fetch(` outside `shared/api/**` and `app/api/**` route handlers.
  - Every wire payload is parsed with a zod schema; types are `z.infer`. No `any`, no `as`
    on `response.json()`.
  - Failures are values (`Result`), not exceptions thrown into the render tree.
  - Every async surface has loading, empty, error and terminal states.
  - `next-env.d.ts` is generated and git-ignored — never edit or commit it.
- Tooling is workspace-local: `eslint`, `eslint-config-next`, `prettier` in
  `apps/web/package.json`; configs in `apps/web/`. `npm run verify:web` must pass.
- `research.result` is an open JSON value while stage 02 is in development. Render it
  defensively; do not type it.

## Current research flow

- `01-product-identification` returns `productName`, `categoryName` and
  `generalCategoryName` for one product + one market. Its live search/identify path is
  temporarily replaced by a fixture replay; see [ops/current.md](ops/current.md).
- `02-page-collection` searches the identified names, merges those pages with the ones 01
  found, fetches missing text and triages every page (one LLM call per page, six at a time)
  into `good`/`none`.
- `03-company-discovery` builds one profile per good domain: homepage scrape, up to two
  evidence pages, contact-page hunt, then an `a`/`b`/`none`/`unclear` verdict plus contacts
  and prices. `a` means the offered material and product form match the product name;
  qualifiers such as treatment, grade or dimension are optional.
- Runs are asynchronous: `POST /research` returns `202 {jobId, status}`, the client polls
  `GET /research/:jobId`, and the web detail page renders the terminal state. When discovery
  is enabled the run stores `result: { companies }`.

## Research runs: one product, one market

- One research run = **one product + one market/language**. The request carries
  `name`, `description`, `country`; the country determines the single target
  language for that run.
- Never design for several languages in one run: no language list, no
  per-language batching, no "five languages at once".
- The product can be anything (industrial goods, used clothing, food, services)
  and the market can be any country/language. Do not hardcode product
  categories, wood/sauna assumptions, or a fixed country list.
- All generation, evidence, and output are scoped to that run's product and
  language.
- The sense spec's `form` is one category seed, not a constraint on stage 2.
  Stage 2 must generate multiple meaningful term families from the full
  description (application, material, treatment, supply forms); never reduce
  it to one term per category.
- Examples: `Thermo Abachi Cladding` + Lithuania; `Used Clothing` + Hungary;
  another product + Bulgaria.

## Legacy notes: ladder levels and candidate expansion (not current implementation)

1. Ladder levels are provisional priority hints, never eligibility filters.
   Evaluate family heads, term variants, and discovered labels against
   product sense and specificity before assigning them to general, specific,
   or broader.
2. Stage 3 verifies seed candidates and extracts newly discovered relevant
   category labels with evidence URLs and context. Discovered candidates
   enter subsequent evaluation and bounded search expansion.
- The candidate set includes term variants, not only family heads; otherwise
  structured synonyms are lost.
- Inclusion in the candidate set does not assign a term to general. A
  material-specific subordinate compound may be a valid specific term;
  meaning and specificity, supported by source evidence, decide the
  assignment.
- Language fit follows commercial usage, international names, and spelling
  variants; do not reject a variant as foreign on normative spelling alone.
