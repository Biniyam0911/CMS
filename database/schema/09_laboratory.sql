-- ============================================================
-- 09 - Laboratory Information System (LIS)
-- ============================================================
USE ClinicDB;
GO

-- Lab instruments (HL7 / ASTM)
CREATE TABLE LabInstruments (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    Name            NVARCHAR(100)   NOT NULL,
    Model           NVARCHAR(100)   NULL,
    SerialNumber    VARCHAR(50)     NULL,
    Protocol        VARCHAR(10)     NOT NULL,  -- 'HL7' | 'ASTM'
    IpAddress       VARCHAR(45)     NULL,
    Port            INT             NULL,
    Category        NVARCHAR(50)    NULL,       -- Hematology, Biochemistry, Urinalysis, etc.
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_LabInstruments PRIMARY KEY (Id),
    CONSTRAINT FK_LabInstruments_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT CHK_LabInstruments_Protocol CHECK (Protocol IN ('HL7','ASTM'))
);
GO

-- Master test catalog
CREATE TABLE LabTestCatalog (
    Id                  INT             NOT NULL IDENTITY(1,1),
    TenantId            TINYINT         NOT NULL DEFAULT 1,
    TestCode            VARCHAR(20)     NOT NULL,
    TestName            NVARCHAR(200)   NOT NULL,
    Category            NVARCHAR(100)   NULL,    -- Hematology, Chemistry, Microbiology, etc.
    Method              NVARCHAR(100)   NULL,
    SampleType          NVARCHAR(50)    NULL,    -- Blood, Urine, Stool, CSF, etc.
    SampleVolume        VARCHAR(30)     NULL,
    TurnaroundMinutes   INT             NOT NULL DEFAULT 60,
    NormalRangeLow      DECIMAL(12,4)   NULL,
    NormalRangeHigh     DECIMAL(12,4)   NULL,
    CriticalLow         DECIMAL(12,4)   NULL,
    CriticalHigh        DECIMAL(12,4)   NULL,
    Unit                VARCHAR(30)     NULL,
    ResultType          TINYINT         NOT NULL DEFAULT 1,  -- 1=Numeric 2=Text 3=PosNeg
    Price               DECIMAL(10,2)   NULL,
    InstrumentId        INT             NULL,
    IsActive            BIT             NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_LabTestCatalog PRIMARY KEY (Id),
    CONSTRAINT UQ_LabTestCatalog_Code UNIQUE (TenantId, TestCode),
    CONSTRAINT FK_LabTestCatalog_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_LabTestCatalog_Instruments FOREIGN KEY (InstrumentId) REFERENCES LabInstruments(Id)
);
GO

-- Lab order headers
CREATE TABLE LabOrders (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    OrderNumber     VARCHAR(30)     NOT NULL,
    PatientId       INT             NOT NULL,
    EncounterId     INT             NULL,
    OrderedBy       INT             NOT NULL,    -- DoctorId
    Priority        TINYINT         NOT NULL DEFAULT 2,  -- 1=STAT 2=Routine 3=Scheduled
    OrderedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    ClinicalInfo    NVARCHAR(500)   NULL,
    StatusId        TINYINT         NOT NULL DEFAULT 1,  -- 1=Ordered 2=Collected 3=Processing 4=Resulted 5=Delivered
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_LabOrders PRIMARY KEY (Id),
    CONSTRAINT UQ_LabOrders_Number UNIQUE (TenantId, OrderNumber),
    CONSTRAINT FK_LabOrders_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_LabOrders_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_LabOrders_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id),
    CONSTRAINT FK_LabOrders_Doctors FOREIGN KEY (OrderedBy) REFERENCES Doctors(Id)
);
GO

-- Per-test line items
CREATE TABLE LabOrderItems (
    Id          INT         NOT NULL IDENTITY(1,1),
    OrderId     INT         NOT NULL,
    TestId      INT         NOT NULL,
    StatusId    TINYINT     NOT NULL DEFAULT 1,
    CONSTRAINT PK_LabOrderItems PRIMARY KEY (Id),
    CONSTRAINT FK_LabOrderItems_Orders FOREIGN KEY (OrderId) REFERENCES LabOrders(Id) ON DELETE CASCADE,
    CONSTRAINT FK_LabOrderItems_Tests FOREIGN KEY (TestId) REFERENCES LabTestCatalog(Id)
);
GO

-- Sample collection log
CREATE TABLE LabSamples (
    Id              INT             NOT NULL IDENTITY(1,1),
    OrderId         INT             NOT NULL,
    Barcode         VARCHAR(50)     NOT NULL,
    SampleType      NVARCHAR(50)    NOT NULL,
    Volume          VARCHAR(20)     NULL,
    CollectedBy     INT             NOT NULL,    -- StaffId
    CollectedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
    ReceivedAt      DATETIME2       NULL,
    Condition       NVARCHAR(100)   NULL,        -- Haemolysed, Lipemic, etc.
    RejectionReason NVARCHAR(200)   NULL,
    IsRejected      BIT             NOT NULL DEFAULT 0,
    CONSTRAINT PK_LabSamples PRIMARY KEY (Id),
    CONSTRAINT UQ_LabSamples_Barcode UNIQUE (Barcode),
    CONSTRAINT FK_LabSamples_Orders FOREIGN KEY (OrderId) REFERENCES LabOrders(Id)
);
GO

