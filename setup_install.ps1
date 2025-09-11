<#
  setup_install.ps1
  - Installs backend (Python) and frontend (Node) deps
  - Writes backend env files for Postgres (dev & demo)
  - Creates DBs if missing
  - Seeds conditionally (only when empty), or both envs with -SeedBoth, or force reseed with -ForceSeed
  - Backfills WLTP range if missing/zero
  - Verifies that 'repairs_year' data is present after seeding
#>

param(
  [switch]$AutoInstallNode,
  [switch]$SkipSeed,
  [switch]$SeedBoth,
  [switch]$ForceSeed,
  [ValidateSet('3.12','3.11','3')] [string]$PythonVersion = '3.11',
  [ValidateSet('dev','demo')]      [string]$Env = 'dev',
  # Postgres URLs (encode passwords if they have symbols)
  [string]$DevDbUrl  = 'postgresql+psycopg2://postgres:admin@127.0.0.1:5432/financial_tracker',
  [string]$DemoDbUrl = 'postgresql+psycopg2://postgres:admin@127.0.0.1:5432/financial_tracker_demo'
)

# Prefer PowerShell 7+. If running on 5.1, try to relaunch in pwsh (shim must be AFTER param).
if ($PSVersionTable.PSVersion.Major -lt 7) {
  $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
  if ($pwsh) {
    Write-Host "[INFO]  Relaunching in PowerShell 7..." -ForegroundColor Cyan
    & $pwsh.Source -NoProfile -File $PSCommandPath @args
    exit $LASTEXITCODE
  } else {
    Write-Warning "PowerShell 7 not found. Install with: winget install Microsoft.PowerShell"
    Write-Warning "Continuing in Windows PowerShell 5.1 (modern syntax disabled)."
  }
}

$ErrorActionPreference = 'Stop'

function Info($m){ Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Ok($m){   Write-Host "[OK]    $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "[FAIL]  $m" -ForegroundColor Red }

# repo root
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $repoRoot

# ---------------- helpers ----------------
function Get-PythonCmd {
  param([string]$Requested = '3.11')
  $hasPy = Get-Command py -ErrorAction SilentlyContinue
  if ($hasPy) {
    try { & py "-$Requested" -c "import sys;print(1)" *> $null; if ($LASTEXITCODE -eq 0) { return @('py', "-$Requested") } } catch {}
    try { & py -3 -c "import sys;print(1)" *> $null; if ($LASTEXITCODE -eq 0) { return @('py', '-3') } } catch {}
    try { & py -c "import sys;print(1)" *> $null; if ($LASTEXITCODE -eq 0) { return @('py') } } catch {}
  }
  $hasPython = Get-Command python -ErrorAction SilentlyContinue
  if ($hasPython) { return @('python') }
  return @()
}

function Invoke-ArrayCommand {
  param([Parameter(Mandatory=$true)][string[]]$Cmd,[string[]]$Args=@())
  $exe  = $Cmd[0]
  $rest = @()
  if ($Cmd.Count -gt 1) { $rest = $Cmd[1..($Cmd.Count-1)] }
  & $exe @rest @Args
}

function Enable-NodeOnPath {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) {
    $nodeDir = Split-Path $nodeCmd.Source
    if ($env:PATH -notmatch [regex]::Escape($nodeDir)) {
      Info "Adding $nodeDir to PATH for this session..."
      $env:PATH = "$nodeDir;$env:PATH"
    }
    return $true
  }
  $candidates = @(
    "C:\Program Files\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) {
      $dir = Split-Path $c
      Info "Adding $dir to PATH for this session..."
      $env:PATH = "$dir;$env:PATH"
      return $true
    }
  }
  return $false
}

function Install-NodeLTS {
  if (-not $AutoInstallNode) { return $false }
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) { Warn "winget not found; install Node.js LTS manually."; return $false }
  Info "Installing Node.js LTS via winget..."
  try {
    winget install --id Microsoft.OpenJDK.17 -e --silent *> $null | Out-Null  # harmless if missing
    winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements --silent
  } catch {
    Warn ("winget install failed: " + $_.Exception.Message)
    return $false
  }
  return (Enable-NodeOnPath)
}

