using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Appointments;

public class AppointmentService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;

    public AppointmentService(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    public async Task<int> CreateAppointmentAsync(CreateAppointmentDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@TenantId", dto.TenantId);
        p.Add("@PatientId", dto.PatientId);
        p.Add("@DoctorId", dto.DoctorId);
        p.Add("@SlotDateTime", dto.SlotDateTime);
        p.Add("@DurationMin", dto.DurationMinutes);
        p.Add("@Reason", dto.ReasonForVisit);
        p.Add("@BookedBy", 1);
        p.Add("@NewId", dbType: System.Data.DbType.Int32, direction: System.Data.ParameterDirection.Output);

        await conn.ExecuteAsync("sp_CreateAppointment", p, commandType: System.Data.CommandType.StoredProcedure);
        int newId = p.Get<int>("@NewId");

        await _cache.RemoveByPrefixAsync($"tenant:{dto.TenantId}:appointments");
        return newId;
    }

    public async Task<List<AppointmentDto>> GetDoctorAppointmentsAsync(byte tenantId, int doctorId, DateTime date)
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
            WHERE a.TenantId = @TenantId AND a.DoctorId = @DoctorId
              AND CAST(a.SlotDateTime AS DATE) = CAST(@Date AS DATE)
            ORDER BY a.SlotDateTime";

        return (await conn.QueryAsync<AppointmentDto>(sql, new { TenantId = tenantId, DoctorId = doctorId, Date = date })).ToList();
    }
}
