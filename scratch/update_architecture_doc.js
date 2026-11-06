const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../docs/architecture/ARCHITECTURE_OVERVIEW.md');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF for replacements
let isCRLF = content.includes('\r\n');
let text = content.replace(/\r\n/g, '\n');

// 1. Update Middleware in Request flow
const oldMiddleware = `                          [ ASP.NET Core Middleware Pipeline ]
                            ├─ GlobalExceptionMiddleware (catches unexpected crashes)
                            ├─ RateLimitingMiddleware (protects against DDoS/brute-force)
                            ├─ JwtCookieMiddleware (reads auth cookie & sets ClaimsPrincipal)
                            └─ Serilog Request Logging (logs path, user, duration)`;

const newMiddleware = `                          [ ASP.NET Core Middleware Pipeline ]
                            ├─ GlobalExceptionMiddleware (catches unexpected crashes)
                            ├─ ResponseCompressionMiddleware (Brotli & Gzip optimal compression)
                            ├─ RateLimitingMiddleware (ApiPolicy 300 req/min, AuthPolicy 15 req/min)
                            ├─ JwtCookieMiddleware (reads auth cookie & sets ClaimsPrincipal)
                            ├─ TenantMiddleware (resolves clinic TenantId)
                            └─ Serilog Request Logging (logs path, user, duration)`;

text = text.replace(oldMiddleware, newMiddleware);

// 2. Update Section 4: LIS Pipeline
const oldLisSnippet = `[ Lab Machine (e.g. ZYBIO Z3) ]
        │ (Analyzes patient sample tube, reads Barcode / Sample ID)
        │ Opens TCP Socket Connection to Clinic Server IP on Port 8004
        ▼
[ LisTcpListenerService.cs (Background Socket Listener) ]
        │ Receives raw byte stream over TCP
        │ Buffers frames between <STX> (0x02) and <ETX> (0x03) or <CR><LF>
        ▼
[ LabAdapters.cs / LabResultIngestionService.cs ]
        │ Protocol auto-detection:
        │   - HL7 v2.x (MSH, PID, OBR, OBX segments)
        │   - ASTM 1394 / 1381 (H, P, O, R segments)
        │ Extracts:
        │   - SpecimenBarcode / OrderNumber
        │   - Test Parameter (e.g., WBC, RBC, HGB, PLT, Glucose)
        │   - Quantitative Value (e.g., 7.5) & Unit (10^9/L)
        │   - Flag (Normal, High, Low, Critical)
        ▼
[ Database Update: LabResults Table ]
        │ Matches barcode with pending \`LabOrderItems\`
        │ Stores result values and marks status as \`RESULTED\`
        ▼
[ SignalR Push to LaboratoryPage.tsx ]
        │ Lab technician sees the result populate on screen without manual typing!
        │ Doctor reviews and clicks "Verify / Sign Off"`;

