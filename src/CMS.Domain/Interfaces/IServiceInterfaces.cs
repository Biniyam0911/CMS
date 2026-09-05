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

public interface IHl7Adapter
{
    Task<LabResult?> ParseOruMessageAsync(string hl7RawMessage);
    string CreateOrmOrderMessage(LabOrder order, Patient patient);
}

public interface IAstmAdapter
{
    Task<LabResult?> ParseAstmMessageAsync(string astmRawMessage);
}
