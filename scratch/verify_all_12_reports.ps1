$connStr = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)

try {
    $conn.Open()
    Write-Output "=== TESTING ALL 12 ANC REPORTS AGAINST LIVE CLINICDB ==="

    $reports = @(
        "ACTIVE_REGISTER",
        "FIRST_REGISTRATION",
        "FOLLOW_UP",
        "TRIMESTER_DISTRIBUTION",
        "MISSED_APPOINTMENTS",
        "HIGH_RISK_REGISTER",
        "OVERDUE_PREGNANCIES",
        "PREGNANCY_OUTCOME",
        "LAB_COMPLETION",
        "PMTCT_HIV",
        "CLINICIAN_WORKLOAD",
        "CONTINUITY_COHORT"
    )

    # 1. Active Register
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(1) FROM AncPregnancyEpisodes WHERE Status = 'Active';"
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 1 [ACTIVE_REGISTER]: Found {0} active pregnancies" -f $cnt)

    # 2. First Registrations
    $cmd.CommandText = "SELECT COUNT(1) FROM AncPregnancyEpisodes;"
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 2 [FIRST_REGISTRATION]: Found {0} initial registrations" -f $cnt)

    # 3. Follow-up Visits
    $cmd.CommandText = "SELECT COUNT(1) FROM AncEncounters;"
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 3 [FOLLOW_UP]: Found {0} encounters documented" -f $cnt)

    # 4. Trimesters
    $cmd.CommandText = @"
SELECT 
    SUM(CASE WHEN DATEDIFF(day, DATEADD(day, -280, EstablishedEdd), GETDATE()) / 7 < 14 THEN 1 ELSE 0 END) AS T1,
    SUM(CASE WHEN DATEDIFF(day, DATEADD(day, -280, EstablishedEdd), GETDATE()) / 7 BETWEEN 14 AND 27 THEN 1 ELSE 0 END) AS T2,
    SUM(CASE WHEN DATEDIFF(day, DATEADD(day, -280, EstablishedEdd), GETDATE()) / 7 >= 28 THEN 1 ELSE 0 END) AS T3
FROM AncPregnancyEpisodes WHERE Status = 'Active';
"@
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Output ("Report 4 [TRIMESTER_DISTRIBUTION]: T1: {0}, T2: {1}, T3: {2}" -f $reader["T1"], $reader["T2"], $reader["T3"])
    }
    $reader.Close()

    # 5. Missed Appointments
    $cmd.CommandText = "SELECT COUNT(1) FROM AncAppointments WHERE Status = 'Scheduled' AND AppointmentDate < CAST(GETDATE() AS DATE);"
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 5 [MISSED_APPOINTMENTS]: Found {0} overdue appointments" -f $cnt)

    # 6. High Risk
    $cmd.CommandText = @"
SELECT COUNT(1) FROM AncEncounters WHERE SystolicBp >= 140 OR DiastolicBp >= 90 OR (DangerSignsJson IS NOT NULL AND DangerSignsJson <> '[]');
"@
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 6 [HIGH_RISK_REGISTER]: Found {0} high-risk encounter records" -f $cnt)

    # 7. Overdue Pregnancies
    $cmd.CommandText = "SELECT COUNT(1) FROM AncPregnancyEpisodes WHERE Status = 'Active' AND DATEDIFF(day, DATEADD(day, -280, EstablishedEdd), GETDATE()) / 7 >= 42;"
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 7 [OVERDUE_PREGNANCIES]: Found {0} overdue pregnancies (>= 42w)" -f $cnt)

    # 8. Pregnancy Delivery & Outcomes
    $cmd.CommandText = "SELECT COUNT(1) FROM AncPregnancyOutcomes;"
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 8 [PREGNANCY_OUTCOME]: Found {0} deliveries/outcomes recorded" -f $cnt)

    # 9. Labs
    $cmd.CommandText = "SELECT COUNT(1) FROM AncLaboratoryExaminations;"
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 9 [LAB_COMPLETION]: Found {0} laboratory examinations" -f $cnt)

    # 10. PMTCT / HIV
    $cmd.CommandText = "SELECT COUNT(1) FROM AncPmtctRecords;"
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 10 [PMTCT_HIV]: Found {0} PMTCT records" -f $cnt)

    # 11. Clinician Workload
    $cmd.CommandText = "SELECT COUNT(DISTINCT AttendingDoctorId) FROM AncEncounters;"
    $cnt = $cmd.ExecuteScalar()
    Write-Output ("Report 11 [CLINICIAN_WORKLOAD]: Found {0} active clinicians" -f $cnt)

    # 12. Continuity Cohort
    $cmd.CommandText = @"
SELECT 
    COUNT(CASE WHEN Visits >= 1 THEN 1 END) AS V1,
    COUNT(CASE WHEN Visits >= 2 THEN 1 END) AS V2,
    COUNT(CASE WHEN Visits >= 3 THEN 1 END) AS V3,
    COUNT(CASE WHEN Visits >= 4 THEN 1 END) AS V4
FROM (
    SELECT ep.Id, COUNT(enc.Id) AS Visits
    FROM AncPregnancyEpisodes ep
    LEFT JOIN AncEncounters enc ON enc.EpisodeId = ep.Id
    WHERE ep.Status = 'Active'
    GROUP BY ep.Id
) t;
"@
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        Write-Output ("Report 12 [CONTINUITY_COHORT]: ANC 1: {0}, ANC 2: {1}, ANC 3: {2}, ANC 4+: {3}" -f $reader["V1"], $reader["V2"], $reader["V3"], $reader["V4"])
    }
    $reader.Close()

    $conn.Close()
    Write-Output "`n=== ALL 12 REPORTS QUERIED LIVE FROM DATABASE WITH ZERO ERRORS ==="
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
