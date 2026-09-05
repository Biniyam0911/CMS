-- ============================================================
-- MASTER MIGRATION: All CMS Tables (SQL Server 2019 compatible)
-- Drops and recreates all tables in dependency order
-- Run against: ClinicDB on localhost\sqlexpress
-- ============================================================
USE ClinicDB;

-- ─── DROP ALL IN REVERSE ORDER ───────────────────────────────
IF OBJECT_ID('dbo.NarcoticsDispenseLogs','U') IS NOT NULL DROP TABLE dbo.NarcoticsDispenseLogs;
IF OBJECT_ID('dbo.LabChainOfCustody','U') IS NOT NULL DROP TABLE dbo.LabChainOfCustody;
IF OBJECT_ID('dbo.ConsultationRooms','U') IS NOT NULL DROP TABLE dbo.ConsultationRooms;
IF OBJECT_ID('dbo.PatientProblemLists','U') IS NOT NULL DROP TABLE dbo.PatientProblemLists;
IF OBJECT_ID('dbo.CdssDrugInteractions','U') IS NOT NULL DROP TABLE dbo.CdssDrugInteractions;
IF OBJECT_ID('dbo.LabTestParameters','U') IS NOT NULL DROP TABLE dbo.LabTestParameters;
IF OBJECT_ID('dbo.PharmacyRestockLogs','U') IS NOT NULL DROP TABLE dbo.PharmacyRestockLogs;
IF OBJECT_ID('dbo.PatientMedicalHistories','U') IS NOT NULL DROP TABLE dbo.PatientMedicalHistories;
IF OBJECT_ID('dbo.ProcedureOrders','U') IS NOT NULL DROP TABLE dbo.ProcedureOrders;
IF OBJECT_ID('dbo.MedicalCertificates','U') IS NOT NULL DROP TABLE dbo.MedicalCertificates;
IF OBJECT_ID('dbo.IntegrationConfigs','U') IS NOT NULL DROP TABLE dbo.IntegrationConfigs;
IF OBJECT_ID('dbo.ClinicSettings','U') IS NOT NULL DROP TABLE dbo.ClinicSettings;
IF OBJECT_ID('dbo.WebhookSubscriptions','U') IS NOT NULL DROP TABLE dbo.WebhookSubscriptions;
IF OBJECT_ID('dbo.ApiKeys','U') IS NOT NULL DROP TABLE dbo.ApiKeys;
IF OBJECT_ID('dbo.ModuleInstances','U') IS NOT NULL DROP TABLE dbo.ModuleInstances;
IF OBJECT_ID('dbo.SystemModules','U') IS NOT NULL DROP TABLE dbo.SystemModules;
IF OBJECT_ID('dbo.PatientQueueHistory','U') IS NOT NULL DROP TABLE dbo.PatientQueueHistory;
IF OBJECT_ID('dbo.PatientQueues','U') IS NOT NULL DROP TABLE dbo.PatientQueues;
IF OBJECT_ID('dbo.QueueCounters','U') IS NOT NULL DROP TABLE dbo.QueueCounters;
IF OBJECT_ID('dbo.ReportExecutionLog','U') IS NOT NULL DROP TABLE dbo.ReportExecutionLog;
IF OBJECT_ID('dbo.ReportShares','U') IS NOT NULL DROP TABLE dbo.ReportShares;
IF OBJECT_ID('dbo.ReportSchedules','U') IS NOT NULL DROP TABLE dbo.ReportSchedules;
IF OBJECT_ID('dbo.ReportDefinitions','U') IS NOT NULL DROP TABLE dbo.ReportDefinitions;
IF OBJECT_ID('dbo.ReportTemplates','U') IS NOT NULL DROP TABLE dbo.ReportTemplates;
IF OBJECT_ID('dbo.NotificationQueue','U') IS NOT NULL DROP TABLE dbo.NotificationQueue;
IF OBJECT_ID('dbo.LabQCLog','U') IS NOT NULL DROP TABLE dbo.LabQCLog;
IF OBJECT_ID('dbo.LabCriticalAlerts','U') IS NOT NULL DROP TABLE dbo.LabCriticalAlerts;

-- Drop temporal LabResults
IF OBJECT_ID('dbo.LabResults','U') IS NOT NULL BEGIN
    ALTER TABLE dbo.LabResults SET (SYSTEM_VERSIONING = OFF);
    DROP TABLE dbo.LabResults;
END
IF OBJECT_ID('dbo.LabResultsHistory','U') IS NOT NULL DROP TABLE dbo.LabResultsHistory;

IF OBJECT_ID('dbo.LabWorkItems','U') IS NOT NULL DROP TABLE dbo.LabWorkItems;
IF OBJECT_ID('dbo.LabSamples','U') IS NOT NULL DROP TABLE dbo.LabSamples;
IF OBJECT_ID('dbo.LabOrderItems','U') IS NOT NULL DROP TABLE dbo.LabOrderItems;
IF OBJECT_ID('dbo.LabOrders','U') IS NOT NULL DROP TABLE dbo.LabOrders;
IF OBJECT_ID('dbo.LabTestCatalog','U') IS NOT NULL DROP TABLE dbo.LabTestCatalog;
IF OBJECT_ID('dbo.LabInstruments','U') IS NOT NULL DROP TABLE dbo.LabInstruments;
IF OBJECT_ID('dbo.Payments','U') IS NOT NULL DROP TABLE dbo.Payments;
IF OBJECT_ID('dbo.InvoiceItems','U') IS NOT NULL DROP TABLE dbo.InvoiceItems;
IF OBJECT_ID('dbo.Invoices','U') IS NOT NULL DROP TABLE dbo.Invoices;
IF OBJECT_ID('dbo.PharmacyDispenseLog','U') IS NOT NULL DROP TABLE dbo.PharmacyDispenseLog;
IF OBJECT_ID('dbo.PrescriptionItems','U') IS NOT NULL DROP TABLE dbo.PrescriptionItems;

-- Drop temporal Prescriptions
IF OBJECT_ID('dbo.Prescriptions','U') IS NOT NULL BEGIN
    ALTER TABLE dbo.Prescriptions SET (SYSTEM_VERSIONING = OFF);
    DROP TABLE dbo.Prescriptions;
END
IF OBJECT_ID('dbo.PrescriptionsHistory','U') IS NOT NULL DROP TABLE dbo.PrescriptionsHistory;

IF OBJECT_ID('dbo.DrugFormulary','U') IS NOT NULL DROP TABLE dbo.DrugFormulary;
IF OBJECT_ID('dbo.EncounterAttachments','U') IS NOT NULL DROP TABLE dbo.EncounterAttachments;
IF OBJECT_ID('dbo.Diagnoses','U') IS NOT NULL DROP TABLE dbo.Diagnoses;
IF OBJECT_ID('dbo.DiagnosisCodes','U') IS NOT NULL DROP TABLE dbo.DiagnosisCodes;

-- Drop temporal Encounters
IF OBJECT_ID('dbo.Encounters','U') IS NOT NULL BEGIN
    ALTER TABLE dbo.Encounters SET (SYSTEM_VERSIONING = OFF);
    DROP TABLE dbo.Encounters;
END
IF OBJECT_ID('dbo.EncountersHistory','U') IS NOT NULL DROP TABLE dbo.EncountersHistory;

IF OBJECT_ID('dbo.Appointments','U') IS NOT NULL DROP TABLE dbo.Appointments;
IF OBJECT_ID('dbo.DoctorSchedules','U') IS NOT NULL DROP TABLE dbo.DoctorSchedules;
IF OBJECT_ID('dbo.Doctors','U') IS NOT NULL DROP TABLE dbo.Doctors;
IF OBJECT_ID('dbo.Staff','U') IS NOT NULL DROP TABLE dbo.Staff;
IF OBJECT_ID('dbo.Departments','U') IS NOT NULL DROP TABLE dbo.Departments;

-- Drop temporal Patients
IF OBJECT_ID('dbo.Patients','U') IS NOT NULL BEGIN
    ALTER TABLE dbo.Patients SET (SYSTEM_VERSIONING = OFF);
    DROP TABLE dbo.Patients;
END
IF OBJECT_ID('dbo.PatientsHistory','U') IS NOT NULL DROP TABLE dbo.PatientsHistory;

