using System.Data;
using System.Text.Json;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.AntenatalCare;

public class AncService : IAncService
{
    private readonly IDbConnectionFactory _dbFactory;

    public AncService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<AncPatientCheckDto> CheckPatientActivePregnancyAsync(int patientId, int tenantId = 1)
    {
        using var conn = _dbFactory.CreateConnection();

        var patientSql = @"
            SELECT Id, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender, 
                   PrimaryPhone, BloodGroup, Address, Allergies, ChronicConditions
            FROM Patients WITH (NOLOCK)
            WHERE Id = @PatientId AND TenantId = @TenantId";

        var p = await conn.QueryFirstOrDefaultAsync<dynamic>(patientSql, new { PatientId = patientId, TenantId = tenantId });
        if (p == null)
            throw new KeyNotFoundException($"Patient with ID {patientId} not found.");

        DateTime dob = p.DateOfBirth;
        var ageYears = DateTime.UtcNow.Year - dob.Year;
        if (dob > DateTime.UtcNow.AddYears(-ageYears)) ageYears--;

        string fullName = $"{p.FirstName} {p.MiddleName} {p.LastName}".Replace("  ", " ").Trim();

        // Get active episode if any
        var epSql = @"
            SELECT ep.*,
                   (SELECT COUNT(1) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id AND IsDraft = 0) AS CompletedVisitsCount,
                   (SELECT MAX(EncounterDate) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id) AS LastVisitDate,
                   (SELECT MIN(AppointmentDate) FROM AncAppointments WITH (NOLOCK) WHERE EpisodeId = ep.Id AND Status = 'Scheduled' AND AppointmentDate >= CAST(GETDATE() AS DATE)) AS NextAppointmentDate
            FROM AncPregnancyEpisodes ep WITH (NOLOCK)
            WHERE ep.PatientId = @PatientId AND ep.TenantId = @TenantId AND ep.Status = 'Active'";

        var activeEpRow = await conn.QueryFirstOrDefaultAsync<dynamic>(epSql, new { PatientId = patientId, TenantId = tenantId });

        AncEpisodeSummaryDto? activeSummary = null;
        if (activeEpRow != null)
        {
            activeSummary = await MapEpisodeSummaryFromRowAsync(conn, activeEpRow, DateTime.UtcNow.Date);
        }

        // Get historical closed episodes
        var histSql = @"
            SELECT ep.*,
                   (SELECT COUNT(1) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id AND IsDraft = 0) AS CompletedVisitsCount,
                   (SELECT MAX(EncounterDate) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id) AS LastVisitDate,
                   u.Username AS ClosedByName
            FROM AncPregnancyEpisodes ep WITH (NOLOCK)
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = ep.ClosedByUserId
            WHERE ep.PatientId = @PatientId AND ep.TenantId = @TenantId AND ep.Status = 'Closed'
            ORDER BY ISNULL(ep.ClosedAt, ep.RegistrationDate) DESC";

        var histRows = (await conn.QueryAsync<dynamic>(histSql, new { PatientId = patientId, TenantId = tenantId })).ToList();
        var historicalSummaries = new List<AncEpisodeSummaryDto>();
        foreach (var h in histRows)
        {
            DateTime targetDate = h.ClosedAt != null ? (DateTime)h.ClosedAt : (DateTime)h.RegistrationDate;
            historicalSummaries.Add(await MapEpisodeSummaryFromRowAsync(conn, h, targetDate));
        }

        return new AncPatientCheckDto
        {
            PatientId = p.Id,
            MRN = p.MRN,
            FullName = fullName,
            AgeYears = ageYears,
            Gender = p.Gender.ToString(),
            DateOfBirth = p.DateOfBirth,
            PrimaryPhone = p.PrimaryPhone ?? "",
            BloodGroup = p.BloodGroup,
            Address = p.Address,
            Allergies = p.Allergies,
            ChronicConditions = p.ChronicConditions,
            HasActivePregnancy = activeSummary != null,
            ActiveEpisode = activeSummary,
            HistoricalEpisodes = historicalSummaries
        };
    }

    public async Task<AncWorkspaceDetailDto> RegisterNewEpisodeAsync(AncRegisterEpisodeRequest request, int userId, int tenantId = 1)
    {
        using var conn = _dbFactory.CreateConnection();
        if (conn.State != ConnectionState.Open) conn.Open();
        using var tran = conn.BeginTransaction();

        try
        {
            // Verify Patient exists
            var pExists = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM Patients WITH (NOLOCK) WHERE Id = @PatientId AND TenantId = @TenantId",
                new { request.PatientId, TenantId = tenantId }, tran);

            if (pExists == 0)
                throw new KeyNotFoundException($"Patient with ID {request.PatientId} not found.");

            // Rule: Check for active pregnancy
            var activeExists = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT EpisodeNumber FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE PatientId = @PatientId AND TenantId = @TenantId AND Status = 'Active'",
                new { request.PatientId, TenantId = tenantId }, tran);

            if (!string.IsNullOrEmpty(activeExists))
            {
                throw new InvalidOperationException($"Patient already has an active pregnancy episode ({activeExists}). All follow-up visits must belong to this episode.");
            }

            // Calculate EDDs and Gestational Age
            DateTime? eddLmp = null;
            DateTime? eddUs = null;
            DateTime establishedEdd;
            int gaWeeks = 0;
            int gaDays = 0;

            if (request.LmpDate.HasValue)
            {
                eddLmp = request.LmpDate.Value.AddDays(280);
                var daysFromLmp = (request.RegistrationDate.Date - request.LmpDate.Value.Date).Days;
                if (daysFromLmp > 0)
                {
                    gaWeeks = daysFromLmp / 7;
                    gaDays = daysFromLmp % 7;
                }
            }

            if (request.InitialUltrasoundDate.HasValue && request.InitialUltrasoundWeeks.HasValue)
            {
                var usDaysTotal = (request.InitialUltrasoundWeeks.Value * 7) + (request.InitialUltrasoundDays ?? 0);
                var lmpEquivalent = request.InitialUltrasoundDate.Value.AddDays(-usDaysTotal);
                eddUs = lmpEquivalent.AddDays(280);

                if (request.ApprovedDatingMethod == "Ultrasound")
                {
                    var daysFromLmpEq = (request.RegistrationDate.Date - lmpEquivalent.Date).Days;
                    if (daysFromLmpEq > 0)
                    {
                        gaWeeks = daysFromLmpEq / 7;
                        gaDays = daysFromLmpEq % 7;
                    }
                }
            }

            if (request.EstablishedEddOverride.HasValue)
            {
                establishedEdd = request.EstablishedEddOverride.Value;
            }
            else if (request.ApprovedDatingMethod == "Ultrasound" && eddUs.HasValue)
            {
                establishedEdd = eddUs.Value;
            }
            else if (eddLmp.HasValue)
            {
                establishedEdd = eddLmp.Value;
            }
            else
            {
                establishedEdd = request.RegistrationDate.AddDays(280);
            }

