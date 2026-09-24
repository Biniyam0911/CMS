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
    List<PrescriptionItemDto> Items,
    bool IsPaid = false,
    string? Mrn = null);

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

public class NotificationItemDto
{
    public long Id { get; set; }
    public byte TenantId { get; set; }
    public int? RecipientUserId { get; set; }
    public string? Channel { get; set; }
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
    public int Priority { get; set; }
    public string NotificationType { get; set; } = "";
    public string? RefType { get; set; }
    public long? RefId { get; set; }
    public byte StatusId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? TargetRole { get; set; }

    public NotificationItemDto() { }

    public NotificationItemDto(
        long id, byte tenantId, int? recipientUserId, string? channel,
        string subject, string body, int priority, string notificationType,
        string? refType, long? refId, byte statusId, DateTime createdAt,
        string? targetRole = null)
    {
        Id = id;
        TenantId = tenantId;
        RecipientUserId = recipientUserId;
        Channel = channel;
        Subject = subject;
        Body = body;
        Priority = priority;
        NotificationType = notificationType;
        RefType = refType;
        RefId = refId;
        StatusId = statusId;
        CreatedAt = createdAt;
        TargetRole = targetRole;
    }
}

public record BroadcastNotificationDto(
    string Subject, string Body, string NotificationType,
    string? TargetRole = null, int Priority = 1);

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
    public int? InsuranceProviderId { get; set; }
    public string? InsuranceProviderName { get; set; }
    public decimal InsuranceCoPayPercent { get; set; }
    public decimal InsuranceClaimAmount { get; set; }
    public decimal PatientPayAmount { get; set; }
    public string? PreAuthCode { get; set; }
    public byte ClaimStatusId { get; set; } = 1;
    public string? FiscalReceiptNo { get; set; }
    public string? FiscalSignature { get; set; }
    public string? FiscalQrPayload { get; set; }
    public bool IsWaived { get; set; } = false;
    public string? ReceiptImageUrl { get; set; }
    public string? Notes { get; set; }
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
    byte? StatusId = null,
    int? InsuranceProviderId = null,
    decimal? InsuranceCoPayPercent = null,
    string? PreAuthCode = null);

public record ProcessPaymentDto(
    byte TenantId, int InvoiceId, int PatientId, decimal Amount, string PaymentMethod, int ReceivedBy, string? Reference = null);

// ==========================================
// Phase 2 DTOs: IPD, Insurance, Fiscal & PACS
// ==========================================

public class WardDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public string Name { get; set; } = "";
    public string WardType { get; set; } = "General";
    public int TotalBeds { get; set; }
    public int OccupiedBeds { get; set; }
    public int AvailableBeds { get; set; }
    public bool IsActive { get; set; } = true;
}

public class BedDto
{
    public int Id { get; set; }
    public int WardId { get; set; }
    public string WardName { get; set; } = "";
    public string BedNumber { get; set; } = "";
    public decimal DailyRate { get; set; }
    public byte StatusId { get; set; } // 1=Available, 2=Occupied, 3=Maintenance, 4=Cleaning
    public string StatusName { get; set; } = "Available";
    public int? CurrentAdmissionId { get; set; }
    public int? PatientId { get; set; }
    public string? PatientName { get; set; }
    public string? MRN { get; set; }
    public DateTime? AdmittedAt { get; set; }
    public string? DoctorName { get; set; }
}

public class AdmissionDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public string MRN { get; set; } = "";
    public int BedId { get; set; }
    public string BedNumber { get; set; } = "";
    public string WardName { get; set; } = "";
    public int? DoctorId { get; set; }
    public string? DoctorName { get; set; }
    public int? EncounterId { get; set; }
    public DateTime AdmittedAt { get; set; }
    public DateTime? DischargedAt { get; set; }
    public string AdmissionReason { get; set; } = "";
    public string? InitialDiagnosis { get; set; }
    public byte StatusId { get; set; } // 1=Admitted, 2=Discharged, 3=Transferred
    public string StatusName { get; set; } = "Admitted";
    public string? DischargeSummary { get; set; }
    public int? TotalStayDays { get; set; }
    public decimal? TotalBedCharge { get; set; }
    public List<InpatientRoundDto> Rounds { get; set; } = new();
}

