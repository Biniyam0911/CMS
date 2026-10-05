-- ============================================================
-- dbOHMS to ClinicDB MIGRATION SCRIPT (WITH FULL PROGRESS LOGGING)
-- Source Database: dbOHMS
-- Target Database: ClinicDB
-- ============================================================
-- FEATURES:
--   1. Real-time progress printing: prints [SourceTable] -> [TargetTable]
--   2. Shows Total Source Records and Processed Counts for each step
--   3. Step-by-step progress tracking (Step X of 12)
--   4. DateOfBirth reverse-calculated from [age] in tblPatient
--   5. Unique incremental emails: cms0x@cms.com
--   6. Enclosed keywords in square brackets ([Plan], [RowCount], etc.)
--   7. Final table-by-table reconciliation report
-- ============================================================

USE ClinicDB;
GO

SET NOCOUNT ON;
PRINT '======================================================================';
PRINT '===            CMS DATABASE MIGRATION STARTING                     ===';
PRINT '===       Source: [dbOHMS]  -->  Target: [ClinicDB]                ===';
PRINT '======================================================================';
RAISERROR('Starting full migration from dbOHMS to ClinicDB...', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- PRE-MIGRATION DDL: Create tables if missing, add columns if
-- table exists but column is absent.
-- All statements are idempotent / safe to re-run.
-- ============================================================
PRINT '----------------------------------------------------------------------';
PRINT 'PRE-MIGRATION DDL: Ensuring all ClinicDB tables & columns exist...';
RAISERROR('PRE-MIGRATION DDL: Checking schema...', 0, 1) WITH NOWAIT;

-- ─── TENANTS ─────────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Tenants','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Tenants] (
        [Id]        TINYINT         NOT NULL IDENTITY(1,1),
        [Code]      VARCHAR(20)     NOT NULL,
        [Name]      NVARCHAR(200)   NOT NULL,
        [IsActive]  BIT             NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_Tenants PRIMARY KEY ([Id]),
        CONSTRAINT UQ_Tenants_Code UNIQUE ([Code])
    );
    EXEC('INSERT INTO ClinicDB.dbo.[Tenants] ([Code],[Name]) VALUES (''MAIN'',''Main Clinic'')');
    PRINT '--> Created Tenants.';
END

-- ─── ROLES ───────────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Roles','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Roles] (
        [Id]          SMALLINT        NOT NULL IDENTITY(1,1),
        [Name]        NVARCHAR(50)    NOT NULL,
        [Description] NVARCHAR(200)   NULL,
        CONSTRAINT PK_Roles PRIMARY KEY ([Id]),
        CONSTRAINT UQ_Roles_Name UNIQUE ([Name])
    );
    EXEC('INSERT INTO ClinicDB.dbo.[Roles] ([Name],[Description]) VALUES
        (''SuperAdmin'',    ''Full system access''),
        (''Admin'',         ''Clinic administration''),
        (''Doctor'',        ''Physician / Medical doctor''),
        (''Nurse'',         ''Nursing staff''),
        (''Receptionist'',  ''Front desk / appointment booking''),
        (''LabTechnician'', ''Laboratory technician''),
        (''Pathologist'',   ''Lab result verification''),
        (''Pharmacist'',    ''Pharmacy / dispensing''),
        (''Patient'',       ''Self-service patient portal'')');
    PRINT '--> Created Roles.';
END

-- ─── USERS ───────────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Users','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Users] (
        [Id]                  INT             NOT NULL IDENTITY(1,1),
        [TenantId]            TINYINT         NOT NULL DEFAULT 1,
        [Username]            NVARCHAR(100)   NOT NULL,
        [Email]               NVARCHAR(200)   NOT NULL,
        [PasswordHash]        NVARCHAR(500)   NOT NULL,
        [Salt]                NVARCHAR(100)   NOT NULL,
        [FirstName]           NVARCHAR(100)   NOT NULL,
        [LastName]            NVARCHAR(100)   NOT NULL,
        [Phone]               VARCHAR(20)     NULL,
        [IsActive]            BIT             NOT NULL DEFAULT 1,
        [IsLocked]            BIT             NOT NULL DEFAULT 0,
        [FailedLoginAttempts] TINYINT         NOT NULL DEFAULT 0,
        [LockoutEnd]          DATETIME2       NULL,
        [MfaEnabled]          BIT             NOT NULL DEFAULT 0,
        [MfaSecret]           NVARCHAR(200)   NULL,
        [LastLoginAt]         DATETIME2       NULL,
        [CreatedAt]           DATETIME2       NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]           DATETIME2       NULL,
        CONSTRAINT PK_Users PRIMARY KEY ([Id]),
        CONSTRAINT UQ_Users_Username UNIQUE ([TenantId],[Username]),
        CONSTRAINT UQ_Users_Email UNIQUE ([TenantId],[Email]),
        CONSTRAINT FK_Users_Tenants FOREIGN KEY ([TenantId]) REFERENCES ClinicDB.dbo.[Tenants]([Id])
    );
    PRINT '--> Created Users.';
END
ELSE
BEGIN
    IF COL_LENGTH('ClinicDB.dbo.Users','Salt') IS NULL
        ALTER TABLE ClinicDB.dbo.[Users] ADD [Salt] NVARCHAR(100) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Users','FailedLoginAttempts') IS NULL
        ALTER TABLE ClinicDB.dbo.[Users] ADD [FailedLoginAttempts] TINYINT NOT NULL DEFAULT 0;
    IF COL_LENGTH('ClinicDB.dbo.Users','MfaEnabled') IS NULL
        ALTER TABLE ClinicDB.dbo.[Users] ADD [MfaEnabled] BIT NOT NULL DEFAULT 0;
    IF COL_LENGTH('ClinicDB.dbo.Users','MfaSecret') IS NULL
        ALTER TABLE ClinicDB.dbo.[Users] ADD [MfaSecret] NVARCHAR(200) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Users','LockoutEnd') IS NULL
        ALTER TABLE ClinicDB.dbo.[Users] ADD [LockoutEnd] DATETIME2 NULL;
END

-- ─── USER ROLES ──────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.UserRoles','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[UserRoles] (
        [UserId]     INT         NOT NULL,
        [RoleId]     SMALLINT    NOT NULL,
        [AssignedAt] DATETIME2   NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_UserRoles PRIMARY KEY ([UserId],[RoleId]),
        CONSTRAINT FK_UserRoles_Users FOREIGN KEY ([UserId]) REFERENCES ClinicDB.dbo.[Users]([Id]) ON DELETE CASCADE,
        CONSTRAINT FK_UserRoles_Roles FOREIGN KEY ([RoleId]) REFERENCES ClinicDB.dbo.[Roles]([Id])
    );
    PRINT '--> Created UserRoles.';
END

-- ─── REFRESH TOKENS ──────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.RefreshTokens','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[RefreshTokens] (
        [Id]          BIGINT        NOT NULL IDENTITY(1,1),
        [UserId]      INT           NOT NULL,
        [Token]       NVARCHAR(500) NOT NULL,
        [ExpiresAt]   DATETIME2     NOT NULL,
        [IsRevoked]   BIT           NOT NULL DEFAULT 0,
        [CreatedAt]   DATETIME2     NOT NULL DEFAULT GETDATE(),
        [RevokedAt]   DATETIME2     NULL,
        CONSTRAINT PK_RefreshTokens PRIMARY KEY ([Id]),
        CONSTRAINT UQ_RefreshTokens_Token UNIQUE ([Token]),
        CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY ([UserId]) REFERENCES ClinicDB.dbo.[Users]([Id]) ON DELETE CASCADE
    );
    PRINT '--> Created RefreshTokens.';
END

-- ─── SPECIALIZATIONS ─────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Specializations','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Specializations] (
        [Id]       SMALLINT      NOT NULL IDENTITY(1,1),
        [Name]     NVARCHAR(100) NOT NULL,
        [Code]     VARCHAR(20)   NULL
    );
    EXEC('INSERT INTO ClinicDB.dbo.[Specializations] ([Name],[Code]) VALUES (''General Practice'',''GEN''),(''Pediatrics'',''PED''),(''Surgery'',''SUR'')');
    PRINT '--> Created Specializations.';
END

-- ─── DEPARTMENTS ─────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Departments','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Departments] (
        [Id]          INT           NOT NULL IDENTITY(1,1),
        [TenantId]    TINYINT       NOT NULL DEFAULT 1,
        [Name]        NVARCHAR(100) NOT NULL,
        [Code]        VARCHAR(20)   NULL,
        [HeadDoctorId] INT          NULL,
        [IsActive]    BIT           NOT NULL DEFAULT 1,
        CONSTRAINT PK_Departments PRIMARY KEY ([Id]),
        CONSTRAINT FK_Departments_Tenants FOREIGN KEY ([TenantId]) REFERENCES ClinicDB.dbo.[Tenants]([Id])
    );
    EXEC('INSERT INTO ClinicDB.dbo.[Departments]([TenantId],[Name],[Code]) VALUES (1,''General Practice'',''GP''),(1,''Laboratory'',''LAB''),(1,''Pharmacy'',''PHA'')');
    PRINT '--> Created Departments.';
END

-- ─── STAFF ───────────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Staff','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Staff] (
        [Id]            INT           NOT NULL IDENTITY(1,1),
        [TenantId]      TINYINT       NOT NULL DEFAULT 1,
        [UserId]        INT           NOT NULL,
        [StaffCode]     VARCHAR(30)   NOT NULL,
        [Title]         NVARCHAR(20)  NULL,
        [FirstName]     NVARCHAR(100) NOT NULL,
        [LastName]      NVARCHAR(100) NOT NULL,
        [Phone]         VARCHAR(20)   NULL,
        [Email]         NVARCHAR(200) NULL,
        [PrimaryRoleId] INT           NULL,
        [Department]    NVARCHAR(100) NULL,
        [JoinDate]      DATE          NULL,
        [IsActive]      BIT           NOT NULL DEFAULT 1,
        [CreatedAt]     DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_Staff PRIMARY KEY ([Id]),
        CONSTRAINT UQ_Staff_Code UNIQUE ([TenantId],[StaffCode]),
        CONSTRAINT FK_Staff_Users   FOREIGN KEY ([UserId])   REFERENCES ClinicDB.dbo.[Users]([Id]),
        CONSTRAINT FK_Staff_Tenants FOREIGN KEY ([TenantId]) REFERENCES ClinicDB.dbo.[Tenants]([Id])
    );
    PRINT '--> Created Staff.';
END
ELSE
BEGIN
    IF COL_LENGTH('ClinicDB.dbo.Staff','StaffCode') IS NULL
        ALTER TABLE ClinicDB.dbo.[Staff] ADD [StaffCode] VARCHAR(30) NOT NULL DEFAULT '';
    IF COL_LENGTH('ClinicDB.dbo.Staff','Title') IS NULL
        ALTER TABLE ClinicDB.dbo.[Staff] ADD [Title] NVARCHAR(20) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Staff','Department') IS NULL
        ALTER TABLE ClinicDB.dbo.[Staff] ADD [Department] NVARCHAR(100) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Staff','FirstName') IS NULL
        ALTER TABLE ClinicDB.dbo.[Staff] ADD [FirstName] NVARCHAR(100) NOT NULL DEFAULT '';
    IF COL_LENGTH('ClinicDB.dbo.Staff','LastName') IS NULL
        ALTER TABLE ClinicDB.dbo.[Staff] ADD [LastName] NVARCHAR(100) NOT NULL DEFAULT '';
END

-- ─── DOCTORS ─────────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Doctors','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Doctors] (
        [Id]             INT           NOT NULL IDENTITY(1,1),
        [StaffId]        INT           NOT NULL,
        [LicenseNumber]  VARCHAR(50)   NULL,
        [SpecializationId] SMALLINT    NULL,
        [ConsultationFee] DECIMAL(10,2) NULL,
        [IsAvailable]    BIT           NOT NULL DEFAULT 1,
        [IsActive]       BIT           NOT NULL DEFAULT 1,
        [CreatedAt]      DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_Doctors PRIMARY KEY ([Id]),
        CONSTRAINT FK_Doctors_Staff FOREIGN KEY ([StaffId]) REFERENCES ClinicDB.dbo.[Staff]([Id])
    );
    PRINT '--> Created Doctors.';
END
ELSE
BEGIN
    IF COL_LENGTH('ClinicDB.dbo.Doctors','SpecializationId') IS NULL
        ALTER TABLE ClinicDB.dbo.[Doctors] ADD [SpecializationId] SMALLINT NULL;
    IF COL_LENGTH('ClinicDB.dbo.Doctors','IsAvailable') IS NULL
        ALTER TABLE ClinicDB.dbo.[Doctors] ADD [IsAvailable] BIT NOT NULL DEFAULT 1;
    IF COL_LENGTH('ClinicDB.dbo.Doctors','ConsultationFee') IS NULL
        ALTER TABLE ClinicDB.dbo.[Doctors] ADD [ConsultationFee] DECIMAL(10,2) NULL;
END

-- ─── PATIENTS ────────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Patients','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Patients] (
        [Id]                    INT           NOT NULL IDENTITY(1,1),
        [TenantId]              TINYINT       NOT NULL DEFAULT 1,
        [MRN]                   VARCHAR(20)   NOT NULL,
        [UserId]                INT           NULL,
        [FirstName]             NVARCHAR(100) NOT NULL,
        [MiddleName]            NVARCHAR(100) NULL,
        [LastName]              NVARCHAR(100) NOT NULL,
        [DateOfBirth]           DATE          NOT NULL DEFAULT '1900-01-01',
        [Gender]                TINYINT       NOT NULL DEFAULT 1,
        [NationalId]            NVARCHAR(50)  NULL,
        [BloodGroup]            VARCHAR(5)    NULL,
        [MaritalStatus]         TINYINT       NULL,
        [Nationality]           NVARCHAR(100) NULL,
        [PrimaryPhone]          VARCHAR(20)   NOT NULL DEFAULT '0000000000',
        [SecondaryPhone]        VARCHAR(20)   NULL,
        [Email]                 NVARCHAR(200) NULL,
        [Address]               NVARCHAR(500) NULL,
        [City]                  NVARCHAR(100) NULL,
        [Region]                NVARCHAR(100) NULL,
        [Country]               NVARCHAR(100) NULL DEFAULT 'Ethiopia',
        [EmergencyName]         NVARCHAR(200) NULL,
        [EmergencyPhone]        VARCHAR(20)   NULL,
        [EmergencyRelation]     NVARCHAR(50)  NULL,
        [InsuranceProvider]     NVARCHAR(100) NULL,
        [InsurancePolicyNo]     NVARCHAR(100) NULL,
        [InsuranceExpiry]       DATE          NULL,
        [InsuranceCopayPercent] DECIMAL(5,2)  NULL DEFAULT 0,
        [Allergies]             NVARCHAR(1000) NULL,
        [ChronicConditions]     NVARCHAR(1000) NULL,
        [PhotoUrl]              NVARCHAR(500) NULL,
        [Notes]                 NVARCHAR(2000) NULL,
        [IsActive]              BIT           NOT NULL DEFAULT 1,
        [CreatedAt]             DATETIME2     NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]             DATETIME2     NULL,
        [CreatedBy]             INT           NULL,
        CONSTRAINT PK_Patients PRIMARY KEY ([Id]),
        CONSTRAINT UQ_Patients_TenantMRN UNIQUE ([TenantId],[MRN]),
        CONSTRAINT FK_Patients_Tenants FOREIGN KEY ([TenantId]) REFERENCES ClinicDB.dbo.[Tenants]([Id])
    );
    CREATE INDEX IX_Patients_TenantId ON ClinicDB.dbo.[Patients] ([TenantId]);
    CREATE INDEX IX_Patients_MRN      ON ClinicDB.dbo.[Patients] ([TenantId],[MRN]);
    CREATE INDEX IX_Patients_Name     ON ClinicDB.dbo.[Patients] ([TenantId],[LastName],[FirstName]);
    PRINT '--> Created Patients.';
END
ELSE
BEGIN
    IF COL_LENGTH('ClinicDB.dbo.Patients','MiddleName') IS NULL
        ALTER TABLE ClinicDB.dbo.[Patients] ADD [MiddleName] NVARCHAR(100) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Patients','BloodGroup') IS NULL
        ALTER TABLE ClinicDB.dbo.[Patients] ADD [BloodGroup] VARCHAR(5) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Patients','MaritalStatus') IS NULL
        ALTER TABLE ClinicDB.dbo.[Patients] ADD [MaritalStatus] TINYINT NULL;
    IF COL_LENGTH('ClinicDB.dbo.Patients','InsuranceProvider') IS NULL
        ALTER TABLE ClinicDB.dbo.[Patients] ADD [InsuranceProvider] NVARCHAR(100) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Patients','InsurancePolicyNo') IS NULL
        ALTER TABLE ClinicDB.dbo.[Patients] ADD [InsurancePolicyNo] NVARCHAR(100) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Patients','InsuranceCopayPercent') IS NULL
        ALTER TABLE ClinicDB.dbo.[Patients] ADD [InsuranceCopayPercent] DECIMAL(5,2) NULL DEFAULT 0;
    IF COL_LENGTH('ClinicDB.dbo.Patients','ChronicConditions') IS NULL
        ALTER TABLE ClinicDB.dbo.[Patients] ADD [ChronicConditions] NVARCHAR(1000) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Patients','PhotoUrl') IS NULL
        ALTER TABLE ClinicDB.dbo.[Patients] ADD [PhotoUrl] NVARCHAR(500) NULL;
END

-- ─── APPOINTMENTS ─────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Appointments','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Appointments] (
        [Id]              INT           NOT NULL IDENTITY(1,1),
        [TenantId]        TINYINT       NOT NULL DEFAULT 1,
        [PatientId]       INT           NOT NULL,
        [DoctorId]        INT           NOT NULL,
        [SlotDateTime]    DATETIME2     NOT NULL,
        [DurationMinutes] TINYINT       NOT NULL DEFAULT 15,
        [StatusId]        TINYINT       NOT NULL DEFAULT 1,
        [ReasonForVisit]  NVARCHAR(500) NULL,
        [Notes]           NVARCHAR(500) NULL,
        [BookedBy]        INT           NOT NULL DEFAULT 1,
        [BookedAt]        DATETIME2     NOT NULL DEFAULT GETDATE(),
        [ReminderSent]    BIT           NOT NULL DEFAULT 0,
        [CancelledAt]     DATETIME2     NULL,
        [CancelReason]    NVARCHAR(500) NULL,
        [CreatedAt]       DATETIME2     NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]       DATETIME2     NULL,
        CONSTRAINT PK_Appointments PRIMARY KEY ([Id]),
        CONSTRAINT FK_Appointments_Tenants  FOREIGN KEY ([TenantId])  REFERENCES ClinicDB.dbo.[Tenants]([Id]),
        CONSTRAINT FK_Appointments_Patients FOREIGN KEY ([PatientId]) REFERENCES ClinicDB.dbo.[Patients]([Id]),
        CONSTRAINT FK_Appointments_Doctors  FOREIGN KEY ([DoctorId])  REFERENCES ClinicDB.dbo.[Doctors]([Id])
    );
    CREATE INDEX IX_Appointments_Slot    ON ClinicDB.dbo.[Appointments] ([DoctorId],[SlotDateTime]);
    CREATE INDEX IX_Appointments_Patient ON ClinicDB.dbo.[Appointments] ([PatientId],[SlotDateTime] DESC);
    PRINT '--> Created Appointments.';
