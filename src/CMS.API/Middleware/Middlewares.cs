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
        // Extract X-Tenant-ID header if present (default: 1 for single-clinic)
        byte tenantId = 1;
        if (context.Request.Headers.TryGetValue("X-Tenant-ID", out var headerVal) && byte.TryParse(headerVal, out var parsed))
        {
            tenantId = parsed;
        }

        context.Items["TenantId"] = tenantId;
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
