-- ============================================================
-- 18 - Extended EMR: SOAP, Medical Certificates, Procedures & Patient History
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE MedicalCertificates (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    CertificateNo   VARCHAR(30)     NOT NULL, -- e.g. 'MC-2026-00042'
    PatientId       INT             NOT NULL,
    DoctorId        INT             NOT NULL,
    EncounterId     INT             NULL,
    CertificateType VARCHAR(50)     NOT NULL DEFAULT 'SickLeave', -- 'SickLeave', 'Fitness', 'MedicalReport', 'Referral'
    DiagnosisSummary NVARCHAR(500)  NOT NULL,
    Recommendation  NVARCHAR(1000)  NOT NULL,
    StartDate       DATE            NOT NULL,
    EndDate         DATE            NOT NULL,
    DaysExcused     INT             NOT NULL DEFAULT 1,
    QrVerificationCode VARCHAR(64)  NOT NULL,
    IsIssued        BIT             NOT NULL DEFAULT 1,
    IssuedAt        DATETIME2       NOT NULL DEFAULT GETDATE(),
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_MedicalCertificates PRIMARY KEY (Id),
    CONSTRAINT UQ_MedicalCertificates_No UNIQUE (CertificateNo),
    CONSTRAINT FK_MedCert_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_MedCert_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_MedCert_Doctors FOREIGN KEY (DoctorId) REFERENCES Doctors(Id)
);
GO

CREATE TABLE ProcedureOrders (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    EncounterId     INT             NOT NULL,
    PatientId       INT             NOT NULL,
    OrderedBy       INT             NOT NULL,
    ProcedureCode   VARCHAR(50)     NOT NULL, -- CPT code e.g. '99213', '10060'
    ProcedureName   NVARCHAR(200)   NOT NULL,
    ClinicalNotes   NVARCHAR(500)   NULL,
    StatusId        TINYINT         NOT NULL DEFAULT 1, -- 1=Ordered, 2=Scheduled, 3=InProgress, 4=Completed, 5=Cancelled
    PerformedBy     INT             NULL,
    PerformedAt     DATETIME2       NULL,
    ProcedureResult NVARCHAR(MAX)   NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ProcedureOrders PRIMARY KEY (Id),
    CONSTRAINT FK_ProcOrders_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_ProcOrders_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id),
    CONSTRAINT FK_ProcOrders_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id)
);
GO

CREATE TABLE PatientMedicalHistories (
    Id              INT             NOT NULL IDENTITY(1,1),
    PatientId       INT             NOT NULL,
    HistoryType     VARCHAR(50)     NOT NULL, -- 'PastMedical', 'Surgical', 'Family', 'Social', 'Allergy', 'Immunization'
    Description     NVARCHAR(500)   NOT NULL,
    OnsetDate       NVARCHAR(50)    NULL,
    Status          VARCHAR(50)     NOT NULL DEFAULT 'Active', -- 'Active', 'Resolved', 'Inactive'
    Notes           NVARCHAR(500)   NULL,
    RecordedBy      INT             NULL,
    RecordedAt      DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_PatientMedicalHistories PRIMARY KEY (Id),
    CONSTRAINT FK_PatientHistories_Patient FOREIGN KEY (PatientId) REFERENCES Patients(Id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_MedCert_Patient ON MedicalCertificates (PatientId, IssuedAt DESC);
CREATE INDEX IX_ProcOrders_Patient ON ProcedureOrders (PatientId, CreatedAt DESC);
CREATE INDEX IX_PatientHistory_Type ON PatientMedicalHistories (PatientId, HistoryType);
GO
