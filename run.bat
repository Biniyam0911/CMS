@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo  Clinic Management System (CMS) - Startup Launcher
echo ========================================================

echo [1/2] Launching Backend API on http://localhost:5010 ...
start "CMS Backend API (:5010)" cmd /k "title CMS Backend API (:5010) && dotnet run --project src\CMS.API\CMS.API.csproj --launch-profile http"

timeout /t 3 /nobreak >nul

echo [2/2] Launching Frontend Web App on http://localhost:3000 ...
start "CMS Frontend Web (:3000)" cmd /k "title CMS Frontend Web (:3000) && npm --prefix frontend\cms-web run dev"

timeout /t 2 /nobreak >nul

echo ========================================================
echo  CMS is running successfully!
echo   - Backend API:  http://localhost:5010
echo   - Frontend Web: http://localhost:3000
echo   - Antenatal:    http://localhost:3000/antenatal-care
echo ========================================================

start http://localhost:3000/antenatal-care

exit /b 0