END

-- ─── ENCOUNTERS ───────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Encounters','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Encounters] (
        [Id]               INT           NOT NULL IDENTITY(1,1),
        [TenantId]         TINYINT       NOT NULL DEFAULT 1,
        [AppointmentId]    INT           NULL,
        [PatientId]        INT           NOT NULL,
        [DoctorId]         INT           NOT NULL,
        [EncounterDate]    DATE          NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        [EncounterTime]    TIME          NOT NULL DEFAULT CAST(GETDATE() AS TIME),
        [ChiefComplaint]   NVARCHAR(500) NULL,
        [HistoryOfIllness] NVARCHAR(2000) NULL,
        [PhysicalExam]     NVARCHAR(2000) NULL,
        [Assessment]       NVARCHAR(2000) NULL,
        [Plan]             NVARCHAR(2000) NULL,
        [VitalSigns]       NVARCHAR(1000) NULL,
        [IsFinalized]      BIT           NOT NULL DEFAULT 0,
        [FinalizedAt]      DATETIME2     NULL,
        [CreatedAt]        DATETIME2     NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]        DATETIME2     NULL,
        [CreatedBy]        INT           NOT NULL DEFAULT 1,
        CONSTRAINT PK_Encounters PRIMARY KEY ([Id]),
        CONSTRAINT FK_Encounters_Tenants      FOREIGN KEY ([TenantId])      REFERENCES ClinicDB.dbo.[Tenants]([Id]),
        CONSTRAINT FK_Encounters_Patients     FOREIGN KEY ([PatientId])     REFERENCES ClinicDB.dbo.[Patients]([Id]),
        CONSTRAINT FK_Encounters_Doctors      FOREIGN KEY ([DoctorId])      REFERENCES ClinicDB.dbo.[Doctors]([Id]),
        CONSTRAINT FK_Encounters_Appointments FOREIGN KEY ([AppointmentId]) REFERENCES ClinicDB.dbo.[Appointments]([Id])
    );
    CREATE INDEX IX_Encounters_PatientId ON ClinicDB.dbo.[Encounters] ([PatientId],[EncounterDate] DESC);
    CREATE INDEX IX_Encounters_DoctorId  ON ClinicDB.dbo.[Encounters] ([DoctorId],[EncounterDate] DESC);
    PRINT '--> Created Encounters.';
END
ELSE
BEGIN
    IF COL_LENGTH('ClinicDB.dbo.Encounters','HistoryOfIllness') IS NULL
        ALTER TABLE ClinicDB.dbo.[Encounters] ADD [HistoryOfIllness] NVARCHAR(2000) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Encounters','Plan') IS NULL
        ALTER TABLE ClinicDB.dbo.[Encounters] ADD [Plan] NVARCHAR(2000) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Encounters','VitalSigns') IS NULL
        ALTER TABLE ClinicDB.dbo.[Encounters] ADD [VitalSigns] NVARCHAR(1000) NULL;
    IF COL_LENGTH('ClinicDB.dbo.Encounters','FinalizedAt') IS NULL
        ALTER TABLE ClinicDB.dbo.[Encounters] ADD [FinalizedAt] DATETIME2 NULL;
END

-- ─── DIAGNOSES ────────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Diagnoses','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Diagnoses] (
        [Id]            INT          NOT NULL IDENTITY(1,1),
        [EncounterId]   INT          NOT NULL,
        [DiagnosisCode] VARCHAR(10)  NOT NULL DEFAULT 'Z00.0',
        [DiagnosisText] NVARCHAR(300) NOT NULL,
        [DiagnosisType] TINYINT      NOT NULL DEFAULT 1,
        [CreatedAt]     DATETIME2    NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_Diagnoses PRIMARY KEY ([Id]),
        CONSTRAINT FK_Diagnoses_Encounters FOREIGN KEY ([EncounterId]) REFERENCES ClinicDB.dbo.[Encounters]([Id])
    );
    PRINT '--> Created Diagnoses.';
END

-- ─── DRUG FORMULARY ───────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.DrugFormulary','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[DrugFormulary] (
        [Id]            INT           NOT NULL IDENTITY(1,1),
        [TenantId]      TINYINT       NOT NULL DEFAULT 1,
        [DrugCode]      VARCHAR(20)   NULL,
        [GenericName]   NVARCHAR(200) NOT NULL,
        [BrandName]     NVARCHAR(200) NULL,
        [DrugClass]     NVARCHAR(100) NULL,
        [DosageForm]    NVARCHAR(50)  NULL,
        [Strength]      NVARCHAR(50)  NULL,
        [Unit]          NVARCHAR(30)  NULL,
        [CurrentStock]  INT           NOT NULL DEFAULT 0,
        [MinStockLevel] INT           NOT NULL DEFAULT 10,
        [CostPrice]     DECIMAL(10,2) NOT NULL DEFAULT 0,
        [SellingPrice]  DECIMAL(10,2) NOT NULL DEFAULT 0,
        [BatchNumber]   VARCHAR(50)   NULL,
        [ExpiryDate]    DATE          NULL,
        [IsControlled]  BIT           NOT NULL DEFAULT 0,
        [IsActive]      BIT           NOT NULL DEFAULT 1,
        [CreatedAt]     DATETIME2     NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]     DATETIME2     NULL,
        CONSTRAINT PK_DrugFormulary PRIMARY KEY ([Id]),
        CONSTRAINT FK_DrugFormulary_Tenants FOREIGN KEY ([TenantId]) REFERENCES ClinicDB.dbo.[Tenants]([Id])
    );
    PRINT '--> Created DrugFormulary.';
END

-- ─── PRESCRIPTIONS ────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Prescriptions','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Prescriptions] (
        [Id]          INT       NOT NULL IDENTITY(1,1),
        [TenantId]    TINYINT   NOT NULL DEFAULT 1,
        [EncounterId] INT       NOT NULL,
        [PatientId]   INT       NOT NULL,
        [DoctorId]    INT       NOT NULL,
        [PrescribedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [StatusId]    TINYINT   NOT NULL DEFAULT 1,
        [Notes]       NVARCHAR(500) NULL,
        CONSTRAINT PK_Prescriptions PRIMARY KEY ([Id]),
        CONSTRAINT FK_Prescriptions_Tenants    FOREIGN KEY ([TenantId])    REFERENCES ClinicDB.dbo.[Tenants]([Id]),
        CONSTRAINT FK_Prescriptions_Encounters FOREIGN KEY ([EncounterId]) REFERENCES ClinicDB.dbo.[Encounters]([Id]),
        CONSTRAINT FK_Prescriptions_Patients   FOREIGN KEY ([PatientId])   REFERENCES ClinicDB.dbo.[Patients]([Id]),
        CONSTRAINT FK_Prescriptions_Doctors    FOREIGN KEY ([DoctorId])    REFERENCES ClinicDB.dbo.[Doctors]([Id])
    );
    PRINT '--> Created Prescriptions.';
END

-- ─── PRESCRIPTION ITEMS ───────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.PrescriptionItems','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[PrescriptionItems] (
        [Id]             INT           NOT NULL IDENTITY(1,1),
        [PrescriptionId] INT           NOT NULL,
        [DrugId]         INT           NOT NULL,
        [Dosage]         NVARCHAR(100) NOT NULL DEFAULT '',
        [Frequency]      NVARCHAR(100) NOT NULL DEFAULT '',
        [Route]          NVARCHAR(50)  NULL,
        [Duration]       NVARCHAR(50)  NULL,
        [Quantity]       SMALLINT      NOT NULL DEFAULT 1,
        [Instructions]   NVARCHAR(300) NULL,
        [StatusId]       TINYINT       NOT NULL DEFAULT 1,
        CONSTRAINT PK_PrescriptionItems PRIMARY KEY ([Id]),
        CONSTRAINT FK_PrescriptionItems_Rx   FOREIGN KEY ([PrescriptionId]) REFERENCES ClinicDB.dbo.[Prescriptions]([Id]),
        CONSTRAINT FK_PrescriptionItems_Drug FOREIGN KEY ([DrugId])         REFERENCES ClinicDB.dbo.[DrugFormulary]([Id])
    );
    PRINT '--> Created PrescriptionItems.';
END

-- ─── LAB TEST CATALOG ─────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.LabTestCatalog','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[LabTestCatalog] (
        [Id]                INT           NOT NULL IDENTITY(1,1),
        [TenantId]          TINYINT       NOT NULL DEFAULT 1,
        [TestCode]          VARCHAR(20)   NOT NULL,
        [TestName]          NVARCHAR(200) NOT NULL,
        [Category]          NVARCHAR(100) NULL,
        [Method]            NVARCHAR(100) NULL,
        [SampleType]        NVARCHAR(50)  NULL,
        [SampleVolume]      VARCHAR(30)   NULL,
        [TurnaroundMinutes] INT           NOT NULL DEFAULT 60,
        [NormalRangeLow]    DECIMAL(12,4) NULL,
        [NormalRangeHigh]   DECIMAL(12,4) NULL,
        [CriticalLow]       DECIMAL(12,4) NULL,
        [CriticalHigh]      DECIMAL(12,4) NULL,
        [Unit]              VARCHAR(30)   NULL,
        [ResultType]        TINYINT       NOT NULL DEFAULT 1,
        [Price]             DECIMAL(10,2) NULL,
        [ParentTestId]      INT           NULL,
        [IsActive]          BIT           NOT NULL DEFAULT 1,
        [CreatedAt]         DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_LabTestCatalog PRIMARY KEY ([Id]),
        CONSTRAINT UQ_LabTestCatalog_Code UNIQUE ([TenantId],[TestCode]),
        CONSTRAINT FK_LabTestCatalog_Tenants FOREIGN KEY ([TenantId]) REFERENCES ClinicDB.dbo.[Tenants]([Id])
    );
    PRINT '--> Created LabTestCatalog.';
END
ELSE
BEGIN
    IF COL_LENGTH('ClinicDB.dbo.LabTestCatalog','ParentTestId') IS NULL
        ALTER TABLE ClinicDB.dbo.[LabTestCatalog] ADD [ParentTestId] INT NULL;
    IF COL_LENGTH('ClinicDB.dbo.LabTestCatalog','Price') IS NULL
        ALTER TABLE ClinicDB.dbo.[LabTestCatalog] ADD [Price] DECIMAL(10,2) NULL;
END

-- ─── LAB ORDERS ───────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.LabOrders','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[LabOrders] (
        [Id]          INT           NOT NULL IDENTITY(1,1),
        [TenantId]    TINYINT       NOT NULL DEFAULT 1,
        [OrderNumber] VARCHAR(30)   NOT NULL,
        [PatientId]   INT           NOT NULL,
        [EncounterId] INT           NULL,
        [OrderedBy]   INT           NOT NULL,
        [Priority]    TINYINT       NOT NULL DEFAULT 2,
        [OrderedAt]   DATETIME2     NOT NULL DEFAULT GETDATE(),
        [ClinicalInfo] NVARCHAR(500) NULL,
        [StatusId]    TINYINT       NOT NULL DEFAULT 1,
        [CreatedAt]   DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_LabOrders PRIMARY KEY ([Id]),
        CONSTRAINT UQ_LabOrders_Number UNIQUE ([TenantId],[OrderNumber]),
        CONSTRAINT FK_LabOrders_Tenants   FOREIGN KEY ([TenantId])   REFERENCES ClinicDB.dbo.[Tenants]([Id]),
        CONSTRAINT FK_LabOrders_Patients  FOREIGN KEY ([PatientId])  REFERENCES ClinicDB.dbo.[Patients]([Id]),
        CONSTRAINT FK_LabOrders_Encounters FOREIGN KEY ([EncounterId]) REFERENCES ClinicDB.dbo.[Encounters]([Id]),
        CONSTRAINT FK_LabOrders_Doctors   FOREIGN KEY ([OrderedBy])  REFERENCES ClinicDB.dbo.[Doctors]([Id])
    );
    CREATE INDEX IX_LabOrders_PatientId ON ClinicDB.dbo.[LabOrders] ([PatientId],[OrderedAt] DESC);
    PRINT '--> Created LabOrders.';
END

-- ─── LAB ORDER ITEMS ──────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.LabOrderItems','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[LabOrderItems] (
        [Id]       INT     NOT NULL IDENTITY(1,1),
        [OrderId]  INT     NOT NULL,
        [TestId]   INT     NOT NULL,
        [StatusId] TINYINT NOT NULL DEFAULT 1,
        CONSTRAINT PK_LabOrderItems PRIMARY KEY ([Id]),
        CONSTRAINT FK_LabOrderItems_Orders FOREIGN KEY ([OrderId]) REFERENCES ClinicDB.dbo.[LabOrders]([Id]) ON DELETE CASCADE,
        CONSTRAINT FK_LabOrderItems_Tests  FOREIGN KEY ([TestId])  REFERENCES ClinicDB.dbo.[LabTestCatalog]([Id])
    );
    PRINT '--> Created LabOrderItems.';
END

-- ─── INVOICE STATUSES ─────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.InvoiceStatuses','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[InvoiceStatuses] (
        [Id]   TINYINT       NOT NULL,
        [Name] NVARCHAR(30)  NOT NULL,
        CONSTRAINT PK_InvoiceStatuses PRIMARY KEY ([Id])
    );
    EXEC('INSERT INTO ClinicDB.dbo.[InvoiceStatuses] VALUES (1,''Draft''),(2,''Issued''),(3,''PartiallyPaid''),(4,''Paid''),(5,''Void''),(6,''Written Off'')');
    PRINT '--> Created InvoiceStatuses.';
END

-- ─── INVOICES ─────────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.Invoices','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Invoices] (
        [Id]            INT           NOT NULL IDENTITY(1,1),
        [TenantId]      TINYINT       NOT NULL DEFAULT 1,
        [InvoiceNumber] VARCHAR(30)   NOT NULL,
        [PatientId]     INT           NOT NULL,
        [EncounterId]   INT           NULL,
        [StatusId]      TINYINT       NOT NULL DEFAULT 1,
        [IssueDate]     DATE          NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        [DueDate]       DATE          NULL,
        [SubTotal]      DECIMAL(12,2) NOT NULL DEFAULT 0,
        [DiscountAmt]   DECIMAL(12,2) NOT NULL DEFAULT 0,
        [TaxAmt]        DECIMAL(12,2) NOT NULL DEFAULT 0,
        [TotalAmount]   DECIMAL(12,2) NOT NULL DEFAULT 0,
        [PaidAmount]    DECIMAL(12,2) NOT NULL DEFAULT 0,
        [InsuranceClaim] DECIMAL(12,2) NOT NULL DEFAULT 0,
        [Notes]         NVARCHAR(500) NULL,
        [CreatedBy]     INT           NOT NULL DEFAULT 1,
        [CreatedAt]     DATETIME2     NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]     DATETIME2     NULL,
        CONSTRAINT PK_Invoices PRIMARY KEY ([Id]),
        CONSTRAINT UQ_Invoices_Number UNIQUE ([TenantId],[InvoiceNumber]),
        CONSTRAINT FK_Invoices_Tenants   FOREIGN KEY ([TenantId])   REFERENCES ClinicDB.dbo.[Tenants]([Id]),
        CONSTRAINT FK_Invoices_Patients  FOREIGN KEY ([PatientId])  REFERENCES ClinicDB.dbo.[Patients]([Id]),
        CONSTRAINT FK_Invoices_Encounters FOREIGN KEY ([EncounterId]) REFERENCES ClinicDB.dbo.[Encounters]([Id]),
        CONSTRAINT FK_Invoices_Status    FOREIGN KEY ([StatusId])   REFERENCES ClinicDB.dbo.[InvoiceStatuses]([Id])
    );
    CREATE INDEX IX_Invoices_PatientId   ON ClinicDB.dbo.[Invoices] ([PatientId],[IssueDate] DESC);
    CREATE INDEX IX_Invoices_EncounterId ON ClinicDB.dbo.[Invoices] ([EncounterId]);
    PRINT '--> Created Invoices.';
END
ELSE
BEGIN
    -- Most critical: EncounterId may be absent in older installs
    IF COL_LENGTH('ClinicDB.dbo.Invoices','EncounterId') IS NULL
        ALTER TABLE ClinicDB.dbo.[Invoices] ADD [EncounterId] INT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Invoices_EncounterId' AND object_id=OBJECT_ID('ClinicDB.dbo.Invoices'))
        CREATE INDEX IX_Invoices_EncounterId ON ClinicDB.dbo.[Invoices] ([EncounterId]);
    -- Column name variants (InvoiceNo vs InvoiceNumber)
    IF COL_LENGTH('ClinicDB.dbo.Invoices','InvoiceNumber') IS NULL AND COL_LENGTH('ClinicDB.dbo.Invoices','InvoiceNo') IS NOT NULL
        EXEC sp_rename 'ClinicDB.dbo.Invoices.InvoiceNo','InvoiceNumber','COLUMN';
    IF COL_LENGTH('ClinicDB.dbo.Invoices','DiscountAmt') IS NULL
        ALTER TABLE ClinicDB.dbo.[Invoices] ADD [DiscountAmt] DECIMAL(12,2) NOT NULL DEFAULT 0;
    IF COL_LENGTH('ClinicDB.dbo.Invoices','TaxAmt') IS NULL
        ALTER TABLE ClinicDB.dbo.[Invoices] ADD [TaxAmt] DECIMAL(12,2) NOT NULL DEFAULT 0;
    IF COL_LENGTH('ClinicDB.dbo.Invoices','InsuranceClaim') IS NULL
        ALTER TABLE ClinicDB.dbo.[Invoices] ADD [InsuranceClaim] DECIMAL(12,2) NOT NULL DEFAULT 0;
    IF COL_LENGTH('ClinicDB.dbo.Invoices','UpdatedAt') IS NULL
        ALTER TABLE ClinicDB.dbo.[Invoices] ADD [UpdatedAt] DATETIME2 NULL;
END

