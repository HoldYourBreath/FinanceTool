<# 
  setup_install.ps1
  - Installs backend (Python) and frontend (Node) dependencies
  - Creates backend .env with defaults if missing
  - Seeds the database at the end (skip with -SkipSeed)
  - Optionally installs Node LTS with -AutoInstallNode (winget)
#>

param(
  [switch]$AutoInstallNode,
  [switch]$SkipSeed,
  [ValidateSet('3.12','3.11','3')]
  [string]$PythonVersion = '3.11'
)

$ErrorActionPreference = 'Stop'

function Info($m){ Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Ok($m){   Write-Host "[OK]    $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "[FAIL]  $m" -ForegroundColor Red }

# repo root (this script's folder)
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $repoRoot

# ---------------- helpers ----------------
function Get-PythonCmd {
  param([string]$Requested = '3.11')
  $hasPy = Get-Command py -ErrorAction SilentlyContinue
  if ($hasPy) {
    try { & py "-$Requested" -c "import sys;print(1)" > $null 2>&1; if ($LASTEXITCODE -eq 0) { return @('py', "-$Requested") } } catch {}
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

function Ensure-Node-On-Path {
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
  if (-not $winget) {
    Warn "winget not found; cannot auto-install Node. Install Node.js LTS manually and re-run."
    return $false
  }
  Info "Installing Node.js LTS via winget..."
  try {
    winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements --silent
  } catch {
    Warn ("winget install failed: " + $_.Exception.Message)
    return $false
  }
  return (Ensure-Node-On-Path)
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

# .env
$envPath = '.\.env'
if (-not (Test-Path $envPath)) {
@"
# --- Backend .env (generated) ---
FLASK_DEBUG=1
CORS_ORIGIN=http://localhost:5173
SQLALCHEMY_DATABASE_URI=sqlite:///dev.db
# PostgreSQL example:
# SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://postgres:password@localhost:5432/financial_tracker
"@ | Out-File -Encoding UTF8 $envPath
  Ok 'Created backend .env'
} else {
  Info 'backend .env already exists — leaving it unchanged'
}

# ---------------- frontend ----------------
Set-Location '..\frontend'
Info 'Setting up frontend...'

if (-not (Ensure-Node-On-Path)) {
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

# Install dependencies (prefer lockfile)
$exit = 0
if (Test-Path '.\package-lock.json') {
  Info 'Installing frontend deps with npm ci...'
  $exit = Run-Npm 'ci --no-audit --no-fund'
} else {
  Info 'Installing frontend deps with npm install...'
  $exit = Run-Npm 'install --no-audit --no-fund'
}

# Fallback if lockfile mismatch / flakiness
if ($exit -ne 0) {
  Warn "npm install failed (exit $exit). Attempting cleanup and retry..."
  foreach ($name in @('esbuild','rollup','node')) { try { taskkill /IM "$name.exe" /F 2>$null | Out-Null } catch {} }
  try { attrib -R -S -H -A node_modules\* -Recurse 2>$null | Out-Null } catch {}
  if (Test-Path '.\node_modules') { cmd /c rmdir /s /q node_modules }
  if (Test-Path '.\package-lock.json') { Remove-Item '.\package-lock.json' -Force -ErrorAction SilentlyContinue }
  Run-Npm 'cache verify' | Out-Null
  $exit = Run-Npm 'install --no-audit --no-fund'
}

if ($exit -eq 0) {
  Ok 'Frontend dependencies installed'
} else {
  Fail "Frontend install failed (exit $exit). See npm log in $env:LOCALAPPDATA\npm-cache\_logs"
  Set-Location $repoRoot
  exit $exit
}

# Ensure @playwright/test & browsers are present
try {
  $pkgJson = Get-Content '.\package.json' -Raw
} catch {
  Fail 'Could not read frontend/package.json'; exit 1
}

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

# ---------------- seeding ----------------
function Run-Seed {
  param([string]$RepoRoot)

  $venvPy = Join-Path $RepoRoot 'backend\.venv\Scripts\python.exe'
  if (-not (Test-Path $venvPy)) { $venvPy = 'python' }

  # Ensure backend.* imports work regardless of CWD
  $prevPyPath = $env:PYTHONPATH
  if ($prevPyPath) { $env:PYTHONPATH = "$RepoRoot;$prevPyPath" } else { $env:PYTHONPATH = "$RepoRoot" }

  Info 'Seeding database...'
  $code = 0
  try {
    # Run the orchestrator as a module so absolute imports resolve
    & $venvPy '-m' 'backend.seeds.seed_all'
    $code = $LASTEXITCODE
  } catch {
    $code = 1
    Warn ("Exception while running backend.seeds.seed_all: " + $_.Exception.Message)
  } finally {
    $env:PYTHONPATH = $prevPyPath
  }

  if ($code -ne 0) {
    Fail ("Seeding failed (exit " + $code + ").")
    exit $code
  } else {
    Ok 'Seeding completed.'
  }
}

Set-Location $repoRoot
if ($SkipSeed) {
  Info 'Skipping seeding (flag set).'
} else {
  Run-Seed -RepoRoot $repoRoot
}

Ok 'Setup complete. Next: .\run_dev.ps1 to start servers.'
