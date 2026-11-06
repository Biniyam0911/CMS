# CMS Developer Handbook & Master Onboarding Guide
**HUDERMA Specialty Clinic (Dermatology & Venereology Center)**

Welcome to the HUDERMA Clinic Management System (CMS) source repository! This handbook provides a complete, self-contained guide for maintaining, debugging, customizing, and extending the clinic application without requiring external AI tools.

---

## 🗺️ Quick Navigation Map

| Document | Purpose & Contents | Recommended For |
|:---|:---|:---|
| [**Architecture Overview**](./architecture/ARCHITECTURE_OVERVIEW.md) | Clean Architecture layers, Database schema, real-time SignalR hubs, and LIS analyzer TCP socket pipelines. | Understanding how data moves from Database to Browser. |
| [**How to Add a New Module**](./how-to-guides/HOW_TO_ADD_A_NEW_MODULE.md) | Concrete 11-step recipe with copy-paste code snippets for Database ➔ Domain ➔ Application ➔ API ➔ React UI ➔ Permissions. | Anyone adding a new feature or business domain to the clinic. |
| [**Local Development & Run**](./how-to-guides/LOCAL_DEVELOPMENT_AND_RUN.md) | How to configure, run, and debug backend, frontend, SQL Server, and Redis locally using Visual Studio, VS Code, or CLI. | Running and debugging the app on your local workstation. |
| [**System Errors & Solutions Encyclopedia**](./how-to-guides/SYSTEM_ERRORS_AND_SOLUTIONS.md) | **Dedicated playbook for every error in the system** (HTTP 400/401/403/404/409/429/500, FK violations, Deadlocks, LIS socket dropouts, Chapa/Telebirr, SignalR, White screens). | Resolving and fixing bugs and runtime errors immediately. |
| [**Debugging & Troubleshooting**](./how-to-guides/DEBUGGING_AND_TROUBLESHOOTING.md) | Diagnostic workflows, log tracing patterns, and health check tips. | Diagnosing and monitoring system state. |
| [**Suggestions & Future Roadmap**](./SUGGESTIONS_AND_ROADMAP.md) | Recommended engineering improvements (automated tests, CI/CD, backup automation, offline tolerance, security). | Planning future technical milestones. |
| [**Production Update Manual**](./PRODUCTION_UPDATE_MANUAL.md) | Step-by-step procedures for pulling changes from GitHub and deploying to the live production server (IIS + Windows Services). | DevOps and System Administrators. |

---

## 🏛️ System High-Level Architecture

The system is a modern, high-performance healthcare management solution tailored for ambulatory and specialty clinical care.

### Technology Stack & Performance Architecture
- **Backend**: C# .NET 8 Web API structured using **Clean (Onion) Architecture**.
  - **Response Compression**: Built-in Brotli (`br`) and Gzip middleware compressing JSON/JS/CSS payloads at `CompressionLevel.Optimal` (70%–80% bandwidth reduction).
  - **Rate Limiting**: Fixed-window partitioned rate limiting (`ApiPolicy` 300 req/min, `AuthPolicy` 15 req/min).
- **Database**: Microsoft SQL Server (`ClinicDB`):
  - High-performance indexed tables with covering non-clustered indexes (`IX_AuditLog_Tenant_ChangedAt`, `IX_Encounters_Tenant_Doctor_Date`, `IX_Invoices_Tenant_Date_Paid`).
  - SARGable half-open date range filtering (`>= @DateStart AND < @DateEnd`) and consolidated conditional aggregations (`SUM(CASE WHEN ...)`).
  - Dedicated `UnassignedLabResults` quarantine staging table for unmatched analyzer specimens.
- **Cache**: Redis / Memurai distributed cache with automatic fallback to high-speed in-memory caching (e.g. `tenant:{tenantId}:lab:catalog` cached in < 2ms).
- **Frontend**: Single Page Application (SPA) built with React 18, TypeScript, Tailwind CSS, and Vite:
  - **Dynamic Code-Splitting**: All 26 page components asynchronously chunked with `React.lazy()` & `<React.Suspense>`, shrinking the entry bundle from 1.33 MB down to **73.59 kB** (94.5% payload reduction).
  - **Vendor Chunking**: Rollup `manualChunks` isolating `vendor-react` and `vendor-ui`.
