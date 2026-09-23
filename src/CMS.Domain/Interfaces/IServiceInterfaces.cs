using CMS.Domain.Entities;

namespace CMS.Domain.Interfaces;

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key);
    Task SetAsync<T>(string key, T value, TimeSpan? expiration = null);
    Task RemoveAsync(string key);
    Task RemoveByPrefixAsync(string prefix);
}

public interface INotificationProvider
{
    Task<bool> SendEmailAsync(string toEmail, string subject, string body);
    Task<bool> SendSmsAsync(string phoneNumber, string message);
}

public interface IDbConnectionFactory
{
    System.Data.IDbConnection CreateConnection();
}

public record ParsedLabParameter(
    string Code,
    string Name,
    decimal? NumericValue,
    string? TextValue,
    string Unit,
    string ReferenceRange,
    string Flag,
    bool IsCritical
);

public record ParsedHl7Result(
    string? SampleId,
    string? MessageControlId,
    string? SendingApp,
    string? SendingFacility,
    DateTime? ObservationDateTime,
    List<ParsedLabParameter> Parameters,
    string SummaryText,
    decimal? PrimaryNumeric,
    string? PrimaryUnit,
    string OverallFlag,
    bool IsCritical,
    string RawMessage
);

public interface IHl7Adapter
{
    Task<LabResult?> ParseOruMessageAsync(string hl7RawMessage);
    ParsedHl7Result ParseFullOruMessage(string rawHl7);
    string CreateAckMessage(string rawHl7, bool success = true, string? errorMsg = null);
    string CreateOrmOrderMessage(LabOrder order, Patient patient);
}

public interface IAstmAdapter
{
    Task<LabResult?> ParseAstmMessageAsync(string astmRawMessage);
}

public record LisClientConnectionInfo(
    string RemoteEndPoint,
    DateTime ConnectedAt,
    DateTime LastActivityAt,
    long BytesReceived
);

public record LisListenerStatusDto(
    bool IsListening,
    List<int> Ports,
    List<LisClientConnectionInfo> ActiveClients,
    List<string> RecentLogs
);

public interface ILabResultIngestionService
{
    Task<bool> IngestHl7ResultAsync(string rawHl7, string remoteEndPoint = "");
}

public interface ILisTcpListenerService
{
    bool IsListening { get; }
    IReadOnlyList<int> ListeningPorts { get; }
    IReadOnlyList<LisClientConnectionInfo> ActiveClients { get; }
    IReadOnlyList<string> RecentLogs { get; }
    void LogEvent(string message);
}

