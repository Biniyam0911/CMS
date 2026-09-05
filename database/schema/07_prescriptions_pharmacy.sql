-- ============================================================
-- 07 - Prescriptions & Pharmacy
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE DrugFormulary (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    GenericName     NVARCHAR(200)   NOT NULL,
    BrandName       NVARCHAR(200)   NULL,
    DrugClass       NVARCHAR(100)   NULL,
    Form            NVARCHAR(50)    NULL,  -- Tablet, Capsule, Syrup, Injection, etc.
    Strength        NVARCHAR(50)    NULL,  -- e.g. 500mg, 5mg/ml
    Unit            NVARCHAR(30)    NULL,
    StockQuantity   INT             NOT NULL DEFAULT 0,
    MinStockLevel   INT             NOT NULL DEFAULT 10,
    UnitPrice       DECIMAL(10,2)   NULL,
    IsControlled    BIT             NOT NULL DEFAULT 0,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_DrugFormulary PRIMARY KEY (Id),
    CONSTRAINT FK_DrugFormulary_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
GO

CREATE TABLE Prescriptions (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    EncounterId     INT             NOT NULL,
    PatientId       INT             NOT NULL,
    PrescribedBy    INT             NOT NULL,  -- DoctorId
    PrescribedAt    DATETIME2       NOT NULL DEFAULT GETDATE(),
    IsDispensed     BIT             NOT NULL DEFAULT 0,
    DispensedAt     DATETIME2       NULL,
    DispensedBy     INT             NULL,      -- StaffId (Pharmacist)
    Notes           NVARCHAR(500)   NULL,
    SysStartTime    DATETIME2       GENERATED ALWAYS AS ROW START NOT NULL,
    SysEndTime      DATETIME2       GENERATED ALWAYS AS ROW END   NOT NULL,
    PERIOD FOR SYSTEM_TIME (SysStartTime, SysEndTime),
    CONSTRAINT PK_Prescriptions PRIMARY KEY (Id),
    CONSTRAINT FK_Prescriptions_Tenants   FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Prescriptions_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id),
    CONSTRAINT FK_Prescriptions_Patients  FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_Prescriptions_Doctor    FOREIGN KEY (PrescribedBy) REFERENCES Doctors(Id)
)
WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.PrescriptionsHistory));
GO

CREATE TABLE PrescriptionItems (
    Id              INT             NOT NULL IDENTITY(1,1),
    PrescriptionId  INT             NOT NULL,
    DrugId          INT             NOT NULL,
    Dosage          NVARCHAR(100)   NOT NULL,  -- e.g. "500mg"
    Frequency       NVARCHAR(100)   NOT NULL,  -- e.g. "TID (3x daily)"
    Route           NVARCHAR(50)    NULL,       -- Oral, IV, IM, Topical
    DurationDays    SMALLINT        NULL,
    Quantity        SMALLINT        NOT NULL,
    Instructions    NVARCHAR(300)   NULL,
    CONSTRAINT PK_PrescriptionItems PRIMARY KEY (Id),
    CONSTRAINT FK_PrescriptionItems_Prescriptions FOREIGN KEY (PrescriptionId) REFERENCES Prescriptions(Id),
    CONSTRAINT FK_PrescriptionItems_Drug FOREIGN KEY (DrugId) REFERENCES DrugFormulary(Id)
);
GO

CREATE TABLE PharmacyDispenseLog (
    Id              INT             NOT NULL IDENTITY(1,1),
    PrescriptionId  INT             NOT NULL,
    ItemId          INT             NOT NULL,
    DrugId          INT             NOT NULL,
    QuantityGiven   SMALLINT        NOT NULL,
    DispensedBy     INT             NOT NULL,
    DispensedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
    BatchNumber     VARCHAR(50)     NULL,
    ExpiryDate      DATE            NULL,
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_PharmacyDispenseLog PRIMARY KEY (Id),
    CONSTRAINT FK_PharmacyDispense_Prescription FOREIGN KEY (PrescriptionId) REFERENCES Prescriptions(Id),
    CONSTRAINT FK_PharmacyDispense_Drug FOREIGN KEY (DrugId) REFERENCES DrugFormulary(Id)
);
GO

CREATE INDEX IX_DrugFormulary_TenantId ON DrugFormulary (TenantId);
CREATE INDEX IX_Prescriptions_PatientId ON Prescriptions (PatientId);
CREATE INDEX IX_Prescriptions_EncounterId ON Prescriptions (EncounterId);

CREATE FULLTEXT INDEX ON DrugFormulary (GenericName, BrandName, DrugClass)
    KEY INDEX PK_DrugFormulary ON ClinicFTCatalog;
GO
