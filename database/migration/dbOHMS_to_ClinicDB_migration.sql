-- ============================================================
-- dbOHMS to ClinicDB MIGRATION SCRIPT
-- Source: dbOHMS  |  Target: ClinicDB
-- Generated: September 2026
-- Run as: sa (or any sysadmin) against same SQL Server instance
-- Expected rows:
--   15,861 Patients  |  20,124 Encounters  |  27,451 Appointments
--   19,555 LabOrders |  45,286 Prescriptions | 33,025 Orders→Invoices
--   122 VitalSigns   |  806 MedicalCerts   |  21 Users/Staff
-- ============================================================
-- HOW TO RUN:
--   Open SSMS → New Query → Paste this file → F5
--   Or: sqlcmd -S "127.0.0.1,8710" -U sa -P "say@123" -i migration.sql
-- ============================================================

USE ClinicDB;
GO
SET NOCOUNT ON;
RAISERROR('=== CMS MIGRATION STARTING ===', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 0: Migration infrastructure (log + ID mapping tables)
-- ============================================================
IF OBJECT_ID('dbo.MigrationLog') IS NULL
CREATE TABLE dbo.MigrationLog (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    StepName    NVARCHAR(100), Status NVARCHAR(20),
    RecordCount INT, Notes NVARCHAR(500),
    RunAt       DATETIME2 DEFAULT GETDATE()
);
IF OBJECT_ID('dbo.Map_PatientId') IS NULL
CREATE TABLE dbo.Map_PatientId (
    OldMRN  NVARCHAR(30) PRIMARY KEY,
    NewId   INT NOT NULL
);
IF OBJECT_ID('dbo.Map_DoctorName') IS NULL
CREATE TABLE dbo.Map_DoctorName (
    DoctorNameVariant   NVARCHAR(400) PRIMARY KEY,
    NewDoctorId         INT NOT NULL,
    NewStaffId          INT NOT NULL,
    NewUserId           INT NOT NULL,
    EmpCode             NVARCHAR(30)
);
IF OBJECT_ID('dbo.Map_UserId') IS NULL
CREATE TABLE dbo.Map_UserId (OldEmpCode NVARCHAR(30) PRIMARY KEY, NewUserId INT NOT NULL);
IF OBJECT_ID('dbo.Map_StaffId') IS NULL
CREATE TABLE dbo.Map_StaffId (OldEmpCode NVARCHAR(30) PRIMARY KEY, NewStaffId INT NOT NULL);
IF OBJECT_ID('dbo.Map_DrugId') IS NULL
CREATE TABLE dbo.Map_DrugId (OldDrugName NVARCHAR(1000) PRIMARY KEY, NewDrugId INT NOT NULL);
IF OBJECT_ID('dbo.Map_LabTestId') IS NULL
CREATE TABLE dbo.Map_LabTestId (OldTestCode NVARCHAR(50) PRIMARY KEY, NewTestId INT NOT NULL);
IF OBJECT_ID('dbo.Map_EncounterId') IS NULL
CREATE TABLE dbo.Map_EncounterId (OldConsultId INT PRIMARY KEY, NewEncounterId INT NOT NULL);

RAISERROR('Step 0 OK: Mapping tables ready.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 1: USERS (dbOHMS.Users + tblEmployees → ClinicDB.Users + UserRoles)
-- Password for ALL users: 123456
-- bcrypt("123456", 11 rounds) = $2a$11$K7bdthzBfn/H7tqTicAQqO.UvxJNQ7nOqIQ8SYCVsrn14sP.S7cSm
-- ============================================================
RAISERROR('Step 1: Migrating Users...', 0, 1) WITH NOWAIT;

DECLARE @pwdHash NVARCHAR(500) = '$2a$11$K7bdthzBfn/H7tqTicAQqO.UvxJNQ7nOqIQ8SYCVsrn14sP.S7cSm';
DECLARE @salt    NVARCHAR(100) = 'cms-migration-2026';

INSERT INTO ClinicDB.dbo.Users
    (TenantId, Username, Email, PasswordHash, Salt, FirstName, LastName, Phone, IsActive, IsLocked, FailedLoginAttempts, MfaEnabled)
SELECT
    1,
    ISNULL(NULLIF(LTRIM(RTRIM(u.Uname)),''), u.empCode),
    ISNULL(NULLIF(LTRIM(RTRIM(e.empEmail)),''), 'cms@cms.com'),
    @pwdHash,
    @salt,
    ISNULL(NULLIF(LTRIM(RTRIM(e.empFname)),''), ISNULL(NULLIF(LTRIM(RTRIM(e.empSname)),''), u.Uname)),
    ISNULL(NULLIF(LTRIM(RTRIM(e.empSname)),''), '-'),
    NULLIF(LTRIM(RTRIM(e.empContact)),''),
    1, 0, 0, 0
FROM dbOHMS.dbo.Users u
LEFT JOIN dbOHMS.dbo.tblEmployees e ON LTRIM(RTRIM(e.empCode)) = LTRIM(RTRIM(u.empCode));

-- Map old empCode to new Users.Id
INSERT INTO dbo.Map_UserId (OldEmpCode, NewUserId)
SELECT LTRIM(RTRIM(u.empCode)), cu.Id
FROM dbOHMS.dbo.Users u
JOIN ClinicDB.dbo.Users cu
    ON cu.Username = ISNULL(NULLIF(LTRIM(RTRIM(u.Uname)),''), u.empCode)
    AND cu.TenantId = 1;

-- Assign roles via UserRoles junction table
INSERT INTO ClinicDB.dbo.UserRoles (UserId, RoleId)
SELECT mu.NewUserId,
    CASE LTRIM(RTRIM(u.Levels))
        WHEN 'Administrator' THEN 2  -- Admin
        WHEN 'Doctor'        THEN 3  -- Doctor
        WHEN 'Nurse'         THEN 4  -- Nurse
        WHEN 'Cashier'       THEN 5  -- Receptionist
        WHEN 'FDA'           THEN 8  -- Pharmacist
        ELSE 2
    END
FROM dbOHMS.dbo.Users u
JOIN dbo.Map_UserId mu ON LTRIM(RTRIM(u.empCode)) = mu.OldEmpCode;

DECLARE @c1 INT = (SELECT COUNT(*) FROM dbo.Map_UserId);
INSERT INTO dbo.MigrationLog VALUES ('Step 1: Users', 'OK', @c1, 'All passwords reset to 123456 (bcrypt)', GETDATE());
RAISERROR('Step 1 OK: Users done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 2: STAFF + DOCTORS (tblEmployees → Staff → Doctors)
-- ============================================================
RAISERROR('Step 2: Migrating Staff and Doctors...', 0, 1) WITH NOWAIT;

IF NOT EXISTS (SELECT 1 FROM ClinicDB.dbo.Specializations WHERE Code='GEN')
    INSERT INTO ClinicDB.dbo.Specializations (Name,Code) VALUES ('General Practice','GEN');

INSERT INTO ClinicDB.dbo.Staff
    (TenantId, UserId, StaffCode, Title, FirstName, LastName, Phone, Email, PrimaryRoleId, Department, JoinDate, IsActive)
SELECT
    1, mu.NewUserId,
    LTRIM(RTRIM(e.empCode)),
    CASE WHEN LOWER(LTRIM(RTRIM(e.empDesignation))) IN ('doctor','dentist') THEN 'Dr.' ELSE '' END,
    ISNULL(NULLIF(LTRIM(RTRIM(e.empFname)),''), ISNULL(NULLIF(LTRIM(RTRIM(e.empSname)),''), e.empCode)),
    ISNULL(NULLIF(LTRIM(RTRIM(e.empSname)),''), '-'),
    NULLIF(LTRIM(RTRIM(e.empContact)),''),
    NULLIF(LTRIM(RTRIM(e.empEmail)),''),
    CASE LOWER(LTRIM(RTRIM(e.empDesignation)))
        WHEN 'admin'   THEN 2  WHEN 'doctor' THEN 3  WHEN 'dentist' THEN 3
        WHEN 'nurse'   THEN 4  WHEN 'emy'    THEN 4
        WHEN 'casher'  THEN 5  WHEN 'cashier' THEN 5
        WHEN 'fda'     THEN 8  ELSE 2
    END,
    ISNULL(NULLIF(LTRIM(RTRIM(e.empDepartment)),''), 'General'),
    e.empDateJoined, 1
FROM dbOHMS.dbo.tblEmployees e
JOIN dbo.Map_UserId mu ON LTRIM(RTRIM(e.empCode)) = mu.OldEmpCode;

INSERT INTO dbo.Map_StaffId (OldEmpCode, NewStaffId)
SELECT LTRIM(RTRIM(e.empCode)), s.Id
FROM dbOHMS.dbo.tblEmployees e
JOIN ClinicDB.dbo.Staff s ON s.StaffCode = LTRIM(RTRIM(e.empCode));

DECLARE @genSpecId SMALLINT = (SELECT Id FROM ClinicDB.dbo.Specializations WHERE Code='GEN');
INSERT INTO ClinicDB.dbo.Doctors (StaffId, LicenseNumber, SpecializationId, IsAvailable)
SELECT ms.NewStaffId,
    'LIC-' + LTRIM(RTRIM(e.empCode)),
    @genSpecId, 1
FROM dbOHMS.dbo.tblEmployees e
JOIN dbo.Map_StaffId ms ON LTRIM(RTRIM(e.empCode)) = ms.OldEmpCode
WHERE LOWER(LTRIM(RTRIM(e.empDesignation))) IN ('doctor','dentist','emy','fda');

DECLARE @c2 INT = (SELECT COUNT(*) FROM dbo.Map_StaffId);
INSERT INTO dbo.MigrationLog VALUES ('Step 2: Staff+Doctors', 'OK', @c2, NULL, GETDATE());
RAISERROR('Step 2 OK: Staff and Doctors done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 3: DOCTOR NAME → DoctorId LOOKUP MAP
-- Covers all name variants (case/space/prefix differences)
-- across tblConsultation, tblPrescription, tblOrder, tblSchedule, tblMedicalCertificate
-- Strategy: empSname+empFname+empOname  (per user instruction)
-- ============================================================
RAISERROR('Step 3: Building doctor name lookup map...', 0, 1) WITH NOWAIT;

-- Insert canonical: Sname+Fname+Oname (lowercase)
INSERT INTO dbo.Map_DoctorName (DoctorNameVariant, NewDoctorId, NewStaffId, NewUserId, EmpCode)
SELECT
    LOWER(LTRIM(RTRIM(
        ISNULL(e.empSname,'')+' '+ISNULL(e.empFname,'')+' '+ISNULL(e.empOname,'')
    ))),
    d.Id, s.Id, s.UserId, e.empCode
FROM dbOHMS.dbo.tblEmployees e
JOIN ClinicDB.dbo.Staff s ON s.StaffCode = LTRIM(RTRIM(e.empCode))
JOIN ClinicDB.dbo.Doctors d ON d.StaffId = s.Id
WHERE LOWER(LTRIM(RTRIM(e.empDesignation))) IN ('doctor','dentist','emy','fda')
AND NOT EXISTS (SELECT 1 FROM dbo.Map_DoctorName WHERE DoctorNameVariant =
    LOWER(LTRIM(RTRIM(ISNULL(e.empSname,'')+' '+ISNULL(e.empFname,'')+' '+ISNULL(e.empOname,'')))));

-- Sname+Fname only
INSERT INTO dbo.Map_DoctorName (DoctorNameVariant, NewDoctorId, NewStaffId, NewUserId, EmpCode)
SELECT LOWER(LTRIM(RTRIM(ISNULL(e.empSname,'')+' '+ISNULL(e.empFname,'')))),
    d.Id, s.Id, s.UserId, e.empCode
FROM dbOHMS.dbo.tblEmployees e
JOIN ClinicDB.dbo.Staff s ON s.StaffCode = LTRIM(RTRIM(e.empCode))
JOIN ClinicDB.dbo.Doctors d ON d.StaffId = s.Id
WHERE LOWER(LTRIM(RTRIM(e.empDesignation))) IN ('doctor','dentist','emy','fda')
AND NOT EXISTS (SELECT 1 FROM dbo.Map_DoctorName WHERE DoctorNameVariant =
    LOWER(LTRIM(RTRIM(ISNULL(e.empSname,'')+' '+ISNULL(e.empFname,'')))));

-- Fname+Sname (reversed)
INSERT INTO dbo.Map_DoctorName (DoctorNameVariant, NewDoctorId, NewStaffId, NewUserId, EmpCode)
SELECT LOWER(LTRIM(RTRIM(ISNULL(e.empFname,'')+' '+ISNULL(e.empSname,'')))),
    d.Id, s.Id, s.UserId, e.empCode
FROM dbOHMS.dbo.tblEmployees e
JOIN ClinicDB.dbo.Staff s ON s.StaffCode = LTRIM(RTRIM(e.empCode))
JOIN ClinicDB.dbo.Doctors d ON d.StaffId = s.Id
WHERE LOWER(LTRIM(RTRIM(e.empDesignation))) IN ('doctor','dentist','emy','fda')
AND NOT EXISTS (SELECT 1 FROM dbo.Map_DoctorName WHERE DoctorNameVariant =
    LOWER(LTRIM(RTRIM(ISNULL(e.empFname,'')+' '+ISNULL(e.empSname,'')))));

-- Fname only
INSERT INTO dbo.Map_DoctorName (DoctorNameVariant, NewDoctorId, NewStaffId, NewUserId, EmpCode)
SELECT LOWER(LTRIM(RTRIM(ISNULL(e.empFname,'')))),
    d.Id, s.Id, s.UserId, e.empCode
FROM dbOHMS.dbo.tblEmployees e
JOIN ClinicDB.dbo.Staff s ON s.StaffCode = LTRIM(RTRIM(e.empCode))
JOIN ClinicDB.dbo.Doctors d ON d.StaffId = s.Id
WHERE LOWER(LTRIM(RTRIM(e.empDesignation))) IN ('doctor','dentist','emy','fda')
AND NOT EXISTS (SELECT 1 FROM dbo.Map_DoctorName WHERE DoctorNameVariant =
    LOWER(LTRIM(RTRIM(ISNULL(e.empFname,'')))));

-- Now add all name variants actually found in source data (with 'Dr.' prefix stripped)
-- Use fallback to emp-4 (Huda Aman, most common doctor) for anything unresolvable
DECLARE @fallbackDocId INT = (
    SELECT TOP 1 d.Id FROM ClinicDB.dbo.Doctors d
    JOIN ClinicDB.dbo.Staff s ON d.StaffId=s.Id WHERE s.StaffCode='emp-4'
);
DECLARE @fallbackStfId INT = (SELECT TOP 1 Id FROM ClinicDB.dbo.Staff WHERE StaffCode='emp-4');
DECLARE @fallbackUsrId INT = (SELECT TOP 1 UserId FROM ClinicDB.dbo.Staff WHERE StaffCode='emp-4');

;WITH AllVariants AS (
    SELECT DISTINCT LOWER(LTRIM(RTRIM(DocCode)))  AS n FROM dbOHMS.dbo.tblConsultation WHERE DocCode IS NOT NULL
    UNION SELECT DISTINCT LOWER(LTRIM(RTRIM(docname))) FROM dbOHMS.dbo.tblPrescription   WHERE docname IS NOT NULL
    UNION SELECT DISTINCT LOWER(LTRIM(RTRIM(doctor)))  FROM dbOHMS.dbo.tblOrder           WHERE doctor IS NOT NULL
    UNION SELECT DISTINCT LOWER(LTRIM(RTRIM(doctor)))  FROM dbOHMS.dbo.tblSchedule        WHERE doctor IS NOT NULL
    UNION SELECT DISTINCT LOWER(LTRIM(RTRIM(
        REPLACE(REPLACE(LTRIM(RTRIM(doctor)),'dr. ',''),'dr.','')
    ))) FROM dbOHMS.dbo.tblMedicalCertificate WHERE doctor IS NOT NULL
)
MERGE dbo.Map_DoctorName tgt
USING (
    SELECT v.n,
        LTRIM(RTRIM(REPLACE(REPLACE(v.n,'dr. ',''),'dr.',''))) AS stripped
    FROM AllVariants v
) src ON tgt.DoctorNameVariant = src.n
WHEN NOT MATCHED THEN INSERT (DoctorNameVariant, NewDoctorId, NewStaffId, NewUserId, EmpCode)
VALUES (
    src.n,
    ISNULL((SELECT TOP 1 NewDoctorId FROM dbo.Map_DoctorName WHERE DoctorNameVariant=src.stripped), @fallbackDocId),
    ISNULL((SELECT TOP 1 NewStaffId  FROM dbo.Map_DoctorName WHERE DoctorNameVariant=src.stripped), @fallbackStfId),
    ISNULL((SELECT TOP 1 NewUserId   FROM dbo.Map_DoctorName WHERE DoctorNameVariant=src.stripped), @fallbackUsrId),
    ISNULL((SELECT TOP 1 EmpCode     FROM dbo.Map_DoctorName WHERE DoctorNameVariant=src.stripped), 'emp-4')
);

DECLARE @c3 INT = (SELECT COUNT(*) FROM dbo.Map_DoctorName);
INSERT INTO dbo.MigrationLog VALUES ('Step 3: DoctorNameMap', 'OK', @c3, 'All name variants mapped; unresolved → emp-4 (Huda Aman)', GETDATE());
RAISERROR('Step 3 OK: Doctor name map done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 4: PATIENTS (tblPatient → Patients)
-- patID = MRN | DOB NULL → 1900-01-01 | Email NULL → cms@cms.com
-- ============================================================
RAISERROR('Step 4: Migrating Patients (15,861 records)...', 0, 1) WITH NOWAIT;

INSERT INTO ClinicDB.dbo.Patients (
    TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender,
    PrimaryPhone, SecondaryPhone, Email, Address, Nationality,
    EmergencyName, EmergencyPhone, EmergencyRelation, Notes, IsActive, CreatedAt
)
SELECT
    1,
    LTRIM(RTRIM(p.patID)),
    ISNULL(NULLIF(LTRIM(RTRIM(p.pFname)),''), LTRIM(RTRIM(p.patID))),
    NULLIF(LTRIM(RTRIM(p.pOname)),''),
    ISNULL(NULLIF(LTRIM(RTRIM(p.pSname)),''), '-'),
    ISNULL(p.pDOB, CAST('1900-01-01' AS DATE)),
    CASE LOWER(LTRIM(RTRIM(p.pGender)))
        WHEN 'female' THEN 2 WHEN 'f' THEN 2
        WHEN 'male'   THEN 1 WHEN 'm' THEN 1
        ELSE 3
    END,
    ISNULL(NULLIF(LTRIM(RTRIM(p.pContact)),''), '0000000000'),
    NULL,
    'cms@cms.com',
    NULLIF(LTRIM(RTRIM(p.pResidenAddres)),''),
    NULLIF(LTRIM(RTRIM(p.pNationality)),''),
    NULLIF(LTRIM(RTRIM(p.pGuardianName)),''),
    NULLIF(LTRIM(RTRIM(p.pGuardianPhone)),''),
    NULLIF(LTRIM(RTRIM(p.pGuardianRelateAs)),''),
    NULLIF('Occupation: ' + LTRIM(RTRIM(ISNULL(p.pOccupation,''))), 'Occupation: '),
    1,
    ISNULL(p.regdate, GETDATE())
FROM dbOHMS.dbo.tblPatient p;

-- Build patient MRN → new Id map
INSERT INTO dbo.Map_PatientId (OldMRN, NewId)
SELECT LTRIM(RTRIM(p.patID)), cp.Id
FROM dbOHMS.dbo.tblPatient p
JOIN ClinicDB.dbo.Patients cp ON cp.MRN = LTRIM(RTRIM(p.patID)) AND cp.TenantId=1;

DECLARE @c4 INT = (SELECT COUNT(*) FROM dbo.Map_PatientId);
INSERT INTO dbo.MigrationLog VALUES ('Step 4: Patients', 'OK', @c4, 'DOB=1900-01-01; Email=cms@cms.com for all (all were NULL)', GETDATE());
RAISERROR('Step 4 OK: Patients done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 5: SERVICES (tblServices → LegacyServices staging table)
-- ============================================================
RAISERROR('Step 5: Migrating Services...', 0, 1) WITH NOWAIT;

IF OBJECT_ID('ClinicDB.dbo.LegacyServices') IS NULL
CREATE TABLE ClinicDB.dbo.LegacyServices (
    Id INT IDENTITY(1,1) PRIMARY KEY, OldServiceId INT,
    ServiceName NVARCHAR(400), Category NVARCHAR(200),
    Price DECIMAL(10,2), ServiceCode NVARCHAR(50),
    IsActive BIT DEFAULT 1, TenantId TINYINT DEFAULT 1,
    MigratedAt DATETIME2 DEFAULT GETDATE()
);

INSERT INTO ClinicDB.dbo.LegacyServices
    (OldServiceId, ServiceName, Category, Price, ServiceCode, IsActive)
SELECT serviceid, servicename, category, price, servicecode, ISNULL(isactive,1)
FROM dbOHMS.dbo.tblServices;

DECLARE @c5 INT = @@ROWCOUNT;
INSERT INTO dbo.MigrationLog VALUES ('Step 5: Services', 'OK', @c5, 'Staged in LegacyServices; link to ClinicalServices catalog after review', GETDATE());
RAISERROR('Step 5 OK: Services done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 6: ENCOUNTERS (tblConsultation → Encounters + Diagnoses)
-- DocCode is full doctor name (e.g. 'huda aman') → Map_DoctorName
-- SOAP fields: chiefcompliant/subjective → ChiefComplaint
--              history → HistoryOfIllness
--              pe/objective → PhysicalExam
--              assessment/diagnosis → Assessment
--              plan+plan2+Treatment → Plan
-- ============================================================
RAISERROR('Step 6: Migrating Consultations → Encounters (20,124)...', 0, 1) WITH NOWAIT;

-- Insert LEGACY diagnosis code if not present
IF NOT EXISTS (SELECT 1 FROM ClinicDB.dbo.DiagnosisCodes WHERE Code='LEGACY')
    INSERT INTO ClinicDB.dbo.DiagnosisCodes (Code,Description,Category)
    VALUES ('LEGACY','Migrated from legacy system — no ICD-10 code','Migration');

DECLARE @fbDocId INT = (SELECT TOP 1 d.Id FROM ClinicDB.dbo.Doctors d JOIN ClinicDB.dbo.Staff s ON d.StaffId=s.Id WHERE s.StaffCode='emp-4');
DECLARE @fbUsrId INT = (SELECT TOP 1 UserId FROM ClinicDB.dbo.Staff WHERE StaffCode='emp-4');

INSERT INTO ClinicDB.dbo.Encounters (
    TenantId, PatientId, DoctorId, EncounterDate, EncounterTime,
    ChiefComplaint, HistoryOfIllness, PhysicalExam, Assessment, Plan,
    VitalSigns, IsFinalized, FinalizedAt, CreatedAt, CreatedBy
)
OUTPUT INSERTED.Id, inserted.PatientId, inserted.EncounterDate
INTO #InsertedEncounters (NewId, PatientId, EncounterDate)
SELECT
    1, mp.NewId,
    ISNULL(md.NewDoctorId, @fbDocId),
    ISNULL(c.consultDate, CAST(GETDATE() AS DATE)),
    CAST(GETDATE() AS TIME),
    NULLIF(LTRIM(RTRIM(ISNULL(NULLIF(c.chiefcompliant,''), c.subjective))),''),
    NULLIF(LTRIM(RTRIM(c.history)),''),
    NULLIF(LTRIM(RTRIM(ISNULL(NULLIF(c.pe,''), c.objective))),''),
    NULLIF(LTRIM(RTRIM(ISNULL(NULLIF(c.assessment,''), c.diagnosis))),''),
    NULLIF(LTRIM(RTRIM(
        ISNULL(c.plan,'') +
        CASE WHEN NULLIF(LTRIM(RTRIM(c.plan2)),'') IS NOT NULL THEN '; '+c.plan2 ELSE '' END +
        CASE WHEN NULLIF(LTRIM(RTRIM(c.Treatment)),'') IS NOT NULL THEN ' | Tx: '+c.Treatment ELSE '' END
    )),''),
    NULL, 1,
    ISNULL(CAST(c.consultDate AS DATETIME2), GETDATE()),
    ISNULL(CAST(c.consultDate AS DATETIME2), GETDATE()),
    @fbUsrId
FROM dbOHMS.dbo.tblConsultation c
JOIN dbo.Map_PatientId mp ON LTRIM(RTRIM(c.patID)) = mp.OldMRN
LEFT JOIN dbo.Map_DoctorName md ON LOWER(LTRIM(RTRIM(c.DocCode))) = md.DoctorNameVariant;

-- Build encounter map using ROW_NUMBER to handle same patient/date duplicates
;WITH RankedOld AS (
    SELECT id, LTRIM(RTRIM(patID)) AS mrn, ISNULL(consultDate,CAST(GETDATE() AS DATE)) AS dt,
        ROW_NUMBER() OVER (PARTITION BY LTRIM(RTRIM(patID)), ISNULL(consultDate,CAST(GETDATE() AS DATE)) ORDER BY id) AS rn
    FROM dbOHMS.dbo.tblConsultation
),
RankedNew AS (
    SELECT ie.NewId, ie.PatientId, ie.EncounterDate,
        ROW_NUMBER() OVER (PARTITION BY ie.PatientId, ie.EncounterDate ORDER BY ie.NewId) AS rn
    FROM #InsertedEncounters ie
)
INSERT INTO dbo.Map_EncounterId (OldConsultId, NewEncounterId)
SELECT ro.id, rn.NewId
FROM RankedOld ro
JOIN dbo.Map_PatientId mp ON ro.mrn = mp.OldMRN
JOIN RankedNew rn ON rn.PatientId = mp.NewId AND rn.EncounterDate = ro.dt AND rn.rn = ro.rn;

-- Insert Diagnoses from assessment/diagnosis text
INSERT INTO ClinicDB.dbo.Diagnoses (EncounterId, DiagnosisCode, DiagnosisText, DiagnosisType)
SELECT me.NewEncounterId, 'LEGACY',
    LEFT(ISNULL(NULLIF(LTRIM(RTRIM(c.diagnosis)),''), NULLIF(LTRIM(RTRIM(c.assessment)),''), 'No diagnosis recorded'), 300),
    1
FROM dbOHMS.dbo.tblConsultation c
JOIN dbo.Map_EncounterId me ON c.id = me.OldConsultId
WHERE NULLIF(LTRIM(RTRIM(c.diagnosis)),'') IS NOT NULL
   OR NULLIF(LTRIM(RTRIM(c.assessment)),'') IS NOT NULL;

DROP TABLE IF EXISTS #InsertedEncounters;

DECLARE @c6 INT = (SELECT COUNT(*) FROM dbo.Map_EncounterId);
INSERT INTO dbo.MigrationLog VALUES ('Step 6: Encounters', 'OK', @c6, 'SOAP mapped; diagnosis code = LEGACY placeholder', GETDATE());
RAISERROR('Step 6 OK: Encounters done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 7: APPOINTMENTS (tblSchedule → Appointments)
-- 27,451 records — patient-to-doctor assignment records
-- ============================================================
RAISERROR('Step 7: Migrating Schedule → Appointments (27,451)...', 0, 1) WITH NOWAIT;

DECLARE @fbDocId2 INT = (SELECT TOP 1 d.Id FROM ClinicDB.dbo.Doctors d JOIN ClinicDB.dbo.Staff s ON d.StaffId=s.Id WHERE s.StaffCode='emp-4');
DECLARE @fbUsrId2 INT = (SELECT TOP 1 UserId FROM ClinicDB.dbo.Staff WHERE StaffCode='emp-4');

INSERT INTO ClinicDB.dbo.Appointments (
    TenantId, PatientId, DoctorId, SlotDateTime, DurationMinutes,
    StatusId, ReasonForVisit, Notes, BookedBy, BookedAt, CreatedAt
)
SELECT
    1, mp.NewId,
    ISNULL(md.NewDoctorId, @fbDocId2),
    CAST(s.createOndate AS DATETIME2),
    15,
    CASE WHEN s.ispaid=1 THEN 5 ELSE 1 END,
    NULLIF(LTRIM(RTRIM(s.visittype)),''),
    NULLIF(LTRIM(RTRIM(
        ISNULL(s.appNote,'') +
        CASE WHEN NULLIF(LTRIM(RTRIM(s.diagnosistype)),'') IS NOT NULL THEN ' | '+s.diagnosistype ELSE '' END
    )),''),
    @fbUsrId2,
    ISNULL(s.regdate, s.createOndate),
    ISNULL(s.regdate, s.createOndate)
FROM dbOHMS.dbo.tblSchedule s
JOIN dbo.Map_PatientId mp ON LTRIM(RTRIM(s.patid)) = mp.OldMRN
LEFT JOIN dbo.Map_DoctorName md ON LOWER(LTRIM(RTRIM(s.doctor))) = md.DoctorNameVariant;

DECLARE @c7 INT = @@ROWCOUNT;
INSERT INTO dbo.MigrationLog VALUES ('Step 7: Appointments', 'OK', @c7, 'isPaid=1→Completed, else Scheduled', GETDATE());
RAISERROR('Step 7 OK: Appointments done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 8: VITAL SIGNS (PatientWeight → new Encounter rows with VitalSigns JSON)
-- 122 records
-- ============================================================
RAISERROR('Step 8: Migrating VitalSigns (122 records)...', 0, 1) WITH NOWAIT;

DECLARE @fbDocId3 INT = (SELECT TOP 1 d.Id FROM ClinicDB.dbo.Doctors d JOIN ClinicDB.dbo.Staff s ON d.StaffId=s.Id WHERE s.StaffCode='emp-4');
DECLARE @fbUsrId3 INT = (SELECT TOP 1 UserId FROM ClinicDB.dbo.Staff WHERE StaffCode='emp-4');

INSERT INTO ClinicDB.dbo.Encounters (
    TenantId, PatientId, DoctorId, EncounterDate, EncounterTime,
    ChiefComplaint, VitalSigns, IsFinalized, FinalizedAt, CreatedAt, CreatedBy
)
SELECT
    1, mp.NewId, @fbDocId3,
    pw.measuredOnDate,
    CAST(GETDATE() AS TIME),
    'Vital Signs Assessment (Migrated)',
    '{' +
        '"BP":"'   + ISNULL(LTRIM(RTRIM(pw.pressure)),'')       + '",' +
        '"HR":"'   + ISNULL(LTRIM(RTRIM(pw.pulserate)),'')      + '",' +
        '"RR":"'   + ISNULL(LTRIM(RTRIM(pw.respiratoryrate)),'')+ '",' +
        '"Temp":"' + ISNULL(LTRIM(RTRIM(pw.temperature)),'')    + '",' +
        '"Weight":'+ ISNULL(CAST(pw.weight AS NVARCHAR(20)),'null') + ',' +
        '"Height":'+ ISNULL(CAST(pw.height AS NVARCHAR(20)),'null') + ',' +
        '"BMI":'   + ISNULL(CAST(pw.bmi    AS NVARCHAR(20)),'null') +
    '}',
    1, pw.measuredOnDate,
    CAST(pw.measuredOnDate AS DATETIME2),
    @fbUsrId3
FROM dbOHMS.dbo.PatientWeight pw
JOIN dbo.Map_PatientId mp ON LTRIM(RTRIM(pw.patID)) = mp.OldMRN;

DECLARE @c8 INT = @@ROWCOUNT;
INSERT INTO dbo.MigrationLog VALUES ('Step 8: VitalSigns', 'OK', @c8, 'Each PatientWeight row → standalone Encounter with JSON vitals', GETDATE());
RAISERROR('Step 8 OK: VitalSigns done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 9: LABORATORY (tblLaboratory → LabTestCatalog + LabOrders + LabOrderItems)
-- 19,555 records
-- ============================================================
RAISERROR('Step 9: Migrating Laboratory orders (19,555)...', 0, 1) WITH NOWAIT;

-- 9a: Populate LabTestCatalog from distinct test entries
INSERT INTO ClinicDB.dbo.LabTestCatalog (TenantId, TestCode, TestName, Category, ResultType, IsActive)
SELECT DISTINCT 1,
    ISNULL(NULLIF(LTRIM(RTRIM(l.testcode)),''), 'LGC-'+CAST(l.labid AS VARCHAR)),
    LEFT(LTRIM(RTRIM(l.testname)), 200),
    'General', 2, 1
FROM dbOHMS.dbo.tblLaboratory l
WHERE NULLIF(LTRIM(RTRIM(l.testname)),'') IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.LabTestCatalog t
    WHERE t.TenantId=1 AND t.TestCode=ISNULL(NULLIF(LTRIM(RTRIM(l.testcode)),''),'LGC-'+CAST(l.labid AS VARCHAR))
);

INSERT INTO dbo.Map_LabTestId (OldTestCode, NewTestId)
SELECT DISTINCT
    ISNULL(NULLIF(LTRIM(RTRIM(l.testcode)),''), 'LGC-'+CAST(l.labid AS VARCHAR)),
    tc.Id
FROM dbOHMS.dbo.tblLaboratory l
JOIN ClinicDB.dbo.LabTestCatalog tc
    ON tc.TestCode=ISNULL(NULLIF(LTRIM(RTRIM(l.testcode)),''),'LGC-'+CAST(l.labid AS VARCHAR))
    AND tc.TenantId=1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Map_LabTestId m WHERE m.OldTestCode=ISNULL(NULLIF(LTRIM(RTRIM(l.testcode)),''),'LGC-'+CAST(l.labid AS VARCHAR)));

-- 9b: Insert LabOrders
DECLARE @fbDocId4 INT = (SELECT TOP 1 d.Id FROM ClinicDB.dbo.Doctors d JOIN ClinicDB.dbo.Staff s ON d.StaffId=s.Id WHERE s.StaffCode='emp-4');

INSERT INTO ClinicDB.dbo.LabOrders
    (TenantId, OrderNumber, PatientId, OrderedBy, Priority, OrderedAt, ClinicalInfo, StatusId, CreatedAt)
SELECT 1,
    'LAB-' + RIGHT('000000'+CAST(l.labid AS VARCHAR),6),
    mp.NewId, @fbDocId4,
    CASE WHEN l.urgent=1 THEN 1 ELSE 2 END,
    ISNULL(l.requestdate, GETDATE()),
    NULLIF(LTRIM(RTRIM(l.clinicaldata)),''),
    4, ISNULL(l.requestdate, GETDATE())
FROM dbOHMS.dbo.tblLaboratory l
JOIN dbo.Map_PatientId mp ON LTRIM(RTRIM(l.patid)) = mp.OldMRN;

-- 9c: Insert LabOrderItems
INSERT INTO ClinicDB.dbo.LabOrderItems (OrderId, TestId, StatusId)
SELECT lo.Id, mt.NewTestId, 4
FROM dbOHMS.dbo.tblLaboratory l
JOIN dbo.Map_PatientId mp ON LTRIM(RTRIM(l.patid)) = mp.OldMRN
JOIN ClinicDB.dbo.LabOrders lo
    ON lo.OrderNumber='LAB-'+RIGHT('000000'+CAST(l.labid AS VARCHAR),6) AND lo.TenantId=1
JOIN dbo.Map_LabTestId mt
    ON mt.OldTestCode=ISNULL(NULLIF(LTRIM(RTRIM(l.testcode)),''),'LGC-'+CAST(l.labid AS VARCHAR));

DECLARE @c9 INT = @@ROWCOUNT;
INSERT INTO dbo.MigrationLog VALUES ('Step 9: LabOrders', 'OK', @c9, 'All marked Resulted; test catalog auto-populated', GETDATE());
RAISERROR('Step 9 OK: Laboratory done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 10: PRESCRIPTIONS (tblPrescription → DrugFormulary + Prescriptions + PrescriptionItems)
-- 45,286 records
-- ============================================================
RAISERROR('Step 10: Migrating Prescriptions (45,286)...', 0, 1) WITH NOWAIT;

-- 10a: Populate DrugFormulary
INSERT INTO ClinicDB.dbo.DrugFormulary (TenantId, GenericName, IsActive)
SELECT DISTINCT 1, LEFT(LTRIM(RTRIM(p.medname)),200), 1
FROM dbOHMS.dbo.tblPrescription p
WHERE NULLIF(LTRIM(RTRIM(p.medname)),'') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM ClinicDB.dbo.DrugFormulary df WHERE df.TenantId=1 AND df.GenericName=LEFT(LTRIM(RTRIM(p.medname)),200));

INSERT INTO dbo.Map_DrugId (OldDrugName, NewDrugId)
SELECT DISTINCT LTRIM(RTRIM(p.medname)), df.Id
FROM dbOHMS.dbo.tblPrescription p
JOIN ClinicDB.dbo.DrugFormulary df ON df.GenericName=LEFT(LTRIM(RTRIM(p.medname)),200) AND df.TenantId=1
WHERE NULLIF(LTRIM(RTRIM(p.medname)),'') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM dbo.Map_DrugId WHERE OldDrugName=LTRIM(RTRIM(p.medname)));

-- 10b: Prescriptions headers (one per prescriptionid+patid)
DECLARE @fbDocId5 INT = (SELECT TOP 1 d.Id FROM ClinicDB.dbo.Doctors d JOIN ClinicDB.dbo.Staff s ON d.StaffId=s.Id WHERE s.StaffCode='emp-4');

;WITH PG AS (
    SELECT DISTINCT prescriptionid, LTRIM(RTRIM(patid)) AS patid,
        MIN(prescriptiondate) AS dt, MAX(LTRIM(RTRIM(docname))) AS docname
    FROM dbOHMS.dbo.tblPrescription WHERE prescriptionid IS NOT NULL AND NULLIF(LTRIM(RTRIM(patid)),'') IS NOT NULL
    GROUP BY prescriptionid, LTRIM(RTRIM(patid))
)
INSERT INTO ClinicDB.dbo.Prescriptions
    (TenantId, EncounterId, PatientId, PrescribedBy, PrescribedAt, IsDispensed, Notes)
SELECT 1, NULL, mp.NewId,
    ISNULL(md.NewDoctorId, @fbDocId5),
    ISNULL(pg.dt, GETDATE()), 1,
    'Legacy PrescID: '+CAST(pg.prescriptionid AS VARCHAR)
FROM PG
JOIN dbo.Map_PatientId mp ON pg.patid=mp.OldMRN
LEFT JOIN dbo.Map_DoctorName md ON LOWER(LTRIM(RTRIM(pg.docname)))=md.DoctorNameVariant;

-- 10c: Temp map prescriptionid → new Prescriptions.Id
DROP TABLE IF EXISTS #PM;
SELECT p_old.prescriptionid, p_old.patid, cp.Id AS NewPrescId
INTO #PM
FROM (SELECT DISTINCT prescriptionid, LTRIM(RTRIM(patid)) AS patid FROM dbOHMS.dbo.tblPrescription WHERE prescriptionid IS NOT NULL) p_old
JOIN dbo.Map_PatientId mp ON p_old.patid=mp.OldMRN
JOIN ClinicDB.dbo.Prescriptions cp
    ON cp.PatientId=mp.NewId
    AND cp.Notes='Legacy PrescID: '+CAST(p_old.prescriptionid AS VARCHAR);

-- 10d: PrescriptionItems
INSERT INTO ClinicDB.dbo.PrescriptionItems
    (PrescriptionId, DrugId, Dosage, Frequency, Route, DurationDays, Quantity, Instructions)
SELECT pm.NewPrescId, md2.NewDrugId,
    ISNULL(NULLIF(LTRIM(RTRIM(p.dosage)),''), 'As directed'),
    ISNULL(NULLIF(LTRIM(RTRIM(p.frequency)),''), 'As directed'),
    'Oral',
    TRY_CAST(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(p.length,''))), ' days',''),' day',''),'days','') AS SMALLINT),
    1, NULLIF(LTRIM(RTRIM(p.diagnosis)),'')
FROM dbOHMS.dbo.tblPrescription p
JOIN #PM pm ON p.prescriptionid=pm.prescriptionid AND LTRIM(RTRIM(p.patid))=pm.patid
JOIN dbo.Map_DrugId md2 ON LTRIM(RTRIM(p.medname))=md2.OldDrugName
WHERE NULLIF(LTRIM(RTRIM(p.medname)),'') IS NOT NULL;

DROP TABLE IF EXISTS #PM;
DECLARE @c10 INT = @@ROWCOUNT;
INSERT INTO dbo.MigrationLog VALUES ('Step 10: Prescriptions', 'OK', @c10, 'DrugFormulary auto-populated; all historical = dispensed', GETDATE());
RAISERROR('Step 10 OK: Prescriptions done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 11: ORDERS → INVOICES + INVOICE ITEMS (33,025 records)
-- Group by invoiceno → one Invoice header, multiple InvoiceItems
-- ============================================================
RAISERROR('Step 11: Migrating Orders → Invoices (33,025)...', 0, 1) WITH NOWAIT;

DECLARE @adminId INT = (SELECT TOP 1 Id FROM ClinicDB.dbo.Users WHERE TenantId=1 ORDER BY Id);

-- Invoice headers (one per unique invoiceno+patid)
;WITH IG AS (
    SELECT
        ISNULL(NULLIF(LTRIM(RTRIM(o.invoiceno)),''), 'INV-'+CAST(MIN(o.orderid) AS VARCHAR)) AS InvNum,
        LTRIM(RTRIM(o.patid)) AS patid,
        MIN(o.orderdate)  AS odate,
        SUM(ISNULL(o.totalprice,0)) AS total,
        MAX(CAST(ISNULL(o.ispaid,0) AS INT)) AS paid
    FROM dbOHMS.dbo.tblOrder o
    WHERE NULLIF(LTRIM(RTRIM(o.patid)),'') IS NOT NULL
    GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(o.invoiceno)),''),'INV-'+CAST(o.orderid AS VARCHAR)), LTRIM(RTRIM(o.patid))
)
INSERT INTO ClinicDB.dbo.Invoices
    (TenantId, InvoiceNumber, PatientId, StatusId, IssueDate, SubTotal, TotalAmount, PaidAmount, CreatedBy, CreatedAt)
