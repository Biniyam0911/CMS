// Node.js script to compile and assemble the comprehensive Interactive Dev Hub for CMS
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Read all markdown documentation dynamically from disk
const docRegistry = [
  {
    id: 'handbook',
    title: 'Developer Handbook & Master Onboarding',
    category: 'Core Guide',
    icon: 'fa-book',
    filePath: 'docs/DEVELOPER_HANDBOOK.md'
  },
  {
    id: 'arch',
    title: 'Clean Architecture & System Blueprint',
    category: 'Architecture',
    icon: 'fa-sitemap',
    filePath: 'docs/architecture/ARCHITECTURE_OVERVIEW.md'
  },
  {
    id: 'newmodule',
    title: 'How to Add a New Module (11-Step Recipe)',
    category: 'Step-by-Step Guide',
    icon: 'fa-puzzle-piece',
    filePath: 'docs/how-to-guides/HOW_TO_ADD_A_NEW_MODULE.md'
  },
  {
    id: 'localdev',
    title: 'Local Development & Running the App',
    category: 'Setup & Run',
    icon: 'fa-laptop-code',
    filePath: 'docs/how-to-guides/LOCAL_DEVELOPMENT_AND_RUN.md'
  },
  {
    id: 'errors',
    title: 'System Errors & Solutions Encyclopedia',
    category: 'Troubleshooting & Fixes',
    icon: 'fa-triangle-exclamation',
    filePath: 'docs/how-to-guides/SYSTEM_ERRORS_AND_SOLUTIONS.md'
  },
  {
    id: 'troubleshoot',
    title: 'Debugging & Diagnostic Playbook',
    category: 'Troubleshooting & Fixes',
    icon: 'fa-stethoscope',
    filePath: 'docs/how-to-guides/DEBUGGING_AND_TROUBLESHOOTING.md'
  },
  {
    id: 'roadmap',
    title: 'Engineering Suggestions & Roadmap',
    category: 'Strategy',
    icon: 'fa-lightbulb',
    filePath: 'docs/SUGGESTIONS_AND_ROADMAP.md'
  },
  {
    id: 'prodmanual',
    title: 'Production Update & Deployment Manual',
    category: 'DevOps & Deployment',
    icon: 'fa-server',
    filePath: 'docs/PRODUCTION_UPDATE_MANUAL.md'
  }
];

const docsMap = {};
for (const item of docRegistry) {
  const full = path.join(rootDir, item.filePath);
  const content = fs.readFileSync(full, 'utf8');
  docsMap[item.id] = {
    id: item.id,
    title: item.title,
    category: item.category,
    icon: item.icon,
    path: item.filePath,
    fullPath: full.replace(/\\/g, '/'),
    content: content
  };
}

console.log(`Loaded ${Object.keys(docsMap).length} documentation files successfully.`);

// 2. Comprehensive Code Files Registry
const codeFiles = [
  {
    path: "src/CMS.API/Program.cs",
    layer: "API",
    title: "API Host Startup, Response Compression & Rate Limiting",
    desc: "Registers DI services, Brotli & Gzip optimal response compression, JWT cookies, ApiPolicy rate limiting (300 req/min), and SignalR hubs.",
    whenToEdit: "When adding services, adjusting compression MIME types, tuning rate limiter windows, or updating hubs.",
    bugFix: "Verify app.UseResponseCompression() is called before endpoints, and builder.Services.AddScoped is configured."
  },
  {
    path: "src/CMS.API/Controllers/AdminControllers.cs",
    layer: "API",
    title: "Admin & User Management Controller",
    desc: "Handles user accounts, role assignments, clinic branch metadata, and administrative configurations.",
    whenToEdit: "When creating admin-only actions, managing staff permissions, or configuring clinic parameters.",
    bugFix: "Verify role attributes [Authorize(Roles = 'Admin,SuperAdmin')] match database UserRoles."
  },
  {
    path: "src/CMS.API/Controllers/AuditController.cs",
    layer: "API",
    title: "System Audit Trail Controller (SARGable Index Seeks)",
    desc: "Exposes access logs with SARGable date range seeks (>= @Start AND < @End) utilizing covering index IX_AuditLog_Tenant_ChangedAt.",
    whenToEdit: "When expanding security logging, audit filters, or export reporting.",
    bugFix: "Never wrap ChangedAt in CAST(ChangedAt AS DATE) or queries will revert to expensive table scans."
  },
  {
    path: "src/CMS.API/Controllers/ChapaController.cs",
    layer: "API",
    title: "Chapa Payment Gateway Webhook Controller",
    desc: "Receives asynchronous payment verification webhooks from Chapa for mobile and card transactions.",
    whenToEdit: "When updating Chapa callback signatures or transaction verification statuses.",
    bugFix: "Verify Chapa public/secret API keys in appsettings.json match production keys."
  },
  {
    path: "src/CMS.API/Controllers/ClinicalAuxiliaryControllers.cs",
    layer: "API",
    title: "Clinical Auxiliary Services Controller",
    desc: "Auxiliary clinic endpoints: medical certificates, vitals history, and procedure checklists.",
    whenToEdit: "When adding secondary medical paperwork or auxiliary clinical tools.",
    bugFix: "Ensure tenant ID is supplied when querying patient auxiliary records."
  },
  {
    path: "src/CMS.API/Controllers/ClinicalControllers.cs",
    layer: "API",
    title: "Staff, Appointments & Encounters Controllers",
    desc: "HTTP endpoints for clinical visits, doctor scheduling, ICD-10 diagnoses, and minor surgical procedures.",
    whenToEdit: "When adding parameters to appointment booking or modifying encounter creation logic.",
    bugFix: "Check HttpContext.Items['TenantId'] if multi-clinic isolation returns unexpected empty lists."
  },
  {
    path: "src/CMS.API/Controllers/Controllers.cs",
    layer: "API",
    title: "Core Auth, Lab Catalog & Patient Controllers",
    desc: "Auth (JWT cookies), LaboratoryController with Redis-cached catalog (<2ms), and PatientsController with consolidated conditional count aggregation.",
    whenToEdit: "When updating login, laboratory catalog caching rules, or patient search logic.",
    bugFix: "Invalidate Redis key 'tenant:{tenantId}:lab:catalog' whenever catalog tests are added or modified."
  },
  {
    path: "src/CMS.API/Controllers/InpatientController.cs",
    layer: "API",
    title: "Inpatient Ward & Bed Management Controller",
    desc: "Bed allocation, inpatient admission, doctor rounds, and ward discharge summaries.",
    whenToEdit: "When adding inpatient ward categories or changing admission procedures.",
    bugFix: "Verify bed occupancy status transitions from 'Available' to 'Occupied' on admission."
  },
  {
    path: "src/CMS.API/Controllers/IntegrationControllers.cs",
    layer: "API",
    title: "Third-Party Hardware & LIS Controllers",
    desc: "Endpoints for inspecting analyzer socket connection states, listener ports, and diagnostic packet logs.",
    whenToEdit: "When testing laboratory analyzer connectivity from the web frontend.",
    bugFix: "Use GET /api/v1/laboratory/instruments/listener-status to confirm active TCP socket ports."
  },
  {
    path: "src/CMS.API/Controllers/PatientPortalController.cs",
    layer: "API",
    title: "Patient Self-Service Portal Controller",
    desc: "Patient-facing endpoints for viewing past lab results, prescriptions, and booking appointments.",
    whenToEdit: "When adding features for patient self-service mobile or web apps.",
    bugFix: "Ensure queries strictly filter by the authenticated patient's UserId."
  },
  {
    path: "src/CMS.API/Controllers/PayrollController.cs",
    layer: "API",
    title: "Doctor Commission & Payroll Controller",
    desc: "Doctor revenue share calculations, consultation percentages, procedure cuts, and payouts.",
    whenToEdit: "When modifying commission percentage formulas or generating doctor pay stubs.",
    bugFix: "Ensure invoice payment status is verified before crediting doctor commissions."
  },
  {
    path: "src/CMS.API/Controllers/PharmacyBillingControllers.cs",
    layer: "API",
    title: "Billing, Invoicing, Payments & Dispensary Controllers",
    desc: "Patient invoices, payments, waivers, dispensary prescription queues, and drug catalogs.",
    whenToEdit: "When updating invoice statuses, waiver approvals, or dispensary stock deductions.",
    bugFix: "Check for negative stock deductions in dispensary dispensation loops."
  },
  {
    path: "src/CMS.Application/Encounters/SoapAndClinicalService.cs",
    layer: "Application",
    title: "Clinical Consultation & SOAP Workflow Engine",
    desc: "Coordinates doctor consultation notes, diagnoses, order prescriptions, and lab tests.",
    whenToEdit: "When modifying clinical note fields, ICD-10 diagnosis linking, or encounter completion.",
    bugFix: "Ensure transaction wraps encounter updates and prescription generation to prevent orphan records."
  },
  {
    path: "src/CMS.Application/Billing/BillingService.cs",
    layer: "Application",
    title: "Billing, Discount & Payment Processing Service",
    desc: "Calculates invoice totals, item tax, patient category discounts, and credits payments.",
    whenToEdit: "When altering discount formulas, payment gateway integrations, or credit invoice terms.",
    bugFix: "Verify that invoice status transitions to 'Paid' only when TotalAmount <= PaidAmount."
  },
  {
    path: "src/CMS.Application/Patients/PatientService.cs",
    layer: "Application",
    title: "Patient Registration & Medical Record Engine",
    desc: "Manages patient demographics, auto-generated Medical Record Numbers (MRN), and family relations.",
    whenToEdit: "When adding demographic fields (e.g., blood type, emergency contact) or customizing MRN format.",
    bugFix: "Ensure phone number uniqueness or format validation catches duplicate registrations."
  },
  {
    path: "src/CMS.Application/Queue/QueueService.cs",
    layer: "Application",
    title: "Live Clinic Queue & Triage Service",
    desc: "Token generation, triage priority categorization, room calling, and doctor station routing.",
    whenToEdit: "When changing token naming prefixes (e.g., 'EMG-', 'DOC-') or doctor assignment algorithms.",
    bugFix: "Broadcasts queue updates via SignalR; ensure NotificationHub is injected."
  },
  {
    path: "src/CMS.Domain/Entities/ClinicalEntities.cs",
    layer: "Domain",
    title: "Clinical Core Entities (Encounter, SOAP, Diagnosis)",
    desc: "Pure entity classes defining clinical models, medical orders, vitals, and surgical records.",
    whenToEdit: "When introducing new clinical concepts or adding columns to medical charts.",
    bugFix: "Keep entity free of framework dependencies; use EF Core navigation properties cleanly."
  },
  {
    path: "src/CMS.Domain/Entities/BillingEntities.cs",
    layer: "Domain",
    title: "Financial Core Entities (Invoice, Payment, Waiver)",
    desc: "Entities for tracking clinic revenue, itemized bill lines, tax amounts, and payment methods.",
    whenToEdit: "When adding financial instruments, payment channels, or insurance claim entities.",
    bugFix: "Always use decimal(18,2) for monetary values to prevent floating-point rounding errors."
  },
  {
    path: "src/CMS.Infrastructure/Data/AppDbContext.cs",
    layer: "Infrastructure",
    title: "Entity Framework Core Database Context",
    desc: "Maps C# entities to SQL Server tables, configures Fluent API relationships, indexes, and cascades.",
    whenToEdit: "When adding a new entity DbSet<T>, configuring composite keys, or defining unique constraints.",
    bugFix: "Remember to create a migration script after changing any OnModelCreating configurations."
  },
  {
    path: "src/CMS.Infrastructure/LabIntegration/LisTcpListenerService.cs",
    layer: "Infrastructure",
    title: "Background TCP Listener & Bounded Channel Pipeline",
    desc: "Asynchronous TCP listener on ports 8004, 10001, 10002 with Bounded Channel<LisRawMessage> (capacity 1000) and SemaphoreSlim(50,50) throttling.",
    whenToEdit: "When supporting new analyzer models, adjusting worker channel capacity, or socket concurrency limits.",
    bugFix: "Check 'netstat -ano | findstr 10001' if port is locked, or inspect Channel writer logs if backpressure occurs."
  },
  {
    path: "src/CMS.Infrastructure/LabIntegration/LabResultIngestionService.cs",
    layer: "Infrastructure",
    title: "LIS Result Ingestion & Clinical Quarantine Engine",
    desc: "Parses HL7/ASTM frames, matches orders by barcode, and safely quarantines unknown specimens to UnassignedLabResults with instant alert notifications.",
    whenToEdit: "When adjusting test parameter mapping, critical threshold flags, or quarantine routing.",
    bugFix: "If an analyzer result does not link to an order, query SELECT * FROM UnassignedLabResults WHERE Status='PendingReview'."
  },
  {
    path: "database/migrations/002_performance_indexes_and_lis_quarantine.sql",
    layer: "Infrastructure",
    title: "Performance Covering Indexes & LIS Quarantine Schema",
    desc: "Migration adding covering indexes (IX_AuditLog_Tenant_ChangedAt, IX_Encounters_Tenant_Doctor_Date, IX_Invoices_Tenant_Date_Paid) and UnassignedLabResults table.",
    whenToEdit: "When optimizing large table queries or modifying quarantine schema columns.",
    bugFix: "Apply in SSMS on ClinicDB if queries on AuditLog or Encounters perform table scans."
  },
  {
    path: "frontend/cms-web/src/App.tsx",
    layer: "Frontend",
    title: "React Root Application & Code-Splitting Architecture",
    desc: "Master SPA entry point using React.lazy() & Suspense for all 26 page components, shrinking the entry bundle by 94.5% to 73.59 kB.",
    whenToEdit: "When adding a new screen/module, modifying idle timeout, or updating fallback loading spinners.",
    bugFix: "Always wrap newly imported page components with React.lazy(() => import(...)) to maintain fast page loads."
  },
  {
    path: "frontend/cms-web/vite.config.ts",
    layer: "Frontend",
    title: "Vite Bundler & Rollup Manual Chunks Configuration",
    desc: "Configures PWA plugins, dev proxy rules, and Rollup manualChunks separating vendor-react and vendor-ui chunks.",
    whenToEdit: "When tuning vendor chunks, modifying proxy target ports, or updating PWA service worker settings.",
    bugFix: "If vendor chunk size exceeds limit, tune manualChunks groups in build.rollupOptions.output."
  },
  {
    path: "frontend/cms-web/src/api/apiClient.ts",
    layer: "Frontend",
    title: "Axios API Client & Interceptors",
    desc: "Configured Axios instance with baseUrl, withCredentials (HttpOnly cookies), and 401 interceptor.",
    whenToEdit: "When modifying API base URL, adding custom headers, or handling global 403 errors.",
    bugFix: "Do not remove withCredentials: true or authentication cookies will not be sent!"
  },
  {
    path: "frontend/cms-web/src/components/Sidebar.tsx",
    layer: "Frontend",
    title: "Navigation Sidebar & Role Filtering",
    desc: "Renders the collapsible sidebar menu with role-based visibility checks via permissions.ts.",
    whenToEdit: "When adding a link to a newly created module or changing navigation icons.",
    bugFix: "Ensure requiredPermission matches staff roles or the link will stay hidden."
  },
  {
    path: "frontend/cms-web/src/utils/permissions.ts",
    layer: "Frontend",
    title: "Role-Based Access Control (RBAC) Matrix",
    desc: "Defines permission rules for Doctors, Nurses, Cashiers, Lab Techs, Pharmacists, and Admins.",
    whenToEdit: "When restricting or granting a module to specific staff roles.",
    bugFix: "Cross-check that frontend permission names correspond to backend [Authorize(Roles=...)] attributes."
  },
  {
    path: "frontend/cms-web/src/pages/EMR/EmrSoapPage.tsx",
    layer: "Frontend",
    title: "Electronic Medical Record (EMR) SOAP Consultation Page",
    desc: "Doctor consultation interface for Subjective, Objective, Assessment, and Plan documentation.",
    whenToEdit: "When enhancing doctor chart inputs, vitals history, or prescription auto-complete.",
    bugFix: "Check browser console for unhandled state if saving an empty assessment."
  }
];

