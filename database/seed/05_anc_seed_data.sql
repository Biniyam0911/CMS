-- =========================================================================================
-- ANC SEED DATA: REALISTIC CLINICAL TEST SCENARIOS
-- =========================================================================================
-- Patient 270606 (HANA W/MARIYAM): Multi-gravida with 1 historical closed delivery and 1 active pregnancy (32w 4d)
-- Patient 270605 (MERON GEBREYES): Active pregnancy approaching overdue (42w 3d) with BP alert
-- Patient 270604 (SOFIA KASSA): Active pregnancy at 43w 1d requiring authorized review
-- =========================================================================================

USE ClinicDB;
GO

PRINT '======================================================================';
PRINT 'Seeding Realistic Clinical Test Data for Antenatal Care Module...';
PRINT '======================================================================';

-- Clear existing ANC seed records for idempotent run
DELETE FROM dbo.AncAuditLogs;
DELETE FROM dbo.AncPregnancyOutcomes;
DELETE FROM dbo.AncAppointments;
DELETE FROM dbo.AncDiagnoses;
DELETE FROM dbo.AncLaboratoryExaminations;
DELETE FROM dbo.AncPmtctRecords;
DELETE FROM dbo.AncUltrasoundRecords;
DELETE FROM dbo.AncEncounters;
DELETE FROM dbo.AncPreviousPregnancies;
DELETE FROM dbo.AncInitialAssessments;
DELETE FROM dbo.AncPregnancyEpisodes;
GO

DECLARE @docId INT = (SELECT TOP 1 Id FROM dbo.Doctors);
IF @docId IS NULL SET @docId = 1;

DECLARE @userId INT = (SELECT TOP 1 Id FROM dbo.Users);
IF @userId IS NULL SET @userId = 1;

-- ============================================================================
-- SCENARIO 1: Patient 270606 (HANA W/MARIYAM)
-- Previous Closed Pregnancy (2024) + Active Second Pregnancy (32w 4d)
-- ============================================================================
PRINT '--> Seeding Scenario 1: Multi-pregnancy Patient 270606 (Hana W/Mariyam)';

-- 1.1 Historical Closed Episode: ANC-2024-0001
INSERT INTO dbo.AncPregnancyEpisodes (
    TenantId, PatientId, EpisodeNumber, RegistrationDate, Gravidity, Parity,
    LmpDate, IsCycleRegular, EddLmp, ApprovedDatingMethod, EstablishedEdd,
    InitialGestationalWeeks, InitialGestationalDays, Status, ClosureReason,
    ClosedAt, ClosedByUserId, ClosureRemarks, CreatedAt, CreatedByUserId
)
VALUES (
    1, 270606, 'ANC-2024-0001', '2024-02-15', 1, 0,
    '2024-01-01', 1, '2024-10-07', 'LMP', '2024-10-07',
    6, 3, 'Closed', 'Delivery',
    '2024-10-10 14:30:00', @userId, 'Spontaneous vaginal delivery of healthy female infant', '2024-02-15', @userId
);

DECLARE @ep2024 INT = SCOPE_IDENTITY();

-- Outcome for 2024 episode
INSERT INTO dbo.AncPregnancyOutcomes (
    EpisodeId, DeliveryDate, DeliveryTime, DeliveryPlace, ModeOfDelivery,
    PregnancyOutcome, NumberOfBabies, MaternalOutcome, MaternalComplications,
    Baby1Outcome, Baby1Sex, Baby1WeightGrams, Baby1Apgar1, Baby1Apgar5,
    DeliveryRemarks, ClosingClinicianId, CreatedAt
)
VALUES (
    @ep2024, '2024-10-10', '14:15:00', 'Hospital Labor Ward', 'Spontaneous Vaginal Delivery (SVD)',
    'Live Birth', 1, 'Discharged alive in good condition', 'None',
    'Alive & Healthy', 'Female', 3250.00, 8, 9,
    'Uneventful labor, mother and baby in excellent condition.', @userId, '2024-10-10'
);

