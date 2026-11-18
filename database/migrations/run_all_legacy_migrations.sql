-- ============================================================================
-- MASTER MIGRATION RUNNER
-- Runs all three legacy → new system migrations in correct dependency order
-- ============================================================================
-- Run order:
--   1. Cosmetics Stock  (must run BEFORE Cosmetics Sales so ItemId can be resolved)
--   2. Cosmetics Sales  (depends on CosmeticsItems for FK resolution)
--   3. Facial / Aesthetics (independent)
-- ============================================================================

USE [ClinicDB];
GO

-- ---------------------------------------------------------------------------
-- PRE-MIGRATION SCHEMA VERIFICATION & COLUMN GUARDS
-- Ensures target tables have all expected columns before data insertion
-- ---------------------------------------------------------------------------
IF OBJECT_ID('dbo.CosmeticsSales', 'U') IS NOT NULL AND COL_LENGTH('dbo.CosmeticsSales', 'CreatedByName') IS NULL
BEGIN
    ALTER TABLE dbo.CosmeticsSales ADD CreatedByName NVARCHAR(100) NULL;
    PRINT 'Added missing column CreatedByName to dbo.CosmeticsSales.';
END
GO

IF OBJECT_ID('dbo.CosmeticsSales', 'U') IS NOT NULL AND COL_LENGTH('dbo.CosmeticsSales', 'IsOther') IS NULL
BEGIN
    ALTER TABLE dbo.CosmeticsSales ADD IsOther BIT NOT NULL DEFAULT 0;
    PRINT 'Added missing column IsOther to dbo.CosmeticsSales.';
END
GO

IF OBJECT_ID('dbo.FacialRegistrations', 'U') IS NOT NULL AND COL_LENGTH('dbo.FacialRegistrations', 'IsOther') IS NULL
BEGIN
    ALTER TABLE dbo.FacialRegistrations ADD IsOther BIT NOT NULL DEFAULT 0;
    PRINT 'Added missing column IsOther to dbo.FacialRegistrations.';
END
GO

PRINT '╔══════════════════════════════════════════════════════════════╗';
PRINT '║   CMS Legacy → New System Migration Master Runner           ║';
PRINT '║   Source: dbOHMSfc   →   Target: ClinicDB                   ║';
PRINT '╚══════════════════════════════════════════════════════════════╝';
PRINT 'Start: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '';

-- Step 1
PRINT '▶ Step 1 of 3: Cosmetics Stock (Cosemotics → CosmeticsItems)';
:r "migrate_legacy_cosmetics_stock.sql"
GO

-- Step 2
PRINT '';
PRINT '▶ Step 2 of 3: Cosmetics Sales (CosmeticsSales → CosmeticsSales + CosmeticsSaleItems)';
:r "migrate_legacy_cosmetics_sales.sql"
GO

-- Step 3
PRINT '';
PRINT '▶ Step 3 of 3: Facial / Aesthetics (Aesthetics → FacialRegistrations)';
:r "migrate_legacy_facial.sql"
GO

PRINT '';
PRINT '╔══════════════════════════════════════════════════════════════╗';
PRINT '║              ALL MIGRATIONS COMPLETE                         ║';
PRINT '╚══════════════════════════════════════════════════════════════╝';
PRINT 'End: ' + CONVERT(VARCHAR, GETDATE(), 120);
GO
