<#
.SYNOPSIS
    Stops all background processes listening on CMS ports (5010, 3000, 3001).
#>

Write-Host "Stopping Clinic Management System (CMS)..." -ForegroundColor Yellow

$ports = @(5010, 3000, 3001)
$pidsToKill = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

if ($pidsToKill) {
    foreach ($pidNum in $pidsToKill) {
        try {
            $p = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
            if ($p) {
                Write-Host "Killing process: $($p.ProcessName) (PID: $pidNum)" -ForegroundColor Red
                Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
    Write-Host "CMS services successfully stopped." -ForegroundColor Green
} else {
    Write-Host "No active CMS services found running on ports 5010, 3000, or 3001." -ForegroundColor Gray
}
