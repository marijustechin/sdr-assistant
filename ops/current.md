# Current task — 2026-11-17

**Task:** research pipeline — page collection (02) and company discovery (03) on real runs
**Scope:** `apps/api/src/modules/research` (edited with the user's explicit permission) plus the
Next.js security bump in `apps/web`.
**Status:** **paused by the user** after the first end-to-end runs. The flow works, but stages 01
and the 02 search step are fed from dumps to save credits.

## Where the flow stands

| Stage | State |
| --- | --- |
| `01-product-identification` | **fixture replay**: reads `identified-product-dailylentes.json` and `identification-pages-dailylentes25.json` (a curated 25-page sample) from `temp/` and returns them. The live term-generation → search → identify path is commented out in the service, and the fixture slug is hardcoded. |
| `02-page-collection` | reads `02.1-merged-pages.json`, triages every page, writes `02.2-tirage.json` and `02.3-page-collection-response.json`. Its own search + merge are commented out. |
| `03-company-discovery` | **live**: `{targetCountry, product, pages}` → one profile per domain (`a`/`b`/`none`/`unclear`), contacts, prices; writes `04-companies-<stamp>.json`; the run stores `result: {companies}`. |

`temp/` is git-ignored; dumps are local only.

## Measured runs (same 132-page input, three triage prompts)

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

## Decisions taken

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

## Remaining work

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

## Revert paths

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

## How to run one iteration

```bash
npm run dev            # API on :4000, web on :3000
# POST /research { productId, country, name, description } → 202 { jobId }
# stages: 1.x → 2.x → 3.1 Discovering companies n/m (<domain>) → COMPLETED
```

Dumps appear in `apps/api/src/modules/research/temp/`; the run row (`status`, `stage`,
`lastHeartbeatAt`, `result`) is the source of truth while it runs.
