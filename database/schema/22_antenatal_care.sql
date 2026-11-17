-- =========================================================================================
-- 22 - ANTENATAL CARE (ANC) MODULE & PREGNANCY LIFECYCLE SCHEMA
-- =========================================================================================
-- Unified Antenatal Care clinical architecture supporting:
-- 1. Pregnancy episodes (ONE Patient -> MULTIPLE Episodes -> MULTIPLE Encounters)
-- 2. Initial Assessment & History (Obstetric, Medical/Surgical, General Exam, Baseline Vitals)
-- 3. Side-by-side longitudinal encounter tracking (GA, BP, Weight, FHR, Fundal height, etc.)
-- 4. Clinical Intelligence (LMP & US dating, Automatic GA & EDD, 42w/43w review alerts)
-- 5. Repeatable Ultrasound records, Laboratory tracking, Confidential HIV/PMTCT records
-- 6. Integrated multi-coding diagnoses (ICD-10, DHIS2, HMIS) & Appointment worklist
-- 7. Pregnancy outcome & delivery formal episode closure
-- 8. Comprehensive temporal audit logging
-- =========================================================================================

USE ClinicDB;
GO

-- 1. AncPregnancyEpisodes
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncPregnancyEpisodes')
BEGIN
    CREATE TABLE dbo.AncPregnancyEpisodes (
        Id                          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TenantId                    TINYINT NOT NULL DEFAULT 1,
        PatientId                   INT NOT NULL,
        EpisodeNumber               VARCHAR(30) NOT NULL,
        RegistrationDate            DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        Gravidity                   INT NOT NULL DEFAULT 1,
        Parity                      INT NOT NULL DEFAULT 0,
        LmpDate                     DATE NULL,
        IsCycleRegular              BIT NOT NULL DEFAULT 1,
        EddLmp                      DATE NULL,
        InitialUltrasoundDate       DATE NULL,
        EddUltrasound               DATE NULL,
        ApprovedDatingMethod        VARCHAR(20) NOT NULL DEFAULT 'LMP', -- 'LMP' or 'Ultrasound'
        EstablishedEdd              DATE NOT NULL,
        InitialGestationalWeeks     INT NOT NULL DEFAULT 0,
        InitialGestationalDays      INT NOT NULL DEFAULT 0,
        Status                      VARCHAR(20) NOT NULL DEFAULT 'Active', -- 'Active', 'Closed'
        ClosureReason               NVARCHAR(200) NULL,
        ClosedAt                    DATETIME2 NULL,
        ClosedByUserId              INT NULL,
        ClosureRemarks              NVARCHAR(1000) NULL,
        RequiresOverdueReview       BIT NOT NULL DEFAULT 0,
        OverdueReviewApprovedBy     INT NULL,
        OverdueReviewApprovedAt     DATETIME2 NULL,
        OverdueReviewNotes          NVARCHAR(500) NULL,
        CreatedAt                   DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt                   DATETIME2 NULL,
        CreatedByUserId             INT NOT NULL DEFAULT 1,

        CONSTRAINT FK_AncPregnancyEpisodes_Tenants FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
        CONSTRAINT FK_AncPregnancyEpisodes_Patients FOREIGN KEY (PatientId) REFERENCES dbo.Patients(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_AncPregnancyEpisodes_Number UNIQUE (EpisodeNumber)
    );

    CREATE UNIQUE INDEX UQ_AncPregnancyEpisodes_ActivePatient 
    ON dbo.AncPregnancyEpisodes (TenantId, PatientId) 
    WHERE Status = 'Active';

    CREATE INDEX IX_AncPregnancyEpisodes_Patient ON dbo.AncPregnancyEpisodes (PatientId, Status);
    CREATE INDEX IX_AncPregnancyEpisodes_Edd ON dbo.AncPregnancyEpisodes (EstablishedEdd, Status);
END
GO

-- 2. AncInitialAssessments
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncInitialAssessments')
BEGIN
    CREATE TABLE dbo.AncInitialAssessments (
        Id                              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EpisodeId                       INT NOT NULL,
        AssessmentDate                  DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        Abortions                       INT NOT NULL DEFAULT 0,
        MolarPregnancies                INT NOT NULL DEFAULT 0,
        EctopicPregnancies              INT NOT NULL DEFAULT 0,
        LivingChildren                  INT NOT NULL DEFAULT 0,
        MedicalHistoryJson              NVARCHAR(MAX) NULL,
        GeneralExamJson                 NVARCHAR(MAX) NULL,
        BaselineVitalsJson              NVARCHAR(MAX) NULL,
        BasicAncModelCriteriaJson       NVARCHAR(MAX) NULL,
        GeneralMedicalAssessmentJson    NVARCHAR(MAX) NULL,
        CreatedAt                       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CreatedByUserId                 INT NOT NULL DEFAULT 1,

        CONSTRAINT FK_AncInitialAssessments_Episode FOREIGN KEY (EpisodeId) REFERENCES dbo.AncPregnancyEpisodes(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_AncInitialAssessments_Episode UNIQUE (EpisodeId)
    );
END
GO

-- 3. AncPreviousPregnancies
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncPreviousPregnancies')
BEGIN
    CREATE TABLE dbo.AncPreviousPregnancies (
        Id                      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        PatientId               INT NOT NULL,
        EpisodeId               INT NULL,
        PregnancyNumber         INT NOT NULL,
        BirthYear               INT NULL,
        DateOfBirth             DATE NULL,
        ModeOfDelivery          NVARCHAR(100) NULL,
        GestationalAgeWeeks     INT NULL,
        DeliveryPlace           NVARCHAR(150) NULL,
        BirthWeightGrams        DECIMAL(6,2) NULL,
        DeliveryOutcome         NVARCHAR(50) NULL,
        Complications           NVARCHAR(500) NULL,
        Remarks                 NVARCHAR(500) NULL,
        CreatedAt               DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_AncPreviousPregnancies_Patient FOREIGN KEY (PatientId) REFERENCES dbo.Patients(Id) ON DELETE CASCADE,
        CONSTRAINT FK_AncPreviousPregnancies_Episode FOREIGN KEY (EpisodeId) REFERENCES dbo.AncPregnancyEpisodes(Id)
    );

    CREATE INDEX IX_AncPreviousPregnancies_Patient ON dbo.AncPreviousPregnancies (PatientId, PregnancyNumber);
END
GO

-- 4. AncEncounters
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncEncounters')
BEGIN
    CREATE TABLE dbo.AncEncounters (
        Id                      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EpisodeId               INT NOT NULL,
        EncounterNumber         INT NOT NULL,
        VisitCode               VARCHAR(30) NOT NULL,
        EncounterDate           DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        EncounterTime           TIME NOT NULL DEFAULT CAST(GETDATE() AS TIME),
        GestationalAgeWeeks     INT NOT NULL,
        GestationalAgeDays      INT NOT NULL,
        Trimester               TINYINT NOT NULL DEFAULT 1,
        Weight                  DECIMAL(5,2) NULL,
        SystolicBp              INT NULL,
        DiastolicBp             INT NULL,
        BpSite                  NVARCHAR(50) NULL,
        PulseRate               INT NULL,
        RespiratoryRate         INT NULL,
        Temperature             DECIMAL(4,1) NULL,
        FundalHeight            DECIMAL(4,1) NULL,
        FetalHeartRate          INT NULL,
        FetalMovement           NVARCHAR(50) NULL,
        FetalPresentation       NVARCHAR(50) NULL,
        Anemia                  NVARCHAR(50) NULL,
        Edema                   NVARCHAR(50) NULL,
        IronSupplementation     NVARCHAR(50) NULL,
        TetanusVaccination      NVARCHAR(100) NULL,
        DangerSignsJson         NVARCHAR(MAX) NULL,
        ClinicalNotes           NVARCHAR(MAX) NULL,
        Assessment              NVARCHAR(MAX) NULL,
        [Plan]                  NVARCHAR(MAX) NULL,
        LabResultRemarks        NVARCHAR(MAX) NULL,
        NextVisitDate           DATE NULL,
        AppointmentRemarks      NVARCHAR(500) NULL,
        AttendingDoctorId       INT NOT NULL,
        IsDraft                 BIT NOT NULL DEFAULT 0,
        FinalizedAt             DATETIME2 NULL,
        FinalizedByUserId       INT NULL,
        IsCorrection            BIT NOT NULL DEFAULT 0,
        CorrectionReason        NVARCHAR(500) NULL,
        OriginalEncounterId     INT NULL,
        CreatedAt               DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt               DATETIME2 NULL,
        CreatedByUserId         INT NOT NULL DEFAULT 1,

        CONSTRAINT FK_AncEncounters_Episode FOREIGN KEY (EpisodeId) REFERENCES dbo.AncPregnancyEpisodes(Id) ON DELETE CASCADE,
        CONSTRAINT FK_AncEncounters_Doctor FOREIGN KEY (AttendingDoctorId) REFERENCES dbo.Doctors(Id),
        CONSTRAINT UQ_AncEncounters_EpisodeVisit UNIQUE (EpisodeId, EncounterNumber)
    );

    CREATE INDEX IX_AncEncounters_EpisodeDate ON dbo.AncEncounters (EpisodeId, EncounterDate DESC);
END
GO

-- 5. AncUltrasoundRecords
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncUltrasoundRecords')
BEGIN
    CREATE TABLE dbo.AncUltrasoundRecords (
        Id                          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EpisodeId                   INT NOT NULL,
        EncounterId                 INT NULL,
        UltrasoundDate              DATE NOT NULL,
        GestationalAgeWeeks         INT NOT NULL,
        GestationalAgeDays          INT NOT NULL,
        EstimatedConceptionDate     DATE NULL,
        EddByUltrasound             DATE NULL,
        Trimester                   TINYINT NOT NULL DEFAULT 1,
        Presentation                NVARCHAR(50) NULL,
        PlacentalLocation           NVARCHAR(100) NULL,
        AmnioticFluid               NVARCHAR(50) NULL,
        FetalHeartRate              INT NULL,
        EstimatedFetalWeight        DECIMAL(6,2) NULL,
        Findings                    NVARCHAR(MAX) NULL,
        TakenBy                     NVARCHAR(100) NULL,
        CreatedAt                   DATETIME2 NOT NULL DEFAULT GETDATE(),
        CreatedByUserId             INT NOT NULL DEFAULT 1,

        CONSTRAINT FK_AncUltrasoundRecords_Episode FOREIGN KEY (EpisodeId) REFERENCES dbo.AncPregnancyEpisodes(Id) ON DELETE CASCADE,
        CONSTRAINT FK_AncUltrasoundRecords_Encounter FOREIGN KEY (EncounterId) REFERENCES dbo.AncEncounters(Id)
    );

    CREATE INDEX IX_AncUltrasoundRecords_Episode ON dbo.AncUltrasoundRecords (EpisodeId, UltrasoundDate DESC);
END
GO

-- 6. AncPmtctRecords
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncPmtctRecords')
BEGIN
    CREATE TABLE dbo.AncPmtctRecords (
        Id                          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EpisodeId                   INT NOT NULL,
        MotherConfidentialCode      NVARCHAR(50) NULL,
        PartnerConfidentialCode     NVARCHAR(50) NULL,
        MotherLetterCode            NVARCHAR(20) NULL,
        PartnerLetterCode           NVARCHAR(20) NULL,
        HivTested                   NVARCHAR(20) NULL,
        HivTestResult               NVARCHAR(30) NULL,
        PartnerHivResult            NVARCHAR(30) NULL,
        Cd4Count                    INT NULL,
        WhoClinicalStaging          NVARCHAR(20) NULL,
        NutritionalAssessment       NVARCHAR(100) NULL,
        InfantFeedingCounseling     NVARCHAR(100) NULL,
        LinkedToArt                 BIT NOT NULL DEFAULT 0,
        MotherPmtctDate             DATE NULL,
        PartnerPmtctDate            DATE NULL,
        MotherPmtctResult           NVARCHAR(50) NULL,
        PartnerPmtctResult          NVARCHAR(50) NULL,
        ConfidentialRemarks         NVARCHAR(MAX) NULL,
        UpdatedByUserId             INT NOT NULL DEFAULT 1,
        UpdatedAt                   DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_AncPmtctRecords_Episode FOREIGN KEY (EpisodeId) REFERENCES dbo.AncPregnancyEpisodes(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_AncPmtctRecords_Episode UNIQUE (EpisodeId)
    );
END
GO

-- 7. AncLaboratoryExaminations
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncLaboratoryExaminations')
BEGIN
    CREATE TABLE dbo.AncLaboratoryExaminations (
        Id                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EpisodeId           INT NOT NULL,
        EncounterId         INT NULL,
        TestType            NVARCHAR(50) NOT NULL,
        TestDate            DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        ResultValue         NVARCHAR(100) NULL,
        Unit                NVARCHAR(30) NULL,
        ReferenceRange      NVARCHAR(50) NULL,
        Status              NVARCHAR(30) NOT NULL DEFAULT 'Completed',
        IsAbnormal          BIT NOT NULL DEFAULT 0,
        Remarks             NVARCHAR(500) NULL,
        ConductedBy         NVARCHAR(100) NULL,
        CreatedAt           DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_AncLaboratoryExaminations_Episode FOREIGN KEY (EpisodeId) REFERENCES dbo.AncPregnancyEpisodes(Id) ON DELETE CASCADE,
        CONSTRAINT FK_AncLaboratoryExaminations_Encounter FOREIGN KEY (EncounterId) REFERENCES dbo.AncEncounters(Id)
    );

    CREATE INDEX IX_AncLaboratoryExaminations_Episode ON dbo.AncLaboratoryExaminations (EpisodeId, TestType);
END
GO

-- 8. AncDiagnoses
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncDiagnoses')
BEGIN
    CREATE TABLE dbo.AncDiagnoses (
        Id                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EpisodeId           INT NOT NULL,
        EncounterId         INT NOT NULL,
        IcdCode             VARCHAR(20) NULL,
        Dhis2Code           VARCHAR(30) NULL,
        HmisCode            VARCHAR(30) NULL,
        Description         NVARCHAR(300) NOT NULL,
        DiagnosisType       VARCHAR(30) NOT NULL DEFAULT 'Primary',
        DiagnosisDate       DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        RegisteredByUserId  INT NOT NULL DEFAULT 1,
        CreatedAt           DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_AncDiagnoses_Episode FOREIGN KEY (EpisodeId) REFERENCES dbo.AncPregnancyEpisodes(Id) ON DELETE CASCADE,
        CONSTRAINT FK_AncDiagnoses_Encounter FOREIGN KEY (EncounterId) REFERENCES dbo.AncEncounters(Id)
    );

    CREATE INDEX IX_AncDiagnoses_Episode ON dbo.AncDiagnoses (EpisodeId);
END
GO

-- 9. AncAppointments
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncAppointments')
BEGIN
    CREATE TABLE dbo.AncAppointments (
        Id                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EpisodeId           INT NOT NULL,
        EncounterId         INT NULL,
        PatientId           INT NOT NULL,
        DoctorId            INT NOT NULL,
        AppointmentDate     DATE NOT NULL,
        Status              NVARCHAR(30) NOT NULL DEFAULT 'Scheduled',
        Remarks             NVARCHAR(500) NULL,
        CreatedAt           DATETIME2 NOT NULL DEFAULT GETDATE(),
        AttendedAt          DATETIME2 NULL,

        CONSTRAINT FK_AncAppointments_Episode FOREIGN KEY (EpisodeId) REFERENCES dbo.AncPregnancyEpisodes(Id) ON DELETE CASCADE,
        CONSTRAINT FK_AncAppointments_Patient FOREIGN KEY (PatientId) REFERENCES dbo.Patients(Id),
        CONSTRAINT FK_AncAppointments_Doctor FOREIGN KEY (DoctorId) REFERENCES dbo.Doctors(Id)
    );

    CREATE INDEX IX_AncAppointments_Date ON dbo.AncAppointments (AppointmentDate, Status);
END
GO

-- 10. AncPregnancyOutcomes
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncPregnancyOutcomes')
BEGIN
    CREATE TABLE dbo.AncPregnancyOutcomes (
        Id                      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EpisodeId               INT NOT NULL,
        DeliveryDate            DATE NOT NULL,
        DeliveryTime            TIME NOT NULL,
        DeliveryPlace           NVARCHAR(150) NOT NULL,
        ModeOfDelivery          NVARCHAR(100) NOT NULL,
        PregnancyOutcome        NVARCHAR(50) NOT NULL,
        NumberOfBabies          INT NOT NULL DEFAULT 1,
        MaternalOutcome         NVARCHAR(100) NOT NULL DEFAULT 'Discharged alive in good condition',
        MaternalComplications   NVARCHAR(500) NULL,
        Baby1Outcome            NVARCHAR(50) NOT NULL DEFAULT 'Alive & Healthy',
        Baby1Sex                NVARCHAR(20) NOT NULL DEFAULT 'Female',
        Baby1WeightGrams        DECIMAL(6,2) NOT NULL DEFAULT 3200,
        Baby1Apgar1             INT NULL,
        Baby1Apgar5             INT NULL,
        Baby2Outcome            NVARCHAR(50) NULL,
        Baby2Sex                NVARCHAR(20) NULL,
        Baby2WeightGrams        DECIMAL(6,2) NULL,
        Baby2Apgar1             INT NULL,
        Baby2Apgar5             INT NULL,
        DeliveryRemarks         NVARCHAR(MAX) NULL,
        ReferralInfo            NVARCHAR(500) NULL,
        ClosingClinicianId      INT NOT NULL,
        CreatedAt               DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_AncPregnancyOutcomes_Episode FOREIGN KEY (EpisodeId) REFERENCES dbo.AncPregnancyEpisodes(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_AncPregnancyOutcomes_Episode UNIQUE (EpisodeId),
        CONSTRAINT FK_AncPregnancyOutcomes_User FOREIGN KEY (ClosingClinicianId) REFERENCES dbo.Users(Id)
    );
END
GO

-- 11. AncAuditLogs
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AncAuditLogs')
BEGIN
    CREATE TABLE dbo.AncAuditLogs (
        Id                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EpisodeId           INT NOT NULL,
        EncounterId         INT NULL,
        Action              NVARCHAR(50) NOT NULL,
        ChangedByUserId     INT NOT NULL,
        ChangedAt           DATETIME2 NOT NULL DEFAULT GETDATE(),
        DetailsJson         NVARCHAR(MAX) NULL,
        IpAddress           VARCHAR(50) NULL
    );

    CREATE INDEX IX_AncAuditLogs_Episode ON dbo.AncAuditLogs (EpisodeId, ChangedAt DESC);
END
GO
