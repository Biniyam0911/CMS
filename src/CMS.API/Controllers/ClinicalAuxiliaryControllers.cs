using CMS.Application.Dashboard;
using CMS.Application.Encounters;
using CMS.Application.Patients;
using CMS.Application.Queue;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

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
