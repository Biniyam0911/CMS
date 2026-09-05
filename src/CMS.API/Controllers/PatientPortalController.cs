using CMS.Application.PatientPortal;
using CMS.Shared.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/portal")]
public class PatientPortalController : ControllerBase
{
    private readonly PatientPortalService _portalService;

    public PatientPortalController(PatientPortalService portalService)
    {
        _portalService = portalService;
    }

    [HttpGet("profile/{userId}")]
    public async Task<IActionResult> GetProfile(int userId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var profile = await _portalService.GetPatientProfileAsync(tenantId, userId);
        if (profile == null) return NotFound(ApiResponse<string>.Fail("Patient profile not found."));
        return Ok(ApiResponse<PatientDto>.Ok(profile));
    }

    [HttpGet("appointments/{patientId}")]
    public async Task<IActionResult> GetAppointments(int patientId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var appointments = await _portalService.GetPatientAppointmentsAsync(tenantId, patientId);
        return Ok(ApiResponse<List<AppointmentDto>>.Ok(appointments));
    }

    [HttpGet("lab-results/{patientId}")]
    public async Task<IActionResult> GetVerifiedLabResults(int patientId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var results = await _portalService.GetVerifiedLabResultsAsync(tenantId, patientId);
        return Ok(ApiResponse<object>.Ok(results));
    }
}