public class InpatientRoundDto
{
    public int Id { get; set; }
    public int AdmissionId { get; set; }
    public DateTime RoundTime { get; set; }
    public string StaffName { get; set; } = "";
    public string? BloodPressure { get; set; }
    public int? HeartRate { get; set; }
    public decimal? Temperature { get; set; }
    public int? SpO2 { get; set; }
    public string NursingNotes { get; set; } = "";
    public string? IvFluids { get; set; }
    public string? MedicationsGiven { get; set; }
}

public record AdmitPatientDto(
    byte TenantId, int PatientId, int BedId, int? DoctorId, int? EncounterId,
    string AdmissionReason, string? InitialDiagnosis, int CreatedBy);

public record RecordNursingRoundDto(
    int AdmissionId, string StaffName, string? BloodPressure, int? HeartRate,
    decimal? Temperature, int? SpO2, string NursingNotes, string? IvFluids, string? MedicationsGiven);

public record DischargeInpatientDto(
    int AdmissionId, string DischargeSummary, int? DischargedBy);

public class InsuranceProviderDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public decimal DefaultCoPayPercent { get; set; } = 20.00m;
    public bool IsActive { get; set; } = true;
}

public class InsuranceClaimDto
{
    public int InvoiceId { get; set; }
    public string InvoiceNo { get; set; } = "";
    public int PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public string MRN { get; set; } = "";
    public int InsuranceProviderId { get; set; }
    public string ProviderName { get; set; } = "";
    public string ProviderCode { get; set; } = "";
    public string? PolicyNumber { get; set; }
    public string? PreAuthCode { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal InsuranceCoPayPercent { get; set; }
    public decimal InsuranceClaimAmount { get; set; }
    public decimal PatientPayAmount { get; set; }
    public byte ClaimStatusId { get; set; } // 1=Draft, 2=Submitted, 3=Approved, 4=Reimbursed, 5=Rejected
    public string ClaimStatus { get; set; } = "Submitted";
    public DateTime IssueDate { get; set; }
}

public class FiscalSignResultDto
{
    public bool Success { get; set; }
    public string FiscalReceiptNo { get; set; } = "";
    public string MrcNumber { get; set; } = "";
    public string TinNumber { get; set; } = "";
    public string FiscalSignature { get; set; } = "";
    public string FiscalQrPayload { get; set; } = "";
    public DateTime SignedAt { get; set; }
}

public class RadiologyStudyDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public string MRN { get; set; } = "";
    public int? EncounterId { get; set; }
    public int? DoctorId { get; set; }
    public string? DoctorName { get; set; }
    public string StudyType { get; set; } = "X-Ray"; // X-Ray, CT, Ultrasound, MRI
    public string BodyPart { get; set; } = "Chest";
    public string? ClinicalIndication { get; set; }
    public string? RadiologistFindings { get; set; }
    public string? Impression { get; set; }
    public string ImagePath { get; set; } = "";
    public string ModalityCode { get; set; } = "CR";
    public DateTime StudyDate { get; set; }
    public byte StatusId { get; set; } = 2;
}

// ==========================================
// Phase 3A DTOs: SMS Gateway & Telebirr QR
// ==========================================

public class SendSmsRequestDto
{
    public string RecipientPhone { get; set; } = "";
    public string Message { get; set; } = "";
    public string TriggerEvent { get; set; } = "Manual";
    public int? PatientId { get; set; }
}

