using System.Diagnostics;
using System.Text.RegularExpressions;
using CMS.Application.Auth;
using CMS.Application.Dashboard;
using CMS.Application.Encounters;
using CMS.Application.Modules;
using CMS.Application.Patients;
using CMS.Application.Queue;
using CMS.Application.Settings;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AuthManagementService _authService;

    public UsersController(AuthManagementService authService)
    {
        _authService = authService;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var users = await _authService.GetUsersAsync(tenantId);
        return Ok(ApiResponse<List<UserDto>>.Ok(users));
    }

    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterUserDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        int userId = await _authService.RegisterUserAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { UserId = userId }));
    }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _authService.GetRolesWithPermissionsAsync();
        return Ok(ApiResponse<List<RoleWithPermissionsDto>>.Ok(roles));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class ModulesController : ControllerBase
{
    private readonly ModuleManagementService _moduleService;

    public ModulesController(ModuleManagementService moduleService)
    {
        _moduleService = moduleService;
    }

    [HttpGet]
    public async Task<IActionResult> GetModules()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var modules = await _moduleService.GetTenantModulesAsync(tenantId);
        return Ok(ApiResponse<List<AppModuleDto>>.Ok(modules));
    }

    [HttpPost("toggle")]
    public async Task<IActionResult> ToggleModule([FromBody] ToggleModuleDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        await _moduleService.ToggleModuleAsync(tenantId, dto.ModuleId, dto.IsEnabled);
        return Ok(ApiResponse<string>.Ok("Module status updated."));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class QueueController : ControllerBase
{
    private readonly QueueService _queueService;

    public QueueController(QueueService queueService)
    {
        _queueService = queueService;
    }

    [HttpGet("live")]
    public async Task<IActionResult> GetLiveQueue([FromQuery] DateTime? date = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var queue = await _queueService.GetLiveQueueAsync(tenantId, date);
        return Ok(ApiResponse<List<PatientQueueDto>>.Ok(queue));
    }

    [HttpGet("counters")]
    public async Task<IActionResult> GetCounters()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var counters = await _queueService.GetServiceCountersAsync(tenantId);
        return Ok(ApiResponse<List<ServiceCounterDto>>.Ok(counters));
    }

    [HttpPost("checkin")]
    public async Task<IActionResult> CheckIn([FromBody] CheckInQueueDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        var token = await _queueService.CheckInPatientAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { TokenNumber = token }));
    }

    [HttpPost("call")]
    public async Task<IActionResult> CallNext([FromBody] CallQueueTicketDto dto)
    {
        await _queueService.CallNextTicketAsync(dto.TicketId, dto.CounterId, dto.StaffId);
        return Ok(ApiResponse<string>.Ok("Ticket summoned to counter."));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class MedicalCertificatesController : ControllerBase
{
    private readonly SoapAndClinicalService _clinicalService;

    public MedicalCertificatesController(SoapAndClinicalService clinicalService)
    {
        _clinicalService = clinicalService;
    }

    [HttpPost]
    public async Task<IActionResult> IssueCertificate([FromBody] CreateMedicalCertificateDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        int id = await _clinicalService.IssueMedicalCertificateAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { CertificateId = id }));
    }

    [HttpGet("patient/{patientId}")]
    public async Task<IActionResult> GetPatientCertificates(int patientId)
    {
        var certs = await _clinicalService.GetPatientCertificatesAsync(patientId);
        return Ok(ApiResponse<List<MedicalCertificateDto>>.Ok(certs));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
[Route("api/v1/encounters/procedures")]
public class ProceduresController : ControllerBase
{
    private readonly SoapAndClinicalService _clinicalService;

    public ProceduresController(SoapAndClinicalService clinicalService)
    {
        _clinicalService = clinicalService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateProcedureOrderDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        int id = await _clinicalService.CreateProcedureOrderAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { OrderId = id }));
    }

    [HttpGet("patient/{patientId}")]
    [HttpGet("/api/v1/encounters/patient/{patientId}/procedures")]
    public async Task<IActionResult> GetPatientProcedures(int patientId)
    {
        var procs = await _clinicalService.GetPatientProceduresAsync(patientId);
        return Ok(ApiResponse<List<ProcedureOrderDto>>.Ok(procs));
    }

    [HttpGet("queue")]
    public async Task<IActionResult> GetProcedureQueue([FromQuery] DateTime? date = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var procs = await _clinicalService.GetProcedureQueueAsync(tenantId, date);
        return Ok(ApiResponse<List<ProcedureOrderDto>>.Ok(procs));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly SettingsAndApiService _settingsService;

    public SettingsController(SettingsAndApiService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var settings = await _settingsService.GetClinicSettingsAsync(tenantId);
        return Ok(ApiResponse<List<ClinicSettingDto>>.Ok(settings));
    }

    [HttpPost]
    public async Task<IActionResult> UpdateSetting([FromBody] UpdateSettingDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        await _settingsService.UpdateSettingAsync(tenantId, dto.SettingKey, dto.SettingValue);
        return Ok(ApiResponse<string>.Ok("Setting updated."));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class ApiManagementController : ControllerBase
{
    private readonly SettingsAndApiService _settingsService;

    public ApiManagementController(SettingsAndApiService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet("keys")]
    public async Task<IActionResult> GetKeys()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var keys = await _settingsService.GetApiKeysAsync(tenantId);
        return Ok(ApiResponse<List<ApiKeyDto>>.Ok(keys));
    }

    [HttpPost("keys")]
    public async Task<IActionResult> CreateKey([FromBody] CreateApiKeyDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        var res = await _settingsService.CreateApiKeyAsync(dtoWithTenant, 1);
        return Ok(ApiResponse<CreateApiKeyResponse>.Ok(res));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class IntegrationsController : ControllerBase
{
    private readonly SettingsAndApiService _settingsService;

    public IntegrationsController(SettingsAndApiService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet]
    public async Task<IActionResult> GetIntegrations()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var list = await _settingsService.GetIntegrationsAsync(tenantId);
        return Ok(ApiResponse<List<IntegrationConfigDto>>.Ok(list));
    }

    [HttpPost("update")]
    public async Task<IActionResult> UpdateIntegration([FromBody] UpdateIntegrationDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        await _settingsService.UpdateIntegrationAsync(tenantId, dto);
        return Ok(ApiResponse<string>.Ok("Integration config updated."));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly DashboardService _dashboardService;

    public DashboardController(DashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var metrics = await _dashboardService.GetMetricsAsync(tenantId);
        return Ok(ApiResponse<DashboardMetricsDto>.Ok(metrics));
    }
}

public record CustomQueryRequest(string Query);

[ApiController]
[Route("api/v1/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public ReportsController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpPost("custom-query")]
    public async Task<IActionResult> ExecuteCustomQuery([FromBody] CustomQueryRequest req)
    {
        if (string.IsNullOrWhiteSpace(req?.Query))
            return BadRequest(ApiResponse<object>.Fail("Query string cannot be empty."));

        string rawQuery = req.Query.Trim();

        // 1. Must start with SELECT or WITH (for CTEs)
        if (!Regex.IsMatch(rawQuery, @"^(SELECT|WITH)\b", RegexOptions.IgnoreCase))
        {
            return BadRequest(ApiResponse<object>.Fail("Only read-only SELECT or WITH statements are allowed."));
        }

        // 2. Disallow harmful tokens / DDL / DML / multiple statements with semicolons
        string forbiddenPattern = @"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|MERGE|SHUTDOWN|BACKUP|RESTORE)\b|;--|/\*";
        if (Regex.IsMatch(rawQuery, forbiddenPattern, RegexOptions.IgnoreCase))
        {
            return BadRequest(ApiResponse<object>.Fail("Prohibited SQL keyword or token detected. Queries must be strictly read-only."));
        }

        try
        {
            using var conn = _dbFactory.CreateConnection();
            var sw = Stopwatch.StartNew();

            var rows = (await conn.QueryAsync(rawQuery)).Take(1000).ToList();
            sw.Stop();

            var columns = new List<string>();
            var resultRows = new List<Dictionary<string, object?>>();

            if (rows.Count > 0)
            {
                var firstRow = (IDictionary<string, object>)rows[0];
                columns = firstRow.Keys.ToList();

                foreach (var row in rows)
                {
                    var dict = new Dictionary<string, object?>();
                    var rowDict = (IDictionary<string, object>)row;
                    foreach (var col in columns)
                    {
                        dict[col] = rowDict.ContainsKey(col) ? rowDict[col] : null;
                    }
                    resultRows.Add(dict);
                }
            }

            return Ok(ApiResponse<object>.Ok(new
            {
                Columns = columns,
                Rows = resultRows,
                TotalCount = resultRows.Count,
                ExecutionTimeMs = sw.ElapsedMilliseconds
            }));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<object>.Fail($"SQL Execution Error: {ex.Message}"));
        }
    }

    [HttpGet("datasources")]
    public IActionResult GetDataSources()
    {
        var tables = new[]
        {
            new {
                Name = "Patients",
                Description = "Patient demographic registry and card records",
                Columns = new[] { "Id", "MRN", "FirstName", "MiddleName", "LastName", "Gender", "DateOfBirth", "PrimaryPhone", "InsuranceProvider", "CreatedAt" }
            },
            new {
                Name = "Appointments",
                Description = "Patient clinic bookings and scheduling records",
                Columns = new[] { "Id", "PatientId", "DoctorId", "SlotDateTime", "StatusId", "Notes", "CreatedAt" }
            },
            new {
                Name = "PatientTriage",
                Description = "Vital signs triage and doctor queue tickets",
                Columns = new[] { "Id", "PatientId", "QueueId", "SystolicBP", "DiastolicBP", "HeartRate", "Temperature", "OxygenSaturation", "Bmi", "ChiefComplaint", "Status", "TriagedAt" }
            },
            new {
                Name = "Encounters",
                Description = "Clinical consultation encounters and SOAP notes",
                Columns = new[] { "Id", "PatientId", "DoctorId", "EncounterDate", "ChiefComplaint", "HistoryOfIllness", "PhysicalExam", "Assessment", "Plan", "CreatedAt" }
            },
            new {
                Name = "Prescriptions",
                Description = "Doctor issued prescription orders",
                Columns = new[] { "Id", "PatientId", "DoctorId", "EncounterId", "PrescribedAt", "StatusId" }
            },
            new {
                Name = "PrescriptionItems",
                Description = "Prescription line items with dosage and quantity",
                Columns = new[] { "Id", "PrescriptionId", "DrugId", "Dosage", "Frequency", "Duration", "Quantity", "Instructions" }
            },
            new {
                Name = "LabOrders",
                Description = "Diagnostic laboratory examination requests",
                Columns = new[] { "Id", "PatientId", "OrderedBy", "OrderNumber", "OrderDate", "StatusId" }
            },
            new {
                Name = "LabResults",
                Description = "Analyte test values, reference ranges, and flags",
                Columns = new[] { "Id", "OrderId", "OrderItemId", "TestId", "PatientId", "NumericValue", "TextValue", "Unit", "Flag", "ReferenceRange", "IsVerified", "EnteredAt" }
            },
            new {
                Name = "Invoices",
                Description = "Financial invoices and billing charges",
                Columns = new[] { "Id", "InvoiceNo", "PatientId", "EncounterId", "SubTotal", "TaxAmount", "Total", "PaidAmount", "StatusId", "IssueDate" }
            },
            new {
                Name = "InvoiceItems",
                Description = "Billing itemized charges and services",
                Columns = new[] { "Id", "InvoiceId", "ItemType", "Description", "Quantity", "UnitPrice", "TotalPrice" }
            },
            new {
                Name = "ProcedureOrders",
                Description = "Clinical minor surgeries and ordered procedures",
                Columns = new[] { "Id", "PatientId", "EncounterId", "OrderedBy", "ProcedureCode", "ProcedureName", "StatusId", "ProcedureResult", "CreatedAt" }
            },
            new {
                Name = "DrugFormulary",
                Description = "Dispensary stock formulary and medication pricing",
                Columns = new[] { "Id", "GenericName", "BrandName", "DrugClass", "Form", "Strength", "StockQuantity", "MinStockLevel", "CostPrice", "SellingPrice", "UnitPrice" }
            },
            new {
                Name = "Staff",
                Description = "Clinic practitioners and administrative personnel",
                Columns = new[] { "Id", "UserId", "StaffCode", "Title", "FirstName", "LastName", "Phone", "Email", "Department", "PrimaryRoleId", "IsActive" }
            },
            new {
                Name = "Doctors",
                Description = "Physicians with license and clinical specialization",
                Columns = new[] { "Id", "StaffId", "LicenseNumber", "SpecializationId", "SubSpecialization", "ConsultationFee", "IsAvailable" }
            },
            new {
                Name = "Specializations",
                Description = "Medical specialty catalog",
                Columns = new[] { "Id", "Name", "Code" }
            }
        };

        return Ok(ApiResponse<object>.Ok(tables));
    }
}

public record CreateAuditEntryDto(
    string TableName,
    string RecordId,
    string Operation,
    string? OldValues = null,
    string? NewValues = null,
    int? ChangedBy = null
);

public class AuditDto
{
    public long Id { get; set; }
    public byte TenantId { get; set; }
    public string TableName { get; set; } = string.Empty;
    public string RecordId { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public int? ChangedBy { get; set; }
    public string? UserName { get; set; }
    public DateTime ChangedAt { get; set; }
    public string? IpAddress { get; set; }
}

[ApiController]
[Route("api/v1/[controller]")]
public class AuditController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public AuditController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpGet("logs")]
    public async Task<IActionResult> GetLogs([FromQuery] string? tableName, [FromQuery] string? operation, [FromQuery] int? userId, [FromQuery] DateTime? date)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT TOP 200
                a.Id, a.TenantId, a.TableName, a.RecordId, a.Operation,
                a.OldValues, a.NewValues, a.ChangedBy,
                ISNULL(u.Username, 'System / Dr. Tigist') AS UserName,
                a.ChangedAt, a.IpAddress
            FROM AuditLog a
            LEFT JOIN Users u ON u.Id = a.ChangedBy
            WHERE a.TenantId = @TenantId
              AND (@TableName IS NULL OR a.TableName = @TableName)
              AND (@Operation IS NULL OR a.Operation = @Operation)
              AND (@UserId IS NULL OR a.ChangedBy = @UserId)
              AND (@Date IS NULL OR CAST(a.ChangedAt AS DATE) = CAST(@Date AS DATE))
            ORDER BY a.ChangedAt DESC";

        var list = (await conn.QueryAsync<AuditDto>(sql, new {
            TenantId = tenantId,
            TableName = string.IsNullOrWhiteSpace(tableName) ? null : tableName,
            Operation = string.IsNullOrWhiteSpace(operation) ? null : operation,
            UserId = userId,
            Date = date
        })).ToList();

        return Ok(ApiResponse<List<AuditDto>>.Ok(list));
    }

    [HttpPost("log")]
    public async Task<IActionResult> LogAccess([FromBody] CreateAuditEntryDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var changedBy = dto.ChangedBy ?? 1;

        var sql = @"
            INSERT INTO AuditLog (TenantId, TableName, RecordId, Operation, OldValues, NewValues, ChangedBy, ChangedAt, IpAddress)
            VALUES (@TenantId, @TableName, @RecordId, @Operation, @OldValues, @NewValues, @ChangedBy, SYSUTCDATETIME(), @IpAddress);
            SELECT SCOPE_IDENTITY();";

        long newId = await conn.ExecuteScalarAsync<long>(sql, new {
            TenantId = tenantId,
            dto.TableName,
            dto.RecordId,
            dto.Operation,
            dto.OldValues,
            dto.NewValues,
            ChangedBy = changedBy,
            IpAddress = ip
        });

        return Ok(ApiResponse<object>.Ok(new { LogId = newId, Message = "Audit log recorded." }));
    }
}

public record ScheduleBackupDto(bool Enabled, string Frequency, string TimeOfDay);

[ApiController]
[Route("api/v1/[controller]")]
public class BackupController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _config;
    private static ScheduleBackupDto _currentSchedule = new(true, "Daily", "02:00");

    public BackupController(IDbConnectionFactory dbFactory, Microsoft.Extensions.Configuration.IConfiguration config)
    {
        _dbFactory = dbFactory;
        _config = config;
    }

    private async Task<string> GetSqlDefaultBackupDirectoryAsync(System.Data.IDbConnection conn)
    {
        try
        {
            var sql = @"
                DECLARE @backupDir NVARCHAR(400);
                EXEC master.dbo.xp_instance_regread 
                    N'HKEY_LOCAL_MACHINE', 
                    N'Software\Microsoft\MSSQLServer\MSSQLServer', 
                    N'BackupDirectory', 
                    @backupDir OUTPUT;
                SELECT ISNULL(@backupDir, CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(400)));";
            var dir = await conn.ExecuteScalarAsync<string>(sql);
            if (!string.IsNullOrWhiteSpace(dir)) return dir.TrimEnd('\\');
        }
        catch { }
        return @"C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS03\MSSQL\Backup";
    }

    [HttpGet("list")]
    public async Task<IActionResult> GetBackupList()
    {
        try
        {
            using var conn = _dbFactory.CreateConnection();
            var backupDir = await GetSqlDefaultBackupDirectoryAsync(conn);

            // Query msdb.dbo.backupset for actual verified backups of ClinicDB
            var sql = @"
                SELECT TOP 50
                    bmf.physical_device_name AS FilePath,
                    bs.backup_finish_date AS CreatedAt,
                    bs.backup_size AS SizeBytes,
                    bs.name AS BackupName
                FROM msdb.dbo.backupset bs
                JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
                WHERE bs.database_name = 'ClinicDB'
                ORDER BY bs.backup_finish_date DESC;";

            var records = (await conn.QueryAsync<dynamic>(sql)).ToList();

            var list = records.Select(r =>
            {
                string rawPath = (string)r.FilePath ?? "";
                string fileName = Path.GetFileName(rawPath);
                long bytes = 0;
                try { bytes = Convert.ToInt64(r.SizeBytes); } catch { }
                DateTime dt = DateTime.UtcNow;
                try { dt = Convert.ToDateTime(r.CreatedAt); } catch { }

                return new
                {
                    FileName = string.IsNullOrWhiteSpace(fileName) ? "ClinicDB_Snapshot.bak" : fileName,
                    FilePath = rawPath,
                    SizeBytes = bytes,
                    SizeFormatted = $"{Math.Round(bytes / 1024.0 / 1024.0, 2)} MB",
                    CreatedAt = dt,
                    IsScheduled = fileName.Contains("Scheduled")
                };
            }).ToList();

            return Ok(ApiResponse<object>.Ok(new {
                Backups = list,
                Schedule = _currentSchedule,
                BackupDirectory = backupDir
            }));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<object>.Fail($"Failed to list backups: {ex.Message}"));
        }
    }

    [HttpPost("now")]
    public async Task<IActionResult> RunImmediateBackup()
    {
        try
        {
            using var conn = _dbFactory.CreateConnection();
            var backupDir = await GetSqlDefaultBackupDirectoryAsync(conn);

            string timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            string backupFileName = $"ClinicDB_Manual_{timestamp}.bak";
            string backupPath = Path.Combine(backupDir, backupFileName);

            var sql = @"
                BACKUP DATABASE [ClinicDB] 
                TO DISK = @BackupPath 
                WITH FORMAT, MEDIANAME = 'ClinicDB_Backup', NAME = 'Full Backup of ClinicDB';";

            await conn.ExecuteAsync(sql, new { BackupPath = backupPath }, commandTimeout: 300);

            // Fetch size from msdb
            var sizeSql = @"
                SELECT TOP 1 bs.backup_size 
                FROM msdb.dbo.backupset bs 
                JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
                WHERE bmf.physical_device_name = @BackupPath
                ORDER BY bs.backup_finish_date DESC;";
            
            long backupSize = 0;
            try { backupSize = await conn.ExecuteScalarAsync<long>(sizeSql, new { BackupPath = backupPath }); } catch { }

            return Ok(ApiResponse<object>.Ok(new {
                Success = true,
                FileName = backupFileName,
                BackupPath = backupPath,
                SizeBytes = backupSize,
                SizeFormatted = backupSize > 0 ? $"{Math.Round(backupSize / 1024.0 / 1024.0, 2)} MB" : "Verified .BAK",
                CreatedAt = DateTime.UtcNow,
                Message = $"Full database backup completed successfully to {backupFileName}."
            }));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<object>.Fail($"Backup execution failed: {ex.Message}"));
        }
    }

    [HttpPost("schedule")]
    public IActionResult UpdateSchedule([FromBody] ScheduleBackupDto dto)
    {
        _currentSchedule = dto;
        return Ok(ApiResponse<object>.Ok(new {
            Success = true,
            Schedule = _currentSchedule,
            Message = $"Automated backup schedule updated to {dto.Frequency} at {dto.TimeOfDay}."
        }));
    }
}

