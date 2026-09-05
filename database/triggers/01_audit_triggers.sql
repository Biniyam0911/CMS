-- ============================================================
-- Audit Triggers — Patients, Encounters, LabResults
-- ============================================================
USE ClinicDB;
GO

-- Generic audit helper procedure
CREATE OR ALTER PROCEDURE sp_WriteAuditLog
    @TableName  NVARCHAR(100),
    @RecordId   NVARCHAR(50),
    @Operation  CHAR(1),
    @OldValues  NVARCHAR(MAX),
    @NewValues  NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    -- Get user context set by application (CONTEXT_INFO)
    DECLARE @UserId INT = CAST(SUBSTRING(CAST(CONTEXT_INFO() AS VARCHAR(128)), 1, 10) AS INT);
    INSERT INTO AuditLog (TableName, RecordId, Operation, OldValues, NewValues, ChangedBy)
    VALUES (@TableName, @RecordId, @Operation, @OldValues, @NewValues, NULLIF(@UserId, 0));
END;
GO

-- Patients UPDATE trigger
CREATE OR ALTER TRIGGER trg_Patients_Audit
ON Patients
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted)
    BEGIN
        INSERT INTO AuditLog (TableName, RecordId, Operation, OldValues, ChangedBy, ChangedAt)
        SELECT
            'Patients',
            CAST(d.Id AS NVARCHAR(50)),
            CASE WHEN EXISTS (SELECT 1 FROM inserted WHERE Id = d.Id) THEN 'U' ELSE 'D' END,
            (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            NULL,
            GETDATE()
        FROM deleted d;
    END;
END;
GO

-- Encounters UPDATE trigger
CREATE OR ALTER TRIGGER trg_Encounters_Audit
ON Encounters
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO AuditLog (TableName, RecordId, Operation, OldValues, ChangedAt)
    SELECT 'Encounters', CAST(d.Id AS NVARCHAR(50)),
           CASE WHEN EXISTS (SELECT 1 FROM inserted WHERE Id = d.Id) THEN 'U' ELSE 'D' END,
           (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           GETDATE()
    FROM deleted d;
END;
GO

-- LabResults UPDATE trigger
CREATE OR ALTER TRIGGER trg_LabResults_Audit
ON LabResults
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO AuditLog (TableName, RecordId, Operation, OldValues, ChangedAt)
    SELECT 'LabResults', CAST(d.Id AS NVARCHAR(50)),
           CASE WHEN EXISTS (SELECT 1 FROM inserted WHERE Id = d.Id) THEN 'U' ELSE 'D' END,
           (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           GETDATE()
    FROM deleted d;
END;
GO
