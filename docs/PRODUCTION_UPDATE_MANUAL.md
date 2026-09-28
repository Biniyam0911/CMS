# CMS Production Update & Deployment Manual
**HUDERMA Specialty Clinic (Dermatology & Venereology Center)**  
*Complete, step-by-step operational guide for pushing updates from Development to GitHub and safely applying them to the Production Server.*

---

## 1. Production Architecture & Port Map

Because the **Development Machine** and **Production Server** are separate, all software updates flow through a secure Git release pipeline:

```
[ Developer Machine ] ──(git push)──> [ GitHub (origin/main) ] ──(git pull)──> [ Production Server (Windows/IIS) ]
  - Writes code & fixes                  - Version control                      - Stops IIS & services (releases locks)
  - Runs unit tests                      - Central repository                   - Backs up active appsettings.json
  - Compiles Backend (dotnet build)                                             - Pulls latest release from GitHub
  - Builds Frontend (npm run build)                                             - Runs DB migration scripts (if any)
    (generates frontend/cms-web/dist)                                           - Publishes API & copies frontend dist
                                                                                - Restores production credentials & restarts
```

### Server Component & Port Reference

| Component | Host / Runtime | Default Port(s) | Role / Protocol |
|:---|:---|:---|:---|
| **Web Frontend (React SPA)** | IIS (`wwwroot/dist`) | `80` (HTTP) / `443` (HTTPS) | Web UI accessed by clinic staff in browsers |
| **Backend REST API** | ASP.NET Core 8 Kestrel | `5010` (Internal) | Handles business logic, EMR, Billing, Auth, SignalR |
| **Reverse Proxy (ARR)** | IIS URL Rewrite & ARR | Routes `/api` & `/uploads` ➔ `5010` | Proxies API & static receipts seamlessly through port 80/443 |
| **LIS TCP Listener #1** | Background Socket Listener | **`8004`** (TCP) | Default primary analyzer port (Hematology / ZYBIO Z3 / Mindray) |
| **LIS TCP Listener #2** | Background Socket Listener | **`10001`** (TCP) | Clinical Chemistry analyzer port |
| **LIS TCP Listener #3** | Background Socket Listener | **`10002`** (TCP) | Immunology / Urinalysis analyzer port |
| **Database (ClinicDB)** | Microsoft SQL Server | `1433` (or `8710`) | Relational database (Patients, EMR, LabOrders, Invoices) |
| **Distributed Cache** | Redis / Memurai | `6379` | Fast distributed cache and session store |
| **Background Daemon** | `CMSServiceManager` (Service) | N/A | Windows Service for background workers & scheduled reports |

---

## 2. Quick Update Cheatsheet (TL;DR)

Whenever an update is ready to be released to production:

| Step | Environment | Command / Action |
|:---|:---|:---|
| **1. Build Frontend** | Dev Machine | `cd frontend\cms-web && npm run build && cd ..\..` |
| **2. Commit & Push** | Dev Machine | `git add . && git commit -m "feat/fix: update summary" && git push origin main` |
| **3. Apply DB Scripts** | Prod Server | If any SQL migrations exist, run them in SSMS on `ClinicDB` |
| **4. Deploy Update** | Prod Server | Right-click `deploy\update_production.bat` ➔ **Run as Administrator** |
| **5. Verify Health** | Prod Server | Open `http://localhost/` in browser and test `/api/v1/laboratory/instruments/listener-status` |

---

## 3. Phase 1: On Your Development Machine

Complete these steps on your development PC before deploying to production.

