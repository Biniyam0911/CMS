namespace CMS.Shared.DTOs;

// --- PATIENT & ACTIVE PREGNANCY CHECK ---
public class AncPatientCheckDto
{
    public int PatientId { get; set; }
    public string MRN { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int AgeYears { get; set; }
    public string Gender { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string PrimaryPhone { get; set; } = string.Empty;
    public string? BloodGroup { get; set; }
    public string? Address { get; set; }
    public string? Allergies { get; set; }
    public string? ChronicConditions { get; set; }

    public bool HasActivePregnancy { get; set; }
    public AncEpisodeSummaryDto? ActiveEpisode { get; set; }
    public List<AncEpisodeSummaryDto> HistoricalEpisodes { get; set; } = new();
}

// --- EPISODE SUMMARY ---
public class AncEpisodeSummaryDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string EpisodeNumber { get; set; } = string.Empty;
    public DateTime RegistrationDate { get; set; }
    public int Gravidity { get; set; }
    public int Parity { get; set; }
    public DateTime? LmpDate { get; set; }
    public bool IsCycleRegular { get; set; }
    public DateTime? EddLmp { get; set; }
    public DateTime? InitialUltrasoundDate { get; set; }
    public DateTime? EddUltrasound { get; set; }
    public string ApprovedDatingMethod { get; set; } = "LMP";
    public DateTime EstablishedEdd { get; set; }
    
    // Dynamic calculations as of target date (or today)
    public int CurrentGestationalWeeks { get; set; }
    public int CurrentGestationalDays { get; set; }
    public string GestationalAgeFormatted => $"{CurrentGestationalWeeks}w + {CurrentGestationalDays}d";
    public byte CurrentTrimester { get; set; }
    public string TrimesterFormatted => CurrentTrimester switch { 1 => "First Trimester", 2 => "Second Trimester", _ => "Third Trimester" };
    public int ProgressPercentage { get; set; }
    public int DaysRemaining { get; set; }
    public bool IsOverdueWarning { get; set; } // >= 42w
    public bool RequiresOverdueReview { get; set; } // >= 43w
    
    public string Status { get; set; } = "Active";
    public int CompletedVisitsCount { get; set; }
    public DateTime? LastVisitDate { get; set; }
    public DateTime? NextAppointmentDate { get; set; }
    public string? ClosureReason { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string? ClosedByName { get; set; }
    public List<AncClinicalAlertDto> ClinicalAlerts { get; set; } = new();
}

public class AncClinicalAlertDto
{
    public string Severity { get; set; } = "info"; // "info", "warning", "critical"
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? ActionPrompt { get; set; }
}

// --- NEW PREGNANCY REGISTRATION REQUEST ---
public class AncRegisterEpisodeRequest
{
    public int PatientId { get; set; }
    public DateTime RegistrationDate { get; set; } = DateTime.UtcNow.Date;
    public int Gravidity { get; set; } = 1;
    public int Parity { get; set; } = 0;
    public DateTime? LmpDate { get; set; }
    public bool IsCycleRegular { get; set; } = true;
    public DateTime? InitialUltrasoundDate { get; set; }
    public int? InitialUltrasoundWeeks { get; set; }
    public int? InitialUltrasoundDays { get; set; }
    public string ApprovedDatingMethod { get; set; } = "LMP"; // "LMP" or "Ultrasound"
    public DateTime? EstablishedEddOverride { get; set; }

    // Initial Assessment details
    public int Abortions { get; set; } = 0;
    public int MolarPregnancies { get; set; } = 0;
    public int EctopicPregnancies { get; set; } = 0;
    public int LivingChildren { get; set; } = 0;

    // Structured JSON or objects
    public AncMedicalHistoryDto? MedicalHistory { get; set; }
    public AncGeneralExamDto? GeneralExam { get; set; }
    public AncBaselineVitalsDto? BaselineVitals { get; set; }
    public AncBasicModelCriteriaDto? BasicModelCriteria { get; set; }
    public AncGeneralMedicalAssessmentDto? GeneralMedicalAssessment { get; set; }
    public List<AncPreviousPregnancyDto>? PreviousPregnancies { get; set; }
}

public class AncUpdateEpisodeBaselineRequest
{
    public int EpisodeId { get; set; }
    public int Gravidity { get; set; } = 1;
    public int Parity { get; set; } = 0;
    public DateTime? LmpDate { get; set; }
    public bool IsCycleRegular { get; set; } = true;
    public string ApprovedDatingMethod { get; set; } = "LMP";
    public DateTime? InitialUltrasoundDate { get; set; }
    public int? InitialGestationalWeeks { get; set; }
    public int? InitialGestationalDays { get; set; }
    public List<AncPreviousPregnancyDto>? PreviousPregnancies { get; set; }
}

public class AncMedicalHistoryDto
{
    public AncHistoryItem Diabetes { get; set; } = new();
    public AncHistoryItem Hypertension { get; set; } = new();
    public AncHistoryItem RenalDisease { get; set; } = new();
    public AncHistoryItem Tuberculosis { get; set; } = new();
    public AncHistoryItem DrugAllergy { get; set; } = new();
    public AncHistoryItem PastSurgicalHistory { get; set; } = new();
    public AncHistoryItem MotherMedicalHistory { get; set; } = new();
    public AncHistoryItem FatherMedicalHistory { get; set; } = new();
}

public class AncHistoryItem
{
    public string Status { get; set; } = "No"; // "Yes", "No", "Unknown"
    public string? Remarks { get; set; }
}

public class AncGeneralExamDto
{
    public string? Chest { get; set; }
    public string? Heart { get; set; }
    public string? Abdomen { get; set; }
    public string? VaginalExamination { get; set; }
    public string? GeneralFindings { get; set; }
    public string? HpNotes { get; set; }
    public string? AdditionalRemarks { get; set; }
}

public class AncBaselineVitalsDto
{
    public int? SystolicBp { get; set; }
    public int? DiastolicBp { get; set; }
    public string? BpSite { get; set; }
    public int? PulseRate { get; set; }
    public int? RespiratoryRate { get; set; }
    public decimal? Temperature { get; set; }
    public decimal? SpO2 { get; set; }
    public string? OxygenSupport { get; set; }
    public decimal? Weight { get; set; }
    public decimal? Height { get; set; }
    public decimal? Muac { get; set; } // Mid-Upper Arm Circumference
    public decimal? HeadCircumference { get; set; }
}

public class AncBasicModelCriteriaDto
{
    public AncHistoryItem HistoryOfStillbirth { get; set; } = new();
    public AncHistoryItem HistoryThreeOrMoreAbortions { get; set; } = new();
    public AncHistoryItem PreviousLowBirthWeight { get; set; } = new();
    public AncHistoryItem PreviousHighBirthWeight { get; set; } = new();
    public AncHistoryItem LastPregnancyComplications { get; set; } = new();
    public AncHistoryItem PreviousSurgery { get; set; } = new();
    public AncHistoryItem OtherRiskCriteria { get; set; } = new();
}

public class AncGeneralMedicalAssessmentDto
{
    public AncHistoryItem InsulinDependentDiabetes { get; set; } = new();
    public AncHistoryItem RenalDisease { get; set; } = new();
    public AncHistoryItem CardiacDisease { get; set; } = new();
    public AncHistoryItem KnownSubstanceAbuse { get; set; } = new();
    public AncHistoryItem OtherSevereConditions { get; set; } = new();
}

public class AncPreviousPregnancyDto
{
    public int Id { get; set; }
    public int PregnancyNumber { get; set; }
    public int? BirthYear { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? ModeOfDelivery { get; set; }
    public int? GestationalAgeWeeks { get; set; }
    public string? DeliveryPlace { get; set; }
    public decimal? BirthWeightGrams { get; set; }
    public string? DeliveryOutcome { get; set; }
    public string? Complications { get; set; }
    public string? Remarks { get; set; }
}

// --- ENCOUNTER (FOLLOW-UP) DTOs ---
public class AncEncounterDto
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public int EncounterNumber { get; set; }
    public string VisitCode { get; set; } = string.Empty;
    public DateTime EncounterDate { get; set; }
    public string EncounterTimeFormatted { get; set; } = string.Empty;
    public int GestationalAgeWeeks { get; set; }
    public int GestationalAgeDays { get; set; }
    public string GestationalAgeFormatted => $"{GestationalAgeWeeks}w + {GestationalAgeDays}d";
    public byte Trimester { get; set; }
    public decimal? Weight { get; set; }
    public int? SystolicBp { get; set; }
    public int? DiastolicBp { get; set; }
    public string? BloodPressureFormatted => SystolicBp.HasValue && DiastolicBp.HasValue ? $"{SystolicBp}/{DiastolicBp} mmHg" : null;
    public string? BpSite { get; set; }
    public int? PulseRate { get; set; }
    public int? RespiratoryRate { get; set; }
    public decimal? Temperature { get; set; }
    public decimal? FundalHeight { get; set; }
    public int? FetalHeartRate { get; set; }
    public string? FetalMovement { get; set; }
    public string? FetalPresentation { get; set; }
    public string? Anemia { get; set; }
    public string? Edema { get; set; }
    public string? IronSupplementation { get; set; }
    public string? TetanusVaccination { get; set; }
    public List<string> DangerSigns { get; set; } = new();
    public string? ClinicalNotes { get; set; }
    public string? Assessment { get; set; }
    public string? Plan { get; set; }
    public string? LabResultRemarks { get; set; }
    public DateTime? NextVisitDate { get; set; }
    public string? AppointmentRemarks { get; set; }
    public int AttendingDoctorId { get; set; }
    public string AttendingDoctorName { get; set; } = string.Empty;
    public bool IsDraft { get; set; }
    public DateTime? FinalizedAt { get; set; }
    public string? FinalizedByName { get; set; }
    public bool IsCorrection { get; set; }
    public string? CorrectionReason { get; set; }
    public List<AncDiagnosisDto> Diagnoses { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class AncCreateEncounterRequest
{
    public int EpisodeId { get; set; }
    public DateTime EncounterDate { get; set; } = DateTime.UtcNow.Date;
    public decimal? Weight { get; set; }
    public int? SystolicBp { get; set; }
    public int? DiastolicBp { get; set; }
    public string? BpSite { get; set; }
    public int? PulseRate { get; set; }
    public int? RespiratoryRate { get; set; }
    public decimal? Temperature { get; set; }
    public decimal? FundalHeight { get; set; }
    public int? FetalHeartRate { get; set; }
    public string? FetalMovement { get; set; }
    public string? FetalPresentation { get; set; }
    public string? Anemia { get; set; }
    public string? Edema { get; set; }
    public string? IronSupplementation { get; set; }
    public string? TetanusVaccination { get; set; }
    public List<string>? DangerSigns { get; set; }
    public string? ClinicalNotes { get; set; }
    public string? Assessment { get; set; }
    public string? Plan { get; set; }
    public string? LabResultRemarks { get; set; }
    public DateTime? NextVisitDate { get; set; }
    public string? AppointmentRemarks { get; set; }
    public int? AttendingDoctorId { get; set; }
    public bool IsDraft { get; set; } = false;
    public List<AncDiagnosisDto>? Diagnoses { get; set; }

    // Optional authorized correction fields
    public bool IsCorrection { get; set; } = false;
    public string? CorrectionReason { get; set; }
    public int? OriginalEncounterId { get; set; }
}

// --- SIDE-BY-SIDE CLINICAL COMPARISON DTO ---
public class AncEncounterComparisonDto
{
    public AncEncounterDto? PreviousEncounter { get; set; }
    public AncEncounterDto? CurrentEncounter { get; set; }
    public decimal? WeightDifference { get; set; }
    public decimal? FundalHeightDifference { get; set; }
    public int GestationalWeeksDifference { get; set; }
}

// --- ULTRASOUND DTO ---
public class AncUltrasoundDto
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public int? EncounterId { get; set; }
    public DateTime UltrasoundDate { get; set; }
    public int GestationalAgeWeeks { get; set; }
    public int GestationalAgeDays { get; set; }
    public string GestationalAgeFormatted => $"{GestationalAgeWeeks}w + {GestationalAgeDays}d";
    public DateTime? EstimatedConceptionDate { get; set; }
    public DateTime? EddByUltrasound { get; set; }
    public byte Trimester { get; set; }
    public string? Presentation { get; set; }
    public string? PlacentalLocation { get; set; }
    public string? AmnioticFluid { get; set; }
    public int? FetalHeartRate { get; set; }
    public decimal? EstimatedFetalWeight { get; set; }
    public string? Findings { get; set; }
    public string? TakenBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

// --- PMTCT & HIV DTO ---
public class AncPmtctDto
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public string? MotherConfidentialCode { get; set; }
    public string? PartnerConfidentialCode { get; set; }
    public string? MotherLetterCode { get; set; }
    public string? PartnerLetterCode { get; set; }
    public string? HivTested { get; set; }
    public string? HivTestResult { get; set; }
    public string? PartnerHivResult { get; set; }
    public int? Cd4Count { get; set; }
    public string? WhoClinicalStaging { get; set; }
    public string? NutritionalAssessment { get; set; }
    public string? InfantFeedingCounseling { get; set; }
    public bool LinkedToArt { get; set; }
    public DateTime? MotherPmtctDate { get; set; }
    public DateTime? PartnerPmtctDate { get; set; }
    public string? MotherPmtctResult { get; set; }
    public string? PartnerPmtctResult { get; set; }
    public string? ConfidentialRemarks { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsRestricted { get; set; } // If caller lacks permission
}

// --- LAB EXAMINATION DTO ---
public class AncLabExaminationDto
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public int? EncounterId { get; set; }
    public string TestType { get; set; } = string.Empty;
    public DateTime TestDate { get; set; }
    public string? ResultValue { get; set; }
    public string? Unit { get; set; }
    public string? ReferenceRange { get; set; }
    public string Status { get; set; } = "Completed"; // Requested, Pending, Completed
    public bool IsAbnormal { get; set; }
    public string? Remarks { get; set; }
    public string? ConductedBy { get; set; }
}

// --- DIAGNOSIS DTO ---
public class AncDiagnosisDto
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public int? EncounterId { get; set; }
    public string? IcdCode { get; set; }
    public string? Dhis2Code { get; set; }
    public string? HmisCode { get; set; }
    public string Description { get; set; } = string.Empty;
    public string DiagnosisType { get; set; } = "Primary";
    public DateTime DiagnosisDate { get; set; }
}

// --- APPOINTMENT DTO ---
public class AncAppointmentDto
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public int? EncounterId { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientMrn { get; set; } = string.Empty;
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = "Scheduled";
    public string? Remarks { get; set; }
    public bool IsOverdue => Status == "Scheduled" && AppointmentDate < DateTime.UtcNow.Date;
}

// --- PREGNANCY OUTCOME & CLOSURE REQUEST ---
public class AncCloseEpisodeRequest
{
    public int EpisodeId { get; set; }
    public DateTime DeliveryDate { get; set; } = DateTime.UtcNow.Date;
    public TimeSpan DeliveryTime { get; set; } = DateTime.UtcNow.TimeOfDay;
    public string DeliveryPlace { get; set; } = "Hospital Labor Ward";
    public string ModeOfDelivery { get; set; } = "Spontaneous Vaginal Delivery (SVD)";
    public string PregnancyOutcomeType { get; set; } = "Live Birth";
    public int NumberOfBabies { get; set; } = 1;
    public string MaternalOutcome { get; set; } = "Discharged alive in good condition";
    public string? MaternalComplications { get; set; }
    public string Baby1Outcome { get; set; } = "Alive & Healthy";
    public string Baby1Sex { get; set; } = "Female";
    public decimal Baby1WeightGrams { get; set; } = 3200;
    public int? Baby1Apgar1 { get; set; }
    public int? Baby1Apgar5 { get; set; }
    public string? Baby2Outcome { get; set; }
    public string? Baby2Sex { get; set; }
    public decimal? Baby2WeightGrams { get; set; }
    public int? Baby2Apgar1 { get; set; }
    public int? Baby2Apgar5 { get; set; }
    public string? DeliveryRemarks { get; set; }
    public string? ReferralInfo { get; set; }
    public string ClosureReason { get; set; } = "Delivery";
}

public class AncOutcomeDto
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public DateTime DeliveryDate { get; set; }
    public string DeliveryTimeFormatted { get; set; } = string.Empty;
    public string DeliveryPlace { get; set; } = string.Empty;
    public string ModeOfDelivery { get; set; } = string.Empty;
    public string PregnancyOutcomeType { get; set; } = string.Empty;
    public int NumberOfBabies { get; set; }
    public string MaternalOutcome { get; set; } = string.Empty;
    public string? MaternalComplications { get; set; }
    public string Baby1Outcome { get; set; } = string.Empty;
    public string Baby1Sex { get; set; } = string.Empty;
    public decimal Baby1WeightGrams { get; set; }
    public int? Baby1Apgar1 { get; set; }
    public int? Baby1Apgar5 { get; set; }
    public string? Baby2Outcome { get; set; }
    public string? Baby2Sex { get; set; }
    public decimal? Baby2WeightGrams { get; set; }
    public int? Baby2Apgar1 { get; set; }
    public int? Baby2Apgar5 { get; set; }
    public string? DeliveryRemarks { get; set; }
    public string? ReferralInfo { get; set; }
    public string ClosingClinicianName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

// --- FULL WORKSPACE DETAIL DTO ---
public class AncWorkspaceDetailDto
{
    public AncPatientCheckDto Patient { get; set; } = null!;
    public AncEpisodeSummaryDto Episode { get; set; } = null!;
    public AncInitialAssessmentDto? InitialAssessment { get; set; }
    public List<AncPreviousPregnancyDto> PreviousPregnancies { get; set; } = new();
    public List<AncEncounterDto> Encounters { get; set; } = new();
    public AncEncounterComparisonDto? LatestComparison { get; set; }
    public List<AncUltrasoundDto> Ultrasounds { get; set; } = new();
    public AncPmtctDto? Pmtct { get; set; }
    public List<AncLabExaminationDto> LabExaminations { get; set; } = new();
    public List<AncDiagnosisDto> Diagnoses { get; set; } = new();
    public List<AncAppointmentDto> Appointments { get; set; } = new();
    public AncOutcomeDto? Outcome { get; set; }
    public List<AncAuditLogDto> AuditLogs { get; set; } = new();
}

public class AncInitialAssessmentDto
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public DateTime AssessmentDate { get; set; }
    public int Abortions { get; set; }
    public int MolarPregnancies { get; set; }
    public int EctopicPregnancies { get; set; }
    public int LivingChildren { get; set; }
    public AncMedicalHistoryDto? MedicalHistory { get; set; }
    public AncGeneralExamDto? GeneralExam { get; set; }
    public AncBaselineVitalsDto? BaselineVitals { get; set; }
    public AncBasicModelCriteriaDto? BasicModelCriteria { get; set; }
    public AncGeneralMedicalAssessmentDto? GeneralMedicalAssessment { get; set; }
}

public class AncAuditLogDto
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string ChangedByName { get; set; } = string.Empty;
    public DateTime ChangedAt { get; set; }
    public string? DetailsJson { get; set; }
}

