using System.Collections.Concurrent;
using CMS.Domain.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace CMS.Infrastructure.Cache;

/// <summary>
/// Fast in-memory cache service providing high-performance RAM caching
/// when an external Redis instance is unavailable.
/// </summary>
public class MemoryCacheService : ICacheService
{
    private readonly IMemoryCache _cache;
    private readonly ConcurrentDictionary<string, byte> _keys = new();

    public MemoryCacheService(IMemoryCache cache)
    {
        _cache = cache;
    }

    public Task<T?> GetAsync<T>(string key)
    {
        if (_cache.TryGetValue(key, out T? value))
        {
            Serilog.Log.Debug("MemoryCache: HIT for key {Key}", key);
            return Task.FromResult(value);
        }
        Serilog.Log.Debug("MemoryCache: MISS for key {Key}", key);
        return Task.FromResult<T?>(default);
    }

    public Task SetAsync<T>(string key, T value, TimeSpan? expiration = null)
    {
        var options = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiration ?? TimeSpan.FromMinutes(10)
        };

        options.RegisterPostEvictionCallback((k, val, reason, state) =>
        {
            _keys.TryRemove(k.ToString()!, out _);
        });

        _keys.TryAdd(key, 0);
        _cache.Set(key, value, options);
        return Task.CompletedTask;
    }

    public Task RemoveAsync(string key)
    {
        _cache.Remove(key);
        _keys.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    public Task RemoveByPrefixAsync(string prefix)
    {
        var matchingKeys = _keys.Keys.Where(k => k.StartsWith(prefix)).ToList();
        foreach (var key in matchingKeys)
        {
            _cache.Remove(key);
            _keys.TryRemove(key, out _);
        }
        return Task.CompletedTask;
    }
}
