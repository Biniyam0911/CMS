# Clinic Management System (CMS) — Production Shipping & Customer Server Deployment Guide

This guide details **which files and folders to package and ship to the customer**, followed by a **step-by-step installation and configuration guide** on the customer's server.

---

## Part 1: What Files & Folders to Ship

When preparing a release package for a customer on-premise deployment, **do not ship source code, `.git`, `node_modules`, or temporary build directories**. Package the following compiled artifacts and scripts into a single release archive (e.g. `CMS_Release_v1.0.zip`):

```
CMS_Release_v1.0/
├── database/                   # Database setup & schema migration scripts
│   ├── 00_create_database.sql
│   ├── schema/
│   │   ├── 01_tenants.sql
│   │   ├── 02_users_roles.sql
│   │   ├── 03_patients.sql
│   │   ├── 04_staff_doctors.sql
│   │   ├── 05_appointments.sql
│   │   ├── 06_encounters_diagnoses.sql
│   │   ├── 07_prescriptions_pharmacy.sql
│   │   ├── 08_billing.sql
│   │   ├── 09_laboratory.sql
│   │   ├── 10_notifications.sql
│   │   ├── 11_report_builder.sql
│   │   └── 12_audit_and_cache.sql
│   ├── procedures/
│   │   ├── 01_auth_procedures.sql
│   │   ├── 02_patient_procedures.sql
│   │   ├── 03_appointment_procedures.sql
│   │   └── 04_lab_procedures.sql
│   └── triggers/
│       └── 01_audit_triggers.sql
├── api/                        # Compiled .NET 8 Web API binaries
│   ├── CMS.API.dll
│   ├── CMS.API.exe
│   ├── appsettings.json
│   ├── appsettings.Production.json
│   └── web.config
├── service-manager/            # Compiled Windows Service worker binaries
│   ├── CMS.ServiceManager.dll
│   ├── CMS.ServiceManager.exe
│   └── appsettings.json
├── web/                        # Built React Single Page Application (SPA)
│   ├── index.html
│   ├── assets/
│   └── web.config              # IIS rewrite rule for SPA routing
└── deploy/                     # Installation and automation scripts
    ├── install_service.bat
    ├── uninstall_service.bat
    └── setup_iis.ps1
```

### How to Build These Release Artifacts Before Shipping:

1. **Web API**:
   ```powershell
   dotnet publish src/CMS.API/CMS.API.csproj -c Release -o ./release/api
   ```
2. **ServiceManager (Windows Service)**:
   ```powershell
   dotnet publish src/CMS.ServiceManager/CMS.ServiceManager.csproj -c Release -r win-x64 --self-contained false -o ./release/service-manager
   ```
3. **Frontend React SPA**:
   ```powershell
   cd frontend/cms-web
   npm run build
   # Copy dist contents into ./release/web
   ```
4. **Database & Scripts**:
   Copy the `database/` folder and `deploy/` automation scripts into `./release`.

---

## Part 2: Step-by-Step Customer Server Setup Guide

### Server Minimum System Requirements
- **Operating System**: Windows Server 2019 / 2022 (or Windows 10/11 Pro 64-bit for small clinics)
- **Processor**: 4-Core 64-bit CPU or higher
- **RAM**: 8 GB minimum (16 GB recommended)
- **Disk Space**: 50 GB free SSD storage
- **Network**: Static internal IP address for local network access

---

### Step 1: Install Server Prerequisites

Log in to the customer's server as an Administrator and install:

1. **Microsoft SQL Server Express 2019 or 2022**:
   - Install named instance `SQLEXPRESS` (default: `localhost\sqlexpress`).
   - Enable Mixed Mode Authentication (SQL Server and Windows Authentication).
   - Set the `sa` password (or create a dedicated `cms_user` account).
   - Open **SQL Server Configuration Manager** > **SQL Server Network Configuration** > **Protocols for SQLEXPRESS** > Ensure **TCP/IP** is **Enabled**.
2. **Microsoft SQL Server Management Studio (SSMS)**:
   - For executing database scripts and management.
3. **Redis / Memurai for Windows**:
   - Install Memurai Developer/Enterprise or Redis 7.x on Windows port `6379`.
   - Ensure the service starts automatically.
