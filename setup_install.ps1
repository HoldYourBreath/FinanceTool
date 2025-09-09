<# 
  setup_install.ps1
  - Installs backend (Python) and frontend (Node) deps
  - Writes backend env files for Postgres (dev & demo)
  - Creates DBs if missing
  - Seeds selected env by default (or both with -SeedBoth)
  - Verifies that 'repairs_year' data is present after seeding
#>

param(
  [switch]$AutoInstallNode,
  [switch]$SkipSeed,
  [switch]$SeedBoth,
  [ValidateSet('3.12','3.11','3')]
  [string]$PythonVersion = '3.11',
  [ValidateSet('dev','demo')]
  [string]$Env = 'dev',
  # Postgres URLs (encode passwords if they have symbols)
  [string]$DevDbUrl  = 'postgresql+psycopg2://postgres:admin@127.0.0.1:5432/financial_tracker',
  [string]$DemoDbUrl = 'postgresql+psycopg2://postgres:admin@127.0.0.1:5432/financial_tracker_demo'
)

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

function Ensure-SchemaBootstrap {
  param([string]$DbUrl,[string]$RepoRoot)

  Info "Bootstrapping schema (adding any missing columns)..."
  Invoke-BackendPython -RepoRoot $RepoRoot -Code @"
  from backend.app import create_app
  from backend.models.models import db
  from sqlalchemy import inspect, text

  app = create_app()
  with app.app_context():
    insp = inspect(db.engine)

    def ensure_col(table, name, ddl):
        cols = {c['name'] for c in insp.get_columns(table)}
        if name not in cols:
            print(f' -> Adding {table}.{name}')
            db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {ddl};'))
            db.session.commit()
        else:
            print(f' OK {table}.{name} exists')

    # --- Cars: ensure tire replacement interval (NUMERIC(4,2)) ---
    ensure_col('cars', 'tire_replacement_interval_years',
               'tire_replacement_interval_years NUMERIC(4,2)')
    db.session.execute(text('UPDATE cars SET tire_replacement_interval_years = 3 WHERE tire_replacement_interval_years IS NULL;'))
    db.session.commit()

    # --- App settings: ensure global tire change price/year (NUMERIC(10,2)) ---
    cols = {c['name'] for c in insp.get_columns('app_settings')}
    if 'tire_change_price_year' not in cols:
        print(' -> Adding app_settings.tire_change_price_year')
        db.session.execute(text('ALTER TABLE app_settings ADD COLUMN tire_change_price_year NUMERIC(10,2) DEFAULT 2000;'))
        db.session.commit()

    # Ensure singleton row exists with sane defaults
    db.session.execute(text(\"\"\"
        INSERT INTO app_settings (id, electricity_price_ore_kwh, bensin_price_sek_litre, diesel_price_sek_litre,
                                  yearly_driving_km, daily_commute_km, tire_change_price_year)
        SELECT 1, 250, 14, 15, 18000, 30, COALESCE((SELECT tire_change_price_year FROM app_settings LIMIT 1),2000)
        WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id=1);
    \"\"\"))  # no-op if exists
    db.session.commit()

    print(' ✅ Schema bootstrap done.')
"@
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

  # write code to a temp .py and execute it
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
  Invoke-BackendPython -RepoRoot $RepoRoot -Code @"
from backend.utils.db_bootstrap import ensure_database_exists
ensure_database_exists('$DbUrl')
"@
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
function Initialize-SeedEnvironment {
  param(
    [string]$EnvName,
    [string]$DbUrl,
    [string]$RepoRoot
  )

  # Ensure DB exists
  Ensure-PostgresDatabase -DbUrl $DbUrl -RepoRoot $RepoRoot

  # Configure env for backend
  $env:APP_ENV = $EnvName
  $env:DATABASE_URL = $DbUrl
  if ($EnvName -eq 'demo') { $env:DEMO_DATABASE_URL = $DbUrl }

  # --- NEW: schema bootstrap (adds tires/repairs columns etc) ---
  Info "Bootstrapping schema ($EnvName)…"
  Invoke-BackendPython -RepoRoot $RepoRoot -Code @"
from backend.tools.bootstrap_schema import main as _main
_main()
"@

  Info "Seeding ($EnvName) → $DbUrl"
  Invoke-BackendPython -RepoRoot $RepoRoot -Code @"
from backend.app import create_app
a=create_app(); ctx=a.app_context(); ctx.push()
print('APP_ENV =', a.config.get('APP_ENV'))
print('DB URI  =', a.config.get('SQLALCHEMY_DATABASE_URI'))
from backend.seeds import seed_all
seed_all.main() if hasattr(seed_all,'main') else None
ctx.pop()
"@

  # Verify seed
  Info "Verifying seed ($EnvName)…"
  Invoke-BackendPython -RepoRoot $RepoRoot -Code @"
from backend.app import create_app
a=create_app(); ctx=a.app_context(); ctx.push()
from backend.models.models import Car, db
rows = db.session.query(Car.model, Car.repairs_year, Car.type_of_vehicle).order_by(Car.model).limit(8).all()
print('Sample cars:', rows)
nulls = db.session.query(Car).filter((Car.type_of_vehicle.in_(['EV','PHEV'])) & (Car.repairs_year.is_(None))).count()
print('EV/PHEV rows with NULL repairs_year:', nulls)
ctx.pop()
"@
  Ok "Seed verified for $EnvName"
}


Set-Location $repoRoot

if ($SkipSeed) {
  Info 'Skipping seeding (flag set).'
} else {
  # Always seed BOTH envs by default
  Initialize-SeedEnvironment -EnvName 'dev'  -DbUrl $DevDbUrl  -RepoRoot $repoRoot
  Initialize-SeedEnvironment -EnvName 'demo' -DbUrl $DemoDbUrl -RepoRoot $repoRoot
}

Ok "Setup complete.
- Active backend env file now points to: $Env  (backend\.env)
- DB (dev):  $DevDbUrl
- DB (demo): $DemoDbUrl
Next:
  .\run_dev.ps1   # start dev API/UI
  .\run_demo.ps1  # start demo API/UI
"

