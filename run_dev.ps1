# run_dev.ps1 (robust, dev = Postgres on :5000)
$ErrorActionPreference = 'Stop'

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

# ---- Backend (dev on :5000) ----
$backendPs1 = Join-Path $env:TEMP 'finance_backend_dev.ps1'
$backendContent = @'
Set-Location '{ROOT}'
. '{VENV}'

# Environment for THIS window
$env:APP_ENV      = 'dev'
# ⬇️ change if your local creds differ
$env:DATABASE_URL = 'postgresql+psycopg2://postgres:admin@localhost:5432/financial_tracker'

# Flask dev server settings
$env:FLASK_APP      = 'backend.app:create_app'
$env:FLASK_ENV      = 'development'
$env:FLASK_RUN_HOST = '127.0.0.1'
$env:FLASK_RUN_PORT = '5000'

Write-Host "[INFO] Using DATABASE_URL: $env:DATABASE_URL" -ForegroundColor Yellow
flask run
'@
$backendContent = $backendContent.Replace('{ROOT}', $root).Replace('{VENV}', $backendVenv)
Set-Content -Path $backendPs1 -Value $backendContent -Encoding UTF8

Write-Host "[INFO] Launching backend (dev, :5000)..." -ForegroundColor Cyan
Start-PSFile -filePath $backendPs1 -workDir $root

# ---- Frontend ----
$npmCmd = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path $npmCmd)) { $npmCmd = "npm.cmd" }

$frontendPs1 = Join-Path $env:TEMP 'finance_frontend_dev.ps1'
$frontendContent = @'
Set-Location '{FRONT}'

# Point Vite (proxy or client) to the dev backend
$env:VITE_API_BASE_URL = 'http://localhost:5000'
Write-Host "[INFO] VITE_API_BASE_URL=$env:VITE_API_BASE_URL" -ForegroundColor Yellow

& '{NPM}' run dev
'@
$frontendContent = $frontendContent.Replace('{FRONT}', $frontendDir).Replace('{NPM}', $npmCmd)
Set-Content -Path $frontendPs1 -Value $frontendContent -Encoding UTF8

Write-Host "[INFO] Launching frontend (VITE_API_BASE_URL=http://localhost:5000)..." -ForegroundColor Cyan
Start-PSFile -filePath $frontendPs1 -workDir $frontendDir

Write-Host "[OK] Two terminals opened: Backend (5000) and Frontend (5173)" -ForegroundColor Green
