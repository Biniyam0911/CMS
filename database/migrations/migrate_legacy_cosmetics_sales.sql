-- ============================================================================
-- MIGRATION SCRIPT: Legacy Cosmetics Sales → dbo.CosmeticsSales + 
--                                             dbo.CosmeticsSaleItems (ClinicDB)
-- ============================================================================
-- Source DB   : dbOHMSfc
-- Source Table: dbo.CosmeticsSales (legacy — flat per-line model)
-- Target DB   : ClinicDB
-- Target Tables:
--   dbo.CosmeticsSales      (invoice/session header)
--   dbo.CosmeticsSaleItems  (line items per sale)
--
-- Column Mapping (legacy → new):
-- ─────────────────────────────────────────────────────────────────────────
-- dbo.CosmeticsSales (legacy):
--   ClientID          → (identity, not migrated)
--   Firstname         → FirstName
--   Middlename        → MiddleName
--   Lastname          → LastName
--   ItemCode          → CosmeticsSaleItems.ItemCode
--   ItemName          → CosmeticsSaleItems.ItemDescription
--   Quantity          → CosmeticsSaleItems.Quantity
--   Unitprice         → CosmeticsSaleItems.UnitPrice
--   Totalprice        → CosmeticsSaleItems.TotalPrice (line) + CosmeticsSales.TotalAmount (sum)
--   isplc             → CosmeticsSales.IsPlc
--   Registrationdate  → CosmeticsSales.SaleDate + SaleTime + CreatedAt
--   ispaid            → CosmeticsSales.PaymentStatus ('Paid' / 'Pending')
--   cashier           → CosmeticsSales.CreatedByName
--
-- Migration Strategy:
--   The legacy table is flat (one row per line item). The new schema is
--   normalized: one HEADER row in CosmeticsSales + one or more rows in
--   CosmeticsSaleItems.
--
--   Because the legacy table has NO session/invoice grouping key, we treat
--   EACH legacy row as its own independent single-item transaction.
--   This is accurate: each legacy ClientID represents one sale event.
--
--   Invoice numbers are generated as: CS-LEGACY-{ClientID:D6}
--
-- Prerequisites:
--   1. Run migrate_legacy_cosmetics_stock.sql FIRST so CosmeticsItems exist
--      (the ItemId FK on CosmeticsSaleItems will be resolved by ItemCode lookup).
--   2. Run this script on ClinicDB with linked server access to dbOHMSfc.
-- ============================================================================

USE [ClinicDB];
GO

-- Ensure CreatedByName column exists in dbo.CosmeticsSales if table was created in an earlier migration
IF COL_LENGTH('dbo.CosmeticsSales', 'CreatedByName') IS NULL
BEGIN
    ALTER TABLE dbo.CosmeticsSales ADD CreatedByName NVARCHAR(100) NULL;
    PRINT 'Added missing column CreatedByName to dbo.CosmeticsSales.';
END
GO

PRINT '=== Starting Cosmetics Sales Migration (dbOHMSfc.dbo.CosmeticsSales → ClinicDB) ===';
PRINT 'Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120);
GO

-- ---------------------------------------------------------------------------
-- STEP 1: Preview legacy data
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 1: Legacy sales data preview ---';

SELECT TOP 20
    ClientID,
    Firstname, Middlename, Lastname,
    ItemCode, ItemName,
    Quantity, Unitprice, Totalprice,
    isplc,
    Registrationdate,
    ispaid,
    cashier
FROM [dbOHMSfc].[dbo].[CosmeticsSales]
ORDER BY ClientID;

SELECT 
    COUNT(*)           AS TotalLegacyRows,
    MIN(Registrationdate) AS EarliestSale,
    MAX(Registrationdate) AS LatestSale,
    SUM(ISNULL(Totalprice, 0)) AS TotalRevenue
FROM [dbOHMSfc].[dbo].[CosmeticsSales];
GO

-- ---------------------------------------------------------------------------
-- STEP 2: Migrate — wrap in a transaction
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 2: Migrating sales records ---';

BEGIN TRANSACTION MigrateCosmeticsSales;

