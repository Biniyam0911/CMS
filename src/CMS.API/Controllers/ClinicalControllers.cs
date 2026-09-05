using CMS.Application.Appointments;
using CMS.Application.Encounters;
using CMS.Application.StaffServices;
using CMS.Shared.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

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
}

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

    [HttpGet("doctor/{doctorId}")]
    public async Task<IActionResult> GetDoctorAppointments(int doctorId, [FromQuery] DateTime date)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var appointments = await _appointmentService.GetDoctorAppointmentsAsync(tenantId, doctorId, date);
        return Ok(ApiResponse<List<AppointmentDto>>.Ok(appointments));
    }
}

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
}
