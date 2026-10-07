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
        int? encId = dto.EncounterId;
        if (!encId.HasValue || encId.Value <= 0)
        {
            encId = await conn.ExecuteScalarAsync<int?>(
                "SELECT TOP 1 Id FROM Encounters WHERE TenantId = @TenantId AND PatientId = @PatientId ORDER BY Id DESC",
                new { dto.TenantId, dto.PatientId });

            if (!encId.HasValue || encId.Value <= 0)
            {
                encId = await conn.ExecuteScalarAsync<int>(@"
                    INSERT INTO Encounters (TenantId, PatientId, DoctorId, EncounterDate, StatusId, CreatedAt)
                    VALUES (@TenantId, @PatientId, @DoctorId, GETDATE(), 1, GETDATE());
                    SELECT SCOPE_IDENTITY();",
                    new { dto.TenantId, dto.PatientId, DoctorId = dto.OrderedBy });
            }
        }

        var sql = @"
            INSERT INTO ProcedureOrders (TenantId, EncounterId, PatientId, OrderedBy, ProcedureCode, ProcedureName, ClinicalNotes, StatusId, CreatedAt)
            VALUES (@TenantId, @EncounterId, @PatientId, @OrderedBy, @ProcedureCode, @ProcedureName, @ClinicalNotes, 1, GETDATE());
            SELECT SCOPE_IDENTITY();";

        int orderId = await conn.ExecuteScalarAsync<int>(sql, new {
            dto.TenantId,
            EncounterId = encId.Value,
            dto.PatientId,
            dto.OrderedBy,
            dto.ProcedureCode,
            dto.ProcedureName,
            dto.ClinicalNotes
        });

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
            WITH CombinedProcedures AS (
                -- 1. Procedures from ProcedureOrders table
                SELECT po.Id, po.EncounterId, po.PatientId, p.FirstName + ' ' + p.LastName AS PatientName,
                       po.OrderedBy, ISNULL(s.FirstName + ' ' + s.LastName, 'Attending Physician') AS DoctorName,
                       po.ProcedureCode, po.ProcedureName, po.ClinicalNotes, po.StatusId,
                       CASE po.StatusId WHEN 1 THEN 'Ordered' WHEN 2 THEN 'Scheduled' WHEN 3 THEN 'InProgress' WHEN 4 THEN 'Completed' ELSE 'Cancelled' END AS StatusName,
                       po.CreatedAt, po.PerformedAt, po.ProcedureResult
                FROM ProcedureOrders po WITH (NOLOCK)
                JOIN Patients p WITH (NOLOCK) ON p.Id = po.PatientId
                LEFT JOIN Staff s WITH (NOLOCK) ON s.UserId = po.OrderedBy OR s.Id = po.OrderedBy
                WHERE po.TenantId = @TenantId
                  AND (@Date IS NULL OR CAST(po.CreatedAt AS DATE) = CAST(@Date AS DATE))

                UNION ALL

                -- 2. Billed procedures from InvoiceItems (ItemType = 4 or Procedure items) so existing clinical procedures show in the nurse queue
                SELECT 
                    (ii.Id + 1000000) AS Id,
                    ISNULL(inv.EncounterId, 0) AS EncounterId,
                    inv.PatientId,
                    p.FirstName + ' ' + p.LastName AS PatientName,
                    ISNULL(inv.DoctorId, 0) AS OrderedBy,
                    ISNULL(doc.DoctorName, 'Attending Physician') AS DoctorName,
                    ISNULL(s.Code, 'PROC') AS ProcedureCode,
                    ii.Description AS ProcedureName,
                    'Billed clinical procedure' AS ClinicalNotes,
                    CASE inv.StatusId WHEN 4 THEN CAST(4 AS TINYINT) ELSE CAST(1 AS TINYINT) END AS StatusId,
                    CASE inv.StatusId WHEN 4 THEN 'Completed' ELSE 'Ordered' END AS StatusName,
                    ISNULL(inv.IssueDate, GETDATE()) AS CreatedAt,
                    CASE WHEN inv.StatusId = 4 THEN inv.IssueDate ELSE NULL END AS PerformedAt,
                    NULL AS ProcedureResult
                FROM InvoiceItems ii WITH (NOLOCK)
                JOIN Invoices inv WITH (NOLOCK) ON inv.Id = ii.InvoiceId
                JOIN Patients p WITH (NOLOCK) ON p.Id = inv.PatientId
                LEFT JOIN Services s WITH (NOLOCK) ON s.Name = ii.Description
                OUTER APPLY (
                    SELECT TOP 1 ISNULL(st.FirstName + ' ' + st.LastName, 'Attending Physician') AS DoctorName
                    FROM Doctors d WITH (NOLOCK)
                    JOIN Staff st WITH (NOLOCK) ON st.Id = d.StaffId
                    WHERE d.Id = inv.DoctorId
                ) doc
                WHERE inv.TenantId = @TenantId
                  AND (ii.ItemType = 4 
                       OR ii.ItemType = 3
                       OR EXISTS (SELECT 1 FROM Services s2 WITH (NOLOCK) WHERE s2.Name = ii.Description AND s2.Category IN ('Procedure', 'Facial'))
                       OR ii.Description LIKE '%PRP%'
                       OR ii.Description LIKE '%FACIAL%'
                       OR ii.Description LIKE '%Treatment%'
                       OR ii.Description LIKE '%Cryo%'
                       OR ii.Description LIKE '%Electro%'
                       OR ii.Description LIKE '%Biopsy%'
                       OR ii.Description LIKE '%Injection%'
                       OR ii.Description LIKE '%Scar%'
                       OR ii.Description LIKE '%Steroid%'
                       OR ii.Description LIKE '%Peel%')
                  AND (@Date IS NULL OR CAST(inv.IssueDate AS DATE) = CAST(@Date AS DATE))
            )
            SELECT * FROM CombinedProcedures
            ORDER BY CreatedAt DESC";

        return (await conn.QueryAsync<ProcedureOrderDto>(sql, new { TenantId = tenantId, Date = date })).ToList();
    }
}
