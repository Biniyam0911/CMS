-- ============================================================
-- CMS Database Creation Script
-- Server: localhost\sqlexpress
-- Run as: sa / say@123
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'ClinicDB')
BEGIN
    CREATE DATABASE ClinicDB
    COLLATE SQL_Latin1_General_CP1_CI_AS;
END
GO

ALTER DATABASE ClinicDB SET QUERY_STORE = ON;
ALTER DATABASE ClinicDB SET QUERY_STORE (
    OPERATION_MODE = READ_WRITE,
    MAX_STORAGE_SIZE_MB = 1000,
    INTERVAL_LENGTH_MINUTES = 60
);
GO

USE ClinicDB;
GO

-- Enable Full-Text Search
IF NOT EXISTS (SELECT * FROM sys.fulltext_catalogs WHERE name = 'ClinicFTCatalog')
BEGIN
    CREATE FULLTEXT CATALOG ClinicFTCatalog AS DEFAULT;
END
GO