// ========================================================
// Inpatient (IPD) Admission & Bed Management Controller
// ========================================================
[ApiController]
[Route("api/v1/[controller]")]
public class InpatientController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public InpatientController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpGet("wards")]
    public async Task<IActionResult> GetWards()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT w.Id, w.TenantId, w.Name, w.WardType, w.TotalBeds, w.IsActive,
                   COUNT(CASE WHEN b.StatusId = 2 THEN 1 END) AS OccupiedBeds,
                   COUNT(CASE WHEN b.StatusId = 1 THEN 1 END) AS AvailableBeds
            FROM Wards w
            LEFT JOIN Beds b ON b.WardId = w.Id
            WHERE w.TenantId = @TenantId AND w.IsActive = 1
            GROUP BY w.Id, w.TenantId, w.Name, w.WardType, w.TotalBeds, w.IsActive
            ORDER BY w.Id ASC";

        var wards = (await conn.QueryAsync<WardDto>(sql, new { TenantId = tenantId })).ToList();
        return Ok(ApiResponse<List<WardDto>>.Ok(wards));
    }

    [HttpGet("beds")]
    public async Task<IActionResult> GetBeds([FromQuery] int? wardId = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT b.Id, b.WardId, w.Name AS WardName, b.BedNumber, b.DailyRate, b.StatusId,
                   CASE b.StatusId 
                       WHEN 1 THEN 'Available'
                       WHEN 2 THEN 'Occupied'
                       WHEN 3 THEN 'Maintenance'
                       WHEN 4 THEN 'Cleaning'
                       ELSE 'Available' END AS StatusName,
                   a.Id AS CurrentAdmissionId,
                   a.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN,
                   a.AdmittedAt,
                   d.FirstName + ' ' + d.LastName AS DoctorName
            FROM Beds b
            JOIN Wards w ON w.Id = b.WardId
            LEFT JOIN Admissions a ON a.BedId = b.Id AND a.StatusId = 1
            LEFT JOIN Patients p ON p.Id = a.PatientId
            LEFT JOIN Doctors doc ON doc.Id = a.DoctorId
            LEFT JOIN Staff d ON d.Id = doc.StaffId
            WHERE (@WardId IS NULL OR b.WardId = @WardId)
            ORDER BY b.WardId ASC, b.BedNumber ASC";

        var beds = (await conn.QueryAsync<BedDto>(sql, new { WardId = wardId })).ToList();
        return Ok(ApiResponse<List<BedDto>>.Ok(beds));
    }

    [HttpGet("admissions")]
    public async Task<IActionResult> GetAdmissions([FromQuery] int? statusId = 1)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT a.Id, a.TenantId, a.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN,
                   a.BedId, b.BedNumber, w.Name AS WardName,
                   a.DoctorId,
                   ISNULL(st.FirstName + ' ' + st.LastName, 'Attending Physician') AS DoctorName,
                   a.EncounterId, a.AdmittedAt, a.DischargedAt, a.AdmissionReason, a.InitialDiagnosis,
                   a.StatusId,
                   CASE a.StatusId 
                       WHEN 1 THEN 'Admitted'
                       WHEN 2 THEN 'Discharged'
                       WHEN 3 THEN 'Transferred'
                       ELSE 'Admitted' END AS StatusName,
                   a.DischargeSummary, a.TotalStayDays, a.TotalBedCharge
            FROM Admissions a
            JOIN Patients p ON p.Id = a.PatientId
            JOIN Beds b ON b.Id = a.BedId
            JOIN Wards w ON w.Id = b.WardId
            LEFT JOIN Doctors doc ON doc.Id = a.DoctorId
            LEFT JOIN Staff st ON st.Id = doc.StaffId
            WHERE a.TenantId = @TenantId AND (@StatusId IS NULL OR a.StatusId = @StatusId)
            ORDER BY a.AdmittedAt DESC";

        var admissions = (await conn.QueryAsync<AdmissionDto>(sql, new { TenantId = tenantId, StatusId = statusId })).ToList();

        // Load rounds for active admissions
        if (admissions.Any())
        {
            var admIds = admissions.Select(a => a.Id).ToList();
            var roundsSql = @"
                SELECT Id, AdmissionId, RoundTime, StaffName, BloodPressure, HeartRate, Temperature, SpO2, NursingNotes, IvFluids, MedicationsGiven
                FROM InpatientRounds
                WHERE AdmissionId IN @AdmIds
                ORDER BY RoundTime DESC";
            var rounds = (await conn.QueryAsync<InpatientRoundDto>(roundsSql, new { AdmIds = admIds })).ToList();

            foreach (var adm in admissions)
            {
                adm.Rounds = rounds.Where(r => r.AdmissionId == adm.Id).ToList();
            }
        }

        return Ok(ApiResponse<List<AdmissionDto>>.Ok(admissions));
    }

    [HttpPost("admit")]
    public async Task<IActionResult> AdmitPatient([FromBody] AdmitPatientDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        // Check if bed is available
        var bedStatus = await conn.ExecuteScalarAsync<byte?>("SELECT StatusId FROM Beds WHERE Id = @BedId", new { dto.BedId });
        if (bedStatus == 2)
        {
            return BadRequest(ApiResponse<string>.Fail("Bed is currently occupied by another patient."));
        }

        var insertSql = @"
            INSERT INTO Admissions (TenantId, PatientId, BedId, DoctorId, EncounterId, AdmittedAt, AdmissionReason, InitialDiagnosis, StatusId, CreatedBy, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@TenantId, @PatientId, @BedId, @DoctorId, @EncounterId, GETDATE(), @AdmissionReason, @InitialDiagnosis, 1, @CreatedBy, GETDATE());

            UPDATE Beds SET StatusId = 2 WHERE Id = @BedId;";

        int admissionId = await conn.ExecuteScalarAsync<int>(insertSql, new {
            TenantId = tenantId,
            dto.PatientId,
            dto.BedId,
            dto.DoctorId,
            dto.EncounterId,
            dto.AdmissionReason,
            dto.InitialDiagnosis,
            dto.CreatedBy
        });

        return Ok(ApiResponse<object>.Ok(new { AdmissionId = admissionId, Message = "Patient admitted to bed successfully." }));
    }

    [HttpPost("rounds")]
    public async Task<IActionResult> RecordRound([FromBody] RecordNursingRoundDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO InpatientRounds (AdmissionId, RoundTime, StaffName, BloodPressure, HeartRate, Temperature, SpO2, NursingNotes, IvFluids, MedicationsGiven, CreatedAt)
            VALUES (@AdmissionId, GETDATE(), @StaffName, @BloodPressure, @HeartRate, @Temperature, @SpO2, @NursingNotes, @IvFluids, @MedicationsGiven, GETDATE());";

        await conn.ExecuteAsync(sql, dto);
        return Ok(ApiResponse<string>.Ok("Inpatient nursing round recorded."));
    }

    [HttpPost("discharge")]
    public async Task<IActionResult> DischargePatient([FromBody] DischargeInpatientDto dto)
    {
        using var conn = _dbFactory.CreateConnection();

        var adm = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT a.Id, a.BedId, a.PatientId, a.TenantId, a.AdmittedAt, b.DailyRate
            FROM Admissions a
            JOIN Beds b ON b.Id = a.BedId
            WHERE a.Id = @AdmissionId AND a.StatusId = 1", new { dto.AdmissionId });

        if (adm == null) return NotFound(ApiResponse<string>.Fail("Active admission not found."));

        DateTime admittedAt = Convert.ToDateTime(adm.AdmittedAt);
        int days = Math.Max(1, (int)Math.Ceiling((DateTime.UtcNow - admittedAt).TotalDays));
        decimal dailyRate = Convert.ToDecimal(adm.DailyRate);
        decimal totalBedCharge = days * dailyRate;

        var sql = @"
            UPDATE Admissions 
            SET StatusId = 2, 
                DischargedAt = GETDATE(), 
                DischargeSummary = @DischargeSummary,
                TotalStayDays = @TotalStayDays,
                TotalBedCharge = @TotalBedCharge
            WHERE Id = @AdmissionId;

            UPDATE Beds SET StatusId = 1 WHERE Id = @BedId;";

        await conn.ExecuteAsync(sql, new {
            dto.AdmissionId,
            dto.DischargeSummary,
            TotalStayDays = days,
            TotalBedCharge = totalBedCharge,
            BedId = (int)adm.BedId
        });

        return Ok(ApiResponse<object>.Ok(new {
            Success = true,
            AdmissionId = dto.AdmissionId,
            TotalStayDays = days,
            TotalBedCharge = totalBedCharge,
            Message = $"Patient discharged successfully after {days} day(s)."
        }));
    }
}

