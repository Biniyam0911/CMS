USE ClinicDB;
GO

-- Drop the restrictive check constraint
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_LabInstruments_Protocol')
BEGIN
    ALTER TABLE LabInstruments DROP CONSTRAINT CHK_LabInstruments_Protocol;
END
GO

-- Seed default instruments
IF NOT EXISTS (SELECT 1 FROM LabInstruments WHERE Name LIKE '%ZYBIO%')
BEGIN
    INSERT INTO LabInstruments (
        TenantId, Name, Model, SerialNumber, Protocol, IpAddress, Port,
        Category, Department, StationId, Description, ConnectionMode, RemoteIp, RemotePort, IsActive, CreatedAt
    ) VALUES (
        1,
        'ZYBIO Z3 Hematology Analyzer',
        'ZYBIO Hematology Analyzer model z3',
        'HEM-ZYBIO-Z3',
        'HL7 v2.3.1 MLLP',
        '192.168.1.41',
        5100,
        'Hematology',
        'Hematology',
        'HEM-ZYBIO-Z3',
        'ZYBIO Z3 automated 3-part / 5-part hematology analyzer. Machine initiates TCP connection to server port 5100 and sends HL7 ORU^R01 CBC panels with sample ID.',
        'PASSIVE',
        '192.168.1.41',
        5100,
        1,
        SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM LabInstruments WHERE Name LIKE '%TEMIS%')
BEGIN
    INSERT INTO LabInstruments (
        TenantId, Name, Model, SerialNumber, Protocol, IpAddress, Port,
        Category, Department, StationId, Description, ConnectionMode, RemoteIp, RemotePort, IsActive, CreatedAt
    ) VALUES (
        1,
        'Linear TEMIS Chemistry Analyzer',
        'Linear Chemistry analyzer model: TEMIS',
        'CHM-LINEAR-TEMIS',
        'ASTM 1394 / E1381',
        '192.168.1.115',
        5200,
        'Clinical Chemistry',
        'Clinical Chemistry',
        'CHM-LINEAR-TEMIS',
        'Linear TEMIS automated clinical chemistry analyzer for biochemistry panels and electrolytes',
        'PASSIVE',
        '192.168.1.115',
        5200,
        1,
        SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM LabInstruments WHERE Name LIKE '%Finecare%')
BEGIN
    INSERT INTO LabInstruments (
        TenantId, Name, Model, SerialNumber, Protocol, IpAddress, Port,
        Category, Department, StationId, Description, ConnectionMode, RemoteIp, RemotePort, IsActive, CreatedAt
    ) VALUES (
        1,
        'Finecare Wondfo Immunoassay',
        'Finecare immunoassay analyzer wondofa',
        'IMM-FINECARE-WOND',
        'HL7 v2.5.1 MLLP',
        '192.168.8.60',
        8004,
        'Hormone / Immunoassay',
        'Hormone / Immunoassay',
        'IMM-FINECARE-WOND',
        'Finecare Wondfo fluorescence immunoassay analyzer (192.168.8.x subnet). Machine listens on port 8004 — server actively dials out to connect.',
        'ACTIVE',
        '192.168.8.60',
        8004,
        1,
        SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM LabInstruments WHERE Name LIKE '%Sysmex%')
BEGIN
    INSERT INTO LabInstruments (
        TenantId, Name, Model, SerialNumber, Protocol, IpAddress, Port,
        Category, Department, StationId, Description, ConnectionMode, RemoteIp, RemotePort, IsActive, CreatedAt
    ) VALUES (
        1,
        'Sysmex XN-550 (Main Hematology)',
        'Sysmex XN-550 (Automated 5-Part Diff Hematology Analyzer)',
        'HEM-SYSMEX-01',
        'HL7 v2.5.1 MLLP',
        '192.168.1.140',
        2575,
        'Hematology',
        'Hematology',
        'HEM-SYSMEX-01',
        'Sysmex automated 5-part differential hematology workcell with barcode pre-analytical scanner',
        'PASSIVE',
        '192.168.1.140',
        2575,
        1,
        SYSUTCDATETIME()
    );
END
GO

PRINT 'Drop constraint and seed completed successfully.';
GO
