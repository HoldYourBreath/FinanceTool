# run_dev.ps1 (robust)
$ErrorActionPreference = 'Stop'

# Helper to open a new PowerShell window running a ps1 file
function Start-PSFile($filePath, $workDir) {
  Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -ArgumentList @("-NoExit","-ExecutionPolicy","Bypass","-File",$filePath) `
    -WorkingDirectory $workDir -WindowStyle Normal
}

$root        = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir  = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'

# ---- Backend venv check ----
$backendVenv = Join-Path $backendDir '.venv\Scripts\Activate.ps1'
if (-not (Test-Path $backendVenv)) {
  Write-Host "[FAIL] backend venv not found at $backendVenv" -ForegroundColor Red
  exit 1
}

# ---- Write a temp backend script to avoid quoting hell ----
$backendPs1 = Join-Path $env:TEMP 'finance_backend.ps1'
$backendContent = @'
Set-Location '{ROOT}'
. '{VENV}'

# Env vars for THIS window
$env:FLASK_DEBUG  = '1'
$env:DATABASE_URL = 'postgresql+psycopg2://postgres:admin@localhost:5432/financial_tracker'

Write-Host "[INFO] Using DATABASE_URL: $env:DATABASE_URL" -ForegroundColor Yellow
python -m backend.app
'@
$backendContent = $backendContent.Replace('{ROOT}', $root).Replace('{VENV}', $backendVenv)
Set-Content -Path $backendPs1 -Value $backendContent -Encoding UTF8

Write-Host "[INFO] Launching backend..." -ForegroundColor Cyan
Start-PSFile -filePath $backendPs1 -workDir $root

# ---- Frontend ----
$npmCmd = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path $npmCmd)) { $npmCmd = "npm.cmd" }

$frontendPs1 = Join-Path $env:TEMP 'finance_frontend.ps1'
$frontendContent = @'
Set-Location '{FRONT}'
& '{NPM}' run dev
'@
$frontendContent = $frontendContent.Replace('{FRONT}', $frontendDir).Replace('{NPM}', $npmCmd)
Set-Content -Path $frontendPs1 -Value $frontendContent -Encoding UTF8

Write-Host "[INFO] Launching frontend..." -ForegroundColor Cyan
Start-PSFile -filePath $frontendPs1 -workDir $frontendDir

Write-Host "[OK] Two terminals opened: Backend (5000) and Frontend (5173)" -ForegroundColor Green
