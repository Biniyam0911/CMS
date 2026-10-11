-- Migration 001: Add MiddleName to Staff table
-- Run once against your SQL Server database

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Staff' AND COLUMN_NAME = 'MiddleName'
)
BEGIN
    ALTER TABLE Staff
    ADD MiddleName NVARCHAR(100) NULL;
    PRINT 'MiddleName column added to Staff table.';
END
ELSE
BEGIN
    PRINT 'MiddleName column already exists on Staff table.';
END
GO
