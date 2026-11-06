$docs = @{
    handbook = @{
        id = "handbook"
        title = "Developer Handbook & Onboarding"
        category = "Core Guide"
        icon = "fa-book"
        path = "docs/DEVELOPER_HANDBOOK.md"
        fullPath = "C:/Users/ASUS/source/repos/CMS/docs/DEVELOPER_HANDBOOK.md"
        content = [System.IO.File]::ReadAllText("$PSScriptRoot\..\docs\DEVELOPER_HANDBOOK.md")
    }
    arch = @{
        id = "arch"
        title = "Clean Architecture & Data Flow"
        category = "Architecture"
        icon = "fa-layer-group"
        path = "docs/architecture/ARCHITECTURE_OVERVIEW.md"
        fullPath = "C:/Users/ASUS/source/repos/CMS/docs/architecture/ARCHITECTURE_OVERVIEW.md"
        content = [System.IO.File]::ReadAllText("$PSScriptRoot\..\docs\architecture\ARCHITECTURE_OVERVIEW.md")
    }
    newmodule = @{
        id = "newmodule"
        title = "How to Add a New Module (11-Step Recipe)"
        category = "Playbooks"
        icon = "fa-puzzle-piece"
        path = "docs/how-to-guides/HOW_TO_ADD_A_NEW_MODULE.md"
        fullPath = "C:/Users/ASUS/source/repos/CMS/docs/how-to-guides/HOW_TO_ADD_A_NEW_MODULE.md"
        content = [System.IO.File]::ReadAllText("$PSScriptRoot\..\docs\how-to-guides\HOW_TO_ADD_A_NEW_MODULE.md")
    }
    localdev = @{
        id = "localdev"
        title = "Local Development, Setup & Run"
        category = "Playbooks"
        icon = "fa-laptop-code"
        path = "docs/how-to-guides/LOCAL_DEVELOPMENT_AND_RUN.md"
        fullPath = "C:/Users/ASUS/source/repos/CMS/docs/how-to-guides/LOCAL_DEVELOPMENT_AND_RUN.md"
        content = [System.IO.File]::ReadAllText("$PSScriptRoot\..\docs\how-to-guides\LOCAL_DEVELOPMENT_AND_RUN.md")
    }
    troubleshoot = @{
        id = "troubleshoot"
        title = "Debugging & Troubleshooting Playbook"
        category = "Diagnostics"
        icon = "fa-wrench"
        path = "docs/how-to-guides/DEBUGGING_AND_TROUBLESHOOTING.md"
        fullPath = "C:/Users/ASUS/source/repos/CMS/docs/how-to-guides/DEBUGGING_AND_TROUBLESHOOTING.md"
        content = [System.IO.File]::ReadAllText("$PSScriptRoot\..\docs\how-to-guides\DEBUGGING_AND_TROUBLESHOOTING.md")
    }
    roadmap = @{
        id = "roadmap"
        title = "Engineering Suggestions & Roadmap"
        category = "Strategy"
        icon = "fa-lightbulb"
        path = "docs/SUGGESTIONS_AND_ROADMAP.md"
        fullPath = "C:/Users/ASUS/source/repos/CMS/docs/SUGGESTIONS_AND_ROADMAP.md"
        content = [System.IO.File]::ReadAllText("$PSScriptRoot\..\docs\SUGGESTIONS_AND_ROADMAP.md")
    }
    prodmanual = @{
        id = "prodmanual"
        title = "Production Update & Deployment Manual"
        category = "DevOps"
        icon = "fa-server"
        path = "docs/PRODUCTION_UPDATE_MANUAL.md"
        fullPath = "C:/Users/ASUS/source/repos/CMS/docs/PRODUCTION_UPDATE_MANUAL.md"
        content = [System.IO.File]::ReadAllText("$PSScriptRoot\..\docs\PRODUCTION_UPDATE_MANUAL.md")
    }
}

$docsJson = $docs | ConvertTo-Json -Depth 5 -Compress

