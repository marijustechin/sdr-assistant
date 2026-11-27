# SDR-008 — Research Email Account Assignment

## 1. Task ID and status

- **Task ID:** SDR-008
- **Title:** Research Email Account Assignment
- **Status:** `DONE / HUMAN_APPROVED` — accepted by the human owner on 2026-11-27 after manual
  assignment of the real email account and confirmation that it persists after closing and
  reopening the research (§14).
- **Registry:** [README.md](README.md)
- **Checkpoint at start:** `57893fc` (`feat: automate contact discovery and research contact results`)
  confirmed with `git log --oneline -8`; the working tree is the implementation baseline.
- **Execution mode:** standard session environment. No dependency installation, no live
  database change and no paid provider call.
- **Research Implementation Freeze:** fully active. No Stage 01–05 algorithm, prompt,
  provider, stage-orchestration, classification or research-result change is authorized.

## 2. Objective

Introduce research-specific communication settings and allow the user to assign an existing
email account to a research.

## 3. Authorized scope and paths

- Add a new **Settings** tab to the existing research detail page, after the current sections.
  The tab contains only the SDR-008 **Email account** section.
- Persist the research-to-email-account assignment in PostgreSQL with one additive Prisma
  migration. The migration may create a research-communication settings relation; it must not
  alter an existing research, stage, product, setting or email-account column or row.
- Add the minimal backend module, controller, DTO, service and API endpoints required to read
  and change the assignment. Reuse the existing Prisma, validation and error conventions.
- Add the minimal frontend entity query/schema, server action and Settings-tab UI. Reuse the
  existing enabled-account list, verification presentation and styling.
- Extend the existing Playwright mock API (`apps/web/e2e/mock-api.mjs`) and add synthetic
  rendered scenarios for SDR-008.
- Add focused backend and frontend tests for the new behavior.
- Record the task in `docs/tasks/README.md` and this task document.

Planned path scope (the final exact inventory is recorded in §10):

- `apps/api/prisma/schema.prisma` and one new additive migration
- `apps/api/src/modules/research-communication/**`
- `apps/api/src/app.module.ts`
- `apps/api/test/research-communication.test.ts`
- `apps/web/entities/research/**`
- `apps/web/entities/email-account/**` (shared verification presentation moved to the entity
  layer for reuse by two features)
- `apps/web/features/track-research/**` (Settings tab, server action, model helpers and tests)
- `apps/web/features/manage-email-account/**` (import/export adjustment only, from the move)
- `apps/web/_pages/research/**`
- `apps/web/e2e/mock-api.mjs`
- `apps/web/e2e/research-settings.spec.ts`
- `docs/tasks/README.md`
- `docs/tasks/SDR-008-research-email-account-assignment.md`

The original plan proposed a separate `features/manage-research-communication` slice. The
implemented placement inside `features/track-research` is smaller and keeps the required
import direction: the export table does not allow `features/track-research` to import a
sibling feature, while the Settings tab must be rendered by `ResearchWorkspace`.

## 4. Explicit exclusions

- No Stage 01–05 algorithm, prompt, provider, model, research-execution or research-result
  change; no research rerun.
- No modification of `apps/api/src/modules/research` source.
- No email sending, mailbox synchronization, SMTP or IMAP connection attempt, or mailbox
  checking.
- No initial subject/message, sending schedule, daily limits, automatic mailbox checking,
  last mailbox check status or check-email-now controls. No placeholder controls for those
  future settings.
- No credential duplication, password exposure or credential management inside research.
  Email credentials remain exclusively managed by the global Email Accounts settings.
- No new dependencies, no dependency upgrades and no architecture change.
- No unrelated refactoring, formatting of unrelated files or repository-wide tooling.
- No deletion, move, formatting or modification of the existing untracked artifacts.
- No commit or push before human acceptance.
- No live database migration deployment, no database row modification and no live-provider
  call in the implementation proof.

## 5. Acceptance criteria

- Settings tab is accessible.
- An existing enabled email account can be assigned.
- Assignment survives page reload.
- Assignment can be changed or removed.
- Multiple researches can share an account.
- Disabled and missing accounts are handled correctly.
- Existing research and Contacts functionality remains unchanged.
- No credentials appear in research API responses.

## 6. Design decisions

