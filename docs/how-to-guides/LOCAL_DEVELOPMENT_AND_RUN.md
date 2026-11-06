# Local Development, Setup & Running Guide
**HUDERMA Specialty Clinic Management System**

[← Back to Developer Handbook](../DEVELOPER_HANDBOOK.md)

This guide provides instructions for setting up, running, and debugging the CMS application on a local development machine without requiring Antigravity.

---

## 💻 Prerequisites

Ensure the following tools are installed on your workstation:
1. **.NET 8 SDK** (Download from [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/8.0))
2. **Node.js 18+ & npm** (Download from [nodejs.org](https://nodejs.org/))
3. **Microsoft SQL Server** (SQL Server Express or Developer Edition) + **SQL Server Management Studio (SSMS)** or Azure Data Studio.
4. **Visual Studio 2022** (with ASP.NET & Web Development workload) OR **Visual Studio Code** (with C# Dev Kit extension).
5. *(Optional)* **Redis / Memurai for Windows**: If Redis is not installed, CMS automatically falls back to high-speed in-memory caching.

---

## 🗄️ Database Setup

1. Open SSMS or your SQL CLI and connect to your local SQL Server instance (e.g. `localhost\SQLEXPRESS` or `(local)`).
2. If the `ClinicDB` database does not exist:
   - Run `database/00_create_database.sql` to create the schema and initial tables.
   - Run scripts under `database/procedures/` to install stored procedures.
   - Run `database/migrations/002_performance_indexes_and_lis_quarantine.sql` to apply high-performance covering indexes and the LIS quarantine table.
   - Run `database/migration/dbOHMS_to_ClinicDB_migration.sql` or your seed scripts (`run_seed.ps1`) if populating sample clinical data.
3. Verify your connection string in `src/CMS.API/appsettings.Development.json` or `appsettings.json`:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=localhost\\sqlexpress;Database=ClinicDB;User Id=sa;Password=your_password;TrustServerCertificate=True;"
   }
   ```
   *(If using Windows Authentication, you can use: `Server=localhost\\sqlexpress;Database=ClinicDB;Trusted_Connection=True;TrustServerCertificate=True;`)*

---

## 🖥️ Running the Backend API

### Option A: Using Visual Studio 2022
1. Double-click `CMS.sln` to open the solution in Visual Studio.
2. In Solution Explorer, right-click `CMS.API` and select **Set as Startup Project**.
3. Press **F5** (Debug) or **Ctrl+F5** (Run without debugging).
4. The API will launch and listen on:
   - `http://localhost:5010` (HTTP)
   - Swagger interactive documentation will be accessible at: `http://localhost:5010/swagger`

### Option B: Using Command Line (PowerShell / Terminal)
```powershell
cd c:\Users\ASUS\source\repos\CMS\src\CMS.API
dotnet run --launch-profile "CMS.API"
```

---

## 🌐 Running the Frontend (React Vite SPA)

1. Open a new PowerShell terminal and navigate to the frontend directory:
   ```powershell
   cd c:\Users\ASUS\source\repos\CMS\frontend\cms-web
   ```
2. Install npm dependencies (only required the first time):
   ```powershell
   npm install
   ```
3. Start the Vite development hot-reload server:
   ```powershell
   npm run dev
   ```
4. Vite will start, typically at:
   - `http://localhost:5173/`
5. Open your browser and navigate to `http://localhost:5173/`. 
   - Requests made to `/api/...` in the frontend are automatically proxied to the backend at `http://localhost:5010` via `vite.config.ts`.

---

## 🧪 Running Automated Unit & Integration Tests

To verify that all core logic, performance optimizations, and services are behaving correctly:
```powershell
cd c:\Users\ASUS\source\repos\CMS
dotnet test
```

All **50 automated tests** (covering `CMS.UnitTests`, `PerformanceOptimizationTests`, `CMS.IntegrationTests`, and `CMS.E2ETests`) should pass with green checkmarks.

### 📦 Building Frontend for Production
To test the production build with code splitting and vendor chunking:
```powershell
cd frontend\cms-web
npm run build
```
Verify the output generates the optimized entry bundle (~73 kB) with chunks under `dist/assets/`.

---

## 🔬 Testing Laboratory Analyzer Integration Locally

If you want to simulate a physical lab machine (like the ZYBIO Z3 or Mindray analyzer) sending test results to your local computer:

1. The API starts the TCP listener on Port `8004` (and `10001`, `10002`).
2. You can check listener status via:
   `GET http://localhost:5010/api/v1/laboratory/instruments/listener-status`
3. In `tests/` or via PowerShell, you can use the test script `test_lis_by_orderid.ps1` to send mock HL7 or ASTM socket frames:
   ```powershell
   .\test_lis_by_orderid.ps1 -Port 8004 -OrderNumber "ORD-1002"
   ```
4. Observe the backend console output as `LisTcpListenerService` logs the incoming bytes, parses test parameters (WBC, RBC, HGB, PLT), and writes them to the database.

---

## ⚙️ Key Configuration Files

| File | Purpose |
|:---|:---|
| `src/CMS.API/appsettings.json` | Base configuration: Database connection string, JWT secret key, Token expiration, Redis host, Serilog logging sinks. |
| `src/CMS.API/appsettings.Development.json` | Overrides for local dev (enables detailed SQL logging and relaxed rate limits). |
| `frontend/cms-web/vite.config.ts` | Frontend build and dev server proxy rules (routes `/api` to port 5010). |
| `frontend/cms-web/tailwind.config.js` | UI theme configuration, custom colors, fonts, and responsive breakpoints. |
