# ENV-003 — Restrict local SDR Assistant service exposure

## 1. Task ID and status

- **Task ID:** ENV-003
- **Status:** DONE — accepted by the human owner on 2026-11-26. The local frontend, API and
  PostgreSQL host port bind only to loopback; all 12 proof checks passed, data/migrations/
  backup/env values were preserved, and real-provider SMTP/IMAP acceptance subsequently
  succeeded. See §9.
- **Registry:** [README.md](README.md)
- **Parent task:** SDR-005 (database deployment and live-acceptance preparation). SDR-005 is
  not `DONE`.
- **Execution mode:** the session's existing file policy was used as-is; no sandbox mode,
  permission, ACL or Windows Firewall/network-adapter change was made. Only the project-owned
  frontend, API and PostgreSQL service were restarted, under the task's explicit owner
  authorization.
- **Scope authority:** the ENV-003 assignment statement. Execution notes and evidence are
  appended; the approved objective, scope and criteria are not rewritten.

## 2. Objective

Restrict the local development deployment to loopback access without modifying research
behavior or email-verification functionality:

- Frontend: `127.0.0.1:3000`.
- Backend: `127.0.0.1:4000`.
- PostgreSQL host port: `127.0.0.1:5433`.

Preserve normal local development operation.

## 3. Authorized scope and paths

- `apps/api/.env` — `HOST` setting only.
- `apps/api/.env.example` — document the existing `HOST` setting.
- Existing frontend development startup script (`apps/web/package.json` `dev`).
- Existing Docker Compose PostgreSQL host-port publication (`docker-compose.yml`), preserving
  the container port, credentials, service and persistent volume.
- Project-owned service runtime state (frontend, API, PostgreSQL).
- This document, the task registry and relevant SDR-005 task documentation.

No application business logic, research code, tests, dependencies, migrations, schema,
Playwright configuration, database records, credentials or keys are in scope.

## 4. Explicit exclusions

- No Windows Firewall, network adapter or system-wide network changes.
- No research implementation, settings, prompts, schemas or fixture changes.
- No email-verification behavior changes.
- No dependency installation or upgrade.
- No migrations, schema changes or database record modifications.
- No credential changes or key rotation.
- No SMTP/IMAP connection, email sending or mailbox access.
- No repeated application test suites.
- No unrelated file cleanup, staging, commit or push.
- No SDR-006.

## 5. Acceptance criteria

- Frontend, backend and PostgreSQL host port bind only to IPv4 or IPv6 loopback.
- Local API health, frontend HTTP and PostgreSQL connectivity succeed.
- All ten migrations remain applied with unchanged checksums.
- Research and existing email-account counts/content fingerprints are unchanged.
- The encryption key and all pre-existing `.env` values remain unchanged except the
  authorized `HOST` setting.
- The verified SDR-005 backup remains intact.
- No unexpected project listener or forwarding rule exposes the services to the LAN.
- The single final proof passes with the expected final line.

## 6. One proof command

Executed once from the repository root; exit code **0**.