4. **ASP.NET Core 8.0 Hosting Bundle**:
   - Download and install the [.NET 8.0 Hosting Bundle for Windows](https://dotnet.microsoft.com/download/dotnet/8.0).
   - This installs both the .NET 8 Runtime and the IIS ASP.NET Core Module (`AspNetCoreModuleV2`).
5. **IIS Web Server**:
   - Enable IIS via *Turn Windows features on or off* (or PowerShell):
     ```powershell
     Install-WindowsFeature -name Web-Server -IncludeManagementTools
     ```
   - Install **IIS URL Rewrite Module 2.1** (required for React client-side routing).

---

### Step 2: Initialize the SQL Database

1. Open **SSMS** and connect to `localhost\sqlexpress` using the `sa` credentials.
2. Open and run the database scripts from the `database/` folder in this exact sequence:
   - `00_create_database.sql` (Creates `ClinicManagementDB`)
   - All files under `database/schema/` in numerical order (`01` through `12`)
   - All files under `database/procedures/` in numerical order (`01` through `04`)
   - All files under `database/triggers/` (`01_audit_triggers.sql`)
3. Verify that tables (`Tenants`, `Users`, `Patients`, `Invoices`, `ClinicSettings`, etc.) and default seed data are populated.

---

### Step 3: Configure and Deploy the Web API in IIS

1. Create directory `C:\CMS\API` and copy the contents of `api/` into it.
2. Edit `C:\CMS\API\appsettings.Production.json` to verify the connection strings:
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Server=localhost\\sqlexpress;Database=ClinicManagementDB;User Id=sa;Password=YourSecurePassword;TrustServerCertificate=True;",
       "Redis": "localhost:6379"
     },
     "Jwt": {
       "Key": "YourStrong32PlusCharacterSecretKeyHere!",
       "Issuer": "CMS.API",
       "Audience": "CMS.Client"
     }
   }
   ```
3. Open **Internet Information Services (IIS) Manager**:
   - Under **Application Pools**, click **Add Application Pool**:
     - Name: `CMS_ApiPool`
     - .NET CLR Version: **No Managed Code**
     - Managed pipeline mode: **Integrated**
     - Click **OK**, then right-click `CMS_ApiPool` > **Advanced Settings** > Set **Identity** to `ApplicationPoolIdentity`.
   - Under **Sites**, right-click **Sites** > **Add Website**:
     - Site name: `CMS_API`
     - Application pool: `CMS_ApiPool`
     - Physical path: `C:\CMS\API`
     - Port: `5000` (or bind to a subdomain like `api.clinic.local`).
4. Test the API by opening a browser on the server: `http://localhost:5000/api/v1/health` or `http://localhost:5000/api/v1/settings`.

---

### Step 4: Install the ServiceManager Windows Service

The ServiceManager handles background automated jobs (cache invalidation, report schedules, notifications).

1. Create directory `C:\CMS\ServiceManager` and copy the contents of `service-manager/` into it.
2. Edit `C:\CMS\ServiceManager\appsettings.json` to ensure the SQL and Redis connection strings match Step 3.
3. Open an administrative PowerShell/Command Prompt:
   ```cmd
   sc.exe create CMSServiceManager binPath= "C:\CMS\ServiceManager\CMS.ServiceManager.exe" start= auto
   sc.exe description CMSServiceManager "Clinic Management System Background Worker Daemon"
   sc.exe start CMSServiceManager
   ```
4. Verify in `services.msc` that `CMSServiceManager` is running with **Startup type: Automatic**.

---

### Step 5: Deploy the Frontend React SPA in IIS

1. Create directory `C:\inetpub\wwwroot\cms-web` (or `C:\CMS\Web`) and copy the contents of `web/` into it.
2. Ensure `web.config` is present in `C:\CMS\Web` to redirect client routes back to `index.html`:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <configuration>
     <system.webServer>
       <rewrite>
         <rules>
           <rule name="React Routes" stopProcessing="true">
             <match url=".*" />
             <conditions logicalGrouping="MatchAll">
               <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
               <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
               <add input="{REQUEST_URI}" pattern="^/(api)" negate="true" />
             </conditions>
             <action type="Rewrite" url="/" />
           </rule>
         </rules>
       </rewrite>
       <staticContent>
         <mimeMap fileExtension=".webp" mimeType="image/webp" />
       </staticContent>
     </system.webServer>
   </configuration>
   ```
3. In IIS Manager, create the static website:
   - Site name: `CMS_Web`
   - Application pool: `DefaultAppPool` (No Managed Code)
   - Physical path: `C:\CMS\Web`
   - Port: `80` (or `443` with SSL certificate).

---

### Step 6: Configure Windows Firewall for LAN Access

To allow clinic workstations, doctors, and pharmacists to access the system:
1. Open Administrative PowerShell and run:
   ```powershell
   New-NetFirewallRule -DisplayName "CMS Web Application (HTTP 80)" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "CMS Web Application (HTTPS 443)" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "CMS Backend API (TCP 5000)" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
   ```

---

### Step 7: System Verification & Acceptance Smoke Test

1. From a client machine on the network, navigate to `http://<SERVER-IP>/`.
2. Log in using the default SuperAdmin credentials.
3. Verify the following:
   - [x] Dashboard metrics load cleanly without network errors.
   - [x] Navigate to **Clinic Settings**: verify updating Clinic Name and App Icon saves and updates the titlebar and sidebar.
   - [x] Navigate to **Dispensary**: open **New Direct Order (OTC)**, verify dynamic VAT calculation, choose medication and patient/walk-in, and click **Save & Bill**.
   - [x] Navigate to **Billing & Invoices**: verify the invoice appears in the billing register.
