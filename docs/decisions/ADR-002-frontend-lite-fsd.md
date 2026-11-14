# ADR-002 — Frontend uses Lite FSD

- **Status:** accepted
- **Date:** 2026-11-14
- **Deciders:** frontend workstream
- **Related:** [audit](../audits/frontend-2026-11-14.md) §1.2, §2.14, §4 ·
  [plan](../plans/frontend-action-plan-2026-11-14.md) §2 Phase 4 ·
  [frontend conventions](../system/frontend.md)

## Context

`apps/web` is 29 files / ~1.5k lines today and will grow: more research surfaces, product
management, and eventually comparison views. The existing structure is already ~70 % FSD —
`_pages/` (non-routable pages layer), `entities/research/{api,model}` with explicit
`.server.ts` / `.client.ts` split, a public barrel per slice — but it is inconsistent:

- `lib/` mixes three responsibilities (base URL config, a product API, country data).
- Server actions and forms live inside route folders (`app/products/[id]/actions.ts`,
  `research-form.tsx`), so `app/` carries business logic.
- Product data is fetched ad-hoc in a page with a duplicated `Product` type.
- No `shared/`, no `features/`, no enforced import direction.

The audit showed the cost of that drift (unvalidated wire data, duplicated validation,
two status sources, unreachable UI branches). The project is expected to grow, so the
structure has to be enforceable rather than conventional.

## Decision

Adopt **Lite FSD**: five layers, no `processes`, `widgets` only when a third consumer appears.

```text
app/ → _pages/ → features/ → entities/ → shared/
```

1. **`app/` is routing only** — metadata, `params`, one view component. No fetch, no
   validation, no business logic, no server actions.
2. **`_pages/` is the FSD pages layer**, kept non-routable with the underscore prefix.
   A top-level `pages/` directory is reserved by Next for the Pages Router and would be
   picked up as routes.
3. **`features/` holds verbs only** (create-product, edit-product, start-research,
   track-research): form + server action + local state types, together.
4. **`entities/` holds nouns** (product, research): `api/{server,client}.ts`,
   `model/{schema,types}.ts`, one public `index.ts`.
5. **`shared/` holds infrastructure** (http, env, countries, format, ui primitives).
6. Layers are at `apps/web` root, not under `src/`; `@/*` already maps there.
7. Imports flow down only; one public `index.ts` per slice; cross-slice imports never reach
   into a segment.

## Consequences

**Positive**

- Route files stay small, so route changes (params, metadata, redirects) never touch logic.
- Server/client boundaries are visible in file names and can be linted.
- New surfaces follow a template instead of inventing a folder.
- Matches the Next.js App Router model: RSC by default, client islands, actions for
  mutations.

**Negative / costs**

- One migration pass (Phase 4, ~0.5–1 day) with pure file moves.
- Two names for the same concept (`app/` for routing vs. FSD's "app layer") — documented
  once in `docs/system/frontend.md` instead of being smuggled into a rename.
- More `index.ts` files to maintain; worth it only because boundaries are linted.
- Risk of layer inflation on a small app: `widgets/` is explicitly deferred, and `features/`
  is only for verbs.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Next-native colocation (everything under `app/`) | Simplest for 29 files, but it is exactly the current problem: route folders accumulate data access, validation and actions. Does not scale to the planned size. |
| Full FSD (with `processes/`, `widgets/`, strict segments everywhere) | Ceremony without consumers: no cross-page processes exist, one composite is reused by two pages. Revisit if a third page needs a shared composite. |
| Feature folders without layers (`features/*` only) | Loses the entity/shared distinction that keeps API contracts in one place; pages end up owning queries. |
| Move everything under `src/` | Pure churn: alias, tsconfig `include`, every import — for zero architectural gain. FSD does not require it. |
| Separate contracts package now | Requires the API DTOs to import it; the research module is frozen and owned elsewhere. Deferred in `ops/backlog.md`. |

## Compliance

- `docs/system/frontend.md` is the operational version of this decision.
- Phase 4.4 adds `eslint-plugin-boundaries` so an upward import fails `npm run lint`.
- Review rule until then: a diff that adds `fetch`, a schema or a server action under
  `app/**` is rejected.
- Revisit when: a third page needs the same composite (then add `widgets/`), or the API gets
  external consumers (then extract contracts).
