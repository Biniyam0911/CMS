using CMS.Application.Appointments;
using CMS.Application.Encounters;
using CMS.Application.StaffServices;
using CMS.Shared.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

/// <summary>
/// Staff & Doctor Management Controller.
/// Provides endpoints for retrieving doctor schedules, specialties, and staff profiles.
/// DEVELOPER NOTE: All methods read the current tenant from HttpContext.Items["TenantId"]
/// populated by TenantMiddleware to ensure multi-clinic data isolation.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
public class StaffController : ControllerBase
{
    private readonly StaffAndDoctorService _staffService;

    public StaffController(StaffAndDoctorService staffService)
    {
        _staffService = staffService;
    }

    [HttpGet("doctors")]
    public async Task<IActionResult> GetDoctors()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var doctors = await _staffService.GetDoctorsAsync(tenantId);
        return Ok(ApiResponse<List<DoctorDto>>.Ok(doctors));
    }

    [HttpGet("doctors/{doctorId}/schedules")]
    public async Task<IActionResult> GetDoctorSchedules(int doctorId)
    {
        var schedules = await _staffService.GetDoctorSchedulesAsync(doctorId);
        return Ok(ApiResponse<List<DoctorScheduleDto>>.Ok(schedules));
    }

    [HttpGet("specializations")]
    public async Task<IActionResult> GetSpecializations()
    {
        var list = await _staffService.GetSpecializationsAsync();
        return Ok(ApiResponse<List<SpecializationDto>>.Ok(list));
    }

    [HttpGet("all")]
    public async Task<IActionResult> GetAllStaff()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var list = await _staffService.GetAllStaffAsync(tenantId);
        return Ok(ApiResponse<List<StaffDetailDto>>.Ok(list));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateStaff(int id, [FromBody] UpdateStaffDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        dto.Id = id;
        var success = await _staffService.UpdateStaffAsync(tenantId, dto);
        return Ok(ApiResponse<object>.Ok(new { Success = success, StaffId = id }));
    }
}

/// <summary>
/// Appointments Scheduling & Status Management Controller.
/// Handles patient booking, calendar views, pagination, status changes, and rescheduling.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
public class AppointmentsController : ControllerBase
{
    private readonly AppointmentService _appointmentService;

    public AppointmentsController(AppointmentService appointmentService)
    {
        _appointmentService = appointmentService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAppointmentDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        int appointmentId = await _appointmentService.CreateAppointmentAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { AppointmentId = appointmentId }));
    }

    [HttpGet]
    public async Task<IActionResult> GetAllAppointments(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int? doctorId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] int? limit = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        int effectivePageSize = limit.HasValue && limit.Value > 0 ? limit.Value : Math.Clamp(pageSize, 1, 200);
        int effectivePage = Math.Max(1, page);

        var (list, total) = await _appointmentService.GetPagedAppointmentsAsync(tenantId, startDate, endDate, doctorId, effectivePage, effectivePageSize);
        var meta = new PaginationMeta(total, effectivePage, effectivePageSize, (int)Math.Ceiling((double)total / effectivePageSize));
        return Ok(ApiResponse<List<AppointmentDto>>.Ok(list, meta));
    }

    [HttpGet("doctor/{doctorId}")]
    public async Task<IActionResult> GetDoctorAppointments(int doctorId, [FromQuery] DateTime date)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var appointments = await _appointmentService.GetDoctorAppointmentsAsync(tenantId, doctorId, date);
        return Ok(ApiResponse<List<AppointmentDto>>.Ok(appointments));
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateAppointmentStatusDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var success = await _appointmentService.UpdateAppointmentStatusAsync(tenantId, id, dto.StatusId, dto.CancelReason);
        return Ok(ApiResponse<object>.Ok(new { Success = success, AppointmentId = id }));
    }

    [HttpPut("{id}/reschedule")]
    public async Task<IActionResult> Reschedule(int id, [FromBody] RescheduleAppointmentDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var success = await _appointmentService.RescheduleAppointmentAsync(tenantId, id, dto.NewSlotDateTime, dto.DurationMinutes);
        return Ok(ApiResponse<object>.Ok(new { Success = success, AppointmentId = id }));
    }
}

/// <summary>
/// Clinical Encounters Controller.
/// Manages patient visits, ICD-10 diagnostic entries, and minor surgical/clinical procedures.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
public class EncountersController : ControllerBase
{
    private readonly EncounterService _encounterService;

    public EncountersController(EncounterService encounterService)
    {
        _encounterService = encounterService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEncounterDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        dto.TenantId = tenantId;
        int encounterId = await _encounterService.CreateEncounterAsync(dto);
        return Ok(ApiResponse<object>.Ok(new { EncounterId = encounterId }));
    }

    [HttpPost("{encounterId}/diagnoses")]
    public async Task<IActionResult> AddDiagnosis(int encounterId, [FromBody] CreateDiagnosisDto dto)
    {
        var dtoWithEncounter = dto with { EncounterId = encounterId };
        await _encounterService.AddDiagnosisAsync(dtoWithEncounter);
        return Ok(ApiResponse<string>.Ok("Diagnosis added."));
    }

    [HttpGet("patient/{patientId}")]
    public async Task<IActionResult> GetPatientEncounters(int patientId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var encounters = await _encounterService.GetPatientEncountersAsync(tenantId, patientId);
        return Ok(ApiResponse<List<EncounterDto>>.Ok(encounters));
    }

    [HttpGet("patient/{patientId}/procedures")]
    public async Task<IActionResult> GetPatientProcedures(int patientId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var procedures = await _encounterService.GetPatientProceduresAsync(tenantId, patientId);
        return Ok(ApiResponse<List<ProcedureOrderDto>>.Ok(procedures));
    }

    [HttpPost("procedures")]
    public async Task<IActionResult> CreateProcedureOrder([FromBody] CreateProcedureOrderDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        int procId = await _encounterService.CreateProcedureOrderAsync(tenantId, dto);
        return Ok(ApiResponse<object>.Ok(new { ProcedureOrderId = procId }));
    }
}
