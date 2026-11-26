# SDR-005 — Email Connection Testing and Account Form UX

## 1. Task ID and status

- **Task ID:** SDR-005
- **Status:** DONE — accepted by the human owner on 2026-11-26. All automated gates passed
  (Playwright 28/28; backend 76/76), the three §30 gaps were corrected and regression-tested,
  the single migration was applied after a verified protected backup with the ten-check
  deployment proof passing, and ENV-003 restricted the local deployment to loopback. The owner
  then completed real-provider acceptance: both SMTP and IMAP reported `VERIFIED`, and the
  account-list/form UX was accepted. See §34; the task is not reopened.
- **Registry:** [README.md](README.md)
- **Baseline:** accepted Git checkpoint `35ac8ca8d825738b24758ed52033709efbfb276d`
  (`feat: add encrypted email account management`); working tree treated as the
  implementation baseline. All 21 pre-existing excluded untracked files are preserved.
- **Execution mode:** standard `workspace-write`. No privilege escalation, no sandbox or
  environment configuration change.
- **Scope authority:** the SDR-005 implementation assignment statement. This document
  records that approved objective, scope, exclusions and acceptance criteria. The agent may
  append execution notes and verification evidence; the approved statements are not
  rewritten.

## 2. Objective

Extend the existing email-account management with:

1. SMTP connection and authentication verification.
2. IMAP connection and authentication verification.
3. Persistent independent verification results.
4. Clear connection-status presentation.
5. A more compact account configuration form.

Email sending, mailbox synchronization, research assignment and campaigns remain out of
scope.

## 3. Authorized scope and paths

- Existing email-accounts backend module and focused supporting components.
- Additive `EmailAccount` verification fields/enums in the Prisma schema.
- One new additive migration under `apps/api/prisma/migrations/`.
- API package manifest (`apps/api/package.json`) and npm lockfile changes strictly required
  by `nodemailer` and `imapflow` plus strictly necessary TypeScript declarations.
- Existing and new focused email-account tests.
- Existing frontend email-account slices and routes.
- Relevant mock API and Playwright email-account scenarios.
- Minimal relevant documentation updates, the task registry and this document.

No unrelated refactoring. No other dependency change.

## 4. Dependencies

- `nodemailer` — SMTP verification.
- `imapflow` — IMAP verification.
- Strictly necessary TypeScript declarations for the above.

Select stable, compatible versions and record the actually installed versions. Use npm
(not pnpm). Only the API package manifest and the corresponding npm lockfile changes
required by these dependencies are authorized. Do not upgrade unrelated dependencies and do
not execute automatic audit fixes. If installation requires additional permissions or
encounters an unresolved dependency conflict, stop and report `BLOCKED`.

## 5. SMTP verification requirements

Verify the saved SMTP configuration with Nodemailer's `verify()` using the saved host, port,
security mode, username and the decrypted saved password. TLS means implicit TLS; STARTTLS
means a mandatory TLS upgrade before authentication. Validate server certificates and
hostnames; never disable certificate validation; never fall back to plaintext
authentication. Apply bounded connection, greeting, socket and overall operation timeouts.
Close all connections after success, failure or timeout.

A successful verification requires a successful server connection, TLS negotiation and
authentication. Do not send an email and do not execute `MAIL FROM`, `RCPT TO` or `DATA`.
SMTP verification does not establish sender-address authorization or deliverability.

## 6. IMAP verification requirements

Verify the saved IMAP configuration with ImapFlow using the existing saved configuration and
credential-decryption component. Require a successful connection, TLS negotiation and
authentication; for STARTTLS explicitly require the TLS upgrade before authentication.
Disable raw protocol logging and library options that expose credentials. Close the
connection on success, failure or timeout. Do not open or select a mailbox, list/search/
fetch/download messages, mark messages read, move/delete messages, change flags or
synchronize mail.

## 7. Network and credential security requirements

- The application has no authentication and must remain inside a trusted local deployment;
  verification endpoints must not be exposed to public or untrusted networks.
- Treat configurable mail hosts as untrusted network destinations. Validate destination
  hostnames and restrict verification connections to standard mail ports: SMTP 465 and 587;
  IMAP 993 and 143.
- Reject localhost, private, loopback, link-local, reserved and other non-public destination
  addresses, including IPv6 equivalents.
- Validate resolved addresses and make the actual connection use a validated destination
  rather than performing an unchecked second DNS lookup.
- Preserve TLS certificate and hostname validation against the configured hostname.
- Do not add a bypass for these restrictions. If the selected libraries cannot safely
  enforce them using supported APIs, report the blocker rather than weakening them.
- Decrypt only the credential required by the requested protocol.
- Never expose credentials, encryption material or raw provider responses in logs, API
  responses or UI errors.
- Prevent overlapping verification requests for the same account and protocol.
- No automatic retries, scheduled checks or background verification.

## 8. Verification-result requirements

Maintain independent persistent verification results for SMTP and IMAP. Suggested fields per
protocol: status (`NOT_TESTED`, `VERIFIED`, `FAILED`), nullable last-checked timestamp and
nullable safe failure code. Testing is a transient request/UI state, not a persistent
successful result. Use existing Prisma naming conventions. One additive migration affecting
only email-account management. Existing accounts default to `NOT_TESTED`. Do not alter
existing research models or migration files. Do not apply the migration.

Invalidation: when SMTP host, port, security, username or password changes, reset SMTP to
`NOT_TESTED`, clear its timestamp and failure code, and preserve IMAP verification; apply the
equivalent rule to IMAP. Changing account name, sender display name or other unrelated
metadata must not invalidate protocol verification. Saving an empty password field must
preserve the existing credential and must not invalidate verification by itself. Prevent
stale in-flight verification results from marking modified configurations as verified:
persist a result only if the tested protocol configuration and credential still match the
current stored configuration.

## 9. Backend endpoint requirements

Extend the existing email-account module with:

- `POST /email-accounts/:id/test-smtp`
- `POST /email-accounts/:id/test-imap`

Use saved account configurations only; no arbitrary connection credentials or destination
overrides in these endpoints. Disabled accounts must not be tested. Return safe, structured
results that distinguish at least: successful verification, authentication failure,
connection timeout, DNS failure, connection refused, TLS or certificate failure, invalid
configuration, credential decryption unavailable and generic connection failure. Do not
return raw library error objects or server response strings. An expected connection failure
is a structured verification result persisted as `FAILED`. Extend the existing explicit
safe response mapper with verification metadata. No password or encrypted credential fields
may be returned. Keep the implementation inside the email-account module or narrowly scoped
supporting components.

## 10. Frontend account-list requirements

Preserve the existing Settings navigation, visual design and light/dark themes. For every
account display: existing account information, enabled/disabled status, independent SMTP
verification status, independent IMAP verification status, last-checked timestamps and safe
failure information when applicable. Add a Test connections action that invokes both
independent protocol checks. One protocol failure must not prevent the other from being
checked. While testing: loading indicators, duplicate-request prevention, preserved
independent protocol results and clear success/partial-success/failure feedback. Disable
connection-testing actions for disabled accounts. Do not automatically enable an account
after successful verification. Use "Verified" rather than "Connected" for a successful
historical verification.

## 11. Account form UX requirements

Without redesigning the application:

- General section: account name, sender name, email address, and an Enabled checkbox aligned
  beside its label rather than centered across the card. Sender name and email address side
  by side when width permits.
- SMTP and IMAP cards side by side on sufficiently wide screens and stacked on
  narrow/mobile screens. Within each card: host; port and security in a compact two-column
  row; username; password. Reuse existing components and theme tokens.
- On account creation, initialize SMTP and IMAP usernames from the email address while the
  corresponding username fields have not been manually customized. Do not overwrite
  user-customized usernames. Do not change existing usernames automatically in edit mode.
  Preserve all existing password-field behavior.
- On the edit form add Test SMTP connection and Test IMAP connection, showing the
  corresponding saved verification result. Verification tests the saved configuration only.
  For a new or unsaved modified account, require saving before testing; disable testing while
  unsaved form changes exist and explain why. Never silently test the old saved settings
  while presenting unsaved settings as current. Keep Save and Cancel behavior unchanged.

## 12. Frontend architecture requirements

Preserve Lite FSD, App Router composition only, existing HTTP and Server Action conventions,
Zod validation of every API response, schema-derived types, result-based errors, no unsafe
casts or `any`, loading/empty/error/success states and the existing notification conventions.
Do not redesign navigation or shared components unnecessarily.

## 13. Test requirements

Focused backend tests for: correct TLS and STARTTLS configuration, required certificate
validation, successful SMTP and IMAP verification, independent protocol failures, timeout
handling and connection cleanup, safe error mapping, credential handling without leakage,
disabled-account rejection, invalid and unsafe network destinations, independent
verification-result persistence, correct invalidation when settings or passwords change,
empty-password preservation, rejection of stale verification results and duplicate
verification prevention. Use mocked protocol adapters, DNS and network behavior; automated
tests must never contact real email servers. Preserve the existing SDR-004 backend tests.

Focused frontend tests and Playwright scenarios using the existing mock API covering: initial
`NOT_TESTED` states, both protocols verified, SMTP success with IMAP failure, SMTP failure
with IMAP success, both protocols failed, loading and duplicate-action prevention, disabled
account behavior, individual verification actions on the edit form, save-before-testing
behavior, verification invalidation, username initialization without overwriting custom
values, and responsive two-column/stacked form layout. Do not weaken existing assertions and
do not modify research tests or restore excluded research fixtures.

## 14. Explicit exclusions

Not implemented or modified:

- Assigning accounts to research, campaigns, sending emails, reading or synchronizing
  mailboxes, OAuth2, scheduled verification.
- Connecting to the owner's real email account, modifying existing real or synthetic accounts
  in the database, applying migrations.
- Modifying `.env` or the encryption key.
- Modifying research implementation, prompts, schemas, settings or fixtures, or changing
  research behavior indirectly.
- Modifying unrelated dependencies.
- Changing sandbox permissions or environment configuration.
- Staging, committing or pushing.
- Starting SDR-006.

## 15. Acceptance criteria

- SMTP and IMAP verification are independently implemented.
- TLS and authentication are required.
- Verification never sends or reads email.
- Network destination restrictions are enforced.
- Connections are cleaned up in all outcomes.
- Passwords and raw provider responses remain private.
- Independent verification results are persisted.
- Configuration changes invalidate only affected verification results.
- Stale verification results cannot overwrite current configuration state.
- Account list displays accurate verification states.
- Individual and combined verification actions work.
- Disabled and unsaved account configurations cannot be tested.
- Account form is compact and responsive.
- Existing email-account management remains functional.
- Mandatory automated verification passes.
- Research Implementation Freeze remains intact.

Real-provider acceptance is a separate owner-authorized step after migration deployment.

## 16. One proof command

