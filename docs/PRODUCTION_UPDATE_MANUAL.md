# CMS Production Update & Deployment Manual
**HUDERMA Clinic Management System (CMS)**  
*A complete step-by-step guide for pushing updates from Development to GitHub and applying them to the Production Server.*

---

## 1. Architecture Overview

Because your **Development Machine** and **Production Server** are separate, all software updates follow a safe, 3-tier pipeline:

```
[ Developer Machine ] ──(git push)──> [ GitHub (origin/main) ] ──(git pull)──> [ Production Server (IIS) ]
  - Writes code & fixes                  - Version control                      - Stops IIS (releases locks)
  - Compiles Backend & Tests             - Central repository                   - Pulls latest release
  - Builds Frontend (npm run build)                                             - Publishes API & Frontend
                                                                                - Preserves DB configs & restarts
```

---

## 2. Quick Update Cheatsheet (TL;DR)

Whenever you have an update ready:

| Step | Location | Command / Action |
|:---|:---|:---|
| **1. Build Frontend** | Dev Machine | `cd frontend\cms-web && npm run build` |
| **2. Commit & Push** | Dev Machine | `git add . && git commit -m "Update notes" && git push origin main` |
| **3. Deploy on Prod** | Prod Server | Right-click `deploy\update_production.bat` -> **Run as Administrator** |

---

## 3. Phase 1: On Your Development Machine

Follow these steps on your development laptop/PC every time you finish making changes.

