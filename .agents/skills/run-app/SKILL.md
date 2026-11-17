---
name: run-app
description: Launches and verifies the Clinic Management System (CMS) services (Backend .NET API on port 5010 and Frontend Vite dev server on port 3000/3001). Triggered when the user asks to "run the app", "start the app", "launch the app", or types "run" or "/run".
---

# Run CMS Application Workflow

When the user asks to run or start the app (or types `run`, `/run`, `run the app`, `start app`), follow these steps:

1. **Check if ports are already listening**:
   Check if port `5010` (Backend API) and port `3000`/`3001` (Frontend) are already active:
   ```powershell
   Get-NetTCPConnection -LocalPort 5010,3000,3001 -ErrorAction SilentlyContinue
   ```

2. **Start Backend API Daemon (if not already running)**:
   Launch the .NET API daemon in the background:
   - Tool: `run_command`
   - `CommandLine`: `dotnet run --project src\CMS.API\CMS.API.csproj --launch-profile http --no-build`
   - `IsDaemon`: `true`
   - `WaitMsBeforeAsync`: `500`
   - `toolSummary`: `Start backend API daemon`

3. **Start Frontend Web Daemon (if not already running)**:
   Launch the Vite frontend server in the background:
   - Tool: `run_command`
   - `CommandLine`: `npm --prefix frontend\cms-web run dev`
   - `IsDaemon`: `true`
   - `WaitMsBeforeAsync`: `500`
   - `toolSummary`: `Start Vite frontend server`

4. **Verify Health**:
   Wait 3–5 seconds and perform health checks:
   - Frontend: `Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing`
   - Backend: `Invoke-WebRequest -Uri "http://localhost:5010/api/v1/settings" -UseBasicParsing` (Expect 401 Unauthorized or 200 OK)

5. **Report to User**:
   Provide clickable links:
   - **Backend API**: http://localhost:5010
   - **Frontend Web**: http://localhost:3000
   - **Antenatal Care (ANC)**: http://localhost:3000/antenatal-care
