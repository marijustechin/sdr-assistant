# SDR-004 — Email Account Management

## 1. Task ID and status

- **Task ID:** SDR-004
- **Status:** DONE — accepted by the human owner on 2026-11-26. All implementation,
  verification, database deployment and database-backed acceptance evidence in §7–§17 is
  accepted. Earlier blocked/pending states are historical and superseded; §18 records the
  acceptance and the exact supersession mapping.
- **Registry:** [README.md](README.md)
- **Baseline:** implementation checkpoint `61302c7f9c48a8d2757638271d0381d9db2951d4`;
  accepted documentation checkpoint `a89b32ee4b7c675b0d22baa227356f715b9e5626`.
- **Execution mode:** standard `workspace-write`. No privilege escalation, no sandbox
  configuration change.
- **Scope authority:** the implementation assignment statement for SDR-004. This document
  records that approved objective, scope, exclusions and acceptance criteria. Execution
  notes and verification evidence are appended; the approved statements are not rewritten.

## 2. Objective

Implement configurable email accounts accessible through **Settings → Email accounts**.
The application must support multiple independently configured accounts, each with its own
SMTP and IMAP settings and its own encrypted credentials. Account configuration and
persistence only: no email is sent, no mailbox is synchronized, and no account is assigned
to a research yet.

## 3. Authorized scope and paths

Authorized content modifications are limited to:

- New backend module `apps/api/src/modules/email-accounts/`.
- Minimal backend module registration in `apps/api/src/app.module.ts`.
- `apps/api/prisma/schema.prisma`: additive `EmailAccount` model only (plus the enum it
  needs).
- One new additive migration under `apps/api/prisma/migrations/`.
- `apps/api/.env.example`.
- Focused new backend tests `apps/api/test/email-accounts.test.ts`.
- New frontend email-account entity, feature, page slices and routes under `apps/web`.
- Minimal integration into the existing Settings page and Settings section navigation.
- Focused frontend unit tests, Playwright scenarios and the minimal mock-API support they
  need.
- Documentation describing the new functionality, the task registry and this document.

No unrelated refactoring. Existing dependencies and Node.js built-in crypto only. No
dependency installation, upgrade, removal or lockfile change was performed.

## 4. Explicit exclusions

The following were not implemented or modified:

- Assignment of an email account to a research, campaigns, email templates, email sending,
  SMTP/IMAP connection testing, incoming-mail synchronization, OAuth2, Gmail- or
  Microsoft 365-specific integration, automated communication, AI-generated messages,
  background jobs/schedulers, email analytics.
- Hard deletion of email accounts.
- Research implementation, orchestration, prompts, provider configuration,
  classification/evidence rules, research database models, research migrations, research
  tests and fixtures.
- Package manifests and lockfiles.
- Actual environment credentials (`apps/api/.env` was not modified or read as a value).
- `AGENTS.md`, `PRODUCT.md`, harness and system documentation, approved ADRs and the
  Research Implementation Freeze.
- Database migrations applied to the existing database; database connections; external API
  or email-provider calls.
- Environment permissions, sandbox configuration, staging, commits or pushes.

## 5. Acceptance criteria

- Settings contains a working Email accounts section.
- Multiple email accounts are supported.
- Accounts can be created, edited, enabled and disabled.
- SMTP and IMAP configurations are independently stored.
- Passwords are encrypted before persistence.
- Passwords and encrypted credential material are never returned by the API.
- Editing non-credential fields preserves existing passwords.
- Replacing a password updates the corresponding encrypted credential.
- Missing or invalid encryption configuration fails safely.
- Backend validation handles invalid account settings.
- Frontend follows existing architecture and visual conventions.
- Focused backend and frontend tests cover the implemented functionality.
- Rendered frontend behavior is verified using the existing mock API.
- The new migration is additive and does not modify research tables.
- No migration has been applied to the existing database.
- Research Implementation Freeze has been respected.

Actual database-backed manual acceptance remains pending until the owner authorizes the
database migration and configures the encryption key.

## 6. One proof command

The single authorized proof is this compound PowerShell command:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run db:generate
    if ($LASTEXITCODE -ne 0) {
        throw 'Prisma generation failed'
    }

    npm.cmd run test -w @sdr-assistant/api -- test/email-accounts.test.ts
    if ($LASTEXITCODE -ne 0) {
        throw 'Email account backend tests failed'
    }

    npm.cmd run verify:web
    if ($LASTEXITCODE -ne 0) {
        throw 'Frontend verification failed'
    }

    npm.cmd run e2e:web
    if ($LASTEXITCODE -ne 0) {
        throw 'Frontend E2E verification failed'
    }

    Write-Output 'PASS: SDR-004 verification'
}
```

Prisma Client generation and the local mock API/Next.js processes required by the existing
E2E harness are explicitly authorized for this proof. No real database connection,
production API startup or external email-provider connection is authorized.

## 7. Verification result

- **Executed:** once, on 2026-11-25 (Europe/Vilnius), after all substantive implementation
  changes, in standard `workspace-write`.
- **Exit code:** `1`.
- **Final line:** `PASS: SDR-004 verification` was **not** printed.

### Stage results

| Stage | Result | Observed output |
| --- | --- | --- |
| `npm.cmd run db:generate` | PASS | `✔ Generated Prisma Client (7.10.1) to .\src\generated\prisma in 121ms` |
| `npm run test -w @sdr-assistant/api -- test/email-accounts.test.ts` | PASS | `✓ test/email-accounts.test.ts (23 tests) 22ms`; `Test Files 1 passed (1)`; `Tests 23 passed (23)`; `Duration 1.70s` |
| `npm run verify:web` | PASS | typegen: `✓ Types generated successfully`; lint: no findings; Vitest: `Test Files 12 passed (12)`, `Tests 80 passed (80)` (including `entities/email-account/model/schema.test.ts` 10 tests and `features/manage-email-account/ui/email-account-form.test.tsx` 4 tests); format: `All matched files use Prettier code style!` |
| `npm run e2e:web` | **FAIL** | `Error: spawn EPERM`; npm reported `code 1` from `playwright test` in `apps/web`; the compound script then threw `Frontend E2E verification failed`. |

The only stage output produced before the failure was the npm banner for
`npm run e2e --workspace @sdr-assistant/web` / `playwright test`. Playwright never listed or
executed a test.

Two expected, safe log lines appeared during the backend tests — they are the deliberate
"missing/invalid encryption key" negative tests and contain no credential or key material:

```text
[Nest] ERROR [EmailAccountsService] Email-account credential encryption is unavailable: EMAIL_ACCOUNT_ENCRYPTION_KEY is not set.
[Nest] ERROR [EmailAccountsService] Email-account credential encryption is unavailable: EMAIL_ACCOUNT_ENCRYPTION_KEY must be Base64-encoded.
```

### What the executed gates establish

- The Prisma schema is valid and generates a client containing `EmailAccount` and
  `EmailSecurityMode`.
- The 23 focused backend tests pass: AES-256-GCM round trip, random IV per encryption,
  missing/invalid key rejection, corrupted-data rejection, safe response mapping, creation
  validation, credential retention on non-credential updates, credential replacement,
  enable/disable, and 404 handling.
- `verify:web` passes: TypeScript typecheck, ESLint (`--max-warnings=0`), all 80 web unit
  tests, and Prettier formatting.

### What remains unverified

- Rendered frontend behavior against the mock API (the E2E gate did not run).
- Database-backed behavior, API startup, and any SMTP/IMAP connectivity (explicitly outside
  this task and not authorized).

### Blocker (confirmed observation and documented cause)

- The observed failure is the Playwright runner's `Error: spawn EPERM` before any test ran.
- Playwright's runner forks its worker process with an `ipc` stdio channel and starts
  `webServer` entries with piped stdio (`node_modules/playwright/lib/runner/index.js`,
  `fork(..., { stdio: [..., "ipc"] })` and `stdio: "stdin"`). On Windows these are named-pipe
  channels.
- The DSH Windows sandbox in the authorized `workspace-write` mode denies that boundary;
  [environment.md](../../docs/system/environment.md) §3 already records the same
  `spawn EPERM` for forked workers (Vitest's default `forks` pool) and for Next.js process
  spawning, and states that this is not evidence that a broader mode is authorized.
- Consequently the mandatory E2E gate cannot execute under the authorized environment. Per
  the task, the conflict is reported and execution stopped. No sandbox escalation, retry
  with an equivalent command, or weaker verification was attempted.

## 8. Remaining blockers or limitations

- **Verification blocker:** the mandatory `npm run e2e:web` gate needs an environment in
  which Playwright can fork workers and start its web servers. This is outside
  `workspace-write`. Completing the proof requires the owner to run it in that environment,
  or to authorize a separate environment maintenance/exception for this exact gate. The
  proof must not be weakened or substituted. **Resolved** by the human-authorized
  verification continuation in §14; retained here as history.
- **Migration pending:** `20261125230000_add_email_account` is created but deliberately not
  applied. Database-backed acceptance requires the owner to review and apply it.
- **Encryption key pending:** `EMAIL_ACCOUNT_ENCRYPTION_KEY` is documented in
  `apps/api/.env.example` but not configured in `apps/api/.env`. Creating or updating an
  account returns a safe 500 until it is set.
- **No connectivity:** SMTP and IMAP connectivity, sending and synchronization are outside
  this task and were not implemented or tested.
- **No application authentication:** email-account management may only be used inside the
  trusted local deployment and must not be exposed publicly.

## 9. Implementation summary

### Backend

`apps/api/src/modules/email-accounts/`:

- `email-accounts.module.ts` — module, registered with one import in `app.module.ts`.
- `email-accounts.controller.ts` — `GET /email-accounts`, `GET /email-accounts/:id`,
  `POST /email-accounts`, `PATCH /email-accounts/:id`. No delete route. No mail clients.
- `email-accounts.service.ts` — list/read/create/partial update. Creation encrypts both
  credentials. Update writes a password column only when a new password is supplied, so
  non-credential edits retain stored credentials. `PATCH` supports `enabled` for
  enable/disable. Missing rows are `404`. Missing/invalid encryption configuration fails
  safely with a fixed message that names no key material.
- `email-accounts.mapper.ts` — explicit field-by-field response mapping plus
  `smtpPasswordConfigured` / `imapPasswordConfigured`. Encrypted columns are never spread
  into a response.
- `credential-encryption.ts` — AES-256-GCM with a fresh 12-byte random IV per operation,
  16-byte authentication tag, payload `v1.<iv>.<tag>.<ciphertext>` (Base64). The key is
  read only from `EMAIL_ACCOUNT_ENCRYPTION_KEY`, must be canonical Base64 decoding to
  exactly 32 bytes, and is validated before every encrypt/decrypt. Errors never contain the
  key, plaintext, ciphertext, IV or tag.
- `dto/create-email-account.dto.ts`, `dto/update-email-account.dto.ts` — class-validator
  DTOs: required fields, trimmed strings, `@IsEmail`, integer ports 1–65535, security mode
  restricted to `TLS`/`STARTTLS`, non-empty host/username, required passwords on create,
  optional passwords on update with empty/whitespace meaning "keep the stored credential".
- `email-accounts.constants.ts` — the two supported security modes; unencrypted
  authentication is not representable.

### Database

- `apps/api/prisma/schema.prisma`: new enum `EmailSecurityMode` (`TLS`, `STARTTLS`) and model
  `EmailAccount` mapped to `email_accounts`; `cuid()` id, `createdAt`/`updatedAt`, no
  research relation. No existing model, field, table or relation changed.
- `apps/api/prisma/migrations/20261125230000_add_email_account/migration.sql`: one additive
  migration that creates the enum and the `email_accounts` table only. It was not applied.
- `apps/api/.env.example`: documents `EMAIL_ACCOUNT_ENCRYPTION_KEY` with the generation
  command and no value. `apps/api/.env` was not modified.

### Frontend

- `entities/email-account/` — zod wire schemas and `z.infer` types; `readEmailAccountForm`
  validates the form once on the client and again in the server action; server-only API
  functions via `shared/api/http` return `Result`; a separate `client.ts` entry keeps the
  browser bundle free of `server-only` code.
- `features/manage-email-account/` — server actions for create/update/enable-disable,
  `EmailAccountForm` (General / Outgoing mail (SMTP) / Incoming mail (IMAP)), and
  `EmailAccountToggle` for the list. Defaults: SMTP 587 + STARTTLS, IMAP 993 + TLS, enabled
  on create. Password inputs start empty in both modes; on edit they explain that an empty
  field keeps the configured credential. Success and failure use the existing toast
  conventions; fields show inline validation errors.
- `_pages/email-accounts/` and routes `app/settings/email-accounts/` (list with loading,
  empty, error and success states; `new`; `[id]/edit`). App Router files contain only
  metadata, params and one view component.
- Settings integration: an Email accounts card on `/settings`, and an Email accounts tab in
  the existing Settings section navigation with a nested-route matcher.
- `e2e/mock-api.mjs` gained deterministic email-account state and the minimal reject path
  used by the failure scenario; reusable accounts are reset per test.
- Tests: `apps/api/test/email-accounts.test.ts` (23), `entities/email-account/model/schema.test.ts`
  (10), `features/manage-email-account/ui/email-account-form.test.tsx` (4),
  `e2e/email-accounts.spec.ts` (6 rendered scenarios: empty list, creation, validation,
  editing with empty password fields, enable/disable, API failure feedback), and updated
  Settings navigation unit tests.

### Unchanged and preserved

- No research source, prompt, schema, provider configuration, stage, test or fixture was
  modified; pre-existing untracked research artifacts remain untouched.
- No dependency, package manifest or lockfile change.
- No migration applied, no database connection, no external API or mail-provider call.
- No staging, commit or push.

## 10. Environment variable requirements and key generation

Required variable, read by the API only:

| Variable | Format | Purpose |
| --- | --- | --- |
| `EMAIL_ACCOUNT_ENCRYPTION_KEY` | Exactly 32 random bytes, canonical Base64 (44 characters, one `=` of padding) | Encrypts and decrypts stored SMTP/IMAP credentials with AES-256-GCM |

Generate it locally (do not commit the output; do not paste it into documentation):

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
```

