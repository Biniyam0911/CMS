namespace CMS.Shared.DTOs;

// --- Batch A: Auth, RBAC & Modules ---
public record RegisterUserDto(
    byte TenantId, string Username, string Email, string Password,
    string FirstName, string LastName, string? Phone, short[] RoleIds);

public record UpdateUserDto(
    int Id, string FirstName, string LastName, string? Phone, string Email,
    bool IsActive, short[] RoleIds);

public record MfaSetupResponse(string Secret, string QrCodeUri, string ManualKey);
public record VerifyMfaRequest(int UserId, string Code);

public record RoleWithPermissionsDto(
    short Id, string Name, string? Description, int UserCount, string[] Permissions);

public record CreateRoleDto(string Name, string? Description, string[] Permissions);

public record AppModuleDto(
    int Id, string ModuleCode, string Name, string? Description, string Category,
    string? IconName, string Version, bool IsCore, bool IsEnabled, string? CustomConfigJson);

public record ToggleModuleDto(int ModuleId, bool IsEnabled);

// --- Batch B: Patients & Full EMR/SOAP ---
public record PatientDetailDto(
    int Id, byte TenantId, string MRN, string FirstName, string? MiddleName, string LastName,
    DateTime DateOfBirth, int Gender, string? BloodGroup, string? MaritalStatus,
    string PrimaryPhone, string? SecondaryPhone, string? Email, string? Address, string? City,
    string? EmergencyName, string? EmergencyPhone, string? EmergencyRelation,
    string? InsuranceProvider, string? InsurancePolicyNo, string? Allergies,
    string? ChronicConditions, string? Notes, bool IsActive,
    List<PatientMedicalHistoryDto> Histories,
    List<EncounterDto> Encounters);

public record PatientMedicalHistoryDto(
    int Id, int PatientId, string HistoryType, string Description, string? OnsetDate,
    string Status, string? Notes, DateTime RecordedAt);

public record CreatePatientHistoryDto(
    int PatientId, string HistoryType, string Description, string? OnsetDate, string? Notes);

public record MedicalCertificateDto(
    int Id, string CertificateNo, int PatientId, string PatientName,
    int DoctorId, string DoctorName, int? EncounterId, string CertificateType,
    string DiagnosisSummary, string Recommendation, DateTime StartDate, DateTime EndDate,
    int DaysExcused, string QrVerificationCode, DateTime IssuedAt);

public record CreateMedicalCertificateDto(
    byte TenantId, int PatientId, int DoctorId, int? EncounterId, string CertificateType,
    string DiagnosisSummary, string Recommendation, DateTime StartDate, DateTime EndDate);

public record ProcedureOrderDto(
    int Id, int EncounterId, int PatientId, string PatientName, int OrderedBy, string DoctorName,
    string ProcedureCode, string ProcedureName, string? ClinicalNotes, byte StatusId, string StatusName,
    DateTime CreatedAt, DateTime? PerformedAt, string? ProcedureResult);

public record CreateProcedureOrderDto(
    byte TenantId, int EncounterId, int PatientId, int OrderedBy,
    string ProcedureCode, string ProcedureName, string? ClinicalNotes);

public record CompleteProcedureDto(int OrderId, int PerformedBy, string ProcedureResult);

// --- Batch C: Queue & Live Triage ---
public record ServiceCounterDto(
    int Id, byte TenantId, string CounterNumber, string CounterName,
    string ServiceType, int? CurrentStaffId, string? CurrentStaffName, bool IsActive);

public record PatientQueueDto(
    long Id, byte TenantId, string TokenNumber, int PatientId, string PatientName,
    string ServiceType, byte PriorityLevel, string PriorityName, byte StatusId, string StatusName,
    int? AssignedCounterId, string? CounterName, int? AssignedDoctorId, string? DoctorName,
    int? EstimatedWaitMin, DateTime CheckInTime, DateTime? CallTime);

public record CheckInQueueDto(
    byte TenantId, int PatientId, string ServiceType, byte PriorityLevel = 2,
    int? AssignedDoctorId = null, string? Notes = null);

public record CallQueueTicketDto(long TicketId, int CounterId, int StaffId);

// --- Batch F: Settings, API Keys, Integrations & Dashboard ---
public record ApiKeyDto(
    int Id, byte TenantId, string Name, string KeyPrefix, int RateLimitRpm,
    string? AllowedIps, DateTime? ExpiresAt, bool IsActive, DateTime? LastUsedAt, DateTime CreatedAt);

public record CreateApiKeyDto(byte TenantId, string Name, int RateLimitRpm = 60, string? AllowedIps = null, int DaysValid = 365);
public record CreateApiKeyResponse(int Id, string Name, string RawApiKey, string KeyPrefix);

public record WebhookSubscriptionDto(
    int Id, byte TenantId, string EndpointUrl, string SubscribedEvents, bool IsActive, DateTime CreatedAt);

public record CreateWebhookDto(byte TenantId, string EndpointUrl, string[] Events);

public record ClinicSettingDto(int Id, string SettingKey, string SettingValue, string Category, string? Description);

public record UpdateSettingDto(string SettingKey, string SettingValue);

public record IntegrationConfigDto(
    int Id, string ProviderCode, string ProviderType, string DisplayName,
    bool IsEnabled, bool IsPrimary, string HealthStatus, string? ErrorMessage, DateTime UpdatedAt);

public record UpdateIntegrationDto(string ProviderCode, bool IsEnabled, bool IsPrimary, string? CredentialsJson);

public record DashboardMetricsDto(
    int ActivePatientsCount,
    int TodayAppointmentsCount,
    int PendingLabOrdersCount,
    int WaitingQueueCount,
    decimal TodayRevenue,
    double CacheHitRatio,
    int ActiveDoctorsCount,
    List<PatientQueueDto> LiveQueue,
    List<dynamic> CriticalAlerts,
    List<dynamic> RecentActivities);
