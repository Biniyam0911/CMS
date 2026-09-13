using System.Security.Cryptography;
using System.Text;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Encounters;

public class SoapAndClinicalService
{
    private readonly IDbConnectionFactory _dbFactory;

    public SoapAndClinicalService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<int> IssueMedicalCertificateAsync(CreateMedicalCertificateDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var certNo = $"MC-{DateTime.UtcNow.Year}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";
        var daysExcused = (int)(dto.EndDate.Date - dto.StartDate.Date).TotalDays + 1;
        if (daysExcused < 1) daysExcused = 1;

        var qrCode = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{certNo}|{dto.PatientId}|{dto.StartDate:yyyy-MM-dd}")))[..16];

        var sql = @"
            INSERT INTO MedicalCertificates (TenantId, CertificateNo, PatientId, DoctorId, EncounterId,
                                            CertificateType, DiagnosisSummary, Recommendation, StartDate, EndDate,
                                            DaysExcused, QrVerificationCode, IsIssued)
            VALUES (@TenantId, @CertificateNo, @PatientId, @DoctorId, @EncounterId,
                    @CertificateType, @DiagnosisSummary, @Recommendation, @StartDate, @EndDate,
                    @DaysExcused, @QrVerificationCode, 1);
            SELECT SCOPE_IDENTITY();";

        return await conn.ExecuteScalarAsync<int>(sql, new {
            dto.TenantId, CertificateNo = certNo, dto.PatientId, dto.DoctorId, dto.EncounterId,
            dto.CertificateType, dto.DiagnosisSummary, dto.Recommendation, dto.StartDate, dto.EndDate,
            DaysExcused = daysExcused, QrVerificationCode = qrCode
        });
    }

    public async Task<List<MedicalCertificateDto>> GetPatientCertificatesAsync(int patientId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT mc.Id, mc.CertificateNo, mc.PatientId, p.FirstName + ' ' + p.LastName AS PatientName,
                   mc.DoctorId, s.FirstName + ' ' + s.LastName AS DoctorName,
                   mc.EncounterId, mc.CertificateType, mc.DiagnosisSummary, mc.Recommendation,
                   mc.StartDate, mc.EndDate, mc.DaysExcused, mc.QrVerificationCode, mc.IssuedAt
            FROM MedicalCertificates mc
            JOIN Patients p ON p.Id = mc.PatientId
            JOIN Doctors d ON d.Id = mc.DoctorId
            JOIN Staff s ON s.Id = d.StaffId
            WHERE mc.PatientId = @PatientId
            ORDER BY mc.IssuedAt DESC";

        return (await conn.QueryAsync<MedicalCertificateDto>(sql, new { PatientId = patientId })).ToList();
    }

    public async Task<int> CreateProcedureOrderAsync(CreateProcedureOrderDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO ProcedureOrders (TenantId, EncounterId, PatientId, OrderedBy, ProcedureCode, ProcedureName, ClinicalNotes, StatusId)
            VALUES (@TenantId, @EncounterId, @PatientId, @OrderedBy, @ProcedureCode, @ProcedureName, @ClinicalNotes, 1);
            SELECT SCOPE_IDENTITY();";

        int orderId = await conn.ExecuteScalarAsync<int>(sql, dto);

        try
        {
            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, 'Procedure Ordered: ' + @ProcedureName, 'Clinical procedure ' + @ProcedureName + ' (' + @ProcedureCode + ') ordered for patient #' + CAST(@PatientId AS VARCHAR) + '.', 2, 'ProcedureOrdered', 'Doctor,Nurse,Admin', @RefId, 1, GETDATE())",
                new { dto.TenantId, dto.ProcedureName, dto.ProcedureCode, dto.PatientId, RefId = orderId });
        }
        catch { /* non-blocking notification */ }

        return orderId;
    }

    public async Task<List<ProcedureOrderDto>> GetPatientProceduresAsync(int patientId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT po.Id, po.EncounterId, po.PatientId, p.FirstName + ' ' + p.LastName AS PatientName,
                   po.OrderedBy, ISNULL(s.FirstName + ' ' + s.LastName, 'Attending Physician') AS DoctorName,
                   po.ProcedureCode, po.ProcedureName, po.ClinicalNotes, po.StatusId,
                   CASE po.StatusId WHEN 1 THEN 'Ordered' WHEN 2 THEN 'Scheduled' WHEN 3 THEN 'InProgress' WHEN 4 THEN 'Completed' ELSE 'Cancelled' END AS StatusName,
                   po.CreatedAt, po.PerformedAt, po.ProcedureResult
            FROM ProcedureOrders po
            JOIN Patients p ON p.Id = po.PatientId
            LEFT JOIN Staff s ON s.UserId = po.OrderedBy
            WHERE po.PatientId = @PatientId
            ORDER BY po.CreatedAt DESC";

        return (await conn.QueryAsync<ProcedureOrderDto>(sql, new { PatientId = patientId })).ToList();
    }

    public async Task<List<ProcedureOrderDto>> GetProcedureQueueAsync(byte tenantId, DateTime? date = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT po.Id, po.EncounterId, po.PatientId, p.FirstName + ' ' + p.LastName AS PatientName,
                   po.OrderedBy, ISNULL(s.FirstName + ' ' + s.LastName, 'Attending Physician') AS DoctorName,
                   po.ProcedureCode, po.ProcedureName, po.ClinicalNotes, po.StatusId,
                   CASE po.StatusId WHEN 1 THEN 'Ordered' WHEN 2 THEN 'Scheduled' WHEN 3 THEN 'InProgress' WHEN 4 THEN 'Completed' ELSE 'Cancelled' END AS StatusName,
                   po.CreatedAt, po.PerformedAt, po.ProcedureResult
            FROM ProcedureOrders po
            JOIN Patients p ON p.Id = po.PatientId
            LEFT JOIN Staff s ON s.UserId = po.OrderedBy
            WHERE po.TenantId = @TenantId AND po.StatusId IN (1, 2, 3)
              AND (@Date IS NULL OR CAST(po.CreatedAt AS DATE) = CAST(@Date AS DATE))
            ORDER BY po.CreatedAt ASC";

        return (await conn.QueryAsync<ProcedureOrderDto>(sql, new { TenantId = tenantId, Date = date })).ToList();
    }
}
