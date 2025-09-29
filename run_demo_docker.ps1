<# ================================
 run_demo_docker.ps1
 Bring up demo stack with Docker:
 - Postgres (persistent volume)
 - Backend (Flask) on :5001
 - Frontend (Vite)  on :5173
 Seeds demo data via backend/seeds/seed_all.py

 Flags:
   -Rebuild            : force image rebuild
   -ResetData          : stop stack, remove volumes, then start fresh + seed
   -Compose <path>     : override compose file (default: docker-compose.demo.yml)
   -NoSeed             : skip seeding step
   -NoOpen             : do not auto-open the frontend in a browser
   -WaitSeconds <int>  : max seconds to wait for health (default: 180)
   -BackendServiceName : service name in compose (default: "backend")
   -HealthPath <path>  : HTTP health endpoint path (default: "/api/health")
   -BackendPort <int>  : host port for backend (default: 5001)
   -FrontendPort <int> : host port for frontend (default: 5173)
================================ #>

[CmdletBinding()]
param(
  [switch]$Rebuild,
  [switch]$ResetData,
  [string]$Compose = "docker-compose.demo.yml",
  [switch]$NoSeed,
  [switch]$NoOpen,
  [int]$WaitSeconds = 180,
  [string]$BackendServiceName = "backend",
  [string]$HealthPath = "/api/health",
  [int]$BackendPort = 5001,
  [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

# --- Sanity checks ------------------------------------------------------------
try { $null = docker -v } catch {
  Write-Fail "Docker CLI not found. Install Docker Desktop and ensure 'docker' is on PATH."
  exit 1
}
try { $null = docker info | Out-Null } catch {
  Write-Fail "Docker engine is not reachable. Start Docker Desktop and retry."
  exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$composePath = Join-Path $root $Compose
if (-not (Test-Path $composePath)) {
  Write-Fail "Compose file not found at '$composePath'."
  exit 1
}
Write-Info "Using compose file: $composePath"

# --- Optional clean start -----------------------------------------------------
if ($ResetData) {
  Write-Warn "Resetting data volumes (this will DELETE your DB data)..."
  docker compose -f $composePath down -v --remove-orphans
}

# --- Start stack --------------------------------------------------------------
$buildArg = if ($Rebuild) { "--build" } else { "" }
Write-Info "Bringing up services (detached)..."
docker compose -f $composePath up $buildArg -d

# --- Helper: get container name for a service --------------------------------
function Get-ContainerNameForService([string]$service) {
  # docker compose ps --format gives name per service
  $line = docker compose -f $composePath ps --format json | ConvertFrom-Json | Where-Object { $_.Service -eq $service } | Select-Object -First 1
  if ($null -eq $line) { return $null }
  return $line.Name
}

# --- Wait for backend health --------------------------------------------------
$containerName = Get-ContainerNameForService -service $BackendServiceName
if (-not $containerName) {
  Write-Fail "Could not find container for service '$BackendServiceName'."
  docker compose -f $composePath ps
  exit 1
}
Write-Info "Backend container: $containerName"

# Prefer container HEALTHCHECK, fall back to HTTP if no health or failing
$deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
$healthUrl = "http://localhost:$BackendPort$HealthPath"
$healthy = $false

Write-Info "Waiting for backend health (up to $WaitSeconds s)..."
while ([DateTime]::UtcNow -lt $deadline) {
  try {
    # Check health status from Docker (if defined)
    $health = docker inspect --format='{{json .State.Health}}' $containerName 2>$null | ConvertFrom-Json
    if ($health) {
      if ($health.Status -eq "healthy") { $healthy = $true; break }
      elseif ($health.Status -eq "unhealthy") {
        # Some images report unhealthy due to curl missing. Try HTTP anyway.
        try {
          $r = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
          if ($r.StatusCode -eq 200) { $healthy = $true; break }
        } catch { }
      }
    } else {
      # No healthcheck defined -> fall back to HTTP
      $r = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
      if ($r.StatusCode -eq 200) { $healthy = $true; break }
    }
  } catch {
    # container may still be starting; ignore
  }
  Start-Sleep -Milliseconds 800
}

if (-not $healthy) {
  Write-Fail "Backend failed to become healthy within $WaitSeconds s."
  Write-Info "Recent backend logs:"
  docker compose -f $composePath logs --tail=200 $BackendServiceName
  Write-Info "Container health (if any):"
  try { docker inspect --format='{{json .State.Health}}' $containerName | jq . } catch { }
  exit 1
}
Write-Ok "Backend is healthy/reachable at $healthUrl"

# --- Seed demo data (optional) ------------------------------------------------
if (-not $NoSeed) {
  Write-Info "Seeding demo data (backend/seeds/seed_all.py)..."
  try {
    docker compose -f $composePath exec -T $BackendServiceName python -m backend.seeds.seed_all
    Write-Ok "Seeding complete."
  } catch {
    Write-Warn "Seeding failed (continuing). Check backend logs for details."
  }

  # Optional: set baseline price settings (non-fatal)
  try {
    $body = @{ data = @{ interest_rate_pct = 5; downpayment_sek = 0 } } | ConvertTo-Json -Depth 3
    Invoke-RestMethod -Method Post -Uri "http://localhost:$BackendPort/api/settings/prices" -Body $body -ContentType "application/json" | Out-Null
    Write-Ok "Baseline price settings applied."
  } catch {
    Write-Warn "Could not apply baseline price settings (non-fatal)."
  }
} else {
  Write-Info "Skipping seeding due to -NoSeed."
}

# --- Open the app -------------------------------------------------------------
$frontendUrl = "http://localhost:$FrontendPort"
if (-not $NoOpen) {
  Write-Info "Opening frontend: $frontendUrl"
  try { Start-Process $frontendUrl } catch {
    Write-Warn "Could not open browser automatically. Open $frontendUrl manually."
  }
}

Write-Ok "Demo is up!  Backend: http://localhost:$BackendPort  |  Frontend: $frontendUrl"
Write-Info "Stop stack:   docker compose -f `"$Compose`" down"
Write-Info "Reset data:   .\run_demo_docker.ps1 -ResetData"
Write-Info "Force rebuild:.\run_demo_docker.ps1 -Rebuild"
