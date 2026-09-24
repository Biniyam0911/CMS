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
            SELECT 
                u.Id,
                u.PatientId,
                p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                u.DoctorId,
                ISNULL(s.FirstName + ' ' + s.LastName, 'Attending Physician') AS DoctorName,
                u.EncounterDate,
                u.ChiefComplaint,
                u.HistoryOfIllness,
                u.PhysicalExam,
                u.Assessment,
                u.[Plan],
                u.VitalSigns,
                u.IsFinalized,
                u.FinalizedAt
            FROM (
                -- 1. Clinical Encounters (SOAP notes)
                SELECT 
                    e.Id,
                    e.TenantId,
                    e.PatientId,
                    e.DoctorId,
                    e.EncounterDate,
                    e.ChiefComplaint,
                    e.HistoryOfIllness,
                    e.PhysicalExam,
                    e.Assessment,
                    e.[Plan],
                    e.VitalSigns,
                    e.IsFinalized,
                    e.FinalizedAt
                FROM Encounters e WITH (NOLOCK)
                WHERE e.TenantId = @TenantId AND e.PatientId = @PatientId

                UNION ALL

                -- 2. Triage & Scheduled Visits (that do not already have an encounter recorded on the same date)
                SELECT 
                    t.Id + 1000000 AS Id,
                    t.TenantId,
                    t.PatientId,
                    t.AssignedDoctorId AS DoctorId,
                    CAST(t.TriagedAt AS DATE) AS EncounterDate,
                    COALESCE(t.ChiefComplaint, 'Outpatient Consultation') AS ChiefComplaint,
                    NULL AS HistoryOfIllness,
                    NULL AS PhysicalExam,
                    COALESCE(t.NurseNotes, t.TriageCategory, 'Consultation') AS Assessment,
                    t.Status AS [Plan],
                    NULL AS VitalSigns,
                    1 AS IsFinalized,
                    t.TriagedAt AS FinalizedAt
                FROM PatientTriage t WITH (NOLOCK)
                WHERE t.TenantId = @TenantId AND t.PatientId = @PatientId
                  AND NOT EXISTS (
                      SELECT 1 FROM Encounters ex WITH (NOLOCK)
                      WHERE ex.TenantId = @TenantId 
                        AND ex.PatientId = @PatientId
                        AND CAST(ex.EncounterDate AS DATE) = CAST(t.TriagedAt AS DATE)
                  )
            ) u
            JOIN Patients p WITH (NOLOCK) ON p.Id = u.PatientId
            LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = u.DoctorId
            LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
            ORDER BY u.EncounterDate DESC, u.Id DESC";

        var encounters = (await conn.QueryAsync<EncounterDto>(sql, new { TenantId = tenantId, PatientId = patientId })).ToList();
        return encounters;
    }

    public async Task<List<ProcedureOrderDto>> GetPatientProceduresAsync(byte tenantId, int patientId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT po.Id, po.EncounterId, po.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   po.OrderedBy,
                   ISNULL(s.Title + ' ' + s.FirstName + ' ' + s.LastName, 'Attending Physician') AS DoctorName,
                   po.ProcedureCode, po.ProcedureName, po.ClinicalNotes,
                   po.StatusId,
                   CASE po.StatusId
                       WHEN 1 THEN 'Ordered'
                       WHEN 2 THEN 'Scheduled'
                       WHEN 3 THEN 'InProgress'
                       WHEN 4 THEN 'Completed'
                       WHEN 5 THEN 'Cancelled'
                       ELSE 'Ordered'
                   END AS StatusName,
                   po.CreatedAt, po.PerformedAt, po.ProcedureResult
            FROM ProcedureOrders po
            JOIN Patients p ON p.Id = po.PatientId
            LEFT JOIN Users u ON u.Id = po.OrderedBy
            LEFT JOIN Staff s ON s.UserId = u.Id
            LEFT JOIN Users pu ON pu.Id = po.PerformedBy
            LEFT JOIN Staff ps ON ps.UserId = pu.Id
            WHERE po.TenantId = @TenantId AND po.PatientId = @PatientId
            ORDER BY po.CreatedAt DESC";

        var procs = (await conn.QueryAsync<ProcedureOrderDto>(sql, new { TenantId = tenantId, PatientId = patientId })).ToList();
        return procs;
    }

    public async Task<int> CreateProcedureOrderAsync(byte tenantId, CreateProcedureOrderDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        int? encId = dto.EncounterId;
        if (!encId.HasValue || encId.Value <= 0)
        {
            encId = await conn.ExecuteScalarAsync<int?>(
                "SELECT TOP 1 Id FROM Encounters WHERE TenantId = @TenantId AND PatientId = @PatientId ORDER BY Id DESC",
                new { TenantId = tenantId, dto.PatientId });
        }

        var sql = @"
            INSERT INTO ProcedureOrders (TenantId, EncounterId, PatientId, OrderedBy, ProcedureCode, ProcedureName, ClinicalNotes, StatusId, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@TenantId, @EncounterId, @PatientId, @OrderedBy, @ProcedureCode, @ProcedureName, @ClinicalNotes, 1, GETDATE());";

        int id = await conn.ExecuteScalarAsync<int>(sql, new {
            TenantId = tenantId,
            EncounterId = encId,
            dto.PatientId,
            dto.OrderedBy,
            dto.ProcedureCode,
            dto.ProcedureName,
            dto.ClinicalNotes
        });
        return id;
    }
}
