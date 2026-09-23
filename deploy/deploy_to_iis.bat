@echo off
echo ============================================================
echo Deploying CMS API and Frontend to IIS
echo (Please right-click and 'Run as Administrator')
echo ============================================================

echo [1/3] Stopping IIS...
iisreset /stop

echo [2/3] Publishing CMS API...
dotnet publish "%~dp0..\src\CMS.API\CMS.API.csproj" -c Release -o "C:\inetpub\wwwroot\cms-api"

echo [3/3] Deploying Frontend to IIS...
if exist "%~dp0..\frontend\cms-web\dist" (
    xcopy /E /Y /I "%~dp0..\frontend\cms-web\dist\*" "C:\inetpub\wwwroot\dist\"
)

echo Starting IIS...
iisreset /start

echo ============================================================
echo Deployment Complete!
echo ============================================================
pause