### Step 1.1: Verify Backend Compilation & Tests
Open a terminal in the root repository directory (`CMS\`) and run:
```powershell
dotnet test tests\CMS.UnitTests\CMS.UnitTests.csproj
dotnet build CMS.sln
```
Ensure both complete with **0 Errors**.

### Step 1.2: Build the Production Frontend Assets
The frontend must be compiled into optimized static HTML, CSS, and JS bundles before deploying:
```powershell
cd frontend\cms-web
npm run build
cd ..\..
```
> [!NOTE]
> The `frontend/cms-web/dist` directory is tracked in the repository. Compiling it on your development machine ensures that your production server does not need NodeJS or Vite installed—it receives the ready-to-serve production bundles directly from GitHub.

### Step 1.3: Stage, Commit, and Push to GitHub
Stage all modified files, create a descriptive commit, and push to GitHub:
```powershell
git add .
git commit -m "Feat: Update LIS passive TCP server and EMR attending doctor display"
git push origin main
```
> [!TIP]
> Verify on GitHub (https://github.com/Biniyam0911/CMS) that your latest commit appears on the `main` branch.

---

## 4. Phase 2: On Your Production Server

Log in to the **Production Server** (via Remote Desktop / RDP or directly).

### Method A: Automated 1-Click Update (Recommended)

An automated deployment script [`deploy\update_production.bat`](file:///c:/Users/ASUS/source/repos/CMS/deploy/update_production.bat) has been provided in the repository.

1. Navigate to the repository folder on the production server (e.g., `C:\CMS` or `C:\Users\...\source\repos\CMS`).
2. Go to the `deploy` folder.
3. **Right-click `update_production.bat` and select "Run as administrator"**.

#### What this automated script does for you:
1. **Backs up active production settings:** Automatically preserves `C:\inetpub\wwwroot\cms-api\appsettings.json` so production database credentials and secrets are never overwritten.
2. **Safely stops IIS (`iisreset /stop`):** Shuts down `w3wp.exe` worker processes to release file locks on running DLLs.
3. **Pulls latest code from GitHub (`git pull origin main`):** Synchronizes backend code and pre-compiled frontend assets.
4. **Publishes Backend API:** Executes `dotnet publish` to compile Release binaries into `C:\inetpub\wwwroot\cms-api`.
5. **Restores production settings:** Ensures the production database connection string is active.
6. **Deploys Frontend:** Copies updated web files to `C:\inetpub\wwwroot\dist`.
7. **Restarts IIS (`iisreset /start`):** Reboots the web server with zero stale cache.
8. **Outputs health status and active LIS listener ports.**

---

### Method B: Manual Step-by-Step Commands

If you prefer running the commands manually or need to troubleshoot, open **Command Prompt (cmd.exe) as Administrator** on the production server and run:

```cmd
:: Step 1: Navigate to repository
cd /d C:\Users\ASUS\source\repos\CMS

:: Step 2: Stop IIS to release locked DLL files
iisreset /stop

:: Step 3: Pull latest release from GitHub
git pull origin main

:: Step 4: Publish Backend API to IIS folder
dotnet publish src\CMS.API\CMS.API.csproj -c Release -o "C:\inetpub\wwwroot\cms-api" --nologo

:: Step 5: Deploy Frontend Web Application to IIS folder
xcopy /E /Y /I "frontend\cms-web\dist\*" "C:\inetpub\wwwroot\dist\"

:: Step 6: Start IIS
iisreset /start

:: Step 7: Verify API Health
curl http://localhost:5000/api/v1/health
```

---

## 5. Phase 3: Handling Database Updates

If an update includes database modifications (new tables, altered columns, or updated stored procedures):

1. **Locate the SQL Script:** SQL scripts are stored in the [`database/`](file:///c:/Users/ASUS/source/repos/CMS/database) folder (or provided as a migration script).
2. **Open SSMS (SQL Server Management Studio)** on the production server.
3. Connect to the local SQL Server instance (`Server=127.0.0.1,8710` or your production SQL instance).
4. Select database `ClinicDB`.
5. Open and execute (`F5`) the migration script.
6. **Rule of Thumb:** Always run database migrations **before or right after** updating the application binaries.

---

## 6. Phase 4: LIS Machine Integration (ZYBIO Z3 Analyzer)

The ZYBIO Z3 hematology analyzer connects **passively** to the server:

1. **Firewall Rule (One-Time Setup on Production):**
   The production server must allow incoming TCP traffic from the laboratory machine on ports `5100` and `2575`.
   Run this in PowerShell as Administrator (only needed once):
   ```powershell
   New-NetFirewallRule -DisplayName "CMS LIS Analyzer TCP Receiver (5100, 2575)" `
       -Direction Inbound -Protocol TCP -LocalPort 5100,2575 -Action Allow
   ```

2. **IIS Application Pool Settings (Keep TCP Listener Alive):**
   To ensure the background TCP listener never goes to sleep:
   - Open **IIS Manager** (`inetmgr`).
   - Go to **Application Pools** -> Select `cms-api` pool -> **Advanced Settings**.
   - Set **Start Mode** to `AlwaysRunning`.
   - Set **Idle Time-out (minutes)** to `0`.
   - Go to the API Web Site -> **Advanced Settings** -> Set **Preload Enabled** to `True`.

---

## 7. Troubleshooting & Recovery

### Issue 1: `w3wp.exe` File Lock Error During Update
- **Symptom:** `The process cannot access the file because it is being used by another process.`
- **Fix:** Run `iisreset /stop`. If a worker process still hangs, force-kill it before running the publish command:
  ```cmd
  taskkill /F /IM w3wp.exe
  ```

### Issue 2: Git Conflicts on the Production Server
- **Symptom:** `error: Your local changes to the following files would be overwritten by merge.`
- **Cause:** Someone edited a file directly on the production server.
- **Fix:** Reset the production repository to match GitHub cleanly:
  ```cmd
  git fetch origin
  git reset --hard origin/main
  ```

### Issue 3: Production Database Connection String Overwritten
- **Symptom:** API returns database connection errors after update.
- **Fix:** The automated update script creates automatic timestamps backups in `C:\inetpub\cms_backups\`. Copy the backup `appsettings.json` back into `C:\inetpub\wwwroot\cms-api\appsettings.json` and run `iisreset`.

### Issue 4: Emergency Rollback
- If an update has an unexpected bug and you need to restore the previous version immediately:
  ```cmd
  git log -n 5 --oneline
  git checkout <PREVIOUS_COMMIT_HASH>
  deploy\deploy_to_iis.bat
  ```
  This immediately republishes the previous known-good commit to IIS.
