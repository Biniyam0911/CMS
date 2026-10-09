-- =====================================================================================
-- CMS Production Database Migration Patch
-- Purpose: Widen LabResults.TextValue & LabResultsHistory.TextValue to NVARCHAR(MAX)
-- Author: Clinic Management System Engineering
-- Target DB: ClinicDB (SQL Server)
-- Note: LabResults is a SYSTEM_VERSIONED temporal table.
-- =====================================================================================

USE [ClinicDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT 'Starting migration: Widen LabResults.TextValue to NVARCHAR(MAX)...';

BEGIN TRY
    -- 1. Check if column already NVARCHAR(MAX) (CHARACTER_MAXIMUM_LENGTH = -1)
    IF EXISTS (
        SELECT 1 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'dbo' 
          AND TABLE_NAME = 'LabResults' 
          AND COLUMN_NAME = 'TextValue' 
          AND CHARACTER_MAXIMUM_LENGTH <> -1
    )
    BEGIN
        PRINT 'Temporal table dbo.LabResults detected with restricted TextValue length. Disabling system versioning...';

        -- Temporarily turn off system versioning
        ALTER TABLE dbo.LabResults SET (SYSTEM_VERSIONING = OFF);

        PRINT 'Altering dbo.LabResults.TextValue to NVARCHAR(MAX)...';
        ALTER TABLE dbo.LabResults ALTER COLUMN TextValue NVARCHAR(MAX) NULL;

        PRINT 'Altering dbo.LabResultsHistory.TextValue to NVARCHAR(MAX)...';
        ALTER TABLE dbo.LabResultsHistory ALTER COLUMN TextValue NVARCHAR(MAX) NULL;

        PRINT 'Re-enabling system versioning on dbo.LabResults...';
        ALTER TABLE dbo.LabResults SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.LabResultsHistory));

        PRINT 'SUCCESS: dbo.LabResults and dbo.LabResultsHistory TextValue altered to NVARCHAR(MAX).';
    END
    ELSE
    BEGIN
        PRINT 'dbo.LabResults.TextValue is already NVARCHAR(MAX). No schema alteration needed.';
    END
END TRY
BEGIN CATCH
    PRINT 'ERROR during migration: ' + ERROR_MESSAGE();
    -- Ensure system versioning is safely restored if it was left OFF
    IF OBJECT_ID('dbo.LabResults', 'U') IS NOT NULL
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LabResults' AND temporal_type = 0)
        BEGIN
            PRINT 'Restoring SYSTEM_VERSIONING = ON...';
            ALTER TABLE dbo.LabResults SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.LabResultsHistory));
        END;
    END;
    THROW;
END CATCH;
GO

-- Verification Check
SELECT 
    t.name AS TableName,
    c.name AS ColumnName,
    ty.name AS DataTypeName,
    c.max_length AS MaxLengthBytes,
    CASE WHEN c.max_length = -1 THEN 'NVARCHAR(MAX)' ELSE 'NVARCHAR(' + CAST(c.max_length/2 AS VARCHAR) + ')' END AS FriendlyType
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name IN ('LabResults', 'LabResultsHistory')
  AND c.name = 'TextValue';
GO

PRINT 'Migration script completed.';
GO