Then set `EMAIL_ACCOUNT_ENCRYPTION_KEY` in `apps/api/.env`. There is no default key and no
plaintext fallback. While the value is missing or invalid, account creation and password
replacement fail safely; reading, editing non-credential fields and enabling/disabling do
not need the key.

## 11. Human manual acceptance instructions (pending)

Until the owner authorizes the database migration and configures the key, the account UI
can only be exercised against the mock API (E2E) — the real API cannot persist accounts.

1. Review the additive migration
   `apps/api/prisma/migrations/20261125230000_add_email_account/migration.sql`; confirm it
   touches no research table.
2. Apply it only when authorized (for example `npm run db:migrate`) — this task did not.
3. Generate the key with the command in §10 and set `EMAIL_ACCOUNT_ENCRYPTION_KEY` in
   `apps/api/.env`; never commit it.
4. Start the stack in an authorized environment (`npm run dev`), open
   `http://localhost:3000/settings/email-accounts`.
5. Create a first account with synthetic values; verify the list shows account name, email
   address, sender name, status, Edit and Disable.
6. Re-open it with Edit: fields are prefilled, both password inputs are empty, and the hints
   say that leaving them empty keeps the stored password.
7. Change a non-credential field and save; then confirm in PostgreSQL that
   `smtpPasswordEncrypted` / `imapPasswordEncrypted` are unchanged ciphertext.
8. Enter a new SMTP password and save; confirm that column changed and decrypts only with
   the configured key. Repeat for IMAP. Confirm API responses only contain
   `smtpPasswordConfigured` / `imapPasswordConfigured` and never ciphertext, IV or tag.
9. Use Disable and Enable and confirm the status flag persists after a reload.
10. Complete the approved proof in an environment where Playwright may spawn its workers and
    web servers; the E2E gate is the only outstanding verification item.

## 12. Freeze and scope compliance

- Research Implementation Freeze respected: `apps/api/src/modules/research/**` and all
  research tests/fixtures are unchanged; previously excluded research files were not
  restored.
- Only the authorized paths were created or modified (see §13).
- Existing dependencies and Node.js built-in crypto only; no dependency, manifest or
  lockfile change.
- No database migration applied; no database connection; no external API, SMTP or IMAP call.
- No `.env` value changed; `apps/api/.env` is untouched.
- No sandbox or environment permission change; no privilege escalation.
- No Git staging, commit or push.
- SDR-004 is not marked `DONE`; SDR-005 was not started.

## 13. Changed files

Modified (10):

- `README.md`
- `apps/api/.env.example`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/web/_pages/settings/ui/settings-page.tsx`
- `apps/web/e2e/mock-api.mjs`
- `apps/web/widgets/app-shell/model/navigation.ts`
- `apps/web/widgets/app-shell/model/navigation.test.ts`
- `apps/web/widgets/app-shell/ui/section-nav.tsx`
- `docs/tasks/README.md`

New (30):

- `apps/api/prisma/migrations/20261125230000_add_email_account/migration.sql`
- `apps/api/src/modules/email-accounts/email-accounts.constants.ts`
- `apps/api/src/modules/email-accounts/credential-encryption.ts`
- `apps/api/src/modules/email-accounts/email-accounts.mapper.ts`
- `apps/api/src/modules/email-accounts/email-accounts.service.ts`
- `apps/api/src/modules/email-accounts/email-accounts.controller.ts`
- `apps/api/src/modules/email-accounts/email-accounts.module.ts`
- `apps/api/src/modules/email-accounts/dto/create-email-account.dto.ts`
- `apps/api/src/modules/email-accounts/dto/update-email-account.dto.ts`
- `apps/api/test/email-accounts.test.ts`
- `apps/web/app/settings/email-accounts/page.tsx`
- `apps/web/app/settings/email-accounts/loading.tsx`
- `apps/web/app/settings/email-accounts/new/page.tsx`
- `apps/web/app/settings/email-accounts/[id]/edit/page.tsx`
- `apps/web/_pages/email-accounts/index.ts`
- `apps/web/_pages/email-accounts/ui/email-accounts-page.tsx`
- `apps/web/_pages/email-accounts/ui/new-email-account-page.tsx`
- `apps/web/_pages/email-accounts/ui/edit-email-account-page.tsx`
- `apps/web/entities/email-account/index.ts`
- `apps/web/entities/email-account/client.ts`
- `apps/web/entities/email-account/model/schema.ts`
- `apps/web/entities/email-account/model/schema.test.ts`
- `apps/web/entities/email-account/api/email-accounts.server.ts`
- `apps/web/features/manage-email-account/index.ts`
- `apps/web/features/manage-email-account/api/action.ts`
- `apps/web/features/manage-email-account/ui/email-account-form.tsx`
- `apps/web/features/manage-email-account/ui/email-account-form.test.tsx`
- `apps/web/features/manage-email-account/ui/email-account-toggle.tsx`
- `apps/web/e2e/email-accounts.spec.ts`
- `docs/tasks/SDR-004-email-account-management.md`

Generated, git-ignored, not part of Git: `apps/api/src/generated/prisma` (regenerated by the
proof) and `apps/web/.next` / `next-env.d.ts` (regenerated by `verify:web`).

## 14. Resumed E2E verification (human-authorized continuation, 2026-11-25)

### 14.1 Authorization

- The human owner authorized resuming SDR-004 **exclusively** to complete the mandatory
  Playwright E2E verification, and explicitly authorized **Full Access** for this specific
  verification operation.
- The authorization granted no permission for unrelated implementation, environment or
  repository changes. Application code, tests, Playwright configuration, research files,
  dependencies, `.env`, database and sandbox configuration remained unchanged.
- This continuation appended evidence only; §2–§13 (approved objective, scope, exclusions,
  acceptance criteria, original proof and its failure) are preserved.

### 14.2 Preconditions checked

| Check | Result |
| --- | --- |
| HEAD | `a89b32ee4b7c675b0d22baa227356f715b9e5626` — unchanged since the original proof |
| Working tree | identical to the state recorded after the original proof: the same 10 modified tracked files, the same 30 SDR-004 new files, and the same pre-existing excluded untracked files; no implementation change |
| Implementation state | every substantive SDR-004 file has a modification time of `2026-11-25 23:08:16` or earlier — before the original proof (`db:generate` completed at 23:09, backend tests started 23:10). The only later changes were `docs/tasks/README.md` (23:13:50) and this document (23:13:54), both documentation-only |
| Playwright target | only the mock API: `node e2e/mock-api.mjs` on `127.0.0.1:4100`, and Next dev on `localhost:3100` with `API_URL=http://127.0.0.1:4100` and `NEXT_DIST_DIR=.next-e2e`; no real research API and no production database |
| Mock API nature | `e2e/mock-api.mjs` imports only `node:http`, listens on `127.0.0.1:4100`, and contains no Prisma, PostgreSQL or real-API access |
| Pre-run environment | Playwright started its own web servers (its `[WebServer]` output is present and there was no "reusing existing server" message), so ports 3100/4100 were free; the owner's separate dev servers on 3000/4000 were not used or modified |

