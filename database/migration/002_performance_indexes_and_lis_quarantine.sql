-- =====================================================================
-- PERFORMANCE OPTIMIZATION COVERING INDEXES & LIS QUARANTINE SCHEMA
-- Phase 3 & Phase 4 Database Migration
-- =====================================================================

USE [ClinicDB];
GO

-- 1. Optimize AuditLog filtering by tenant and descending timestamp
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLog_Tenant_ChangedAt' AND object_id = OBJECT_ID('AuditLog'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLog_Tenant_ChangedAt
    ON [dbo].[AuditLog] ([TenantId], [ChangedAt] DESC)
    INCLUDE ([TableName], [RecordId], [Operation], [ChangedBy], [IpAddress]);
    PRINT 'Created IX_AuditLog_Tenant_ChangedAt';
END
GO

-- 2. Optimize Doctor Encounters lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Encounters_Tenant_Doctor_Date' AND object_id = OBJECT_ID('Encounters'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Encounters_Tenant_Doctor_Date
    ON [dbo].[Encounters] ([TenantId], [DoctorId], [EncounterDate])
    INCLUDE ([PatientId]);
    PRINT 'Created IX_Encounters_Tenant_Doctor_Date';
END
GO

-- 3. Optimize Invoices financial aggregations and date filtering
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_Tenant_Date_Paid' AND object_id = OBJECT_ID('Invoices'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Invoices_Tenant_Date_Paid
    ON [dbo].[Invoices] ([TenantId], [IssueDate], [StatusId])
    INCLUDE ([PaidAmount], [TotalAmount], [PatientId]);
    PRINT 'Created IX_Invoices_Tenant_Date_Paid';
END
GO

-- 4. Create UnassignedLabResults quarantine table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UnassignedLabResults')
BEGIN
    CREATE TABLE UnassignedLabResults (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        TenantId TINYINT NOT NULL DEFAULT 1,
        SampleId NVARCHAR(100) NULL,
        RemoteEndPoint NVARCHAR(100) NULL,
        RawMessage NVARCHAR(MAX) NOT NULL,
        PrimaryNumeric DECIMAL(18,4) NULL,
        SummaryText NVARCHAR(MAX) NULL,
        Flag NVARCHAR(50) NULL,
        IsCritical BIT NOT NULL DEFAULT 0,
        ReceivedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        Status NVARCHAR(50) NOT NULL DEFAULT 'PendingReview'
    );
    PRINT 'Created UnassignedLabResults';
END
GO