SELECT 1, ig.InvNum, mp.NewId,
    CASE WHEN ig.paid=1 THEN 4 ELSE 2 END,
    ISNULL(CAST(ig.odate AS DATE), CAST(GETDATE() AS DATE)),
    ig.total, ig.total,
    CASE WHEN ig.paid=1 THEN ig.total ELSE 0 END,
    @adminId, ISNULL(ig.odate, GETDATE())
FROM IG
JOIN dbo.Map_PatientId mp ON ig.patid=mp.OldMRN;

-- InvoiceItems (one per tblOrder row)
INSERT INTO ClinicDB.dbo.InvoiceItems
    (InvoiceId, ItemType, Description, Quantity, UnitPrice, Discount, Total)
SELECT inv.Id,
    CASE LOWER(LTRIM(RTRIM(o.category)))
        WHEN 'consultation' THEN 1 WHEN 'lab' THEN 2 WHEN 'laboratory' THEN 2
        WHEN 'drug' THEN 3 WHEN 'pharmacy' THEN 3 WHEN 'procedure' THEN 4
        ELSE 5
    END,
    LEFT(ISNULL(LTRIM(RTRIM(o.item)),'Service'),200),
    ISNULL(o.quantity,1),
    ISNULL(o.unitprice,0), 0,
    ISNULL(o.totalprice,0)