No content fingerprints of the SDR-004 files had been recorded earlier, so the equivalent
evidence used is: unchanged HEAD, an unchanged `git status` manifest, and modification
times that precede the original proof for every substantive file.

### 14.3 Command and result

```powershell
npm.cmd run e2e:web
```

- Executed **once** in the explicitly authorized Full Access mode.
- **Exit code: 0.**
- Duration: 1.5 minutes.
- **Tests executed: 17. Passed: 17. Failed: 0. Skipped: 0. Retried/flaky: 0.**

Actual output (test-result section):

```text
Running 17 tests using 1 worker

  ok  1 [chromium] › e2e\app.spec.ts:9:1 › renders the shell, navigation and theme switch (1.3s)
  ok  2 [chromium] › e2e\app.spec.ts:27:1 › lists products and marks the section (1.1s)
  ok  3 [chromium] › e2e\app.spec.ts:49:1 › validates and saves research settings rendered from API metadata (2.4s)
  ok  4 [chromium] › e2e\app.spec.ts:89:1 › shows product tabs, history and the start form (1.9s)
  ok  5 [chromium] › e2e\app.spec.ts:114:1 › runs a research to completion and renders the result (5.6s)
  ok  6 [chromium] › e2e\app.spec.ts:135:1 › renders a failed run with its error and recovery (1.9s)
  ok  7 [chromium] › e2e\app.spec.ts:153:1 › announces a stopped poller with a toast when the job disappears (1.1s)
  ok  8 [chromium] › e2e\app.spec.ts:170:1 › renders the app 404 page (1.2s)
  ok  9 [chromium] › e2e\app.spec.ts:176:1 › switches theme and persists it (909ms)
  ok 10 [chromium] › e2e\app.spec.ts:191:1 › copies a completed result and confirms with a toast (1.1s)
  ok 11 [chromium] › e2e\app.spec.ts:215:1 › shows back-to-top only on an overflowing page (1.9s)
  ok 12 [chromium] › e2e\email-accounts.spec.ts:81:1 › shows the empty email-account list inside Settings (2.4s)
  ok 13 [chromium] › e2e\email-accounts.spec.ts:104:1 › creates an account with independent SMTP and IMAP settings (3.8s)
  ok 14 [chromium] › e2e\email-accounts.spec.ts:136:1 › validates the account form before calling the API (978ms)
  ok 15 [chromium] › e2e\email-accounts.spec.ts:158:1 › edits an account and leaves password fields empty (3.1s)
  ok 16 [chromium] › e2e\email-accounts.spec.ts:196:1 › disables and enables an account from the list (1.1s)
  ok 17 [chromium] › e2e\email-accounts.spec.ts:218:1 › shows API failure feedback and stays on the form (1.3s)

  17 passed (1.5m)
```

Stderr contained only npm banner lines and Node `NO_COLOR`/`FORCE_COLOR` warnings from the
harness web servers; there was no test failure, retry or flaky marker.

### 14.4 Email-account rendered scenarios

| # | Scenario | Result |
| --- | --- | --- |
| 12 | Empty account list inside Settings; "Email accounts" section tab and "Settings" main nav current; Add account and Add the first account links visible | PASS |
| 13 | Create with independent SMTP/IMAP settings; defaults 587 + STARTTLS and 993 + TLS; Enabled checked; list row, "Email account created" toast; persisted after reload | PASS |
| 14 | Client-side validation errors (account name, email format, port range, SMTP password, IMAP host) without navigation; "Check the highlighted fields" toast | PASS |
| 15 | Edit with prefilled fields, both password inputs empty, configured-password hints, save, "Email account updated" toast | PASS |
| 16 | Disable and re-enable from the list, status changes and notifications | PASS |
| 17 | API failure feedback (422) keeps the form, shows the API message inline and in a toast | PASS |

### 14.5 Process cleanup

- Playwright's mock API (port 4100) and Next dev server (port 3100) were terminated by the
  harness; **no listeners remained on 3100 or 4100** after the run.
- No Playwright, Chromium (`ms-playwright`), mock-API or E2E Next process remained.
- Unrelated, pre-existing processes were **not** stopped: the owner's dev servers on ports
  3000 and 4000 (running since 14:12), an unrelated Next dev on port 3011 from another
  project, and the owner's browser processes.
- The run left no server or browser process behind.

### 14.6 Updated verification conclusion

Combining this continuation with the preserved evidence in §7:

| Gate | Result |
| --- | --- |
| `npm run db:generate` | PASS |
| focused backend tests (`test/email-accounts.test.ts`) | PASS (23/23) |
| `npm run verify:web` (typecheck, ESLint, 80 unit tests, Prettier) | PASS |
| `npm run e2e:web` (Playwright against the mock API) | **PASS (17/17, exit code 0)** |

All original verification requirements are now satisfied. Database-backed manual acceptance
(migration application, encryption-key configuration, real persistence and ciphertext checks)
remains pending owner action and is unchanged by this continuation.

### 14.7 Scope compliance of the continuation

- No application code, test, Playwright configuration, research file, prompt, schema,
  fixture, dependency, manifest, lockfile, `.env` or database state was modified.
- No database connection, migration application, SMTP/IMAP connection or external provider
  call was made.
- No ACL, security policy or sandbox configuration was changed; Full Access was used only
  for this single authorized E2E command.
- No staging, commit or push was performed, and SDR-005 was not started.
- Only `docs/tasks/SDR-004-email-account-management.md` and `docs/tasks/README.md` were
  edited by this continuation (append-only evidence and status).
- Research Implementation Freeze remains fully active.

## 15. Database migration and manual-acceptance preflight (read-only, 2026-11-25)

### 15.1 Scope and authorization

- The human owner assigned a **read-only** preflight to determine whether the new
  `EmailAccount` migration can be applied to the current PostgreSQL database without
  affecting existing research data. Migration execution, backup creation, key generation,
  `.env` changes, code/test changes and process restarts were explicitly **not** authorized.
- Only these read-only operations were performed: container/database status, database
  schema and migration-record queries, migration-file inspection, and one
  `prisma migrate status` proof.
- No database record or schema was modified; no migration, `db push`, `reset` or `resolve`
  was run; no backup or encryption key was created; no application code, test, migration
  file or `.env` was changed; no process was restarted; no external provider was called; no
  Full Access or privilege escalation was used.

### 15.2 Database identity, connectivity and application match

| Item | Observation |
| --- | --- |
| Container | `sdr-assistant-db`, compose service `db`, project `sdr-assistant`, image `postgres:17-alpine` |
| Container state | running and `healthy` (up ~34 hours at inspection), restart policy `unless-stopped` |
| Published port | `0.0.0.0:5433 -> 5432/tcp` (Docker Desktop port mapping) |
| Server | PostgreSQL 17.11 on x86_64-pc-linux-musl |
| Current database | `sdr_assistant` |
| Databases in cluster | `sdr_assistant` plus the default `postgres` only — no second application database |
| Connectivity | `pg_isready`: accepting connections; read-only `psql` queries succeeded |
| Migration user | `sdr` — database owner and superuser; `public` schema owned by `pg_database_owner` |
| `apps/api/.env` `DATABASE_URL` | scheme `postgresql`, host `localhost`, port `5433`, database `sdr_assistant`, user `sdr`, password present, no query parameters (credentials not printed) |
| `EMAIL_ACCOUNT_ENCRYPTION_KEY` in `apps/api/.env` | **not present / not configured** |