function Run-Npx {
  param([string]$ArgsLine)
  $npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
  if (-not $npx) { $npx = Get-Command npx -ErrorAction SilentlyContinue }
  if (-not $npx) { throw "npx not found on PATH." }
  $proc = Start-Process -FilePath $npx.Source -ArgumentList $ArgsLine -NoNewWindow -Wait -PassThru
  return $proc.ExitCode
}

function Run-Npm {
  param([string]$ArgsLine)
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
  if (-not $npm) { throw "npm not found on PATH." }
  $proc = Start-Process -FilePath $npm.Source -ArgumentList $ArgsLine -NoNewWindow -Wait -PassThru
  return $proc.ExitCode
}

function Invoke-BackendPython {
  param(
    [string]$Code,
    [string]$RepoRoot
  )
  $venvPy = Join-Path $RepoRoot 'backend\.venv\Scripts\python.exe'
  if (-not (Test-Path $venvPy)) { $venvPy = 'python' }

  $prevPyPath = $env:PYTHONPATH
  if ($prevPyPath) { $env:PYTHONPATH = "$RepoRoot;$prevPyPath" } else { $env:PYTHONPATH = "$RepoRoot" }

  $tmp = Join-Path $env:TEMP ("seed_" + [guid]::NewGuid().ToString("N") + ".py")
  try {
    Set-Content -LiteralPath $tmp -Value $Code -Encoding UTF8
    & $venvPy $tmp
  } finally {
    $env:PYTHONPATH = $prevPyPath
    if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
  }
}

function Ensure-PostgresDatabase {
  param([string]$DbUrl,[string]$RepoRoot)
  Info "Ensuring database exists (backend.utils.db_bootstrap.ensure_database_exists)…"

  $old = $env:DATABASE_URL
  $env:DATABASE_URL = $DbUrl
  try {
    Invoke-BackendPython -RepoRoot $RepoRoot -Code @"
import os
from backend.utils.db_bootstrap import ensure_database_exists
ensure_database_exists(os.environ['DATABASE_URL'])
"@
  } finally {
    if ($null -ne $old) { $env:DATABASE_URL = $old } else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
  }
}


function Get-CarCount {
  param([string]$DbUrl,[string]$RepoRoot)
  $code = @'
from backend.app import create_app
from backend.models.models import db
from sqlalchemy import text
a = create_app()
with a.app_context():
    n = db.session.execute(text('SELECT COUNT(*) FROM cars')).scalar()
    print(n)
'@
  $out = Invoke-BackendPython -RepoRoot $RepoRoot -Code $code
  return [int]($out | Select-String -Pattern '^\d+$' | ForEach-Object { $_.Line } | Select-Object -Last 1)
}

function Backfill-RangeKm {
  param([string]$RepoRoot)
  Write-Host "[INFO]  Backfilling range_km where missing/zero..."
  Invoke-BackendPython -RepoRoot $RepoRoot -Code @'
from backend.app import create_app, db
from sqlalchemy import text
app = create_app()
with app.app_context():
    res = db.session.execute(text("""
        UPDATE cars
        SET range_km = CAST(ROUND(battery_capacity_kwh * 100.0 / NULLIF(consumption_kwh_per_100km, 0)) AS INTEGER)
        WHERE type_of_vehicle = 'EV'
          AND (range_km IS NULL OR range_km = 0)
          AND battery_capacity_kwh > 0
          AND consumption_kwh_per_100km > 0
    """))
    db.session.commit()
    print(f"Backfilled rows: {res.rowcount}")
'@
}

# ---------------- backend ----------------
if (-not (Test-Path '.\backend')) { Fail 'backend folder not found'; exit 1 }
Info 'Setting up backend...'
Set-Location '.\backend'

$pyCmd = Get-PythonCmd -Requested $PythonVersion
if (-not $pyCmd) { Fail "Python $PythonVersion not found (py launcher or python.exe)"; exit 1 }

if (-not (Test-Path '.\.venv')) {
  Info "Creating virtual environment (.venv) with Python $PythonVersion..."
  Invoke-ArrayCommand -Cmd $pyCmd -Args @('-m','venv','.venv')
  Ok 'Created .venv'
} else {
  Info 'Virtual environment already exists (.venv)'
}

