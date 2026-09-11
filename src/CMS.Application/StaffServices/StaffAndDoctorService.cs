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

    public async Task<List<SpecializationDto>> GetSpecializationsAsync()
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = "SELECT CAST(Id AS INT) AS Id, CAST(Code AS NVARCHAR(50)) AS SpecializationCode, CAST(Name AS NVARCHAR(150)) AS SpecializationName, CAST('' AS NVARCHAR(255)) AS Description FROM Specializations ORDER BY Name";
        var list = (await conn.QueryAsync<SpecializationDto>(sql)).ToList();
        return list;
    }

    public async Task<List<StaffDetailDto>> GetAllStaffAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT s.Id, s.TenantId, s.UserId, s.StaffCode, s.Title, s.FirstName, s.LastName,
                   s.Phone, s.Email, s.PrimaryRoleId, ISNULL(r.Name, 'Staff') AS RoleName,
                   s.Department, s.IsActive,
                   d.Id AS DoctorId, d.LicenseNumber, d.SpecializationId,
                   ISNULL(sp.Name, '') AS SpecializationName,
                   d.SubSpecialization, d.ConsultationFee
            FROM Staff s
            LEFT JOIN Roles r ON r.Id = s.PrimaryRoleId
            LEFT JOIN Doctors d ON d.StaffId = s.Id
            LEFT JOIN Specializations sp ON sp.Id = d.SpecializationId
            WHERE s.TenantId = @TenantId
            ORDER BY s.LastName, s.FirstName";

        return (await conn.QueryAsync<StaffDetailDto>(sql, new { TenantId = tenantId })).ToList();
    }

    public async Task<bool> UpdateStaffAsync(byte tenantId, UpdateStaffDto dto)
    {
        using var conn = _dbFactory.CreateConnection();

        // 1. Update Staff record
        var sqlStaff = @"
            UPDATE Staff
            SET Title = @Title,
                FirstName = @FirstName,
                LastName = @LastName,
                Phone = @Phone,
                Email = @Email,
                PrimaryRoleId = ISNULL(@PrimaryRoleId, PrimaryRoleId),
                Department = @Department,
                IsActive = @IsActive,
                UpdatedAt = GETDATE()
            WHERE Id = @Id AND TenantId = @TenantId;";

        await conn.ExecuteAsync(sqlStaff, new {
            dto.Id,
            TenantId = tenantId,
            dto.Title,
            dto.FirstName,
            dto.LastName,
            dto.Phone,
            dto.Email,
            dto.PrimaryRoleId,
            dto.Department,
            dto.IsActive
        });

        // 2. If staff is linked to a user, update User record too
        if (dto.UserId.HasValue && dto.UserId.Value > 0)
        {
            var sqlUser = @"
                UPDATE Users
                SET FirstName = @FirstName,
                    LastName = @LastName,
                    Email = ISNULL(@Email, Email),
                    Phone = ISNULL(@Phone, Phone),
                    IsActive = @IsActive
                WHERE Id = @UserId AND TenantId = @TenantId;";

            await conn.ExecuteAsync(sqlUser, new {
                UserId = dto.UserId.Value,
                TenantId = tenantId,
                dto.FirstName,
                dto.LastName,
                dto.Email,
                dto.Phone,
                dto.IsActive
            });
        }

        // 3. Update or Insert Doctor record if SpecializationId or LicenseNumber provided
        if (dto.SpecializationId.HasValue || !string.IsNullOrWhiteSpace(dto.LicenseNumber))
        {
            var existingDoc = await conn.QueryFirstOrDefaultAsync<int?>(
                "SELECT Id FROM Doctors WHERE StaffId = @StaffId", new { StaffId = dto.Id });

            if (existingDoc.HasValue && existingDoc.Value > 0)
            {
                var sqlDoc = @"
                    UPDATE Doctors
                    SET LicenseNumber = ISNULL(@LicenseNumber, LicenseNumber),
                        SpecializationId = ISNULL(@SpecializationId, SpecializationId),
                        SubSpecialization = @SubSpecialization,
                        ConsultationFee = @ConsultationFee,
                        IsAvailable = @IsActive
                    WHERE Id = @DoctorId;";

                await conn.ExecuteAsync(sqlDoc, new {
                    DoctorId = existingDoc.Value,
                    dto.LicenseNumber,
                    dto.SpecializationId,
                    dto.SubSpecialization,
                    dto.ConsultationFee,
                    dto.IsActive
                });
            }
            else if (dto.SpecializationId.HasValue)
            {
                var sqlNewDoc = @"
                    INSERT INTO Doctors (StaffId, LicenseNumber, SpecializationId, SubSpecialization, ConsultationFee, IsAvailable)
                    VALUES (@StaffId, ISNULL(@LicenseNumber, 'LIC-' + CAST(@StaffId AS VARCHAR)), @SpecializationId, @SubSpecialization, @ConsultationFee, @IsActive);";

                await conn.ExecuteAsync(sqlNewDoc, new {
                    StaffId = dto.Id,
                    dto.LicenseNumber,
                    SpecializationId = dto.SpecializationId.Value,
                    dto.SubSpecialization,
                    dto.ConsultationFee,
                    dto.IsActive
                });
            }
        }

        // Invalidate cache
        await _cache.RemoveAsync($"tenant:{tenantId}:doctors:all");
        return true;
    }
}
