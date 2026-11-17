<#
.SYNOPSIS
    Starts the CMS Backend API and Frontend Web Server.
.DESCRIPTION
    Launches the .NET backend on http://localhost:5010 and the Vite frontend on http://localhost:3000,
    then opens the default web browser to the Antenatal Care workspace.
#>

$repoRoot = $PSScriptRoot
if (-not $repoRoot) { $repoRoot = Get-Location }

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Clinic Management System (CMS) - Startup Launcher" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Start Backend API
Write-Host "[1/2] Launching Backend API on http://localhost:5010 ..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k title CMS Backend API (:5010) && dotnet run --project src\CMS.API\CMS.API.csproj --launch-profile http" -WorkingDirectory $repoRoot

Start-Sleep -Seconds 3

# 2. Start Frontend Web
Write-Host "[2/2] Launching Frontend Web App on http://localhost:3000 ..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k title CMS Frontend Web (:3000) && npm --prefix frontend\cms-web run dev" -WorkingDirectory $repoRoot

Start-Sleep -Seconds 2

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " CMS is running successfully!" -ForegroundColor Green
Write-Host "  - Backend API:  http://localhost:5010" -ForegroundColor Yellow
Write-Host "  - Frontend Web: http://localhost:3000" -ForegroundColor Yellow
Write-Host "  - Antenatal:    http://localhost:3000/antenatal-care" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

Start-Process "http://localhost:3000/antenatal-care"
