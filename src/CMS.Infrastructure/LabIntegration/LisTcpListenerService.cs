using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;
using CMS.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CMS.Infrastructure.LabIntegration;

public class LisTcpListenerService : BackgroundService, ILisTcpListenerService
{
    private readonly ILogger<LisTcpListenerService> _logger;
    private readonly ILabResultIngestionService _ingestionService;
    private readonly IHl7Adapter _hl7Adapter;
    private readonly IConfiguration _config;

    private readonly ConcurrentDictionary<string, LisClientConnectionInfo> _activeClients = new();
    private readonly ConcurrentQueue<string> _recentLogs = new();
    private readonly List<int> _listeningPorts = new();
    private bool _isListening = false;
    private const int MaxLogs = 100;

    public bool IsListening => _isListening;
    public IReadOnlyList<int> ListeningPorts => _listeningPorts.AsReadOnly();
    public IReadOnlyList<LisClientConnectionInfo> ActiveClients => _activeClients.Values.ToList().AsReadOnly();
    public IReadOnlyList<string> RecentLogs => _recentLogs.ToList().AsReadOnly();

    public LisTcpListenerService(
        ILogger<LisTcpListenerService> logger,
        ILabResultIngestionService ingestionService,
        IHl7Adapter hl7Adapter,
        IConfiguration config)
    {
        _logger = logger;
        _ingestionService = ingestionService;
        _hl7Adapter = hl7Adapter;
        _config = config;
    }

    public void LogEvent(string message)
    {
        string timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
        string formatted = $"[{timestamp}] {message}";

        _recentLogs.Enqueue(formatted);
        while (_recentLogs.Count > MaxLogs && _recentLogs.TryDequeue(out _)) { }

        _logger.LogInformation("{LisLog}", formatted);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Determine ports to listen on (default 5100 and 2575)
        var ports = new List<int>();
        var configuredPort = _config.GetValue<int?>("Lis:Port") ?? _config.GetValue<int?>("LisListener:Port") ?? 5100;
        ports.Add(configuredPort);

        var secondaryPort = _config.GetValue<int?>("Lis:SecondaryPort") ?? 2575;
        if (!ports.Contains(secondaryPort))
        {
            ports.Add(secondaryPort);
        }

        var listenerTasks = new List<Task>();
        foreach (var port in ports)
        {
            listenerTasks.Add(StartPortListenerAsync(port, stoppingToken));
        }

        await Task.WhenAll(listenerTasks);
    }

