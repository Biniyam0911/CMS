using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Modules;

public class ModuleManagementService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;

    public ModuleManagementService(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    public async Task<List<AppModuleDto>> GetTenantModulesAsync(byte tenantId)
    {
        var cacheKey = $"tenant:{tenantId}:modules";
        var cached = await _cache.GetAsync<List<AppModuleDto>>(cacheKey);
        if (cached != null) return cached;

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT m.Id, m.ModuleCode, m.Name, m.Description, m.Category, m.IconName, m.Version, m.IsCore,
                   ISNULL(tms.IsEnabled, 1) AS IsEnabled, tms.CustomConfigJson
            FROM AppModuleRegistry m
            LEFT JOIN TenantModuleSettings tms ON tms.ModuleId = m.Id AND tms.TenantId = @TenantId
            ORDER BY m.Category, m.Name";

        var modules = (await conn.QueryAsync<AppModuleDto>(sql, new { TenantId = tenantId })).ToList();
        await _cache.SetAsync(cacheKey, modules, TimeSpan.FromHours(4));
        return modules;
    }

    public async Task ToggleModuleAsync(byte tenantId, int moduleId, bool isEnabled)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            IF EXISTS (SELECT 1 FROM TenantModuleSettings WHERE TenantId = @TenantId AND ModuleId = @ModuleId)
            BEGIN
                UPDATE TenantModuleSettings SET IsEnabled = @IsEnabled, UpdatedAt = GETDATE()
                WHERE TenantId = @TenantId AND ModuleId = @ModuleId;
            END
            ELSE
            BEGIN
                INSERT INTO TenantModuleSettings (TenantId, ModuleId, IsEnabled)
                VALUES (@TenantId, @ModuleId, @IsEnabled);
            END";

        await conn.ExecuteAsync(sql, new { TenantId = tenantId, ModuleId = moduleId, IsEnabled = isEnabled });
        await _cache.RemoveAsync($"tenant:{tenantId}:modules");
    }
}
