-- =====================================================================
-- PATCH SCRIPT: MIGRATE SCHEDULE & CONSULTATIONS TO PATIENT TRIAGE
-- Target Database: ClinicDB
-- Source Database: dbOHMS
-- Run this on existing migrated databases to populate historical patient queues
-- =====================================================================

USE [ClinicDB];
GO

SET NOCOUNT ON;
PRINT 'Starting PatientTriage migration from tblSchedule & tblConsultation...';

DECLARE @fbDocId INT = (SELECT TOP 1 [NewDoctorId] FROM dbo.[Map_DoctorName]);
IF @fbDocId IS NULL SET @fbDocId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Doctors]);
DECLARE @fbUsrId INT = (SELECT TOP 1 [NewUserId] FROM dbo.[Map_DoctorName]);
IF @fbUsrId IS NULL SET @fbUsrId = (SELECT TOP 1 [Id] FROM ClinicDB.dbo.[Users]);

-- 1. Insert from tblSchedule
INSERT INTO ClinicDB.dbo.[PatientTriage] (
    [TenantId], [PatientId], [AppointmentId], [QueueId], [TriageCategory], [PriorityLevel],
    [SystolicBP], [DiastolicBP], [HeartRate], [RespiratoryRate], [Temperature], [OxygenSaturation],
    [WeightKg], [HeightCm], [Bmi], [BloodGlucose], [PainScale],
    [ChiefComplaint], [NurseNotes],
    [AssignedDoctorId], [AssignedRoomId], [Status],
    [HoldReason], [HoldDurationMin],
    [TriagedBy], [TriagedAt], [UpdatedAt]
)
SELECT
    1 AS [TenantId],
    mp.[NewId] AS [PatientId],
    a.[Id] AS [AppointmentId],
    NULL AS [QueueId],
    COALESCE(NULLIF(LTRIM(RTRIM(s.[visittype])), ''), 'General Consultation') AS [TriageCategory],
    3 AS [PriorityLevel],
    CASE WHEN CHARINDEX('/', pw.[pressure]) > 0 
         THEN TRY_CAST(LEFT(pw.[pressure], CHARINDEX('/', pw.[pressure]) - 1) AS INT) 
         ELSE NULL END AS [SystolicBP],
    CASE WHEN CHARINDEX('/', pw.[pressure]) > 0 
         THEN TRY_CAST(SUBSTRING(pw.[pressure], CHARINDEX('/', pw.[pressure]) + 1, 10) AS INT) 
         ELSE NULL END AS [DiastolicBP],
    TRY_CAST(pw.[pulserate] AS INT) AS [HeartRate],
    TRY_CAST(pw.[respiratoryrate] AS INT) AS [RespiratoryRate],
    TRY_CAST(pw.[temperature] AS DECIMAL(4,1)) AS [Temperature],
    NULL AS [OxygenSaturation],
    TRY_CAST(pw.[weight] AS DECIMAL(5,2)) AS [WeightKg],
    CASE WHEN pw.[height] IS NOT NULL AND pw.[height] > 0 AND pw.[height] < 3 
         THEN TRY_CAST(pw.[height] * 100 AS DECIMAL(5,2)) 
         ELSE TRY_CAST(pw.[height] AS DECIMAL(5,2)) END AS [HeightCm],
    TRY_CAST(pw.[bmi] AS DECIMAL(5,2)) AS [Bmi],
    NULL AS [BloodGlucose],
    NULL AS [PainScale],
    COALESCE(NULLIF(LTRIM(RTRIM(s.[appNote])), ''), NULLIF(LTRIM(RTRIM(c.[chiefcompliant])), ''), NULLIF(LTRIM(RTRIM(c.[subjective])), ''), 'Routine consultation') AS [ChiefComplaint],
    NULLIF(LTRIM(RTRIM(
        ISNULL(s.[diagnosistype], '') + 
        CASE WHEN NULLIF(LTRIM(RTRIM(c.[diagnosis])), '') IS NOT NULL THEN ' | ' + c.[diagnosis] ELSE '' END
    )), '') AS [NurseNotes],
    COALESCE(md.[NewDoctorId], @fbDocId, 1) AS [AssignedDoctorId],
    NULL AS [AssignedRoomId],
    CASE WHEN c.[id] IS NOT NULL OR s.[ispaid] = 1 THEN 'Completed' ELSE 'AssignedToDoctor' END AS [Status],
    NULL AS [HoldReason],
    NULL AS [HoldDurationMin],
    COALESCE(md.[NewUserId], @fbUsrId, 1) AS [TriagedBy],
    ISNULL(s.[regdate], s.[createOndate]) AS [TriagedAt],
    ISNULL(s.[regdate], s.[createOndate]) AS [UpdatedAt]
FROM dbOHMS.dbo.[tblSchedule] s
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(s.[patid])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(s.[doctor]))) = md.[DoctorNameVariant]
LEFT JOIN ClinicDB.dbo.[Appointments] a 
    ON a.[PatientId] = mp.[NewId] 
   AND a.[DoctorId] = COALESCE(md.[NewDoctorId], @fbDocId, 1) 
   AND CAST(a.[SlotDateTime] AS DATE) = CAST(s.[createOndate] AS DATE)
