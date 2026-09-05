namespace CMS.Shared.DTOs;

public class TriageDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string MRN { get; set; } = string.Empty;
    public int? AppointmentId { get; set; }
    public long? QueueId { get; set; }
    public string? TokenNumber { get; set; }
    public string TriageCategory { get; set; } = "Yellow";
    public byte PriorityLevel { get; set; } = 3;
    public int? SystolicBP { get; set; }
    public int? DiastolicBP { get; set; }
    public int? HeartRate { get; set; }
    public int? RespiratoryRate { get; set; }
    public decimal? Temperature { get; set; }
    public decimal? OxygenSaturation { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? Bmi { get; set; }
    public decimal? BloodGlucose { get; set; }
    public byte? PainScale { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? NurseNotes { get; set; }
    public int? AssignedDoctorId { get; set; }
    public string? AssignedDoctorName { get; set; }
    public int? AssignedRoomId { get; set; }
    public string? AssignedRoomName { get; set; }
    public string Status { get; set; } = "WaitingTriage";
    public string? HoldReason { get; set; }
    public int? HoldDurationMin { get; set; }
    public int TriagedBy { get; set; } = 1;
    public DateTime TriagedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public TriageDto() { }
}

public class RecordTriageDto
{
    public int? TriageId { get; set; }
    public byte TenantId { get; set; } = 1;
    public int PatientId { get; set; }
    public int? AppointmentId { get; set; }
    public long? QueueId { get; set; }
    public string TriageCategory { get; set; } = "Yellow";
    public byte PriorityLevel { get; set; } = 3;
    public int? SystolicBP { get; set; }
    public int? DiastolicBP { get; set; }
    public int? HeartRate { get; set; }
    public int? RespiratoryRate { get; set; }
    public decimal? Temperature { get; set; }
    public decimal? OxygenSaturation { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? Bmi { get; set; }
    public decimal? BloodGlucose { get; set; }
    public byte? PainScale { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? NurseNotes { get; set; }
    public int TriagedBy { get; set; } = 1;
}

public class HoldAppointmentDto
{
    public byte TenantId { get; set; } = 1;
    public int TriageId { get; set; }
    public int? AppointmentId { get; set; }
    public string HoldReason { get; set; } = string.Empty;
    public int HoldDurationMin { get; set; } = 15;
}

public class ResumeAppointmentDto
{
    public byte TenantId { get; set; } = 1;
    public int TriageId { get; set; }
    public int? AppointmentId { get; set; }
}

public class AssignDoctorDto
{
    public byte TenantId { get; set; } = 1;
    public int TriageId { get; set; }
    public int? AppointmentId { get; set; }
    public int DoctorId { get; set; }
    public int? RoomId { get; set; }
}
