# run_demo.ps1  (demo = Postgres on :5001)
$ErrorActionPreference = 'Stop'

function Start-PSFile($filePath, $workDir) {
  Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -ArgumentList @("-NoExit","-ExecutionPolicy","Bypass","-File",$filePath) `
    -WorkingDirectory $workDir -WindowStyle Normal
}

$root        = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir  = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$backendVenv = Join-Path $backendDir '.venv\Scripts\Activate.ps1'
if (-not (Test-Path $backendVenv)) {
  Write-Host "[FAIL] backend venv not found at $backendVenv" -ForegroundColor Red
  exit 1
}

# ----- Backend (demo on :5001, Postgres) -----
$backendPs1 = Join-Path $env:TEMP 'finance_backend_demo.ps1'
$backendContent = @'
Set-Location '{ROOT}'
. '{VENV}'

# Ensure no leftover dev URL leaks into this window
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

# Demo env (Postgres demo DB)
$env:APP_ENV           = 'demo'
$env:DEMO_DATABASE_URL = 'postgresql+psycopg2://postgres:admin@localhost:5432/financial_tracker_demo'

# Flask dev server
$env:FLASK_APP      = 'backend.app:create_app'
$env:FLASK_ENV      = 'development'
$env:FLASK_RUN_HOST = '127.0.0.1'
$env:FLASK_RUN_PORT = '5001'

Write-Host "[INFO] DEMO Postgres: $env:DEMO_DATABASE_URL" -ForegroundColor Yellow
flask run
'@
$backendContent = $backendContent.Replace('{ROOT}', $root).Replace('{VENV}', $backendVenv)
Set-Content -Path $backendPs1 -Value $backendContent -Encoding UTF8
Write-Host "[INFO] Launching backend (demo, :5001)..." -ForegroundColor Cyan
Start-PSFile -filePath $backendPs1 -workDir $root

# ----- Frontend (point Vite to :5001) -----
$npmCmd = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path $npmCmd)) { $npmCmd = "npm.cmd" }

$frontendPs1 = Join-Path $env:TEMP 'finance_frontend_demo.ps1'
$frontendContent = @'
Set-Location '{FRONTEND}'
$env:VITE_API_BASE_URL = 'http://localhost:5001'
Write-Host "[INFO] VITE_API_BASE_URL=$env:VITE_API_BASE_URL" -ForegroundColor Yellow
& '{NPM}' run dev
'@
$frontendContent = $frontendContent.Replace('{FRONTEND}', $frontendDir).Replace('{NPM}', $npmCmd)
Set-Content -Path $frontendPs1 -Value $frontendContent -Encoding UTF8
Write-Host "[INFO] Launching frontend (VITE_API_BASE_URL=http://localhost:5001)..." -ForegroundColor Cyan
Start-PSFile -filePath $frontendPs1 -workDir $frontendDir

Write-Host "[OK] Demo up: Backend :5001, Frontend :5173" -ForegroundColor Green