OUTER APPLY (
    SELECT TOP 1 *
    FROM dbOHMS.dbo.[PatientWeight] w
    WHERE LTRIM(RTRIM(w.[patID])) = LTRIM(RTRIM(s.[patid]))
      AND CAST(w.[measuredOnDate] AS DATE) = CAST(s.[createOndate] AS DATE)
    ORDER BY w.[id] DESC
) pw
OUTER APPLY (
    SELECT TOP 1 *
    FROM dbOHMS.dbo.[tblConsultation] c_sub
    WHERE LTRIM(RTRIM(c_sub.[patID])) = LTRIM(RTRIM(s.[patid]))
      AND CAST(c_sub.[consultDate] AS DATE) = CAST(s.[createOndate] AS DATE)
    ORDER BY c_sub.[id] DESC
) c
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[PatientTriage] ex
    WHERE ex.[PatientId] = mp.[NewId]
      AND CAST(ex.[TriagedAt] AS DATE) = CAST(s.[createOndate] AS DATE)
)
OPTION (MAXDOP 1);

DECLARE @schedCount INT = @@ROWCOUNT;
PRINT '--> PatientTriage from tblSchedule inserted: ' + CAST(@schedCount AS VARCHAR) + ' rows.';

-- 2. Insert from tblConsultation (walk-in consultations without same-day schedule)
INSERT INTO ClinicDB.dbo.[PatientTriage] (
    [TenantId], [PatientId], [AppointmentId], [QueueId], [TriageCategory], [PriorityLevel],
    [SystolicBP], [DiastolicBP], [HeartRate], [RespiratoryRate], [Temperature], [OxygenSaturation],
    [WeightKg], [HeightCm], [Bmi], [BloodGlucose], [PainScale],
    [ChiefComplaint], [NurseNotes],
    [AssignedDoctorId], [AssignedRoomId], [Status],
    [HoldReason], [HoldDurationMin],
    [TriagedBy], [TriagedAt], [UpdatedAt]
)
SELECT
    1 AS [TenantId],
    mp.[NewId] AS [PatientId],
    NULL AS [AppointmentId],
    NULL AS [QueueId],
    'General Consultation' AS [TriageCategory],
    3 AS [PriorityLevel],
    CASE WHEN CHARINDEX('/', pw.[pressure]) > 0 
         THEN TRY_CAST(LEFT(pw.[pressure], CHARINDEX('/', pw.[pressure]) - 1) AS INT) 
         ELSE NULL END AS [SystolicBP],
    CASE WHEN CHARINDEX('/', pw.[pressure]) > 0 
         THEN TRY_CAST(SUBSTRING(pw.[pressure], CHARINDEX('/', pw.[pressure]) + 1, 10) AS INT) 
         ELSE NULL END AS [DiastolicBP],
    TRY_CAST(pw.[pulserate] AS INT) AS [HeartRate],
    TRY_CAST(pw.[respiratoryrate] AS INT) AS [RespiratoryRate],
    TRY_CAST(pw.[temperature] AS DECIMAL(4,1)) AS [Temperature],
    NULL AS [OxygenSaturation],
    TRY_CAST(pw.[weight] AS DECIMAL(5,2)) AS [WeightKg],
    CASE WHEN pw.[height] IS NOT NULL AND pw.[height] > 0 AND pw.[height] < 3 
         THEN TRY_CAST(pw.[height] * 100 AS DECIMAL(5,2)) 
         ELSE TRY_CAST(pw.[height] AS DECIMAL(5,2)) END AS [HeightCm],
    TRY_CAST(pw.[bmi] AS DECIMAL(5,2)) AS [Bmi],
    NULL AS [BloodGlucose],
    NULL AS [PainScale],
    COALESCE(NULLIF(LTRIM(RTRIM(c.[chiefcompliant])), ''), NULLIF(LTRIM(RTRIM(c.[subjective])), ''), 'Walk-in consultation') AS [ChiefComplaint],
    NULLIF(LTRIM(RTRIM(c.[diagnosis])), '') AS [NurseNotes],
    COALESCE(md.[NewDoctorId], @fbDocId, 1) AS [AssignedDoctorId],
    NULL AS [AssignedRoomId],
    'Completed' AS [Status],
    NULL AS [HoldReason],
    NULL AS [HoldDurationMin],
    COALESCE(md.[NewUserId], @fbUsrId, 1) AS [TriagedBy],
    ISNULL(CAST(c.[consultDate] AS DATETIME2), GETDATE()) AS [TriagedAt],
    ISNULL(CAST(c.[consultDate] AS DATETIME2), GETDATE()) AS [UpdatedAt]
FROM dbOHMS.dbo.[tblConsultation] c
JOIN dbo.[Map_PatientId] mp ON LTRIM(RTRIM(c.[patID])) = mp.[OldMRN]
LEFT JOIN dbo.[Map_DoctorName] md ON LOWER(LTRIM(RTRIM(c.[DocCode]))) = md.[DoctorNameVariant]
OUTER APPLY (
    SELECT TOP 1 *
    FROM dbOHMS.dbo.[PatientWeight] w
    WHERE LTRIM(RTRIM(w.[patID])) = LTRIM(RTRIM(c.[patID]))
      AND CAST(w.[measuredOnDate] AS DATE) = CAST(c.[consultDate] AS DATE)
    ORDER BY w.[id] DESC
) pw
WHERE NOT EXISTS (
    SELECT 1 FROM ClinicDB.dbo.[PatientTriage] ex
    WHERE ex.[PatientId] = mp.[NewId]
      AND CAST(ex.[TriagedAt] AS DATE) = CAST(c.[consultDate] AS DATE)
)
OPTION (MAXDOP 1);

DECLARE @consultCount INT = @@ROWCOUNT;
PRINT '--> PatientTriage from walk-in tblConsultation inserted: ' + CAST(@consultCount AS VARCHAR) + ' rows.';

PRINT 'Done. Total records now in PatientTriage: ' + CAST((SELECT COUNT(*) FROM ClinicDB.dbo.[PatientTriage]) AS VARCHAR);
GO