// --- DASHBOARD STATISTICS DTO ---
public class AncDashboardDto
{
    public int TotalActivePregnancies { get; set; }
    public int NewRegistrationsThisMonth { get; set; }
    public int FollowUpVisitsToday { get; set; }
    public int UpcomingAppointmentsCount { get; set; }
    public int OverdueAppointmentsCount { get; set; }
    public int FirstTrimesterCount { get; set; }
    public int SecondTrimesterCount { get; set; }
    public int ThirdTrimesterCount { get; set; }
    public int OverdueWarning42wCount { get; set; }
    public int RequiringReview43wCount { get; set; }
    public int HighRiskCount { get; set; }
    public int ClosedThisMonthCount { get; set; }
    public List<AncEpisodeSummaryDto> ActivePregnanciesList { get; set; } = new();
    public List<AncAppointmentDto> TodayWorklist { get; set; } = new();
    public List<AncClinicalAlertDto> UrgentAlerts { get; set; } = new();
}

// --- REPORT DTOs ---
public class AncReportFilterRequest
{
    public string? ReportType { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int? DoctorId { get; set; }
    public string? Status { get; set; }
    public byte? Trimester { get; set; }
    public string? SearchTerm { get; set; }
}

public class AncReportResultDto
{
    public string ReportTitle { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public int TotalRecords { get; set; }
    public List<string> Headers { get; set; } = new();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public Dictionary<string, object?> SummaryMetrics { get; set; } = new();
}
