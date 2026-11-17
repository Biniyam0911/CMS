using System;
using System.Collections.Generic;

namespace CMS.Shared.DTOs;

public record CosmeticsItemDto(
    int Id,
    string Code,
    string Description,
    decimal PurchaseUnitPrice,
    decimal Quantity,
    decimal Margin,
    decimal SellingUnitPrice,
    decimal TotalPurchasePrice,
    decimal TotalSellingPrice,
    DateTime RegistrationDate,
    bool IsActive
);

public class CosmeticsItemCreateDto
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal PurchaseUnitPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal Margin { get; set; } = 1.0m;
    public decimal SellingUnitPrice { get; set; }
    public decimal TotalPurchasePrice { get; set; }
    public decimal TotalSellingPrice { get; set; }
}

public class CosmeticsSaleLineCreateDto
{
    public int? ItemId { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string ItemDescription { get; set; } = string.Empty;
    public decimal Quantity { get; set; } = 1.0m;
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
}

public class CosmeticsSaleCreateDto
{
    public string? MobileNo { get; set; }
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string? LastName { get; set; }
    public bool IsPlc { get; set; }
    public decimal TotalAmount { get; set; }
    public List<CosmeticsSaleLineCreateDto> Items { get; set; } = new();
}

public record CosmeticsSaleLineDto(
    int Id,
    int? ItemId,
    string ItemCode,
    string ItemDescription,
    decimal Quantity,
    decimal UnitPrice,
    decimal TotalPrice
);

public record CosmeticsSaleDto(
    int Id,
    string InvoiceNumber,
    string? MobileNo,
    string? FirstName,
    string? MiddleName,
    string? LastName,
    string? FullName,
    bool IsPlc,
    decimal TotalAmount,
    string PaymentStatus,
    DateTime SaleDate,
    TimeSpan SaleTime,
    string? CreatedByName,
    List<CosmeticsSaleLineDto> Items
);

public class CosmeticsSalesReportRowDto
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string SaleDate { get; set; } = string.Empty;
    public string SaleTime { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string MobileNo { get; set; } = string.Empty;
    public string TransactionCategory { get; set; } = "Standard";
    public bool IsPlc { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string ItemDescription { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal PurchaseUnitPrice { get; set; }
    public decimal Profit { get; set; }
    public string Cashier { get; set; } = string.Empty;
}

public class CosmeticsSalesReportSummaryDto
{
    public decimal TotalRevenue { get; set; }
    public decimal TotalCost { get; set; }
    public decimal TotalProfit { get; set; }
    public decimal TotalItemsSold { get; set; }
    public int TotalInvoices { get; set; }
    public List<CosmeticsSalesReportRowDto> Items { get; set; } = new();
}
