param(
  [switch]$NoSeed = $false,
  [switch]$KeepEnv = $false   # set if you don't want to restore original backend\.env
)

$ErrorActionPreference = "Stop"

# Ensure we run from repo root (this script is in scripts/)
Set-Location -Path (Join-Path $PSScriptRoot "..")

# --- Force backend to DEMO for the whole run (so create_app uses demo DB) ---
$envPath      = "backend\.env"
$backupEnv    = "backend\.env.prev"
$demoEnvPath  = "backend\.env.demo"

if (Test-Path $envPath) { Copy-Item $envPath $backupEnv -Force }
Copy-Item $demoEnvPath $envPath -Force

# Also set helpful env vars (create_app may still read them)
$env:APP_ENV = "demo"
# Optional: if your app honors these, they match .env.demo
$env:SQLALCHEMY_DATABASE_URI = "postgresql+psycopg2://postgres:admin@127.0.0.1:5432/financial_tracker_demo"
$env:DATABASE_URL            = $env:SQLALCHEMY_DATABASE_URI

# Prevent private dir from hijacking seeder discovery
Remove-Item Env:SEED_DIR -ErrorAction Ignore
Remove-Item Env:SEED_FILE_ACC_INFO -ErrorAction Ignore

Write-Host "== Recreate DB and create schema ==" -ForegroundColor Cyan
& python scripts/bootstrap_db.py --recreate

if (-not $NoSeed) {
  Write-Host "== Seeding acc_info ==" -ForegroundColor Cyan
  & python -m backend.seeds.seed_acc_info

  # Add other seeders here as you implement them, e.g.:
  # Write-Host "== Seeding investments ==" -ForegroundColor Cyan
  # & python -m backend.seeds.seed_investments
}

Write-Host "== Verify counts ==" -ForegroundColor Cyan

# Write a verify script under repo so `backend` is importable
$verifyPath = Join-Path $PSScriptRoot "verify_counts.py"
@'
from __future__ import annotations
import sys
from pathlib import Path
from sqlalchemy import text

# ensure repo root importable regardless of CWD
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app import create_app
from backend.models.models import db

tables = ["acc_info","investments","months","incomes","expenses","financing","planned_purchases"]

app = create_app()
with app.app_context():
    print(f"DB: {db.engine.url}")
    for t in tables:
        try:
            n = db.session.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
            print(f"{t}: {n}")
        except Exception as e:
            print(f"{t}: (missing) {e}")
'@ | Set-Content -Path $verifyPath -Encoding UTF8

& python $verifyPath

if (-not $KeepEnv) {
  # restore original backend\.env
  if (Test-Path $backupEnv) { Copy-Item $backupEnv $envPath -Force; Remove-Item $backupEnv -Force }
}
