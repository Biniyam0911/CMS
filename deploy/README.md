# On-Premise Deployment Guide — Clinic Management System (CMS)

## Prerequisites
- **OS**: Windows Server 2019 / 2022 or Windows 10/11 Pro
- **Database**: Microsoft SQL Server Express 2019/2022 (`localhost\sqlexpress`)
- **Cache**: Redis 7.x for Windows or Memurai
- **Web Server**: IIS 10+ with ASP.NET Core Hosting Bundle 8.0 installed
- **Runtime**: .NET 8.0 SDK / Runtime

---

## 1. Database Setup
1. Open SQL Server Management Studio (SSMS) connecting to `localhost\sqlexpress`.
2. Login with `sa` / `say@123`.
3. Execute database scripts in exact numerical order from `database/`:
   ```bash
   00_create_database.sql
   schema/01_tenants.sql
   schema/02_users_roles.sql
   schema/03_patients.sql
   schema/04_staff_doctors.sql
   schema/05_appointments.sql
   schema/06_encounters_diagnoses.sql
   schema/07_prescriptions_pharmacy.sql
   schema/08_billing.sql
   schema/09_laboratory.sql
   schema/10_notifications.sql
   schema/11_report_builder.sql
   schema/12_audit_and_cache.sql
   procedures/01_auth_procedures.sql
   procedures/02_patient_procedures.sql
   procedures/03_appointment_procedures.sql
   procedures/04_lab_procedures.sql
   triggers/01_audit_triggers.sql
   ```

---

## 2. API Deployment (IIS)
1. Publish the Web API project:
   ```bash
   dotnet publish src/CMS.API/CMS.API.csproj -c Release -o C:\inetpub\wwwroot\cms-api
   ```
2. Open IIS Manager, create an Application Pool `CMSAppPool` (.NET CLR Version: `No Managed Code`).
3. Add a new Site pointing to `C:\inetpub\wwwroot\cms-api` on Port `5000`.

---

## 3. ServiceManager Daemon Installation
1. Publish the ServiceManager worker project:
   ```bash
   dotnet publish src/CMS.ServiceManager/CMS.ServiceManager.csproj -c Release -r win-x64 --self-contained false -o C:\CMS\ServiceManager
   ```
2. Run `deploy/install_service.bat` as Administrator to install and start `CMSServiceManager` Windows Service.

---

## 4. Frontend SPA Deployment
1. Build the React SPA:
   ```bash
   cd frontend/cms-web
   npm run build
   ```
2. Copy `frontend/cms-web/dist` contents to IIS static site directory (`C:\inetpub\wwwroot\cms-web`) on Port `80` or `443`.