BEGIN TRY

    -- Temp table to hold migrated ClientIDs (for idempotency check)
    IF OBJECT_ID('tempdb..#MigratedSales') IS NOT NULL
        DROP TABLE #MigratedSales;

    CREATE TABLE #MigratedSales (
        LegacyClientId   INT NOT NULL,
        NewSaleId        INT NOT NULL,
        InvoiceNumber    NVARCHAR(50) NOT NULL
    );

    -- -----------------------------------------------------------------------
    -- Insert one header row into CosmeticsSales per legacy ClientID
    -- -----------------------------------------------------------------------
    -- Use a CURSOR to capture SCOPE_IDENTITY() for each inserted sale header,
    -- then insert the matching line item immediately after.
    -- -----------------------------------------------------------------------

    DECLARE 
        @LegacyId       INT,
        @Firstname      NVARCHAR(100),
        @Middlename     NVARCHAR(100),
        @Lastname       NVARCHAR(100),
        @ItemCode       NVARCHAR(100),
        @ItemName       NVARCHAR(500),
        @Quantity       DECIMAL(18,2),
        @Unitprice      DECIMAL(18,2),
        @Totalprice     DECIMAL(18,2),
        @IsPlc          BIT,
        @RegDate        DATETIME,
        @IsPaid         BIT,
        @Cashier        NVARCHAR(500),
        @NewSaleId      INT,
        @InvoiceNo      NVARCHAR(50),
        @PayStatus      NVARCHAR(50),
        @SaleDate       DATE,
        @SaleTime       TIME(0),
        @ResolvedItemId INT;

    DECLARE cur_legacy_sales CURSOR FAST_FORWARD FOR
        SELECT 
            ClientID,
            ISNULL(Firstname, ''),
            ISNULL(Middlename, ''),
            ISNULL(Lastname, ''),
            ISNULL(ItemCode, ''),
            ISNULL(ItemName, 'Unknown Item'),
            ISNULL(Quantity, 1.00),
            ISNULL(Unitprice, 0.00),
            ISNULL(Totalprice, 0.00),
            ISNULL(isplc, 0),
            ISNULL(Registrationdate, GETDATE()),
            ISNULL(ispaid, 1),
            ISNULL(cashier, 'Migration')
        FROM [dbOHMSfc].[dbo].[CosmeticsSales]
        -- Idempotency: skip records already migrated in a previous run
        WHERE NOT EXISTS (
            SELECT 1 
            FROM [ClinicDB].[dbo].[CosmeticsSales] cs
            WHERE cs.InvoiceNumber = 'CS-LEGACY-' + RIGHT('000000' + CAST(ClientID AS VARCHAR), 6)
              AND cs.TenantId = 1
        )
        ORDER BY ClientID;

    OPEN cur_legacy_sales;
    FETCH NEXT FROM cur_legacy_sales INTO
        @LegacyId, @Firstname, @Middlename, @Lastname,
        @ItemCode, @ItemName, @Quantity, @Unitprice, @Totalprice,
        @IsPlc, @RegDate, @IsPaid, @Cashier;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @InvoiceNo  = 'CS-LEGACY-' + RIGHT('000000' + CAST(@LegacyId AS VARCHAR), 6);
        SET @PayStatus  = CASE WHEN @IsPaid = 1 THEN 'Paid' ELSE 'Pending' END;
        SET @SaleDate   = CAST(@RegDate AS DATE);
        SET @SaleTime   = CAST(@RegDate AS TIME(0));

        -- Insert sale header
        INSERT INTO [ClinicDB].[dbo].[CosmeticsSales] (
            TenantId, InvoiceNumber, FirstName, MiddleName, LastName,
            IsPlc, IsOther, TotalAmount, PaymentStatus,
            SaleDate, SaleTime, CreatedByName, CreatedAt
        )
        VALUES (
            1,
            @InvoiceNo,
            @Firstname,
            NULLIF(@Middlename, ''),
            @Lastname,
            @IsPlc,
            0,                    -- IsOther: legacy had no Other flag; default to 0
            @Totalprice,
            @PayStatus,
            @SaleDate,
            @SaleTime,
            @Cashier,
            @RegDate
        );

        SET @NewSaleId = SCOPE_IDENTITY();

        -- Resolve ItemId from new CosmeticsItems table (by matching ItemCode)
        SELECT @ResolvedItemId = Id 
        FROM [ClinicDB].[dbo].[CosmeticsItems]
        WHERE TenantId = 1 AND Code = @ItemCode;
        -- If not found (item wasn't in stock table), leave as NULL

        -- Insert line item
        INSERT INTO [ClinicDB].[dbo].[CosmeticsSaleItems] (
            TenantId, SaleId, ItemId, ItemCode, ItemDescription,
            Quantity, UnitPrice, TotalPrice, PurchaseUnitPrice, CreatedAt
        )
        VALUES (
            1,
            @NewSaleId,
            @ResolvedItemId,          -- NULL if ItemCode not found in new stock
            @ItemCode,
            @ItemName,
            @Quantity,
            @Unitprice,
            @Totalprice,
            -- PurchaseUnitPrice: look up from migrated stock table if available
            ISNULL(
                (SELECT TOP 1 PurchaseUnitPrice 
                 FROM [ClinicDB].[dbo].[CosmeticsItems]
                 WHERE TenantId = 1 AND Code = @ItemCode),
                0.00
            ),
            @RegDate
        );

        INSERT INTO #MigratedSales (LegacyClientId, NewSaleId, InvoiceNumber)
        VALUES (@LegacyId, @NewSaleId, @InvoiceNo);

        FETCH NEXT FROM cur_legacy_sales INTO
            @LegacyId, @Firstname, @Middlename, @Lastname,
            @ItemCode, @ItemName, @Quantity, @Unitprice, @Totalprice,
            @IsPlc, @RegDate, @IsPaid, @Cashier;
    END;

    CLOSE cur_legacy_sales;
    DEALLOCATE cur_legacy_sales;

    DECLARE @SalesInserted INT = (SELECT COUNT(*) FROM #MigratedSales);
    PRINT 'Sales headers inserted  : ' + CAST(@SalesInserted AS VARCHAR);
    PRINT 'Sale line items inserted: ' + CAST(@SalesInserted AS VARCHAR) + ' (1-to-1 with headers)';

    COMMIT TRANSACTION MigrateCosmeticsSales;
    PRINT '--- Cosmetics Sales Migration: COMMITTED ---';

END TRY
BEGIN CATCH
    IF CURSOR_STATUS('global', 'cur_legacy_sales') >= 0
    BEGIN
        CLOSE cur_legacy_sales;
        DEALLOCATE cur_legacy_sales;
    END;
    ROLLBACK TRANSACTION MigrateCosmeticsSales;
    PRINT '--- Cosmetics Sales Migration: ROLLED BACK ---';
    PRINT 'Error ' + CAST(ERROR_NUMBER() AS VARCHAR) + ': ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO

-- ---------------------------------------------------------------------------
-- STEP 3: Verification
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 3: Verification ---';

SELECT 
    'Legacy Source Rows'                 AS [Source],
    COUNT(*)                             AS [Count],
    SUM(ISNULL(Totalprice, 0))           AS [Total Revenue]
FROM [dbOHMSfc].[dbo].[CosmeticsSales]
UNION ALL
SELECT 
    'New Sale Headers (TenantId=1)',
    COUNT(*),
    SUM(TotalAmount)
FROM [ClinicDB].[dbo].[CosmeticsSales]
WHERE TenantId = 1
  AND InvoiceNumber LIKE 'CS-LEGACY-%';

-- Show rows where ItemId could NOT be resolved (ItemCode not in new stock table)
PRINT '';
PRINT '--- Items with unresolved ItemCode (ItemId = NULL) ---';
SELECT 
    csi.ItemCode,
    csi.ItemDescription,
    COUNT(*) AS SalesCount
FROM [ClinicDB].[dbo].[CosmeticsSaleItems] csi
INNER JOIN [ClinicDB].[dbo].[CosmeticsSales] cs ON cs.Id = csi.SaleId
WHERE cs.TenantId = 1
  AND cs.InvoiceNumber LIKE 'CS-LEGACY-%'
  AND csi.ItemId IS NULL
GROUP BY csi.ItemCode, csi.ItemDescription
ORDER BY SalesCount DESC;
-- If this returns rows, those ItemCodes were sold in the past but are not in stock.
-- You may want to add them manually or they were discontinued items.

PRINT '';
PRINT '=== Cosmetics Sales Migration Complete ===';
GO
