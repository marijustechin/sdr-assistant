# Current task — 2026-11-17

**Task:** settings foundation — API module, one real setting, `/settings` pages
**Scope:** new `apps/api/src/modules/settings`, Prisma `Setting` model + one migration, new web
`entities/settings` / `features/update-settings` / `_pages/settings*`, app shell navigation.
**Status:** **built and verified** (`verify:web`, API `tsc`, API vitest, E2E, `next build`).
The migration file exists but **has not been applied**: Postgres was down (Docker daemon
unreachable, `localhost:5433` closed) and the chosen path was "add migration file only".

## What was built

### API

- `GET /settings` → `{ groups: [{ key, label, description, items: [...] }] }` where each item is
  `{ key, label, description, type, value, default, min, max }`.
- `PATCH /settings` takes `{ updates: Record<string, unknown> }`, validates **every** key and
  value against the registry, upserts the batch in one transaction and returns the same grouped
  shape. Unknown key or invalid value → `400` whose message names every failing key
  (`Unknown setting key: …`, `Invalid value for …: …`).
- Precedence is **code default → DB value**. No env overrides, no per-run overrides. A stored
  value that no longer validates falls back to the default and logs a warning.
- Registry: `apps/api/src/modules/settings/settings.registry.ts` — group + definition, zod schema,
  default, label, description, type, min/max. `assertSettingsRegistry()` runs at import and
  rejects duplicate keys, unknown groups, bad defaults and inverted bounds.
- Prisma `Setting { key String @id, value Json, createdAt, updatedAt }` mapped to `settings`
  (`apps/api/prisma/schema.prisma`). Exactly one migration:
  `apps/api/prisma/migrations/20261117190641_add_setting/migration.sql`.
- First setting: `research.pageCollection.resultsPerQuery` — integer, default `20`, min `1`,
  max `50`; how many search results stage 02 requests per query per provider.

### Web

- Sidebar "Settings" item (gear/sliders icon), `/settings` hub and `/settings/research`, with
  Overview / Research section tabs.
- `app/**` is routing only. Views are `_pages/settings` and `_pages/research-settings`; the wire
  schema and pure validation live in `entities/settings/model/schema.ts`; HTTP is
  `entities/settings/api/settings.server.ts` (through `shared/api`); saving is the server action
  `features/update-settings/api/action.ts`.
- The form is generated from the API metadata, not a field list: value, default, min/max, label,
  description and control type all come from `GET /settings`. It has client-side validation,
  surfaces the server error, renders loading / empty / error / pending states, and toasts on save
  success and failure.
- Tests: API registry (10), web entity schema (7) and the rendered form's validation error (1 of
  65 total web tests).

### Verification (2026-11-17)

| Check | Result |
| --- | --- |
| `npm run verify:web` | green — 65 tests, typecheck, lint, format |
| `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` | exit 0 |
| `npm test --workspace @sdr-assistant/api` | 10/10 |
| `npm run e2e -w @sdr-assistant/web` | 11/11 rendered scenarios |
| `npm run build -w @sdr-assistant/web` | 13 routes, including `/settings` and `/settings/research` |
| `prisma validate` | schema valid |
| `prisma migrate diff --from-empty --to-schema …` | `settings` table matches the migration |
| **the migration itself** | **not run** — Postgres unavailable |

## How to add a setting in one place

Everything starts in `apps/api/src/modules/settings/settings.registry.ts`.

1. New area? Add one entry to `SETTING_GROUPS` — `key`, `label`, `description`.
2. Append one definition to `SETTINGS`. For an integer use
   `integerSetting({ key: '<group>.<name>', group, label, description, defaultValue, min, max })`.
   For a string/boolean add the matching helper (or a definition with `schema`, `type`, and
   `min: null, max: null`).
3. Restart the API. `GET /settings` carries it, `PATCH /settings` validates it and the web form
   renders it from the metadata — no frontend field list, no migration (the table stores
   key → JSON).

A new **type** needs three touch points: `SETTING_TYPES` in the registry, one control branch in
`features/update-settings/ui/settings-form.tsx`, and the client validator in
`entities/settings/model/schema.ts` (`readSettingInput`). The API registry stays the source of
truth and validates again.

## When Postgres is up

```bash
npm run db:up
npm run db:migrate        # applies 20261117190641_add_setting
npm run db:check          # optional: API build + connectivity
```

Then exercise `GET /settings` and `PATCH /settings` against the real database and open
`/settings/research`.

## Deliberately left for later

- **Wire the first setting into stage 02.** Its live search step is commented out and the stage
  replays `02.1-merged-pages.json`; the literal `resultsPerQuery: 20` sits inside that dead code.
  Injecting the stored value would touch `apps/api/src/modules/research` (protected area), so the
  registry entry carries a TODO with the exact location instead. **No current run reads the
  setting yet.**
- **Per-run snapshot of the settings a run used.** Not stored on `Research`; without it the UI
  cannot show which values produced an old result, and changing a setting silently changes the
  meaning of future runs. Needs a schema decision (JSON column on `researches` vs.
  `result.settings`) and an explicit request because it touches the research module.
- **Model per stage.** Next likely group (`research.models`), mapping stage → model id. The LLM
  config currently lives in the research module.
