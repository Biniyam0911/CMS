using System.Diagnostics;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class CosmeticsController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public CosmeticsController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    /// <summary>
    /// Fetch all active stock items
    /// </summary>
    [HttpGet("stock")]
    public async Task<IActionResult> GetStock([FromQuery] string? search = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT Id, Code, Description, PurchaseUnitPrice, Quantity, Margin,
                   SellingUnitPrice, TotalPurchasePrice, TotalSellingPrice, RegistrationDate, IsActive
            FROM dbo.CosmeticsItems WITH (NOLOCK)
            WHERE TenantId = @TenantId AND IsActive = 1
              AND (@Search IS NULL OR Code LIKE '%' + @Search + '%' OR Description LIKE '%' + @Search + '%')
            ORDER BY Code ASC, Description ASC";

        var items = (await conn.QueryAsync<CosmeticsItemDto>(sql, new { TenantId = tenantId, Search = search })).ToList();
        return Ok(ApiResponse<List<CosmeticsItemDto>>.Ok(items));
    }

    /// <summary>
    /// Register new stock item / Add stock
    /// </summary>
    [HttpPost("items")]
    public async Task<IActionResult> AddStock([FromBody] CosmeticsItemCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest(ApiResponse<object>.Fail("Item Code is required."));

        if (string.IsNullOrWhiteSpace(dto.Description))
            return BadRequest(ApiResponse<object>.Fail("Item Description is required."));

        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        decimal margin = dto.Margin > 0 ? dto.Margin : 1.0m;
        decimal purchasePrice = dto.PurchaseUnitPrice >= 0 ? dto.PurchaseUnitPrice : 0.0m;
        decimal quantity = dto.Quantity >= 0 ? dto.Quantity : 0.0m;

        // Auto calculate if not provided
        decimal sellingPrice = dto.SellingUnitPrice > 0 ? dto.SellingUnitPrice : Math.Round(purchasePrice * margin, 2);
        decimal totalPurchase = dto.TotalPurchasePrice > 0 ? dto.TotalPurchasePrice : Math.Round(purchasePrice * quantity, 2);
        decimal totalSelling = dto.TotalSellingPrice > 0 ? dto.TotalSellingPrice : Math.Round(sellingPrice * quantity, 2);

        // Check if code already exists
        var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT Id, Quantity FROM dbo.CosmeticsItems 
            WHERE TenantId = @TenantId AND Code = @Code",
            new { TenantId = tenantId, Code = dto.Code.Trim() });

        if (existing != null)
        {
            // Update existing stock: add quantity and update prices
            decimal newQty = (decimal)existing.Quantity + quantity;
            decimal newTotalPurchase = Math.Round(purchasePrice * newQty, 2);
            decimal newTotalSelling = Math.Round(sellingPrice * newQty, 2);

            var sqlUpdate = @"
                UPDATE dbo.CosmeticsItems
                SET Description = @Description,
                    PurchaseUnitPrice = @PurchaseUnitPrice,
                    Quantity = @Quantity,
                    Margin = @Margin,
                    SellingUnitPrice = @SellingUnitPrice,
                    TotalPurchasePrice = @TotalPurchasePrice,
                    TotalSellingPrice = @TotalSellingPrice,
                    UpdatedAt = GETDATE()
                WHERE Id = @Id";

            await conn.ExecuteAsync(sqlUpdate, new
            {
                Id = (int)existing.Id,
                Description = dto.Description.Trim(),
                PurchaseUnitPrice = purchasePrice,
                Quantity = newQty,
                Margin = margin,
                SellingUnitPrice = sellingPrice,
                TotalPurchasePrice = newTotalPurchase,
                TotalSellingPrice = newTotalSelling
            });

            return Ok(ApiResponse<object>.Ok(new { message = "Stock updated successfully.", code = dto.Code.Trim(), updatedQuantity = newQty }));
        }

        // Insert new item
        var sqlInsert = @"
            INSERT INTO dbo.CosmeticsItems (
                TenantId, Code, Description, PurchaseUnitPrice, Quantity, Margin,
                SellingUnitPrice, TotalPurchasePrice, TotalSellingPrice, RegistrationDate, IsActive, CreatedAt
            )
            OUTPUT INSERTED.Id
            VALUES (
                @TenantId, @Code, @Description, @PurchaseUnitPrice, @Quantity, @Margin,
                @SellingUnitPrice, @TotalPurchasePrice, @TotalSellingPrice, CAST(GETDATE() AS DATE), 1, GETDATE()
            );";

        int newId = await conn.ExecuteScalarAsync<int>(sqlInsert, new
        {
            TenantId = tenantId,
            Code = dto.Code.Trim(),
            Description = dto.Description.Trim(),
            PurchaseUnitPrice = purchasePrice,
            Quantity = quantity,
            Margin = margin,
            SellingUnitPrice = sellingPrice,
            TotalPurchasePrice = totalPurchase,
            TotalSellingPrice = totalSelling
        });

        return Ok(ApiResponse<object>.Ok(new { id = newId, code = dto.Code.Trim(), message = "Item registered successfully." }));
    }

    /// <summary>
    /// Look up client details by phone/mobile number across patient records, sales, and facial registrations
    /// </summary>
    [HttpGet("client-lookup")]
    public async Task<IActionResult> ClientLookup([FromQuery] string mobile)
    {
        if (string.IsNullOrWhiteSpace(mobile))
            return BadRequest(ApiResponse<object>.Fail("Mobile number is required."));

        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        string cleanMobile = mobile.Trim();

        // 1. Try from Patients table
        var patient = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT TOP 1 FirstName, MiddleName, LastName, PrimaryPhone AS MobileNo
            FROM dbo.Patients
            WHERE TenantId = @TenantId AND (PrimaryPhone LIKE '%' + @Mobile + '%' OR SecondaryPhone LIKE '%' + @Mobile + '%')",
            new { TenantId = tenantId, Mobile = cleanMobile });

        if (patient != null)
        {
            return Ok(ApiResponse<object>.Ok(new
            {
                firstName = (string?)patient.FirstName ?? "",
                middleName = (string?)patient.MiddleName ?? "",
                lastName = (string?)patient.LastName ?? "",
                mobile = (string?)patient.MobileNo ?? cleanMobile
            }));
        }

        // 2. Try from previous CosmeticsSales
        var prevSale = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT TOP 1 FirstName, MiddleName, LastName, MobileNo
            FROM dbo.CosmeticsSales
            WHERE TenantId = @TenantId AND MobileNo LIKE '%' + @Mobile + '%'
            ORDER BY Id DESC",
            new { TenantId = tenantId, Mobile = cleanMobile });

        if (prevSale != null)
        {
            return Ok(ApiResponse<object>.Ok(new
            {
                firstName = (string?)prevSale.FirstName ?? "",
                middleName = (string?)prevSale.MiddleName ?? "",
                lastName = (string?)prevSale.LastName ?? "",
                mobile = (string?)prevSale.MobileNo ?? cleanMobile
            }));
        }

        // 3. Try from FacialRegistrations
        var facial = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT TOP 1 FirstName, MiddleName, LastName, Mobile
            FROM dbo.FacialRegistrations
            WHERE TenantId = @TenantId AND Mobile LIKE '%' + @Mobile + '%'
            ORDER BY Id DESC",
            new { TenantId = tenantId, Mobile = cleanMobile });

        if (facial != null)
        {
            return Ok(ApiResponse<object>.Ok(new
            {
                firstName = (string?)facial.FirstName ?? "",
                middleName = (string?)facial.MiddleName ?? "",
                lastName = (string?)facial.LastName ?? "",
                mobile = (string?)facial.Mobile ?? cleanMobile
            }));
        }

        return Ok(ApiResponse<object?>.Ok(null));
    }

    /// <summary>
    /// Process and record a cash sale
    /// </summary>
    [HttpPost("sales")]
    public async Task<IActionResult> ProcessCashSale([FromBody] CosmeticsSaleCreateDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("At least one sale item is required."));

        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        if (conn.State != System.Data.ConnectionState.Open) conn.Open();
        using var trans = conn.BeginTransaction();

        try
        {
            // Generate Invoice Number (CS-YYYY-XXXX)
            var maxId = await conn.ExecuteScalarAsync<int?>("SELECT MAX(Id) FROM dbo.CosmeticsSales WITH (TABLOCKX)", transaction: trans) ?? 0;
            string invNo = $"CS-{DateTime.UtcNow:yyyy}-{(maxId + 1):D4}";

            decimal totalAmount = 0m;
            foreach (var line in dto.Items)
            {
                decimal qty = line.Quantity > 0 ? line.Quantity : 1.0m;
                totalAmount += Math.Round(qty * line.UnitPrice, 2);
            }
            if (dto.TotalAmount > 0) totalAmount = dto.TotalAmount;

            var currentUserName = User.Identity?.Name ?? "Cashier";

            var sqlSale = @"
                INSERT INTO dbo.CosmeticsSales (
                    TenantId, InvoiceNumber, MobileNo, FirstName, MiddleName, LastName,
                    IsPlc, TotalAmount, PaymentStatus, SaleDate, SaleTime, CreatedByName, CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @TenantId, @InvoiceNumber, @MobileNo, @FirstName, @MiddleName, @LastName,
                    @IsPlc, @TotalAmount, 'Paid', CAST(GETDATE() AS DATE), CAST(GETDATE() AS TIME(0)), @CreatedByName, GETDATE()
                );";

            int saleId = await conn.ExecuteScalarAsync<int>(sqlSale, new
            {
                TenantId = tenantId,
                InvoiceNumber = invNo,
                MobileNo = dto.MobileNo?.Trim(),
                FirstName = dto.FirstName?.Trim(),
                MiddleName = dto.MiddleName?.Trim(),
                LastName = dto.LastName?.Trim(),
                IsPlc = dto.IsPlc,
                TotalAmount = totalAmount,
                CreatedByName = currentUserName
            }, transaction: trans);

            // Insert line items and decrement stock
            foreach (var item in dto.Items)
            {
                decimal lineQty = item.Quantity > 0 ? item.Quantity : 1.0m;
                decimal linePrice = item.UnitPrice;
                decimal lineTotal = Math.Round(lineQty * linePrice, 2);

                // Fetch item info for PurchaseUnitPrice
                var stockItem = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                    SELECT Id, PurchaseUnitPrice, Quantity FROM dbo.CosmeticsItems 
                    WHERE TenantId = @TenantId AND (Id = @ItemId OR Code = @Code)",
                    new { TenantId = tenantId, ItemId = item.ItemId, Code = item.ItemCode },
                    transaction: trans);

                decimal purchaseUnit = stockItem != null ? (decimal)stockItem.PurchaseUnitPrice : 0.0m;
                int? matchedItemId = stockItem != null ? (int)stockItem.Id : item.ItemId;

                var sqlLine = @"
                    INSERT INTO dbo.CosmeticsSaleItems (
                        TenantId, SaleId, ItemId, ItemCode, ItemDescription,
                        Quantity, UnitPrice, TotalPrice, PurchaseUnitPrice, CreatedAt
                    )
                    VALUES (
                        @TenantId, @SaleId, @ItemId, @ItemCode, @ItemDescription,
                        @Quantity, @UnitPrice, @TotalPrice, @PurchaseUnitPrice, GETDATE()
                    );";

                await conn.ExecuteAsync(sqlLine, new
                {
                    TenantId = tenantId,
                    SaleId = saleId,
                    ItemId = matchedItemId,
                    ItemCode = item.ItemCode,
                    ItemDescription = item.ItemDescription,
                    Quantity = lineQty,
                    UnitPrice = linePrice,
                    TotalPrice = lineTotal,
                    PurchaseUnitPrice = purchaseUnit
                }, transaction: trans);

                // Decrement stock balance
                if (matchedItemId.HasValue)
                {
                    await conn.ExecuteAsync(@"
                        UPDATE dbo.CosmeticsItems
                        SET Quantity = CASE WHEN Quantity - @Qty >= 0 THEN Quantity - @Qty ELSE 0 END,
                            TotalPurchasePrice = PurchaseUnitPrice * (CASE WHEN Quantity - @Qty >= 0 THEN Quantity - @Qty ELSE 0 END),
                            TotalSellingPrice = SellingUnitPrice * (CASE WHEN Quantity - @Qty >= 0 THEN Quantity - @Qty ELSE 0 END),
                            UpdatedAt = GETDATE()
                        WHERE Id = @ItemId AND TenantId = @TenantId",
                        new { Qty = lineQty, ItemId = matchedItemId.Value, TenantId = tenantId },
                        transaction: trans);
                }
            }

            trans.Commit();

            return Ok(ApiResponse<object>.Ok(new
            {
                saleId = saleId,
                invoiceNumber = invNo,
                totalAmount = totalAmount,
                message = "Sale processed and stock updated successfully."
            }));
        }
        catch (Exception ex)
        {
            trans.Rollback();
            return StatusCode(500, ApiResponse<object>.Fail($"Failed to process sale: {ex.Message}"));
        }
    }

    /// <summary>
    /// Itemized Cosmetics Sales Report with metrics
    /// </summary>
    [HttpGet("reports/sales")]
    public async Task<IActionResult> GetSalesReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? search = null,
        [FromQuery] bool? isPlc = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        DateTime fDate = fromDate ?? DateTime.Today.AddDays(-30);
        DateTime tDate = toDate ?? DateTime.Today;

        var sql = @"
            SELECT 
                cs.Id,
                cs.InvoiceNumber,
                FORMAT(cs.SaleDate, 'yyyy-MM-dd') AS SaleDate,
                CONVERT(VARCHAR(8), cs.SaleTime, 108) AS SaleTime,
                ISNULL(NULLIF(cs.FullName, ''), 'Walk-in Client') AS ClientName,
                ISNULL(cs.MobileNo, '-') AS MobileNo,
                CASE WHEN cs.IsPlc = 1 THEN 'PLC' ELSE 'Standard' END AS TransactionCategory,
                cs.IsPlc,
                csi.ItemCode,
                csi.ItemDescription,
                csi.Quantity,
                csi.UnitPrice,
                csi.TotalPrice,
                csi.PurchaseUnitPrice,
                (csi.TotalPrice - (csi.PurchaseUnitPrice * csi.Quantity)) AS Profit,
                ISNULL(cs.CreatedByName, 'Cashier') AS Cashier
            FROM dbo.CosmeticsSales cs WITH (NOLOCK)
            INNER JOIN dbo.CosmeticsSaleItems csi WITH (NOLOCK) ON cs.Id = csi.SaleId
            WHERE cs.TenantId = @TenantId
              AND cs.SaleDate >= @FromDate AND cs.SaleDate <= @ToDate
              AND (@IsPlc IS NULL OR cs.IsPlc = @IsPlc)
              AND (@Search IS NULL 
                   OR cs.InvoiceNumber LIKE '%' + @Search + '%'
                   OR cs.FullName LIKE '%' + @Search + '%'
                   OR cs.MobileNo LIKE '%' + @Search + '%'
                   OR csi.ItemCode LIKE '%' + @Search + '%'
                   OR csi.ItemDescription LIKE '%' + @Search + '%')
            ORDER BY cs.SaleDate DESC, cs.Id DESC;";

        var rows = (await conn.QueryAsync<CosmeticsSalesReportRowDto>(sql, new
        {
            TenantId = tenantId,
            FromDate = fDate,
            ToDate = tDate,
            IsPlc = isPlc,
            Search = search
        })).ToList();

        decimal totalRevenue = rows.Sum(r => r.TotalPrice);
        decimal totalCost = rows.Sum(r => r.PurchaseUnitPrice * r.Quantity);
        decimal totalProfit = totalRevenue - totalCost;
        decimal totalItemsSold = rows.Sum(r => r.Quantity);
        int totalInvoices = rows.Select(r => r.InvoiceNumber).Distinct().Count();

        var summary = new CosmeticsSalesReportSummaryDto
        {
            TotalRevenue = totalRevenue,
            TotalCost = totalCost,
            TotalProfit = totalProfit,
            TotalItemsSold = totalItemsSold,
            TotalInvoices = totalInvoices,
            Items = rows
        };

        return Ok(ApiResponse<CosmeticsSalesReportSummaryDto>.Ok(summary));
    }
}
