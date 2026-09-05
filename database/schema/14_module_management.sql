-- ============================================================
-- 14 - Module Management Schema
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE AppModuleRegistry (
    Id              INT             NOT NULL IDENTITY(1,1),
    ModuleCode      VARCHAR(50)     NOT NULL, -- 'PATIENTS', 'EMR', 'LAB', 'PHARMACY', 'BILLING', 'APPOINTMENTS', 'QUEUE', 'REPORT_BUILDER', 'REPORTS', 'PATIENT_PORTAL', 'API_MGMT', 'SETTINGS', 'INTEGRATIONS', 'DASHBOARD', 'USER_MGMT', 'MODULE_MGMT'
    Name            NVARCHAR(100)   NOT NULL,
    Description     NVARCHAR(500)   NULL,
    Category        NVARCHAR(50)    NOT NULL DEFAULT 'Clinical', -- 'Core', 'Clinical', 'Financial', 'Administrative', 'Patient'
    IconName        VARCHAR(50)     NULL,
    Version         VARCHAR(20)     NOT NULL DEFAULT '1.0.0',
    IsCore          BIT             NOT NULL DEFAULT 0, -- Core modules cannot be disabled
    RequiredRoles   NVARCHAR(200)   NULL, -- Comma-separated list of default roles
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_AppModuleRegistry PRIMARY KEY (Id),
    CONSTRAINT UQ_AppModuleRegistry_Code UNIQUE (ModuleCode)
);
GO

CREATE TABLE TenantModuleSettings (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    ModuleId        INT             NOT NULL,
    IsEnabled       BIT             NOT NULL DEFAULT 1,
    CustomConfigJson NVARCHAR(MAX)  NULL,
    UpdatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedBy       INT             NULL,
    CONSTRAINT PK_TenantModuleSettings PRIMARY KEY (Id),
    CONSTRAINT UQ_TenantModuleSettings UNIQUE (TenantId, ModuleId),
    CONSTRAINT FK_TenantModule_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_TenantModule_Registry FOREIGN KEY (ModuleId) REFERENCES AppModuleRegistry(Id)
);
GO

-- Seed 16 Modules
INSERT INTO AppModuleRegistry (ModuleCode, Name, Description, Category, IconName, IsCore) VALUES
('DASHBOARD', 'Executive Dashboard', 'Real-time KPI metrics, active appointments, queue stats, and critical alerts', 'Core', 'LayoutDashboard', 1),
('PATIENTS', 'Patient Management', 'Comprehensive patient registry, demographics, medical history timeline, insurance, and merging', 'Clinical', 'Users', 1),
('EMR', 'Electronic Medical Records & SOAP', 'Clinical visit documentation, SOAP notes, vital signs, ICD-10 diagnosis, procedure & medical certs', 'Clinical', 'FileHeart', 1),
('APPOINTMENTS', 'Appointment Scheduling', 'Doctor schedule matrix, multi-view calendar (Day/Week/Month), slot reservation, reminders', 'Clinical', 'Calendar', 1),
('QUEUE', 'Queue & Counter Management', 'Patient token generation, triage priority queue, TV display screen, counter call dispatch', 'Clinical', 'ListOrdered', 0),
('LAB', 'Laboratory Information System (LIS)', 'Test catalog, sample barcoding, analyzer integration (HL7/ASTM), automated result validation', 'Clinical', 'FlaskConical', 0),
('PHARMACY', 'Pharmacy & Dispensary', 'Drug formulary, e-prescriptions, stock inventory, batch dispensing logs', 'Clinical', 'Pill', 0),
('BILLING', 'Billing & Financial Accounting', 'Automated invoicing, VAT/tax calculation, payments, insurance claims, financial aging reports', 'Financial', 'CreditCard', 1),
('REPORTS', 'Reports Library', 'Standard operational reports for clinical volume, financial revenue, lab TAT, pharmacy consumption', 'Administrative', 'BarChart3', 1),
('REPORT_BUILDER', 'Custom Report Builder', 'No-code drag-and-drop query designer with PDF, Excel, and CSV export capabilities', 'Administrative', 'FileSpreadsheet', 0),
('PATIENT_PORTAL', 'Patient Self-Service Portal', 'Secure web portal for patients to book visits, inspect verified lab results, pay invoices', 'Patient', 'Globe', 0),
('USER_MGMT', 'User Management & RBAC', 'User administration, role builder, permission matrix, session controls, and MFA configuration', 'Administrative', 'ShieldCheck', 1),
('MODULE_MGMT', 'Module Management', 'Enable, disable, and configure system modules per clinic tenant', 'Core', 'Boxes', 1),
('API_MGMT', 'API Management & Webhooks', 'API key issuance, rate limiting per token, webhook subscription and delivery logging', 'Administrative', 'Key', 0),
('SETTINGS', 'Admin & System Settings', 'Clinic profile, working hours, notification templates, VAT settings, document print templates', 'Administrative', 'Settings', 1),
('INTEGRATIONS', '3rd Party Integrations', 'Email (SMTP/SendGrid), SMS (Twilio/Infobip), Payment gateways, Lab analyzers, AI assistant', 'Administrative', 'Plug', 0);
GO
