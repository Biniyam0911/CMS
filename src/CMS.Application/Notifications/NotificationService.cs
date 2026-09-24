using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Notifications;

public class NotificationService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;

    public NotificationService(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    public async Task<long> EnqueueNotificationAsync(EnqueueNotificationDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO Notifications (TenantId, RecipientUserId, RecipientEmail, RecipientPhone, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId)
            VALUES (@TenantId, @RecipientUserId, @RecipientEmail, @RecipientPhone, 3, @Subject, @Body, @Priority, ISNULL(@NotificationType, 'General'), @RefType, @RefId, 1);
            SELECT SCOPE_IDENTITY();";

        return await conn.ExecuteScalarAsync<long>(sql, dto);
    }

    public async Task<List<NotificationItemDto>> GetNotificationsAsync(byte tenantId, int? userId = null, string? role = null)
    {
        // 30-second cache per tenant+user to absorb concurrent polling from multiple browser tabs
        var cacheKey = $"notif:{tenantId}:{userId ?? 0}";
        var cached = await _cache.GetAsync<List<NotificationItemDto>>(cacheKey);
        if (cached != null) return cached;

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT TOP 50
                Id, TenantId, RecipientUserId,
                CASE Channel WHEN 1 THEN 'Email' WHEN 2 THEN 'SMS' WHEN 3 THEN 'InApp' ELSE 'All' END AS Channel,
                Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt,
                RefType AS TargetRole
            FROM Notifications WITH (NOLOCK)
            WHERE TenantId = @TenantId
              AND (RecipientUserId IS NULL OR @UserId IS NULL OR RecipientUserId = @UserId)
            ORDER BY StatusId ASC, Priority ASC, CreatedAt DESC";

        var list = (await conn.QueryAsync<NotificationItemDto>(sql, new { TenantId = tenantId, UserId = userId })).ToList();

        // Cache for 30 seconds — acceptable staleness for notification badge
        await _cache.SetAsync(cacheKey, list, TimeSpan.FromSeconds(30));
        return list;
    }

    public async Task<bool> MarkAsReadAsync(long notificationId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = "UPDATE Notifications SET StatusId = 2, SentAt = GETDATE() WHERE Id = @Id";
        int rows = await conn.ExecuteAsync(sql, new { Id = notificationId });
        return rows > 0;
    }

    public async Task<bool> MarkAllAsReadAsync(byte tenantId, int? userId = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE Notifications
            SET StatusId = 2, SentAt = GETDATE()
            WHERE TenantId = @TenantId
              AND StatusId = 1
              AND (RecipientUserId IS NULL OR @UserId IS NULL OR RecipientUserId = @UserId)";
        int rows = await conn.ExecuteAsync(sql, new { TenantId = tenantId, UserId = userId });
        return rows > 0;
    }

    public async Task<long> BroadcastNotificationAsync(byte tenantId, BroadcastNotificationDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, StatusId, CreatedAt)
            VALUES (@TenantId, NULL, 3, @Subject, @Body, @Priority, @NotificationType, @TargetRole, 1, GETDATE());
            SELECT SCOPE_IDENTITY();";

        return await conn.ExecuteScalarAsync<long>(sql, new {
            TenantId = tenantId,
            Subject = dto.Subject,
            Body = dto.Body,
            Priority = dto.Priority,
            NotificationType = dto.NotificationType,
            TargetRole = dto.TargetRole ?? "All"
        });
    }

    public async Task<string?> GetRoleNotificationRulesAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = "SELECT SettingValue FROM ClinicSettings WHERE TenantId = @TenantId AND SettingKey = 'Notification.RoleRules'";
        return await conn.QueryFirstOrDefaultAsync<string?>(sql, new { TenantId = tenantId });
    }

    public async Task<bool> SaveRoleNotificationRulesAsync(byte tenantId, string jsonRules)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            IF EXISTS (SELECT 1 FROM ClinicSettings WHERE TenantId = @TenantId AND SettingKey = 'Notification.RoleRules')
                UPDATE ClinicSettings SET SettingValue = @SettingValue, UpdatedAt = GETDATE() WHERE TenantId = @TenantId AND SettingKey = 'Notification.RoleRules';
            ELSE
                INSERT INTO ClinicSettings (TenantId, SettingKey, SettingValue, Category, Description)
                VALUES (@TenantId, 'Notification.RoleRules', @SettingValue, 'Notifications', 'Role-based notification subscription matrix');";

        int rows = await conn.ExecuteAsync(sql, new { TenantId = tenantId, SettingValue = jsonRules });

        try
        {
            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, 'Security: Notification Rules Updated', 'Role alert subscription matrix was modified by administrator.', 2, 'SystemSecurity', 'SuperAdmin,Admin', 1, GETDATE())",
                new { TenantId = tenantId });
        }
        catch { /* non-blocking */ }

        return rows > 0;
    }
}