# activate
$venvActivate = '.\.venv\Scripts\Activate.ps1'
if (-not (Test-Path $venvActivate)) { Fail "Could not find $venvActivate"; exit 1 }
. $venvActivate

Info 'Upgrading pip/setuptools/wheel...'
python -m pip install --upgrade pip setuptools wheel

if (Test-Path '.\requirements.txt') {
  Info 'Installing backend requirements...'
  pip install -r requirements.txt --prefer-binary
  Ok 'Backend dependencies installed'
} else {
  Warn 'requirements.txt not found — skipping backend install'
}

# --- Write env files for Postgres (dev/demo) ---
$envDev  = '.\.env.dev'
$envDemo = '.\.env.demo'
@"
# Backend .env.dev (dev/private)
APP_ENV=dev
DATABASE_URL=$DevDbUrl
CORS_ORIGIN=http://localhost:5173
"@ | Out-File -Encoding UTF8 $envDev
Ok 'Wrote backend .env.dev'

@"
# Backend .env.demo (demo dataset, Postgres)
APP_ENV=demo
DATABASE_URL=$DemoDbUrl
DEMO_DATABASE_URL=$DemoDbUrl
CORS_ORIGIN=http://localhost:5173
"@ | Out-File -Encoding UTF8 $envDemo
Ok 'Wrote backend .env.demo'

# keep a plain .env that points to the chosen env (overwrite to avoid confusion)
$activeEnvPath = '.\.env'
if ($Env -eq 'demo') {
  Copy-Item $envDemo $activeEnvPath -Force
} else {
  Copy-Item $envDev  $activeEnvPath -Force
}
Ok "Selected backend env: $Env (wrote backend\.env)"

# ---------------- frontend ----------------
Set-Location '..\frontend'
Info 'Setting up frontend...'

if (-not (Enable-NodeOnPath)) {
  if (-not (Install-NodeLTS)) {
    Fail 'Node.js not available. Install Node LTS and re-run.'
    Set-Location $repoRoot
    exit 1
  }
}

try {
  $nodeV = node -v
  $npmV  = npm -v
  Info "Node: $nodeV  |  npm: $npmV"
} catch {
  Warn ("Could not query node/npm versions: " + $_.Exception.Message)
}

# Install deps
$exit = 0
if (Test-Path '.\package-lock.json') {
  Info 'Installing frontend deps with npm ci...'
  $exit = Run-Npm 'ci --no-audit --no-fund'
} else {
  Info 'Installing frontend deps with npm install...'
  $exit = Run-Npm 'install --no-audit --no-fund'
}
if ($exit -ne 0) {
  Warn "npm install failed (exit $exit). Attempting cleanup and retry..."
  foreach ($name in @('esbuild','rollup','node')) { try { taskkill /IM "$name.exe" /F 2>$null | Out-Null } catch {} }
  try { attrib -R -S -H -A node_modules\* -Recurse 2>$null | Out-Null } catch {}
  if (Test-Path '.\node_modules') { cmd /c rmdir /s /q node_modules }
  if (Test-Path '.\package-lock.json') { Remove-Item '.\package-lock.json' -Force -ErrorAction SilentlyContinue }
  Run-Npm 'cache verify' | Out-Null
  $exit = Run-Npm 'install --no-audit --no-fund'
}
if ($exit -eq 0) { Ok 'Frontend dependencies installed' } else {
  Fail "Frontend install failed (exit $exit). See npm log in $env:LOCALAPPDATA\npm-cache\_logs"
  Set-Location $repoRoot
  exit $exit
}

# Ensure Playwright
try { $pkgJson = Get-Content '.\package.json' -Raw } catch { Fail 'Could not read frontend/package.json'; exit 1 }
if ($pkgJson -notmatch '"@playwright/test"\s*:') {
  Info 'Installing @playwright/test...'
  $code = Run-Npm 'install -D @playwright/test --no-audit --no-fund'
  if ($code -ne 0) { Fail 'Failed to install @playwright/test'; exit $code }
  Ok '@playwright/test installed'
} else {
  Info '@playwright/test already present'
}
Info 'Installing Playwright browsers...'
$code = Run-Npx 'playwright install'
if ($code -ne 0) { Fail 'playwright install failed'; exit $code }
Ok 'Playwright browsers installed'