-- ─── INVOICE ITEMS ────────────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.InvoiceItems','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[InvoiceItems] (
        [Id]          INT           NOT NULL IDENTITY(1,1),
        [InvoiceId]   INT           NOT NULL,
        [ItemType]    TINYINT       NOT NULL DEFAULT 1,
        [Description] NVARCHAR(200) NOT NULL,
        [Quantity]    DECIMAL(10,2) NOT NULL DEFAULT 1,
        [UnitPrice]   DECIMAL(10,2) NOT NULL DEFAULT 0,
        [Discount]    DECIMAL(10,2) NOT NULL DEFAULT 0,
        [Total]       DECIMAL(10,2) NOT NULL DEFAULT 0,
        [RefId]       INT           NULL,
        CONSTRAINT PK_InvoiceItems PRIMARY KEY ([Id]),
        CONSTRAINT FK_InvoiceItems_Invoices FOREIGN KEY ([InvoiceId]) REFERENCES ClinicDB.dbo.[Invoices]([Id]) ON DELETE CASCADE
    );
    PRINT '--> Created InvoiceItems.';
END
ELSE
BEGIN
    IF COL_LENGTH('ClinicDB.dbo.InvoiceItems','RefId') IS NULL
        ALTER TABLE ClinicDB.dbo.[InvoiceItems] ADD [RefId] INT NULL;
END

-- ─── PAYROLL AGREEMENTS ───────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.PayrollAgreements','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[PayrollAgreements] (
        [Id]        INT           NOT NULL IDENTITY(1,1),
        [TenantId]  TINYINT       NOT NULL DEFAULT 1,
        [DoctorId]  INT           NOT NULL,
        [Category]  NVARCHAR(100) NOT NULL,
        [RateType]  TINYINT       NOT NULL DEFAULT 1,
        [Rate]      DECIMAL(10,2) NOT NULL DEFAULT 0,
        [IsActive]  BIT           NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2     NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_PayrollAgreements PRIMARY KEY ([Id]),
        CONSTRAINT FK_PayrollAgreements_Tenants FOREIGN KEY ([TenantId]) REFERENCES ClinicDB.dbo.[Tenants]([Id]),
        CONSTRAINT FK_PayrollAgreements_Doctors FOREIGN KEY ([DoctorId]) REFERENCES ClinicDB.dbo.[Doctors]([Id]),
        CONSTRAINT UQ_PayrollAgreements_Doc_Cat UNIQUE ([TenantId],[DoctorId],[Category])
    );
    CREATE INDEX IX_PayrollAgreements_Doctor ON ClinicDB.dbo.[PayrollAgreements] ([TenantId],[DoctorId],[IsActive]);
    PRINT '--> Created PayrollAgreements.';
END

-- ─── CHAPA TRANSACTIONS ───────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.ChapaTransactions','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[ChapaTransactions] (
        [Id]             INT           NOT NULL IDENTITY(1,1),
        [TenantId]       TINYINT       NOT NULL DEFAULT 1,
        [InvoiceId]      INT           NOT NULL,
        [TxRef]          VARCHAR(100)  NOT NULL UNIQUE,
        [Amount]         DECIMAL(12,2) NOT NULL,
        [Currency]       VARCHAR(10)   NOT NULL DEFAULT 'ETB',
        [Email]          VARCHAR(100)  NULL,
        [FirstName]      NVARCHAR(100) NULL,
        [LastName]       NVARCHAR(100) NULL,
        [PaymentStatus]  VARCHAR(30)   NOT NULL DEFAULT 'pending',
        [CheckoutUrl]    NVARCHAR(500) NULL,
        [ChapaReference] VARCHAR(100)  NULL,
        [CreatedAt]      DATETIME2     NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]      DATETIME2     NULL,
        CONSTRAINT PK_ChapaTransactions PRIMARY KEY ([Id]),
        CONSTRAINT FK_ChapaTransactions_Invoices FOREIGN KEY ([InvoiceId]) REFERENCES ClinicDB.dbo.[Invoices]([Id])
    );
    CREATE INDEX IX_ChapaTransactions_Invoice ON ClinicDB.dbo.[ChapaTransactions] ([TenantId],[InvoiceId]);
    CREATE INDEX IX_ChapaTransactions_TxRef   ON ClinicDB.dbo.[ChapaTransactions] ([TxRef]);
    PRINT '--> Created ChapaTransactions.';
END

-- ─── LAB TEST PARAMETERS ──────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.LabTestParameters','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[LabTestParameters] (
        [Id]                 INT           NOT NULL IDENTITY(1,1),
        [TestCatalogId]      INT           NOT NULL,
        [ParameterCode]      VARCHAR(50)   NOT NULL,
        [ParameterName]      NVARCHAR(100) NOT NULL,
        [Unit]               VARCHAR(30)   NULL,
        [ReferenceLow]       DECIMAL(10,2) NULL,
        [ReferenceHigh]      DECIMAL(10,2) NULL,
        [TextReferenceRange] NVARCHAR(200) NULL,
        [DisplayOrder]       INT           NOT NULL DEFAULT 1,
        [CreatedAt]          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_LabTestParameters PRIMARY KEY ([Id]),
        CONSTRAINT FK_LabTestParameters_Catalog FOREIGN KEY ([TestCatalogId]) REFERENCES ClinicDB.dbo.[LabTestCatalog]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX IX_LabTestParameters_Catalog ON ClinicDB.dbo.[LabTestParameters] ([TestCatalogId],[DisplayOrder]);
    PRINT '--> Created LabTestParameters.';
END
ELSE
BEGIN
    -- Column name variants between master schema (TestId) and live schema (TestCatalogId)
    IF COL_LENGTH('ClinicDB.dbo.LabTestParameters','TestCatalogId') IS NULL AND COL_LENGTH('ClinicDB.dbo.LabTestParameters','TestId') IS NOT NULL
        EXEC sp_rename 'ClinicDB.dbo.LabTestParameters.TestId','TestCatalogId','COLUMN';
    IF COL_LENGTH('ClinicDB.dbo.LabTestParameters','TextReferenceRange') IS NULL
        ALTER TABLE ClinicDB.dbo.[LabTestParameters] ADD [TextReferenceRange] NVARCHAR(200) NULL;
    IF COL_LENGTH('ClinicDB.dbo.LabTestParameters','DisplayOrder') IS NULL AND COL_LENGTH('ClinicDB.dbo.LabTestParameters','SortOrder') IS NOT NULL
        EXEC sp_rename 'ClinicDB.dbo.LabTestParameters.SortOrder','DisplayOrder','COLUMN';
    IF COL_LENGTH('ClinicDB.dbo.LabTestParameters','ReferenceLow') IS NULL AND COL_LENGTH('ClinicDB.dbo.LabTestParameters','NormalRangeLow') IS NOT NULL
    BEGIN
        EXEC sp_rename 'ClinicDB.dbo.LabTestParameters.NormalRangeLow','ReferenceLow','COLUMN';
        EXEC sp_rename 'ClinicDB.dbo.LabTestParameters.NormalRangeHigh','ReferenceHigh','COLUMN';
    END
END

-- ─── MEDICAL CERTIFICATES ─────────────────────────────────────
IF OBJECT_ID('ClinicDB.dbo.MedicalCertificates','U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[MedicalCertificates] (
        [Id]                INT           NOT NULL IDENTITY(1,1),
        [TenantId]          TINYINT       NOT NULL DEFAULT 1,
        [CertificateNo]     VARCHAR(30)   NOT NULL,
        [PatientId]         INT           NOT NULL,
        [DoctorId]          INT           NOT NULL,
        [EncounterId]       INT           NULL,
        [CertificateType]   NVARCHAR(50)  NOT NULL DEFAULT 'SickLeave',
        [DiagnosisSummary]  NVARCHAR(500) NULL,
        [Recommendation]    NVARCHAR(1000) NULL,
        [StartDate]         DATE          NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        [EndDate]           DATE          NULL,
        [DaysExcused]       INT           NOT NULL DEFAULT 1,
        [QrVerificationCode] VARCHAR(64)  NULL,
        [IsIssued]          BIT           NOT NULL DEFAULT 1,
        [IssuedAt]          DATETIME2     NULL,
        [CreatedAt]         DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_MedicalCertificates PRIMARY KEY ([Id]),
        CONSTRAINT UQ_MedCert_No UNIQUE ([TenantId],[CertificateNo]),
        CONSTRAINT FK_MedCert_Tenants  FOREIGN KEY ([TenantId])  REFERENCES ClinicDB.dbo.[Tenants]([Id]),
        CONSTRAINT FK_MedCert_Patients FOREIGN KEY ([PatientId]) REFERENCES ClinicDB.dbo.[Patients]([Id]),
        CONSTRAINT FK_MedCert_Doctors  FOREIGN KEY ([DoctorId])  REFERENCES ClinicDB.dbo.[Doctors]([Id])
    );
    PRINT '--> Created MedicalCertificates.';
END
ELSE
BEGIN
    IF COL_LENGTH('ClinicDB.dbo.MedicalCertificates','QrVerificationCode') IS NULL
        ALTER TABLE ClinicDB.dbo.[MedicalCertificates] ADD [QrVerificationCode] VARCHAR(64) NULL;
    IF COL_LENGTH('ClinicDB.dbo.MedicalCertificates','EncounterId') IS NULL
        ALTER TABLE ClinicDB.dbo.[MedicalCertificates] ADD [EncounterId] INT NULL;
END

PRINT '--> [COMPLETED] PRE-MIGRATION DDL: All tables verified / created.';
RAISERROR('--> PRE-MIGRATION DDL complete.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- PRE-MIGRATION: Disable Audit Triggers & Temporal Versioning
-- ============================================================
PRINT 'Optimizing database: Disabling audit triggers & temporal versioning for bulk speed...';

IF OBJECT_ID('dbo.trg_Patients_Audit', 'TR') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[Patients] DISABLE TRIGGER [trg_Patients_Audit];
IF OBJECT_ID('dbo.trg_Encounters_Audit', 'TR') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[Encounters] DISABLE TRIGGER [trg_Encounters_Audit];
IF OBJECT_ID('dbo.trg_LabResults_Audit', 'TR') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[LabResults] DISABLE TRIGGER [trg_LabResults_Audit];

IF (SELECT temporal_type FROM sys.tables WHERE [name] = 'Patients' AND schema_id = SCHEMA_ID('dbo')) = 2
    ALTER TABLE ClinicDB.dbo.[Patients] SET (SYSTEM_VERSIONING = OFF);
IF (SELECT temporal_type FROM sys.tables WHERE [name] = 'Encounters' AND schema_id = SCHEMA_ID('dbo')) = 2
    ALTER TABLE ClinicDB.dbo.[Encounters] SET (SYSTEM_VERSIONING = OFF);
IF (SELECT temporal_type FROM sys.tables WHERE [name] = 'Prescriptions' AND schema_id = SCHEMA_ID('dbo')) = 2
    ALTER TABLE ClinicDB.dbo.[Prescriptions] SET (SYSTEM_VERSIONING = OFF);
IF (SELECT temporal_type FROM sys.tables WHERE [name] = 'LabResults' AND schema_id = SCHEMA_ID('dbo')) = 2
    ALTER TABLE ClinicDB.dbo.[LabResults] SET (SYSTEM_VERSIONING = OFF);

PRINT '--> [READY] Performance optimizations applied.';
GO

-- ============================================================
-- STEP 0: Create Migration Infrastructure & Mapping Tables
-- ============================================================
PRINT '----------------------------------------------------------------------';
PRINT 'Step 0/12: Initializing Migration Tracking & ID Mapping Tables...';
RAISERROR('Step 0/12: Initializing Mapping Tables...', 0, 1) WITH NOWAIT;

DROP TABLE IF EXISTS dbo.[MigrationLog];
CREATE TABLE dbo.[MigrationLog] (
    [Id]          INT IDENTITY(1,1) PRIMARY KEY,
    [StepName]    NVARCHAR(100),
    [SourceTable] NVARCHAR(100),
    [TargetTable] NVARCHAR(100),
    [SourceCount] INT,
    [TargetCount] INT,
    [Status]      NVARCHAR(20),
    [Notes]       NVARCHAR(500),
    [RunAt]       DATETIME2 DEFAULT GETDATE()
);

DROP TABLE IF EXISTS dbo.[Map_PatientId];
CREATE TABLE dbo.[Map_PatientId] (
    [OldMRN] NVARCHAR(50) PRIMARY KEY,
    [NewId]  INT NOT NULL
);

DROP TABLE IF EXISTS dbo.[Map_DoctorName];
CREATE TABLE dbo.[Map_DoctorName] (
    [Id]                INT IDENTITY(1,1) PRIMARY KEY,
    [DoctorNameVariant] NVARCHAR(400) NOT NULL,
    [NewDoctorId]       INT NOT NULL,
    [NewStaffId]        INT NOT NULL,
    [NewUserId]         INT NOT NULL,
    [EmpCode]           NVARCHAR(30) NULL
);
CREATE UNIQUE INDEX [UQ_Map_DoctorName_Variant] ON dbo.[Map_DoctorName] ([DoctorNameVariant]);

DROP TABLE IF EXISTS dbo.[Map_UserId];
CREATE TABLE dbo.[Map_UserId] (
    [OldEmpCode] NVARCHAR(30) PRIMARY KEY,
    [NewUserId]  INT NOT NULL
);

DROP TABLE IF EXISTS dbo.[Map_StaffId];
CREATE TABLE dbo.[Map_StaffId] (
    [OldEmpCode] NVARCHAR(30) PRIMARY KEY,
    [NewStaffId] INT NOT NULL
);

DROP TABLE IF EXISTS dbo.[Map_DrugId];
CREATE TABLE dbo.[Map_DrugId] (
    [Id]          INT IDENTITY(1,1) PRIMARY KEY,
    [OldDrugName] NVARCHAR(450) NOT NULL,
    [NewDrugId]   INT NOT NULL
);
CREATE UNIQUE INDEX [UQ_Map_DrugId_Name] ON dbo.[Map_DrugId] ([OldDrugName]);

DROP TABLE IF EXISTS dbo.[Map_LabTestId];
CREATE TABLE dbo.[Map_LabTestId] (
    [OldTestName] NVARCHAR(300) PRIMARY KEY,
    [NewTestId]   INT NOT NULL
);

DROP TABLE IF EXISTS dbo.[Map_EncounterId];
CREATE TABLE dbo.[Map_EncounterId] (
    [OldConsultId]   INT PRIMARY KEY,
    [NewEncounterId] INT NOT NULL
);

PRINT '--> [COMPLETED] Step 0/12: Mapping tables ready.';
RAISERROR('--> Step 0/12: Mapping tables initialized.', 0, 1) WITH NOWAIT;

-- Add OldConsultId to Encounters HERE in Step 0 so it is already in the schema
-- when Step 6's batch is compiled. If ALTER TABLE and INSERT [OldConsultId] are
-- in the same GO batch, SQL Server compile-time check fails with 'Invalid column name'.
IF COL_LENGTH('ClinicDB.dbo.Encounters', 'OldConsultId') IS NULL
    ALTER TABLE ClinicDB.dbo.[Encounters] ADD [OldConsultId] INT NULL;
GO

-- ============================================================
-- STEP 1: USERS & ROLES
-- Source: [dbOHMS.dbo.Users] & [dbOHMS.dbo.tblEmployees]
-- Target: [ClinicDB.dbo.Users] & [ClinicDB.dbo.UserRoles]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[Users]);
PRINT '----------------------------------------------------------------------';
PRINT 'Step 1/12: Migrating [dbOHMS.dbo.Users] -> [ClinicDB.dbo.Users] & [ClinicDB.dbo.UserRoles]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 1/12: Migrating [dbOHMS.dbo.Users] -> [ClinicDB.dbo.Users] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

DECLARE @pwdHash NVARCHAR(500) = '$2a$11$K7bdthzBfn/H7tqTicAQqO.UvxJNQ7nOqIQ8SYCVsrn14sP.S7cSm';
DECLARE @salt    NVARCHAR(100) = 'cms-migration-2026';
DECLARE @rc      INT = 0;

;WITH SourceUsers AS (
    SELECT
        u.[empCode],
        ISNULL(NULLIF(LTRIM(RTRIM(u.[Uname])),''), u.[empCode]) AS [Username],
        ISNULL(NULLIF(LTRIM(RTRIM(e.[empFname])),''), ISNULL(NULLIF(LTRIM(RTRIM(e.[empSname])),''), u.[Uname])) AS [FirstName],
        ISNULL(NULLIF(LTRIM(RTRIM(e.[empSname])),''), '-') AS [LastName],
        NULLIF(LTRIM(RTRIM(e.[empContact])),'') AS [Phone],
        'cms0' + CAST(ROW_NUMBER() OVER (ORDER BY TRY_CAST(REPLACE(u.[empCode], 'emp-', '') AS INT), u.[empCode]) AS VARCHAR) + '@cms.com' AS [Email]
    FROM dbOHMS.dbo.[Users] u
    LEFT JOIN dbOHMS.dbo.[tblEmployees] e ON LTRIM(RTRIM(e.[empCode])) = LTRIM(RTRIM(u.[empCode]))
)
INSERT INTO ClinicDB.dbo.[Users] (
    [TenantId], [Username], [Email], [PasswordHash], [Salt],
    [FirstName], [LastName], [Phone], [IsActive], [IsLocked],
    [FailedLoginAttempts], [MfaEnabled]
)
SELECT
    1,
    su.[Username],
    su.[Email],
    @pwdHash,
    @salt,
    su.[FirstName],
    su.[LastName],
    su.[Phone],
    1, 0, 0, 0
FROM SourceUsers su
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[Users] cu
    WHERE LOWER(cu.[Username]) = LOWER(su.[Username])
      AND cu.[TenantId] = 1
)
AND NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[Users] cu
    WHERE LOWER(cu.[Email]) = LOWER(su.[Email])
      AND cu.[TenantId] = 1
);
SET @rc = @@ROWCOUNT;

INSERT INTO dbo.[Map_UserId] ([OldEmpCode], [NewUserId])
SELECT DISTINCT
    LTRIM(RTRIM(u.[empCode])),
    cu.[Id]
FROM dbOHMS.dbo.[Users] u
JOIN ClinicDB.dbo.[Users] cu
    ON LOWER(cu.[Username]) = LOWER(ISNULL(NULLIF(LTRIM(RTRIM(u.[Uname])),''), u.[empCode]))
    AND cu.[TenantId] = 1
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.[Map_UserId] WHERE [OldEmpCode] = LTRIM(RTRIM(u.[empCode]))
);

INSERT INTO ClinicDB.dbo.[UserRoles] ([UserId], [RoleId])
SELECT DISTINCT
    mu.[NewUserId],
    CASE LTRIM(RTRIM(u.[Levels]))
        WHEN 'Administrator' THEN 2  -- Admin
        WHEN 'Doctor'        THEN 3  -- Doctor
        WHEN 'Nurse'         THEN 4  -- Nurse
        WHEN 'Cashier'       THEN 5  -- Receptionist / Cashier
        WHEN 'FDA'           THEN 8  -- Pharmacist
        ELSE 2
    END
