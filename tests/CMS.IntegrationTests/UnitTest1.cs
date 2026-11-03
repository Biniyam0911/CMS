using CMS.Shared.DTOs;
using System.Text.Json;
using Xunit;

namespace CMS.IntegrationTests;

public class ApiResponseSerializationTests
{
    [Fact]
    public void ApiResponse_SerializesAndDeserializes_WithMeta()
    {
        var meta = new PaginationMeta(Total: 42, Page: 1, PageSize: 10, TotalPages: 5);
        var original = ApiResponse<List<string>>.Ok(new List<string> { "Item1", "Item2" }, meta);

        var json = JsonSerializer.Serialize(original, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var deserialized = JsonSerializer.Deserialize<JsonElement>(json);

        Assert.True(deserialized.GetProperty("success").GetBoolean());
        Assert.Equal(2, deserialized.GetProperty("data").GetArrayLength());
        Assert.Equal(42, deserialized.GetProperty("meta").GetProperty("total").GetInt32());
    }

    [Fact]
    public void LoginRequest_JsonContract_MatchesApiSpecification()
    {
        var request = new LoginRequest("admin", "say@123", 1);
        var json = JsonSerializer.Serialize(request, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var deserialized = JsonSerializer.Deserialize<JsonElement>(json);

        Assert.Equal("admin", deserialized.GetProperty("username").GetString());
        Assert.Equal("say@123", deserialized.GetProperty("password").GetString());
        Assert.Equal(1, deserialized.GetProperty("tenantId").GetByte());
    }

    [Fact]
    public void RefreshTokenRequest_Contract_IsSerializedCorrectly()
    {
        var req = new RefreshTokenRequest("sample-token-guid");
        var json = JsonSerializer.Serialize(req, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var deserialized = JsonSerializer.Deserialize<JsonElement>(json);

        Assert.Equal("sample-token-guid", deserialized.GetProperty("refreshToken").GetString());
    }
}