IF OBJECT_ID('dbo.AuditLogs','U') IS NOT NULL DROP TABLE dbo.AuditLogs;
IF OBJECT_ID('dbo.RefreshTokens','U') IS NOT NULL DROP TABLE dbo.RefreshTokens;
IF OBJECT_ID('dbo.UserRoles','U') IS NOT NULL DROP TABLE dbo.UserRoles;
IF OBJECT_ID('dbo.Users','U') IS NOT NULL DROP TABLE dbo.Users;
IF OBJECT_ID('dbo.Roles','U') IS NOT NULL DROP TABLE dbo.Roles;
IF OBJECT_ID('dbo.Tenants','U') IS NOT NULL DROP TABLE dbo.Tenants;

PRINT 'All old tables dropped.';

-- ─── 01 TENANTS ──────────────────────────────────────────────
CREATE TABLE Tenants (
    Id          TINYINT         NOT NULL IDENTITY(1,1),
    Code        VARCHAR(20)     NOT NULL,
    Name        NVARCHAR(200)   NOT NULL,
    IsActive    BIT             NOT NULL DEFAULT 1,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Tenants PRIMARY KEY (Id),
    CONSTRAINT UQ_Tenants_Code UNIQUE (Code)
);
INSERT INTO Tenants (Code, Name) VALUES ('MAIN','Main Clinic');
PRINT '01 Tenants OK';

