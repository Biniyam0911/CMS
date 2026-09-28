@echo off
echo ============================================================
echo Clinic Management System (CMS) — ServiceManager Installer
echo ============================================================

:: Check Administrator Privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo         Please right-click this file and select 'Run as administrator'.
    pause
    exit /b 1
)

set SERVICE_NAME=CMSServiceManager

:: Search common publish locations
set BIN_PATH="%~dp0..\publish\service-manager\CMS.ServiceManager.exe"
if not exist %BIN_PATH% set BIN_PATH="C:\CMS\publish\service-manager\CMS.ServiceManager.exe"
if not exist %BIN_PATH% set BIN_PATH="%~dp0..\src\CMS.ServiceManager\bin\Release\net8.0\win-x64\publish\CMS.ServiceManager.exe"
if not exist %BIN_PATH% set BIN_PATH="%~dp0..\src\CMS.ServiceManager\bin\Release\net8.0\CMS.ServiceManager.exe"

echo Target binary: %BIN_PATH%

:: 1. Stop existing service and wait
sc query %SERVICE_NAME% > NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [1/3] Stopping %SERVICE_NAME%...
    net stop %SERVICE_NAME% >nul 2>&1
    taskkill /F /IM CMS.ServiceManager.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
    
    echo [2/3] Updating service configuration...
    sc config %SERVICE_NAME% binPath= %BIN_PATH% start= auto displayname= "CMS ServiceManager Daemon"
) else (
    echo [1/3] Ensuring lingering process is terminated...
    taskkill /F /IM CMS.ServiceManager.exe >nul 2>&1
    timeout /t 1 /nobreak >nul

    echo [2/3] Creating Windows Service '%SERVICE_NAME%'...
    sc create %SERVICE_NAME% binPath= %BIN_PATH% start= auto displayname= "CMS ServiceManager Daemon"
)

sc description %SERVICE_NAME% "Background service daemon for CMS (notification dispatch, scheduled reports)" >nul 2>&1

echo [3/3] Starting %SERVICE_NAME%...
net start %SERVICE_NAME%

echo.
sc query %SERVICE_NAME%
echo.
echo ============================================================
echo Installation Complete!
echo ============================================================
pause