-- Previous pregnancy record in patient's obstetric history
INSERT INTO dbo.AncPreviousPregnancies (
    PatientId, EpisodeId, PregnancyNumber, BirthYear, DateOfBirth, ModeOfDelivery,
    GestationalAgeWeeks, DeliveryPlace, BirthWeightGrams, DeliveryOutcome, Complications, Remarks, CreatedAt
)
VALUES (
    270606, @ep2024, 1, 2024, '2024-10-10', 'Spontaneous Vaginal Delivery (SVD)',
    40, 'Hospital Labor Ward', 3250.00, 'Live Birth', 'None', 'First pregnancy uneventful', '2024-10-10'
);

-- 1.2 Current Active Episode: ANC-2026-0001
-- Today is 2026-11-12. Target GA: 32w 4d (228 days ago from today -> LMP: 2026-03-29)
DECLARE @lmpDateActive DATE = '2026-03-29';
DECLARE @eddActive DATE = DATEADD(DAY, 280, @lmpDateActive); -- 2027-01-03

INSERT INTO dbo.AncPregnancyEpisodes (
    TenantId, PatientId, EpisodeNumber, RegistrationDate, Gravidity, Parity,
    LmpDate, IsCycleRegular, EddLmp, ApprovedDatingMethod, EstablishedEdd,
    InitialGestationalWeeks, InitialGestationalDays, Status, CreatedAt, CreatedByUserId
)
VALUES (
    1, 270606, 'ANC-2026-0001', '2026-05-10', 2, 1,
    @lmpDateActive, 1, @eddActive, 'LMP', @eddActive,
    6, 0, 'Active', '2026-05-10', @userId
);

DECLARE @ep2026 INT = SCOPE_IDENTITY();

-- Initial Assessment for Active Episode
INSERT INTO dbo.AncInitialAssessments (
    EpisodeId, AssessmentDate, Abortions, MolarPregnancies, EctopicPregnancies, LivingChildren,
    MedicalHistoryJson, GeneralExamJson, BaselineVitalsJson, BasicAncModelCriteriaJson, GeneralMedicalAssessmentJson,
    CreatedAt, CreatedByUserId
)
VALUES (
    @ep2026, '2026-05-10', 0, 0, 0, 1,
    '{"Diabetes":{"Status":"No"},"Hypertension":{"Status":"No"},"RenalDisease":{"Status":"No"},"Tuberculosis":{"Status":"No"},"DrugAllergy":{"Status":"Yes","Remarks":"Mild Penicillin rash"},"PastSurgicalHistory":{"Status":"No"},"MotherMedicalHistory":{"Status":"No"},"FatherMedicalHistory":{"Status":"No"}}',
    '{"Chest":"Clear vesicular breath sounds","Heart":"S1 and S2 present, no murmurs","Abdomen":"Soft, non-tender, gravid uterus palpated","VaginalExamination":"Normal cervix, closed, no discharge","GeneralFindings":"Good general health, no pallor or edema","HpNotes":"Gravida 2 Para 1 registering at 6 weeks gestation."}',
    '{"SystolicBp":115,"DiastolicBp":72,"BpSite":"Right Arm, Sitting","PulseRate":76,"RespiratoryRate":18,"Temperature":36.7,"SpO2":98.0,"Weight":62.5,"Height":164.0,"Muac":26.5}',
    '{"HistoryOfStillbirth":{"Status":"No"},"HistoryThreeOrMoreAbortions":{"Status":"No"},"PreviousLowBirthWeight":{"Status":"No"},"PreviousHighBirthWeight":{"Status":"No"},"LastPregnancyComplications":{"Status":"No"},"PreviousSurgery":{"Status":"No"},"OtherRiskCriteria":{"Status":"No"}}',
    '{"InsulinDependentDiabetes":{"Status":"No"},"RenalDisease":{"Status":"No"},"CardiacDisease":{"Status":"No"},"KnownSubstanceAbuse":{"Status":"No"},"OtherSevereConditions":{"Status":"No"}}',
    '2026-05-10', @userId
);

