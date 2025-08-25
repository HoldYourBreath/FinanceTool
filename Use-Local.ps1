Copy-Item backend/.env.local backend/.env -Force
Copy-Item frontend/.env.local frontend/.env -Force
Write-Host "✅ Using LOCAL (private) profile"