FROM dbOHMS.dbo.tblOrder o
JOIN dbo.Map_PatientId mp ON LTRIM(RTRIM(o.patid))=mp.OldMRN
JOIN ClinicDB.dbo.Invoices inv
    ON inv.InvoiceNumber=ISNULL(NULLIF(LTRIM(RTRIM(o.invoiceno)),''),'INV-'+CAST(o.orderid AS VARCHAR))
    AND inv.TenantId=1;

DECLARE @c11 INT = @@ROWCOUNT;
INSERT INTO dbo.MigrationLog VALUES ('Step 11: Invoices', 'OK', @c11, 'Grouped by invoiceno; isPaid→StatusId 4=Paid 2=Issued', GETDATE());
RAISERROR('Step 11 OK: Invoices done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- STEP 12: MEDICAL CERTIFICATES (806 records → new MedicalCertificates table)
-- ============================================================
RAISERROR('Step 12: Migrating Medical Certificates (806)...', 0, 1) WITH NOWAIT;

IF OBJECT_ID('ClinicDB.dbo.MedicalCertificates') IS NULL
BEGIN
    CREATE TABLE ClinicDB.dbo.MedicalCertificates (
        Id              INT          NOT NULL IDENTITY(1,1),
        TenantId        TINYINT      NOT NULL DEFAULT 1,
        PatientId       INT          NULL,
        PatientMRN      NVARCHAR(50) NULL,
        FullName        NVARCHAR(200) NULL,
        Age             INT          NULL,
        Address         NVARCHAR(400) NULL,
        ExaminedOn      DATE         NULL,
        Diagnosis       NVARCHAR(1000) NULL,
        Recommendation  NVARCHAR(1000) NULL,
        RestDays        NVARCHAR(50) NULL,
        DoctorName      NVARCHAR(400) NULL,
        DoctorId        INT          NULL,
        Specialty       NVARCHAR(400) NULL,
        CertificateHash UNIQUEIDENTIFIER NULL,
        IssuedAt        DATETIME2    NULL,
        CreatedAt       DATETIME2    NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_MedicalCertificates PRIMARY KEY (Id),
        CONSTRAINT FK_MedCert_Patients FOREIGN KEY (PatientId) REFERENCES ClinicDB.dbo.Patients(Id),
        CONSTRAINT FK_MedCert_Tenants  FOREIGN KEY (TenantId)  REFERENCES ClinicDB.dbo.Tenants(Id)
    );
    CREATE INDEX IX_MedCert_PatientId  ON ClinicDB.dbo.MedicalCertificates (PatientId);
    CREATE INDEX IX_MedCert_ExaminedOn ON ClinicDB.dbo.MedicalCertificates (ExaminedOn);
END

INSERT INTO ClinicDB.dbo.MedicalCertificates
    (TenantId, PatientId, PatientMRN, FullName, Age, Address, ExaminedOn,
     Diagnosis, Recommendation, RestDays, DoctorName, DoctorId, Specialty, CertificateHash, IssuedAt)
SELECT 1, mp.NewId,
    LTRIM(RTRIM(mc.patid)), mc.fullname, mc.age, mc.address, mc.examinedon,
    mc.diagnosis, mc.recommendation, mc.rest, mc.doctor,
    md.NewDoctorId,
    mc.specialty, mc.hash,
    ISNULL(mc.regdate, GETDATE())
FROM dbOHMS.dbo.tblMedicalCertificate mc
LEFT JOIN dbo.Map_PatientId mp ON LTRIM(RTRIM(mc.patid))=mp.OldMRN
LEFT JOIN dbo.Map_DoctorName md ON LOWER(LTRIM(RTRIM(
    REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(mc.doctor,''))),'Dr. ',''),'Dr.','')
)))=md.DoctorNameVariant;