-- Ultrasound at 20 weeks
INSERT INTO dbo.AncUltrasoundRecords (
    EpisodeId, UltrasoundDate, GestationalAgeWeeks, GestationalAgeDays,
    EddByUltrasound, Trimester, Presentation, PlacentalLocation, AmnioticFluid,
    FetalHeartRate, EstimatedFetalWeight, Findings, TakenBy, CreatedAt, CreatedByUserId
)
VALUES (
    @ep2026, '2026-08-16', 20, 0,
    @eddActive, 2, 'Cephalic', 'Posterior high', 'Normal',
    148, 380.00, 'Single live intrauterine fetus. Normal anatomy scan. Adequate liquor. Normal cardiac activity.', 'Dr. Radiology', '2026-08-16', @userId
);

-- PMTCT Record (Baseline Negative)
INSERT INTO dbo.AncPmtctRecords (
    EpisodeId, MotherConfidentialCode, PartnerConfidentialCode, MotherLetterCode, PartnerLetterCode,
    HivTested, HivTestResult, PartnerHivResult, Cd4Count, WhoClinicalStaging,
    NutritionalAssessment, InfantFeedingCounseling, LinkedToArt, MotherPmtctDate, MotherPmtctResult,
    ConfidentialRemarks, UpdatedByUserId, UpdatedAt
)
VALUES (
    @ep2026, 'CONF-M-270606', 'CONF-P-99120', 'M-AA', 'P-BB',
    'Yes', 'Negative', 'Negative', 850, 'Stage 1',
    'Normal', 'Exclusive Breastfeeding Counseling Done', 0, '2026-05-10', 'Non-Reactive',
    'Pre- and post-test counseling completed. Partner tested concordant negative.', @userId, '2026-05-10'
);

-- Encounter 1: First Trimester (12w 0d)
INSERT INTO dbo.AncEncounters (
    EpisodeId, EncounterNumber, VisitCode, EncounterDate, EncounterTime,
    GestationalAgeWeeks, GestationalAgeDays, Trimester, Weight, SystolicBp, DiastolicBp,
    BpSite, PulseRate, RespiratoryRate, Temperature, FundalHeight, FetalHeartRate,
    FetalMovement, FetalPresentation, Anemia, Edema, IronSupplementation, TetanusVaccination,
    DangerSignsJson, ClinicalNotes, Assessment, [Plan], AttendingDoctorId, IsDraft,
    FinalizedAt, FinalizedByUserId, CreatedAt, CreatedByUserId
)
VALUES (
    @ep2026, 1, 'ANC-2026-0001-V01', '2026-06-21', '09:30:00',
    12, 0, 1, 63.2, 112, 70,
    'Right Arm, Sitting', 78, 18, 36.6, 12.0, 154,
    'Not Yet Felt', 'Not Determined', 'None', 'None', 'Prescribed', 'TT1 Given',
    '[]', 'First trimester routine follow-up. Mild morning sickness resolving. Tolerating diet well.',
    'Intrauterine pregnancy at 12 weeks, progressing normally.', 'Continue daily folic acid and iron. Routine first trimester labs ordered.',
    @docId, 0, '2026-06-21 10:00:00', @userId, '2026-06-21', @userId
);

-- Encounter 2: Second Trimester (24w 2d)
INSERT INTO dbo.AncEncounters (
    EpisodeId, EncounterNumber, VisitCode, EncounterDate, EncounterTime,
    GestationalAgeWeeks, GestationalAgeDays, Trimester, Weight, SystolicBp, DiastolicBp,
    BpSite, PulseRate, RespiratoryRate, Temperature, FundalHeight, FetalHeartRate,
    FetalMovement, FetalPresentation, Anemia, Edema, IronSupplementation, TetanusVaccination,
    DangerSignsJson, ClinicalNotes, Assessment, [Plan], AttendingDoctorId, IsDraft,
    FinalizedAt, FinalizedByUserId, CreatedAt, CreatedByUserId
)
VALUES (
    @ep2026, 2, 'ANC-2026-0001-V02', '2026-09-15', '10:15:00',
    24, 2, 2, 65.8, 118, 74,
    'Right Arm, Sitting', 80, 18, 36.8, 24.0, 144,
    'Normal', 'Cephalic', 'None', 'None', 'Continuing', 'TT2 Given',
    '[]', 'Second trimester visit. Mother reports active fetal movements. No headaches, no epigastric pain.',
    'Gravida 2 Para 1 at 24 weeks gestation. Normal maternal weight gain and fundal growth.', 'Reinforce warning signs of preeclampsia. Re-check Hemoglobin at 28 weeks.',
    @docId, 0, '2026-09-15 11:00:00', @userId, '2026-09-15', @userId
);

