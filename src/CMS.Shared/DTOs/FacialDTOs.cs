namespace CMS.Shared.DTOs;

public record FacialRegistrationCreateDto(
    string FirstName,
    string? MiddleName,
    string LastName,
    int? Age,
    string? Gender,
    string? Mobile,
    int? ServiceId,
    string ProcedureType,
    int Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal TotalPrice,
    int? DoctorId,
    string? DoctorName,
    bool IsPlc,
    bool IsOther,
    string? Notes
);

public class FacialRegistrationDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public string RegistrationNumber { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int? Age { get; set; }
    public string? Gender { get; set; }
    public string? Mobile { get; set; }
    public int? ServiceId { get; set; }
    public string ProcedureType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Discount { get; set; }
    public decimal TotalPrice { get; set; }
    public int? DoctorId { get; set; }
    public string? DoctorName { get; set; }
    public bool IsPlc { get; set; }
    public bool IsOther { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "Completed";
    public DateTime RegistrationDate { get; set; }
    public TimeSpan RegistrationTime { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class FacialReportSummaryDto
{
    public int TotalTransactions { get; set; }
    public decimal TotalGrossRevenue { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalNetRevenue { get; set; }
    public List<FacialProcedureBreakdownDto> Procedures { get; set; } = new();
}

public class FacialProcedureBreakdownDto
{
    public string ProcedureType { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal TotalRevenue { get; set; }
}