// 3. Error Encyclopedia Items (Structured Data for the Dedicated Interactive Page)
const errorEncyclopedia = [
  {
    code: "LIS QUARANTINE",
    title: "Unmatched Specimen Quarantined in UnassignedLabResults",
    category: "LIS",
    severity: "Medium",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    symptom: "Analyzer transmitted results, but they do not appear on patient's chart. Tech receives high-priority notification.",
    log: "No matching LabOrder found for specimen barcode/sample 'UNKNOWN-9012'. Quarantining result in UnassignedLabResults.",
    cause: "Tech scanned MRN or entered wrong tube ID instead of CMS order barcode. System safely quarantined to prevent mixups.",
    fixSteps: [
      "Query quarantine table: SELECT * FROM UnassignedLabResults WHERE Status='PendingReview';",
      "Open Laboratory Management -> LIS Quarantine Queue in web UI.",
      "Match the specimen to the intended patient's lab order and click 'Assign and Re-ingest'."
    ],
    fixCmd: "SELECT TOP 10 * FROM UnassignedLabResults WHERE Status='PendingReview' ORDER BY ReceivedAt DESC;",
    docAnchor: "#44-unmatched-barcode--unknown-specimen-id-quarantined-in-unassignedlabresults"
  },
  {
    code: "SQL SCAN",
    title: "AuditLog Table Scan Degradation (Non-SARGable Query)",
    category: "Database",
    severity: "High",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    symptom: "AuditLog page takes 5-10s to load or times out when audit table grows beyond 100,000 records.",
    log: "Executed DbCommand (4,812ms) SELECT ... FROM AuditLog WHERE CAST(ChangedAt AS DATE) = CAST(@Date AS DATE)",
    cause: "CAST function on ChangedAt prevents index seeks and triggers full table scans on large tables.",
    fixSteps: [
      "Run migration 002_performance_indexes_and_lis_quarantine.sql in SSMS.",
      "Use SARGable half-open date ranges in SQL: AND (ChangedAt >= @DateStart AND ChangedAt < @DateEnd)."
    ],
    fixCmd: "CREATE NONCLUSTERED INDEX IX_AuditLog_Tenant_ChangedAt ON [dbo].[AuditLog] ([TenantId], [ChangedAt] DESC) INCLUDE ([TableName], [RecordId], [Operation], [ChangedBy], [IpAddress]);",
    docAnchor: "#35-slow-audit-log-queries--table-scan-degradation-non-sargable-filter"
  },

  {
    code: "HTTP 401",
    title: "Unauthorized (Session Cookie Expired or Missing)",
    category: "Auth",
    severity: "High",
    badgeColor: "bg-red-100 text-red-800 border-red-200",
    symptom: "User is abruptly logged out and redirected to /login, or API calls return 401 with empty response.",
    log: 'Bearer was not authenticated. Failure message: "IDX10223: Lifetime validation failed. The token is expired."',
    cause: "JWT in HttpOnly cookie expired (>60m), silent refresh failed, or request lacked withCredentials: true.",
    fixSteps: [
      "Ensure frontend/cms-web/src/api/apiClient.ts has withCredentials: true.",
      "Check server clock drift with 'w32tm /query /status' and sync via 'w32tm /resync /force'.",
      "Verify user account is active: UPDATE Users SET LockoutEnd = NULL, AccessFailedCount = 0 WHERE Username = 'admin';"
    ],
    fixCmd: "UPDATE Users SET LockoutEnd = NULL, AccessFailedCount = 0 WHERE Username = 'admin';",
    docAnchor: "#11-http-401-unauthorized-missing-or-expired-token"
  },
  {
    code: "HTTP 403",
    title: "Forbidden (RBAC Role or Claim Denied)",
    category: "Auth",
    severity: "Medium",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    symptom: "User sees red toast alert: 'You do not have permission to perform this action' when clicking clinical or billing actions.",
    log: "Authorization failed for user 'dr.yonas'. User lacks role 'Admin' or claim 'Billing.Waiver.Approve'.",
    cause: "The user's assigned role in UserRoles table does not match [Authorize(Roles = '...')] on the controller or permissions.ts.",
    fixSteps: [
      "Inspect controller requirement in C# endpoint.",
      "Query UserRoles in SQL: SELECT u.Username, r.Name FROM Users u JOIN UserRoles ur ON u.Id=ur.UserId JOIN Roles r ON ur.RoleId=r.Id WHERE u.Username='...';",
      "Assign missing role in UserRoles table and have user re-login."
    ],
    fixCmd: "INSERT INTO UserRoles (UserId, RoleId) SELECT u.Id, r.Id FROM Users u, Roles r WHERE u.Username='user' AND r.Name='Admin';",
    docAnchor: "#12-http-403-forbidden-rbac-permission-denied"
  },
  {
    code: "CORS 0",
    title: "CORS Policy Blocked (Access-Control-Allow-Origin)",
    category: "Auth",
    severity: "High",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    symptom: "Browser console displays: 'Access to XMLHttpRequest at http://localhost:5000 has been blocked by CORS policy'.",
    log: "No backend exception logged; browser security sandbox silences the HTTP response before reaching JavaScript.",
    cause: "Client origin (e.g. http://localhost:5173 or clinic.huderma.com) is missing from appsettings.json Cors:AllowedOrigins.",
    fixSteps: [
      "Add client URL to Cors:AllowedOrigins array in src/CMS.API/appsettings.json.",
      "Ensure app.UseCors('DefaultCors') is called before app.UseAuthentication() in Program.cs.",
      "When AllowCredentials() is enabled, never use wildcard origins ('*'); specify exact hostnames."
    ],
    fixCmd: `"Cors": { "AllowedOrigins": ["http://localhost:5173", "https://clinic.huderma.com"] }`,
    docAnchor: "#13-cors-policy-blocked-access-control-allow-origin-missing"
  },
  {
    code: "HTTP 400",
    title: "Bad Request (DTO Validation Failure)",
    category: "HTTP",
    severity: "Low",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    symptom: "Form submission fails; API returns 400 with a dictionary of field validation error messages.",
    log: `{"title": "One or more validation errors occurred.", "errors": {"Phone": ["Must be valid Ethiopian format"]}}`,
    cause: "FluentValidation or DataAnnotations validator rule was violated by submitted frontend JSON.",
    fixSteps: [
      "Check validator in src/CMS.Application/<Module>/<Model>Validator.cs.",
      "Inspect request payload in DevTools Network tab.",
      "Ensure phone regex / decimal parsing matches frontend form mask."
    ],
    fixCmd: `RuleFor(x => x.Phone).NotEmpty().Matches(@"^(?:\\+251|0)(9|7)\\d{8}$");`,
    docAnchor: "#21-http-400-bad-request-dto-validation-failure"
  },
  {
    code: "HTTP 409",
    title: "Conflict (Duplicate Key / Concurrency Violation)",
    category: "HTTP",
    severity: "Medium",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    symptom: "Cannot register patient or save record; error displays 'A record with the specified key already exists'.",
    log: "Microsoft.EntityFrameworkCore.DbUpdateException: Cannot insert duplicate key row in object 'dbo.Patients' with unique index 'IX_Patients_MedicalRecordNumber'.",
    cause: "Two concurrent sessions generated identical MRN or modified same row simultaneously.",
    fixSteps: [
      "Use SQL sequence for atomic MRN generation instead of MAX(MRN) + 1.",
      "In EMR charts, implement optimistic concurrency using [Timestamp] RowVersion."
    ],
    fixCmd: "SELECT current_value FROM sys.sequences WHERE name = 'MedicalRecordNumberSequence';",
    docAnchor: "#23-http-409-conflict-duplicate-mrn-or-concurrency-conflict"
  },
  {
    code: "HTTP 429",
    title: "Too Many Requests (Rate Limiter Tripped)",
    category: "HTTP",
    severity: "Low",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
    symptom: "User is temporarily blocked with: 'Rate limit exceeded. Please try again after 60 seconds.'",
    log: "Rate limit exceeded for client IP '192.168.1.45' on endpoint '/api/v1/auth/login'. Limit: 15 req/min.",
    cause: "ASP.NET Core rate limiter partition exceeded (15 req/min on Auth, 300 req/min on general API).",
    fixSteps: [
      "Increase permit limits in Program.cs if running automated tests or clinic local network.",
      "Whitelist internal clinic subnet (192.168.1.0/24) from aggressive throttling."
    ],
    fixCmd: `options.AddFixedWindowLimiter("auth", opt => { opt.PermitLimit = 50; opt.Window = TimeSpan.FromMinutes(1); });`,
    docAnchor: "#24-http-429-too-many-requests-rate-limiter-tripped"
  },
  {
    code: "HTTP 500",
    title: "DbUpdateException / Foreign Key Violation",
    category: "Database",
    severity: "High",
    badgeColor: "bg-red-100 text-red-800 border-red-200",
    symptom: "Saving Encounter, Order, or Prescription fails with 500 Internal Server Error.",
    log: 'The INSERT statement conflicted with the FOREIGN KEY constraint "FK_Encounters_Patients_PatientId".',
    cause: "Frontend submitted a child record with PatientId, DoctorId, or EncounterId that does not exist in DB.",
    fixSteps: [
      "Verify parent record existence in SQL before insertion.",
      "Add validation in Application Service: var exists = await _db.Patients.AnyAsync(p => p.Id == dto.PatientId);"
    ],
    fixCmd: "SELECT Id, FullName, IsDeleted FROM Patients WHERE Id = @Id;",
    docAnchor: "#31-500-internal-server-error-dbupdateexception--fk-violation"
  },
  {
    code: "SQL 1205",
    title: "Deadlock Victim (Transaction Deadlocked)",
    category: "Database",
    severity: "High",
    badgeColor: "bg-red-100 text-red-800 border-red-200",
    symptom: "Occasional random 500 during peak hours when triage, billing, and lab results update at the same moment.",
    log: "SqlException (0x80131904): Transaction (Process ID 72) was deadlocked on lock resources and chosen as deadlock victim.",
    cause: "Competing transactions acquiring locks in opposite order (Tx1: Patients->Invoices, Tx2: Invoices->Patients).",
    fixSteps: [
      "Enable Read Committed Snapshot Isolation (RCSI) in SQL Server to avoid read locks blocking writes.",
      "Add Polly retry on error number 1205 in EF Core options.",
      "Standardize lock order across all services: always update parent before child."
    ],
    fixCmd: "ALTER DATABASE HudermaCMS SET READ_COMMITTED_SNAPSHOT ON;",
    docAnchor: "#32-sql-deadlock-exception-error-1205"
  },
  {
    code: "DB POOL",
    title: "Connection Pool Exhausted (Timeout Elapsed)",
    category: "Database",
    severity: "Critical",
    badgeColor: "bg-red-100 text-red-800 border-red-200",
    symptom: "Entire CMS freezes; all requests spin for 30s and fail with 500.",
    log: "System.InvalidOperationException: Timeout expired. The timeout period elapsed prior to obtaining a connection from the pool.",
    cause: "Leaked ADO.NET connection (missing using/await using) or synchronous .Result/.Wait() blocking thread pool.",
    fixSteps: [
      "Find leaked sleeping transactions in sys.dm_exec_sessions and kill blocking PID.",
      "Ensure all raw database calls use await using var conn = new SqlConnection(...);",
      "Temporarily increase Max Pool Size=200 in connection string."
    ],
    fixCmd: "SELECT session_id, status, open_transaction_count FROM sys.dm_exec_sessions WHERE is_user_process=1 AND open_transaction_count>0;",
    docAnchor: "#33-connection-pool-exhausted-timeout-expired-the-timeout-period-elapsed-prior-to-obtaining-a-connection-from-the-pool"
  },
  {
    code: "PORT 10001",
    title: "Socket AddressAlreadyInUse / Connection Refused",
    category: "LIS",
    severity: "High",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    symptom: "Mindray BC-5000 or ZYBIO Z3 machine says 'Connection refused'; lab results do not sync automatically.",
    log: "Failed to establish TCP listener on port 10001. System.Net.Sockets.SocketException: Only one usage of each socket address is normally permitted.",
    cause: "An orphaned API process or another service is already bound to port 10001, or Windows Firewall blocked port.",
    fixSteps: [
      "Find locking PID: netstat -ano | findstr 10001",
      "Kill locking process: taskkill /PID <PID> /F",
      "Open inbound firewall ports 10001-10005: New-NetFirewallRule -DisplayName 'CMS LIS' -Direction Inbound -LocalPort 10001-10005 -Protocol TCP -Action Allow"
    ],
    fixCmd: "Get-Process -Id (Get-NetTCPConnection -LocalPort 10001).OwningProcess | Stop-Process -Force",
    docAnchor: "#41-connection-refused--port-offline-ports-8004-10001-10002"
  },
  {
    code: "ASTM FRAME",
    title: "Malformed Framing / Missing STX or ETX",
    category: "LIS",
    severity: "Medium",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    symptom: "Analyzer connects and sends packets, but results are discarded without saving.",
    log: "ASTM Frame framing error: Expected STX (0x02) at start of frame, received: 0x48 ('H'). Frame discarded.",
    cause: "Machine configured for raw ASTM on an MLLP port or vice-versa (HL7 on Port 8004 vs ASTM on 10001/10002).",
    fixSteps: [
      "Verify analyzer port assignment: HL7 -> 8004, Mindray ASTM -> 10001, ZYBIO Z3 -> 10002.",
      "Check LisSettings in appsettings.json."
    ],
    fixCmd: "Test-NetConnection -ComputerName 127.0.0.1 -Port 10001",
    docAnchor: "#42-malformed-mllp--astm-framing-missing-stx-or-etx"
  },
  {
    code: "SIGNALR WS",
    title: "WebSocket Handshake 404 / 500 Failure",
    category: "SignalR",
    severity: "Medium",
    badgeColor: "bg-cyan-100 text-cyan-800 border-cyan-200",
    symptom: "Queue TV calling chime does not ring when doctor clicks 'Call Next'. Yellow bar displays reconnecting.",
    log: "WebSocket failed to connect. The URL 'wss://clinic.huderma.com/hubs/notifications' returned 404.",
    cause: "IIS or Reverse proxy not forwarding Upgrade: websocket header, or WebSockets feature not installed in Windows Server.",
    fixSteps: [
      "Install WebSocket feature in IIS: Install-WindowsFeature -Name Web-WebSockets.",
      "Verify app.MapHub<NotificationHub>('/hubs/notifications') in Program.cs.",
      "Enable Long-Polling fallback in client options."
    ],
    fixCmd: "Install-WindowsFeature -Name Web-WebSockets",
    docAnchor: "#51-signalr-websocket-connection-failed-http-404--500-on-negotiate"
  },
  {
    code: "CHAPA SEC",
    title: "Chapa Webhook HMAC Signature Invalid",
    category: "Payments",
    severity: "High",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    symptom: "Patient pays mobile bill via CBE Birr / Telebirr; invoice remains in 'Unpaid' state.",
    log: "Chapa Webhook HMAC signature verification failed. Computed: 'd8a7...', Received Header: '9f2c...'. 401.",
    cause: "Webhook SecretHash in appsettings.json does not match the merchant dashboard key.",
    fixSteps: [
      "Copy Secret Hash from Chapa Dashboard -> Settings -> Webhooks.",
      "Update Chapa:SecretHash in appsettings.json."
    ],
    fixCmd: `"Chapa": { "SecretHash": "LIVE_SECRET_HASH", "SecretKey": "CHASECK_LIVE-..." }`,
    docAnchor: "#61-chapa-webhook-signature-verification-failed"
  },
  {
    code: "TELEGRAM 409",
    title: "Telegram Bot Conflict (Terminated by GetUpdates)",
    category: "Telemed",
    severity: "Medium",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    symptom: "Clinic telemedicine bot stops responding to patient messages.",
    log: "Telegram.Bot.Exceptions.ApiRequestException: Conflict: terminated by other getUpdates request.",
    cause: "Two instances of CMS API (e.g. local dev PC and staging server) running simultaneously using same bot token.",
    fixSteps: [
      "Never share production Telegram bot tokens on local dev machines.",
      "Create a dedicated dev bot via @BotFather (e.g. @HudermaDevBot) for local development."
    ],
    fixCmd: `curl -F "url=https://clinic.huderma.com/api/v1/telegram/webhook" https://api.telegram.org/bot<TOKEN>/setWebhook`,
    docAnchor: "#71-telegram-bot-409-conflict-terminated-by-other-getupdates-request"
  },
  {
    code: "REACT WHITE",
    title: "White Screen of Death (Cannot read properties of undefined)",
    category: "Frontend",
    severity: "Critical",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    symptom: "Staff opens a patient record or billing screen; the entire browser window turns blank white.",
    log: "Uncaught TypeError: Cannot read properties of undefined (reading 'map') at EmrSoapPage.tsx:142",
    cause: "API returned null instead of empty array [] for nested collections and component lacked optional chaining.",
    fixSteps: [
      "Use safe array access in React: (items || []).map(...) instead of items.map(...).",
      "Ensure App.tsx wraps routes in <ErrorBoundary>."
    ],
    fixCmd: `{(items || []).map(item => <Row key={item.id} data={item} />)}`,
    docAnchor: "#81-white-screen-of-death-uncaught-runtime-exception"
  },
  {
    code: "PWA CACHE",
    title: "Stale PWA Service Worker (ChunkLoadError)",
    category: "Frontend",
    severity: "Medium",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    symptom: "After deploying new features, receptionists see broken icons or get 'Loading chunk failed'.",
    log: "ChunkLoadError: Loading chunk assets/EmrSoapPage-DF21a.js failed.",
    cause: "Service Worker cached obsolete JS chunks that were replaced in the latest production build.",
    fixSteps: [
      "Instruct staff to press Ctrl + Shift + R (Hard Refresh).",
      "In DevTools -> Application -> Storage -> Click 'Clear site data'.",
      "Configure cleanupOutdatedCaches: true in vite.config.ts."
    ],
    fixCmd: "Ctrl + Shift + R",
    docAnchor: "#82-stale-pwa-service-worker-cache-after-production-update"
  }
];