FROM dbOHMS.dbo.[Users] u
JOIN dbo.[Map_UserId] mu ON LTRIM(RTRIM(u.[empCode])) = mu.[OldEmpCode]
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[UserRoles] ur
    WHERE ur.[UserId] = mu.[NewUserId]
);

DECLARE @userTotal INT = (SELECT COUNT(*) FROM dbo.[Map_UserId]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 1', 'Users', 'Users & UserRoles', @srcCount, @userTotal, 'OK', 'Incremental emails: cms0x@cms.com, passwords: 123456', GETDATE());
PRINT '--> [COMPLETED] Step 1/12: [dbOHMS.dbo.Users] -> [ClinicDB.dbo.Users] | Processed: ' + CAST(@userTotal AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 1/12: Users done (%d of %d mapped).', 0, 1, @userTotal, @srcCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 2: STAFF & DOCTORS
-- Source: [dbOHMS.dbo.tblEmployees]
-- Target: [ClinicDB.dbo.Staff] & [ClinicDB.dbo.Doctors]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblEmployees]);
PRINT '------------------------------------------------------------';
PRINT 'Step 2/12: Migrating [dbOHMS.dbo.tblEmployees] -> [ClinicDB.dbo.Staff] & [ClinicDB.dbo.Doctors]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 2/12: Migrating [dbOHMS.dbo.tblEmployees] -> [ClinicDB.dbo.Staff] & [ClinicDB.dbo.Doctors] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

IF NOT EXISTS (SELECT 1 FROM ClinicDB.dbo.[Specializations] WHERE [Code] = 'GEN')
    INSERT INTO ClinicDB.dbo.[Specializations] ([Name], [Code]) VALUES ('General Practice', 'GEN');

DECLARE @adminUserId INT = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Users] WHERE [TenantId] = 1 ORDER BY [Id]);
DECLARE @genSpecId   SMALLINT = (SELECT [Id] FROM ClinicDB.dbo.[Specializations] WHERE [Code] = 'GEN');

INSERT INTO ClinicDB.dbo.[Staff] (
    [TenantId], [UserId], [StaffCode], [Title], [FirstName], [LastName],
    [Phone], [Email], [PrimaryRoleId], [Department], [JoinDate], [IsActive]
)
SELECT
    1,
    ISNULL(mu.[NewUserId], @adminUserId),
    LTRIM(RTRIM(e.[empCode])),
    CASE WHEN LOWER(LTRIM(RTRIM(e.[empDesignation]))) IN ('doctor','dentist') THEN 'Dr.' ELSE '' END,
    ISNULL(NULLIF(LTRIM(RTRIM(e.[empFname])),''), ISNULL(NULLIF(LTRIM(RTRIM(e.[empSname])),''), e.[empCode])),
    ISNULL(NULLIF(LTRIM(RTRIM(e.[empSname])),''), '-'),
    NULLIF(LTRIM(RTRIM(e.[empContact])),''),
    NULLIF(LTRIM(RTRIM(e.[empEmail])),''),
    CASE LOWER(LTRIM(RTRIM(e.[empDesignation])))
        WHEN 'admin'   THEN 2  WHEN 'doctor' THEN 3  WHEN 'dentist' THEN 3
        WHEN 'nurse'   THEN 4  WHEN 'emy'    THEN 4
        WHEN 'casher'  THEN 5  WHEN 'cashier' THEN 5
        WHEN 'fda'     THEN 8  ELSE 2
    END,
    ISNULL(NULLIF(LTRIM(RTRIM(e.[empDepartment])),''), 'General'),
    e.[empDateJoined],
    1
FROM dbOHMS.dbo.[tblEmployees] e
LEFT JOIN dbo.[Map_UserId] mu ON LTRIM(RTRIM(e.[empCode])) = mu.[OldEmpCode]
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[Staff] s
    WHERE s.[TenantId] = 1 AND s.[StaffCode] = LTRIM(RTRIM(e.[empCode]))
);

INSERT INTO dbo.[Map_StaffId] ([OldEmpCode], [NewStaffId])
SELECT DISTINCT LTRIM(RTRIM(e.[empCode])), s.[Id]
FROM dbOHMS.dbo.[tblEmployees] e
JOIN ClinicDB.dbo.[Staff] s ON s.[StaffCode] = LTRIM(RTRIM(e.[empCode])) AND s.[TenantId] = 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Map_StaffId] WHERE [OldEmpCode] = LTRIM(RTRIM(e.[empCode])));

INSERT INTO ClinicDB.dbo.[Doctors] ([StaffId], [LicenseNumber], [SpecializationId], [IsAvailable])
SELECT
    ms.[NewStaffId],
    'LIC-' + LTRIM(RTRIM(e.[empCode])),
    @genSpecId,
    1
FROM dbOHMS.dbo.[tblEmployees] e
JOIN dbo.[Map_StaffId] ms ON LTRIM(RTRIM(e.[empCode])) = ms.[OldEmpCode]
WHERE LOWER(LTRIM(RTRIM(e.[empDesignation]))) IN ('doctor','dentist','emy','fda')
  AND NOT EXISTS (
      SELECT 1 FROM ClinicDB.dbo.[Doctors] d WHERE d.[StaffId] = ms.[NewStaffId]
  );

DECLARE @stfCount INT = (SELECT COUNT(*) FROM dbo.[Map_StaffId]);
DECLARE @docCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[Doctors]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 2', 'tblEmployees', 'Staff & Doctors', @srcCount, @stfCount, 'OK', 'Doctors created: ' + CAST(@docCount AS VARCHAR), GETDATE());
PRINT '--> [COMPLETED] Step 2/12: [dbOHMS.dbo.tblEmployees] -> [ClinicDB.dbo.Staff] & [ClinicDB.dbo.Doctors] | Processed: ' + CAST(@stfCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 2/12: Staff & Doctors done (%d records).', 0, 1, @stfCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 3: BUILD DOCTOR LOOKUP ENGINE
-- Source: [dbOHMS.dbo.tblEmployees] + Child Table Doctor Names
-- Target: [ClinicDB.dbo.Map_DoctorName]
-- ============================================================
PRINT '----------------------------------------------------------------------';
PRINT 'Step 3/12: Building Doctor Lookup Map [dbOHMS.dbo.tblEmployees] -> [ClinicDB.dbo.Map_DoctorName]';
RAISERROR('Step 3/12: Building Doctor Lookup Engine...', 0, 1) WITH NOWAIT;

DECLARE @fbDocId INT = (
    SELECT TOP 1 d.[Id] FROM ClinicDB.dbo.[Doctors] d
    JOIN ClinicDB.dbo.[Staff] s ON d.[StaffId] = s.[Id]
    WHERE s.[StaffCode] = 'emp-4'
);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors] ORDER BY [Id]);
IF @fbDocId IS NULL SET @fbDocId = 1;

DECLARE @fbStfId INT = (SELECT TOP 1 [StaffId] FROM ClinicDB.dbo.[Doctors] WHERE [Id] = @fbDocId);
IF @fbStfId IS NULL SET @fbStfId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Staff] ORDER BY [Id]);
IF @fbStfId IS NULL SET @fbStfId = 1;

DECLARE @fbUsrId INT = (SELECT TOP 1 [UserId] FROM ClinicDB.dbo.[Staff] WHERE [Id] = @fbStfId);
IF @fbUsrId IS NULL SET @fbUsrId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Users] ORDER BY [Id]);
IF @fbUsrId IS NULL SET @fbUsrId = 1;

-- Canonical: Sname + Fname + Oname
INSERT INTO dbo.[Map_DoctorName] ([DoctorNameVariant], [NewDoctorId], [NewStaffId], [NewUserId], [EmpCode])
SELECT DISTINCT
    LOWER(LTRIM(RTRIM(ISNULL(e.[empSname],'') + ' ' + ISNULL(e.[empFname],'') + ' ' + ISNULL(e.[empOname],'')))),
    d.[Id], s.[Id], s.[UserId], e.[empCode]
FROM dbOHMS.dbo.[tblEmployees] e
JOIN ClinicDB.dbo.[Staff] s ON s.[StaffCode] = LTRIM(RTRIM(e.[empCode])) AND s.[TenantId] = 1
JOIN ClinicDB.dbo.[Doctors] d ON d.[StaffId] = s.[Id]
WHERE NULLIF(LTRIM(RTRIM(ISNULL(e.[empSname],'') + ' ' + ISNULL(e.[empFname],'') + ' ' + ISNULL(e.[empOname],''))),'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.[Map_DoctorName]
      WHERE [DoctorNameVariant] = LOWER(LTRIM(RTRIM(ISNULL(e.[empSname],'') + ' ' + ISNULL(e.[empFname],'') + ' ' + ISNULL(e.[empOname],''))))
  );

-- Sname + Fname
INSERT INTO dbo.[Map_DoctorName] ([DoctorNameVariant], [NewDoctorId], [NewStaffId], [NewUserId], [EmpCode])
SELECT DISTINCT
    LOWER(LTRIM(RTRIM(ISNULL(e.[empSname],'') + ' ' + ISNULL(e.[empFname],'')))),
    d.[Id], s.[Id], s.[UserId], e.[empCode]
FROM dbOHMS.dbo.[tblEmployees] e
JOIN ClinicDB.dbo.[Staff] s ON s.[StaffCode] = LTRIM(RTRIM(e.[empCode])) AND s.[TenantId] = 1
JOIN ClinicDB.dbo.[Doctors] d ON d.[StaffId] = s.[Id]
WHERE NULLIF(LTRIM(RTRIM(ISNULL(e.[empSname],'') + ' ' + ISNULL(e.[empFname],''))),'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.[Map_DoctorName]
      WHERE [DoctorNameVariant] = LOWER(LTRIM(RTRIM(ISNULL(e.[empSname],'') + ' ' + ISNULL(e.[empFname],''))))
  );

-- Fname + Sname (reversed)
INSERT INTO dbo.[Map_DoctorName] ([DoctorNameVariant], [NewDoctorId], [NewStaffId], [NewUserId], [EmpCode])
SELECT DISTINCT
    LOWER(LTRIM(RTRIM(ISNULL(e.[empFname],'') + ' ' + ISNULL(e.[empSname],'')))),
    d.[Id], s.[Id], s.[UserId], e.[empCode]
FROM dbOHMS.dbo.[tblEmployees] e
JOIN ClinicDB.dbo.[Staff] s ON s.[StaffCode] = LTRIM(RTRIM(e.[empCode])) AND s.[TenantId] = 1
JOIN ClinicDB.dbo.[Doctors] d ON d.[StaffId] = s.[Id]
WHERE NULLIF(LTRIM(RTRIM(ISNULL(e.[empFname],'') + ' ' + ISNULL(e.[empSname],''))),'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.[Map_DoctorName]
      WHERE [DoctorNameVariant] = LOWER(LTRIM(RTRIM(ISNULL(e.[empFname],'') + ' ' + ISNULL(e.[empSname],''))))
  );

-- All doctor variants from child tables
;WITH AllVariants AS (
    SELECT DISTINCT LOWER(LTRIM(RTRIM(c.[DocCode]))) AS [Variant] FROM dbOHMS.dbo.[tblConsultation] c WHERE c.[DocCode] IS NOT NULL
    UNION
    SELECT DISTINCT LOWER(LTRIM(RTRIM(p.[docname]))) FROM dbOHMS.dbo.[tblPrescription] p WHERE p.[docname] IS NOT NULL
    UNION
    SELECT DISTINCT LOWER(LTRIM(RTRIM(o.[doctor]))) FROM dbOHMS.dbo.[tblOrder] o WHERE o.[doctor] IS NOT NULL
    UNION
    SELECT DISTINCT LOWER(LTRIM(RTRIM(s.[doctor]))) FROM dbOHMS.dbo.[tblSchedule] s WHERE s.[doctor] IS NOT NULL
    UNION
    SELECT DISTINCT LOWER(LTRIM(RTRIM(mc.[doctor]))) FROM dbOHMS.dbo.[tblMedicalCertificate] mc WHERE mc.[doctor] IS NOT NULL
),
CleanedVariants AS (
    SELECT
        v.[Variant],
        LTRIM(RTRIM(REPLACE(REPLACE(v.[Variant], 'dr. ', ''), 'dr.', ''))) AS [Stripped]
    FROM AllVariants v
    WHERE NULLIF(LTRIM(RTRIM(v.[Variant])),'') IS NOT NULL
)
INSERT INTO dbo.[Map_DoctorName] ([DoctorNameVariant], [NewDoctorId], [NewStaffId], [NewUserId], [EmpCode])
SELECT
    cv.[Variant],
    COALESCE(
        (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName] WHERE [DoctorNameVariant] = cv.[Stripped]),
        @fbDocId
    ),
    COALESCE(
        (SELECT TOP 1 [NewStaffId] FROM dbo.[Map_DoctorName] WHERE [DoctorNameVariant] = cv.[Stripped]),
        @fbStfId
    ),
    COALESCE(
        (SELECT TOP 1 [NewUserId] FROM dbo.[Map_DoctorName] WHERE [DoctorNameVariant] = cv.[Stripped]),
        @fbUsrId
    ),
    COALESCE(
        (SELECT TOP 1 [EmpCode] FROM dbo.[Map_DoctorName] WHERE [DoctorNameVariant] = cv.[Stripped]),
        'emp-4'
    )
FROM CleanedVariants cv
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.[Map_DoctorName] WHERE [DoctorNameVariant] = cv.[Variant]
);

DECLARE @docMapTotal INT = (SELECT COUNT(*) FROM dbo.[Map_DoctorName]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 3', 'tblEmployees Variants', 'Map_DoctorName', @docMapTotal, @docMapTotal, 'OK', 'Fallback DoctorId=' + CAST(@fbDocId AS VARCHAR), GETDATE());
PRINT '--> [COMPLETED] Step 3/12: [dbOHMS.dbo.tblEmployees] -> [ClinicDB.dbo.Map_DoctorName] | Mapped: ' + CAST(@docMapTotal AS VARCHAR) + ' Doctor name variations.';
RAISERROR('--> [COMPLETED] Step 3/12: Doctor lookup engine ready.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 4: PATIENTS
-- Source: [dbOHMS.dbo.tblPatient]
-- Target: [ClinicDB.dbo.Patients]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblPatient]);
PRINT '----------------------------------------------------------------------';
PRINT 'Step 4/12: Migrating [dbOHMS.dbo.tblPatient] -> [ClinicDB.dbo.Patients]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR) + ' (Calculating DateOfBirth from age column)';
RAISERROR('Step 4/12: Migrating [dbOHMS.dbo.tblPatient] -> [ClinicDB.dbo.Patients] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

DECLARE @patInserted INT = 0;
DECLARE @patUpdated  INT = 0;

-- 4a. Update already-inserted patients with reverse-calculated DateOfBirth
UPDATE cp
SET
    cp.[DateOfBirth] = CASE
        WHEN p.[age] IS NOT NULL AND p.[age] > 0 AND p.[age] <= 120
            THEN DATEADD(year, -p.[age], CAST(ISNULL(p.[regdate], GETDATE()) AS DATE))
        ELSE ISNULL(p.[pDOB], CAST('1900-01-01' AS DATE))
    END,
    cp.[Email] = 'cms@cms.com'
FROM ClinicDB.dbo.[Patients] cp
JOIN dbOHMS.dbo.[tblPatient] p ON cp.[MRN] = LTRIM(RTRIM(p.[patID]))
WHERE cp.[TenantId] = 1;
SET @patUpdated = @@ROWCOUNT;

-- 4b. Insert missing patients
INSERT INTO ClinicDB.dbo.[Patients] (
    [TenantId], [MRN], [FirstName], [MiddleName], [LastName],
    [DateOfBirth], [Gender], [PrimaryPhone], [SecondaryPhone],
    [Email], [Address], [Nationality],
    [EmergencyName], [EmergencyPhone], [EmergencyRelation],
    [Notes], [IsActive], [CreatedAt]
)
SELECT
    1,
    LTRIM(RTRIM(p.[patID])),
    ISNULL(NULLIF(LTRIM(RTRIM(p.[pFname])),''), LTRIM(RTRIM(p.[patID]))),
    NULLIF(LTRIM(RTRIM(p.[pOname])),''),
    ISNULL(NULLIF(LTRIM(RTRIM(p.[pSname])),''), '-'),
    CASE
        WHEN p.[age] IS NOT NULL AND p.[age] > 0 AND p.[age] <= 120
            THEN DATEADD(year, -p.[age], CAST(ISNULL(p.[regdate], GETDATE()) AS DATE))
        ELSE ISNULL(p.[pDOB], CAST('1900-01-01' AS DATE))
    END,
    CASE LOWER(LTRIM(RTRIM(p.[pGender])))
        WHEN 'female' THEN 2 WHEN 'f' THEN 2
        WHEN 'male'   THEN 1 WHEN 'm' THEN 1
        ELSE 3
    END,
    ISNULL(NULLIF(LTRIM(RTRIM(p.[pContact])),''), '0000000000'),
    NULL,
    'cms@cms.com',
    NULLIF(LTRIM(RTRIM(p.[pResidenAddres])),''),
    NULLIF(LTRIM(RTRIM(p.[pNationality])),''),
    NULLIF(LTRIM(RTRIM(p.[pGuardianName])),''),
    NULLIF(LTRIM(RTRIM(p.[pGuardianPhone])),''),
    NULLIF(LTRIM(RTRIM(p.[pGuardianRelateAs])),''),
    NULLIF('Occupation: ' + LTRIM(RTRIM(ISNULL(p.[pOccupation],''))), 'Occupation: '),
    1,
    ISNULL(p.[regdate], GETDATE())
FROM dbOHMS.dbo.[tblPatient] p
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[Patients] cp
    WHERE cp.[MRN] = LTRIM(RTRIM(p.[patID])) AND cp.[TenantId] = 1
);
SET @patInserted = @@ROWCOUNT;

-- 4c. Map PatientId
INSERT INTO dbo.[Map_PatientId] ([OldMRN], [NewId])
SELECT DISTINCT LTRIM(RTRIM(p.[patID])), cp.[Id]
FROM dbOHMS.dbo.[tblPatient] p
JOIN ClinicDB.dbo.[Patients] cp ON cp.[MRN] = LTRIM(RTRIM(p.[patID])) AND cp.[TenantId] = 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Map_PatientId] WHERE [OldMRN] = LTRIM(RTRIM(p.[patID])));

