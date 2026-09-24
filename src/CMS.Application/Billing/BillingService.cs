using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Billing;

public class BillingService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly IServiceProvider _serviceProvider;

    public BillingService(IDbConnectionFactory dbFactory, IServiceProvider serviceProvider)
    {
        _dbFactory = dbFactory;
        _serviceProvider = serviceProvider;
    }

    public async Task<int> CreateInvoiceAsync(CreateInvoiceDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var invoiceNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
        bool isFree = dto.IsFree == true;
        bool isPaid = dto.StatusId == 4;
        byte initialStatus = (isFree || isPaid) ? (byte)4 : (dto.StatusId ?? (byte)2); // 4 = Paid, 2 = Issued
        decimal subTotal = isFree ? 0 : dto.Items.Sum(i => (i.Quantity * i.UnitPrice) - i.Discount);
        // Dynamic VAT rate from ClinicSettings (TaxRate key, stored as percent e.g. "0" = 0%, "15" = 15%)
        decimal vatRate = 0.0m;
        try
        {
            var vatStr = await conn.ExecuteScalarAsync<string?>(@"
                SELECT TOP 1 SettingValue FROM ClinicSettings 
                WHERE TenantId = @TenantId AND SettingKey = 'TaxRate'",
                new { dto.TenantId });

            if (string.IsNullOrWhiteSpace(vatStr))
            {
                vatStr = await conn.ExecuteScalarAsync<string?>(@"
                    SELECT TOP 1 SettingValue FROM ClinicSettings 
                    WHERE TenantId = @TenantId AND SettingKey = 'Tax.DefaultVatPercent'",
                    new { dto.TenantId });
            }

            if (!string.IsNullOrWhiteSpace(vatStr) && decimal.TryParse(vatStr, out var parsed))
                vatRate = parsed / 100m;
        }
        catch { /* keep default */ }
        decimal tax = isFree ? 0 : Math.Round(subTotal * vatRate, 2);
        decimal total = isFree ? 0 : subTotal + tax;
        decimal paid = isFree ? 0 : (isPaid ? total : 0);

        // Insurance Split Calculations
        decimal coPayPercent = dto.InsuranceCoPayPercent ?? 0;
        decimal insuranceClaim = 0;
        decimal patientPay = total;
        if (dto.InsuranceProviderId.HasValue && dto.InsuranceProviderId.Value > 0 && !isFree)
        {
            if (coPayPercent > 0 && coPayPercent <= 100)
            {
                patientPay = Math.Round(total * (coPayPercent / 100m), 2);
                insuranceClaim = total - patientPay;
            }
            else
            {
                // Default 100% covered if 0 co-pay specified with insurance
                insuranceClaim = total;
                patientPay = 0;
            }
        }

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
            INSERT INTO Invoices (TenantId, InvoiceNumber, PatientId, EncounterId, StatusId, IssueDate, SubTotal, TaxAmt, TotalAmount, PaidAmount, DiscountAmt, InsuranceClaim, InsuranceProviderId, InsuranceCoPayPercent, InsuranceClaimAmount, PatientPayAmount, PreAuthCode, ClaimStatusId, CreatedBy, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@TenantId, @InvoiceNumber, @PatientId, @EncounterId, @InitialStatus, GETDATE(), @SubTotal, @TaxAmt, @TotalAmount, @PaidAmount, 0, @InsuranceClaim, @InsuranceProviderId, @InsuranceCoPayPercent, @InsuranceClaimAmount, @PatientPayAmount, @PreAuthCode, @ClaimStatusId, @CreatedBy, GETDATE());";

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
            InsuranceClaim = insuranceClaim,
            dto.InsuranceProviderId,
            InsuranceCoPayPercent = coPayPercent,
            InsuranceClaimAmount = insuranceClaim,
            PatientPayAmount = patientPay,
            dto.PreAuthCode,
            ClaimStatusId = (dto.InsuranceProviderId.HasValue && dto.InsuranceProviderId.Value > 0) ? 2 : 1, // 2=Submitted, 1=Draft/N/A
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
                    // Resolve a valid DoctorId — FK_LabOrders_Doctors requires a Doctors.Id
                    int validDoctorId = dto.CreatedBy > 0
                        ? (await conn.ExecuteScalarAsync<int?>(
                              "SELECT TOP 1 Id FROM Doctors WHERE Id = @Id", new { Id = dto.CreatedBy }) ?? 0)
                        : 0;
                    if (validDoctorId <= 0)
                        validDoctorId = await conn.ExecuteScalarAsync<int>(
                            "SELECT TOP 1 Id FROM Doctors ORDER BY Id ASC");

                    var newOrderNo = $"LAB-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
                    var orderId = await conn.ExecuteScalarAsync<int>(@"
                        INSERT INTO LabOrders (TenantId, OrderNumber, PatientId, EncounterId, OrderedBy, Priority, OrderedAt, ClinicalInfo, StatusId, CreatedAt)
                        OUTPUT INSERTED.Id
                        VALUES (@TenantId, @OrderNumber, @PatientId, @EncounterId, @OrderedBy, 2, GETDATE(), @ClinicalInfo, 1, GETDATE())",
                        new {
                            dto.TenantId,
                            OrderNumber = newOrderNo,
                            dto.PatientId,
                            EncounterId = validEncounterId,
                            OrderedBy = validDoctorId,
                            ClinicalInfo = item.Description
                        });

                    // Try to match an existing LabTestCatalog entry by name/code in the description
                    var testId = await conn.ExecuteScalarAsync<int?>(@"
                        SELECT TOP 1 Id FROM LabTestCatalog 
                        WHERE TenantId = @TenantId AND IsActive = 1
                          AND (TestName LIKE '%' + @Keyword + '%' OR TestCode LIKE '%' + @Keyword + '%')",
                        new { dto.TenantId, Keyword = item.Description.Split('(')[0].Trim() });

                    if (!testId.HasValue || testId <= 0)
                        testId = await conn.ExecuteScalarAsync<int>(
                            "SELECT TOP 1 Id FROM LabTestCatalog WHERE TenantId = @TenantId AND IsActive = 1 ORDER BY Id ASC",
                            new { dto.TenantId });

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

        try
        {
            var notifType = initialStatus == 4 ? "PaymentSettled" : "InvoicePending";
            var notifSub = initialStatus == 4 ? $"Payment Settled: {invoiceNumber} (Br {total:F2})" : $"Invoice Issued: {invoiceNumber} (Br {total:F2})";
            var notifBody = initialStatus == 4 
                ? $"Invoice {invoiceNumber} settled in full for Br {total:F2}. Receipt generated."
                : $"Invoice {invoiceNumber} for Br {total:F2} generated for patient #{dto.PatientId}. Awaiting payment at cashier.";
            
            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, @Subject, @Body, 2, @NotificationType, 'BillingOfficer,Doctor,Admin', @RefId, 1, GETDATE())",
                new { dto.TenantId, Subject = notifSub, Body = notifBody, NotificationType = notifType, RefId = invoiceId });
        }
        catch { /* notification logging non-blocking */ }

        return invoiceId;
    }

    public async Task<BillingStatsDto> GetBillingStatsAsync(byte tenantId, DateTime? fromDate = null, DateTime? toDate = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT 
                COUNT(1) AS TotalInvoices,
                SUM(CASE WHEN TotalAmount > 0 THEN 1 ELSE 0 END) AS BillableInvoices,
                SUM(CASE WHEN TotalAmount = 0 THEN 1 ELSE 0 END) AS WaivedInvoices,
                ISNULL(SUM(CASE WHEN TotalAmount > 0 THEN TotalAmount ELSE 0 END), 0) AS TotalBilled,
                ISNULL(SUM(CASE WHEN TotalAmount > 0 THEN PaidAmount ELSE 0 END), 0) AS PaidRevenue,
                ISNULL(SUM(CASE WHEN TotalAmount > 0 AND TotalAmount > PaidAmount THEN TotalAmount - PaidAmount ELSE 0 END), 0) AS PendingReceivables,
                SUM(CASE WHEN StatusId = 4 AND TotalAmount > 0 THEN 1 ELSE 0 END) AS PaidCount
            FROM Invoices WITH (NOLOCK)
            WHERE TenantId = @TenantId
              AND (@FromDate IS NULL OR CAST(IssueDate AS DATE) >= CAST(@FromDate AS DATE))
              AND (@ToDate IS NULL OR CAST(IssueDate AS DATE) <= CAST(@ToDate AS DATE))";

        var stats = await conn.QueryFirstOrDefaultAsync<BillingStatsDto>(sql, new { TenantId = tenantId, FromDate = fromDate, ToDate = toDate });
        return stats ?? new BillingStatsDto();
    }

    public async Task<List<InvoiceDto>> GetInvoicesAsync(byte tenantId, int limit = 200, int? patientId = null, DateTime? fromDate = null, DateTime? toDate = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT TOP (@Limit) i.Id, i.TenantId, i.InvoiceNumber AS InvoiceNo,
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
                   END AS IsWaived,
                   i.InsuranceProviderId,
                   ip.Name AS InsuranceProviderName,
                   ISNULL(i.InsuranceCoPayPercent, 0) AS InsuranceCoPayPercent,
                   ISNULL(i.InsuranceClaimAmount, 0) AS InsuranceClaimAmount,
                   ISNULL(i.PatientPayAmount, i.TotalAmount) AS PatientPayAmount,
                   i.PreAuthCode,
                   ISNULL(i.ClaimStatusId, 1) AS ClaimStatusId,
                   i.FiscalReceiptNo,
                   i.FiscalSignature,
                   i.FiscalQrPayload,
                   i.ReceiptImageUrl,
                   i.Notes
            FROM Invoices i WITH (NOLOCK)
            JOIN Patients p WITH (NOLOCK) ON p.Id = i.PatientId
            LEFT JOIN InsuranceProviders ip WITH (NOLOCK) ON ip.Id = i.InsuranceProviderId
            WHERE i.TenantId = @TenantId
              AND (@PatientId IS NULL OR i.PatientId = @PatientId)
              AND (@FromDate IS NULL OR CAST(i.IssueDate AS DATE) >= CAST(@FromDate AS DATE))
              AND (@ToDate IS NULL OR CAST(i.IssueDate AS DATE) <= CAST(@ToDate AS DATE))
            ORDER BY i.Id DESC";

        var invoices = (await conn.QueryAsync<InvoiceDto>(sql, new { TenantId = tenantId, Limit = limit, PatientId = patientId, FromDate = fromDate, ToDate = toDate })).ToList();

        // Populate line items in O(N) using lookup dictionary
        var invoiceIds = invoices.Select(x => x.Id).ToList();
        if (invoiceIds.Any())
        {
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

            var allItems = (await conn.QueryAsync<InvoiceItemDto>(itemSql, new { InvoiceIds = invoiceIds })).ToList();
            var itemLookup = allItems.ToLookup(it => it.InvoiceId);
            foreach (var inv in invoices)
            {
                inv.Items.AddRange(itemLookup[inv.Id]);
            }
        }

        return invoices;
    }

    public async Task<InvoiceDto?> GetInvoiceByIdAsync(int id, byte tenantId)
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
                   END AS IsWaived,
                   i.InsuranceProviderId,
                   ip.Name AS InsuranceProviderName,
                   ISNULL(i.InsuranceCoPayPercent, 0) AS InsuranceCoPayPercent,
                   ISNULL(i.InsuranceClaimAmount, 0) AS InsuranceClaimAmount,
                   ISNULL(i.PatientPayAmount, i.TotalAmount) AS PatientPayAmount,
                   i.PreAuthCode,
                   ISNULL(i.ClaimStatusId, 1) AS ClaimStatusId,
                   i.FiscalReceiptNo,
                   i.FiscalSignature,
                   i.FiscalQrPayload,
                   i.ReceiptImageUrl,
                   i.Notes
            FROM Invoices i
            JOIN Patients p ON p.Id = i.PatientId
            LEFT JOIN InsuranceProviders ip ON ip.Id = i.InsuranceProviderId
            WHERE i.Id = @Id AND i.TenantId = @TenantId";

        var inv = await conn.QueryFirstOrDefaultAsync<InvoiceDto>(sql, new { Id = id, TenantId = tenantId });
        if (inv != null)
        {
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
                WHERE InvoiceId = @InvoiceId";
            var items = (await conn.QueryAsync<InvoiceItemDto>(itemSql, new { InvoiceId = id })).ToList();
            inv.Items.AddRange(items);
        }
        return inv;
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
            WHERE Id = @InvoiceId AND TenantId = @TenantId;

            SELECT StatusId FROM Invoices WHERE Id = @InvoiceId;";

        byte newStatus = await conn.ExecuteScalarAsync<byte>(paymentSql, new
        {
            dto.TenantId,
            dto.InvoiceId,
            dto.PatientId,
            dto.Amount,
            PaymentMethod = methodCode,
            dto.Reference,
            dto.ReceivedBy
        });

        // When invoice is marked as Paid (StatusId = 4), verify and notify patient on Telegram if applicable
        if (newStatus == 4)
        {
            try
            {
                var telemedService = _serviceProvider.GetService(typeof(CMS.Application.Telemedicine.TelemedService)) as CMS.Application.Telemedicine.TelemedService;
                if (telemedService != null)
                {
                    await telemedService.NotifyPaymentVerifiedAsync(dto.TenantId, dto.InvoiceId);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TELEMED PAYMENT NOTIFY ERROR] {ex.Message}");
            }
        }

        try
        {
            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, 'Payment Settled: Invoice #' + CAST(@InvoiceId AS VARCHAR), 'Payment of Br ' + CAST(@Amount AS VARCHAR) + ' collected for patient #' + CAST(@PatientId AS VARCHAR) + ' (Ref: ' + ISNULL(@Reference, 'Cash') + ').', 2, 'PaymentSettled', 'BillingOfficer,Doctor,Admin', @InvoiceId, 1, GETDATE())",
                new { dto.TenantId, dto.InvoiceId, dto.PatientId, dto.Amount, dto.Reference });
        }
        catch { /* non-blocking notification */ }
    }

    public async Task<List<InsuranceProviderDto>> GetInsuranceProvidersAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT Id, TenantId, Name, Code, ContactPerson, Phone, Email, DefaultCoPayPercent, IsActive
            FROM InsuranceProviders
            WHERE TenantId = @TenantId AND IsActive = 1
            ORDER BY Name ASC";
        return (await conn.QueryAsync<InsuranceProviderDto>(sql, new { TenantId = tenantId })).ToList();
    }

    public async Task<List<InsuranceClaimDto>> GetInsuranceClaimsAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT i.Id AS InvoiceId, i.InvoiceNumber AS InvoiceNo,
                   i.PatientId, p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN,
                   ISNULL(i.InsuranceProviderId, 0) AS InsuranceProviderId,
                   ISNULL(ip.Name, 'Self / Cash') AS ProviderName,
                   ISNULL(ip.Code, 'CASH') AS ProviderCode,
                   p.InsurancePolicyNo AS PolicyNumber,
                   i.PreAuthCode,
                   i.TotalAmount,
                   ISNULL(i.InsuranceCoPayPercent, 0) AS InsuranceCoPayPercent,
                   ISNULL(i.InsuranceClaimAmount, 0) AS InsuranceClaimAmount,
                   ISNULL(i.PatientPayAmount, i.TotalAmount) AS PatientPayAmount,
                   ISNULL(i.ClaimStatusId, 2) AS ClaimStatusId,
                   CASE i.ClaimStatusId
                       WHEN 1 THEN 'Draft'
                       WHEN 2 THEN 'Submitted'
                       WHEN 3 THEN 'Approved'
                       WHEN 4 THEN 'Reimbursed'
                       WHEN 5 THEN 'Rejected'
                       ELSE 'Submitted' END AS ClaimStatus,
                   i.IssueDate
            FROM Invoices i
            JOIN Patients p ON p.Id = i.PatientId
            JOIN InsuranceProviders ip ON ip.Id = i.InsuranceProviderId
            WHERE i.TenantId = @TenantId AND i.InsuranceProviderId IS NOT NULL
            ORDER BY i.Id DESC";
        return (await conn.QueryAsync<InsuranceClaimDto>(sql, new { TenantId = tenantId })).ToList();
    }

    public async Task<bool> UpdateClaimStatusAsync(int invoiceId, byte statusId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = "UPDATE Invoices SET ClaimStatusId = @StatusId, UpdatedAt = GETDATE() WHERE Id = @InvoiceId";
        return await conn.ExecuteAsync(sql, new { InvoiceId = invoiceId, StatusId = statusId }) > 0;
    }
}