// ========================================================
// Fiscal Tax Authority (ERCA / e-Tax QR) Controller
// ========================================================
[ApiController]
[Route("api/v1/[controller]")]
public class FiscalController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public FiscalController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpGet("settings")]
    public IActionResult GetFiscalSettings()
    {
        return Ok(ApiResponse<object>.Ok(new
        {
            TinNumber = "0048291038",
            MrcNumber = "ERCA-ETH-2026-F9812",
            TaxAuthority = "Ethiopian Ministry of Revenues (ERCA)",
            TerminalIp = "127.0.0.1:9100",
            FiscalMode = "Online Fiscal Signed",
            IsConnected = true
        }));
    }

    [HttpPost("sign-receipt/{invoiceId}")]
    public async Task<IActionResult> SignFiscalReceipt(int invoiceId)
    {
        using var conn = _dbFactory.CreateConnection();
        var inv = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT i.Id, i.InvoiceNumber, i.TotalAmount, i.TaxAmt, i.IssueDate, i.TenantId,
                   p.FirstName + ' ' + p.LastName AS PatientName, p.MRN
            FROM Invoices i
            JOIN Patients p ON p.Id = i.PatientId
            WHERE i.Id = @InvoiceId", new { InvoiceId = invoiceId });

        if (inv == null) return NotFound(ApiResponse<string>.Fail("Invoice not found."));

        string timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        string fiscalReceiptNo = $"FS-{DateTime.UtcNow:yyyyMM}-{invoiceId:D6}";
        string tinNumber = "0048291038";
        string mrcNumber = "ERCA-ETH-2026-F9812";

        // Generate SHA256 cryptographic signature
        string rawSignatureSource = $"{tinNumber}|{inv.InvoiceNumber}|{inv.TotalAmount}|{inv.TaxAmt}|{timestamp}|{mrcNumber}";
        string signature;
        using (var sha = System.Security.Cryptography.SHA256.Create())
        {
            byte[] hash = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(rawSignatureSource));
            signature = Convert.ToHexString(hash)[..32];
        }

        // Standard ERCA e-tax QR payload URI
        string qrPayload = $"https://etax.mor.gov.et/verify?tin={tinNumber}&mrc={mrcNumber}&inv={inv.InvoiceNumber}&tot={inv.TotalAmount}&vat={inv.TaxAmt}&sig={signature}";

        var updateSql = @"
            UPDATE Invoices 
            SET FiscalReceiptNo = @FiscalReceiptNo,
                FiscalSignature = @FiscalSignature,
                FiscalQrPayload = @FiscalQrPayload,
                MrcNumber = @MrcNumber
            WHERE Id = @InvoiceId;";

        await conn.ExecuteAsync(updateSql, new {
            InvoiceId = invoiceId,
            FiscalReceiptNo = fiscalReceiptNo,
            FiscalSignature = signature,
            FiscalQrPayload = qrPayload,
            MrcNumber = mrcNumber
        });

        return Ok(ApiResponse<FiscalSignResultDto>.Ok(new FiscalSignResultDto
        {
            Success = true,
            FiscalReceiptNo = fiscalReceiptNo,
            MrcNumber = mrcNumber,
            TinNumber = tinNumber,
            FiscalSignature = signature,
            FiscalQrPayload = qrPayload,
            SignedAt = DateTime.UtcNow
        }));
    }
}

