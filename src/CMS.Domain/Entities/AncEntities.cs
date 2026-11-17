using System.ComponentModel.DataAnnotations.Schema;

namespace CMS.Domain.Entities;

public class AncPregnancyEpisode : BaseEntity
{
    public int PatientId { get; set; }
    public virtual Patient Patient { get; set; } = null!;

    public string EpisodeNumber { get; set; } = string.Empty;
    public DateTime RegistrationDate { get; set; } = DateTime.UtcNow.Date;
    public int Gravidity { get; set; } = 1;
    public int Parity { get; set; } = 0;
    public DateTime? LmpDate { get; set; }
    public bool IsCycleRegular { get; set; } = true;
    public DateTime? EddLmp { get; set; }
    public DateTime? InitialUltrasoundDate { get; set; }
    public DateTime? EddUltrasound { get; set; }
    public string ApprovedDatingMethod { get; set; } = "LMP"; // "LMP" or "Ultrasound"
    public DateTime EstablishedEdd { get; set; }
    public int InitialGestationalWeeks { get; set; }
    public int InitialGestationalDays { get; set; }
    public string Status { get; set; } = "Active"; // "Active", "Closed"
    public string? ClosureReason { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int? ClosedByUserId { get; set; }
    public string? ClosureRemarks { get; set; }
    public bool RequiresOverdueReview { get; set; } = false;
    public int? OverdueReviewApprovedBy { get; set; }
    public DateTime? OverdueReviewApprovedAt { get; set; }
    public string? OverdueReviewNotes { get; set; }
    public int CreatedByUserId { get; set; } = 1;

    // Navigation properties
    public virtual AncInitialAssessment? InitialAssessment { get; set; }
    public virtual ICollection<AncEncounter> Encounters { get; set; } = new List<AncEncounter>();
    public virtual ICollection<AncUltrasoundRecord> UltrasoundRecords { get; set; } = new List<AncUltrasoundRecord>();
    public virtual AncPmtctRecord? PmtctRecord { get; set; }
    public virtual ICollection<AncLaboratoryExamination> LaboratoryExaminations { get; set; } = new List<AncLaboratoryExamination>();
    public virtual ICollection<AncDiagnosis> Diagnoses { get; set; } = new List<AncDiagnosis>();
    public virtual ICollection<AncAppointment> Appointments { get; set; } = new List<AncAppointment>();
    public virtual AncPregnancyOutcome? Outcome { get; set; }
}

public class AncInitialAssessment
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public virtual AncPregnancyEpisode Episode { get; set; } = null!;

    public DateTime AssessmentDate { get; set; } = DateTime.UtcNow.Date;
    public int Abortions { get; set; } = 0;
    public int MolarPregnancies { get; set; } = 0;
    public int EctopicPregnancies { get; set; } = 0;
    public int LivingChildren { get; set; } = 0;
    public string? MedicalHistoryJson { get; set; }
    public string? GeneralExamJson { get; set; }
    public string? BaselineVitalsJson { get; set; }
    public string? BasicAncModelCriteriaJson { get; set; }
    public string? GeneralMedicalAssessmentJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int CreatedByUserId { get; set; } = 1;
}

public class AncPreviousPregnancy
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public virtual Patient Patient { get; set; } = null!;

    public int? EpisodeId { get; set; }
    public virtual AncPregnancyEpisode? Episode { get; set; }

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
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AncEncounter
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public virtual AncPregnancyEpisode Episode { get; set; } = null!;

    public int EncounterNumber { get; set; }
    public string VisitCode { get; set; } = string.Empty;
    public DateTime EncounterDate { get; set; } = DateTime.UtcNow.Date;
    public TimeSpan EncounterTime { get; set; } = DateTime.UtcNow.TimeOfDay;
    public int GestationalAgeWeeks { get; set; }
    public int GestationalAgeDays { get; set; }
    public byte Trimester { get; set; } = 1;
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
    public string? DangerSignsJson { get; set; }
    public string? ClinicalNotes { get; set; }
    public string? Assessment { get; set; }

    [Column("Plan")]
    public string? Plan { get; set; }

    public string? LabResultRemarks { get; set; }
    public DateTime? NextVisitDate { get; set; }
    public string? AppointmentRemarks { get; set; }
    public int AttendingDoctorId { get; set; }
    public virtual Doctor AttendingDoctor { get; set; } = null!;

    public bool IsDraft { get; set; } = false;
    public DateTime? FinalizedAt { get; set; }
    public int? FinalizedByUserId { get; set; }
    public bool IsCorrection { get; set; } = false;
    public string? CorrectionReason { get; set; }
    public int? OriginalEncounterId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int CreatedByUserId { get; set; } = 1;

    public virtual ICollection<AncDiagnosis> Diagnoses { get; set; } = new List<AncDiagnosis>();
}