# ---------------- seeding & verification ----------------
function Seed-Env {
  param([string]$EnvName,[string]$DbUrl,[string]$RepoRoot)

  # Configure env for backend
  $env:APP_ENV = $EnvName
  $env:DATABASE_URL = $DbUrl
  if ($EnvName -eq 'demo') { $env:DEMO_DATABASE_URL = $DbUrl } else { $env:DEMO_DATABASE_URL = $null }

  # Ensure DB and bootstrap schema
  Ensure-PostgresDatabase -DbUrl $DbUrl -RepoRoot $RepoRoot
  Info "Bootstrapping schema ($EnvName)…"
  Invoke-BackendPython -RepoRoot $RepoRoot -Code @'
from backend.tools.bootstrap_schema import main as _main
_main()
'@

  # Decide whether to seed
  $count = Get-CarCount -DbUrl $DbUrl -RepoRoot $RepoRoot
  Info "cars count in '$EnvName' = $count"

  if ($ForceSeed -or ($count -eq 0)) {
    Info "Seeding ($EnvName) -> $DbUrl"
    Invoke-BackendPython -RepoRoot $RepoRoot -Code @'
from backend.app import create_app
a = create_app(); ctx = a.app_context(); ctx.push()
print("APP_ENV =", a.config.get("APP_ENV"))
print("DB URI  =", a.config.get("SQLALCHEMY_DATABASE_URI"))
from backend.seeds import seed_all
seed_all.main() if hasattr(seed_all, "main") else None
ctx.pop()
'@
    Ok "Seed completed for $EnvName"
  } else {
    Ok "Skipping seed for $EnvName (cars already has $count rows). Use -ForceSeed to reseed."
  }

  # Backfill WLTP range if missing/zero (always run to heal old datasets)
  Backfill-RangeKm -RepoRoot $RepoRoot

  # Verify seed/values
  Info "Verifying dataset ($EnvName)…"
  Invoke-BackendPython -RepoRoot $RepoRoot -Code @'
from backend.app import create_app
a = create_app(); ctx = a.app_context(); ctx.push()
from backend.models.models import Car, db
from sqlalchemy import text

rows = (db.session.query(Car.model, Car.repairs_year, Car.type_of_vehicle, Car.range_km)
                 .order_by(Car.model).limit(8).all())
print("Sample cars:", rows)

ev_missing = db.session.execute(text("""
  SELECT COUNT(*) FROM cars
  WHERE type_of_vehicle IN ('EV','PHEV')
    AND (range_km IS NULL OR range_km = 0)
""")).scalar()

print("EV/PHEV rows with missing/zero range_km:", ev_missing)
ctx.pop()
'@
}

  # Recompute TCO for this env (ensures non-zero values after setup)
  Info "Recomputing TCO ($EnvName)…"
  Invoke-BackendPython -RepoRoot $RepoRoot -Code @"
from backend.app import create_app
app = create_app()
with app.test_client() as c:
    r = c.post('/api/cars/update')
    print('TCO recompute /api/cars/update ->', r.status_code)
"@


Set-Location $repoRoot

if ($SkipSeed) {
  Info 'Skipping seeding (flag set).'
} else {
  # Build list of (envName, dbUrl) pairs without ternary (PS5.1-safe)
  $targets = @()
  if ($SeedBoth) {
    $targets += ,@('dev',  $DevDbUrl)
    $targets += ,@('demo', $DemoDbUrl)
  } else {
    if ($Env -eq 'demo') {
      $targets += ,@('demo', $DemoDbUrl)
    } else {
      $targets += ,@('dev',  $DevDbUrl)
    }
  }

  foreach ($t in $targets) {
    $envName = $t[0]
    $dbUrl   = $t[1]
    Seed-Env -EnvName $envName -DbUrl $dbUrl -RepoRoot $repoRoot
  }
}

Ok "Setup complete.
- Active backend env file now points to: $Env  (backend\.env)
- DB (dev):  $DevDbUrl
- DB (demo): $DemoDbUrl
Next:
  .\run_dev.ps1   # start dev API/UI
  .\run_demo.ps1  # start demo API/UI
"
