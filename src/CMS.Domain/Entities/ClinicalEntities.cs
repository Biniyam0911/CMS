using CMS.Domain.Enums;

namespace CMS.Domain.Entities;

public class Patient : BaseEntity
{
    public string MRN { get; set; } = string.Empty;
    public int? UserId { get; set; }
    public User? User { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string? NationalId { get; set; }
    public string? BloodGroup { get; set; }
    public MaritalStatus? MaritalStatus { get; set; }
    public string PrimaryPhone { get; set; } = string.Empty;
    public string? SecondaryPhone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? EmergencyName { get; set; }
    public string? EmergencyPhone { get; set; }
    public string? EmergencyRelation { get; set; }
    public string? InsuranceProvider { get; set; }
    public string? InsurancePolicyNo { get; set; }
    public string? Allergies { get; set; }
    public string? ChronicConditions { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Staff : BaseEntity
{
    public int UserId { get; set; }
    public User? User { get; set; }
    public string StaffCode { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public short PrimaryRoleId { get; set; }
    public string? Department { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Doctor
{
    public int Id { get; set; }
    public int StaffId { get; set; }
    public Staff? Staff { get; set; }
    public string LicenseNumber { get; set; } = string.Empty;
    public short SpecializationId { get; set; }
    public string? SubSpecialization { get; set; }
    public decimal? ConsultationFee { get; set; }
    public bool IsAvailable { get; set; } = true;
}

public class Appointment : BaseEntity
{
    public int PatientId { get; set; }
    public Patient? Patient { get; set; }
    public int DoctorId { get; set; }
    public Doctor? Doctor { get; set; }
    public DateTime SlotDateTime { get; set; }
    public byte DurationMinutes { get; set; } = 15;
    public AppointmentStatus StatusId { get; set; } = AppointmentStatus.Scheduled;
    public string? ReasonForVisit { get; set; }
    public string? Notes { get; set; }
    public int? BookedBy { get; set; }
    public bool ReminderSent { get; set; } = false;
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }
}

public class Encounter : BaseEntity
{
    public int? AppointmentId { get; set; }
    public int PatientId { get; set; }
    public Patient? Patient { get; set; }
    public int DoctorId { get; set; }
    public Doctor? Doctor { get; set; }
    public DateTime EncounterDate { get; set; } = DateTime.UtcNow.Date;
    public TimeSpan EncounterTime { get; set; } = DateTime.UtcNow.TimeOfDay;
    public string? ChiefComplaint { get; set; }
    public string? HistoryOfIllness { get; set; }
    public string? PhysicalExam { get; set; }
    public string? Assessment { get; set; }
    public string? Plan { get; set; }
    public string? VitalSigns { get; set; } // JSON format
    public bool IsFinalized { get; set; } = false;
    public DateTime? FinalizedAt { get; set; }
    public int CreatedBy { get; set; }
    public ICollection<Diagnosis> Diagnoses { get; set; } = new List<Diagnosis>();
}

public class Diagnosis
{
    public int Id { get; set; }
    public int EncounterId { get; set; }
    public string DiagnosisCode { get; set; } = string.Empty;
    public string DiagnosisText { get; set; } = string.Empty;
    public DiagnosisType DiagnosisType { get; set; } = DiagnosisType.Primary;
}
