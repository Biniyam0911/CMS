namespace CMS.Shared.DTOs;

public record ApiResponse<T>(bool Success, T? Data, string[]? Errors = null, object? Meta = null)
{
    public static ApiResponse<T> Ok(T data, object? meta = null) => new(true, data, null, meta);
    public static ApiResponse<T> Fail(params string[] errors) => new(false, default, errors);
}

public record LoginRequest(string Username, string Password, byte TenantId = 1);
public record LoginResponse(string AccessToken, string RefreshToken, int ExpiresInMinutes, UserDto User);
public record RefreshTokenRequest(string RefreshToken);

public record UserDto(int Id, byte TenantId, string Username, string Email, string FirstName, string LastName, string[] Roles, bool MfaEnabled, int? DoctorId = null, int? StaffId = null);

public class PatientDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public string MRN { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public int Gender { get; set; }
    public string? PrimaryPhone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? InsuranceProvider { get; set; }
    public decimal? InsuranceCopayPercent { get; set; }
    public string? Allergies { get; set; }
    public string? ChronicConditions { get; set; }
    public string? NationalId { get; set; }
    public string? BloodGroup { get; set; }
    public string? PhotoUrl { get; set; }
    public bool IsActive { get; set; } = true;

    public PatientDto() { }

    public PatientDto(
        int id, byte tenantId, string mrn, string firstName, string? middleName, string lastName,
        DateTime dateOfBirth, int gender, string? primaryPhone, string? email, string? address,
        string? insuranceProvider, string? allergies, bool isActive)
    {
        Id = id;
        TenantId = tenantId;
        MRN = mrn;
        FirstName = firstName;
        MiddleName = middleName;
        LastName = lastName;
        DateOfBirth = dateOfBirth;
        Gender = gender;
        PrimaryPhone = primaryPhone;
        Email = email;
        Address = address;
        InsuranceProvider = insuranceProvider;
        Allergies = allergies;
        IsActive = isActive;
    }
}

public record CreatePatientDto(
    byte TenantId, string? MRN, string FirstName, string? MiddleName, string LastName,
    DateTime DateOfBirth, int Gender, string PrimaryPhone, string? Email, string? Address,
    string? InsuranceProvider, decimal? InsuranceCopayPercent, string? Allergies, string? NationalId = null);

public record AppointmentDto(
    int Id, int PatientId, string PatientName, int DoctorId, string DoctorName,
    DateTime SlotDateTime, byte DurationMinutes, int StatusId, string StatusName, string? ReasonForVisit);

public record CreateAppointmentDto(
    byte TenantId, int PatientId, int DoctorId, DateTime SlotDateTime, byte DurationMinutes, string? ReasonForVisit);

public record LabTestCatalogDto(
    int Id, string TestCode, string TestName, string? Category, string? SampleType,
    int TurnaroundMinutes, decimal? NormalRangeLow, decimal? NormalRangeHigh, string? Unit, decimal? Price);

public record CreateLabOrderDto(
    byte TenantId, int PatientId, int? EncounterId, int OrderedBy, int Priority, string? ClinicalInfo, int[] TestIds);

public record EnterLabResultDto(
    int OrderItemId, decimal? NumericValue, string? TextValue, int EnteredBy, int SourceType = 1, string? RawMessage = null);

public record ReportExecuteRequest(
    string DataSource,
    List<ReportColumnDto> Columns,
    List<ReportFilterDto>? Filters = null,
    List<ReportSortDto>? Sorts = null,
    int PageNumber = 1,
    int PageSize = 50);

public record ReportColumnDto(string Field, string Alias, bool Visible = true);
public record ReportFilterDto(string Field, string Operator, string Value);
public record ReportSortDto(string Field, string Direction = "ASC");
