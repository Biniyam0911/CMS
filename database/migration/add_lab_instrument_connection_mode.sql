-- ============================================================
-- Add ConnectionMode to LabInstruments for Active/Passive mode
-- per-machine persistence. Active = server dials out to machine.
-- Passive = machine connects in to server listener.
-- ============================================================
USE ClinicDB;
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'LabInstruments' AND COLUMN_NAME = 'ConnectionMode'
)
BEGIN
    ALTER TABLE LabInstruments ADD ConnectionMode VARCHAR(10) NOT NULL CONSTRAINT DF_LabInstruments_ConnectionMode DEFAULT 'PASSIVE';
END
GO

-- Store machine's remote IP (for active outbound connect)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'LabInstruments' AND COLUMN_NAME = 'RemoteIp'
)
BEGIN
    ALTER TABLE LabInstruments ADD RemoteIp VARCHAR(45) NULL;
END
GO

-- Store machine's remote port (for active outbound connect)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'LabInstruments' AND COLUMN_NAME = 'RemotePort'
)
BEGIN
    ALTER TABLE LabInstruments ADD RemotePort INT NULL;
END
GO

-- Friendly name / station ID
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'LabInstruments' AND COLUMN_NAME = 'StationId'
)
BEGIN
    ALTER TABLE LabInstruments ADD StationId VARCHAR(50) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'LabInstruments' AND COLUMN_NAME = 'Department'
)
BEGIN
    ALTER TABLE LabInstruments ADD Department NVARCHAR(80) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'LabInstruments' AND COLUMN_NAME = 'Description'
)
BEGIN
    ALTER TABLE LabInstruments ADD Description NVARCHAR(500) NULL;
END
GO

PRINT 'LabInstruments schema updated successfully.';
GO
