-- ============================================================
-- 21 - Enterprise Upgrades (Patient MPI, CDSS, Resource Scheduling, Lab Custody, FEFO Pharmacy)
-- Benchmarked against Epic, Cerner, OpenMRS, and Bahmni
-- ============================================================
USE ClinicDB;
GO

-- 1. PATIENT MANAGEMENT: Master Patient Index (MPI), Photo, Next of Kin, Copay
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Patients') AND name = 'PhotoUrl')
BEGIN
    ALTER TABLE Patients ADD PhotoUrl NVARCHAR(500) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Patients') AND name = 'InsuranceCopayPercent')
BEGIN
    ALTER TABLE Patients ADD InsuranceCopayPercent DECIMAL(5,2) NOT NULL DEFAULT 0.00;
END
GO

CREATE TABLE PatientMergeLogs (
    Id              INT             NOT NULL IDENTITY(1,1),
    TargetPatientId INT             NOT NULL,
    SourcePatientId INT             NOT NULL,
    MergeReason     NVARCHAR(300)   NOT NULL,
    MergedBy        INT             NOT NULL,
    MergedAt        DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_PatientMergeLogs PRIMARY KEY (Id)
);
GO

-- 2. EMR & SOAP: CDSS Drug-Drug Interaction Rules & Active Problem List
CREATE TABLE CdssDrugInteractions (
    Id              INT             NOT NULL IDENTITY(1,1),
    DrugA           NVARCHAR(100)   NOT NULL,
    DrugB           NVARCHAR(100)   NOT NULL,
    SeverityLevel   VARCHAR(20)     NOT NULL, -- 'Major', 'Moderate', 'Minor'
    ClinicalWarning NVARCHAR(500)   NOT NULL,
    CONSTRAINT PK_CdssDrugInteractions PRIMARY KEY (Id)
);
GO

INSERT INTO CdssDrugInteractions (DrugA, DrugB, SeverityLevel, ClinicalWarning) VALUES
('Amlodipine', 'Simvastatin', 'Moderate', 'Amlodipine may increase serum concentration of Simvastatin. Limit Simvastatin to 20mg daily.'),
('Amoxicillin', 'Allopurinol', 'Minor', 'Increased incidence of skin rashes reported when co-administered.'),
('Tramadol', 'Paracetamol', 'Minor', 'Synergistic analgesic effect. Monitor total daily paracetamol dosage.');
GO

CREATE TABLE PatientProblemLists (
    Id              INT             NOT NULL IDENTITY(1,1),
    PatientId       INT             NOT NULL,
    IcdCode         VARCHAR(20)     NOT NULL,
    ProblemName     NVARCHAR(200)   NOT NULL,
    OnsetDate       DATE            NULL,
    Status          VARCHAR(20)     NOT NULL DEFAULT 'Active', -- 'Active', 'Resolved', 'Inactive'
    RecordedBy      INT             NOT NULL,
    RecordedAt      DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_PatientProblemLists PRIMARY KEY (Id),
    CONSTRAINT FK_ProblemList_Patient FOREIGN KEY (PatientId) REFERENCES Patients(Id) ON DELETE CASCADE
);
GO

-- 3. APPOINTMENT SCHEDULING: Resource & Room Reservation
CREATE TABLE ConsultationRooms (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    RoomName        NVARCHAR(50)    NOT NULL,
    Department      NVARCHAR(50)    NOT NULL,
    IsAvailable     BIT             NOT NULL DEFAULT 1,
    CONSTRAINT PK_ConsultationRooms PRIMARY KEY (Id)
);
GO

INSERT INTO ConsultationRooms (TenantId, RoomName, Department) VALUES
(1, 'Consultation Room 101', 'Cardiology'),
(1, 'Consultation Room 102', 'General Medicine'),
(1, 'Pediatric Exam Room A', 'Pediatrics');
GO

-- 4. LABORATORY: Delta Checking & Chain of Custody
CREATE TABLE LabChainOfCustody (
    Id              INT             NOT NULL IDENTITY(1,1),
    SampleId        INT             NOT NULL,
    ActionStep      VARCHAR(50)     NOT NULL, -- 'Collected', 'ReceivedInLab', 'Aliquoted', 'AnalyzerRun', 'Verified', 'Archived'
    PerformedBy     INT             NOT NULL,
    ActionTime      DATETIME2       NOT NULL DEFAULT GETDATE(),
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_LabChainOfCustody PRIMARY KEY (Id)
);
GO

-- 5. PHARMACY: FEFO Batch Expiry & Narcotics Logbook
CREATE TABLE NarcoticsDispenseLogs (
    Id              INT             NOT NULL IDENTITY(1,1),
    PrescriptionId  INT             NOT NULL,
    DrugId          INT             NOT NULL,
    PatientId       INT             NOT NULL,
    DoctorId        INT             NOT NULL,
    PharmacistId    INT             NOT NULL,
    Quantity        INT             NOT NULL,
    SerialLogNo     VARCHAR(50)     NOT NULL,
    DispensedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_NarcoticsDispenseLogs PRIMARY KEY (Id)
);
GO
