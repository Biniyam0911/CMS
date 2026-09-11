using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Billing;

public class BillingService
{
    private readonly IDbConnectionFactory _dbFactory;

    public BillingService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<int> CreateInvoiceAsync(CreateInvoiceDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var invoiceNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
        bool isFree = dto.IsFree == true;
        bool isPaid = dto.StatusId == 4;
        byte initialStatus = (isFree || isPaid) ? (byte)4 : (dto.StatusId ?? (byte)2); // 4 = Paid, 2 = Issued
        decimal subTotal = isFree ? 0 : dto.Items.Sum(i => (i.Quantity * i.UnitPrice) - i.Discount);
        // Dynamic VAT rate from ClinicSettings (TaxRate key, stored as percent e.g. "15" = 15%)
        decimal vatRate = 0.15m;
        try
        {
            var vatStr = await conn.ExecuteScalarAsync<string?>(
                @"SELECT TOP 1 SettingValue FROM ClinicSettings 
                  WHERE TenantId = @TenantId AND SettingKey IN ('TaxRate', 'Tax.DefaultVatPercent')
                  ORDER BY CASE WHEN SettingKey = 'TaxRate' THEN 0 ELSE 1 END",
                new { dto.TenantId });
            if (!string.IsNullOrWhiteSpace(vatStr) && decimal.TryParse(vatStr, out var parsed))
                vatRate = parsed / 100m;
        }
        catch { /* keep default */ }
        decimal tax = isFree ? 0 : Math.Round(subTotal * vatRate, 2);
        decimal total = isFree ? 0 : subTotal + tax;
        decimal paid = isFree ? 0 : (isPaid ? total : 0);

        // Verify if EncounterId exists in Encounters table to satisfy FK_Invoices_Encounters
        int? validEncounterId = null;
        if (dto.EncounterId.HasValue && dto.EncounterId.Value > 0)
        {
            var exists = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM Encounters WHERE Id = @Id AND TenantId = @TenantId",
                new { Id = dto.EncounterId.Value, dto.TenantId });
            if (exists > 0) validEncounterId = dto.EncounterId.Value;
        }

        var sqlHeader = @"
            INSERT INTO Invoices (TenantId, InvoiceNumber, PatientId, EncounterId, StatusId, IssueDate, SubTotal, TaxAmt, TotalAmount, PaidAmount, DiscountAmt, InsuranceClaim, CreatedBy, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@TenantId, @InvoiceNumber, @PatientId, @EncounterId, @InitialStatus, GETDATE(), @SubTotal, @TaxAmt, @TotalAmount, @PaidAmount, 0, 0, @CreatedBy, GETDATE());";

        int invoiceId = await conn.ExecuteScalarAsync<int>(sqlHeader, new {
            dto.TenantId,
            InvoiceNumber = invoiceNumber,
            dto.PatientId,
            EncounterId = validEncounterId,
            InitialStatus = initialStatus,
            SubTotal = subTotal,
            TaxAmt = tax,
            TotalAmount = total,
            PaidAmount = paid,
            CreatedBy = dto.CreatedBy > 0 ? dto.CreatedBy : 1
        });

        var sqlItem = @"
            INSERT INTO InvoiceItems (InvoiceId, ItemType, Description, Quantity, UnitPrice, Discount, Total, RefId)
            VALUES (@InvoiceId, @ItemType, @Description, @Quantity, @UnitPrice, @Discount, @Total, @RefId)";

        foreach (var item in dto.Items)
        {
            byte typeByte = 1;
            if (!string.IsNullOrEmpty(item.ItemType))
            {
                var lower = item.ItemType.ToLower();
                if (lower.Contains("consult") || lower == "1") typeByte = 1;
                else if (lower.Contains("lab") || lower == "2") typeByte = 2;
                else if (lower.Contains("proc") || lower == "3") typeByte = 3;
                else if (lower.Contains("pharm") || lower.Contains("rx") || lower.Contains("drug") || lower == "4") typeByte = 4;
            }

            decimal itemUnitPrice = isFree ? 0 : item.UnitPrice;
            decimal itemTotal = isFree ? 0 : (item.Quantity * item.UnitPrice) - item.Discount;
            int? refId = item.RefId;

            // If lab item and no RefId, try to find an open LabOrder for this patient or create one so it shows in worklist!
            if (typeByte == 2 && (!refId.HasValue || refId.Value <= 0))
            {
                var existingOrderId = await conn.ExecuteScalarAsync<int?>(@"
                    SELECT TOP 1 Id FROM LabOrders 
                    WHERE PatientId = @PatientId AND TenantId = @TenantId AND CAST(OrderedAt AS DATE) = CAST(GETDATE() AS DATE)
                    ORDER BY Id DESC",
                    new { dto.PatientId, dto.TenantId });

                if (existingOrderId.HasValue && existingOrderId.Value > 0)
                {
                    refId = existingOrderId.Value;
                }
                else
                {
                    var newOrderNo = $"LAB-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
                    var orderId = await conn.ExecuteScalarAsync<int>(@"
                        INSERT INTO LabOrders (TenantId, OrderNumber, PatientId, EncounterId, OrderedBy, Priority, OrderedAt, ClinicalInfo, StatusId, CreatedAt)
                        OUTPUT INSERTED.Id
                        VALUES (@TenantId, @OrderNumber, @PatientId, @EncounterId, @CreatedBy, 2, GETDATE(), @ClinicalInfo, 1, GETDATE())",
                        new {
                            dto.TenantId,
                            OrderNumber = newOrderNo,
                            dto.PatientId,
                            EncounterId = validEncounterId,
                            CreatedBy = dto.CreatedBy > 0 ? dto.CreatedBy : 1,
                            ClinicalInfo = item.Description
                        });

                    var testId = await conn.ExecuteScalarAsync<int?>(@"
                        SELECT TOP 1 Id FROM LabTestCatalog 
                        WHERE TenantId = @TenantId AND (TestName LIKE '%' + @Keyword + '%' OR TestCode LIKE '%' + @Keyword + '%')",
                        new { dto.TenantId, Keyword = item.Description.Split('(')[0].Trim() }) ?? 1;

                    await conn.ExecuteAsync(@"
                        INSERT INTO LabOrderItems (OrderId, TestId, StatusId)
                        VALUES (@OrderId, @TestId, 1)",
                        new { OrderId = orderId, TestId = testId });

                    refId = orderId;
                }
            }

            await conn.ExecuteAsync(sqlItem, new {
                InvoiceId = invoiceId,
                ItemType = typeByte,
                Description = item.Description ?? "Clinical Service",
                Quantity = item.Quantity,
                UnitPrice = itemUnitPrice,
                Discount = isFree ? 0 : item.Discount,
                Total = itemTotal,
                RefId = refId
            });
        }

