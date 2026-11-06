const fs = require('fs');
const path = require('path');

const devHubScriptPath = path.join(__dirname, 'build_dev_hub.js');
let scriptContent = fs.readFileSync(devHubScriptPath, 'utf8');

// 1. Update Program.cs entry
scriptContent = scriptContent.replace(
  `    title: "API Host Startup & Service Lifetime Configuration",
    desc: "Registers DI services (Scoped, Singleton, Transient), JWT authentication, CORS, rate limiting, and SignalR hub endpoints.",
    whenToEdit: "When adding a new service, registering a new SignalR hub, or changing connection strings.",
    bugFix: "If an endpoint fails with 500 'Unable to resolve service', verify builder.Services.AddScoped<IService, Service>() is present here."`,
  `    title: "API Host Startup, Response Compression & Rate Limiting",
    desc: "Registers DI services, Brotli & Gzip optimal response compression, JWT cookies, ApiPolicy rate limiting (300 req/min), and SignalR hubs.",
    whenToEdit: "When adding services, adjusting compression MIME types, tuning rate limiter windows, or updating hubs.",
    bugFix: "Verify app.UseResponseCompression() is called before endpoints, and builder.Services.AddScoped is configured."`
);

// 2. Update Controllers.cs entry
scriptContent = scriptContent.replace(
  `    title: "Core Authentication & Base Controllers",
    desc: "User authentication (login, logout, refresh), token generation, and base HTTP utility controllers.",
    whenToEdit: "When modifying password verification rules or JWT cookie configuration.",
    bugFix: "Ensure Response.Cookies.Append sets HttpOnly: true, SameSite: SameSiteMode.Strict."`,
  `    title: "Core Auth, Lab Catalog & Patient Controllers",
    desc: "Auth (JWT cookies), LaboratoryController with Redis-cached catalog (<2ms), and PatientsController with consolidated conditional count aggregation.",
    whenToEdit: "When updating login, laboratory catalog caching rules, or patient search logic.",
    bugFix: "Invalidate Redis key 'tenant:{tenantId}:lab:catalog' whenever catalog tests are added or modified."`
);

// 3. Update AuditController.cs entry
scriptContent = scriptContent.replace(
  `    title: "System Audit Trail Controller",
    desc: "Exposes access logs, patient chart viewing audits, and administrative change tracking.",
    whenToEdit: "When expanding security logging or compliance reporting.",
    bugFix: "Ensure client IP and timestamp are captured from HttpContext.Connection.RemoteIpAddress."`,
  `    title: "System Audit Trail Controller (SARGable Index Seeks)",
    desc: "Exposes access logs with SARGable date range seeks (>= @Start AND < @End) utilizing covering index IX_AuditLog_Tenant_ChangedAt.",
    whenToEdit: "When expanding security logging, audit filters, or export reporting.",
    bugFix: "Never wrap ChangedAt in CAST(ChangedAt AS DATE) or queries will revert to expensive table scans."`
);

// 4. Update LisTcpListenerService.cs entry and add LabResultIngestionService & Migration
scriptContent = scriptContent.replace(
  `    path: "src/CMS.Infrastructure/LabIntegration/LisTcpListenerService.cs",
    layer: "Infrastructure",
    title: "Background TCP Listener for Lab Analyzers",
    desc: "Asynchronous TCP socket listener on ports 8004, 10001, 10002 receiving HL7 and ASTM machine packets.",
    whenToEdit: "When supporting a new analyzer model, changing listening ports, or adjusting timeouts.",
    bugFix: "Run 'netstat -ano | findstr 10001' if the service fails to bind on startup."`,
  `    path: "src/CMS.Infrastructure/LabIntegration/LisTcpListenerService.cs",
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
    bugFix: "If an analyzer result does not link to an order, query 'SELECT * FROM UnassignedLabResults WHERE Status=\"PendingReview\"'."
  },
  {
    path: "database/migrations/002_performance_indexes_and_lis_quarantine.sql",
    layer: "Infrastructure",
    title: "Performance Covering Indexes & LIS Quarantine Schema",
    desc: "Migration adding covering indexes (IX_AuditLog_Tenant_ChangedAt, IX_Encounters_Tenant_Doctor_Date, IX_Invoices_Tenant_Date_Paid) and UnassignedLabResults table.",
    whenToEdit: "When optimizing large table queries or modifying quarantine schema columns.",
    bugFix: "Apply in SSMS on ClinicDB if queries on AuditLog or Encounters perform table scans."`
);

// 5. Update App.tsx entry and add vite.config.ts
scriptContent = scriptContent.replace(
  `    path: "frontend/cms-web/src/App.tsx",
    layer: "Frontend",
    title: "React Root Application & Route Definitions",
    desc: "Main SPA entry point containing React Router route paths, layout wrappers, and auth guards.",
    whenToEdit: "When adding a new page URL route or modifying layout shells.",
    bugFix: "Ensure new routes are wrapped with <ProtectedRoute> if they require authentication."`,
  `    path: "frontend/cms-web/src/App.tsx",
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
    bugFix: "If vendor chunk size exceeds limit, tune manualChunks groups in build.rollupOptions.output."`
);

// 6. Update errorEncyclopedia with LIS Quarantine & SQL Scan
const newErrorEntries = `  {
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
`;

scriptContent = scriptContent.replace(
  `// 3. Error Encyclopedia Items (Structured Data for the Dedicated Interactive Page)\nconst errorEncyclopedia = [`,
  `// 3. Error Encyclopedia Items (Structured Data for the Dedicated Interactive Page)\nconst errorEncyclopedia = [\n${newErrorEntries}`
);

// 7. Update LAYER_META descriptions
scriptContent = scriptContent.replace(
  `desc: 'Single-page application handling user interfaces for Doctors, Nurses, Cashiers, and Admins. Communicates with API using HttpOnly cookie authentication and connects to SignalR for instant queue chimes.',`,
  `desc: 'Single-page application with dynamic code-splitting (React.lazy & Suspense for all 26 pages, 73.59 kB entry bundle) and Rollup vendor chunking. Communicates via HttpOnly cookies and SignalR live chimes.',`
);

scriptContent = scriptContent.replace(
  `desc: 'Entry point for HTTP requests. Handles JWT cookie issuance, rate limiting, Serilog logging, CORS policies, SignalR hubs, and delegates business logic to Application services.',`,
  `desc: 'Entry point for HTTP requests with Brotli & Gzip optimal response compression, JWT cookies, ApiPolicy rate limiting (300 req/min), Redis-cached catalog (<2ms), and SignalR hubs.',`
);

scriptContent = scriptContent.replace(
  `desc: 'Implements interfaces defined in Domain/Application. Contains EF Core AppDbContext, SQL Server migrations, Redis cache, SMTP emailer, and TCP socket listeners for lab analyzers.',`,
  `desc: 'EF Core DbContext, covering performance indexes, Redis cache, and high-concurrency LIS TCP listener with Bounded Channel<T>, SemaphoreSlim(50,50), and UnassignedLabResults quarantine.',`
);

fs.writeFileSync(devHubScriptPath, scriptContent, 'utf8');
console.log('Successfully patched build_dev_hub.js with optimizations & quarantine features.');
