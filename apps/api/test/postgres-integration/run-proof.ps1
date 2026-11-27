param(
  [string]$Image = 'postgres:17-alpine'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
Set-Location $repo

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$suffix = Get-Random -Minimum 1000 -Maximum 9999
$container = "sdr007a-it-$stamp-$suffix"
$database = "sdr007a_it_$($stamp)_$suffix"
$user = 'sdr_it'
$password = "pw_$($stamp)_$suffix"
$port = $null
$containerStarted = $false
$liveBefore = $null
$failure = $null

function Invoke-Checked([string]$Label, [scriptblock]$Action) {
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Sql([string]$Sql) {
  $result = docker exec $container psql -U $user -d $database -tAc $Sql
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed: $Sql"
  }
  return ($result | Out-String).Trim()
}

try {
  docker image inspect $Image *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Required local image $Image is unavailable."
  }
  docker inspect sdr-assistant-db *> $null
  if ($LASTEXITCODE -ne 0) {
    throw 'Expected read-only live database identity check failed.'
  }
  $liveBefore = docker inspect sdr-assistant-db --format '{{.Id}}|{{.State.StartedAt}}'
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($liveBefore)) {
    throw 'Could not record the live database identity.'
  }

  for ($candidate = 55439; $candidate -le 55459; $candidate += 1) {
    $listening = Get-NetTCPConnection -State Listen -LocalPort $candidate -ErrorAction SilentlyContinue
    if (-not $listening) {
      $port = $candidate
      break
    }
  }
  if ($null -eq $port) {
    throw 'No loopback test port is available.'
  }

  Write-Output "ISOLATED_CONTAINER=$container"
  Write-Output "ISOLATED_DATABASE=$database"
  Write-Output "ISOLATED_USER=$user"
  Write-Output "ISOLATED_PORT=127.0.0.1:$port"

  docker run -d --rm --name $container `
    --tmpfs /var/lib/postgresql/data:rw `
    -e "POSTGRES_USER=$user" `
    -e "POSTGRES_PASSWORD=$password" `
    -e "POSTGRES_DB=$database" `
    -p "127.0.0.1:$port`:5432" `
    $Image | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Temporary PostgreSQL container failed to start.'
  }
  $containerStarted = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    docker exec $container pg_isready -U $user -d $database *> $null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    throw 'Temporary PostgreSQL container did not become ready.'
  }

  $mountCount = docker inspect $container --format '{{len .Mounts}}'
  if ($mountCount -ne '0') {
    throw "Unexpected mounts on temporary container: $mountCount"
  }
  $portBinding = docker inspect $container --format '{{range $p, $conf := .HostConfig.PortBindings}}{{range $conf}}{{.HostIp}}:{{.HostPort}} -> {{$p}}{{end}}{{end}}'
  Write-Output "ISOLATED_PORT_BINDING=$portBinding"
  if ($portBinding -notmatch "127\.0\.0\.1:$port") {
    throw 'Temporary container is not bound to loopback only.'
  }

  $identity = Invoke-Sql "SELECT current_database() || '|' || current_user || '|' || COALESCE(inet_server_addr()::text, 'local-socket')"
  Write-Output "DATABASE_IDENTITY=$identity"
  if ($identity -notlike "$database|$user|*") {
    throw 'Temporary database identity verification failed.'
  }
  if ((Invoke-Sql "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'") -ne '0') {
    throw 'Temporary database is not empty before migration deployment.'
  }

  $url = "postgresql://${user}:${password}@127.0.0.1:${port}/${database}"
  if ($url -match ':5433/|sdr_assistant') {
    throw 'Refusing a connection string that resembles the live database.'
  }
  $env:DATABASE_URL = $url
  $env:SDR007A_TEST_DATABASE_URL = $url
  Write-Output 'MIGRATION_DEPLOY_BEGIN'

  Push-Location (Join-Path $repo 'apps\api')
  try {
    & (Join-Path $repo 'node_modules\.bin\prisma.cmd') migrate deploy
    if ($LASTEXITCODE -ne 0) {
      throw "Migration deployment failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  $migrationCount = Invoke-Sql "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"
  Write-Output "MIGRATIONS_APPLIED=$migrationCount"
  if ($migrationCount -ne '11') {
    throw "Expected 11 applied migrations, found $migrationCount."
  }

  $tables = Invoke-Sql "SELECT string_agg(table_name, ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('lead_qualification_runs','lead_qualification_results')"
  Write-Output "STAGE05_TABLES=$tables"
  if ($tables -ne 'lead_qualification_results,lead_qualification_runs') {
    throw 'Stage 05 tables were not created as expected.'
  }

  $indexes = Invoke-Sql "SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('lead_qualification_one_active_run_per_research','lead_qualification_one_published_run_per_research')"
  Write-Output "PARTIAL_UNIQUE_INDEXES=$indexes"
  if ($indexes -ne 'lead_qualification_one_active_run_per_research,lead_qualification_one_published_run_per_research') {
    throw 'Partial unique indexes are missing.'
  }

  Invoke-Checked 'API build' { npm.cmd run build -w @sdr-assistant/api }
  Write-Output 'BUILD_PASS'

  Invoke-Checked 'Stage 05 synthetic tests' {
    npm.cmd run test -w @sdr-assistant/api -- test/lead-qualification/
  }
  Write-Output 'SYNTHETIC_TESTS_PASS'

  Invoke-Checked 'Stage 05 PostgreSQL integration tests' {
    npm.cmd run test -w @sdr-assistant/api -- test/postgres-integration/
  }
  Write-Output 'POSTGRES_INTEGRATION_TESTS_PASS'

  $liveAfter = docker inspect sdr-assistant-db --format '{{.Id}}|{{.State.StartedAt}}'
  Write-Output "LIVE_DB_IDENTITY_BEFORE=$liveBefore"
  Write-Output "LIVE_DB_IDENTITY_AFTER=$liveAfter"
  if ($liveAfter -ne $liveBefore) {
    throw 'The live database identity changed during isolated verification.'
  }

  Write-Output 'PASS: SDR-007A real PostgreSQL integration verification'
} catch {
  $failure = $_
  Write-Output "PROOF_FAILURE=$($_.Exception.Message)"
} finally {
  if ($containerStarted) {
    docker stop $container *> $null
    if ($LASTEXITCODE -ne 0) {
      docker rm -f $container *> $null
    }
  }
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SDR007A_TEST_DATABASE_URL -ErrorAction SilentlyContinue
  $stillPresent = docker ps -a --filter "name=^/$container$" --format '{{.Names}}'
  Write-Output "CLEANUP_CONTAINER_STILL_PRESENT=$stillPresent"
  if (-not [string]::IsNullOrWhiteSpace($stillPresent)) {
    Write-Output 'TEMP_CONTAINER_CLEANUP_FAILED'
    if ($null -eq $failure) {
      $failure = 'Temporary container was not removed.'
    }
  }
  if ($liveBefore -ne $null) {
    $liveFinal = docker inspect sdr-assistant-db --format '{{.Id}}|{{.State.StartedAt}}'
    Write-Output "LIVE_DB_FINAL_IDENTITY=$liveFinal"
    if ($liveFinal -ne $liveBefore) {
      Write-Output 'LIVE_DB_CHANGED_DURING_CLEANUP'
      if ($null -eq $failure) {
        $failure = 'Live database identity changed during cleanup.'
      }
    }
  }
}

if ($null -ne $failure) {
  Write-Output 'PROOF_EXIT=1'
  exit 1
}
Write-Output 'PROOF_EXIT=0'
exit 0
