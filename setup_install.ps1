<#
  setup_install.ps1
  - Installs backend (Python) and frontend (Node) dependencies
  - Creates backend .env with defaults if missing
  - Does NOT start servers
  - Adds Node to PATH for this session; can auto-install Node LTS if missing (use -AutoInstallNode)
#>

param(
  [switch]$AutoInstallNode
)

$ErrorActionPreference = 'Stop'

function Info($m){ Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Ok($m){   Write-Host "[OK]    $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "[FAIL]  $m" -ForegroundColor Red }

# Remember repo root & jump there
$repoRoot = (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -Path $repoRoot

# -------------------- Backend --------------------
if (-not (Test-Path '.\backend')) { Fail 'backend folder not found'; exit 1 }
Info 'Setting up backend...'
Set-Location '.\backend'

# Pick python launcher
$pythonCmd = 'python'
if (Get-Command py -ErrorAction SilentlyContinue) { $pythonCmd = 'py -3.12' }

# Create venv
if (-not (Test-Path '.\.venv')) {
  Info 'Creating virtual environment (.venv)...'
  & $pythonCmd -m venv .venv
  Ok 'Created .venv'
} else {
  Info 'Virtual environment already exists (.venv)'
}

# Activate venv
$venvActivate = '.\.venv\Scripts\Activate.ps1'
if (-not (Test-Path $venvActivate)) { Fail "Could not find $venvActivate"; exit 1 }
. $venvActivate

# Upgrade pip toolchain
Info 'Upgrading pip/setuptools/wheel...'
python -m pip install --upgrade pip setuptools wheel

# Install backend deps
if (Test-Path '.\requirements.txt') {
  Info 'Installing backend requirements...'
  pip install -r requirements.txt --prefer-binary
  Ok 'Backend dependencies installed'
} else {
  Warn 'requirements.txt not found — skipping backend install'
}

# Ensure backend .env
$envPath = '.\.env'
if (-not (Test-Path $envPath)) {
  Info 'Creating backend .env with defaults (SQLite)...'
  @"
# Flask
FLASK_DEBUG=1
CORS_ORIGIN=http://localhost:5173

# Database (dev default = SQLite)
SQLALCHEMY_DATABASE_URI=sqlite:///dev.db
"@ | Out-File -Encoding ASCII $envPath
  Ok 'Created backend .env'
} else {
  Info 'backend .env already exists — leaving it unchanged'
}

# -------------------- Frontend --------------------
Set-Location '..\frontend'
Info 'Setting up frontend...'

function Add-NodeToPath {
  $candidates = @(
    "C:\Program Files\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
  )
  $nodeExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($nodeExe) {
    $nodeDir = Split-Path $nodeExe
    if ($env:PATH -notmatch [regex]::Escape($nodeDir)) {
      Info "Adding $nodeDir to PATH for this session..."
      $env:PATH = "$nodeDir;$env:PATH"
    }
    return $true
  }
  return $false
}

# Ensure Node is available on PATH for this session
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (-not (Add-NodeToPath)) {
        Warn 'Node.js not found on PATH. Install Node.js LTS and rerun this script.'
        Set-Location $repoRoot
        exit 1
    }
}

# *** Force PATH to include the directory that contains node.exe ***
$nodeCmd = Get-Command node -ErrorAction Stop
$nodeDir = Split-Path $nodeCmd.Source
if ($env:PATH -notmatch [regex]::Escape($nodeDir)) {
    Info "Adding $nodeDir to PATH for this session..."
    $env:PATH = "$nodeDir;$env:PATH"
}

# Prefer npm.cmd (avoid PS shim)
$npmCmd = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path $npmCmd)) { $npmCmd = "npm.cmd" }

# Prefer npm.cmd
$npmCmd = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path $npmCmd)) { $npmCmd = "npm.cmd" }

function Run-Npm {
  param([string]$argsLine)
  $p = Start-Process -FilePath $npmCmd -ArgumentList $argsLine -NoNewWindow -Wait -PassThru
  return $p.ExitCode
}

function Do-NpmInstall {
  if (Test-Path '.\package-lock.json') {
    Info 'Installing with npm ci (lockfile present)...'
    return (Run-Npm 'ci')
  } else {
    Info 'Installing with npm install (no lockfile found)...'
    return (Run-Npm 'install')
  }
}

$code = Do-NpmInstall

if ($code -ne 0) {
  Warn "npm install failed (exit $code). Attempting cleanup and retry..."

  # Kill possible locks (quiet)
  try { taskkill /IM esbuild.exe /F 2>$null | Out-Null } catch {}
  try { taskkill /IM node.exe    /F 2>$null | Out-Null } catch {}

  # Clear attributes and remove dirs (quiet)
  & attrib.exe -R -S -H "node_modules\@esbuild\win32-x64\esbuild.exe" 2>$null
  cmd /c rmdir /s /q node_modules
  Remove-Item '.\package-lock.json' -Force -ErrorAction SilentlyContinue

  # Cache verify and reinstall
  Run-Npm 'cache verify' | Out-Null
  $code = Run-Npm 'install'
}

if ($code -eq 0) {
  Ok 'Frontend dependencies installed'
} else {
  Fail "Frontend install failed (exit $code). See npm log in $env:LOCALAPPDATA\npm-cache\_logs"
  exit $code
}


# Back to repo root
Set-Location $repoRoot
Ok 'Setup complete. Next run: .\run_dev.ps1 to start servers.'