public class SmsLogItemDto
{
    public long Id { get; set; }
    public byte TenantId { get; set; }
    public string RecipientPhone { get; set; } = "";
    public int? PatientId { get; set; }
    public string? PatientName { get; set; }
    public string Message { get; set; } = "";
    public string TriggerEvent { get; set; } = "General";
    public string GatewayProvider { get; set; } = "EthioTelecom";
    public string Status { get; set; } = "Sent";
    public string? ExternalMessageId { get; set; }
    public DateTime SentAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TelebirrQrRequestDto
{
    public int InvoiceId { get; set; }
    public decimal Amount { get; set; }
    public string? PayerPhone { get; set; }
}

public class TelebirrQrResponseDto
{
    public bool Success { get; set; }
    public int InvoiceId { get; set; }
    public string InvoiceNo { get; set; } = "";
    public decimal Amount { get; set; }
    public string MerchantCode { get; set; } = "MERCH-ETH-004928";
    public string ShortCode { get; set; } = "8711";
    public string TelebirrQrString { get; set; } = "";
    public string CbeBirrQrString { get; set; } = "";
    public string TransactionReference { get; set; } = "";
    public string PaymentInstructions { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}

public class TelebirrCallbackDto
{
    public int InvoiceId { get; set; }
    public string TransactionNo { get; set; } = "";
    public decimal Amount { get; set; }
    public string PayerPhone { get; set; } = "";
    public string Status { get; set; } = "Completed";
}

// ==============================================================
// Telemedicine & Online Consultation DTOs (Telegram & WhatsApp)
// ==============================================================

public class TelemedSessionSummaryDto
{
    public int Id { get; set; }
    public byte TenantId { get; set; }
    public string SessionNumber { get; set; } = "";
    public int PatientId { get; set; }
    public string PatientName { get; set; } = "";
    public string? PatientPhone { get; set; }
    public string? MRN { get; set; }
    public int? DoctorId { get; set; }
    public string? DoctorName { get; set; }
    public string Platform { get; set; } = "Telegram"; // 'Telegram', 'WhatsApp'
    public string PlatformChatId { get; set; } = "";
    public string ConsultationType { get; set; } = "ChatAndVideo";
    public int StatusId { get; set; } // 1=PendingPayment, 2=Queued, 3=InConsultation, 4=Completed, 5=Cancelled
    public string StatusName => StatusId switch
    {
        1 => "Pending Payment",
        2 => "Waiting in Lobby",
        3 => "In Consultation",
        4 => "Completed",
        5 => "Cancelled",
        _ => "Unknown"
    };
    public string? ChiefComplaint { get; set; }
    public string? TriageNotes { get; set; }
    public decimal ConsultationFee { get; set; }
    public bool IsPaid { get; set; }
    public string? PaymentReference { get; set; }
    public string? RoomUrl { get; set; }
    public int MessageCount { get; set; }
    public int UnreadCount { get; set; }
    public DateTime? ScheduledStartTime { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TelemedMessageDto
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public string SenderType { get; set; } = "Patient"; // 'Patient', 'Doctor', 'SystemBot'
    public int? SenderStaffId { get; set; }
    public string? SenderStaffName { get; set; }
    public int? SenderPatientId { get; set; }
    public string? SenderPatientName { get; set; }
    public string MessageType { get; set; } = "Text"; // 'Text', 'Image', 'VoiceNote', 'Document', 'VideoLink', 'Prescription'
    public string? ContentText { get; set; }
    public string? MediaUrl { get; set; }
    public string? MediaFileName { get; set; }
    public string? MediaMimeType { get; set; }
    public string? PlatformMessageId { get; set; }
    public bool IsReadByDoctor { get; set; }
    public bool IsDeliveredToPatient { get; set; }
    public DateTime SentAt { get; set; }
}

public class SendDoctorMessageRequestDto
{
    public int SessionId { get; set; }
    public string MessageType { get; set; } = "Text"; // 'Text', 'Image', 'VideoLink', 'Prescription'
    public string ContentText { get; set; } = "";
    public string? MediaUrl { get; set; }
    public string? MediaFileName { get; set; }
}

public class InitiateTelemedCallRequestDto
{
    public int SessionId { get; set; }
    public string CallType { get; set; } = "Video"; // 'Video', 'Audio'
}

public class CompleteTelemedConsultationRequestDto
{
    public int SessionId { get; set; }
    public string? Diagnosis { get; set; }
    public string? DoctorNotes { get; set; }
    public string? PrescriptionText { get; set; }
}

public class BillingStatsDto
{
    public int TotalInvoices { get; set; }
    public int BillableInvoices { get; set; }
    public int WaivedInvoices { get; set; }
    public decimal TotalBilled { get; set; }
    public decimal PaidRevenue { get; set; }
    public decimal PendingReceivables { get; set; }
    public int PaidCount { get; set; }
    public int CollectionRate => BillableInvoices > 0 ? (int)Math.Round((double)PaidCount / BillableInvoices * 100) : 100;
}