The single approved automated proof procedure is:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run db:generate
    if ($LASTEXITCODE -ne 0) {
        throw 'Prisma generation failed'
    }

    npm.cmd run build -w @sdr-assistant/api
    if ($LASTEXITCODE -ne 0) {
        throw 'API build failed'
    }

    npm.cmd run test -w @sdr-assistant/api -- test/email-accounts.test.ts test/email-account-connections.test.ts
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

    Write-Output 'PASS: SDR-005 verification'
}
```

The existing API build, Prisma Client generation and local mock E2E server processes are
authorized for this proof. No real database connection or external mail-provider connection
is authorized. If `workspace-write` blocks Playwright with the previously documented
`spawn EPERM` error, preserve successful gate evidence and report `BLOCKED`; do not escalate
automatically. If the API build exposes pre-existing research errors, document them and stop;
do not repair frozen research code.

## 17. Verification result

- **Executed:** once, on 2026-11-26 (Europe/Vilnius), after all substantive implementation
  changes, in standard `workspace-write`.
- **Exit code:** `1`.
- **Final line:** `PASS: SDR-005 verification` was **not** printed.

### Stage results

| Stage | Result | Observed output |
| --- | --- | --- |
| `npm.cmd run db:generate` | PASS | `✔ Generated Prisma Client (7.10.1) to .\src\generated\prisma in 171ms` |
| `npm.cmd run build -w @sdr-assistant/api` | PASS | second generation `in 128ms`; `tsc -p tsconfig.json` completed with exit 0 and no diagnostics |
| `npm.cmd run test -w @sdr-assistant/api -- test/email-accounts.test.ts test/email-account-connections.test.ts` | PASS | `test/email-accounts.test.ts (23 tests) 32ms`; `test/email-account-connections.test.ts (46 tests) 120ms`; `Test Files 2 passed (2)`; `Tests 69 passed (69)`; `Duration 1.02s` |
| `npm.cmd run verify:web` | PASS | typegen `✓ Types generated successfully`; ESLint no findings; `Test Files 12 passed (12)`; `Tests 95 passed (95)`; `All matched files use Prettier code style!` |
| `npm.cmd run e2e:web` | **FAIL** | `Error: spawn EPERM`; npm reported `code 1` from `playwright test` in `apps/web`; the compound script then threw `Frontend E2E verification failed`. |

The E2E output contained only the npm banners for `npm run e2e --workspace
@sdr-assistant/web` / `playwright test`, then `Error: spawn EPERM`. Playwright never listed
or executed a test.

Expected, safe log lines appeared during the backend tests (deliberate negative tests, no
credential or key material): missing encryption key from `EmailAccountsService`, and
`credential decryption is unavailable` from `EmailConnectionVerificationService`; the SMTP
failure-mapping tests also logged their safe failure codes.

### What the passing gates establish

- The additive Prisma schema is valid and generates a client containing
  `EmailVerificationStatus` and the six new `EmailAccount` columns.
- `tsc` compiles the API, including the new destination guard, adapters, verification
  service and endpoints.
- The 23 preserved SDR-004 backend tests and the 46 new focused connection tests pass.
  Together they cover TLS/STARTTLS options, certificate and host-name validation, successful
  SMTP and IMAP verification, independent failures, bounded timeouts and cleanup, safe error
  mapping, credential isolation and non-leakage, disabled-account rejection, unsafe and
  malformed destinations, independent persistence, invalidation, empty-password
  preservation, stale-result rejection and duplicate prevention. All DNS, protocol and
  network behavior in these tests is mocked.
- `verify:web` passes: Next type generation, TypeScript, ESLint (`--max-warnings=0`), 95 web
  unit tests (15 entity-schema tests and 14 account-form tests among them) and Prettier.

### What remains unverified

- All Playwright scenarios, including every SDR-005 rendered scenario and the preserved
  SDR-004 rendered behavior: the gate did not start.
- Database-backed behavior (the migration has not been applied) and any real SMTP/IMAP
  provider connection (neither is authorized).

### Blocker

- The observed failure is Playwright's `Error: spawn EPERM` before any test ran. Playwright
  forks its worker with an `ipc` channel and starts `webServer` entries with piped stdio;
  the authorized `workspace-write` sandbox denies that boundary, exactly as already recorded
  for the SDR-004 E2E gate in [environment.md](../system/environment.md) §3.
- Per §16 the proof was not weakened, no equivalent command was retried, and no sandbox
  escalation was requested. Successful gate evidence above is preserved.

## 18. Remaining blockers or limitations

- **E2E verification blocker:** the mandatory `npm run e2e:web` gate needs an environment in
  which Playwright can fork its worker and start its web servers. This is outside
  `workspace-write`. Completion requires the owner to run the exact proof in such an
  environment or to authorize a separate environment exception for this gate. The proof
  must not be weakened or substituted.
- **Migration not applied:** `20261126120000_add_email_account_verification` is created but
  deliberately not applied. No database connection was made by this task.
- **Real-provider acceptance pending:** no real SMTP or IMAP server was contacted. The
  owner's email account is not known to work, and SMTP verification cannot establish sender
  authorization or deliverability even after it is run.
- **Single-process duplicate guard:** overlapping verification is prevented in one API
  process. The trusted local deployment runs one API process; a multi-instance deployment
  would need a database-backed lock.
- **No application authentication:** the verification endpoints are safe only inside the
  trusted local deployment and must not be exposed to public or untrusted networks.
- **Playwright scenarios authored but unexecuted:** the mock-API state and rendered
  scenarios for SDR-005 exist in the working tree but could not be proven by this task.
- **No background/scheduled verification:** by design; every test is an explicit user
  request.

## 19. Installed dependencies

| Package | Installed version | Notes |
| --- | --- | --- |
| `nodemailer` | `10.6.1` | SMTP verification via `verify()`; ships its own TypeScript declarations, so no `@types/nodemailer` is installed (its README says the legacy types conflict). |
| `imapflow` | `2.12.2` | IMAP verification via `verifyOnly`; ships its own declarations. |

- Installed with npm, not pnpm: `npm install nodemailer@10.6.1 imapflow@2.12.2 -w
  @sdr-assistant/api`, with a workspace-local npm cache because the default cache is outside
  the sandbox. No unrelated dependency was upgraded and no audit fix was run.
- Manifest and lockfile changes are limited to `apps/api/package.json` and the corresponding
  `package-lock.json` entries: `package-lock.json` gains 152 lines (the two packages and
  their transitive dependencies, plus the `devOptional` → runtime flag on `iconv-lite` and
  `safer-buffer`). `eslint`, `next`, `vitest` and other existing versions are unchanged.

## 20. Connection verification architecture

Backend, inside `apps/api/src/modules/email-accounts/`:

- `email-connection.constants.ts` — protocols, allowed ports, verification statuses, safe
  failure codes, timeout budgets and the verification target type.
- `email-connection.tokens.ts` — Nest injection tokens for the resolver and the two
  protocol adapters.
- `mail-destination.ts` — hostname normalization, a `BlockList` of non-public IPv4/IPv6
  ranges, a global-unicast IPv6 requirement, one bounded DNS lookup and a resolved
  destination (configured host + validated IP).
- `smtp-connection-verifier.ts` — Nodemailer `verify()` adapter.
- `imap-connection-verifier.ts` — ImapFlow `verifyOnly` adapter.
- `email-connection-errors.ts` — overall timeout and the safe error-code classifier.
- `email-connection-verification.service.ts` — request orchestration, locking, per-protocol
  decryption, persistence and staleness protection.
- `email-accounts.mapper.ts` — explicit safe response mapping, now including verification
  metadata and never credential material.
- `email-accounts.service.ts` — configuration-change invalidation.

Request flow:

1. Reject an overlapping request for the same account + protocol (in-memory key
   `accountId:protocol`; different protocols are independent).
2. Load the saved row; missing → 404; disabled → 409. No request body is read.
3. Validate the saved port against the protocol allow-list; otherwise fail with
   `INVALID_CONFIGURATION` without decrypting or dialing.
4. Normalize the saved host and resolve it once with a 5 s budget. Every resolved address
   must be public. Return the configured host (TLS name) plus the validated IP (connect
   target); reject with `INVALID_CONFIGURATION`, `UNSAFE_DESTINATION`, `DNS_FAILURE` or
   `CONNECTION_TIMEOUT`.
5. Decrypt only the requested protocol's stored password after the destination passed.
   Missing key or corrupted payload → `CREDENTIAL_UNAVAILABLE`.
6. Call the protocol adapter with the validated IP, the configured hostname for TLS and the
   decrypted credential.
7. Map any failure to one safe code; persist `VERIFIED`/`FAILED` with `lastCheckedAt` and
   the failure code only if the row still matches the tested host, port, security, username
   and encrypted credential (conditional `updateMany`). Otherwise return
   `CONFIGURATION_CHANGED` and persist nothing.
8. Return the structured result plus the current safe account.

Protocol properties:

- **SMTP:** `verify()` only (never `sendMail`); `secure: true` for `TLS`; `requireTLS: true`
  for `STARTTLS`; `tls.rejectUnauthorized: true`; the TLS server name is always the
  configured host; `forceAuth: true` so a connection cannot verify without authentication;
  `connectionTimeout`, `greetingTimeout`, `socketTimeout` and an overall timeout; the socket
  is created by the adapter, passed to Nodemailer and destroyed in `finally`.
- **IMAP:** `verifyOnly: true` with `includeMailboxes: false` authenticates and logs out
  without opening, selecting, listing, searching, fetching or changing anything; `secure:
  true` for `TLS`; `doSTARTTLS: true` for `STARTTLS` (the library fails hard when the
  upgrade is unavailable instead of continuing in cleartext); `tls.rejectUnauthorized: true`;
  configured servername; `logger: false`, `logRaw: false`, `emitLogs: false`; bounded
  connection, greeting, socket and overall timeouts; the client is closed in `finally`.

## 21. API endpoint contracts

`POST /email-accounts/:id/test-smtp` and `POST /email-accounts/:id/test-imap`:

- Request: no body. The saved account configuration is the only input.
- `200` structured result:

```json
{
  "accountId": "cuid",
  "protocol": "SMTP",
  "result": "VERIFIED | FAILED | CONFIGURATION_CHANGED",
  "failureCode": "AUTHENTICATION_FAILED | CONNECTION_TIMEOUT | DNS_FAILURE | CONNECTION_REFUSED | TLS_FAILURE | INVALID_CONFIGURATION | UNSAFE_DESTINATION | CREDENTIAL_UNAVAILABLE | CONNECTION_FAILED | null",
  "lastCheckedAt": "ISO timestamp | null",
  "account": { "...safe email-account response..." }
}
```

- Expected connection, authentication, TLS, DNS and configuration failures are `200` with
  `result: "FAILED"` and a safe code, and are persisted as `FAILED`. Raw library errors,
  server responses and credentials never appear in the body.
- `404` when the account does not exist.
- `409` when the account is disabled ("Disabled email accounts cannot be tested.") or a
  verification for the same account and protocol is already running.
- `CONFIGURATION_CHANGED` is a safe, non-persisted outcome: the tested configuration no
  longer matches the stored one.

The account response gains six fields, independently per protocol:
`smtpVerificationStatus`, `smtpLastCheckedAt`, `smtpVerificationFailureCode`,
`imapVerificationStatus`, `imapLastCheckedAt`, `imapVerificationFailureCode`. It still
returns no password, ciphertext, IV or authentication tag.

## 22. Verification-result storage and invalidation

- Prisma enum `EmailVerificationStatus` (`NOT_TESTED`, `VERIFIED`, `FAILED`).
- Six additive `EmailAccount` columns, each protocol independent:
  `smtpVerificationStatus` / `imapVerificationStatus` (default `NOT_TESTED`),
  `smtpLastCheckedAt` / `imapLastCheckedAt` (nullable), and
  `smtpVerificationFailureCode` / `imapVerificationFailureCode` (nullable).
- One additive migration:
  `apps/api/prisma/migrations/20261126120000_add_email_account_verification/migration.sql`.
  It creates the enum and adds the six columns with defaults, references no research table
  and was not applied.
- A PATCH resets only the protocol whose host, port, security, username or password actually
  changed; unchanged submitted values do not reset anything. Name, sender, email address and
  enabled do not invalidate either result. An empty password field keeps the credential and
  both results.
- A result is written with a conditional `updateMany` whose condition is the tested
  protocol configuration and encrypted credential, so a change that lands during a test
  prevents the stale result from being stored.

## 23. Frontend changes

- Account list: both independent statuses ("SMTP · Verified", "IMAP · Failed", "Not tested"),
  last-checked timestamps, safe failure text, enabled/disabled status, and a **Test
  connections** button that runs both checks concurrently and is disabled for disabled
  accounts or while a test is running. One protocol failure never prevents the other check.
  Feedback uses the existing toast conventions: full success, partial success, failure,
  discarded configuration change, or request failure.
- Edit form: **Test SMTP connection** and **Test IMAP connection** buttons with the saved
  result of each protocol. Testing is disabled for a new account, a disabled account or
  unsaved changes, with the reason shown. After a test the current route is refreshed so the
  displayed result belongs to the tested saved configuration. Save and Cancel are unchanged.
- Form layout: General, then SMTP and IMAP cards side by side at ≥1024 px and stacked below;
  sender name and email address side by side at ≥640 px; port and security in a compact
  two-column row; Enabled checkbox beside its label. Existing components and tokens only.
- Username initialization: on creation only, typing the email address fills both usernames
  until each is manually edited; custom values are never overwritten and edit mode never
  rewrites usernames automatically.
- "Verified" (not "Connected") is used for a successful historical test. Successful
  verification never enables an account.

## 24. Tests added or updated

- `apps/api/test/email-account-connections.test.ts` (46 new tests): response metadata;
  invalidation per protocol including unchanged values and empty passwords; destination
  normalization, IPv4/IPv6 rejection, DNS failure/timeout, invalid hosts, port allow-list;
  SMTP TLS/STARTTLS options, forced authentication, cleanup and timeout; IMAP TLS/STARTTLS,
  verify-only behavior, cleanup and timeout; safe code classification; independent
  persistence; credential isolation; disabled/missing accounts; duplicate prevention;
  stale configuration and stale credential rejection; no credential leakage.
- `apps/api/test/email-accounts.test.ts` (23 preserved tests, updated only for the new
  response fields and fixture defaults).
- Web unit tests: entity schema tests for verification metadata and result parsing, failure
  descriptions and labels; form tests for username initialization/custom preservation, edit
  mode, disabled testing states, saved result display, individual SMTP test and alignment/
  layout class checks. Total web unit tests: 95 in 12 files.
- Playwright: preserved SDR-004 scenarios plus new mock-API behavior and rendered scenarios
  for initial `NOT_TESTED`, both verified, SMTP-only success, IMAP-only success, both
  failures, loading/duplicate prevention, disabled accounts, individual edit-form tests,
  save-before-testing, invalidation, username initialization and responsive layout. These
  were authored but could not be executed because of the E2E blocker.

## 25. Changed files

Modified (22):

- `README.md`
- `apps/api/package.json`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/email-accounts/email-accounts.controller.ts`
- `apps/api/src/modules/email-accounts/email-accounts.mapper.ts`
- `apps/api/src/modules/email-accounts/email-accounts.module.ts`
- `apps/api/src/modules/email-accounts/email-accounts.service.ts`
- `apps/api/test/email-accounts.test.ts`
- `apps/web/_pages/email-accounts/ui/email-accounts-page.tsx`
- `apps/web/e2e/email-accounts.spec.ts`
- `apps/web/e2e/mock-api.mjs`
- `apps/web/entities/email-account/api/email-accounts.server.ts`
- `apps/web/entities/email-account/client.ts`
- `apps/web/entities/email-account/index.ts`
- `apps/web/entities/email-account/model/schema.test.ts`
- `apps/web/entities/email-account/model/schema.ts`
- `apps/web/features/manage-email-account/api/action.ts`
- `apps/web/features/manage-email-account/index.ts`
- `apps/web/features/manage-email-account/ui/email-account-form.test.tsx`
- `apps/web/features/manage-email-account/ui/email-account-form.tsx`
- `docs/tasks/README.md`
- `package-lock.json`

