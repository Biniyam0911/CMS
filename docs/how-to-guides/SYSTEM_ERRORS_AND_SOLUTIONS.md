# CMS System Error Encyclopedia & Solutions Manual
**HUDERMA Specialty Clinic (Dermatology & Venereology Center)**

This document is the definitive operational and technical reference manual for diagnosing, troubleshooting, and solving **every error** that can occur across the HUDERMA Clinic Management System. 

Each error entry includes:
1. **Symptom & Clinical Impact**: What receptionists, nurses, lab techs, or doctors experience.
2. **Log Signature / Error Message**: The exact string in Serilog (`logs/cms-api-*.log`), SQL Server, browser console (`F12`), or analyzer packets.
3. **Root Cause**: Why the error happened under the hood.
4. **Step-by-Step Resolution**: Exact commands, SQL scripts, or code diffs to fix it immediately.
5. **Prevention**: Long-term setting or rule to stop it from reoccurring.

---

## 📑 Error Index by Category

| Category | Typical Error Codes / Signatures | Primary Layer |
|:---|:---|:---|
| **[1. Authentication & Authorization](#1-authentication--authorization-errors)** | 401 Unauthorized, 403 Forbidden, Expired Refresh Token, Antiforgery mismatch | API / JWT / React Client |
| **[2. HTTP Client & Validation](#2-http-client--validation-errors)** | 400 Bad Request, 404 Not Found, 409 Conflict, 429 Too Many Requests | API / Controllers / DTOs |
| **[3. Database & Entity Framework](#3-database--entity-framework-errors)** | 500 DbUpdateException, Foreign Key Violation, Deadlock (1205), Connection Pool Exhausted | SQL Server / EF Core 8 |
| **[4. LIS & Medical Analyzer Sockets](#4-lis--medical-analyzer-socket-errors)** | Connection Refused (8004/10001/10002), AddressAlreadyInUse, ASTM Checksum Mismatch, Unmatched Barcode | TCP Background Services |
| **[5. Real-Time & SignalR](#5-real-time--signalr-errors)** | WebSocket Handshake 404/500, Negotiate Failure, Fallback to Long-Polling, CORS Blocked | SignalR / Kestrel / IIS |
| **[6. External Payment Gateways](#6-external-payment-gateway-errors)** | Chapa Signature Invalid, Telebirr Timeout, Duplicate Webhook Callback, 422 Unprocessable | Webhook Endpoints / HTTP Client |
| **[7. Telemedicine & Notifications](#7-telemedicine--notification-errors)** | Telegram Bot 409 Conflict (GetUpdates), WhatsApp Graph API 401, SMTP Port 587 Timeout | Background Workers / Integrations |
| **[8. Frontend SPA & PWA](#8-frontend-spa--pwa-errors)** | Blank White Screen, Stale Service Worker Cache, LocalStorage QuotaExceeded, TTS Autoplay Blocked | React 18 / Vite / Service Worker |

---

## 1. Authentication & Authorization Errors

### 1.1 HTTP 401 Unauthorized (Missing or Expired Token)
- **Symptom**: User is abruptly logged out and redirected to `/login`, or API calls return `401 Unauthorized` with an empty response.
- **Log Signature**:
  ```
  [WRN] Bearer was not authenticated. Failure message: "IDX10223: Lifetime validation failed. The token is expired. ValidTo: '11/06/2026 08:30:00', Current time: '11/06/2026 08:35:12'".
  ```
- **Root Cause**:
  1. The 60-minute JWT token stored in the `cms_access_token` HttpOnly cookie expired.
  2. The background silent refresh call (`POST /api/v1/auth/refresh-token`) failed or the refresh token itself was revoked.
  3. Frontend request was made without `withCredentials: true`, causing the browser to omit the session cookie.
- **Step-by-Step Resolution**:
  1. **Check Axios configuration**: Ensure `frontend/cms-web/src/api/apiClient.ts` has `withCredentials: true`:
     ```typescript
     export const api = axios.create({
       baseURL: import.meta.env.VITE_API_URL || '',
       withCredentials: true // CRITICAL: ensures cookies are sent across origins
     });
     ```
  2. **Verify Server Time Drift**: Run `w32tm /query /status` on the Windows host. If server clock is skewed by > 5 minutes, JWT validation fails. Re-sync with:
     ```powershell
     w32tm /resync /force
     ```
  3. **Check User Status in Database**: Verify the account is active and not locked:
     ```sql
     SELECT Id, Username, IsActive, LockoutEnd, RefreshTokenExpiryTime 
     FROM Users WHERE Username = 'admin';
     ```
     If locked, reset lockout:
     ```sql
     UPDATE Users SET LockoutEnd = NULL, AccessFailedCount = 0 WHERE Username = 'admin';
     ```

---

### 1.2 HTTP 403 Forbidden (RBAC Permission Denied)
- **Symptom**: User sees a red toast alert: *"You do not have permission to perform this action"* when clicking a button (e.g. approving a waiver, viewing laboratory configurations).
- **Log Signature**:
  ```
  [INF] Authorization failed for user 'dr.yonas'. User lacks role 'Admin' or claim 'Billing.Waiver.Approve'.
  ```
- **Root Cause**: The user's assigned role in the `UserRoles` join table does not match the `[Authorize(Roles = "...")]` attribute on the target controller endpoint or the frontend permission map in `permissions.ts`.
- **Step-by-Step Resolution**:
  1. Inspect controller authorization requirement:
     ```csharp
     // Check src/CMS.API/Controllers/PharmacyBillingControllers.cs
     [Authorize(Roles = "Admin,BillingManager")]
     [HttpPost("waivers/{id}/approve")]
     ```
  2. Query user's current database roles:
     ```sql
     SELECT u.Username, r.Name AS RoleName 
     FROM Users u
     JOIN UserRoles ur ON u.Id = ur.UserId
     JOIN Roles r ON ur.RoleId = r.Id
     WHERE u.Username = 'dr.yonas';
     ```
  3. Grant missing role if appropriate:
     ```sql
     INSERT INTO UserRoles (UserId, RoleId)
     SELECT u.Id, r.Id FROM Users u, Roles r
     WHERE u.Username = 'dr.yonas' AND r.Name = 'BillingManager';
     ```
  4. Have the user log out and log back in to reissue a refreshed JWT containing the new role claims.

---

### 1.3 CORS Policy Blocked (`Access-Control-Allow-Origin` Missing)
- **Symptom**: Browser console displays:
  ```
  Access to XMLHttpRequest at 'http://localhost:5000/api/v1/patients' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
  ```
- **Log Signature**: Kestrel does not log an error; the browser drops the response before passing it to JavaScript.
- **Root Cause**: The frontend origin (`http://localhost:5173` or production domain) is not listed in `appsettings.json` under `Cors:AllowedOrigins`, or `AllowCredentials()` was called without specific origins.
- **Step-by-Step Resolution**:
  1. Open `src/CMS.API/appsettings.json`:
     ```json
     "Cors": {
       "AllowedOrigins": [
         "http://localhost:5173",
         "http://localhost:3000",
         "https://clinic.huderma.com"
       ]
     }
     ```
  2. Inspect `src/CMS.API/Program.cs` CORS configuration:
     ```csharp
     builder.Services.AddCors(options => {
       options.AddPolicy("DefaultCors", policy => {
         policy.WithOrigins(allowedOrigins)
               .AllowAnyHeader()
               .AllowAnyMethod()
               .AllowCredentials(); // REQUIRED for HttpOnly cookies
       });
     });
     ```
  3. Ensure `app.UseCors("DefaultCors");` is placed **before** `app.UseAuthentication()` and `app.UseAuthorization()`.

---

## 2. HTTP Client & Validation Errors

### 2.1 HTTP 400 Bad Request (DTO Validation Failure)
- **Symptom**: Form submission fails; API returns `400 Bad Request` with validation error dictionary:
  ```json
  {
    "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
    "title": "One or more validation errors occurred.",
    "status": 400,
    "errors": {
      "Phone": ["The Phone field is not a valid Ethiopian mobile number (09... or 07...)."],
      "BirthDate": ["Date of birth cannot be in the future."]
    }
  }
  ```
- **Root Cause**: FluentValidation validator or DataAnnotations failed in the Application layer before reaching the service logic.
- **Step-by-Step Resolution**:
  1. Locate the validator in `src/CMS.Application/<Module>/<Model>Validator.cs`:
     ```csharp
     RuleFor(x => x.Phone)
       .NotEmpty()
       .Matches(@"^(?:\+251|0)(9|7)\d{8}$")
       .WithMessage("Phone must be valid Ethiopian format.");
     ```
  2. Inspect frontend input form to ensure mask/validation rules match backend regex.
  3. In case of decimal parsing failures (e.g. `Price: "150.00"` vs `Price: 150`), ensure JSON serializer handles strings or frontend converts to numeric float before dispatch.

---

### 2.2 HTTP 404 Not Found (Missing Route or Deleted Entity)
- **Symptom**: Network tab shows `404 Not Found` for endpoints like `/api/v1/patient-feedbacks/15`.
- **Root Cause**:
  1. Route mismatch: Missing controller route attribute or wrong URL slug.
  2. Entity soft-deleted: Entity has `IsDeleted = true` and global EF query filter ignores it.
- **Step-by-Step Resolution**:
  1. Verify controller attribute:
     ```csharp
     [Route("api/v1/[controller]")] // Translates to api/v1/patient-feedbacks if controller is PatientFeedbacksController
     ```
  2. Verify if record exists in SQL directly (bypassing query filter):
     ```sql
     SELECT Id, IsDeleted, CreatedAt FROM Patients WHERE Id = 15;
     ```
  3. If `IsDeleted = 1`, restore it if soft-deletion was accidental:
     ```sql
     UPDATE Patients SET IsDeleted = 0 WHERE Id = 15;
     ```

---

### 2.3 HTTP 409 Conflict (Duplicate MRN or Concurrency Conflict)
- **Symptom**: Receptionist tries to register a patient or finalize an invoice and gets *"A record with the specified key already exists"* or *"Concurrency violation"*.
- **Log Signature**:
  ```
  Microsoft.EntityFrameworkCore.DbUpdateException: Cannot insert duplicate key row in object 'dbo.Patients' with unique index 'IX_Patients_MedicalRecordNumber'.
  ```
- **Root Cause**:
  1. Two receptionists simultaneously generated an auto-incrementing MRN without transactional locking.
  2. EF Core `DbUpdateConcurrencyException` when editing a medical chart that another doctor modified concurrently.
- **Step-by-Step Resolution**:
  1. Wrap MRN generation in an atomic transaction or SQL sequence:
     ```sql
     -- Verify sequence current value
     SELECT current_value FROM sys.sequences WHERE name = 'MedicalRecordNumberSequence';
     ```
  2. For clinical chart concurrency, implement row-version check (`[Timestamp] public byte[] RowVersion { get; set; }`) and catch `DbUpdateConcurrencyException` to prompt user: *"Chart was updated by Dr. Abebe. Reload to view latest changes."*

---

### 2.4 HTTP 429 Too Many Requests (Rate Limiter Tripped)
- **Symptom**: User rapidly clicking "Search" or repeatedly attempting login gets blocked with:
  ```json
  { "status": 429, "message": "Rate limit exceeded. Please try again after 60 seconds." }
  ```
- **Log Signature**:
  ```
  [WRN] Rate limit exceeded for client IP '192.168.1.45' on endpoint '/api/v1/auth/login'. Limit: 15 req/min.
  ```
- **Root Cause**: ASP.NET Core built-in rate limiter partition triggered.
  - Auth policy: `15 requests per 1 minute` per client IP.
  - General API: `300 requests per 1 minute`.
- **Step-by-Step Resolution**:
  1. If testing or developing locally, adjust limits in `src/CMS.API/Program.cs`:
     ```csharp
     options.AddFixedWindowLimiter("auth", opt => {
       opt.PermitLimit = 50; // Increased for internal test environments
       opt.Window = TimeSpan.FromMinutes(1);
     });
     ```
  2. If a shared clinic NAT IP triggers this, whitelist internal subnet `192.168.1.0/24` from aggressive throttling.

---

## 3. Database & Entity Framework Errors

### 3.1 500 Internal Server Error (DbUpdateException / FK Violation)
- **Symptom**: Doctor attempts to save an Encounter or Lab Order; API returns `500 Internal Server Error`.
- **Log Signature**:
  ```
  Microsoft.Data.SqlClient.SqlException: The INSERT statement conflicted with the FOREIGN KEY constraint "FK_Encounters_Patients_PatientId". The conflict occurred in database "HudermaCMS", table "dbo.Patients", column 'Id'.
  ```
- **Root Cause**: The frontend submitted an `Encounter` payload with a `PatientId` that does not exist in the database (or was deleted).
- **Step-by-Step Resolution**:
  1. Check incoming payload in Serilog or Network tab.
  2. Run verification query:
     ```sql
     SELECT Id FROM Patients WHERE Id = @SubmittedPatientId;
     ```
  3. Validate foreign keys in Application Service before calling `_db.Add()`:
     ```csharp
     var patientExists = await _db.Patients.AnyAsync(p => p.Id == dto.PatientId && !p.IsDeleted);
     if (!patientExists)
         throw new KeyNotFoundException($"Patient with ID {dto.PatientId} does not exist.");
     ```

---

### 3.2 SQL Deadlock Exception (Error 1205)
- **Symptom**: Occasional random 500 error during peak clinic hours when queue triage, billing, and lab results update simultaneously.
- **Log Signature**:
  ```
  Microsoft.Data.SqlClient.SqlException (0x80131904): Transaction (Process ID 72) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. Rerun the transaction.
  ```
- **Root Cause**: Two competing transactions accessed tables in reverse order. For example:
  - *Tx 1 (Billing)*: Locks `Invoices` table ➔ then requests lock on `Patients`.
  - *Tx 2 (EMR)*: Locks `Patients` table ➔ then requests lock on `Invoices`.
- **Step-by-Step Resolution**:
  1. Enforce strict lock ordering: Always update parent (`Patients`) before child (`Invoices`).
  2. Enable SQL Server Read Committed Snapshot Isolation (RCSI) to prevent read locks from blocking writes:
     ```sql
     ALTER DATABASE HudermaCMS SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
     ALTER DATABASE HudermaCMS SET READ_COMMITTED_SNAPSHOT ON;
     ALTER DATABASE HudermaCMS SET MULTI_USER;
     ```
  3. Add Polly execution retry policy to EF Core in `Program.cs`:
     ```csharp
     builder.Services.AddDbContext<AppDbContext>(options =>
         options.UseSqlServer(connStr, sqlOptions =>
             sqlOptions.EnableRetryOnFailure(
                 maxRetryCount: 5,
                 maxRetryDelay: TimeSpan.FromSeconds(5),
                 errorNumbersToAdd: new[] { 1205 })));
     ```

---

### 3.3 Connection Pool Exhausted ("Timeout expired. The timeout period elapsed prior to obtaining a connection from the pool.")
- **Symptom**: The entire clinic management system hangs; all API requests spin indefinitely and fail with 500 after 15-30 seconds.
- **Log Signature**:
  ```
  System.InvalidOperationException: Timeout expired. The timeout period elapsed prior to obtaining a connection from the pool. This may have occurred because all pooled connections were in use and max pool size was reached.
  ```
- **Root Cause**:
  1. Leaked ADO.NET connection (missing `using` or `await using var connection = ...`).
  2. Synchronous `.Result` or `.Wait()` on asynchronous EF Core queries causing thread pool starvation.
  3. Unbounded long-running queries locking tables.
- **Step-by-Step Resolution**:
  1. Find leaked sleeping connections in SQL Server:
     ```sql
     SELECT session_id, status, blocking_session_id, wait_type, last_request_start_time, program_name
     FROM sys.dm_exec_sessions
     WHERE is_user_process = 1 AND status = 'sleeping' AND open_transaction_count > 0;
     ```
  2. Kill runaway blocked sessions if urgent:
     ```sql
     KILL <session_id>;
     ```
  3. Increase `Max Pool Size` in connection string as a safety cushion:
     ```
     Server=localhost;Database=HudermaCMS;Trusted_Connection=True;Max Pool Size=200;
     ```
  4. Ensure all raw database access uses `using`:
     ```csharp
     // ALWAYS use await using
     await using var conn = new SqlConnection(_connectionString);
     await conn.OpenAsync();
     ```

---

### 3.4 Migration Script Failed / Pending Model Changes
- **Symptom**: API throws `InvalidOperationException` on startup: *"The model backing the 'AppDbContext' context has changed since the database was created."*
- **Root Cause**: A developer added a C# property to an entity but forgot to run the database migration script.
- **Step-by-Step Resolution**:
  1. Identify pending migrations:
     ```bash
     dotnet ef migrations list --project src/CMS.Infrastructure --startup-project src/CMS.API
     ```
  2. Apply pending migrations:
     ```bash
     dotnet ef database update --project src/CMS.Infrastructure --startup-project src/CMS.API
     ```
  3. Or run the corresponding `.sql` migration script located in `database/migrations/` (e.g. `002_performance_indexes_and_lis_quarantine.sql`) via SSMS or `sqlcmd`.

---

### 3.5 Slow Audit Log Queries / Table Scan Degradation (Non-SARGable Filter)
- **Symptom**: Searching the audit trail on `AuditLogPage.tsx` takes 5–10 seconds or times out when the table grows beyond 100,000 rows.
- **Log Signature**:
  ```
  [WRN] Executed DbCommand (4,812ms) [Parameters=[@Date='...'], CommandType='Text'] SELECT ... FROM AuditLog WHERE CAST(ChangedAt AS DATE) = CAST(@Date AS DATE)
  ```
- **Root Cause**: `CAST(ChangedAt AS DATE)` prevents SQL Server from performing index seeks, forcing a clustered table scan on every record.
- **Step-by-Step Resolution**:
  1. Apply covering index migration: `database/migrations/002_performance_indexes_and_lis_quarantine.sql`:
     ```sql
     CREATE NONCLUSTERED INDEX IX_AuditLog_Tenant_ChangedAt
     ON [dbo].[AuditLog] ([TenantId], [ChangedAt] DESC)
     INCLUDE ([TableName], [RecordId], [Operation], [ChangedBy], [IpAddress]);
     ```
  2. Refactor SQL in `AuditController.cs` to use half-open SARGable date ranges:
     ```csharp
     DateTime dateStart = date.Value.Date;
     DateTime dateEnd = dateStart.AddDays(1);
     // In SQL WHERE clause:
     AND (@DateStart IS NULL OR (a.ChangedAt >= @DateStart AND a.ChangedAt < @DateEnd))
     ```

---

## 4. LIS & Medical Analyzer Socket Errors

### 4.1 Connection Refused / Port Offline (Ports 8004, 10001, 10002)
- **Symptom**: Mindray BC-5000 or ZYBIO Z3 displays *"Communication error: Target host refused connection"*. Lab results do not automatically sync.
- **Log Signature**:
  ```
  [WRN] Failed to establish TCP listener on port 10001. System.Net.Sockets.SocketException: Only one usage of each socket address is normally permitted.
  ```
- **Root Cause**:
  1. Another instance of the API or an old background process is already bound to port 10001.
  2. Windows Defender Firewall is blocking inbound TCP traffic on that port.
- **Step-by-Step Resolution**:
  1. Find which process is locking the port:
     ```powershell
     netstat -ano | findstr "10001"
     ```
  2. Identify the PID from the rightmost column and kill it:
     ```powershell
     taskkill /PID <PID_HERE> /F
     ```
  3. Add Windows Firewall rule to allow inbound analyzer traffic:
     ```powershell
     New-NetFirewallRule -DisplayName "CMS LIS Analyzers (10001-10005)" -Direction Inbound -LocalPort 10001-10005 -Protocol TCP -Action Allow
     ```
  4. Restart the CMS API service.

---

### 4.2 Malformed MLLP / ASTM Framing (Missing `<STX>` or `<ETX>`)
- **Symptom**: Analyzer sends a test packet, but the system logs an error and does not parse results.
- **Log Signature**:
  ```
  [WRN] ASTM Frame framing error: Expected STX (0x02) at start of frame, received: 0x48 ('H'). Frame discarded.
  ```
- **Root Cause**: The machine is configured for ASTM 1381 raw mode without framing characters, or uses HL7 MLLP (`<VT>...<FS><CR>`) on a port configured for ASTM.
- **Step-by-Step Resolution**:
  1. Check analyzer configuration screen:
     - If protocol is **HL7 v2.x**, machine must connect to **Port 8004** (MLLP framed with `0x0B` start and `0x1C 0x0D` end).
     - If protocol is **ASTM 1394/1381**, machine must connect to **Port 10001** (Mindray) or **Port 10002** (ZYBIO Z3).
  2. Inspect raw hex packet in `src/CMS.Infrastructure/LabIntegration/LisTcpListenerService.cs`:
     ```csharp
     _logger.LogInformation("Raw Packet Received [{Length} bytes]: {Hex}", 
         bytesRead, BitConverter.ToString(buffer, 0, bytesRead));
     ```
  3. Ensure analyzer port settings match `appsettings.json`:
     ```json
     "LisSettings": {
       "Hl7Port": 8004,
       "MindrayPort": 10001,
       "ZybioPort": 10002
     }
     ```

---

### 4.3 ASTM Checksum Verification Failure
- **Symptom**: Communication between Mindray and server stalls after the first record frame; machine sends `<EOT>` and aborts.
- **Log Signature**:
  ```
  [WRN] ASTM Checksum mismatch: Computed 'B4', received 'A2'. Frame: "2P|1||MRN-9021||Abebe^Tigist|||||||||||"
  ```
- **Root Cause**: Electrical noise, baud rate mismatch on serial-to-ethernet converters, or checksum algorithm implementation discrepancy.
- **Step-by-Step Resolution**:
  1. Check calculation logic in `AstmProtocolHandler.cs`:
     - Sum all ASCII byte values starting immediately after `<STX>` up to and including `<ETX>` (or `<ETB>`).
     - Take modulo 256 (`sum % 256`).
     - Format as 2-character uppercase hex (`X2`).
  2. If using RS232-to-Ethernet converter (Moxa, USR-TCP232), verify baud rate is set to `9600`, Data Bits: `8`, Parity: `None`, Stop Bits: `1`.

---

### 4.4 Unmatched Barcode / Unknown Specimen ID (Quarantined in `UnassignedLabResults`)
- **Symptom**: Machine successfully completes tests and receives an ACK, but the CBC results do not automatically populate on the patient's chart. An automated high-priority notification is dispatched to Lab Technicians.
- **Log Signature**:
  ```
  [WRN] No matching LabOrder found for specimen barcode/sample 'UNKNOWN-9012'. Quarantining result in UnassignedLabResults.
  ```
- **Root Cause**:
  1. Lab technician scanned the patient MRN or entered an arbitrary sample ID on the analyzer instead of scanning the CMS-generated barcode.
  2. The test order was not saved or was already marked completed in the database.
  3. *Safety note*: Legacy versions attempted to attach unmatched results to the most recent patient order. This dangerous behavior has been **completely eliminated**; unknown samples are strictly quarantined.
- **Step-by-Step Resolution**:
  1. Query the quarantine staging table in SQL Server:
     ```sql
     SELECT TOP 20 Id, SampleId, RemoteEndPoint, SummaryText, Flag, IsCritical, ReceivedAt, Status
     FROM UnassignedLabResults
     WHERE Status = 'PendingReview'
     ORDER BY ReceivedAt DESC;
     ```
  2. In the web interface, navigate to **Laboratory Management ➔ LIS Quarantine Queue**.
  3. Identify the specimen by timestamp and analyzer IP (`RemoteEndPoint`), select the intended patient's lab order, and click **"Assign and Re-ingest"**.
  4. Ensure all phlebotomists scan the exact barcoded sticker printed by CMS prior to loading vials into the analyzer carousel.

---

### 4.5 LIS Channel Backpressure & Semaphore Throttling
- **Symptom**: Under burst testing or heavy morning clinic rushes, analyzer socket connections are rejected or the database ingestion queue lags behind analyzer ACKs.
- **Log Signature**:
  ```
  [WRN] Channel writer backpressure: incoming analyzer queue reached capacity (1000 items). Thread waiting for consumer tasks.
  ```
- **Root Cause**:
  1. More than 50 simultaneous TCP connections were initiated, exceeding the `SemaphoreSlim(50, 50)` connection pool guard.
  2. Database write latency delayed consumer workers while consuming from `_incomingChannel`.
- **Step-by-Step Resolution**:
  1. Verify the 4 dedicated consumer worker tasks in `LisTcpListenerService.cs` are running without exceptions.
  2. If the clinic expands to >25 simultaneous analyzer machines, adjust semaphore permits in `LisTcpListenerService.cs`:
     ```csharp
     private readonly SemaphoreSlim _connectionLimiter = new(100, 100);
     ```
  3. Check SQL Server IOPS and verify covering indexes are active to ensure rapid inserts.

---

## 5. Real-Time & SignalR Errors

### 5.1 SignalR WebSocket Connection Failed (HTTP 404 / 500 on Negotiate)
- **Symptom**: Clinic Queue TV displays static data; live queue calling chime does not ring when patient is summoned.
- **Log Signature (Browser Console)**:
  ```
  Error: Failed to start the connection: Error: WebSocket failed to connect. The URL 'wss://clinic.huderma.com/hubs/notifications' returned 404 Not Found.
  ```
- **Root Cause**:
  1. IIS Reverse Proxy / URL Rewrite is not configured to forward the `Upgrade: websocket` and `Connection: Upgrade` headers.
  2. SignalR hub endpoint route is missing or misnamed in `Program.cs`.
- **Step-by-Step Resolution**:
  1. Verify hub mapping in `src/CMS.API/Program.cs`:
     ```csharp
     app.MapHub<NotificationHub>("/hubs/notifications", options => {
       options.Transports = HttpTransportType.WebSockets | HttpTransportType.LongPolling;
     });
     ```
  2. In IIS (if hosted behind IIS), install the **WebSocket Protocol** role feature:
     ```powershell
     Install-WindowsFeature -Name Web-WebSockets
     ```
  3. If behind Nginx or Cloudflare reverse proxy, add WebSocket upgrade headers:
     ```nginx
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     ```

---

### 5.2 SignalR Frequent Disconnections & Reconnect Loops
- **Symptom**: Yellow alert bar appears in frontend: *"Reconnecting to live notification server..."* every 30 seconds.
- **Log Signature**:
  ```
  [WRN] Client 'connectionId_XYZ' keep-alive timed out after 30000ms. Disconnecting client.
  ```
- **Root Cause**: Wi-Fi signal dropouts or aggressive firewall closing idle TCP connections.
- **Step-by-Step Resolution**:
  1. Increase ClientTimeoutInterval and KeepAliveInterval in `Program.cs`:
     ```csharp
     builder.Services.AddSignalR(options => {
       options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
       options.KeepAliveInterval = TimeSpan.FromSeconds(15);
       options.HandshakeTimeout = TimeSpan.FromSeconds(15);
     });
     ```
  2. In `frontend/cms-web/src/context/SignalRContext.tsx`, configure automatic reconnect:
     ```typescript
     const hubConnection = new HubConnectionBuilder()
       .withUrl('/hubs/notifications')
       .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // progressive retry backoff
       .build();
     ```

---

## 6. External Payment Gateway Errors

### 6.1 Chapa Webhook Signature Verification Failed
- **Symptom**: Patient pays via mobile banking (CBE Birr / Telebirr) through Chapa; invoice remains in `Unpaid` status.
- **Log Signature**:
  ```
  [WRN] Chapa Webhook HMAC signature verification failed. Computed: 'd8a7...', Received Header: '9f2c...'. Request rejected with 401.
  ```
- **Root Cause**: The webhook secret key in `appsettings.json` does not match the secret key configured in the Chapa Merchant Dashboard.
- **Step-by-Step Resolution**:
  1. Log in to [Chapa Dashboard](https://dashboard.chapa.co/) ➔ Settings ➔ Webhooks.
  2. Copy the **Secret Hash**.
  3. Update `src/CMS.API/appsettings.json`:
     ```json
     "Chapa": {
       "SecretHash": "YOUR_EXACT_SECRET_HASH_HERE",
       "SecretKey": "CHASECK_LIVE-..."
     }
     ```
  4. Ensure `ChapaController.cs` computes HMAC-SHA256 correctly:
     ```csharp
     using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secretHash));
     var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
     var calculatedSignature = BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
     ```

---

### 6.2 Telebirr Payment Query Timeout / Failure
- **Symptom**: Billing clerk clicks "Verify Telebirr Payment"; spinner runs for 30 seconds, then displays *"Gateway timeout"*.
- **Root Cause**: Telebirr B2B gateway gateway latency or DNS failure resolving Telebirr API endpoint from clinic network.
- **Step-by-Step Resolution**:
  1. Check network connectivity from server host:
     ```powershell
     Test-NetConnection -ComputerName api.telebirr.et -Port 443
     ```
  2. Implement circuit-breaker pattern in `TelebirrPaymentService.cs`:
     ```csharp
     builder.Services.AddHttpClient<ITelebirrService, TelebirrService>()
       .AddPolicyHandler(HttpPolicyExtensions
         .HandleTransientHttpError()
         .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt))));
     ```
  3. Allow billing staff to click **"Manual Reference Verification"** if transaction reference SMS is presented by patient.

---

## 7. Telemedicine & Notification Errors

### 7.1 Telegram Bot 409 Conflict ("Terminated by other getUpdates request")
- **Symptom**: Telemedicine Telegram bot stops responding to patient chat messages.
- **Log Signature**:
  ```
  Telegram.Bot.Exceptions.ApiRequestException: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running
  ```
- **Root Cause**: Two instances of the CMS API (e.g., local developer machine and production staging server) are running simultaneously using the same Telegram Bot Token with long-polling (`ReceiveAsync`).
- **Step-by-Step Resolution**:
  1. Never reuse the production Telegram Bot Token in local development!
  2. Create a separate development bot via `@BotFather` on Telegram (e.g. `@HudermaDevBot`).
  3. In `appsettings.Development.json`, set:
     ```json
     "Telegram": {
       "BotToken": "DEV_BOT_TOKEN_HERE"
     }
     ```
  4. Or switch production to **Webhook mode** instead of long-polling:
     ```bash
     curl -F "url=https://clinic.huderma.com/api/v1/telegram/webhook" https://api.telegram.org/bot<TOKEN>/setWebhook
     ```

---

### 7.2 SMTP Email Send Failure (Authentication / Port 587 Timeout)
- **Symptom**: Password reset emails or lab result PDF attachments fail to deliver to patients.
- **Log Signature**:
  ```
  System.Net.Mail.SmtpException: The operation has timed out. / Authentication failed because the remote party has closed the transport stream.
  ```
- **Root Cause**:
  1. Google Workspace / Gmail requires an **App Password**, not the account's standard login password.
  2. Outbound port 25 or 587 is blocked by local Internet Service Provider (Ethio Telecom).
- **Step-by-Step Resolution**:
  1. Test outbound SMTP port connectivity:
     ```powershell
     Test-NetConnection -ComputerName smtp.gmail.com -Port 587
     ```
  2. If port 587 is blocked, switch to port 465 (SSL):
     ```json
     "SmtpSettings": {
       "Host": "smtp.gmail.com",
       "Port": 465,
       "EnableSsl": true
     }
     ```
  3. Ensure Gmail "2-Step Verification" is active and generate a 16-character **App Password** under Google Account Security.

---

## 8. Frontend SPA & PWA Errors

### 8.1 White Screen of Death (Uncaught Runtime Exception)
- **Symptom**: Staff opens a patient chart or billing page; screen turns completely white with no UI elements.
- **Log Signature (Browser Console `F12`)**:
  ```
  Uncaught TypeError: Cannot read properties of undefined (reading 'map')
      at EmrSoapPage.tsx:142
  ```
- **Root Cause**: The API returned `null` instead of an empty array `[]` for a nested collection (e.g., `prescriptions`, `diagnoses`), and the React component attempted `.map()` without optional chaining (`?.`).
- **Step-by-Step Resolution**:
  1. Add optional chaining and null coalescing in the React component:
     ```tsx
     // INSTEAD OF:
     items.map(item => <Row key={item.id} />)

     // USE SAFE PATTERN:
     (items || []).map(item => <Row key={item.id} />)
     ```
  2. Ensure the top-level application is wrapped in an **ErrorBoundary** in `src/App.tsx`:
     ```tsx
     <ErrorBoundary fallback={<ClinicErrorRecoveryFallback />}>
       <AppRoutes />
     </ErrorBoundary>
     ```

---

### 8.2 Stale PWA Service Worker Cache After Production Update
- **Symptom**: Developer deployed new features to IIS, but receptionists still see the old UI version or get missing chunk errors (`Loading chunk failed`).
- **Root Cause**: The browser's Service Worker cached old JavaScript bundle hashes (`index-D7x9a.js`) that no longer exist on the server.
- **Step-by-Step Resolution**:
  1. Instruct receptionists to press **Ctrl + Shift + R** (Hard Refresh).
  2. Or clear service worker cache programmatically on startup by incrementing the cache name in `vite.config.ts`:
     ```typescript
     VitePWA({
       registerType: 'autoUpdate',
       workbox: {
         cleanupOutdatedCaches: true,
         skipWaiting: true,
         clientsClaim: true
       }
     })
     ```
  3. To wipe cache on an individual PC manually: Press `F12` ➔ **Application** tab ➔ **Storage** ➔ Click **Clear site data**.

---

### 8.3 Browser Autoplay Policy Blocking Audio Chimes
- **Symptom**: Clinic Queue Calling chime ("*Token number 45, please proceed to Doctor Office 2*") does not sound on the reception TV.
- **Log Signature (Browser Console)**:
  ```
  NotAllowedError: play() failed because the user didn't interact with the document first. https://goo.gl/xX8pDD
  ```
- **Root Cause**: Modern browsers (Chrome, Edge) strictly forbid audio playback without prior user interaction (click or tap) on the page.
- **Step-by-Step Resolution**:
  1. Add an initial **"Activate Audio & Fullscreen"** modal or button on the TV Display page:
     ```tsx
     {!audioUnlocked && (
       <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center">
         <button 
           onClick={() => { initAudio(); setAudioUnlocked(true); }}
           className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-xl font-bold shadow-2xl">
           🔊 Start Queue Display Audio
         </button>
       </div>
     )}
     ```
  2. Or in Chrome settings on the TV kiosk: Navigate to `chrome://settings/content/sound` ➔ Add `http://localhost:5173` to **"Allowed to play sound"**.

---

## 🛠️ Emergency Recovery Quick-Commands Cheat Sheet

| Situation | Command / Action |
|:---|:---|
| **Kill hung API process** | `taskkill /IM CMS.API.exe /F` |
| **Kill port 10001 (LIS)** | `Get-Process -Id (Get-NetTCPConnection -LocalPort 10001).OwningProcess \| Stop-Process -Force` |
| **Check API Logs in Real-time** | `Get-Content src\CMS.API\logs\cms-api-*.log -Wait -Tail 50` |
| **Run Unit Tests to Verify State**| `dotnet test tests\CMS.UnitTests\CMS.UnitTests.csproj` |
| **Build Frontend Cleanly** | `cd frontend\cms-web && npm run build` |
| **Re-run DB Migrations** | `dotnet ef database update --project src\CMS.Infrastructure --startup-project src\CMS.API` |
| **Unlock Locked Admin User** | `UPDATE Users SET LockoutEnd = NULL, AccessFailedCount = 0 WHERE Username = 'admin';` |
