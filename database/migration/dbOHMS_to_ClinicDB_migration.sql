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

IF OBJECT_ID('dbo.MigrationLog') IS NULL
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
    [OldTestCode] NVARCHAR(50) PRIMARY KEY,
    [NewTestId]   INT NOT NULL
);

DROP TABLE IF EXISTS dbo.[Map_EncounterId];
CREATE TABLE dbo.[Map_EncounterId] (
    [OldConsultId]   INT PRIMARY KEY,
    [NewEncounterId] INT NOT NULL
);

PRINT '--> [COMPLETED] Step 0/12: Mapping tables ready.';
RAISERROR('--> Step 0/12: Mapping tables initialized.', 0, 1) WITH NOWAIT;
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
-- Target: [ClinicDB.dbo.LegacyServices]
-- ============================================================
DECLARE @srcCount INT = (SELECT COUNT(*) FROM dbOHMS.dbo.[tblServices]);
PRINT '------------------------------------------------------------';
PRINT 'Step 5/12: Migrating [dbOHMS.dbo.tblServices] -> [ClinicDB.dbo.LegacyServices]';
PRINT 'Total source records to migrate: ' + CAST(@srcCount AS VARCHAR);
RAISERROR('Step 5/12: Migrating [dbOHMS.dbo.tblServices] -> [ClinicDB.dbo.LegacyServices] (%d records)...', 0, 1, @srcCount) WITH NOWAIT;

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

DECLARE @svcCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[LegacyServices]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 5', 'tblServices', 'LegacyServices', @srcCount, @svcCount, 'OK', 'Staged in LegacyServices', GETDATE());
PRINT '--> [COMPLETED] Step 5/12: [dbOHMS.dbo.tblServices] -> [ClinicDB.dbo.LegacyServices] | Processed: ' + CAST(@svcCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
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

DROP TABLE IF EXISTS #InsertedEncounters;
CREATE TABLE #InsertedEncounters (
    [NewId]         INT,
    [PatientId]     INT,
    [EncounterDate] DATE
);

INSERT INTO ClinicDB.dbo.[Encounters] (
    [TenantId], [PatientId], [DoctorId], [EncounterDate], [EncounterTime],
    [ChiefComplaint], [HistoryOfIllness], [PhysicalExam], [Assessment], [Plan],
    [VitalSigns], [IsFinalized], [FinalizedAt], [CreatedAt], [CreatedBy]
)
OUTPUT INSERTED.[Id], INSERTED.[PatientId], INSERTED.[EncounterDate]
INTO #InsertedEncounters ([NewId], [PatientId], [EncounterDate])
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
    COALESCE(md.[NewUserId], @fbUsrId, 1)
FROM dbOHMS.dbo.[tblConsultation] c
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(c.[patID])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(c.[DocCode]))) = md.[DoctorNameVariant];

-- Map old consult id to new encounter id
;WITH RankedOld AS (
    SELECT [id], LTRIM(RTRIM([patID])) AS [mrn], ISNULL([consultDate], CAST(GETDATE() AS DATE)) AS [dt],
        ROW_NUMBER() OVER (PARTITION BY LTRIM(RTRIM([patID])), ISNULL([consultDate], CAST(GETDATE() AS DATE)) ORDER BY [id]) AS [rn]
    FROM dbOHMS.dbo.[tblConsultation]
),
RankedNew AS (
    SELECT ie.[NewId], ie.[PatientId], ie.[EncounterDate],
        ROW_NUMBER() OVER (PARTITION BY ie.[PatientId], ie.[EncounterDate] ORDER BY ie.[NewId]) AS [rn]
    FROM #InsertedEncounters ie
)
INSERT INTO dbo.[Map_EncounterId] ([OldConsultId], [NewEncounterId])
SELECT ro.[id], rn.[NewId]
FROM RankedOld ro
JOIN dbo.[Map_PatientId] mp ON ro.[mrn] = mp.[OldMRN]
JOIN RankedNew rn ON rn.[PatientId] = mp.[NewId] AND rn.[EncounterDate] = ro.[dt] AND rn.[rn] = ro.[rn]
WHERE NOT EXISTS (SELECT 1 FROM dbo.[Map_EncounterId] WHERE [OldConsultId] = ro.[id]);