The application's configured data source matches the inspected database: same host, port,
database name and user as the running compose container, and the cluster contains no other
application database. At inspection time `pg_stat_activity` showed no live application
connection (only the inspector's local `psql` connection); this is an idle-pool observation
and not a configuration mismatch. The running application process was neither probed nor
restarted.

### 15.3 Migration records and consistency

`_prisma_migrations` contains **8 rows, all applied**, with no unfinished, failed or rolled
back entries and no error logs:

| Migration | Started / finished | Rolled back | Steps |
| --- | --- | --- | --- |
| `20261031115714_add_product` | 2026-10-31 11:57:14 | no | 1 |
| `20261106133236_add_general_categories` | 2026-11-06 13:32:36 | no | 1 |
| `20261110120000_rename_general_categories_to_possible_search_terms` | 2026-11-10 16:57:54 | no | 1 |
| `20261113110533_add_research` | 2026-11-13 11:05:33 | no | 1 |
| `20261117190641_add_setting` | 2026-11-17 20:19:41 | no | 1 |
| `20261124123231_add_stage_results` | 2026-11-24 12:32:31 | no | 1 |
| `20261124123609_stage01_identified_and_prepared` | 2026-11-24 12:36:09 | no | 1 |
| `20261124144445_stage03_resume_state` | 2026-11-24 14:44:46 | no | 1 |

- Nine migration folders exist on disk; the only one without a database record is
  `20261125230000_add_email_account` → **pending**.
- Every recorded migration's stored checksum matches the SHA-256 of its on-disk
  `migration.sql` → no applied migration file has been modified, and no database record is
  missing from disk.
- No inconsistent, failed or rolled back migration was found.

### 15.4 Existing research tables and row counts (pre-migration baseline)

| Table | Rows |
| --- | --- |
| `products` | 5 |
| `researches` | 42 |
| `research_stage_01_results` | 5 |
| `research_stage_02_results` | 3 |
| `research_stage_03_results` | 5 |
| `settings` | 1 |
| `_prisma_migrations` | 8 |

Research schema verified: `researches` has
`id, productId, country, status, stage, result, error, lastHeartbeatAt, createdAt,
updatedAt, executionLeaseUntil, executionToken`; `research_stage_01_results` has
`identifiedProduct` and `preparedCandidates` and **no** `result` column;
`research_stage_03_results` has `criteria, decidedPages, decisions, errorPages,
promptVersion, result`; all three stage tables have their primary keys, unique `jobId`
indexes and cascade foreign keys to `researches`. These are the expected objects of the
applied research migrations and the baseline for post-migration comparison.

`email_accounts` table: **absent** (all schemas). `EmailSecurityMode` enum: **absent** (all
namespaces).

### 15.5 Migration review

| Migration | Status | Research tables | Destructive operations | Expected schema in DB |
| --- | --- | --- | --- | --- |
| `20261124123231_add_stage_results` | APPLIED (2026-11-24 12:32:31) | Creates `research_stage_01/02/03_results` with unique `jobId` indexes and `ON DELETE CASCADE` foreign keys to `researches` | No — additive only (new tables, indexes, constraints) | Present: all three tables, indexes and foreign keys |
| `20261124123609_stage01_identified_and_prepared` | APPLIED (2026-11-24 12:36:09) | Alters `research_stage_01_results` | Yes if replayed — drops `result` and adds two `NOT NULL` columns without defaults. Already recorded applied and is never replayed by `migrate deploy` | Present: `result` gone, `identifiedProduct`/`preparedCandidates` present |
| `20261124144445_stage03_resume_state` | APPLIED (2026-11-24 14:44:46) | Alters `research_stage_03_results` and `researches` | No data loss — adds nullable/defaulted columns and relaxes `result NOT NULL` | Present: all added columns |
| `20261125230000_add_email_account` | **PENDING** | None | No — creates one enum and one table; no research table is referenced | Absent, as expected before application |

**Conclusion:** no older research migration is pending or inconsistent. Applying pending
migrations would execute **only** the additive `20261125230000_add_email_account` migration
(`CREATE TYPE "EmailSecurityMode"`, `CREATE TABLE "email_accounts"`). It takes no locks on
research tables and changes no research row or column. No blocker was found.

Limitation: `prisma migrate status` and checksums validate the migration ledger, not a full
schema drift diff. The research objects relevant to these migrations were verified directly
in §15.4; a full drift diff would require additional tooling/shadow-database use that was
not authorized.

### 15.6 Authorized proof: `prisma migrate status`

Command (executed once, exactly as authorized, from the repository root):

```powershell
& {
    Push-Location apps/api
    try {
        $cli = @(
            '.\node_modules\.bin\prisma.cmd',
            '..\..\node_modules\.bin\prisma.cmd'
        ) | Where-Object {
            Test-Path -LiteralPath $_
        } | Select-Object -First 1

        if (-not $cli) {
            throw 'Existing local Prisma CLI not found'
        }

        & $cli migrate status
        Write-Output "PRISMA_MIGRATE_STATUS_EXIT=$LASTEXITCODE"
    }
    finally {
        Pop-Location
    }
}
```

Actual output (stdout):

```text
Datasource "db": PostgreSQL database "sdr_assistant", schema "public" at "localhost:5433"

9 migrations found in prisma/migrations
Following migration have not yet been applied:
20261125230000_add_email_account

To apply migrations in development run prisma migrate dev.
To apply migrations in production run prisma migrate deploy.
PRISMA_MIGRATE_STATUS_EXIT=1
```

Stderr:

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma.
```

**Native Prisma exit code: 1.** Interpretation: the CLI exits non-zero because migrations
are pending. The output names exactly one pending migration and reports no drift, failed
migration or inconsistency; the database is healthy and up to date with the 8 recorded
migrations.

### 15.7 Proposed backup and migration procedure (not executed)

Minimum safe sequence for the owner to execute or authorize later. Nothing below was run in
this preflight.

**Step 1 — Record the pre-migration baseline (read-only).**

```powershell
docker compose exec -T db psql -U sdr -d sdr_assistant -X -A -F ' | ' -c @"
SELECT 'products' AS t, count(*) FROM products
UNION ALL SELECT 'researches', count(*) FROM researches
UNION ALL SELECT 'research_stage_01_results', count(*) FROM research_stage_01_results
UNION ALL SELECT 'research_stage_02_results', count(*) FROM research_stage_02_results
UNION ALL SELECT 'research_stage_03_results', count(*) FROM research_stage_03_results
UNION ALL SELECT 'settings', count(*) FROM settings;
"@
```

Expected baseline: 5 / 42 / 5 / 3 / 5 / 1 (captured above).

**Step 2 — Create a custom-format backup without printing credentials.**

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $env:USERPROFILE 'SDR-Backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
docker compose exec -T db pg_dump -U sdr -d sdr_assistant -Fc -f /tmp/sdr_assistant_pre_email_account.dump
docker compose cp db:/tmp/sdr_assistant_pre_email_account.dump "$backupDir\sdr_assistant_pre_email_account-$stamp.dump"
```

The `db` service's PostgreSQL credentials come from the compose environment; no password is
typed on a command line or written to the repository.

**Step 3 — Verify the backup before touching the schema.**

```powershell
docker compose exec -T db pg_restore -l /tmp/sdr_assistant_pre_email_account.dump | Select-String 'TABLE DATA'
docker compose exec -T db pg_restore -l /tmp/sdr_assistant_pre_email_account.dump | Select-String 'TABLE DATA' | Measure-Object | Select-Object -ExpandProperty Count
Get-FileHash "$backupDir\sdr_assistant_pre_email_account-$stamp.dump" -Algorithm SHA256
```

Acceptance: `pg_restore -l` exits 0; it lists the six application tables plus
`_prisma_migrations` (7 `TABLE DATA` entries at this baseline); the SHA-256 is recorded in
the owner's notes. Optional stronger check: restore into a throwaway database
(`sdr_assistant_restore_check`) on the same container, compare row counts, then drop that
database — never touching `sdr_assistant`.

**Step 4 — Apply only the pending migration.**

```powershell
Push-Location apps/api
try {
    .\node_modules\.bin\prisma.cmd migrate deploy
    Write-Output "MIGRATE_DEPLOY_EXIT=$LASTEXITCODE"
}
finally { Pop-Location }
```

Expected: one pending migration found and applied
(`20261125230000_add_email_account`), exit code 0. Do not use `migrate dev`, `db push`,
`migrate reset` or `migrate resolve`. The application may stay running: the migration only
creates a new enum/table and takes no locks on research tables; pausing research runs during
the operation is optional and is an owner choice.

**Step 5 — Confirm migrations and research data.**

```powershell
Push-Location apps/api
.\node_modules\.bin\prisma.cmd migrate status   # expected exit 0, "Database schema is up to date!"
Pop-Location
```

```sql
SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied,
       count(*) FILTER (WHERE finished_at IS NULL) AS unfinished,
       count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back
FROM _prisma_migrations;   -- expected: 9 / 0 / 0

SELECT to_regclass('public.email_accounts') IS NOT NULL AS email_accounts_exists,
       (SELECT count(*) FROM pg_type WHERE typname = 'EmailSecurityMode') AS enum_count;
-- expected: t / 1
```

Re-run the Step 1 counts and the research column query; all six counts must be identical to
the baseline and the research table columns unchanged.

**Step 6 — Configure the encryption key without exposing it.**

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
```

Write the single Base64 line into `apps/api/.env` as
`EMAIL_ACCOUNT_ENCRYPTION_KEY=<generated value>` without echoing it into logs, chat,
screenshots or Git. Never commit `.env`; it is git-ignored. No default or fallback exists.

**Step 7 — Restart the API so it reads the new environment.**

The API reads `EMAIL_ACCOUNT_ENCRYPTION_KEY` from the environment at request time, but an
existing process started without it will keep failing. The owner restarts the API process
(for example `npm run dev:api`); this preflight did not restart, stop or probe it. The web
app needs no restart for this variable.

**Step 8 — Database-backed acceptance checks.**

1. Open `/settings/email-accounts`, create an account with synthetic SMTP/IMAP values.
2. Confirm the list shows name, address, sender name, status, Edit and Disable; edit it and
   confirm both password fields are empty and the preserve hint is shown.
3. Save a non-credential change, then verify the encrypted columns are unchanged:
   ```sql
   SELECT id, enabled,
          length("smtpPasswordEncrypted") AS smtp_len,
          length("imapPasswordEncrypted") AS imap_len,
          ("smtpPasswordEncrypted" LIKE 'v1.%') AS smtp_v1_format,
          ("imapPasswordEncrypted" LIKE 'v1.%') AS imap_v1_format,
          md5("smtpPasswordEncrypted") AS smtp_hash, md5("imapPasswordEncrypted") AS imap_hash
   FROM email_accounts;
   ```
   Compare the two `md5` hashes before and after the edit; both must be unchanged. Do not
   print or copy the full ciphertext or any plaintext.
4. Replace only the SMTP password and save; the SMTP hash must change and the IMAP hash must
   stay identical. Repeat for IMAP.
5. Disable and re-enable the account and confirm `enabled` toggles in the DB and survives a
   page reload.
6. Confirm the API responses contain only `smtpPasswordConfigured` /
   `imapPasswordConfigured` (never ciphertext, IV, tag or plaintext) and that no plaintext
   credential is stored: search the two columns for the synthetic marker used, expecting 0
   matches.
7. SMTP/IMAP connectivity, sending and synchronization remain unimplemented; they cannot be
   accepted by these checks.

**Rollback.** The migration is additive. If it must be undone, drop only
`email_accounts` and `EmailSecurityMode` (owner-approved) or restore the backup; research
tables and rows are unaffected either way. Prisma provides no down migration, so this is a
manual owner action, not an automated step.

### 15.8 Required human decisions

1. Approve creating the backup and confirm its destination (`%USERPROFILE%\SDR-Backups`) and
   retention.
2. Approve applying exactly one pending migration
   (`20261125230000_add_email_account`) via `prisma migrate deploy`, and decide whether to
   pause research runs during it.
3. Authorize generating and storing `EMAIL_ACCOUNT_ENCRYPTION_KEY` and restarting the API.
4. Confirm that the inspected database (`localhost:5433`, `sdr_assistant`) is the intended
   acceptance target and that no other environment shares it.
5. Decide whether the post-migration row-count/schema snapshot should be recorded in this
   document.

### 15.9 Confirmation

- No migration, `db push`, `migrate reset` or `migrate resolve` was executed; no schema or
  database record was modified.
- No backup was created; no encryption key was generated or configured; `.env` was not
  modified.
- No application source, test, migration file, research file, dependency or configuration
  was changed; no process was restarted; no external provider was contacted.
- No Full Access or privilege escalation was requested or used for this preflight; no
  staging, commit or push was performed; SDR-005 was not started.
- Research Implementation Freeze remains fully active. Preflight status:
  **READY_FOR_HUMAN_REVIEW**; SDR-004 is not DONE.

## 16. Database deployment and manual-acceptance preparation (executed, 2026-11-26)

### 16.1 Authorization and backup location

- The human owner accepted the SDR-004 automated verification and database preflight and
  explicitly authorized: a protected local PostgreSQL backup outside the repository,
  applying the single pending `20261125230000_add_email_account` migration, and generating
  and storing `EMAIL_ACCOUNT_ENCRYPTION_KEY` in `apps/api/.env`. Full Access was authorized
  exclusively for these operations.
- Backup root: the owner created and indicated
  `C:\Users\msmig\Projektai\_backupsForProjects`; the backup was placed in a new timestamped
  subdirectory there instead of §4's `%LOCALAPPDATA%\SDR-Backups` wording.
- Research Implementation Freeze remained fully active throughout.
- No application source, tests, fixtures, migration files, dependencies, manifests or
  research implementation were modified. No research job was interrupted or modified.

### 16.2 Target confirmation before changes

| Item | Observation |
| --- | --- |
| Container / service | `sdr-assistant-db` / `db`, image `postgres:17-alpine`, running and `healthy` |
| Host / port / database / user | `localhost` / `5433` / `sdr_assistant` / `sdr` |
| Server | PostgreSQL 17.11; `pg_isready` reported accepting connections |
| Application data source | `apps/api/.env` points at the same host, port, database and user (credentials not printed) |
| Migration ledger | 8 records, 8 applied, 0 unfinished, 0 rolled back |
| Pending migrations | exactly one: `20261125230000_add_email_account` (Prisma exit 1, pending only) |
| Applied checksums | all 8 matched the on-disk migration files |
| Active research jobs | 0 `QUEUED`, 0 `RUNNING`; 0 rows with an execution token/lease (37 COMPLETED, 3 FAILED, 2 INTERRUPTED) |
| `email_accounts` / `EmailSecurityMode` | both absent |

### 16.3 Pre-migration baseline (deterministic, read-only)

Captured with aggregate/structure queries only; no individual research record was exported.

| Protected table | Rows | Content fingerprint |
| --- | --- | --- |
| `products` | 5 | `b08db99b30806f800ca649948aac817a` |
| `researches` | 42 | `6f4476a16e93d2584dd6299dc802a0f3` |
| `research_stage_01_results` | 5 | `70a5598f0d4ac766f31996943daa8a06` |
| `research_stage_02_results` | 3 | `b9b7c5c113d4deb13b9f6864443afdc3` |
| `research_stage_03_results` | 5 | `b88706cadf893d1d377fa9e14134ffcd` |
| `settings` | 1 | `a5fb91bf9317969fb493b58f87baf8e2` |

- Schema metadata fingerprint (columns, indexes, constraints of the six tables):
  `3fc348d9692c77144f871a5c2626ac5d`.
- The eight applied migration checksums were captured (see the expected-checksum map in the
  final proof in §16.7).
- Evidence saved as `baseline.json` (2,200 bytes, SHA-256
  `2A62956EC8B7B4FDFB3FB8B9AF2F6281805368633864D129BB8777CD254E34EC`) in the protected
  backup directory.

### 16.4 Protected backup

| Item | Value |
| --- | --- |
| Backup directory | `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-104437` |
| ACL | inheritance disabled; explicit FullControl for `NT AUTHORITY\SYSTEM`, `BUILTIN\Administrators` and `AlfasisDev\msmig`; 0 `CodexSandboxUsers` ACEs; no inherited ACEs |
| ACL scope | applied only to the newly created empty directory; parent and existing directories untouched |
| Archive | `sdr_assistant_full_20261126-104437.dump` |
| Size | 3,804,416 bytes |
| SHA-256 | `5891a813972efb73bd730efa7ca6d05af69dbba2508ee6f6629c9e21264b8f13` |
| `pg_dump` | exit code 0 (`pg_dump -U sdr -d sdr_assistant -Fc`, credentials from container env) |
| Container vs host | sizes equal; SHA-256 equal (container `sha256sum` vs host `Get-FileHash`) |
| `pg_restore -l` | exit 0; exactly 7 `TABLE DATA` entries: the six application tables plus `_prisma_migrations` |
| SQL generation | `pg_restore --file=- <dump> > /dev/null` exit 0 — complete archive read and SQL generated without a database connection |
| Live restore | not performed |
| Temporary container dump | removed after verification; no `sdr004_*` temporary path remains in the container |
| Other evidence | `backup-verification.json` (725 bytes) in the same protected directory |

### 16.5 Migration application

- Immediately before deployment: the protected baseline was re-queried and matched §16.3
  exactly; the ledger remained 8 applied / 0 unfinished / 0 rolled back; exactly one pending
  migration was present; the pending SQL was re-read and contains only two statements —
  `CREATE TYPE "EmailSecurityMode"` and `CREATE TABLE "email_accounts"` — with no `DROP`,
  `ALTER TABLE`, research reference or additional object.
- Command (from `apps/api`, existing local CLI):
  `.\node_modules\.bin\prisma.cmd migrate deploy`
- Actual output:

```text
Datasource "db": PostgreSQL database "sdr_assistant", schema "public" at "localhost:5433"

9 migrations found in prisma/migrations

Applying migration `20261125230000_add_email_account`

The following migration(s) have been applied:

migrations/
  └─ 20261125230000_add_email_account/
    └─ migration.sql

All migrations have been successfully applied.
MIGRATE_DEPLOY_EXIT=0
```

- **Exit code 0.** Only the single authorized migration was applied.
- After deployment: ledger 9 records / 9 applied / 0 unfinished / 0 rolled back; the new
  record is finished at `2026-11-26 08:45:41` database time (`10:45:41` local). The eight
  previously applied records and checksums are unchanged; the new record's checksum
  `325cddc6d2a6a8bab2e9619dbf18f68cf141e8d84ff1f5e81b8910f4c971f219` equals the SHA-256
  of its `migration.sql`.
- `email_accounts` exists, `EmailSecurityMode` exists (1 enum type), and `email_accounts`
  contains 0 rows. No email account has been created.

### 16.6 Encryption key configuration

- `EMAIL_ACCOUNT_ENCRYPTION_KEY` was absent before this step (no valid key to preserve and
  no invalid non-empty key to report).
- Generated exactly 32 cryptographically random bytes with Node.js
  `crypto.randomBytes(32)` and canonical Base64 encoding, then written directly into
  `apps/api/.env`.
- All eight pre-existing variables were preserved: `DATABASE_URL`, `PORT`,
  `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `EXA_API_KEY`,
  `FIRECRAWL_API_KEY`, `TERMINOLOGY_SNAPSHOT_DIR`.
- Validation: line present exactly once, canonical Base64, decodes to exactly 32 bytes. The
  key value was never printed, logged, documented or committed.
- `apps/api/.env` remains ignored by Git (`.gitignore:21:.env`).
- The API was **not** restarted; the owner will restart it before manual acceptance.

### 16.7 Single final proof

An initial execution of the final proof failed only at check 4 because the script expected
PostgreSQL's boolean text as `t|1|0`, while `||` renders a boolean operand as `true`
(`true|1|0`). No database or migration state was touched by that attempt; only the expected
literal was corrected, with no change to any check's meaning, and the proof was then
executed successfully. Earlier histories (the implementation proof, E2E continuation and
preflight) are preserved above.

Exact final proof command (executed once after the expected-literal correction, from the
repository root):

```powershell
& {
    $ErrorActionPreference = 'Stop'

    function Get-DbScalar([string]$sql) {
        $out = docker compose exec -T db psql -U sdr -d sdr_assistant -X -A -t -c $sql 2>$null
        if ($LASTEXITCODE -ne 0) { throw 'Database query failed' }
        return ($out | Out-String).Trim()
    }

    Push-Location apps/api
    try {
        $statusOutput = (& .\node_modules\.bin\prisma.cmd migrate status 2>&1 | Out-String)
        $statusExit = $LASTEXITCODE
    }
    finally { Pop-Location }
    if ($statusExit -ne 0) { throw "prisma migrate status failed with exit code $statusExit" }
    if ($statusOutput -notmatch 'Database schema is up to date!') { throw 'Prisma did not report an up-to-date schema' }
    Write-Output 'CHECK 1 prisma-migrate-status: PASS'

    $ledger = Get-DbScalar "SELECT count(*) || '|' || count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) || '|' || count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) || '|' || count(*) FILTER (WHERE rolled_back_at IS NOT NULL) FROM _prisma_migrations;"
    if ($ledger -ne '9|9|0|0') { throw "Migration ledger mismatch: $ledger" }
    $newApplied = Get-DbScalar "SELECT count(*) FROM _prisma_migrations WHERE migration_name = '20261125230000_add_email_account' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;"
    if ($newApplied -ne '1') { throw 'EmailAccount migration is not applied' }
    $expectedChecksums = [ordered]@{
        '20261031115714_add_product' = 'abd918c3a48e29eb30602f3fb0765f9e4d3b3ce08abb2e1ea433e17362b6c7af'
        '20261106133236_add_general_categories' = '77d41d4cc3ad2fbba4eb2ecf51127a308e351ab524126eba08690aed0a6c7771'
        '20261110120000_rename_general_categories_to_possible_search_terms' = '6df2807bf118f107a30103d476587f9155ae40ee379751af91d83dc191a1030a'
        '20261113110533_add_research' = 'be830625dda2bca0e79ed5e1c3664951440f175debc4a522fe064278a126f656'
        '20261117190641_add_setting' = 'e14189df2cc83405e231643623920cf344c373895fd2654aa4f802a590abda17'
        '20261124123231_add_stage_results' = '4d8c23c3b461714146474bb53c9d8598c39988cb0f16a0bfce32ff6f77208797'
        '20261124123609_stage01_identified_and_prepared' = 'ba2d13ff882f80932a318d0cf2b3e8ca24e64fb3f9e50f378936e2d198351e07'
        '20261124144445_stage03_resume_state' = 'b72b800c0197e15020cf147ce98a5abcb8b462f919d41ece28ae01b2fb3cc6b6'
        '20261125230000_add_email_account' = '325cddc6d2a6a8bab2e9619dbf18f68cf141e8d84ff1f5e81b8910f4c971f219'
    }
    $ledgerRows = Get-DbScalar "SELECT migration_name || '=' || checksum FROM _prisma_migrations ORDER BY migration_name;"
    $ledgerMap = @{}
    foreach ($line in ($ledgerRows -split "`n")) {
        $trimmed = $line.Trim()
        if ($trimmed -ne '') {
            $parts = $trimmed -split '=', 2
            $ledgerMap[$parts[0]] = $parts[1]
        }
    }
    if ($ledgerMap.Count -ne 9) { throw "Unexpected migration-record count: $($ledgerMap.Count)" }
    foreach ($name in $expectedChecksums.Keys) {
        if (-not $ledgerMap.ContainsKey($name)) { throw "Missing migration record: $name" }
        if ($ledgerMap[$name] -ne $expectedChecksums[$name]) { throw "Checksum mismatch for $name" }
    }
    Write-Output 'CHECK 2 migration-ledger-and-checksums: PASS'

    $fingerprintSql = @'
