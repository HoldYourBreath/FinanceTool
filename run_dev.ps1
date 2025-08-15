<#
  run_dev.ps1
  - Starts Flask backend and Vite frontend
  - Each in its own PowerShell window
#>

$ErrorActionPreference = 'Stop'

function Start-Terminal($workDir, $command){
  $ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $args = "-NoExit -ExecutionPolicy Bypass -Command ""Set-Location '$workDir'; $command"""
  Start-Process -FilePath $ps -ArgumentList $args -WorkingDirectory $workDir -WindowStyle Normal
}

$root = (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Backend
$backendDir = Join-Path $root 'backend'
$backendVenv = Join-Path $backendDir '.venv\Scripts\Activate.ps1'
if (-not (Test-Path $backendVenv)) {
  Write-Host "[FAIL] backend venv not found at $backendVenv" -ForegroundColor Red
  exit 1
}
$backendCmd = ". '$backendVenv'; `$env:FLASK_DEBUG='1'; python .\app.py"
Write-Host "[INFO] Launching backend..." -ForegroundColor Cyan
Start-Terminal -workDir $backendDir -command $backendCmd

# Frontend (use npm.cmd and ensure node dir on PATH)
$frontendDir = Join-Path $root 'frontend'
$npmCmd = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path $npmCmd)) { $npmCmd = "npm.cmd" }
$frontendCmd = "& '$npmCmd' run dev"
Write-Host "[INFO] Launching frontend..." -ForegroundColor Cyan
Start-Terminal -workDir $frontendDir -command $frontendCmd

Write-Host "[OK]  Two terminals opened: Backend (port 5000) and Frontend (port 5173)" -ForegroundColor Green