New (13):

- `apps/api/prisma/migrations/20261126120000_add_email_account_verification/migration.sql`
- `apps/api/src/modules/email-accounts/email-connection.constants.ts`
- `apps/api/src/modules/email-accounts/email-connection.tokens.ts`
- `apps/api/src/modules/email-accounts/email-connection-errors.ts`
- `apps/api/src/modules/email-accounts/mail-destination.ts`
- `apps/api/src/modules/email-accounts/smtp-connection-verifier.ts`
- `apps/api/src/modules/email-accounts/imap-connection-verifier.ts`
- `apps/api/src/modules/email-accounts/email-connection-verification.service.ts`
- `apps/api/test/email-account-connections.test.ts`
- `apps/web/features/manage-email-account/model/connection-test-feedback.ts`
- `apps/web/features/manage-email-account/ui/email-account-verification-status.tsx`
- `apps/web/features/manage-email-account/ui/test-connections-button.tsx`
- `docs/tasks/SDR-005-email-connection-testing.md`

Generated, git-ignored, not part of Git: `apps/api/src/generated/prisma` (regenerated by
the proof), `apps/api/dist` (API build) and `apps/web/.next` / `next-env.d.ts` (verify:web).

All 21 pre-existing excluded untracked research/tooling files are unchanged and still
present.

## 26. Deployment and real-provider acceptance instructions

Real-provider acceptance is a separate owner-authorized step. It was not performed, and the
owner's account is not known to work. Suggested sequence after authorization:

1. Review the additive migration
   `apps/api/prisma/migrations/20261126120000_add_email_account_verification/migration.sql`:
   one enum + six columns, no research object. Verify that the deployment target is the
   intended local PostgreSQL database and that a protected backup exists.
2. Apply exactly that migration (for example `prisma migrate deploy` from `apps/api`) only
   when authorized. Do not use `db push`, `migrate dev`, `reset` or `resolve`. Confirm
   `_prisma_migrations` records it and no research row or table changed.
3. Ensure `EMAIL_ACCOUNT_ENCRYPTION_KEY` is configured in `apps/api/.env` and restart the
   API so the process reads it.
4. Confirm the deployment is reachable only from the trusted local environment. The
   application has no end-user authentication; do not expose it publicly.
5. Create or open a synthetic account and save host, port, security, username and password.
   For a first check use a real provider only with owner-provided credentials and a mailbox
   dedicated to acceptance.
6. Run **Test SMTP connection** and **Test IMAP connection**. A success means the server was
   reached, TLS was negotiated and authentication succeeded. Expect `Verified` plus a
   timestamp. A wrong password should produce `Failed` with `Authentication failed`; a
   closed port should produce `Connection refused` or `Connection timed out`; an
   unreachable name `DNS failure`; a bad certificate `TLS failure`.
7. Confirm that no message was sent and no mailbox was opened or changed. Verification uses
   Nodemailer `verify()` only and ImapFlow `verifyOnly` without mailbox listing.
8. Confirm the behavior of a configuration change: edit only the SMTP host, save, and verify
   SMTP becomes `Not tested` while the IMAP result is preserved; repeat for IMAP.
9. Confirm disabled accounts cannot be tested and no successful test enables an account.
10. Only then treat the account as verified. SMTP verification does not establish
    sender-address authorization or deliverability.

Rollback: the migration is additive. Dropping only `email_accounts`, the
`EmailVerificationStatus` enum and its columns, or restoring the protected backup, leaves
research data untouched. Prisma has no down migration; rollback is a manual owner action.

## 27. Scope compliance

- Research Implementation Freeze respected: no file under
  `apps/api/src/modules/research` and no research test, fixture, prompt, schema, provider
  configuration or behavior was changed; the 21 pre-existing excluded untracked files are
  untouched.
- Only the authorized paths were modified or created (see §25); no unrelated refactoring.
- The migration was not applied; no database connection and no real SMTP/IMAP connection was
  made; no `.env` value was changed.
- No package outside the two approved libraries (and the lockfile entries they require) was
  added or upgraded; no audit fix was run.
- No sandbox permission, environment configuration or process was changed; no privilege
  escalation was used.
- No staging, commit or push; SDR-006 was not started.
- SDR-005 is not `DONE`.

## 28. Resumed E2E verification (human-authorized Full Access, 2026-11-26)

### 28.1 Authorization and scope

- The human owner authorized completing the remaining mandatory Playwright E2E gate using
  **Full Access exclusively for this verification operation**. The session file policy was
  `danger-full-access` and approval prompts were disabled.
- The authorization granted no permission to modify application code, tests, Playwright
  configuration, dependencies, migrations, `.env`, database state or research artifacts, and
  none was modified. It also did not authorize a fix if a test failed.
- §17 and §18 are preserved unchanged as the earlier `workspace-write` evidence. This section
  supersedes only their "E2E not executed / `spawn EPERM`" state.

### 28.2 Preconditions checked before the run

| Check | Observation |
| --- | --- |
| Git HEAD | `35ac8ca8d825738b24758ed52033709efbfb276d`, unchanged |
| Working tree | The same 22 modified + 13 new SDR-005 paths plus the 21 pre-existing excluded untracked artifacts (56 paths total); unchanged after the run |
| Implementation file times | Every substantive implementation/test/config file has a last-write time at or before `2026-11-26 11:52:09`, before the original proof started at `11:53:09`. Only documentation changed after the original proof |
| Playwright configuration | `apps/web/playwright.config.ts` unmodified (last write `2026-11-14 21:23:51`); `git diff` empty |
| E2E target | Mock API on `127.0.0.1:4100`; Next dev on `localhost:3100` with `API_URL=http://127.0.0.1:4100` and `NEXT_DIST_DIR=.next-e2e` |
| Mock API nature | `apps/web/e2e/mock-api.mjs` imports only `node:http` and listens on `127.0.0.1`; no Prisma, PostgreSQL, real API or mail-provider access |
| Ports 3100/4100 | Free before the run |
| Excluded artifacts | 21/21 present |
| Playwright browsers | Installed Chromium build `chromium-1255` |

### 28.3 Command, output and exit code

Command, executed once from the repository root:

```powershell
npm.cmd run e2e:web
```

- **Exit code:** `1`.
- **Duration:** `2.2m`.
- **Executed:** 28 tests with 1 worker (chromium project).
- **Passed:** 24. **Failed:** 4. **Skipped:** 0. **Retried/flaky:** 0.

Test-result summary from the actual output:

```text
Running 28 tests using 1 worker

  ok  1-11   app.spec.ts (all preserved SDR-004 app scenarios)
  ok  12-17  email-accounts.spec.ts (empty list, create, validation, edit,
             disable/enable, API failure)
  ok  18     shows Not tested states for a fresh account
  x   19     tests both connections and reports a full success
  x   20     keeps independent results when SMTP succeeds and IMAP fails
  x   21     keeps independent results when SMTP fails and IMAP succeeds
  x   22     reports a failure when both protocols fail
  ok  23     does not test a disabled account
  ok  24     tests each protocol from the edit form
  ok  25     requires saving before a new or modified account can be tested
  ok  26     invalidates only the verification of the changed protocol
  ok  27     initializes usernames from the email address without overwriting custom values
  ok  28     lays the form out in two columns on wide screens and stacks it on narrow screens

  4 failed
    [chromium] › e2e\email-accounts.spec.ts:256:1 › tests both connections and reports a full success
    [chromium] › e2e\email-accounts.spec.ts:288:1 › keeps independent results when SMTP succeeds and IMAP fails
    [chromium] › e2e\email-accounts.spec.ts:311:1 › keeps independent results when SMTP fails and IMAP succeeds
    [chromium] › e2e\email-accounts.spec.ts:331:1 › reports a failure when both protocols fail
  24 passed (2.2m)
```

Stderr contained only npm banners and Node `NO_COLOR`/`FORCE_COLOR` warnings from the harness
web servers; there was no infrastructure or dependency error, and Playwright executed every
test.

### 28.4 SDR-005 email-account verification scenarios