SELECT 'products' AS table_name, count(*) AS row_count,
       md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), '')) AS fingerprint
FROM (SELECT p::text AS row_text FROM products p) s
UNION ALL
SELECT 'researches', count(*), md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), ''))
FROM (SELECT r::text AS row_text FROM researches r) s
UNION ALL
SELECT 'research_stage_01_results', count(*), md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), ''))
FROM (SELECT r::text AS row_text FROM research_stage_01_results r) s
UNION ALL
SELECT 'research_stage_02_results', count(*), md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), ''))
FROM (SELECT r::text AS row_text FROM research_stage_02_results r) s
UNION ALL
SELECT 'research_stage_03_results', count(*), md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), ''))
FROM (SELECT r::text AS row_text FROM research_stage_03_results r) s
UNION ALL
SELECT 'settings', count(*), md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), ''))
FROM (SELECT r::text AS row_text FROM settings r) s
ORDER BY table_name;
'@
    $expectedRows = @(
        'products|5|b08db99b30806f800ca649948aac817a',
        'researches|42|6f4476a16e93d2584dd6299dc802a0f3',
        'research_stage_01_results|5|70a5598f0d4ac766f31996943daa8a06',
        'research_stage_02_results|3|b9b7c5c113d4deb13b9f6864443afdc3',
        'research_stage_03_results|5|b88706cadf893d1d377fa9e14134ffcd',
        'settings|1|a5fb91bf9317969fb493b58f87baf8e2'
    )
    $actualRows = @((Get-DbScalar $fingerprintSql) -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
    if ($actualRows.Count -ne 6) { throw "Unexpected protected-table row count: $($actualRows.Count)" }
    foreach ($row in $expectedRows) {
        if ($actualRows -notcontains $row) { throw "Protected-table baseline mismatch: $row" }
    }
    $schemaSql = @'
SELECT md5(string_agg(line, E'\n' ORDER BY line)) AS schema_fingerprint
FROM (
  SELECT 'COLUMN|' || table_name || '|' || column_name || '|' || data_type || '|' || is_nullable || '|' || COALESCE(column_default, '') AS line
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name IN ('products','researches','research_stage_01_results','research_stage_02_results','research_stage_03_results','settings')
  UNION ALL
  SELECT 'INDEX|' || tablename || '|' || indexname || '|' || indexdef
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename IN ('products','researches','research_stage_01_results','research_stage_02_results','research_stage_03_results','settings')
  UNION ALL
  SELECT 'CONSTRAINT|' || conrelid::regclass::text || '|' || conname || '|' || pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text IN ('products','researches','research_stage_01_results','research_stage_02_results','research_stage_03_results','settings')
) s;
'@
    $schemaFingerprint = Get-DbScalar $schemaSql
    if ($schemaFingerprint -ne '3fc348d9692c77144f871a5c2626ac5d') { throw 'Protected-table schema metadata fingerprint changed' }
    Write-Output 'CHECK 3 protected-research-baseline: PASS'

    $objects = Get-DbScalar "SELECT (to_regclass('public.email_accounts') IS NOT NULL) || '|' || (SELECT count(*) FROM pg_type WHERE typname = 'EmailSecurityMode') || '|' || (SELECT count(*) FROM email_accounts);"
    if ($objects -ne 'true|1|0') { throw "EmailAccount objects mismatch: $objects" }
    Write-Output 'CHECK 4 email-account-table-and-enum: PASS'

    $backup = 'C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-104437\sdr_assistant_full_20261126-104437.dump'
    if (-not (Test-Path -LiteralPath $backup)) { throw 'Verified backup archive is missing' }
    $backupHash = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($backupHash -ne '5891a813972efb73bd730efa7ca6d05af69dbba2508ee6f6629c9e21264b8f13') { throw 'Backup archive SHA-256 changed' }
    Write-Output 'CHECK 5 backup-archive-sha256: PASS'

    $envRaw = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath 'apps/api/.env').Path)
    $keyMatch = [regex]::Matches($envRaw, '(?m)^[ \t]*EMAIL_ACCOUNT_ENCRYPTION_KEY[ \t]*=[ \t]*(\S+)[ \t]*$')
    if ($keyMatch.Count -ne 1) { throw 'EMAIL_ACCOUNT_ENCRYPTION_KEY is missing or duplicated in apps/api/.env' }
    $keyValue = $keyMatch[0].Groups[1].Value
    $keyBytes = [Convert]::FromBase64String($keyValue)
    if ($keyBytes.Length -ne 32) { throw 'Configured encryption key is not 32 bytes' }
    if ([Convert]::ToBase64String($keyBytes) -ne $keyValue) { throw 'Configured encryption key is not canonical Base64' }
    Write-Output 'CHECK 6 encryption-key-configuration: PASS'

    git check-ignore --quiet apps/api/.env
    if ($LASTEXITCODE -ne 0) { throw 'apps/api/.env is not git-ignored' }
    Write-Output 'CHECK 7 env-git-ignored: PASS'

    Write-Output 'PASS: SDR-004 migration, backup, research preservation and encryption configuration verified'
}
```

Actual output:

```text
CHECK 1 prisma-migrate-status: PASS
CHECK 2 migration-ledger-and-checksums: PASS
CHECK 3 protected-research-baseline: PASS
CHECK 4 email-account-table-and-enum: PASS
CHECK 5 backup-archive-sha256: PASS
CHECK 6 encryption-key-configuration: PASS
CHECK 7 env-git-ignored: PASS
PASS: SDR-004 migration, backup, research preservation and encryption configuration verified
```

**Exit code: 0.**

### 16.8 Research preservation comparison

| Check | Before | After | Result |
| --- | --- | --- | --- |
| `products` | 5 / `b08db99b…` | 5 / `b08db99b…` | identical |
| `researches` | 42 / `6f4476a1…` | 42 / `6f4476a1…` | identical |
| `research_stage_01_results` | 5 / `70a5598f…` | 5 / `70a5598f…` | identical |
| `research_stage_02_results` | 3 / `b9b7c5c1…` | 3 / `b9b7c5c1…` | identical |
| `research_stage_03_results` | 5 / `b88706ca…` | 5 / `b88706ca…` | identical |
| `settings` | 1 / `a5fb91bf…` | 1 / `a5fb91bf…` | identical |
| Schema metadata | `3fc348d9…` | `3fc348d9…` | identical |
| Migration checksums | 8 recorded | same 8 unchanged + new migration | correct |

No research row, column, index or constraint changed.

### 16.9 Scope compliance

- Authorized modifications used only: the new protected backup directory and its contents;
  that directory's ACL; the database changes of the single authorized migration;
  `EMAIL_ACCOUNT_ENCRYPTION_KEY` in `apps/api/.env`; the task registry and this document.
- No research implementation, application source, test, fixture, migration file, dependency,
  manifest or lockfile was modified.
- No email account was created (table has 0 rows); no SMTP/IMAP connection or external
  provider call was made; no research job was interrupted.
- No existing application process was restarted, stopped or started by this task; the API dev
  process observed during inspection was left untouched.
- No Full Access request or sandbox/ACL change beyond the new backup directory's ACL; no
  staging, commit or push; SDR-005 was not started.
- Research Implementation Freeze remains fully active.

### 16.10 Manual acceptance instructions for the owner

1. **Restart the API** so it loads the new `EMAIL_ACCOUNT_ENCRYPTION_KEY` (the running dev
   process started before the key was written). For example stop and restart
   `npm run dev:api`, or restart `npm run dev`. The web app needs no restart.
2. Confirm `GET /health` responds and open `/settings/email-accounts`.
3. Create one synthetic account (synthetic host/address and synthetic passwords). Confirm
   the list shows account name, address, sender name, Enabled status, Edit and Disable.
4. Edit it without entering passwords: both password fields must be empty, the preserve hint
   must be shown, and the encrypted columns' `md5()` must be unchanged after saving. Replace
   only the SMTP password: only the SMTP hash changes; repeat for IMAP.
5. Disable and re-enable the account; confirm the status persists after reload.
6. Confirm API responses contain only `smtpPasswordConfigured`/`imapPasswordConfigured` and
   that the encrypted columns contain `v1.`-format ciphertext with no plaintext marker.
7. Record the results in this document (execution notes may be appended) and ask the human
   owner to accept SDR-004; only the owner may mark it DONE.

### 16.11 Remaining limitations

- SMTP/IMAP connectivity, sending and synchronization remain unimplemented and untested.
- No application authentication exists; email-account management must remain in the trusted
  local deployment.
- Hard deletion and research-to-account assignment remain out of scope for SDR-004.
- Backup retention and encryption-key custody/rotation are owner decisions; this task
  created no rotation mechanism.
- The final proof validates the migration ledger and the protected-table schema/content
  fingerprints, not a full schema drift diff of the entire database.
- Manual database-backed acceptance remains pending the owner's restart and checks.
  SDR-004 remains **READY_FOR_HUMAN_REVIEW**, not DONE.

## 17. Database-backed acceptance (executed, 2026-11-26)

### 17.1 Authorization and scope

- The human owner visually reviewed the Settings → Email accounts UI, created a real email
  account through the application, and accepted the current visual theme, navigation and
  general UI structure. Potential form-layout improvements are deferred to SDR-005.
- Remaining requirement: database-backed credential and account-management verification
  against the running local API and PostgreSQL, without modifying the implementation.
- Before scripting, the actual contract was inspected: `CreateEmailAccountDto` and
  `UpdateEmailAccountDto` field names and validation, `EmailAccountsController` routes
  (`GET/POST /email-accounts`, `GET/PATCH /email-accounts/:id`), the explicit
  `toEmailAccountResponse` mapper field set, and the Prisma `EmailAccount` model/columns.
- Only a separate synthetic account (`SDR-004 acceptance test <timestamp>`, `example.com`
  addresses, synthetic credentials) was created and updated through the API. No real
  account was read beyond a hashed aggregate fingerprint, modified, disabled or deleted;
  no password, ciphertext or real account data was printed.
- No SMTP or IMAP connection was attempted, no external provider was called, no service was
  restarted, PostgreSQL access was read-only, and no implementation file was changed.

### 17.2 Environment and synthetic account

| Item | Value |
| --- | --- |
| API | `http://localhost:4000`, `/health` returned `{"status":"ok"}` |
| Database | `sdr_assistant` via container `sdr-assistant-db`, reachable |
| Pre-existing real accounts | 1 (captured only as count + aggregated hashed fingerprint) |
| Synthetic account | `SDR-004 acceptance test 20261126-111205` |
| Synthetic address | `sdr004.acceptance.<timestamp>@example.com` (example.com) |
| Synthetic SMTP/IMAP | `smtp.example.com:587 STARTTLS`, `imap.example.com:993 TLS`, synthetic users/passwords |
| Final synthetic state | **disabled** (`enabled = false`), both stored credentials encrypted |
| Final account totals | 2 total; 1 pre-existing real account; 1 synthetic account |