- **Persistence:** a new one-row-per-research `research_communication_settings` table with a
  nullable `emailAccountId` relation to the existing `email_accounts` table. This keeps the
  assignment independent of research execution, avoids changing any existing research API
  response or column, and gives the planned communication settings a natural home. Multiple
  researches can reference the same account; the relation is not unique on the account side.
- **Disabled/missing accounts:** the stored assignment is never rewritten automatically. The
  Settings tab resolves the assigned account from the full account list, so a disabled account
  remains visible and removable. An assignment that no longer resolves is shown as unavailable
  and can be removed. Deleting an account that is still assigned is restricted by the foreign
  key, so the assignment is not silently cleared.
- **API:** `GET /research/:jobId/communication` returns the assignment; the minimal mutation
  endpoint accepts only an account id or `null`. It validates the research, the account
  existence and the account's enabled state and returns only the assignment, never account
  configuration or credentials.
- **Frontend:** the research page keeps its existing server-rendered load and adds the
  communication settings plus the existing account list as props. The Settings tab updates its
  assignment locally after the server action and is restored from PostgreSQL on reload. The
  existing verification presentation is reused; it moves to the email-account entity layer only
  so that two features can share it without a feature-to-feature import.

## 7. Single proof command

The canonical proof is:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run build --workspace @sdr-assistant/api
    if ($LASTEXITCODE -ne 0) { throw 'API build failed' }

    npm.cmd run test --workspace @sdr-assistant/api -- test/research-communication.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'Backend assignment tests failed' }

    npm.cmd run verify:web
    if ($LASTEXITCODE -ne 0) { throw 'Frontend verification failed' }

    npm.cmd run e2e:web
    if ($LASTEXITCODE -ne 0) { throw 'Playwright verification failed' }

    Write-Output 'PASS: SDR-008 research email account assignment'
}
```

The proof uses synthetic fixtures and the mock API only. It performs no SMTP/IMAP connection,
no email sending, no mailbox synchronization, no paid provider call and no live database
change. It includes the mandatory `verify:web` gate and the rendered-behaviour Playwright gate.

## 8. Excluded-artifact baseline (before implementation)

30 currently untracked artifacts confirmed with `git status --porcelain=v1 -uall`. SHA-256
baseline (files; the `apps/api/scripts/` directory contributes 12 files):

| Artifact | SHA-256 |
| --- | --- |
| `apps/api/scripts/contact-consolidation.mjs` | `27DF40CB5432B94B0EEF912907F7E69D58E472F68A5CE878BECC52FC74EADFE5` |
| `apps/api/scripts/contact-discovery-offline.mjs` | `4E599728683D45210C9C3421ACEA84DB95682D1319916F7F0598A4CA4422CCEF` |
| `apps/api/scripts/contact-email-ownership.mjs` | `AEED1ECF3DA191C0E1500750381F1B4036467AEA230F46A3104E7078B70CE9AA` |
| `apps/api/scripts/contact-final-filter.mjs` | `C448A958DFAE9007614C47F31B500C4F12165D1BAE88E197434776F834A7FFE9` |
| `apps/api/scripts/contact-homepage-collection.mjs` | `0112530219DEB4065EE338B9CDC9E444B10FDEE6E388E6F755FA05A90159AFB8` |
| `apps/api/scripts/contact-page-discovery.mjs` | `B61EFCDAA18D64E15D8AA57200A60D87EFC1F47932F95EF1884497383A0A4D0B` |
| `apps/api/scripts/exa-contact-discovery.mjs` | `A1C90096DC880941DDB9C9DAF1F98529FC6F55D0C2EE099673866F1C94A8CBEB` |
| `apps/api/scripts/publish-stage05-selective.mjs` | `A16927551E084AD182B84B93778059EFD299DE10523C1BC59DE172444D453D40` |
| `apps/api/scripts/reprocess-stage05-excluded.mjs` | `F2B18553E73725665115253A6BE30AF3098D83B245352418FCA6956A7865101E` |
| `apps/api/scripts/run-stage05-contact-discovery.mjs` | `02297DB1FA0B8B6E0561AEE87E18DE2B26B8E10462139A842ECF8FCEBFC1F768` |
| `apps/api/scripts/stage05-pilot-3.mjs` | `1C6638A885992C9C522CE21B553DA74CFE40209962D8C79E9A9DFD78C5C1D7A3` |
| `apps/api/scripts/verify-stage05-publication.mjs` | `611E9BF4852DAB09E13366956FF675BEB619461EA58AD284B8215A1774687B79` |
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
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-13.json` | `6F51C24844AE7ACEEEA526901AFBE375B92F8629C07853F41AA4DE9C2156E832` |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-01-24.json` | `6E0D7E0334F95841B34A6870534D3FD00B61873AB22DEA56431A55CFC694B8EE` |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-15-12.json` | `B81A0EA47429D28A5E03F4051F41AF0504D2B37A7CA86268A30B5933D9F505DF` |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-14.json` | `DF871261BFEA33F61AE0CBB279B4D8D35E54D7B09BC43EF9EDA39E9E6FABCFF6` |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-25-43.json` | `0B7C46AA5D3AC861BB6DDE90BB724220A871735F0ED53F4200757E4159EFF15C` |
| `src/modules/research/stages/01-product-identification/temp/companies-2026-11-15-14-46-33.json` | `798B3A2E3F55C4CA3B2BAFD4873925E31B001293C49C81B52119376A612ABFAA` |

