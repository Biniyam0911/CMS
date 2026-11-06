# CMS Architecture Overview & Data Flow Guide
**HUDERMA Specialty Clinic Management System**

[← Back to Developer Handbook](../DEVELOPER_HANDBOOK.md)

This guide explains the architectural foundations of CMS: how the layers are separated, how data flows end-to-end, how authentication and multi-tenancy operate, how laboratory instruments connect via TCP sockets, and how the database is structured.

---

## 1. Clean (Onion) Architecture Explained

The backend is built using Clean Architecture principles. The primary rule of Clean Architecture is that **dependencies point inward**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │                         CMS.API                             │
 │   (Presentation Layer: HTTP Endpoints, Middleware, Hubs)    │
 └──────────────────────────────┬──────────────────────────────┘
                                │ references
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                     CMS.Application                         │
 │   (Business Logic, Workflows, Domain Service Orchestration) │
 └──────────────┬───────────────────────────────┬──────────────┘
                │ references                    │ references
                ▼                               ▼
 ┌─────────────────────────────┐  ┌─────────────────────────────┐
 │         CMS.Domain          │  │         CMS.Shared          │
 │ (Entities, Rules, Enums,    │  │ (Data Transfer Objects/DTOs,│
 │  Service Interfaces)        │  │  Common Helpers, Constants) │
 └──────────────▲──────────────┘  └─────────────────────────────┘
                │ implemented by
 ┌──────────────┴──────────────────────────────────────────────┐
 │                    CMS.Infrastructure                       │
 │ (EF Core AppDbContext, Repositories, Redis, Smtp, LIS Sockets│
 └─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Project | Contains | Must NOT Contain |
|:---|:---|:---|:---|
| **Domain** | `CMS.Domain` | Entities (`Patient`, `Encounter`, `Invoice`), Enums (`OrderStatus`, `TriagePriority`), Interfaces (`IServiceInterfaces.cs`). | SQL queries, HTTP references, third-party libraries, EF Core references. |
| **Application** | `CMS.Application` | Business services (`ExpandedPatientService`, `SoapAndClinicalService`, `BillingService`, `LabService`). | Direct HTTP `HttpContext`, database connection strings, HTML rendering. |
| **Infrastructure** | `CMS.Infrastructure` | EF Core `AppDbContext`, SQL migrations, LIS TCP listeners, Redis cache clients, SMTP email sender. | Web controller logic, frontend UI concerns. |
| **Shared** | `CMS.Shared` | Request/Response DTOs (`CreatePatientDto`, `SoapNoteDto`, `InvoiceResponseDto`), validation rules, API wrappers. | Database entity definitions with navigation properties. |
| **API (Presentation)**| `CMS.API` | ASP.NET Core controllers (`ClinicalControllers.cs`, `AdminControllers.cs`), SignalR hubs (`NotificationHub`), middleware, `Program.cs`. | Heavy business logic or raw database queries. |

---

## 2. End-to-End Request & Data Flow Walkthrough

To understand what happens when a user performs an action in the browser, let us follow the journey of saving a clinical consultation SOAP note:

```
[ User in Browser ] 
        │ (Fills SOAP note & clicks "Save Consultation")
        ▼
[ React Component: EmrSoapPage.tsx ]
        │ Calls `api.post('/api/v1/clinical/encounters/{id}/soap', payload)`
        ▼
[ API Client: apiClient.ts ]
        │ Appends credentials: 'include' (sends HttpOnly auth cookie)
        │ Serializes JSON body, sets Content-Type: application/json
        ▼
[ HTTP Request over Network ] ──➔ [ Port 5010 (or IIS Reverse Proxy) ]
                                          │
                                          ▼
                         [ ASP.NET Core Middleware Pipeline ]
                           ├─ GlobalExceptionMiddleware (catches unexpected crashes)
                           ├─ RateLimitingMiddleware (protects against DDoS/brute-force)
                           ├─ JwtCookieMiddleware (reads auth cookie & sets ClaimsPrincipal)
                           └─ Serilog Request Logging (logs path, user, duration)
                                          │
                                          ▼
                         [ Controller: ClinicalControllers.cs ]
                           └─ [HttpPost("encounters/{id}/soap")]
                           └─ Validates ModelState and extracts CurrentUserId from Claims
                           └─ Calls `_soapService.SaveSoapNoteAsync(dto)`
                                          │
                                          ▼
                         [ Application Service: SoapAndClinicalService.cs ]
                           ├─ Evaluates clinical rules & diagnoses
                           ├─ Updates Encounter status (e.g. from WAITING to IN_CONSULTATION)
                           ├─ Calculates ICD-10 links
                           └─ Uses `_dbContext` or repository to save
                                          │
                                          ▼
                         [ Infrastructure: AppDbContext.cs / SQL Server ]
                           └─ Generates optimized `UPDATE Encounters ...` and `INSERT INTO SoapNotes ...`
                           └─ Executes in atomic SQL transaction
                                          │
                                          ▼
                         [ Real-Time Notification: NotificationHub.cs ]
                           └─ Broadcasts `QueueUpdated` event via SignalR WebSockets
                              so Reception and TV screens refresh instantly
                                          │
                                          ▼
                         [ HTTP 200 JSON Response ] ──➔ [ React State Updated ]
```

---

## 3. Authentication & Security Flow

Security in CMS uses industry-standard enterprise patterns:

1. **HttpOnly Secure Cookies**:
   - When a user logs in via `/api/v1/auth/login`, the API generates a cryptographically signed JSON Web Token (JWT).
   - Rather than returning the raw JWT to be saved in JavaScript `localStorage` (which is vulnerable to XSS attacks), the server sets an `HttpOnly`, `SameSite=Strict`, `Secure` cookie named `cms_auth`.
   - The browser automatically attaches this cookie to all subsequent API requests.
2. **Role-Based Access Control (RBAC)**:
   - Each user is assigned one or more roles: `Admin`, `Doctor`, `Nurse`, `Receptionist`, `Pharmacist`, `LabTechnician`, `Cashier`, `Auditor`.
   - On the backend, controllers use `[Authorize(Roles = "Doctor,Admin")]` attributes.
   - On the frontend, `src/utils/permissions.ts` dynamically filters the sidebar links and disables actions if the active role lacks permissions.
3. **Session Inactivity Timeout**:
   - `App.tsx` contains an idle timer that tracks mouse movement and keystrokes. After 15 minutes of inactivity, a 60-second warning countdown appears. If the user does not click "Stay Logged In", the session is safely cleared and the server logout endpoint is invoked.

---

## 4. Hardware Integration: Laboratory Analyzer TCP Sockets (LIS)

One of the most powerful features of CMS is automated machine integration with clinical lab analyzers (such as the **ZYBIO Z3** Hematology Analyzer and **Mindray** Chemistry/Immunoassay instruments).

### How It Works:

```
[ Lab Machine (e.g. ZYBIO Z3 / Mindray BC-5000) ]
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
```

### High-Concurrency & Safety Enhancements:
- **Bounded Channel (`Channel<LisRawMessage>`)**: Decouples TCP network receipt from database writes. Network sockets return ACKs within milliseconds while 4 dedicated background consumer tasks handle SQL ingestion.
- **Connection Limiting (`SemaphoreSlim`)**: Guards the server against socket floods (max 50 concurrent analyzer streams), protecting the ADO.NET connection pool from starvation.
- **Strict Quarantine (`UnassignedLabResults`)**: Eliminates dangerous legacy fallback heuristics where unmatched results could attach to another patient's active chart. Unmatched samples are safely quarantined with automated alerts.
```

### Configured Ports:
- **Port 8004**: Primary Hematology Analyzer (ZYBIO Z3 / Mindray BC series).
- **Port 10001**: Clinical Chemistry Analyzer.
- **Port 10002**: Immunology / Urinalysis Analyzer.

---

## 5. Relational Database Schema & Relationships

The database is structured into cohesive modules:

### Core Entity Relationships:

```
  ┌──────────────┐          1..* ┌──────────────┐
  │   Patients   │───────────────┤  Encounters  │
  └──────┬───────┘               └──────┬───────┘
         │                              │
         │ 1..*                         │ 1..*
         ▼                              ▼
  ┌──────────────┐               ┌──────────────┐
  │ Invoices     │               │ ClinicalNotes│ (SOAP, Vitals, Diagnoses)
  └──────┬───────┘               └──────────────┘
         │ 1..*                         │
         ▼                              ├────────────────────────┐
  ┌──────────────┐                      │ 1..*                   │ 1..*
  │ InvoiceItems │                      ▼                        ▼
  └──────────────┘               ┌──────────────┐         ┌──────────────┐
                                 │  LabOrders   │         │Prescriptions │
                                 └──────┬───────┘         └──────┬───────┘
                                        │ 1..*                   │ 1..*
                                        ▼                        ▼
                                 ┌──────────────┐         ┌──────────────┐
                                 │  LabResults  │         │ PrescrItems  │
                                 └──────────────┘         └──────────────┘
```

1. **Patients**: Stores patient demographics, National ID, Phone, MRN (Medical Record Number), Emergency Contact, Allergies, and Blood Type.
2. **Encounters**: Represents a single clinical visit (Outpatient or Inpatient). Tracks visit date, admitting doctor, queue number, and visit stage (TRIAGE, IN_CONSULTATION, PHARMACY, BILLING, COMPLETED).
3. **VitalSigns**: Blood pressure, pulse, temperature, respiratory rate, oxygen saturation ($SpO_2$), BMI, and pediatric growth metrics.
4. **ClinicalDiagnoses**: ICD-10 coded diagnostic records associated with the encounter.
5. **LabOrders & LabResults**: Test requests (CBC, Lipid Panel, Liver Function, etc.) and itemized quantitative/qualitative outputs with reference ranges.
6. **Invoices, InvoiceItems & Payments**: Financial records, billing line items, discounts, insurance claims, and Chapa/Telebirr transactions.
7. **Users, Roles & Staff**: Authentication accounts, cryptographic password hashes, and assigned clinic permissions.


### Covering Performance Indexes & Quarantine Objects (Migration 002):
1. **`IX_AuditLog_Tenant_ChangedAt`**: Non-clustered covering index on `([TenantId], [ChangedAt] DESC)` with included columns (`TableName`, `RecordId`, `Operation`, `ChangedBy`, `IpAddress`). Enables ultra-fast audit trail filtering using SARGable date range queries (`>= @Start AND < @End`).
2. **`IX_Encounters_Tenant_Doctor_Date`**: Non-clustered covering index on `([TenantId], [DoctorId], [EncounterDate])` INCLUDE (`[PatientId]`). Accelerates doctor consultation history and daily encounter worklists.
3. **`IX_Invoices_Tenant_Date_Paid`**: Non-clustered covering index on `([TenantId], [IssueDate], [StatusId])` INCLUDE (`[PaidAmount], [TotalAmount], [PatientId]`). Powers high-speed financial reporting and daily revenue aggregations.
4. **`UnassignedLabResults`**: Dedicated quarantine staging table for raw analyzer packets that lack a matching patient order ID.

---

## 6. Frontend Performance & Critical Rendering Path

The single-page application is engineered for instantaneous page loads and low bandwidth consumption:

### Dynamic Code-Splitting Architecture:
- **Component-Level Lazy Loading**: All 26 page components in `frontend/cms-web/src/App.tsx` are loaded asynchronously via `React.lazy()` and wrapped in a central `<React.Suspense>` boundary with a branded clinic loading spinner:
```tsx
const EmrSoapPage = React.lazy(() => import('./pages/EMR/EmrSoapPage'));
const LaboratoryPage = React.lazy(() => import('./pages/Laboratory/LaboratoryPage'));
```
- **Monolithic Bundle Reduction**: Shrinks the initial JavaScript download from **1.33 MB down to 73.59 kB** (20.96 kB gzipped) — a **94.5% payload reduction** on initial page load.
- **Rollup Manual Vendor Chunking**: `vite.config.ts` partitions external libraries into separate long-term cacheable bundles:
  - `vendor-react`: `react`, `react-dom`
  - `vendor-ui`: `lucide-react`
  When clinic features are updated, receptionists do not need to re-download the core React vendor runtime.
