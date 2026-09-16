using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Billing;

public class TelebirrPaymentService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly BillingService _billingService;

    public TelebirrPaymentService(IDbConnectionFactory dbFactory, BillingService billingService)
    {
        _dbFactory = dbFactory;
        _billingService = billingService;
    }

    public async Task<TelebirrQrResponseDto> GenerateDynamicQrAsync(byte tenantId, TelebirrQrRequestDto req)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT i.Id, i.InvoiceNumber, i.TotalAmount, ISNULL(i.PaidAmount, 0) AS PaidAmount,
                   p.FirstName + ' ' + p.LastName AS PatientName, p.PrimaryPhone AS Phone
            FROM Invoices i
            JOIN Patients p ON p.Id = i.PatientId
            WHERE i.Id = @InvoiceId AND i.TenantId = @TenantId";

        var inv = await conn.QueryFirstOrDefaultAsync<dynamic>(sql, new { req.InvoiceId, TenantId = tenantId });
        if (inv == null)
        {
            return new TelebirrQrResponseDto { Success = false };
        }

        decimal payable = req.Amount > 0 ? req.Amount : Math.Max(0, (decimal)inv.TotalAmount - (decimal)inv.PaidAmount);
        string invoiceNo = (string)inv.InvoiceNumber;
        string txnRef = $"TB-{DateTime.UtcNow:yyyyMMdd}-{req.InvoiceId:D6}";
        string merchantCode = "MERCH-ETH-004928";
        string shortCode = "8711";

        // Generate official Telebirr SuperApp Deeplink / Dynamic QR payload
        // Format: telebirr://pay?merch=XXX&amount=YYY&ref=ZZZ&desc=Medical+Bill
        string telebirrQr = $"telebirr://pay?merch={merchantCode}&amount={payable:F2}&ref={txnRef}&inv={invoiceNo}";
        
        // Generate CBE Birr USSD / QR payload
        string cbeBirrQr = $"cbebirr://pay?code={shortCode}&bill={invoiceNo}&amount={payable:F2}&ref={txnRef}";

        string instructions = $"Dial *127# on Ethio Telecom, select 'Pay Merchant' -> Code {shortCode}, or scan using Telebirr SuperApp.";

        return new TelebirrQrResponseDto
        {
            Success = true,
            InvoiceId = req.InvoiceId,
            InvoiceNo = invoiceNo,
            Amount = payable,
            MerchantCode = merchantCode,
            ShortCode = shortCode,
            TelebirrQrString = telebirrQr,
            CbeBirrQrString = cbeBirrQr,
            TransactionReference = txnRef,
            PaymentInstructions = instructions,
            ExpiresAt = DateTime.UtcNow.AddMinutes(15)
        };
    }

    public async Task<bool> ProcessTelebirrCallbackAsync(byte tenantId, TelebirrCallbackDto callback)
    {
        using var conn = _dbFactory.CreateConnection();

        // 1. Check if invoice exists and get patient ID
        var inv = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, PatientId, TotalAmount, ISNULL(PaidAmount,0) AS PaidAmount FROM Invoices WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = callback.InvoiceId, TenantId = tenantId });

        if (inv == null) return false;

        // 2. Process payment via BillingService
        var paymentDto = new ProcessPaymentDto(
            TenantId: tenantId,
            InvoiceId: callback.InvoiceId,
            PatientId: (int)inv.PatientId,
            Amount: callback.Amount,
            PaymentMethod: "2", // 2: Telebirr / CBE Mobile
            ReceivedBy: 1,
            Reference: $"Telebirr TX: {callback.TransactionNo} (Phone: {callback.PayerPhone})"
        );

        await _billingService.ProcessPaymentAsync(paymentDto);

        // 3. Update payment record with Telebirr metadata
        await conn.ExecuteAsync(@"
            UPDATE Payments 
            SET TelebirrTransactionNo = @TxnNo, TelebirrPayerPhone = @PayerPhone
            WHERE InvoiceId = @InvoiceId AND Reference LIKE '%' + @TxnNo + '%'",
            new { TxnNo = callback.TransactionNo, callback.PayerPhone, callback.InvoiceId });

        return true;
    }
}
