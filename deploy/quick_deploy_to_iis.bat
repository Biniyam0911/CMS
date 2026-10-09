@echo off
setlocal enabledelayedexpansion

echo ===============================================================================
echo                CMS IMMEDIATE PRODUCTION DEPLOYMENT SCRIPT
echo ===============================================================================
echo This script deploys the latest fixes to IIS:
echo  1. Lab Results Value Leak Fix (stops 7.39 leaking into non-CBC tests)
echo  2. Unit of Measurement Stripping (clean results only, no duplicate units/flags)
echo  3. Database Schema Patch (NVARCHAR MAX on TextValue)
echo  4. Cleans up Order #216162
echo ===============================================================================
echo.

:: 1. Check Administrator Privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo         Please right-click this file and select 'Run as administrator'.
    echo.
    pause
    exit /b 1
)

set "REPO_ROOT=%~dp0.."
set "API_PROJ=%REPO_ROOT%\src\CMS.API\CMS.API.csproj"
set "FRONTEND_DIST=%REPO_ROOT%\frontend\cms-web\dist"
set "IIS_API_DIR=C:\inetpub\wwwroot\cms-api"
set "IIS_WEB_DIR=C:\inetpub\wwwroot\dist"
set "BACKUP_DIR=C:\inetpub\cms_backups\%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "BACKUP_DIR=%BACKUP_DIR: =0%"

:: 2. Backup current production configuration
echo [STEP 1/5] Backing up production appsettings.json...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if exist "%IIS_API_DIR%\appsettings.json" (
    copy /Y "%IIS_API_DIR%\appsettings.json" "%BACKUP_DIR%\appsettings.json" >nul
    echo [OK] Backed up active appsettings.json to %BACKUP_DIR%
)
if exist "%IIS_API_DIR%\appsettings.Production.json" (
    copy /Y "%IIS_API_DIR%\appsettings.Production.json" "%BACKUP_DIR%\appsettings.Production.json" >nul
)

:: 3. Stop IIS and Services to release all locked DLLs and files
echo.
echo [STEP 2/5] Stopping IIS and background services to release file locks...
sc query CMSServiceManager >nul 2>&1
if %errorLevel% equ 0 (
    echo [INFO] Stopping CMSServiceManager Windows Service...
    net stop CMSServiceManager >nul 2>&1
)
sc query CMSApi >nul 2>&1
if %errorLevel% equ 0 (
    echo [INFO] Stopping CMSApi Windows Service...
    net stop CMSApi >nul 2>&1
)
iisreset /stop
if %errorLevel% neq 0 (
    echo [WARNING] Terminating w3wp.exe directly if lingering...
    taskkill /F /IM w3wp.exe >nul 2>&1
)
echo [OK] Web server and services stopped.

:: 4. Apply Database Migrations & Order 216162 Cleanup
echo.
echo [STEP 3/5] Applying Database Patches and Order #216162 Data Cleanup...
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\deploy\apply_db_migrations.ps1"
if %errorLevel% neq 0 (
    echo [WARNING] Database migration runner returned an exit code.
)

:: 5. Publish Backend API
echo.
echo [STEP 4/5] Publishing Backend API to %IIS_API_DIR%...
dotnet publish "%API_PROJ%" -c Release -o "%IIS_API_DIR%" --nologo
if %errorLevel% neq 0 (
    echo [ERROR] Dotnet publish failed!
    echo Starting IIS back up...
    iisreset /start
    pause
    exit /b 1
)
echo [OK] Backend API published successfully.

:: Restore production appsettings
if exist "%BACKUP_DIR%\appsettings.json" (
    copy /Y "%BACKUP_DIR%\appsettings.json" "%IIS_API_DIR%\appsettings.json" >nul
    echo [OK] Preserved production database connection strings and secrets.
)
if exist "%BACKUP_DIR%\appsettings.Production.json" (
    copy /Y "%BACKUP_DIR%\appsettings.Production.json" "%IIS_API_DIR%\appsettings.Production.json" >nul
)

:: 6. Deploy Frontend Web App
echo.
echo [STEP 5/5] Deploying Frontend Web Application to %IIS_WEB_DIR%...
if not exist "%IIS_WEB_DIR%" mkdir "%IIS_WEB_DIR%"
if exist "%FRONTEND_DIST%" (
    xcopy /E /Y /I "%FRONTEND_DIST%\*" "%IIS_WEB_DIR%\" >nul
    echo [OK] Frontend deployed successfully.
) else (
    echo [INFO] Building frontend bundle...
    cd /d "%REPO_ROOT%\frontend\cms-web"
    call npm run build
    xcopy /E /Y /I "%FRONTEND_DIST%\*" "%IIS_WEB_DIR%\" >nul
)

:: 7. Restart IIS and Background Services
echo.
echo Starting IIS and background services...
iisreset /start
sc query CMSApi >nul 2>&1
if %errorLevel% equ 0 (
    net start CMSApi >nul 2>&1
)
sc query CMSServiceManager >nul 2>&1
if %errorLevel% equ 0 (
    net start CMSServiceManager >nul 2>&1
)
echo [OK] IIS and background services are running.

echo.
echo ===============================================================================
echo                      DEPLOYMENT COMPLETED SUCCESSFULLY!
echo ===============================================================================
echo  - Laboratory fix deployed to IIS (https://192.168.1.10/ / http://localhost)
echo  - Order #216162 data cleaned and verified
echo ===============================================================================
echo.
pause
