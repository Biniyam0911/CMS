using Microsoft.AspNetCore.SignalR;

namespace CMS.API.Hubs;

public class NotificationHub : Hub
{
    public async Task JoinTenantGroup(string tenantId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"Tenant_{tenantId}");
    }

    public async Task SendNotification(string tenantId, string type, string message)
    {
        await Clients.Group($"Tenant_{tenantId}").SendAsync("ReceiveNotification", type, message);
    }
}
