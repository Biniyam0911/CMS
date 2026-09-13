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