DECLARE @patTotal INT = (SELECT COUNT(*) FROM dbo.[Map_PatientId]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 4', 'tblPatient', 'Patients', @srcCount, @patTotal, 'OK', 'Updated: ' + CAST(@patUpdated AS VARCHAR) + ', Inserted: ' + CAST(@patInserted AS VARCHAR), GETDATE());
PRINT '--> [COMPLETED] Step 4/12: [dbOHMS.dbo.tblPatient] -> [ClinicDB.dbo.Patients] | Processed: ' + CAST(@patTotal AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 4/12: Patients done (%d records).', 0, 1, @patTotal) WITH NOWAIT;
GO

-- ============================================================
-- STEP 5: SERVICES
-- Source: [dbOHMS.dbo.tblServices]
-- Target: [ClinicDB.dbo.Services] & [ClinicDB.dbo.LegacyServices]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblServices]);
PRINT '------------------------------------------------------------';
PRINT 'Step 5/12: Migrating [dbOHMS.dbo.tblServices] -> [ClinicDB.dbo.Services] & [LegacyServices]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 5/12: Migrating [dbOHMS.dbo.tblServices] -> [ClinicDB.dbo.Services] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

IF OBJECT_ID('ClinicDB.dbo.LegacyServices') IS NULL
CREATE TABLE ClinicDB.dbo.[LegacyServices] (
    [Id]           INT IDENTITY(1,1) PRIMARY KEY,
    [OldServiceId] INT,
    [ServiceName]  NVARCHAR(400),
    [Category]     NVARCHAR(200),
    [Price]        DECIMAL(10,2),
    [ServiceCode]  NVARCHAR(50),
    [IsActive]     BIT DEFAULT 1,
    [TenantId]     TINYINT DEFAULT 1,
    [MigratedAt]   DATETIME2 DEFAULT GETDATE()
);

INSERT INTO ClinicDB.dbo.[LegacyServices] (
    [OldServiceId], [ServiceName], [Category], [Price], [ServiceCode], [IsActive]
)
SELECT s.[serviceid], s.[servicename], s.[category], s.[price], s.[servicecode], ISNULL(s.[isactive], 1)
FROM dbOHMS.dbo.[tblServices] s
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[LegacyServices] ls WHERE ls.[OldServiceId] = s.[serviceid]
);

-- Primary Production Services Table
IF OBJECT_ID('ClinicDB.dbo.Services') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[Services] (
        [Id]          INT IDENTITY(1,1) PRIMARY KEY,
        [TenantId]    TINYINT NOT NULL DEFAULT 1,
        [Code]        NVARCHAR(50) NOT NULL,
        [Name]        NVARCHAR(300) NOT NULL,
        [Category]    NVARCHAR(100) NOT NULL,
        [Department]  NVARCHAR(100) NULL,
        [Price]       DECIMAL(18,2) NOT NULL DEFAULT 0,
        [Taxable]     BIT NOT NULL DEFAULT 0,
        [IsActive]    BIT NOT NULL DEFAULT 1,
        [Description] NVARCHAR(500) NULL,
        [CreatedAt]   DATETIME2 NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]   DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    CREATE NONCLUSTERED INDEX [IX_Services_Tenant_Active] ON ClinicDB.dbo.[Services] ([TenantId], [IsActive]) INCLUDE ([Code], [Name], [Category], [Price]);
END

INSERT INTO ClinicDB.dbo.[Services] ([TenantId], [Code], [Name], [Category], [Department], [Price], [Taxable], [IsActive], [Description], [CreatedAt], [UpdatedAt])
SELECT 
    ls.[TenantId],
    ls.[ServiceCode],
    ls.[ServiceName],
    ls.[Category],
    CASE 
        WHEN ls.[Category] = 'Consultation' THEN 'Outpatient Consultation'
        WHEN ls.[Category] = 'Laboratory' OR ls.[Category] = 'Old Lab Category' THEN 'Laboratory'
        WHEN ls.[Category] = 'Pharmacy' THEN 'Pharmacy'
        WHEN ls.[Category] = 'Procedure' THEN 'Minor Surgery & Procedures'
        WHEN ls.[Category] = 'Facial' THEN 'Dermatology & Aesthetics'
        ELSE 'General Clinical'
    END,
    ls.[Price],
    0,
    ls.[IsActive],
    ls.[ServiceName],
    ls.[MigratedAt],
    ls.[MigratedAt]
FROM ClinicDB.dbo.[LegacyServices] ls
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[Services] s WHERE s.[Code] = ls.[ServiceCode] AND s.[Name] = ls.[ServiceName]
);

DECLARE @svcCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[Services]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 5', 'tblServices', 'Services', @srcCount, @svcCount, 'OK', 'Migrated to primary Services table', GETDATE());
PRINT '--> [COMPLETED] Step 5/12: [dbOHMS.dbo.tblServices] -> [ClinicDB.dbo.Services] | Processed: ' + CAST(@svcCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 5/12: Services done (%d records).', 0, 1, @svcCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 6: CONSULTATIONS
-- Source: [dbOHMS.dbo.tblConsultation]
-- Target: [ClinicDB.dbo.Encounters] & [ClinicDB.dbo.Diagnoses]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblConsultation]);
PRINT '------------------------------------------------------------';
PRINT 'Step 6/12: Migrating [dbOHMS.dbo.tblConsultation] -> [ClinicDB.dbo.Encounters] & [ClinicDB.dbo.Diagnoses]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 6/12: Migrating [dbOHMS.dbo.tblConsultation] -> [ClinicDB.dbo.Encounters] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

IF NOT EXISTS (SELECT 1 FROM ClinicDB.dbo.[DiagnosisCodes] WHERE [Code] = 'LEGACY')
    INSERT INTO ClinicDB.dbo.[DiagnosisCodes] ([Code], [Description], [Category])
    VALUES ('LEGACY', 'Migrated from legacy system (no ICD-10 code)', 'Migration');

DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);
DECLARE @fbUsrId INT = (SELECT TOP 1 [NewUserId] FROM dbo.[Map_DoctorName]);
IF @fbUsrId IS NULL SET @fbUsrId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Users]);

PRINT '  [Step 6 Action 1/4] OldConsultId column ready (added in Step 0). Building Map_EncounterId...';
RAISERROR('  [Step 6 Action 1/4] OldConsultId ready. Building mapping table...', 0, 1) WITH NOWAIT;

DROP TABLE IF EXISTS dbo.[Map_EncounterId];
CREATE TABLE dbo.[Map_EncounterId] (
    [OldConsultId]   INT PRIMARY KEY,
    [NewEncounterId] INT NOT NULL
);

PRINT '  [Step 6 Action 2/4] Bulk inserting 20,124 consultation records into Encounters...';
RAISERROR('  [Step 6 Action 2/4] Bulk inserting consultation records into Encounters...', 0, 1) WITH NOWAIT;

INSERT INTO ClinicDB.dbo.[Encounters] (
    [TenantId], [PatientId], [DoctorId], [EncounterDate], [EncounterTime],
    [ChiefComplaint], [HistoryOfIllness], [PhysicalExam], [Assessment], [Plan],
    [VitalSigns], [IsFinalized], [FinalizedAt], [CreatedAt], [CreatedBy], [OldConsultId]
)
SELECT
    1,
    mp.[NewId],
    COALESCE(md.[NewDoctorId], @fbDocId, 1),
    ISNULL(c.[consultDate], CAST(GETDATE() AS DATE)),
    CAST(GETDATE() AS TIME),
    NULLIF(LTRIM(RTRIM(COALESCE(NULLIF(c.[chiefcompliant],''), c.[subjective]))),''),
    NULLIF(LTRIM(RTRIM(c.[history])),''),
    NULLIF(LTRIM(RTRIM(COALESCE(NULLIF(c.[pe],''), c.[objective]))),''),
    NULLIF(LTRIM(RTRIM(COALESCE(NULLIF(c.[assessment],''), c.[diagnosis]))),''),
    NULLIF(LTRIM(RTRIM(
        ISNULL(c.[plan],'') +
        CASE WHEN NULLIF(LTRIM(RTRIM(c.[plan2])),'') IS NOT NULL THEN '; ' + c.[plan2] ELSE '' END +
        CASE WHEN NULLIF(LTRIM(RTRIM(c.[Treatment])),'') IS NOT NULL THEN ' | Tx: ' + c.[Treatment] ELSE '' END
    )),''),
    NULL,
    1,
    ISNULL(CAST(c.[consultDate] AS DATETIME2), GETDATE()),
    ISNULL(CAST(c.[consultDate] AS DATETIME2), GETDATE()),
    COALESCE(md.[NewUserId], @fbUsrId, 1),
    c.[id]
FROM dbOHMS.dbo.[tblConsultation] c
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(c.[patID])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(c.[DocCode]))) = md.[DoctorNameVariant];

DECLARE @encRows INT = @@ROWCOUNT;
PRINT '  --> Encounters inserted: ' + CAST(@encRows AS VARCHAR) + ' rows.';
RAISERROR('  --> Encounters inserted: %d rows.', 0, 1, @encRows) WITH NOWAIT;

PRINT '  [Step 6 Action 3/4] Populating Map_EncounterId cross-reference table...';
RAISERROR('  [Step 6 Action 3/4] Populating Map_EncounterId cross-reference table...', 0, 1) WITH NOWAIT;

INSERT INTO dbo.[Map_EncounterId] ([OldConsultId], [NewEncounterId])
SELECT [OldConsultId], [Id]
FROM ClinicDB.dbo.[Encounters]
WHERE [OldConsultId] IS NOT NULL;

DECLARE @mapRows INT = @@ROWCOUNT;
PRINT '  --> Map_EncounterId populated: ' + CAST(@mapRows AS VARCHAR) + ' mappings.';
RAISERROR('  --> Map_EncounterId populated: %d mappings.', 0, 1, @mapRows) WITH NOWAIT;

PRINT '  [Step 6 Action 4/4] Inserting diagnosis records into Diagnoses table...';
RAISERROR('  [Step 6 Action 4/4] Inserting diagnosis records into Diagnoses table...', 0, 1) WITH NOWAIT;

INSERT INTO ClinicDB.dbo.[Diagnoses] ([EncounterId], [DiagnosisCode], [DiagnosisText], [DiagnosisType])
SELECT
    me.[NewEncounterId],
    'LEGACY',
    LEFT(COALESCE(NULLIF(LTRIM(RTRIM(c.[diagnosis])),''), NULLIF(LTRIM(RTRIM(c.[assessment])),''), 'No diagnosis recorded'), 300),
    1
FROM dbOHMS.dbo.[tblConsultation] c
JOIN dbo.[Map_EncounterId] me ON c.[id] = me.[OldConsultId]
WHERE NULLIF(LTRIM(RTRIM(c.[diagnosis])),'') IS NOT NULL
   OR NULLIF(LTRIM(RTRIM(c.[assessment])),'') IS NOT NULL;

DECLARE @diagRows INT = @@ROWCOUNT;
PRINT '  --> Diagnoses inserted: ' + CAST(@diagRows AS VARCHAR) + ' rows.';
RAISERROR('  --> Diagnoses inserted: %d rows.', 0, 1, @diagRows) WITH NOWAIT;


DECLARE @encCount INT = (SELECT COUNT(*) FROM dbo.[Map_EncounterId]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 6', 'tblConsultation', 'Encounters & Diagnoses', @srcCount, @encCount, 'OK', 'SOAP data mapped; Diagnoses created: ' + CAST(@diagRows AS VARCHAR), GETDATE());
PRINT '--> [COMPLETED] Step 6/12: [dbOHMS.dbo.tblConsultation] -> [ClinicDB.dbo.Encounters] & [ClinicDB.dbo.Diagnoses] | Encounters: ' + CAST(@encCount AS VARCHAR) + ', Diagnoses: ' + CAST(@diagRows AS VARCHAR) + '.';
RAISERROR('--> [COMPLETED] Step 6/12: Encounters done (%d records).', 0, 1, @encCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 7: APPOINTMENTS
-- Source: [dbOHMS.dbo.tblSchedule]
-- Target: [ClinicDB.dbo.Appointments]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblSchedule]);
PRINT '------------------------------------------------------------';
PRINT 'Step 7/12: Migrating [dbOHMS.dbo.tblSchedule] -> [ClinicDB.dbo.Appointments]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 7/12: Migrating [dbOHMS.dbo.tblSchedule] -> [ClinicDB.dbo.Appointments] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);
DECLARE @fbUsrId INT = (SELECT TOP 1 [NewUserId] FROM dbo.[Map_DoctorName]);
IF @fbUsrId IS NULL SET @fbUsrId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Users]);

-- UQ_Appointments_DoctorSlot = (TenantId, DoctorId, SlotDateTime).
-- Legacy tblSchedule stores date-only (createOndate), so many patients share the
-- same (doctor, date). Fix: offset duplicate slots by (row_number - 1) minutes
-- so every record gets a unique SlotDateTime while preserving all data.
;WITH [CTE_Sched] AS (
    SELECT
        s.[id],
        s.[patid],
        s.[doctor],
        s.[createOndate],
        s.[regdate],
        s.[ispaid],
        s.[visittype],
        s.[appNote],
        s.[diagnosistype],
        mp.[NewId]                                            AS [NewPatientId],
        COALESCE(md.[NewDoctorId], @fbDocId, 1)              AS [NewDoctorId],
        COALESCE(md.[NewUserId],   @fbUsrId, 1)              AS [NewUserId],
        -- Offset each duplicate (doctor, date) by row-number minutes
        DATEADD(MINUTE,
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(md.[NewDoctorId], @fbDocId, 1),
                             CAST(s.[createOndate] AS DATETIME2)
                ORDER BY s.[id]
            ) - 1,
            CAST(s.[createOndate] AS DATETIME2)
        ) AS [UniqueSlot]
    FROM dbOHMS.dbo.[tblSchedule] s
    JOIN  dbo.[Map_PatientId]  mp ON LTRIM(RTRIM(s.[patid]))          = mp.[OldMRN]
    LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(s.[doctor]))) = md.[DoctorNameVariant]
)
INSERT INTO ClinicDB.dbo.[Appointments] (
    [TenantId], [PatientId], [DoctorId], [SlotDateTime], [DurationMinutes],
    [StatusId], [ReasonForVisit], [Notes], [BookedBy], [BookedAt], [CreatedAt]
)
SELECT
    1,
    [NewPatientId],
    [NewDoctorId],
    [UniqueSlot],
    15,
    CASE WHEN [ispaid] = 1 THEN 5 ELSE 1 END,
    NULLIF(LTRIM(RTRIM([visittype])),''),
    NULLIF(LTRIM(RTRIM(
        ISNULL([appNote],'') +
        CASE WHEN NULLIF(LTRIM(RTRIM([diagnosistype])),'') IS NOT NULL THEN ' | ' + [diagnosistype] ELSE '' END
    )),''),
    [NewUserId],
    ISNULL([regdate], [createOndate]),
    ISNULL([regdate], [createOndate])
FROM [CTE_Sched]
OPTION (MAXDOP 1);

DECLARE @apptCount INT = @@ROWCOUNT;
INSERT INTO dbo.[MigrationLog] VALUES ('Step 7', 'tblSchedule', 'Appointments', @srcCount, @apptCount, 'OK', 'ispaid=1 -> Completed (5), else Scheduled (1)', GETDATE());
PRINT '--> [COMPLETED] Step 7/12: [dbOHMS.dbo.tblSchedule] -> [ClinicDB.dbo.Appointments] | Processed: ' + CAST(@apptCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 7/12: Appointments done (%d records).', 0, 1, @apptCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 7B: PATIENT TRIAGE QUEUE & HISTORICAL ASSIGNMENTS
-- Source: [dbOHMS.dbo.tblSchedule] & [dbOHMS.dbo.tblConsultation]
-- Target: [ClinicDB.dbo.PatientTriage]
-- ============================================================
PRINT '------------------------------------------------------------';
PRINT 'Step 7B: Migrating [tblSchedule] & [tblConsultation] -> [ClinicDB.dbo.PatientTriage]...';
RAISERROR('Step 7B: Migrating historical patient assignments to PatientTriage...', 0, 1) WITH NOWAIT;

DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);
DECLARE @fbUsrId INT = (SELECT TOP 1 [NewUserId] FROM dbo.[Map_DoctorName]);
IF @fbUsrId IS NULL SET @fbUsrId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Users]);

-- 1. Insert from tblSchedule
INSERT INTO ClinicDB.dbo.[PatientTriage] (
    [TenantId], [PatientId], [AppointmentId], [QueueId], [TriageCategory], [PriorityLevel],
    [SystolicBP], [DiastolicBP], [HeartRate], [RespiratoryRate], [Temperature], [OxygenSaturation],
    [WeightKg], [HeightCm], [Bmi], [BloodGlucose], [PainScale],
    [ChiefComplaint], [NurseNotes],
    [AssignedDoctorId], [AssignedRoomId], [Status],
    [HoldReason], [HoldDurationMin],
    [TriagedBy], [TriagedAt], [UpdatedAt]
)
SELECT
    1 AS [TenantId],
    mp.[NewId] AS [PatientId],
    a.[Id] AS [AppointmentId],
    NULL AS [QueueId],
    COALESCE(NULLIF(LTRIM(RTRIM(s.[visittype])), ''), 'General Consultation') AS [TriageCategory],
    3 AS [PriorityLevel],
    CASE WHEN CHARINDEX('/', pw.[pressure]) > 0 
         THEN TRY_CAST(LEFT(pw.[pressure], CHARINDEX('/', pw.[pressure]) - 1) AS INT) 
         ELSE NULL END AS [SystolicBP],
    CASE WHEN CHARINDEX('/', pw.[pressure]) > 0 
         THEN TRY_CAST(SUBSTRING(pw.[pressure], CHARINDEX('/', pw.[pressure]) + 1, 10) AS INT) 
         ELSE NULL END AS [DiastolicBP],
    TRY_CAST(pw.[pulserate] AS INT) AS [HeartRate],
    TRY_CAST(pw.[respiratoryrate] AS INT) AS [RespiratoryRate],
    TRY_CAST(pw.[temperature] AS DECIMAL(4,1)) AS [Temperature],
    NULL AS [OxygenSaturation],
    TRY_CAST(pw.[weight] AS DECIMAL(5,2)) AS [WeightKg],
    CASE WHEN pw.[height] IS NOT NULL AND pw.[height] > 0 AND pw.[height] < 3 
         THEN TRY_CAST(pw.[height] * 100 AS DECIMAL(5,2)) 
         ELSE TRY_CAST(pw.[height] AS DECIMAL(5,2)) END AS [HeightCm],
    TRY_CAST(pw.[bmi] AS DECIMAL(5,2)) AS [Bmi],
    NULL AS [BloodGlucose],
    NULL AS [PainScale],
    COALESCE(NULLIF(LTRIM(RTRIM(s.[appNote])), ''), NULLIF(LTRIM(RTRIM(c.[chiefcompliant])), ''), NULLIF(LTRIM(RTRIM(c.[subjective])), ''), 'Routine consultation') AS [ChiefComplaint],
    NULLIF(LTRIM(RTRIM(
        ISNULL(s.[diagnosistype], '') + 
        CASE WHEN NULLIF(LTRIM(RTRIM(c.[diagnosis])), '') IS NOT NULL THEN ' | ' + c.[diagnosis] ELSE '' END
    )), '') AS [NurseNotes],
    COALESCE(md.[NewDoctorId], @fbDocId, 1) AS [AssignedDoctorId],
    NULL AS [AssignedRoomId],
    CASE WHEN c.[id] IS NOT NULL OR s.[ispaid] = 1 THEN 'Completed' ELSE 'AssignedToDoctor' END AS [Status],
    NULL AS [HoldReason],
    NULL AS [HoldDurationMin],
    COALESCE(md.[NewUserId], @fbUsrId, 1) AS [TriagedBy],
    ISNULL(s.[regdate], s.[createOndate]) AS [TriagedAt],
    ISNULL(s.[regdate], s.[createOndate]) AS [UpdatedAt]