        return invoiceId;
    }

    public async Task<List<InvoiceDto>> GetInvoicesAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT i.Id, i.TenantId, i.InvoiceNumber AS InvoiceNo,
                   i.PatientId, p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   i.EncounterId, i.IssueDate, i.DueDate, i.SubTotal,
                   ISNULL(i.TaxAmt, 0) AS TaxAmount,
                   ISNULL(i.DiscountAmt, 0) AS DiscountAmount,
                   i.TotalAmount, ISNULL(i.PaidAmount, 0) AS PaidAmount,
                   i.StatusId,
                   CASE i.StatusId
                       WHEN 1 THEN 'Draft'
                       WHEN 2 THEN 'Issued'
                       WHEN 3 THEN 'PartiallyPaid'
                       WHEN 4 THEN 'Paid'
                       WHEN 5 THEN 'Void'
                       ELSE 'Issued' END AS StatusName,
                   CASE 
                       WHEN i.TotalAmount = 0 THEN CAST(1 AS BIT)
                       WHEN EXISTS (
                           SELECT 1 FROM Payments pm 
                           WHERE pm.InvoiceId = i.Id 
                             AND (pm.PaymentMethod = 4 OR pm.Reference LIKE '%Waiv%' OR pm.Reference LIKE '%Free%')
                       ) THEN CAST(1 AS BIT)
                       ELSE CAST(0 AS BIT)
                   END AS IsWaived
            FROM Invoices i
            JOIN Patients p ON p.Id = i.PatientId
            WHERE i.TenantId = @TenantId
            ORDER BY i.Id DESC";

        var invoices = (await conn.QueryAsync<InvoiceDto>(sql, new { TenantId = tenantId })).ToList();

        // Populate line items
        var itemSql = @"
            SELECT Id, InvoiceId,
                   CASE ItemType
                       WHEN 1 THEN 'Consultation'
                       WHEN 2 THEN 'Laboratory'
                       WHEN 3 THEN 'Procedure'
                       WHEN 4 THEN 'Pharmacy'
                       ELSE 'Service' END AS ItemType,
                   RefId AS ReferenceId, Description, CAST(Quantity AS INT) AS Quantity, UnitPrice, Total AS TotalPrice
            FROM InvoiceItems
            WHERE InvoiceId IN @InvoiceIds";

        var invoiceIds = invoices.Select(x => x.Id).ToList();
        if (invoiceIds.Any())
        {
            var allItems = (await conn.QueryAsync<InvoiceItemDto>(itemSql, new { InvoiceIds = invoiceIds })).ToList();
            foreach (var inv in invoices)
            {
                var items = allItems.Where(it => it.InvoiceId == inv.Id).ToList();
                inv.Items.AddRange(items);
            }
        }

        return invoices;
    }

    public async Task ProcessPaymentAsync(ProcessPaymentDto dto)
    {
        using var conn = _dbFactory.CreateConnection();

        byte methodCode = 1;
        if (byte.TryParse(dto.PaymentMethod, out var parsedByte))
        {
            methodCode = parsedByte;
        }
        else if (Enum.TryParse<CMS.Domain.Enums.PaymentMethod>(dto.PaymentMethod, true, out var parsedEnum))
        {
            methodCode = (byte)parsedEnum;
        }

        var paymentSql = @"
            INSERT INTO Payments (TenantId, InvoiceId, PatientId, Amount, PaymentDate, PaymentMethod, Reference, ReceivedBy)
            VALUES (@TenantId, @InvoiceId, @PatientId, @Amount, GETDATE(), @PaymentMethod, @Reference, @ReceivedBy);

            UPDATE Invoices
            SET PaidAmount = PaidAmount + @Amount,
                StatusId = CASE WHEN (PaidAmount + @Amount) >= TotalAmount THEN 4 ELSE 3 END,
                UpdatedAt = GETDATE()
            WHERE Id = @InvoiceId AND TenantId = @TenantId;";

        await conn.ExecuteAsync(paymentSql, new
        {
            dto.TenantId,
            dto.InvoiceId,
            dto.PatientId,
            dto.Amount,
            PaymentMethod = methodCode,
            dto.Reference,
            dto.ReceivedBy
        });
    }
}