# Exhaustive File Directory
$codeFiles = @(
    # API LAYER
    @{ path = "src/CMS.API/Program.cs"; layer = "API"; title = "API Host Startup & Service Lifetime Configuration"; desc = "Registers DI services (Scoped, Singleton, Transient), JWT authentication, CORS, rate limiting, and SignalR hub endpoints."; whenToEdit = "When adding a new service, registering a new SignalR hub, or changing connection strings."; bugFix = "If an endpoint fails with 500 'Unable to resolve service', verify builder.Services.AddScoped<IService, Service>() is present here." },
    @{ path = "src/CMS.API/Controllers/AdminControllers.cs"; layer = "API"; title = "Admin & User Management Controller"; desc = "User accounts, role assignments, clinic metadata, and branch configuration endpoints."; whenToEdit = "When creating admin-only administrative actions or user management endpoints."; bugFix = "Verify role attributes [Authorize(Roles = 'Admin,SuperAdmin')] match database UserRoles." },
    @{ path = "src/CMS.API/Controllers/AuditController.cs"; layer = "API"; title = "System Audit Trail Controller"; desc = "Exposes access logs, patient chart viewing audits, and administrative change tracking."; whenToEdit = "When expanding security logging or compliance reporting."; bugFix = "Ensure client IP and timestamp are captured from HttpContext.Connection.RemoteIpAddress." },
    @{ path = "src/CMS.API/Controllers/ChapaController.cs"; layer = "API"; title = "Chapa Payment Gateway Webhook Controller"; desc = "Receives asynchronous payment verification webhooks from Chapa for mobile and card transactions."; whenToEdit = "When updating Chapa callback signatures or transaction verification statuses."; bugFix = "Verify Chapa public/secret API keys in appsettings.json match production keys." },
    @{ path = "src/CMS.API/Controllers/ClinicalAuxiliaryControllers.cs"; layer = "API"; title = "Clinical Auxiliary Services Controller"; desc = "Auxiliary clinic endpoints: medical certificates, vitals history, and procedure checklists."; whenToEdit = "When adding secondary medical paperwork or auxiliary clinical tools."; bugFix = "Ensure tenant ID is supplied when querying patient auxiliary records." },
    @{ path = "src/CMS.API/Controllers/ClinicalControllers.cs"; layer = "API"; title = "Staff, Appointments & Encounters Controllers"; desc = "HTTP endpoints for clinical visits, doctor scheduling, ICD-10 diagnoses, and minor surgical procedures."; whenToEdit = "When adding parameters to appointment booking or modifying encounter creation logic."; bugFix = "Check HttpContext.Items['TenantId'] if multi-clinic isolation returns unexpected empty lists." },
    @{ path = "src/CMS.API/Controllers/Controllers.cs"; layer = "API"; title = "Core Authentication & Base Controllers"; desc = "User authentication (login, logout, refresh), token generation, and base HTTP utility controllers."; whenToEdit = "When modifying password verification rules or JWT cookie configuration."; bugFix = "Ensure Response.Cookies.Append sets HttpOnly: true, SameSite: SameSiteMode.Strict." },
    @{ path = "src/CMS.API/Controllers/InpatientController.cs"; layer = "API"; title = "Inpatient Ward & Bed Management Controller"; desc = "Bed allocation, inpatient admission, doctor rounds, and ward discharge summaries."; whenToEdit = "When adding inpatient ward categories or changing admission procedures."; bugFix = "Verify bed occupancy status transitions from 'Available' to 'Occupied' on admission." },
    @{ path = "src/CMS.API/Controllers/IntegrationControllers.cs"; layer = "API"; title = "Third-Party Hardware & LIS Controllers"; desc = "Endpoints for inspecting analyzer socket connection states, listener ports, and diagnostic packet logs."; whenToEdit = "When testing laboratory analyzer connectivity from the web frontend."; bugFix = "Use GET /api/v1/laboratory/instruments/listener-status to confirm active TCP socket ports." },
    @{ path = "src/CMS.API/Controllers/PatientPortalController.cs"; layer = "API"; title = "Patient Self-Service Portal Controller"; desc = "Patient-facing endpoints for viewing past lab results, prescriptions, and booking appointments."; whenToEdit = "When adding features for patient self-service mobile or web apps."; bugFix = "Ensure queries strictly filter by the authenticated patient's UserId." },
    @{ path = "src/CMS.API/Controllers/PayrollController.cs"; layer = "API"; title = "Doctor Commission & Payroll Controller"; desc = "Doctor revenue share calculations, consultation percentages, procedure cuts, and payouts."; whenToEdit = "When modifying commission percentage formulas or generating doctor pay stubs."; bugFix = "Ensure invoice payment status is verified before crediting doctor commissions." },
    @{ path = "src/CMS.API/Controllers/PharmacyBillingControllers.cs"; layer = "API"; title = "Billing, Invoicing, Payments & Dispensary Controllers"; desc = "Patient invoices, payments, waivers, dispensary prescription queues, and drug catalogs."; whenToEdit = "When updating invoice statuses, waiver approvals, or dispensary batch verification."; bugFix = "Ensure payment transactions pass through BillingService rather than mutating DB directly." },
    @{ path = "src/CMS.API/Controllers/ReportsController.cs"; layer = "API"; title = "Clinic Intelligence & Reports Controller"; desc = "Dedicated reporting endpoints: sales revenue, doctor performance, diagnosis trends, and demographic breakdowns."; whenToEdit = "When adding new analytical charts or financial export filters."; bugFix = "Ensure date filters are converted to UTC and encompass the entire 23:59:59 end-of-day." },
    @{ path = "src/CMS.API/Controllers/ServicesController.cs"; layer = "API"; title = "Clinical Price Catalog & Services Controller"; desc = "Catalog of clinic billable services (consultation fees, lab test prices, procedure tariffs)."; whenToEdit = "When updating service fee schedules or adding medical packages."; bugFix = "Verify IsActive flag is honored so retired services are hidden from doctors." },
    @{ path = "src/CMS.API/Controllers/TriageController.cs"; layer = "API"; title = "Nursing Triage & Vital Signs Controller"; desc = "Nursing vitals recording, priority scoring (Emergency, Urgent, Routine), and doctor room dispatch."; whenToEdit = "When changing triage score thresholds or adding pediatric vital parameters."; bugFix = "Ensure vital sign records link properly to the patient's active encounter ID." },
    @{ path = "src/CMS.API/Hubs/NotificationHub.cs"; layer = "API"; title = "SignalR Real-Time WebSocket Hub"; desc = "Broadcasts real-time events to all connected browser clients: QueueUpdated, ResultReady, NewOrderAlert."; whenToEdit = "When creating new real-time push events between clinical departments."; bugFix = "In IIS production, ensure WebSocket Protocol role is enabled to avoid falling back to long-polling." },
    @{ path = "src/CMS.API/Middleware/Middlewares.cs"; layer = "API"; title = "Exception & Multi-Tenant Middleware Pipeline"; desc = "ExceptionMiddleware catches unhandled server crashes; TenantMiddleware extracts clinic ID from headers."; whenToEdit = "When adding global HTTP request logging, security headers, or custom exception mappings."; bugFix = "Ensure ExceptionMiddleware writes detailed stack trace to Serilog before returning 500 JSON." },

    # APPLICATION LAYER
    @{ path = "src/CMS.Application/Appointments/AppointmentService.cs"; layer = "Application"; title = "Appointment Booking & Calendar Scheduling Service"; desc = "Calculates doctor available time slots, prevents double bookings, and manages cancellation policies."; whenToEdit = "When customizing calendar slot duration or booking buffer times."; bugFix = "Check doctor working hours and existing appointments query when debugging slot collisions." },
    @{ path = "src/CMS.Application/Auth/AuthManagementService.cs"; layer = "Application"; title = "User Authentication & Cryptography Service"; desc = "Password hashing (PBKDF2/BCrypt), JWT token signing, refresh token rotation, and role validation."; whenToEdit = "When changing password complexity rules or token expiration lifetimes."; bugFix = "If refresh token fails, verify token has not expired and RevokedAt is NULL in DB." },
    @{ path = "src/CMS.Application/Billing/BillingService.cs"; layer = "Application"; title = "Financial Billing, Invoicing & Tax Calculation Service"; desc = "Calculates invoice subtotal, dynamic VAT rate from ClinicSettings, insurance co-pay splits, waivers, and payment receipts."; whenToEdit = "When modifying VAT/tax calculation, insurance co-pay logic, or cash receipt generation."; bugFix = "Check ClinicSettings for 'TaxRate' or 'Tax.DefaultVatPercent' if tax calculation returns 0." },
    @{ path = "src/CMS.Application/Billing/ChapaPaymentService.cs"; layer = "Application"; title = "Chapa Online Payment Gateway Integration"; desc = "Initiates hosted checkout sessions and verifies bank/telecom payment callbacks."; whenToEdit = "When updating Chapa API endpoints or webhook payload handling."; bugFix = "Verify amount currency is ETB and callback URL is publicly accessible." },
    @{ path = "src/CMS.Application/Billing/TelebirrPaymentService.cs"; layer = "Application"; title = "Telebirr Mobile Money Payment Integration"; desc = "Encrypted payload generation and verification for Ethio Telecom Telebirr payments."; whenToEdit = "When updating Telebirr merchant keys, app IDs, or RSA encryption signatures."; bugFix = "Verify RSA public key formatting and timestamp validity." },
    @{ path = "src/CMS.Application/Dashboard/DashboardService.cs"; layer = "Application"; title = "Executive Clinical Dashboard Service"; desc = "Aggregates real-time clinic KPIs: today's patient visits, revenue, pending lab orders, and occupancy."; whenToEdit = "When adding high-level metrics or management graphs to DashboardPage.tsx."; bugFix = "Use AsNoTracking() on EF queries to ensure dashboard queries execute in milliseconds." },
    @{ path = "src/CMS.Application/Encounters/EncounterService.cs"; layer = "Application"; title = "Patient Encounter Lifecycle Service"; desc = "Manages patient visit status flow: REGISTERED ➔ TRIAGED ➔ IN_CONSULTATION ➔ DISPENSARY ➔ COMPLETED."; whenToEdit = "When adding new stages to clinical patient workflow."; bugFix = "Ensure encounter status updates trigger a SignalR queue refresh event." },
    @{ path = "src/CMS.Application/Encounters/SoapAndClinicalService.cs"; layer = "Application"; title = "SOAP Consultation & Medical Certificates Service"; desc = "Handles doctor consultation documentation, ICD-10 diagnosis linking, medical certificates with QR codes, and procedure orders using Dapper."; whenToEdit = "When adding fields to SOAP notes, modifying certificate templates, or clinical procedures."; bugFix = "Uses IDbConnectionFactory. Ensure SQL parameter names match DTO properties exactly." },
    @{ path = "src/CMS.Application/Laboratory/LabService.cs"; layer = "Application"; title = "Laboratory Catalog & Test Fulfillment Service"; desc = "Manages test orders, specimen collection tubes, technician manual result entry, and doctor sign-off verification."; whenToEdit = "When introducing new lab tests, sub-parameters, or modifying order turnaround times."; bugFix = "Orders must be in 'ORDERED' status to accept machine ingestion from LIS." },
    @{ path = "src/CMS.Application/Modules/ModuleManagementService.cs"; layer = "Application"; title = "Tenant Module Licensing & Activation Service"; desc = "Enables or disables modular clinic features (Telemed, Inpatient, Payroll) per clinic tenant."; whenToEdit = "When registering a new modular feature into the system."; bugFix = "Disabled modules in TenantModuleSettings should hide corresponding frontend routes." },
    @{ path = "src/CMS.Application/Notifications/NotificationService.cs"; layer = "Application"; title = "In-App Alerts & Notification Dispatcher"; desc = "Stores persistent in-app notifications and dispatches urgent alerts to clinical roles."; whenToEdit = "When adding custom alert triggers (e.g. Critical Lab Alert)."; bugFix = "Ensure RecipientUserId is set for private alerts or NULL for role-wide broadcasts." },
    @{ path = "src/CMS.Application/Notifications/SmsGatewayService.cs"; layer = "Application"; title = "SMS Text Messaging Gateway Service"; desc = "Sends appointment reminder text messages and verification codes to patient phones."; whenToEdit = "When switching SMS telecommunication providers or editing SMS templates."; bugFix = "Verify international phone format prefix (+251 for Ethiopia)." },
    @{ path = "src/CMS.Application/PatientPortal/PatientPortalService.cs"; layer = "Application"; title = "Patient Self-Service Logic Service"; desc = "Serves personal health records, appointment history, and invoices to logged-in patients."; whenToEdit = "When expanding the patient portal feature set."; bugFix = "Never return clinical notes marked as 'Confidential' to patient portal." },
    @{ path = "src/CMS.Application/Patients/ExpandedPatientService.cs"; layer = "Application"; title = "Patient Master Index (MPI) & Registration Service"; desc = "Creates unique patient Medical Record Numbers (MRN), handles duplicate phone/ID detection, and full-text search."; whenToEdit = "When adding patient fields (National ID, Blood Type, Allergies) or changing MRN prefix."; bugFix = "Ensure MRN generation locks sequence to prevent duplicate numbers during concurrent registrations." },
    @{ path = "src/CMS.Application/Pharmacy/PharmacyService.cs"; layer = "Application"; title = "Dispensary & Stock Inventory Service"; desc = "Controls drug dispensing, batch numbers, stock replenishment, and expiration date warnings."; whenToEdit = "When altering stock deduction rules or adding drug categories."; bugFix = "Ensure dispensing transactions check available batch quantity before completing." },
    @{ path = "src/CMS.Application/Queue/QueueService.cs"; layer = "Application"; title = "Patient Queue Engine & TV Screen Dispatcher"; desc = "Calculates waiting times, assigns sequential token numbers, and broadcasts room call events."; whenToEdit = "When changing queue routing rules between triage and consultation rooms."; bugFix = "Check if QueueItems have status 'WAITING' when diagnosing TV display omissions." },
    @{ path = "src/CMS.Application/ReportBuilder/ReportExportService.cs"; layer = "Application"; title = "Excel & PDF Document Export Engine"; desc = "Renders formatted clinical documents, invoices, lab reports, and analytics spreadsheets."; whenToEdit = "When altering report page styling, clinic logos, or Excel column layouts."; bugFix = "Ensure memory streams are flushed and disposed cleanly after generating file bytes." },
    @{ path = "src/CMS.Application/ReportBuilder/ReportTemplateService.cs"; layer = "Application"; title = "Dynamic Report Template Configuration"; desc = "Stores and executes custom SQL queries and column mappings for clinic administrators."; whenToEdit = "When creating new ad-hoc report definitions."; bugFix = "All ad-hoc queries must be validated by SafeQueryBuilder to prevent SQL injection." },
    @{ path = "src/CMS.Application/ReportBuilder/SafeQueryBuilder.cs"; layer = "Application"; title = "Safe SQL Query Sanitizer & Validator"; desc = "Enforces SELECT-only statements and rejects destructive SQL keywords (DROP, DELETE, UPDATE)."; whenToEdit = "When adding permitted SQL aggregation functions for report builder."; bugFix = "Throws InvalidOperationException if non-SELECT statements are detected." },
    @{ path = "src/CMS.Application/Settings/SettingsAndApiService.cs"; layer = "Application"; title = "Clinic Settings & Webhook Key Management"; desc = "Manages dynamic clinic key-value settings (VAT rate, logo, clinic name) and third-party API keys."; whenToEdit = "When adding global configuration parameters accessible across the clinic."; bugFix = "Settings are cached in memory. Invalidate cache when updating ClinicSettings." },
    @{ path = "src/CMS.Application/StaffServices/StaffAndDoctorService.cs"; layer = "Application"; title = "Staff Profiles & Doctor Rostering Service"; desc = "Maintains employee records, specialty assignments, working days, and room allocations."; whenToEdit = "When adding employee metadata or modifying doctor specialty assignments."; bugFix = "Ensure Staff.UserId matches corresponding record in Users table." },
    @{ path = "src/CMS.Application/Telemedicine/TelegramBotService.cs"; layer = "Application"; title = "Telegram Bot Telemedicine Integration"; desc = "Handles incoming Telegram messages, links chat IDs to patient MRNs, and sends lab alerts."; whenToEdit = "When adding Telegram bot commands (/results, /book) or webhook handlers."; bugFix = "Verify Telegram Bot Token in appsettings.json using update_bot_token.ps1." },
    @{ path = "src/CMS.Application/Telemedicine/TelemedService.cs"; layer = "Application"; title = "Telemedicine Video & Chat Queue Service"; desc = "Coordinates remote virtual consultation queues between doctors and off-site patients."; whenToEdit = "When adding WebRTC video signaling or remote chat features."; bugFix = "Ensure video session tokens expire after consultation is signed off." },
    @{ path = "src/CMS.Application/Telemedicine/WhatsAppCloudService.cs"; layer = "Application"; title = "WhatsApp Cloud API Patient Messaging"; desc = "Integrates with Meta WhatsApp Business Cloud API to deliver appointment confirmations."; whenToEdit = "When configuring WhatsApp message templates or Meta webhook tokens."; bugFix = "Check Meta API phone ID and Bearer access token validity." },

    # DOMAIN & INFRASTRUCTURE
    @{ path = "src/CMS.Domain/Entities/AuthEntities.cs"; layer = "Domain"; title = "Authentication & User Entities"; desc = "Core entities: User, Role, UserRole, RefreshToken, ApiKey."; whenToEdit = "When adding columns to user accounts or authentication records."; bugFix = "PasswordHash should never be exposed in any DTO." },
    @{ path = "src/CMS.Domain/Entities/ClinicalEntities.cs"; layer = "Domain"; title = "Core Clinical Domain Entities"; desc = "Patient, Staff, Doctor, Appointment, Encounter, VitalSign, Diagnosis."; whenToEdit = "When expanding core clinical patient models or medical encounter entities."; bugFix = "Ensure new properties have appropriate default values or nullability." },
    @{ path = "src/CMS.Domain/Entities/ExtendedEntities.cs"; layer = "Domain"; title = "Extended Financial & Care Entities"; desc = "Invoice, InvoiceItem, Payment, Prescription, MedicalCertificate, ProcedureOrder."; whenToEdit = "When adding financial or ancillary clinical data structures."; bugFix = "Verify foreign key relationships link to parent patient and encounter IDs." },
    @{ path = "src/CMS.Domain/Entities/LabAndReportEntities.cs"; layer = "Domain"; title = "Laboratory & Reporting Domain Entities"; desc = "LabOrder, LabOrderItem, LabSample, LabResult, LabInstrument, ReportDefinition."; whenToEdit = "When adding test parameter configurations or instrument metadata."; bugFix = "Ensure LabResult.StatusId matches OrderStatus enum." },
    @{ path = "src/CMS.Domain/Enums/Enums.cs"; layer = "Domain"; title = "Global Domain Enums"; desc = "TriagePriority, EncounterStatus, OrderStatus, PaymentMethod, Gender, MaritalStatus."; whenToEdit = "When introducing new status codes or categorical domain values."; bugFix = "Ensure enum integer values match the database TINYINT/INT constraints." },
    @{ path = "src/CMS.Domain/Interfaces/IServiceInterfaces.cs"; layer = "Domain"; title = "Service Contract Interfaces"; desc = "Defines interface contracts implemented by Application and Infrastructure layers."; whenToEdit = "When declaring new service methods to keep architecture loosely coupled."; bugFix = "Both interface and implementation signatures must match exactly." },
    @{ path = "src/CMS.Infrastructure/BackgroundServices/DatabaseBackupBackgroundService.cs"; layer = "Infrastructure"; title = "Automated Scheduled Database Backup Service"; desc = "Background worker taking automated nightly SQL Server backups to local disk."; whenToEdit = "When changing backup frequency, backup folder path, or retention limits."; bugFix = "Ensure the Windows user account running the API has write permissions to backup directory." },
    @{ path = "src/CMS.Infrastructure/Cache/RedisCacheService.cs"; layer = "Infrastructure"; title = "Redis / Memurai Distributed Cache Provider"; desc = "High-speed key-value caching provider using StackExchange.Redis."; whenToEdit = "When altering cache key prefixing or default TTL expirations."; bugFix = "Falls back automatically to MemoryCacheService if Redis server is down." },
    @{ path = "src/CMS.Infrastructure/Cache/MemoryCacheService.cs"; layer = "Infrastructure"; title = "In-Memory High-Speed Cache Fallback"; desc = "Lightweight zero-dependency caching provider using ASP.NET Core IMemoryCache."; whenToEdit = "When adjusting in-process memory cache evacuation policies."; bugFix = "Memory cache is process-local; restarts will clear active cache entries." },
    @{ path = "src/CMS.Infrastructure/Data/AppDbContext.cs"; layer = "Infrastructure"; title = "Entity Framework Core Database Context"; desc = "Houses all DbSets, maps entities to SQL Server tables, sets relationship constraints, and applies global soft-delete query filters."; whenToEdit = "When adding a new entity or table, configuring indexes, or foreign key cascades."; bugFix = "Remember to configure HasQueryFilter(x => !x.IsDeleted) so deleted records are excluded." },
    @{ path = "src/CMS.Infrastructure/LabIntegration/LabAdapters.cs"; layer = "Infrastructure"; title = "ASTM 1394 & HL7 v2.x Protocol Parsers"; desc = "Extracts sample barcodes, parameters (WBC, RBC, HGB, PLT), quantitative values, and units from raw analyzer byte frames."; whenToEdit = "When connecting a new analyzer model with unique framing delimiters."; bugFix = "Test raw frame bytes with unit test in CMS.UnitTests to verify segment extraction." },
    @{ path = "src/CMS.Infrastructure/LabIntegration/LabResultIngestionService.cs"; layer = "Infrastructure"; title = "Automated Lab Result Matching & Ingestion Engine"; desc = "Matches incoming analyzer specimen barcodes to pending LabOrderItems and saves results."; whenToEdit = "When altering result auto-verification thresholds or flag rules."; bugFix = "Checks if order exists; logs warning if machine sends result for unregistered barcode." },
    @{ path = "src/CMS.Infrastructure/LabIntegration/LisTcpListenerService.cs"; layer = "Infrastructure"; title = "Multi-Port Laboratory Analyzer TCP Socket Listener"; desc = "Background service concurrently listening on ports 8004, 10001, and 10002 for raw ASTM 1394 and HL7 v2.x analyzer result streams."; whenToEdit = "When adding or changing analyzer ports, buffer timeouts, or diagnostic socket logging."; bugFix = "If machine cannot connect, check Windows Firewall inbound rules on port 8004." },
    @{ path = "src/CMS.Infrastructure/Notifications/SmtpEmailProvider.cs"; layer = "Infrastructure"; title = "Outbound SMTP Email Provider"; desc = "Sends password reset emails, invoice PDFs, and official reports via SMTP."; whenToEdit = "When updating SMTP server host, port, credentials, or TLS settings."; bugFix = "Check appsettings.json Smtp configuration if emails bounce." },

    # SHARED DTOs
    @{ path = "src/CMS.Shared/DTOs/ClinicalDTOs.cs"; layer = "Shared"; title = "Clinical & Encounter Data Transfer Objects"; desc = "EncounterDto, CreateEncounterDto, VitalSignDto, CreateDiagnosisDto, AppointmentDto."; whenToEdit = "When changing the payload shape between doctor consultation page and API."; bugFix = "Avoid circular reference properties inside DTO records." },
    @{ path = "src/CMS.Shared/DTOs/LabPharmacyBillingDTOs.cs"; layer = "Shared"; title = "Lab, Pharmacy & Billing DTOs"; desc = "CreateInvoiceDto, InvoiceDto, LabOrderDto, LabResultDto, PrescriptionDto, DrugDto."; whenToEdit = "When adding columns to billing receipts, lab result grids, or pharmacy queues."; bugFix = "Ensure decimal types for monetary fields (UnitPrice, TotalAmount) to avoid rounding errors." },
    @{ path = "src/CMS.Shared/DTOs/ExtendedDTOs.cs"; layer = "Shared"; title = "Extended Module & Procedure DTOs"; desc = "ProcedureOrderDto, MedicalCertificateDto, StaffDetailDto, DoctorScheduleDto."; whenToEdit = "When expanding minor procedure orders or medical certificates."; bugFix = "Check DateTime property timezone handling (prefer UTC DateTime)." },

    # FRONTEND PAGES & COMPONENTS
    @{ path = "frontend/cms-web/src/App.tsx"; layer = "Frontend"; title = "Master React Application Component & View Router"; desc = "Manages activeModule state, HttpOnly cookie auth session, and 15-minute idle inactivity timeout."; whenToEdit = "When adding a new module screen, modifying timeout duration, or adding global modals."; bugFix = "Ensure new module keys are added to the activeModule render condition around line 460." },
    @{ path = "frontend/cms-web/src/api/apiClient.ts"; layer = "Frontend"; title = "Centralized Typed Fetch Networking Client"; desc = "Wraps browser fetch with credentials: 'include' (HttpOnly cookies), x-tenant-id headers, and automatic 401 session expiration handling."; whenToEdit = "When adding custom request headers or modifying error popup handling."; bugFix = "Never use plain window.fetch() directly — always use api.get / api.post from this file." },
    @{ path = "frontend/cms-web/src/components/Sidebar.tsx"; layer = "Frontend"; title = "Role-Based Navigation Sidebar"; desc = "Renders navigation menu items filtered by user roles. Defines ModuleKey type and MODULE_ITEMS catalog."; whenToEdit = "When adding a menu icon, reordering links, or adding navigation categories."; bugFix = "If a menu item doesn't show, check utils/permissions.ts to see if your role is allowed." },
    @{ path = "frontend/cms-web/src/components/Header.tsx"; layer = "Frontend"; title = "Top Navigation Bar & User Profile Header"; desc = "Displays clinic branch switcher, current logged-in user, active notifications bell, theme toggle, and logout button."; whenToEdit = "When adding top-bar shortcuts or clinic branch selection options."; bugFix = "Ensure user logout calls handleLogout to clear session cookies properly." },
    @{ path = "frontend/cms-web/src/components/ClinicalOrderModal.tsx"; layer = "Frontend"; title = "Unified Clinical Order Dispatch Modal"; desc = "Reusable popup modal allowing doctors to order Lab Tests, Medications, and Minor Procedures from any screen."; whenToEdit = "When adding order types or changing quick-search test catalog filters."; bugFix = "Verifies active patient ID before allowing order submission." },
    @{ path = "frontend/cms-web/src/components/RadiologyViewerModal.tsx"; layer = "Frontend"; title = "Embedded Medical Image & Radiology Viewer"; desc = "Displays X-ray, ultrasound, and clinical dermatology photos with zoom, pan, and contrast controls."; whenToEdit = "When enhancing image inspection tools or DICOM rendering."; bugFix = "Ensure image URL is prefixed with backend uploads directory." },
    @{ path = "frontend/cms-web/src/utils/permissions.ts"; layer = "Frontend"; title = "Role-Based Access Control (RBAC) Permissions Matrix"; desc = "Defines allowed ModuleKey screens per user role (SuperAdmin, Admin, Doctor, Nurse, etc.)."; whenToEdit = "When granting or revoking module permissions for any clinic role."; bugFix = "Add your new ModuleKey to DEFAULT_ROLE_PERMISSIONS under the allowed roles." },
    @{ path = "frontend/cms-web/src/utils/cdsRuleEngine.ts"; layer = "Frontend"; title = "Clinical Decision Support (CDS) Rule Engine"; desc = "Evaluates patient vital signs in real-time, alerting doctors to critical thresholds (e.g. Stage 2 Hypertension, High Fever)."; whenToEdit = "When adding clinical alert rules or adjusting warning thresholds."; bugFix = "Check systolic/diastolic parsing if blood pressure alerts fail to trigger." },
    @{ path = "frontend/cms-web/src/utils/audioAnnouncer.ts"; layer = "Frontend"; title = "Text-to-Speech Waiting Room Audio Announcer"; desc = "Uses HTML5 SpeechSynthesis API to chime and speak patient call announcements (e.g. 'Patient John Doe, please proceed to Room 2')."; whenToEdit = "When customizing announcement language, accent voice, or audio chime tone."; bugFix = "Browsers require user interaction before allowing audio synthesis to play." },
    @{ path = "frontend/cms-web/src/pages/Dashboard/DashboardPage.tsx"; layer = "Frontend"; title = "Clinic Executive Analytics Dashboard"; desc = "Visual KPI cards showing today's patient visits, daily revenue, active waiting room queue, and department distribution."; whenToEdit = "When adding operational graphs or financial summary widgets."; bugFix = "Dashboard automatically polls or receives SignalR updates to refresh stats." },
    @{ path = "frontend/cms-web/src/pages/Patients/PatientsPage.tsx"; layer = "Frontend"; title = "Patient Master Index & Registration Page"; desc = "Searchable patient directory, new patient registration modal, and comprehensive medical record history drawer."; whenToEdit = "When adding patient registration inputs or medical history summary tabs."; bugFix = "MRN search supports partial text matching." },
    @{ path = "frontend/cms-web/src/pages/Triage/TriagePage.tsx"; layer = "Frontend"; title = "Nurse Triage & Vitals Assessment Page"; desc = "Records blood pressure, temperature, pulse, oxygen saturation, pain scale, and assigns triage urgency."; whenToEdit = "When adding vital signs metrics (e.g. Blood Glucose) or pediatric growth charts."; bugFix = "Submitting triage moves patient status to 'TRIAGED' and notifies doctor queue." },
    @{ path = "frontend/cms-web/src/pages/EMR/EmrSoapPage.tsx"; layer = "Frontend"; title = "Doctor EMR & SOAP Clinical Consultation Page"; desc = "Comprehensive clinical consultation interface with real-time Clinical Decision Support (CDS) alerts and orders."; whenToEdit = "When customizing clinical examination forms, ICD-10 search, or prescription orders."; bugFix = "Vital sign threshold alerts are driven by utils/cdsRuleEngine.ts." },
    @{ path = "frontend/cms-web/src/pages/Billing/BillingPage.tsx"; layer = "Frontend"; title = "Cashier Billing, Invoicing & Receipts Interface"; desc = "Manages invoice itemization, discounts, insurance claim deductions, cash/Chapa/Telebirr payment collection, and print receipts."; whenToEdit = "When customizing print receipt layouts or payment collection methods."; bugFix = "Ensure invoice payments reload active queue upon successful transaction." },
    @{ path = "frontend/cms-web/src/pages/Laboratory/LaboratoryPage.tsx"; layer = "Frontend"; title = "Laboratory Worklist & Verified Results Page"; desc = "Lab technician sample tracking, automated machine result review, and official report approval."; whenToEdit = "When altering result verification workflows or print report headers."; bugFix = "Unverified results show in 'Order Worklist'; verified results move to 'Verified Results' tab." },
    @{ path = "frontend/cms-web/src/pages/Pharmacy/PharmacyPage.tsx"; layer = "Frontend"; title = "Pharmacy Dispensary Queue & Stock Management"; desc = "Prescription fulfillment queue, drug dispensing verification, stock balance monitoring, and batch adjustments."; whenToEdit = "When modifying drug dispensing workflows or adding inventory reconciliation tools."; bugFix = "Ensure batch number is selected before confirming prescription dispensing." },
    @{ path = "frontend/cms-web/src/pages/Queue/QueuePage.tsx"; layer = "Frontend"; title = "Clinic Receptionist Queue Management Page"; desc = "Monitors waiting patients across all clinic departments, reassigns doctors, and manually calls patients."; whenToEdit = "When adding queue priority overrides or department transfer buttons."; bugFix = "Queue items sync with backend QueueService via SignalR." },
    @{ path = "frontend/cms-web/src/pages/Queue/WaitingRoomTvScreen.tsx"; layer = "Frontend"; title = "Fullscreen Waiting Room TV Kiosk Display"; desc = "Kiosk screen for waiting room TVs displaying currently called tokens, doctor rooms, and audio announcements."; whenToEdit = "When customizing waiting room TV layout, sponsor banner, or clinic branding."; bugFix = "Designed to run full-screen (F11) on unattended smart TV browsers." },
    @{ path = "frontend/cms-web/src/pages/Inpatient/InpatientPage.tsx"; layer = "Frontend"; title = "Inpatient Ward & Bed Allocation Page"; desc = "Visual grid of hospital beds, admission status, admitting doctor, and daily inpatient care notes."; whenToEdit = "When configuring ward layouts, bed numbers, or inpatient nursing sheets."; bugFix = "Beds are color-coded: Green (Available), Red (Occupied), Yellow (Maintenance)." },
    @{ path = "frontend/cms-web/src/pages/Appointments/AppointmentsPage.tsx"; layer = "Frontend"; title = "Appointments Calendar & Booking Page"; desc = "Interactive day/week/month appointment calendar, slot availability finder, and booking modal."; whenToEdit = "When customizing calendar view options or appointment reminder buttons."; bugFix = "Ensure selected appointment date timezone matches clinic local time." },
    @{ path = "frontend/cms-web/src/pages/UserManagement/UserManagementPage.tsx"; layer = "Frontend"; title = "User Accounts & Role Permissions Admin Page"; desc = "Staff user directory, password resets, account locking, and role assignment matrix."; whenToEdit = "When adding staff account attributes or security administration tools."; bugFix = "SuperAdmin role cannot be deleted or revoked." },
    @{ path = "frontend/cms-web/src/pages/Settings/SettingsPage.tsx"; layer = "Frontend"; title = "Clinic Global Configuration Settings Page"; desc = "Configure clinic name, logo upload, default VAT tax rate, working hours, and invoice footer notes."; whenToEdit = "When adding clinic-wide customization settings."; bugFix = "Saving settings updates ClinicSettings table in SQL Server immediately." },
    @{ path = "frontend/cms-web/src/pages/Appearance/AppearancePage.tsx"; layer = "Frontend"; title = "Theme & Custom Clinic Branding Page"; desc = "Custom theme colors, high-contrast accessibility mode, and font scaling settings."; whenToEdit = "When adding color palettes or branding customization presets."; bugFix = "Theme preferences persist in browser localStorage." },
    @{ path = "frontend/cms-web/src/pages/Integrations/MachineIntegrationTab.tsx"; layer = "Frontend"; title = "LIS Medical Analyzer Real-Time Monitor Tab"; desc = "Live diagnostic view showing active analyzer socket connections, bytes received, and packet logs."; whenToEdit = "When adding visual packet decoders for lab machine testing."; bugFix = "Polls listener-status endpoint to show connected analyzer IP addresses." }
)

