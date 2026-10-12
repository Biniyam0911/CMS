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

        // Resolve and store UserId so controllers and triggers can use it
        context.Items["UserId"] = ResolveUserId(context);

        await _next(context);
    }

    /// <summary>
    /// Resolves the authenticated user's ID from JWT claims, x-user-id header, or raw JWT cookie.
    /// Returns 0 if not resolved (callers should treat 0 as unknown — do NOT silently use 1).
    /// </summary>
    public static int ResolveUserId(HttpContext context)
    {
        // 1. Try JWT claims already populated by UseAuthentication()
        var userIdClaim = context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? context.User?.FindFirst("nameid")?.Value
            ?? context.User?.FindFirst("sub")?.Value
            ?? context.User?.FindFirst("UserId")?.Value
            ?? context.User?.FindFirst("id")?.Value
            ?? context.User?.Claims.FirstOrDefault(c =>
                c.Type.EndsWith("nameidentifier", StringComparison.OrdinalIgnoreCase) ||
                c.Type == "nameid" || c.Type == "sub")?.Value;

        if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var fromClaim) && fromClaim > 0)
            return fromClaim;

        // 2. Try x-user-id header — frontend sends this explicitly on every request
        //    Check both lowercase and mixed-case variants (ASP.NET Core header dict is case-insensitive
        //    but be explicit to avoid any edge cases).
        foreach (var headerName in new[] { "x-user-id", "X-User-ID", "X-User-Id" })
        {
            if (context.Request.Headers.TryGetValue(headerName, out var hv) &&
                int.TryParse(hv.FirstOrDefault(), out var fromHeader) && fromHeader > 0)
                return fromHeader;
        }

        // 3. Fallback: parse the JWT cookie directly (covers cases where UseAuthentication
        //    claim mapping differs between .NET versions)
        if (context.Request.Cookies.TryGetValue("cms_access_token", out var cookieToken) &&
            !string.IsNullOrEmpty(cookieToken))
        {
            try
            {
                var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
                if (handler.CanReadToken(cookieToken))
                {
                    var jwt = handler.ReadJwtToken(cookieToken);
                    var idStr = jwt.Claims.FirstOrDefault(c =>
                        c.Type == "nameid" ||
                        c.Type == "sub" ||
                        c.Type == "id" ||
                        c.Type == "UserId" ||
                        c.Type.EndsWith("nameidentifier", StringComparison.OrdinalIgnoreCase))?.Value;
                    if (!string.IsNullOrEmpty(idStr) && int.TryParse(idStr, out var fromJwt) && fromJwt > 0)
                        return fromJwt;
                }
            }
            catch { }
        }

        return 0;
    }

    /// <summary>
    /// Gets the UserId already stored by the middleware in HttpContext.Items,
    /// or re-resolves it if missing.
    /// </summary>
    public static int GetUserId(HttpContext context)
    {
        if (context.Items["UserId"] is int stored && stored > 0)
            return stored;
        return ResolveUserId(context);
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