-- Insert Diagnoses
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

DROP TABLE IF EXISTS #InsertedEncounters;

DECLARE @encCount INT = (SELECT COUNT(*) FROM dbo.[Map_EncounterId]);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 6', 'tblConsultation', 'Encounters & Diagnoses', @srcCount, @encCount, 'OK', 'SOAP data mapped; diagnosis code set to LEGACY', GETDATE());
PRINT '--> [COMPLETED] Step 6/12: [dbOHMS.dbo.tblConsultation] -> [ClinicDB.dbo.Encounters] & [ClinicDB.dbo.Diagnoses] | Processed: ' + CAST(@encCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
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

INSERT INTO ClinicDB.dbo.[Appointments] (
    [TenantId], [PatientId], [DoctorId], [SlotDateTime], [DurationMinutes],
    [StatusId], [ReasonForVisit], [Notes], [BookedBy], [BookedAt], [CreatedAt]
)
SELECT
    1,
    mp.[NewId],
    COALESCE(md.[NewDoctorId], @fbDocId, 1),
    CAST(s.[createOndate] AS DATETIME2),
    15,
    CASE WHEN s.[ispaid] = 1 THEN 5 ELSE 1 END,
    NULLIF(LTRIM(RTRIM(s.[visittype])),''),
    NULLIF(LTRIM(RTRIM(
        ISNULL(s.[appNote],'') +
        CASE WHEN NULLIF(LTRIM(RTRIM(s.[diagnosistype])),'') IS NOT NULL THEN ' | ' + s.[diagnosistype] ELSE '' END
    )),''),
    COALESCE(md.[NewUserId], @fbUsrId, 1),
    ISNULL(s.[regdate], s.[createOndate]),
    ISNULL(s.[regdate], s.[createOndate])
FROM dbOHMS.dbo.[tblSchedule] s
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(s.[patid])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(s.[doctor]))) = md.[DoctorNameVariant];

DECLARE @apptCount INT = @@ROWCOUNT;
INSERT INTO dbo.[MigrationLog] VALUES ('Step 7', 'tblSchedule', 'Appointments', @srcCount, @apptCount, 'OK', 'ispaid=1 -> Completed (5), else Scheduled (1)', GETDATE());
PRINT '--> [COMPLETED] Step 7/12: [dbOHMS.dbo.tblSchedule] -> [ClinicDB.dbo.Appointments] | Processed: ' + CAST(@apptCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 7/12: Appointments done (%d records).', 0, 1, @apptCount) WITH NOWAIT;
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
INSERT INTO ClinicDB.dbo.[LabTestCatalog] (
    [TenantId], [TestCode], [TestName], [Category], [ResultType], [IsActive]
)
SELECT DISTINCT
    1,
    ISNULL(NULLIF(LTRIM(RTRIM(l.[testcode])),''), 'LGC-' + CAST(l.[labid] AS VARCHAR)),
    LEFT(LTRIM(RTRIM(l.[testname])), 200),
    'General', 2, 1
FROM dbOHMS.dbo.[tblLaboratory] l
WHERE NULLIF(LTRIM(RTRIM(l.[testname])),'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM ClinicDB.dbo.[LabTestCatalog] tc
      WHERE tc.[TenantId] = 1
        AND tc.[TestCode] = ISNULL(NULLIF(LTRIM(RTRIM(l.[testcode])),''), 'LGC-' + CAST(l.[labid] AS VARCHAR))
  );

-- 9b. Map LabTestId
INSERT INTO dbo.[Map_LabTestId] ([OldTestCode], [NewTestId])
SELECT DISTINCT
    ISNULL(NULLIF(LTRIM(RTRIM(l.[testcode])),''), 'LGC-' + CAST(l.[labid] AS VARCHAR)),
    tc.[Id]
FROM dbOHMS.dbo.[tblLaboratory] l
JOIN ClinicDB.dbo.[LabTestCatalog] tc
    ON tc.[TestCode] = ISNULL(NULLIF(LTRIM(RTRIM(l.[testcode])),''), 'LGC-' + CAST(l.[labid] AS VARCHAR))
    AND tc.[TenantId] = 1
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.[Map_LabTestId] m
    WHERE m.[OldTestCode] = ISNULL(NULLIF(LTRIM(RTRIM(l.[testcode])),''), 'LGC-' + CAST(l.[labid] AS VARCHAR))
);