            var year = request.RegistrationDate.Year;
            var seqCount = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE EpisodeNumber LIKE @Prefix",
                new { Prefix = $"ANC-{year}-%" }, tran) + 1;
            var episodeNumber = $"ANC-{year}-{seqCount:D4}";

            var insertEpSql = @"
                INSERT INTO AncPregnancyEpisodes (
                    TenantId, PatientId, EpisodeNumber, RegistrationDate, Gravidity, Parity,
                    LmpDate, IsCycleRegular, EddLmp, InitialUltrasoundDate, EddUltrasound,
                    ApprovedDatingMethod, EstablishedEdd, InitialGestationalWeeks, InitialGestationalDays,
                    Status, CreatedAt, CreatedByUserId
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @TenantId, @PatientId, @EpisodeNumber, @RegistrationDate, @Gravidity, @Parity,
                    @LmpDate, @IsCycleRegular, @EddLmp, @InitialUltrasoundDate, @EddUltrasound,
                    @ApprovedDatingMethod, @EstablishedEdd, @InitialGestationalWeeks, @InitialGestationalDays,
                    'Active', GETDATE(), @CreatedByUserId
                );";

            int episodeId = await conn.ExecuteScalarAsync<int>(insertEpSql, new
            {
                TenantId = tenantId,
                request.PatientId,
                EpisodeNumber = episodeNumber,
                request.RegistrationDate,
                request.Gravidity,
                request.Parity,
                request.LmpDate,
                request.IsCycleRegular,
                EddLmp = eddLmp,
                request.InitialUltrasoundDate,
                EddUltrasound = eddUs,
                request.ApprovedDatingMethod,
                EstablishedEdd = establishedEdd,
                InitialGestationalWeeks = gaWeeks,
                InitialGestationalDays = gaDays,
                CreatedByUserId = userId
            }, tran);

            // Insert Initial Assessment
            var insertAssessSql = @"
                INSERT INTO AncInitialAssessments (
                    EpisodeId, AssessmentDate, Abortions, MolarPregnancies, EctopicPregnancies, LivingChildren,
                    MedicalHistoryJson, GeneralExamJson, BaselineVitalsJson, BasicAncModelCriteriaJson, GeneralMedicalAssessmentJson,
                    CreatedAt, CreatedByUserId
                )
                VALUES (
                    @EpisodeId, @AssessmentDate, @Abortions, @MolarPregnancies, @EctopicPregnancies, @LivingChildren,
                    @MedicalHistoryJson, @GeneralExamJson, @BaselineVitalsJson, @BasicAncModelCriteriaJson, @GeneralMedicalAssessmentJson,
                    GETDATE(), @CreatedByUserId
                );";

            await conn.ExecuteAsync(insertAssessSql, new
            {
                EpisodeId = episodeId,
                AssessmentDate = request.RegistrationDate,
                request.Abortions,
                request.MolarPregnancies,
                request.EctopicPregnancies,
                request.LivingChildren,
                MedicalHistoryJson = request.MedicalHistory != null ? JsonSerializer.Serialize(request.MedicalHistory) : null,
                GeneralExamJson = request.GeneralExam != null ? JsonSerializer.Serialize(request.GeneralExam) : null,
                BaselineVitalsJson = request.BaselineVitals != null ? JsonSerializer.Serialize(request.BaselineVitals) : null,
                BasicAncModelCriteriaJson = request.BasicModelCriteria != null ? JsonSerializer.Serialize(request.BasicModelCriteria) : null,
                GeneralMedicalAssessmentJson = request.GeneralMedicalAssessment != null ? JsonSerializer.Serialize(request.GeneralMedicalAssessment) : null,
                CreatedByUserId = userId
            }, tran);

            // Insert Previous Pregnancies
            if (request.PreviousPregnancies != null && request.PreviousPregnancies.Count > 0)
            {
                var insertPrevSql = @"
                    INSERT INTO AncPreviousPregnancies (
                        PatientId, EpisodeId, PregnancyNumber, BirthYear, DateOfBirth, ModeOfDelivery,
                        GestationalAgeWeeks, DeliveryPlace, BirthWeightGrams, DeliveryOutcome, Complications, Remarks, CreatedAt
                    )
                    VALUES (
                        @PatientId, @EpisodeId, @PregnancyNumber, @BirthYear, @DateOfBirth, @ModeOfDelivery,
                        @GestationalAgeWeeks, @DeliveryPlace, @BirthWeightGrams, @DeliveryOutcome, @Complications, @Remarks, GETDATE()
                    );";

                foreach (var prev in request.PreviousPregnancies)
                {
                    await conn.ExecuteAsync(insertPrevSql, new
                    {
                        request.PatientId,
                        EpisodeId = episodeId,
                        prev.PregnancyNumber,
                        prev.BirthYear,
                        prev.DateOfBirth,
                        prev.ModeOfDelivery,
                        prev.GestationalAgeWeeks,
                        prev.DeliveryPlace,
                        prev.BirthWeightGrams,
                        prev.DeliveryOutcome,
                        prev.Complications,
                        prev.Remarks
                    }, tran);
                }
            }

            // Insert Initial PMTCT placeholder
            var insertPmtctSql = @"
                INSERT INTO AncPmtctRecords (EpisodeId, HivTested, HivTestResult, PartnerHivResult, UpdatedByUserId, UpdatedAt)
                VALUES (@EpisodeId, 'Not Tested', 'Not Tested', 'Unknown', @UserId, GETDATE());";
            await conn.ExecuteAsync(insertPmtctSql, new { EpisodeId = episodeId, UserId = userId }, tran);

            // Audit log
            var insertAuditSql = @"
                INSERT INTO AncAuditLogs (EpisodeId, Action, ChangedByUserId, ChangedAt, DetailsJson)
                VALUES (@EpisodeId, 'REGISTER_EPISODE', @UserId, GETDATE(), @DetailsJson);";
            await conn.ExecuteAsync(insertAuditSql, new
            {
                EpisodeId = episodeId,
                UserId = userId,
                DetailsJson = JsonSerializer.Serialize(new { EpisodeNumber = episodeNumber, request.RegistrationDate, EstablishedEdd = establishedEdd })
            }, tran);

            tran.Commit();

            return await GetWorkspaceDetailsAsync(episodeId, userId, true, tenantId);
        }
        catch
        {
            tran.Rollback();
            throw;
        }
    }

    public async Task<AncWorkspaceDetailDto> GetWorkspaceDetailsAsync(int episodeId, int userId, bool isAuthorizedPmtct = false, int tenantId = 1)
    {
        using var conn = _dbFactory.CreateConnection();

        var epSql = @"
            SELECT ep.*,
                   (SELECT COUNT(1) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id AND IsDraft = 0) AS CompletedVisitsCount,
                   (SELECT MAX(EncounterDate) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id) AS LastVisitDate,
                   (SELECT MIN(AppointmentDate) FROM AncAppointments WITH (NOLOCK) WHERE EpisodeId = ep.Id AND Status = 'Scheduled' AND AppointmentDate >= CAST(GETDATE() AS DATE)) AS NextAppointmentDate,
                   u.Username AS ClosedByName
            FROM AncPregnancyEpisodes ep WITH (NOLOCK)
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = ep.ClosedByUserId
            WHERE ep.Id = @EpisodeId AND ep.TenantId = @TenantId";

        var epRow = await conn.QueryFirstOrDefaultAsync<dynamic>(epSql, new { EpisodeId = episodeId, TenantId = tenantId });
        if (epRow == null)
            throw new KeyNotFoundException($"ANC Episode with ID {episodeId} not found.");

        int patientId = epRow.PatientId;
        var patientCheck = await CheckPatientActivePregnancyAsync(patientId, tenantId);
        var episodeSummary = await MapEpisodeSummaryFromRowAsync(conn, epRow, DateTime.UtcNow.Date);

        // Initial Assessment
        var assessSql = "SELECT * FROM AncInitialAssessments WITH (NOLOCK) WHERE EpisodeId = @EpisodeId";
        var assessRow = await conn.QueryFirstOrDefaultAsync<dynamic>(assessSql, new { EpisodeId = episodeId });
        AncInitialAssessmentDto? initAssessDto = null;
        if (assessRow != null)
        {
            initAssessDto = new AncInitialAssessmentDto
            {
                Id = assessRow.Id,
                EpisodeId = assessRow.EpisodeId,
                AssessmentDate = assessRow.AssessmentDate,
                Abortions = assessRow.Abortions,
                MolarPregnancies = assessRow.MolarPregnancies,
                EctopicPregnancies = assessRow.EctopicPregnancies,
                LivingChildren = assessRow.LivingChildren,
                MedicalHistory = !string.IsNullOrEmpty((string?)assessRow.MedicalHistoryJson)
                    ? JsonSerializer.Deserialize<AncMedicalHistoryDto>((string)assessRow.MedicalHistoryJson) : null,
                GeneralExam = !string.IsNullOrEmpty((string?)assessRow.GeneralExamJson)
                    ? JsonSerializer.Deserialize<AncGeneralExamDto>((string)assessRow.GeneralExamJson) : null,
                BaselineVitals = !string.IsNullOrEmpty((string?)assessRow.BaselineVitalsJson)
                    ? JsonSerializer.Deserialize<AncBaselineVitalsDto>((string)assessRow.BaselineVitalsJson) : null,
                BasicModelCriteria = !string.IsNullOrEmpty((string?)assessRow.BasicModelCriteriaJson)
                    ? JsonSerializer.Deserialize<AncBasicModelCriteriaDto>((string)assessRow.BasicModelCriteriaJson) : null,
                GeneralMedicalAssessment = !string.IsNullOrEmpty((string?)assessRow.GeneralMedicalAssessmentJson)
                    ? JsonSerializer.Deserialize<AncGeneralMedicalAssessmentDto>((string)assessRow.GeneralMedicalAssessmentJson) : null
            };
        }

        // Previous Pregnancies
        var prevSql = @"
            SELECT * FROM AncPreviousPregnancies WITH (NOLOCK) 
            WHERE PatientId = @PatientId 
            ORDER BY PregnancyNumber";
        var prevPregnancies = (await conn.QueryAsync<AncPreviousPregnancyDto>(prevSql, new { PatientId = patientId })).ToList();

        // Encounters
        var encSql = @"
            SELECT enc.*, 
                   ISNULL(s.Title + ' ' + s.FirstName + ' ' + s.LastName, ISNULL(s.FirstName + ' ' + s.LastName, 'Attending Doctor')) AS AttendingDoctorName,
                   u.Username AS FinalizedByName
            FROM AncEncounters enc WITH (NOLOCK)
            LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = enc.AttendingDoctorId
            LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = enc.FinalizedByUserId
            WHERE enc.EpisodeId = @EpisodeId
            ORDER BY enc.EncounterNumber ASC";

        var encRows = (await conn.QueryAsync<dynamic>(encSql, new { EpisodeId = episodeId })).ToList();
        var encountersDto = new List<AncEncounterDto>();

        foreach (var er in encRows)
        {
            var encDto = MapEncounterDtoFromRow(er);
            // Load diagnoses for encounter
            var diags = await conn.QueryAsync<AncDiagnosisDto>(
                "SELECT * FROM AncDiagnoses WITH (NOLOCK) WHERE EncounterId = @EncounterId",
                new { EncounterId = encDto.Id });
            encDto.Diagnoses = diags.ToList();
            encountersDto.Add(encDto);
        }

        // Build side-by-side comparison
        AncEncounterComparisonDto? latestComparison = null;
        if (encountersDto.Count >= 2)
        {
            var cur = encountersDto[^1];
            var prv = encountersDto[^2];
            latestComparison = new AncEncounterComparisonDto
            {
                CurrentEncounter = cur,
                PreviousEncounter = prv,
                WeightDifference = (cur.Weight.HasValue && prv.Weight.HasValue) ? (cur.Weight - prv.Weight) : null,
                FundalHeightDifference = (cur.FundalHeight.HasValue && prv.FundalHeight.HasValue) ? (cur.FundalHeight - prv.FundalHeight) : null,
                GestationalWeeksDifference = cur.GestationalAgeWeeks - prv.GestationalAgeWeeks
            };
        }
        else if (encountersDto.Count == 1)
        {
            latestComparison = new AncEncounterComparisonDto
            {
                CurrentEncounter = encountersDto[0],
                PreviousEncounter = null
            };
        }

        // Ultrasounds
        var usSql = "SELECT * FROM AncUltrasoundRecords WITH (NOLOCK) WHERE EpisodeId = @EpisodeId ORDER BY UltrasoundDate DESC";
        var ultrasounds = (await conn.QueryAsync<AncUltrasoundDto>(usSql, new { EpisodeId = episodeId })).ToList();

        // PMTCT Record (Role-Protected)
        AncPmtctDto? pmtctDto = null;
        var pmtctRow = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT * FROM AncPmtctRecords WITH (NOLOCK) WHERE EpisodeId = @EpisodeId",
            new { EpisodeId = episodeId });

        if (pmtctRow != null)
        {
            if (isAuthorizedPmtct)
            {
                pmtctDto = new AncPmtctDto
                {
                    Id = pmtctRow.Id,
                    EpisodeId = pmtctRow.EpisodeId,
                    MotherConfidentialCode = pmtctRow.MotherConfidentialCode,
                    PartnerConfidentialCode = pmtctRow.PartnerConfidentialCode,
                    MotherLetterCode = pmtctRow.MotherLetterCode,
                    PartnerLetterCode = pmtctRow.PartnerLetterCode,
                    HivTested = pmtctRow.HivTested,
                    HivTestResult = pmtctRow.HivTestResult,
                    PartnerHivResult = pmtctRow.PartnerHivResult,
                    Cd4Count = pmtctRow.Cd4Count,
                    WhoClinicalStaging = pmtctRow.WhoClinicalStaging,
                    NutritionalAssessment = pmtctRow.NutritionalAssessment,
                    InfantFeedingCounseling = pmtctRow.InfantFeedingCounseling,
                    LinkedToArt = pmtctRow.LinkedToArt,
                    MotherPmtctDate = pmtctRow.MotherPmtctDate,
                    PartnerPmtctDate = pmtctRow.PartnerPmtctDate,
                    MotherPmtctResult = pmtctRow.MotherPmtctResult,
                    PartnerPmtctResult = pmtctRow.PartnerPmtctResult,
                    ConfidentialRemarks = pmtctRow.ConfidentialRemarks,
                    UpdatedAt = pmtctRow.UpdatedAt,
                    IsRestricted = false
                };
            }
            else
            {
                pmtctDto = new AncPmtctDto
                {
                    Id = pmtctRow.Id,
                    EpisodeId = pmtctRow.EpisodeId,
                    IsRestricted = true
                };
            }
        }

        // Labs
        var labSql = "SELECT * FROM AncLaboratoryExaminations WITH (NOLOCK) WHERE EpisodeId = @EpisodeId ORDER BY TestDate DESC";
        var labs = (await conn.QueryAsync<AncLabExaminationDto>(labSql, new { EpisodeId = episodeId })).ToList();

        // Diagnoses
        var diagSql = "SELECT * FROM AncDiagnoses WITH (NOLOCK) WHERE EpisodeId = @EpisodeId ORDER BY DiagnosisDate DESC";
        var diagnoses = (await conn.QueryAsync<AncDiagnosisDto>(diagSql, new { EpisodeId = episodeId })).ToList();

        // Appointments
        var apptSql = @"
            SELECT a.*,
                   p.FirstName + ' ' + p.LastName AS PatientName,
                   p.MRN AS PatientMrn,
                   ISNULL(s.FirstName + ' ' + s.LastName, 'Staff') AS DoctorName
            FROM AncAppointments a WITH (NOLOCK)
            JOIN Patients p WITH (NOLOCK) ON p.Id = a.PatientId
            LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = a.DoctorId
            LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
            WHERE a.EpisodeId = @EpisodeId
            ORDER BY a.AppointmentDate ASC";
        var appointments = (await conn.QueryAsync<AncAppointmentDto>(apptSql, new { EpisodeId = episodeId })).ToList();

        // Outcome
        var ocSql = @"
            SELECT oc.*, u.Username AS ClosingClinicianName
            FROM AncPregnancyOutcomes oc WITH (NOLOCK)
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = oc.ClosingClinicianId
            WHERE oc.EpisodeId = @EpisodeId";
        var ocRow = await conn.QueryFirstOrDefaultAsync<dynamic>(ocSql, new { EpisodeId = episodeId });
        AncOutcomeDto? outcomeDto = null;
        if (ocRow != null)
        {
            TimeSpan dtTime = ocRow.DeliveryTime is TimeSpan ts ? ts : TimeSpan.Zero;
            outcomeDto = new AncOutcomeDto
            {
                Id = ocRow.Id,
                EpisodeId = ocRow.EpisodeId,
                DeliveryDate = ocRow.DeliveryDate,
                DeliveryTimeFormatted = dtTime.ToString(@"hh\:mm"),
                DeliveryPlace = ocRow.DeliveryPlace,
                ModeOfDelivery = ocRow.ModeOfDelivery,
                PregnancyOutcomeType = ocRow.PregnancyOutcome,
                NumberOfBabies = ocRow.NumberOfBabies,
                MaternalOutcome = ocRow.MaternalOutcome,
                MaternalComplications = ocRow.MaternalComplications,
                Baby1Outcome = ocRow.Baby1Outcome,
                Baby1Sex = ocRow.Baby1Sex,
                Baby1WeightGrams = ocRow.Baby1WeightGrams,
                Baby1Apgar1 = ocRow.Baby1Apgar1,
                Baby1Apgar5 = ocRow.Baby1Apgar5,
                Baby2Outcome = ocRow.Baby2Outcome,
                Baby2Sex = ocRow.Baby2Sex,
                Baby2WeightGrams = ocRow.Baby2WeightGrams,
                Baby2Apgar1 = ocRow.Baby2Apgar1,
                Baby2Apgar5 = ocRow.Baby2Apgar5,
                DeliveryRemarks = ocRow.DeliveryRemarks,
                ReferralInfo = ocRow.ReferralInfo,
                ClosingClinicianName = ocRow.ClosingClinicianName ?? "Clinician",
                CreatedAt = ocRow.CreatedAt
            };
        }

        // Audit Logs
        var auditSql = @"
            SELECT TOP 30 l.Id, l.Action, l.ChangedAt, l.DetailsJson, ISNULL(u.Username, 'System') AS ChangedByName
            FROM AncAuditLogs l WITH (NOLOCK)
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = l.ChangedByUserId
            WHERE l.EpisodeId = @EpisodeId
            ORDER BY l.ChangedAt DESC";
        var auditLogs = (await conn.QueryAsync<AncAuditLogDto>(auditSql, new { EpisodeId = episodeId })).ToList();

        return new AncWorkspaceDetailDto
        {
            Patient = patientCheck,
            Episode = episodeSummary,
            InitialAssessment = initAssessDto,
            PreviousPregnancies = prevPregnancies,
            Encounters = encountersDto,
            LatestComparison = latestComparison,
            Ultrasounds = ultrasounds,
            Pmtct = pmtctDto,
            LabExaminations = labs,
            Diagnoses = diagnoses,
            Appointments = appointments,
            Outcome = outcomeDto,
            AuditLogs = auditLogs
        };
    }

    public async Task<AncEncounterDto> CreateEncounterAsync(AncCreateEncounterRequest request, int userId, int tenantId = 1)
    {
        using var conn = _dbFactory.CreateConnection();
        if (conn.State != ConnectionState.Open) conn.Open();
        using var tran = conn.BeginTransaction();

        try
        {
            var ep = await conn.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE Id = @EpisodeId AND TenantId = @TenantId",
                new { request.EpisodeId, TenantId = tenantId }, tran);

            if (ep == null)
                throw new KeyNotFoundException($"ANC Episode {request.EpisodeId} not found.");

            if (ep.Status == "Closed")
                throw new InvalidOperationException("Cannot add encounters to a closed pregnancy episode.");

            var ga = CalculateGestationalAgeDynamic((object)ep, request.EncounterDate);
            var gaWeeks = ga.weeks;
            var gaDays = ga.days;
            var trimester = (byte)(gaWeeks < 14 ? 1 : (gaWeeks < 28 ? 2 : 3));

            var maxNum = await conn.ExecuteScalarAsync<int?>(
                "SELECT MAX(EncounterNumber) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = @EpisodeId",
                new { request.EpisodeId }, tran) ?? 0;
            var nextNum = maxNum + 1;
            var visitCode = $"{ep.EpisodeNumber}-V{nextNum:D2}";

            int doctorId = request.AttendingDoctorId ?? await conn.ExecuteScalarAsync<int>(
                "SELECT TOP 1 Id FROM Doctors WITH (NOLOCK)", null, tran);
            if (doctorId == 0) doctorId = 1;

            var insertEncSql = @"
                INSERT INTO AncEncounters (
                    EpisodeId, EncounterNumber, VisitCode, EncounterDate, EncounterTime,
                    GestationalAgeWeeks, GestationalAgeDays, Trimester, Weight, SystolicBp, DiastolicBp,
                    BpSite, PulseRate, RespiratoryRate, Temperature, FundalHeight, FetalHeartRate,
                    FetalMovement, FetalPresentation, Anemia, Edema, IronSupplementation, TetanusVaccination,
                    DangerSignsJson, ClinicalNotes, Assessment, [Plan], LabResultRemarks, NextVisitDate,
                    AppointmentRemarks, AttendingDoctorId, IsDraft, FinalizedAt, FinalizedByUserId,
                    IsCorrection, CorrectionReason, OriginalEncounterId, CreatedAt, CreatedByUserId
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @EpisodeId, @EncounterNumber, @VisitCode, @EncounterDate, CAST(GETDATE() AS TIME),
                    @GestationalAgeWeeks, @GestationalAgeDays, @Trimester, @Weight, @SystolicBp, @DiastolicBp,
                    @BpSite, @PulseRate, @RespiratoryRate, @Temperature, @FundalHeight, @FetalHeartRate,
                    @FetalMovement, @FetalPresentation, @Anemia, @Edema, @IronSupplementation, @TetanusVaccination,
                    @DangerSignsJson, @ClinicalNotes, @Assessment, @Plan, @LabResultRemarks, @NextVisitDate,
                    @AppointmentRemarks, @AttendingDoctorId, @IsDraft, 
                    CASE WHEN @IsDraft = 1 THEN NULL ELSE GETDATE() END,
                    CASE WHEN @IsDraft = 1 THEN NULL ELSE @UserId END,
                    @IsCorrection, @CorrectionReason, @OriginalEncounterId, GETDATE(), @UserId
                );";

            int encId = await conn.ExecuteScalarAsync<int>(insertEncSql, new
            {
                request.EpisodeId,
                EncounterNumber = nextNum,
                VisitCode = visitCode,
                request.EncounterDate,
                GestationalAgeWeeks = gaWeeks,
                GestationalAgeDays = gaDays,
                Trimester = trimester,
                request.Weight,
                request.SystolicBp,
                request.DiastolicBp,
                request.BpSite,
                request.PulseRate,
                request.RespiratoryRate,
                request.Temperature,
                request.FundalHeight,
                request.FetalHeartRate,
                request.FetalMovement,
                request.FetalPresentation,
                request.Anemia,
                request.Edema,
                request.IronSupplementation,
                request.TetanusVaccination,
                DangerSignsJson = request.DangerSigns != null ? JsonSerializer.Serialize(request.DangerSigns) : null,
                request.ClinicalNotes,
                request.Assessment,
                request.Plan,
                request.LabResultRemarks,
                request.NextVisitDate,
                request.AppointmentRemarks,
                AttendingDoctorId = doctorId,
                request.IsDraft,
                UserId = userId,
                request.IsCorrection,
                request.CorrectionReason,
                request.OriginalEncounterId
            }, tran);

            // Add Diagnoses if any
            if (request.Diagnoses != null && request.Diagnoses.Count > 0)
            {
                var diagSql = @"
                    INSERT INTO AncDiagnoses (EpisodeId, EncounterId, IcdCode, Dhis2Code, HmisCode, Description, DiagnosisType, DiagnosisDate, RegisteredByUserId, CreatedAt)
                    VALUES (@EpisodeId, @EncounterId, @IcdCode, @Dhis2Code, @HmisCode, @Description, @DiagnosisType, @DiagnosisDate, @UserId, GETDATE());";

                foreach (var diag in request.Diagnoses)
                {
                    await conn.ExecuteAsync(diagSql, new
                    {
                        request.EpisodeId,
                        EncounterId = encId,
                        diag.IcdCode,
                        diag.Dhis2Code,
                        diag.HmisCode,
                        diag.Description,
                        DiagnosisType = diag.DiagnosisType ?? "Primary",
                        DiagnosisDate = request.EncounterDate,
                        UserId = userId
                    }, tran);
                }
            }

            // Add Appointment if NextVisitDate is set
            if (request.NextVisitDate.HasValue)
            {
                var apptSql = @"
                    INSERT INTO AncAppointments (EpisodeId, EncounterId, PatientId, DoctorId, AppointmentDate, Status, Remarks, CreatedAt)
                    VALUES (@EpisodeId, @EncounterId, @PatientId, @DoctorId, @AppointmentDate, 'Scheduled', @Remarks, GETDATE());";

                await conn.ExecuteAsync(apptSql, new
                {
                    request.EpisodeId,
                    EncounterId = encId,
                    PatientId = (int)ep.PatientId,
                    DoctorId = doctorId,
                    AppointmentDate = request.NextVisitDate.Value,
                    Remarks = request.AppointmentRemarks
                }, tran);
            }

            // Flag overdue review if >= 43 weeks
            if (gaWeeks >= 43)
            {
                await conn.ExecuteAsync(
                    "UPDATE AncPregnancyEpisodes SET RequiresOverdueReview = 1 WHERE Id = @Id",
                    new { Id = request.EpisodeId }, tran);
            }

            // Audit Log
            await conn.ExecuteAsync(@"
                INSERT INTO AncAuditLogs (EpisodeId, EncounterId, Action, ChangedByUserId, ChangedAt, DetailsJson)
                VALUES (@EpisodeId, @EncounterId, @Action, @UserId, GETDATE(), @DetailsJson)",
                new
                {
                    request.EpisodeId,
                    EncounterId = encId,
                    Action = request.IsDraft ? "SAVE_DRAFT_ENCOUNTER" : "FINALIZE_ENCOUNTER",
                    UserId = userId,
                    DetailsJson = JsonSerializer.Serialize(new { VisitCode = visitCode, GA = $"{gaWeeks}w {gaDays}d", request.IsDraft, request.IsCorrection })
                }, tran);

            var loadedEnc = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                SELECT enc.*, 
                       ISNULL(s.Title + ' ' + s.FirstName + ' ' + s.LastName, ISNULL(s.FirstName + ' ' + s.LastName, 'Doctor')) AS AttendingDoctorName,
                       u.Username AS FinalizedByName
                FROM AncEncounters enc WITH (NOLOCK)
                LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = enc.AttendingDoctorId
                LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
                LEFT JOIN Users u WITH (NOLOCK) ON u.Id = enc.FinalizedByUserId
                WHERE enc.Id = @Id", new { Id = encId }, tran);

            tran.Commit();

            return MapEncounterDtoFromRow(loadedEnc);
        }
        catch
        {
            tran.Rollback();
            throw;
        }
    }

    public async Task<AncEncounterDto> FinalizeEncounterAsync(int encounterId, int userId)
    {
        using var conn = _dbFactory.CreateConnection();

        var enc = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT * FROM AncEncounters WITH (NOLOCK) WHERE Id = @Id", new { Id = encounterId });

        if (enc == null)
            throw new KeyNotFoundException($"Encounter with ID {encounterId} not found.");

        if (enc.IsDraft == false)
            throw new InvalidOperationException("Encounter is already finalized.");

        await conn.ExecuteAsync(@"
            UPDATE AncEncounters 
            SET IsDraft = 0, FinalizedAt = GETDATE(), FinalizedByUserId = @UserId, UpdatedAt = GETDATE()
            WHERE Id = @Id", new { Id = encounterId, UserId = userId });

        await conn.ExecuteAsync(@"
            INSERT INTO AncAuditLogs (EpisodeId, EncounterId, Action, ChangedByUserId, ChangedAt, DetailsJson)
            VALUES (@EpisodeId, @EncounterId, 'FINALIZE_ENCOUNTER', @UserId, GETDATE(), @DetailsJson)",
            new
            {
                EpisodeId = (int)enc.EpisodeId,
                EncounterId = encounterId,
                UserId = userId,
                DetailsJson = JsonSerializer.Serialize(new { enc.VisitCode, FinalizedAt = DateTime.UtcNow })
            });

        var loadedEnc = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT enc.*, 
                   ISNULL(s.Title + ' ' + s.FirstName + ' ' + s.LastName, ISNULL(s.FirstName + ' ' + s.LastName, 'Doctor')) AS AttendingDoctorName,
                   u.Username AS FinalizedByName
            FROM AncEncounters enc WITH (NOLOCK)
            LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = enc.AttendingDoctorId
            LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = enc.FinalizedByUserId
            WHERE enc.Id = @Id", new { Id = encounterId });

        return MapEncounterDtoFromRow(loadedEnc);
    }

    public async Task<AncUltrasoundDto> AddUltrasoundRecordAsync(int episodeId, AncUltrasoundDto dto, int userId)
    {
        using var conn = _dbFactory.CreateConnection();

        var usDaysTotal = (dto.GestationalAgeWeeks * 7) + dto.GestationalAgeDays;
        var lmpEquivalent = dto.UltrasoundDate.AddDays(-usDaysTotal);
        var eddUs = dto.EddByUltrasound ?? lmpEquivalent.AddDays(280);
        var trimester = (byte)(dto.GestationalAgeWeeks < 14 ? 1 : (dto.GestationalAgeWeeks < 28 ? 2 : 3));

        var sql = @"
            INSERT INTO AncUltrasoundRecords (
                EpisodeId, EncounterId, UltrasoundDate, GestationalAgeWeeks, GestationalAgeDays,
                EstimatedConceptionDate, EddByUltrasound, Trimester, Presentation, PlacentalLocation,
                AmnioticFluid, FetalHeartRate, EstimatedFetalWeight, Findings, TakenBy, CreatedAt, CreatedByUserId
            )
            OUTPUT INSERTED.Id
            VALUES (
                @EpisodeId, @EncounterId, @UltrasoundDate, @GestationalAgeWeeks, @GestationalAgeDays,
                @EstimatedConceptionDate, @EddByUltrasound, @Trimester, @Presentation, @PlacentalLocation,
                @AmnioticFluid, @FetalHeartRate, @EstimatedFetalWeight, @Findings, @TakenBy, GETDATE(), @UserId
            );";

        int id = await conn.ExecuteScalarAsync<int>(sql, new
        {
            EpisodeId = episodeId,
            dto.EncounterId,
            dto.UltrasoundDate,
            dto.GestationalAgeWeeks,
            dto.GestationalAgeDays,
            EstimatedConceptionDate = dto.EstimatedConceptionDate ?? lmpEquivalent.AddDays(14),
            EddByUltrasound = eddUs,
            Trimester = trimester,
            dto.Presentation,
            dto.PlacentalLocation,
            dto.AmnioticFluid,
            dto.FetalHeartRate,
            dto.EstimatedFetalWeight,
            dto.Findings,
            dto.TakenBy,
            UserId = userId
        });

        await conn.ExecuteAsync(@"
            INSERT INTO AncAuditLogs (EpisodeId, Action, ChangedByUserId, ChangedAt, DetailsJson)
            VALUES (@EpisodeId, 'ADD_ULTRASOUND', @UserId, GETDATE(), @DetailsJson)",
            new
            {
                EpisodeId = episodeId,
                UserId = userId,
                DetailsJson = JsonSerializer.Serialize(new { dto.UltrasoundDate, GA = $"{dto.GestationalAgeWeeks}w {dto.GestationalAgeDays}d", eddUs })
            });

        dto.Id = id;
        dto.EddByUltrasound = eddUs;
        dto.Trimester = trimester;
        dto.CreatedAt = DateTime.UtcNow;
        return dto;
    }

    public async Task<AncPmtctDto> SavePmtctRecordAsync(int episodeId, AncPmtctDto dto, int userId)
    {
        using var conn = _dbFactory.CreateConnection();

        var exists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM AncPmtctRecords WITH (NOLOCK) WHERE EpisodeId = @EpisodeId",
            new { EpisodeId = episodeId });

        if (exists > 0)
        {
            var updateSql = @"
                UPDATE AncPmtctRecords SET
                    MotherConfidentialCode = @MotherConfidentialCode,
                    PartnerConfidentialCode = @PartnerConfidentialCode,
                    MotherLetterCode = @MotherLetterCode,
                    PartnerLetterCode = @PartnerLetterCode,
                    HivTested = @HivTested,
                    HivTestResult = @HivTestResult,
                    PartnerHivResult = @PartnerHivResult,
                    Cd4Count = @Cd4Count,
                    WhoClinicalStaging = @WhoClinicalStaging,
                    NutritionalAssessment = @NutritionalAssessment,
                    InfantFeedingCounseling = @InfantFeedingCounseling,
                    LinkedToArt = @LinkedToArt,
                    MotherPmtctDate = @MotherPmtctDate,
                    PartnerPmtctDate = @PartnerPmtctDate,
                    MotherPmtctResult = @MotherPmtctResult,
                    PartnerPmtctResult = @PartnerPmtctResult,
                    ConfidentialRemarks = @ConfidentialRemarks,
                    UpdatedByUserId = @UserId,
                    UpdatedAt = GETDATE()
                WHERE EpisodeId = @EpisodeId;";

            await conn.ExecuteAsync(updateSql, new
            {
                EpisodeId = episodeId,
                dto.MotherConfidentialCode,
                dto.PartnerConfidentialCode,
                dto.MotherLetterCode,
                dto.PartnerLetterCode,
                dto.HivTested,
                dto.HivTestResult,
                dto.PartnerHivResult,
                dto.Cd4Count,
                dto.WhoClinicalStaging,
                dto.NutritionalAssessment,
                dto.InfantFeedingCounseling,
                dto.LinkedToArt,
                dto.MotherPmtctDate,
                dto.PartnerPmtctDate,
                dto.MotherPmtctResult,
                dto.PartnerPmtctResult,
                dto.ConfidentialRemarks,
                UserId = userId
            });
        }
        else
        {
            var insertSql = @"
                INSERT INTO AncPmtctRecords (
                    EpisodeId, MotherConfidentialCode, PartnerConfidentialCode, MotherLetterCode, PartnerLetterCode,
                    HivTested, HivTestResult, PartnerHivResult, Cd4Count, WhoClinicalStaging,
                    NutritionalAssessment, InfantFeedingCounseling, LinkedToArt, MotherPmtctDate,
                    PartnerPmtctDate, MotherPmtctResult, PartnerPmtctResult, ConfidentialRemarks,
                    UpdatedByUserId, UpdatedAt
                )
                VALUES (
                    @EpisodeId, @MotherConfidentialCode, @PartnerConfidentialCode, @MotherLetterCode, @PartnerLetterCode,
                    @HivTested, @HivTestResult, @PartnerHivResult, @Cd4Count, @WhoClinicalStaging,
                    @NutritionalAssessment, @InfantFeedingCounseling, @LinkedToArt, @MotherPmtctDate,
                    @PartnerPmtctDate, @MotherPmtctResult, @PartnerPmtctResult, @ConfidentialRemarks,
                    @UserId, GETDATE()
                );";

            await conn.ExecuteAsync(insertSql, new
            {
                EpisodeId = episodeId,
                dto.MotherConfidentialCode,
                dto.PartnerConfidentialCode,
                dto.MotherLetterCode,
                dto.PartnerLetterCode,
                dto.HivTested,
                dto.HivTestResult,
                dto.PartnerHivResult,
                dto.Cd4Count,
                dto.WhoClinicalStaging,
                dto.NutritionalAssessment,
                dto.InfantFeedingCounseling,
                dto.LinkedToArt,
                dto.MotherPmtctDate,
                dto.PartnerPmtctDate,
                dto.MotherPmtctResult,
                dto.PartnerPmtctResult,
                dto.ConfidentialRemarks,
                UserId = userId
            });
        }

        await conn.ExecuteAsync(@"
            INSERT INTO AncAuditLogs (EpisodeId, Action, ChangedByUserId, ChangedAt, DetailsJson)
            VALUES (@EpisodeId, 'UPDATE_PMTCT_RECORD', @UserId, GETDATE(), 'Confidential PMTCT data modified')",
            new { EpisodeId = episodeId, UserId = userId });

        dto.UpdatedAt = DateTime.UtcNow;
        return dto;
    }

    public async Task<AncLabExaminationDto> AddLabExaminationAsync(int episodeId, AncLabExaminationDto dto, int userId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO AncLaboratoryExaminations (EpisodeId, EncounterId, TestType, TestDate, ResultValue, Unit, ReferenceRange, Status, IsAbnormal, Remarks, ConductedBy, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@EpisodeId, @EncounterId, @TestType, @TestDate, @ResultValue, @Unit, @ReferenceRange, @Status, @IsAbnormal, @Remarks, @ConductedBy, GETDATE());";

        int id = await conn.ExecuteScalarAsync<int>(sql, new
        {
            EpisodeId = episodeId,
            dto.EncounterId,
            dto.TestType,
            dto.TestDate,
            dto.ResultValue,
            dto.Unit,
            dto.ReferenceRange,
            dto.Status,
            dto.IsAbnormal,
            dto.Remarks,
            dto.ConductedBy
        });

        dto.Id = id;
        return dto;
    }

    public async Task<AncDiagnosisDto> AddDiagnosisAsync(int episodeId, AncDiagnosisDto dto, int userId)
    {
        using var conn = _dbFactory.CreateConnection();
        int encounterId = dto.EncounterId ?? await conn.ExecuteScalarAsync<int>(
            "SELECT TOP 1 Id FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = @EpisodeId ORDER BY EncounterNumber DESC",
            new { EpisodeId = episodeId });

        if (encounterId == 0)
            throw new InvalidOperationException("Cannot add diagnosis without an existing encounter.");

        var sql = @"
            INSERT INTO AncDiagnoses (EpisodeId, EncounterId, IcdCode, Dhis2Code, HmisCode, Description, DiagnosisType, DiagnosisDate, RegisteredByUserId, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@EpisodeId, @EncounterId, @IcdCode, @Dhis2Code, @HmisCode, @Description, @DiagnosisType, @DiagnosisDate, @UserId, GETDATE());";

        int id = await conn.ExecuteScalarAsync<int>(sql, new
        {
            EpisodeId = episodeId,
            EncounterId = encounterId,
            dto.IcdCode,
            dto.Dhis2Code,
            dto.HmisCode,
            dto.Description,
            DiagnosisType = dto.DiagnosisType ?? "Primary",
            dto.DiagnosisDate,
            UserId = userId
        });

        dto.Id = id;
        return dto;
    }

    public async Task<AncAppointmentDto> ScheduleAppointmentAsync(int episodeId, AncAppointmentDto dto, int userId)
    {
        using var conn = _dbFactory.CreateConnection();
        var patientId = await conn.ExecuteScalarAsync<int>(
            "SELECT PatientId FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE Id = @EpisodeId",
            new { EpisodeId = episodeId });

        var sql = @"
            INSERT INTO AncAppointments (EpisodeId, EncounterId, PatientId, DoctorId, AppointmentDate, Status, Remarks, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@EpisodeId, @EncounterId, @PatientId, @DoctorId, @AppointmentDate, @Status, @Remarks, GETDATE());";

        int id = await conn.ExecuteScalarAsync<int>(sql, new
        {
            EpisodeId = episodeId,
            dto.EncounterId,
            PatientId = patientId,
            DoctorId = dto.DoctorId,
            dto.AppointmentDate,
            Status = dto.Status ?? "Scheduled",
            dto.Remarks
        });

        dto.Id = id;
        return dto;
    }

    public async Task<bool> ApproveOverdueReviewAsync(int episodeId, string reviewNotes, int userId)
    {
        using var conn = _dbFactory.CreateConnection();

        await conn.ExecuteAsync(@"
            UPDATE AncPregnancyEpisodes SET
                OverdueReviewApprovedBy = @UserId,
                OverdueReviewApprovedAt = GETDATE(),
                OverdueReviewNotes = @Notes,
                RequiresOverdueReview = 0
            WHERE Id = @EpisodeId",
            new { EpisodeId = episodeId, UserId = userId, Notes = reviewNotes });

        await conn.ExecuteAsync(@"
            INSERT INTO AncAuditLogs (EpisodeId, Action, ChangedByUserId, ChangedAt, DetailsJson)
            VALUES (@EpisodeId, 'APPROVE_OVERDUE_REVIEW', @UserId, GETDATE(), @DetailsJson)",
            new
            {
                EpisodeId = episodeId,
                UserId = userId,
                DetailsJson = JsonSerializer.Serialize(new { reviewNotes, ApprovedAt = DateTime.UtcNow })
            });

        return true;
    }

    public async Task<AncOutcomeDto> CloseEpisodeAsync(AncCloseEpisodeRequest request, int userId)
    {
        using var conn = _dbFactory.CreateConnection();
        if (conn.State != ConnectionState.Open) conn.Open();
        using var tran = conn.BeginTransaction();

        try
        {
            var ep = await conn.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE Id = @EpisodeId",
                new { request.EpisodeId }, tran);

            if (ep == null)
                throw new KeyNotFoundException($"Episode {request.EpisodeId} not found.");

            if (ep.Status == "Closed")
                throw new InvalidOperationException("Episode is already closed.");

            var insertOutcomeSql = @"
                INSERT INTO AncPregnancyOutcomes (
                    EpisodeId, DeliveryDate, DeliveryTime, DeliveryPlace, ModeOfDelivery, PregnancyOutcome,
                    NumberOfBabies, MaternalOutcome, MaternalComplications, Baby1Outcome, Baby1Sex,
                    Baby1WeightGrams, Baby1Apgar1, Baby1Apgar5, Baby2Outcome, Baby2Sex, Baby2WeightGrams,
                    Baby2Apgar1, Baby2Apgar5, DeliveryRemarks, ReferralInfo, ClosingClinicianId, CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @EpisodeId, @DeliveryDate, @DeliveryTime, @DeliveryPlace, @ModeOfDelivery, @PregnancyOutcome,
                    @NumberOfBabies, @MaternalOutcome, @MaternalComplications, @Baby1Outcome, @Baby1Sex,
                    @Baby1WeightGrams, @Baby1Apgar1, @Baby1Apgar5, @Baby2Outcome, @Baby2Sex, @Baby2WeightGrams,
                    @Baby2Apgar1, @Baby2Apgar5, @DeliveryRemarks, @ReferralInfo, @UserId, GETDATE()
                );";

            int outcomeId = await conn.ExecuteScalarAsync<int>(insertOutcomeSql, new
            {
                request.EpisodeId,
                request.DeliveryDate,
                request.DeliveryTime,
                request.DeliveryPlace,
                request.ModeOfDelivery,
                PregnancyOutcome = request.PregnancyOutcomeType,
                request.NumberOfBabies,
                request.MaternalOutcome,
                request.MaternalComplications,
                request.Baby1Outcome,
                request.Baby1Sex,
                request.Baby1WeightGrams,
                request.Baby1Apgar1,
                request.Baby1Apgar5,
                request.Baby2Outcome,
                request.Baby2Sex,
                request.Baby2WeightGrams,
                request.Baby2Apgar1,
                request.Baby2Apgar5,
                request.DeliveryRemarks,
                request.ReferralInfo,
                UserId = userId
            }, tran);

            // Close episode
            await conn.ExecuteAsync(@"
                UPDATE AncPregnancyEpisodes SET
                    Status = 'Closed',
                    ClosedAt = GETDATE(),
                    ClosedByUserId = @UserId,
                    ClosureReason = @ClosureReason,
                    ClosureRemarks = @ClosureRemarks,
                    UpdatedAt = GETDATE()
                WHERE Id = @EpisodeId",
                new
                {
                    request.EpisodeId,
                    UserId = userId,
                    request.ClosureReason,
                    ClosureRemarks = request.DeliveryRemarks
                }, tran);

            // Add to previous pregnancies table
            var prevCount = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM AncPreviousPregnancies WITH (NOLOCK) WHERE PatientId = @PatientId",
                new { PatientId = (int)ep.PatientId }, tran) + 1;

            var gaDelivery = CalculateGestationalAgeDynamic((object)ep, request.DeliveryDate).weeks;

            await conn.ExecuteAsync(@"
                INSERT INTO AncPreviousPregnancies (
                    PatientId, EpisodeId, PregnancyNumber, BirthYear, DateOfBirth, ModeOfDelivery,
                    GestationalAgeWeeks, DeliveryPlace, BirthWeightGrams, DeliveryOutcome, Complications, Remarks, CreatedAt
                )
                VALUES (
                    @PatientId, @EpisodeId, @PregnancyNumber, @BirthYear, @DateOfBirth, @ModeOfDelivery,
                    @GestationalAgeWeeks, @DeliveryPlace, @BirthWeightGrams, @DeliveryOutcome, @Complications, @Remarks, GETDATE()
                );",
                new
                {
                    PatientId = (int)ep.PatientId,
                    request.EpisodeId,
                    PregnancyNumber = prevCount,
                    BirthYear = request.DeliveryDate.Year,
                    DateOfBirth = request.DeliveryDate,
                    request.ModeOfDelivery,
                    GestationalAgeWeeks = gaDelivery,
                    request.DeliveryPlace,
                    BirthWeightGrams = request.Baby1WeightGrams,
                    DeliveryOutcome = request.PregnancyOutcomeType,
                    Complications = request.MaternalComplications,
                    Remarks = request.DeliveryRemarks
                }, tran);

            await conn.ExecuteAsync(@"
                INSERT INTO AncAuditLogs (EpisodeId, Action, ChangedByUserId, ChangedAt, DetailsJson)
                VALUES (@EpisodeId, 'CLOSE_EPISODE_DELIVERY', @UserId, GETDATE(), @DetailsJson)",
                new
                {
                    request.EpisodeId,
                    UserId = userId,
                    DetailsJson = JsonSerializer.Serialize(new { request.DeliveryDate, request.ModeOfDelivery, request.PregnancyOutcomeType, request.ClosureReason })
                }, tran);

            var username = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT Username FROM Users WITH (NOLOCK) WHERE Id = @UserId", new { UserId = userId }, tran);

            tran.Commit();

            return new AncOutcomeDto
            {
                Id = outcomeId,
                EpisodeId = request.EpisodeId,
                DeliveryDate = request.DeliveryDate,
                DeliveryTimeFormatted = request.DeliveryTime.ToString(@"hh\:mm"),
                DeliveryPlace = request.DeliveryPlace,
                ModeOfDelivery = request.ModeOfDelivery,
                PregnancyOutcomeType = request.PregnancyOutcomeType,
                NumberOfBabies = request.NumberOfBabies,
                MaternalOutcome = request.MaternalOutcome,
                MaternalComplications = request.MaternalComplications,
                Baby1Outcome = request.Baby1Outcome,
                Baby1Sex = request.Baby1Sex,
                Baby1WeightGrams = request.Baby1WeightGrams,
                Baby1Apgar1 = request.Baby1Apgar1,
                Baby1Apgar5 = request.Baby1Apgar5,
                Baby2Outcome = request.Baby2Outcome,
                Baby2Sex = request.Baby2Sex,
                Baby2WeightGrams = request.Baby2WeightGrams,
                Baby2Apgar1 = request.Baby2Apgar1,
                Baby2Apgar5 = request.Baby2Apgar5,
                DeliveryRemarks = request.DeliveryRemarks,
                ReferralInfo = request.ReferralInfo,
                ClosingClinicianName = username ?? "Clinician",
                CreatedAt = DateTime.UtcNow
            };
        }
        catch
        {
            tran.Rollback();
            throw;
        }
    }

    public async Task<List<AncEpisodeSummaryDto>> GetPatientPregnancyHistoryAsync(int patientId, int tenantId = 1)
    {
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT ep.*,
                   (SELECT COUNT(1) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id AND IsDraft = 0) AS CompletedVisitsCount,
                   (SELECT MAX(EncounterDate) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id) AS LastVisitDate,
                   (SELECT MIN(AppointmentDate) FROM AncAppointments WITH (NOLOCK) WHERE EpisodeId = ep.Id AND Status = 'Scheduled' AND AppointmentDate >= CAST(GETDATE() AS DATE)) AS NextAppointmentDate,
                   u.Username AS ClosedByName
            FROM AncPregnancyEpisodes ep WITH (NOLOCK)
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = ep.ClosedByUserId
            WHERE ep.PatientId = @PatientId AND ep.TenantId = @TenantId
            ORDER BY ep.RegistrationDate DESC";

        var rows = (await conn.QueryAsync<dynamic>(sql, new { PatientId = patientId, TenantId = tenantId })).ToList();
        var list = new List<AncEpisodeSummaryDto>();
        foreach (var r in rows)
        {
            DateTime targetDate = r.ClosedAt != null ? (DateTime)r.ClosedAt : DateTime.UtcNow.Date;
            list.Add(await MapEpisodeSummaryFromRowAsync(conn, r, targetDate));
        }
        return list;
    }

    public async Task<AncWorkspaceDetailDto> UpdateDatingAsync(int episodeId, string datingMethod, DateTime? lmp, DateTime? usDate, int? usWeeks, int? usDays, int userId)
    {
        using var conn = _dbFactory.CreateConnection();

        DateTime? eddLmp = null;
        DateTime? eddUs = null;
        DateTime establishedEdd;

        var ep = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT * FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE Id = @Id", new { Id = episodeId });

        if (ep == null)
            throw new KeyNotFoundException($"Episode {episodeId} not found.");

        if (lmp.HasValue)
        {
            eddLmp = lmp.Value.AddDays(280);
        }
        else if (ep.LmpDate != null)
        {
            lmp = (DateTime)ep.LmpDate;
            eddLmp = lmp.Value.AddDays(280);
        }

        if (usDate.HasValue && usWeeks.HasValue)
        {
            var usDaysTotal = (usWeeks.Value * 7) + (usDays ?? 0);
            var lmpEq = usDate.Value.AddDays(-usDaysTotal);
            eddUs = lmpEq.AddDays(280);
        }
        else if (ep.InitialUltrasoundDate != null && ep.EddUltrasound != null)
        {
            eddUs = (DateTime)ep.EddUltrasound;
        }

        if (datingMethod == "Ultrasound" && eddUs.HasValue)
        {
            establishedEdd = eddUs.Value;
        }
        else if (eddLmp.HasValue)
        {
            establishedEdd = eddLmp.Value;
        }
        else
        {
            establishedEdd = (DateTime)ep.EstablishedEdd;
        }

        await conn.ExecuteAsync(@"
            UPDATE AncPregnancyEpisodes SET
                ApprovedDatingMethod = @ApprovedDatingMethod,
                LmpDate = @LmpDate,
                EddLmp = @EddLmp,
                InitialUltrasoundDate = @InitialUltrasoundDate,
                EddUltrasound = @EddUltrasound,
                EstablishedEdd = @EstablishedEdd,
                UpdatedAt = GETDATE()
            WHERE Id = @Id",
            new
            {
                Id = episodeId,
                ApprovedDatingMethod = datingMethod,
                LmpDate = lmp,
                EddLmp = eddLmp,
                InitialUltrasoundDate = usDate ?? (DateTime?)ep.InitialUltrasoundDate,
                EddUltrasound = eddUs,
                EstablishedEdd = establishedEdd
            });

        await conn.ExecuteAsync(@"
            INSERT INTO AncAuditLogs (EpisodeId, Action, ChangedByUserId, ChangedAt, DetailsJson)
            VALUES (@EpisodeId, 'UPDATE_DATING_APPROVAL', @UserId, GETDATE(), @DetailsJson)",
            new
            {
                EpisodeId = episodeId,
                UserId = userId,
                DetailsJson = JsonSerializer.Serialize(new { datingMethod, EstablishedEdd = establishedEdd, eddLmp, eddUs })
            });

        return await GetWorkspaceDetailsAsync(episodeId, userId, true, (byte)ep.TenantId);
    }

    public async Task<AncWorkspaceDetailDto> UpdateEpisodeBaselineAsync(int episodeId, AncUpdateEpisodeBaselineRequest request, int userId, int tenantId = 1)
    {
        using var conn = _dbFactory.CreateConnection();
        if (conn.State != ConnectionState.Open) conn.Open();
        using var tran = conn.BeginTransaction();

        try
        {
            var ep = await conn.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE Id = @Id", new { Id = episodeId }, tran);

            if (ep == null)
                throw new KeyNotFoundException($"Episode {episodeId} not found.");

            DateTime? eddLmp = null;
            DateTime? eddUs = null;
            DateTime establishedEdd;

            if (request.LmpDate.HasValue)
            {
                eddLmp = request.LmpDate.Value.AddDays(280);
            }
            else if (ep.LmpDate != null)
            {
                eddLmp = ((DateTime)ep.LmpDate).AddDays(280);
            }

            if (request.InitialUltrasoundDate.HasValue && request.InitialGestationalWeeks.HasValue)
            {
                var usDaysTotal = (request.InitialGestationalWeeks.Value * 7) + (request.InitialGestationalDays ?? 0);
                var lmpEq = request.InitialUltrasoundDate.Value.AddDays(-usDaysTotal);
                eddUs = lmpEq.AddDays(280);
            }
            else if (ep.InitialUltrasoundDate != null && ep.EddUltrasound != null)
            {
                eddUs = (DateTime)ep.EddUltrasound;
            }

            if (request.ApprovedDatingMethod == "Ultrasound" && eddUs.HasValue)
            {
                establishedEdd = eddUs.Value;
            }
            else if (eddLmp.HasValue)
            {
                establishedEdd = eddLmp.Value;
            }
            else
            {
                establishedEdd = (DateTime)ep.EstablishedEdd;
            }

            await conn.ExecuteAsync(@"
                UPDATE AncPregnancyEpisodes SET
                    Gravidity = @Gravidity,
                    Parity = @Parity,
                    LmpDate = @LmpDate,
                    IsCycleRegular = @IsCycleRegular,
                    ApprovedDatingMethod = @ApprovedDatingMethod,
                    EddLmp = @EddLmp,
                    InitialUltrasoundDate = @InitialUltrasoundDate,
                    EddUltrasound = @EddUltrasound,
                    EstablishedEdd = @EstablishedEdd,
                    UpdatedAt = GETDATE()
                WHERE Id = @Id",
                new
                {
                    Id = episodeId,
                    request.Gravidity,
                    request.Parity,
                    request.LmpDate,
                    request.IsCycleRegular,
                    request.ApprovedDatingMethod,
                    EddLmp = eddLmp,
                    request.InitialUltrasoundDate,
                    EddUltrasound = eddUs,
                    EstablishedEdd = establishedEdd
                }, tran);

            if (request.PreviousPregnancies != null)
            {
                await conn.ExecuteAsync("DELETE FROM AncPreviousPregnancies WHERE EpisodeId = @EpisodeId", new { EpisodeId = episodeId }, tran);
                if (request.PreviousPregnancies.Count > 0)
                {
                    var insertPrevSql = @"
                        INSERT INTO AncPreviousPregnancies (
                            PatientId, EpisodeId, PregnancyNumber, BirthYear, DateOfBirth, ModeOfDelivery,
                            GestationalAgeWeeks, DeliveryPlace, BirthWeightGrams, DeliveryOutcome, Complications, Remarks, CreatedAt
                        )
                        VALUES (
                            @PatientId, @EpisodeId, @PregnancyNumber, @BirthYear, @DateOfBirth, @ModeOfDelivery,
                            @GestationalAgeWeeks, @DeliveryPlace, @BirthWeightGrams, @DeliveryOutcome, @Complications, @Remarks, GETDATE()
                        );";

                    foreach (var prev in request.PreviousPregnancies)
                    {
                        await conn.ExecuteAsync(insertPrevSql, new
                        {
                            PatientId = (int)ep.PatientId,
                            EpisodeId = episodeId,
                            prev.PregnancyNumber,
                            prev.BirthYear,
                            prev.DateOfBirth,
                            prev.ModeOfDelivery,
                            prev.GestationalAgeWeeks,
                            prev.DeliveryPlace,
                            prev.BirthWeightGrams,
                            prev.DeliveryOutcome,
                            prev.Complications,
                            prev.Remarks
                        }, tran);
                    }
                }
            }

            await conn.ExecuteAsync(@"
                INSERT INTO AncAuditLogs (EpisodeId, Action, ChangedByUserId, ChangedAt, DetailsJson)
                VALUES (@EpisodeId, 'UPDATE_REGISTRATION_BASELINE', @UserId, GETDATE(), @DetailsJson)",
                new
                {
                    EpisodeId = episodeId,
                    UserId = userId,
                    DetailsJson = JsonSerializer.Serialize(new
                    {
                        request.Gravidity,
                        request.Parity,
                        request.LmpDate,
                        request.ApprovedDatingMethod,
                        EstablishedEdd = establishedEdd
                    })
                }, tran);

            tran.Commit();

            return await GetWorkspaceDetailsAsync(episodeId, userId, true, (byte)ep.TenantId);
        }
        catch
        {
            tran.Rollback();
            throw;
        }
    }

    public async Task<AncDashboardDto> GetDashboardAsync(int tenantId = 1)
    {
        using var conn = _dbFactory.CreateConnection();
        var today = DateTime.UtcNow.Date;
        var startOfMonth = new DateTime(today.Year, today.Month, 1);

        var activeSql = @"
            SELECT ep.*,
                   (SELECT COUNT(1) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id AND IsDraft = 0) AS CompletedVisitsCount,
                   (SELECT MAX(EncounterDate) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id) AS LastVisitDate,
                   (SELECT MIN(AppointmentDate) FROM AncAppointments WITH (NOLOCK) WHERE EpisodeId = ep.Id AND Status = 'Scheduled' AND AppointmentDate >= CAST(GETDATE() AS DATE)) AS NextAppointmentDate
            FROM AncPregnancyEpisodes ep WITH (NOLOCK)
            WHERE ep.TenantId = @TenantId AND ep.Status = 'Active'";

        var activeRows = (await conn.QueryAsync<dynamic>(activeSql, new { TenantId = tenantId })).ToList();
        var summaries = new List<AncEpisodeSummaryDto>();
        foreach (var r in activeRows)
        {
            summaries.Add(await MapEpisodeSummaryFromRowAsync(conn, r, today));
        }

        var followUpsToday = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM AncEncounters WITH (NOLOCK) WHERE EncounterDate = @Today", new { Today = today });

        var newThisMonth = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE TenantId = @TenantId AND RegistrationDate >= @StartOfMonth",
            new { TenantId = tenantId, StartOfMonth = startOfMonth });

        var closedThisMonth = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE TenantId = @TenantId AND Status = 'Closed' AND ClosedAt >= @StartOfMonth",
            new { TenantId = tenantId, StartOfMonth = startOfMonth });

        var apptSql = @"
            SELECT TOP 15 a.*,
                   p.FirstName + ' ' + p.LastName AS PatientName,
                   p.MRN AS PatientMrn,
                   ISNULL(s.Title + ' ' + s.FirstName + ' ' + s.LastName, ISNULL(s.FirstName + ' ' + s.LastName, 'Doctor')) AS DoctorName
            FROM AncAppointments a WITH (NOLOCK)
            JOIN Patients p WITH (NOLOCK) ON p.Id = a.PatientId
            LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = a.DoctorId
            LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
            WHERE a.Status = 'Scheduled' AND a.AppointmentDate >= @Today
            ORDER BY a.AppointmentDate ASC";

        var upcomingAppts = (await conn.QueryAsync<AncAppointmentDto>(apptSql, new { Today = today })).ToList();

        var overdueApptsCount = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM AncAppointments WITH (NOLOCK) WHERE Status = 'Scheduled' AND AppointmentDate < @Today",
            new { Today = today });

        var urgentAlerts = summaries
            .SelectMany(s => s.ClinicalAlerts.Where(a => a.Severity == "critical" || a.Severity == "warning"))
            .Take(12)
            .ToList();

        return new AncDashboardDto
        {
            TotalActivePregnancies = summaries.Count,
            NewRegistrationsThisMonth = newThisMonth,
            FollowUpVisitsToday = followUpsToday,
            UpcomingAppointmentsCount = upcomingAppts.Count,
            OverdueAppointmentsCount = overdueApptsCount,
            FirstTrimesterCount = summaries.Count(s => s.CurrentTrimester == 1),
            SecondTrimesterCount = summaries.Count(s => s.CurrentTrimester == 2),
            ThirdTrimesterCount = summaries.Count(s => s.CurrentTrimester == 3),
            OverdueWarning42wCount = summaries.Count(s => s.IsOverdueWarning && !s.RequiresOverdueReview),
            RequiringReview43wCount = summaries.Count(s => s.RequiresOverdueReview),
            HighRiskCount = summaries.Count(s => s.ClinicalAlerts.Any(a => a.Severity == "critical")),
            ClosedThisMonthCount = closedThisMonth,
            ActivePregnanciesList = summaries,
            TodayWorklist = upcomingAppts,
            UrgentAlerts = urgentAlerts
        };
    }

    public async Task<AncReportResultDto> GenerateReportAsync(AncReportFilterRequest filter, int tenantId = 1)
    {
        using var conn = _dbFactory.CreateConnection();
        var type = filter.ReportType ?? "ACTIVE_REGISTER";
        var result = new AncReportResultDto();

        switch (type)
        {
            case "ACTIVE_REGISTER":
            default:
                result.ReportTitle = "Active Antenatal Care Pregnancy Register";
                result.Headers = new List<string> { "Episode #", "Patient MRN", "Patient Name", "Age", "Gravida/Para", "LMP", "EDD", "Dating Source", "Gestational Age", "Trimester", "Visits", "Next Visit" };
                var activeRows = (await conn.QueryAsync<dynamic>(@"
                    SELECT ep.*, p.MRN, p.FirstName, p.LastName, p.DateOfBirth,
                           (SELECT COUNT(1) FROM AncEncounters WITH (NOLOCK) WHERE EpisodeId = ep.Id AND IsDraft = 0) AS CompletedVisitsCount,
                           (SELECT MIN(AppointmentDate) FROM AncAppointments WITH (NOLOCK) WHERE EpisodeId = ep.Id AND Status = 'Scheduled' AND AppointmentDate >= CAST(GETDATE() AS DATE)) AS NextAppointmentDate
                    FROM AncPregnancyEpisodes ep WITH (NOLOCK)
                    JOIN Patients p WITH (NOLOCK) ON p.Id = ep.PatientId
                    WHERE ep.TenantId = @TenantId AND ep.Status = 'Active'
                    ORDER BY ep.EstablishedEdd ASC", new { TenantId = tenantId })).ToList();

                result.TotalRecords = activeRows.Count;
                foreach (var ep in activeRows)
                {
                    var sum = await MapEpisodeSummaryFromRowAsync(conn, ep, DateTime.UtcNow.Date);
                    DateTime dob = ep.DateOfBirth;
                    int age = DateTime.UtcNow.Year - dob.Year;
                    DateTime? nxt = ep.NextAppointmentDate;

                    result.Rows.Add(new Dictionary<string, object?>
                    {
                        ["EpisodeId"] = (int)ep.Id,
                        ["PatientId"] = (int)ep.PatientId,
                        ["Episode #"] = ep.EpisodeNumber,
                        ["Patient MRN"] = ep.MRN,
                        ["Patient Name"] = $"{ep.FirstName} {ep.LastName}".Trim(),
                        ["Age"] = age,
                        ["Gravida/Para"] = $"G{ep.Gravidity} P{ep.Parity}",
                        ["LMP"] = ep.LmpDate != null ? ((DateTime)ep.LmpDate).ToString("yyyy-MM-dd") : "N/A",
                        ["EDD"] = ((DateTime)ep.EstablishedEdd).ToString("yyyy-MM-dd"),
                        ["Dating Source"] = ep.ApprovedDatingMethod,
                        ["Gestational Age"] = sum.GestationalAgeFormatted,
                        ["Trimester"] = sum.TrimesterFormatted,
                        ["Visits"] = ep.CompletedVisitsCount,
                        ["Next Visit"] = nxt?.ToString("yyyy-MM-dd") ?? "None scheduled"
                    });
                }
                result.SummaryMetrics["Total Active Pregnancies"] = activeRows.Count;
                break;

            case "FIRST_REGISTRATION":
                result.ReportTitle = "ANC First Registration Report";
                result.Headers = new List<string> { "Reg Date", "Episode #", "MRN", "Patient Name", "Age", "Gravida/Para", "LMP", "Established EDD", "Cycle", "Approved Dating", "Prior Deliveries" };
                var start = filter.StartDate ?? DateTime.UtcNow.AddMonths(-1);
                var end = filter.EndDate ?? DateTime.UtcNow;

                var regRows = (await conn.QueryAsync<dynamic>(@"
                    SELECT ep.*, p.MRN, p.FirstName, p.LastName, p.DateOfBirth,
                           (SELECT COUNT(1) FROM AncPreviousPregnancies WITH (NOLOCK) WHERE PatientId = ep.PatientId) AS PriorDeliveriesCount
                    FROM AncPregnancyEpisodes ep WITH (NOLOCK)
                    JOIN Patients p WITH (NOLOCK) ON p.Id = ep.PatientId
                    WHERE ep.TenantId = @TenantId AND ep.RegistrationDate >= @Start AND ep.RegistrationDate <= @End
                    ORDER BY ep.RegistrationDate DESC", new { TenantId = tenantId, Start = start, End = end })).ToList();

                result.TotalRecords = regRows.Count;
                foreach (var r in regRows)
                {
                    DateTime dob = r.DateOfBirth;
                    int age = DateTime.UtcNow.Year - dob.Year;
                    int priorCount = (int)(r.PriorDeliveriesCount ?? 0);
                    bool isCycleReg = r.IsCycleRegular != null && (bool)r.IsCycleRegular;

                    result.Rows.Add(new Dictionary<string, object?>
                    {
                        ["EpisodeId"] = (int)r.Id,
                        ["PatientId"] = (int)r.PatientId,
                        ["Reg Date"] = ((DateTime)r.RegistrationDate).ToString("yyyy-MM-dd"),
                        ["Episode #"] = r.EpisodeNumber,
                        ["MRN"] = r.MRN,
                        ["Patient Name"] = $"{r.FirstName} {r.LastName}".Trim(),
                        ["Age"] = age,
                        ["Gravida/Para"] = $"G{r.Gravidity} P{r.Parity}",
                        ["LMP"] = r.LmpDate != null ? ((DateTime)r.LmpDate).ToString("yyyy-MM-dd") : "N/A",
                        ["Established EDD"] = ((DateTime)r.EstablishedEdd).ToString("yyyy-MM-dd"),
                        ["Cycle"] = isCycleReg ? "Regular" : "Irregular",
                        ["Approved Dating"] = r.ApprovedDatingMethod,
                        ["Prior Deliveries"] = priorCount > 0 ? $"{priorCount} Recorded" : "None"
                    });
                }
                result.SummaryMetrics["Total Registrations"] = regRows.Count;
                break;

            case "FOLLOW_UP":
                result.ReportTitle = "ANC Follow-up Visits Report";
                result.Headers = new List<string> { "Visit Date", "Visit Code", "MRN", "Patient Name", "GA", "BP", "Weight", "FHR", "Doctor", "Status" };

                var encSql = @"
                    SELECT enc.*, ep.PatientId, p.MRN, p.FirstName, p.LastName,
                           ISNULL(s.Title + ' ' + s.FirstName + ' ' + s.LastName, ISNULL(s.FirstName + ' ' + s.LastName, 'Staff')) AS DoctorName
                    FROM AncEncounters enc WITH (NOLOCK)
                    JOIN AncPregnancyEpisodes ep WITH (NOLOCK) ON ep.Id = enc.EpisodeId
                    JOIN Patients p WITH (NOLOCK) ON p.Id = ep.PatientId
                    LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = enc.AttendingDoctorId
                    LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
                    WHERE (@Start IS NULL OR enc.EncounterDate >= @Start) AND (@End IS NULL OR enc.EncounterDate <= @End)
                    ORDER BY enc.EncounterDate DESC";

                var encs = (await conn.QueryAsync<dynamic>(encSql, new { Start = filter.StartDate, End = filter.EndDate })).ToList();
                result.TotalRecords = encs.Count;
                foreach (var enc in encs)
                {
                    result.Rows.Add(new Dictionary<string, object?>
                    {
                        ["EpisodeId"] = (int)enc.EpisodeId,
                        ["PatientId"] = (int)enc.PatientId,
                        ["Visit Date"] = ((DateTime)enc.EncounterDate).ToString("yyyy-MM-dd"),
                        ["Visit Code"] = enc.VisitCode,
                        ["MRN"] = enc.MRN,
                        ["Patient Name"] = $"{enc.FirstName} {enc.LastName}".Trim(),
                        ["GA"] = $"{enc.GestationalAgeWeeks}w {enc.GestationalAgeDays}d",
                        ["BP"] = enc.SystolicBp != null ? $"{enc.SystolicBp}/{enc.DiastolicBp}" : "N/A",
                        ["Weight"] = enc.Weight != null ? ((decimal)enc.Weight).ToString("0.0") : "N/A",
                        ["FHR"] = enc.FetalHeartRate != null ? enc.FetalHeartRate.ToString() : "N/A",
                        ["Doctor"] = enc.DoctorName,
                        ["Status"] = (bool)enc.IsDraft ? "Draft" : "Finalized"
                    });
                }
                result.SummaryMetrics["Total Follow-ups Documented"] = encs.Count;
                break;

            case "TRIMESTER_DISTRIBUTION":
                result.ReportTitle = "Gestational Age & Trimester Distribution Report";
                result.Headers = new List<string> { "Trimester", "Gestational Week Range", "Active Pregnancies", "Percentage of Active" };
                var allActiveRows = (await conn.QueryAsync<dynamic>(@"
                    SELECT * FROM AncPregnancyEpisodes WITH (NOLOCK) 
                    WHERE TenantId = @TenantId AND Status = 'Active'", new { TenantId = tenantId })).ToList();

                int t1 = 0, t2 = 0, t3 = 0;
                foreach (var row in allActiveRows)
                {
                    var ga = CalculateGestationalAgeDynamic((object)row, DateTime.UtcNow.Date);
                    var w = ga.weeks;
                    if (w < 14) t1++;
                    else if (w < 28) t2++;
                    else t3++;
                }
                int total = Math.Max(1, allActiveRows.Count);

                result.TotalRecords = 3;
                result.Rows.Add(new Dictionary<string, object?> { ["Trimester"] = "First Trimester", ["Gestational Week Range"] = "1 - 13 Weeks", ["Active Pregnancies"] = t1, ["Percentage of Active"] = $"{(t1 * 100.0 / total):F1}%" });
                result.Rows.Add(new Dictionary<string, object?> { ["Trimester"] = "Second Trimester", ["Gestational Week Range"] = "14 - 27 Weeks", ["Active Pregnancies"] = t2, ["Percentage of Active"] = $"{(t2 * 100.0 / total):F1}%" });
                result.Rows.Add(new Dictionary<string, object?> { ["Trimester"] = "Third Trimester", ["Gestational Week Range"] = "28+ Weeks", ["Active Pregnancies"] = t3, ["Percentage of Active"] = $"{(t3 * 100.0 / total):F1}%" });
                result.SummaryMetrics["Total Active Pregnancies"] = allActiveRows.Count;
                break;

            case "PREGNANCY_OUTCOME":
                result.ReportTitle = "Pregnancy Delivery and Outcome Report";
                result.Headers = new List<string> { "Delivery Date", "Episode #", "MRN", "Mother Name", "Delivery Place", "Delivery Mode", "Outcome", "Maternal Outcome", "Baby Wt (g)" };

                var outcomes = (await conn.QueryAsync<dynamic>(@"
                    SELECT oc.*, ep.EpisodeNumber, p.MRN, p.FirstName, p.LastName
                    FROM AncPregnancyOutcomes oc WITH (NOLOCK)
                    JOIN AncPregnancyEpisodes ep WITH (NOLOCK) ON ep.Id = oc.EpisodeId
                    JOIN Patients p WITH (NOLOCK) ON p.Id = ep.PatientId
                    ORDER BY oc.DeliveryDate DESC")).ToList();

                result.TotalRecords = outcomes.Count;
                foreach (var oc in outcomes)
                {
                    result.Rows.Add(new Dictionary<string, object?>
                    {
                        ["Delivery Date"] = ((DateTime)oc.DeliveryDate).ToString("yyyy-MM-dd"),
                        ["Episode #"] = oc.EpisodeNumber,
                        ["MRN"] = oc.MRN,
                        ["Mother Name"] = $"{oc.FirstName} {oc.LastName}".Trim(),
                        ["Delivery Place"] = oc.DeliveryPlace,
                        ["Delivery Mode"] = oc.ModeOfDelivery,
                        ["Outcome"] = oc.PregnancyOutcome,
                        ["Maternal Outcome"] = oc.MaternalOutcome,
                        ["Baby Wt (g)"] = oc.Baby1WeightGrams.ToString()
                    });
                }
                result.SummaryMetrics["Total Deliveries Documented"] = outcomes.Count;
                break;

            case "MISSED_APPOINTMENTS":
                result.ReportTitle = "Missed ANC Appointments Worklist";
                result.Headers = new List<string> { "Scheduled Date", "Days Overdue", "Episode #", "Patient MRN", "Patient Name", "Phone", "Doctor", "Remarks" };

                var missed = (await conn.QueryAsync<dynamic>(@"
                    SELECT a.*, ep.EpisodeNumber, p.MRN, p.FirstName, p.LastName, p.PrimaryPhone,
                           ISNULL(s.FirstName + ' ' + s.LastName, 'Staff') AS DoctorName
                    FROM AncAppointments a WITH (NOLOCK)
                    JOIN AncPregnancyEpisodes ep WITH (NOLOCK) ON ep.Id = a.EpisodeId
                    JOIN Patients p WITH (NOLOCK) ON p.Id = a.PatientId
                    LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = a.DoctorId
                    LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
                    WHERE a.Status = 'Scheduled' AND a.AppointmentDate < CAST(GETDATE() AS DATE)
                    ORDER BY a.AppointmentDate ASC")).ToList();

                result.TotalRecords = missed.Count;
                foreach (var m in missed)
                {
                    DateTime apptDt = m.AppointmentDate;
                    var daysOverdue = (DateTime.UtcNow.Date - apptDt.Date).Days;
                    result.Rows.Add(new Dictionary<string, object?>
                    {
                        ["Scheduled Date"] = apptDt.ToString("yyyy-MM-dd"),
                        ["Days Overdue"] = $"{daysOverdue} days",
                        ["Episode #"] = m.EpisodeNumber,
                        ["Patient MRN"] = m.MRN,
                        ["Patient Name"] = $"{m.FirstName} {m.LastName}".Trim(),
                        ["Phone"] = m.PrimaryPhone ?? "",
                        ["Doctor"] = m.DoctorName,
                        ["Remarks"] = m.Remarks ?? "Standard ANC Follow-up"
                    });
                }
                result.SummaryMetrics["Total Defaulted Appointments"] = missed.Count;
                break;

            case "HIGH_RISK_REGISTER":
                result.ReportTitle = "High-Risk Antenatal Care Register";
                result.Headers = new List<string> { "Episode #", "Patient MRN", "Patient Name", "Age", "GA", "High-Risk Indicators", "Latest BP", "Doctor" };

                var allActiveForRisk = (await conn.QueryAsync<dynamic>(@"
                    SELECT ep.*, p.MRN, p.FirstName, p.LastName, p.DateOfBirth,
                           (SELECT TOP 1 CONCAT(SystolicBp, '/', DiastolicBp) FROM AncEncounters WHERE EpisodeId = ep.Id AND SystolicBp IS NOT NULL ORDER BY EncounterDate DESC, Id DESC) AS LatestBp,
                           (SELECT TOP 1 SystolicBp FROM AncEncounters WHERE EpisodeId = ep.Id AND SystolicBp IS NOT NULL ORDER BY EncounterDate DESC, Id DESC) AS LatestSystolic,
                           (SELECT TOP 1 DiastolicBp FROM AncEncounters WHERE EpisodeId = ep.Id AND DiastolicBp IS NOT NULL ORDER BY EncounterDate DESC, Id DESC) AS LatestDiastolic,
                           (SELECT TOP 1 DangerSignsJson FROM AncEncounters WHERE EpisodeId = ep.Id AND DangerSignsJson IS NOT NULL AND DangerSignsJson <> '[]' ORDER BY EncounterDate DESC, Id DESC) AS LatestDangerSigns,
                           ISNULL((SELECT TOP 1 ISNULL(s.FirstName + ' ' + s.LastName, 'Staff') FROM AncEncounters enc JOIN Doctors doc ON doc.Id = enc.AttendingDoctorId JOIN Staff s ON s.Id = doc.StaffId WHERE enc.EpisodeId = ep.Id ORDER BY enc.Id DESC), 'Attending Clinician') AS DoctorName
                    FROM AncPregnancyEpisodes ep WITH (NOLOCK)
                    JOIN Patients p WITH (NOLOCK) ON p.Id = ep.PatientId
                    WHERE ep.TenantId = @TenantId AND ep.Status = 'Active'", new { TenantId = tenantId })).ToList();

                int highRiskCount = 0;
                foreach (var r in allActiveForRisk)
                {
                    var ga = CalculateGestationalAgeDynamic((object)r, DateTime.UtcNow.Date);
                    DateTime dob = r.DateOfBirth;
                    int age = DateTime.UtcNow.Year - dob.Year;
                    if (DateTime.UtcNow.DayOfYear < dob.DayOfYear) age--;

                    var riskFlags = new List<string>();
                    if (age < 18) riskFlags.Add("Adolescent (<18)");
                    if (age >= 35) riskFlags.Add("Advanced Maternal Age (35+)");
                    if (r.LatestSystolic != null && (int)r.LatestSystolic >= 140 || r.LatestDiastolic != null && (int)r.LatestDiastolic >= 90)
                        riskFlags.Add($"Hypertension ({r.LatestBp})");
                    if (ga.weeks >= 42)
                        riskFlags.Add($"Overdue ({ga.weeks}w)");
                    if (r.LatestDangerSigns != null && !string.IsNullOrWhiteSpace((string)r.LatestDangerSigns) && (string)r.LatestDangerSigns != "[]")
                        riskFlags.Add("Active Danger Signs");
                    if ((int)r.Gravidity >= 5)
                        riskFlags.Add($"Grand Multipara (G{r.Gravidity})");

                    if (riskFlags.Count > 0)
                    {
                        highRiskCount++;
                        result.Rows.Add(new Dictionary<string, object?>
                        {
                            ["EpisodeId"] = (int)r.Id,
                            ["PatientId"] = (int)r.PatientId,
                            ["Episode #"] = r.EpisodeNumber,
                            ["Patient MRN"] = r.MRN,
                            ["Patient Name"] = $"{r.FirstName} {r.LastName}".Trim(),
                            ["Age"] = age.ToString(),
                            ["GA"] = $"{ga.weeks}w {ga.days}d",
                            ["High-Risk Indicators"] = string.Join("; ", riskFlags),
                            ["Latest BP"] = r.LatestBp ?? "Normal",
                            ["Doctor"] = r.DoctorName
                        });
                    }
                }
                result.TotalRecords = result.Rows.Count;
                result.SummaryMetrics["High-Risk Pregnancies Flagged"] = highRiskCount;
                break;

            case "OVERDUE_PREGNANCIES":
                result.ReportTitle = "Overdue Pregnancies (>= 42 Weeks) & Review Threshold Register";
                result.Headers = new List<string> { "Episode #", "Patient MRN", "Patient Name", "Established EDD", "Gestational Age", "Classification", "Action Required", "Doctor" };

                var allActiveForOverdue = (await conn.QueryAsync<dynamic>(@"
                    SELECT ep.*, p.MRN, p.FirstName, p.LastName,
                           ISNULL((SELECT TOP 1 ISNULL(s.FirstName + ' ' + s.LastName, 'Staff') FROM AncEncounters enc JOIN Doctors doc ON doc.Id = enc.AttendingDoctorId JOIN Staff s ON s.Id = doc.StaffId WHERE enc.EpisodeId = ep.Id ORDER BY enc.Id DESC), 'Attending Clinician') AS DoctorName
                    FROM AncPregnancyEpisodes ep WITH (NOLOCK)
                    JOIN Patients p WITH (NOLOCK) ON p.Id = ep.PatientId
                    WHERE ep.TenantId = @TenantId AND ep.Status = 'Active'", new { TenantId = tenantId })).ToList();

                int c42 = 0, c43 = 0;
                foreach (var ep in allActiveForOverdue)
                {
                    var ga = CalculateGestationalAgeDynamic((object)ep, DateTime.UtcNow.Date);
                    if (ga.weeks >= 42)
                    {
                        bool is43 = ga.weeks >= 43;
                        if (is43) c43++; else c42++;

                        result.Rows.Add(new Dictionary<string, object?>
                        {
                            ["EpisodeId"] = (int)ep.Id,
                            ["PatientId"] = (int)ep.PatientId,
                            ["Episode #"] = ep.EpisodeNumber,
                            ["Patient MRN"] = ep.MRN,
                            ["Patient Name"] = $"{ep.FirstName} {ep.LastName}".Trim(),
                            ["Established EDD"] = ((DateTime)ep.EstablishedEdd).ToString("yyyy-MM-dd"),
                            ["Gestational Age"] = $"{ga.weeks}w {ga.days}d",
                            ["Classification"] = is43 ? ">= 43w Review Threshold" : "42w Post-term Warning",
                            ["Action Required"] = is43 ? "Authorized Clinical Review & Induction/Closure" : "Biophysical Profile & Urgent Monitoring",
                            ["Doctor"] = ep.DoctorName
                        });
                    }
                }
                result.TotalRecords = result.Rows.Count;
                result.SummaryMetrics["42-Week Overdue (Warning)"] = c42;
                result.SummaryMetrics["43-Week Overdue (Review Required)"] = c43;
                break;

            case "LAB_COMPLETION":
                result.ReportTitle = "ANC Laboratory & Investigation Completion Report";
                result.Headers = new List<string> { "Test Date", "Episode #", "Patient MRN", "Patient Name", "Test Type", "Status", "Result", "Reference Range", "Abnormal?" };

                var labs = (await conn.QueryAsync<dynamic>(@"
                    SELECT l.*, ep.EpisodeNumber, p.MRN, p.FirstName, p.LastName
                    FROM AncLaboratoryExaminations l WITH (NOLOCK)
                    JOIN AncPregnancyEpisodes ep WITH (NOLOCK) ON ep.Id = l.EpisodeId
                    JOIN Patients p WITH (NOLOCK) ON p.Id = ep.PatientId
                    ORDER BY l.TestDate DESC, l.Id DESC")).ToList();

                int comp = 0, pend = 0, abn = 0;
                result.TotalRecords = labs.Count;
                foreach (var lb in labs)
                {
                    string status = lb.Status ?? "Requested";
                    bool isAbn = (bool)lb.IsAbnormal;
                    if (status == "Completed") comp++; else pend++;
                    if (isAbn) abn++;

                    result.Rows.Add(new Dictionary<string, object?>
                    {
                        ["Test Date"] = ((DateTime)lb.TestDate).ToString("yyyy-MM-dd"),
                        ["Episode #"] = lb.EpisodeNumber,
                        ["Patient MRN"] = lb.MRN,
                        ["Patient Name"] = $"{lb.FirstName} {lb.LastName}".Trim(),
                        ["Test Type"] = lb.TestType,
                        ["Status"] = status,
                        ["Result"] = lb.ResultValue != null ? $"{lb.ResultValue} {lb.Unit ?? ""}".Trim() : "Pending",
                        ["Reference Range"] = lb.ReferenceRange ?? "-",
                        ["Abnormal?"] = isAbn ? "YES (Abnormal)" : "No"
                    });
                }
                result.SummaryMetrics["Total Labs Ordered"] = labs.Count;
                result.SummaryMetrics["Completed"] = comp;
                result.SummaryMetrics["Pending"] = pend;
                result.SummaryMetrics["Abnormal Findings"] = abn;
                break;

            case "PMTCT_HIV":
                result.ReportTitle = "PMTCT / HIV Maternal Care Summary Report";
                result.Headers = new List<string> { "Episode #", "Patient MRN", "Maternal Code", "Partner Code", "HIV Test Status", "Maternal Result", "Partner Result", "Linked to ART", "Staging", "CD4" };

                var pmtcts = (await conn.QueryAsync<dynamic>(@"
                    SELECT pm.*, ep.EpisodeNumber, p.MRN
                    FROM AncPmtctRecords pm WITH (NOLOCK)
                    JOIN AncPregnancyEpisodes ep WITH (NOLOCK) ON ep.Id = pm.EpisodeId
                    JOIN Patients p WITH (NOLOCK) ON p.Id = ep.PatientId
                    ORDER BY pm.UpdatedAt DESC")).ToList();

                int tested = 0, reactive = 0, linked = 0;
                result.TotalRecords = pmtcts.Count;
                foreach (var pm in pmtcts)
                {
                    string res = pm.HivTestResult ?? "Not Tested";
                    if (res != "Not Tested" && !string.IsNullOrWhiteSpace(res)) tested++;
                    if (res == "Reactive" || res == "Positive") reactive++;
                    if ((bool)pm.LinkedToArt) linked++;

                    result.Rows.Add(new Dictionary<string, object?>
                    {
                        ["Episode #"] = pm.EpisodeNumber,
                        ["Patient MRN"] = pm.MRN,
                        ["Maternal Code"] = pm.MotherConfidentialCode ?? "N/A",
                        ["Partner Code"] = pm.PartnerConfidentialCode ?? "N/A",
                        ["HIV Test Status"] = pm.HivTested ?? "Offered",
                        ["Maternal Result"] = res,
                        ["Partner Result"] = pm.PartnerHivResult ?? "Unknown",
                        ["Linked to ART"] = (bool)pm.LinkedToArt ? "Yes (Linked)" : "No",
                        ["Staging"] = pm.WhoClinicalStaging ?? "-",
                        ["CD4"] = pm.Cd4Count != null ? pm.Cd4Count.ToString() : "-"
                    });
                }
                result.SummaryMetrics["Total PMTCT Records"] = pmtcts.Count;
                result.SummaryMetrics["Tested for HIV"] = tested;
                result.SummaryMetrics["Reactive / Positive"] = reactive;
                result.SummaryMetrics["Linked to ART"] = linked;
                break;

            case "CLINICIAN_WORKLOAD":
                result.ReportTitle = "Doctor & Clinician ANC Workload & Productivity Report";
                result.Headers = new List<string> { "Clinician Name", "Department", "Registrations Owned", "Encounters Conducted", "Deliveries Recorded" };

                var workload = (await conn.QueryAsync<dynamic>(@"
                    SELECT ISNULL(s.FirstName + ' ' + s.LastName, 'Unassigned') AS ClinicianName,
                           ISNULL(d.Specialization, 'Maternity / ANC') AS Department,
                           (SELECT COUNT(DISTINCT enc.EpisodeId) FROM AncEncounters enc WHERE enc.AttendingDoctorId = d.Id) AS RegistrationsCount,
                           (SELECT COUNT(1) FROM AncEncounters WHERE AttendingDoctorId = d.Id) AS EncountersCount,
                           (SELECT COUNT(1) FROM AncPregnancyOutcomes WHERE ClosingClinicianId = d.StaffId) AS DeliveriesCount
                    FROM Doctors d WITH (NOLOCK)
                    JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
                    GROUP BY s.FirstName, s.LastName, d.Specialization, d.Id, d.StaffId
                    ORDER BY EncountersCount DESC")).ToList();

                result.TotalRecords = workload.Count;
                foreach (var w in workload)
                {
                    result.Rows.Add(new Dictionary<string, object?>
                    {
                        ["Clinician Name"] = w.ClinicianName,
                        ["Department"] = w.Department,
                        ["Registrations Owned"] = Convert.ToInt32(w.RegistrationsCount),
                        ["Encounters Conducted"] = Convert.ToInt32(w.EncountersCount),
                        ["Deliveries Recorded"] = Convert.ToInt32(w.DeliveriesCount)
                    });
                }
                result.SummaryMetrics["Active Clinicians Documenting ANC"] = workload.Count;
                break;

            case "CONTINUITY_COHORT":
                result.ReportTitle = "ANC Continuity of Care & Visit Cohort Report";
                result.Headers = new List<string> { "Visit Cohort Milestone", "Patient Count", "% of Active Episodes", "Target Completion Rate" };

                var totalActive = await conn.ExecuteScalarAsync<int>(@"
                    SELECT COUNT(1) FROM AncPregnancyEpisodes WITH (NOLOCK) WHERE TenantId = @TenantId AND Status = 'Active'", new { TenantId = tenantId });
                totalActive = Math.Max(1, totalActive);

                var visitCounts = (await conn.QueryAsync<int>(@"
                    SELECT COUNT(enc.Id) 
                    FROM AncPregnancyEpisodes ep WITH (NOLOCK)
                    LEFT JOIN AncEncounters enc WITH (NOLOCK) ON enc.EpisodeId = ep.Id AND enc.IsDraft = 0
                    WHERE ep.TenantId = @TenantId AND ep.Status = 'Active'
                    GROUP BY ep.Id", new { TenantId = tenantId })).ToList();

                int v1 = visitCounts.Count(c => c >= 1);
                int v2 = visitCounts.Count(c => c >= 2);
                int v3 = visitCounts.Count(c => c >= 3);
                int v4 = visitCounts.Count(c => c >= 4);

                result.TotalRecords = 4;
                result.Rows.Add(new Dictionary<string, object?> { ["Visit Cohort Milestone"] = "ANC 1 (First Contact / Registration)", ["Patient Count"] = v1, ["% of Active Episodes"] = $"{(v1 * 100.0 / totalActive):F1}%", ["Target Completion Rate"] = "100%" });
                result.Rows.Add(new Dictionary<string, object?> { ["Visit Cohort Milestone"] = "ANC 2 (Second Contact, ~20w)", ["Patient Count"] = v2, ["% of Active Episodes"] = $"{(v2 * 100.0 / totalActive):F1}%", ["Target Completion Rate"] = "90%" });
                result.Rows.Add(new Dictionary<string, object?> { ["Visit Cohort Milestone"] = "ANC 3 (Third Contact, ~28w)", ["Patient Count"] = v3, ["% of Active Episodes"] = $"{(v3 * 100.0 / totalActive):F1}%", ["Target Completion Rate"] = "80%" });
                result.Rows.Add(new Dictionary<string, object?> { ["Visit Cohort Milestone"] = "ANC 4+ (Fourth Contact or More)", ["Patient Count"] = v4, ["% of Active Episodes"] = $"{(v4 * 100.0 / totalActive):F1}%", ["Target Completion Rate"] = "75%" });

                result.SummaryMetrics["Cohort Active Total"] = totalActive;
                result.SummaryMetrics["Achieved 4+ Visits"] = v4;
                break;
        }

        return result;
    }

    // --- INTERNAL HELPERS ---
    private static (int weeks, int days) CalculateGestationalAgeDynamic(object epObj, DateTime targetDate)
    {
        dynamic ep = epObj;
        DateTime referenceLmpDate;
        string approvedMethod = (string)ep.ApprovedDatingMethod;
        DateTime? initUsDate = ep.InitialUltrasoundDate != null ? (DateTime?)ep.InitialUltrasoundDate : null;
        DateTime establishedEdd = (DateTime)ep.EstablishedEdd;
        DateTime? lmp = ep.LmpDate != null ? (DateTime?)ep.LmpDate : null;
        int gaInitWeeks = ep.InitialGestationalWeeks is int gw ? gw : 0;
        int gaInitDays = ep.InitialGestationalDays is int gd ? gd : 0;

        if (approvedMethod == "Ultrasound" && initUsDate.HasValue)
        {
            var usDays = (gaInitWeeks * 7) + gaInitDays;
            referenceLmpDate = initUsDate.Value.AddDays(-usDays);
        }
        else if (lmp.HasValue)
        {
            referenceLmpDate = lmp.Value;
        }
        else
        {
            referenceLmpDate = establishedEdd.AddDays(-280);
        }

        var totalDays = (targetDate.Date - referenceLmpDate.Date).Days;
        if (totalDays < 0) totalDays = 0;

        return (totalDays / 7, totalDays % 7);
    }

    private async Task<AncEpisodeSummaryDto> MapEpisodeSummaryFromRowAsync(IDbConnection conn, dynamic ep, DateTime targetDate)
    {
        var ga = CalculateGestationalAgeDynamic((object)ep, targetDate);
        int weeks = ga.weeks;
        int days = ga.days;
        var trimester = (byte)(weeks < 14 ? 1 : (weeks < 28 ? 2 : 3));
        var progress = Math.Clamp((int)((((weeks * 7) + days) / 280.0) * 100), 0, 100);
        DateTime establishedEdd = ep.EstablishedEdd;
        var daysRemaining = (establishedEdd.Date - targetDate.Date).Days;

        var alerts = new List<AncClinicalAlertDto>();

        if (weeks >= 43)
        {
            alerts.Add(new AncClinicalAlertDto
            {
                Severity = "critical",
                Title = "43-Week Overdue Threshold Reached",
                Message = $"Gestational age is {weeks}w {days}d. Hospital protocol requires authorized clinical review and episode closure/induction protocol.",
                ActionPrompt = "Review & Close Episode"
            });
        }
        else if (weeks >= 42)
        {
            alerts.Add(new AncClinicalAlertDto
            {
                Severity = "warning",
                Title = "Overdue Pregnancy Warning (42 Weeks)",
                Message = $"Pregnancy has entered 42 completed weeks ({weeks}w {days}d). Intensive biophysical profile & fetal monitoring recommended.",
                ActionPrompt = "Evaluate Fetal Well-being"
            });
        }

        // Check latest encounter BP and alerts
        var latestEnc = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT TOP 1 * FROM AncEncounters WITH (NOLOCK) 
            WHERE EpisodeId = @EpisodeId 
            ORDER BY EncounterNumber DESC", new { EpisodeId = (int)ep.Id });

        if (latestEnc != null)
        {
            int? sys = latestEnc.SystolicBp;
            int? dia = latestEnc.DiastolicBp;
            if (sys >= 160 || dia >= 110)
            {
                alerts.Add(new AncClinicalAlertDto
                {
                    Severity = "critical",
                    Title = "Severe Hypertension",
                    Message = $"Latest BP is {sys}/{dia} mmHg. High risk of preeclampsia/eclampsia.",
                    ActionPrompt = "Initiate Antihypertensive / MgSO4 protocol"
                });
            }
            else if (sys >= 140 || dia >= 90)
            {
                alerts.Add(new AncClinicalAlertDto
                {
                    Severity = "warning",
                    Title = "Elevated Blood Pressure",
                    Message = $"Latest BP is {sys}/{dia} mmHg.",
                    ActionPrompt = "Monitor Urinalysis for Proteinuria"
                });
            }

            string? dsJson = latestEnc.DangerSignsJson;
            if (!string.IsNullOrEmpty(dsJson) && dsJson != "[]")
            {
                alerts.Add(new AncClinicalAlertDto
                {
                    Severity = "critical",
                    Title = "Active Obstetric Danger Signs",
                    Message = "Patient has reported active danger signs during previous assessment.",
                    ActionPrompt = "Immediate Clinical Evaluation"
                });
            }
        }

        bool requiresReview = (weeks >= 43) || (bool)ep.RequiresOverdueReview;

        return new AncEpisodeSummaryDto
        {
            Id = ep.Id,
            PatientId = ep.PatientId,
            EpisodeNumber = ep.EpisodeNumber,
            RegistrationDate = ep.RegistrationDate,
            Gravidity = ep.Gravidity,
            Parity = ep.Parity,
            LmpDate = ep.LmpDate,
            IsCycleRegular = ep.IsCycleRegular,
            EddLmp = ep.EddLmp,
            InitialUltrasoundDate = ep.InitialUltrasoundDate,
            EddUltrasound = ep.EddUltrasound,
            ApprovedDatingMethod = ep.ApprovedDatingMethod,
            EstablishedEdd = establishedEdd,
            CurrentGestationalWeeks = weeks,
            CurrentGestationalDays = days,
            CurrentTrimester = trimester,
            ProgressPercentage = progress,
            DaysRemaining = daysRemaining,
            IsOverdueWarning = weeks >= 42,
            RequiresOverdueReview = requiresReview,
            Status = ep.Status,
            CompletedVisitsCount = ep.CompletedVisitsCount is int cv ? cv : 0,
            LastVisitDate = ep.LastVisitDate,
            NextAppointmentDate = ep.NextAppointmentDate,
            ClosureReason = ep.ClosureReason,
            ClosedAt = ep.ClosedAt,
            ClosedByName = ep.ClosedByName,
            ClinicalAlerts = alerts
        };
    }

    private AncEncounterDto MapEncounterDtoFromRow(dynamic enc)
    {
        var dangerSigns = new List<string>();
        string? dsJson = enc.DangerSignsJson;
        if (!string.IsNullOrEmpty(dsJson))
        {
            try { dangerSigns = JsonSerializer.Deserialize<List<string>>(dsJson) ?? new(); }
            catch { }
        }

        TimeSpan encTime = enc.EncounterTime is TimeSpan ts ? ts : TimeSpan.Zero;

        return new AncEncounterDto
        {
            Id = enc.Id,
            EpisodeId = enc.EpisodeId,
            EncounterNumber = enc.EncounterNumber,
            VisitCode = enc.VisitCode,
            EncounterDate = enc.EncounterDate,
            EncounterTimeFormatted = encTime.ToString(@"hh\:mm"),
            GestationalAgeWeeks = enc.GestationalAgeWeeks,
            GestationalAgeDays = enc.GestationalAgeDays,
            Trimester = (byte)enc.Trimester,
            Weight = enc.Weight,
            SystolicBp = enc.SystolicBp,
            DiastolicBp = enc.DiastolicBp,
            BpSite = enc.BpSite,
            PulseRate = enc.PulseRate,
            RespiratoryRate = enc.RespiratoryRate,
            Temperature = enc.Temperature,
            FundalHeight = enc.FundalHeight,
            FetalHeartRate = enc.FetalHeartRate,
            FetalMovement = enc.FetalMovement,
            FetalPresentation = enc.FetalPresentation,
            Anemia = enc.Anemia,
            Edema = enc.Edema,
            IronSupplementation = enc.IronSupplementation,
            TetanusVaccination = enc.TetanusVaccination,
            DangerSigns = dangerSigns,
            ClinicalNotes = enc.ClinicalNotes,
            Assessment = enc.Assessment,
            Plan = enc.Plan,
            LabResultRemarks = enc.LabResultRemarks,
            NextVisitDate = enc.NextVisitDate,
            AppointmentRemarks = enc.AppointmentRemarks,
            AttendingDoctorId = enc.AttendingDoctorId,
            AttendingDoctorName = enc.AttendingDoctorName ?? "Doctor",
            IsDraft = enc.IsDraft,
            FinalizedAt = enc.FinalizedAt,
            FinalizedByName = enc.FinalizedByName,
            IsCorrection = enc.IsCorrection,
            CorrectionReason = enc.CorrectionReason,
            CreatedAt = enc.CreatedAt
        };
    }
}