FROM dbOHMS.dbo.[tblSchedule] s
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(s.[patid])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(s.[doctor]))) = md.[DoctorNameVariant]
LEFT JOIN ClinicDB.dbo.[Appointments] a 
    ON a.[PatientId] = mp.[NewId] 
   AND a.[DoctorId] = COALESCE(md.[NewDoctorId], @fbDocId, 1) 
   AND CAST(a.[SlotDateTime] AS DATE) = CAST(s.[createOndate] AS DATE)
OUTER APPLY (
    SELECT TOP 1 *
    FROM dbOHMS.dbo.[PatientWeight] w
    WHERE LTRIM(RTRIM(w.[patID])) = LTRIM(RTRIM(s.[patid]))
      AND CAST(w.[measuredOnDate] AS DATE) = CAST(s.[createOndate] AS DATE)
    ORDER BY w.[id] DESC
) pw
OUTER APPLY (
    SELECT TOP 1 *
    FROM dbOHMS.dbo.[tblConsultation] c_sub
    WHERE LTRIM(RTRIM(c_sub.[patID])) = LTRIM(RTRIM(s.[patid]))
      AND CAST(c_sub.[consultDate] AS DATE) = CAST(s.[createOndate] AS DATE)
    ORDER BY c_sub.[id] DESC
) c
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[PatientTriage] ex
    WHERE ex.[PatientId] = mp.[NewId]
      AND CAST(ex.[TriagedAt] AS DATE) = CAST(s.[createOndate] AS DATE)
)
OPTION (MAXDOP 1);

DECLARE @triageSchedCount INT = @@ROWCOUNT;

-- 2. Insert from tblConsultation (walk-in consultations without same-day schedule)
INSERT INTO ClinicDB.dbo.[PatientTriage] (
    [TenantId], [PatientId], [AppointmentId], [QueueId], [TriageCategory], [PriorityLevel],
    [SystolicBP], [DiastolicBP], [HeartRate], [RespiratoryRate], [Temperature], [OxygenSaturation],
    [WeightKg], [HeightCm], [Bmi], [BloodGlucose], [PainScale],
    [ChiefComplaint], [NurseNotes],
    [AssignedDoctorId], [AssignedRoomId], [Status],
    [HoldReason], [HoldDurationMin],
    [TriagedBy], [TriagedAt], [UpdatedAt]
)
SELECT
    1 AS [TenantId],
    mp.[NewId] AS [PatientId],
    NULL AS [AppointmentId],
    NULL AS [QueueId],
    'General Consultation' AS [TriageCategory],
    3 AS [PriorityLevel],
    CASE WHEN CHARINDEX('/', pw.[pressure]) > 0 
         THEN TRY_CAST(LEFT(pw.[pressure], CHARINDEX('/', pw.[pressure]) - 1) AS INT) 
         ELSE NULL END AS [SystolicBP],
    CASE WHEN CHARINDEX('/', pw.[pressure]) > 0 
         THEN TRY_CAST(SUBSTRING(pw.[pressure], CHARINDEX('/', pw.[pressure]) + 1, 10) AS INT) 
         ELSE NULL END AS [DiastolicBP],
    TRY_CAST(pw.[pulserate] AS INT) AS [HeartRate],
    TRY_CAST(pw.[respiratoryrate] AS INT) AS [RespiratoryRate],
    TRY_CAST(pw.[temperature] AS DECIMAL(4,1)) AS [Temperature],
    NULL AS [OxygenSaturation],
    TRY_CAST(pw.[weight] AS DECIMAL(5,2)) AS [WeightKg],
    CASE WHEN pw.[height] IS NOT NULL AND pw.[height] > 0 AND pw.[height] < 3 
         THEN TRY_CAST(pw.[height] * 100 AS DECIMAL(5,2)) 
         ELSE TRY_CAST(pw.[height] AS DECIMAL(5,2)) END AS [HeightCm],
    TRY_CAST(pw.[bmi] AS DECIMAL(5,2)) AS [Bmi],
    NULL AS [BloodGlucose],
    NULL AS [PainScale],
    COALESCE(NULLIF(LTRIM(RTRIM(c.[chiefcompliant])), ''), NULLIF(LTRIM(RTRIM(c.[subjective])), ''), 'Walk-in consultation') AS [ChiefComplaint],
    NULLIF(LTRIM(RTRIM(c.[diagnosis])), '') AS [NurseNotes],
    COALESCE(md.[NewDoctorId], @fbDocId, 1) AS [AssignedDoctorId],
    NULL AS [AssignedRoomId],
    'Completed' AS [Status],
    NULL AS [HoldReason],
    NULL AS [HoldDurationMin],
    COALESCE(md.[NewUserId], @fbUsrId, 1) AS [TriagedBy],
    ISNULL(CAST(c.[consultDate] AS DATETIME2), GETDATE()) AS [TriagedAt],
    ISNULL(CAST(c.[consultDate] AS DATETIME2), GETDATE()) AS [UpdatedAt]
FROM dbOHMS.dbo.[tblConsultation] c
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(c.[patID])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(c.[DocCode]))) = md.[DoctorNameVariant]
OUTER APPLY (
    SELECT TOP 1 *
    FROM dbOHMS.dbo.[PatientWeight] w
    WHERE LTRIM(RTRIM(w.[patID])) = LTRIM(RTRIM(c.[patID]))
      AND CAST(w.[measuredOnDate] AS DATE) = CAST(c.[consultDate] AS DATE)
    ORDER BY w.[id] DESC
) pw
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[PatientTriage] ex
    WHERE ex.[PatientId] = mp.[NewId]
      AND CAST(ex.[TriagedAt] AS DATE) = CAST(c.[consultDate] AS DATE)
)
OPTION (MAXDOP 1);

DECLARE @triageConsultCount INT = @@ROWCOUNT;
DECLARE @totalTriage INT = @triageSchedCount + @triageConsultCount;

INSERT INTO dbo.[MigrationLog] VALUES ('Step 7B', 'tblSchedule+tblConsultation', 'PatientTriage', (SELECT COUNT(*) FROM dbOHMS.dbo.[tblSchedule]), @totalTriage, 'OK', 'Schedule + Walk-in Consultations mapped to PatientTriage', GETDATE());
PRINT '--> [COMPLETED] Step 7B: PatientTriage populated | Total: ' + CAST(@totalTriage AS VARCHAR) + ' rows (Schedule: ' + CAST(@triageSchedCount AS VARCHAR) + ', Walk-in: ' + CAST(@triageConsultCount AS VARCHAR) + ').';
RAISERROR('--> [COMPLETED] Step 7B: PatientTriage done (%d records).', 0, 1, @totalTriage) WITH NOWAIT;
GO

-- ============================================================
-- STEP 8: VITAL SIGNS
-- Source: [dbOHMS.dbo.PatientWeight]
-- Target: [ClinicDB.dbo.Encounters] (Vital Signs JSON format)
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[PatientWeight]);
PRINT '------------------------------------------------------------';
PRINT 'Step 8/12: Migrating [dbOHMS.dbo.PatientWeight] -> [ClinicDB.dbo.Encounters] (Vital Signs JSON format)';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 8/12: Migrating [dbOHMS.dbo.PatientWeight] -> [ClinicDB.dbo.Encounters] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);
DECLARE @fbUsrId INT = (SELECT TOP 1 [NewUserId] FROM dbo.[Map_DoctorName]);
IF @fbUsrId IS NULL SET @fbUsrId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Users]);

INSERT INTO ClinicDB.dbo.[Encounters] (
    [TenantId], [PatientId], [DoctorId], [EncounterDate], [EncounterTime],
    [ChiefComplaint], [VitalSigns], [IsFinalized], [FinalizedAt], [CreatedAt], [CreatedBy]
)
SELECT
    1,
    mp.[NewId],
    COALESCE(@fbDocId, 1),
    pw.[measuredOnDate],
    CAST(GETDATE() AS TIME),
    'Vital Signs Assessment (Migrated)',
    '{' +
        '"BP":"'   + ISNULL(LTRIM(RTRIM(pw.[pressure])),'')        + '",' +
        '"HR":"'   + ISNULL(LTRIM(RTRIM(pw.[pulserate])),'')       + '",' +
        '"RR":"'   + ISNULL(LTRIM(RTRIM(pw.[respiratoryrate])),'') + '",' +
        '"Temp":"' + ISNULL(LTRIM(RTRIM(pw.[temperature])),'')     + '",' +
        '"Weight":'+ ISNULL(CAST(pw.[weight] AS NVARCHAR(20)),'null') + ',' +
        '"Height":'+ ISNULL(CAST(pw.[height] AS NVARCHAR(20)),'null') + ',' +
        '"BMI":'   + ISNULL(CAST(pw.[bmi]    AS NVARCHAR(20)),'null') +
    '}',
    1,
    pw.[measuredOnDate],
    CAST(pw.[measuredOnDate] AS DATETIME2),
    COALESCE(@fbUsrId, 1)
FROM dbOHMS.dbo.[PatientWeight] pw
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(pw.[patID])) = mp.[OldMRN];

DECLARE @vitalCount INT = @@ROWCOUNT;
INSERT INTO dbo.[MigrationLog] VALUES ('Step 8', 'PatientWeight', 'Encounters (VitalSigns)', @srcCount, @vitalCount, 'OK', 'Vitals formatted to JSON string in Encounters.VitalSigns', GETDATE());
PRINT '--> [COMPLETED] Step 8/12: [dbOHMS.dbo.PatientWeight] -> [ClinicDB.dbo.Encounters] | Processed: ' + CAST(@vitalCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 8/12: Vital Signs done (%d records).', 0, 1, @vitalCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 9: LABORATORY
-- Source: [dbOHMS.dbo.tblLaboratory]
-- Target: [ClinicDB.dbo.LabTestCatalog], [ClinicDB.dbo.LabOrders], [ClinicDB.dbo.LabOrderItems]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblLaboratory]);
PRINT '------------------------------------------------------------';
PRINT 'Step 9/12: Migrating [dbOHMS.dbo.tblLaboratory] -> [ClinicDB.dbo.LabOrders] & [ClinicDB.dbo.LabOrderItems]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 9/12: Migrating [dbOHMS.dbo.tblLaboratory] -> [ClinicDB.dbo.LabOrders] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

-- 9a. Pre-populate LabTestCatalog
PRINT '  [Step 9 Action 1/4] Populating LabTestCatalog from distinct test names...';
RAISERROR('  [Step 9 Action 1/4] Populating LabTestCatalog...', 0, 1) WITH NOWAIT;

;WITH DistinctTests AS (
    SELECT 
        LTRIM(RTRIM(ISNULL(NULLIF(l.[testname], ''), 'General Lab Test'))) AS [CleanName],
        MAX(LTRIM(RTRIM(l.[testcode]))) AS [RawCategory]
    FROM dbOHMS.dbo.[tblLaboratory] l
    GROUP BY LTRIM(RTRIM(ISNULL(NULLIF(l.[testname], ''), 'General Lab Test')))
)
INSERT INTO ClinicDB.dbo.[LabTestCatalog] (
    [TenantId], [TestCode], [TestName], [Category], [ResultType], [IsActive]
)
SELECT
    1,
    'LAB-' + RIGHT('0000' + CAST(ROW_NUMBER() OVER (ORDER BY dt.[CleanName]) AS VARCHAR), 4),
    LEFT(dt.[CleanName], 200),
    LEFT(COALESCE(NULLIF(dt.[RawCategory], ''), 'General'), 100),
    2, 1
FROM DistinctTests dt
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[LabTestCatalog] tc
    WHERE tc.[TenantId] = 1 AND tc.[TestName] = LEFT(dt.[CleanName], 200)
)
OPTION (MAXDOP 1);
DECLARE @catRows INT = @@ROWCOUNT;
PRINT '  --> LabTestCatalog populated: ' + CAST(@catRows AS VARCHAR) + ' test types.';
RAISERROR('  --> LabTestCatalog: %d test types added.', 0, 1, @catRows) WITH NOWAIT;

-- 9b. Map LabTestId
PRINT '  [Step 9 Action 2/4] Building Map_LabTestId cross-reference...';
RAISERROR('  [Step 9 Action 2/4] Building Map_LabTestId...', 0, 1) WITH NOWAIT;
INSERT INTO dbo.[Map_LabTestId] ([OldTestName], [NewTestId])
SELECT DISTINCT
    LEFT(LTRIM(RTRIM(ISNULL(NULLIF(l.[testname], ''), 'General Lab Test'))), 300),
    tc.[Id]
FROM dbOHMS.dbo.[tblLaboratory] l
JOIN ClinicDB.dbo.[LabTestCatalog] tc
    ON tc.[TestName] = LEFT(LTRIM(RTRIM(ISNULL(NULLIF(l.[testname], ''), 'General Lab Test'))), 200)
    AND tc.[TenantId] = 1
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.[Map_LabTestId] m
    WHERE m.[OldTestName] = LEFT(LTRIM(RTRIM(ISNULL(NULLIF(l.[testname], ''), 'General Lab Test'))), 300)
)
OPTION (MAXDOP 1);
DECLARE @mapLabRows INT = @@ROWCOUNT;
PRINT '  --> Map_LabTestId populated: ' + CAST(@mapLabRows AS VARCHAR) + ' mappings.';
RAISERROR('  --> Map_LabTestId: %d mappings.', 0, 1, @mapLabRows) WITH NOWAIT;

-- 9c. Insert LabOrders
PRINT '  [Step 9 Action 3/4] Inserting LabOrders...';
RAISERROR('  [Step 9 Action 3/4] Inserting LabOrders...', 0, 1) WITH NOWAIT;
DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);

INSERT INTO ClinicDB.dbo.[LabOrders] (
    [TenantId], [OrderNumber], [PatientId], [OrderedBy],
    [Priority], [OrderedAt], [ClinicalInfo], [StatusId], [CreatedAt]
)
SELECT
    1,
    'LAB-' + RIGHT('000000' + CAST(l.[labid] AS VARCHAR), 6),
    mp.[NewId],
    COALESCE(@fbDocId, 1),
    CASE WHEN l.[urgent] = 1 THEN 1 ELSE 2 END,
    ISNULL(l.[requestdate], GETDATE()),
    NULLIF(LTRIM(RTRIM(l.[clinicaldata])),''),
    4, -- Resulted
    ISNULL(l.[requestdate], GETDATE())
FROM dbOHMS.dbo.[tblLaboratory] l
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(l.[patid])) = mp.[OldMRN]
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[LabOrders] lo
    WHERE lo.[TenantId] = 1 AND lo.[OrderNumber] = 'LAB-' + RIGHT('000000' + CAST(l.[labid] AS VARCHAR), 6)
)
OPTION (MAXDOP 1);
DECLARE @ordRows INT = @@ROWCOUNT;
PRINT '  --> LabOrders inserted: ' + CAST(@ordRows AS VARCHAR) + ' orders.';
RAISERROR('  --> LabOrders: %d orders inserted.', 0, 1, @ordRows) WITH NOWAIT;

-- 9d. Insert LabOrderItems
PRINT '  [Step 9 Action 4/4] Inserting LabOrderItems...';
RAISERROR('  [Step 9 Action 4/4] Inserting LabOrderItems...', 0, 1) WITH NOWAIT;
INSERT INTO ClinicDB.dbo.[LabOrderItems] ([OrderId], [TestId], [StatusId])
SELECT lo.[Id], mt.[NewTestId], 4
FROM dbOHMS.dbo.[tblLaboratory] l
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(l.[patid])) = mp.[OldMRN]
JOIN ClinicDB.dbo.[LabOrders] lo
    ON lo.[OrderNumber] = 'LAB-' + RIGHT('000000' + CAST(l.[labid] AS VARCHAR), 6)
    AND lo.[TenantId] = 1
JOIN dbo.[Map_LabTestId] mt
    ON mt.[OldTestName] = LEFT(LTRIM(RTRIM(ISNULL(NULLIF(l.[testname], ''), 'General Lab Test'))), 300)
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[LabOrderItems] loi
    WHERE loi.[OrderId] = lo.[Id] AND loi.[TestId] = mt.[NewTestId]
)
OPTION (MAXDOP 1);
DECLARE @itemRows INT = @@ROWCOUNT;
PRINT '  --> LabOrderItems inserted: ' + CAST(@itemRows AS VARCHAR) + ' items.';
RAISERROR('  --> LabOrderItems: %d items inserted.', 0, 1, @itemRows) WITH NOWAIT;

DECLARE @labCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[LabOrders] WHERE [TenantId] = 1);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 9', 'tblLaboratory', 'LabOrders & Items', @srcCount, @labCount, 'OK', 'Tests registered in LabTestCatalog, marked Resulted', GETDATE());
PRINT '--> [COMPLETED] Step 9/12: [dbOHMS.dbo.tblLaboratory] -> [ClinicDB.dbo.LabOrders] & [ClinicDB.dbo.LabOrderItems] | Processed: ' + CAST(@labCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 9/12: Laboratory done (%d orders).', 0, 1, @labCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 10: PRESCRIPTIONS
-- Source: [dbOHMS.dbo.tblPrescription]
-- Target: [ClinicDB.dbo.DrugFormulary], [ClinicDB.dbo.Prescriptions], [ClinicDB.dbo.PrescriptionItems]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblPrescription]);
PRINT '------------------------------------------------------------';
PRINT 'Step 10/12: Migrating [dbOHMS.dbo.tblPrescription] -> [ClinicDB.dbo.Prescriptions] & [ClinicDB.dbo.PrescriptionItems]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 10/12: Migrating [dbOHMS.dbo.tblPrescription] -> [ClinicDB.dbo.Prescriptions] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

-- 10a. Populate DrugFormulary
PRINT '  [Step 10 Action 1/6] Populating DrugFormulary from distinct medication names...';
RAISERROR('  [Step 10 Action 1/6] Populating DrugFormulary...', 0, 1) WITH NOWAIT;

INSERT INTO ClinicDB.dbo.[DrugFormulary] ([TenantId], [GenericName], [IsActive])
SELECT DISTINCT 1, LEFT(LTRIM(RTRIM(p.[medname])), 200), 1
FROM dbOHMS.dbo.[tblPrescription] p
WHERE NULLIF(LTRIM(RTRIM(p.[medname])),'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM ClinicDB.dbo.[DrugFormulary] df
      WHERE df.[TenantId] = 1 AND df.[GenericName] = LEFT(LTRIM(RTRIM(p.[medname])), 200)
  )
