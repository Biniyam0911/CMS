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