- **Real-Time Communication**: ASP.NET Core SignalR (`NotificationHub`) for live queue updates and alerts.
- **Hardware Integration**: High-concurrency background TCP listener service (`LisTcpListenerService`):
  - Bounded `Channel<LisRawMessage>` producer-consumer queue (1,000 capacity) processed by 4 dedicated worker tasks.
  - Connection limiter with `SemaphoreSlim(50, 50)` and exception guards to prevent socket starvation.
  - Zero-guessing clinical data integrity: Unrecognized specimens are quarantined in `UnassignedLabResults` with instant alert notifications to Lab Technicians.
- **External Gateways**: Chapa & Telebirr for digital payments; Telegram Bot API & WhatsApp Cloud API for telemedicine; SMTP for email.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 18 TypeScript SPA                         │
│   (Vite + Tailwind CSS: EMR, Triage, Pharmacy, Billing, Lab, Queue)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / REST (JSON) + WSS (SignalR)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CMS.API (ASP.NET Core 8)                        │
│   Controllers, Rate Limiting, Serilog, JWT Cookies, Global Middleware  │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │ calls                         │ depends on
                    ▼                               ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│           CMS.Application            │  │          CMS.Shared          │
│ Services, Business Logic, Workflows  │  │ DTOs, Enums, ViewModels,     │
└───────────────────┬──────────────────┘  │ Common Constants             │
                    │ calls               └──────────────▲───────────────┘
                    ▼                                    │
┌──────────────────────────────────────┐                 │
│              CMS.Domain              │─────────────────┤
│ Core Entities, Rules, Interfaces     │                 │
└───────────────────▲──────────────────┘                 │
                    │ implements                         │
┌───────────────────┴────────────────────────────────────┴───────────────┐
│                          CMS.Infrastructure                            │
│ EF Core AppDbContext, Repositories, Redis/Memory Cache, SMTP Provider, │
│ LIS Analyzer TCP Socket Listener (HL7 / ASTM Parser)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL Server & TCP Sockets
                                    ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│     SQL Server (ClinicDB)     │        │ Lab Analyzers (Mindray/ZYBIO) │
