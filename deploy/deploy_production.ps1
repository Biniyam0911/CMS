# =====================================================================================
# CMS Production Deployment & Update Script (PowerShell)
# Purpose: Deploys Database Patches, Backend API, and Frontend React App to Production
# Run As Administrator on the Production Windows Server
# =====================================================================================

param (
    [string]$RepoPath = "$PSScriptRoot\..",
    [string]$IisApiDir = "C:\inetpub\wwwroot\cms-api",
    [string]$IisWebDir = "C:\inetpub\wwwroot\dist",
    [string]$AppPoolName = "CMS_AppPool",
    [switch]$SkipGitPull,
    [switch]$SkipDbMigration
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "             CMS PRODUCTION AUTOMATED DEPLOYMENT                 " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Verify Administrator Privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be executed in an elevated PowerShell session (Run as Administrator)." -ForegroundColor Red
    exit 1
}

$repoRoot = (Resolve-Path $RepoPath).Path
Set-Location $repoRoot
Write-Host "[INFO] Repository Root: $repoRoot" -ForegroundColor Gray

# 2. Backup Production Configuration
$backupDir = "C:\inetpub\cms_backups\" + (Get-Date -Format "yyyyMMdd_HHmmss")
Write-Host "`n[STEP 1/6] Backing up production appsettings.json..." -ForegroundColor Yellow
if (Test-Path "$IisApiDir\appsettings.json") {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Copy-Item "$IisApiDir\appsettings.json" -Destination "$backupDir\appsettings.json" -Force
    if (Test-Path "$IisApiDir\appsettings.Production.json") {
        Copy-Item "$IisApiDir\appsettings.Production.json" -Destination "$backupDir\appsettings.Production.json" -Force
    }
    Write-Host "[OK] Production settings backed up to: $backupDir" -ForegroundColor Green
} else {
    Write-Host "[INFO] No existing appsettings found at $IisApiDir (first-time deploy or non-IIS path)." -ForegroundColor Gray
}

# 3. Stop Services and Web Server to Release Locks
Write-Host "`n[STEP 2/6] Stopping services and IIS to release file locks..." -ForegroundColor Yellow
$services = @("CMSServiceManager", "CMSApi")
foreach ($svc in $services) {
    if (Get-Service $svc -ErrorAction SilentlyContinue) {
        Write-Host "Stopping service $svc..." -ForegroundColor Gray
        Stop-Service $svc -Force -ErrorAction SilentlyContinue
    }
}

# Stop IIS or terminate worker if active
try {
    & "$env:windir\system32\iisreset.exe" /stop | Out-Null
} catch {
    Get-Process w3wp -ErrorAction SilentlyContinue | Stop-Process -Force
}
Write-Host "[OK] Services and web server stopped." -ForegroundColor Green

# 4. Pull Latest Code from Repository (if not skipped)
if (-not $SkipGitPull) {
    Write-Host "`n[STEP 3/6] Pulling latest code from git repository..." -ForegroundColor Yellow
    try {
        git pull origin main
        Write-Host "[OK] Code updated from main." -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Git pull failed or local repo has untracked changes: $_" -ForegroundColor Yellow
    }
}

# 5. Execute Database Migrations
if (-not $SkipDbMigration) {
    Write-Host "`n[STEP 4/6] Executing database migrations..." -ForegroundColor Yellow
    $migrationScript = Join-Path $PSScriptRoot "apply_db_migrations.ps1"
    if (Test-Path $migrationScript) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $migrationScript
    } else {
        Write-Host "[WARN] Migration script $migrationScript not found." -ForegroundColor Yellow
    }
}

# 6. Build & Publish Backend API
Write-Host "`n[STEP 5/6] Building and publishing Backend API..." -ForegroundColor Yellow
$apiProj = Join-Path $repoRoot "src\CMS.API\CMS.API.csproj"
if (Test-Path $apiProj) {
    dotnet publish $apiProj -c Release -o $IisApiDir --nologo
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Backend build failed!" -ForegroundColor Red
        & "$env:windir\system32\iisreset.exe" /start
        exit 1
    }
    Write-Host "[OK] Backend API published to $IisApiDir" -ForegroundColor Green
}

# Restore production appsettings
if (Test-Path "$backupDir\appsettings.json") {
    Copy-Item "$backupDir\appsettings.json" -Destination "$IisApiDir\appsettings.json" -Force
    if (Test-Path "$backupDir\appsettings.Production.json") {
        Copy-Item "$backupDir\appsettings.Production.json" -Destination "$IisApiDir\appsettings.Production.json" -Force
    }
    Write-Host "[OK] Preserved production database configuration." -ForegroundColor Green
}

# 7. Build & Deploy Frontend Web Application
Write-Host "`n[STEP 6/6] Building and deploying React Frontend..." -ForegroundColor Yellow
$frontendDir = Join-Path $repoRoot "frontend\cms-web"
if (Test-Path $frontendDir) {
    Set-Location $frontendDir
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Frontend build failed!" -ForegroundColor Red
        & "$env:windir\system32\iisreset.exe" /start
        exit 1
    }
    
    $distDir = Join-Path $frontendDir "dist"
    if (Test-Path $distDir) {
        New-Item -ItemType Directory -Force -Path $IisWebDir | Out-Null
        Copy-Item "$distDir\*" -Destination $IisWebDir -Recurse -Force
        Write-Host "[OK] Frontend static assets copied to $IisWebDir" -ForegroundColor Green
    }
}

# 8. Restart Web Server and Services
Write-Host "`nStarting IIS and background services..." -ForegroundColor Yellow
& "$env:windir\system32\iisreset.exe" /start | Out-Null
foreach ($svc in $services) {
    if (Get-Service $svc -ErrorAction SilentlyContinue) {
        Start-Service $svc -ErrorAction SilentlyContinue
    }
}

# Recycle App Pool
try {
    & "$env:windir\system32\inetsrv\appcmd.exe" recycle apppool /apppool.name:$AppPoolName | Out-Null
} catch {}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "             DEPLOYMENT COMPLETED SUCCESSFULLY!                  " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Active Endpoints:"
Write-Host " - Web App: http://localhost / https://yourclinic.com"
Write-Host " - API Base: http://localhost:5010 / http://localhost/api/v1"
Write-Host "=================================================================" -ForegroundColor Cyan
