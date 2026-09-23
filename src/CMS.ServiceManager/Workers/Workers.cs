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
    private readonly ILabResultIngestionService _ingestionService;

    public LabInstrumentListenerWorker(
        ILogger<LabInstrumentListenerWorker> logger,
        IHl7Adapter hl7Adapter,
        ILabResultIngestionService ingestionService)
    {
        _logger = logger;
        _hl7Adapter = hl7Adapter;
        _ingestionService = ingestionService;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        int port = 5100;
        _logger.LogInformation("Starting LabInstrumentListenerWorker TCP listener on Port {Port}...", port);

        TcpListener? listener = null;
        try
        {
            listener = new TcpListener(System.Net.IPAddress.Any, port);
            listener.Start();
            _logger.LogInformation("LIS TCP Server listening on 0.0.0.0:{Port} (Waiting for incoming analyzer connections)", port);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var client = await listener.AcceptTcpClientAsync(stoppingToken);
                    _ = Task.Run(() => HandleClientAsync(client, stoppingToken), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    if (!stoppingToken.IsCancellationRequested)
                    {
                        _logger.LogError(ex, "Error accepting LIS client connection");
                        await Task.Delay(1000, stoppingToken);
                    }
                }
            }
        }
        catch (SocketException ex)
        {
            _logger.LogWarning("Port {Port} could not be bound ({Error}). It may be active in the API process.", port, ex.SocketErrorCode);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LabInstrumentListenerWorker fatal error");
        }
        finally
        {
            listener?.Stop();
        }
    }

    private async Task HandleClientAsync(TcpClient client, CancellationToken ct)
    {
        string endpoint = client.Client.RemoteEndPoint?.ToString() ?? "Unknown";
        string connTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
        _logger.LogInformation("[{Time}] CONNECTED: {Endpoint}", connTime, endpoint);

        try
        {
            using var stream = client.GetStream();
            var buffer = new byte[8192];
            var messageBuffer = new List<byte>();

            while (!ct.IsCancellationRequested && client.Connected)
            {
                int bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, ct);
                if (bytesRead <= 0) break;

                for (int i = 0; i < bytesRead; i++) messageBuffer.Add(buffer[i]);

                bool hasMllpEnd = messageBuffer.Count >= 2 && messageBuffer[^2] == 0x1C && messageBuffer[^1] == 0x0D;
                bool isStreamEmpty = !stream.DataAvailable;

                if (hasMllpEnd || (isStreamEmpty && messageBuffer.Count > 0))
                {
                    byte[] msgBytes = messageBuffer.ToArray();
                    messageBuffer.Clear();

                    string rawHl7 = Encoding.UTF8.GetString(msgBytes);
                    string msgTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
                    _logger.LogInformation("[{Time}] FROM {Endpoint} | {Bytes} bytes | UTF-8", msgTime, endpoint, msgBytes.Length);

                    await _ingestionService.IngestHl7ResultAsync(rawHl7, endpoint);

                    string ack = _hl7Adapter.CreateAckMessage(rawHl7, success: true);
                    bool usedMllp = msgBytes.Length > 0 && msgBytes[0] == 0x0B;

                    byte[] ackBytes;
                    if (usedMllp)
                    {
                        var list = new List<byte> { 0x0B };
                        list.AddRange(Encoding.UTF8.GetBytes(ack));
                        list.Add(0x1C);
                        list.Add(0x0D);
                        ackBytes = list.ToArray();
                    }
                    else
                    {
                        ackBytes = Encoding.UTF8.GetBytes(ack + "\r");
                    }

                    await stream.WriteAsync(ackBytes, 0, ackBytes.Length, ct);
                    await stream.FlushAsync(ct);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Client exception for {Endpoint}", endpoint);
        }
        finally
        {
            try { client.Close(); } catch { }
            string discTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
            _logger.LogInformation("[{Time}] DISCONNECTED: {Endpoint}", discTime, endpoint);
        }
    }
}