| # | Scenario | Result |
| --- | --- | --- |
| 18 | Initial independent `Not tested` states and an enabled combined action | PASS |
| 19 | Both connections verified; loading state; duplicate-action prevention; persistence after reload | **FAIL** |
| 20 | SMTP verified with IMAP failed; safe failure text | **FAIL** |
| 21 | SMTP failed with IMAP verified | **FAIL** |
| 22 | Both protocols failed | **FAIL** |
| 23 | Disabled account: combined action disabled, statuses remain `Not tested` | PASS |
| 24 | Individual SMTP and IMAP tests on the edit form | PASS |
| 25 | Unsaved new/modified account cannot be tested; saving enables testing | PASS |
| 26 | Only the changed protocol's result is invalidated | PASS |
| 27 | Username initialization from email; custom value preserved | PASS |
| 28 | Two-column wide / stacked narrow form layout, checkbox and field alignment | PASS |

### 28.5 Preserved SDR-004 scenarios

All preserved rendered scenarios passed, unchanged:

| # | Scenario | Result |
| --- | --- | --- |
| 12 | Empty email-account list inside Settings | PASS |
| 13 | Create with independent SMTP/IMAP settings | PASS |
| 14 | Client-side form validation before the API call | PASS |
| 15 | Edit with empty password fields | PASS |
| 16 | Disable and enable from the list | PASS |
| 17 | API failure feedback and stay on the form | PASS |
| 1–11 | App shell, products, settings, research tabs/history/start, completed run, failed run, stopped poller, 404, theme, copy result, back-to-top | PASS |

### 28.6 Failure evidence

All four failures are the account-list **combined Test connections** scenarios and failed at
their first status assertion after the action completed:

| Test | Assertion | Locator | Timeout |
| --- | --- | --- | --- |
| 19 `tests both connections…` | `toBeVisible` at `email-accounts.spec.ts:274` | `locator('.product-item').first().getByText(/SMTP · Verified/)` | 15000 ms, element not found |
| 20 `SMTP succeeds / IMAP fails` | `toBeVisible` at `:299` | same, `/SMTP · Verified/` | 15000 ms, element not found |
| 21 `SMTP fails / IMAP succeeds` | `toBeVisible` at `:322` | `/SMTP · Failed/` | 15000 ms, element not found |
| 22 `both protocols fail` | `toBeVisible` at `:345` | `/SMTP · Failed/` | 15000 ms, element not found |

The Playwright error snapshot for test 19 shows the list row still rendering:

```text
SMTP · Not tested   Not checked yet.
IMAP · Verified     Last checked 2026-11-26 12:10
```

The action did run (the loading-state assertions before the timeout passed), but the combined
result left only one protocol updated in the rendered list.

Trace and error-context files are under the git-ignored
`apps/web/test-results/email-accounts-*` directories (four failures).

### 28.7 Confirmed observation and untested hypothesis

- **Confirmed:** the combined action issues the two protocol requests concurrently
  (`Promise.all` in `testAllEmailAccountConnectionsAction`), and the E2E mock handler reads
  the account snapshot *before* its 600 ms delay and writes a whole object afterwards, so two
  concurrent handlers can overwrite each other's protocol update. The failure snapshot shows
  exactly one protocol updated. All four failing scenarios use the combined concurrent
  action; every sequential/individual scenario passed.
- **Hypothesis, not established:** the four failures come from that lost-update behavior in
  the E2E mock harness rather than from the application verification path. This was not
  confirmed against a real API/database because doing so would exceed this verification-only
  authorization. No fix was attempted.

### 28.8 Process cleanup and preservation

- Ports 3100 and 4100 were free after the run; no mock-API or Next `--port 3100` process
  remained.
- No running browser binary under `ms-playwright` remained.
- The owner's existing dev servers on ports 3000/4000 and unrelated Chrome processes were not
  stopped or modified.
- Only git-ignored Playwright traces/error contexts remain under `apps/web/test-results/`.
- No application, test, Playwright configuration, dependency, migration, `.env`, database or
  research file was modified by this verification. Git status remains the same 56-path
  working tree, and all 21 excluded artifacts remain present.

### 28.9 Updated status

- The mandatory E2E gate has now executed, but it has **4 failing tests**; therefore the
  acceptance criterion "Mandatory automated verification passes" is not satisfied.
- Status remains **BLOCKED**, not `DONE`. SDR-006 was not started. A future fix to the E2E
  mock/test race (or of any confirmed application defect) requires separate authorization and
  a fresh full proof; this verification-only task did not change anything.

## 29. Concurrent verification lost-update: root cause, correction and passing proof (2026-11-26)

### 29.1 Authorization and scope

- The human owner authorized a focused root-cause inspection and, **if and only if** the
  failure originated exclusively in the mock API, a correction limited to
  `apps/web/e2e/mock-api.mjs`, followed by one full Playwright run under Full Access.
- No production code change was authorized unless a production defect was reported `BLOCKED`
  first. No such production defect was found, so no production file was touched.
- No assertion, timeout, scenario, Playwright configuration, dependency, migration,
  `.env`, database or research file was changed.

### 29.2 Confirmed root cause (mock API)

Confirmed by code inspection and by the §28 failure snapshot: the mock's connection-test
handler captured the account **before** the artificial delay and later replaced the complete
account object with that stale snapshot.

Pre-correction handler behavior:

```js
const found = emailAccounts.get(id);          // snapshot before the delay
// ... disabled check ...
await delay(CONNECTION_TEST_DELAY_MS);        // 600 ms
const outcome = connectionOutcome(found, protocol);
const updated = {
  ...found,                                   // stale full account
  [`${prefix}VerificationStatus`]: outcome.status,
  [`${prefix}LastCheckedAt`]: now,
  [`${prefix}VerificationFailureCode`]: outcome.failureCode,
  updatedAt: now,
};
emailAccounts.set(id, updated);               // replaces the whole account
```

The combined action issues the SMTP and IMAP requests concurrently. Both handlers read the
same pre-delay snapshot, then each writes a full object containing only its own protocol's
new result; the last write wins. This exactly matches the observed failure state (SMTP
`NOT_TESTED`, IMAP `VERIFIED`) and explains why every combined-action scenario failed while
every sequential/individual scenario passed.

### 29.3 Production backend review — not vulnerable to the same lost update

Inspected `apps/api/src/modules/email-accounts/email-connection-verification.service.ts`,
`email-accounts.service.ts` and the Prisma schema:

- `persistenceData(protocol, …)` returns **only** that protocol's three verification fields
  (`smtpVerificationStatus` / `smtpLastCheckedAt` / `smtpVerificationFailureCode` or the IMAP
  equivalents). No read-modify-write of the whole account occurs.
- Persistence is a single conditional `updateMany` whose `where` contains the account id plus
  the tested host, port, security, username and encrypted password for that protocol. Prisma
  executes this as one atomic SQL `UPDATE … WHERE`; a concurrent configuration change makes
  `count` zero and the service returns `CONFIGURATION_CHANGED` without persisting.
- SMTP and IMAP updates target different columns and different `where` fields, so concurrent
  protocol tests cannot overwrite each other; both persist. The same atomic condition still
  protects against stale configuration results.
- `EmailAccountsService.update` invalidation also writes only the affected protocol's reset
  fields (plus the changed metadata fields), not a whole-account snapshot.
- Conclusion: the production persistence path does **not** contain the mock's lost-update
  defect and required no change.

### 29.4 Frontend review — no response-ordering overwrite

- `testAllEmailAccountConnectionsAction` awaits both independent protocol requests with
  `Promise.all`, then revalidates the accounts path once; it returns the two outcomes, not
  account snapshots used as state.
- The list page is server-rendered and re-fetches the full account list after invalidation;
  it never applies the response account of one protocol over the other.
- The edit form only invokes single-protocol actions and refreshes the route; the combined
  action is used only by the account list.
- Conclusion: the frontend does not introduce a similar response-ordering risk; no change was
  needed.

### 29.5 Authorized correction (mock only)

`apps/web/e2e/mock-api.mjs` connection-test handler now, after the delay:

1. Re-reads the current account from `emailAccounts`;
2. Computes the deterministic outcome from the current saved configuration;
3. Merges only the requested protocol's verification status, timestamp and failure code onto
   the current account, then writes it.

The 600 ms artificial delay, the deterministic failure simulation, the disabled-account
rejection and the independent/concurrent request behavior are preserved. No serialization,
assertion weakening, timeout increase or scenario skip was introduced.

**Exact modified path in this step:** `apps/web/e2e/mock-api.mjs` only.

### 29.6 Single authorized proof — executed once

Command from the repository root, under the authorization for this E2E execution:

```powershell
npm.cmd run e2e:web
```

- **Exit code:** `0`.
- **Executed:** 28 tests using 1 worker (chromium).
- **Passed:** 28. **Failed:** 0. **Skipped:** 0. **Retried/flaky:** 0.
- **Duration:** `58.8s`.

Output summary:

```text
Running 28 tests using 1 worker

  ok  1  renders the shell, navigation and theme switch (879ms)
  ok  2  lists products and marks the section (903ms)
  ok  3  validates and saves research settings rendered from API metadata (2.0s)
  ok  4  shows product tabs, history and the start form (1.8s)
  ok  5  runs a research to completion and renders the result (5.0s)
  ok  6  renders a failed run with its error and recovery (1.2s)
  ok  7  announces a stopped poller with a toast when the job disappears (801ms)
  ok  8  renders the app 404 page (706ms)
  ok  9  switches theme and persists it (891ms)
  ok 10  copies a completed result and confirms with a toast (1.1s)
  ok 11  shows back-to-top only on an overflowing page (1.6s)
  ok 12  shows the empty email-account list inside Settings (836ms)
  ok 13  creates an account with independent SMTP and IMAP settings (2.1s)
  ok 14  validates the account form before calling the API (961ms)
  ok 15  edits an account and leaves password fields empty (1.9s)
  ok 16  disables and enables an account from the list (925ms)
  ok 17  shows API failure feedback and stays on the form (2.5s)
  ok 18  shows Not tested states for a fresh account (554ms)
  ok 19  tests both connections and reports a full success (1.8s)
  ok 20  keeps independent results when SMTP succeeds and IMAP fails (1.5s)
  ok 21  keeps independent results when SMTP fails and IMAP succeeds (1.5s)
  ok 22  reports a failure when both protocols fail (1.5s)
  ok 23  does not test a disabled account (538ms)
  ok 24  tests each protocol from the edit form (2.9s)
  ok 25  requires saving before a new or modified account can be tested (2.2s)
  ok 26  invalidates only the verification of the changed protocol (2.6s)
  ok 27  initializes usernames from the email address without overwriting custom values (826ms)
  ok 28  lays the form out in two columns on wide screens and stacks it on narrow screens (1.0s)

  28 passed (58.8s)
```

All four previously failing combined-action scenarios (`tests both connections`, `SMTP
succeeds / IMAP fails`, `SMTP fails / IMAP succeeds`, `both protocols fail`) now pass with
their original assertions, and all 17 preserved SDR-004 scenarios still pass.

### 29.7 Preservation, cleanup and updated evidence

- Only the mock file changed in this step. Production implementation, tests, assertions,
  Playwright configuration, dependencies, lockfile, migrations, `.env`, database and research
  files are unchanged. The working tree remains 56 paths with all 21 excluded artifacts.
- Previous evidence remains valid as stated by the task: Prisma generation, API build, 69
  backend tests, 95 web unit tests, typecheck, ESLint and Prettier were not rerun and are not
  invalidated by a mock-only change.
- Ports 3100/4100 were free after the run; no Playwright browser, mock-API or Next `--port
  3100` process remained. Unrelated owner processes were not targeted or stopped.
- The earlier 24/28 evidence and this passing 28/28 evidence are both preserved (§28 and
  §29).

### 29.8 Updated status

- Every mandatory automated gate now passes. SDR-005 is **READY_FOR_HUMAN_REVIEW**, not
  `DONE`.