-- Work item assignment to technician/instrument
CREATE TABLE LabWorkItems (
    Id              INT             NOT NULL IDENTITY(1,1),
    OrderItemId     INT             NOT NULL,
    AssignedTo      INT             NULL,    -- StaffId (Lab Tech)
    InstrumentId    INT             NULL,
    StartedAt       DATETIME2       NULL,
    CompletedAt     DATETIME2       NULL,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_LabWorkItems PRIMARY KEY (Id),
    CONSTRAINT FK_LabWorkItems_OrderItems FOREIGN KEY (OrderItemId) REFERENCES LabOrderItems(Id),
    CONSTRAINT FK_LabWorkItems_Instruments FOREIGN KEY (InstrumentId) REFERENCES LabInstruments(Id)
);
GO

-- Results (temporal for audit trail)
CREATE TABLE LabResults (
    Id              INT             NOT NULL IDENTITY(1,1),
    OrderItemId     INT             NOT NULL,
    OrderId         INT             NOT NULL,
    TestId          INT             NOT NULL,
    PatientId       INT             NOT NULL,
    NumericValue    DECIMAL(12,4)   NULL,
    TextValue       NVARCHAR(500)   NULL,
    Unit            VARCHAR(30)     NULL,
    Flag            VARCHAR(5)      NULL,    -- H, L, HH, LL, Normal, POS, NEG
    ReferenceRange  NVARCHAR(100)   NULL,
    IsCritical      BIT             NOT NULL DEFAULT 0,
    EnteredBy       INT             NOT NULL,    -- StaffId (Lab Tech)
    EnteredAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    VerifiedBy      INT             NULL,        -- StaffId (Pathologist)
    VerifiedAt      DATETIME2       NULL,
    IsVerified      BIT             NOT NULL DEFAULT 0,
    SourceType      TINYINT         NOT NULL DEFAULT 1,  -- 1=Manual 2=HL7 3=ASTM
    RawMessage      NVARCHAR(MAX)   NULL,                -- Original HL7/ASTM message
    SysStartTime    DATETIME2       GENERATED ALWAYS AS ROW START NOT NULL,
    SysEndTime      DATETIME2       GENERATED ALWAYS AS ROW END   NOT NULL,
    PERIOD FOR SYSTEM_TIME (SysStartTime, SysEndTime),
    CONSTRAINT PK_LabResults PRIMARY KEY (Id),
    CONSTRAINT FK_LabResults_OrderItems FOREIGN KEY (OrderItemId) REFERENCES LabOrderItems(Id),
    CONSTRAINT FK_LabResults_Tests FOREIGN KEY (TestId) REFERENCES LabTestCatalog(Id)
)
WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.LabResultsHistory));
GO

-- Critical value alerts
CREATE TABLE LabCriticalAlerts (
    Id              INT             NOT NULL IDENTITY(1,1),
    ResultId        INT             NOT NULL,
    OrderId         INT             NOT NULL,
    PatientId       INT             NOT NULL,
    DoctorId        INT             NOT NULL,
    AlertValue      NVARCHAR(100)   NOT NULL,
    AlertFlag       VARCHAR(5)      NOT NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    NotifiedAt      DATETIME2       NULL,
    AcknowledgedBy  INT             NULL,
    AcknowledgedAt  DATETIME2       NULL,
    IsAcknowledged  BIT             NOT NULL DEFAULT 0,
    NotifyCount     TINYINT         NOT NULL DEFAULT 0,
    CONSTRAINT PK_LabCriticalAlerts PRIMARY KEY (Id),
    CONSTRAINT FK_LabCriticalAlerts_Results FOREIGN KEY (ResultId) REFERENCES LabResults(Id)
);
GO

-- QC log
CREATE TABLE LabQCLog (
    Id              INT             NOT NULL IDENTITY(1,1),
    InstrumentId    INT             NOT NULL,
    TestId          INT             NOT NULL,
    QCLevel         VARCHAR(20)     NULL,    -- Low, Normal, High
    LotNumber       VARCHAR(50)     NULL,
    ExpiryDate      DATE            NULL,
    NumericValue    DECIMAL(12,4)   NULL,
    ExpectedLow     DECIMAL(12,4)   NULL,
    ExpectedHigh    DECIMAL(12,4)   NULL,
    IsPassed        BIT             NOT NULL,
    RunBy           INT             NOT NULL,
    RunAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_LabQCLog PRIMARY KEY (Id),
    CONSTRAINT FK_LabQCLog_Instruments FOREIGN KEY (InstrumentId) REFERENCES LabInstruments(Id),
    CONSTRAINT FK_LabQCLog_Tests FOREIGN KEY (TestId) REFERENCES LabTestCatalog(Id)
);
GO

CREATE INDEX IX_LabOrders_PatientId ON LabOrders (PatientId, OrderedAt DESC);
CREATE INDEX IX_LabOrders_Status ON LabOrders (StatusId, TenantId);
CREATE INDEX IX_LabResults_OrderItemId ON LabResults (OrderItemId);
CREATE INDEX IX_LabResults_Critical ON LabResults (IsCritical) WHERE IsCritical = 1;
CREATE INDEX IX_LabCriticalAlerts_Unacked ON LabCriticalAlerts (IsAcknowledged, CreatedAt) WHERE IsAcknowledged = 0;
CREATE INDEX IX_LabSamples_Barcode ON LabSamples (Barcode);

CREATE FULLTEXT INDEX ON LabTestCatalog (TestName, Category, Method)
    KEY INDEX PK_LabTestCatalog ON ClinicFTCatalog;
GO
