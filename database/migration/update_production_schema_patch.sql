-- =====================================================================
-- DATABASE UPDATE SCRIPT FOR PRODUCTION SERVER (ClinicDB)
-- Safe, Idempotent: Can be executed multiple times without error
-- =====================================================================
USE [ClinicDB];
GO

SET NOCOUNT ON;
PRINT '=======================================================';
PRINT 'Starting production database update for CMS...';
PRINT '=======================================================';
GO

-- ─────────────────────────────────────────────────────────────────────
-- 1. PatientTriage: Add VisitType column (fixes EMR & Triage queue)
-- ─────────────────────────────────────────────────────────────────────
IF COL_LENGTH('dbo.PatientTriage', 'VisitType') IS NULL
BEGIN
    ALTER TABLE dbo.PatientTriage ADD VisitType NVARCHAR(50) NULL;
    PRINT '✓ Added VisitType column to PatientTriage.';
END
ELSE
BEGIN
    PRINT '• Column VisitType already exists on PatientTriage.';
END
GO

-- Backfill default VisitType for existing records if null
UPDATE dbo.PatientTriage 
SET VisitType = 'New'
WHERE VisitType IS NULL;
PRINT '✓ Backfilled default VisitType on PatientTriage.';
GO

-- ─────────────────────────────────────────────────────────────────────
-- 2. Invoices: Add DoctorId column & index (fixes Billing & Reports)
-- ─────────────────────────────────────────────────────────────────────
IF COL_LENGTH('dbo.Invoices', 'DoctorId') IS NULL
BEGIN
    ALTER TABLE dbo.Invoices ADD DoctorId INT NULL;
    PRINT '✓ Added DoctorId column to Invoices.';
END
ELSE
BEGIN
    PRINT '• Column DoctorId already exists on Invoices.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_DoctorId' AND object_id = OBJECT_ID('dbo.Invoices'))
BEGIN
    CREATE INDEX IX_Invoices_DoctorId ON dbo.Invoices (TenantId, DoctorId);
    PRINT '✓ Created index IX_Invoices_DoctorId on Invoices.';
END
GO

-- Backfill DoctorId on existing invoices from Encounters, Triage, or Appointments
UPDATE i
SET i.DoctorId = COALESCE(
    (SELECT TOP 1 e.DoctorId FROM dbo.Encounters e WHERE e.Id = i.EncounterId),
    (SELECT TOP 1 t.AssignedDoctorId FROM dbo.PatientTriage t WHERE t.PatientId = i.PatientId AND t.AssignedDoctorId > 0 ORDER BY t.Id DESC),
    (SELECT TOP 1 a.DoctorId FROM dbo.Appointments a WHERE a.PatientId = i.PatientId AND a.DoctorId > 0 ORDER BY a.Id DESC)
)
FROM dbo.Invoices i
WHERE i.DoctorId IS NULL;
PRINT '✓ Backfilled DoctorId on Invoices where available.';
GO

-- ─────────────────────────────────────────────────────────────────────
-- 3. LabTestParameters: Add TextReferenceRange (fixes Lab catalog & save)
-- ─────────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.LabTestParameters', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.LabTestParameters', 'TextReferenceRange') IS NULL
    BEGIN
        ALTER TABLE dbo.LabTestParameters ADD TextReferenceRange NVARCHAR(200) NULL;
        PRINT '✓ Added TextReferenceRange column to LabTestParameters.';
    END
    ELSE
    BEGIN
        PRINT '• Column TextReferenceRange already exists on LabTestParameters.';
    END
END
GO

-- ─────────────────────────────────────────────────────────────────────
-- 4. Verify & Summary
-- ─────────────────────────────────────────────────────────────────────
PRINT '=======================================================';
PRINT 'Database update completed successfully!';
PRINT '=======================================================';
SELECT 'PatientTriage' AS [Table], 'VisitType' AS [Column], 
       CASE WHEN COL_LENGTH('dbo.PatientTriage', 'VisitType') IS NOT NULL THEN 'PRESENT' ELSE 'MISSING' END AS [Status]
UNION ALL
SELECT 'Invoices', 'DoctorId', 
       CASE WHEN COL_LENGTH('dbo.Invoices', 'DoctorId') IS NOT NULL THEN 'PRESENT' ELSE 'MISSING' END
UNION ALL
SELECT 'LabTestParameters', 'TextReferenceRange', 
       CASE WHEN COL_LENGTH('dbo.LabTestParameters', 'TextReferenceRange') IS NOT NULL THEN 'PRESENT' ELSE 'MISSING' END;
GO
