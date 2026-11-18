-- ============================================================================
-- MIGRATION SCRIPT: Legacy Facial/Aesthetics → dbo.FacialRegistrations (ClinicDB)
-- ============================================================================
-- Source DB   : dbOHMSfc
-- Source Table: dbo.Aesthetics
-- Target DB   : ClinicDB
-- Target Table: dbo.FacialRegistrations
--
-- Column Mapping (legacy → new):
-- ─────────────────────────────────────────────────────────────────────────
--   ClientID           → (identity, not migrated; used for RegistrationNumber)
--   Firstname          → FirstName
--   Middlename         → MiddleName
--   Lastname           → LastName
--   Age                → Age
--   Type               → ProcedureType
--   UnitPrice          → UnitPrice
--   Quantity           → Quantity
--   TotalPrice         → TotalPrice
--   isActive           → (used to set Status: 1 = 'Completed', 0 = 'Cancelled')
--   RegistredeBy       → (stored in Notes: "Registered by: <name>")
--   RegistrationDate   → RegistrationDate (DATE) + RegistrationTime (TIME)
--   isPlc              → IsPlc
--   gender             → Gender
--   mobile             → Mobile
--
-- Notes:
--   • Legacy has no Discount, DoctorId, DoctorName, RegistrationNumber.
--     These are set to defaults (0, NULL, NULL, auto-generated).
--   • IsOther defaults to 0 (legacy had only isPlc).
--     If isPlc = 0, it may be PLC or Other — cannot distinguish from legacy.
--     All non-PLC records are imported as IsOther = 0 by default.
--     You may manually update specific records if the distinction is known.
--   • Registration numbers: FR-LEGACY-{ClientID:D6}
--   • Status: isActive=1 → 'Completed', isActive=0 → 'Cancelled'
--   • Discount = 0 (not tracked in legacy system)
--
-- Prerequisites:
--   1. Run this script on ClinicDB with linked server access to dbOHMSfc.
--   2. The ServiceId FK is left NULL (legacy had text-based Type, not FK).
--      After migration you may optionally map ProcedureType → ServiceId using
--      the UPDATE statement at the bottom of this script.
-- ============================================================================

USE [ClinicDB];
GO

PRINT '=== Starting Facial/Aesthetics Migration (dbOHMSfc.dbo.Aesthetics → ClinicDB.dbo.FacialRegistrations) ===';
PRINT 'Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120);
GO

-- ---------------------------------------------------------------------------
-- STEP 1: Preview legacy data
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 1: Legacy Aesthetics data preview ---';

SELECT TOP 20
    ClientID,
    Firstname, Middlename, Lastname,
    Age, gender, mobile,
    [Type],
    UnitPrice, Quantity, TotalPrice,
    isPlc,
    isActive,
    RegistredeBy,
    RegistrationDate
FROM [dbOHMSfc].[dbo].[Aesthetics]
ORDER BY ClientID;

SELECT 
    COUNT(*)               AS TotalLegacyRows,
    SUM(CASE WHEN isPlc = 1 THEN 1 ELSE 0 END) AS PLCRows,
    SUM(CASE WHEN ISNULL(isPlc, 0) = 0 THEN 1 ELSE 0 END) AS NonPLCRows,
    SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) AS ActiveRows,
    SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) AS InactiveRows,
    MIN(RegistrationDate)  AS EarliestRecord,
    MAX(RegistrationDate)  AS LatestRecord,
    SUM(ISNULL(TotalPrice, 0)) AS TotalRevenue
FROM [dbOHMSfc].[dbo].[Aesthetics];
GO

-- ---------------------------------------------------------------------------
-- STEP 2: Show distinct procedure types in legacy (for ServiceId mapping review)
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 2: Distinct Procedure Types in legacy (for ServiceId mapping) ---';

SELECT DISTINCT
    ISNULL([Type], 'NULL') AS ProcedureType,
    COUNT(*) OVER (PARTITION BY [Type]) AS UsageCount
FROM [dbOHMSfc].[dbo].[Aesthetics]
ORDER BY UsageCount DESC;
GO

-- ---------------------------------------------------------------------------
-- STEP 3: Perform migration
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 3: Inserting legacy facial records into dbo.FacialRegistrations ---';