OPTION (MAXDOP 1);

DECLARE @drugCount INT = @@ROWCOUNT;
PRINT '  --> DrugFormulary populated: ' + CAST(@drugCount AS VARCHAR) + ' medicines added.';
RAISERROR('  --> DrugFormulary: %d medicines added.', 0, 1, @drugCount) WITH NOWAIT;

-- 10b. Map DrugId
PRINT '  [Step 10 Action 2/6] Building Map_DrugId cross-reference...';
RAISERROR('  [Step 10 Action 2/6] Building Map_DrugId...', 0, 1) WITH NOWAIT;

INSERT INTO dbo.[Map_DrugId] ([OldDrugName], [NewDrugId])
SELECT DISTINCT LEFT(LTRIM(RTRIM(p.[medname])), 450), df.[Id]
FROM dbOHMS.dbo.[tblPrescription] p
JOIN ClinicDB.dbo.[DrugFormulary] df
    ON df.[GenericName] = LEFT(LTRIM(RTRIM(p.[medname])), 200)
    AND df.[TenantId] = 1
WHERE NULLIF(LTRIM(RTRIM(p.[medname])),'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.[Map_DrugId] WHERE [OldDrugName] = LEFT(LTRIM(RTRIM(p.[medname])), 450)
  )
OPTION (MAXDOP 1);

DECLARE @mapDrugRows INT = @@ROWCOUNT;
PRINT '  --> Map_DrugId populated: ' + CAST(@mapDrugRows AS VARCHAR) + ' mappings.';
RAISERROR('  --> Map_DrugId: %d mappings.', 0, 1, @mapDrugRows) WITH NOWAIT;

-- 10c. Ensure every prescription patient has an Encounter
PRINT '  [Step 10 Action 3/6] Ensuring prescription patients have an Encounter...';
RAISERROR('  [Step 10 Action 3/6] Ensuring prescription patients have an Encounter...', 0, 1) WITH NOWAIT;

DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);
DECLARE @fbUsrId INT = (SELECT TOP 1 [NewUserId] FROM dbo.[Map_DoctorName]);
IF @fbUsrId IS NULL SET @fbUsrId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Users]);

INSERT INTO ClinicDB.dbo.[Encounters] (
    [TenantId], [PatientId], [DoctorId], [EncounterDate], [EncounterTime],
    [ChiefComplaint], [IsFinalized], [FinalizedAt], [CreatedAt], [CreatedBy]
)
SELECT DISTINCT
    1,
    mp.[NewId],
    COALESCE(md.[NewDoctorId], @fbDocId, 1),
    CAST(ISNULL(p.[prescriptiondate], GETDATE()) AS DATE),
    CAST(GETDATE() AS TIME),
    'Prescription Dispensing (Legacy)',
    1,
    ISNULL(CAST(p.[prescriptiondate] AS DATETIME2), GETDATE()),
    ISNULL(CAST(p.[prescriptiondate] AS DATETIME2), GETDATE()),
    COALESCE(md.[NewUserId], @fbUsrId, 1)
FROM dbOHMS.dbo.[tblPrescription] p
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(p.[patid])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(p.[docname]))) = md.[DoctorNameVariant]
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[Encounters] e WHERE e.[PatientId] = mp.[NewId]
)
OPTION (MAXDOP 1);

DECLARE @encAdded INT = @@ROWCOUNT;
PRINT '  --> Default Encounters created for patients without prior visits: ' + CAST(@encAdded AS VARCHAR);
RAISERROR('  --> Default Encounters created: %d', 0, 1, @encAdded) WITH NOWAIT;

-- 10d. Fast pre-indexed Encounter lookup per patient
PRINT '  [Step 10 Action 4/6] Pre-indexing Encounter IDs per patient...';
RAISERROR('  [Step 10 Action 4/6] Pre-indexing Encounter IDs per patient...', 0, 1) WITH NOWAIT;

DROP TABLE IF EXISTS #PatEncounter;
SELECT 
    [PatientId], 
    MIN([Id]) AS [EncounterId]
INTO #PatEncounter
FROM ClinicDB.dbo.[Encounters]
GROUP BY [PatientId];

CREATE CLUSTERED INDEX [IX_PatEncounter] ON #PatEncounter ([PatientId]);

-- 10e. Insert Prescriptions Headers
PRINT '  [Step 10 Action 5/6] Inserting Prescription headers...';
RAISERROR('  [Step 10 Action 5/6] Inserting Prescription headers...', 0, 1) WITH NOWAIT;

;WITH PrescGroups AS (
    SELECT 
        p.[prescriptionid],
        LTRIM(RTRIM(p.[patid])) AS [patid],
        MIN(p.[prescriptiondate]) AS [PrescDate],
        MAX(LTRIM(RTRIM(p.[docname]))) AS [docname]
    FROM dbOHMS.dbo.[tblPrescription] p
    WHERE p.[prescriptionid] IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(p.[patid])),'') IS NOT NULL
    GROUP BY p.[prescriptionid], LTRIM(RTRIM(p.[patid]))
)
INSERT INTO ClinicDB.dbo.[Prescriptions] (
    [TenantId], [EncounterId], [PatientId], [PrescribedBy], [PrescribedAt], [IsDispensed], [Notes]
)
SELECT
    1,
    pe.[EncounterId],
    mp.[NewId],
    COALESCE(md.[NewDoctorId], @fbDocId, 1),
    ISNULL(pg.[PrescDate], GETDATE()),
    1,
    'Legacy PrescID: ' + CAST(pg.[prescriptionid] AS VARCHAR)
FROM PrescGroups pg
JOIN dbo.[Map_PatientId] mp ON pg.[patid] = mp.[OldMRN]
JOIN #PatEncounter pe ON pe.[PatientId] = mp.[NewId]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(pg.[docname]))) = md.[DoctorNameVariant]
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[Prescriptions] cp
    WHERE cp.[TenantId] = 1
      AND cp.[PatientId] = mp.[NewId]
      AND cp.[Notes] = 'Legacy PrescID: ' + CAST(pg.[prescriptionid] AS VARCHAR)
)
OPTION (MAXDOP 1);

DECLARE @prescHeadersCount INT = @@ROWCOUNT;
PRINT '  --> Prescriptions headers inserted: ' + CAST(@prescHeadersCount AS VARCHAR) + ' records.';
RAISERROR('  --> Prescriptions headers: %d records.', 0, 1, @prescHeadersCount) WITH NOWAIT;

-- 10f. Build index mapping for PrescriptionItems
PRINT '  [Step 10 Action 6/6] Mapping and inserting PrescriptionItems...';
RAISERROR('  [Step 10 Action 6/6] Mapping and inserting PrescriptionItems...', 0, 1) WITH NOWAIT;

DROP TABLE IF EXISTS #PrescMap;
SELECT 
    cp.[Id] AS [NewPrescId], 
    cp.[PatientId], 
    TRY_CAST(REPLACE(cp.[Notes], 'Legacy PrescID: ', '') AS INT) AS [OldPrescId]
INTO #PrescMap
FROM ClinicDB.dbo.[Prescriptions] cp
WHERE cp.[TenantId] = 1 AND cp.[Notes] LIKE 'Legacy PrescID: %';

CREATE CLUSTERED INDEX [IX_PrescMap] ON #PrescMap ([OldPrescId], [PatientId]);

INSERT INTO ClinicDB.dbo.[PrescriptionItems] (
    [PrescriptionId], [DrugId], [Dosage], [Frequency], [Route], [DurationDays], [Quantity], [Instructions]
)
SELECT
    pm.[NewPrescId],
    md2.[NewDrugId],
    ISNULL(NULLIF(LTRIM(RTRIM(p.[dosage])),''), 'As directed'),
    ISNULL(NULLIF(LTRIM(RTRIM(p.[frequency])),''), 'As directed'),
    'Oral',
    TRY_CAST(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(p.[length],''))), ' days', ''), ' day', ''), 'days', '') AS SMALLINT),
    1,
    NULLIF(LTRIM(RTRIM(p.[diagnosis])),'')
FROM dbOHMS.dbo.[tblPrescription] p
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(p.[patid])) = mp.[OldMRN]
JOIN #PrescMap pm ON p.[prescriptionid] = pm.[OldPrescId] AND mp.[NewId] = pm.[PatientId]
JOIN dbo.[Map_DrugId] md2 ON LEFT(LTRIM(RTRIM(p.[medname])), 450) = md2.[OldDrugName]
WHERE NULLIF(LTRIM(RTRIM(p.[medname])),'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM ClinicDB.dbo.[PrescriptionItems] pi2
      WHERE pi2.[PrescriptionId] = pm.[NewPrescId] AND pi2.[DrugId] = md2.[NewDrugId]
  )
OPTION (MAXDOP 1);

DECLARE @itemCount INT = @@ROWCOUNT;
PRINT '  --> PrescriptionItems inserted: ' + CAST(@itemCount AS VARCHAR) + ' items.';
RAISERROR('  --> PrescriptionItems: %d items.', 0, 1, @itemCount) WITH NOWAIT;

DROP TABLE IF EXISTS #PrescMap;
DROP TABLE IF EXISTS #PatEncounter;

DECLARE @rxCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[Prescriptions] WHERE [TenantId] = 1);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 10', 'tblPrescription', 'Prescriptions & Items', @srcCount, @rxCount, 'OK', 'DrugFormulary populated, line items attached', GETDATE());
PRINT '--> [COMPLETED] Step 10/12: [dbOHMS.dbo.tblPrescription] -> [ClinicDB.dbo.Prescriptions] & [ClinicDB.dbo.PrescriptionItems] | Processed: ' + CAST(@rxCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 10/12: Prescriptions done (%d records).', 0, 1, @rxCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 11: ORDERS -> INVOICES & ITEMS (WITH ENCOUNTER LINKING)
-- Source: [dbOHMS.dbo.tblOrder]
-- Target: [ClinicDB.dbo.Invoices] & [ClinicDB.dbo.InvoiceItems]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblOrder]);
PRINT '------------------------------------------------------------';
PRINT 'Step 11/12: Migrating [dbOHMS.dbo.tblOrder] -> [ClinicDB.dbo.Invoices] & [ClinicDB.dbo.InvoiceItems]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 11/12: Migrating [dbOHMS.dbo.tblOrder] -> [ClinicDB.dbo.Invoices] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

DECLARE @adminUserId INT = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Users] WHERE [TenantId] = 1 ORDER BY [Id]);

;WITH OrderNumbered AS (
    SELECT
        o.[orderid],
        LTRIM(RTRIM(o.[patid])) AS [patid],
        ISNULL(NULLIF(LTRIM(RTRIM(o.[invoiceno])),''), 'ORD-' + CAST(o.[orderid] AS VARCHAR)) AS [RawInv],
        DENSE_RANK() OVER (ORDER BY ISNULL(NULLIF(LTRIM(RTRIM(o.[invoiceno])),''), 'ORD-' + CAST(o.[orderid] AS VARCHAR)), LTRIM(RTRIM(o.[patid]))) AS [InvRank],
        o.[orderdate],
        ISNULL(o.[totalprice], 0) AS [totalprice],
        ISNULL(o.[ispaid], 0) AS [ispaid]
    FROM dbOHMS.dbo.[tblOrder] o
    WHERE NULLIF(LTRIM(RTRIM(o.[patid])),'') IS NOT NULL
),
InvoiceHeaders AS (
    SELECT
        'INV-' + RIGHT('0000000' + CAST(onum.[InvRank] AS VARCHAR), 7) AS [InvoiceNumber],
        onum.[patid],
        MIN(onum.[orderdate]) AS [OrderDate],
        SUM(onum.[totalprice]) AS [TotalAmount],
        MAX(CAST(onum.[ispaid] AS INT)) AS [IsPaid]
    FROM OrderNumbered onum
    GROUP BY onum.[InvRank], onum.[patid]
)
INSERT INTO ClinicDB.dbo.[Invoices] (
    [TenantId], [InvoiceNumber], [PatientId], [EncounterId], [StatusId],
    [IssueDate], [SubTotal], [TotalAmount], [PaidAmount], [CreatedBy], [CreatedAt]
)
SELECT
    1,
    ih.[InvoiceNumber],
    mp.[NewId],
    -- Link to closest Encounter for this patient (same-day preferred, else closest within 30 days)
    (SELECT TOP 1 e.[Id]
     FROM ClinicDB.dbo.[Encounters] e
     WHERE e.[TenantId] = 1
       AND e.[PatientId] = mp.[NewId]
       AND ABS(DATEDIFF(day, e.[EncounterDate], ISNULL(CAST(ih.[OrderDate] AS DATE), CAST(GETDATE() AS DATE)))) <= 30
     ORDER BY ABS(DATEDIFF(day, e.[EncounterDate], ISNULL(CAST(ih.[OrderDate] AS DATE), CAST(GETDATE() AS DATE)))) ASC, e.[Id] DESC),
    CASE WHEN ih.[IsPaid] = 1 THEN 4 ELSE 2 END, -- 4=Paid, 2=Issued
    ISNULL(CAST(ih.[OrderDate] AS DATE), CAST(GETDATE() AS DATE)),
    ih.[TotalAmount],
    ih.[TotalAmount],
    CASE WHEN ih.[IsPaid] = 1 THEN ih.[TotalAmount] ELSE 0 END,
    @adminUserId,
    ISNULL(ih.[OrderDate], GETDATE())
FROM InvoiceHeaders ih
JOIN dbo.[Map_PatientId] mp ON ih.[patid] = mp.[OldMRN]
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[Invoices] inv
    WHERE inv.[TenantId] = 1 AND inv.[InvoiceNumber] = ih.[InvoiceNumber]
)
OPTION (MAXDOP 1);

;WITH OrderNumbered AS (
    SELECT
        o.[orderid],
        LTRIM(RTRIM(o.[patid])) AS [patid],
        'INV-' + RIGHT('0000000' + CAST(
            DENSE_RANK() OVER (ORDER BY ISNULL(NULLIF(LTRIM(RTRIM(o.[invoiceno])),''), 'ORD-' + CAST(o.[orderid] AS VARCHAR)), LTRIM(RTRIM(o.[patid])))
        AS VARCHAR), 7) AS [InvoiceNumber],
        o.[category],
        o.[item],
        ISNULL(o.[quantity], 1) AS [quantity],
        ISNULL(o.[unitprice], 0) AS [unitprice],
        ISNULL(o.[totalprice], 0) AS [totalprice]
    FROM dbOHMS.dbo.[tblOrder] o
    WHERE NULLIF(LTRIM(RTRIM(o.[patid])),'') IS NOT NULL
)
INSERT INTO ClinicDB.dbo.[InvoiceItems] (
    [InvoiceId], [ItemType], [Description], [Quantity], [UnitPrice], [Discount], [Total]
)
SELECT
    inv.[Id],
    CASE LOWER(LTRIM(RTRIM(onum.[category])))
        WHEN 'consultation' THEN 1
        WHEN 'lab'          THEN 2
        WHEN 'laboratory'   THEN 2
        WHEN 'drug'         THEN 3
        WHEN 'pharmacy'     THEN 3
        WHEN 'procedure'    THEN 4
        ELSE 5
    END,
    LEFT(ISNULL(LTRIM(RTRIM(onum.[item])), 'Service Item'), 200),
    onum.[quantity],
    onum.[unitprice],
    0,
    onum.[totalprice]
FROM OrderNumbered onum
JOIN ClinicDB.dbo.[Invoices] inv
    ON inv.[InvoiceNumber] = onum.[InvoiceNumber]
    AND inv.[TenantId] = 1
OPTION (MAXDOP 1);

DECLARE @invCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[Invoices] WHERE [TenantId] = 1);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 11', 'tblOrder', 'Invoices & InvoiceItems', @srcCount, @invCount, 'OK', 'All invoices generated with unique InvoiceNumber and EncounterId linked', GETDATE());
PRINT '--> [COMPLETED] Step 11/12: [dbOHMS.dbo.tblOrder] -> [ClinicDB.dbo.Invoices] & [ClinicDB.dbo.InvoiceItems] | Processed: ' + CAST(@invCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 11/12: Invoices done (%d invoices).', 0, 1, @invCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 12: MEDICAL CERTIFICATES
-- Source: [dbOHMS.dbo.tblMedicalCertificate]
-- Target: [ClinicDB.dbo.MedicalCertificates]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblMedicalCertificate]);
PRINT '------------------------------------------------------------';
PRINT 'Step 12/12: Migrating [dbOHMS.dbo.tblMedicalCertificate] -> [ClinicDB.dbo.MedicalCertificates]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 12/12: Migrating [dbOHMS.dbo.tblMedicalCertificate] -> [ClinicDB.dbo.MedicalCertificates] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);

INSERT INTO ClinicDB.dbo.[MedicalCertificates] (
    [TenantId], [CertificateNo], [PatientId], [DoctorId], [EncounterId],
    [CertificateType], [DiagnosisSummary], [Recommendation],
    [StartDate], [EndDate], [DaysExcused], [QrVerificationCode],
    [IsIssued], [IssuedAt], [CreatedAt]
)
SELECT
    1,
    'MC-' + RIGHT('000000' + CAST(mc.[id] AS VARCHAR), 6),
    mp.[NewId],
    COALESCE(md.[NewDoctorId], @fbDocId, 1),
    NULL,
    'SickLeave',
    LEFT(ISNULL(NULLIF(LTRIM(RTRIM(mc.[diagnosis])),''), 'Medical assessment completed'), 500),
    LEFT(ISNULL(NULLIF(LTRIM(RTRIM(mc.[recommendation])),''), 'Rest as recommended'), 1000),
    ISNULL(mc.[examinedon], CAST(ISNULL(mc.[regdate], GETDATE()) AS DATE)),
    DATEADD(day, 
        CASE 
            WHEN ISNULL(TRY_CAST(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(mc.[rest],'1'))), ' days', ''), ' day', ''), 'days', '') AS INT), 1) <= 0 
                THEN 1 
            ELSE ISNULL(TRY_CAST(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(mc.[rest],'1'))), ' days', ''), ' day', ''), 'days', '') AS INT), 1) 
        END, 
        ISNULL(mc.[examinedon], CAST(ISNULL(mc.[regdate], GETDATE()) AS DATE))
    ),
    CASE 
        WHEN ISNULL(TRY_CAST(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(mc.[rest],'1'))), ' days', ''), ' day', ''), 'days', '') AS INT), 1) <= 0 
            THEN 1 
        ELSE ISNULL(TRY_CAST(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(mc.[rest],'1'))), ' days', ''), ' day', ''), 'days', '') AS INT), 1) 
    END,
    ISNULL(CAST(mc.[hash] AS VARCHAR(64)), 'MC-VERIFY-' + RIGHT('000000' + CAST(mc.[id] AS VARCHAR), 6)),
    1,
    ISNULL(mc.[regdate], GETDATE()),
    ISNULL(mc.[regdate], GETDATE())
