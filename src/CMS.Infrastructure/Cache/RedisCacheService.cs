using System.Text.Json;
using CMS.Domain.Interfaces;
using StackExchange.Redis;

namespace CMS.Infrastructure.Cache;

public class RedisCacheService : ICacheService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _db;

    public RedisCacheService(IConnectionMultiplexer redis)
    {
        _redis = redis;
        _db = _redis.GetDatabase();
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        try
        {
            if (!_redis.IsConnected) return default;
            var value = await _db.StringGetAsync(key);
            if (value.IsNullOrEmpty) return default;
            return JsonSerializer.Deserialize<T>(value!);
        }
        catch
        {
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null)
    {
        try
        {
            if (!_redis.IsConnected) return;
            var json = JsonSerializer.Serialize(value);
            await _db.StringSetAsync(key, json, expiration ?? TimeSpan.FromMinutes(10));
        }
        catch
        {
        }
    }

    public async Task RemoveAsync(string key)
    {
        try
        {
            if (!_redis.IsConnected) return;
            await _db.KeyDeleteAsync(key);
        }
        catch
        {
        }
    }

    public async Task RemoveByPrefixAsync(string prefix)
    {
        try
        {
            if (!_redis.IsConnected) return;
            var endpoints = _redis.GetEndPoints();
            foreach (var endpoint in endpoints)
            {
                var server = _redis.GetServer(endpoint);
                if (!server.IsConnected) continue;
                var keys = server.Keys(pattern: $"{prefix}*").ToArray();
                foreach (var key in keys)
                {
                    await _db.KeyDeleteAsync(key);
                }
            }
        }
        catch
        {
        }
    }
}
