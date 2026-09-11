namespace CMS.Shared.DTOs;

public class SpecializationDto
{
    public int Id { get; set; }
    public string SpecializationCode { get; set; } = string.Empty;
    public string SpecializationName { get; set; } = string.Empty;
    public string? Description { get; set; }

    public SpecializationDto() { }
    public SpecializationDto(int id, string specializationCode, string specializationName, string? description = null)
    {
        Id = id;
        SpecializationCode = specializationCode;
        SpecializationName = specializationName;
        Description = description;
    }
}

public class DoctorDto
{
    public int Id { get; set; }
    public int StaffId { get; set; }
    public string? StaffCode { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public int SpecializationId { get; set; }
    public string? SpecializationName { get; set; }
    public string? LicenseNumber { get; set; }
    public string? SubSpecialization { get; set; }
    public decimal? ConsultationFee { get; set; }
    public bool? IsAvailable { get; set; }

    public DoctorDto() { }
    public DoctorDto(int id, int staffId, string doctorName, int specializationId, string specializationName, string licenseNumber, string? consultationFee)
    {
        Id = id;
        StaffId = staffId;
        DoctorName = doctorName;
        SpecializationId = specializationId;
        SpecializationName = specializationName;
        LicenseNumber = licenseNumber;
        if (decimal.TryParse(consultationFee, out var fee)) ConsultationFee = fee;
    }
}

public record ConsultationRoomDto(int Id, string RoomNumber, string RoomName, string? Department, bool IsActive);


public record DoctorScheduleDto(int Id, int DoctorId, byte DayOfWeek, string StartTime, string EndTime, byte SlotMinutes, bool IsActive);
public record CreateScheduleDto(int DoctorId, byte DayOfWeek, TimeSpan StartTime, TimeSpan EndTime, byte SlotMinutes = 15);

public class EncounterDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public DateTime EncounterDate { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? HistoryOfIllness { get; set; }
    public string? PhysicalExam { get; set; }
    public string? Assessment { get; set; }
    public string? Plan { get; set; }
    public string? VitalSigns { get; set; }
    public bool IsFinalized { get; set; }
    public DateTime? FinalizedAt { get; set; }
    public List<DiagnosisDto> Diagnoses { get; set; } = new();

    public EncounterDto() { }
}

public class CreateEncounterDto
{
    public byte TenantId { get; set; } = 1;
    public int? AppointmentId { get; set; }
    public int PatientId { get; set; }
    public int DoctorId { get; set; } = 1;
    public string? ChiefComplaint { get; set; }
    public string? HistoryOfIllness { get; set; }
    public string? PhysicalExam { get; set; }
    public string? Assessment { get; set; }
    public string? Plan { get; set; }
    public string? SoapPlan { get => Plan; set => Plan = value; }
    public string? VitalSigns { get; set; }
    public int CreatedBy { get; set; } = 1;

    public CreateEncounterDto() { }
}

public record DiagnosisDto(int Id, int EncounterId, string DiagnosisCode, string DiagnosisText, int DiagnosisType);

public record CreateDiagnosisDto(int EncounterId, string DiagnosisCode, string DiagnosisText, int DiagnosisType = 1);

public class StaffDetailDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public int UserId { get; set; }
    public string? StaffCode { get; set; }
    public string? Title { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public short PrimaryRoleId { get; set; }
    public string? RoleName { get; set; }
    public string? Department { get; set; }
    public bool IsActive { get; set; }
    public int? DoctorId { get; set; }
    public string? LicenseNumber { get; set; }
    public short? SpecializationId { get; set; }
    public string? SpecializationName { get; set; }
    public string? SubSpecialization { get; set; }
    public decimal? ConsultationFee { get; set; }
}

public class UpdateStaffDto
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? Title { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public short? PrimaryRoleId { get; set; }
    public string? Department { get; set; }
    public bool IsActive { get; set; } = true;
    public string? LicenseNumber { get; set; }
    public short? SpecializationId { get; set; }
    public string? SubSpecialization { get; set; }
    public decimal? ConsultationFee { get; set; }
}
