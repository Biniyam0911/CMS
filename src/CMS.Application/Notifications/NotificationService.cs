using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Notifications;

public class NotificationService
{
    private readonly IDbConnectionFactory _dbFactory;

    public NotificationService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<long> EnqueueNotificationAsync(EnqueueNotificationDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO Notifications (TenantId, RecipientUserId, RecipientEmail, RecipientPhone, Channel, Subject, Body, Priority, NotificationType, RefType, RefId)
            VALUES (@TenantId, @RecipientUserId, @RecipientEmail, @RecipientPhone, @Channel, @Subject, @Body, @Priority, @NotificationType, @RefType, @RefId);
            SELECT SCOPE_IDENTITY();";

        return await conn.ExecuteScalarAsync<long>(sql, dto);
    }
}
