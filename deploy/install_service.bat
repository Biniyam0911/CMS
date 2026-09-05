@echo off
echo ============================================================
echo Clinic Management System (CMS) — ServiceManager Installer
echo ============================================================

set SERVICE_NAME=CMSServiceManager
set BIN_PATH="%~dp0src\CMS.ServiceManager\bin\Release\net8.0\win-x64\publish\CMS.ServiceManager.exe"

sc query %SERVICE_NAME% > NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Stopping and deleting existing service...
    sc stop %SERVICE_NAME%
    sc delete %SERVICE_NAME%
)

echo Creating Windows Service '%SERVICE_NAME%'...
sc create %SERVICE_NAME% binPath= %BIN_PATH% start= auto displayname= "CMS ServiceManager Daemon"
sc description %SERVICE_NAME% "Background service daemon for CMS (HL7 listener, notification dispatch, scheduled reports)"

echo Starting service...
sc start %SERVICE_NAME%

echo Installation complete!
pause
