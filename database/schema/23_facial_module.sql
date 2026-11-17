-- ============================================================
-- 23 - Facial Module Schema Migration (Production Environment)
-- ============================================================
-- Author: Clinic Management System (CMS)
-- Purpose: Facial Client Registration, Transactions, and Reporting (PLC & Other)
-- Target Database: ClinicDB / SQL Server 2019+
-- ============================================================

USE ClinicDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FacialRegistrations' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.FacialRegistrations (
        Id                  INT             IDENTITY(1,1) NOT NULL,
        TenantId            TINYINT         NOT NULL DEFAULT 1,
        RegistrationNumber  VARCHAR(30)     NOT NULL,
        FirstName           NVARCHAR(100)   NOT NULL,
        MiddleName          NVARCHAR(100)   NULL,
        LastName            NVARCHAR(100)   NOT NULL,
        FullName            AS (LTRIM(RTRIM(FirstName + ' ' + ISNULL(MiddleName + ' ', '') + LastName))),
        Age                 INT             NULL,
        Gender              NVARCHAR(20)    NULL,
        Mobile              NVARCHAR(50)    NULL,
        ServiceId           INT             NULL,
        ProcedureType       NVARCHAR(200)   NOT NULL,
        Quantity            INT             NOT NULL DEFAULT 1,
        UnitPrice           DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
        Discount            DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
        TotalPrice          DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
        DoctorId            INT             NULL,
        DoctorName          NVARCHAR(150)   NULL,
        IsPlc               BIT             NOT NULL DEFAULT 0,
        IsOther             BIT             NOT NULL DEFAULT 0,
        Notes               NVARCHAR(500)   NULL,
        Status              NVARCHAR(50)    NOT NULL DEFAULT 'Completed',
        RegistrationDate    DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        RegistrationTime    TIME(0)         NOT NULL DEFAULT CAST(GETDATE() AS TIME(0)),
        CreatedBy           INT             NULL,
        CreatedAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
        UpdatedAt           DATETIME2       NULL,

        CONSTRAINT PK_FacialRegistrations PRIMARY KEY CLUSTERED (Id ASC)
    );

    PRINT 'Created table dbo.FacialRegistrations successfully.';
END
ELSE
BEGIN
    PRINT 'Table dbo.FacialRegistrations already exists.';
END
GO

-- ------------------------------------------------------------
-- Indexes for High Performance Queries and Reports
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FacialRegistrations_Tenant_Date' AND object_id = OBJECT_ID('dbo.FacialRegistrations'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_FacialRegistrations_Tenant_Date 
    ON dbo.FacialRegistrations (TenantId, RegistrationDate DESC, Id DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FacialRegistrations_IsPlc' AND object_id = OBJECT_ID('dbo.FacialRegistrations'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_FacialRegistrations_IsPlc 
    ON dbo.FacialRegistrations (TenantId, IsPlc, RegistrationDate DESC)
    INCLUDE (RegistrationNumber, FirstName, MiddleName, LastName, Mobile, ProcedureType, Quantity, UnitPrice, Discount, TotalPrice, DoctorName);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FacialRegistrations_IsOther' AND object_id = OBJECT_ID('dbo.FacialRegistrations'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_FacialRegistrations_IsOther 
    ON dbo.FacialRegistrations (TenantId, IsOther, RegistrationDate DESC)
    INCLUDE (RegistrationNumber, FirstName, MiddleName, LastName, Mobile, ProcedureType, Quantity, UnitPrice, Discount, TotalPrice, DoctorName);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FacialRegistrations_Mobile' AND object_id = OBJECT_ID('dbo.FacialRegistrations'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_FacialRegistrations_Mobile 
    ON dbo.FacialRegistrations (TenantId, Mobile);
END
GO

PRINT 'Facial Module Schema Migration Complete.';
GO
