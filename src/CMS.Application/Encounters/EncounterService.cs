using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Encounters;

public class EncounterService
{
    private readonly IDbConnectionFactory _dbFactory;

    public EncounterService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<int> CreateEncounterAsync(CreateEncounterDto dto)
    {
        using var conn = _dbFactory.CreateConnection();

        int? validAppointmentId = null;
        if (dto.AppointmentId.HasValue && dto.AppointmentId.Value > 0)
        {
            var apptExists = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM Appointments WHERE Id = @Id AND TenantId = @TenantId",
                new { Id = dto.AppointmentId.Value, dto.TenantId });
            if (apptExists > 0) validAppointmentId = dto.AppointmentId.Value;
        }

        var sql = @"
            INSERT INTO Encounters (TenantId, AppointmentId, PatientId, DoctorId, EncounterDate, EncounterTime,
                                    ChiefComplaint, HistoryOfIllness, PhysicalExam, Assessment, [Plan], VitalSigns, IsFinalized, FinalizedAt, CreatedBy, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@TenantId, @AppointmentId, @PatientId, @DoctorId, CAST(GETDATE() AS DATE), CAST(GETDATE() AS TIME),
                    @ChiefComplaint, @HistoryOfIllness, @PhysicalExam, @Assessment, @Plan, @VitalSigns, 1, GETDATE(), @CreatedBy, GETDATE());";

        int id = await conn.ExecuteScalarAsync<int>(sql, new {
            dto.TenantId,
            AppointmentId = validAppointmentId,
            dto.PatientId,
            DoctorId = dto.DoctorId > 0 ? dto.DoctorId : 1,
            dto.ChiefComplaint,
            dto.HistoryOfIllness,
            dto.PhysicalExam,
            dto.Assessment,
            Plan = dto.Plan ?? dto.SoapPlan,
            dto.VitalSigns,
            CreatedBy = dto.CreatedBy > 0 ? dto.CreatedBy : 1
        });
        return id;
    }

    public async Task AddDiagnosisAsync(CreateDiagnosisDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO Diagnoses (EncounterId, DiagnosisCode, DiagnosisText, DiagnosisType)
            VALUES (@EncounterId, @DiagnosisCode, @DiagnosisText, @DiagnosisType)";

        await conn.ExecuteAsync(sql, dto);
    }

    public async Task<List<EncounterDto>> GetPatientEncountersAsync(byte tenantId, int patientId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT e.Id, e.PatientId, p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   e.DoctorId, ISNULL(s.FirstName + ' ' + s.LastName, 'Dr. Kebede Biniyam') AS DoctorName,
                   e.EncounterDate, e.ChiefComplaint, e.HistoryOfIllness,
                   e.PhysicalExam, e.Assessment, e.[Plan], e.VitalSigns,
                   e.IsFinalized, e.FinalizedAt
            FROM Encounters e
            JOIN Patients p ON p.Id = e.PatientId
            LEFT JOIN Doctors d ON d.Id = e.DoctorId
            LEFT JOIN Staff s ON s.Id = d.StaffId
            WHERE e.TenantId = @TenantId AND e.PatientId = @PatientId
            ORDER BY e.Id DESC";

        var encounters = (await conn.QueryAsync<EncounterDto>(sql, new { TenantId = tenantId, PatientId = patientId })).ToList();
        return encounters;
    }
}
