-- ============================================================
-- MIGRATION PATCH: Encounters in Invoices, Payroll Agreements & Enterprise Tables
-- Database: ClinicDB
-- Description:
--   1. Ensures EncounterId column & index exists on Invoices.
--   2. Backfills EncounterId on Invoices by linking to same-day or closest clinical encounters.
--   3. Creates & indexes PayrollAgreements table.
--   4. Seeds standard payroll categories & commission agreements for all clinic doctors.
--   5. Ensures ChapaTransactions table & indexes exist for payment gateway.
--   6. Ensures LabTestParameters exists with standard panel parameters.
-- ============================================================
USE ClinicDB;
GO

SET NOCOUNT ON;
PRINT '======================================================================';
PRINT '===  STARTING MIGRATION PATCH: ENCOUNTERS, INVOICES & PAYROLL     ===';
PRINT '======================================================================';
GO

-- ─────────────────────────────────────────────────────────────
-- PART 1: INVOICES & ENCOUNTERS LINKING
-- ─────────────────────────────────────────────────────────────
PRINT '------------------------------------------------------------';
PRINT 'Part 1: Ensuring EncounterId column and index on Invoices...';

IF COL_LENGTH('dbo.Invoices', 'EncounterId') IS NULL
BEGIN
    ALTER TABLE dbo.[Invoices] ADD [EncounterId] INT NULL;
    PRINT '--> Added column EncounterId to Invoices table.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_EncounterId' AND object_id = OBJECT_ID('dbo.Invoices'))
BEGIN
    CREATE INDEX IX_Invoices_EncounterId ON dbo.[Invoices] ([EncounterId]);
    PRINT '--> Created index IX_Invoices_EncounterId.';
END
GO

PRINT 'Part 1.1: Linking Invoices to exact same-day Encounters...';
UPDATE inv
SET inv.[EncounterId] = enc.[Id],
    inv.[UpdatedAt] = GETDATE()
FROM dbo.[Invoices] inv
CROSS APPLY (
    SELECT TOP 1 e.[Id]
    FROM dbo.[Encounters] e
    WHERE e.[TenantId] = inv.[TenantId]
      AND e.[PatientId] = inv.[PatientId]
      AND CAST(e.[EncounterDate] AS DATE) = CAST(inv.[IssueDate] AS DATE)
    ORDER BY e.[Id] DESC
) enc
WHERE inv.[EncounterId] IS NULL;

DECLARE @sameDayLinked INT = @@ROWCOUNT;
PRINT '--> Same-day encounters linked: ' + CAST(@sameDayLinked AS VARCHAR) + ' invoices.';

PRINT 'Part 1.2: Linking remaining Invoices to patient''s closest clinical Encounter...';
UPDATE inv
SET inv.[EncounterId] = enc.[Id],
    inv.[UpdatedAt] = GETDATE()
FROM dbo.[Invoices] inv
CROSS APPLY (
    SELECT TOP 1 e.[Id]
    FROM dbo.[Encounters] e
    WHERE e.[TenantId] = inv.[TenantId]
      AND e.[PatientId] = inv.[PatientId]
    ORDER BY ABS(DATEDIFF(day, e.[EncounterDate], inv.[IssueDate])) ASC, e.[Id] DESC
) enc
WHERE inv.[EncounterId] IS NULL;

DECLARE @closestLinked INT = @@ROWCOUNT;
PRINT '--> Closest patient encounters linked: ' + CAST(@closestLinked AS VARCHAR) + ' invoices.';
GO

-- ─────────────────────────────────────────────────────────────
-- PART 2: PAYROLL AGREEMENTS TABLE & SEEDING
-- ─────────────────────────────────────────────────────────────
PRINT '------------------------------------------------------------';
PRINT 'Part 2: Initializing PayrollAgreements table...';

IF OBJECT_ID('dbo.PayrollAgreements', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[PayrollAgreements] (
        [Id]          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [TenantId]    TINYINT NOT NULL DEFAULT 1,
        [DoctorId]    INT NOT NULL,
        [Category]    NVARCHAR(100) NOT NULL,
        [RateType]    TINYINT NOT NULL DEFAULT 1, -- 1=Percentage, 2=Fixed Amount
        [Rate]        DECIMAL(10,2) NOT NULL DEFAULT 0,
        [IsActive]    BIT NOT NULL DEFAULT 1,
        [CreatedAt]   DATETIME2 NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]   DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_PayrollAgreements_Tenants FOREIGN KEY ([TenantId]) REFERENCES dbo.[Tenants]([Id]),
        CONSTRAINT FK_PayrollAgreements_Doctors FOREIGN KEY ([DoctorId]) REFERENCES dbo.[Doctors]([Id]),
        CONSTRAINT UQ_PayrollAgreements_Tenant_Doctor_Category UNIQUE ([TenantId], [DoctorId], [Category])
    );
    PRINT '--> Created table PayrollAgreements.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PayrollAgreements_Doctor' AND object_id = OBJECT_ID('dbo.PayrollAgreements'))