└───────────────────────────────┘        └───────────────────────────────┘
```

---

## 📂 Complete Codebase File & Responsibility Dictionary

Use this directory to immediately locate where any feature, bug, or calculation lives:

### 1. Backend REST API (`src/CMS.API`)
| File | Responsibility & Role | When to Modify / Debug |
|:---|:---|:---|
| `Program.cs` | Host startup, DI service lifetimes, Brotli/Gzip response compression, JWT cookies, rate limiting (300 req/min), and SignalR hub mapping. | Adding new services, configuring compression, altering cookie policies or connection strings. |
| `Controllers/ClinicalControllers.cs` | HTTP endpoints for Staff/Doctors, Appointments, and Encounters (visits, diagnoses, procedure orders). | Modifying appointment scheduling rules or encounter creation parameters. |
| `Controllers/PharmacyBillingControllers.cs` | HTTP endpoints for Invoices, Payments, Waivers, Dispensary Prescriptions, and Drug Catalog. | Changing financial workflows, invoice adjustments, or dispensary dispensing logic. |
| `Controllers/AdminControllers.cs` | Endpoints for User accounts, Role assignment, Clinic configuration, and Tenant management. | Managing staff permissions, password resets, and branch/tenant settings. |
| `Controllers/TriageController.cs` | Endpoints for recording nursing vital signs and priority calculation. | Changing triage threshold algorithms or vital sign parameters. |
| `Controllers/InpatientController.cs` | Endpoints for bed management, admissions, inpatient rounds, and discharge summaries. | Adding bed categories or changing inpatient admission flows. |
| `Controllers/ChapaController.cs` | Payment webhook callback endpoint for Chapa mobile and card payments. | Debugging payment gateway transaction verifications. |
| `Hubs/NotificationHub.cs` | SignalR WebSocket hub broadcasting real-time queue updates and clinical alerts. | Adding new real-time push events between doctor rooms and reception. |
| `Middleware/Middlewares.cs` | ExceptionMiddleware (catches server crashes) and TenantMiddleware (resolves clinic ID). | Diagnosing 500 crashes or adding global security headers. |

### 2. Business Logic Layer (`src/CMS.Application`)
| File | Responsibility & Role | When to Modify / Debug |
|:---|:---|:---|
| `Encounters/SoapAndClinicalService.cs` | Doctor consultation SOAP notes, medical certificate issuance, and procedure orders using Dapper. | Adjusting SOAP documentation fields or medical certificate formats. |
| `Billing/BillingService.cs` | Financial invoicing, dynamic VAT lookup from `ClinicSettings`, insurance co-pay splits, waivers, and receipt generation. | Modifying discount rules, tax rates, insurance split logic, or payment receipts. |
| `Billing/ChapaPaymentService.cs` | Chapa API integration for processing digital payments and verifying checkout transactions. | Upgrading Chapa payment secret keys or checkout redirects. |
| `Laboratory/LabService.cs` | Lab test catalog, specimen tubes, lab order workflows, and manual technician result entry. | Adding new lab tests, reference ranges, or modifying order statuses. |
| `Pharmacy/PharmacyService.cs` | Prescription queue, stock batch tracking, drug expiry alerts, and dispensing verification. | Updating drug inventory management or batch dispensing rules. |
| `Patients/ExpandedPatientService.cs` | Patient registration, automated Medical Record Number (MRN) generation, search, and demographics. | Adding fields to patient registration (e.g. National ID, Insurance). |
| `Queue/QueueService.cs` | Patient queuing engine per doctor and department with waiting room TV synchronization. | Altering queue prioritization or call-next logic. |
| `Telemedicine/TelegramBotService.cs` | Telegram bot client for patient chat, remote consultations, and automated SMS/message delivery. | Customizing patient notification templates or bot commands. |
| `Dashboard/DashboardService.cs` | Executive clinic analytics, daily revenue metrics, patient visit counts, and department volumes. | Adding new dashboard charts or financial metric aggregations. |

### 3. Domain & Persistence (`CMS.Domain` & `CMS.Infrastructure`)
| File | Responsibility & Role | When to Modify / Debug |
|:---|:---|:---|
| `CMS.Domain/Entities/ClinicalEntities.cs` | Core entities: `Patient`, `Staff`, `Doctor`, `Appointment`, `Encounter`, `VitalSign`, `Diagnosis`. | Defining business properties and relationships. |
| `CMS.Domain/Entities/ExtendedEntities.cs` | Extended entities: `Invoice`, `InvoiceItem`, `Prescription`, `MedicalCertificate`, `ProcedureOrder`. | Adding financial or ancillary clinical data structures. |
| `CMS.Domain/Interfaces/IServiceInterfaces.cs` | Service contract interfaces ensuring loose coupling and testability. | Declaring new methods for application services. |
| `CMS.Infrastructure/Data/AppDbContext.cs` | EF Core DbContext mapping entities to SQL tables with global soft-delete query filters. | Registering new `DbSet<T>` and configuring table indexes or foreign keys. |
| `CMS.Infrastructure/LabIntegration/LisTcpListenerService.cs` | Multi-port TCP socket listener (8004, 10001, 10002) with Bounded `Channel<T>` producer-consumer queue and `SemaphoreSlim` concurrency throttling. | Connecting new laboratory analyzer instruments or troubleshooting socket timeouts. |
| `CMS.Infrastructure/LabIntegration/LabResultIngestionService.cs` | Ingests analyzer results, parses parameters, and safely quarantines unmatched barcodes into `UnassignedLabResults` staging table. | Modifying result mapping, critical value thresholds, or quarantine alert channels. |
| `CMS.Infrastructure/LabIntegration/LabAdapters.cs` | Parses raw ASTM 1394/1381 and HL7 v2.x byte frames into normalized lab test parameters. | Supporting new analyzer protocol formats (e.g. Mindray, ZYBIO, Sysmex). |

### 4. Frontend Web Application (`frontend/cms-web/src`)
| File | Responsibility & Role | When to Modify / Debug |
|:---|:---|:---|
| `App.tsx` | Master view router with dynamic code splitting (`React.lazy()` & Suspense for 26 pages, 73.59 kB entry bundle), auth state, and idle timeout. | Adding a new screen view, customizing timeout durations, or changing default page. |
| `api/apiClient.ts` | Centralized Fetch wrapper sending HttpOnly auth cookies, tenant headers, and handling 401 logouts. | Adding global HTTP interceptors, headers, or modifying API base URL. |
| `components/Sidebar.tsx` | Navigation sidebar dynamically filtered by the logged-in user's roles (`MODULE_ITEMS`). | Adding new menu items, reordering navigation, or changing icons. |
| `utils/permissions.ts` | Role-Based Access Control (RBAC) matrix defining allowed modules per user role. | Granting or restricting module access for specific roles (Doctor, Nurse, etc.). |
| `pages/EMR/EmrSoapPage.tsx` | Doctor clinical consultation workspace with real-time Clinical Decision Support (CDS) alerts and orders. | Customizing SOAP templates, ICD-10 diagnosis search, or clinical order shortcuts. |
| `pages/Billing/BillingPage.tsx` | Cashier invoicing interface with itemized billing, waivers, insurance splits, and Chapa/Telebirr links. | Changing invoice payment options or receipt printing styles. |
| `pages/Laboratory/LaboratoryPage.tsx` | Lab technician worklist and verified results screen with live machine ingestion. | Adjusting lab result approval workflows or print requisition layouts. |
| `pages/Pharmacy/PharmacyPage.tsx` | Dispensary queue, drug dispensing verification, and batch inventory stock levels. | Changing prescription dispensing workflows or stock adjustment modals. |
| `pages/Queue/WaitingRoomTvScreen.tsx` | Fullscreen waiting room display with audio text-to-speech patient call announcer. | Customizing waiting room TV styling, audio voice, or announcement chimes. |

---

## 🍳 Developer Cookbook: Common Customization Recipes

### Recipe 1: How to Add a New Field to an Existing Entity (e.g. Adding `ReferralSource` to Patient)
1. **Database**: Run a SQL alter script in SSMS on `ClinicDB`:
   ```sql
   ALTER TABLE Patients ADD ReferralSource NVARCHAR(100) NULL;
   ```
2. **Domain Entity**: In `src/CMS.Domain/Entities/ClinicalEntities.cs`, add the property to `Patient`:
   ```csharp
   public string? ReferralSource { get; set; }
   ```
3. **DTO**: In `src/CMS.Shared/DTOs/DTOs.cs`, add `ReferralSource` to `PatientDto` and `CreatePatientDto`.
4. **Service**: In `src/CMS.Application/Patients/ExpandedPatientService.cs`, include `ReferralSource` in the mapping and SQL insert/update statements.
5. **Frontend**: In `frontend/cms-web/src/pages/Patients/PatientsPage.tsx`, add the input field inside the patient registration modal and display the column in the patient details drawer.

### Recipe 2: How to Add a New API Route
1. Open the relevant controller in `src/CMS.API/Controllers/`.
2. Add an action method decorated with HTTP verb and route:
   ```csharp
   [HttpGet("summary-metrics")]
   [Authorize(Roles = "Admin,Doctor")]
   public async Task<IActionResult> GetSummaryMetrics()
   {
       var data = await _myService.GetMetricsAsync();
       return Ok(ApiResponse<MyMetricsDto>.Ok(data));
   }
   ```
3. Test the route immediately in Swagger UI at `http://localhost:5010/swagger`.

