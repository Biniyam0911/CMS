-- ============================================================
-- 11 - Custom Report Builder Tables
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE ReportTemplates (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    Name            NVARCHAR(200)   NOT NULL,
    Description     NVARCHAR(500)   NULL,
    OwnerId         INT             NOT NULL,       -- UserId
    IsPublic        BIT             NOT NULL DEFAULT 0,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_ReportTemplates PRIMARY KEY (Id),
    CONSTRAINT FK_ReportTemplates_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_ReportTemplates_Users FOREIGN KEY (OwnerId) REFERENCES Users(Id)
);
GO

CREATE TABLE ReportDefinitions (
    Id              INT             NOT NULL IDENTITY(1,1),
    TemplateId      INT             NOT NULL,
    DataSource      NVARCHAR(100)   NOT NULL,       -- e.g. 'Patients', 'Appointments'
    ColumnsJson     NVARCHAR(MAX)   NOT NULL,       -- JSON: [{field, alias, visible}]
    FiltersJson     NVARCHAR(MAX)   NULL,           -- JSON: [{field, operator, value}]
    GroupByJson     NVARCHAR(MAX)   NULL,           -- JSON: [{field, aggregate}]
    SortByJson      NVARCHAR(MAX)   NULL,           -- JSON: [{field, direction}]
    DateRangeField  NVARCHAR(100)   NULL,
    DateRangePreset NVARCHAR(50)    NULL,           -- Today, ThisWeek, ThisMonth, Custom
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_ReportDefinitions PRIMARY KEY (Id),
    CONSTRAINT UQ_ReportDefinitions_Template UNIQUE (TemplateId),
    CONSTRAINT FK_ReportDefinitions_Templates FOREIGN KEY (TemplateId) REFERENCES ReportTemplates(Id) ON DELETE CASCADE
);
GO

CREATE TABLE ReportSchedules (
    Id              INT             NOT NULL IDENTITY(1,1),
    TemplateId      INT             NOT NULL,
    CronExpression  VARCHAR(50)     NOT NULL,       -- e.g. '0 7 * * 1' = Monday 7AM
    Format          TINYINT         NOT NULL DEFAULT 1,  -- 1=PDF 2=Excel 3=CSV
    Recipients      NVARCHAR(MAX)   NOT NULL,       -- JSON: [email1, email2]
    IsActive        BIT             NOT NULL DEFAULT 1,
    LastRunAt       DATETIME2       NULL,
    NextRunAt       DATETIME2       NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ReportSchedules PRIMARY KEY (Id),
    CONSTRAINT FK_ReportSchedules_Templates FOREIGN KEY (TemplateId) REFERENCES ReportTemplates(Id) ON DELETE CASCADE
);
GO

CREATE TABLE ReportShares (
    Id          INT         NOT NULL IDENTITY(1,1),
    TemplateId  INT         NOT NULL,
    ShareType   TINYINT     NOT NULL,   -- 1=User 2=Role
    ShareRefId  INT         NOT NULL,   -- UserId or RoleId
    CreatedAt   DATETIME2   NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ReportShares PRIMARY KEY (Id),
    CONSTRAINT FK_ReportShares_Templates FOREIGN KEY (TemplateId) REFERENCES ReportTemplates(Id) ON DELETE CASCADE
);
GO

CREATE TABLE ReportExecutionLog (
    Id              BIGINT          NOT NULL IDENTITY(1,1),
    TemplateId      INT             NOT NULL,
    ExecutedBy      INT             NOT NULL,
    ExecutedAt      DATETIME2       NOT NULL DEFAULT GETDATE(),
    DurationMs      INT             NULL,
    RowCount        INT             NULL,
    Format          TINYINT         NULL,
    IsScheduled     BIT             NOT NULL DEFAULT 0,
    ErrorMessage    NVARCHAR(500)   NULL,
    CONSTRAINT PK_ReportExecutionLog PRIMARY KEY (Id),
    CONSTRAINT FK_ReportExLog_Templates FOREIGN KEY (TemplateId) REFERENCES ReportTemplates(Id)
);
GO

CREATE INDEX IX_ReportTemplates_TenantOwner ON ReportTemplates (TenantId, OwnerId);
CREATE INDEX IX_ReportSchedules_NextRun ON ReportSchedules (NextRunAt, IsActive) WHERE IsActive = 1;
CREATE INDEX IX_ReportExLog_TemplateId ON ReportExecutionLog (TemplateId, ExecutedAt DESC);
GO
