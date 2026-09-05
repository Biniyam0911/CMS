using CMS.Application.Auth;
using CMS.Application.Dashboard;
using CMS.Application.Encounters;
using CMS.Application.Modules;
using CMS.Application.Patients;
using CMS.Application.Queue;
using CMS.Application.Settings;
using CMS.Shared.DTOs;
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
    public async Task<IActionResult> GetLiveQueue()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var queue = await _queueService.GetLiveQueueAsync(tenantId);
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
    public async Task<IActionResult> GetPatientProcedures(int patientId)
    {
        var procs = await _clinicalService.GetPatientProceduresAsync(patientId);
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