$codeFilesJson = $codeFiles | ConvertTo-Json -Depth 5 -Compress

$htmlTemplate = @'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CMS Developer & Architecture Hub</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    pre code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85rem; }
    .tab-active { border-bottom: 2px solid #2563eb; color: #2563eb; font-weight: 600; }
    .doc-active { background-color: #eff6ff; border-left: 3px solid #2563eb; color: #1e40af; font-weight: 600; }
    /* Markdown Prose Styling */
    .markdown-body h1 { font-size: 1.75rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    .markdown-body h2 { font-size: 1.35rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.35rem; }
    .markdown-body h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; color: #334155; }
    .markdown-body p { margin-bottom: 1rem; line-height: 1.65; color: #334155; font-size: 0.925rem; }
    .markdown-body ul, .markdown-body ol { margin-bottom: 1rem; padding-left: 1.5rem; }
    .markdown-body ul { list-style-type: disc; }
    .markdown-body ol { list-style-type: decimal; }
    .markdown-body li { margin-bottom: 0.35rem; font-size: 0.925rem; color: #334155; }
    .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 1.25rem; font-size: 0.875rem; }
    .markdown-body th { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 0.65rem 0.75rem; text-align: left; font-weight: 600; color: #1e293b; }
    .markdown-body td { border: 1px solid #e2e8f0; padding: 0.65rem 0.75rem; color: #334155; }
    .markdown-body tr:nth-child(even) { background-color: #fcfcfd; }
    .markdown-body code:not(pre code) { background-color: #f1f5f9; color: #0f172a; padding: 0.2rem 0.4rem; border-radius: 0.375rem; font-size: 0.825rem; font-family: monospace; }
    .markdown-body pre { background-color: #0f172a; color: #f8fafc; padding: 1rem; border-radius: 0.75rem; overflow-x: auto; margin-bottom: 1.25rem; }
    .markdown-body blockquote { border-left: 4px solid #3b82f6; background-color: #eff6ff; padding: 0.75rem 1rem; margin-bottom: 1rem; border-radius: 0 0.5rem 0.5rem 0; }
    .markdown-body blockquote p { margin-bottom: 0; color: #1e40af; }
    .markdown-body hr { border: 0; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
    .markdown-body a { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
    .markdown-body a:hover { color: #1d4ed8; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col">

  <!-- Header with Global Live Search -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      
      <!-- Brand -->
      <div class="flex items-center space-x-3 cursor-pointer" onclick="switchTab('arch')">
        <div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
          <i class="fa-solid fa-hospital"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 leading-tight">HUDERMA CMS Developer Hub</h1>
          <p class="text-xs text-slate-500">Universal Knowledge Base & Architecture Navigator</p>
        </div>
      </div>

      <!-- Omnisearch Bar -->
      <div class="flex-1 max-w-lg relative">
        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-xs text-slate-400"></i>
          <input type="text" id="global-search" placeholder="Search all guides, code files, or errors... (e.g. 'billing', '401', 'lis', 'soap')" oninput="onGlobalSearch()" onfocus="onGlobalSearch()" class="w-full pl-9 pr-10 py-2 text-xs bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-inner">
          <button id="clear-search-btn" onclick="clearGlobalSearch()" class="hidden absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs">
            <i class="fa-solid fa-circle-xmark"></i>
          </button>
        </div>

        <!-- Global Search Results Dropdown -->
        <div id="search-results-dropdown" class="hidden absolute left-0 right-0 top-12 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-96 overflow-y-auto p-2 z-50 space-y-1">
          <!-- Injected via JavaScript -->
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex items-center space-x-3 text-sm">
        <button onclick="switchTab('docs')" class="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200">
          <i class="fa-solid fa-book-open"></i> Docs Reader
        </button>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
          <i class="fa-solid fa-circle text-[8px] mr-1.5 animate-pulse"></i> Complete File Index
        </span>
      </div>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <div class="bg-white border-b border-slate-200 sticky top-16 z-40 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-6 overflow-x-auto">
      <button onclick="switchTab('arch')" id="tab-arch" class="tab-btn py-4 text-sm font-medium text-slate-500 hover:text-slate-700 tab-active flex items-center gap-2 whitespace-nowrap">
        <i class="fa-solid fa-layer-group"></i> Architecture Explorer
      </button>
      <button onclick="switchTab('codedir')" id="tab-codedir" class="tab-btn py-4 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2 whitespace-nowrap">
        <i class="fa-solid fa-folder-tree"></i> Where is the Code? (Every File Directory)
      </button>
      <button onclick="switchTab('docs')" id="tab-docs" class="tab-btn py-4 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2 whitespace-nowrap">
        <i class="fa-solid fa-book-open"></i> Documentation Library
      </button>
      <button onclick="switchTab('generator')" id="tab-generator" class="tab-btn py-4 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2 whitespace-nowrap">
        <i class="fa-solid fa-wand-magic-sparkles"></i> New Module Generator
      </button>
      <button onclick="switchTab('lis')" id="tab-lis" class="tab-btn py-4 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2 whitespace-nowrap">
        <i class="fa-solid fa-microscope"></i> LIS Analyzer Pipeline
      </button>
      <button onclick="switchTab('troubleshoot')" id="tab-troubleshoot" class="tab-btn py-4 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2 whitespace-nowrap">
        <i class="fa-solid fa-wrench"></i> Troubleshooting Finder
      </button>
    </div>
  </div>

  <!-- Main Content Area -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full" onclick="closeSearchDropdown()">

    <!-- TAB 1: ARCHITECTURE EXPLORER -->
    <div id="content-arch" class="space-y-8">
      <div class="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold mb-2">Clean Architecture & Data Flow Map</h2>
          <p class="text-blue-100 text-sm max-w-2xl">
            Click any layer below to inspect its exact responsibilities, core files, and rules for modification. Notice how dependencies flow strictly inwards toward the Domain core.
          </p>
        </div>
        <button onclick="openDocInReader('arch')" class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur transition flex items-center gap-2 whitespace-nowrap">
          <i class="fa-solid fa-book"></i> Read Full Architecture Guide
        </button>
      </div>

      <!-- Interactive Layers Stack -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div onclick="selectLayer('frontend')" class="layer-card cursor-pointer p-5 bg-white rounded-xl border-2 border-indigo-200 hover:border-indigo-600 hover:shadow-md transition">
          <div class="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-3">
            <i class="fa-brands fa-react text-xl"></i>
          </div>
          <h3 class="font-bold text-slate-900 text-base">1. React SPA</h3>
          <p class="text-xs text-slate-500 mt-1">Vite + React 18 + Tailwind CSS. EMR, Triage, Pharmacy, Billing.</p>
          <div class="mt-4 text-xs font-semibold text-indigo-600 flex items-center">Inspect Layer <i class="fa-solid fa-chevron-right ml-1 text-[10px]"></i></div>
        </div>

        <div onclick="selectLayer('api')" class="layer-card cursor-pointer p-5 bg-white rounded-xl border-2 border-blue-200 hover:border-blue-600 hover:shadow-md transition">
          <div class="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-3">
            <i class="fa-solid fa-network-wired text-xl"></i>
          </div>
          <h3 class="font-bold text-slate-900 text-base">2. CMS.API</h3>
          <p class="text-xs text-slate-500 mt-1">Controllers, Rate Limiting, Serilog, SignalR Hub, HttpOnly Cookies.</p>
          <div class="mt-4 text-xs font-semibold text-blue-600 flex items-center">Inspect Layer <i class="fa-solid fa-chevron-right ml-1 text-[10px]"></i></div>
        </div>

        <div onclick="selectLayer('app')" class="layer-card cursor-pointer p-5 bg-white rounded-xl border-2 border-cyan-200 hover:border-cyan-600 hover:shadow-md transition">
          <div class="w-10 h-10 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold mb-3">
            <i class="fa-solid fa-gears text-xl"></i>
          </div>
          <h3 class="font-bold text-slate-900 text-base">3. Application</h3>
          <p class="text-xs text-slate-500 mt-1">Business logic, clinical workflows, billing rules, payment gateways.</p>
          <div class="mt-4 text-xs font-semibold text-cyan-600 flex items-center">Inspect Layer <i class="fa-solid fa-chevron-right ml-1 text-[10px]"></i></div>
        </div>

        <div onclick="selectLayer('domain')" class="layer-card cursor-pointer p-5 bg-white rounded-xl border-2 border-emerald-200 hover:border-emerald-600 hover:shadow-md transition">
          <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-3">
            <i class="fa-solid fa-heart-pulse text-xl"></i>
          </div>
          <h3 class="font-bold text-slate-900 text-base">4. Domain Core</h3>
          <p class="text-xs text-slate-500 mt-1">Pure Entities, Enums, Interfaces, Shared DTOs. Zero external dependencies.</p>
          <div class="mt-4 text-xs font-semibold text-emerald-600 flex items-center">Inspect Layer <i class="fa-solid fa-chevron-right ml-1 text-[10px]"></i></div>
        </div>

        <div onclick="selectLayer('infra')" class="layer-card cursor-pointer p-5 bg-white rounded-xl border-2 border-purple-200 hover:border-purple-600 hover:shadow-md transition">
          <div class="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-3">
            <i class="fa-solid fa-database text-xl"></i>
          </div>
          <h3 class="font-bold text-slate-900 text-base">5. Infrastructure</h3>
          <p class="text-xs text-slate-500 mt-1">EF Core DbContext, SQL Server, Redis, LIS Analyzer Socket Listener.</p>
          <div class="mt-4 text-xs font-semibold text-purple-600 flex items-center">Inspect Layer <i class="fa-solid fa-chevron-right ml-1 text-[10px]"></i></div>
        </div>
      </div>

      <!-- Layer Detail Pane -->
      <div id="layer-details" class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <!-- Injected via JavaScript -->
      </div>
    </div>

    <!-- TAB 2: WHERE IS THE CODE? (FILE DIRECTORY) -->
    <div id="content-codedir" class="space-y-6 hidden">
      <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 class="text-xl font-bold text-slate-900 mb-1">Codebase Directory & Responsibility Map for Every File</h2>
            <p class="text-sm text-slate-500">
              Complete index mapping every file in the solution. Know exactly what each file does, when to edit it, and how to fix bugs.
            </p>
          </div>
          
          <div class="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200" id="file-counter-badge">
            <!-- Count injected via JS -->
          </div>
        </div>

        <!-- Layer filter pills -->
        <div class="flex flex-wrap gap-2 text-xs mb-4">
          <button onclick="filterCodeDir('all')" class="codedir-filter px-3 py-1.5 rounded-lg font-semibold bg-blue-600 text-white" id="filter-all">All Files</button>
          <button onclick="filterCodeDir('API')" class="codedir-filter px-3 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200" id="filter-API">API Controllers & Middleware</button>
          <button onclick="filterCodeDir('Application')" class="codedir-filter px-3 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200" id="filter-Application">Application Business Services</button>
          <button onclick="filterCodeDir('Domain')" class="codedir-filter px-3 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200" id="filter-Domain">Domain Entities & Enums</button>
          <button onclick="filterCodeDir('Infrastructure')" class="codedir-filter px-3 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200" id="filter-Infrastructure">Infrastructure & LIS Sockets</button>
          <button onclick="filterCodeDir('Shared')" class="codedir-filter px-3 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200" id="filter-Shared">Shared DTOs</button>
          <button onclick="filterCodeDir('Frontend')" class="codedir-filter px-3 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200" id="filter-Frontend">Frontend Pages & Components</button>
        </div>

        <!-- Search input for file directory -->
        <div class="relative mb-6">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-xs text-slate-400"></i>
          <input type="text" id="codedir-search" placeholder="Type any keyword (e.g. 'soap', 'billing', 'lis', 'chapa', 'patient', 'jwt', 'vitals')..." oninput="renderCodeDir()" class="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>

        <!-- Files Grid -->
        <div id="codedir-list" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Injected via JavaScript -->
        </div>
      </div>
    </div>

    <!-- TAB 3: DOCUMENTATION LIBRARY & READER -->
    <div id="content-docs" class="space-y-6 hidden">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left Sidebar: Document Navigation -->
        <div class="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4 sticky top-36">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
              <i class="fa-solid fa-books text-blue-600"></i> Documentation Library
            </h3>
            <span class="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">7 Guides</span>
          </div>

          <!-- Search filter input -->
          <div class="relative">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-xs text-slate-400"></i>
            <input type="text" id="doc-search" placeholder="Filter library guides..." oninput="filterDocs()" class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
          </div>

          <!-- Document List -->
          <div id="doc-nav-list" class="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            <!-- Injected via JavaScript -->
          </div>
        </div>

        <!-- Right Pane: Markdown Reader -->
        <div class="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          
          <!-- Document Header Bar -->
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-slate-200">
            <div>
              <span id="reader-category" class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Core Guide</span>
              <h2 id="reader-title" class="text-xl font-bold text-slate-900 mt-1">Developer Handbook</h2>
              <p id="reader-path" class="text-xs font-mono text-slate-400 mt-0.5">docs/DEVELOPER_HANDBOOK.md</p>
            </div>

            <div class="flex items-center gap-2">
              <a id="reader-vscode-link" href="#" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5" title="Open directly in Visual Studio Code">
                <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> Open in VS Code
              </a>
              <button onclick="copyDocPath()" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5">
                <i class="fa-regular fa-copy text-[10px]"></i> <span id="copy-doc-path-text">Copy Path</span>
              </button>
            </div>
          </div>

          <!-- Rendered Markdown Content Container -->
          <div id="markdown-container" class="markdown-body">
            <!-- Rendered by marked.js -->
          </div>
        </div>

      </div>
    </div>

    <!-- TAB 4: NEW MODULE CODE GENERATOR -->
    <div id="content-generator" class="space-y-6 hidden">
      <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 mb-1">Interactive New Module Code Generator</h2>
            <p class="text-sm text-slate-500">
              Type the name of any new entity or module you want to add. The generator will instantly create the copy-paste code snippets for every file across the entire stack!
            </p>
          </div>
          <button onclick="openDocInReader('newmodule')" class="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition flex items-center gap-2 whitespace-nowrap">
            <i class="fa-solid fa-book"></i> Read 11-Step Walkthrough Guide
          </button>
        </div>

        <div class="flex gap-4 items-center">
          <div class="flex-1 max-w-md">
            <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Module / Entity Name (PascalCase)</label>
            <input type="text" id="gen-module-name" value="PatientFeedback" oninput="generateModuleCode()" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-slate-900">
          </div>
          <div class="pt-5">
            <button onclick="generateModuleCode()" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm shadow flex items-center gap-2">
              <i class="fa-solid fa-bolt"></i> Generate Snippets
            </button>
          </div>
        </div>
      </div>

      <!-- Generated Code Tabs -->
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div class="flex border-b border-slate-200 bg-slate-50 px-4 overflow-x-auto text-xs font-semibold text-slate-600">
          <button onclick="showGenStep('sql')" id="genstep-btn-sql" class="px-4 py-3 border-b-2 border-blue-600 text-blue-600">1. SQL Table</button>
          <button onclick="showGenStep('entity')" id="genstep-btn-entity" class="px-4 py-3 border-b-2 border-transparent hover:text-slate-900">2. Domain Entity</button>
          <button onclick="showGenStep('dto')" id="genstep-btn-dto" class="px-4 py-3 border-b-2 border-transparent hover:text-slate-900">3. Shared DTO</button>
          <button onclick="showGenStep('service')" id="genstep-btn-service" class="px-4 py-3 border-b-2 border-transparent hover:text-slate-900">4. Application Service</button>
          <button onclick="showGenStep('controller')" id="genstep-btn-controller" class="px-4 py-3 border-b-2 border-transparent hover:text-slate-900">5. API Controller</button>
          <button onclick="showGenStep('react')" id="genstep-btn-react" class="px-4 py-3 border-b-2 border-transparent hover:text-slate-900">6. React Page</button>
        </div>

        <div class="p-6 relative">
          <div class="flex justify-between items-center mb-3">
            <span id="gen-file-path" class="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1 rounded">database/migrations/xxx.sql</span>
            <button onclick="copySnippet()" class="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
              <i class="fa-regular fa-copy"></i> <span id="copy-btn-text">Copy Code</span>
            </button>
          </div>
          <pre class="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto max-h-[500px]"><code id="gen-code-content">-- Code will be generated here</code></pre>
        </div>
      </div>
    </div>

    <!-- TAB 5: LIS ANALYZER PIPELINE -->
    <div id="content-lis" class="space-y-6 hidden">
      <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 class="text-xl font-bold text-slate-900 mb-2">Automated Laboratory Analyzer TCP Socket Pipeline</h2>
        <p class="text-sm text-slate-500 max-w-3xl">
          CMS connects directly to physical laboratory analyzers (e.g. ZYBIO Z3 Hematology, Mindray Chemistry) without third-party middleware. Here is how raw bytes become verified clinical results.
        </p>

        <!-- Pipeline Diagram -->
        <div class="my-8 grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div class="text-blue-700 font-bold text-sm mb-1"><i class="fa-solid fa-flask mr-1"></i> 1. Machine Test Run</div>
            <p class="text-xs text-slate-600">Technician scans tube barcode (e.g. ORD-1002). Machine analyzes sample & opens TCP socket to server port 8004.</p>
          </div>
          <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div class="text-indigo-700 font-bold text-sm mb-1"><i class="fa-solid fa-server mr-1"></i> 2. Socket Listener</div>
            <p class="text-xs text-slate-600"><code>LisTcpListenerService.cs</code> reads raw TCP stream buffered between 0x02 (STX) and 0x03 (ETX).</p>
          </div>
          <div class="p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <div class="text-purple-700 font-bold text-sm mb-1"><i class="fa-solid fa-code mr-1"></i> 3. Protocol Parser</div>
            <p class="text-xs text-slate-600"><code>LabAdapters.cs</code> auto-detects HL7 vs ASTM 1394, parses WBC, RBC, HGB, PLT values and reference flags.</p>
          </div>
          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div class="text-emerald-700 font-bold text-sm mb-1"><i class="fa-solid fa-check-double mr-1"></i> 4. Live UI Ingestion</div>
            <p class="text-xs text-slate-600">Database rows created in <code>LabResults</code> table; SignalR pushes event to <code>LaboratoryPage.tsx</code> for doctor sign-off.</p>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-6">
          <h3 class="font-bold text-slate-900 text-sm mb-3">Configured Listening Ports:</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div class="p-3 bg-slate-50 border rounded-lg">
              <span class="font-bold text-slate-800">Port 8004 (TCP)</span>: Primary Hematology (ZYBIO Z3 / Mindray BC)
            </div>
            <div class="p-3 bg-slate-50 border rounded-lg">
              <span class="font-bold text-slate-800">Port 10001 (TCP)</span>: Clinical Chemistry Analyzer
            </div>
            <div class="p-3 bg-slate-50 border rounded-lg">
              <span class="font-bold text-slate-800">Port 10002 (TCP)</span>: Immunology / Urinalysis Instrument
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 6: TROUBLESHOOTING FINDER -->
    <div id="content-troubleshoot" class="space-y-6 hidden">
      <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 mb-1">Instant Troubleshooting Assistant</h2>
            <p class="text-sm text-slate-500">Click any issue to reveal immediate diagnosis and recovery steps.</p>
          </div>
          <button onclick="openDocInReader('troubleshoot')" class="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition flex items-center gap-2 whitespace-nowrap">
            <i class="fa-solid fa-book"></i> Open Full Debugging Playbook
          </button>
        </div>

        <div class="space-y-3">
          <details class="p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
            <summary class="font-semibold text-slate-900 text-sm flex items-center justify-between">
              <span><i class="fa-solid fa-shield-halved text-amber-500 mr-2"></i> HTTP 401 Unauthorized / Immediate Logout</span>
              <i class="fa-solid fa-chevron-down text-xs text-slate-400"></i>
            </summary>
            <div class="mt-3 text-xs text-slate-600 border-t pt-3 leading-relaxed">
              <strong>Cause:</strong> CMS uses HttpOnly authentication cookies. If using Vite dev server, requests must go through the proxy (<code class="bg-slate-200 px-1">/api/...</code>) with <code class="bg-slate-200 px-1">credentials: 'include'</code>.<br>
              <strong>Fix:</strong> Open browser DevTools (F12) ➔ Application ➔ Cookies ➔ Clear all cookies and log in again. Ensure backend <code class="bg-slate-200 px-1">Jwt:Key</code> in <code class="bg-slate-200 px-1">appsettings.json</code> has not changed.
            </div>
          </details>

          <details class="p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
            <summary class="font-semibold text-slate-900 text-sm flex items-center justify-between">
              <span><i class="fa-solid fa-user-lock text-red-500 mr-2"></i> HTTP 403 Forbidden / Sidebar Link Missing</span>
              <i class="fa-solid fa-chevron-down text-xs text-slate-400"></i>
            </summary>
            <div class="mt-3 text-xs text-slate-600 border-t pt-3 leading-relaxed">
              <strong>Cause:</strong> The user account lacks the required role (e.g. Doctor, Admin) in the SQL Server database.<br>
              <strong>Fix:</strong> Check <code class="bg-slate-200 px-1">frontend/cms-web/src/utils/permissions.ts</code> for the allowed roles on that module, and verify the user's role mapping in SQL Server with: <code class="bg-slate-200 px-1">SELECT * FROM UserRoles WHERE UserId = ...</code>.
            </div>
          </details>

          <details class="p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
            <summary class="font-semibold text-slate-900 text-sm flex items-center justify-between">
              <span><i class="fa-solid fa-plug text-blue-500 mr-2"></i> Lab Machine connected but results not saving</span>
              <i class="fa-solid fa-chevron-down text-xs text-slate-400"></i>
            </summary>
            <div class="mt-3 text-xs text-slate-600 border-t pt-3 leading-relaxed">
              <strong>Cause:</strong> Barcode mismatch or Windows Firewall blocking inbound socket traffic.<br>
              <strong>Fix:</strong> Verify the technician typed the exact Order Number (e.g. ORD-1002) into the analyzer. Check firewall inbound rules for TCP port 8004. Inspect backend logs at <code class="bg-slate-200 px-1">src/CMS.API/logs/</code> for LIS frame ingestion entries.
            </div>
          </details>
        </div>
      </div>
    </div>

  </main>

  <footer class="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
    HUDERMA Specialty Clinic Management System • Universal Developer Documentation & Navigator
  </footer>

  <script>
    // Embedded Documentation Registry
    const DOCS = @@DOCS_JSON@@;

    // Codebase File Directory Registry (Every File)
    const CODE_FILES = @@CODE_FILES_JSON@@;

    let activeDocId = 'handbook';
    let currentCodeDirFilter = 'all';

    // Tab switching
    function switchTab(tab) {
      ['arch', 'codedir', 'docs', 'generator', 'lis', 'troubleshoot'].forEach(t => {
        document.getElementById('content-' + t).classList.add('hidden');
        document.getElementById('tab-' + t).classList.remove('tab-active');
      });
      document.getElementById('content-' + tab).classList.remove('hidden');
      document.getElementById('tab-' + tab).classList.add('tab-active');
      if (tab === 'generator') generateModuleCode();
      if (tab === 'docs') renderDocNav();
      if (tab === 'codedir') renderCodeDir();
    }

    // Open specific document directly in the reader tab
    function openDocInReader(docId) {
      activeDocId = docId;
      switchTab('docs');
      loadDoc(docId);
    }

    // Render documentation list
    function renderDocNav(filter = '') {
      const list = document.getElementById('doc-nav-list');
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
        btn.className = `w-full text-left p-2.5 rounded-lg text-xs transition flex items-start gap-2.5 ${isActive ? 'doc-active' : 'hover:bg-slate-50 text-slate-700'}`;
        btn.innerHTML = `
          <i class="fa-solid ${d.icon} text-sm mt-0.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}"></i>
          <div class="flex-1 min-w-0">
            <div class="font-semibold truncate">${d.title}</div>
            <div class="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>${d.category}</span> • <span class="font-mono truncate">${d.path}</span>
            </div>
          </div>
        `;
        list.appendChild(btn);
      });
    }

    function filterDocs() {
      const q = document.getElementById('doc-search').value.trim();
      renderDocNav(q);
    }

    // Load and render document via marked.js
    function loadDoc(docId) {
      activeDocId = docId;
      renderDocNav(document.getElementById('doc-search')?.value || '');
      const doc = DOCS[docId];
      if (!doc) return;

      document.getElementById('reader-title').innerText = doc.title;
      document.getElementById('reader-category').innerText = doc.category;
      document.getElementById('reader-path').innerText = doc.path;
      document.getElementById('reader-vscode-link').href = `vscode://file/${doc.fullPath}`;

      // Render markdown using marked.js
      const rawMarkdown = doc.content;
      document.getElementById('markdown-container').innerHTML = marked.parse(rawMarkdown);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

    // =========================================================================
    // INTERNAL LINK ROUTER: Intercept clicks on links so you NEVER exit the hub!
    // =========================================================================
    document.getElementById('markdown-container').addEventListener('click', function(e) {
      const anchor = e.target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;

      // Check if link points to another doc
      const lower = href.toLowerCase();
      if (lower.includes('architecture_overview') || lower.includes('architecture/')) {
        e.preventDefault();
        openDocInReader('arch');
      } else if (lower.includes('how_to_add_a_new_module') || lower.includes('new_module')) {
        e.preventDefault();
        openDocInReader('newmodule');
      } else if (lower.includes('local_development') || lower.includes('localdev')) {
        e.preventDefault();
        openDocInReader('localdev');
      } else if (lower.includes('debugging_and_troubleshooting') || lower.includes('troubleshoot')) {
        e.preventDefault();
        openDocInReader('troubleshoot');
      } else if (lower.includes('developer_handbook')) {
        e.preventDefault();
        openDocInReader('handbook');
      } else if (lower.includes('suggestions_and_roadmap') || lower.includes('roadmap')) {
        e.preventDefault();
        openDocInReader('roadmap');
      } else if (lower.includes('production_update_manual') || lower.includes('production')) {
        e.preventDefault();
        openDocInReader('prodmanual');
      } else if (lower.includes('interactive_dev_hub.html')) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (href.startsWith('#')) {
        e.preventDefault();
        const el = document.getElementById(href.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    });

    // =========================================================================
    // CODEBASE FILE DIRECTORY LOGIC
    // =========================================================================
    function filterCodeDir(layer) {
      currentCodeDirFilter = layer;
      document.querySelectorAll('.codedir-filter').forEach(btn => {
        btn.className = 'codedir-filter px-3 py-1.5 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200';
      });
      document.getElementById('filter-' + layer).className = 'codedir-filter px-3 py-1.5 rounded-lg font-semibold bg-blue-600 text-white';
      renderCodeDir();
    }

    function renderCodeDir() {
      const list = document.getElementById('codedir-list');
      const search = document.getElementById('codedir-search').value.toLowerCase().trim();
      list.innerHTML = '';

      const filtered = CODE_FILES.filter(f => {
        const matchesLayer = currentCodeDirFilter === 'all' || f.layer === currentCodeDirFilter;
        const matchesSearch = !search || 
          f.path.toLowerCase().includes(search) || 
          f.title.toLowerCase().includes(search) || 
          f.desc.toLowerCase().includes(search) ||
          f.whenToEdit.toLowerCase().includes(search);
        return matchesLayer && matchesSearch;
      });

      document.getElementById('file-counter-badge').innerText = `Showing ${filtered.length} of ${CODE_FILES.length} Files`;

      if (filtered.length === 0) {
        list.innerHTML = '<div class="col-span-2 text-center text-slate-400 py-8 text-xs">No matching code files found. Try searching for "billing", "lis", "patient", or "soap".</div>';
        return;
      }

      filtered.forEach(f => {
        const card = document.createElement('div');
        card.className = 'p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition flex flex-col justify-between';
        
        let layerBadgeColor = "bg-blue-100 text-blue-800";
        if (f.layer === "Application") layerBadgeColor = "bg-cyan-100 text-cyan-800";
        if (f.layer === "Domain") layerBadgeColor = "bg-emerald-100 text-emerald-800";
        if (f.layer === "Infrastructure") layerBadgeColor = "bg-purple-100 text-purple-800";
        if (f.layer === "Frontend") layerBadgeColor = "bg-indigo-100 text-indigo-800";
        if (f.layer === "Shared") layerBadgeColor = "bg-amber-100 text-amber-800";

        card.innerHTML = `
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded ${layerBadgeColor}">${f.layer} Layer</span>
              <a href="vscode://file/C:/Users/ASUS/source/repos/CMS/${f.path}" class="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1" title="Open in Visual Studio Code">
                <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i> Open in VS Code
              </a>
            </div>
            <h4 class="font-bold text-slate-900 text-sm mb-1">${f.title}</h4>
            <div class="text-xs font-mono text-slate-600 bg-white p-1.5 rounded border border-slate-200 mb-2 truncate select-all" title="${f.path}">${f.path}</div>
            <p class="text-xs text-slate-600 mb-2 leading-relaxed">${f.desc}</p>
          </div>
          <div class="mt-3 pt-3 border-t border-slate-200/80 space-y-1.5 text-[11px]">
            <div><strong class="text-slate-800">When to edit:</strong> <span class="text-slate-600">${f.whenToEdit}</span></div>
            <div><strong class="text-amber-800"><i class="fa-solid fa-wrench mr-1"></i>Bug tip:</strong> <span class="text-amber-900">${f.bugFix}</span></div>
          </div>
        `;
        list.appendChild(card);
      });
    }

    // =========================================================================
    // OMNISEARCH / FULL-TEXT GLOBAL SEARCH ENGINE
    // =========================================================================
    function onGlobalSearch() {
      const q = document.getElementById('global-search').value.trim().toLowerCase();
      const dropdown = document.getElementById('search-results-dropdown');
      const clearBtn = document.getElementById('clear-search-btn');

      if (!q) {
        dropdown.classList.add('hidden');
        clearBtn.classList.add('hidden');
        return;
      }

      clearBtn.classList.remove('hidden');
      dropdown.classList.remove('hidden');
      dropdown.innerHTML = '';

      let resultsCount = 0;

      // 1. Search in Documentation Content
      Object.keys(DOCS).forEach(key => {
        const doc = DOCS[key];
        const titleMatch = doc.title.toLowerCase().includes(q);
        const contentIndex = doc.content.toLowerCase().indexOf(q);

        if (titleMatch || contentIndex !== -1) {
          resultsCount++;
          let snippet = "";
          if (contentIndex !== -1) {
            const start = Math.max(0, contentIndex - 40);
            const end = Math.min(doc.content.length, contentIndex + 90);
            snippet = "..." + doc.content.substring(start, end).replace(/\n/g, ' ') + "...";
          } else {
            snippet = "Document topic matching: " + doc.title;
          }

          const item = document.createElement('div');
          item.className = 'p-2.5 hover:bg-blue-50 rounded-lg cursor-pointer transition border-b border-slate-100 last:border-0';
          item.onclick = () => {
            openDocInReader(key);
            closeSearchDropdown();
          };
          item.innerHTML = `
            <div class="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span class="flex items-center gap-1.5"><i class="fa-solid ${doc.icon} text-blue-600"></i> ${doc.title}</span>
              <span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">${doc.category}</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${snippet}</p>
          `;
          dropdown.appendChild(item);
        }
      });

      // 2. Search in Codebase Directory
      CODE_FILES.forEach(f => {
        if (f.path.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q) || f.whenToEdit.toLowerCase().includes(q) || f.bugFix.toLowerCase().includes(q)) {
          resultsCount++;
          const item = document.createElement('div');
          item.className = 'p-2.5 hover:bg-indigo-50 rounded-lg cursor-pointer transition border-b border-slate-100 last:border-0';
          item.onclick = () => {
            switchTab('codedir');
            document.getElementById('codedir-search').value = q;
            renderCodeDir();
            closeSearchDropdown();
          };
          item.innerHTML = `
            <div class="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span class="flex items-center gap-1.5"><i class="fa-solid fa-file-code text-indigo-600"></i> ${f.title}</span>
              <span class="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono">${f.layer}</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 font-mono truncate">${f.path}</p>
          `;
          dropdown.appendChild(item);
        }
      });

      if (resultsCount === 0) {
        dropdown.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">No results found for "' + q + '". Try searching for "billing", "lis", "patient", or "jwt".</div>';
      }
    }

    function clearGlobalSearch() {
      document.getElementById('global-search').value = '';
      closeSearchDropdown();
      document.getElementById('clear-search-btn').classList.add('hidden');
    }

    function closeSearchDropdown() {
      document.getElementById('search-results-dropdown').classList.add('hidden');
    }

    // Keyboard shortcut (Ctrl+K or Cmd+K) to focus search
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search').focus();
      }
    });

    // Architecture Layer inspector data
    const layers = {
      frontend: {
        title: "Frontend Layer (React 18 Single Page Application)",
        path: "frontend/cms-web/src/",
        desc: "Interactive user interface built with React 18, TypeScript, Tailwind CSS, and Lucide icons. Runs as a high-performance SPA using Vite.",
        files: [
          "App.tsx: Main root handling auth state, active module routing, idle session timeout.",
          "components/Sidebar.tsx: Dynamically renders navigation links based on user roles.",
          "pages/EMR/EmrSoapPage.tsx: Doctor clinical consultation and SOAP documentation.",
          "api/apiClient.ts: Typed wrapper around fetch with automatic cookie handling."
        ],
        tip: "To add a new screen: Create a component under pages/, add the key to Sidebar.tsx, and map it in App.tsx."
      },
      api: {
        title: "Presentation & REST API Layer (CMS.API)",
        path: "src/CMS.API/",
        desc: "Entry point for HTTP requests. Handles routing, authentication middleware, rate limiting, Serilog logging, and real-time SignalR notifications.",
        files: [
          "Program.cs: Service registration, middleware pipeline, CORS, cookie config.",
          "Controllers/ClinicalControllers.cs: Endpoints for encounters, diagnoses, vitals.",
          "Controllers/PharmacyBillingControllers.cs: Endpoints for billing, invoices, drugs.",
          "Hubs/NotificationHub.cs: SignalR hub for real-time queue updates and alerts."
        ],
        tip: "Never put heavy business logic in controllers. Keep controllers thin: validate DTOs and call services in CMS.Application."
      },
      app: {
        title: "Application Business Logic Layer (CMS.Application)",
        path: "src/CMS.Application/",
        desc: "Orchestrates all business rules, workflows, validation, and domain operations. This is the heart of the clinic system.",
        files: [
          "Encounters/SoapAndClinicalService.cs: Clinical consultations and CDS rule evaluation.",
          "Billing/BillingService.cs: Invoicing, discounts, waivers, and receipt generation.",
          "Laboratory/LabService.cs: Test catalog, order fulfillment, result validation.",
          "Pharmacy/PharmacyService.cs: Stock levels, prescription dispensing, drug inventory."
        ],
        tip: "Always define an interface in CMS.Domain/Interfaces and register your service as AddScoped in Program.cs."
      },
      domain: {
        title: "Domain Core & Shared Layer (CMS.Domain & CMS.Shared)",
        path: "src/CMS.Domain/ & src/CMS.Shared/",
        desc: "The innermost layer. Contains pure entity models, domain enums, service contracts, and shared Data Transfer Objects (DTOs).",
        files: [
          "CMS.Domain/Entities/ClinicalEntities.cs: Patient, Encounter, VitalSign, Diagnosis.",
          "CMS.Domain/Interfaces/IServiceInterfaces.cs: Service contract definitions.",
          "CMS.Domain/Enums/Enums.cs: VisitStatus, OrderStatus, TriagePriority.",
          "CMS.Shared/DTOs/ClinicalDTOs.cs: API request and response models."
        ],
        tip: "Keep CMS.Domain clean of third-party libraries. Never reference EF Core or ASP.NET packages here."
      },
      infra: {
        title: "Infrastructure & Data Layer (CMS.Infrastructure)",
        path: "src/CMS.Infrastructure/",
        desc: "Manages database persistence via Entity Framework Core, SQL Server schema, Redis caching, and TCP socket servers for medical lab analyzers.",
        files: [
          "Data/AppDbContext.cs: EF Core DbContext with soft-delete global filters.",
          "LabIntegration/LisTcpListenerService.cs: Multi-port socket listener for lab machines.",
          "LabIntegration/LabAdapters.cs: HL7 v2 and ASTM 1394 protocol parsers.",
          "Cache/RedisCacheService.cs: Distributed cache with in-memory fallback."
        ],
        tip: "Always configure global soft-delete query filters in OnModelCreating so deleted rows are never accidentally shown."
      }
    };

    function selectLayer(key) {
      const data = layers[key];
      const container = document.getElementById('layer-details');
      container.innerHTML = `
        <div class="border-b pb-4 mb-4 flex justify-between items-start">
          <div>
            <span class="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded font-semibold">${data.path}</span>
            <h3 class="text-lg font-bold text-slate-900 mt-2">${data.title}</h3>
            <p class="text-sm text-slate-600 mt-1">${data.desc}</p>
          </div>
          <button onclick="openDocInReader('arch')" class="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
            <i class="fa-solid fa-book-open"></i> Full Arch Guide
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 class="text-xs font-bold uppercase text-slate-400 mb-2">Key Files in this Layer</h4>
            <ul class="text-xs space-y-1.5 text-slate-700">
              ${data.files.map(f => `<li class="flex items-start gap-2"><i class="fa-solid fa-file-code text-blue-500 mt-0.5"></i> <span>${f}</span></li>`).join('')}
            </ul>
          </div>
          <div class="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col justify-between">
            <div>
              <h4 class="text-xs font-bold uppercase text-blue-800 mb-1"><i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i> Developer Tip</h4>
              <p class="text-xs text-blue-900 leading-relaxed">${data.tip}</p>
            </div>
            <div class="mt-3 pt-2 border-t border-blue-200/50 flex justify-end">
              <button onclick="openDocInReader('newmodule')" class="text-xs font-semibold text-blue-700 hover:underline">
                See How to Add Module in this Layer ➔
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Generator logic
    let currentStep = 'sql';
    function showGenStep(step) {
      currentStep = step;
      ['sql', 'entity', 'dto', 'service', 'controller', 'react'].forEach(s => {
        const btn = document.getElementById('genstep-btn-' + s);
        if (s === step) {
          btn.className = 'px-4 py-3 border-b-2 border-blue-600 text-blue-600';
        } else {
          btn.className = 'px-4 py-3 border-b-2 border-transparent hover:text-slate-900';
        }
      });
      generateModuleCode();
    }

    function generateModuleCode() {
      const name = document.getElementById('gen-module-name').value.trim() || 'CustomModule';
      const plural = name.endsWith('s') ? name + 'es' : name + 's';
      const pathLabel = document.getElementById('gen-file-path');
      const codeBlock = document.getElementById('gen-code-content');

      if (currentStep === 'sql') {
        pathLabel.innerText = `database/migrations/xxx_add_${name.toLowerCase()}.sql`;
        codeBlock.innerText = `CREATE TABLE [dbo].[${plural}] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Title] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(1000) NULL,
    [Status] NVARCHAR(50) NOT NULL DEFAULT 'Active',
    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
    [IsDeleted] BIT NOT NULL DEFAULT 0
);
CREATE INDEX [IX_${plural}_Status] ON [dbo].[${plural}]([Status]);`;
      } else if (currentStep === 'entity') {
        pathLabel.innerText = `src/CMS.Domain/Entities/${name}.cs`;
        codeBlock.innerText = `namespace CMS.Domain.Entities;

public class ${name}
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;
}`;
      } else if (currentStep === 'dto') {
        pathLabel.innerText = `src/CMS.Shared/DTOs/${name}DTOs.cs`;
        codeBlock.innerText = `namespace CMS.Shared.DTOs;

public class ${name}Dto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class Create${name}Dto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
}`;
      } else if (currentStep === 'service') {
        pathLabel.innerText = `src/CMS.Application/${name}/${name}Service.cs`;
        codeBlock.innerText = `using CMS.Domain.Entities;
using CMS.Infrastructure.Data;
using CMS.Shared.DTOs;
using Microsoft.EntityFrameworkCore;

namespace CMS.Application.${name};

public interface I${name}Service
{
    Task<List<${name}Dto>> GetAllAsync();
    Task<${name}Dto> CreateAsync(Create${name}Dto dto);
}

public class ${name}Service : I${name}Service
{
    private readonly AppDbContext _db;
    public ${name}Service(AppDbContext db) => _db = db;

    public async Task<List<${name}Dto>> GetAllAsync()
    {
        return await _db.${plural}.AsNoTracking()
            .Select(x => new ${name}Dto {
                Id = x.Id, Title = x.Title, Description = x.Description, Status = x.Status, CreatedAt = x.CreatedAt
            }).ToListAsync();
    }

    public async Task<${name}Dto> CreateAsync(Create${name}Dto dto)
    {
        var item = new ${name} { Title = dto.Title, Description = dto.Description };
        _db.${plural}.Add(item);
        await _db.SaveChangesAsync();
        return new ${name}Dto { Id = item.Id, Title = item.Title, Description = item.Description, Status = item.Status, CreatedAt = item.CreatedAt };
    }
}`;
      } else if (currentStep === 'controller') {
        pathLabel.innerText = `src/CMS.API/Controllers/${name}Controller.cs`;
        codeBlock.innerText = `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CMS.Application.${name};
using CMS.Shared.DTOs;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class ${name}Controller : ControllerBase
{
    private readonly I${name}Service _service;
    public ${name}Controller(I${name}Service service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Create${name}Dto dto) => Ok(await _service.CreateAsync(dto));
}`;
      } else if (currentStep === 'react') {
        pathLabel.innerText = `frontend/cms-web/src/pages/${name}/${name}Page.tsx`;
        codeBlock.innerText = `import React, { useState, useEffect } from 'react';
import { api } from '../../api/apiClient';

export default function ${name}Page() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/${name}').then(res => {
      if (res.data) setItems(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">${name} Module</h1>
      {loading ? <p>Loading...</p> : (
        <div className="bg-white rounded-xl shadow p-4">
          <ul>{items.map(i => <li key={i.id} className="p-2 border-b">{i.title} - {i.status}</li>)}</ul>
        </div>
      )}
    </div>
  );
}`;
      }
    }

    function copySnippet() {
      const code = document.getElementById('gen-code-content').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const btnText = document.getElementById('copy-btn-text');
        btnText.innerText = 'Copied!';
        setTimeout(() => { btnText.innerText = 'Copy Code'; }, 2000);
      });
    }

    // Initialize default view
    selectLayer('frontend');
    loadDoc('handbook');
    renderCodeDir();
  </script>
</body>
</html>
'@

$finalHtml = $htmlTemplate.Replace('@@DOCS_JSON@@', $docsJson).Replace('@@CODE_FILES_JSON@@', $codeFilesJson)
[System.IO.File]::WriteAllText("$PSScriptRoot\..\docs\interactive_dev_hub.html", $finalHtml, [System.Text.Encoding]::UTF8)
Write-Host "interactive_dev_hub.html successfully rebuilt with EVERY file in the codebase directory!"
