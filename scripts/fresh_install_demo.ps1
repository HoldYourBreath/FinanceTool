param(
  [switch]$NoSeed = $false,
  [switch]$WithCars = $false,
  [string]$Db = "financial_tracker_demo",
  [string]$PgUser = "postgres",
  [string]$PgPass = "admin",
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432
)

$ErrorActionPreference = "Stop"
$env:APP_ENV = "demo"
$PgPassEnc = [System.Uri]::EscapeDataString($PgPass)
$env:SQLALCHEMY_DATABASE_URI = "postgresql://${PgUser}:${PgPassEnc}@${PgHost}:${PgPort}/${Db}"

Write-Host "== Recreate DB and create schema ==" -ForegroundColor Cyan
python scripts\bootstrap_db.py --recreate

if (-not $NoSeed) {
  Write-Host "== Seed ALL demo tables ==" -ForegroundColor Cyan
  python scripts\seed_demo_all.py --env demo

  if ($WithCars) {
    Write-Host "== Seed cars table ==" -ForegroundColor Cyan
    python scripts\seed_demo_all.py --env demo --tables cars
  }
}

Write-Host "== Verify counts ==" -ForegroundColor Cyan
python scripts\verify_counts.py
