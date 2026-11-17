# Project Guidelines & Run Commands

## Running the Application

Whenever the user says:
- `run the app`
- `run`
- `/run`
- `start the app`
- `launch the app`

Immediately execute the application startup:
1. Start the backend API daemon: `dotnet run --project src\CMS.API\CMS.API.csproj --launch-profile http --no-build` (`IsDaemon: true`, port 5010)
2. Start the frontend Vite server daemon: `npm --prefix frontend\cms-web run dev` (`IsDaemon: true`, port 3000/3001)
3. Confirm both are listening and present the links:
   - Backend API: http://localhost:5010
   - Frontend Web: http://localhost:3000
   - Antenatal Care Workspace: http://localhost:3000/antenatal-care

## Terminal / Desktop Shortcuts
The user can also launch the app outside the chat anytime by running:
- Command Prompt: `run` (or double-click `run.bat`)
- PowerShell: `.\run.ps1`
To stop the app:
- Command Prompt: `stop` (or double-click `stop.bat`)
- PowerShell: `.\stop.ps1`