### Step 1.1: Verify Tests & Backend Compilation
Open a terminal in the root repository directory (`CMS\`) and verify that the solution compiles without warnings:
```powershell
dotnet test tests\CMS.UnitTests\CMS.UnitTests.csproj
dotnet build CMS.sln
```
Ensure the build outputs **0 Errors**.

### Step 1.2: Build the Production Frontend Assets
The frontend must be pre-compiled into optimized static production bundles:
```powershell
cd frontend\cms-web
npm run build
cd ..\..
```
> [!IMPORTANT]
> The `frontend/cms-web/dist` directory is tracked by Git. Building the frontend on your development machine ensures that **the production server does not require Node.js or Vite installed**. The production server will simply pull the ready-to-serve files directly from GitHub.

### Step 1.3: Stage, Commit, and Push to GitHub
Stage all code changes together with the updated `dist/` assets and push:
```powershell
git add .
git commit -m "feat: updated laboratory results workflow, verified tab, and default LIS ports"
git push origin main
```
Confirm on [GitHub (Biniyam0911/CMS)](https://github.com/Biniyam0911/CMS) that your latest commit is visible on the `main` branch.

---

## 4. Phase 2: On Your Production Server

Log in to the **Production Server** via Remote Desktop (RDP) or console.

### Method A: Automated 1-Click Update (Recommended)

An automated deployment batch script is provided at [`deploy\update_production.bat`](file:///c:/Users/ASUS/source/repos/CMS/deploy/update_production.bat).

1. Navigate to the repository directory on the production server (e.g., `C:\CMS` or `C:\Users\ASUS\source\repos\CMS`).
2. Open the `deploy` folder.
3. **Right-click `update_production.bat` and select "Run as administrator"**.

#### What this automated script does:
1. **Safety Backup**: Backs up active `appsettings.json` and `appsettings.Production.json` to `C:\inetpub\cms_backups\<timestamp>\` to guarantee database credentials and secret keys are never lost.
2. **Releases File Locks**: Automatically stops IIS (`iisreset /stop`) and stops the `CMSServiceManager` / `CMSApi` Windows services so DLLs can be overwritten without `file in use` errors.
3. **Pulls Latest Release**: Runs `git pull origin main` to synchronize the repository with GitHub.
4. **Publishes Backend**: Compiles Release binaries to `C:\inetpub\wwwroot\cms-api` using `dotnet publish`.
5. **Restores Production Settings**: Re-applies the production database connection string and secret keys.
6. **Deploys Frontend**: Copies the latest frontend bundles to `C:\inetpub\wwwroot\dist`.
7. **Restarts Everything**: Restarts IIS (`iisreset /start`) and restarts the background Windows services.
8. **Displays Endpoints**: Prints the active web application, API, and LIS listener endpoints.

---

### Method B: Manual Step-by-Step CLI Commands

If you need manual control or are diagnosing an issue, open **Command Prompt (cmd.exe) as Administrator** on the production server and execute:

```cmd
:: 1. Navigate to repository root
cd /d C:\CMS

:: 2. Stop IIS and background daemon to unlock DLLs
iisreset /stop
sc query CMSServiceManager >nul 2>&1 && net stop CMSServiceManager

:: 3. Pull latest release from GitHub
git pull origin main

:: 4. Publish Backend API to IIS folder
dotnet publish src\CMS.API\CMS.API.csproj -c Release -o "C:\inetpub\wwwroot\cms-api" --nologo

:: 5. Deploy Frontend Web Application to IIS folder
xcopy /E /Y /I "frontend\cms-web\dist\*" "C:\inetpub\wwwroot\dist\"

:: 6. Restart IIS and background services
iisreset /start
sc query CMSServiceManager >nul 2>&1 && net start CMSServiceManager

:: 7. Verify API Health
curl http://localhost:5010/swagger
```

---

## 5. Phase 3: Handling Database Updates (Migrations & Procedures)

If the update introduces schema modifications, new tables, or updated stored procedures:

### Step 5.1: Create a Pre-Update Database Backup
Always take a snapshot of `ClinicDB` before applying schema migrations:
```powershell
sqlcmd -S localhost -d master -Q "BACKUP DATABASE [ClinicDB] TO DISK = N'C:\CMS\backups\ClinicDB_PreUpdate.bak' WITH INIT, STATS = 10;"
```

### Step 5.2: Execute Migration Scripts in SSMS
1. Open **SQL Server Management Studio (SSMS)** on the production server.
2. Connect to the local SQL Server instance (`Server=127.0.0.1,8710` or default instance).
3. In Object Explorer, expand **Databases** ➔ select **`ClinicDB`**.
4. Open the SQL migration file (located in `database/` or in the pull request).
5. Click **Execute** (or press `F5`).
6. Confirm that the query window outputs:
   ```
   Commands completed successfully.
   ```

> [!TIP]
> Database migration scripts should always be executed **either right before or immediately after** running the application update.

---

## 6. Phase 4: LIS Machine Integration (ZYBIO Z3 & Analyzers)

The CMS LIS integration features a **Passive TCP Server** built directly into the API backend. It listens on TCP ports and receives incoming MLLP/HL7 results from laboratory machines.

### 6.1. Default LIS Listening Ports
- **`8004`**: Primary analyzer port (ZYBIO Z3 Hematology / Mindray)
- **`10001`**: Clinical Chemistry analyzer port
- **`10002`**: Immunology / Urinalysis analyzer port

### 6.2. Firewall Configuration (One-Time Setup on Production)
The production server's Windows Defender Firewall must allow incoming TCP traffic from the laboratory network on these ports. Run in PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "CMS LIS Analyzer TCP Listeners (8004, 10001, 10002)" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 8004,10001,10002 `
    -Action Allow
```

### 6.3. IIS Application Pool Settings (Keep TCP Listener Active)
Because the LIS TCP listener runs as a hosted background service inside the API process, you must configure IIS so the worker process **never goes idle or sleeps**:

1. Open **IIS Manager** (`inetmgr`).
2. In the left panel, click **Application Pools**.
3. Right-click the **`cms-api`** application pool ➔ select **Advanced Settings...**.
4. Configure the following:
   - **Start Mode**: Change from `OnDemand` to **`AlwaysRunning`**.
   - **Idle Time-out (minutes)**: Change from `20` to **`0`** (disables idle shutdown).
   - **Recycling ➔ Regular Time Interval (minutes)**: Set to `0` (or schedule during off-hours, e.g. 03:00 AM).
5. In the left panel, expand **Sites** ➔ select the API website ➔ click **Advanced Settings...**:
   - **Preload Enabled**: Change to **`True`**.
6. Click **OK** and restart the application pool.

---

## 7. Phase 5: Post-Deployment Smoke Tests & Verification

Perform these 4 rapid smoke tests immediately after deploying an update:

### Test 1: API & LIS Listener Status Check
Open PowerShell on the server and check the active LIS listener ports:
```powershell
$status = Invoke-RestMethod -Uri "http://localhost:5010/api/v1/laboratory/instruments/listener-status" -Method Get
$status.data | Select-Object isListening, ports, configuredPorts | Format-List
```
**Expected output:**
```
isListening     : True
ports           : {8004, 10001, 10002}
configuredPorts : {8004, 10001, 10002}
```

### Test 2: Web Application Accessibility
1. Open a browser on a client workstation within the clinic network: `http://<SERVER-IP>/` (or domain).
2. Log in with staff credentials.
3. Verify that the Dashboard loads smoothly with no console errors.

### Test 3: Laboratory Worklist & Verified Results
1. Navigate to the **Laboratory** module (`/laboratory`).
2. Verify that the two tabs appear:
   - **Order Worklist** (shows pending/unverified orders; values pre-populate in textboxes)
   - **Verified Results** (shows verified orders with `✓ VERIFIED & APPROVED` badge)
3. Check the **Print Requisition / Referral** button on Worklist orders.
4. Check the **Print Official Report** button on Verified orders.

### Test 4: LIS Result Ingestion Test (via PowerShell)
You can inject a mock test result on port `8004` to verify end-to-end ingestion into the database:
```powershell
.\test_lis_by_orderid.ps1 -OrderId 78253 -TestId 753 -Value 29.0 -Port 8004
```
Refresh the Laboratory worklist—the parameter textbox will immediately display `29.0`!

---

## 8. Phase 6: Troubleshooting & Recovery

### Issue 1: `w3wp.exe` File Lock Error During Update
- **Symptom:** `dotnet publish` or `git pull` reports: `The process cannot access the file because it is being used by another process.`
- **Fix:** Run `iisreset /stop`. If a worker process still hangs, force-kill it before publishing:
  ```cmd
  taskkill /F /IM w3wp.exe
  taskkill /F /IM CMS.API.exe
  ```

### Issue 2: Git Conflicts on the Production Server
- **Symptom:** `error: Your local changes to the following files would be overwritten by merge.`
- **Cause:** A file or script was modified directly on the production server.
- **Fix:** Discard server-side local edits and force the repository to match GitHub:
  ```cmd
  git fetch origin
  git reset --hard origin/main
  ```

### Issue 3: Custom Production Database Connection String Lost
- **Symptom:** The API returns database connection timeout or login failed errors after an update.
- **Fix:** The automated update script creates automatic timestamped backups in `C:\inetpub\cms_backups\`. Copy the backup `appsettings.json` back into `C:\inetpub\wwwroot\cms-api\appsettings.json` and run `iisreset`.

### Issue 4: Emergency Rollback (Known-Good State in < 2 Minutes)
If a critical issue occurs in production and you need to restore the previous release immediately:
```cmd
:: Step 1: Find the previous stable commit
git log -n 5 --oneline

:: Step 2: Checkout the stable commit
git checkout <STABLE_COMMIT_HASH>

:: Step 3: Republish the previous version to IIS
deploy\update_production.bat
```
This will instantly compile and republish the known-good code and assets to IIS.
