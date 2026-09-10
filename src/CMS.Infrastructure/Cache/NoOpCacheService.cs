using CMS.Domain.Interfaces;

namespace CMS.Infrastructure.Cache;

/// <summary>
/// No-operation cache service used when Redis is unavailable.
/// All reads return null (cache miss) and all writes are silently discarded.
/// This allows the API to run without Redis at the cost of caching performance.
/// </summary>
public class NoOpCacheService : ICacheService
{
    public Task<T?> GetAsync<T>(string key) => Task.FromResult<T?>(default);

    public Task SetAsync<T>(string key, T value, TimeSpan? expiration = null) => Task.CompletedTask;

    public Task RemoveAsync(string key) => Task.CompletedTask;

    public Task RemoveByPrefixAsync(string prefix) => Task.CompletedTask;
}
