using System.Security.Cryptography;
using System.Text;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Settings;

public class SettingsAndApiService
{
    private readonly IDbConnectionFactory _dbFactory;

    public SettingsAndApiService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<List<ClinicSettingDto>> GetClinicSettingsAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = "SELECT Id, SettingKey, SettingValue, Category, Description FROM ClinicSettings WHERE TenantId = @TenantId ORDER BY Category, SettingKey";
        return (await conn.QueryAsync<ClinicSettingDto>(sql, new { TenantId = tenantId })).ToList();
    }

    public async Task UpdateSettingAsync(byte tenantId, string key, string value)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            IF EXISTS (SELECT 1 FROM ClinicSettings WHERE TenantId = @TenantId AND SettingKey = @SettingKey)
                UPDATE ClinicSettings SET SettingValue = @SettingValue, UpdatedAt = GETDATE() WHERE TenantId = @TenantId AND SettingKey = @SettingKey;
            ELSE
                INSERT INTO ClinicSettings (TenantId, SettingKey, SettingValue) VALUES (@TenantId, @SettingKey, @SettingValue);";

        await conn.ExecuteAsync(sql, new { TenantId = tenantId, SettingKey = key, SettingValue = value });
    }

    public async Task<CreateApiKeyResponse> CreateApiKeyAsync(CreateApiKeyDto dto, int userId)
    {
        using var conn = _dbFactory.CreateConnection();
        var rawKey = $"cms_live_{Guid.NewGuid():N}{Guid.NewGuid():N}";
        var prefix = rawKey[..10];
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawKey)));

        var sql = @"
            INSERT INTO ApiKeys (TenantId, Name, KeyPrefix, KeyHash, RateLimitRpm, AllowedIps, ExpiresAt, CreatedBy)
            VALUES (@TenantId, @Name, @KeyPrefix, @KeyHash, @RateLimitRpm, @AllowedIps, DATEADD(DAY, @DaysValid, GETDATE()), @CreatedBy);
            SELECT SCOPE_IDENTITY();";

        int id = await conn.ExecuteScalarAsync<int>(sql, new {
            dto.TenantId, dto.Name, KeyPrefix = prefix, KeyHash = hash,
            dto.RateLimitRpm, dto.AllowedIps, dto.DaysValid, CreatedBy = userId
        });

        return new CreateApiKeyResponse(id, dto.Name, rawKey, prefix);
    }

    public async Task<List<ApiKeyDto>> GetApiKeysAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = "SELECT Id, TenantId, Name, KeyPrefix, RateLimitRpm, AllowedIps, ExpiresAt, IsActive, LastUsedAt, CreatedAt FROM ApiKeys WHERE TenantId = @TenantId ORDER BY CreatedAt DESC";
        return (await conn.QueryAsync<ApiKeyDto>(sql, new { TenantId = tenantId })).ToList();
    }

    public async Task<List<IntegrationConfigDto>> GetIntegrationsAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = "SELECT Id, ProviderCode, ProviderType, DisplayName, IsEnabled, IsPrimary, HealthStatus, ErrorMessage, UpdatedAt FROM IntegrationConfigs WHERE TenantId = @TenantId ORDER BY ProviderType, DisplayName";
        return (await conn.QueryAsync<IntegrationConfigDto>(sql, new { TenantId = tenantId })).ToList();
    }

    public async Task UpdateIntegrationAsync(byte tenantId, UpdateIntegrationDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE IntegrationConfigs
            SET IsEnabled = @IsEnabled, IsPrimary = @IsPrimary,
                CredentialsJson = COALESCE(@CredentialsJson, CredentialsJson),
                HealthStatus = CASE WHEN @IsEnabled = 1 THEN 'Healthy' ELSE 'Unknown' END,
                UpdatedAt = GETDATE()
            WHERE TenantId = @TenantId AND ProviderCode = @ProviderCode;";

        await conn.ExecuteAsync(sql, new { TenantId = tenantId, dto.ProviderCode, dto.IsEnabled, dto.IsPrimary, dto.CredentialsJson });
    }
}
