-- ============================================================
-- 16 - Settings & Clinic Profile Schema
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE ClinicSettings (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    SettingKey      VARCHAR(100)    NOT NULL,
    SettingValue    NVARCHAR(MAX)   NOT NULL,
    Category        VARCHAR(50)     NOT NULL DEFAULT 'General', -- 'General', 'Localization', 'Billing', 'Clinical', 'Notification', 'Print'
    Description     NVARCHAR(300)   NULL,
    UpdatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedBy       INT             NULL,
    CONSTRAINT PK_ClinicSettings PRIMARY KEY (Id),
    CONSTRAINT UQ_ClinicSettings UNIQUE (TenantId, SettingKey),
    CONSTRAINT FK_ClinicSettings_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
GO

CREATE TABLE DocumentTemplates (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    TemplateType    VARCHAR(50)     NOT NULL, -- 'MedicalCertificate', 'Prescription', 'Invoice', 'LabReport', 'ReferralLetter'
    Name            NVARCHAR(100)   NOT NULL,
    HeaderHtml      NVARCHAR(MAX)   NULL,
    BodyHtml        NVARCHAR(MAX)   NOT NULL,
    FooterHtml      NVARCHAR(MAX)   NULL,
    IsDefault       BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_DocumentTemplates PRIMARY KEY (Id),
    CONSTRAINT FK_DocTemplates_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
GO

-- Seed standard clinic default settings
INSERT INTO ClinicSettings (TenantId, SettingKey, SettingValue, Category, Description) VALUES
(1, 'Clinic.Name', 'Aethel Clinic & Diagnostic Center', 'General', 'Official clinic display name'),
(1, 'Clinic.Address', 'Bole Sub-City, Road 4, Addis Ababa, Ethiopia', 'General', 'Physical facility address'),
(1, 'Clinic.Phone', '+251-11-662-8900', 'General', 'Primary contact phone'),
(1, 'Clinic.Email', 'info@aethelclinic.et', 'General', 'Official contact email'),
(1, 'Clinic.TaxId', 'TIN-0098452147', 'Billing', 'Taxpayer Identification Number'),
(1, 'Currency.Code', 'ETB', 'Localization', 'Default ISO currency code'),
(1, 'Currency.Symbol', 'Br', 'Localization', 'Currency symbol'),
(1, 'Timezone', 'Africa/Addis_Ababa', 'Localization', 'Clinic operating timezone'),
(1, 'Tax.DefaultVatPercent', '15.0', 'Billing', 'Standard VAT rate percentage'),
(1, 'Appointment.DefaultDurationMin', '15', 'Clinical', 'Default time slot duration per patient'),
(1, 'Appointment.MaxDaysInAdvance', '60', 'Clinical', 'Maximum forward booking window in days'),
(1, 'Queue.AutoCallNext', 'false', 'Clinical', 'Automatically summon next ticket upon checkout');
GO