- **More groups.** Triage, fetching and discovery settings; each is one group entry + one
  definition.
- **Per-run and env overrides.** Intentionally absent: precedence is deliberately only
  default → DB.

## Parked — research pipeline (02 / 03)

**Task:** research pipeline — page collection (02) and company discovery (03) on real runs
**Status:** **paused by the user** after the first end-to-end runs. The flow works, but stages 01
and the 02 search step are fed from dumps to save credits.

### Where the flow stands

| Stage | State |
| --- | --- |
| `01-product-identification` | **fixture replay**: reads `identified-product-dailylentes.json` and `identification-pages-dailylentes25.json` (a curated 25-page sample) from `temp/` and returns them. The live term-generation → search → identify path is commented out in the service, and the fixture slug is hardcoded. |
| `02-page-collection` | reads `02.1-merged-pages.json`, triages every page, writes `02.2-tirage.json` and `02.3-page-collection-response.json`. Its own search + merge are commented out. |
| `03-company-discovery` | **live**: `{targetCountry, product, pages}` → one profile per domain (`a`/`b`/`none`/`unclear`), contacts, prices; writes `04-companies-<stamp>.json`; the run stores `result: {companies}`. |

`temp/` is git-ignored; dumps are local only.

### Measured runs (same 132-page input, three triage prompts)

| | v15 literal | v16 semantic | **v17 = v15 + 1 sentence** |
| --- | --- | --- | --- |
| triage `good`/`none` | 93 / 39 | 91 / 41 | 90 / 42 |
| companies | 52 | 49 | 49 |
| `a` | 5 | 5 | 4 (one stricter: plain abachi, no "termo") |
| emails | 91 | 79 | 80 |
| verdict | baseline | **degraded** | **kept** |

v16 lost real Lithuanian sellers (`pata.lt`, `nvg.lt` were read as "articles") and let foreign shops
in. v17 keeps them, drops `skelbiu.lt` (third-party platform) and `skv.lt` (mass-market), and adds no
foreign noise. The 03 output for v17: 49 companies, 4 `a` with 91 prices.

### Decisions taken

- **02 collects, 03 decides.** 02 must stay recall-oriented; material and company-type judgments
  belong to 03. The code-side re-check of rule 2 (`verifyTriage`) was removed for this reason.
- **triage v17** = v15 word-for-word plus one rule 1 sentence: *"An advert or a listing published on
  a third-party platform is not the seller's own commercial offer."*
- **discovery v9**: `a` requires the identifying **material and product form**; qualifiers that only
  describe treatment, grade, colour, dimension, brand or style are optional, so plain
  "abachi dailylentės" counts as `a` for "termo abachi dailylentės".
- **Prices**: any supplied page may carry them, but a price counts only when it sits within 1 200
  characters of at least two of the product name's word stems; placeholder zeros are dropped. The
  model's own offers pass the same test.
- No hardcoded markets, categories or domain blocklists.

### Remaining work

- [ ] Re-enable the live 01 path (credits permitting) and the 02 search + merge.
- [ ] Re-measure the price filter end to end; the proximity rule was only unit-checked against
      `02.3` texts (it removed the homepage noise: `sauna.lt` 30 → 4, `matosauna` 30 → 12).
- [ ] Contacts: 14 of 49 companies have no email. `extractEmails` runs over the homepage and contact
      pages only — add the 02 page texts, which already contain the same footer.
- [ ] Homepage: still sent to the model as evidence and still the only source of `links`. Decide
      whether it should contribute links only.
- [ ] Company type: a white-label storefront of a foreign platform (e.g. `pirtiesbites.lt`, a
      SaunaBee reseller) still gets `b`; there is no rule for it yet.
- [ ] `a` depends on which two evidence pages 03 picks; consider using every product-matching page.
- [ ] `GET /research` still has no `orderBy`/`take`; partial unique index on active runs is open.

### Revert paths

- **triage v17 → v15**: `page-triage.prompt.ts` holds v15, v16 and v17 side by side; swap the two
  exported constants at the bottom. The triage input matches v15, nothing else changes.
- **discovery v9 → v8**: in `company-discovery.prompt.ts`, restore the v8 verdict wording —
  *"a": the supplied information supports an offer matching the complete productName, preserving its
  identifying material, treatment and form. Word order and grammatical forms may differ.* — and the
  v8 price task (*"for every supplied page that shows a price for the offered product…"*), then set
  the version back to `company-discovery-v8`. In `company-discovery.service.ts`, call
  `extractPrices(sourceTexts)` and `validOffers(offers, sourceTexts)` without `productName` and drop
  the `nearProductName` / `priceValue` guards; the helpers `priceValue`, `nearProductName` and
  `escapeRegExp` can be deleted.

### How to run one iteration

```bash
npm run dev            # API on :4000, web on :3000
# POST /research { productId, country, name, description } → 202 { jobId }
# stages: 1.x → 2.x → 3.1 Discovering companies n/m (<domain>) → COMPLETED
```

Dumps appear in `apps/api/src/modules/research/temp/`; the run row (`status`, `stage`,
`lastHeartbeatAt`, `result`) is the source of truth while it runs.