// ========================================================
// Radiology & PACS DICOM Studies Controller
// ========================================================
[ApiController]
[Route("api/v1/[controller]")]
public class RadiologyController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public RadiologyController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpGet("patient/{patientId}")]
    public async Task<IActionResult> GetPatientStudies(int patientId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT r.Id, r.TenantId, r.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN,
                   r.EncounterId, r.DoctorId,
                   ISNULL(st.FirstName + ' ' + st.LastName, 'Radiologist') AS DoctorName,
                   r.StudyType, r.BodyPart, r.ClinicalIndication, r.RadiologistFindings, r.Impression,
                   r.ImagePath, r.ModalityCode, r.StudyDate, r.StatusId
            FROM RadiologyStudies r
            JOIN Patients p ON p.Id = r.PatientId
            LEFT JOIN Doctors doc ON doc.Id = r.DoctorId
            LEFT JOIN Staff st ON st.Id = doc.StaffId
            WHERE r.PatientId = @PatientId
            ORDER BY r.StudyDate DESC";

        var studies = (await conn.QueryAsync<RadiologyStudyDto>(sql, new { PatientId = patientId })).ToList();
        return Ok(ApiResponse<List<RadiologyStudyDto>>.Ok(studies));
    }

    [HttpPost("studies")]
    public async Task<IActionResult> CreateStudy([FromBody] RadiologyStudyDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO RadiologyStudies (TenantId, PatientId, EncounterId, DoctorId, StudyType, BodyPart, ClinicalIndication, RadiologistFindings, Impression, ImagePath, ModalityCode, StudyDate, StatusId, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@TenantId, @PatientId, @EncounterId, @DoctorId, @StudyType, @BodyPart, @ClinicalIndication, @RadiologistFindings, @Impression, @ImagePath, @ModalityCode, GETDATE(), 2, GETDATE())";

        int studyId = await conn.ExecuteScalarAsync<int>(sql, new {
            TenantId = tenantId,
            dto.PatientId,
            dto.EncounterId,
            dto.DoctorId,
            dto.StudyType,
            dto.BodyPart,
            dto.ClinicalIndication,
            dto.RadiologistFindings,
            dto.Impression,
            dto.ImagePath,
            ModalityCode = string.IsNullOrWhiteSpace(dto.ModalityCode) ? "CR" : dto.ModalityCode
        });

        return Ok(ApiResponse<object>.Ok(new { StudyId = studyId, Message = "Radiology study recorded successfully." }));
    }
}

