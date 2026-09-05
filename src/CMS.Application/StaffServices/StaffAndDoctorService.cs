using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.StaffServices;

public class StaffAndDoctorService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;

    public StaffAndDoctorService(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    public async Task<List<DoctorDto>> GetDoctorsAsync(byte tenantId)
    {
        var cacheKey = $"tenant:{tenantId}:doctors:all";
        var cached = await _cache.GetAsync<List<DoctorDto>>(cacheKey);
        if (cached != null) return cached;

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT d.Id, d.StaffId, st.StaffCode,
                   st.Title + ' ' + st.FirstName + ' ' + st.LastName AS DoctorName,
                   d.LicenseNumber, d.SpecializationId, sp.Name AS SpecializationName,
                   d.SubSpecialization, d.ConsultationFee, d.IsAvailable
            FROM Doctors d
            JOIN Staff st ON st.Id = d.StaffId
            LEFT JOIN Specializations sp ON sp.Id = d.SpecializationId
            WHERE st.TenantId = @TenantId AND st.IsActive = 1";

        var doctors = (await conn.QueryAsync<DoctorDto>(sql, new { TenantId = tenantId })).ToList();
        await _cache.SetAsync(cacheKey, doctors, TimeSpan.FromMinutes(15));
        return doctors;
    }

    public async Task<List<DoctorScheduleDto>> GetDoctorSchedulesAsync(int doctorId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT Id, DoctorId, DayOfWeek, CAST(StartTime AS VARCHAR(8)) AS StartTime,
                   CAST(EndTime AS VARCHAR(8)) AS EndTime, SlotMinutes, IsActive
            FROM DoctorSchedules
            WHERE DoctorId = @DoctorId AND IsActive = 1
            ORDER BY DayOfWeek, StartTime";

        return (await conn.QueryAsync<DoctorScheduleDto>(sql, new { DoctorId = doctorId })).ToList();
    }
}