### 17.3 Temporary acceptance script

- Created at `docs/tasks/sdr-004-acceptance-proof.ps1`, executed once with
  `& '.\docs\tasks\sdr-004-acceptance-proof.ps1'` from the repository root, then removed.
  It was never staged or committed.
- Exact script content as executed (195 lines):

```powershell
# SDR-004 database-backed acceptance proof (temporary).
# Account mutations go only through the running local API.
# PostgreSQL access is read-only. No SMTP/IMAP or external provider is contacted.
$ErrorActionPreference = 'Stop'

$baseUrl = 'http://localhost:4000'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$accountName = "SDR-004 acceptance test $stamp"
$emailAddress = "sdr004.acceptance.$stamp@example.com"
$smtpPassword = 'Synthetic-SMTP-' + [guid]::NewGuid().ToString('N')
$imapPassword = 'Synthetic-IMAP-' + [guid]::NewGuid().ToString('N')
$rotatedSmtpPassword = 'Synthetic-SMTP-rotated-' + [guid]::NewGuid().ToString('N')
$rotatedImapPassword = 'Synthetic-IMAP-rotated-' + [guid]::NewGuid().ToString('N')

function Assert-Check([bool]$condition, [string]$message) {
    if (-not $condition) { throw "FAIL: $message" }
}

function Invoke-Api([string]$method, [string]$path, $body) {
    $params = @{
        Uri = $baseUrl + $path
        Method = $method
        TimeoutSec = 20
        ErrorAction = 'Stop'
    }
    if ($null -ne $body) {
        $params['ContentType'] = 'application/json'
        $params['Body'] = ($body | ConvertTo-Json -Compress)
    }
    return Invoke-RestMethod @params
}

function Get-DbScalar([string]$sql) {
    $output = docker compose exec -T db psql -U sdr -d sdr_assistant -X -A -t -c $sql 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'FAIL: read-only database query failed' }
    return ($output | Out-String).Trim()
}

# Preconditions
$health = Invoke-Api 'GET' '/health' $null
Assert-Check ($health.status -eq 'ok') 'local API health check'

$baselineSql = @'
SELECT count(*) || '|' || md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), ''))
FROM (SELECT a::text AS row_text FROM email_accounts a) s;
'@
$baseline = Get-DbScalar $baselineSql
$baselineParts = $baseline -split '\|', 2
$baselineRealCount = [int]$baselineParts[0]
Assert-Check ($baselineRealCount -ge 1) 'at least one pre-existing real account expected'

# Create the synthetic account through the API
$createBody = @{
    name = $accountName
    senderName = 'SDR-004 Acceptance'
    emailAddress = $emailAddress
    enabled = $true
    smtpHost = 'smtp.example.com'
    smtpPort = 587
    smtpSecurity = 'STARTTLS'
    smtpUsername = 'sdr004-smtp-user'
    smtpPassword = $smtpPassword
    imapHost = 'imap.example.com'
    imapPort = 993
    imapSecurity = 'TLS'
    imapUsername = 'sdr004-imap-user'
    imapPassword = $imapPassword
}
$created = Invoke-Api 'POST' '/email-accounts' $createBody
$id = [string]$created.id
Assert-Check ($id -ne '') 'created account has an id'
Assert-Check ($created.name -eq $accountName) 'created account name matches'
Assert-Check ($created.emailAddress -eq $emailAddress) 'created account email matches'
Assert-Check ($created.enabled -eq $true) 'created account is enabled'
Write-Output 'CHECK 1 create-synthetic-account: PASS'

$smtpSelectSql = @"
SELECT "smtpPasswordEncrypted" FROM email_accounts WHERE id = '$id';
"@
$imapSelectSql = @"
SELECT "imapPasswordEncrypted" FROM email_accounts WHERE id = '$id';
"@
$fingerprintSql = @"
SELECT md5("smtpPasswordEncrypted") || '|' || md5("imapPasswordEncrypted") FROM email_accounts WHERE id = '$id';
"@
$enabledSql = @"
SELECT "enabled"::text FROM email_accounts WHERE id = '$id';
"@

$smtpCiphertext = Get-DbScalar $smtpSelectSql
$imapCiphertext = Get-DbScalar $imapSelectSql
Assert-Check ($smtpCiphertext.StartsWith('v1.')) 'SMTP credential persisted in encrypted format'
Assert-Check ($imapCiphertext.StartsWith('v1.')) 'IMAP credential persisted in encrypted format'
Assert-Check ($smtpCiphertext.Length -gt 40) 'SMTP encrypted payload is non-trivial'
Assert-Check ($imapCiphertext.Length -gt 40) 'IMAP encrypted payload is non-trivial'
Assert-Check ($smtpCiphertext -ne $smtpPassword) 'SMTP credential is not stored as plaintext'
Assert-Check ($imapCiphertext -ne $imapPassword) 'IMAP credential is not stored as plaintext'
Write-Output 'CHECK 2 credentials-persisted-encrypted: PASS'

Assert-Check (-not $smtpCiphertext.Contains($smtpPassword)) 'SMTP encrypted payload does not contain its plaintext'
Assert-Check (-not $imapCiphertext.Contains($imapPassword)) 'IMAP encrypted payload does not contain its plaintext'
Write-Output 'CHECK 3 encrypted-payload-excludes-plaintext: PASS'

$fingerprint = Get-DbScalar $fingerprintSql
$fingerprintParts = $fingerprint -split '\|', 2
$smtpFingerprint = $fingerprintParts[0]
$imapFingerprint = $fingerprintParts[1]
Assert-Check ($smtpFingerprint -ne '') 'SMTP credential fingerprint captured'
Assert-Check ($imapFingerprint -ne '') 'IMAP credential fingerprint captured'

$fetched = Invoke-Api 'GET' "/email-accounts/$id" $null
Assert-Check ($fetched.id -eq $id) 'retrieved account id matches'
Assert-Check ($fetched.name -eq $accountName) 'retrieved account name matches'
Assert-Check ($fetched.emailAddress -eq $emailAddress) 'retrieved account email matches'
Assert-Check ($fetched.smtpHost -eq 'smtp.example.com' -and $fetched.smtpPort -eq 587) 'retrieved SMTP settings match'
Assert-Check ($fetched.imapHost -eq 'imap.example.com' -and $fetched.imapPort -eq 993) 'retrieved IMAP settings match'
Write-Output 'CHECK 4 retrieve-account: PASS'

$expectedProperties = @(
    'id', 'name', 'senderName', 'emailAddress', 'enabled',
    'smtpHost', 'smtpPort', 'smtpSecurity', 'smtpUsername', 'smtpPasswordConfigured',
    'imapHost', 'imapPort', 'imapSecurity', 'imapUsername', 'imapPasswordConfigured',
    'createdAt', 'updatedAt'
) | Sort-Object
foreach ($response in @($created, $fetched)) {
    $actualProperties = @($response.PSObject.Properties.Name) | Sort-Object
    Assert-Check ((($actualProperties -join ',') -eq ($expectedProperties -join ','))) 'API response exposes exactly the safe field set'
    Assert-Check ($response.smtpPasswordConfigured -eq $true) 'SMTP presence flag is true'
    Assert-Check ($response.imapPasswordConfigured -eq $true) 'IMAP presence flag is true'
    $raw = $response | ConvertTo-Json -Compress -Depth 5
    Assert-Check (-not $raw.Contains($smtpPassword)) 'API response does not contain the SMTP plaintext'
    Assert-Check (-not $raw.Contains($imapPassword)) 'API response does not contain the IMAP plaintext'
    Assert-Check (-not $raw.Contains($smtpCiphertext)) 'API response does not contain the SMTP ciphertext'
    Assert-Check (-not $raw.Contains($imapCiphertext)) 'API response does not contain the IMAP ciphertext'
    Assert-Check (-not ($raw -match 'v1\.')) 'API response does not contain an encrypted payload prefix'
    Assert-Check (-not ($raw -match '(?i)PasswordEncrypted')) 'API response does not contain encrypted password fields'
}
Write-Output 'CHECK 5 api-response-credential-safe: PASS'

$updatedSender = 'SDR-004 Acceptance Updated'
$response = Invoke-Api 'PATCH' "/email-accounts/$id" @{ senderName = $updatedSender }
Assert-Check ($response.senderName -eq $updatedSender) 'sender name updated'
Assert-Check ((Get-DbScalar $fingerprintSql) -eq "$smtpFingerprint|$imapFingerprint") 'both credential fingerprints unchanged after non-credential update'
Write-Output 'CHECK 6 non-credential-update-preserves-credentials: PASS'

$response = Invoke-Api 'PATCH' "/email-accounts/$id" @{ senderName = 'SDR-004 Acceptance Empty Passwords'; smtpPassword = ''; imapPassword = '' }
Assert-Check ((Get-DbScalar $fingerprintSql) -eq "$smtpFingerprint|$imapFingerprint") 'both credential fingerprints unchanged after empty-password update'
Assert-Check ($response.smtpPasswordConfigured -eq $true -and $response.imapPasswordConfigured -eq $true) 'credential presence flags remain true'
Write-Output 'CHECK 7 empty-password-update-preserves-credentials: PASS'

$response = Invoke-Api 'PATCH' "/email-accounts/$id" @{ smtpPassword = $rotatedSmtpPassword }
$afterSmtp = (Get-DbScalar $fingerprintSql) -split '\|', 2
$smtpFingerprintAfterRotation = $afterSmtp[0]
$imapFingerprintAfterRotation = $afterSmtp[1]
Assert-Check ($smtpFingerprintAfterRotation -ne $smtpFingerprint) 'SMTP fingerprint changed after SMTP replacement'
Assert-Check ($imapFingerprintAfterRotation -eq $imapFingerprint) 'IMAP fingerprint unchanged after SMTP replacement'
$newSmtpCiphertext = Get-DbScalar $smtpSelectSql
Assert-Check ($newSmtpCiphertext.StartsWith('v1.')) 'replacement SMTP credential is encrypted'
Assert-Check (-not $newSmtpCiphertext.Contains($rotatedSmtpPassword)) 'replacement SMTP ciphertext excludes its plaintext'
Write-Output 'CHECK 8 replace-smtp-only: PASS'

$response = Invoke-Api 'PATCH' "/email-accounts/$id" @{ imapPassword = $rotatedImapPassword }
$afterImap = (Get-DbScalar $fingerprintSql) -split '\|', 2
Assert-Check ($afterImap[0] -eq $smtpFingerprintAfterRotation) 'SMTP fingerprint unchanged after IMAP replacement'
Assert-Check ($afterImap[1] -ne $imapFingerprint) 'IMAP fingerprint changed after IMAP replacement'
$newImapCiphertext = Get-DbScalar $imapSelectSql
Assert-Check ($newImapCiphertext.StartsWith('v1.')) 'replacement IMAP credential is encrypted'
Assert-Check (-not $newImapCiphertext.Contains($rotatedImapPassword)) 'replacement IMAP ciphertext excludes its plaintext'
Write-Output 'CHECK 9 replace-imap-only: PASS'

$response = Invoke-Api 'PATCH' "/email-accounts/$id" @{ enabled = $false }
Assert-Check ($response.enabled -eq $false) 'API reports disabled after disabling'
Assert-Check ((Get-DbScalar $enabledSql) -eq 'false') 'database persists disabled state'
Write-Output 'CHECK 10 disable-persists: PASS'

$response = Invoke-Api 'PATCH' "/email-accounts/$id" @{ enabled = $true }
Assert-Check ($response.enabled -eq $true) 'API reports enabled after enabling'
Assert-Check ((Get-DbScalar $enabledSql) -eq 'true') 'database persists enabled state'
Write-Output 'CHECK 11 enable-persists: PASS'

$response = Invoke-Api 'PATCH' "/email-accounts/$id" @{ enabled = $false }
Assert-Check ($response.enabled -eq $false) 'synthetic account disabled at the end'
Assert-Check ((Get-DbScalar $enabledSql) -eq 'false') 'database persists final disabled state'

$realAccountSql = @"
SELECT count(*) || '|' || md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), ''))
FROM (SELECT a::text AS row_text FROM email_accounts a WHERE a.id <> '$id') s;
"@
$realAfter = Get-DbScalar $realAccountSql
Assert-Check ($realAfter -eq $baseline) 'pre-existing real accounts unchanged'
$totalCount = [int](Get-DbScalar 'SELECT count(*) FROM email_accounts;')
Assert-Check ($totalCount -eq $baselineRealCount + 1) 'exactly one synthetic account added, no other account added or removed'
Write-Output 'CHECK 12 existing-real-accounts-unchanged: PASS'

Write-Output 'PASS: SDR-004 database-backed acceptance'
```

