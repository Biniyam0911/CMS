@echo off
setlocal
echo ========================================================
echo  Stopping Clinic Management System (CMS)...
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-NetTCPConnection -LocalPort 5010,3000,3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo CMS services on ports 5010, 3000, and 3001 have been stopped.
timeout /t 2 >nul
exit /b 0