## 9. Verification result

**PASS.** The single canonical proof command in §7 was executed once on 2026-11-27
(started 16:22 Europe/Vilnius) after implementation, with **exit code 0** and final line
`PASS: SDR-008 research email account assignment`.

| Gate | Result |
| --- | --- |
| API build (`prisma generate` + `tsc -p tsconfig.json`) | **PASS** — Prisma Client generated for the new model; TypeScript compiled |
| Focused backend tests (`test/research-communication.test.ts`) | **PASS — 14/14** tests, 1 file |
| `verify:web` | **PASS** — `next typegen`/`tsc --noEmit`, ESLint (0 warnings), **174/174** Vitest tests in 23 files, Prettier |
| `e2e:web` | **PASS — 45/45** Playwright scenarios, 0 failed, 0 skipped, **1.4m** |

The 45 rendered scenarios comprise the 39 preserved SDR-004/005/007/007A scenarios plus six
new SDR-008 scenarios:

1. Settings tab opens with an unassigned research and no configured accounts.
2. An enabled account with SMTP/IMAP verification is assigned and restored after reload.
3. The assignment is changed and removed, and both states survive reload.
4. Multiple researches share one account.
5. A disabled assigned account stays assigned, is not offered in the selector and is not
   silently replaced; it can be changed explicitly.
6. An assigned account that no longer exists is shown as unavailable and can be removed.

Rendered evidence (git-ignored `apps/web/test-results/`):

- `research-settings-assigns--4578f-nd-restores-it-after-reload-chromium/sdr-008-email-account-assigned-desktop.png`
- `research-settings-keeps-a--48326--never-replaces-it-silently-chromium/sdr-008-email-account-disabled-desktop.png`

Development checks before the canonical proof used the same focused commands (API build,
focused backend tests, web typecheck, focused web tests, focused Playwright). The first
focused Playwright run exposed a strict-mode locator ambiguity in the new spec
(`Disabled` matched both the status badge and the explanatory hint); the new spec was
corrected before the canonical proof. The canonical proof itself was executed once and
passed.

No live database, SMTP/IMAP connection, email send, mailbox synchronization or paid
provider call occurred during the proof.

## 10. Implementation record and changed files

### Backend

- Added `ResearchCommunicationSettings` to the Prisma schema: one row per research, an
  optional `emailAccountId` relation to `email_accounts`, no credential column and no change
  to an existing table. `onDelete: Cascade` follows the research; `onDelete: Restrict`
  protects an account that is still assigned.
- Added the additive migration
  `20261127170000_add_research_communication_settings` (one table, one index, two foreign
  keys; no existing table or row is altered). The DDL was generated from the Prisma schema
  with `prisma migrate diff --from-empty --to-schema` and verified against the generated
  client.
- Added `modules/research-communication`: `GET /research/:jobId/communication` and
  `PATCH /research/:jobId/communication/email-account`. The endpoint validates the research,
  the account existence and the account's enabled state, returns only
  `{ emailAccountId }`, and never reads or returns a credential. The module is registered in
  `app.module.ts`; `apps/api/src/modules/research` is untouched.