-- ─── 02 USERS & ROLES ────────────────────────────────────────
CREATE TABLE Roles (
    Id          INT             NOT NULL IDENTITY(1,1),
    TenantId    TINYINT         NOT NULL DEFAULT 1,
    Name        NVARCHAR(100)   NOT NULL,
    NormalizedName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(300)   NULL,
    IsSystem    BIT             NOT NULL DEFAULT 0,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Roles PRIMARY KEY (Id),
    CONSTRAINT UQ_Roles_TenantName UNIQUE (TenantId, NormalizedName),
    CONSTRAINT FK_Roles_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE Users (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    Username        NVARCHAR(100)   NOT NULL,
    NormalizedUsername NVARCHAR(100) NOT NULL,
    Email           NVARCHAR(200)   NOT NULL,
    NormalizedEmail NVARCHAR(200)   NOT NULL,
    PasswordHash    NVARCHAR(MAX)   NOT NULL,
    FirstName       NVARCHAR(100)   NOT NULL,
    LastName        NVARCHAR(100)   NOT NULL,
    Phone           VARCHAR(20)     NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    IsLocked        BIT             NOT NULL DEFAULT 0,
    FailedLoginCount TINYINT        NOT NULL DEFAULT 0,
    LastLoginAt     DATETIME2       NULL,
    MustChangePassword BIT          NOT NULL DEFAULT 0,
    MfaEnabled      BIT             NOT NULL DEFAULT 0,
    MfaSecret       NVARCHAR(100)   NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_Users PRIMARY KEY (Id),
    CONSTRAINT UQ_Users_TenantUsername UNIQUE (TenantId, NormalizedUsername),
    CONSTRAINT UQ_Users_TenantEmail UNIQUE (TenantId, NormalizedEmail),
    CONSTRAINT FK_Users_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE UserRoles (
    UserId      INT NOT NULL,
    RoleId      INT NOT NULL,
    AssignedAt  DATETIME2 NOT NULL DEFAULT GETDATE(),
    AssignedBy  INT NULL,
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE
);

CREATE TABLE RefreshTokens (
    Id          BIGINT          NOT NULL IDENTITY(1,1),
    UserId      INT             NOT NULL,
    Token       NVARCHAR(500)   NOT NULL,
    ExpiresAt   DATETIME2       NOT NULL,
    RevokedAt   DATETIME2       NULL,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    CreatedByIp VARCHAR(45)     NULL,
    CONSTRAINT PK_RefreshTokens PRIMARY KEY (Id),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

-- Seed roles
INSERT INTO Roles (TenantId, Name, NormalizedName, IsSystem) VALUES
(1,'SuperAdmin','SUPERADMIN',1),(1,'Admin','ADMIN',1),(1,'Doctor','DOCTOR',1),
(1,'Nurse','NURSE',1),(1,'Receptionist','RECEPTIONIST',1),(1,'LabTechnician','LABTECHNICIAN',1),
(1,'Pharmacist','PHARMACIST',1),(1,'BillingOfficer','BILLINGOFFICER',1),(1,'PatientPortal','PATIENTPORTAL',1);

-- Seed admin user (password: Admin@123 - BCrypt hash)
INSERT INTO Users (TenantId, Username, NormalizedUsername, Email, NormalizedEmail, PasswordHash, FirstName, LastName, IsActive)
VALUES (1,'admin','ADMIN','admin@clinic.com','ADMIN@CLINIC.COM',
'$2a$11$NVUsORJHDmZcgfmHpfNLJO8sXEQh5kMtHGHOJiALb6JiwLsFAM/oK','System','Admin',1);

INSERT INTO UserRoles (UserId, RoleId) VALUES (1,1);
PRINT '02 Users & Roles OK';

-- ─── 03 PATIENTS ─────────────────────────────────────────────
CREATE TABLE Patients (
    Id                  INT             NOT NULL IDENTITY(1,1),
    TenantId            TINYINT         NOT NULL DEFAULT 1,
    MRN                 VARCHAR(20)     NOT NULL,
    UserId              INT             NULL,
    FirstName           NVARCHAR(100)   NOT NULL,
    MiddleName          NVARCHAR(100)   NULL,
    LastName            NVARCHAR(100)   NOT NULL,
    DateOfBirth         DATE            NOT NULL,
    Gender              TINYINT         NOT NULL DEFAULT 1,
    NationalId          NVARCHAR(50)    NULL,
    BloodGroup          VARCHAR(5)      NULL,
    MaritalStatus       TINYINT         NULL,
    Nationality         NVARCHAR(100)   NULL,
    PrimaryPhone        VARCHAR(20)     NOT NULL,
    SecondaryPhone      VARCHAR(20)     NULL,
    Email               NVARCHAR(200)   NULL,
    Address             NVARCHAR(500)   NULL,
    City                NVARCHAR(100)   NULL,
    Region              NVARCHAR(100)   NULL,
    Country             NVARCHAR(100)   NULL DEFAULT 'Ethiopia',
    EmergencyName       NVARCHAR(200)   NULL,
    EmergencyPhone      VARCHAR(20)     NULL,
    EmergencyRelation   NVARCHAR(50)    NULL,
    InsuranceProvider   NVARCHAR(100)   NULL,
    InsurancePolicyNo   NVARCHAR(100)   NULL,
    InsuranceExpiry     DATE            NULL,
    InsuranceCopayPercent DECIMAL(5,2)  NULL DEFAULT 0,
    Allergies           NVARCHAR(1000)  NULL,
    ChronicConditions   NVARCHAR(1000)  NULL,
    PhotoUrl            NVARCHAR(500)   NULL,
    Notes               NVARCHAR(2000)  NULL,
    IsActive            BIT             NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2       NULL,
    CreatedBy           INT             NULL,
    CONSTRAINT PK_Patients PRIMARY KEY (Id),
    CONSTRAINT UQ_Patients_TenantMRN UNIQUE (TenantId, MRN),
    CONSTRAINT FK_Patients_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Patients_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
);
CREATE INDEX IX_Patients_TenantId ON Patients (TenantId);
CREATE INDEX IX_Patients_MRN ON Patients (TenantId, MRN);
CREATE INDEX IX_Patients_Name ON Patients (TenantId, LastName, FirstName);
PRINT '03 Patients OK';

-- ─── 04 STAFF & DOCTORS ──────────────────────────────────────
CREATE TABLE Departments (
    Id          INT             NOT NULL IDENTITY(1,1),
    TenantId    TINYINT         NOT NULL DEFAULT 1,
    Name        NVARCHAR(100)   NOT NULL,
    Code        VARCHAR(20)     NULL,
    HeadDoctorId INT            NULL,
    IsActive    BIT             NOT NULL DEFAULT 1,
    CONSTRAINT PK_Departments PRIMARY KEY (Id),
    CONSTRAINT FK_Departments_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE Staff (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    UserId          INT             NOT NULL,
    StaffNo         VARCHAR(20)     NOT NULL,
    JobTitle        NVARCHAR(100)   NULL,
    DepartmentId    INT             NULL,
    Phone           VARCHAR(20)     NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    JoinDate        DATE            NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Staff PRIMARY KEY (Id),
    CONSTRAINT FK_Staff_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_Staff_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Staff_Departments FOREIGN KEY (DepartmentId) REFERENCES Departments(Id)
);

CREATE TABLE Doctors (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    StaffId         INT             NOT NULL,
    UserId          INT             NOT NULL,
    Specialty       NVARCHAR(100)   NULL,
    LicenseNumber   VARCHAR(50)     NULL,
    Qualifications  NVARCHAR(300)   NULL,
    ConsultationFee DECIMAL(10,2)   NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Doctors PRIMARY KEY (Id),
    CONSTRAINT FK_Doctors_Staff FOREIGN KEY (StaffId) REFERENCES Staff(Id),
    CONSTRAINT FK_Doctors_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_Doctors_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE DoctorSchedules (
    Id          INT         NOT NULL IDENTITY(1,1),
    DoctorId    INT         NOT NULL,
    DayOfWeek   TINYINT     NOT NULL,
    StartTime   TIME        NOT NULL,
    EndTime     TIME        NOT NULL,
    SlotMinutes SMALLINT    NOT NULL DEFAULT 15,
    IsActive    BIT         NOT NULL DEFAULT 1,
    CONSTRAINT PK_DoctorSchedules PRIMARY KEY (Id),
    CONSTRAINT FK_DoctorSchedules_Doctors FOREIGN KEY (DoctorId) REFERENCES Doctors(Id) ON DELETE CASCADE
);

-- Seed department & doctor
INSERT INTO Departments (TenantId, Name, Code) VALUES (1,'General Practice','GP'),(1,'Pediatrics','PED'),(1,'Laboratory','LAB'),(1,'Pharmacy','PHA');

-- Doctor user
INSERT INTO Users (TenantId, Username, NormalizedUsername, Email, NormalizedEmail, PasswordHash, FirstName, LastName)
VALUES (1,'dr.abebe','DR.ABEBE','dr.abebe@clinic.com','DR.ABEBE@CLINIC.COM',
'$2a$11$NVUsORJHDmZcgfmHpfNLJO8sXEQh5kMtHGHOJiALb6JiwLsFAM/oK','Abebe','Bekele');
INSERT INTO UserRoles (UserId, RoleId) VALUES (2,3);
INSERT INTO Staff (TenantId, UserId, StaffNo, JobTitle, DepartmentId) VALUES (1,2,'STF-001','General Practitioner',1);
INSERT INTO Doctors (TenantId, StaffId, UserId, Specialty, LicenseNumber, ConsultationFee) VALUES (1,1,2,'General Practice','ETH-MED-2019-4421',300.00);

PRINT '04 Staff & Doctors OK';

-- ─── 05 APPOINTMENTS ─────────────────────────────────────────
CREATE TABLE Appointments (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    PatientId       INT             NOT NULL,
    DoctorId        INT             NOT NULL,
    AppointmentDate DATE            NOT NULL,
    StartTime       TIME            NOT NULL,
    EndTime         TIME            NOT NULL,
    Type            TINYINT         NOT NULL DEFAULT 1,  -- 1=NewPatient 2=FollowUp 3=Procedure 4=Emergency
    StatusId        TINYINT         NOT NULL DEFAULT 1,  -- 1=Scheduled 2=Confirmed 3=CheckedIn 4=InConsult 5=Completed 6=Cancelled 7=NoShow
    ChiefComplaint  NVARCHAR(500)   NULL,
    Notes           NVARCHAR(500)   NULL,
    RoomId          INT             NULL,
    CreatedBy       INT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_Appointments PRIMARY KEY (Id),
    CONSTRAINT FK_Appointments_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Appointments_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_Appointments_Doctors FOREIGN KEY (DoctorId) REFERENCES Doctors(Id)
);
CREATE INDEX IX_Appointments_Date ON Appointments (DoctorId, AppointmentDate);
CREATE INDEX IX_Appointments_Patient ON Appointments (PatientId, AppointmentDate DESC);
PRINT '05 Appointments OK';

-- ─── 06 ENCOUNTERS & DIAGNOSES ───────────────────────────────
CREATE TABLE Encounters (
    Id                  INT             NOT NULL IDENTITY(1,1),
    TenantId            TINYINT         NOT NULL DEFAULT 1,
    AppointmentId       INT             NULL,
    PatientId           INT             NOT NULL,
    DoctorId            INT             NOT NULL,
    EncounterDate       DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    EncounterTime       TIME            NOT NULL DEFAULT CAST(GETDATE() AS TIME),
    ChiefComplaint      NVARCHAR(500)   NULL,
    HistoryOfIllness    NVARCHAR(2000)  NULL,
    PhysicalExam        NVARCHAR(2000)  NULL,
    Assessment          NVARCHAR(2000)  NULL,
    SoapPlan            NVARCHAR(2000)  NULL,
    VitalSigns          NVARCHAR(1000)  NULL,
    IsFinalized         BIT             NOT NULL DEFAULT 0,
    FinalizedAt         DATETIME2       NULL,
    CreatedAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2       NULL,
    CreatedBy           INT             NOT NULL DEFAULT 1,
    CONSTRAINT PK_Encounters PRIMARY KEY (Id),
    CONSTRAINT FK_Encounters_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Encounters_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_Encounters_Doctors FOREIGN KEY (DoctorId) REFERENCES Doctors(Id),
    CONSTRAINT FK_Encounters_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(Id)
);

CREATE TABLE DiagnosisCodes (
    Code        VARCHAR(10)     NOT NULL,
    Description NVARCHAR(300)   NOT NULL,
    Category    NVARCHAR(100)   NULL,
    CONSTRAINT PK_DiagnosisCodes PRIMARY KEY (Code)
);

CREATE TABLE Diagnoses (
    Id              INT             NOT NULL IDENTITY(1,1),
    EncounterId     INT             NOT NULL,
    DiagnosisCode   VARCHAR(10)     NOT NULL,
    DiagnosisText   NVARCHAR(300)   NOT NULL,
    DiagnosisType   TINYINT         NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Diagnoses PRIMARY KEY (Id),
    CONSTRAINT FK_Diagnoses_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id)
);

CREATE TABLE EncounterAttachments (
    Id              INT             NOT NULL IDENTITY(1,1),
    EncounterId     INT             NOT NULL,
    FileName        NVARCHAR(300)   NOT NULL,
    FilePath        NVARCHAR(500)   NOT NULL,
    FileType        VARCHAR(50)     NULL,
    FileSizeBytes   BIGINT          NULL,
    UploadedBy      INT             NOT NULL DEFAULT 1,
    UploadedAt      DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_EncounterAttachments PRIMARY KEY (Id),
    CONSTRAINT FK_EncounterAttachments_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id)
);

CREATE INDEX IX_Encounters_PatientId ON Encounters (PatientId, EncounterDate DESC);
CREATE INDEX IX_Encounters_DoctorId  ON Encounters (DoctorId, EncounterDate DESC);
-- Seed ICD-10 codes
INSERT INTO DiagnosisCodes (Code, Description, Category) VALUES
('I10','Essential (primary) hypertension','Circulatory'),('J06.9','Acute upper respiratory infection','Respiratory'),
('E11','Type 2 diabetes mellitus','Endocrine'),('J18.9','Pneumonia, unspecified','Respiratory'),
('K21.0','Gastro-oesophageal reflux disease with oesophagitis','Digestive'),
('A09','Other and unspecified gastroenteritis','Digestive'),('Z00.0','General adult medical examination','Preventive'),
('B34.9','Viral infection, unspecified','Infectious'),('M54.5','Low back pain','Musculoskeletal'),
('R50.9','Fever, unspecified','Symptoms');
PRINT '06 Encounters & Diagnoses OK';

-- ─── 07 PRESCRIPTIONS & PHARMACY ─────────────────────────────
CREATE TABLE DrugFormulary (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    DrugCode        VARCHAR(20)     NULL,
    GenericName     NVARCHAR(200)   NOT NULL,
    BrandName       NVARCHAR(200)   NULL,
    DrugClass       NVARCHAR(100)   NULL,
    DosageForm      NVARCHAR(50)    NULL,
    Strength        NVARCHAR(50)    NULL,
    Unit            NVARCHAR(30)    NULL,
    CurrentStock    INT             NOT NULL DEFAULT 0,
    MinStockLevel   INT             NOT NULL DEFAULT 10,
    CostPrice       DECIMAL(10,2)   NOT NULL DEFAULT 0,
    SellingPrice    DECIMAL(10,2)   NOT NULL DEFAULT 0,
    BatchNumber     VARCHAR(50)     NULL,
    ExpiryDate      DATE            NULL,
    IsControlled    BIT             NOT NULL DEFAULT 0,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_DrugFormulary PRIMARY KEY (Id),
    CONSTRAINT FK_DrugFormulary_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE Prescriptions (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    EncounterId     INT             NOT NULL,
    PatientId       INT             NOT NULL,
    DoctorId        INT             NOT NULL,
    PrescribedAt    DATETIME2       NOT NULL DEFAULT GETDATE(),
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    Notes           NVARCHAR(500)   NULL,
    CONSTRAINT PK_Prescriptions PRIMARY KEY (Id),
    CONSTRAINT FK_Prescriptions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Prescriptions_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id),
    CONSTRAINT FK_Prescriptions_Patients  FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_Prescriptions_Doctors   FOREIGN KEY (DoctorId) REFERENCES Doctors(Id)
);

CREATE TABLE PrescriptionItems (
    Id              INT             NOT NULL IDENTITY(1,1),
    PrescriptionId  INT             NOT NULL,
    DrugId          INT             NOT NULL,
    Dosage          NVARCHAR(100)   NOT NULL,
    Frequency       NVARCHAR(100)   NOT NULL,
    Route           NVARCHAR(50)    NULL,
    Duration        NVARCHAR(50)    NULL,
    Quantity        SMALLINT        NOT NULL DEFAULT 1,
    Instructions    NVARCHAR(300)   NULL,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    CONSTRAINT PK_PrescriptionItems PRIMARY KEY (Id),
    CONSTRAINT FK_PrescriptionItems_Prescriptions FOREIGN KEY (PrescriptionId) REFERENCES Prescriptions(Id),
    CONSTRAINT FK_PrescriptionItems_Drug FOREIGN KEY (DrugId) REFERENCES DrugFormulary(Id)
);

CREATE TABLE PharmacyDispenseLog (
    Id              INT             NOT NULL IDENTITY(1,1),
    PrescriptionId  INT             NOT NULL,
    ItemId          INT             NOT NULL,
    DrugId          INT             NOT NULL,
    QuantityGiven   SMALLINT        NOT NULL,
    DispensedBy     INT             NOT NULL DEFAULT 1,
    DispensedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
    BatchNumber     VARCHAR(50)     NULL,
    ExpiryDate      DATE            NULL,
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_PharmacyDispenseLog PRIMARY KEY (Id),
    CONSTRAINT FK_PharmacyDispense_Prescription FOREIGN KEY (PrescriptionId) REFERENCES Prescriptions(Id),
    CONSTRAINT FK_PharmacyDispense_Drug FOREIGN KEY (DrugId) REFERENCES DrugFormulary(Id)
);

CREATE TABLE PharmacyRestockLogs (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    DrugId          INT             NOT NULL,
    BatchNumber     VARCHAR(50)     NULL,
    QuantityAdded   INT             NOT NULL,
    UnitCostPrice   DECIMAL(10,2)   NOT NULL DEFAULT 0,
    UnitSellingPrice DECIMAL(10,2)  NOT NULL DEFAULT 0,
    ExpiryDate      DATE            NULL,
    SupplierName    NVARCHAR(200)   NULL,
    RestockedBy     INT             NOT NULL DEFAULT 1,
    RestockedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_PharmacyRestockLogs PRIMARY KEY (Id),
    CONSTRAINT FK_PharmacyRestock_Drug FOREIGN KEY (DrugId) REFERENCES DrugFormulary(Id)
);

-- Seed essential drugs
INSERT INTO DrugFormulary (TenantId, DrugCode, GenericName, BrandName, DrugClass, DosageForm, Strength, Unit, CurrentStock, MinStockLevel, CostPrice, SellingPrice, BatchNumber, ExpiryDate)
VALUES
(1,'AMOX500','Amoxicillin','Amoxil','Antibiotic','Capsule','500mg','Capsule',200,20,8.50,15.00,'BATCH-2025-001','2027-06-30'),
(1,'PARA500','Paracetamol','Panadol','Analgesic','Tablet','500mg','Tablet',500,50,2.00,5.00,'BATCH-2025-002','2027-12-31'),
(1,'METF500','Metformin','Glucophage','Antidiabetic','Tablet','500mg','Tablet',150,30,10.00,18.00,'BATCH-2025-003','2027-03-31'),
(1,'AMLO5','Amlodipine','Norvasc','Antihypertensive','Tablet','5mg','Tablet',120,20,12.00,22.00,'BATCH-2025-004','2028-01-31'),
(1,'ORS','ORS Sachet','Electral','Electrolyte','Sachet','21g','Sachet',300,50,3.00,7.00,'BATCH-2025-005','2026-12-31'),
(1,'IBUP400','Ibuprofen','Brufen','NSAID','Tablet','400mg','Tablet',250,30,5.00,10.00,'BATCH-2025-006','2027-09-30'),
(1,'OMEP20','Omeprazole','Losec','PPI','Capsule','20mg','Capsule',180,25,9.00,16.00,'BATCH-2025-007','2027-08-31'),
(1,'CETR10','Cetirizine','Zyrtec','Antihistamine','Tablet','10mg','Tablet',200,30,4.00,9.00,'BATCH-2025-008','2028-03-31'),
(1,'AZIT500','Azithromycin','Zithromax','Antibiotic','Tablet','500mg','Tablet',100,15,25.00,45.00,'BATCH-2025-009','2027-05-31'),
(1,'MORPH10','Morphine','Morphine Sulphate','Opioid Analgesic','Injection','10mg/ml','Ampule',30,5,80.00,120.00,'BATCH-2025-010','2027-01-31',1);

UPDATE DrugFormulary SET IsControlled=1 WHERE DrugCode='MORPH10';

PRINT '07 Prescriptions & Pharmacy OK';

-- ─── 08 BILLING ──────────────────────────────────────────────
CREATE TABLE Invoices (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    InvoiceNo       VARCHAR(30)     NOT NULL,
    PatientId       INT             NOT NULL,
    EncounterId     INT             NULL,
    IssueDate       DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    DueDate         DATE            NULL,
    SubTotal        DECIMAL(12,2)   NOT NULL DEFAULT 0,
    TaxAmount       DECIMAL(12,2)   NOT NULL DEFAULT 0,
    DiscountAmount  DECIMAL(12,2)   NOT NULL DEFAULT 0,
    TotalAmount     DECIMAL(12,2)   NOT NULL DEFAULT 0,
    PaidAmount      DECIMAL(12,2)   NOT NULL DEFAULT 0,
    StatusId        TINYINT         NOT NULL DEFAULT 1,  -- 1=Draft 2=Issued 3=PartialPaid 4=Paid 5=Void
    Notes           NVARCHAR(500)   NULL,
    CreatedBy       INT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_Invoices PRIMARY KEY (Id),
    CONSTRAINT UQ_Invoices_No UNIQUE (TenantId, InvoiceNo),
    CONSTRAINT FK_Invoices_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Invoices_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_Invoices_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id)
);

CREATE TABLE InvoiceItems (
    Id          INT             NOT NULL IDENTITY(1,1),
    InvoiceId   INT             NOT NULL,
    ItemType    TINYINT         NOT NULL DEFAULT 1,  -- 1=Consultation 2=Drug 3=Lab 4=Procedure 5=Other
    ReferenceId INT             NULL,
    Description NVARCHAR(300)   NOT NULL,
    Quantity    INT             NOT NULL DEFAULT 1,
    UnitPrice   DECIMAL(10,2)   NOT NULL,
    Discount    DECIMAL(10,2)   NOT NULL DEFAULT 0,
    TotalPrice  DECIMAL(10,2)   NOT NULL,
    CONSTRAINT PK_InvoiceItems PRIMARY KEY (Id),
    CONSTRAINT FK_InvoiceItems_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id) ON DELETE CASCADE
);

CREATE TABLE Payments (
    Id              INT             NOT NULL IDENTITY(1,1),
    InvoiceId       INT             NOT NULL,
    Amount          DECIMAL(12,2)   NOT NULL,
    PaymentMethod   TINYINT         NOT NULL DEFAULT 1,  -- 1=Cash 2=Card 3=Insurance 4=Mobile
    TransactionRef  NVARCHAR(100)   NULL,
    ProcessedBy     INT             NOT NULL DEFAULT 1,
    ProcessedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_Payments PRIMARY KEY (Id),
    CONSTRAINT FK_Payments_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id)
);
CREATE INDEX IX_Invoices_Patient ON Invoices (PatientId, IssueDate DESC);
PRINT '08 Billing OK';