    private async Task StartPortListenerAsync(int port, CancellationToken stoppingToken)
    {
        TcpListener? listener = null;
        try
        {
            listener = new TcpListener(IPAddress.Any, port);
            listener.Start();
            lock (_listeningPorts)
            {
                if (!_listeningPorts.Contains(port)) _listeningPorts.Add(port);
                _isListening = true;
            }

            LogEvent($"LISTENER STARTED: Passively waiting for analyzer connections on 0.0.0.0:{port}...");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var client = await listener.AcceptTcpClientAsync(stoppingToken);
                    _ = Task.Run(() => HandleClientAsync(client, port, stoppingToken), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    if (!stoppingToken.IsCancellationRequested)
                    {
                        LogEvent($"ERROR accepting connection on port {port}: {ex.Message}");
                        await Task.Delay(1000, stoppingToken);
                    }
                }
            }
        }
        catch (SocketException ex)
        {
            LogEvent($"WARNING: Port {port} could not be bound ({ex.SocketErrorCode}). It may already be in use by another service.");
            _logger.LogWarning(ex, "Port {Port} could not be bound for LIS listener", port);
        }
        catch (Exception ex)
        {
            LogEvent($"ERROR starting LIS listener on port {port}: {ex.Message}");
            _logger.LogError(ex, "Error starting LIS listener on port {Port}", port);
        }
        finally
        {
            try
            {
                listener?.Stop();
                lock (_listeningPorts)
                {
                    _listeningPorts.Remove(port);
                    if (_listeningPorts.Count == 0) _isListening = false;
                }
                LogEvent($"LISTENER STOPPED: Port {port}");
            }
            catch { }
        }
    }

    private async Task HandleClientAsync(TcpClient client, int listenPort, CancellationToken stoppingToken)
    {
        string remoteEndPoint = client.Client.RemoteEndPoint?.ToString() ?? $"Unknown:{listenPort}";
        DateTime connectedAt = DateTime.Now;
        var clientInfo = new LisClientConnectionInfo(remoteEndPoint, connectedAt, DateTime.Now, 0);
        _activeClients[remoteEndPoint] = clientInfo;

        // Exact requested log format: [2026-09-23 18:11:45.616] CONNECTED: 192.168.1.41:42674
        LogEvent($"CONNECTED: {remoteEndPoint}");

        try
        {
            using var stream = client.GetStream();
            stream.ReadTimeout = 300000; // 5 minute read timeout for idle machine
            var buffer = new byte[8192];
            var messageBuffer = new List<byte>();

            while (!stoppingToken.IsCancellationRequested && client.Connected)
            {
                int bytesRead = 0;
                try
                {
                    bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, stoppingToken);
                }
                catch (IOException)
                {
                    // Timeout or client disconnected
                    break;
                }

                if (bytesRead <= 0)
                {
                    // Socket closed by remote analyzer
                    break;
                }

                for (int i = 0; i < bytesRead; i++)
                {
                    messageBuffer.Add(buffer[i]);
                }

                _activeClients[remoteEndPoint] = clientInfo with
                {
                    LastActivityAt = DateTime.Now,
                    BytesReceived = clientInfo.BytesReceived + bytesRead
                };

                // Check if we have received a complete HL7 message
                // Standard MLLP ends with \x1C\x0D (FS CR), or plain HL7 with no more data pending in stream
                bool hasMllpEnd = messageBuffer.Count >= 2 &&
                                  messageBuffer[^2] == 0x1C &&
                                  messageBuffer[^1] == 0x0D;

                bool isStreamEmpty = !stream.DataAvailable;

                if (hasMllpEnd || (isStreamEmpty && messageBuffer.Count > 0))
                {
                    byte[] msgBytes = messageBuffer.ToArray();
                    messageBuffer.Clear();

                    string rawHl7 = Encoding.UTF8.GetString(msgBytes);

                    // Exact requested log format: [2026-09-23 18:12:51.791] FROM 192.168.1.41:42674 | 1712 bytes | UTF-8
                    LogEvent($"FROM {remoteEndPoint} | {msgBytes.Length} bytes | UTF-8");

                    // Ingest into database
                    bool inserted = await _ingestionService.IngestHl7ResultAsync(rawHl7, remoteEndPoint);
                    if (inserted)
                    {
                        LogEvent($"RESULT INSERTED: Results saved to database from {remoteEndPoint}");
                    }
                    else
                    {
                        LogEvent($"RESULT NOTICE: Processed payload from {remoteEndPoint}");
                    }

                    // Generate ACK response back to the machine
                    try
                    {
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

                        await stream.WriteAsync(ackBytes, 0, ackBytes.Length, stoppingToken);
                        await stream.FlushAsync(stoppingToken);

                        LogEvent($"SENT ACK to {remoteEndPoint}");
                    }
                    catch (Exception ackEx)
                    {
                        LogEvent($"ERROR sending ACK to {remoteEndPoint}: {ackEx.Message}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            LogEvent($"CLIENT EXCEPTION ({remoteEndPoint}): {ex.Message}");
        }
        finally
        {
            _activeClients.TryRemove(remoteEndPoint, out _);
            try { client.Close(); } catch { }
            LogEvent($"DISCONNECTED: {remoteEndPoint}");
        }
    }
}