### 17.4 Actual proof output and exit code

Command: `& '.\docs\tasks\sdr-004-acceptance-proof.ps1'` (executed once from the repository
root).

```text
CHECK 1 create-synthetic-account: PASS
CHECK 2 credentials-persisted-encrypted: PASS
CHECK 3 encrypted-payload-excludes-plaintext: PASS
CHECK 4 retrieve-account: PASS
CHECK 5 api-response-credential-safe: PASS
CHECK 6 non-credential-update-preserves-credentials: PASS
CHECK 7 empty-password-update-preserves-credentials: PASS
CHECK 8 replace-smtp-only: PASS
CHECK 9 replace-imap-only: PASS
CHECK 10 disable-persists: PASS
CHECK 11 enable-persists: PASS
CHECK 12 existing-real-accounts-unchanged: PASS
PASS: SDR-004 database-backed acceptance
```

**Exit code: 0.** No credential, ciphertext or real-account data appeared in the output.

### 17.5 Acceptance-check results

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Synthetic account can be created | PASS | `POST /email-accounts` returned the created account with matching name/address and `enabled=true` |
| 2 | Both credentials persisted encrypted | PASS | Both DB columns are `v1.`-prefixed payloads of non-trivial length, not equal to the plaintext |
| 3 | Encrypted credentials contain no plaintext | PASS | Neither stored payload contains its synthetic plaintext substring |
| 4 | Account retrievable after creation | PASS | `GET /email-accounts/:id` returned matching id, name, address and SMTP/IMAP settings |
| 5 | API responses expose only presence flags | PASS | Response property set is exactly the 17 safe fields; both flags true; raw JSON contains no plaintext, ciphertext, `v1.` payload prefix or encrypted-password field |
| 6 | Non-credential update preserves credentials | PASS | `PATCH { senderName }` updated the name; both credential fingerprints identical |
| 7 | Empty password update preserves credentials | PASS | `PATCH { smtpPassword: "", imapPassword: "" }`; both fingerprints identical, flags true |
| 8 | Replacing only SMTP changes only SMTP | PASS | SMTP fingerprint changed; IMAP fingerprint unchanged; new SMTP payload encrypted and plaintext-free |
| 9 | Replacing only IMAP changes only IMAP | PASS | IMAP fingerprint changed; SMTP fingerprint unchanged from check 8; new IMAP payload encrypted and plaintext-free |
| 10 | Disabling persists | PASS | API reported `enabled=false`; database column `false` |
| 11 | Re-enabling persists | PASS | API reported `enabled=true`; database column `true` |
| 12 | Existing real accounts unchanged | PASS | Aggregated hashed fingerprint and count of all pre-existing accounts identical before/after; exactly one new (synthetic) account |

