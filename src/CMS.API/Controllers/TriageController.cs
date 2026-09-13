using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TriageController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;

    public TriageController(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    [HttpGet("queue")]
    public async Task<IActionResult> GetQueue([FromQuery] string? status = null, [FromQuery] DateTime? date = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT t.Id, t.TenantId, t.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN,
                   t.AppointmentId, t.QueueId,
                   ISNULL(q.TokenNumber, 'TRG-' + CAST(t.Id AS VARCHAR)) AS TokenNumber,
                   t.TriageCategory, t.PriorityLevel,
                   t.SystolicBP, t.DiastolicBP, t.HeartRate, t.RespiratoryRate,
                   t.Temperature, t.OxygenSaturation, t.WeightKg, t.HeightCm,
                   t.Bmi, t.BloodGlucose, t.PainScale,
                   t.ChiefComplaint, t.NurseNotes,
                   t.AssignedDoctorId,
                   ISNULL(s.FirstName + ' ' + s.LastName, 'Unassigned') AS AssignedDoctorName,
                   t.AssignedRoomId,
                   ISNULL(r.RoomName, 'Not Assigned') AS AssignedRoomName,
                   t.Status, t.HoldReason, t.HoldDurationMin,
                   t.TriagedBy, t.TriagedAt, t.UpdatedAt
            FROM PatientTriage t
            JOIN Patients p ON p.Id = t.PatientId
            LEFT JOIN PatientQueues q ON q.Id = t.QueueId
            LEFT JOIN Doctors d ON d.Id = t.AssignedDoctorId
            LEFT JOIN Staff s ON s.Id = d.StaffId
            LEFT JOIN ConsultationRooms r ON r.Id = t.AssignedRoomId
            WHERE t.TenantId = @TenantId
              AND (@Status IS NULL OR t.Status = @Status)
              AND (@Date IS NULL OR CAST(t.TriagedAt AS DATE) = CAST(@Date AS DATE) OR CAST(t.UpdatedAt AS DATE) = CAST(@Date AS DATE))
            ORDER BY t.PriorityLevel ASC, t.UpdatedAt DESC, t.TriagedAt DESC";

        var list = (await conn.QueryAsync<TriageDto>(sql, new {
            TenantId = tenantId,
            Status = string.IsNullOrWhiteSpace(status) ? null : status,
            Date = date
        })).ToList();
        return Ok(ApiResponse<List<TriageDto>>.Ok(list));
    }

    [HttpGet("doctor/{doctorId:int}")]
    public async Task<IActionResult> GetDoctorQueue(int doctorId, [FromQuery] DateTime? date = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT t.Id, t.TenantId, t.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN, p.DateOfBirth, p.Gender, p.BloodGroup, p.Allergies, p.InsuranceProvider,
                   p.PrimaryPhone,
                   t.AppointmentId, t.QueueId,
                   ISNULL(q.TokenNumber, 'TRG-' + CAST(t.Id AS VARCHAR)) AS TokenNumber,
                   t.TriageCategory, t.PriorityLevel,
                   t.SystolicBP, t.DiastolicBP, t.HeartRate, t.RespiratoryRate,
                   t.Temperature, t.OxygenSaturation, t.WeightKg, t.HeightCm,
                   t.Bmi, t.BloodGlucose, t.PainScale,
                   t.ChiefComplaint, t.NurseNotes,
                   t.AssignedDoctorId,
                   ISNULL(s.FirstName + ' ' + s.LastName, 'Attending Physician') AS AssignedDoctorName,
                   t.AssignedRoomId,
                   ISNULL(r.RoomName, 'Room 101') AS AssignedRoomName,
                   t.Status, t.TriagedAt, t.UpdatedAt
            FROM PatientTriage t
            JOIN Patients p ON p.Id = t.PatientId
            LEFT JOIN PatientQueues q ON q.Id = t.QueueId
            LEFT JOIN Doctors d ON d.Id = t.AssignedDoctorId
            LEFT JOIN Staff s ON s.Id = d.StaffId
            LEFT JOIN ConsultationRooms r ON r.Id = t.AssignedRoomId
            WHERE t.TenantId = @TenantId
              AND (t.AssignedDoctorId = @DoctorId OR @DoctorId = 0)
              AND (
                  @Date IS NULL
                  OR CAST(t.TriagedAt AS DATE) = CAST(@Date AS DATE)
                  OR CAST(t.UpdatedAt AS DATE) = CAST(@Date AS DATE)
              )
            ORDER BY t.PriorityLevel ASC, t.UpdatedAt DESC, t.TriagedAt DESC";

        var list = (await conn.QueryAsync<dynamic>(sql, new {
            TenantId = tenantId,
            DoctorId = doctorId,
            Date = date
        })).ToList();
        return Ok(ApiResponse<dynamic>.Ok(list));
    }

    [HttpGet("patient/{patientId:int}/latest")]
    public async Task<IActionResult> GetLatestPatientVitals(int patientId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT TOP 1 t.Id, t.TenantId, t.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN,
                   t.AppointmentId, t.QueueId,
                   t.TriageCategory, t.PriorityLevel,
                   t.SystolicBP, t.DiastolicBP, t.HeartRate, t.RespiratoryRate,
                   t.Temperature, t.OxygenSaturation, t.WeightKg, t.HeightCm,
                   t.Bmi, t.BloodGlucose, t.PainScale,
                   t.ChiefComplaint, t.NurseNotes,
                   t.AssignedDoctorId,
                   ISNULL(s.FirstName + ' ' + s.LastName, 'Unassigned') AS AssignedDoctorName,
                   t.AssignedRoomId,
                   t.Status, t.HoldReason, t.HoldDurationMin,
                   t.TriagedBy, t.TriagedAt, t.UpdatedAt
            FROM PatientTriage t
            JOIN Patients p ON p.Id = t.PatientId
            LEFT JOIN Doctors d ON d.Id = t.AssignedDoctorId
            LEFT JOIN Staff s ON s.Id = d.StaffId
            WHERE t.TenantId = @TenantId AND t.PatientId = @PatientId
            ORDER BY t.UpdatedAt DESC, t.TriagedAt DESC";

        var record = await conn.QueryFirstOrDefaultAsync<TriageDto>(sql, new { TenantId = tenantId, PatientId = patientId });
        return Ok(ApiResponse<TriageDto?>.Ok(record));
    }

    [HttpGet("patient/{patientId:int}/history")]
    public async Task<IActionResult> GetPatientVitalsHistory(int patientId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT t.Id, t.TenantId, t.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   t.TriageCategory, t.PriorityLevel,
                   t.SystolicBP, t.DiastolicBP, t.HeartRate, t.RespiratoryRate,
                   t.Temperature, t.OxygenSaturation, t.WeightKg, t.HeightCm,
                   t.Bmi, t.BloodGlucose, t.PainScale,
                   t.ChiefComplaint, t.NurseNotes,
                   t.TriagedAt, t.UpdatedAt
            FROM PatientTriage t
            JOIN Patients p ON p.Id = t.PatientId
            WHERE t.TenantId = @TenantId AND t.PatientId = @PatientId
            ORDER BY t.TriagedAt ASC";

        var records = (await conn.QueryAsync<TriageDto>(sql, new { TenantId = tenantId, PatientId = patientId })).ToList();
        return Ok(ApiResponse<List<TriageDto>>.Ok(records));
    }

    [HttpPost]
    public async Task<IActionResult> RecordTriage([FromBody] RecordTriageDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        decimal? bmi = null;
        if (dto.WeightKg.HasValue && dto.HeightCm.HasValue && dto.HeightCm.Value > 0)
        {
            var hM = dto.HeightCm.Value / 100m;
            bmi = Math.Round(dto.WeightKg.Value / (hM * hM), 1);
        }

        int triageId = dto.TriageId ?? 0;

        if (triageId > 0)
        {
            var updateSql = @"
                UPDATE PatientTriage
                SET TriageCategory = @TriageCategory,
                    PriorityLevel = @PriorityLevel,
                    SystolicBP = @SystolicBP,
                    DiastolicBP = @DiastolicBP,
                    HeartRate = @HeartRate,
                    RespiratoryRate = @RespiratoryRate,
                    Temperature = @Temperature,
                    OxygenSaturation = @OxygenSaturation,
                    WeightKg = @WeightKg,
                    HeightCm = @HeightCm,
                    Bmi = @Bmi,
                    BloodGlucose = @BloodGlucose,
                    PainScale = @PainScale,
                    ChiefComplaint = @ChiefComplaint,
                    NurseNotes = @NurseNotes,
                    Status = CASE WHEN Status = 'AssignedToDoctor' THEN 'AssignedToDoctor' ELSE 'Triaged' END,
                    TriagedBy = @TriagedBy,
                    UpdatedAt = GETDATE()
                WHERE Id = @TriageId AND TenantId = @TenantId;";

            await conn.ExecuteAsync(updateSql, new {
                TriageId = triageId,
                TenantId = tenantId,
                dto.TriageCategory,
                dto.PriorityLevel,
                dto.SystolicBP,
                dto.DiastolicBP,
                dto.HeartRate,
                dto.RespiratoryRate,
                dto.Temperature,
                dto.OxygenSaturation,
                dto.WeightKg,
                dto.HeightCm,
                Bmi = bmi ?? dto.Bmi,
                dto.BloodGlucose,
                dto.PainScale,
                dto.ChiefComplaint,
                dto.NurseNotes,
                TriagedBy = dto.TriagedBy > 0 ? dto.TriagedBy : 1
            });
        }
        else
        {
            var sql = @"
                INSERT INTO PatientTriage (
                    TenantId, PatientId, AppointmentId, QueueId, TriageCategory, PriorityLevel,
                    SystolicBP, DiastolicBP, HeartRate, RespiratoryRate, Temperature, OxygenSaturation,
                    WeightKg, HeightCm, Bmi, BloodGlucose, PainScale, ChiefComplaint, NurseNotes,
                    Status, TriagedBy, TriagedAt, UpdatedAt
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @TenantId, @PatientId, @AppointmentId, @QueueId, @TriageCategory, @PriorityLevel,
                    @SystolicBP, @DiastolicBP, @HeartRate, @RespiratoryRate, @Temperature, @OxygenSaturation,
                    @WeightKg, @HeightCm, @Bmi, @BloodGlucose, @PainScale, @ChiefComplaint, @NurseNotes,
                    'WaitingTriage', @TriagedBy, GETDATE(), GETDATE()
                );";

            triageId = await conn.ExecuteScalarAsync<int>(sql, new {
                TenantId = tenantId,
                dto.PatientId, dto.AppointmentId, dto.QueueId,
                dto.TriageCategory, dto.PriorityLevel,
                dto.SystolicBP, dto.DiastolicBP, dto.HeartRate, dto.RespiratoryRate,
                dto.Temperature, dto.OxygenSaturation, dto.WeightKg, dto.HeightCm,
                Bmi = bmi ?? dto.Bmi,
                dto.BloodGlucose, dto.PainScale, dto.ChiefComplaint, dto.NurseNotes,
                TriagedBy = dto.TriagedBy > 0 ? dto.TriagedBy : 1
            });
        }

        try
        {
            bool isEmergency = dto.PriorityLevel == 1 || (dto.TriageCategory != null && dto.TriageCategory.Contains("Emergency", StringComparison.OrdinalIgnoreCase));
            var notifType = isEmergency ? "EmergencyTriage" : "PatientCheckIn";
            var notifSub = isEmergency 
                ? $"Emergency Triage Alert: Patient #{dto.PatientId}" 
                : $"Patient Triaged: #{dto.PatientId} ({dto.TriageCategory ?? "Routine"})";
            var notifBody = isEmergency
                ? $"Patient #{dto.PatientId} flagged with critical vitals (BP {dto.SystolicBP}/{dto.DiastolicBP}, HR {dto.HeartRate}, SpO2 {dto.OxygenSaturation}%). Immediate doctor review required."
                : $"Patient #{dto.PatientId} triaged: BP {dto.SystolicBP}/{dto.DiastolicBP}, Chief Complaint: {dto.ChiefComplaint ?? "Routine assessment"}. Ready for doctor.";

            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, @Subject, @Body, @Priority, @NotificationType, 'Doctor,Nurse,Admin', @RefId, 1, GETDATE())",
                new { TenantId = tenantId, Subject = notifSub, Body = notifBody, Priority = isEmergency ? 1 : 2, NotificationType = notifType, RefId = triageId });
        }
        catch { /* non-blocking notification */ }

        return Ok(ApiResponse<object>.Ok(new { TriageId = triageId, Bmi = bmi }));
    }

    [HttpPost("hold")]
    public async Task<IActionResult> HoldAppointment([FromBody] HoldAppointmentDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE PatientTriage
            SET Status = 'OnHold',
                HoldReason = @HoldReason,
                HoldDurationMin = @HoldDurationMin,
                UpdatedAt = GETDATE()
            WHERE Id = @TriageId AND TenantId = @TenantId;";

        await conn.ExecuteAsync(sql, new {
            dto.TriageId,
            TenantId = tenantId,
            dto.HoldReason,
            dto.HoldDurationMin
        });

        if (dto.AppointmentId.HasValue && dto.AppointmentId.Value > 0)
        {
            await conn.ExecuteAsync(
                "UPDATE Appointments SET StatusId = 4, UpdatedAt = GETDATE() WHERE Id = @Id AND TenantId = @TenantId",
                new { Id = dto.AppointmentId.Value, TenantId = tenantId });
        }

        return Ok(ApiResponse<string>.Ok("Appointment placed on triage hold."));
    }

    [HttpPost("resume")]
    public async Task<IActionResult> ResumeAppointment([FromBody] ResumeAppointmentDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE PatientTriage
            SET Status = 'Triaged',
                HoldReason = NULL,
                HoldDurationMin = NULL,
                UpdatedAt = GETDATE()
            WHERE Id = @TriageId AND TenantId = @TenantId;";

        await conn.ExecuteAsync(sql, new {
            dto.TriageId,
            TenantId = tenantId
        });

        if (dto.AppointmentId.HasValue && dto.AppointmentId.Value > 0)
        {
            await conn.ExecuteAsync(
                "UPDATE Appointments SET StatusId = 2, UpdatedAt = GETDATE() WHERE Id = @Id AND TenantId = @TenantId",
                new { Id = dto.AppointmentId.Value, TenantId = tenantId });
        }

        return Ok(ApiResponse<string>.Ok("Appointment resumed and marked ready for doctor."));
    }

    [HttpPost("assign-doctor")]
    public async Task<IActionResult> AssignDoctor([FromBody] AssignDoctorDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE PatientTriage
            SET AssignedDoctorId = @DoctorId,
                AssignedRoomId = @RoomId,
                Status = 'AssignedToDoctor',
                UpdatedAt = GETDATE()
            WHERE Id = @TriageId AND TenantId = @TenantId;";

        await conn.ExecuteAsync(sql, new {
            dto.TriageId,
            TenantId = tenantId,
            dto.DoctorId,
            dto.RoomId
        });

        if (dto.AppointmentId.HasValue && dto.AppointmentId.Value > 0)
        {
            await conn.ExecuteAsync(
                "UPDATE Appointments SET DoctorId = @DoctorId, StatusId = 2, UpdatedAt = GETDATE() WHERE Id = @Id AND TenantId = @TenantId",
                new { Id = dto.AppointmentId.Value, dto.DoctorId, TenantId = tenantId });
        }

        return Ok(ApiResponse<string>.Ok("Patient assigned and routed to doctor successfully."));
    }
}