FROM dbOHMS.dbo.[tblMedicalCertificate] mc
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(mc.[patid])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(
    REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(mc.[doctor],''))),'Dr. ',''),'Dr.','')
))) = md.[DoctorNameVariant]
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[MedicalCertificates] med
    WHERE med.[TenantId] = 1
      AND med.[CertificateNo] = 'MC-' + RIGHT('000000' + CAST(mc.[id] AS VARCHAR), 6)
)
OPTION (MAXDOP 1);

DECLARE @mcCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[MedicalCertificates] WHERE [TenantId] = 1);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 12', 'tblMedicalCertificate', 'MedicalCertificates', @srcCount, @mcCount, 'OK', 'MedicalCertificates table populated', GETDATE());
PRINT '--> [COMPLETED] Step 12/12: [dbOHMS.dbo.tblMedicalCertificate] -> [ClinicDB.dbo.MedicalCertificates] | Processed: ' + CAST(@mcCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 12/12: Medical Certificates done (%d certificates).', 0, 1, @mcCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 13: PAYROLL AGREEMENTS TABLE + SEEDING
-- Creates PayrollAgreements if it does not exist, then seeds
-- standard commission categories for all doctors.
-- Idempotent: skips rows that already exist (TenantId, DoctorId, Category).
-- ============================================================
PRINT '------------------------------------------------------------';
PRINT 'Step 13/15: PayrollAgreements — create table & seed defaults...';
RAISERROR('Step 13/15: PayrollAgreements...', 0, 1) WITH NOWAIT;

IF OBJECT_ID('ClinicDB.dbo.PayrollAgreements', 'U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[PayrollAgreements] (
        [Id]        INT             NOT NULL IDENTITY(1,1),
        [TenantId]  TINYINT         NOT NULL DEFAULT 1,
        [DoctorId]  INT             NOT NULL,
        [Category]  NVARCHAR(100)   NOT NULL,
        [RateType]  TINYINT         NOT NULL DEFAULT 1, -- 1=Percentage, 2=Fixed Amount
        [Rate]      DECIMAL(10,2)   NOT NULL DEFAULT 0,
        [IsActive]  BIT             NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2       NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_PayrollAgreements PRIMARY KEY ([Id]),
        CONSTRAINT FK_PayrollAgreements_Tenants FOREIGN KEY ([TenantId]) REFERENCES ClinicDB.dbo.[Tenants]([Id]),
        CONSTRAINT FK_PayrollAgreements_Doctors FOREIGN KEY ([DoctorId]) REFERENCES ClinicDB.dbo.[Doctors]([Id]),
        CONSTRAINT UQ_PayrollAgreements_Doc_Cat UNIQUE ([TenantId], [DoctorId], [Category])
    );
    CREATE INDEX IX_PayrollAgreements_Doctor ON ClinicDB.dbo.[PayrollAgreements] ([TenantId], [DoctorId], [IsActive]);
    PRINT '--> Created table PayrollAgreements.';
END
ELSE
    PRINT '--> PayrollAgreements already exists — skipping CREATE.';
GO

INSERT INTO ClinicDB.dbo.[PayrollAgreements] ([TenantId], [DoctorId], [Category], [RateType], [Rate], [IsActive], [CreatedAt], [UpdatedAt])
SELECT
    1,
    d.[Id],
    cats.[Category],
    1, -- 1=Percentage
    cats.[Rate],
    1,
    GETDATE(),
    GETDATE()
FROM ClinicDB.dbo.[Doctors] d
CROSS JOIN (VALUES
    ('Consultation',            50.00),
    ('Facial Aesthetics',       30.00),
    ('PRP Regenerative',        40.00),
    ('Intralesional Injection',  40.00),
    ('Electrotherapy',          35.00),
    ('Acne & Scarring',         35.00),
    ('Cryosurgery',             35.00),
    ('Laser & Pigment',         30.00),
    ('Hair Restoration',        35.00),
    ('Minor Procedure',         40.00),
    ('General Service',         30.00)
) AS cats([Category], [Rate])
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[PayrollAgreements] pa
    WHERE pa.[TenantId] = 1 AND pa.[DoctorId] = d.[Id] AND pa.[Category] = cats.[Category]
);

DECLARE @paCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[PayrollAgreements]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 13', 'N/A (seed)', 'PayrollAgreements', 0, @paCount, 'OK', 'Table ensured; standard payroll categories seeded for all doctors', GETDATE());
PRINT '--> [COMPLETED] Step 13/15: PayrollAgreements total: ' + CAST(@paCount AS VARCHAR);
RAISERROR('--> [COMPLETED] Step 13/15: PayrollAgreements done (%d rows).', 0, 1, @paCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 14: CHAPA PAYMENT GATEWAY TRANSACTIONS TABLE
-- Creates ChapaTransactions if it does not exist.
-- No legacy data to migrate — table is new with this system.
-- ============================================================
PRINT '------------------------------------------------------------';
PRINT 'Step 14/15: ChapaTransactions — ensure table exists...';
RAISERROR('Step 14/15: ChapaTransactions...', 0, 1) WITH NOWAIT;

IF OBJECT_ID('ClinicDB.dbo.ChapaTransactions', 'U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[ChapaTransactions] (
        [Id]             INT             NOT NULL IDENTITY(1,1),
        [TenantId]       TINYINT         NOT NULL DEFAULT 1,
        [InvoiceId]      INT             NOT NULL,
        [TxRef]          VARCHAR(100)    NOT NULL UNIQUE,
        [Amount]         DECIMAL(12,2)   NOT NULL,
        [Currency]       VARCHAR(10)     NOT NULL DEFAULT 'ETB',
        [Email]          VARCHAR(100)    NULL,
        [FirstName]      NVARCHAR(100)   NULL,
        [LastName]       NVARCHAR(100)   NULL,
        [PaymentStatus]  VARCHAR(30)     NOT NULL DEFAULT 'pending',
        [CheckoutUrl]    NVARCHAR(500)   NULL,
        [ChapaReference] VARCHAR(100)    NULL,
        [CreatedAt]      DATETIME2       NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]      DATETIME2       NULL,
        CONSTRAINT PK_ChapaTransactions PRIMARY KEY ([Id]),
        CONSTRAINT FK_ChapaTransactions_Invoices FOREIGN KEY ([InvoiceId]) REFERENCES ClinicDB.dbo.[Invoices]([Id])
    );
    CREATE INDEX IX_ChapaTransactions_Invoice ON ClinicDB.dbo.[ChapaTransactions] ([TenantId], [InvoiceId]);
    CREATE INDEX IX_ChapaTransactions_TxRef   ON ClinicDB.dbo.[ChapaTransactions] ([TxRef]);
    PRINT '--> Created table ChapaTransactions.';
END
ELSE
    PRINT '--> ChapaTransactions already exists — skipping CREATE.';

DECLARE @chapaCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[ChapaTransactions]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 14', 'N/A (new table)', 'ChapaTransactions', 0, @chapaCount, 'OK', 'Table ensured; no legacy data to migrate', GETDATE());
PRINT '--> [COMPLETED] Step 14/15: ChapaTransactions total: ' + CAST(@chapaCount AS VARCHAR);
RAISERROR('--> [COMPLETED] Step 14/15: ChapaTransactions done (%d rows).', 0, 1, @chapaCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 15: LAB TEST PARAMETERS — ENSURE TABLE + SEED PANELS
-- Creates LabTestParameters if it does not exist, then seeds
-- standard sub-parameters for CBC, Lipid Profile, and Glucose.
-- Idempotent: skips rows that already exist (TestCatalogId, ParameterCode).
-- ============================================================
PRINT '------------------------------------------------------------';
PRINT 'Step 15/15: LabTestParameters — ensure table & seed standard panels...';
RAISERROR('Step 15/15: LabTestParameters...', 0, 1) WITH NOWAIT;

IF OBJECT_ID('ClinicDB.dbo.LabTestParameters', 'U') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[LabTestParameters] (
        [Id]                 INT             NOT NULL IDENTITY(1,1),
        [TestCatalogId]      INT             NOT NULL,
        [ParameterCode]      VARCHAR(50)     NOT NULL,
        [ParameterName]      NVARCHAR(100)   NOT NULL,
        [Unit]               VARCHAR(30)     NULL,
        [ReferenceLow]       DECIMAL(10,2)   NULL,
        [ReferenceHigh]      DECIMAL(10,2)   NULL,
        [TextReferenceRange] NVARCHAR(200)   NULL,
        [DisplayOrder]       INT             NOT NULL DEFAULT 1,
        [CreatedAt]          DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_LabTestParameters PRIMARY KEY ([Id]),
        CONSTRAINT FK_LabTestParameters_Catalog FOREIGN KEY ([TestCatalogId]) REFERENCES ClinicDB.dbo.[LabTestCatalog]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX IX_LabTestParameters_Catalog ON ClinicDB.dbo.[LabTestParameters] ([TestCatalogId], [DisplayOrder]);
    PRINT '--> Created table LabTestParameters.';
END
ELSE
    PRINT '--> LabTestParameters already exists — skipping CREATE.';
GO

-- Seed standard panels (Lipid, CBC, Glucose) — idempotent
;WITH PanelDefs AS (
    -- Lipid Profile
    SELECT 'Lipid' AS TestPattern, 'CHOL'  AS PCode, 'Total Cholesterol'        AS PName, 'mg/dL' AS Unit, 125.00 AS RefLow, 200.00  AS RefHigh, 1 AS Ord UNION ALL
    SELECT 'Lipid',  'HDL',   'HDL Cholesterol',          'mg/dL',  40.00,  60.00, 2 UNION ALL
    SELECT 'Lipid',  'LDL',   'LDL Cholesterol',          'mg/dL',  50.00, 100.00, 3 UNION ALL
    SELECT 'Lipid',  'TRIG',  'Triglycerides',            'mg/dL',  10.00, 150.00, 4 UNION ALL
    -- Complete Blood Count
    SELECT 'CBC',    'WBC',   'White Blood Cell Count',   '10^3/uL', 4.50,  11.00, 1 UNION ALL
    SELECT 'CBC',    'RBC',   'Red Blood Cell Count',     '10^6/uL', 4.30,   5.90, 2 UNION ALL
    SELECT 'CBC',    'HGB',   'Hemoglobin',               'g/dL',   13.50,  17.50, 3 UNION ALL
    SELECT 'CBC',    'HCT',   'Hematocrit',               '%',      41.00,  53.00, 4 UNION ALL
    SELECT 'CBC',    'PLT',   'Platelets',                '10^3/uL',150.00, 450.00, 5 UNION ALL
    -- Blood Glucose
    SELECT 'Glucose','FBS',   'Fasting Blood Sugar',      'mg/dL',  70.00,  99.00, 1 UNION ALL
    SELECT 'Glucose','PPBS',  'Postprandial Blood Sugar', 'mg/dL',  70.00, 140.00, 2 UNION ALL
    SELECT 'Glucose','HBA1C', 'Hemoglobin A1c',           '%',       4.00,   5.60, 3
)
INSERT INTO ClinicDB.dbo.[LabTestParameters] ([TestCatalogId], [ParameterCode], [ParameterName], [Unit], [ReferenceLow], [ReferenceHigh], [DisplayOrder], [CreatedAt])
SELECT
    tc.[Id],
    pd.[PCode],
    pd.[PName],
    pd.[Unit],
    pd.[RefLow],
    pd.[RefHigh],
    pd.[Ord],
    SYSUTCDATETIME()
FROM ClinicDB.dbo.[LabTestCatalog] tc
JOIN PanelDefs pd ON tc.[TestName] LIKE '%' + pd.[TestPattern] + '%'
                  OR tc.[TestCode] LIKE '%' + pd.[TestPattern] + '%'
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[LabTestParameters] p
    WHERE p.[TestCatalogId] = tc.[Id] AND p.[ParameterCode] = pd.[PCode]
);

DECLARE @labParamCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[LabTestParameters]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 15', 'N/A (seed)', 'LabTestParameters', 0, @labParamCount, 'OK', 'Standard CBC/Lipid/Glucose sub-parameters seeded', GETDATE());
PRINT '--> [COMPLETED] Step 15/15: LabTestParameters total: ' + CAST(@labParamCount AS VARCHAR);
RAISERROR('--> [COMPLETED] Step 15/15: LabTestParameters done (%d rows).', 0, 1, @labParamCount) WITH NOWAIT;
GO

-- ============================================================
-- POST-MIGRATION: Restore Audit Triggers & Temporal Versioning
-- ============================================================
PRINT '----------------------------------------------------------------------';
PRINT 'Restoring system: Re-enabling audit triggers & temporal versioning...';

-- 1. Drop temporary linkage column FIRST so Encounters column count matches EncountersHistory (20 columns)
IF COL_LENGTH('ClinicDB.dbo.Encounters', 'OldConsultId') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[Encounters] DROP COLUMN [OldConsultId];

-- 2. Re-enable audit triggers
IF OBJECT_ID('dbo.trg_Patients_Audit', 'TR') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[Patients] ENABLE TRIGGER [trg_Patients_Audit];
IF OBJECT_ID('dbo.trg_Encounters_Audit', 'TR') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[Encounters] ENABLE TRIGGER [trg_Encounters_Audit];
IF OBJECT_ID('dbo.trg_LabResults_Audit', 'TR') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[LabResults] ENABLE TRIGGER [trg_LabResults_Audit];

-- 3. Re-enable temporal system-versioning
IF (SELECT temporal_type FROM sys.tables WHERE [name] = 'Patients' AND schema_id = SCHEMA_ID('dbo')) = 0
    ALTER TABLE ClinicDB.dbo.[Patients] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.[PatientsHistory]));
IF (SELECT temporal_type FROM sys.tables WHERE [name] = 'Encounters' AND schema_id = SCHEMA_ID('dbo')) = 0
    ALTER TABLE ClinicDB.dbo.[Encounters] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.[EncountersHistory]));
IF (SELECT temporal_type FROM sys.tables WHERE [name] = 'Prescriptions' AND schema_id = SCHEMA_ID('dbo')) = 0
    ALTER TABLE ClinicDB.dbo.[Prescriptions] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.[PrescriptionsHistory]));
IF (SELECT temporal_type FROM sys.tables WHERE [name] = 'LabResults' AND schema_id = SCHEMA_ID('dbo')) = 0
    ALTER TABLE ClinicDB.dbo.[LabResults] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.[LabResultsHistory]));

PRINT '--> [RESTORED] Triggers and temporal system-versioning re-enabled.';
GO

-- ============================================================
-- SUMMARY & RECONCILIATION TABLE
-- ============================================================
PRINT '======================================================================';
PRINT '===          ALL 15 STEPS COMPLETED — FINAL RECONCILIATION         ===';
PRINT '======================================================================';
GO

SELECT
    [StepName]                     AS [Step],
    [SourceTable]                  AS [Source (dbOHMS)],
    [TargetTable]                  AS [Target (ClinicDB)],
    [SourceCount]                  AS [Source Rows],
    [TargetCount]                  AS [Migrated Rows],
    [Status],
    CONVERT(VARCHAR(20), [RunAt], 120) AS [CompletedAt]
FROM dbo.[MigrationLog]
ORDER BY [Id];
GO

PRINT '======================================================================';
PRINT '===             TARGET DATABASE CURRENT RECORD COUNTS              ===';
PRINT '======================================================================';
GO

SELECT T.[TargetTable], T.[TotalRowsInClinicDB]
FROM (VALUES
    ('Patients',            (SELECT COUNT(*) FROM ClinicDB.dbo.[Patients] WHERE [TenantId] = 1)),
    ('Users',               (SELECT COUNT(*) FROM ClinicDB.dbo.[Users] WHERE [TenantId] = 1)),
    ('Staff',               (SELECT COUNT(*) FROM ClinicDB.dbo.[Staff] WHERE [TenantId] = 1)),
    ('Doctors',             (SELECT COUNT(*) FROM ClinicDB.dbo.[Doctors])),
    ('Appointments',        (SELECT COUNT(*) FROM ClinicDB.dbo.[Appointments] WHERE [TenantId] = 1)),
    ('PatientTriage',       (SELECT COUNT(*) FROM ClinicDB.dbo.[PatientTriage] WHERE [TenantId] = 1)),
    ('Encounters',          (SELECT COUNT(*) FROM ClinicDB.dbo.[Encounters] WHERE [TenantId] = 1)),
    ('Diagnoses',           (SELECT COUNT(*) FROM ClinicDB.dbo.[Diagnoses])),
    ('Prescriptions',       (SELECT COUNT(*) FROM ClinicDB.dbo.[Prescriptions] WHERE [TenantId] = 1)),
    ('PrescriptionItems',   (SELECT COUNT(*) FROM ClinicDB.dbo.[PrescriptionItems])),
    ('DrugFormulary',       (SELECT COUNT(*) FROM ClinicDB.dbo.[DrugFormulary] WHERE [TenantId] = 1)),
    ('LabOrders',           (SELECT COUNT(*) FROM ClinicDB.dbo.[LabOrders] WHERE [TenantId] = 1)),
    ('LabOrderItems',       (SELECT COUNT(*) FROM ClinicDB.dbo.[LabOrderItems])),
    ('LabTestCatalog',      (SELECT COUNT(*) FROM ClinicDB.dbo.[LabTestCatalog] WHERE [TenantId] = 1)),
    ('Invoices',            (SELECT COUNT(*) FROM ClinicDB.dbo.[Invoices] WHERE [TenantId] = 1)),
    ('InvoiceItems',        (SELECT COUNT(*) FROM ClinicDB.dbo.[InvoiceItems])),
    ('MedicalCertificates', (SELECT COUNT(*) FROM ClinicDB.dbo.[MedicalCertificates] WHERE [TenantId] = 1)),
    ('Services',            (SELECT COUNT(*) FROM ClinicDB.dbo.[Services] WHERE [TenantId] = 1)),
    ('LegacyServices',      (SELECT COUNT(*) FROM ClinicDB.dbo.[LegacyServices])),
    ('PayrollAgreements',   (SELECT COUNT(*) FROM ClinicDB.dbo.[PayrollAgreements])),
    ('ChapaTransactions',   (SELECT COUNT(*) FROM ClinicDB.dbo.[ChapaTransactions])),
    ('LabTestParameters',   (SELECT COUNT(*) FROM ClinicDB.dbo.[LabTestParameters])),
    ('Invoices[Linked]',    (SELECT COUNT(*) FROM ClinicDB.dbo.[Invoices] WHERE [TenantId] = 1 AND [EncounterId] IS NOT NULL))
) T([TargetTable], [TotalRowsInClinicDB])
ORDER BY T.[TargetTable];
GO

PRINT '=== MIGRATION VERIFICATION COMPLETE ===';
GO