-- ─── 09 LABORATORY ───────────────────────────────────────────
CREATE TABLE LabInstruments (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    Name            NVARCHAR(100)   NOT NULL,
    Model           NVARCHAR(100)   NULL,
    SerialNumber    VARCHAR(50)     NULL,
    Protocol        VARCHAR(10)     NOT NULL DEFAULT 'HL7',
    IpAddress       VARCHAR(45)     NULL,
    Port            INT             NULL,
    Category        NVARCHAR(50)    NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_LabInstruments PRIMARY KEY (Id),
    CONSTRAINT FK_LabInstruments_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE LabTestCatalog (
    Id                  INT             NOT NULL IDENTITY(1,1),
    TenantId            TINYINT         NOT NULL DEFAULT 1,
    TestCode            VARCHAR(20)     NOT NULL,
    TestName            NVARCHAR(200)   NOT NULL,
    Category            NVARCHAR(100)   NULL,
    Method              NVARCHAR(100)   NULL,
    SampleType          NVARCHAR(50)    NULL,
    SampleVolume        VARCHAR(30)     NULL,
    TurnaroundMinutes   INT             NOT NULL DEFAULT 60,
    NormalRangeLow      DECIMAL(12,4)   NULL,
    NormalRangeHigh     DECIMAL(12,4)   NULL,
    CriticalLow         DECIMAL(12,4)   NULL,
    CriticalHigh        DECIMAL(12,4)   NULL,
    Unit                VARCHAR(30)     NULL,
    ResultType          TINYINT         NOT NULL DEFAULT 1,
    Price               DECIMAL(10,2)   NULL,
    ParentTestId        INT             NULL,
    InstrumentId        INT             NULL,
    IsActive            BIT             NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_LabTestCatalog PRIMARY KEY (Id),
    CONSTRAINT UQ_LabTestCatalog_Code UNIQUE (TenantId, TestCode),
    CONSTRAINT FK_LabTestCatalog_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE LabOrders (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    OrderNumber     VARCHAR(30)     NOT NULL,
    PatientId       INT             NOT NULL,
    EncounterId     INT             NULL,
    OrderedBy       INT             NOT NULL,
    Priority        TINYINT         NOT NULL DEFAULT 2,
    OrderedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    ClinicalInfo    NVARCHAR(500)   NULL,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_LabOrders PRIMARY KEY (Id),
    CONSTRAINT UQ_LabOrders_Number UNIQUE (TenantId, OrderNumber),
    CONSTRAINT FK_LabOrders_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_LabOrders_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_LabOrders_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id),
    CONSTRAINT FK_LabOrders_Doctors FOREIGN KEY (OrderedBy) REFERENCES Doctors(Id)
);

CREATE TABLE LabOrderItems (
    Id          INT         NOT NULL IDENTITY(1,1),
    OrderId     INT         NOT NULL,
    TestId      INT         NOT NULL,
    StatusId    TINYINT     NOT NULL DEFAULT 1,
    CONSTRAINT PK_LabOrderItems PRIMARY KEY (Id),
    CONSTRAINT FK_LabOrderItems_Orders FOREIGN KEY (OrderId) REFERENCES LabOrders(Id) ON DELETE CASCADE,
    CONSTRAINT FK_LabOrderItems_Tests FOREIGN KEY (TestId) REFERENCES LabTestCatalog(Id)
);

CREATE TABLE LabSamples (
    Id              INT             NOT NULL IDENTITY(1,1),
    OrderId         INT             NOT NULL,
    Barcode         VARCHAR(50)     NOT NULL,
    SampleType      NVARCHAR(50)    NOT NULL,
    Volume          VARCHAR(20)     NULL,
    CollectedBy     INT             NOT NULL DEFAULT 1,
    CollectedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
    ReceivedAt      DATETIME2       NULL,
    Condition       NVARCHAR(100)   NULL,
    RejectionReason NVARCHAR(200)   NULL,
    IsRejected      BIT             NOT NULL DEFAULT 0,
    CustodyStatus   NVARCHAR(50)    NULL DEFAULT 'Collected',
    CONSTRAINT PK_LabSamples PRIMARY KEY (Id),
    CONSTRAINT UQ_LabSamples_Barcode UNIQUE (Barcode),
    CONSTRAINT FK_LabSamples_Orders FOREIGN KEY (OrderId) REFERENCES LabOrders(Id)
);

CREATE TABLE LabWorkItems (
    Id              INT             NOT NULL IDENTITY(1,1),
    OrderItemId     INT             NOT NULL,
    AssignedTo      INT             NULL,
    InstrumentId    INT             NULL,
    StartedAt       DATETIME2       NULL,
    CompletedAt     DATETIME2       NULL,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_LabWorkItems PRIMARY KEY (Id),
    CONSTRAINT FK_LabWorkItems_OrderItems FOREIGN KEY (OrderItemId) REFERENCES LabOrderItems(Id)
);

CREATE TABLE LabResults (
    Id              INT             NOT NULL IDENTITY(1,1),
    OrderItemId     INT             NOT NULL,
    OrderId         INT             NOT NULL,
    TestId          INT             NOT NULL,
    PatientId       INT             NOT NULL,
    NumericValue    DECIMAL(12,4)   NULL,
    TextValue       NVARCHAR(500)   NULL,
    Unit            VARCHAR(30)     NULL,
    Flag            VARCHAR(5)      NULL,
    ReferenceRange  NVARCHAR(100)   NULL,
    IsCritical      BIT             NOT NULL DEFAULT 0,
    EnteredBy       INT             NOT NULL DEFAULT 1,
    EnteredAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    VerifiedBy      INT             NULL,
    VerifiedAt      DATETIME2       NULL,
    IsVerified      BIT             NOT NULL DEFAULT 0,
    SourceType      TINYINT         NOT NULL DEFAULT 1,
    RawMessage      NVARCHAR(MAX)   NULL,
    CONSTRAINT PK_LabResults PRIMARY KEY (Id),
    CONSTRAINT FK_LabResults_OrderItems FOREIGN KEY (OrderItemId) REFERENCES LabOrderItems(Id),
    CONSTRAINT FK_LabResults_Tests FOREIGN KEY (TestId) REFERENCES LabTestCatalog(Id)
);

CREATE TABLE LabCriticalAlerts (
    Id              INT             NOT NULL IDENTITY(1,1),
    ResultId        INT             NOT NULL,
    OrderId         INT             NOT NULL,
    PatientId       INT             NOT NULL,
    DoctorId        INT             NOT NULL,
    AlertValue      NVARCHAR(100)   NOT NULL,
    AlertFlag       VARCHAR(5)      NOT NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    NotifiedAt      DATETIME2       NULL,
    AcknowledgedBy  INT             NULL,
    AcknowledgedAt  DATETIME2       NULL,
    IsAcknowledged  BIT             NOT NULL DEFAULT 0,
    NotifyCount     TINYINT         NOT NULL DEFAULT 0,
    CONSTRAINT PK_LabCriticalAlerts PRIMARY KEY (Id),
    CONSTRAINT FK_LabCriticalAlerts_Results FOREIGN KEY (ResultId) REFERENCES LabResults(Id)
);

CREATE TABLE LabTestParameters (
    Id              INT             NOT NULL IDENTITY(1,1),
    TestId          INT             NOT NULL,
    ParameterCode   VARCHAR(20)     NOT NULL,
    ParameterName   NVARCHAR(100)   NOT NULL,
    Unit            VARCHAR(30)     NULL,
    NormalRangeLow  DECIMAL(12,4)   NULL,
    NormalRangeHigh DECIMAL(12,4)   NULL,
    CriticalLow     DECIMAL(12,4)   NULL,
    CriticalHigh    DECIMAL(12,4)   NULL,
    SortOrder       INT             NOT NULL DEFAULT 0,
    CONSTRAINT PK_LabTestParameters PRIMARY KEY (Id),
    CONSTRAINT FK_LabTestParameters_Test FOREIGN KEY (TestId) REFERENCES LabTestCatalog(Id) ON DELETE CASCADE
);

CREATE TABLE LabQCLog (
    Id              INT             NOT NULL IDENTITY(1,1),
    InstrumentId    INT             NOT NULL,
    TestId          INT             NOT NULL,
    QCLevel         VARCHAR(20)     NULL,
    LotNumber       VARCHAR(50)     NULL,
    ExpiryDate      DATE            NULL,
    NumericValue    DECIMAL(12,4)   NULL,
    ExpectedLow     DECIMAL(12,4)   NULL,
    ExpectedHigh    DECIMAL(12,4)   NULL,
    IsPassed        BIT             NOT NULL DEFAULT 1,
    RunBy           INT             NOT NULL DEFAULT 1,
    RunAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_LabQCLog PRIMARY KEY (Id),
    CONSTRAINT FK_LabQCLog_Instruments FOREIGN KEY (InstrumentId) REFERENCES LabInstruments(Id),
    CONSTRAINT FK_LabQCLog_Tests FOREIGN KEY (TestId) REFERENCES LabTestCatalog(Id)
);

-- Seed Lab Test Catalog
INSERT INTO LabTestCatalog (TenantId, TestCode, TestName, Category, SampleType, TurnaroundMinutes, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, ResultType, Price) VALUES
(1,'CBC','Complete Blood Count','Hematology','EDTA Blood',60,NULL,NULL,NULL,NULL,NULL,1,150),
(1,'LFT','Liver Function Tests','Biochemistry','Serum',120,NULL,NULL,NULL,NULL,NULL,1,350),
(1,'RFT','Renal Function Tests','Biochemistry','Serum',120,NULL,NULL,NULL,NULL,NULL,1,300),
(1,'FBS','Fasting Blood Sugar','Biochemistry','Plasma',30,'mmol/L',3.9,6.1,2.5,25.0,1,80),
(1,'HBA1C','Glycated Haemoglobin','Biochemistry','EDTA Blood',60,'%',4.0,5.6,NULL,NULL,1,250),
(1,'LIPID','Lipid Profile','Biochemistry','Serum',120,NULL,NULL,NULL,NULL,NULL,1,400),
(1,'UA','Urinalysis','Urinalysis','Urine',30,NULL,NULL,NULL,NULL,NULL,2,60),
(1,'ECG','Electrocardiogram','Cardiology','N/A',20,NULL,NULL,NULL,NULL,NULL,2,200),
(1,'MALARIA','Malaria RDT','Serology','Whole Blood',20,NULL,NULL,NULL,NULL,NULL,3,120),
(1,'PREG','Pregnancy Test (urine)','Serology','Urine',15,NULL,NULL,NULL,NULL,NULL,3,50);

-- CBC Sub-parameters
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'WBC','White Blood Cells','10^9/L',4.0,11.0,2.0,30.0,1 FROM LabTestCatalog WHERE TestCode='CBC';
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'RBC','Red Blood Cells','10^12/L',4.2,5.8,2.0,7.0,2 FROM LabTestCatalog WHERE TestCode='CBC';
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'HGB','Haemoglobin','g/dL',12.0,17.5,6.0,20.0,3 FROM LabTestCatalog WHERE TestCode='CBC';
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'HCT','Haematocrit','%',36.0,52.0,18.0,60.0,4 FROM LabTestCatalog WHERE TestCode='CBC';
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'PLT','Platelets','10^9/L',150.0,400.0,50.0,1000.0,5 FROM LabTestCatalog WHERE TestCode='CBC';
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'NEUT','Neutrophils','%',50.0,70.0,NULL,NULL,6 FROM LabTestCatalog WHERE TestCode='CBC';
-- LFT Sub-parameters
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'ALT','Alanine Aminotransferase','U/L',7.0,56.0,NULL,500.0,1 FROM LabTestCatalog WHERE TestCode='LFT';
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'AST','Aspartate Aminotransferase','U/L',10.0,40.0,NULL,500.0,2 FROM LabTestCatalog WHERE TestCode='LFT';
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'ALP','Alkaline Phosphatase','U/L',44.0,147.0,NULL,NULL,3 FROM LabTestCatalog WHERE TestCode='LFT';
INSERT INTO LabTestParameters (TestId, ParameterCode, ParameterName, Unit, NormalRangeLow, NormalRangeHigh, CriticalLow, CriticalHigh, SortOrder)
SELECT Id, 'TBIL','Total Bilirubin','mg/dL',0.2,1.2,NULL,15.0,4 FROM LabTestCatalog WHERE TestCode='LFT';

CREATE INDEX IX_LabOrders_PatientId ON LabOrders (PatientId, OrderedAt DESC);
CREATE INDEX IX_LabResults_OrderItemId ON LabResults (OrderItemId);
PRINT '09 Laboratory OK';

-- ─── 10 NOTIFICATIONS ────────────────────────────────────────
CREATE TABLE NotificationQueue (
    Id              BIGINT          NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    RecipientUserId INT             NULL,
    RecipientEmail  NVARCHAR(200)   NULL,
    RecipientPhone  VARCHAR(20)     NULL,
    Channel         TINYINT         NOT NULL DEFAULT 1,
    Subject         NVARCHAR(300)   NOT NULL,
    Body            NVARCHAR(MAX)   NOT NULL,
    Priority        TINYINT         NOT NULL DEFAULT 2,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    AttemptCount    TINYINT         NOT NULL DEFAULT 0,
    LastAttemptAt   DATETIME2       NULL,
    SentAt          DATETIME2       NULL,
    ErrorMessage    NVARCHAR(500)   NULL,
    NotificationType NVARCHAR(50)   NULL,
    RefType         NVARCHAR(50)    NULL,
    RefId           BIGINT          NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_NotificationQueue PRIMARY KEY (Id),
    CONSTRAINT FK_NotifQueue_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
PRINT '10 Notifications OK';

-- ─── 11 REPORT BUILDER ───────────────────────────────────────
CREATE TABLE ReportTemplates (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    Name            NVARCHAR(200)   NOT NULL,
    Description     NVARCHAR(500)   NULL,
    OwnerId         INT             NOT NULL DEFAULT 1,
    IsPublic        BIT             NOT NULL DEFAULT 0,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_ReportTemplates PRIMARY KEY (Id),
    CONSTRAINT FK_ReportTemplates_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_ReportTemplates_Users FOREIGN KEY (OwnerId) REFERENCES Users(Id)
);

CREATE TABLE ReportDefinitions (
    Id              INT             NOT NULL IDENTITY(1,1),
    TemplateId      INT             NOT NULL,
    DataSource      NVARCHAR(100)   NOT NULL,
    ColumnsJson     NVARCHAR(MAX)   NOT NULL,
    FiltersJson     NVARCHAR(MAX)   NULL,
    GroupByJson     NVARCHAR(MAX)   NULL,
    SortByJson      NVARCHAR(MAX)   NULL,
    DateRangeField  NVARCHAR(100)   NULL,
    DateRangePreset NVARCHAR(50)    NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_ReportDefinitions PRIMARY KEY (Id),
    CONSTRAINT UQ_ReportDefinitions_Template UNIQUE (TemplateId),
    CONSTRAINT FK_ReportDefinitions_Templates FOREIGN KEY (TemplateId) REFERENCES ReportTemplates(Id) ON DELETE CASCADE
);

CREATE TABLE ReportSchedules (
    Id              INT             NOT NULL IDENTITY(1,1),
    TemplateId      INT             NOT NULL,
    CronExpression  VARCHAR(50)     NOT NULL,
    Format          TINYINT         NOT NULL DEFAULT 1,
    Recipients      NVARCHAR(MAX)   NOT NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    LastRunAt       DATETIME2       NULL,
    NextRunAt       DATETIME2       NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ReportSchedules PRIMARY KEY (Id),
    CONSTRAINT FK_ReportSchedules_Templates FOREIGN KEY (TemplateId) REFERENCES ReportTemplates(Id) ON DELETE CASCADE
);

CREATE TABLE ReportShares (
    Id          INT         NOT NULL IDENTITY(1,1),
    TemplateId  INT         NOT NULL,
    ShareType   TINYINT     NOT NULL,
    ShareRefId  INT         NOT NULL,
    CreatedAt   DATETIME2   NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ReportShares PRIMARY KEY (Id),
    CONSTRAINT FK_ReportShares_Templates FOREIGN KEY (TemplateId) REFERENCES ReportTemplates(Id) ON DELETE CASCADE
);

CREATE TABLE ReportExecutionLog (
    Id              BIGINT          NOT NULL IDENTITY(1,1),
    TemplateId      INT             NOT NULL,
    ExecutedBy      INT             NOT NULL DEFAULT 1,
    ExecutedAt      DATETIME2       NOT NULL DEFAULT GETDATE(),
    DurationMs      INT             NULL,
    RowsReturned    INT             NULL,
    Format          TINYINT         NULL,
    IsScheduled     BIT             NOT NULL DEFAULT 0,
    ErrorMessage    NVARCHAR(500)   NULL,
    CONSTRAINT PK_ReportExecutionLog PRIMARY KEY (Id),
    CONSTRAINT FK_ReportExLog_Templates FOREIGN KEY (TemplateId) REFERENCES ReportTemplates(Id)
);
PRINT '11 Report Builder OK';

-- ─── 12 AUDIT LOG ────────────────────────────────────────────
CREATE TABLE AuditLogs (
    Id          BIGINT          NOT NULL IDENTITY(1,1),
    TenantId    TINYINT         NOT NULL DEFAULT 1,
    UserId      INT             NULL,
    Action      NVARCHAR(100)   NOT NULL,
    EntityType  NVARCHAR(100)   NULL,
    EntityId    NVARCHAR(50)    NULL,
    OldValues   NVARCHAR(MAX)   NULL,
    NewValues   NVARCHAR(MAX)   NULL,
    IpAddress   VARCHAR(45)     NULL,
    UserAgent   NVARCHAR(300)   NULL,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_AuditLogs PRIMARY KEY (Id)
);
PRINT '12 Audit OK';

-- ─── 13 QUEUE MANAGEMENT ─────────────────────────────────────
CREATE TABLE QueueCounters (
    Id          INT             NOT NULL IDENTITY(1,1),
    TenantId    TINYINT         NOT NULL DEFAULT 1,
    CounterDate DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    Prefix      VARCHAR(5)      NOT NULL DEFAULT 'A',
    LastNumber  INT             NOT NULL DEFAULT 0,
    CONSTRAINT PK_QueueCounters PRIMARY KEY (Id),
    CONSTRAINT UQ_QueueCounters UNIQUE (TenantId, CounterDate, Prefix)
);

CREATE TABLE PatientQueues (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    TicketNo        VARCHAR(10)     NOT NULL,
    PatientId       INT             NOT NULL,
    ServiceType     NVARCHAR(100)   NOT NULL DEFAULT 'General',
    Priority        TINYINT         NOT NULL DEFAULT 2,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    CalledAt        DATETIME2       NULL,
    CalledToStation NVARCHAR(50)    NULL,
    ServedAt        DATETIME2       NULL,
    ServedBy        INT             NULL,
    WaitMinutes     INT             NULL,
    QueueDate       DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_PatientQueues PRIMARY KEY (Id),
    CONSTRAINT FK_PatientQueues_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_PatientQueues_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id)
);

CREATE TABLE PatientQueueHistory (
    Id          INT         NOT NULL IDENTITY(1,1),
    QueueId     INT         NOT NULL,
    StatusId    TINYINT     NOT NULL,
    ChangedAt   DATETIME2   NOT NULL DEFAULT GETDATE(),
    ChangedBy   INT         NULL,
    Notes       NVARCHAR(200) NULL,
    CONSTRAINT PK_PatientQueueHistory PRIMARY KEY (Id),
    CONSTRAINT FK_QueueHistory_Queue FOREIGN KEY (QueueId) REFERENCES PatientQueues(Id) ON DELETE CASCADE
);
PRINT '13 Queue Management OK';

-- ─── 14 MODULE MANAGEMENT ────────────────────────────────────
CREATE TABLE SystemModules (
    Id          INT             NOT NULL IDENTITY(1,1),
    Code        VARCHAR(30)     NOT NULL,
    Name        NVARCHAR(100)   NOT NULL,
    Category    NVARCHAR(50)    NULL,
    IsCore      BIT             NOT NULL DEFAULT 0,
    Description NVARCHAR(500)   NULL,
    CONSTRAINT PK_SystemModules PRIMARY KEY (Id),
    CONSTRAINT UQ_SystemModules_Code UNIQUE (Code)
);

CREATE TABLE ModuleInstances (
    Id          INT             NOT NULL IDENTITY(1,1),
    TenantId    TINYINT         NOT NULL DEFAULT 1,
    ModuleId    INT             NOT NULL,
    IsEnabled   BIT             NOT NULL DEFAULT 1,
    EnabledAt   DATETIME2       NULL,
    DisabledAt  DATETIME2       NULL,
    Config      NVARCHAR(MAX)   NULL,
    CONSTRAINT PK_ModuleInstances PRIMARY KEY (Id),
    CONSTRAINT UQ_ModuleInstances UNIQUE (TenantId, ModuleId),
    CONSTRAINT FK_ModuleInstances_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_ModuleInstances_Modules FOREIGN KEY (ModuleId) REFERENCES SystemModules(Id)
);

INSERT INTO SystemModules (Code, Name, Category, IsCore) VALUES
('PATIENTS','Patient Management','Clinical',1),('EMR','Electronic Medical Records','Clinical',1),
('APPOINTMENTS','Appointments','Clinical',1),('LABORATORY','Laboratory','Clinical',0),
('PHARMACY','Pharmacy','Clinical',0),('BILLING','Billing','Financial',0),
('QUEUE','Queue Management','Operational',0),('REPORTS','Reports','Analytics',0),
('REPORT_BUILDER','Report Builder','Analytics',0),('USER_MGMT','User Management','Administrative',1),
('PORTAL','Patient Portal','Patient-Facing',0),('API_MGMT','API Management','Administrative',0),
('INTEGRATIONS','3rd Party Integrations','Administrative',0),('SETTINGS','Settings','Administrative',1),
('MODULES','Module Management','Administrative',1);

INSERT INTO ModuleInstances (TenantId, ModuleId, IsEnabled, EnabledAt)
SELECT 1, Id, 1, GETDATE() FROM SystemModules;
PRINT '14 Modules OK';

-- ─── 15 API MANAGEMENT ───────────────────────────────────────
CREATE TABLE ApiKeys (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    Name            NVARCHAR(200)   NOT NULL,
    KeyPrefix       VARCHAR(20)     NOT NULL,
    KeyHash         NVARCHAR(300)   NOT NULL,
    Scopes          NVARCHAR(500)   NULL,
    RateLimit       INT             NOT NULL DEFAULT 60,
    IsActive        BIT             NOT NULL DEFAULT 1,
    ExpiresAt       DATE            NULL,
    LastUsedAt      DATETIME2       NULL,
    CreatedBy       INT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ApiKeys PRIMARY KEY (Id),
    CONSTRAINT FK_ApiKeys_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE WebhookSubscriptions (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    Name            NVARCHAR(200)   NOT NULL,
    TargetUrl       NVARCHAR(500)   NOT NULL,
    EventTypes      NVARCHAR(500)   NOT NULL,
    SecretHash      NVARCHAR(300)   NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    LastTriggeredAt DATETIME2       NULL,
    FailureCount    INT             NOT NULL DEFAULT 0,
    CreatedBy       INT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_WebhookSubscriptions PRIMARY KEY (Id),
    CONSTRAINT FK_WebhookSubs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
PRINT '15 API Management OK';

-- ─── 16 SETTINGS ─────────────────────────────────────────────
CREATE TABLE ClinicSettings (
    Id          INT             NOT NULL IDENTITY(1,1),
    TenantId    TINYINT         NOT NULL DEFAULT 1,
    Category    NVARCHAR(50)    NOT NULL,
    SettingKey  NVARCHAR(100)   NOT NULL,
    SettingValue NVARCHAR(MAX)  NOT NULL,
    DataType    VARCHAR(20)     NOT NULL DEFAULT 'string',
    Description NVARCHAR(300)   NULL,
    IsPublic    BIT             NOT NULL DEFAULT 0,
    UpdatedBy   INT             NULL,
    UpdatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ClinicSettings PRIMARY KEY (Id),
    CONSTRAINT UQ_ClinicSettings UNIQUE (TenantId, Category, SettingKey),
    CONSTRAINT FK_ClinicSettings_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

INSERT INTO ClinicSettings (TenantId, Category, SettingKey, SettingValue, DataType, IsPublic) VALUES
(1,'General','ClinicName','General Health Clinic','string',1),
(1,'General','ClinicPhone','+251911000000','string',1),
(1,'General','ClinicEmail','info@clinic.com','string',1),
(1,'General','ClinicAddress','Addis Ababa, Ethiopia','string',1),
(1,'General','Currency','ETB','string',1),
(1,'General','TimezoneId','Africa/Addis_Ababa','string',0),
(1,'Billing','TaxRate','0','decimal',0),
(1,'Billing','InvoicePrefix','INV','string',0),
(1,'Lab','CriticalAlertEmail','lab@clinic.com','string',0),
(1,'Queue','DefaultPrefix','A','string',0);
PRINT '16 Settings OK';

-- ─── 17 INTEGRATIONS ─────────────────────────────────────────
CREATE TABLE IntegrationConfigs (
    Id          INT             NOT NULL IDENTITY(1,1),
    TenantId    TINYINT         NOT NULL DEFAULT 1,
    Code        VARCHAR(30)     NOT NULL,
    Name        NVARCHAR(200)   NOT NULL,
    IntegrationType NVARCHAR(50) NOT NULL,
    ConfigJson  NVARCHAR(MAX)   NULL,
    IsActive    BIT             NOT NULL DEFAULT 0,
    LastTestedAt DATETIME2      NULL,
    StatusMessage NVARCHAR(300) NULL,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt   DATETIME2       NULL,
    CONSTRAINT PK_IntegrationConfigs PRIMARY KEY (Id),
    CONSTRAINT UQ_IntegrationConfigs UNIQUE (TenantId, Code),
    CONSTRAINT FK_IntegrationConfigs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

INSERT INTO IntegrationConfigs (TenantId, Code, Name, IntegrationType, IsActive) VALUES
(1,'AFRICASTALKING','Africa''s Talking SMS','SMS',0),
(1,'SMSC_LOCAL','Local SMSC Gateway','SMS',0),
(1,'OPENAI','OpenAI Clinical Assistant','AI',0),
(1,'MPESA','M-Pesa Mobile Money','Payment',0),
(1,'TELEBIRR','TeleBirr Mobile Money','Payment',0);
PRINT '17 Integrations OK';

-- ─── 18 SOAP, CERTIFICATES, PROCEDURES ───────────────────────
CREATE TABLE MedicalCertificates (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    CertificateNo   VARCHAR(30)     NOT NULL,
    PatientId       INT             NOT NULL,
    DoctorId        INT             NOT NULL,
    EncounterId     INT             NULL,
    CertificateType VARCHAR(50)     NOT NULL DEFAULT 'SickLeave',
    DiagnosisSummary NVARCHAR(500)  NOT NULL,
    Recommendation  NVARCHAR(1000)  NOT NULL,
    StartDate       DATE            NOT NULL,
    EndDate         DATE            NOT NULL,
    DaysExcused     INT             NOT NULL DEFAULT 1,
    QrVerificationCode VARCHAR(64)  NOT NULL,
    IsIssued        BIT             NOT NULL DEFAULT 1,
    IssuedAt        DATETIME2       NOT NULL DEFAULT GETDATE(),
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_MedicalCertificates PRIMARY KEY (Id),
    CONSTRAINT UQ_MedicalCertificates_No UNIQUE (CertificateNo),
    CONSTRAINT FK_MedCert_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_MedCert_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_MedCert_Doctors FOREIGN KEY (DoctorId) REFERENCES Doctors(Id)
);

CREATE TABLE ProcedureOrders (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    EncounterId     INT             NOT NULL,
    PatientId       INT             NOT NULL,
    OrderedBy       INT             NOT NULL,
    ProcedureCode   VARCHAR(50)     NOT NULL,
    ProcedureName   NVARCHAR(200)   NOT NULL,
    ClinicalNotes   NVARCHAR(500)   NULL,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    PerformedBy     INT             NULL,
    PerformedAt     DATETIME2       NULL,
    ProcedureResult NVARCHAR(MAX)   NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ProcedureOrders PRIMARY KEY (Id),
    CONSTRAINT FK_ProcOrders_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_ProcOrders_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id),
    CONSTRAINT FK_ProcOrders_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id)
);

CREATE TABLE PatientMedicalHistories (
    Id              INT             NOT NULL IDENTITY(1,1),
    PatientId       INT             NOT NULL,
    HistoryType     VARCHAR(50)     NOT NULL,
    Description     NVARCHAR(500)   NOT NULL,
    OnsetDate       NVARCHAR(50)    NULL,
    Status          VARCHAR(50)     NOT NULL DEFAULT 'Active',
    Notes           NVARCHAR(500)   NULL,
    RecordedBy      INT             NULL,
    RecordedAt      DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_PatientMedicalHistories PRIMARY KEY (Id),
    CONSTRAINT FK_PatientHistories_Patient FOREIGN KEY (PatientId) REFERENCES Patients(Id) ON DELETE CASCADE
);
PRINT '18 SOAP & Certificates OK';

-- ─── 21 ENTERPRISE UPGRADES ───────────────────────────────────
CREATE TABLE CdssDrugInteractions (
    Id              INT             NOT NULL IDENTITY(1,1),
    DrugACode       VARCHAR(20)     NOT NULL,
    DrugAName       NVARCHAR(200)   NOT NULL,
    DrugBCode       VARCHAR(20)     NOT NULL,
    DrugBName       NVARCHAR(200)   NOT NULL,
    Severity        VARCHAR(20)     NOT NULL DEFAULT 'Moderate',
    Description     NVARCHAR(1000)  NOT NULL,
    Recommendation  NVARCHAR(500)   NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CONSTRAINT PK_CdssDrugInteractions PRIMARY KEY (Id)
);

CREATE TABLE PatientProblemLists (
    Id              INT             NOT NULL IDENTITY(1,1),
    PatientId       INT             NOT NULL,
    ProblemCode     VARCHAR(20)     NOT NULL,
    ProblemName     NVARCHAR(300)   NOT NULL,
    Severity        VARCHAR(20)     NULL,
    OnsetDate       DATE            NULL,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    Notes           NVARCHAR(500)   NULL,
    CreatedBy       INT             NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_PatientProblemLists PRIMARY KEY (Id),
    CONSTRAINT FK_ProblemList_Patient FOREIGN KEY (PatientId) REFERENCES Patients(Id) ON DELETE CASCADE
);

CREATE TABLE ConsultationRooms (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    RoomCode        VARCHAR(20)     NOT NULL,
    RoomName        NVARCHAR(100)   NOT NULL,
    RoomType        NVARCHAR(50)    NULL,
    Floor           NVARCHAR(20)    NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CONSTRAINT PK_ConsultationRooms PRIMARY KEY (Id),
    CONSTRAINT UQ_ConsultationRooms UNIQUE (TenantId, RoomCode),
    CONSTRAINT FK_ConsultationRooms_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

CREATE TABLE LabChainOfCustody (
    Id          INT         NOT NULL IDENTITY(1,1),
    SampleId    INT         NOT NULL,
    Status      NVARCHAR(50) NOT NULL,
    Location    NVARCHAR(100) NULL,
    HandledBy   INT         NOT NULL DEFAULT 1,
    HandledAt   DATETIME2   NOT NULL DEFAULT GETDATE(),
    Notes       NVARCHAR(200) NULL,
    CONSTRAINT PK_LabChainOfCustody PRIMARY KEY (Id),
    CONSTRAINT FK_LabCoC_Sample FOREIGN KEY (SampleId) REFERENCES LabSamples(Id) ON DELETE CASCADE
);

CREATE TABLE NarcoticsDispenseLogs (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    LogRef          VARCHAR(30)     NOT NULL,
    DrugId          INT             NOT NULL,
    PrescriptionId  INT             NOT NULL,
    PatientId       INT             NOT NULL,
    QuantityDispensed DECIMAL(10,3) NOT NULL,
    DispensedBy     INT             NOT NULL DEFAULT 1,
    DispensedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
    WitnessedBy     INT             NULL,
    BalanceAfter    DECIMAL(10,3)   NOT NULL DEFAULT 0,
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_NarcoticsDispenseLogs PRIMARY KEY (Id),
    CONSTRAINT UQ_NarcoticsLogs_Ref UNIQUE (TenantId, LogRef)
);

-- Seed rooms & drug interactions
INSERT INTO ConsultationRooms (TenantId, RoomCode, RoomName, RoomType, Floor)
VALUES (1,'R101','Room 101 - General','General','Ground'),(1,'R102','Room 102 - Pediatrics','Pediatrics','Ground'),
(1,'R201','Room 201 - Cardiology','Specialist','First'),(1,'LAB1','Lab Reception','Laboratory','Ground');

INSERT INTO CdssDrugInteractions (DrugACode, DrugAName, DrugBCode, DrugBName, Severity, Description, Recommendation) VALUES
('AMLO5','Amlodipine','SIMV','Simvastatin','Major','Amlodipine inhibits CYP3A4, significantly increasing simvastatin plasma concentration and rhabdomyolysis risk.','Limit simvastatin to 20mg/day or switch to pravastatin.'),
('METF500','Metformin','ALCOHOL','Alcohol','Moderate','Increased lactic acidosis risk with alcohol.','Advise patient to avoid alcohol during metformin therapy.'),
('IBUP400','Ibuprofen','AMLO5','Amlodipine','Moderate','NSAIDs may reduce antihypertensive effect.','Monitor BP closely. Use paracetamol as alternative.');

PRINT '21 Enterprise Upgrades OK';

PRINT '=== ALL MIGRATIONS COMPLETE ===';

-- Final table count
SELECT COUNT(*) AS TotalTables FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE';
