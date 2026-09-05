-- ============================================================
-- 10 - Notifications Queue
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE Notifications (
    Id              BIGINT          NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    RecipientUserId INT             NULL,
    RecipientEmail  NVARCHAR(200)   NULL,
    RecipientPhone  VARCHAR(20)     NULL,
    Channel         TINYINT         NOT NULL,   -- 1=Email 2=SMS 3=InApp 4=EmailAndSMS
    Subject         NVARCHAR(300)   NULL,
    Body            NVARCHAR(MAX)   NOT NULL,
    Priority        TINYINT         NOT NULL DEFAULT 2,  -- 1=High 2=Normal 3=Low
    NotificationType NVARCHAR(50)   NOT NULL,            -- 'AppointmentReminder','LabResult','CriticalAlert',...
    RefType         NVARCHAR(50)    NULL,                -- entity type this notification is about
    RefId           INT             NULL,                -- entity ID
    StatusId        TINYINT         NOT NULL DEFAULT 1,  -- 1=Pending 2=Sent 3=Failed 4=Cancelled
    AttemptCount    TINYINT         NOT NULL DEFAULT 0,
    LastAttemptAt   DATETIME2       NULL,
    SentAt          DATETIME2       NULL,
    ErrorMessage    NVARCHAR(500)   NULL,
    ScheduledFor    DATETIME2       NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Notifications PRIMARY KEY (Id),
    CONSTRAINT FK_Notifications_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
GO

CREATE INDEX IX_Notifications_Pending ON Notifications (StatusId, ScheduledFor, Priority)
    WHERE StatusId = 1;
CREATE INDEX IX_Notifications_Type ON Notifications (NotificationType, CreatedAt DESC);
GO
