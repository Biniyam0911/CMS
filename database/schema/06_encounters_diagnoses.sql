-- ============================================================
-- 06 - Encounters & Diagnoses (Temporal)
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE Encounters (
    Id                  INT             NOT NULL IDENTITY(1,1),
    TenantId            TINYINT         NOT NULL DEFAULT 1,
    AppointmentId       INT             NULL,
    PatientId           INT             NOT NULL,
    DoctorId            INT             NOT NULL,
    EncounterDate       DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    EncounterTime       TIME            NOT NULL DEFAULT CAST(GETDATE() AS TIME),
    ChiefComplaint      NVARCHAR(500)   NULL,
    HistoryOfIllness    NVARCHAR(2000)  NULL,
    PhysicalExam        NVARCHAR(2000)  NULL,
    Assessment          NVARCHAR(2000)  NULL,
    Plan                NVARCHAR(2000)  NULL,
    VitalSigns          NVARCHAR(1000)  NULL,   -- JSON: BP, HR, RR, Temp, SpO2, Weight, Height
    IsFinalized         BIT             NOT NULL DEFAULT 0,
    FinalizedAt         DATETIME2       NULL,
    CreatedAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2       NULL,
    CreatedBy           INT             NOT NULL,
    SysStartTime        DATETIME2       GENERATED ALWAYS AS ROW START NOT NULL,
    SysEndTime          DATETIME2       GENERATED ALWAYS AS ROW END   NOT NULL,
    PERIOD FOR SYSTEM_TIME (SysStartTime, SysEndTime),
    CONSTRAINT PK_Encounters PRIMARY KEY (Id),
    CONSTRAINT FK_Encounters_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Encounters_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_Encounters_Doctors FOREIGN KEY (DoctorId) REFERENCES Doctors(Id),
    CONSTRAINT FK_Encounters_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(Id)
)
WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.EncountersHistory));
GO

CREATE TABLE DiagnosisCodes (
    Code        VARCHAR(10)     NOT NULL,
    Description NVARCHAR(300)   NOT NULL,
    Category    NVARCHAR(100)   NULL,
    CONSTRAINT PK_DiagnosisCodes PRIMARY KEY (Code)
);
GO

CREATE TABLE Diagnoses (
    Id              INT             NOT NULL IDENTITY(1,1),
    EncounterId     INT             NOT NULL,
    DiagnosisCode   VARCHAR(10)     NOT NULL,
    DiagnosisText   NVARCHAR(300)   NOT NULL,
    DiagnosisType   TINYINT         NOT NULL DEFAULT 1, -- 1=Primary 2=Secondary 3=Differential
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Diagnoses PRIMARY KEY (Id),
    CONSTRAINT FK_Diagnoses_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id),
    CONSTRAINT FK_Diagnoses_Codes FOREIGN KEY (DiagnosisCode) REFERENCES DiagnosisCodes(Code)
);
GO

CREATE TABLE EncounterAttachments (
    Id              INT             NOT NULL IDENTITY(1,1),
    EncounterId     INT             NOT NULL,
    FileName        NVARCHAR(300)   NOT NULL,
    FilePath        NVARCHAR(500)   NOT NULL,
    FileType        VARCHAR(50)     NULL,
    FileSizeBytes   BIGINT          NULL,
    UploadedBy      INT             NOT NULL,
    UploadedAt      DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_EncounterAttachments PRIMARY KEY (Id),
    CONSTRAINT FK_EncounterAttachments_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id)
);
GO

CREATE INDEX IX_Encounters_PatientId ON Encounters (PatientId, EncounterDate DESC);
CREATE INDEX IX_Encounters_DoctorId  ON Encounters (DoctorId, EncounterDate DESC);
CREATE INDEX IX_Diagnoses_EncounterId ON Diagnoses (EncounterId);
GO

CREATE FULLTEXT INDEX ON DiagnosisCodes (Description, Category)
    KEY INDEX PK_DiagnosisCodes ON ClinicFTCatalog;
GO