BEGIN
    CREATE INDEX IX_PayrollAgreements_Doctor ON dbo.[PayrollAgreements] ([TenantId], [DoctorId], [IsActive]);
    PRINT '--> Created index IX_PayrollAgreements_Doctor.';
END
GO

PRINT 'Part 2.1: Seeding standard payroll categories for all active doctors...';

;WITH StandardCategories AS (
    SELECT 'Consultation' AS Category, CAST(50.00 AS DECIMAL(10,2)) AS DefaultRate UNION ALL
    SELECT 'Facial Aesthetics', 30.00 UNION ALL
    SELECT 'PRP Regenerative', 40.00 UNION ALL
    SELECT 'Intralesional Injection', 40.00 UNION ALL
    SELECT 'Electrotherapy', 35.00 UNION ALL
    SELECT 'Acne & Scarring', 35.00 UNION ALL
    SELECT 'Cryosurgery', 35.00 UNION ALL
    SELECT 'Laser & Pigment', 30.00 UNION ALL
    SELECT 'Hair Restoration', 35.00 UNION ALL
    SELECT 'Minor Procedure', 40.00 UNION ALL
    SELECT 'General Service', 30.00
)
INSERT INTO dbo.[PayrollAgreements] ([TenantId], [DoctorId], [Category], [RateType], [Rate], [IsActive], [CreatedAt], [UpdatedAt])
SELECT 
    1,
    d.[Id],
    c.[Category],
    1, -- 1=Percentage
    c.[DefaultRate],
    1,
    GETDATE(),
    GETDATE()
FROM dbo.[Doctors] d
CROSS JOIN StandardCategories c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.[PayrollAgreements] pa
    WHERE pa.[TenantId] = 1 AND pa.[DoctorId] = d.[Id] AND pa.[Category] = c.[Category]
);

DECLARE @seededAgreements INT = @@ROWCOUNT;
PRINT '--> Payroll agreements seeded: ' + CAST(@seededAgreements AS VARCHAR) + ' records.';
GO

-- ─────────────────────────────────────────────────────────────
-- PART 3: CHAPA PAYMENT TRANSACTIONS TABLE
-- ─────────────────────────────────────────────────────────────
PRINT '------------------------------------------------------------';
PRINT 'Part 3: Initializing ChapaTransactions table...';

IF OBJECT_ID('dbo.ChapaTransactions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ChapaTransactions] (
        [Id]             INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [TenantId]       TINYINT NOT NULL DEFAULT 1,
        [InvoiceId]      INT NOT NULL,
        [TxRef]          VARCHAR(100) NOT NULL UNIQUE,
        [Amount]         DECIMAL(12,2) NOT NULL,
        [Currency]       VARCHAR(10) NOT NULL DEFAULT 'ETB',
        [Email]          VARCHAR(100) NULL,
        [FirstName]      NVARCHAR(100) NULL,
        [LastName]       NVARCHAR(100) NULL,
        [PaymentStatus]  VARCHAR(30) NOT NULL DEFAULT 'pending',
        [CheckoutUrl]    NVARCHAR(500) NULL,
        [ChapaReference] VARCHAR(100) NULL,
        [CreatedAt]      DATETIME2 NOT NULL DEFAULT GETDATE(),
        [UpdatedAt]      DATETIME2 NULL,
        CONSTRAINT FK_ChapaTransactions_Invoices FOREIGN KEY ([InvoiceId]) REFERENCES dbo.[Invoices]([Id])
    );
    PRINT '--> Created table ChapaTransactions.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChapaTransactions_Invoice' AND object_id = OBJECT_ID('dbo.ChapaTransactions'))
BEGIN
    CREATE INDEX IX_ChapaTransactions_Invoice ON dbo.[ChapaTransactions] ([TenantId], [InvoiceId]);
    CREATE INDEX IX_ChapaTransactions_TxRef ON dbo.[ChapaTransactions] ([TxRef]);
    PRINT '--> Created indexes on ChapaTransactions.';
END
GO

-- ─────────────────────────────────────────────────────────────
-- PART 4: LAB TEST PARAMETERS (SUB-TESTS) INITIALIZATION
-- ─────────────────────────────────────────────────────────────
PRINT '------------------------------------------------------------';
PRINT 'Part 4: Ensuring LabTestParameters table and default panels...';

IF OBJECT_ID('dbo.LabTestParameters', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[LabTestParameters] (
        [Id]                 INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [TestCatalogId]      INT NOT NULL,
        [ParameterCode]      VARCHAR(50) NOT NULL,
        [ParameterName]      NVARCHAR(100) NOT NULL,
        [Unit]               VARCHAR(30) NULL,
        [ReferenceLow]       DECIMAL(10,2) NULL,
        [ReferenceHigh]      DECIMAL(10,2) NULL,
        [TextReferenceRange] NVARCHAR(200) NULL,
        [DisplayOrder]       INT NOT NULL DEFAULT 1,
        [CreatedAt]          DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_LabTestParameters_Catalog FOREIGN KEY ([TestCatalogId]) REFERENCES dbo.[LabTestCatalog]([Id]) ON DELETE CASCADE
    );
    PRINT '--> Created table LabTestParameters.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabTestParameters_Catalog' AND object_id = OBJECT_ID('dbo.LabTestParameters'))
