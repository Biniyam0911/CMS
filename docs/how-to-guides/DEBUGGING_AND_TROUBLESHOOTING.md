# CMS Debugging & Troubleshooting Playbook
**HUDERMA Specialty Clinic Management System**

[← Back to Developer Handbook](../DEVELOPER_HANDBOOK.md) | [**📖 Open Full System Errors Encyclopedia & Solutions Manual**](./SYSTEM_ERRORS_AND_SOLUTIONS.md)

> [!TIP]
> For a complete, dedicated breakdown of **every specific error code** (HTTP 400, 401, 403, 404, 409, 429, 500, EF Core Foreign Key violations, SQL Deadlocks 1205, LIS TCP socket disconnects, Chapa/Telebirr webhooks, Telegram bots, and React white screens), see the comprehensive [**System Errors & Solutions Encyclopedia**](./SYSTEM_ERRORS_AND_SOLUTIONS.md).

When an unexpected error or bug occurs in development or production, use this playbook to quickly identify the root cause and resolve it.

---

## 🔍 Where to Check Logs First

### 1. Backend Application Logs (Serilog)
All API requests, database queries, and unhandled exceptions are written to rolling log files:
- **Location**: `src/CMS.API/logs/cms_api_YYYYMMDD.log` (or `publish_output/logs/` in production).
- **Tip**: To inspect live logs in real time in PowerShell:
  ```powershell
  Get-Content -Path (Get-ChildItem src\CMS.API\logs\*.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName -Wait -Tail 50
  ```

### 2. Browser Developer Console
In Chrome or Edge, press **F12** and check:
- **Console tab**: JavaScript runtime errors, uncaught promise rejections, and failed asset loads.
- **Network tab**: Inspect failed HTTP requests (red rows), check the **Headers** (Authorization cookies) and the **Response** JSON body for the server's exact error message.

---

## 🛑 Common Issues & Solutions

---

### Issue 1: "401 Unauthorized" or Logged Out Immediately After Login

#### Symptoms:
- You log in successfully, but navigating to any page redirects you back to Login.
- API requests return HTTP status 429 or 401.

#### Root Causes & Fixes:
1. **Cookie Not Being Sent**:
   - The auth token is stored in an `HttpOnly` cookie. In development, browsers treat `http://localhost:5173` and `http://localhost:5010` as different origins.
   - **Fix**: Ensure your API requests use `credentials: 'include'` (which is already configured in `src/api/apiClient.ts`). When using Vite, ensure all requests go through the Vite proxy (`/api/...`), so the browser sees both frontend and backend on the same origin (`localhost:5173`).
2. **JWT Secret Key Mismatch**:
   - If the backend restarted and generated a new dynamic key, existing cookies become invalid.
   - **Fix**: Clear browser cookies (F12 ➔ Application ➔ Cookies ➔ Clear All) and log in again. Ensure `Jwt:Key` in `appsettings.json` is a fixed 256-bit secret string.
3. **Clock Skew / Expired Token**:
   - Check if your computer clock is out of sync. JWT token validation checks expiration timestamps.

---

### Issue 2: "403 Forbidden" Access Denied on Specific Features

#### Symptoms:
- You can access the Dashboard, but clicking "Inpatient" or "Pharmacy" shows "Access Denied" or the sidebar item is missing.

#### Root Causes & Fixes:
1. **Role-Based Access Control (RBAC)**:
   - Check what roles the user has in the database:
     ```sql
     SELECT u.Username, r.Name AS RoleName
     FROM Users u
     JOIN UserRoles ur ON u.Id = ur.UserId
     JOIN Roles r ON ur.RoleId = r.Id
     WHERE u.Username = 'doctor_user';
     ```
2. **Frontend Permissions vs Backend Authorization**:
   - The frontend checks permissions in `frontend/cms-web/src/utils/permissions.ts`.
   - The backend checks `[Authorize(Roles = "Admin,Doctor")]` on the Controller method.
   - **Fix**: If you created a new role or changed permissions, make sure both `permissions.ts` and the controller attribute match.

---

### Issue 3: Laboratory Machine (LIS) Results Not Appearing in the UI

#### Symptoms:
- The hematology analyzer (e.g. ZYBIO Z3 or Mindray) finished a test sample, but the result never appears under the patient's lab order.

#### Troubleshooting Steps:
1. **Check if the Port is Listening**:
   In PowerShell on the server machine:
   ```powershell
   Get-NetTCPConnection -LocalPort 8004 -ErrorAction SilentlyContinue
   ```
   If nothing is returned, the background service or API listener is not running. Check API logs for socket bind errors.
2. **Windows Defender Firewall**:
   - Physical lab machines communicate via LAN IP. The server's Windows Firewall must allow incoming TCP traffic on ports **8004**, **10001**, and **10002**.
   - Test connectivity from the lab technician PC:
     ```powershell
     Test-NetConnection -ComputerName <SERVER_IP> -Port 8004
     ```
3. **Specimen Barcode / Order Number Match & Quarantine**:
   - The analyzer sends the sample ID entered into the machine (e.g. `ORD-216162` or barcode sticker).
   - If the technician typed an unrecognized number or scanned an MRN, the CMS will **not guess or assign it to an arbitrary patient**. Instead, it safely quarantines the raw packet into `UnassignedLabResults` and logs:
     `"No matching LabOrder found for specimen barcode/sample '...'. Quarantining result in UnassignedLabResults."`
   - Check the quarantine table in SSMS:
     ```sql
     SELECT TOP 10 Id, SampleId, RemoteEndPoint, SummaryText, ReceivedAt, Status 
     FROM UnassignedLabResults 
     WHERE Status = 'PendingReview';
     ```
   - In the frontend, the lab technician can manually match the quarantined result to the patient's lab order.

---

### Issue 4: Database Errors (Column Not Found / Migration Mismatch)

#### Symptoms:
- HTTP 500 error: `Invalid column name 'MiddleName'` or `Cannot insert duplicate key`.

#### Root Causes & Fixes:
- The C# entity code was updated with a new property, but the SQL Server database schema was not migrated yet.
- **Fix**: Check `database/migrations/` and run any pending `.sql` files against `ClinicDB` using SSMS.
- Always check that the SQL data types match the C# types (e.g. `NVARCHAR(MAX)` vs `string`, `DATETIME2` vs `DateTime`).

---

### Issue 5: SignalR Live Updates Not Working

#### Symptoms:
- When a doctor finishes an encounter, the reception queue or waiting room TV does not automatically update unless the page is manually refreshed.

#### Troubleshooting Steps:
1. In the browser console, look for SignalR connection messages:
   - `[SignalR] Connected to /hubs/notifications` (healthy)
   - `[SignalR] Error: Failed to start the connection` (unhealthy)
2. Ensure WebSocket connections are enabled in IIS if running behind IIS reverse proxy (IIS ➔ Add Roles and Features ➔ Web Server ➔ Application Development ➔ **WebSocket Protocol** must be checked).
3. If WebSockets are blocked by corporate proxies, SignalR will automatically negotiate fallback to Server-Sent Events (SSE) or Long Polling.