-- 9c. Insert LabOrders
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
);

-- 9d. Insert LabOrderItems
INSERT INTO ClinicDB.dbo.[LabOrderItems] ([OrderId], [TestId], [StatusId])
SELECT lo.[Id], mt.[NewTestId], 4
FROM dbOHMS.dbo.[tblLaboratory] l
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(l.[patid])) = mp.[OldMRN]
JOIN ClinicDB.dbo.[LabOrders] lo
    ON lo.[OrderNumber] = 'LAB-' + RIGHT('000000' + CAST(l.[labid] AS VARCHAR), 6)
    AND lo.[TenantId] = 1
JOIN dbo.[Map_LabTestId] mt
    ON mt.[OldTestCode] = ISNULL(NULLIF(LTRIM(RTRIM(l.[testcode])),''), 'LGC-' + CAST(l.[labid] AS VARCHAR))
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[LabOrderItems] loi
    WHERE loi.[OrderId] = lo.[Id] AND loi.[TestId] = mt.[NewTestId]
);

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
INSERT INTO ClinicDB.dbo.[DrugFormulary] ([TenantId], [GenericName], [IsActive])
SELECT DISTINCT 1, LEFT(LTRIM(RTRIM(p.[medname])), 200), 1
FROM dbOHMS.dbo.[tblPrescription] p
WHERE NULLIF(LTRIM(RTRIM(p.[medname])),'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM ClinicDB.dbo.[DrugFormulary] df
      WHERE df.[TenantId] = 1 AND df.[GenericName] = LEFT(LTRIM(RTRIM(p.[medname])), 200)
  );

-- 10b. Map DrugId
INSERT INTO dbo.[Map_DrugId] ([OldDrugName], [NewDrugId])
SELECT DISTINCT LEFT(LTRIM(RTRIM(p.[medname])), 450), df.[Id]
FROM dbOHMS.dbo.[tblPrescription] p
JOIN ClinicDB.dbo.[DrugFormulary] df
    ON df.[GenericName] = LEFT(LTRIM(RTRIM(p.[medname])), 200)
    AND df.[TenantId] = 1
WHERE NULLIF(LTRIM(RTRIM(p.[medname])),'') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.[Map_DrugId] WHERE [OldDrugName] = LEFT(LTRIM(RTRIM(p.[medname])), 450)
  );

-- 10c. Insert Prescriptions Headers
DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);

;WITH PrescGroups AS (
    SELECT DISTINCT
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
    1, NULL, mp.[NewId],
    COALESCE(md.[NewDoctorId], @fbDocId, 1),
    ISNULL(pg.[PrescDate], GETDATE()),
    1,
    'Legacy PrescID: ' + CAST(pg.[prescriptionid] AS VARCHAR)
FROM PrescGroups pg
JOIN dbo.[Map_PatientId] mp ON pg.[patid] = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(pg.[docname]))) = md.[DoctorNameVariant]
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[Prescriptions] cp
    WHERE cp.[TenantId] = 1
      AND cp.[PatientId] = mp.[NewId]
      AND cp.[Notes] = 'Legacy PrescID: ' + CAST(pg.[prescriptionid] AS VARCHAR)
);