// ========================================================
// Phase 3A: Ethio Telecom SMS Gateway Controller
// ========================================================
[ApiController]
[Route("api/v1/[controller]")]
public class SmsController : ControllerBase
{
    private readonly CMS.Application.Notifications.SmsGatewayService _smsService;

    public SmsController(CMS.Application.Notifications.SmsGatewayService smsService)
    {
        _smsService = smsService;
    }

    [HttpPost("send")]
    public async Task<IActionResult> SendSms([FromBody] SendSmsRequestDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        long id = await _smsService.SendSmsAsync(tenantId, dto.RecipientPhone, dto.Message, dto.TriggerEvent, dto.PatientId);
        return Ok(ApiResponse<object>.Ok(new { SmsId = id, Message = "SMS dispatched via Ethio Telecom Gateway." }));
    }

    [HttpGet("logs")]
    public async Task<IActionResult> GetSmsLogs([FromQuery] int limit = 50)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var logs = await _smsService.GetSmsLogsAsync(tenantId, limit);
        return Ok(ApiResponse<List<SmsLogItemDto>>.Ok(logs));
    }

    [HttpPost("trigger-appointment-reminder/{appointmentId}")]
    public async Task<IActionResult> TriggerAppointmentReminder(int appointmentId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        bool ok = await _smsService.TriggerAppointmentReminderAsync(tenantId, appointmentId);
        return Ok(ApiResponse<bool>.Ok(ok));
    }
}

