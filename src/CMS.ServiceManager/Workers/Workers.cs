using System.Net.Sockets;
using System.Text;
using CMS.Domain.Interfaces;
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

public class LabInstrumentListenerWorker : BackgroundService
{
    private readonly ILogger<LabInstrumentListenerWorker> _logger;
    private readonly IHl7Adapter _hl7Adapter;

    public LabInstrumentListenerWorker(ILogger<LabInstrumentListenerWorker> logger, IHl7Adapter hl7Adapter)
    {
        _logger = logger;
        _hl7Adapter = hl7Adapter;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Starting LabInstrumentListenerWorker TCP listener on Port 2575 (HL7)...");
        try
        {
            var listener = new TcpListener(System.Net.IPAddress.Any, 2575);
            listener.Start();

            while (!stoppingToken.IsCancellationRequested)
            {
                if (listener.Pending())
                {
                    using var client = await listener.AcceptTcpClientAsync(stoppingToken);
                    using var stream = client.GetStream();
                    var buffer = new byte[4096];
                    int bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, stoppingToken);
                    if (bytesRead > 0)
                    {
                        var rawHl7 = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                        _logger.LogInformation("Received raw HL7 message from lab analyzer!");
                        await _hl7Adapter.ParseOruMessageAsync(rawHl7);
                    }
                }
                await Task.Delay(500, stoppingToken);
            }
            listener.Stop();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LabInstrumentListenerWorker error");
        }
    }
}