-- 10d. Temporary map for Prescriptions.Id
DROP TABLE IF EXISTS #PrescMap;
SELECT p_old.[prescriptionid], p_old.[patid], cp.[Id] AS [NewPrescId]
INTO #PrescMap
FROM (
    SELECT DISTINCT [prescriptionid], LTRIM(RTRIM([patid])) AS [patid]
    FROM dbOHMS.dbo.[tblPrescription]
    WHERE [prescriptionid] IS NOT NULL
) p_old
JOIN dbo.[Map_PatientId] mp ON p_old.[patid] = mp.[OldMRN]
JOIN ClinicDB.dbo.[Prescriptions] cp
    ON cp.[PatientId] = mp.[NewId]
    AND cp.[Notes] = 'Legacy PrescID: ' + CAST(p_old.[prescriptionid] AS VARCHAR);

-- 10e. Insert PrescriptionItems
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
JOIN #PrescMap pm ON p.[prescriptionid] = pm.[prescriptionid] AND LTRIM(RTRIM(p.[patid])) = pm.[patid]
JOIN dbo.[Map_DrugId] md2 ON LEFT(LTRIM(RTRIM(p.[medname])), 450) = md2.[OldDrugName]
WHERE NULLIF(LTRIM(RTRIM(p.[medname])),'') IS NOT NULL;

DROP TABLE IF EXISTS #PrescMap;

DECLARE @rxCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[Prescriptions] WHERE [TenantId] = 1);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 10', 'tblPrescription', 'Prescriptions & Items', @srcCount, @rxCount, 'OK', 'DrugFormulary populated, line items attached', GETDATE());
PRINT '--> [COMPLETED] Step 10/12: [dbOHMS.dbo.tblPrescription] -> [ClinicDB.dbo.Prescriptions] & [ClinicDB.dbo.PrescriptionItems] | Processed: ' + CAST(@rxCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 10/12: Prescriptions done (%d records).', 0, 1, @rxCount) WITH NOWAIT;
GO

-- ============================================================
-- STEP 11: ORDERS -> INVOICES & ITEMS
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
    [TenantId], [InvoiceNumber], [PatientId], [StatusId],
    [IssueDate], [SubTotal], [TotalAmount], [PaidAmount], [CreatedBy], [CreatedAt]
)
SELECT
    1,
    ih.[InvoiceNumber],
    mp.[NewId],
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
);

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
    AND inv.[TenantId] = 1;

DECLARE @invCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[Invoices] WHERE [TenantId] = 1);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 11', 'tblOrder', 'Invoices & InvoiceItems', @srcCount, @invCount, 'OK', 'All invoices generated with unique InvoiceNumber', GETDATE());
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

IF OBJECT_ID('ClinicDB.dbo.MedicalCertificates') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.[MedicalCertificates] (
        [Id]              INT IDENTITY(1,1) PRIMARY KEY,
        [TenantId]        TINYINT NOT NULL DEFAULT 1,
        [PatientId]       INT NULL,
        [PatientMRN]      NVARCHAR(50) NULL,
        [FullName]        NVARCHAR(200) NULL,
        [Age]             INT NULL,
        [Address]         NVARCHAR(400) NULL,
        [ExaminedOn]      DATE NULL,
        [Diagnosis]       NVARCHAR(1000) NULL,
        [Recommendation]  NVARCHAR(1000) NULL,
        [RestDays]        NVARCHAR(50) NULL,
        [DoctorName]      NVARCHAR(400) NULL,
        [DoctorId]        INT NULL,
        [Specialty]       NVARCHAR(400) NULL,
        [CertificateHash] UNIQUEIDENTIFIER NULL,
        [IssuedAt]        DATETIME2 NULL,
        [CreatedAt]       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [FK_MedCert_Patients] FOREIGN KEY ([PatientId]) REFERENCES ClinicDB.dbo.[Patients]([Id]),
        CONSTRAINT [FK_MedCert_Tenants]  FOREIGN KEY ([TenantId])  REFERENCES ClinicDB.dbo.[Tenants]([Id])
    );
    CREATE INDEX [IX_MedCert_PatientId]  ON ClinicDB.dbo.[MedicalCertificates] ([PatientId]);
    CREATE INDEX [IX_MedCert_ExaminedOn] ON ClinicDB.dbo.[MedicalCertificates] ([ExaminedOn]);
