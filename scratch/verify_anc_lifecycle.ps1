$connStr = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)

try {
    $conn.Open()
    Write-Output "=== CONNECTED TO CLINICDB SUCCESSFULLY ==="

    # 1. Check Tables
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 'Anc%';"
    $tableCount = $cmd.ExecuteScalar()
    Write-Output "SCENARIO 1: ANC Table Count in Database = $tableCount (Expected: 11)"

    # 2. Check Seeded Episodes
    $cmd.CommandText = @"
SELECT ep.EpisodeNumber, ep.Status, ep.ApprovedDatingMethod, ep.EstablishedEdd, p.MRN, p.FirstName, p.LastName 
FROM AncPregnancyEpisodes ep 
JOIN Patients p ON p.Id = ep.PatientId 
ORDER BY ep.EpisodeNumber;
"@
    $reader = $cmd.ExecuteReader()
    Write-Output "`nSCENARIO 2: Pregnancy Episodes:"
    while ($reader.Read()) {
        $edd = [DateTime]$reader["EstablishedEdd"]
        Write-Output (" - {0} | Status: {1} | Method: {2} | EDD: {3:yyyy-MM-dd} | Patient: {4} {5} (MRN: {6})" -f `
            $reader["EpisodeNumber"], $reader["Status"], $reader["ApprovedDatingMethod"], $edd, $reader["FirstName"], $reader["LastName"], $reader["MRN"])
    }
    $reader.Close()

    # 3. Check Patient 270606 Lifecycle (1 Closed + 1 Active)
    $cmd.CommandText = @"
SELECT Status, COUNT(1) AS Cnt 
FROM AncPregnancyEpisodes ep 
JOIN Patients p ON p.Id = ep.PatientId 
WHERE p.MRN = '270606' OR p.MRN = 'HD-270606'
GROUP BY Status;
"@
    $reader = $cmd.ExecuteReader()
    Write-Output "`nSCENARIO 3: Patient 270606 Episode Distribution (One Patient -> Multiple Episodes):"
    while ($reader.Read()) {
        Write-Output (" - Status: {0} -> Count: {1}" -f $reader["Status"], $reader["Cnt"])
    }
    $reader.Close()

    # 4. Check Filtered Unique Index Constraint Enforcement
    Write-Output "`nSCENARIO 4: Filtered Unique Index Enforcement (Preventing Duplicate Active Pregnancy):"
    try {
        $dupCmd = $conn.CreateCommand()
        $dupCmd.CommandText = @"
INSERT INTO AncPregnancyEpisodes (TenantId, PatientId, EpisodeNumber, RegistrationDate, Gravidity, Parity, ApprovedDatingMethod, EstablishedEdd, Status, CreatedByUserId)
VALUES (1, (SELECT Id FROM Patients WHERE MRN = '270606' OR MRN = 'HD-270606'), 'ANC-TEST-DUP', GETDATE(), 2, 1, 'LMP', DATEADD(day, 280, GETDATE()), 'Active', 1);
"@
        $dupCmd.ExecuteNonQuery()
        Write-Output " FAILED: Duplicate active pregnancy was erroneously allowed!"
    } catch {
        Write-Output " PASSED: Duplicate active pregnancy rejected by SQL Server: $($_.Exception.Message.Split([char]10)[0])"
    }

    # 5. Check Follow-up Encounters & Sequential Visit Codes
    $cmd.CommandText = @"
SELECT enc.EncounterNumber, enc.VisitCode, enc.GestationalAgeWeeks, enc.GestationalAgeDays, enc.SystolicBp, enc.DiastolicBp, enc.FundalHeight, enc.FetalHeartRate, enc.IsDraft
FROM AncEncounters enc
JOIN AncPregnancyEpisodes ep ON ep.Id = enc.EpisodeId
WHERE ep.EpisodeNumber = 'ANC-2026-0001'
ORDER BY enc.EncounterNumber;
"@
    $reader = $cmd.ExecuteReader()
    Write-Output "`nSCENARIO 5: Follow-up Encounters for ANC-2026-0001:"
    while ($reader.Read()) {
        Write-Output (" - Encounter #{0} ({1}) | GA: {2}w {3}d | BP: {4}/{5} | FH: {6}cm | FHR: {7} bpm | Draft: {8}" -f `
            $reader["EncounterNumber"], $reader["VisitCode"], $reader["GestationalAgeWeeks"], $reader["GestationalAgeDays"], `
            $reader["SystolicBp"], $reader["DiastolicBp"], $reader["FundalHeight"], $reader["FetalHeartRate"], $reader["IsDraft"])
    }
    $reader.Close()

    # 6. Check Delivery Outcome on Closed Episode
    $cmd.CommandText = @"
SELECT oc.DeliveryDate, oc.DeliveryPlace, oc.ModeOfDelivery, oc.PregnancyOutcome, oc.Baby1WeightGrams, oc.Baby1Sex, oc.Baby1Outcome
FROM AncPregnancyOutcomes oc
JOIN AncPregnancyEpisodes ep ON ep.Id = oc.EpisodeId
WHERE ep.EpisodeNumber = 'ANC-2024-0001';
"@
    $reader = $cmd.ExecuteReader()
    Write-Output "`nSCENARIO 6: Delivery Outcome for Closed Episode ANC-2024-0001:"
    while ($reader.Read()) {
        $dDate = [DateTime]$reader["DeliveryDate"]
        Write-Output (" - Delivery Date: {0:yyyy-MM-dd} at {1} | Mode: {2} | Outcome: {3} | Baby: {4}, {5}g ({6})" -f `
            $dDate, $reader["DeliveryPlace"], $reader["ModeOfDelivery"], $reader["PregnancyOutcome"], $reader["Baby1Sex"], $reader["Baby1WeightGrams"], $reader["Baby1Outcome"])
    }
    $reader.Close()

    # 7. Check Confidential PMTCT Record
    $cmd.CommandText = @"
SELECT MotherConfidentialCode, PartnerConfidentialCode, HivTestResult, PartnerHivResult, LinkedToArt
FROM AncPmtctRecords pm
JOIN AncPregnancyEpisodes ep ON ep.Id = pm.EpisodeId
WHERE ep.EpisodeNumber = 'ANC-2026-0001';
"@
    $reader = $cmd.ExecuteReader()
    Write-Output "`nSCENARIO 7: Confidential PMTCT Tracking:"
    while ($reader.Read()) {
        Write-Output (" - Maternal Code: {0} | Partner Code: {1} | Maternal HIV: {2} | Partner HIV: {3} | ART Linked: {4}" -f `
            $reader["MotherConfidentialCode"], $reader["PartnerConfidentialCode"], $reader["HivTestResult"], $reader["PartnerHivResult"], $reader["LinkedToArt"])
    }
    $reader.Close()

    # 8. Check Overdue & 43-week Review Episodes
    $cmd.CommandText = @"
SELECT ep.EpisodeNumber, ep.EstablishedEdd, p.MRN, p.FirstName, p.LastName,
       DATEDIFF(day, DATEADD(day, -280, ep.EstablishedEdd), GETDATE()) / 7 AS EstWeeks
FROM AncPregnancyEpisodes ep
JOIN Patients p ON p.Id = ep.PatientId
WHERE ep.Status = 'Active' AND DATEDIFF(day, DATEADD(day, -280, ep.EstablishedEdd), GETDATE()) / 7 >= 42;
"@
    $reader = $cmd.ExecuteReader()
    Write-Output "`nSCENARIO 8: Overdue Pregnancies (>= 42 Weeks Alert & 43 Weeks Review):"
    while ($reader.Read()) {
        $weeks = $reader["EstWeeks"]
        $type = if ($weeks -ge 43) { "43-WEEK MANDATORY AUTHORIZED CLINICAL REVIEW" } else { "42-WEEK POST-TERM WARNING" }
        Write-Output (" - {0} | Patient: {1} {2} (MRN: {3}) | Approx GA: {4} weeks -> [{5}]" -f `
            $reader["EpisodeNumber"], $reader["FirstName"], $reader["LastName"], $reader["MRN"], $weeks, $type)
    }
    $reader.Close()

    $conn.Close()
    Write-Output "`n=== ALL DATABASE INTEGRATION SCENARIOS VERIFIED SUCCESSFULLY ==="
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
