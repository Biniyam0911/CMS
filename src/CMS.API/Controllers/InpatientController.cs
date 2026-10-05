using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

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
