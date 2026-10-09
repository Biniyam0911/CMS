using CMS.Application.Dashboard;
using CMS.Application.Encounters;
using CMS.Application.Patients;
using CMS.Application.Queue;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/queue")]
[Microsoft.AspNetCore.Authorization.AllowAnonymous]
public class QueueController : ControllerBase
{
    private readonly QueueService _queueService;

    public QueueController(QueueService queueService)
    {
        _queueService = queueService;
    }

    [HttpGet("live")]
    public async Task<IActionResult> GetLiveQueue([FromQuery] DateTime? date = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var queue = await _queueService.GetLiveQueueAsync(tenantId, date);
        return Ok(ApiResponse<List<PatientQueueDto>>.Ok(queue));
    }

    [HttpGet("counters")]
    public async Task<IActionResult> GetCounters()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var counters = await _queueService.GetServiceCountersAsync(tenantId);
        return Ok(ApiResponse<List<ServiceCounterDto>>.Ok(counters));
    }

    [HttpPost("checkin")]
    public async Task<IActionResult> CheckIn([FromBody] CheckInQueueDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        var (token, ticketId) = await _queueService.CheckInPatientAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { TokenNumber = token, TicketId = ticketId }));
    }

    [HttpPost("call")]
    public async Task<IActionResult> CallNext([FromBody] CallQueueTicketDto dto)
    {
        await _queueService.CallNextTicketAsync(dto.TicketId, dto.CounterId, dto.StaffId, dto.StationType);
        return Ok(ApiResponse<string>.Ok("Ticket summoned to counter."));
    }

    [HttpPost("recall")]
    public async Task<IActionResult> Recall([FromBody] RecallQueueTicketDto dto)
    {
        await _queueService.RecallTicketAsync(dto.TicketId, dto.CounterId, dto.StaffId);
        return Ok(ApiResponse<string>.Ok("Ticket recalled."));
    }

    [HttpPost("complete")]
    public async Task<IActionResult> Complete([FromBody] CompleteQueueTicketDto dto)
    {
        await _queueService.CompleteTicketAsync(dto.TicketId, dto.StaffId);
        return Ok(ApiResponse<string>.Ok("Ticket completed."));
    }

    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel([FromBody] CancelQueueTicketDto dto)
    {
        await _queueService.CancelTicketAsync(dto.TicketId, dto.StaffId, dto.Reason);
        return Ok(ApiResponse<string>.Ok("Ticket cancelled."));
    }

    [HttpGet("completed")]
    public async Task<IActionResult> GetCompleted([FromQuery] DateTime? date = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var completed = await _queueService.GetCompletedQueueAsync(tenantId, date);
        return Ok(ApiResponse<List<CompletedQueueTicketDto>>.Ok(completed));
    }

    [HttpGet("last-called")]
    public async Task<IActionResult> GetLastCalled()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var queue = await _queueService.GetLiveQueueAsync(tenantId, DateTime.UtcNow);
        var called = queue
            .Where(q => q.StatusId == 2)
            .OrderByDescending(q => q.CallTime ?? DateTime.MinValue)
            .FirstOrDefault();
        return Ok(ApiResponse<PatientQueueDto?>.Ok(called));
    }

    [HttpPost("launch-browser")]
    public IActionResult LaunchBrowser([FromBody] LaunchBrowserRequestDto dto)
    {
        try
        {
            var rawUrl = string.IsNullOrWhiteSpace(dto?.Url) ? "https://www.google.com" : dto.Url.Trim();
            if (!rawUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !rawUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                rawUrl = "https://" + rawUrl;

            var target = (dto?.Browser ?? "edge").ToLowerInvariant();
            var mode = (dto?.Mode ?? "app").ToLowerInvariant(); // "app" or "window"

            string? exe = null;
            if (target.Contains("chrome"))
            {
                var candidates = new[]
                {
                    @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
                };
                exe = candidates.FirstOrDefault(System.IO.File.Exists);
            }

            if (exe == null || target.Contains("edge"))
            {
                var edgeCandidates = new[]
                {
                    @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
                };
                var foundEdge = edgeCandidates.FirstOrDefault(System.IO.File.Exists);
                if (foundEdge != null) exe = foundEdge;
            }

            if (!string.IsNullOrEmpty(exe))
            {
                var args = mode == "app"
                    ? $"--app=\"{rawUrl}\""
                    : $"--new-window \"{rawUrl}\"";

                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = exe,
                    Arguments = args,
                    UseShellExecute = false
                });
                return Ok(ApiResponse<string>.Ok($"Launched {System.IO.Path.GetFileNameWithoutExtension(exe)} ({mode} mode) with {rawUrl}"));
            }
            else
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = rawUrl,
                    UseShellExecute = true
                });
                return Ok(ApiResponse<string>.Ok($"Launched default browser with {rawUrl}"));
            }
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<string>.Fail("Could not launch system browser: " + ex.Message));
        }
    }

    private static readonly System.Net.Http.SocketsHttpHandler _proxySocketsHandler = new()
    {
        PooledConnectionLifetime = TimeSpan.FromMinutes(10),
        PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
        MaxConnectionsPerServer = 20,
        AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate | System.Net.DecompressionMethods.Brotli,
        AllowAutoRedirect = true,
        SslOptions = new System.Net.Security.SslClientAuthenticationOptions
        {
            RemoteCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true
        }
    };

    private static readonly System.Net.Http.HttpClient _proxyHttpClient = new(_proxySocketsHandler)
    {
        Timeout = TimeSpan.FromSeconds(10),
        DefaultRequestHeaders =
        {
            { "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" },
            { "Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" },
            { "Accept-Language", "en-US,en;q=0.9" }
        }
    };

    [HttpGet("proxy")]
    [HttpGet("web-proxy")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public async Task<IActionResult> ProxyWebPage([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return BadRequest("URL parameter is required.");
        var targetUrl = url.Trim();
        if (!targetUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !targetUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            targetUrl = "https://" + targetUrl;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, targetUrl);
            var response = await _proxyHttpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            var mediaType = response.Content.Headers.ContentType?.MediaType ?? "text/html";

            // If not HTML (e.g. image, css, script), stream raw bytes directly with high throughput
            if (!mediaType.Contains("html", StringComparison.OrdinalIgnoreCase))
            {
                var stream = await response.Content.ReadAsStreamAsync();
                return File(stream, mediaType);
            }

            // HTML: fast read & inject base tag so client browser downloads sub-resources directly
            var content = await response.Content.ReadAsStringAsync();
            var uri = new Uri(targetUrl);
            var baseHref = $"{uri.Scheme}://{uri.Authority}{uri.AbsolutePath}";
            if (!baseHref.EndsWith('/'))
            {
                var lastSlash = baseHref.LastIndexOf('/');
                if (lastSlash > 8) baseHref = baseHref[..(lastSlash + 1)];
                else baseHref += "/";
            }

            // Remove any meta CSP or X-Frame-Options tags inside the HTML content
            content = System.Text.RegularExpressions.Regex.Replace(content, @"<meta[^>]*http-equiv=[""']?(?:X-Frame-Options|Content-Security-Policy)[""']?[^>]*>", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            var baseTag = $"<base href=\"{baseHref}\">";
            var headIdx = content.IndexOf("<head>", StringComparison.OrdinalIgnoreCase);
            if (headIdx >= 0)
            {
                content = content.Insert(headIdx + 6, "\n" + baseTag + "\n");
            }
            else
            {
                content = baseTag + "\n" + content;
            }

            // Ensure our response allows framing everywhere & caches
            Response.Headers["X-Frame-Options"] = "ALLOWALL";
            Response.Headers["Content-Security-Policy"] = "frame-ancestors *";
            Response.Headers.CacheControl = "public, max-age=120";
            return Content(content, "text/html; charset=utf-8");
        }
        catch (Exception ex)
        {
            return Content($"<html><body style='font-family:sans-serif;background:#022018;color:#f87171;padding:24px;'><h3 style='color:#34d399;'>Live Queue Web Browser</h3><p>Could not load {System.Net.WebUtility.HtmlEncode(targetUrl)}: {System.Net.WebUtility.HtmlEncode(ex.Message)}</p></body></html>", "text/html");
        }
    }
}

public class LaunchBrowserRequestDto
{
    public string? Url { get; set; }
    public string? Browser { get; set; }
    public string? Mode { get; set; }
}

[ApiController]
[Route("api/v1/[controller]")]
public class MedicalCertificatesController : ControllerBase
{
    private readonly SoapAndClinicalService _clinicalService;

    public MedicalCertificatesController(SoapAndClinicalService clinicalService)
    {
        _clinicalService = clinicalService;
    }

    [HttpPost]
    public async Task<IActionResult> IssueCertificate([FromBody] CreateMedicalCertificateDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        int id = await _clinicalService.IssueMedicalCertificateAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { CertificateId = id }));
    }

    [HttpGet("patient/{patientId}")]
    public async Task<IActionResult> GetPatientCertificates(int patientId)
    {
        var certs = await _clinicalService.GetPatientCertificatesAsync(patientId);
        return Ok(ApiResponse<List<MedicalCertificateDto>>.Ok(certs));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
[Route("api/v1/encounters/procedures")]
public class ProceduresController : ControllerBase
{
    private readonly SoapAndClinicalService _clinicalService;

    public ProceduresController(SoapAndClinicalService clinicalService)
    {
        _clinicalService = clinicalService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateProcedureOrderDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        int id = await _clinicalService.CreateProcedureOrderAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { OrderId = id }));
    }

    [HttpGet("patient/{patientId}")]
    [HttpGet("/api/v1/encounters/patient/{patientId}/procedures")]
    public async Task<IActionResult> GetPatientProcedures(int patientId)
    {
        var procs = await _clinicalService.GetPatientProceduresAsync(patientId);
        return Ok(ApiResponse<List<ProcedureOrderDto>>.Ok(procs));
    }

    [HttpGet("queue")]
    public async Task<IActionResult> GetProcedureQueue([FromQuery] DateTime? date = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var procs = await _clinicalService.GetProcedureQueueAsync(tenantId, date);
        return Ok(ApiResponse<List<ProcedureOrderDto>>.Ok(procs));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly DashboardService _dashboardService;

    public DashboardController(DashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var metrics = await _dashboardService.GetMetricsAsync(tenantId);
        return Ok(ApiResponse<DashboardMetricsDto>.Ok(metrics));
    }
}
