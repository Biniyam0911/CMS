# =====================================================================================
# CMS Production - Database Migration Runner
# Purpose: Executes pending SQL migration scripts against ClinicDB
# Works on all Windows machines via built-in .NET SqlClient (no sqlcmd required)
# =====================================================================================

param (
    [string]$Server = "127.0.0.1,8710",
    [string]$Database = "ClinicDB",
    [string]$User = "sa",
    [string]$Password = "say@123",
    [string]$MigrationFile = ""
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         CMS Production Database Migration Runner         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Resolve script root and repository paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path "$scriptDir\..").Path

# Try loading connection string from appsettings.json if default
$appsettingsPath = Join-Path $repoRoot "src\CMS.API\appsettings.json"
$connString = ""

if (Test-Path $appsettingsPath) {
    try {
        $json = Get-Content $appsettingsPath -Raw | ConvertFrom-Json
        if ($json.ConnectionStrings -and $json.ConnectionStrings.DefaultConnection) {
            $connString = $json.ConnectionStrings.DefaultConnection
            Write-Host "[INFO] Loaded connection string from src/CMS.API/appsettings.json" -ForegroundColor Gray
        }
    } catch {
        Write-Host "[WARN] Could not parse appsettings.json, using parameter values." -ForegroundColor Yellow
    }
}

if (-not $connString) {
    $connString = "Server=$Server;Database=$Database;User Id=$User;Password=$Password;TrustServerCertificate=True;MultipleActiveResultSets=True;"
}

# Determine migration files to run
$migrationFiles = @()
if ($MigrationFile -and (Test-Path $MigrationFile)) {
    $migrationFiles += (Resolve-Path $MigrationFile).Path
} else {
    $defaultPatch = Join-Path $repoRoot "database\migration\widen_labresults_textvalue_patch.sql"
    if (Test-Path $defaultPatch) {
        $migrationFiles += $defaultPatch
    }
    $cleanupPatch = Join-Path $repoRoot "database\migration\cleanup_order_216162_patch.sql"
    if (Test-Path $cleanupPatch) {
        $migrationFiles += $cleanupPatch
    }
}

if ($migrationFiles.Count -eq 0) {
    Write-Host "[INFO] No migration files to execute." -ForegroundColor Yellow
    exit 0
}

# Connect to SQL Server
Write-Host "[STEP 1] Connecting to SQL Server..." -ForegroundColor Yellow
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connString)
    $conn.Open()
    Write-Host "[OK] Connected to database successfully." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Database connection failed: $_" -ForegroundColor Red
    exit 1
}

# Execute each script in GO-delimited batches
foreach ($file in $migrationFiles) {
    $fileName = Split-Path -Leaf $file
    Write-Host "[STEP 2] Running migration: $fileName..." -ForegroundColor Yellow

    $scriptContent = Get-Content -Path $file -Raw -Encoding UTF8
    
    # Split by standard GO statements
    $batches = [System.Text.RegularExpressions.Regex]::Split(
        $scriptContent,
        "^\s*GO\s*$",
        [System.Text.RegularExpressions.RegexOptions]::Multiline -bor [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    foreach ($batch in $batches) {
        $trimmedBatch = $batch.Trim()
        if (-not [string]::IsNullOrWhiteSpace($trimmedBatch)) {
            try {
                $cmd = $conn.CreateCommand()
                $cmd.CommandText = $trimmedBatch
                $cmd.CommandTimeout = 120
                $cmd.ExecuteNonQuery() | Out-Null
            } catch {
                Write-Host "[ERROR] Migration batch failed in $fileName : $_" -ForegroundColor Red
                $conn.Close()
                exit 1
            }
        }
    }
    Write-Host "[OK] Migration applied successfully: $fileName" -ForegroundColor Green
}

$conn.Close()
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       Database migrations completed successfully!        " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