-- Encounter 3: Third Trimester (28w 3d) - Previous Visit for Comparison
INSERT INTO dbo.AncEncounters (
    EpisodeId, EncounterNumber, VisitCode, EncounterDate, EncounterTime,
    GestationalAgeWeeks, GestationalAgeDays, Trimester, Weight, SystolicBp, DiastolicBp,
    BpSite, PulseRate, RespiratoryRate, Temperature, FundalHeight, FetalHeartRate,
    FetalMovement, FetalPresentation, Anemia, Edema, IronSupplementation, TetanusVaccination,
    DangerSignsJson, ClinicalNotes, Assessment, [Plan], AttendingDoctorId, IsDraft,
    FinalizedAt, FinalizedByUserId, NextVisitDate, AppointmentRemarks, CreatedAt, CreatedByUserId
)
VALUES (
    @ep2026, 3, 'ANC-2026-0001-V03', '2026-10-14', '11:00:00',
    28, 3, 3, 67.5, 120, 78,
    'Right Arm, Sitting', 82, 18, 36.7, 28.5, 142,
    'Normal', 'Cephalic', 'Mild', 'Pedal +', 'Continuing', 'TT3 Scheduled',
    '[]', 'Third trimester visit. Mild dependent ankle edema in evenings after standing. Fundal height matches dates.',
    '28 weeks pregnancy. Mild physiologic edema. Well compensated.', 'Advise leg elevation in evening. Scheduled follow-up in 4 weeks.',
    @docId, 0, '2026-10-14 11:45:00', @userId, '2026-11-18', 'Routine 32-34 week ANC check', '2026-10-14', @userId
);

-- Next appointment scheduled for 2026-11-18
INSERT INTO dbo.AncAppointments (
    EpisodeId, EncounterId, PatientId, DoctorId, AppointmentDate, Status, Remarks, CreatedAt
)
VALUES (
    @ep2026, SCOPE_IDENTITY(), 270606, @docId, '2026-11-18', 'Scheduled', 'Routine 32-week ANC follow-up', GETDATE()
);

-- Lab investigations
INSERT INTO dbo.AncLaboratoryExaminations (EpisodeId, TestType, TestDate, ResultValue, Unit, ReferenceRange, Status, IsAbnormal, Remarks)
VALUES 
(@ep2026, 'BloodGroupRh', '2026-05-10', 'O Positive', '', '', 'Completed', 0, 'Rh Positive, no antibody prophylaxis needed'),
(@ep2026, 'Hemoglobin', '2026-05-10', '12.4', 'g/dL', '11.0 - 15.0', 'Completed', 0, 'Baseline normal'),
(@ep2026, 'Urinalysis', '2026-10-14', 'Protein Negative, Glucose Negative', '', '', 'Completed', 0, 'No proteinuria or bacteriuria'),
(@ep2026, 'Hemoglobin', '2026-10-14', '10.8', 'g/dL', '11.0 - 15.0', 'Completed', 1, 'Mild gestational anemia; increased oral ferrous sulfate');

-- Diagnoses
INSERT INTO dbo.AncDiagnoses (EpisodeId, EncounterId, IcdCode, Description, DiagnosisType, DiagnosisDate, RegisteredByUserId)
VALUES 
(@ep2026, (SELECT TOP 1 Id FROM dbo.AncEncounters WHERE EpisodeId = @ep2026 AND EncounterNumber = 1), 'Z34.0', 'Supervision of normal first pregnancy', 'Primary', '2026-06-21', @userId),
(@ep2026, (SELECT TOP 1 Id FROM dbo.AncEncounters WHERE EpisodeId = @ep2026 AND EncounterNumber = 3), 'D64.9', 'Mild nutritional anemia in pregnancy', 'Secondary', '2026-10-14', @userId);