// 4. Build the HTML template
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HUDERMA CMS - Developer Hub & Documentation</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Marked.js Markdown Parser -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <!-- FontAwesome Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    .tab-active { border-bottom: 3px solid #2563eb; color: #1d4ed8; font-weight: 700; }
    .doc-active { background-color: #eff6ff; border-left: 3px solid #2563eb; color: #1d4ed8; font-weight: 600; }
    /* GitHub Markdown Container Styling */
    .markdown-body { font-size: 14px; line-height: 1.65; color: #1e293b; }
    .markdown-body h1 { font-size: 1.85rem; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 1.25rem; margin-bottom: 1rem; color: #0f172a; }
    .markdown-body h2 { font-size: 1.45rem; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.35rem; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #1e293b; }
    .markdown-body h3 { font-size: 1.15rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.5rem; color: #334155; }
    .markdown-body h4 { font-size: 1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.35rem; color: #475569; }
    .markdown-body p { margin-bottom: 0.85rem; }
    .markdown-body ul, .markdown-body ol { padding-left: 1.5rem; margin-bottom: 0.85rem; }
    .markdown-body ul { list-style-type: disc; }
    .markdown-body ol { list-style-type: decimal; }
    .markdown-body li { margin-bottom: 0.25rem; }
    .markdown-body code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background-color: #f1f5f9; padding: 0.15rem 0.35rem; border-radius: 0.25rem; font-size: 0.85em; color: #b91c1c; }
    .markdown-body pre { background-color: #0f172a; color: #f8fafc; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin-bottom: 1rem; }
    .markdown-body pre code { background-color: transparent; color: inherit; padding: 0; font-size: 0.85rem; }
    .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.85rem; }
    .markdown-body th, .markdown-body td { border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; text-align: left; }
    .markdown-body th { background-color: #f8fafc; font-weight: 600; }
    .markdown-body blockquote { border-left: 4px solid #3b82f6; padding-left: 1rem; color: #475569; font-style: italic; margin-bottom: 1rem; background-color: #f8fafc; padding: 0.75rem 1rem; border-radius: 0 0.375rem 0.375rem 0; }
    .markdown-body a { color: #2563eb; text-decoration: underline; font-weight: 500; cursor: pointer; }
    .markdown-body a:hover { color: #1d4ed8; }
    .markdown-body hr { border: 0; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col">

  <!-- Header & Top Navigation -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        
        <!-- Brand & Title -->
        <div class="flex items-center space-x-3 cursor-pointer" onclick="switchTab('arch')">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <i class="fa-solid fa-hospital text-lg"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-black text-lg tracking-tight bg-gradient-to-r from-blue-700 to-indigo-800 bg-clip-text text-transparent">HUDERMA CMS</span>
              <span class="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">Self-Reliant Dev Hub</span>
            </div>
            <p class="text-xs text-slate-500 font-medium">Architecture, Onboarding, Error Encyclopedia & Code Maps</p>
          </div>
        </div>

        <!-- Global Search / Quick Links -->
        <div class="flex items-center space-x-3">
          <div class="relative hidden lg:block w-72">
            <i class="fa-solid fa-search absolute left-3 top-2.5 text-xs text-slate-400"></i>
            <input type="text" id="global-search" oninput="handleGlobalSearch()" placeholder="Search error codes, files, docs..." class="w-full pl-8 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
            <div id="global-search-results" class="hidden absolute top-10 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto p-2"></div>
          </div>

          <button onclick="openDocInReader('handbook')" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200" title="Quick Read Handbook">
            <i class="fa-solid fa-book-open"></i> Handbook
          </button>
          <button onclick="switchTab('errors')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition border border-red-200" title="System Errors & Solutions">
            <i class="fa-solid fa-triangle-exclamation"></i> Error Solutions
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <nav class="flex space-x-6 overflow-x-auto border-t border-slate-100" id="main-nav-tabs">
        <button onclick="switchTab('arch')" id="tab-arch" class="tab-btn py-3 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 tab-active flex items-center gap-2 whitespace-nowrap">
          <i class="fa-solid fa-sitemap"></i> 1. Architecture Blueprint
        </button>
        <button onclick="switchTab('docs')" id="tab-docs" class="tab-btn py-3 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-2 whitespace-nowrap">
          <i class="fa-solid fa-book"></i> 2. Document Reader
        </button>
        <button onclick="switchTab('codedir')" id="tab-codedir" class="tab-btn py-3 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-2 whitespace-nowrap">
          <i class="fa-solid fa-folder-tree"></i> 3. Code Directory Map
        </button>
        <button onclick="switchTab('errors')" id="tab-errors" class="tab-btn py-3 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-2 whitespace-nowrap">
          <i class="fa-solid fa-triangle-exclamation text-red-500"></i> 4. Error Encyclopedia
        </button>
        <button onclick="switchTab('generator')" id="tab-generator" class="tab-btn py-3 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-2 whitespace-nowrap">
          <i class="fa-solid fa-wand-magic-sparkles text-amber-500"></i> 5. Module Generator
        </button>
        <button onclick="switchTab('lis')" id="tab-lis" class="tab-btn py-3 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-2 whitespace-nowrap">
          <i class="fa-solid fa-microscope text-emerald-500"></i> 6. LIS Simulator
        </button>
        <button onclick="switchTab('troubleshoot')" id="tab-troubleshoot" class="tab-btn py-3 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-2 whitespace-nowrap">
          <i class="fa-solid fa-stethoscope text-indigo-500"></i> 7. Quick Diagnostics
        </button>
      </nav>
    </div>
  </header>

  <!-- Main Content Areas -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">

    <!-- TAB 1: ARCHITECTURE BLUEPRINT -->
    <section id="content-arch" class="space-y-6">
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Interactive Clean Architecture Blueprint</h1>
            <p class="text-xs text-slate-500 mt-1">Click any layer below to inspect its responsibilities, dependencies, files, and debugging tips.</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="openDocInReader('arch')" class="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition border border-blue-200">
              <i class="fa-solid fa-file-lines mr-1"></i> Read Full Architecture Spec
            </button>
            <button onclick="switchTab('codedir')" class="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition">
              <i class="fa-solid fa-folder-tree mr-1"></i> View Code Directory
            </button>
          </div>
        </div>

        <!-- Interactive Onion / Layer Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Left: Layer Cards -->
          <div class="lg:col-span-5 space-y-3">
            <div onclick="selectLayer('frontend')" id="layer-card-frontend" class="layer-card p-4 rounded-xl border-2 border-blue-500 bg-blue-50/50 cursor-pointer transition shadow-sm">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">UI</div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900">1. Frontend Client (SPA & PWA)</h3>
                    <p class="text-[11px] text-slate-500">React 18, TypeScript, Tailwind CSS, Vite</p>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-xs text-blue-600"></i>
              </div>
            </div>

            <div onclick="selectLayer('api')" id="layer-card-api" class="layer-card p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white cursor-pointer transition">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">API</div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900">2. Presentation & API Gateway</h3>
                    <p class="text-[11px] text-slate-500">ASP.NET Core 8 Web API, Controllers, Middleware</p>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-xs text-slate-400"></i>
              </div>
            </div>

            <div onclick="selectLayer('application')" id="layer-card-application" class="layer-card p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white cursor-pointer transition">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">APP</div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900">3. Application Business Logic</h3>
                    <p class="text-[11px] text-slate-500">Workflows, Services, DTOs, FluentValidation</p>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-xs text-slate-400"></i>
              </div>
            </div>

            <div onclick="selectLayer('domain')" id="layer-card-domain" class="layer-card p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white cursor-pointer transition">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs">DOM</div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900">4. Domain Core (Zero Dependencies)</h3>
                    <p class="text-[11px] text-slate-500">Entities, Enums, Interfaces, Value Objects</p>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-xs text-slate-400"></i>
              </div>
            </div>

            <div onclick="selectLayer('infrastructure')" id="layer-card-infrastructure" class="layer-card p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white cursor-pointer transition">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs">INF</div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900">5. Infrastructure & Hardware Adapters</h3>
                    <p class="text-[11px] text-slate-500">EF Core AppDbContext, SQL Server, Redis, LIS Sockets</p>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-xs text-slate-400"></i>
              </div>
            </div>
          </div>

          <!-- Right: Layer Details View -->
          <div class="lg:col-span-7 bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col justify-between" id="layer-details-box">
            <div>
              <div class="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div>
                  <span id="detail-tag" class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">Client Layer</span>
                  <h2 id="detail-title" class="text-lg font-bold text-slate-900 mt-1">Frontend SPA (React 18 + TypeScript)</h2>
                </div>
                <div class="text-right">
                  <span class="text-xs text-slate-400">Directory</span>
                  <p id="detail-dir" class="text-xs font-mono font-semibold text-slate-700">frontend/cms-web/</p>
                </div>
              </div>

              <div class="space-y-4">
                <div>
                  <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Responsibilities</h4>
                  <p id="detail-desc" class="text-xs text-slate-600 leading-relaxed">
                    User interface for Reception, EMR, Billing, Pharmacy, Lab, and Admin. Sends authenticated requests with HttpOnly session cookies via Axios, connects to SignalR for live queue notifications.
                  </p>
                </div>

                <div>
                  <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Key Files & Subdirectories</h4>
                  <ul id="detail-files" class="text-xs font-mono space-y-1 text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                    <!-- Populated dynamically -->
                  </ul>
                </div>

                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h4 class="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                    <i class="fa-solid fa-wrench"></i> How to Customize or Fix Bugs
                  </h4>
                  <p id="detail-tips" class="text-xs text-amber-800">
                    Always check DevTools Console and Network tab. If routes are forbidden, check permissions.ts and ensure apiClient.ts sends cookies.
                  </p>
                </div>
              </div>
            </div>

            <div class="mt-6 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span class="text-xs text-slate-500">Need to add a feature in this layer?</span>
              <button onclick="switchTab('generator')" class="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-semibold transition shadow-sm">
                Open Code Generator <i class="fa-solid fa-arrow-right ml-1"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 2: DOCUMENT READER -->
    <section id="content-docs" class="hidden space-y-4">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left: Document List Sidebar -->
        <div class="lg:col-span-4 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm sticky top-24 max-h-[85vh] flex flex-col">
          <div class="pb-3 border-b border-slate-100 mb-3">
            <h3 class="font-bold text-sm text-slate-900 flex items-center gap-2">
              <i class="fa-solid fa-book-bookmark text-blue-600"></i> Documentation Library
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">8 Comprehensive Manuals (Self-Contained)</p>
            <div class="mt-3 relative">
              <i class="fa-solid fa-search absolute left-2.5 top-2.5 text-xs text-slate-400"></i>
              <input type="text" id="doc-search" oninput="filterDocs()" placeholder="Filter manuals..." class="w-full pl-7 pr-3 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
            </div>
          </div>

          <!-- Doc Items List -->
          <div class="space-y-1.5 overflow-y-auto flex-1 pr-1" id="doc-nav-list">
            <!-- Populated via JS -->
          </div>
        </div>

        <!-- Right: Active Document Markdown Content -->
        <div class="lg:col-span-8 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <!-- Reader Top Action Bar -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
            <div>
              <span id="reader-category" class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Core Guide</span>
              <h1 id="reader-title" class="text-xl sm:text-2xl font-black text-slate-900 mt-1">Developer Handbook & Master Onboarding</h1>
              <p id="reader-path" class="text-xs font-mono text-slate-400 mt-0.5">docs/DEVELOPER_HANDBOOK.md</p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="copyDocPath()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5" title="Copy full disk path">
                <i class="fa-regular fa-copy"></i> <span id="copy-doc-path-text">Copy Path</span>
              </button>
              <a id="reader-vscode-link" href="#" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border border-blue-200" title="Open directly in Visual Studio Code">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Open in VS Code
              </a>
            </div>
          </div>

          <!-- Rendered Markdown Body -->
          <div id="markdown-container" class="markdown-body">
            <!-- Rendered by marked.js -->
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 3: CODE DIRECTORY MAP -->
    <section id="content-codedir" class="hidden space-y-6">
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Code Directory & Component Map</h1>
            <p class="text-xs text-slate-500 mt-1">Quick-reference guide explaining what every file does, when to edit it, and common bug fixes.</p>
          </div>

          <!-- Filter Pills -->
          <div class="flex flex-wrap items-center gap-2" id="codedir-filters">
            <button onclick="filterCodeDir('all')" class="codedir-pill px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white">All Files</button>
            <button onclick="filterCodeDir('API')" class="codedir-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">API</button>
            <button onclick="filterCodeDir('Application')" class="codedir-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Application</button>
            <button onclick="filterCodeDir('Domain')" class="codedir-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Domain</button>
            <button onclick="filterCodeDir('Infrastructure')" class="codedir-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Infrastructure</button>
            <button onclick="filterCodeDir('Frontend')" class="codedir-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Frontend</button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="mb-6 relative">
          <i class="fa-solid fa-search absolute left-3 top-3 text-sm text-slate-400"></i>
          <input type="text" id="codedir-search" oninput="renderCodeDir()" placeholder="Search by file path, purpose, or error symptom..." class="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
        </div>

        <!-- Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="codedir-grid">
          <!-- Populated by JS -->
        </div>
      </div>
    </section>

    <!-- TAB 4: ERROR ENCYCLOPEDIA (DEDICATED PAGE / SOLVER) -->
    <section id="content-errors" class="hidden space-y-6">
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm"><i class="fa-solid fa-triangle-exclamation"></i></span>
              <h1 class="text-2xl font-bold text-slate-900">System Error Encyclopedia & Solutions Manual</h1>
            </div>
            <p class="text-xs text-slate-500 mt-1">Dedicated interactive troubleshooting solver for every HTTP, Database, LIS Socket, Auth, and Frontend error.</p>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="openDocInReader('errors')" class="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold transition border border-red-200">
              <i class="fa-solid fa-book mr-1"></i> Read Full 30KB Error Manual
            </button>
            <button onclick="switchTab('troubleshoot')" class="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition">
              <i class="fa-solid fa-stethoscope mr-1"></i> Quick Checklist
            </button>
          </div>
        </div>

        <!-- Error Search & Category Filter Bar -->
        <div class="space-y-3 mb-6">
          <div class="relative">
            <i class="fa-solid fa-search absolute left-3 top-3 text-sm text-slate-400"></i>
            <input type="text" id="error-search-input" oninput="renderErrorEncyclopedia()" placeholder="Type error code or keyword (e.g. 401, 1205, 10001, CORS, Deadlock, Chapa, PWA, White screen)..." class="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50">
          </div>

          <!-- Category filter buttons -->
          <div class="flex flex-wrap items-center gap-2" id="error-category-filters">
            <button onclick="filterErrorCat('all')" class="err-pill px-3 py-1 text-xs font-semibold rounded-lg bg-red-600 text-white">All Errors (16)</button>
            <button onclick="filterErrorCat('Auth')" class="err-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Auth & RBAC</button>
            <button onclick="filterErrorCat('HTTP')" class="err-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">HTTP & Validation</button>
            <button onclick="filterErrorCat('Database')" class="err-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Database & EF Core</button>
            <button onclick="filterErrorCat('LIS')" class="err-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">LIS Analyzers & Sockets</button>
            <button onclick="filterErrorCat('SignalR')" class="err-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Real-Time & SignalR</button>
            <button onclick="filterErrorCat('Payments')" class="err-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Payments & Integrations</button>
            <button onclick="filterErrorCat('Frontend')" class="err-pill px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Frontend & PWA</button>
          </div>
        </div>

        <!-- Emergency Recovery Command Banner -->
        <div class="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-4 mb-6 shadow-md">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <i class="fa-solid fa-bolt"></i> Emergency Quick-Kill Commands (Run in PowerShell as Administrator)
            </span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
            <div class="bg-black/40 p-2.5 rounded-lg border border-white/10 flex items-center justify-between">
              <div>
                <span class="text-slate-400 block text-[10px]">Kill Hung API</span>
                <code>taskkill /IM CMS.API.exe /F</code>
              </div>
              <button onclick="copyRaw('taskkill /IM CMS.API.exe /F')" class="text-slate-400 hover:text-white p-1" title="Copy"><i class="fa-regular fa-copy"></i></button>
            </div>
            <div class="bg-black/40 p-2.5 rounded-lg border border-white/10 flex items-center justify-between">
              <div>
                <span class="text-slate-400 block text-[10px]">Free Port 10001 (LIS)</span>
                <code class="text-[11px]">taskkill /PID (PID) /F</code>
              </div>
              <button onclick="copyRaw('Get-Process -Id (Get-NetTCPConnection -LocalPort 10001).OwningProcess | Stop-Process -Force')" class="text-slate-400 hover:text-white p-1" title="Copy PowerShell"><i class="fa-regular fa-copy"></i></button>
            </div>
            <div class="bg-black/40 p-2.5 rounded-lg border border-white/10 flex items-center justify-between">
              <div>
                <span class="text-slate-400 block text-[10px]">Tail Real-Time Log</span>
                <code class="text-[11px]">Get-Content logs -Wait</code>
              </div>
              <button onclick="copyRaw('Get-Content src\\CMS.API\\logs\\cms-api-*.log -Wait -Tail 50')" class="text-slate-400 hover:text-white p-1" title="Copy"><i class="fa-regular fa-copy"></i></button>
            </div>
          </div>
        </div>

        <!-- Error Cards Container -->
        <div class="space-y-4" id="error-cards-container">
          <!-- Populated dynamically -->
        </div>
      </div>
    </section>

    <!-- TAB 5: MODULE GENERATOR -->
    <section id="content-generator" class="hidden space-y-6">
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Interactive New Module Code Generator</h1>
            <p class="text-xs text-slate-500 mt-1">Generates clean C# and TypeScript code following HUDERMA Clean Architecture patterns.</p>
          </div>
          <button onclick="openDocInReader('newmodule')" class="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition border border-blue-200">
            <i class="fa-solid fa-book-open mr-1"></i> Read 11-Step Recipe
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Left: Input form -->
          <div class="lg:col-span-4 space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Module Name (Singular PascalCase)</label>
              <input type="text" id="gen-module-name" value="PatientFeedback" oninput="generateModuleCode()" class="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono">
              <span class="text-[10px] text-slate-400">e.g., PatientFeedback, BedTransfer, DoctorReview</span>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Plural Form</label>
              <input type="text" id="gen-module-plural" value="PatientFeedbacks" oninput="generateModuleCode()" class="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Step to Inspect</label>
              <div class="space-y-1.5">
                <button onclick="setGenStep('entity')" id="btn-gen-entity" class="gen-step-btn w-full text-left p-2 rounded-lg text-xs font-semibold bg-blue-600 text-white">Step 1: Domain Entity & DTO</button>
                <button onclick="setGenStep('db')" id="btn-gen-db" class="gen-step-btn w-full text-left p-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700">Step 2: DbContext & Migration</button>
                <button onclick="setGenStep('service')" id="btn-gen-service" class="gen-step-btn w-full text-left p-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700">Step 3: Application Service</button>
                <button onclick="setGenStep('controller')" id="btn-gen-controller" class="gen-step-btn w-full text-left p-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700">Step 4: API Controller</button>
                <button onclick="setGenStep('react')" id="btn-gen-react" class="gen-step-btn w-full text-left p-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700">Step 5: React UI Component</button>
              </div>
            </div>
          </div>

          <!-- Right: Generated Code Preview -->
          <div class="lg:col-span-8 flex flex-col">
            <div class="flex items-center justify-between bg-slate-900 text-slate-300 px-4 py-2.5 rounded-t-xl text-xs font-mono">
              <span id="gen-code-path">src/CMS.Domain/Entities/PatientFeedback.cs</span>
              <button onclick="copySnippet()" class="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded transition flex items-center gap-1.5">
                <i class="fa-regular fa-copy"></i> <span id="copy-btn-text">Copy Code</span>
              </button>
            </div>
            <pre class="bg-slate-950 text-emerald-400 p-4 rounded-b-xl overflow-x-auto text-xs font-mono flex-1 leading-relaxed max-h-[500px]" id="gen-code-content"></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 6: LIS SIMULATOR -->
    <section id="content-lis" class="hidden space-y-6">
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Laboratory Information System (LIS) Simulator</h1>
            <p class="text-xs text-slate-500 mt-1">Simulate Mindray BC-5000 (ASTM 1394) and ZYBIO Z3 analyzer TCP socket frames.</p>
          </div>
          <button onclick="switchTab('errors')" class="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition border border-emerald-200">
            <i class="fa-solid fa-triangle-exclamation mr-1"></i> LIS Socket Errors & Fixes
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Machine Selection & Frame Preview -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <button onclick="selectLisMachine('mindray')" id="btn-lis-mindray" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white">Mindray BC-5000 (Port 10001)</button>
              <button onclick="selectLisMachine('zybio')" id="btn-lis-zybio" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-600">ZYBIO Z3 (Port 10002)</button>
              <button onclick="selectLisMachine('hl7')" id="btn-lis-hl7" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-600">HL7 MLLP (Port 8004)</button>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Simulated Barcode / Sample ID</label>
              <input type="text" id="lis-sample-id" value="LAB-2026-90412" oninput="updateLisPayload()" class="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Raw Packet Stream (Hex + ASCII Framing)</label>
              <pre id="lis-raw-frame" class="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono overflow-x-auto h-48"></pre>
            </div>
          </div>

          <!-- Parsed Test Results -->
          <div>
            <h3 class="text-xs font-bold text-slate-700 uppercase mb-2">Parsed Clinical Laboratory Values</h3>
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b border-slate-200 text-slate-500">
                    <th class="text-left py-1.5">Parameter</th>
                    <th class="text-left py-1.5">Value</th>
                    <th class="text-left py-1.5">Reference Range</th>
                    <th class="text-left py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody id="lis-parsed-rows" class="divide-y divide-slate-100 font-mono">
                  <!-- Populated by JS -->
                </tbody>
              </table>
            </div>

            <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
              <span class="font-bold block mb-1"><i class="fa-solid fa-circle-info mr-1"></i> Under the Hood:</span>
              Packets enter <code class="font-mono text-blue-700">LisTcpListenerService.cs</code>, are parsed by <code class="font-mono text-blue-700">AstmProtocolHandler.cs</code>, and matched to active LabOrders by Barcode.
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 7: QUICK DIAGNOSTICS & TROUBLESHOOT -->
    <section id="content-troubleshoot" class="hidden space-y-6">
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">System Diagnostics & Troubleshooting Playbook</h1>
            <p class="text-xs text-slate-500 mt-1">Pre-flight checks and quick health diagnostic routines for local development and production.</p>
          </div>
          <button onclick="switchTab('errors')" class="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-xs font-semibold transition shadow-sm">
            <i class="fa-solid fa-triangle-exclamation mr-1"></i> Open Error Encyclopedia
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div class="flex items-center gap-2 text-blue-600 font-bold text-sm">
              <i class="fa-solid fa-server"></i> 1. Backend API Health
            </div>
            <p class="text-xs text-slate-600">Checks if ASP.NET Core Kestrel is listening on port 5010/5000 and accepting requests.</p>
            <div class="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-700">
              curl http://localhost:5010/health
            </div>
          </div>

          <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div class="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <i class="fa-solid fa-database"></i> 2. SQL Server Connection
            </div>
            <p class="text-xs text-slate-600">Tests connection string validity, credentials, and pending database migrations.</p>
            <div class="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-700">
              dotnet ef database update --dry-run
            </div>
          </div>

          <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div class="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <i class="fa-solid fa-microscope"></i> 3. LIS Socket Ports
            </div>
            <p class="text-xs text-slate-600">Verifies that ports 8004, 10001, and 10002 are not locked or blocked by firewall.</p>
            <div class="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-700">
              netstat -ano | findstr "10001"
            </div>
          </div>
        </div>
      </div>
    </section>

  </main>

  <!-- Embedded JSON Documentation Store -->
  <script id="docs-data" type="application/json">
${JSON.stringify(docsMap)}
  </script>

  <!-- Embedded Code Files Store -->
  <script id="code-files-data" type="application/json">
${JSON.stringify(codeFiles)}
  </script>

  <!-- Embedded Error Encyclopedia Store -->
  <script id="errors-data" type="application/json">
${JSON.stringify(errorEncyclopedia)}
  </script>

  <!-- Client-Side Application Logic -->
  <script>
    // Safe initialization from JSON script blocks
    const DOCS = JSON.parse(document.getElementById('docs-data').textContent);
    const CODE_FILES = JSON.parse(document.getElementById('code-files-data').textContent);
    const ERRORS = JSON.parse(document.getElementById('errors-data').textContent);

    let activeDocId = 'handbook';
    let currentCodeDirFilter = 'all';
    let currentErrorCat = 'all';
    let currentGenStep = 'entity';
    let currentLisMachine = 'mindray';

    // Layer metadata for Blueprint
    const LAYER_META = {
      frontend: {
        tag: 'Client Presentation Layer',
        title: 'Frontend SPA (React 18 + TypeScript)',
        dir: 'frontend/cms-web/',
        desc: 'Single-page application with dynamic code-splitting (React.lazy & Suspense for all 26 pages, 73.59 kB entry bundle) and Rollup vendor chunking. Communicates via HttpOnly cookies and SignalR live chimes.',
        files: [
          'frontend/cms-web/src/App.tsx (Route definitions & auth protection)',
          'frontend/cms-web/src/api/apiClient.ts (Axios with withCredentials: true)',
          'frontend/cms-web/src/components/Sidebar.tsx (Role-based menu rendering)',
          'frontend/cms-web/src/utils/permissions.ts (Role-permission mapping matrix)',
          'frontend/cms-web/src/pages/EMR/EmrSoapPage.tsx (Doctor consultation chart)'
        ],
        tips: 'Always check browser DevTools (F12) Console and Network tabs. Ensure API calls use api instance from apiClient.ts.'
      },
      api: {
        tag: 'Web Gateway & Host',
        title: 'CMS.API (ASP.NET Core 8 Web API)',
        dir: 'src/CMS.API/',
        desc: 'Entry point for HTTP requests with Brotli & Gzip optimal response compression, JWT cookies, ApiPolicy rate limiting (300 req/min), Redis-cached catalog (<2ms), and SignalR hubs.',
        files: [
          'src/CMS.API/Program.cs (DI container, Middleware, SignalR hubs)',
          'src/CMS.API/Controllers/ClinicalControllers.cs (Encounters, Appointments)',
          'src/CMS.API/Controllers/PharmacyBillingControllers.cs (Billing, Dispensary)',
          'src/CMS.API/Controllers/Controllers.cs (Login, Refresh Token, Logout)',
          'src/CMS.API/appsettings.json (Connection strings, CORS, Chapa keys)'
        ],
        tips: 'When an endpoint returns 500, inspect src/CMS.API/logs/cms-api-*.log. If a service cannot be resolved, check builder.Services.AddScoped in Program.cs.'
      },
      application: {
        tag: 'Business Logic Core',
        title: 'CMS.Application (Use Cases & Workflows)',
        dir: 'src/CMS.Application/',
        desc: 'Contains business workflows, validation rules (FluentValidation), transaction boundaries, and service interfaces. Pure C# with no knowledge of HTTP or database drivers.',
        files: [
          'src/CMS.Application/Encounters/SoapAndClinicalService.cs (Clinical consultations)',
          'src/CMS.Application/Billing/BillingService.cs (Invoices & Waivers)',
          'src/CMS.Application/Patients/PatientService.cs (Demographics & MRN generation)',
          'src/CMS.Application/Queue/QueueService.cs (Patient calling & triage priority)'
        ],
        tips: 'Add new business features here first! Write unit tests against service interfaces without needing a real web server.'
      },
      domain: {
        tag: 'Enterprise Core Domain',
        title: 'CMS.Domain (Entities & Contracts)',
        dir: 'src/CMS.Domain/',
        desc: 'The innermost onion layer. Contains core business models, enums, interfaces, and domain events. Completely decoupled from external libraries or frameworks.',
        files: [
          'src/CMS.Domain/Entities/ClinicalEntities.cs (Encounter, SOAP, Diagnosis, LabOrder)',
          'src/CMS.Domain/Entities/BillingEntities.cs (Invoice, Payment, Waiver, LineItem)',
          'src/CMS.Domain/Entities/PatientEntities.cs (Patient demographics, Emergency contact)',
          'src/CMS.Domain/Enums/ClinicalEnums.cs (EncounterStatus, PriorityLevel, Gender)'
        ],
        tips: 'Never add database or web references to CMS.Domain. Keep entity properties clean and use decimal(18,2) for all financial numbers.'
      },
      infrastructure: {
        tag: 'Adapters & External Tech',
        title: 'CMS.Infrastructure (Database & Hardware)',
        dir: 'src/CMS.Infrastructure/',
        desc: 'EF Core DbContext, covering performance indexes, Redis cache, and high-concurrency LIS TCP listener with Bounded Channel<T>, SemaphoreSlim(50,50), and UnassignedLabResults quarantine.',
        files: [
          'src/CMS.Infrastructure/Data/AppDbContext.cs (EF Core model mapping & relationships)',
          'src/CMS.Infrastructure/LabIntegration/LisTcpListenerService.cs (Mindray/ZYBIO TCP listener)',
          'src/CMS.Infrastructure/LabIntegration/AstmProtocolHandler.cs (ASTM 1394 packet parser)',
          'src/CMS.Infrastructure/Services/RedisCacheService.cs (Distributed caching)'
        ],
        tips: 'After adding an entity property, create a migration script using dotnet ef migrations add or direct SQL script in database/migration/.'
      }
    };

    // Tab Switching Function (Zero-Fail Implementation)
    function switchTab(tabId) {
      const tabs = ['arch', 'docs', 'codedir', 'errors', 'generator', 'lis', 'troubleshoot'];
      if (!tabs.includes(tabId)) tabId = 'arch';

      tabs.forEach(t => {
        const content = document.getElementById('content-' + t);
        const tabBtn = document.getElementById('tab-' + t);
        if (content) content.classList.add('hidden');
        if (tabBtn) tabBtn.classList.remove('tab-active');
      });

      const activeContent = document.getElementById('content-' + tabId);
      const activeTabBtn = document.getElementById('tab-' + tabId);
      if (activeContent) activeContent.classList.remove('hidden');
      if (activeTabBtn) activeTabBtn.classList.add('tab-active');

      // Update URL hash without reload
      window.location.hash = 'tab=' + tabId + (tabId === 'docs' ? '&doc=' + activeDocId : '');

      // Trigger lazy tab initializers
      if (tabId === 'docs') renderDocNav();
      if (tabId === 'codedir') renderCodeDir();
      if (tabId === 'errors') renderErrorEncyclopedia();
      if (tabId === 'generator') generateModuleCode();
      if (tabId === 'lis') updateLisPayload();

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Direct Reader Opener
    function openDocInReader(docId, targetAnchor = '') {
      if (!DOCS[docId]) docId = 'handbook';
      activeDocId = docId;
      switchTab('docs');
      loadDoc(docId, targetAnchor);
    }

    // Render Documentation Sidebar
    function renderDocNav(filter = '') {
      const list = document.getElementById('doc-nav-list');
      if (!list) return;
      list.innerHTML = '';

      const keys = Object.keys(DOCS);
      const filtered = keys.filter(k => {
        const d = DOCS[k];
        return d.title.toLowerCase().includes(filter.toLowerCase()) ||
               d.category.toLowerCase().includes(filter.toLowerCase()) ||
               d.path.toLowerCase().includes(filter.toLowerCase());
      });

      if (filtered.length === 0) {
        list.innerHTML = '<div class="text-xs text-slate-400 p-3 text-center">No matching guides found</div>';
        return;
      }

      filtered.forEach(k => {
        const d = DOCS[k];
        const isActive = k === activeDocId;
        const btn = document.createElement('button');
        btn.onclick = () => loadDoc(k);
        btn.className = \`w-full text-left p-2.5 rounded-lg text-xs transition flex items-start gap-2.5 \${isActive ? 'doc-active' : 'hover:bg-slate-50 text-slate-700'}\`;
        btn.innerHTML = \`
          <i class="fa-solid \${d.icon} text-sm mt-0.5 \${isActive ? 'text-blue-600' : 'text-slate-400'}"></i>
          <div class="flex-1 min-w-0">
            <div class="font-semibold truncate">\${d.title}</div>
            <div class="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>\${d.category}</span> • <span class="font-mono truncate">\${d.path}</span>
            </div>
          </div>
        \`;
        list.appendChild(btn);
      });
    }

    function filterDocs() {
      const q = document.getElementById('doc-search')?.value.trim() || '';
      renderDocNav(q);
    }

    // Load and render document via marked.js
    function loadDoc(docId, targetAnchor = '') {
      const doc = DOCS[docId];
      if (!doc) return;
      activeDocId = docId;

      document.getElementById('reader-title').innerText = doc.title;
      document.getElementById('reader-category').innerText = doc.category;
      document.getElementById('reader-path').innerText = doc.path;
      document.getElementById('reader-vscode-link').href = \`vscode://file/\${doc.fullPath}\`;

      // Render Markdown using marked.js
      const rawMarkdown = doc.content;
      const html = marked.parse(rawMarkdown);
      const container = document.getElementById('markdown-container');
      container.innerHTML = html;

      // Update sidebar active selection
      renderDocNav(document.getElementById('doc-search')?.value || '');

      // Intercept and handle all internal markdown links cleanly!
      interceptMarkdownLinks();

      if (targetAnchor) {
        setTimeout(() => {
          const el = document.getElementById(targetAnchor.replace(/^#/, '')) ||
                     document.querySelector(\`[id*="\${targetAnchor.replace(/^#/, '')}"]\`);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    // Intercept Markdown Links so they never break or jump out of the hub!
    function interceptMarkdownLinks() {
      const container = document.getElementById('markdown-container');
      if (!container) return;

      const links = container.querySelectorAll('a');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        // If it points to another local markdown file:
        const lowerHref = href.toLowerCase();
        let targetDocKey = null;

        if (lowerHref.includes('developer_handbook')) targetDocKey = 'handbook';
        else if (lowerHref.includes('architecture_overview')) targetDocKey = 'arch';
        else if (lowerHref.includes('how_to_add_a_new_module')) targetDocKey = 'newmodule';
        else if (lowerHref.includes('local_development_and_run')) targetDocKey = 'localdev';
        else if (lowerHref.includes('system_errors_and_solutions')) targetDocKey = 'errors';
        else if (lowerHref.includes('debugging_and_troubleshooting')) targetDocKey = 'troubleshoot';
        else if (lowerHref.includes('suggestions_and_roadmap')) targetDocKey = 'roadmap';
        else if (lowerHref.includes('production_update_manual')) targetDocKey = 'prodmanual';

        if (targetDocKey) {
          link.addEventListener('click', function(e) {
            e.preventDefault();
            // Check if there is an anchor hash in the link
            const hashIndex = href.indexOf('#');
            const anchor = hashIndex !== -1 ? href.slice(hashIndex) : '';
            openDocInReader(targetDocKey, anchor);
          });
          link.title = 'Open in Hub Document Reader';
          link.classList.add('cursor-pointer');
        } else if (href.startsWith('#')) {
          // Internal anchor on current page
          link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = href.substring(1);
            const targetElem = document.getElementById(targetId) ||
                               document.querySelector(\`[id*="\${targetId}"]\`);
            if (targetElem) targetElem.scrollIntoView({ behavior: 'smooth' });
          });
        } else if (href.startsWith('http')) {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        }
      });
    }

    function copyDocPath() {
      const doc = DOCS[activeDocId];
      if (!doc) return;
      navigator.clipboard.writeText(doc.fullPath).then(() => {
        const textSpan = document.getElementById('copy-doc-path-text');
        textSpan.innerText = 'Copied!';
        setTimeout(() => { textSpan.innerText = 'Copy Path'; }, 2000);
      });
    }

    // Blueprint Layer Selector
    function selectLayer(layerKey) {
      const meta = LAYER_META[layerKey];
      if (!meta) return;

      ['frontend', 'api', 'application', 'domain', 'infrastructure'].forEach(l => {
        const card = document.getElementById('layer-card-' + l);
        if (card) {
          card.classList.remove('border-2', 'border-blue-500', 'bg-blue-50/50', 'shadow-sm');
          card.classList.add('border-slate-200', 'bg-white');
        }
      });

      const activeCard = document.getElementById('layer-card-' + layerKey);
      if (activeCard) {
        activeCard.classList.remove('border-slate-200', 'bg-white');
        activeCard.classList.add('border-2', 'border-blue-500', 'bg-blue-50/50', 'shadow-sm');
      }

      document.getElementById('detail-tag').innerText = meta.tag;
      document.getElementById('detail-title').innerText = meta.title;
      document.getElementById('detail-dir').innerText = meta.dir;
      document.getElementById('detail-desc').innerText = meta.desc;
      document.getElementById('detail-tips').innerText = meta.tips;

      const filesList = document.getElementById('detail-files');
      filesList.innerHTML = '';
      meta.files.forEach(f => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-1.5';
        li.innerHTML = '<i class="fa-regular fa-file-code text-blue-500 mt-0.5"></i> <span>' + f + '</span>';
        filesList.appendChild(li);
      });
    }

    // Render Code Directory Map
    function renderCodeDir() {
      const container = document.getElementById('codedir-grid');
      if (!container) return;
      const search = (document.getElementById('codedir-search')?.value || '').toLowerCase();
      container.innerHTML = '';

      const filtered = CODE_FILES.filter(f => {
        const matchLayer = currentCodeDirFilter === 'all' || f.layer.toLowerCase() === currentCodeDirFilter.toLowerCase();
        const matchSearch = f.path.toLowerCase().includes(search) ||
                            f.title.toLowerCase().includes(search) ||
                            f.desc.toLowerCase().includes(search) ||
                            f.whenToEdit.toLowerCase().includes(search) ||
                            f.bugFix.toLowerCase().includes(search);
        return matchLayer && matchSearch;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="col-span-2 text-center py-8 text-slate-400 text-xs">No code files match your search criteria.</div>';
        return;
      }

      filtered.forEach(f => {
        const card = document.createElement('div');
        card.className = 'p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition flex flex-col justify-between space-y-3';
        card.innerHTML = \`
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">\${f.layer}</span>
              <a href="vscode://file/C:/Users/ASUS/source/repos/CMS/\${f.path}" class="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1" title="Open in Visual Studio Code">
                <i class="fa-solid fa-code"></i> Open File
              </a>
            </div>
            <h4 class="font-bold text-sm text-slate-900 mt-2">\${f.title}</h4>
            <p class="text-xs font-mono text-slate-500 mt-0.5 break-all">\${f.path}</p>
            <p class="text-xs text-slate-600 mt-2 leading-relaxed">\${f.desc}</p>
          </div>
          <div class="space-y-1.5 pt-2 border-t border-slate-100 text-[11px]">
            <div><strong class="text-slate-700">When to edit:</strong> <span class="text-slate-600">\${f.whenToEdit}</span></div>
            <div><strong class="text-amber-800">Troubleshooting fix:</strong> <span class="text-amber-700 font-mono">\${f.bugFix}</span></div>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function filterCodeDir(layer) {
      currentCodeDirFilter = layer;
      document.querySelectorAll('.codedir-pill').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-slate-100', 'text-slate-600');
      });
      event.target.classList.remove('bg-slate-100', 'text-slate-600');
      event.target.classList.add('bg-blue-600', 'text-white');
      renderCodeDir();
    }

    // Render Error Encyclopedia Cards
    function renderErrorEncyclopedia() {
      const container = document.getElementById('error-cards-container');
      if (!container) return;
      const search = (document.getElementById('error-search-input')?.value || '').toLowerCase();
      container.innerHTML = '';

      const filtered = ERRORS.filter(err => {
        const matchCat = currentErrorCat === 'all' || err.category.toLowerCase() === currentErrorCat.toLowerCase();
        const matchSearch = err.code.toLowerCase().includes(search) ||
                            err.title.toLowerCase().includes(search) ||
                            err.symptom.toLowerCase().includes(search) ||
                            err.log.toLowerCase().includes(search) ||
                            err.cause.toLowerCase().includes(search) ||
                            err.fixSteps.some(s => s.toLowerCase().includes(search));
        return matchCat && matchSearch;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-slate-400 text-xs">No system error records found matching your query.</div>';
        return;
      }

      filtered.forEach(err => {
        const card = document.createElement('div');
        card.className = 'border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm hover:border-slate-300 transition';
        card.innerHTML = \`
          <div class="p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded border \${err.badgeColor}">\${err.code}</span>
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">\${err.category}</span>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded \${err.severity === 'Critical' ? 'bg-red-600 text-white' : err.severity === 'High' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'}">\${err.severity}</span>
              </div>
              <h3 class="text-base font-bold text-slate-900 mt-1">\${err.title}</h3>
              <p class="text-xs text-slate-600"><strong class="text-slate-800">Symptom:</strong> \${err.symptom}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button onclick="openDocInReader('errors', '\${err.docAnchor}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200">
                <i class="fa-solid fa-book-open mr-1"></i> Read in Manual
              </button>
            </div>
          </div>

          <div class="p-4 sm:p-5 space-y-3 text-xs">
            <div>
              <strong class="text-slate-700 block mb-1">Log Signature / Console Error:</strong>
              <pre class="bg-slate-900 text-rose-300 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">\${err.log}</pre>
            </div>

            <div>
              <strong class="text-slate-700 block mb-1">Underlying Root Cause:</strong>
              <p class="text-slate-600 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">\${err.cause}</p>
            </div>

            <div>
              <strong class="text-emerald-800 block mb-1 font-bold">Step-by-Step Resolution:</strong>
              <ol class="list-decimal list-inside space-y-1 text-slate-700 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                \${err.fixSteps.map(s => \`<li>\${s}</li>\`).join('')}
              </ol>
            </div>

            <div class="pt-2 flex items-center justify-between bg-slate-100 px-3 py-2 rounded-lg font-mono text-[11px]">
              <span class="truncate text-slate-700 pr-2">Fix Command: \${err.fixCmd}</span>
              <button onclick="copyRaw('\${err.fixCmd.replace(/'/g, "\\\\'")}')" class="px-2 py-1 bg-white hover:bg-slate-200 rounded border border-slate-300 text-slate-700 shrink-0 font-sans font-semibold text-[10px]">
                <i class="fa-regular fa-copy"></i> Copy
              </button>
            </div>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function filterErrorCat(category) {
      currentErrorCat = category;
      document.querySelectorAll('.err-pill').forEach(btn => {
        btn.classList.remove('bg-red-600', 'text-white');
        btn.classList.add('bg-slate-100', 'text-slate-600');
      });
      event.target.classList.remove('bg-slate-100', 'text-slate-600');
      event.target.classList.add('bg-red-600', 'text-white');
      renderErrorEncyclopedia();
    }

    // Global Search Auto-Suggest
    function handleGlobalSearch() {
      const q = document.getElementById('global-search').value.trim().toLowerCase();
      const resBox = document.getElementById('global-search-results');
      if (!resBox) return;

      if (!q) {
        resBox.classList.add('hidden');
        resBox.innerHTML = '';
        return;
      }

      const matches = [];

      // Search error encyclopedia
      ERRORS.forEach(err => {
        if (err.code.toLowerCase().includes(q) || err.title.toLowerCase().includes(q) || err.symptom.toLowerCase().includes(q)) {
          matches.push({ type: 'Error', title: err.code + ': ' + err.title, action: () => { switchTab('errors'); document.getElementById('error-search-input').value = err.code; renderErrorEncyclopedia(); } });
        }
      });

      // Search docs
      Object.keys(DOCS).forEach(k => {
        const d = DOCS[k];
        if (d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)) {
          matches.push({ type: 'Doc', title: d.title, action: () => openDocInReader(k) });
        }
      });

      // Search code files
      CODE_FILES.forEach(f => {
        if (f.title.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) {
          matches.push({ type: 'Code', title: f.path, action: () => { switchTab('codedir'); document.getElementById('codedir-search').value = f.path; renderCodeDir(); } });
        }
      });

      if (matches.length === 0) {
        resBox.innerHTML = '<div class="text-xs text-slate-400 p-2">No matching items found</div>';
      } else {
        resBox.innerHTML = matches.slice(0, 8).map((m, idx) => \`
          <div onclick="executeGlobalMatch(\${idx})" class="p-2 hover:bg-slate-50 rounded cursor-pointer text-xs flex items-center justify-between border-b border-slate-50 last:border-0">
            <span class="font-medium text-slate-800 truncate">\${m.title}</span>
            <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">\${m.type}</span>
          </div>
        \`).join('');
      }

      window.globalSearchMatches = matches;
      resBox.classList.remove('hidden');
    }

    function executeGlobalMatch(idx) {
      if (window.globalSearchMatches && window.globalSearchMatches[idx]) {
        window.globalSearchMatches[idx].action();
        document.getElementById('global-search-results').classList.add('hidden');
      }
    }

    // Module Generator Code Generator
    function setGenStep(step) {
      currentGenStep = step;
      document.querySelectorAll('.gen-step-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-200');
      });
      const activeBtn = document.getElementById('btn-gen-' + step);
      if (activeBtn) {
        activeBtn.classList.remove('bg-white', 'text-slate-700', 'border');
        activeBtn.classList.add('bg-blue-600', 'text-white');
      }
      generateModuleCode();
    }

    function generateModuleCode() {
      const name = document.getElementById('gen-module-name').value.trim() || 'PatientFeedback';
      const plural = document.getElementById('gen-module-plural').value.trim() || name + 's';
      const codeBlock = document.getElementById('gen-code-content');
      const pathLabel = document.getElementById('gen-code-path');

      if (currentGenStep === 'entity') {
        pathLabel.innerText = \`src/CMS.Domain/Entities/\${name}.cs\`;
        codeBlock.innerText = \`namespace CMS.Domain.Entities;

public class \${name}
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;
}\`;
      } else if (currentGenStep === 'db') {
        pathLabel.innerText = 'src/CMS.Infrastructure/Data/AppDbContext.cs (Snippet)';
        codeBlock.innerText = \`// In AppDbContext.cs:
public DbSet<\${name}> \${plural} { get; set; } = null!;

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);

    modelBuilder.Entity<\${name}>(b => {
        b.ToTable("\${plural}");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.HasQueryFilter(x => !x.IsDeleted);
    });
}\`;
      } else if (currentGenStep === 'service') {
        pathLabel.innerText = \`src/CMS.Application/\${name}/\${name}Service.cs\`;
        codeBlock.innerText = \`using Microsoft.EntityFrameworkCore;
using CMS.Infrastructure.Data;
using CMS.Domain.Entities;

namespace CMS.Application.\${name};

public interface I\${name}Service
{
    Task<List<\${name}Dto>> GetAllAsync();
    Task<\${name}Dto> CreateAsync(Create\${name}Dto dto);
}

public class \${name}Service : I\${name}Service
{
    private readonly AppDbContext _db;
    public \${name}Service(AppDbContext db) => _db = db;

    public async Task<List<\${name}Dto>> GetAllAsync()
    {
        return await _db.\${plural}.AsNoTracking()
            .Select(x => new \${name}Dto {
                Id = x.Id, Title = x.Title, Description = x.Description, Status = x.Status, CreatedAt = x.CreatedAt
            }).ToListAsync();
    }

    public async Task<\${name}Dto> CreateAsync(Create\${name}Dto dto)
    {
        var item = new \${name} { Title = dto.Title, Description = dto.Description };
        _db.\${plural}.Add(item);
        await _db.SaveChangesAsync();
        return new \${name}Dto { Id = item.Id, Title = item.Title, Description = item.Description, Status = item.Status, CreatedAt = item.CreatedAt };
    }
}\`;
      } else if (currentGenStep === 'controller') {
        pathLabel.innerText = \`src/CMS.API/Controllers/\${name}Controller.cs\`;
        codeBlock.innerText = \`using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CMS.Application.\${name};
using CMS.Shared.DTOs;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class \${name}Controller : ControllerBase
{
    private readonly I\${name}Service _service;
    public \${name}Controller(I\${name}Service service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Create\${name}Dto dto) => Ok(await _service.CreateAsync(dto));
}\`;
      } else if (currentGenStep === 'react') {
        pathLabel.innerText = \`frontend/cms-web/src/pages/\${name}/\${name}Page.tsx\`;
        codeBlock.innerText = \`import React, { useState, useEffect } from 'react';
import { api } from '../../api/apiClient';

export default function \${name}Page() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/\${name}').then(res => {
      if (res.data) setItems(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">\${name} Module</h1>
      {loading ? <p>Loading...</p> : (
        <div className="bg-white rounded-xl shadow p-4">
          <ul>{items.map(i => <li key={i.id} className="p-2 border-b">{i.title} - {i.status}</li>)}</ul>
        </div>
      )}
    </div>
  );
}\`;
      }
    }

    function copySnippet() {
      const code = document.getElementById('gen-code-content').innerText;
      copyRaw(code);
      const btnText = document.getElementById('copy-btn-text');
      btnText.innerText = 'Copied!';
      setTimeout(() => { btnText.innerText = 'Copy Code'; }, 2000);
    }

    function copyRaw(text) {
      navigator.clipboard.writeText(text);
    }

    // LIS Simulator Helpers
    function selectLisMachine(machine) {
      currentLisMachine = machine;
      ['mindray', 'zybio', 'hl7'].forEach(m => {
        const btn = document.getElementById('btn-lis-' + m);
        if (btn) {
          btn.classList.remove('bg-emerald-600', 'text-white');
          btn.classList.add('bg-slate-100', 'text-slate-600');
        }
      });
      const activeBtn = document.getElementById('btn-lis-' + machine);
      if (activeBtn) {
        activeBtn.classList.remove('bg-slate-100', 'text-slate-600');
        activeBtn.classList.add('bg-emerald-600', 'text-white');
      }
      updateLisPayload();
    }

    function updateLisPayload() {
      const barcode = document.getElementById('lis-sample-id')?.value.trim() || 'LAB-2026-90412';
      const frameEl = document.getElementById('lis-raw-frame');
      const tableBody = document.getElementById('lis-parsed-rows');

      if (currentLisMachine === 'mindray') {
        frameEl.innerText =
\`<ENQ>
<ACK>
<STX>1H|\\^&|||Mindray^BC-5000|||||||P|1<CR><ETX>B4<CR><LF>
<ACK>
<STX>2P|1||MRN-8842||Abebe^Tigist||19940512|F|||||||||||||||||<CR><ETX>7C<CR><LF>
<ACK>
<STX>3O|1|\${barcode}||^^^WBC\\^^^RBC\\^^^HGB|||20261106114500||||||||||||||||O<CR><ETX>3E<CR><LF>
<ACK>
<STX>4R|1|^^^WBC|7.45|10^9/L|4.00-10.00|N||F||||20261106114612<CR><ETX>8F<CR><LF>
<ACK>
<STX>5R|2|^^^RBC|4.82|10^12/L|3.80-5.80|N||F||||20261106114612<CR><ETX>92<CR><LF>
<ACK>
<STX>6R|3|^^^HGB|14.2|g/dL|12.0-16.0|N||F||||20261106114612<CR><ETX>6A<CR><LF>
<ACK>
<STX>7L|1|N<CR><ETX>07<CR><LF>
<ACK>
<EOT>\`;

        tableBody.innerHTML = \`
          <tr><td class="py-1">WBC (White Blood Cells)</td><td class="py-1 font-bold text-slate-800">7.45 10^9/L</td><td class="py-1 text-slate-500">4.00 - 10.00</td><td><span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">Normal</span></td></tr>
          <tr><td class="py-1">RBC (Red Blood Cells)</td><td class="py-1 font-bold text-slate-800">4.82 10^12/L</td><td class="py-1 text-slate-500">3.80 - 5.80</td><td><span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">Normal</span></td></tr>
          <tr><td class="py-1">HGB (Hemoglobin)</td><td class="py-1 font-bold text-slate-800">14.2 g/dL</td><td class="py-1 text-slate-500">12.0 - 16.0</td><td><span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">Normal</span></td></tr>
        \`;
      } else if (currentLisMachine === 'zybio') {
        frameEl.innerText =
\`<ENQ>
<ACK>
<STX>1H|\\^&|||ZYBIO^Z3|||||||P|1<CR><ETX>A1<CR><LF>
<ACK>
<STX>2O|1|\${barcode}||^^^PLT\\^^^LYM#|||20261106114500||||||||||||||||O<CR><ETX>4D<CR><LF>
<ACK>
<STX>3R|1|^^^PLT|245|10^9/L|150-450|N||F||||20261106114612<CR><ETX>5F<CR><LF>
<ACK>
<STX>4R|2|^^^LYM#|2.10|10^9/L|1.00-3.50|N||F||||20261106114612<CR><ETX>2A<CR><LF>
<ACK>
<EOT>\`;

        tableBody.innerHTML = \`
          <tr><td class="py-1">PLT (Platelets)</td><td class="py-1 font-bold text-slate-800">245 10^9/L</td><td class="py-1 text-slate-500">150 - 450</td><td><span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">Normal</span></td></tr>
          <tr><td class="py-1">LYM# (Lymphocyte Count)</td><td class="py-1 font-bold text-slate-800">2.10 10^9/L</td><td class="py-1 text-slate-500">1.00 - 3.50</td><td><span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">Normal</span></td></tr>
        \`;
      } else {
        frameEl.innerText =
\`<VT>
MSH|^~\\&|MINDRAY|LAB|CMS|HUDERMA|20261106114500||ORU^R01|MSG00981|P|2.3.1<CR>
PID|1||\${barcode}||Abebe^Tigist||19940512|F<CR>
OBR|1|\${barcode}||CBC^Complete Blood Count|||20261106114500<CR>
OBX|1|NM|6690-2^WBC^LN||7.45|10*3/uL|4.00-10.00|N|||F<CR>
OBX|2|NM|718-7^HGB^LN||14.2|g/dL|12.0-16.0|N|||F<CR>
<FS><CR>\`;

        tableBody.innerHTML = \`
          <tr><td class="py-1">WBC (HL7 6690-2)</td><td class="py-1 font-bold text-slate-800">7.45 10*3/uL</td><td class="py-1 text-slate-500">4.00 - 10.00</td><td><span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">Normal</span></td></tr>
          <tr><td class="py-1">HGB (HL7 718-7)</td><td class="py-1 font-bold text-slate-800">14.2 g/dL</td><td class="py-1 text-slate-500">12.0 - 16.0</td><td><span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">Normal</span></td></tr>
        \`;
      }
    }

    // Initialize state from URL hash if provided
    window.addEventListener('hashchange', handleHashRouting);

    function handleHashRouting() {
      const hash = window.location.hash.substring(1);
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const tab = params.get('tab');
      const doc = params.get('doc');
      if (tab) switchTab(tab);
      if (doc) openDocInReader(doc);
    }

    // Initialize Default Views
    selectLayer('frontend');
    loadDoc('handbook');
    renderCodeDir();
    renderErrorEncyclopedia();

    // Check initial hash
    if (window.location.hash) {
      handleHashRouting();
    }
  </script>
</body>
</html>
`;

// 5. Write the compiled HTML file to docs/interactive_dev_hub.html
const outputPath = path.join(rootDir, 'docs', 'interactive_dev_hub.html');
fs.writeFileSync(outputPath, htmlContent, 'utf8');

console.log(`Generated ${outputPath} successfully (${(htmlContent.length / 1024).toFixed(1)} KB).`);
