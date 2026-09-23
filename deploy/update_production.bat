@echo off
setlocal enabledelayedexpansion

echo ===============================================================================
echo                CMS PRODUCTION AUTOMATED UPDATE SCRIPT
echo ===============================================================================
echo [INFO] This script pulls the latest release from GitHub and deploys both
echo        the Backend API (ASP.NET Core) and Frontend (React PWA) to IIS.
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
echo [STEP 1/6] Backing up production appsettings.json...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if exist "%IIS_API_DIR%\appsettings.json" (
    copy /Y "%IIS_API_DIR%\appsettings.json" "%BACKUP_DIR%\appsettings.json" >nul
    echo [OK] Backed up active appsettings.json to %BACKUP_DIR%
)
if exist "%IIS_API_DIR%\appsettings.Production.json" (
    copy /Y "%IIS_API_DIR%\appsettings.Production.json" "%BACKUP_DIR%\appsettings.Production.json" >nul
)

:: 3. Stop IIS to release all locked DLLs and files
echo.
echo [STEP 2/6] Stopping IIS to release file locks (w3wp.exe)...
iisreset /stop
if %errorLevel% neq 0 (
    echo [WARNING] iisreset /stop had an issue. Terminating w3wp.exe directly if lingering...
    taskkill /F /IM w3wp.exe >nul 2>&1
)
echo [OK] IIS stopped.

:: 4. Pull latest update from GitHub
echo.
echo [STEP 3/6] Pulling latest code and prebuilt assets from GitHub...
cd /d "%REPO_ROOT%"
git pull origin main
if %errorLevel% neq 0 (
    echo [ERROR] Git pull failed! Please check network connectivity or resolve git conflicts.
    echo Starting IIS back up...
    iisreset /start
    pause
    exit /b 1
)
echo [OK] Latest code pulled successfully.

:: 5. Publish Backend API
echo.
echo [STEP 4/6] Publishing Backend API to %IIS_API_DIR%...
dotnet publish "%API_PROJ%" -c Release -o "%IIS_API_DIR%" --nologo
if %errorLevel% neq 0 (
    echo [ERROR] Dotnet publish failed!
    echo Starting IIS back up...
    iisreset /start
    pause
    exit /b 1
)
echo [OK] Backend API published successfully.

:: 5b. Restore production configuration if it had custom settings
if exist "%BACKUP_DIR%\appsettings.json" (
    copy /Y "%BACKUP_DIR%\appsettings.json" "%IIS_API_DIR%\appsettings.json" >nul
    echo [OK] Preserved production database connection strings and secrets.
)
if exist "%BACKUP_DIR%\appsettings.Production.json" (
    copy /Y "%BACKUP_DIR%\appsettings.Production.json" "%IIS_API_DIR%\appsettings.Production.json" >nul
)

:: 6. Deploy Frontend Web App
echo.
echo [STEP 5/6] Deploying Frontend Web Application to %IIS_WEB_DIR%...
if not exist "%IIS_WEB_DIR%" mkdir "%IIS_WEB_DIR%"
if exist "%FRONTEND_DIST%" (
    xcopy /E /Y /I "%FRONTEND_DIST%\*" "%IIS_WEB_DIR%\" >nul
    echo [OK] Frontend deployed successfully.
) else (
    echo [WARNING] %FRONTEND_DIST% not found.
    echo           If NodeJS is on this server, building frontend now...
    cd /d "%REPO_ROOT%\frontend\cms-web"
    call npm run build
    xcopy /E /Y /I "%FRONTEND_DIST%\*" "%IIS_WEB_DIR%\" >nul
)

:: 7. Restart IIS
echo.
echo [STEP 6/6] Starting IIS...
iisreset /start
echo [OK] IIS is running.

:: 8. Verification & Health Check
echo.
echo ===============================================================================
echo                      UPDATE COMPLETED SUCCESSFULLY!
echo ===============================================================================
echo Server Endpoints:
echo  - Web Application: http://localhost:5000 / http://127.0.0.1
echo  - API Swagger/Base: http://localhost:5000/api/v1/health
echo  - LIS TCP Listener: Ports 5100, 2575 (Listening for ZYBIO Z3 and analyzers)
echo ===============================================================================
echo.
pause
