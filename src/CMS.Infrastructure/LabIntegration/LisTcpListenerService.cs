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
    private class PortListenerEntry
    {
        public int Port { get; init; }
        public TcpListener Listener { get; init; } = default!;
        public CancellationTokenSource Cts { get; init; } = default!;
        public Task Task { get; set; } = default!;
    }

    private readonly ILogger<LisTcpListenerService> _logger;
    private readonly ILabResultIngestionService _ingestionService;
    private readonly IHl7Adapter _hl7Adapter;
    private readonly IConfiguration _config;

    private readonly ConcurrentDictionary<string, LisClientConnectionInfo> _activeClients = new();
    private readonly ConcurrentQueue<string> _recentLogs = new();
    private readonly ConcurrentDictionary<int, PortListenerEntry> _listeners = new();
    private readonly HashSet<int> _configuredPorts = new();
    private readonly object _lock = new();
    private CancellationToken _appStoppingToken;
    private const int MaxLogs = 100;

    public bool IsListening => !_listeners.IsEmpty;
    public IReadOnlyList<int> ListeningPorts => _listeners.Keys.OrderBy(p => p).ToList().AsReadOnly();
    public IReadOnlyList<int> ConfiguredPorts
    {
        get
        {
            lock (_lock)
            {
                return _configuredPorts.OrderBy(p => p).ToList().AsReadOnly();
            }
        }
    }
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
        _appStoppingToken = stoppingToken;

        // Determine default ports to listen on (default 8004, 10001, 10002)
        var defaultPorts = new List<int>();
        var configuredPortsSection = _config.GetSection("Lis:Ports").Get<int[]>();
        if (configuredPortsSection != null && configuredPortsSection.Length > 0)
        {
            defaultPorts.AddRange(configuredPortsSection);
        }
        else
        {
            var p1 = _config.GetValue<int?>("Lis:Port") ?? _config.GetValue<int?>("LisListener:Port") ?? 8004;
            var p2 = _config.GetValue<int?>("Lis:SecondaryPort") ?? 10001;
            var p3 = _config.GetValue<int?>("Lis:TertiaryPort") ?? 10002;
            defaultPorts.Add(p1);
            defaultPorts.Add(p2);
            defaultPorts.Add(p3);
        }

        lock (_lock)
        {
            foreach (var p in defaultPorts.Where(p => p is >= 1 and <= 65535).Distinct())
            {
                _configuredPorts.Add(p);
            }
        }

        // Start default listeners
        await StartAsync();

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // App is stopping
        }
        finally
        {
            await StopAsync();
        }
    }

    public Task<bool> StartAsync(int? port = null)
    {
        lock (_lock)
        {
            if (port.HasValue)
            {
                _configuredPorts.Add(port.Value);
                StartPortListenerInternal(port.Value);
            }
            else
            {
                foreach (var p in _configuredPorts.ToList())
                {
                    StartPortListenerInternal(p);
                }
            }
        }
        return Task.FromResult(IsListening);
    }

    public Task<bool> StopAsync(int? port = null)
    {
        lock (_lock)
        {
            if (port.HasValue)
            {
                StopPortListenerInternal(port.Value);
            }
            else
            {
                foreach (var p in _listeners.Keys.ToList())
                {
                    StopPortListenerInternal(p);
                }
                LogEvent("LISTENER STOPPED: All LIS listeners stopped.");
            }
        }
        return Task.FromResult(true);
    }

    public Task<bool> ConfigurePortsAsync(IEnumerable<int> ports)
    {
        lock (_lock)
        {
            var validPorts = ports.Where(p => p is >= 1 and <= 65535).Distinct().ToList();
            if (validPorts.Count == 0) return Task.FromResult(false);

            // Stop listeners that are no longer in the list
            var toStop = _listeners.Keys.Where(p => !validPorts.Contains(p)).ToList();
            foreach (var p in toStop)
            {
                StopPortListenerInternal(p);
            }

            _configuredPorts.Clear();
            foreach (var p in validPorts)
            {
                _configuredPorts.Add(p);
                StartPortListenerInternal(p);
            }

            LogEvent($"PORTS CONFIGURED: Now listening on [{string.Join(", ", _configuredPorts.OrderBy(x => x))}]");
        }
        return Task.FromResult(true);
    }

    private void StartPortListenerInternal(int port)
    {
        if (_listeners.ContainsKey(port)) return;

        var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(_appStoppingToken);
        TcpListener? listener = null;
        try
        {
            listener = new TcpListener(IPAddress.Any, port);
            listener.Start();
            LogEvent($"LISTENER STARTED: Passively waiting for analyzer connections on 0.0.0.0:{port}...");
        }
        catch (SocketException ex)
        {
            LogEvent($"WARNING: Port {port} could not be bound ({ex.SocketErrorCode}). It may already be in use by another service.");
            _logger.LogWarning(ex, "Port {Port} could not be bound for LIS listener", port);
            linkedCts.Dispose();
            return;
        }
        catch (Exception ex)
        {
            LogEvent($"ERROR starting LIS listener on port {port}: {ex.Message}");
            _logger.LogError(ex, "Error starting LIS listener on port {Port}", port);
            linkedCts.Dispose();
            return;
        }

        var entry = new PortListenerEntry
        {
            Port = port,
            Listener = listener,
            Cts = linkedCts
        };

        var task = Task.Run(() => AcceptLoopAsync(entry), linkedCts.Token);
        entry.Task = task;
        _listeners[port] = entry;
    }

    private void StopPortListenerInternal(int port)
    {
        if (_listeners.TryRemove(port, out var entry))
        {
            try { entry.Cts.Cancel(); } catch { }
            try { entry.Listener.Stop(); } catch { }
            try { entry.Cts.Dispose(); } catch { }
            LogEvent($"LISTENER STOPPED: Port {port}");
        }
    }

    private async Task AcceptLoopAsync(PortListenerEntry entry)
    {
        var listener = entry.Listener;
        var port = entry.Port;
        var token = entry.Cts.Token;

        try
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    var client = await listener.AcceptTcpClientAsync(token);
                    _ = Task.Run(() => HandleClientAsync(client, port, token), token);
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    if (!token.IsCancellationRequested)
                    {
                        LogEvent($"ERROR accepting connection on port {port}: {ex.Message}");
                        await Task.Delay(1000, token);
                    }
                }
            }
        }
        catch (Exception)
        {
            // Listener stopped or socket closed
        }
        finally
        {
            try { listener.Stop(); } catch { }
            _listeners.TryRemove(port, out _);
        }
    }

    private async Task HandleClientAsync(TcpClient client, int listenPort, CancellationToken stoppingToken)
    {
        string remoteEndPoint = client.Client.RemoteEndPoint?.ToString() ?? $"Unknown:{listenPort}";
        DateTime connectedAt = DateTime.Now;
        var clientInfo = new LisClientConnectionInfo(remoteEndPoint, connectedAt, DateTime.Now, 0);
        _activeClients[remoteEndPoint] = clientInfo;

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

                    // Strip MLLP wrapper bytes (VT=0x0B, FS=0x1C, CR=0x0D) for display
                    string displayRaw = rawHl7
                        .TrimStart((char)0x0B)
                        .TrimEnd((char)0x0D, (char)0x1C)
                        .Replace("\r", "\n");
                    LogEvent($"RAW DATA FROM {remoteEndPoint}:\n{displayRaw}");

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
