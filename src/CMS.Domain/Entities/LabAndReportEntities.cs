namespace CMS.Domain.Entities;

public class LabInstrument : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public byte Protocol { get; set; } = 1; // 1=HL7, 2=ASTM
    public string IpAddress { get; set; } = string.Empty;
    public int Port { get; set; }
    public string Category { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class LabTestCatalog : BaseEntity
{
    public string TestCode { get; set; } = string.Empty;
    public string TestName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public string SampleType { get; set; } = string.Empty;
    public string SampleVolume { get; set; } = string.Empty;
    public int TurnaroundMinutes { get; set; }
    public decimal? NormalRangeLow { get; set; }
    public decimal? NormalRangeHigh { get; set; }
    public decimal? CriticalLow { get; set; }
    public decimal? CriticalHigh { get; set; }
    public string Unit { get; set; } = string.Empty;
    public byte ResultType { get; set; } = 1; // 1=Numeric, 2=Text, 3=PosNeg
    public decimal Price { get; set; }
    public int? InstrumentId { get; set; }
    public List<LabTestParameter> Parameters { get; set; } = new();
}

public class LabTestParameter
{
    public int Id { get; set; }
    public int TestCatalogId { get; set; }
    public string ParameterCode { get; set; } = string.Empty;
    public string ParameterName { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal? ReferenceLow { get; set; }
    public decimal? ReferenceHigh { get; set; }
    public string? TextReferenceRange { get; set; }
    public int DisplayOrder { get; set; } = 1;
}

public class LabOrder : BaseEntity
{
    public string OrderNumber { get; set; } = string.Empty;
    public int PatientId { get; set; }
    public Patient? Patient { get; set; }
    public int? EncounterId { get; set; }
    public int OrderedBy { get; set; }
    public byte Priority { get; set; } = 2; // 1=STAT, 2=Routine, 3=Scheduled
    public DateTime OrderedAt { get; set; } = DateTime.UtcNow;
    public string? ClinicalInfo { get; set; }
    public byte StatusId { get; set; } = 1; // 1=Ordered, 2=Collected, 3=Processing, 4=Resulted, 5=Delivered
    public List<LabOrderItem> OrderItems { get; set; } = new();
}

public class LabOrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int TestId { get; set; }
    public LabTestCatalog? Test { get; set; }
    public byte StatusId { get; set; } = 1;
    public List<LabResult> Results { get; set; } = new();
}

public class LabSample : BaseEntity
{
    public int OrderId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string SampleType { get; set; } = string.Empty;
    public string Volume { get; set; } = string.Empty;
    public int CollectedBy { get; set; }
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReceivedAt { get; set; }
    public string Condition { get; set; } = "Good";
    public bool IsRejected { get; set; } = false;
}

public class LabResult : BaseEntity
{
    public int OrderItemId { get; set; }
    public int OrderId { get; set; }
    public int TestId { get; set; }
    public int? ParameterId { get; set; }
    public int PatientId { get; set; }
    public decimal? NumericValue { get; set; }
    public string? TextValue { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string Flag { get; set; } = "Normal"; // Normal, H, L, HH, LL
    public string ReferenceRange { get; set; } = string.Empty;
    public bool IsCritical { get; set; } = false;
    public DateTime EnteredAt { get; set; } = DateTime.UtcNow;
    public int EnteredBy { get; set; }
    public int? VerifiedBy { get; set; }
    public bool IsVerified { get; set; } = false;
    public byte SourceType { get; set; } = 1; // 1=Manual, 2=HL7, 3=ASTM
    public string? RawMessage { get; set; }
}

public class LabCriticalAlert : BaseEntity
{
    public int ResultId { get; set; }
    public int OrderId { get; set; }
    public int PatientId { get; set; }
    public int DoctorId { get; set; }
    public string AlertValue { get; set; } = string.Empty;
    public string AlertFlag { get; set; } = string.Empty;
    public DateTime NotifiedAt { get; set; } = DateTime.UtcNow;
    public int? AcknowledgedBy { get; set; }
    public bool IsAcknowledged { get; set; } = false;
    public int NotifyCount { get; set; } = 1;
}
