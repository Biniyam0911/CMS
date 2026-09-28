@echo off
echo ============================================================
echo Clinic Management System (CMS) — API Windows Service Installer
echo ============================================================

:: Check Administrator Privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo         Please right-click this file and select 'Run as administrator'.
    pause
    exit /b 1
)

set SERVICE_NAME=CMSApi
set BIN_PATH="C:\inetpub\wwwroot\cms-api\CMS.API.exe"
if not exist %BIN_PATH% (
    set BIN_PATH="C:\CMS\publish\api\CMS.API.exe"
)
if not exist %BIN_PATH% (
    set BIN_PATH="%~dp0..\publish\api\CMS.API.exe"
)

echo Target binary: %BIN_PATH%

sc query %SERVICE_NAME% > NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Stopping and removing existing service '%SERVICE_NAME%'...
    sc stop %SERVICE_NAME% >nul 2>&1
    sc delete %SERVICE_NAME% >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo Registering Windows Service '%SERVICE_NAME%'...
sc create %SERVICE_NAME% binPath= %BIN_PATH% start= auto displayname= "CMS Web API Service"
sc description %SERVICE_NAME% "Clinic Management System Backend Web API (Kestrel on port 5010 and LIS TCP ports)"

echo Starting service...
sc start %SERVICE_NAME%

echo.
echo Service status:
sc query %SERVICE_NAME%
echo.
pause