DECLARE @c12 INT = @@ROWCOUNT;
INSERT INTO dbo.MigrationLog VALUES ('Step 12: MedicalCertificates', 'OK', @c12, 'New MedicalCertificates table created in ClinicDB', GETDATE());
RAISERROR('Step 12 OK: Medical Certificates done.', 0, 1) WITH NOWAIT;
GO

-- ============================================================
-- FINAL SUMMARY
-- ============================================================
RAISERROR('', 0, 1) WITH NOWAIT;
RAISERROR('=== MIGRATION COMPLETE ===', 0, 1) WITH NOWAIT;

SELECT StepName, Status, RecordCount, Notes,
    CONVERT(VARCHAR(20), RunAt, 120) AS RunAt
FROM dbo.MigrationLog ORDER BY Id;
GO

-- Final record count verification
SELECT T.[Table], T.[Rows] FROM (VALUES
    ('Patients',           (SELECT COUNT(*) FROM ClinicDB.dbo.Patients          WHERE TenantId=1)),
    ('Users',              (SELECT COUNT(*) FROM ClinicDB.dbo.Users              WHERE TenantId=1)),
    ('Staff',              (SELECT COUNT(*) FROM ClinicDB.dbo.Staff              WHERE TenantId=1)),
    ('Doctors',            (SELECT COUNT(*) FROM ClinicDB.dbo.Doctors)),
    ('Appointments',       (SELECT COUNT(*) FROM ClinicDB.dbo.Appointments       WHERE TenantId=1)),
    ('Encounters',         (SELECT COUNT(*) FROM ClinicDB.dbo.Encounters         WHERE TenantId=1)),
    ('Diagnoses',          (SELECT COUNT(*) FROM ClinicDB.dbo.Diagnoses)),
    ('Prescriptions',      (SELECT COUNT(*) FROM ClinicDB.dbo.Prescriptions      WHERE TenantId=1)),
    ('PrescriptionItems',  (SELECT COUNT(*) FROM ClinicDB.dbo.PrescriptionItems)),
    ('DrugFormulary',      (SELECT COUNT(*) FROM ClinicDB.dbo.DrugFormulary      WHERE TenantId=1)),
    ('LabOrders',          (SELECT COUNT(*) FROM ClinicDB.dbo.LabOrders          WHERE TenantId=1)),
    ('LabOrderItems',      (SELECT COUNT(*) FROM ClinicDB.dbo.LabOrderItems)),
    ('LabTestCatalog',     (SELECT COUNT(*) FROM ClinicDB.dbo.LabTestCatalog     WHERE TenantId=1)),
    ('Invoices',           (SELECT COUNT(*) FROM ClinicDB.dbo.Invoices           WHERE TenantId=1)),
    ('InvoiceItems',       (SELECT COUNT(*) FROM ClinicDB.dbo.InvoiceItems)),
    ('MedicalCertificates',(SELECT COUNT(*) FROM ClinicDB.dbo.MedicalCertificates WHERE TenantId=1)),
    ('LegacyServices',     (SELECT COUNT(*) FROM ClinicDB.dbo.LegacyServices))
) T([Table],[Rows])
ORDER BY T.[Table];
GO
