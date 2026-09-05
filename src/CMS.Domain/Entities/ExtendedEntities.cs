namespace CMS.Domain.Entities;

public class ServiceCounter : BaseEntity
{
    public string CounterNumber { get; set; } = string.Empty;
    public string CounterName { get; set; } = string.Empty;
    public string ServiceType { get; set; } = string.Empty;
    public int? CurrentStaffId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class PatientQueue : BaseEntity
{
    public string TokenNumber { get; set; } = string.Empty;
    public int PatientId { get; set; }
    public Patient? Patient { get; set; }
    public string ServiceType { get; set; } = string.Empty;
    public byte PriorityLevel { get; set; } = 2; // 1=Emergency, 2=Normal, 3=VIP
    public byte StatusId { get; set; } = 1; // 1=Waiting, 2=Called, 3=InProgress, 4=Completed, 5=NoShow, 6=Cancelled
    public int? AssignedCounterId { get; set; }
    public ServiceCounter? AssignedCounter { get; set; }
    public int? AssignedDoctorId { get; set; }
    public int? EstimatedWaitMin { get; set; } = 15;
    public DateTime CheckInTime { get; set; } = DateTime.UtcNow;
    public DateTime? CallTime { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public string? Notes { get; set; }
}

public class AppModule
{
    public int Id { get; set; }
    public string ModuleCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = "Clinical";
    public string? IconName { get; set; }
    public string Version { get; set; } = "1.0.0";
    public bool IsCore { get; set; } = false;
    public string? RequiredRoles { get; set; }
}

public class TenantModuleSetting
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public int ModuleId { get; set; }
    public AppModule? Module { get; set; }
    public bool IsEnabled { get; set; } = true;
    public string? CustomConfigJson { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class CdssDrugInteraction
{
    public int Id { get; set; }
    public string DrugA { get; set; } = string.Empty;
    public string DrugB { get; set; } = string.Empty;
    public string SeverityLevel { get; set; } = "Moderate"; // 'Major', 'Moderate', 'Minor'
    public string ClinicalWarning { get; set; } = string.Empty;
}

public class PatientProblemList
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string IcdCode { get; set; } = string.Empty;
    public string ProblemName { get; set; } = string.Empty;
    public DateTime? OnsetDate { get; set; }
    public string Status { get; set; } = "Active";
    public int RecordedBy { get; set; }
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
}

public class ConsultationRoom
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public string RoomName { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public bool IsAvailable { get; set; } = true;
}

public class LabChainOfCustody
{
    public int Id { get; set; }
    public int SampleId { get; set; }
    public string ActionStep { get; set; } = string.Empty;
    public int PerformedBy { get; set; }
    public DateTime ActionTime { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
}

public class NarcoticsDispenseLog
{
    public int Id { get; set; }
    public int PrescriptionId { get; set; }
    public int DrugId { get; set; }
    public int PatientId { get; set; }
    public int DoctorId { get; set; }
    public int PharmacistId { get; set; }
    public int Quantity { get; set; }
    public string SerialLogNo { get; set; } = string.Empty;
    public DateTime DispensedAt { get; set; } = DateTime.UtcNow;
}

public class NotificationItem
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public int? RecipientUserId { get; set; }
    public string? RecipientEmail { get; set; }
    public string? RecipientPhone { get; set; }
    public byte Channel { get; set; } = 1;
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public byte Priority { get; set; } = 2;
    public string NotificationType { get; set; } = string.Empty;
    public string? RefType { get; set; }
    public long? RefId { get; set; }
    public bool IsSent { get; set; } = false;
    public DateTime? SentAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ReportTemplate
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public string Name { get; set; } = string.Empty;
    public string SourceTable { get; set; } = string.Empty;
    public string ColumnsJson { get; set; } = "[]";
    public string? FilterJson { get; set; }
    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ReportDefinition
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "General";
    public string QuerySql { get; set; } = string.Empty;
    public bool IsSystem { get; set; } = true;
}

public class ApiKey
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public string Name { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = string.Empty;
    public string SecretHash { get; set; } = string.Empty;
    public int RateLimitRpm { get; set; } = 60;
    public DateTime ExpiresAt { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class WebhookSubscription
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public string EventName { get; set; } = string.Empty;
    public string TargetUrl { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ClinicSetting
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public string SettingKey { get; set; } = string.Empty;
    public string SettingValue { get; set; } = string.Empty;
    public string DataType { get; set; } = "String";
    public string Category { get; set; } = "General";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class DocumentTemplate
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public string DocumentType { get; set; } = string.Empty;
    public string TemplateName { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class IntegrationConfig
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public string ProviderCode { get; set; } = string.Empty;
    public string ProviderName { get; set; } = string.Empty;
    public string IntegrationType { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = false;
    public string CredentialsJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class MedicalCertificate
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public string CertificateNumber { get; set; } = string.Empty;
    public int PatientId { get; set; }
    public int DoctorId { get; set; }
    public string CertificateType { get; set; } = "SickLeave";
    public int DaysExcused { get; set; } = 1;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Recommendation { get; set; } = string.Empty;
    public string QrVerificationCode { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
}

public class ProcedureOrder
{
    public int Id { get; set; }
    public byte TenantId { get; set; } = 1;
    public int PatientId { get; set; }
    public int DoctorId { get; set; }
    public string ProcedureCode { get; set; } = string.Empty;
    public string ProcedureName { get; set; } = string.Empty;
    public byte StatusId { get; set; } = 1; // 1=Ordered, 2=Completed, 3=Cancelled
    public string ClinicalNotes { get; set; } = string.Empty;
    public DateTime OrderedAt { get; set; } = DateTime.UtcNow;
}

public class PatientMedicalHistory
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string HistoryType { get; set; } = "PastMedical";
    public string Description { get; set; } = string.Empty;
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
}
