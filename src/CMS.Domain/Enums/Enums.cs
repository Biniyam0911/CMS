namespace CMS.Domain.Enums;

public enum Gender { Male = 1, Female = 2, Other = 3 }
public enum MaritalStatus { Single = 1, Married = 2, Divorced = 3, Widowed = 4 }
public enum AppointmentStatus { Scheduled = 1, Confirmed = 2, CheckedIn = 3, InProgress = 4, Completed = 5, Cancelled = 6, NoShow = 7 }
public enum InvoiceStatus { Draft = 1, Issued = 2, PartiallyPaid = 3, Paid = 4, Void = 5, WrittenOff = 6 }
public enum PaymentMethod { Cash = 1, Card = 2, Insurance = 3, BankTransfer = 4, Mobile = 5 }
public enum NotificationChannel { Email = 1, SMS = 2, InApp = 3, EmailAndSMS = 4 }
public enum NotificationStatus { Pending = 1, Sent = 2, Failed = 3, Cancelled = 4 }
public enum LabOrderPriority { STAT = 1, Routine = 2, Scheduled = 3 }
public enum LabOrderStatus { Ordered = 1, Collected = 2, Processing = 3, Resulted = 4, Delivered = 5 }
public enum LabResultFlag { Normal, H, L, HH, LL, POS, NEG }
public enum LabResultSource { Manual = 1, HL7 = 2, ASTM = 3 }
public enum LabProtocol { HL7, ASTM }
public enum LabResultType { Numeric = 1, Text = 2, PosNeg = 3 }
public enum ReportFormat { PDF = 1, Excel = 2, CSV = 3 }
public enum ReportShareType { User = 1, Role = 2 }
public enum DiagnosisType { Primary = 1, Secondary = 2, Differential = 3 }
public enum InvoiceItemType { Consultation = 1, Lab = 2, Drug = 3, Procedure = 4, Other = 5 }
