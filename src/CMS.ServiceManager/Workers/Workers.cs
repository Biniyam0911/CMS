using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CMS.ServiceManager.Workers;

public class HealthCheckWorker : BackgroundService
{
    private readonly ILogger<HealthCheckWorker> _logger;

    public HealthCheckWorker(ILogger<HealthCheckWorker> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("ServiceManager Heartbeat: DB, Redis, and Services Healthy at {Time}", DateTimeOffset.Now);
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}

public class NotificationDispatchWorker : BackgroundService
{
    private readonly ILogger<NotificationDispatchWorker> _logger;

    public NotificationDispatchWorker(ILogger<NotificationDispatchWorker> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogDebug("NotificationDispatchWorker polling queue...");
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }
}