- Added `test/research-communication.test.ts`: 14 tests over a synthetic in-memory Prisma
  stand-in covering read, assign, change, remove, sharing, disabled and missing accounts,
  unknown research, idempotency, credential exclusion and DTO validation.

### Frontend

- Added the research entity communication schema and server client
  (`fetchResearchCommunication`, `updateResearchEmailAccount`) using the existing
  `Result`/zod HTTP layer.
- Added the Settings tab (fifth tab) and the Email account section. It shows the current
  assignment, account name, address, enabled/disabled state and existing SMTP/IMAP
  verification results; offers only enabled accounts; supports assign, change and remove;
  and handles no-account, no-enabled-account, disabled, missing and load-error states. The
  assignment is held above the tab content so switching sections does not reset it, and a
  page reload restores it from the server.
- Added the `updateResearchEmailAccountAction` server action with `revalidatePath`; no
  credential is part of the request or response.
- Moved `EmailAccountVerificationStatus` from the manage-email-account feature to the
  email-account entity layer so two features can share it without a sibling-feature import.
  Existing imports were adjusted; the component's markup and behaviour are unchanged.
- Added model helpers and tests for the assignment resolution and enabled-account selection,
  plus a jsdom component test for all Settings-tab states and actions.
- Extended the Playwright mock API with the assignment endpoints and reset, added
  `e2e/research-settings.spec.ts` (six scenarios and two screenshots), and updated the
  SDR-007 tab-label expectation to include the new Settings tab.
- No CSS change was required: the section reuses `card`, `field`, `actions`, `status`,
  `hint`, `button` and existing Tailwind utilities and tokens.

### Changed files

```text
M  apps/api/prisma/schema.prisma
A  apps/api/prisma/migrations/20261127170000_add_research_communication_settings/migration.sql
M  apps/api/src/app.module.ts
A  apps/api/src/modules/research-communication/dto/update-research-email-account.dto.ts
A  apps/api/src/modules/research-communication/research-communication.controller.ts
A  apps/api/src/modules/research-communication/research-communication.module.ts
A  apps/api/src/modules/research-communication/research-communication.service.ts
A  apps/api/test/research-communication.test.ts
M  apps/web/_pages/research/ui/research-page.tsx
M  apps/web/e2e/mock-api.mjs
M  apps/web/e2e/research-results.spec.ts
A  apps/web/e2e/research-settings.spec.ts
M  apps/web/entities/email-account/client.ts
M  apps/web/entities/email-account/index.ts
A  apps/web/entities/email-account/ui/email-account-verification-status.tsx
M  apps/web/features/manage-email-account/index.ts
M  apps/web/features/manage-email-account/ui/email-account-form.tsx
D  apps/web/features/manage-email-account/ui/email-account-verification-status.tsx
A  apps/web/features/track-research/api/update-email-account-action.ts
M  apps/web/features/track-research/index.ts
A  apps/web/features/track-research/model/research-settings.ts
A  apps/web/features/track-research/model/research-settings.test.ts
M  apps/web/features/track-research/model/sections.ts
A  apps/web/features/track-research/ui/research-settings.tsx
A  apps/web/features/track-research/ui/research-settings.test.tsx
M  apps/web/features/track-research/ui/research-tabs.tsx
M  apps/web/features/track-research/ui/research-workspace.tsx
M  apps/web/entities/research/api/research.server.ts
M  apps/web/entities/research/client.ts
M  apps/web/entities/research/index.ts
A  apps/web/entities/research/model/communication.ts
M  docs/tasks/README.md
A  docs/tasks/SDR-008-research-email-account-assignment.md
```

The generated Prisma client (`apps/api/src/generated/**`) and Next.js generated files are
git-ignored and not part of the change set. All 30 pre-existing untracked artifacts were
re-hashed after the proof and remained byte-identical (0 mismatches).

## 11. Remaining limitations or blockers

> **Update 2026-11-27:** limitations 1 and 2 below were resolved by the owner-authorized live
> deployment recorded in §13. The original verification-time statements are preserved here.