Final synthetic state: **disabled** (`enabled=false`), both credentials still encrypted.
Total accounts: 2 (one pre-existing real account, one synthetic acceptance account).

### 17.6 Security confirmations

- **Encrypted at rest:** both credentials are stored as authenticated-encryption payloads
  (`v1.` prefix), are not plaintext, and do not contain the plaintext substring. The
  encryption key and ciphertext were never printed.
- **Empty password updates preserve credentials:** the `md5` fingerprints of both encrypted
  columns were identical before and after the empty-password `PATCH`; both presence flags
  remained true.
- **Independent replacement:** replacing SMTP changed only the SMTP fingerprint; replacing
  IMAP changed only the IMAP fingerprint while SMTP stayed at its check-8 value.
- **API safety:** every inspected response contained exactly the explicit safe field set and
  no ciphertext, IV, authentication tag or plaintext.
- **Real accounts untouched:** no real account id was used in any mutation; the aggregated
  fingerprint/count comparison over all pre-existing accounts matched exactly.

### 17.7 Scope compliance

- Only authorized modifications: the synthetic account created/updated through the API (left
  disabled), the temporary acceptance script (created, executed and removed), the task
  registry and this document.
- No application source, test, research file, prompt, schema, fixture, migration, dependency,
  package manifest or lockfile was modified. `.env` and the encryption key were not changed.
  No database schema change or migration was made; PostgreSQL inspection was read-only.
- No email was sent, no SMTP/IMAP connection was attempted, no external provider was
  contacted, no service was restarted, no automated test suite was rerun, and no sandbox
  privilege escalation was requested (the session's file policy was used as already
  configured).
- Nothing was staged, committed or pushed; SDR-005 was not started. Research Implementation
  Freeze remains fully active.
- The synthetic account remains as one disabled `email_accounts` row in the local database by
  design; it is not a repository file and may be removed later only under separate explicit
  authorization.

### 17.8 Remaining limitations

- SMTP and IMAP connectivity, sending and synchronization remain out of scope and untested.
- No application authentication exists; email-account management remains limited to the
  trusted local deployment.
- Form-layout refinements are deferred to SDR-005 by owner decision.
- Backup retention and encryption-key custody/rotation remain owner decisions.
- Acceptance used the running local development API; no separate production-like deployment
  was exercised.
- SDR-004 remains **READY_FOR_HUMAN_REVIEW**, not DONE.

## 18. Final human acceptance and repository preservation (2026-11-26)

### 18.1 Acceptance

The human owner accepted SDR-004 — Email Account Management on 2026-11-26, with the
following evidence accepted as recorded in this document:

| Evidence | Result | Recorded in |
| --- | --- | --- |
| Prisma Client generation | PASS | §7 |
| Backend tests | 23/23 PASS | §7 |
| Frontend unit tests | 80/80 PASS | §7 |
| Typecheck, ESLint, Prettier | PASS | §7 |
| Playwright E2E | 17/17 PASS | §14 |
| Database backup and migration verification | PASS | §16 |
| Database-backed acceptance | 12/12 PASS | §17 |
| Existing real email account unchanged | PASS | §17 |
| Visual UI and navigation | Accepted | §17.1 |

Form-layout refinements and SMTP/IMAP connectivity testing are deferred to SDR-005 by owner
decision. Research Implementation Freeze remains fully active.

### 18.2 Superseded historical states

The earlier status notes in this document are preserved unchanged as history. They are
**not** the current state; the authoritative current status is DONE in §1 and this section.

| Historical note (preserved) | Where | Superseded by | Current state |
| --- | --- | --- | --- |
| E2E gate blocked by `spawn EPERM` under the sandbox; status `BLOCKED` | §7, §8 | Human-authorized E2E continuation | §14: `npm.cmd run e2e:web` passed 17/17, exit 0 |
| EmailAccount migration pending / not applied | §7, §8, §15 | Authorized database deployment | §16: `migrate deploy` applied the single migration, exit 0; ledger 9/9 applied |
| Database-backed manual acceptance pending | §16.10, §16.11, §17 preamble status line | Database-backed acceptance | §17: all 12 acceptance checks PASS; synthetic account left disabled |
| Status `READY_FOR_HUMAN_REVIEW` | §17.8 and earlier | Human acceptance | §18.1: accepted; status DONE |

### 18.3 Remaining limitations (accepted with SDR-004)

- SMTP and IMAP connectivity, connection testing, sending and incoming synchronization are
  not implemented or verified.
- Application authentication is not implemented; email-account management remains limited to
  the trusted local deployment and must not be exposed publicly.
- The synthetic acceptance account `SDR-004 acceptance test 20261126-111205` remains in the
  local database, intentionally **disabled**.
- Encryption-key custody and rotation remain the owner's responsibility; this task added no
  rotation mechanism.
- Form-layout improvements are deferred to SDR-005; no such changes were made here.

### 18.4 Repository preservation

- Approved staging manifest: exactly the 40 paths listed in §13 (10 modified, 30 added),
  staged with explicit literal paths, including `apps/web/app/settings/email-accounts/[id]/edit/page.tsx`.
- Excluded from staging: `apps/api/.env`, generated Prisma client/.next/.next-e2e artifacts,
  generated `next-env.d.ts`, the 21 previously excluded untracked research/tooling files,
  temporary scripts, database backups and research artifacts.
- One commit was created: `feat: add encrypted email account management`.
- `main` was pushed to `origin` without force-push.
- Final read-only proof: `git ls-remote --exit-code origin refs/heads/main`, requiring remote
  `refs/heads/main` to equal local HEAD. The commit hash, staged-manifest comparison, push
  result, proof output and working-tree state are recorded in the completion report that
  accompanies this commit, not inside the commit itself.
- No amend, reset, stash, pull, merge, rebase or force-push was performed.

### 18.5 Confirmation

- SDR-004 is accepted and marked **DONE** in §1 and in the task registry.
- No application implementation, research implementation, tests, fixtures, dependencies,
  database schema/data, migrations, credentials, `.env` values or services were modified by
  this acceptance operation; only the two authorized documentation files were edited and the
  authorized Git commit/push were performed.
- SDR-005 was not registered or started. Research Implementation Freeze remains fully active.
