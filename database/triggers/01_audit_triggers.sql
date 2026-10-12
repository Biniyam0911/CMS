-- ============================================================
-- Audit Triggers — Patients, Encounters, LabResults
-- ============================================================
-- Run this script against ClinicDB to create/update all audit triggers.
-- These triggers use SESSION_CONTEXT(N'UserId') to capture the acting user.
-- The application sets this via: EXEC sp_set_session_context N'UserId', @userId
-- before each data-modifying statement.
-- ============================================================
USE ClinicDB;
GO

-- ============================================================
-- Patients AFTER UPDATE, DELETE
-- ============================================================
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
            COALESCE(
                TRY_CAST(SESSION_CONTEXT(N'UserId') AS INT),
                (SELECT TOP 1 CreatedBy FROM inserted WHERE Id = d.Id),
                d.CreatedBy,
                1
            ),
            GETDATE()
        FROM deleted d;
    END;
END;
GO

-- ============================================================
-- Encounters AFTER UPDATE, DELETE
-- ============================================================
CREATE OR ALTER TRIGGER trg_Encounters_Audit
ON Encounters
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted)
    BEGIN
        INSERT INTO AuditLog (TableName, RecordId, Operation, OldValues, ChangedBy, ChangedAt)
        SELECT
            'Encounters',
            CAST(d.Id AS NVARCHAR(50)),
            CASE WHEN EXISTS (SELECT 1 FROM inserted WHERE Id = d.Id) THEN 'U' ELSE 'D' END,
            (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            COALESCE(
                TRY_CAST(SESSION_CONTEXT(N'UserId') AS INT),
                (SELECT TOP 1 CreatedBy FROM inserted WHERE Id = d.Id),
                d.CreatedBy,
                1
            ),
            GETDATE()
        FROM deleted d;
    END;
END;
GO

-- ============================================================
-- LabResults AFTER UPDATE, DELETE
-- ============================================================
CREATE OR ALTER TRIGGER trg_LabResults_Audit
ON LabResults
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted)
    BEGIN
        INSERT INTO AuditLog (TableName, RecordId, Operation, OldValues, ChangedBy, ChangedAt)
        SELECT
            'LabResults',
            CAST(d.Id AS NVARCHAR(50)),
            CASE WHEN EXISTS (SELECT 1 FROM inserted WHERE Id = d.Id) THEN 'U' ELSE 'D' END,
            (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            COALESCE(
                TRY_CAST(SESSION_CONTEXT(N'UserId') AS INT),
                (SELECT TOP 1 VerifiedBy FROM inserted WHERE Id = d.Id),
                (SELECT TOP 1 EnteredBy  FROM inserted WHERE Id = d.Id),
                d.VerifiedBy,
                d.EnteredBy,
                1
            ),
            GETDATE()
        FROM deleted d;
    END;
END;
GO