1. **Migration not deployed to the live database.** The additive migration is authored and
   validated by Prisma generation and the API build, but it was not applied to the live
   `sdr_assistant` PostgreSQL database: the approved proof is explicitly a synthetic/mocked
   verification. Live persistence therefore needs the owner-authorized
   `prisma migrate deploy` (with the repository's usual protected backup) and an API
   restart. Until then the running API returns an error for the new endpoint and the
   Settings tab renders its error state while every other research section keeps working.
2. **No live-API acceptance run.** Assignment behaviour was verified against the mock API and
   focused in-memory Prisma service tests, not against the running NestJS API and PostgreSQL.
   The rendered scenarios prove the UI and persistence contract; database-level acceptance
   remains for the owner after deployment.
3. **Communication remains a planned label.** SDR-008 implements Settings only. The existing
   non-interactive `Communication — Planned` marker is preserved after the Settings tab and
   no communication control, placeholder or functionality was added. The requested eventual
   order `… Contacts | Communication | Settings` is reached when Communication is implemented
   in a future task; making the planned marker a fifth/faux tab now would violate the
   instruction not to implement placeholder controls.
4. **No account deletion UI.** Email accounts are only created, edited and enabled/disabled.
   The database restriction prevents deleting an assigned account; the missing-account state
   is implemented defensively and exercised by the mock scenario.
5. The SMTP/IMAP verification values are historical saved-configuration results; the Settings
   tab never performs a connection test, send or mailbox check.

## 12. Final status

`DONE / HUMAN_APPROVED` — the implementation, the single canonical proof, the owner-authorized
live deployment and the owner's manual acceptance (§14) are complete. The migration, protected
backup, deployment and proof evidence are preserved in §9 and §13; the SDR-008 scope is
committed and pushed. No additional implementation, test, refactoring or database change was
made for closure.

## 13. Live deployment and acceptance preparation — 2026-11-27

Authorized by the human owner for practical verification. Executed after the accepted
implementation proof. No code, test, dependency or configuration change; no research rerun;
no provider, SMTP/IMAP or email action; **no email account was assigned by the agent**.

### 13.1 Preflight

- Target confirmed: PostgreSQL **17.11** container `sdr-assistant-db`, database
  `sdr_assistant`, user `sdr`, published only on `127.0.0.1:5433`.
- Migration ledger: **11 applied, 0 unfinished, 0 rolled back**; exactly one pending:
  `20261127170000_add_research_communication_settings`.
- The running API already exposed the new route; it returned `500` only because the table was
  missing.
- Baseline counts: products 5, researches 4 (all `COMPLETED`), stage 01/02/03 = 2/2/3,
  settings 1, email accounts 2 (1 enabled), Stage 05 runs 2 (1 published), Stage 05 results
  154.
- Baseline full-row MD5 fingerprints: researches `caab4e8b…`, stage01 `8c8b2103…`, stage02
  `052a17fe…`, stage03 `7936c1e4…`, products `018a354c…`, settings `a5fb91bf…`,
  email_accounts `9dd296b9…`, lead_runs `c6ca2326…`, lead_results `21a38077…`.

### 13.2 Protected backup

- Directory:
  `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261127-204309`.
  ACL inheritance removed; only `NT AUTHORITY\SYSTEM`, `BUILTIN\Administrators` and
  `ALFASISDEV\msmig` have FullControl (no `CodexSandboxUsers`).
- Dump `sdr_assistant_full_20261127-204309.dump`: **2,550,159 bytes**; container and host
  SHA-256 both
  `8a9e5a50bd4f0fef5c59c42414bbe1e04b7ef1678f75a1ec67a5001a26175b79`.
- `pg_restore -l` exit 0: **68 archive entries, 10 `TABLE DATA` entries**. The container
  temporary dump was removed. `backup-verification.json` records the result.

### 13.3 Migration result

- `prisma migrate deploy` — exit 0; applied only
  `20261127170000_add_research_communication_settings`.
- `prisma migrate status` — `Database schema is up to date!`, exit 0.
- Ledger now **12 applied / 0 unfinished / 0 rolled back**. The applied checksum
  `17065586fa58f1bf9a8fc8f23c0815e61674c8aba69b46c9b7f6553850f11e43` equals the repository
  migration file SHA-256.
- New table verified: columns `researchId` (text, PK), `emailAccountId` (text, nullable),
  `createdAt`, `updatedAt`; unique PK index and `emailAccountId` index; foreign keys
  `researchId → researches` (`ON DELETE CASCADE`) and `emailAccountId → email_accounts`
  (`ON DELETE RESTRICT`).
- `research_communication_settings` row count: **0** — no assignment was created.

### 13.4 Preservation

All nine full-row fingerprints and all counts are **identical** before and after the
migration and restart:

- researches `caab4e8b244c90d6e56e1afe05fefcf8` (4, all `COMPLETED`);
- stage01 `8c8b2103ad5e492a43efd404de5ec86c`, stage02
  `052a17fede17f91959eabe367153b6a5`, stage03 `7936c1e4ca4c17505c867dfb7d4e8941`;
- products `018a354c0df2e76f0d4b628255cdeb7b` (5), settings
  `a5fb91bf9317969fb493b58f87baf8e2` (1);
- email_accounts `9dd296b9936078637a771d72094b0701` (2, 1 enabled);
- lead_runs `c6ca23264b68f7388521c31e183cbf60` (2, 1 published), lead_results
  `21a38077090e18a5be6dd7bd662ce3f1` (154).

Live API confirmation: 4 researches (`COMPLETED`); research
`cmww8smxb0000z4swhooukamv` has 77 company profiles with `schemaVersion: 1`; published
Stage 05 run `cmwyyy1dj0000z8sw0rfmunfg` is `COMPLETED` with 71 accepted / 6 excluded;
2 email accounts exist.

### 13.5 Service restart and application readiness

- The old dev stack (root `npm run dev` PID 83468) was stopped; ports 3000/4000 were free.
- A fresh detached `npm run dev` stack was started. After one expected `node --watch` restart
  caused by the initial `tsc` build (`dist/main.js`), the final services settled:
  - API `127.0.0.1:4000`, PID 50528, `GET /health` → `{"status":"ok"}`;
  - web `127.0.0.1:3000`, PID 50404, root and research page return 200.
  - launcher PID 53976; logs:
    `apps/api/.runs/sdr-008-dev-20261127-204404.log` and `.err.log`.
- Live assignment endpoint: `GET /research/cmww8smxb0000z4swhooukamv/communication` →
  `200 {"emailAccountId":null}`.
- Email-account endpoint: `200`, 2 accounts, 1 enabled; no ciphertext or password field is
  returned (only `smtpPasswordConfigured` / `imapPasswordConfigured` booleans).
- The research page renders the **Settings** tab; the RSC payload contains
  `communication: { state: "ready", emailAccountId: null, accounts: [...] }`, and the
  communication error state is absent.
- Application URL for acceptance:
  `http://127.0.0.1:3000/researches/cmww8smxb0000z4swhooukamv`.

### 13.6 Prepared manual acceptance steps

1. Open the URL above and select the **Settings** tab.
2. Under **Email account**, select the one enabled account and press **Assign account**.
3. Reload the page, open Settings again and confirm the account and its stored SMTP/IMAP
   verification are restored.
4. Optionally change the assignment and remove it.
5. The disabled synthetic account is not offered for assignment; it can be assigned only if
   explicitly enabled first.

The owner performs these steps. The agent created no assignment.

### 13.7 Status

Deployment complete and application ready for manual acceptance. No commit or push was
performed. Awaiting human acceptance.

## 14. Human acceptance and closure — 2026-11-27

**Accepted by the human owner as `DONE / HUMAN_APPROVED` on 2026-11-27.** The owner assigned
the real email account in the research Settings tab and confirmed that the assignment persists
after closing and reopening the research.

- Read-only post-acceptance confirmation: exactly **1** assignment row exists, references an
  existing research and an **enabled** account. No account address, identifier or credential is
  recorded in this task document.
- Manual acceptance was performed by the owner. The agent performed no assignment, no email
  operation, no SMTP/IMAP operation, no research rerun and no additional database change.
- The additive migration (§13.3), protected pre-migration backup (§13.2), deployment evidence
  (§13) and the single canonical proof (§9) are preserved in this record. The backup remains at
  `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261127-204309`.
- Closure commit scope is limited to the SDR-008 implementation, its tests, the Playwright mock
  and scenarios, the shared verification component move, and the SDR-008 task records. It
  excludes credentials, private data, `.env`, generated clients, build output, test results,
  logs, pre-existing research artifacts and all other untracked files.
- The scope is committed with `feat: add research email account assignment` and pushed to
  `origin main` without force. The exact commit hash, staged-manifest review, remote
  verification and post-commit working-tree status are recorded in the completion report for
  this closure (a commit cannot contain its own hash).
