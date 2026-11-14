# Agent notes

## Protected area

- **Do not modify code under `apps/api/src/modules/research` without an
  explicit, specific request from the user.** Documentation, README, TODO and
  non-research code may be changed as part of project maintenance.
- Raw identification fixtures live in
  `apps/api/src/modules/research/stages/01-product-identification/temp/` and are
  gitignored. Do not commit them.

## Current research flow

- `01-product-identification` returns `productName`, `categoryName` and
  `generalCategoryName` for one product + one market.
- `02-company-discovery` consumes an identification fixture and produces the
  company discovery result.
- While 02 is being tested, the live 01 call is commented out in
  `ResearchService`; see [HANDOVER.md](HANDOVER.md) and [TODO.md](TODO.md).

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