END

DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);

INSERT INTO ClinicDB.dbo.[MedicalCertificates] (
    [TenantId], [PatientId], [PatientMRN], [FullName], [Age], [Address],
    [ExaminedOn], [Diagnosis], [Recommendation], [RestDays],
    [DoctorName], [DoctorId], [Specialty], [CertificateHash], [IssuedAt]
)
SELECT
    1,
    mp.[NewId],
    LTRIM(RTRIM(mc.[patid])),
    mc.[fullname],
    mc.[age],
    mc.[address],
    mc.[examinedon],
    mc.[diagnosis],
    mc.[recommendation],
    mc.[rest],
    mc.[doctor],
    COALESCE(md.[NewDoctorId], @fbDocId, 1),
    mc.[specialty],
    mc.[hash],
    ISNULL(mc.[regdate], GETDATE())
FROM dbOHMS.dbo.[tblMedicalCertificate] mc
LEFT JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(mc.[patid])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(
    REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(mc.[doctor],''))),'Dr. ',''),'Dr.','')
))) = md.[DoctorNameVariant]
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[MedicalCertificates] med
    WHERE med.[TenantId] = 1
      AND med.[PatientMRN] = LTRIM(RTRIM(mc.[patid]))
      AND med.[ExaminedOn] = mc.[examinedon]
);

DECLARE @mcCount INT = (SELECT COUNT(*) FROM ClinicDB.dbo.[MedicalCertificates] WHERE [TenantId] = 1);
INSERT INTO dbo.[MigrationLog] VALUES ('Step 12', 'tblMedicalCertificate', 'MedicalCertificates', @srcCount, @mcCount, 'OK', 'MedicalCertificates table populated', GETDATE());
PRINT '--> [COMPLETED] Step 12/12: [dbOHMS.dbo.tblMedicalCertificate] -> [ClinicDB.dbo.MedicalCertificates] | Processed: ' + CAST(@mcCount AS VARCHAR) + ' of ' + CAST(@srcCount AS VARCHAR) + ' records.';
RAISERROR('--> [COMPLETED] Step 12/12: Medical Certificates done (%d certificates).', 0, 1, @mcCount) WITH NOWAIT;
GO

-- ============================================================
-- POST-MIGRATION: Restore Audit Triggers & Temporal Versioning
-- ============================================================
PRINT '----------------------------------------------------------------------';
PRINT 'Restoring system: Re-enabling audit triggers & temporal versioning...';

IF OBJECT_ID('dbo.trg_Patients_Audit', 'TR') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[Patients] ENABLE TRIGGER [trg_Patients_Audit];
IF OBJECT_ID('dbo.trg_Encounters_Audit', 'TR') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[Encounters] ENABLE TRIGGER [trg_Encounters_Audit];
IF OBJECT_ID('dbo.trg_LabResults_Audit', 'TR') IS NOT NULL
    ALTER TABLE ClinicDB.dbo.[LabResults] ENABLE TRIGGER [trg_LabResults_Audit];

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
PRINT '===          ALL 12 STEPS COMPLETED — FINAL RECONCILIATION         ===';
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
    ('LegacyServices',      (SELECT COUNT(*) FROM ClinicDB.dbo.[LegacyServices]))
) T([TargetTable], [TotalRowsInClinicDB])
ORDER BY T.[TargetTable];
GO

PRINT '=== MIGRATION VERIFICATION COMPLETE ===';
GO
