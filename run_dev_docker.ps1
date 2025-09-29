$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$compose = Join-Path $root 'docker-compose.dev.yml'

if (-not (Test-Path $compose)) {
  Write-Host "[FAIL] $compose not found" -ForegroundColor Red
  exit 1
}

Write-Host "[INFO] Bringing up dev stack (db + backend:5000 + frontend:5173)..." -ForegroundColor Cyan
docker compose -f $compose up --build
