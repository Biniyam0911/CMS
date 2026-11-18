-- ============================================================================
-- MIGRATION SCRIPT: Legacy Cosmetics Stock → dbo.CosmeticsItems (ClinicDB)
-- ============================================================================
-- Source DB  : dbOHMSfc
-- Source Table: dbo.Cosemotics  (note legacy typo in table name)
-- Target DB  : ClinicDB
-- Target Table: dbo.CosmeticsItems
--
-- Column Mapping:
--   Legacy                 → New
--   ItemID                 → (identity, not migrated)
--   ItemCode               → Code
--   Description            → Description
--   PurchaseUnitPrice      → PurchaseUnitPrice
--   SellingUnitPrice       → SellingUnitPrice
--   Margin                 → Margin  (NOTE: legacy stores raw value e.g. 1.56, same as new)
--   RegistrationDate       → RegistrationDate (cast to DATE)
--   RegisteredBy           → CreatedByName
--   Quantity               → Quantity
--   TotalPurchasePrice     → TotalPurchasePrice
--   TotalSellingPrice      → TotalSellingPrice
--   ItemType               → (no equivalent; logged in notes below)
--
-- Prerequisites:
--   1. Run this script connected to ClinicDB (or adjust USE statements).
--   2. Ensure a linked server OR run as two steps: export from dbOHMSfc, import to ClinicDB.
--   3. The new table enforces a UNIQUE index on (TenantId, Code). Duplicate codes
--      in legacy data will be skipped with a warning (see EXCEPT logic below).
-- ============================================================================

USE [ClinicDB];
GO

PRINT '=== Starting Cosmetics Stock Migration (dbOHMSfc.dbo.Cosemotics → dbo.CosmeticsItems) ===';
PRINT 'Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120);
GO

-- ---------------------------------------------------------------------------
-- STEP 1: Identify and log any duplicate ItemCodes in the legacy table
--         (duplicates will be migrated for the first occurrence only)
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 1: Duplicate ItemCode check in legacy data ---';

SELECT 
    ItemCode,
    COUNT(*) AS DuplicateCount
FROM [dbOHMSfc].[dbo].[Cosemotics]
WHERE ItemCode IS NOT NULL
GROUP BY ItemCode
HAVING COUNT(*) > 1
ORDER BY DuplicateCount DESC;
-- If this returns rows, review them before proceeding.
GO

-- ---------------------------------------------------------------------------
-- STEP 2: Preview what will be migrated
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 2: Preview source records ---';

SELECT 
    ItemID,
    ISNULL(ItemCode, 'NULL')        AS ItemCode,
    ISNULL(Description, 'NULL')     AS Description,
    ISNULL(PurchaseUnitPrice, 0)    AS PurchaseUnitPrice,
    ISNULL(SellingUnitPrice, 0)     AS SellingUnitPrice,
    ISNULL(Margin, 1.00)            AS Margin,
    ISNULL(Quantity, 0)             AS Quantity,
    ISNULL(TotalPurchasePrice, 0)   AS TotalPurchasePrice,
    ISNULL(TotalSellingPrice, 0)    AS TotalSellingPrice,
    CAST(ISNULL(RegistrationDate, GETDATE()) AS DATE) AS RegistrationDate,
    ISNULL(RegisteredBy, 'Migration') AS RegisteredBy,
    ISNULL(ItemType, '')             AS ItemType
FROM [dbOHMSfc].[dbo].[Cosemotics]
ORDER BY ItemID;
GO

-- ---------------------------------------------------------------------------
-- STEP 3: Perform the migration (skip items whose Code already exists in new DB)
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 3: Inserting legacy cosmetics stock into dbo.CosmeticsItems ---';

-- Wrap in a transaction so we can roll back if anything goes wrong
BEGIN TRANSACTION MigrateStock;

BEGIN TRY

    INSERT INTO [ClinicDB].[dbo].[CosmeticsItems] (
        TenantId,
        Code,
        Description,
        PurchaseUnitPrice,
        Quantity,
        Margin,
        SellingUnitPrice,
        TotalPurchasePrice,
        TotalSellingPrice,
        RegistrationDate,
        IsActive,
        CreatedAt
    )
    SELECT
        1                                               AS TenantId,
        -- Deduplicate: use ROW_NUMBER so only the first occurrence of each code is taken
        src.ItemCode                                    AS Code,
        ISNULL(src.Description, 'Unnamed Item')         AS Description,
        ISNULL(src.PurchaseUnitPrice, 0.00)             AS PurchaseUnitPrice,
        ISNULL(src.Quantity, 0.00)                      AS Quantity,
        -- Margin: legacy stores multiplier (e.g. 1.56). New table stores same format.
        -- If legacy Margin is 0 or NULL default to 1.00 (no markup assumption)
        CASE 
            WHEN ISNULL(src.Margin, 0) <= 0 THEN 1.0000
            ELSE CAST(src.Margin AS DECIMAL(18,4))
        END                                             AS Margin,
        ISNULL(src.SellingUnitPrice, 0.00)              AS SellingUnitPrice,
        ISNULL(src.TotalPurchasePrice, 0.00)            AS TotalPurchasePrice,
        ISNULL(src.TotalSellingPrice, 0.00)             AS TotalSellingPrice,
        CAST(ISNULL(src.RegistrationDate, GETDATE()) AS DATE) AS RegistrationDate,
        1                                               AS IsActive,
        ISNULL(src.RegistrationDate, GETDATE())         AS CreatedAt
    FROM (
        -- Use ROW_NUMBER to handle duplicate ItemCodes — keep the latest entry
        SELECT *,
            ROW_NUMBER() OVER (
                PARTITION BY ItemCode 
                ORDER BY RegistrationDate DESC, ItemID DESC
            ) AS rn
        FROM [dbOHMSfc].[dbo].[Cosemotics]
        WHERE ItemCode IS NOT NULL
          AND ItemCode != ''
    ) src
    WHERE src.rn = 1
      -- Skip codes that already exist in the target (idempotent re-run safety)
      AND NOT EXISTS (
          SELECT 1 
          FROM [ClinicDB].[dbo].[CosmeticsItems] ci
          WHERE ci.TenantId = 1 AND ci.Code = src.ItemCode
      );

    DECLARE @StockRowsInserted INT = @@ROWCOUNT;
    PRINT 'Stock rows inserted: ' + CAST(@StockRowsInserted AS VARCHAR);

    COMMIT TRANSACTION MigrateStock;
    PRINT '--- Cosmetics Stock Migration: COMMITTED ---';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION MigrateStock;
    PRINT '--- Cosmetics Stock Migration: ROLLED BACK ---';
    PRINT 'Error ' + CAST(ERROR_NUMBER() AS VARCHAR) + ': ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO

-- ---------------------------------------------------------------------------
-- STEP 4: Verification
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 4: Verification ---';

SELECT 
    'Legacy Source Count'    AS Source, 
    COUNT(*)                 AS [Row Count]
FROM [dbOHMSfc].[dbo].[Cosemotics]
UNION ALL
SELECT 
    'New Target Count (TenantId=1)', 
    COUNT(*)
FROM [ClinicDB].[dbo].[CosmeticsItems]
WHERE TenantId = 1;

PRINT '';
PRINT '=== Cosmetics Stock Migration Complete ===';
GO
