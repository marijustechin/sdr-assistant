# Handover — 2026-11-14

## Baseline

- Branch: `main`
- Baseline commit: `072a5a8` — `Add research jobs and company discovery`
- Remote: `origin` → `https://github.com/marijustechin/sdr-assistant.git`
- Raw identification fixtures are local only:
  `apps/api/src/modules/research/stages/01-product-identification/temp/` is gitignored.

## What works

- **01-product-identification**: English product name/description + country →
  `productName`, `categoryName`, `generalCategoryName`.
  The final answer is validated with `identifiedProductSchema`; searched with
  Exa and DeepSeek Search; prepared pages are deduplicated and merged.
- **Background research**: `POST /research` creates a Prisma `Research` job and
  returns `jobId`; the worker updates `status`, `stage` and `result`; the web
  client polls `GET /research/:jobId`.
- **Identification fixtures**: `writeIdentificationFixture` /
  `readIdentificationFixture` in
  `apps/api/src/modules/research/lib/research-fixture.lib.ts`.
  Current `ResearchService.runResearch` reads fixture `abachi-lt` and calls
  `CompanyDiscoveryService`.
- **02-company-discovery**: skeleton prompt and service exist; not yet validated
  or hardened.
- **Web**: `/researches` pages, `_pages/research`, `entities/research` and
  `app/api/research/[jobId]` polling proxy. The old `products/[id]` research
  form is still the only way to start a run. The detail page now renders status,
  terminal states and the result; polling is bounded, backs off, stops on 4xx and
  aborts on unmount. Audit, plan, harness and tooling landed on 2026-11-14 — see
  `docs/audits/frontend-2026-11-14.md`, `docs/plans/frontend-action-plan-2026-11-14.md`,
  `docs/system/`.

## Temporary state

- The live 01 identification call is **commented out** in
  `apps/api/src/modules/research/research.service.ts` while 02 is being tested
  from fixtures.
- `abachi-lt` (and other fixtures) live only in the local `temp/` directory and
  are not committed.
- `npm run build`: API build and Next.js compile/typecheck pass, but
  `next build` ends with `spawn EPERM` in this sandbox. Run the web build in a
  normal terminal/outside the sandbox.
- The research sections in `AGENTS.md` still mention the old stage 2/3 ladder;
  they are legacy notes, not the current implementation.

## Key decisions

- One research run = one product + one market/language.
- Use both Exa and DeepSeek Search; they complement each other.
- 01 returns three names: product, category, broader general category.
- No per-page evidence taxonomy in the current flow.
- Fixtures are for 02 development; raw page content is not committed.
- Keep the final answer schema and prompt in sync.
- **Protected area:** do not modify `apps/api/src/modules/research` code without
  an explicit, specific request from the user.

## Commands

```bash
npm run dev                 # API + web
npm run build               # API build + web build
npm run verify:web          # web typecheck + lint + format:check (gate)
npm run db:up               # PostgreSQL
npm run db:migrate          # Prisma migrations
```

In PowerShell inside the DSH sandbox use `npm.cmd` / `npx.cmd` (the `.ps1` shims fail on a
named pipe). See `docs/system/harness.md` §4 for the full caveat list.

Typechecks used during cleanup:

```bash
node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
```

## Next

See [TODO.md](TODO.md). Harness, frontend audit and the frontend action plan landed on
2026-11-14. Next is the research flow P0 (checklist in `ops/current.md`), then the Lite FSD
migration and the remaining phases of the plan.