```powershell
& {
    $ErrorActionPreference = 'Stop'

    function Ensure([bool]$condition, [string]$message) {
        if (-not $condition) { throw $message }
    }
    function Get-DbScalar([string]$sql) {
        $out = docker compose exec -T db psql -U sdr -d sdr_assistant -X -A -t -c $sql 2>$null
        if ($LASTEXITCODE -ne 0) { throw 'Database query failed' }
        return ($out | Out-String).Trim()
    }
    function Get-Listeners([int]$port) {
        return @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    }
    function Assert-LoopbackListeners([int]$port, [string]$label) {
        $listeners = Get-Listeners $port
        Ensure ($listeners.Count -ge 1) "$label has no listener on port $port"
        foreach ($listener in $listeners) {
            Ensure ($listener.LocalAddress -in @('127.0.0.1', '::1')) "$label is not loopback-bound: $($listener.LocalAddress):$port"
        }
    }

    Assert-LoopbackListeners 3000 'Frontend'
    Write-Output 'CHECK 1 frontend-loopback-only: PASS'
    Assert-LoopbackListeners 4000 'Backend'
    Write-Output 'CHECK 2 backend-loopback-only: PASS'

    $bindings = docker inspect sdr-assistant-db --format '{{json .HostConfig.PortBindings}}' | ConvertFrom-Json
    $dbBindings = @($bindings.'5432/tcp')
    Ensure ($dbBindings.Count -ge 1) 'PostgreSQL has no host port binding'
    foreach ($binding in $dbBindings) {
        Ensure ($binding.HostIp -in @('127.0.0.1', '::1')) "PostgreSQL wildcard publication: $($binding.HostIp):$($binding.HostPort)"
        Ensure ($binding.HostPort -eq '5433') "PostgreSQL host port is not 5433: $($binding.HostPort)"
    }
    $published = (docker port sdr-assistant-db 5432 | Out-String).Trim()
    Ensure ($published -match '^127\.0\.0\.1:5433$') "Unexpected docker port publication: $published"
    Assert-LoopbackListeners 5433 'PostgreSQL'
    Write-Output 'CHECK 3 postgresql-loopback-publication: PASS'

    $health = Invoke-WebRequest -Uri 'http://127.0.0.1:4000/health' -UseBasicParsing -TimeoutSec 10
    Ensure ($health.StatusCode -eq 200) 'API health did not return HTTP 200'
    $healthJson = $health.Content | ConvertFrom-Json
    Ensure ($healthJson.status -eq 'ok') 'API health did not report status ok'
    Write-Output 'CHECK 4 api-health: PASS'

    $web = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 15
    Ensure ($web.StatusCode -eq 200) 'Frontend did not return HTTP 200'
    Write-Output 'CHECK 5 frontend-http: PASS'

    $tcp = [System.Net.Sockets.TcpClient]::new()
    try {
        $tcp.Connect('127.0.0.1', 5433)
        Ensure ($tcp.Connected) 'PostgreSQL TCP connection failed'
    }
    finally { $tcp.Dispose() }
    Ensure ((Get-DbScalar 'SELECT 1;') -eq '1') 'PostgreSQL SQL query failed'
    Write-Output 'CHECK 6 postgresql-connectivity: PASS'

    $ledger = Get-DbScalar "SELECT count(*) || '|' || count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) || '|' || count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) || '|' || count(*) FILTER (WHERE rolled_back_at IS NOT NULL) FROM _prisma_migrations;"
    Ensure ($ledger -eq '10|10|0|0') "Migration ledger mismatch: $ledger"
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
        '20261126120000_add_email_account_verification' = 'c4e51cc080cefa0c2a88695f71045ca5f8888aeaf6156101212715d5d464ce50'
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
    Write-Output 'CHECK 7 ten-migrations-and-checksums: PASS'

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
    Write-Output 'CHECK 8 research-preservation: PASS'

    $emailSql = @'
SELECT count(*) || '|' || md5(COALESCE(string_agg(row_text, E'\n' ORDER BY row_text COLLATE "C"), ''))
FROM (
  SELECT ROW(id, name, "senderName", "emailAddress", enabled, "smtpHost", "smtpPort", "smtpSecurity"::text, "smtpUsername", "smtpPasswordEncrypted", "imapHost", "imapPort", "imapSecurity"::text, "imapUsername", "imapPasswordEncrypted", "createdAt", "updatedAt")::text AS row_text
  FROM email_accounts
) s;
'@
    Ensure ((Get-DbScalar $emailSql) -eq '2|a849b0af79b178a9bc69e56117daec01') 'Email-account preservation mismatch'
    Write-Output 'CHECK 9 email-account-preservation: PASS'

    $repoRoot = (Get-Location).Path
    $envPath = Join-Path $repoRoot 'apps/api/.env'
    $envRaw = [System.IO.File]::ReadAllText($envPath)
    $envLines = @($envRaw -split "`r?`n" | Where-Object { $_ -match '^[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*=' -and $_ -notmatch '^[ \t]*HOST[ \t]*=' } | ForEach-Object { $_.Trim() } | Sort-Object)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $nonHostHash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($envLines -join "`n")))).Replace('-','').ToLowerInvariant()
    Ensure ($envLines.Count -eq 9) 'Unexpected number of non-HOST environment variables'
    Ensure ($nonHostHash -eq 'a3e09f6ec068bb817116097364cc1d751d1dcee966b009b2e19993561f8d96d3') 'Pre-existing environment values changed'
    $hostCount = ([regex]::Matches($envRaw, '(?m)^[ \t]*HOST[ \t]*=')).Count
    Ensure ($hostCount -eq 1) 'HOST is not configured exactly once'
    Ensure ([regex]::IsMatch($envRaw, '(?m)^[ \t]*HOST[ \t]*=[ \t]*127\.0\.0\.1[ \t]*$')) 'HOST is not 127.0.0.1'
    $keyMatch = [regex]::Match($envRaw, '(?m)^[ \t]*EMAIL_ACCOUNT_ENCRYPTION_KEY[ \t]*=[ \t]*(\S+)[ \t]*$')
    Ensure ($keyMatch.Success) 'Encryption key is missing'
    $keyBytes = [Convert]::FromBase64String($keyMatch.Groups[1].Value)
    Ensure ($keyBytes.Length -eq 32) 'Encryption key is not 32 bytes'
    Ensure ([Convert]::ToBase64String($keyBytes) -eq $keyMatch.Groups[1].Value) 'Encryption key is not canonical Base64'
    Write-Output 'CHECK 10 environment-preservation-and-key: PASS'

    $archive = 'C:\Users\msmig\Projektai\_backupsForProjects\sdr-assistant-db-20261126-124535\sdr_assistant_full_20261126-124535.dump'
    Ensure (Test-Path -LiteralPath $archive) 'Backup archive is missing'
    Ensure ((Get-Item -LiteralPath $archive).Length -eq 3807035) 'Backup archive size changed'
    Ensure ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -eq '76cb80af3b9bdb856c2446857aab897a8e572e3ec8a2598f7251e99a5cfd3a16') 'Backup archive SHA-256 changed'
    Write-Output 'CHECK 11 backup-intact: PASS'

    foreach ($port in @(3000, 4000, 5433)) {
        foreach ($listener in Get-Listeners $port) {
            Ensure ($listener.LocalAddress -in @('127.0.0.1', '::1')) "Unexpected LAN listener on $port`: $($listener.LocalAddress)"
        }
    }
    $proxyOutput = (netsh interface portproxy show all 2>&1 | Out-String)
    $proxyHits = @($proxyOutput -split "`n" | Where-Object { $_ -match '\b(3000|4000|5433)\b' })
    Ensure ($proxyHits.Count -eq 0) 'Unexpected portproxy forwarding for project ports'
    $dockerPublished = (docker ps --filter name=sdr-assistant-db --format '{{.Ports}}' | Out-String)
    Ensure ($dockerPublished -match '127\.0\.0\.1:5433->5432/tcp') 'Docker published port is not loopback-only'
    Ensure ($dockerPublished -notmatch '0\.0\.0\.0|\[::\]') 'Docker published a wildcard port'
    Write-Output 'CHECK 12 no-lan-listener-or-forwarding: PASS'

    Write-Output 'PASS: ENV-003 local service isolation and data preservation verified'
}
```

## 7. Verification result

### 7.1 Configuration changes

| Path | Change |
| --- | --- |
| `apps/api/.env` | Added exactly one `HOST=127.0.0.1`; all nine pre-existing variables preserved byte-for-value (non-HOST hash unchanged `a3e09f6e…`); encryption key untouched |
| `apps/api/.env.example` | Documented `HOST=127.0.0.1` under `PORT` |
| `apps/web/package.json` | `dev` script changed from `next dev --port 3000` to `next dev --hostname 127.0.0.1 --port 3000`; port/workspace conventions preserved |
| `docker-compose.yml` | PostgreSQL publication changed from `5433:5432` to `127.0.0.1:5433:5432`; image, credentials, service, healthcheck and `db-data` volume preserved |

No application source, tests, Playwright configuration, research file, migration SQL or
database record was changed.

### 7.2 Before/after listeners

| Service | Before | After |
| --- | --- | --- |
| Frontend (3000) | `[::]:3000` | `127.0.0.1:3000` |
| Backend (4000) | `0.0.0.0:4000` | `127.0.0.1:4000` |
| PostgreSQL host (5433) | published on `0.0.0.0:5433` and `[::]:5433` | published on `127.0.0.1:5433` only; listener `127.0.0.1:5433` |

### 7.3 Controlled service restart and volume preservation

- No research execution was active before restart (`0|0|0`).
- The SDR-005 protected backup was verified before PostgreSQL recreation (3,807,035 bytes,
  SHA-256 `76cb80af3b9bdb856c2446857aab897a8e572e3ec8a2598f7251e99a5cfd3a16`).
- Only the positively identified SDR Assistant dev tree was stopped (root PID `41876`,
  `concurrently -n api,web` tree); no unrelated Node/Next/Docker process was stopped.
- The PostgreSQL container was recreated with `docker compose up -d db` (no `down -v`, no
  volume removal). Container id changed `c185b9f7…` → `11dde430…`; the named volume remained
  `sdr-assistant_db-data` at the same mount point and all data survived.
- The API/web dev stack was restarted detached with the existing `npm.cmd run dev`; API health
  and frontend HTTP responded on loopback.
- PostgreSQL, API and frontend all became healthy/reachable on loopback.

### 7.4 Database, email-account and backup preservation

- All 10 migrations remain applied (10/10, 0 unfinished, 0 rolled back); all ten checksums
  unchanged.
- Research: `products` 5 / `b08db99b…`; `researches` 42 / `6f4476a1…`; stage 01 5 /
  `70a5598f…`; stage 02 3 / `b9b7c5c1…`; stage 03 5 / `b88706ca…`; `settings` 1 /
  `a5fb91bf…`; schema fingerprint `3fc348d9…` — all match the pre-migration baseline.
- Email accounts: 2 rows, original-column fingerprint `a849b0af79b178a9bc69e56117daec01`,
  unchanged; both remain `NOT_TESTED`/null on both protocols from SDR-005.
- Backup intact, same size and SHA-256; no backup was modified or restored.
- `EMAIL_ACCOUNT_ENCRYPTION_KEY` valid (32 canonical Base64 bytes) and unchanged; all other
  pre-existing environment values unchanged except the authorized `HOST`.

### 7.5 Exact proof output and exit code

```text
CHECK 1 frontend-loopback-only: PASS
CHECK 2 backend-loopback-only: PASS
CHECK 3 postgresql-loopback-publication: PASS
CHECK 4 api-health: PASS
CHECK 5 frontend-http: PASS
CHECK 6 postgresql-connectivity: PASS
CHECK 7 ten-migrations-and-checksums: PASS
CHECK 8 research-preservation: PASS
CHECK 9 email-account-preservation: PASS
CHECK 10 environment-preservation-and-key: PASS
CHECK 11 backup-intact: PASS
CHECK 12 no-lan-listener-or-forwarding: PASS
PASS: ENV-003 local service isolation and data preservation verified
```

**Exit code: 0.**

### 7.6 Local access and scope of evidence

- Frontend: `http://127.0.0.1:3000`.
- API health: `http://127.0.0.1:4000/health`.
- PostgreSQL: `127.0.0.1:5433` (database `sdr_assistant`).
- The evidence above is **loopback-binding and local-request evidence**. No separate-device
  LAN reachability test was performed. No firewall or network policy was changed.