BEGIN TRANSACTION MigrateFacialRegistrations;

BEGIN TRY

    INSERT INTO [ClinicDB].[dbo].[FacialRegistrations] (
        TenantId,
        RegistrationNumber,
        FirstName,
        MiddleName,
        LastName,
        Age,
        Gender,
        Mobile,
        ServiceId,
        ProcedureType,
        Quantity,
        UnitPrice,
        Discount,
        TotalPrice,
        DoctorId,
        DoctorName,
        IsPlc,
        IsOther,
        Notes,
        Status,
        RegistrationDate,
        RegistrationTime,
        CreatedAt,
        UpdatedAt
    )
    SELECT
        1                                                           AS TenantId,

        -- Auto-generate a registration number from the legacy ClientID
        'FR-LEGACY-' + RIGHT('000000' + CAST(src.ClientID AS VARCHAR), 6)
                                                                    AS RegistrationNumber,

        -- Name fields: enforce NOT NULL on FirstName / LastName
        ISNULL(NULLIF(LTRIM(RTRIM(src.Firstname)), ''), 'Unknown') AS FirstName,
        NULLIF(LTRIM(RTRIM(src.Middlename)), '')                   AS MiddleName,
        ISNULL(NULLIF(LTRIM(RTRIM(src.Lastname)), ''), 'Unknown')  AS LastName,

        src.Age                                                     AS Age,

        -- Normalize gender values
        CASE 
            WHEN LOWER(LTRIM(RTRIM(src.gender))) IN ('m', 'male')   THEN 'Male'
            WHEN LOWER(LTRIM(RTRIM(src.gender))) IN ('f', 'female') THEN 'Female'
            ELSE NULLIF(LTRIM(RTRIM(src.gender)), '')
        END                                                         AS Gender,

        NULLIF(LTRIM(RTRIM(src.mobile)), '')                        AS Mobile,

        NULL                                                        AS ServiceId,   -- resolved post-migration

        -- Procedure type: use Type field; fallback to 'Unknown Procedure'
        ISNULL(NULLIF(LTRIM(RTRIM(src.[Type])), ''), 'Unknown Procedure')
                                                                    AS ProcedureType,

        ISNULL(src.Quantity, 1)                                     AS Quantity,
        ISNULL(src.UnitPrice, 0.00)                                 AS UnitPrice,
        0.00                                                        AS Discount,     -- not tracked in legacy
        ISNULL(src.TotalPrice, 0.00)                                AS TotalPrice,

        NULL                                                        AS DoctorId,
        NULL                                                        AS DoctorName,

        ISNULL(src.isPlc, 0)                                        AS IsPlc,
        -- IsOther: legacy has no Other flag. If isPlc = 0, classify as IsOther = 0 by default.
        -- After migration, you can manually run:
        --   UPDATE FacialRegistrations SET IsOther = 1 WHERE IsPlc = 0 AND ... (your criteria)
        0                                                           AS IsOther,

        -- Preserve legacy metadata in Notes
        CASE 
            WHEN src.RegistredeBy IS NOT NULL 
            THEN 'Migrated from legacy system. Registered by: ' + src.RegistredeBy
            ELSE 'Migrated from legacy system.'
        END                                                         AS Notes,

        -- Status: active record = Completed, inactive = Cancelled
        CASE 
            WHEN ISNULL(src.isActive, 1) = 1 THEN 'Completed'
            ELSE 'Cancelled'
        END                                                         AS Status,

        CAST(ISNULL(src.RegistrationDate, GETDATE()) AS DATE)       AS RegistrationDate,
        CAST(ISNULL(src.RegistrationDate, GETDATE()) AS TIME(0))    AS RegistrationTime,
        ISNULL(src.RegistrationDate, GETDATE())                     AS CreatedAt,
        NULL                                                        AS UpdatedAt

    FROM [dbOHMSfc].[dbo].[Aesthetics] src
    WHERE
        -- Idempotency: skip if already migrated (check by RegistrationNumber)
        NOT EXISTS (
            SELECT 1 
            FROM [ClinicDB].[dbo].[FacialRegistrations] fr
            WHERE fr.TenantId = 1
              AND fr.RegistrationNumber = 'FR-LEGACY-' + RIGHT('000000' + CAST(src.ClientID AS VARCHAR), 6)
        );

    DECLARE @FacialRowsInserted INT = @@ROWCOUNT;
    PRINT 'Facial registration rows inserted: ' + CAST(@FacialRowsInserted AS VARCHAR);

    COMMIT TRANSACTION MigrateFacialRegistrations;
    PRINT '--- Facial Migration: COMMITTED ---';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION MigrateFacialRegistrations;
    PRINT '--- Facial Migration: ROLLED BACK ---';
    PRINT 'Error ' + CAST(ERROR_NUMBER() AS VARCHAR) + ': ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO

