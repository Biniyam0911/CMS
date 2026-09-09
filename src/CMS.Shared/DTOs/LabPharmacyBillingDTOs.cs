namespace CMS.Shared.DTOs;

public class DrugFormularyDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public string GenericName { get; set; } = string.Empty;
    public string? BrandName { get; set; }
    public string? DrugClass { get; set; }
    public string? Form { get; set; }
    public string? DosageForm { get => Form; set => Form = value; }
    public string? Strength { get; set; }
    public string? Unit { get; set; }
    public int StockQuantity { get; set; }
    public int CurrentStock { get => StockQuantity; set => StockQuantity = value; }
    public int MinStockLevel { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal CostPrice { get; set; }
    public decimal SellingPrice { get; set; }
    public string? BatchNumber { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public bool IsControlled { get; set; }
    public bool IsActive { get; set; } = true;

    public DrugFormularyDto() { }
}

public record RestockDrugDto(
    int DrugId, int QuantityAdded, decimal UnitCostPrice, decimal UnitSellingPrice,
    string BatchNumber, DateTime ExpiryDate, string? SupplierName);

public record PrescriptionItemDto(
    int Id, int PrescriptionId, int DrugId, string DrugName, string Dosage,
    string Frequency, string Duration, int Quantity, string Instructions);

public record PrescriptionDto(
    int Id, byte TenantId, int EncounterId, int PatientId, string PatientName,
    int DoctorId, string DoctorName, DateTime PrescribedAt, byte StatusId,
    List<PrescriptionItemDto> Items);

public record CreatePrescriptionItemDto(
    int DrugId, string Dosage, string Frequency, string Duration, int Quantity, string Instructions);

public record CreatePrescriptionDto(
    byte TenantId, int EncounterId, int PatientId, int DoctorId,
    List<CreatePrescriptionItemDto> Items);

public record DispensePrescriptionDto(
    int PrescriptionId, int DispensedBy, string? Notes);

public record DispenseDrugDto(
    int ItemId, int DispensedBy = 1, string? Notes = null);

public record EnqueueNotificationDto(
    byte TenantId, int? RecipientUserId, string? RecipientEmail, string? RecipientPhone,
    string Channel, string Subject, string Body, int Priority = 1,
    string? NotificationType = null, string? RefType = null, long? RefId = null);

public class InvoiceItemDto
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public string? ItemType { get; set; }
    public int? ReferenceId { get; set; }
    public string Description { get; set; } = "";
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }

    public InvoiceItemDto() { }

    public InvoiceItemDto(int id, int invoiceId, string? itemType, int? referenceId, string description, int quantity, decimal unitPrice, decimal totalPrice)
    {
        Id = id;
        InvoiceId = invoiceId;
        ItemType = itemType;
        ReferenceId = referenceId;
        Description = description;
        Quantity = quantity;
        UnitPrice = unitPrice;
        TotalPrice = totalPrice;
    }
}

public class InvoiceDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public string InvoiceNo { get; set; } = "";
    public int PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public int? EncounterId { get; set; }
    public DateTime IssueDate { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public byte StatusId { get; set; }
    public string StatusName { get; set; } = "Issued";
    public bool IsWaived { get; set; } = false;
    public List<InvoiceItemDto> Items { get; set; } = new();

    public InvoiceDto() { }

    public InvoiceDto(
        int id, byte tenantId, string invoiceNo, int patientId, string patientName,
        int? encounterId, DateTime issueDate, DateTime? dueDate, decimal subTotal,
        decimal taxAmount, decimal discountAmount, decimal totalAmount, decimal paidAmount,
        byte statusId, string statusName, List<InvoiceItemDto> items, bool isWaived = false)
    {
        Id = id;
        TenantId = tenantId;
        InvoiceNo = invoiceNo;
        PatientId = patientId;
        PatientName = patientName;
        EncounterId = encounterId;
        IssueDate = issueDate;
        DueDate = dueDate;
        SubTotal = subTotal;
        TaxAmount = taxAmount;
        DiscountAmount = discountAmount;
        TotalAmount = totalAmount;
        PaidAmount = paidAmount;
        StatusId = statusId;
        StatusName = statusName;
        Items = items ?? new List<InvoiceItemDto>();
        IsWaived = isWaived;
    }
}

public record CreateInvoiceItemDto(
    string ItemType, string Description, int Quantity, decimal UnitPrice, decimal Discount = 0, int? RefId = null);

public record CreateInvoiceDto(
    byte TenantId, int PatientId, int? EncounterId, int CreatedBy,
    List<CreateInvoiceItemDto> Items,
    bool? IsFree = false,
    byte? StatusId = null);

public record ProcessPaymentDto(
    byte TenantId, int InvoiceId, int PatientId, decimal Amount, string PaymentMethod, int ReceivedBy, string? Reference = null);