-- ============================================================================
-- SCENARIO 2: Patient 270605 (MERON GEBREYES)
-- Approaching 43 weeks (42w 3d) with Overdue Warning & Hypertension
-- LMP: 2026-01-19 -> Today (2026-11-12) is 297 days -> 42w 3d!
-- ============================================================================
PRINT '--> Seeding Scenario 2: Overdue Warning Patient 270605 (Meron Gebreyes) at 42w 3d';

DECLARE @lmpDateOverdue DATE = '2026-01-19';
DECLARE @eddOverdue DATE = DATEADD(DAY, 280, @lmpDateOverdue); -- 2026-10-26

INSERT INTO dbo.AncPregnancyEpisodes (
    TenantId, PatientId, EpisodeNumber, RegistrationDate, Gravidity, Parity,
    LmpDate, IsCycleRegular, EddLmp, ApprovedDatingMethod, EstablishedEdd,
    InitialGestationalWeeks, InitialGestationalDays, Status, RequiresOverdueReview, CreatedAt, CreatedByUserId
)
VALUES (
    1, 270605, 'ANC-2026-0002', '2026-03-01', 3, 2,
    @lmpDateOverdue, 1, @eddOverdue, 'LMP', @eddOverdue,
    6, 0, 'Active', 0, '2026-03-01', @userId
);

DECLARE @epOverdue INT = SCOPE_IDENTITY();

-- Encounter at 42w with elevated BP
INSERT INTO dbo.AncEncounters (
    EpisodeId, EncounterNumber, VisitCode, EncounterDate, EncounterTime,
    GestationalAgeWeeks, GestationalAgeDays, Trimester, Weight, SystolicBp, DiastolicBp,
    BpSite, PulseRate, RespiratoryRate, Temperature, FundalHeight, FetalHeartRate,
    FetalMovement, FetalPresentation, Anemia, Edema, IronSupplementation, TetanusVaccination,
    DangerSignsJson, ClinicalNotes, Assessment, [Plan], AttendingDoctorId, IsDraft,
    FinalizedAt, FinalizedByUserId, CreatedAt, CreatedByUserId
)
VALUES (
    @epOverdue, 1, 'ANC-2026-0002-V01', '2026-11-10', '14:00:00',
    42, 1, 3, 72.0, 148, 96,
    'Right Arm, Sitting', 88, 20, 36.8, 38.0, 138,
    'Normal', 'Cephalic', 'None', 'Pedal ++', 'Continuing', 'Fully Immunized',
    '[]', 'Patient past EDD (EDD was Oct 26). Blood pressure is elevated at 148/96. Patient is asymptomatic for severe preeclampsia.',
    'Post-term pregnancy at 42 weeks + 1 day with gestational hypertension. Bishop score favorable.',
    'Admit to Maternity Ward for induction of labor. Continuous fetal monitoring and Bishop score assessment.',
    @docId, 0, '2026-11-10 15:00:00', @userId, '2026-11-10', @userId
);

-- ============================================================================
-- SCENARIO 3: Patient 270604 (SOFIA KASSA)
-- Completed 43 weeks (43w 1d) requiring formal clinical review and authorization
-- LMP: 2026-01-13 -> Today is 303 days -> 43w 2d!
-- ============================================================================
PRINT '--> Seeding Scenario 3: 43-Week Review Threshold Patient 270604 (Sofia Kassa)';

DECLARE @lmpDate43 DATE = '2026-01-13';
DECLARE @edd43 DATE = DATEADD(DAY, 280, @lmpDate43);

INSERT INTO dbo.AncPregnancyEpisodes (
    TenantId, PatientId, EpisodeNumber, RegistrationDate, Gravidity, Parity,
    LmpDate, IsCycleRegular, EddLmp, ApprovedDatingMethod, EstablishedEdd,
    InitialGestationalWeeks, InitialGestationalDays, Status, RequiresOverdueReview, CreatedAt, CreatedByUserId
)
VALUES (
    1, 270604, 'ANC-2026-0003', '2026-03-05', 1, 0,
    @lmpDate43, 1, @edd43, 'LMP', @edd43,
    7, 2, 'Active', 1, '2026-03-05', @userId
);

PRINT '======================================================================';
PRINT 'ANC Test Data Seeded Successfully!';
PRINT '======================================================================';
GO