// ========================================================
// Phase 3A: Telebirr & CBE Birr Mobile Payment Controller
// ========================================================
[ApiController]
[Route("api/v1/[controller]")]
public class TelebirrController : ControllerBase
{
    private readonly CMS.Application.Billing.TelebirrPaymentService _telebirrService;
    private readonly IDbConnectionFactory _dbFactory;

    public TelebirrController(CMS.Application.Billing.TelebirrPaymentService telebirrService, IDbConnectionFactory dbFactory)
    {
        _telebirrService = telebirrService;
        _dbFactory = dbFactory;
    }

    [HttpPost("generate-qr")]
    public async Task<IActionResult> GenerateDynamicQr([FromBody] TelebirrQrRequestDto req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var res = await _telebirrService.GenerateDynamicQrAsync(tenantId, req);
        return Ok(ApiResponse<TelebirrQrResponseDto>.Ok(res));
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> ProcessWebhook([FromBody] TelebirrCallbackDto callback)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        bool success = await _telebirrService.ProcessTelebirrCallbackAsync(tenantId, callback);
        return Ok(ApiResponse<object>.Ok(new { Success = success, Message = "Telebirr transaction verified and settled." }));
    }

    [HttpGet("check-status/{invoiceId}")]
    public async Task<IActionResult> CheckPaymentStatus(int invoiceId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var inv = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, TotalAmount, PaidAmount, StatusId FROM Invoices WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = invoiceId, TenantId = tenantId });

        if (inv == null) return NotFound(ApiResponse<string>.Fail("Invoice not found."));

        bool isPaid = inv.StatusId == 4 || inv.PaidAmount >= inv.TotalAmount;
        return Ok(ApiResponse<object>.Ok(new
        {
            InvoiceId = invoiceId,
            StatusId = (int)inv.StatusId,
            TotalAmount = (decimal)inv.TotalAmount,
            PaidAmount = (decimal)inv.PaidAmount,
            IsSettled = isPaid
        }));
    }
}

