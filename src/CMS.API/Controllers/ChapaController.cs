using CMS.Application.Billing;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class ChapaController : ControllerBase
{
    private readonly ChapaPaymentService _chapaService;
    private readonly IDbConnectionFactory _dbFactory;

    public ChapaController(ChapaPaymentService chapaService, IDbConnectionFactory dbFactory)
    {
        _chapaService = chapaService;
        _dbFactory = dbFactory;
    }

    /// <summary>
    /// POST /api/v1/chapa/initialize
    /// Cashier calls this for an invoice → gets back a CheckoutUrl to open for the patient.
    /// </summary>
    [HttpPost("initialize")]
    public async Task<IActionResult> Initialize([FromBody] ChapaInitRequestDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var result = await _chapaService.InitializeTransactionAsync(tenantId, dto);
        if (!result.Success)
            return BadRequest(ApiResponse<ChapaInitResponseDto>.Fail(result.Message ?? "Init failed."));
        return Ok(ApiResponse<ChapaInitResponseDto>.Ok(result));
    }

    /// <summary>
    /// GET /api/v1/chapa/verify/{txRef}
    /// Called after patient returns from Chapa checkout to confirm payment.
    /// Publicly accessible so patients returning from Chapa can verify without staff login.
    /// </summary>
    [HttpGet("verify/{txRef}")]
    [AllowAnonymous]
    public async Task<IActionResult> Verify(string txRef)
    {
        byte tenantId = 1;
        if (txRef.StartsWith("CMS-"))
        {
            var parts = txRef.Split('-');
            if (parts.Length >= 2 && byte.TryParse(parts[1], out var tid))
                tenantId = tid;
        }
        else if (HttpContext.Items["TenantId"] is byte t)
        {
            tenantId = t;
        }

        var result = await _chapaService.VerifyTransactionAsync(tenantId, txRef);
        if (!result.Success)
            return BadRequest(ApiResponse<ChapaVerifyResponseDto>.Fail(result.Message ?? "Verify failed."));
        return Ok(ApiResponse<ChapaVerifyResponseDto>.Ok(result));
    }

    /// <summary>
    /// POST /api/v1/chapa/webhook
    /// Chapa calls this endpoint server-to-server when a payment completes.
    /// This endpoint must be publicly reachable (not authenticated by JWT).
    /// Use the Chapa-Signature header to verify authenticity.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook([FromBody] ChapaWebhookDto payload,
        [FromHeader(Name = "Chapa-Signature")] string? signature)
    {
        // TODO: Validate the signature using your Chapa webhook secret
        // For now we re-verify the transaction with Chapa's API (safe fallback)
        if (payload?.TxRef == null)
            return BadRequest("Missing tx_ref");

        // Extract tenant from tx_ref format: CMS-{tenantId}-{invoiceId}-{timestamp}
        byte tenantId = 1;
        if (payload.TxRef.StartsWith("CMS-"))
        {
            var parts = payload.TxRef.Split('-');
            if (parts.Length >= 2 && byte.TryParse(parts[1], out var tid))
                tenantId = tid;
        }

        var success = await _chapaService.ProcessWebhookAsync(tenantId, payload);
        return success ? Ok(new { message = "Payment processed." }) : Ok(new { message = "Not processed." });
    }

    /// <summary>
    /// GET /api/v1/chapa/transactions
    /// List Chapa payment history for the current tenant.
    /// </summary>
    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactions(
        [FromQuery] int? invoiceId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT ct.Id, ct.InvoiceId, ct.TxRef, ct.Amount, ct.Status, ct.ChapaReference,
                   ct.CreatedAt, ct.VerifiedAt,
                   i.InvoiceNumber,
                   p.FirstName + ' ' + p.LastName AS PatientName
            FROM ChapaTransactions ct
            JOIN Invoices i ON i.Id = ct.InvoiceId
            JOIN Patients p ON p.Id = i.PatientId
            WHERE ct.TenantId = @TenantId
            " + (invoiceId.HasValue ? "AND ct.InvoiceId = @InvoiceId" : "") + @"
            ORDER BY ct.CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        var rows = await conn.QueryAsync<dynamic>(sql, new
        {
            TenantId = tenantId,
            InvoiceId = invoiceId,
            Offset = (page - 1) * pageSize,
            PageSize = pageSize
        });

        return Ok(ApiResponse<IEnumerable<dynamic>>.Ok(rows));
    }
}