- Remaining deployment requirements: apply the additive verification migration after backup
  and approval, then perform separately authorized real-provider acceptance. No real database
  or SMTP/IMAP connection was made; the owner's real account remains unverified.
- SDR-006 was not started; no staging, commit or push was performed.

## 30. Focused mail-adapter security review (read-only, 2026-11-26)

### 30.1 Scope and method

- The owner authorized read-only inspection of the **installed** Nodemailer and ImapFlow
  implementations and the application integration. No application code, test, configuration,
  dependency, migration, `.env`, database or mail server was touched or contacted; no
  automated test was rerun.
- Installed versions: `nodemailer 10.6.1` and `imapflow 2.12.2` (`package-lock.json:7259-7261`
  and `:8813-8815`).
- Source references below use repository-relative paths under `node_modules/`.

### 30.2 Nodemailer 10.6.1 — confirmed findings

**Unconnected socket option.** The option is documented as "Existing socket to use instead of
creating a new one, not connected yet"
(`node_modules/nodemailer/dist/esm/smtp-connection/index.d.ts:61-62`). Its implementation sets
the caller socket as the connection socket, resolves the IP and calls
`this._socket.connect(this.port, this.host, …)`
(`node_modules/nodemailer/dist/cjs/smtp-connection/index.js:287-316`). For implicit TLS the
same branch runs `_upgradeConnection` before `_onConnect` (`:299-306`); for STARTTLS the
plaintext connection later upgrades in `_actionSTARTTLS`/`_upgradeConnection` (`:1643-1665`,
`:1090-1166`). The transport constructor copies caller options through `shared.assign`
(`node_modules/nodemailer/dist/cjs/smtp-transport/index.js:78-82`), which preserves the socket
object by reference (`node_modules/nodemailer/dist/cjs/shared/index.js:598-616`).

**Destination is the supplied validated IP.** The adapter passes `host: target.address` and
the socket; the connection's `this.host` is that value
(`node_modules/nodemailer/dist/cjs/smtp-connection/index.js:175-177`), the socket connects to
it (`:295`), and `shared.resolveHostname` short-circuits for an IP literal without any DNS
lookup (`node_modules/nodemailer/dist/cjs/shared/index.js:138-152`). No second unchecked DNS
lookup occurs.

**TLS identity is checked against the configured hostname.** The adapter supplies both
`servername: target.host` and `tls: { rejectUnauthorized: true, servername: target.host }`
(`apps/api/src/modules/email-accounts/smtp-connection-verifier.ts:62-85`). `_upgradeConnection`
merges the TLS options and the SNI name and calls `tls.connect` with them
(`node_modules/nodemailer/dist/cjs/smtp-connection/index.js:1119-1126`, `:1145`); the implicit
TLS path reuses the same upgrade helper (`:299-306`). `smtp-connection` also resolves its SNI
name from the explicit `servername` option rather than the IP (`:177`). Node's documented
`tls.connect` behaviour verifies the peer certificate against `servername` when
`rejectUnauthorized` is true; this is documented Node behaviour plus inspected wiring, not a
runtime certificate test.

**`forceAuth` and `verify()` require successful authentication.** `verify()` creates the
connection, then:
- obtains the transport auth with `this.getAuth({})`;
- calls `connection.login(...)` whenever auth exists and either the server advertises AUTH or
  `options.forceAuth` is true;
- calls `finalize()` only after a successful login callback; login failure closes the
  connection and rejects.

See `node_modules/nodemailer/dist/cjs/smtp-transport/index.js:349-371`. `login()` selects the
first supported method or falls back to `PLAIN`, rejects missing credentials with `EAUTH`, and
only sets `authenticated` after a 2xx reply; a non-2xx reply is `EAUTH`
(`node_modules/nodemailer/dist/cjs/smtp-connection/index.js:541-598`, `:1806-1822`). The
adapter always supplies non-empty auth, so the earlier `!perCallAuth` branch is not reachable
for this feature.

**Timeouts and cleanup.** `connectionTimeout` bounds DNS + connect
(`node_modules/nodemailer/dist/cjs/smtp-connection/index.js:256-264`), a phase timer reports
`ETIMEDOUT` with a `timeoutType` (`:68-71`, `:433-439`, `:843`), the socket inactivity timeout
is armed at `:829-830`/`:1162-1163`, and every timeout/error path calls `connection.close()`
(`:940-960`; `smtp-transport/index.js:323-330`, `:353-368`). The adapter's own overall timeout
wraps `verify()` and its `finally` destroys the caller-owned socket and calls
`transporter.close()` (`apps/api/src/modules/email-accounts/smtp-connection-verifier.ts:57-95`).

Important ownership detail: `SMTPTransport.close()` only removes OAuth listeners and emits
`close`; it does **not** close an active connection
(`node_modules/nodemailer/dist/cjs/smtp-transport/index.js:391-396`). The cleanup guarantee is
therefore the adapter-owned `net.Socket` destruction, which runs on success, failure and
overall timeout. `net.Socket.destroy()` force-closes the transport (documented Node
behaviour); the TLS/STARTTLS wrapper uses that socket as its underlying transport. No active
verification socket can be left behind by this code path. A verification success resolves
before `QUIT` drains, and the adapter then destroys the socket, so the QUIT may be cut short;
that is harmless for a test-only connection. No runtime socket-teardown test was performed
under this read-only authorization.

### 30.3 ImapFlow 2.12.2 — confirmed findings

**Destination is the supplied validated IP.** The host is stored verbatim
(`node_modules/imapflow/dist/cjs/imap-flow.js:252`); `connect()` builds `{host: this.host,
port: this.port}` and uses `net.connect`/`tls.connect` (default `connector`) at `:2333-2337`
and `:2483`. An IP literal is not re-resolved. The custom-transport path also passes
`this.host` (`transportOptions()` at `:2143-2144`).

**TLS identity uses the configured hostname.** `servername` comes from the configured option
(`:253`); `tlsServername()` supplies it (`:2139-2140`); direct TLS includes it in the
`tls.connect` options (`:2334-2337`, `:2483`), and STARTTLS does the same
(`:1669-1678`, `:1790-1792`). The adapter passes `rejectUnauthorized: true` and
`servername: target.host` (`apps/api/src/modules/email-accounts/imap-connection-verifier.ts:43-68`).
Certificate verification against the configured hostname is therefore wired; actual failure
behaviour is Node TLS behaviour, not runtime-tested here.

**`doSTARTTLS: true` prevents plaintext authentication.** `startSession()` performs
CAPABILITY, the STARTTLS upgrade, then ID/authentication
(`node_modules/imapflow/dist/cjs/imap-flow.js:1388-1398`). When STARTTLS is unavailable,
`_failSTARTTLS` throws because `doSTARTTLS === true` (`:1583-1589`, `:1625-1626`); the adapter
sets exactly that flag for STARTTLS (`imap-connection-verifier.ts:46-47`). Authentication is
only reached after the upgrade.

**`verifyOnly` + `includeMailboxes: false` performs no mailbox selection or listing.** In the
verify-only path, ImapFlow runs CAPABILITY, optional ID, authentication, NAMESPACE, then
optionally `list()` **only** when `includeMailboxes` is true, and finally logs out
(`node_modules/imapflow/dist/cjs/imap-flow.js:1388-1424`). The adapter sets
`verifyOnly: true` and `includeMailboxes: false` (`imap-connection-verifier.ts:57-63`). No
SELECT/EXAMINE, message fetch, flag change, move/delete or synchronization operation occurs in
that path.

**PREAUTH is a confirmed credential-verification gap under implicit TLS.** On a `* PREAUTH`
greeting, `initialPREAUTH()` sets `state = AUTHENTICATED` and `authenticated = true` without
setting `greeting` (`node_modules/imapflow/dist/cjs/imap-flow.js:1929-1937`). `authenticate()`
then returns early for any non-`NOT_AUTHENTICATED` state (`:1834-1841`), so
`connect()` succeeds without using the configured username or password. Under STARTTLS the
same PREAUTH greeting is rejected by `upgradeToSTARTTLS()` because the state is no longer
`NOT_AUTHENTICATED`, and `doSTARTTLS: true` turns that into a hard TLS failure (`:1618-1623`,
`:1583-1589`). The gap therefore applies to `TLS` (implicit TLS) verification, not to
`STARTTLS`.

**`close()` reliably terminates the in-progress connection in the default path.** `close()`
synchronously calls `closeConnection()` (`:2568-2575`). That clears the connection/greeting
timers (`:2659-2666`), settles an in-flight STARTTLS upgrade (`:2684-2691`), rejects the
pending `connect()` promise (`:2696-2713`) and destroys the socket (`:2848-2855`). For the
default no-proxy path, `this.socket` is assigned synchronously when `connector.connect()` is
called (`:2483`) and `initialReject` is already set (`:2390`); an adapter overall timeout that
calls `close()` therefore has a socket to destroy. The pending `connect()` rejection is
observed by `withConnectionTimeout`. Runtime teardown itself is Node TLS/socket behaviour and
was not exercised against a server here.

### 30.4 Application integration — confirmed

- **NestJS wiring is correct.** `EmailAccountsModule` registers `EmailAccountsService` and
  `EmailConnectionVerificationService` and binds the three string tokens via `useFactory` to
  the real resolver/adapters (`apps/api/src/modules/email-accounts/email-accounts.module.ts:15-33`);
  the tokens match the service's `@Inject` names, and `PrismaService` is provided by the
  `@Global()` Prisma module (`apps/api/src/modules/prisma/prisma.module.ts:1-10`). The
  controller injects both services (`email-accounts.controller.ts:15-20`). This is static
  inspection; no API process was started.
- **The conditional update cannot overwrite the other protocol's result.**
  `persistenceData()` emits only the requested protocol's three fields
  (`apps/api/src/modules/email-accounts/email-connection-verification.service.ts:94-123`), and
  the write is one conditional `updateMany` whose `where` contains only the account id and the
  tested protocol configuration/credential (`:289-313`). A concurrent SMTP update touches
  `smtp*` columns; an IMAP update touches `imap*` columns. A configuration or credential change
  makes the update count zero, returning `CONFIGURATION_CHANGED` without persistence. The
  `findRow()` after the write is read-only and does not overwrite.
- **Disabled while verification is running.** The `enabled` check happens once, before the
  test (`:166-173`). The conditional `where` does not include `enabled`, so if the account is
  disabled during the in-flight test, the verification result is still persisted; the account
  stays disabled and nothing re-enables it. This is a confirmed race/policy gap if "disabled
  accounts must not be tested" is intended to cancel an in-flight test; it is not a path to
  enable an account.
