-- ============================================================
-- 15 - API Management & Webhooks Schema
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE ApiKeys (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    Name            NVARCHAR(100)   NOT NULL,
    KeyPrefix       VARCHAR(10)     NOT NULL, -- First 8 chars for identification
    KeyHash         VARCHAR(128)    NOT NULL, -- SHA256 of the actual secret key
    RateLimitRpm    INT             NOT NULL DEFAULT 60, -- Requests per minute
    AllowedIps      NVARCHAR(500)   NULL, -- Comma-separated IP whitelist (optional)
    ExpiresAt       DATETIME2       NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    LastUsedAt      DATETIME2       NULL,
    CreatedBy       INT             NOT NULL,
    CONSTRAINT PK_ApiKeys PRIMARY KEY (Id),
    CONSTRAINT FK_ApiKeys_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
GO

CREATE TABLE WebhookSubscriptions (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    EndpointUrl     NVARCHAR(500)   NOT NULL,
    SecretKey       VARCHAR(128)    NOT NULL, -- HMAC signature key
    SubscribedEvents NVARCHAR(500)  NOT NULL, -- JSON or comma-separated e.g. 'patient.created,lab.result_verified,appointment.booked'
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CreatedBy       INT             NOT NULL,
    CONSTRAINT PK_WebhookSubscriptions PRIMARY KEY (Id),
    CONSTRAINT FK_Webhooks_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
GO

CREATE TABLE WebhookDeliveryLogs (
    Id              BIGINT          NOT NULL IDENTITY(1,1),
    WebhookId       INT             NOT NULL,
    EventName       VARCHAR(100)    NOT NULL,
    PayloadJson     NVARCHAR(MAX)   NOT NULL,
    ResponseStatusCode INT          NULL,
    ResponseBody    NVARCHAR(1000)  NULL,
    IsSuccess       BIT             NOT NULL DEFAULT 0,
    AttemptCount    TINYINT         NOT NULL DEFAULT 1,
    ExecutedAt      DATETIME2       NOT NULL DEFAULT GETDATE(),
    DurationMs      INT             NULL,
    CONSTRAINT PK_WebhookDeliveryLogs PRIMARY KEY (Id),
    CONSTRAINT FK_WebhookLogs_Sub FOREIGN KEY (WebhookId) REFERENCES WebhookSubscriptions(Id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_ApiKeys_Prefix ON ApiKeys (KeyPrefix) WHERE IsActive = 1;
CREATE INDEX IX_WebhookLogs_Webhook ON WebhookDeliveryLogs (WebhookId, ExecutedAt DESC);
GO