-- ---------------------------------------------------------------------------
-- STEP 4: Optional — Map ProcedureType text → ServiceId 
--         Run this AFTER verifying dbo.Services is populated with Facial services
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 4 (OPTIONAL): Resolve ServiceId from ProcedureType text match ---';

/*
-- Uncomment and run when dbo.Services has been seeded with facial service names.

UPDATE fr
SET fr.ServiceId = s.Id
FROM [ClinicDB].[dbo].[FacialRegistrations] fr
INNER JOIN [ClinicDB].[dbo].[Services] s
    ON LOWER(LTRIM(RTRIM(s.Name))) = LOWER(LTRIM(RTRIM(fr.ProcedureType)))
WHERE fr.TenantId = 1
  AND fr.ServiceId IS NULL
  AND fr.RegistrationNumber LIKE 'FR-LEGACY-%';

PRINT 'ServiceId resolved for: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' rows.';
*/

PRINT 'Skipping optional ServiceId resolution (uncomment block above when ready).';
GO

-- ---------------------------------------------------------------------------
-- STEP 5: Optional — Mark non-PLC legacy records as IsOther
--         If your clinic policy is: isPlc=0 means IsOther=1 (not ambiguous)
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 5 (OPTIONAL): Set IsOther = 1 for non-PLC migrated records ---';

/*
-- Uncomment ONLY if your clinic confirms all non-PLC Aesthetics records are "Other"

UPDATE [ClinicDB].[dbo].[FacialRegistrations]
SET IsOther = 1
WHERE TenantId = 1
  AND IsPlc = 0
  AND RegistrationNumber LIKE 'FR-LEGACY-%';

PRINT 'IsOther set for: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' non-PLC rows.';
*/

PRINT 'Skipping optional IsOther update (uncomment block above when confirmed).';
GO

-- ---------------------------------------------------------------------------
-- STEP 6: Verification
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '--- STEP 6: Final Verification ---';

SELECT 
    'Legacy Source (Aesthetics)'          AS [Source],
    COUNT(*)                              AS [Row Count],
    SUM(ISNULL(TotalPrice, 0))            AS [Total Revenue]
FROM [dbOHMSfc].[dbo].[Aesthetics]
UNION ALL
SELECT 
    'New Target FacialRegistrations (TenantId=1, LEGACY)',
    COUNT(*),
    SUM(TotalPrice)
FROM [ClinicDB].[dbo].[FacialRegistrations]
WHERE TenantId = 1
  AND RegistrationNumber LIKE 'FR-LEGACY-%';

-- Revenue by PLC vs Other
PRINT '';
PRINT '--- Revenue split by PLC / Other (new table) ---';

SELECT
    CASE 
        WHEN IsPlc = 1 THEN 'PLC'
        WHEN IsOther = 1 THEN 'Other'
        ELSE 'Unclassified'
    END                             AS Category,
    COUNT(*)                        AS [Records],
    SUM(TotalPrice)                 AS [Total Revenue]
FROM [ClinicDB].[dbo].[FacialRegistrations]
WHERE TenantId = 1
  AND RegistrationNumber LIKE 'FR-LEGACY-%'
GROUP BY
    CASE 
        WHEN IsPlc = 1 THEN 'PLC'
        WHEN IsOther = 1 THEN 'Other'
        ELSE 'Unclassified'
    END;

PRINT '';
PRINT '=== Facial / Aesthetics Migration Complete ===';
GO
