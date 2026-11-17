using System.Security.Claims;
using CMS.Application.AntenatalCare;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/anc")]
public class AntenatalCareController : ControllerBase
{
    private readonly IAncService _ancService;

    public AntenatalCareController(IAncService ancService)
    {
        _ancService = ancService;
    }

    private byte GetTenantId() => HttpContext.Items["TenantId"] is byte t ? t : (byte)1;

    private int GetUserId()
    {
        if (Request.Headers.TryGetValue("x-user-id", out var val) && int.TryParse(val, out var uid))
            return uid;
        if (User.FindFirst(ClaimTypes.NameIdentifier)?.Value is string sub && int.TryParse(sub, out var subId))
            return subId;
        return 1;
    }

    private bool IsAuthorizedForPmtct()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            if (User.IsInRole("Doctor") || User.IsInRole("Obstetrician") || User.IsInRole("Midwife") ||
                User.IsInRole("SuperAdmin") || User.IsInRole("Admin"))
                return true;
        }

        var rolesHeader = Request.Headers["x-user-roles"].ToString();
        if (string.IsNullOrEmpty(rolesHeader) || 
            rolesHeader.Contains("Doctor", StringComparison.OrdinalIgnoreCase) ||
            rolesHeader.Contains("Obstetrician", StringComparison.OrdinalIgnoreCase) ||
            rolesHeader.Contains("Midwife", StringComparison.OrdinalIgnoreCase) ||
            rolesHeader.Contains("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
            rolesHeader.Contains("Admin", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }

    /// <summary>
    /// Check patient status, active pregnancy detection, and historical pregnancy episodes.
    /// </summary>
    [HttpGet("patient-check/{patientId}")]
    public async Task<IActionResult> CheckPatient(int patientId)
    {
        try
        {
            var result = await _ancService.CheckPatientActivePregnancyAsync(patientId, GetTenantId());
            return Ok(ApiResponse<AncPatientCheckDto>.Ok(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<AncPatientCheckDto>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncPatientCheckDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Register a new pregnancy episode for a patient.
    /// Enforces: ONE active pregnancy per patient.
    /// </summary>
    [HttpPost("episodes")]
    public async Task<IActionResult> RegisterEpisode([FromBody] AncRegisterEpisodeRequest request)
    {
        try
        {
            var result = await _ancService.RegisterNewEpisodeAsync(request, GetUserId(), GetTenantId());
            return Ok(ApiResponse<AncWorkspaceDetailDto>.Ok(result));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<AncWorkspaceDetailDto>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncWorkspaceDetailDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Retrieve full clinical workspace details for a pregnancy episode.
    /// </summary>
    [HttpGet("episodes/{episodeId}")]
    public async Task<IActionResult> GetWorkspace(int episodeId)
    {
        try
        {
            var isAuthPmtct = IsAuthorizedForPmtct();
            var result = await _ancService.GetWorkspaceDetailsAsync(episodeId, GetUserId(), isAuthPmtct, GetTenantId());
            return Ok(ApiResponse<AncWorkspaceDetailDto>.Ok(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<AncWorkspaceDetailDto>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncWorkspaceDetailDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Record a follow-up ANC encounter.
    /// </summary>
    [HttpPost("encounters")]
    public async Task<IActionResult> CreateEncounter([FromBody] AncCreateEncounterRequest request)
    {
        try
        {
            var result = await _ancService.CreateEncounterAsync(request, GetUserId(), GetTenantId());
            return Ok(ApiResponse<AncEncounterDto>.Ok(result));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ANC CreateEncounter Error] {ex}");
            return BadRequest(ApiResponse<AncEncounterDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Finalize an encounter.
    /// </summary>
    [HttpPost("encounters/{encounterId}/finalize")]
    public async Task<IActionResult> FinalizeEncounter(int encounterId)
    {
        try
        {
            var result = await _ancService.FinalizeEncounterAsync(encounterId, GetUserId());
            return Ok(ApiResponse<AncEncounterDto>.Ok(result));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ANC CreateEncounter Error] {ex}");
            return BadRequest(ApiResponse<AncEncounterDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Add repeatable ultrasound record.
    /// </summary>
    [HttpPost("episodes/{episodeId}/ultrasounds")]
    public async Task<IActionResult> AddUltrasound(int episodeId, [FromBody] AncUltrasoundDto dto)
    {
        try
        {
            var result = await _ancService.AddUltrasoundRecordAsync(episodeId, dto, GetUserId());
            return Ok(ApiResponse<AncUltrasoundDto>.Ok(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncUltrasoundDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Save or update confidential PMTCT information.
    /// </summary>
    [HttpPost("episodes/{episodeId}/pmtct")]
    public async Task<IActionResult> SavePmtct(int episodeId, [FromBody] AncPmtctDto dto)
    {
        if (!IsAuthorizedForPmtct())
            return Forbid("Access denied: You do not have permission to view or modify confidential HIV/PMTCT information.");

        try
        {
            var result = await _ancService.SavePmtctRecordAsync(episodeId, dto, GetUserId());
            return Ok(ApiResponse<AncPmtctDto>.Ok(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncPmtctDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Record laboratory examination results.
    /// </summary>
    [HttpPost("episodes/{episodeId}/labs")]
    public async Task<IActionResult> AddLab(int episodeId, [FromBody] AncLabExaminationDto dto)
    {
        try
        {
            var result = await _ancService.AddLabExaminationAsync(episodeId, dto, GetUserId());
            return Ok(ApiResponse<AncLabExaminationDto>.Ok(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncLabExaminationDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Record diagnosis with ICD, DHIS2, or HMIS codes.
    /// </summary>
    [HttpPost("episodes/{episodeId}/diagnoses")]
    public async Task<IActionResult> AddDiagnosis(int episodeId, [FromBody] AncDiagnosisDto dto)
    {
        try
        {
            var result = await _ancService.AddDiagnosisAsync(episodeId, dto, GetUserId());
            return Ok(ApiResponse<AncDiagnosisDto>.Ok(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncDiagnosisDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Schedule follow-up appointment.
    /// </summary>
    [HttpPost("episodes/{episodeId}/appointments")]
    public async Task<IActionResult> ScheduleAppointment(int episodeId, [FromBody] AncAppointmentDto dto)
    {
        try
        {
            var result = await _ancService.ScheduleAppointmentAsync(episodeId, dto, GetUserId());
            return Ok(ApiResponse<AncAppointmentDto>.Ok(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncAppointmentDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Approve continuing pregnancy past 43 weeks following formal clinical review.
    /// </summary>
    [HttpPost("episodes/{episodeId}/overdue-review")]
    public async Task<IActionResult> ApproveOverdueReview(int episodeId, [FromBody] string reviewNotes)
    {
        try
        {
            var ok = await _ancService.ApproveOverdueReviewAsync(episodeId, reviewNotes, GetUserId());
            return Ok(ApiResponse<bool>.Ok(ok));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<bool>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Close pregnancy episode with Delivery Outcome or formal closure.
    /// </summary>
    [HttpPost("episodes/{episodeId}/close")]
    public async Task<IActionResult> CloseEpisode(int episodeId, [FromBody] AncCloseEpisodeRequest request)
    {
        try
        {
            request.EpisodeId = episodeId;
            var result = await _ancService.CloseEpisodeAsync(request, GetUserId());
            return Ok(ApiResponse<AncOutcomeDto>.Ok(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncOutcomeDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Update approved pregnancy dating (LMP vs Ultrasound).
    /// </summary>
    [HttpPut("episodes/{episodeId}/dating")]
    public async Task<IActionResult> UpdateDating(int episodeId, [FromQuery] string datingMethod, [FromQuery] DateTime? lmp, [FromQuery] DateTime? usDate, [FromQuery] int? usWeeks, [FromQuery] int? usDays)
    {
        try
        {
            var result = await _ancService.UpdateDatingAsync(episodeId, datingMethod, lmp, usDate, usWeeks, usDays, GetUserId());
            return Ok(ApiResponse<AncWorkspaceDetailDto>.Ok(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncWorkspaceDetailDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Update baseline registration parameters (Gravidity, Parity, LMP, Dating, Prior Deliveries).
    /// </summary>
    [HttpPut("episodes/{episodeId}/baseline")]
    public async Task<IActionResult> UpdateEpisodeBaseline(int episodeId, [FromBody] AncUpdateEpisodeBaselineRequest request)
    {
        try
        {
            request.EpisodeId = episodeId;
            var result = await _ancService.UpdateEpisodeBaselineAsync(episodeId, request, GetUserId(), GetTenantId());
            return Ok(ApiResponse<AncWorkspaceDetailDto>.Ok(result));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ANC UpdateEpisodeBaseline Error] {ex}");
            return BadRequest(ApiResponse<AncWorkspaceDetailDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Retrieve full chronological pregnancy history for a patient.
    /// </summary>
    [HttpGet("patients/{patientId}/history")]
    public async Task<IActionResult> GetPatientHistory(int patientId)
    {
        try
        {
            var history = await _ancService.GetPatientPregnancyHistoryAsync(patientId, GetTenantId());
            return Ok(ApiResponse<List<AncEpisodeSummaryDto>>.Ok(history));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<List<AncEpisodeSummaryDto>>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Retrieve ANC Dashboard statistics, metrics, trimesters, 42w/43w alerts, and today's worklist.
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        try
        {
            var dashboard = await _ancService.GetDashboardAsync(GetTenantId());
            return Ok(ApiResponse<AncDashboardDto>.Ok(dashboard));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncDashboardDto>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Generate one of the 12 clinical and operational ANC reports.
    /// </summary>
    [HttpPost("reports")]
    public async Task<IActionResult> GenerateReport([FromBody] AncReportFilterRequest filter)
    {
        try
        {
            var report = await _ancService.GenerateReportAsync(filter, GetTenantId());
            return Ok(ApiResponse<AncReportResultDto>.Ok(report));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<AncReportResultDto>.Fail(ex.Message));
        }
    }
}