- **Error mapping against the installed shapes.** The mapper
  (`apps/api/src/modules/email-accounts/email-connection-errors.ts:148-197`) matches:
  - Nodemailer `EAUTH`/`ENOAUTH` and SMTP 454/530/534/535/538 → `AUTHENTICATION_FAILED`;
  - Nodemailer `ETIMEDOUT` plus `timeoutType` (set by `timeoutError`,
    `smtp-connection/index.js:68-71`) and ImapFlow `CONNECT_TIMEOUT`/`GREETING_TIMEOUT`/
    `UPGRADE_TIMEOUT`/`ETIMEOUT` (`imapflow/errors.js:13-24`) → `CONNECTION_TIMEOUT`;
  - Nodemailer `EDNS` and Node DNS codes → `DNS_FAILURE`;
  - Nodemailer `ESOCKET` with `originalCode: ECONNREFUSED` (preserved by
    `_formatError`, `smtp-connection/index.js:966-994`) and ImapFlow Node
    `ECONNREFUSED` → `CONNECTION_REFUSED`;
  - Nodemailer `ETLS` and ImapFlow `tlsFailed` (set at
    `imapflow/imap-flow.js:1710-1716`), plus common Node certificate codes →
    `TLS_FAILURE`;
  - ImapFlow `AuthenticationFailure` sets `authenticationFailed: true`
    (`imapflow/errors.js:78-83`) → `AUTHENTICATION_FAILED`.
  - **Gap:** the fixed TLS code set does not include every standard OpenSSL certificate
    verification code (for example `UNABLE_TO_GET_CRL`,
    `UNABLE_TO_DECRYPT_CERT_SIGNATURE`, `UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY`,
    `CRL_NOT_YET_VALID`, `ERROR_IN_CERT_NOT_AFTER_FIELD`, `INVALID_CA`,
    `PATH_LENGTH_EXCEEDED`, `INVALID_PURPOSE`; `HOSTNAME_MISMATCH` if emitted). Those failures
    would be reported as generic `CONNECTION_FAILED` instead of `TLS_FAILURE`. The common
    cases (`DEPTH_ZERO_SELF_SIGNED_CERT`, `SELF_SIGNED_CERT_IN_CHAIN`,
    `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `CERT_HAS_EXPIRED`,
    `ERR_TLS_CERT_ALTNAME_INVALID`) are covered. This is a confirmed code-surface gap by
    inspection, not a runtime-observed failure.

### 30.5 Confirmed defects/gaps and smallest proposed corrections (not implemented)

| # | Finding | Confirmation | Smallest proposed correction |
| --- | --- | --- | --- |
| 1 | ImapFlow PREAUTH under implicit TLS can make `connect()` succeed without checking the saved username/password, so the result can be `VERIFIED` without credential verification. STARTTLS is not affected (it fails the upgrade). | Confirmed by inspected 2.12.2 source (`imap-flow.js:1929-1937`, `:1834-1841`, `:1618-1623`). | In `ImapFlowConnectionVerifier.verify`, after `client.connect()` resolves, reject when `client.greeting === undefined` (the inspected PREAUTH-only state; `initialOK` always sets a string) with `authenticationFailed: true`, so the result persists as `AUTHENTICATION_FAILED`. This is one adapter-file change. If the owner prefers accepting server-asserted PREAUTH as authentication, document that instead. |
| 2 | Some uncommon TLS certificate-verification error codes map to generic `CONNECTION_FAILED`, not `TLS_FAILURE`. | Confirmed by the fixed mapper set (`email-connection-errors.ts:82-99`) against standard OpenSSL verify codes; common codes covered. | Extend `TLS_ERROR_CODES`/`isTlsCode` with the remaining certificate/CRL verification codes (or recognize the TLS socket's `authorizationError`), one mapper-file change. |
| 3 | A disable that lands while a verification is in flight still persists the result, because `persistOutcome`'s conditional `where` omits `enabled`. | Confirmed (`email-connection-verification.service.ts:166-173`, `:289-313`). | Add `enabled: true` to the conditional `where`; a mid-flight disable then makes the write count zero and the existing `CONFIGURATION_CHANGED` branch handles it. No account is enabled either way. |

No credential leak, TLS bypass, plaintext-authentication fallback, mailbox access, or
connection-reuse defect was found. The Nodemailer socket-ownership cleanup is a deliberate
design fact, not a defect: `transporter.close()` alone would not close an active connection,
but the adapter always destroys its owned socket.

### 30.6 Is a correction necessary before live-provider acceptance?

- **Recommended:** the PREAUTH guard (#1) if "Verified" is required to mean "the saved
  credentials authenticated successfully". Without it, a pre-authenticating IMAP server can
  produce a false confidence in the stored password. This must be an owner decision because
  PREAUTH is a server-asserted authenticated state and the change is not implemented here.
- **Recommended but not blocking:** the TLS mapping completion (#2) so live certificate
  failures are reported as `TLS_FAILURE` rather than the generic code.
- **Optional:** the mid-flight disable guard (#3), depending on whether "disabled accounts must
  not be tested" is intended to cancel an already-running request.
- No correction is required for the inspected SMTP socket, destination, TLS-identity,
  `forceAuth`/`verify()` authentication, timeout or cleanup behaviour; those matched the
  intended design. ImapFlow destination, TLS-identity, mandatory STARTTLS,
  `verifyOnly`/`includeMailboxes` and close behaviour also matched, apart from the PREAUTH
  semantics above.

### 30.7 Status and preservation

- This review changed no code, test, configuration, dependency, migration, `.env`, database or
  research file, and did not contact a mail server or database. The passing 28/28 E2E evidence
  in §29 remains valid.
- SDR-005 remains **READY_FOR_HUMAN_REVIEW**, not `DONE`. Migration deployment and
  real-provider acceptance are still pending owner authorization; SDR-006 was not started.

## 31. Final correctness corrections and passing backend proof (2026-11-26)

### 31.1 Authorization and scope

- The human owner authorized correcting all three §30 gaps. Production changes were limited to
  `imap-connection-verifier.ts`, `email-connection-errors.ts` and
  `email-connection-verification.service.ts`; focused test changes to
  `apps/api/test/email-account-connections.test.ts`; documentation changes to this file and
  the task registry.
- No frontend, API response contract, Prisma schema/migration, dependency, manifest, lockfile,
  `.env`, database, mail server or research file was changed. No frontend or Playwright gate
  was rerun, because the frontend and API contracts are unchanged.

### 31.2 IMAP PREAUTH cannot produce VERIFIED without credential authentication

- The adapter now requires a defined `client.greeting` after a successful `verifyOnly`
  `connect()`:
  - ImapFlow 2.12.2 `initialOK()` always assigns `greeting` to a string, including the empty
    string for a greeting without text (`node_modules/imapflow/dist/cjs/imap-flow.js:1922-1926`).
  - `initialPREAUTH()` sets `state = AUTHENTICATED` and `authenticated = true` but never
    assigns `greeting` (`:1929-1937`), and `authenticate()` short-circuits for that state
    (`:1834-1841`).
  - `close()`/`closeConnection()` does not clear `greeting` (`:2575-2653`), so after a
    `verifyOnly` connect resolves the property still reflects the greeting path.
  - `greeting` is a public, typed property (`node_modules/imapflow/dist/cjs/imap-flow.d.ts:177-178`).
- When `greeting` is `undefined`, the adapter throws the new
  `ImapCredentialVerificationError`, which carries `authenticationFailed = true`. The existing
  classifier therefore maps it to the existing safe `AUTHENTICATION_FAILED` result and persists
  `FAILED`; no API contract change. The check does not rely on `authenticated === true`.
- The check runs inside the existing `try`, so `client.close()` in `finally` runs after a
  rejected PREAUTH. Implicit TLS, STARTTLS, certificate/hostname validation, validated
  destination IP, `verifyOnly` (no mailbox selection/listing) and cleanup are unchanged. If
  the greeting state were ever unavailable, the adapter fails safely rather than accepting the
  connection.

### 31.3 TLS error classification

The explicit `TLS_ERROR_CODES` set now additionally recognizes these Node/OpenSSL X509
certificate and CRL verification reasons (all are TLS certificate-validation failures, not
network or authentication failures):

```text
UNABLE_TO_GET_CRL, UNABLE_TO_GET_CRL_ISSUER,
UNABLE_TO_DECRYPT_CERT_SIGNATURE, UNABLE_TO_DECRYPT_CRL_SIGNATURE,
UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY,
CRL_SIGNATURE_FAILURE, CRL_NOT_YET_VALID, CRL_HAS_EXPIRED,
ERROR_IN_CERT_NOT_BEFORE_FIELD, ERROR_IN_CERT_NOT_AFTER_FIELD,
ERROR_IN_CRL_LAST_UPDATE_FIELD, ERROR_IN_CRL_NEXT_UPDATE_FIELD,
INVALID_CA, PATH_LENGTH_EXCEEDED, INVALID_PURPOSE, HOSTNAME_MISMATCH,
SUBJECT_ISSUER_MISMATCH, AKID_SKID_MISMATCH, AKID_ISSUER_SERIAL_MISMATCH,
KEYUSAGE_NO_CERTSIGN, UNHANDLED_CRITICAL_EXTENSION,
UNHANDLED_CRITICAL_CRL_EXTENSION, INVALID_NON_CA,
PROXY_PATH_LENGTH_EXCEEDED, PROXY_CERTIFICATES_NOT_ALLOWED,
DIFFERENT_CRL_SCOPE, CRL_PATH_VALIDATION_ERROR
```

`CERT_*` and `ERR_TLS*`/`ERR_SSL*`/`ERR_OSSL*` prefixes remain supported. Network, DNS,
authentication and generic socket codes are not in this set, and the mapper still never
returns or logs raw provider responses.

### 31.4 Account disabled during verification

The atomic conditional `updateMany` now includes `enabled: true` alongside the id and the
tested protocol configuration/credential. If the account is disabled before the outcome is
persisted:

- the update matches zero rows, so no verification field is written;
- the service returns the existing `CONFIGURATION_CHANGED` result with null `lastCheckedAt`
  and `failureCode`;
- the other protocol's verification fields are untouched;
- the account remains disabled; nothing re-enables it.

No cancellation infrastructure was added; an already-running network operation is allowed to
finish, but its outcome is discarded. Stale-configuration and independent-protocol protections
remain.

### 31.5 Focused regression tests

Seven tests were added to `apps/api/test/email-account-connections.test.ts`; the existing 46
tests were preserved (only IMAP client fakes gained the new required `greeting` property, and
the empty-string normal greeting case was added):

- normal OK greeting (including the empty string) is accepted as credential authentication;
- PREAUTH (`greeting === undefined`) is rejected and the client is closed;
- mandatory STARTTLS configuration remains `secure: false`, `doSTARTTLS: true`,
  `verifyOnly: true` (existing test preserved);
- all newly added certificate/CRL codes classify as `TLS_FAILURE`;
- representative non-TLS errors (`EAUTH`, auth failure, timeouts, DNS, refused, reset, pipe,
  access denied) do not classify as TLS;
- a PREAUTH-shaped error maps to `AUTHENTICATION_FAILED` through the service and preserves the
  other protocol's result;
- disabling an account during an in-flight SMTP test and during an in-flight IMAP test returns
  `CONFIGURATION_CHANGED`, persists nothing, preserves the other protocol and leaves the
  account disabled.

### 31.6 Single approved proof

Command executed once from the repository root:

```powershell
& {
    $ErrorActionPreference = 'Stop'

    npm.cmd run build -w @sdr-assistant/api
    if ($LASTEXITCODE -ne 0) {
        throw 'API build failed'
    }

    npm.cmd run test -w @sdr-assistant/api -- test/email-accounts.test.ts test/email-account-connections.test.ts
    if ($LASTEXITCODE -ne 0) {
        throw 'Email account backend tests failed'
    }

    Write-Output 'PASS: SDR-005 final backend corrections'
}
```

- **Exit code:** `0`.
- **API build:** PASS (Prisma Client generated in 144 ms; `tsc` produced no diagnostics).
- **Backend tests:** `test/email-accounts.test.ts` 23 passed;
  `test/email-account-connections.test.ts` 53 passed; total **76 passed (76)**, 0 failed,
  0 skipped; duration 2.04 s.
- **Final line:** `PASS: SDR-005 final backend corrections`.

### 31.7 Preservation and remaining limitations

- Only the three authorized production files, the focused backend test file and the two
  authorized documentation files changed in this step. Frontend implementation, frontend
  tests, API response contracts, Playwright configuration, dependencies, lockfile, Prisma
  schema/migrations, `.env`, database and research files are unchanged. The 28/28 Playwright
  and 95/95 frontend unit evidence remain applicable; those gates were not rerun.
- All 21 previously excluded untracked artifacts remain present. No real database, SMTP or
  IMAP connection was made.
- Remaining runtime assumptions: the PREAUTH distinction relies on the inspected ImapFlow
  2.12.2 greeting behavior (verified for this installed version, not against a live PREAUTH
  server); the TLS code set covers the named OpenSSL verification reasons but a future Node
  release could add another; live-provider acceptance and migration deployment remain pending.
- SDR-005 is **READY_FOR_HUMAN_REVIEW**, not `DONE`; SDR-006 was not started.

## 32. Database deployment, protected backup and final deployment proof (2026-11-26)

### 32.1 Authorization

- The human owner authorized the database preflight, protected backup and application of the
  single SDR-005 migration, with Full Access exclusively for these operations if enabled.
- Scope used: one migration, backup artifacts outside the repository, and the two authorized
  documentation files. No application code, test, migration file, dependency, manifest,
  `.env`, research object or existing email-account configuration was modified. No SMTP or
  IMAP connection was attempted. No service was restarted.

### 32.2 Preflight findings (read-only)

| Item | Observation |
| --- | --- |
| Container / service | `sdr-assistant-db` / `db`, `postgres:17-alpine`, running and healthy |
| Server | PostgreSQL 17.11; `pg_isready` accepting connections |
| Host / port / database / user | `localhost` / `5433` / `sdr_assistant` / `sdr` |
| Application configuration | `apps/api/.env` `DATABASE_URL` points at the same host, port, database and user; credentials were parsed but never printed |
| Migration ledger | 9 records, 9 applied, 0 unfinished, 0 rolled back |
| Applied checksums | all 9 matched their on-disk `migration.sql` SHA-256 |
| Pending migrations | exactly one: `20261126120000_add_email_account_verification`; `prisma migrate status` exit 1 listed only that name |
| Active research | 0 `QUEUED`, 0 `RUNNING`, 0 rows with `executionToken` or `executionLeaseUntil` |
| Existing `email_accounts` | table present, 2 rows (1 enabled, 1 disabled); no verification enum yet |
| Encryption key | `EMAIL_ACCOUNT_ENCRYPTION_KEY` present exactly once, canonical Base64, exactly 32 bytes; value never printed |

### 32.3 Pending migration review

The unchanged `20261126120000_add_email_account_verification/migration.sql` (SHA-256
`c4e51cc080cefa0c2a88695f71045ca5f8888aeaf6156101212715d5d464ce50`) contains only:

- `CREATE TYPE "EmailVerificationStatus" AS ENUM ('NOT_TESTED', 'VERIFIED', 'FAILED')`;
- one `ALTER TABLE "email_accounts"` adding the six verification columns, with
  `NOT_TESTED` defaults on the two status columns and nullable timestamp/failure-code columns.

It contains no `DROP`, no research reference, no index/constraint change and no other object.

### 32.4 Protected baseline (deterministic, read-only)

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
- Existing email accounts: 2 rows, enabled/disabled 1/1, original-column fingerprint
  `a849b0af79b178a9bc69e56117daec01`. The fingerprint uses the explicit original column list
  and excludes the six new verification columns. No record or credential value was exported.
- Migration ledger checksums were captured in the protected `baseline.json`; the
  `.env` file SHA-256 was `d20aab71807522eeb4465fa13558fd328d74426eb2a991bea1fdbdbbf94df493`
  (no value printed).
- Evidence file: `baseline.json` (3,361 bytes) in the protected backup directory.

### 32.5 Protected backup

| Item | Value |
| --- | --- |
| Backup directory | `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-124535` |
| ACL | inheritance disabled; explicit FullControl only for `ALFASISDEV\msmig`, `BUILTIN\Administrators` and `NT AUTHORITY\SYSTEM`; 0 `CodexSandboxUsers` ACEs; no inherited ACEs |
| ACL scope | applied only to the newly created empty directory; parent/existing backups untouched |
| Archive | `sdr_assistant_full_20261126-124535.dump` |
| Size | 3,807,035 bytes |
| SHA-256 | `76cb80af3b9bdb856c2446857aab897a8e572e3ec8a2598f7251e99a5cfd3a16` |
| `pg_dump` | exit 0 (`pg_dump -U sdr -d sdr_assistant -Fc`, credentials from container env) |
| Container vs host | size equal and SHA-256 equal (`sha256sum` vs `Get-FileHash`) |
| `pg_restore -l` | exit 0; exactly 8 `TABLE DATA` entries — `products`, `researches`, the three stage-results tables, `settings`, `email_accounts` and `_prisma_migrations` |
| Complete archive read / SQL generation | `pg_restore --file=- <dump> > /dev/null` exit 0, no database connection |
| Live restore | not performed |
| Temporary container dump | removed after verification; no temporary path remains |
| Other evidence | `backup-verification.json` (846 bytes) in the same protected directory |

No `.env`, encryption key, credential or plaintext account data was backed up or copied.

### 32.6 Migration application

Immediately before deployment the protected baseline, ledger (9/9/0/0), single pending
migration, migration-file hash, backup hash and `.env` hash were rechecked and matched
(script output `PRE_DEPLOY_BASELINE=PASS`).

Executed from `apps/api` with the existing local CLI (root workspace CLI):

```powershell
& 'C:\Users\msmig\Projektai\sdr-assistant\node_modules\.bin\prisma.cmd' migrate deploy
```

Actual output:

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma.
Datasource "db": PostgreSQL database "sdr_assistant", schema "public" at "localhost:5433"

10 migrations found in prisma/migrations

Applying migration `20261126120000_add_email_account_verification`

The following migration(s) have been applied:

migrations/
  └─ 20261126120000_add_email_account_verification/
    └─ migration.sql

All migrations have been successfully applied.

MIGRATE_DEPLOY_EXIT=0
```

- **Exit code:** 0. Only the authorized migration was applied.
- After deployment: ledger 10 records / 10 applied / 0 unfinished / 0 rolled back; the new
  record's checksum equals the SHA-256 of its file; `EmailVerificationStatus` has labels
  `NOT_TESTED,VERIFIED,FAILED`; all six columns exist with the expected types, nullability and
  `NOT_TESTED` defaults; both existing accounts have `NOT_TESTED`/null on both protocols.
- No research table, row, index, constraint or record changed.

### 32.7 Single final proof — exact command, output and exit code

Executed once from the repository root. Exit code **0**; every check passed.

```powershell
& {
    $ErrorActionPreference = 'Stop'

    function Get-DbScalar([string]$sql) {
        $out = docker compose exec -T db psql -U sdr -d sdr_assistant -X -A -t -c $sql 2>$null
        if ($LASTEXITCODE -ne 0) { throw 'Database query failed' }
        return ($out | Out-String).Trim()
    }
    function Ensure([bool]$condition, [string]$message) {
        if (-not $condition) { throw $message }
    }

    $repoRoot = (Get-Location).Path
    $backupDir = 'C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-124535'
    $archive = Join-Path $backupDir 'sdr_assistant_full_20261126-124535.dump'
    $expectedBackupHash = '76cb80af3b9bdb856c2446857aab897a8e572e3ec8a2598f7251e99a5cfd3a16'
    $expectedEnvHash = 'd20aab71807522eeb4465fa13558fd328d74426eb2a991bea1fdbdbbf94df493'

    $prisma = Join-Path $repoRoot 'node_modules\.bin\prisma.cmd'
    Push-Location (Join-Path $repoRoot 'apps/api')
    try {
        $statusOutput = (& $prisma migrate status 2>&1 | Out-String)
        $statusExit = $LASTEXITCODE
    }
    finally { Pop-Location }
    Ensure ($statusExit -eq 0) "prisma migrate status failed with exit code $statusExit"
    Ensure ($statusOutput -match 'Database schema is up to date!') 'Prisma did not report an up-to-date schema'
    Write-Output 'CHECK 1 prisma-migrate-status: PASS'

    $ledger = Get-DbScalar "SELECT count(*) || '|' || count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) || '|' || count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) || '|' || count(*) FILTER (WHERE rolled_back_at IS NOT NULL) FROM _prisma_migrations;"
    Ensure ($ledger -eq '10|10|0|0') "Migration ledger mismatch: $ledger"
    $newApplied = Get-DbScalar "SELECT count(*) FROM _prisma_migrations WHERE migration_name = '20261126120000_add_email_account_verification' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;"
    Ensure ($newApplied -eq '1') 'Verification migration is not recorded as applied'
    Write-Output 'CHECK 2 migration-ledger-10-applied: PASS'

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
    Ensure ($ledgerMap.Count -eq 10) "Unexpected migration-record count: $($ledgerMap.Count)"
    foreach ($name in $expectedChecksums.Keys) {
        Ensure ($ledgerMap.ContainsKey($name) -and $ledgerMap[$name] -eq $expectedChecksums[$name]) "Migration checksum changed: $name"
    }
    $migrationFile = Join-Path $repoRoot 'apps/api/prisma/migrations/20261126120000_add_email_account_verification/migration.sql'
    $newChecksum = (Get-FileHash -LiteralPath $migrationFile -Algorithm SHA256).Hash.ToLowerInvariant()
    Ensure ($ledgerMap['20261126120000_add_email_account_verification'] -eq $newChecksum) 'New migration checksum does not match its file'
    Write-Output 'CHECK 3 previous-nine-checksums-unchanged: PASS'

    $enumLabels = Get-DbScalar "SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EmailVerificationStatus');"
    Ensure ($enumLabels -eq 'NOT_TESTED,VERIFIED,FAILED') "Enum labels mismatch: $enumLabels"
    $columnCount = Get-DbScalar "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_accounts' AND column_name IN ('smtpVerificationStatus','smtpLastCheckedAt','smtpVerificationFailureCode','imapVerificationStatus','imapLastCheckedAt','imapVerificationFailureCode');"
    Ensure ($columnCount -eq '6') "Expected six verification columns, found $columnCount"
    $statusDefaults = Get-DbScalar 'SELECT count(*) FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''email_accounts'' AND column_name IN (''smtpVerificationStatus'',''imapVerificationStatus'') AND is_nullable = ''NO'' AND udt_name = ''EmailVerificationStatus'' AND column_default = ''''''NOT_TESTED''''::"EmailVerificationStatus"'';'
    Ensure ($statusDefaults -eq '2') "Status column defaults mismatch: $statusDefaults"
    $nullableTimestamps = Get-DbScalar "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_accounts' AND column_name IN ('smtpLastCheckedAt','imapLastCheckedAt') AND data_type = 'timestamp without time zone' AND is_nullable = 'YES';"
    Ensure ($nullableTimestamps -eq '2') 'Verification timestamp columns mismatch'
    $nullableText = Get-DbScalar "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_accounts' AND column_name IN ('smtpVerificationFailureCode','imapVerificationFailureCode') AND data_type = 'text' AND is_nullable = 'YES';"
    Ensure ($nullableText -eq '2') 'Verification failure-code columns mismatch'
    Write-Output 'CHECK 4 enum-and-six-columns: PASS'

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
    $expectedResearch = @(
        'products|5|b08db99b30806f800ca649948aac817a',
        'research_stage_01_results|5|70a5598f0d4ac766f31996943daa8a06',
        'research_stage_02_results|3|b9b7c5c113d4deb13b9f6864443afdc3',
        'research_stage_03_results|5|b88706cadf893d1d377fa9e14134ffcd',
        'researches|42|6f4476a16e93d2584dd6299dc802a0f3',
        'settings|1|a5fb91bf9317969fb493b58f87baf8e2'
    )
    $actualResearch = @((Get-DbScalar $fingerprintSql) -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
    Ensure ($actualResearch.Count -eq 6) 'Unexpected research table row'
    foreach ($row in $expectedResearch) { Ensure ($actualResearch -contains $row) "Research preservation mismatch: $row" }
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
    Ensure ((Get-DbScalar $schemaSql) -eq '3fc348d9692c77144f871a5c2626ac5d') 'Research schema metadata changed'
    Write-Output 'CHECK 5 research-preservation: PASS'

    $emailSql = @'
SELECT count(*) || '|' || md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), ''))
FROM (
  SELECT ROW(id, name, "senderName", "emailAddress", enabled, "smtpHost", "smtpPort", "smtpSecurity"::text, "smtpUsername", "smtpPasswordEncrypted", "imapHost", "imapPort", "imapSecurity"::text, "imapUsername", "imapPasswordEncrypted", "createdAt", "updatedAt")::text AS row_text
  FROM email_accounts
) s;
'@
    Ensure ((Get-DbScalar $emailSql) -eq '2|a849b0af79b178a9bc69e56117daec01') 'Existing email-account columns changed'
    Write-Output 'CHECK 6 existing-email-accounts-preserved: PASS'

    $accountStatuses = Get-DbScalar 'SELECT count(*) || ''|'' || count(*) FILTER (WHERE "smtpVerificationStatus" = ''NOT_TESTED'' AND "smtpLastCheckedAt" IS NULL AND "smtpVerificationFailureCode" IS NULL) || ''|'' || count(*) FILTER (WHERE "imapVerificationStatus" = ''NOT_TESTED'' AND "imapLastCheckedAt" IS NULL AND "imapVerificationFailureCode" IS NULL) || ''|'' || count(*) FILTER (WHERE "smtpVerificationStatus" <> ''NOT_TESTED'' OR "smtpLastCheckedAt" IS NOT NULL OR "smtpVerificationFailureCode" IS NOT NULL OR "imapVerificationStatus" <> ''NOT_TESTED'' OR "imapLastCheckedAt" IS NOT NULL OR "imapVerificationFailureCode" IS NOT NULL) FROM email_accounts;'
    Ensure ($accountStatuses -eq '2|2|2|0') "Initial verification status mismatch: $accountStatuses"
    Write-Output 'CHECK 7 existing-accounts-not-tested: PASS'

    Ensure (Test-Path -LiteralPath $archive) 'Backup archive is missing'
    Ensure ((Get-Item -LiteralPath $archive).Length -eq 3807035) 'Backup archive size changed'
    Ensure ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expectedBackupHash) 'Backup archive SHA-256 changed'
    Write-Output 'CHECK 8 backup-sha256-unchanged: PASS'

    $envPath = Join-Path $repoRoot 'apps/api/.env'
    $envRaw = [System.IO.File]::ReadAllText($envPath)
    $keyMatches = [regex]::Matches($envRaw, '(?m)^[ \t]*EMAIL_ACCOUNT_ENCRYPTION_KEY[ \t]*=[ \t]*(\S+)[ \t]*$')
    Ensure ($keyMatches.Count -eq 1) 'Encryption key line is not present exactly once'
    $keyValue = $keyMatches[0].Groups[1].Value
    $keyBytes = [Convert]::FromBase64String($keyValue)
    Ensure ($keyBytes.Length -eq 32) 'Encryption key is not 32 bytes'
    Ensure ([Convert]::ToBase64String($keyBytes) -eq $keyValue) 'Encryption key is not canonical Base64'
    Ensure ((Get-FileHash -LiteralPath $envPath -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expectedEnvHash) 'apps/api/.env changed'
    Write-Output 'CHECK 9 encryption-key-valid-and-unchanged: PASS'

    git check-ignore --quiet apps/api/.env
    Ensure ($LASTEXITCODE -eq 0) 'apps/api/.env is not Git-ignored'
    Write-Output 'CHECK 10 env-git-ignored: PASS'

    Write-Output 'PASS: SDR-005 migration, backup, research and email-account preservation verified'
}
```

Actual output:

```text
CHECK 1 prisma-migrate-status: PASS
CHECK 2 migration-ledger-10-applied: PASS
CHECK 3 previous-nine-checksums-unchanged: PASS
CHECK 4 enum-and-six-columns: PASS
CHECK 5 research-preservation: PASS
CHECK 6 existing-email-accounts-preserved: PASS
CHECK 7 existing-accounts-not-tested: PASS
CHECK 8 backup-sha256-unchanged: PASS
CHECK 9 encryption-key-valid-and-unchanged: PASS
CHECK 10 env-git-ignored: PASS
PASS: SDR-005 migration, backup, research and email-account preservation verified
```

**Exit code: 0.**

### 32.8 Deployment boundary findings (read-only)

- **API:** listening on `0.0.0.0:4000`. `HOST` is not configured in `apps/api/.env`;
  `apps/api/src/main.ts` defaults to `0.0.0.0`. The API has no application authentication,
  so the email-account verification endpoints are reachable from every interface that can
  reach the host.
- **Web:** Next dev is listening on `[::]:3000` (all IPv6 interfaces, normally dual-stack).
- **Database:** Docker publishes PostgreSQL on `0.0.0.0:5433` and `[::]:5433`; the database is
  reachable from the same network scope as the host, not only from localhost.
- **Firewall/network:** the active profile is `Private` (`ZTE_5D9DA0`, Wi-Fi). Windows
  Firewall profiles are enabled with `DefaultInboundAction = NotConfigured` (default block),
  but eight enabled inbound *allow* rules exist for `node.exe` with `Any` ports, including
  Private-profile rules; there are no explicit port-only rules for 3000/4000/5433. The
  running API binary is `C:\nvm4w\nodejs\node.exe` (NVM shim); the rules target the versioned
  `...\nvm\v24.20.0\node.exe` path, so exact firewall matching is not proven from inspection.
- **Conclusion:** the API/web boundary is **not demonstrably restricted to a trusted local
  environment**. Binding all interfaces plus inbound node allowances plus no application
  authentication is sufficient to treat this as exposed. **Live-provider acceptance must not
  be performed** until the owner binds the API/web to `127.0.0.1` (for example API
  `HOST=127.0.0.1`, Next `--hostname 127.0.0.1`) or verifies firewall restriction from
  another host, and preferably restricts the published PostgreSQL port as well. No network,
  firewall or `.env` change was made by this task.

### 32.9 Preservation and status

- Only the single migration, the protected backup artifacts and the two authorized task
  documents changed. Application code/tests, APIs, frontend, dependencies, manifests,
  lockfile, `.env`, research implementation and existing account rows/configurations were
  not modified. The running services were not restarted.
- All 21 previously excluded untracked artifacts remain present.
- SDR-005 is **READY_FOR_HUMAN_REVIEW**, not `DONE`; live-provider acceptance remains blocked
  by §32.8 until the owner restricts the deployment boundary. SDR-006 was not started.

### 32.10 Owner restart and live-testing instructions

1. **First restrict the boundary** per §32.8; do not run live-provider tests while the API and
   web app bind all interfaces. Verify from another device that ports 3000/4000 (and 5433) are
   unreachable, or bind them to loopback.
2. Restart the API and web application cleanly (this task did not restart them). The API
   process is currently `node --watch dist/main.js`; a clean restart ensures the new build and
   Prisma client are loaded.
3. Confirm `GET /health` and open **Settings → Email accounts**. Existing accounts should show
   **SMTP · Not tested** and **IMAP · Not tested** with no timestamps.
4. Perform live SMTP/IMAP tests only with owner-approved credentials. A success requires
   connection, TLS and credential authentication; no email is sent and no mailbox is opened.
5. Remember that the existing accounts were left disabled where they were disabled before
   migration; do not enable or modify them unless intended. The migration did not change
   account configuration.
6. Keep the protected backup until acceptance is complete:
   `C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-124535`.
   No live restore was performed; a restore is an owner decision.

## 33. ENV-003 — local service isolation resolved the live-acceptance boundary (2026-11-26)

- The human owner authorized environment task **ENV-003** to restrict the local development
  deployment to loopback. Full details and the exact proof command are in
  [ENV-003-local-service-isolation.md](ENV-003-local-service-isolation.md).
- Changes: one `HOST=127.0.0.1` added to `apps/api/.env` (all other environment values
  unchanged; encryption key valid and untouched); documented in `apps/api/.env.example`; web
  `dev` now runs `next dev --hostname 127.0.0.1 --port 3000`; Compose now publishes
  `127.0.0.1:5433:5432` while reusing the `sdr-assistant_db-data` volume.
- Only the positively identified SDR Assistant dev tree was restarted and only the PostgreSQL
  container was recreated (`docker compose up -d db`), with no volume removal. The named volume
  and all data survived.
- Listeners changed from `[::]:3000`, `0.0.0.0:4000` and wildcard `5433` to
  `127.0.0.1:3000`, `127.0.0.1:4000` and `127.0.0.1:5433`.
- ENV-003's single 12-check proof passed (exit 0) with the final line
  `PASS: ENV-003 local service isolation and data preservation verified`. It re-verified
  local API/frontend/PostgreSQL access, all ten migrations and checksums, research and
  email-account preservation, the encryption key and all pre-existing environment values, the
  SDR-005 backup hash, and the absence of a wildcard listener or port-proxy forwarding.
- This supersedes the boundary/restart steps in §32.8/§32.10: the services are now loopback
  bound and running, so SDR-005 live-provider acceptance can proceed under separate owner
  authorization. No separate-device LAN reachability test was performed; the evidence is
  listener/publication binding plus local requests. No SMTP/IMAP connection was made.
- ENV-003 is `READY_FOR_HUMAN_REVIEW`, not `DONE`. SDR-005 remains `READY_FOR_HUMAN_REVIEW`,
  not `DONE`; SDR-006 was not started.

## 34. Final human acceptance and closure (2026-11-26)

### 34.1 Acceptance

The human owner accepted SDR-005 — Email Connection Testing and Account Form UX — on
2026-11-26. The accepted evidence comprises:

- API build and Prisma Client generation: PASS.
- Backend tests: 76/76 PASS.
- Frontend unit tests: 95/95 PASS.
- Typecheck, ESLint and Prettier: PASS.
- Playwright E2E: 28/28 PASS.
- Database deployment proof: 10/10 PASS.
- ENV-003 isolation proof: 12/12 PASS.
- Research and existing email-account preservation: PASS.
- Real-provider SMTP verification: VERIFIED.
- Real-provider IMAP verification: VERIFIED.
- Account list and updated account form UX: accepted.

At 2026-11-26 13:19 local time the owner performed the combined **Test connections** action
against the configured real email account. The accepted screenshots show both protocols
initially `NOT_TESTED` and then `VERIFIED`, both results visible in the edit form, the disabled
synthetic account not testable from the list, empty password fields when editing, and the
accepted two-column form layout.

### 34.2 Sanitized database-backed confirmation

Read-only aggregate inspection after acceptance confirmed:

- 2 existing accounts: 1 enabled and 1 disabled.
- The enabled account has SMTP and IMAP `VERIFIED`, both `lastCheckedAt` timestamps populated
  and both failure codes null.
- The disabled synthetic account remains disabled.
- All 10 migrations remain applied (10/10; 0 unfinished, 0 rolled back).
- The local frontend, API and PostgreSQL host port remain loopback-bound
  (`127.0.0.1:3000`, `127.0.0.1:4000`, `127.0.0.1:5433`).

No account address, hostname, username, password, encrypted credential, screenshot or other
real account detail was retrieved for this record or is committed. No additional SMTP/IMAP
connection was initiated and no database record was modified by the closure work.

### 34.3 Remaining limitations

- SMTP verification does not establish sender authorization or email deliverability.
- Email sending and mailbox synchronization are not implemented.
- Application authentication is not implemented.
- The current security boundary is the local loopback configuration.
- Production deployment requires separate security preparation.
- The synthetic acceptance account remains disabled.
- Encryption-key custody and backup retention remain owner responsibilities.

### 34.4 Closure

SDR-005 is **DONE**. No further implementation changes are authorized. The task record and all
historical requirements, scope, acceptance criteria and verification evidence are preserved.
SDR-006 was not started.