- With the application now loopback-bound, SDR-005 live-provider acceptance can proceed under
  a separate owner authorization, using the restarted local services. No SMTP/IMAP connection
  was made by ENV-003.

## 8. Remaining limitations or blockers

- The services are proven bound to loopback and unreachable on non-loopback addresses from
  this host's listener table; a separate-device LAN scan was not performed and is not claimed.
- Windows Firewall and network adapters were not changed. Any future process that binds
  these ports to `0.0.0.0`/`::` or any external port proxy/NAT rule would re-expose them.
- The API still has no application authentication; loopback binding is the deployment
  boundary. Do not expose it publicly.
- The `start` (production) web script was not changed; only the authorized development
  startup script was modified.
- SDR-005 remains `READY_FOR_HUMAN_REVIEW`, not `DONE`; live-provider acceptance remains an
  owner decision. ENV-003 is `READY_FOR_HUMAN_REVIEW`, not `DONE`.

## 9. Final human acceptance and closure (2026-11-26)

The human owner accepted ENV-003 — Local Service Isolation — on 2026-11-26. The accepted
evidence is the single 12/12 proof in §6/§7, including loopback-only frontend/API/PostgreSQL
bindings, local health/connectivity, preserved migrations/research/email data, the unchanged
encryption key and other environment values, the intact SDR-005 backup, and no wildcard
listener or port-proxy forwarding.

The subsequent SDR-005 real-provider acceptance succeeded through the loopback-bound
deployment: SMTP and IMAP both reported `VERIFIED` on 2026-11-26 at 13:19 local time. No
additional SMTP/IMAP connection was made by ENV-003.

Remaining limitations are unchanged:

- The proof establishes loopback binding/publication and local reachability, not a
  separate-device LAN test.
- Windows Firewall/network policy and adapters were not changed; external NAT/port-proxy or a
  future wildcard binding could re-expose the ports.
- The API has no application authentication; loopback is the security boundary.
- Only the development web script was bound; production deployment requires separate
  security preparation.
- PostgreSQL remains reachable from other containers on its Docker network.
- SMTP verification does not establish sender authorization or deliverability; email sending
  and mailbox synchronization are not implemented.
- The synthetic acceptance account remains disabled; encryption-key custody and backup
  retention remain owner responsibilities.

ENV-003 is **DONE**. No further implementation or environment changes are authorized under
this task; SDR-006 was not started.
