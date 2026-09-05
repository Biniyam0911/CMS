-- ============================================================
-- 12 - Audit Log (Trigger-Driven)
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE AuditLog (
    Id              BIGINT          NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    TableName       NVARCHAR(100)   NOT NULL,
    RecordId        NVARCHAR(50)    NOT NULL,
    Operation       CHAR(1)         NOT NULL CHECK (Operation IN ('I','U','D')),
    OldValues       NVARCHAR(MAX)   NULL,   -- JSON of old row
    NewValues       NVARCHAR(MAX)   NULL,   -- JSON of new row
    ChangedBy       INT             NULL,   -- UserId from session context
    ChangedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    IpAddress       VARCHAR(45)     NULL,
    CONSTRAINT PK_AuditLog PRIMARY KEY (Id)
);
GO

CREATE INDEX IX_AuditLog_Table ON AuditLog (TableName, RecordId, ChangedAt DESC);
CREATE INDEX IX_AuditLog_User ON AuditLog (ChangedBy, ChangedAt DESC);
GO

-- ============================================================
-- 13 - Cache Key Tracking
-- ============================================================

CREATE TABLE CacheKeyRegistry (
    CacheKey    NVARCHAR(300)   NOT NULL,
    TenantId    TINYINT         NULL,
    ExpiresAt   DATETIME2       NULL,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_CacheKeyRegistry PRIMARY KEY (CacheKey)
);
GO
