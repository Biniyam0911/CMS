using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace CMS.Application.Billing;

/// <summary>
/// Chapa payment gateway integration service.
/// Handles: Initialize transaction → redirect to Chapa hosted checkout → verify on return.
/// API docs: https://developer.chapa.co/docs
/// </summary>
public class ChapaPaymentService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly BillingService _billingService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;

    private const string ChapaApiBase = "https://api.chapa.co/v1";

    public ChapaPaymentService(
        IDbConnectionFactory dbFactory,
        BillingService billingService,
        IHttpClientFactory httpClientFactory,
        IConfiguration config)
    {
        _dbFactory = dbFactory;
        _billingService = billingService;
        _httpClientFactory = httpClientFactory;
        _config = config;
    }

    private string GetSecretKey()
    {
        // Store your Chapa secret key in appsettings.json under "Chapa:SecretKey"
        // Test key format: CHASECK_TEST-xxxxxxxxxxxx
        // Live key format: CHASECK-xxxxxxxxxxxx
        return _config["Chapa:SecretKey"] ?? "CHASECK_TEST-your-test-key-here";
    }

    /// <summary>
    /// Step 1: Initialize a Chapa transaction for an invoice.
    /// Returns a checkout URL that the frontend should redirect the patient/cashier to.
    /// </summary>
    public async Task<ChapaInitResponseDto> InitializeTransactionAsync(byte tenantId, ChapaInitRequestDto req)
    {
        using var conn = _dbFactory.CreateConnection();

        // Load invoice + patient details
        var inv = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT i.Id, i.InvoiceNumber, i.TotalAmount, ISNULL(i.PaidAmount, 0) AS PaidAmount,
                   p.FirstName, p.LastName, p.Email, p.PrimaryPhone AS Phone,
                   p.MRN
            FROM Invoices i
            JOIN Patients p ON p.Id = i.PatientId
            WHERE i.Id = @InvoiceId AND i.TenantId = @TenantId",
            new { req.InvoiceId, TenantId = tenantId });

        if (inv == null)
            return new ChapaInitResponseDto { Success = false, Message = "Invoice not found." };

        decimal payable = req.Amount > 0 
            ? req.Amount 
            : Math.Max(0, (decimal)inv.TotalAmount - (decimal)inv.PaidAmount);

        if (payable <= 0)
            return new ChapaInitResponseDto { Success = false, Message = "Invoice is already fully paid." };

        // Generate a unique transaction reference
        string txRef = $"CMS-{tenantId}-{req.InvoiceId}-{DateTime.UtcNow:yyyyMMddHHmmss}";

        // Ensure email passes Chapa's strict email validator (no .local, must have valid domain)
        string rawEmail = ((string?)inv.Email)?.Trim() ?? "";
        string patientEmail;
        if (!string.IsNullOrWhiteSpace(rawEmail) && rawEmail.Contains('@') && rawEmail.Contains('.') && !rawEmail.EndsWith(".local", StringComparison.OrdinalIgnoreCase))
        {
            patientEmail = rawEmail;
        }
        else
        {
            string safeId = System.Text.RegularExpressions.Regex.Replace((string?)inv.MRN ?? req.InvoiceId.ToString(), @"[^a-zA-Z0-9_]", "");
            patientEmail = $"patient_{safeId}@gmail.com";
        }

        string firstName = !string.IsNullOrWhiteSpace((string?)inv.FirstName) 
            ? System.Text.RegularExpressions.Regex.Replace((string)inv.FirstName, @"[^a-zA-Z0-9 ]", "").Trim() 
            : "Patient";
        if (string.IsNullOrWhiteSpace(firstName)) firstName = "Patient";

        string lastName = !string.IsNullOrWhiteSpace((string?)inv.LastName) 
            ? System.Text.RegularExpressions.Regex.Replace((string)inv.LastName, @"[^a-zA-Z0-9 ]", "").Trim() 
            : "Client";
        if (string.IsNullOrWhiteSpace(lastName)) lastName = "Client";

        // Determine callback/return URLs
        string baseUrl = _config["Chapa:CallbackBaseUrl"] ?? "http://localhost:3000";
        string returnUrl = $"{baseUrl}/payment/chapa/return?tx_ref={txRef}&invoice_id={req.InvoiceId}";
        string callbackUrl = _config["Chapa:WebhookUrl"] ?? $"{_config["Chapa:ApiBaseUrl"] ?? "http://localhost:5010"}/api/v1/chapa/webhook";

        // Chapa rules:
        // - title: max 16 chars
        // - description: only letters, numbers, hyphens, underscores, spaces, and dots (NO #, NO em-dash)
        string safeInvNo = System.Text.RegularExpressions.Regex.Replace((string?)inv.InvoiceNumber ?? req.InvoiceId.ToString(), @"[^a-zA-Z0-9_\-\. ]", "");
        string safeDescription = $"Bill {safeInvNo} ETB {payable:F2}";
        if (safeDescription.Length > 50) safeDescription = safeDescription.Substring(0, 50);

        var payload = new
        {
            amount = payable.ToString("F2"),
            currency = "ETB",
            email = patientEmail,
            first_name = firstName,
            last_name = lastName,
            phone_number = !string.IsNullOrWhiteSpace((string?)inv.Phone) 
                ? System.Text.RegularExpressions.Regex.Replace((string)inv.Phone, @"[^0-9+]", "") 
                : "",
            tx_ref = txRef,
            callback_url = callbackUrl,
            return_url = returnUrl,
            customization = new
            {
                title = "Medical Bill",
                description = safeDescription
            }
        };

        try
        {
            var http = _httpClientFactory.CreateClient("Chapa");
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GetSecretKey());
            http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await http.PostAsync($"{ChapaApiBase}/transaction/initialize", content);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                return new ChapaInitResponseDto { Success = false, Message = $"Chapa API error: {body}" };

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            string? checkoutUrl = root.TryGetProperty("data", out var data) && data.TryGetProperty("checkout_url", out var cu)
                ? cu.GetString() : null;

            if (string.IsNullOrEmpty(checkoutUrl))
                return new ChapaInitResponseDto { Success = false, Message = "Chapa returned no checkout URL." };

            // Persist the pending transaction record
            await conn.ExecuteAsync(@"
                IF NOT EXISTS (SELECT 1 FROM ChapaTransactions WHERE TxRef = @TxRef)
                INSERT INTO ChapaTransactions (TenantId, InvoiceId, TxRef, Amount, Status, CreatedAt)
                VALUES (@TenantId, @InvoiceId, @TxRef, @Amount, 'PENDING', GETUTCDATE())",
                new { TenantId = tenantId, req.InvoiceId, TxRef = txRef, Amount = payable });

            return new ChapaInitResponseDto
            {
                Success = true,
                CheckoutUrl = checkoutUrl,
                TxRef = txRef,
                Amount = payable,
                Message = "Transaction initialized. Redirect patient to CheckoutUrl."
            };
        }
        catch (Exception ex)
        {
            return new ChapaInitResponseDto { Success = false, Message = $"Error calling Chapa API: {ex.Message}" };
        }
    }

    /// <summary>
    /// Step 2: Verify a completed transaction by tx_ref.
    /// Called after the patient returns from Chapa's hosted checkout page,
    /// OR from the webhook callback.
    /// </summary>
    public async Task<ChapaVerifyResponseDto> VerifyTransactionAsync(byte tenantId, string txRef)
    {
        try
        {
            var http = _httpClientFactory.CreateClient("Chapa");
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GetSecretKey());

            var response = await http.GetAsync($"{ChapaApiBase}/transaction/verify/{Uri.EscapeDataString(txRef)}");
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                return new ChapaVerifyResponseDto { Success = false, Message = $"Chapa verify error: {body}" };

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var data = root.TryGetProperty("data", out var d) ? d : root;

            string status = data.TryGetProperty("status", out var s) ? s.GetString() ?? "" : "";
            decimal amount = data.TryGetProperty("amount", out var a) && a.TryGetDecimal(out var amt) ? amt : 0;
            string currency = data.TryGetProperty("currency", out var c) ? c.GetString() ?? "ETB" : "ETB";
            string chapaRef = data.TryGetProperty("reference", out var r) ? r.GetString() ?? txRef : txRef;

            bool paid = status.Equals("success", StringComparison.OrdinalIgnoreCase);

            if (paid)
            {
                await ProcessVerifiedPaymentAsync(tenantId, txRef, amount, chapaRef);
            }

            return new ChapaVerifyResponseDto
            {
                Success = true,
                TxRef = txRef,
                Status = status,
                Amount = amount,
                Currency = currency,
                ChapaReference = chapaRef,
                Paid = paid,
                Message = paid ? "Payment verified and recorded." : $"Payment status: {status}"
            };
        }
        catch (Exception ex)
        {
            return new ChapaVerifyResponseDto { Success = false, Message = $"Verify error: {ex.Message}" };
        }
    }

    /// <summary>
    /// Process webhook from Chapa (called server-to-server on payment completion).
    /// Validates the transaction and marks the invoice as paid.
    /// </summary>
    public async Task<bool> ProcessWebhookAsync(byte tenantId, ChapaWebhookDto webhook)
    {
        if (string.IsNullOrEmpty(webhook.TxRef)) return false;

        // Re-verify with Chapa to ensure the webhook payload is genuine
        var verification = await VerifyTransactionAsync(tenantId, webhook.TxRef);
        return verification.Paid;
    }

    private async Task ProcessVerifiedPaymentAsync(byte tenantId, string txRef, decimal amount, string chapaRef)
    {
        using var conn = _dbFactory.CreateConnection();

        // Get the pending transaction record
        var tx = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT InvoiceId, Status FROM ChapaTransactions WHERE TxRef = @TxRef AND TenantId = @TenantId",
            new { TxRef = txRef, TenantId = tenantId });

        if (tx == null) return;

        // Idempotency: only process once
        if (((string)tx.Status).Equals("SUCCESS", StringComparison.OrdinalIgnoreCase)) return;

        var inv = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, PatientId FROM Invoices WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = (int)tx.InvoiceId, TenantId = tenantId });

        if (inv == null) return;

        // Post the payment through the standard billing pipeline
        var paymentDto = new ProcessPaymentDto(
            TenantId: tenantId,
            InvoiceId: (int)tx.InvoiceId,
            PatientId: (int)inv.PatientId,
            Amount: amount,
            PaymentMethod: "5", // 5: Chapa Online Payment
            ReceivedBy: 1,
            Reference: $"Chapa TX: {txRef} (Ref: {chapaRef})"
        );

        await _billingService.ProcessPaymentAsync(paymentDto);

        // Mark the Chapa transaction as succeeded
        await conn.ExecuteAsync(
            "UPDATE ChapaTransactions SET Status = 'SUCCESS', ChapaReference = @ChapaRef, VerifiedAt = GETUTCDATE() WHERE TxRef = @TxRef",
            new { ChapaRef = chapaRef, TxRef = txRef });
    }
}