const newLisSnippet = `[ Lab Machine (e.g. ZYBIO Z3 / Mindray BC-5000) ]
        │ Analyzes blood tube & transmits raw HL7 / ASTM stream over TCP
        │ Connects to Server Ports: 8004 (Hematology), 10001 (Chemistry), 10002 (Immuno)
        ▼
[ LisTcpListenerService.cs (Producer-Consumer TCP Listener) ]
        ├─ Throttles connections using SemaphoreSlim(50, 50) with exception safety guards
        ├─ Sends synchronous ACK response back to machine (<ACK> / 0x06)
        └─ Enqueues packet into Bounded Channel<LisRawMessage> (Capacity: 1000, FullMode.Wait)
        ▼
[ 4 Dedicated Background Worker Tasks: ProcessChannelAsync ]
        │ Consumes queued frames continuously without blocking the TCP socket
        ▼
[ LabAdapters.cs / LabResultIngestionService.cs ]
        │ Extracts Specimen Barcode, Test Parameters, Values, Units, and Flags
        │ Queries LabOrders by OrderNumber or Barcode
        ├──────────────────────────────────────────┬──────────────────────────────────────────┐
        │ [ Barcode Matched to Active Lab Order ]  │ [ Barcode Unrecognized / Mismatched ]   │
        ▼                                          ▼
[ Database Update: LabResults Table ]      [ Quarantine: UnassignedLabResults Table ]
        │ Stores quantitative & flagged values     │ Quarantined to prevent cross-patient mixups
        │ Transitions order status to RESULTED     │ Fires high-priority Notification to Lab Tech
        ▼                                          ▼
[ SignalR Push to LaboratoryPage.tsx ]     [ Lab Worklist: Orphan Review Queue ]
        │ Real-time UI refresh on screen           │ Tech clicks "Manual Link to Order"
\`\`\`

### High-Concurrency & Safety Enhancements:
- **Bounded Channel (\`Channel<LisRawMessage>\`)**: Decouples TCP network receipt from database writes. Network sockets return ACKs within milliseconds while 4 dedicated background consumer tasks handle SQL ingestion.
- **Connection Limiting (\`SemaphoreSlim\`)**: Guards the server against socket floods (max 50 concurrent analyzer streams), protecting the ADO.NET connection pool from starvation.
- **Strict Quarantine (\`UnassignedLabResults\`)**: Eliminates dangerous legacy fallback heuristics where unmatched results could attach to another patient's active chart. Unmatched samples are safely quarantined with automated alerts.`;

text = text.replace(oldLisSnippet, newLisSnippet);

// 3. Update Section 5: Database Schema & add Section 6: Frontend Performance
const addition = `

### Covering Performance Indexes & Quarantine Objects (Migration 002):
1. **\`IX_AuditLog_Tenant_ChangedAt\`**: Non-clustered covering index on \`([TenantId], [ChangedAt] DESC)\` with included columns (\`TableName\`, \`RecordId\`, \`Operation\`, \`ChangedBy\`, \`IpAddress\`). Enables ultra-fast audit trail filtering using SARGable date range queries (\`>= @Start AND < @End\`).
2. **\`IX_Encounters_Tenant_Doctor_Date\`**: Non-clustered covering index on \`([TenantId], [DoctorId], [EncounterDate])\` INCLUDE (\`[PatientId]\`). Accelerates doctor consultation history and daily encounter worklists.
3. **\`IX_Invoices_Tenant_Date_Paid\`**: Non-clustered covering index on \`([TenantId], [IssueDate], [StatusId])\` INCLUDE (\`[PaidAmount], [TotalAmount], [PatientId]\`). Powers high-speed financial reporting and daily revenue aggregations.
4. **\`UnassignedLabResults\`**: Dedicated quarantine staging table for raw analyzer packets that lack a matching patient order ID.

---

## 6. Frontend Performance & Critical Rendering Path

The single-page application is engineered for instantaneous page loads and low bandwidth consumption:

### Dynamic Code-Splitting Architecture:
- **Component-Level Lazy Loading**: All 26 page components in \`frontend/cms-web/src/App.tsx\` are loaded asynchronously via \`React.lazy()\` and wrapped in a central \`<React.Suspense>\` boundary with a branded clinic loading spinner:
\`\`\`tsx
const EmrSoapPage = React.lazy(() => import('./pages/EMR/EmrSoapPage'));
const LaboratoryPage = React.lazy(() => import('./pages/Laboratory/LaboratoryPage'));
\`\`\`
- **Monolithic Bundle Reduction**: Shrinks the initial JavaScript download from **1.33 MB down to 73.59 kB** (20.96 kB gzipped) — a **94.5% payload reduction** on initial page load.
- **Rollup Manual Vendor Chunking**: \`vite.config.ts\` partitions external libraries into separate long-term cacheable bundles:
  - \`vendor-react\`: \`react\`, \`react-dom\`
  - \`vendor-ui\`: \`lucide-react\`
  When clinic features are updated, receptionists do not need to re-download the core React vendor runtime.
`;

if (!text.includes('## 6. Frontend Performance & Critical Rendering Path')) {
  text += addition;
}

if (isCRLF) {
  text = text.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, text, 'utf8');
console.log('Successfully updated ARCHITECTURE_OVERVIEW.md');
