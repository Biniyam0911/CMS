using System.Net;
using System.Text.Json;
using CMS.Shared.DTOs;

namespace CMS.API.Middleware;

public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        byte tenantId = 1;

        // Security Priority 1: If user is authenticated via cryptographically signed JWT, use claim
        var tenantClaim = context.User?.FindFirst("TenantId")?.Value;
        if (!string.IsNullOrEmpty(tenantClaim) && byte.TryParse(tenantClaim, out var parsedClaim) && parsedClaim > 0)
        {
            tenantId = parsedClaim;
        }
        else if (context.Request.Headers.TryGetValue("X-Tenant-ID", out var headerVal) && byte.TryParse(headerVal, out var parsedHeader) && parsedHeader > 0)
        {
            // Security Priority 2: For unauthenticated endpoints (login, registration), use header
            tenantId = parsedHeader;
        }

        context.Items["TenantId"] = tenantId;

        // Also extract and store authenticated UserId if available
        var userIdClaim = context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var parsedUserId))
        {
            context.Items["UserId"] = parsedUserId;
        }

        await _next(context);
    }
}

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception encountered: {Message}", ex.Message);
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var response = ApiResponse<string>.Fail(ex.Message);
            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
    }
}