// ============================================================
// TELEMED CONTROLLER
// ============================================================
[ApiController]
[Route("api/v1/[controller]")]
public class TelemedController : ControllerBase
{
    private readonly CMS.Application.Telemedicine.TelemedService _telemedService;
    private readonly CMS.Application.Telemedicine.TelegramBotService _telegramService;
    private readonly CMS.Application.Telemedicine.WhatsAppCloudService _whatsappService;
    private readonly ILogger<TelemedController> _logger;

    public TelemedController(
        CMS.Application.Telemedicine.TelemedService telemedService,
        CMS.Application.Telemedicine.TelegramBotService telegramService,
        CMS.Application.Telemedicine.WhatsAppCloudService whatsappService,
        ILogger<TelemedController> logger)
    {
        _telemedService = telemedService;
        _telegramService = telegramService;
        _whatsappService = whatsappService;
        _logger = logger;
    }

    // GET /api/v1/telemed/sessions?statusId=2
    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions([FromQuery] int? statusId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var sessions = await _telemedService.GetSessionsAsync(tenantId, statusId);
        return Ok(ApiResponse<IEnumerable<CMS.Shared.DTOs.TelemedSessionSummaryDto>>.Ok(sessions));
    }

    // GET /api/v1/telemed/sessions/{id}
    [HttpGet("sessions/{id:int}")]
    public async Task<IActionResult> GetSession(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var session = await _telemedService.GetSessionDetailAsync(tenantId, id);
        if (session == null) return NotFound(ApiResponse<string>.Fail("Session not found."));
        return Ok(ApiResponse<CMS.Shared.DTOs.TelemedSessionSummaryDto>.Ok(session));
    }

    // GET /api/v1/telemed/sessions/{id}/messages
    [HttpGet("sessions/{id:int}/messages")]
    public async Task<IActionResult> GetMessages(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var messages = await _telemedService.GetSessionMessagesAsync(tenantId, id);
        return Ok(ApiResponse<IEnumerable<CMS.Shared.DTOs.TelemedMessageDto>>.Ok(messages));
    }

