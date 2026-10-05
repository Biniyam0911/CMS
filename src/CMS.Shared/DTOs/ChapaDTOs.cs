namespace CMS.Shared.DTOs;

// ============================================================
//  CHAPA PAYMENT GATEWAY DTOs
// ============================================================

/// <summary>Request to initiate a Chapa payment for a specific invoice.</summary>
public record ChapaInitRequestDto(int InvoiceId, decimal Amount = 0);

/// <summary>Response from initializing a Chapa transaction.</summary>
public class ChapaInitResponseDto
{
    public bool Success { get; set; }
    public string? CheckoutUrl { get; set; }   // Redirect patient/cashier here
    public string? TxRef { get; set; }          // Unique tx reference (store for verify)
    public decimal Amount { get; set; }
    public string? Message { get; set; }
}

/// <summary>Response from verifying a Chapa transaction.</summary>
public class ChapaVerifyResponseDto
{
    public bool Success { get; set; }
    public bool Paid { get; set; }
    public string? TxRef { get; set; }
    public string? Status { get; set; }        // "success" | "failed" | "pending"
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public string? ChapaReference { get; set; }
    public string? Message { get; set; }
}

/// <summary>Chapa webhook payload (Chapa POSTs this when payment completes).</summary>
public class ChapaWebhookDto
{
    public string? TxRef { get; set; }
    public string? Status { get; set; }
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public string? Reference { get; set; }
    public string? Type { get; set; }
    public string? PaymentMethod { get; set; }
}