public class AncUltrasoundRecord
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public virtual AncPregnancyEpisode Episode { get; set; } = null!;

    public int? EncounterId { get; set; }
    public virtual AncEncounter? Encounter { get; set; }

    public DateTime UltrasoundDate { get; set; } = DateTime.UtcNow.Date;
    public int GestationalAgeWeeks { get; set; }
    public int GestationalAgeDays { get; set; }
    public DateTime? EstimatedConceptionDate { get; set; }
    public DateTime? EddByUltrasound { get; set; }
    public byte Trimester { get; set; } = 1;
    public string? Presentation { get; set; }
    public string? PlacentalLocation { get; set; }
    public string? AmnioticFluid { get; set; }
    public int? FetalHeartRate { get; set; }
    public decimal? EstimatedFetalWeight { get; set; }
    public string? Findings { get; set; }
    public string? TakenBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int CreatedByUserId { get; set; } = 1;
}

public class AncPmtctRecord
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public virtual AncPregnancyEpisode Episode { get; set; } = null!;

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
    public bool LinkedToArt { get; set; } = false;
    public DateTime? MotherPmtctDate { get; set; }
    public DateTime? PartnerPmtctDate { get; set; }
    public string? MotherPmtctResult { get; set; }
    public string? PartnerPmtctResult { get; set; }
    public string? ConfidentialRemarks { get; set; }
    public int UpdatedByUserId { get; set; } = 1;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class AncLaboratoryExamination
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public virtual AncPregnancyEpisode Episode { get; set; } = null!;

    public int? EncounterId { get; set; }
    public virtual AncEncounter? Encounter { get; set; }

    public string TestType { get; set; } = string.Empty;
    public DateTime TestDate { get; set; } = DateTime.UtcNow.Date;
    public string? ResultValue { get; set; }
    public string? Unit { get; set; }
    public string? ReferenceRange { get; set; }
    public string Status { get; set; } = "Completed";
    public bool IsAbnormal { get; set; } = false;
    public string? Remarks { get; set; }
    public string? ConductedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AncDiagnosis
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public virtual AncPregnancyEpisode Episode { get; set; } = null!;

    public int EncounterId { get; set; }
    public virtual AncEncounter Encounter { get; set; } = null!;

    public string? IcdCode { get; set; }
    public string? Dhis2Code { get; set; }
    public string? HmisCode { get; set; }
    public string Description { get; set; } = string.Empty;
    public string DiagnosisType { get; set; } = "Primary";
    public DateTime DiagnosisDate { get; set; } = DateTime.UtcNow.Date;
    public int RegisteredByUserId { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AncAppointment
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public virtual AncPregnancyEpisode Episode { get; set; } = null!;

    public int? EncounterId { get; set; }
    public virtual AncEncounter? Encounter { get; set; }

    public int PatientId { get; set; }
    public virtual Patient Patient { get; set; } = null!;

    public int DoctorId { get; set; }
    public virtual Doctor Doctor { get; set; } = null!;

    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = "Scheduled";
    public string? Remarks { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AttendedAt { get; set; }
}

public class AncPregnancyOutcome
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public virtual AncPregnancyEpisode Episode { get; set; } = null!;

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
    public int ClosingClinicianId { get; set; }
    public virtual User ClosingClinician { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AncAuditLog
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public int? EncounterId { get; set; }
    public string Action { get; set; } = string.Empty;
    public int ChangedByUserId { get; set; } = 1;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? DetailsJson { get; set; }
    public string? IpAddress { get; set; }
}