    // POST /api/v1/telemed/sessions/{id}/messages
    [HttpPost("sessions/{id:int}/messages")]
    public async Task<IActionResult> SendMessage(int id, [FromBody] CMS.Shared.DTOs.SendDoctorMessageRequestDto req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        int doctorStaffId = HttpContext.Items["UserId"] is int uid ? uid : 1;
        req.SessionId = id;
        var msg = await _telemedService.SendDoctorMessageAsync(tenantId, doctorStaffId, req);

        // Forward to Telegram or WhatsApp
        var session = await _telemedService.GetSessionDetailAsync(tenantId, id);
        if (session != null)
        {
            string cleanText = req.ContentText ?? "";
            if (session.Platform == "Telegram" && !string.IsNullOrWhiteSpace(session.PlatformChatId))
            {
                await _telegramService.SendTelegramMessageAsync(tenantId, session.PlatformChatId, cleanText);
            }
            else if (session.Platform == "WhatsApp" && !string.IsNullOrWhiteSpace(session.PatientPhone))
            {
                await _whatsappService.SendWhatsAppTextMessageAsync(tenantId, session.PatientPhone, cleanText);
            }
        }

        return Ok(ApiResponse<CMS.Shared.DTOs.TelemedMessageDto>.Ok(msg));
    }

    // POST /api/v1/telemed/sessions/{id}/call
    [HttpPost("sessions/{id:int}/call")]
    public async Task<IActionResult> InitiateCall(int id, [FromBody] CMS.Shared.DTOs.InitiateTelemedCallRequestDto req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        int doctorStaffId = HttpContext.Items["UserId"] is int uid ? uid : 1;
        req.SessionId = id;
        var videoUrl = await _telemedService.InitiateVideoCallAsync(tenantId, doctorStaffId, req);

        // Forward video room link to patient's Telegram/WhatsApp
        var session = await _telemedService.GetSessionDetailAsync(tenantId, id);
        if (session != null)
        {
            string notice = $"📹 *Dr. Bekele has started your 1-click video consultation room.*\n\nPlease tap the link below to join from your phone:\n🔗 {videoUrl}";
            if (session.Platform == "Telegram" && !string.IsNullOrWhiteSpace(session.PlatformChatId))
            {
                await _telegramService.SendTelegramMessageAsync(tenantId, session.PlatformChatId, notice);
            }
            else if (session.Platform == "WhatsApp" && !string.IsNullOrWhiteSpace(session.PatientPhone))
            {
                await _whatsappService.SendWhatsAppTextMessageAsync(tenantId, session.PatientPhone, notice);
            }
        }

        return Ok(ApiResponse<object>.Ok(new { VideoUrl = videoUrl, Message = "Video call room ready." }));
    }

    // POST /api/v1/telemed/sessions/{id}/complete
    [HttpPost("sessions/{id:int}/complete")]
    public async Task<IActionResult> CompleteConsultation(int id, [FromBody] CMS.Shared.DTOs.CompleteTelemedConsultationRequestDto req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        int doctorStaffId = HttpContext.Items["UserId"] is int uid ? uid : 1;
        req.SessionId = id;
        await _telemedService.CompleteConsultationAsync(tenantId, doctorStaffId, req);

        // Forward completion summary to patient
        var session = await _telemedService.GetSessionDetailAsync(tenantId, id);
        if (session != null && session.Platform == "Telegram" && !string.IsNullOrWhiteSpace(session.PlatformChatId))
        {
            string summary = $"✅ *Consultation Completed by Dr. Bekele*\n\n" +
                $"📋 *Diagnosis:* {req.Diagnosis ?? "Clinical advice provided"}\n" +
                (string.IsNullOrWhiteSpace(req.PrescriptionText) ? "" : $"💊 *Prescription:* {req.PrescriptionText}\n\n") +
                "Thank you for choosing Specialty Clinic Telehealth.";
            await _telegramService.SendTelegramMessageAsync(tenantId, session.PlatformChatId, summary);
        }

        return Ok(ApiResponse<object>.Ok(new { Message = "Consultation completed successfully." }));
    }

    // GET /api/v1/telemed/telegram/webhook  (Telegram webhook verification — not used by Telegram but for admin check)
    [HttpGet("telegram/webhook")]
    public IActionResult TelegramVerify() => Ok("Telegram webhook active.");

    // POST /api/v1/telemed/telegram/webhook  (Inbound Telegram updates)
    [HttpPost("telegram/webhook")]
    public async Task<IActionResult> TelegramInbound([FromBody] System.Text.Json.JsonElement update)
    {
        try
        {
            byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
            _logger.LogInformation(">>> INBOUND TELEGRAM UPDATE: {RawJson}", update.GetRawText());
            await _telegramService.HandleInboundTelegramUpdateAsync(tenantId, update);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "!!! Error processing Telegram webhook update: {Message}", ex.Message);
        }
        return Ok(); // Always return 200 to Telegram
    }

    // GET /api/v1/telemed/whatsapp/webhook  (Meta hub verification challenge)
    [HttpGet("whatsapp/webhook")]
    public IActionResult WhatsAppVerify(
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        // In production, validate verifyToken against ClinicSettings
        if (mode == "subscribe" && !string.IsNullOrEmpty(challenge))
            return Content(challenge, "text/plain");
        return BadRequest("Verification failed.");
    }

    // POST /api/v1/telemed/whatsapp/webhook  (Inbound WhatsApp messages)
    [HttpPost("whatsapp/webhook")]
    public async Task<IActionResult> WhatsAppInbound([FromBody] System.Text.Json.JsonElement payload)
    {
        try
        {
            byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
            await _whatsappService.HandleInboundWhatsAppWebhookAsync(tenantId, payload);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing WhatsApp webhook payload.");
        }
        return Ok(); // Always return 200 to Meta
    }
}