BEGIN
    CREATE INDEX IX_LabTestParameters_Catalog ON dbo.[LabTestParameters] ([TestCatalogId], [DisplayOrder]);
    PRINT '--> Created index IX_LabTestParameters_Catalog.';
END
GO

-- Seed sub-test parameters for standard CBC, Lipid, and Glucose tests if not present
;WITH PanelDefs AS (
    -- Lipid Profile
    SELECT 'Lipid Profile' AS TestPattern, 'CHOL' AS PCode, 'Total Cholesterol' AS PName, 'mg/dL' AS Unit, 125.00 AS RefLow, 200.00 AS RefHigh, 1 AS Ord UNION ALL
    SELECT 'Lipid Profile', 'HDL', 'HDL Cholesterol', 'mg/dL', 40.00, 60.00, 2 UNION ALL
    SELECT 'Lipid Profile', 'LDL', 'LDL Cholesterol', 'mg/dL', 50.00, 100.00, 3 UNION ALL
    SELECT 'Lipid Profile', 'TRIG', 'Triglycerides', 'mg/dL', 10.00, 150.00, 4 UNION ALL
    -- Complete Blood Count (CBC)
    SELECT 'CBC', 'WBC', 'White Blood Cell Count', '10^3/uL', 4.50, 11.00, 1 UNION ALL
    SELECT 'CBC', 'RBC', 'Red Blood Cell Count', '10^6/uL', 4.30, 5.90, 2 UNION ALL
    SELECT 'CBC', 'HGB', 'Hemoglobin', 'g/dL', 13.50, 17.50, 3 UNION ALL
    SELECT 'CBC', 'HCT', 'Hematocrit', '%', 41.00, 53.00, 4 UNION ALL
    SELECT 'CBC', 'PLT', 'Platelets', '10^3/uL', 150.00, 450.00, 5 UNION ALL
    -- Blood Sugar / Glucose
    SELECT 'Glucose', 'FBS', 'Fasting Blood Sugar', 'mg/dL', 70.00, 99.00, 1 UNION ALL
    SELECT 'Glucose', 'PPBS', 'Postprandial Blood Sugar', 'mg/dL', 70.00, 140.00, 2 UNION ALL
    SELECT 'Glucose', 'HBA1C', 'Hemoglobin A1c', '%', 4.00, 5.60, 3
)
INSERT INTO dbo.[LabTestParameters] ([TestCatalogId], [ParameterCode], [ParameterName], [Unit], [ReferenceLow], [ReferenceHigh], [DisplayOrder], [CreatedAt])
SELECT 
    tc.[Id],
    pd.[PCode],
    pd.[PName],
    pd.[Unit],
    pd.[RefLow],
    pd.[RefHigh],
    pd.[Ord],
    SYSUTCDATETIME()
FROM dbo.[LabTestCatalog] tc
JOIN PanelDefs pd ON tc.[TestName] LIKE '%' + pd.[TestPattern] '%' OR tc.[TestCode] LIKE '%' + pd.[TestPattern] '%'
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.[LabTestParameters] p
    WHERE p.[TestCatalogId] = tc.[Id] AND p.[ParameterCode] = pd.[PCode]
);

DECLARE @labParamsSeeded INT = @@ROWCOUNT;
PRINT '--> Lab test parameters seeded: ' + CAST(@labParamsSeeded AS VARCHAR) + ' parameters.';
GO

-- ─────────────────────────────────────────────────────────────
-- SUMMARY REPORT
-- ─────────────────────────────────────────────────────────────
PRINT '======================================================================';
PRINT '===                 PATCH VERIFICATION SUMMARY                     ===';
PRINT '======================================================================';

SELECT 
    (SELECT COUNT(*) FROM dbo.[Invoices] WHERE [TenantId] = 1) AS [Total Invoices],
    (SELECT COUNT(*) FROM dbo.[Invoices] WHERE [TenantId] = 1 AND [EncounterId] IS NOT NULL) AS [Invoices With Encounters],
    (SELECT COUNT(*) FROM dbo.[Invoices] WHERE [TenantId] = 1 AND [EncounterId] IS NULL) AS [Invoices Unlinked (Walk-in/Pharmacy)],
    (SELECT COUNT(*) FROM dbo.[Doctors]) AS [Total Doctors],
    (SELECT COUNT(*) FROM dbo.[PayrollAgreements] WHERE [TenantId] = 1) AS [Total Payroll Agreements],
    (SELECT COUNT(DISTINCT [DoctorId]) FROM dbo.[PayrollAgreements] WHERE [TenantId] = 1) AS [Doctors With Agreements],
    (SELECT COUNT(*) FROM dbo.[LabTestParameters]) AS [Total Lab Test Parameters],
    (SELECT COUNT(*) FROM dbo.[ChapaTransactions]) AS [Total Chapa Transactions];

PRINT '=== MIGRATION PATCH COMPLETED SUCCESSFULLY ===';
GO
