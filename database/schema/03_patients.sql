-- ============================================================
-- 03 - Patients (Temporal Table for full history)
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE Patients (
    Id                  INT             NOT NULL IDENTITY(1,1),
    TenantId            TINYINT         NOT NULL DEFAULT 1,
    MRN                 VARCHAR(20)     NOT NULL,   -- Medical Record Number
    UserId              INT             NULL,        -- FK to Users (if portal account)
    FirstName           NVARCHAR(100)   NOT NULL,
    MiddleName          NVARCHAR(100)   NULL,
    LastName            NVARCHAR(100)   NOT NULL,
    DateOfBirth         DATE            NOT NULL,
    Gender              TINYINT         NOT NULL,   -- 1=Male 2=Female 3=Other
    NationalId          NVARCHAR(50)    NULL,
    BloodGroup          VARCHAR(5)      NULL,
    MaritalStatus       TINYINT         NULL,       -- 1=Single 2=Married 3=Divorced 4=Widowed
    Nationality         NVARCHAR(100)   NULL,
    PrimaryPhone        VARCHAR(20)     NOT NULL,
    SecondaryPhone      VARCHAR(20)     NULL,
    Email               NVARCHAR(200)   NULL,
    Address             NVARCHAR(500)   NULL,
    City                NVARCHAR(100)   NULL,
    Region              NVARCHAR(100)   NULL,
    Country             NVARCHAR(100)   NULL DEFAULT 'Ethiopia',
    EmergencyName       NVARCHAR(200)   NULL,
    EmergencyPhone      VARCHAR(20)     NULL,
    EmergencyRelation   NVARCHAR(50)    NULL,
    InsuranceProvider   NVARCHAR(100)   NULL,
    InsurancePolicyNo   NVARCHAR(100)   NULL,
    InsuranceExpiry     DATE            NULL,
    Allergies           NVARCHAR(1000)  NULL,
    ChronicConditions   NVARCHAR(1000)  NULL,
    Notes               NVARCHAR(2000)  NULL,
    IsActive            BIT             NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2       NULL,
    CreatedBy           INT             NULL,
    -- Temporal table columns
    SysStartTime        DATETIME2       GENERATED ALWAYS AS ROW START NOT NULL,
    SysEndTime          DATETIME2       GENERATED ALWAYS AS ROW END   NOT NULL,
    PERIOD FOR SYSTEM_TIME (SysStartTime, SysEndTime),
    CONSTRAINT PK_Patients PRIMARY KEY (Id),
    CONSTRAINT UQ_Patients_TenantMRN UNIQUE (TenantId, MRN),
    CONSTRAINT FK_Patients_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Patients_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
)
WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.PatientsHistory));
GO

CREATE INDEX IX_Patients_TenantId ON Patients (TenantId);
CREATE INDEX IX_Patients_MRN ON Patients (TenantId, MRN);
CREATE INDEX IX_Patients_Name ON Patients (TenantId, LastName, FirstName);
CREATE INDEX IX_Patients_DOB ON Patients (DateOfBirth);
GO

-- Full-Text Search on patient name fields
CREATE FULLTEXT INDEX ON Patients (FirstName, LastName, NationalId)
    KEY INDEX PK_Patients ON ClinicFTCatalog;
GO
