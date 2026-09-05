using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.PatientPortal;

public class PatientPortalService
{
    private readonly IDbConnectionFactory _dbFactory;

    public PatientPortalService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<PatientDto?> GetPatientProfileAsync(byte tenantId, int userId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT Id, TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender, PrimaryPhone, Email, Address, InsuranceProvider, Allergies, IsActive
            FROM Patients
            WHERE TenantId = @TenantId AND UserId = @UserId AND IsActive = 1";

        return await conn.QueryFirstOrDefaultAsync<PatientDto>(sql, new { TenantId = tenantId, UserId = userId });
    }

    public async Task<List<AppointmentDto>> GetPatientAppointmentsAsync(byte tenantId, int patientId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT a.Id, a.PatientId, p.FirstName + ' ' + p.LastName AS PatientName,
                   a.DoctorId, s.FirstName + ' ' + s.LastName AS DoctorName,
                   a.SlotDateTime, a.DurationMinutes, a.StatusId, st.Name AS StatusName,
                   a.ReasonForVisit
            FROM Appointments a
            JOIN Patients p ON p.Id = a.PatientId
            JOIN Doctors d ON d.Id = a.DoctorId
            JOIN Staff s ON s.Id = d.StaffId
            JOIN AppointmentStatuses st ON st.Id = a.StatusId
            WHERE a.TenantId = @TenantId AND a.PatientId = @PatientId
            ORDER BY a.SlotDateTime DESC";

        return (await conn.QueryAsync<AppointmentDto>(sql, new { TenantId = tenantId, PatientId = patientId })).ToList();
    }

    public async Task<List<dynamic>> GetVerifiedLabResultsAsync(byte tenantId, int patientId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT r.Id, r.EnteredAt, r.VerifiedAt, t.TestName, t.Category,
                   r.NumericValue, r.TextValue, r.Unit, r.Flag, r.ReferenceRange
            FROM LabResults r
            JOIN LabTestCatalog t ON t.Id = r.TestId
            WHERE r.PatientId = @PatientId AND r.IsVerified = 1
            ORDER BY r.VerifiedAt DESC";

        return (await conn.QueryAsync(sql, new { PatientId = patientId })).ToList();
    }
}