### Recipe 3: How to Call Your New Endpoint in React
1. In your React component, import `api` from `apiClient`:
   ```tsx
   import { api } from '../../api/apiClient';
   ```
2. Call the endpoint inside an async function:
   ```tsx
   const response = await api.get<{ success: boolean; data: MyMetricsDto }>('/api/v1/my-module/summary-metrics');
   if (response.data?.success) {
       setMetrics(response.data.data);
   }
   ```

---

## 🚀 Golden Rules for System Reliability
1. **Never bypass `apiClient.ts`**: Direct calls to `fetch()` without `credentials: 'include'` will fail authentication because JWT cookies won't be sent.
2. **Always validate DTOs on the backend**: Never rely purely on frontend form validation for financial or clinical data.
3. **Preserve Soft Deletes**: Use `IsDeleted = true` so patient clinical history is never destroyed accidentally.
4. **Compile and Test before Committing**: Always run `dotnet test` (all 50 tests must pass across `CMS.UnitTests`, `CMS.IntegrationTests`, and `CMS.E2ETests`) and `npm run build` to catch type errors before pushing code.
5. **Zero Guessing in LIS Results**: Never guess or arbitrarily assign unmatched analyzer results to recent patients. Always route unrecognized specimens to the `UnassignedLabResults` quarantine table with alert notifications.
6. **Write SARGable SQL Queries**: Avoid wrapping indexed columns in functions (e.g., use `ChangedAt >= @Start AND ChangedAt < @End` instead of `CAST(ChangedAt AS DATE) = @Date`) to ensure SQL Server utilizes non-clustered covering indexes.
