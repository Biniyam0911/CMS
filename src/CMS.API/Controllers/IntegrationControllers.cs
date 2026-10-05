using CMS.Application.Settings;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class IntegrationsController : ControllerBase
{
    private readonly SettingsAndApiService _settingsService;

    public IntegrationsController(SettingsAndApiService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet]
    public async Task<IActionResult> GetIntegrations()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var list = await _settingsService.GetIntegrationsAsync(tenantId);
        return Ok(ApiResponse<List<IntegrationConfigDto>>.Ok(list));
    }

    [HttpPost("update")]
    public async Task<IActionResult> UpdateIntegration([FromBody] UpdateIntegrationDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        await _settingsService.UpdateIntegrationAsync(tenantId, dto);
        return Ok(ApiResponse<string>.Ok("Integration config updated."));
    }
}


[ApiController]
[Route("api/v1/[controller]")]
public class FiscalController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public FiscalController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpGet("settings")]
    public IActionResult GetFiscalSettings()
    {
        return Ok(ApiResponse<object>.Ok(new
        {
            TinNumber = "0048291038",
            MrcNumber = "ERCA-ETH-2026-F9812",
            TaxAuthority = "Ethiopian Ministry of Revenues (ERCA)",
            TerminalIp = "127.0.0.1:9100",
            FiscalMode = "Online Fiscal Signed",
            IsConnected = true
        }));
    }

    [HttpPost("sign-receipt/{invoiceId}")]
    public async Task<IActionResult> SignFiscalReceipt(int invoiceId)
    {
        using var conn = _dbFactory.CreateConnection();
        var inv = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT i.Id, i.InvoiceNumber, i.TotalAmount, i.TaxAmt, i.IssueDate, i.TenantId,
                   p.FirstName + ' ' + p.LastName AS PatientName, p.MRN
            FROM Invoices i
            JOIN Patients p ON p.Id = i.PatientId
            WHERE i.Id = @InvoiceId", new { InvoiceId = invoiceId });

        if (inv == null) return NotFound(ApiResponse<string>.Fail("Invoice not found."));

        string timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        string fiscalReceiptNo = $"FS-{DateTime.UtcNow:yyyyMM}-{invoiceId:D6}";
        string tinNumber = "0048291038";
        string mrcNumber = "ERCA-ETH-2026-F9812";

        // Generate SHA256 cryptographic signature
        string rawSignatureSource = $"{tinNumber}|{inv.InvoiceNumber}|{inv.TotalAmount}|{inv.TaxAmt}|{timestamp}|{mrcNumber}";
        string signature;
        using (var sha = System.Security.Cryptography.SHA256.Create())
        {
            byte[] hash = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(rawSignatureSource));
            signature = Convert.ToHexString(hash)[..32];
        }

        // Standard ERCA e-tax QR payload URI
        string qrPayload = $"https://etax.mor.gov.et/verify?tin={tinNumber}&mrc={mrcNumber}&inv={inv.InvoiceNumber}&tot={inv.TotalAmount}&vat={inv.TaxAmt}&sig={signature}";

        var updateSql = @"
            UPDATE Invoices 
            SET FiscalReceiptNo = @FiscalReceiptNo,
                FiscalSignature = @FiscalSignature,
                FiscalQrPayload = @FiscalQrPayload,
                MrcNumber = @MrcNumber
            WHERE Id = @InvoiceId;";

        await conn.ExecuteAsync(updateSql, new {
            InvoiceId = invoiceId,
            FiscalReceiptNo = fiscalReceiptNo,
            FiscalSignature = signature,
            FiscalQrPayload = qrPayload,
            MrcNumber = mrcNumber
        });

        return Ok(ApiResponse<FiscalSignResultDto>.Ok(new FiscalSignResultDto
        {
            Success = true,
            FiscalReceiptNo = fiscalReceiptNo,
            MrcNumber = mrcNumber,
            TinNumber = tinNumber,
            FiscalSignature = signature,
            FiscalQrPayload = qrPayload,
            SignedAt = DateTime.UtcNow
        }));
    }
}

// ========================================================
// Radiology & PACS DICOM Studies Controller
// ========================================================
[ApiController]
[Route("api/v1/[controller]")]
public class RadiologyController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public RadiologyController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpGet("patient/{patientId}")]
    public async Task<IActionResult> GetPatientStudies(int patientId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT r.Id, r.TenantId, r.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN,
                   r.EncounterId, r.DoctorId,
                   ISNULL(st.FirstName + ' ' + st.LastName, 'Radiologist') AS DoctorName,
                   r.StudyType, r.BodyPart, r.ClinicalIndication, r.RadiologistFindings, r.Impression,
                   r.ImagePath, r.ModalityCode, r.StudyDate, r.StatusId
            FROM RadiologyStudies r
            JOIN Patients p ON p.Id = r.PatientId
            LEFT JOIN Doctors doc ON doc.Id = r.DoctorId
            LEFT JOIN Staff st ON st.Id = doc.StaffId
            WHERE r.PatientId = @PatientId
            ORDER BY r.StudyDate DESC";

        var studies = (await conn.QueryAsync<RadiologyStudyDto>(sql, new { PatientId = patientId })).ToList();
        return Ok(ApiResponse<List<RadiologyStudyDto>>.Ok(studies));
    }

    [HttpPost("studies")]
    public async Task<IActionResult> CreateStudy([FromBody] RadiologyStudyDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO RadiologyStudies (TenantId, PatientId, EncounterId, DoctorId, StudyType, BodyPart, ClinicalIndication, RadiologistFindings, Impression, ImagePath, ModalityCode, StudyDate, StatusId, CreatedAt)
            OUTPUT INSERTED.Id
            VALUES (@TenantId, @PatientId, @EncounterId, @DoctorId, @StudyType, @BodyPart, @ClinicalIndication, @RadiologistFindings, @Impression, @ImagePath, @ModalityCode, GETDATE(), 2, GETDATE())";

        int studyId = await conn.ExecuteScalarAsync<int>(sql, new {
            TenantId = tenantId,
            dto.PatientId,
            dto.EncounterId,
            dto.DoctorId,
            dto.StudyType,
            dto.BodyPart,
            dto.ClinicalIndication,
            dto.RadiologistFindings,
            dto.Impression,
            dto.ImagePath,
            ModalityCode = string.IsNullOrWhiteSpace(dto.ModalityCode) ? "CR" : dto.ModalityCode
        });

        return Ok(ApiResponse<object>.Ok(new { StudyId = studyId, Message = "Radiology study recorded successfully." }));
    }
}

// ========================================================
// Phase 3A: Ethio Telecom SMS Gateway Controller
// ========================================================
[ApiController]
[Route("api/v1/[controller]")]
public class SmsController : ControllerBase
{
    private readonly CMS.Application.Notifications.SmsGatewayService _smsService;

    public SmsController(CMS.Application.Notifications.SmsGatewayService smsService)
    {
        _smsService = smsService;
    }

    [HttpPost("send")]
    public async Task<IActionResult> SendSms([FromBody] SendSmsRequestDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        long id = await _smsService.SendSmsAsync(tenantId, dto.RecipientPhone, dto.Message, dto.TriggerEvent, dto.PatientId);
        return Ok(ApiResponse<object>.Ok(new { SmsId = id, Message = "SMS dispatched via Ethio Telecom Gateway." }));
    }

    [HttpGet("logs")]
    public async Task<IActionResult> GetSmsLogs([FromQuery] int limit = 50)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var logs = await _smsService.GetSmsLogsAsync(tenantId, limit);
        return Ok(ApiResponse<List<SmsLogItemDto>>.Ok(logs));
    }

    [HttpPost("trigger-appointment-reminder/{appointmentId}")]
    public async Task<IActionResult> TriggerAppointmentReminder(int appointmentId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        bool ok = await _smsService.TriggerAppointmentReminderAsync(tenantId, appointmentId);
        return Ok(ApiResponse<bool>.Ok(ok));
    }
}

// ========================================================
// Phase 3A: Telebirr & CBE Birr Mobile Payment Controller
// ========================================================
[ApiController]
[Route("api/v1/[controller]")]
public class TelebirrController : ControllerBase
{
    private readonly CMS.Application.Billing.TelebirrPaymentService _telebirrService;
    private readonly IDbConnectionFactory _dbFactory;

    public TelebirrController(CMS.Application.Billing.TelebirrPaymentService telebirrService, IDbConnectionFactory dbFactory)
    {
        _telebirrService = telebirrService;
        _dbFactory = dbFactory;
    }

    [HttpPost("generate-qr")]
    public async Task<IActionResult> GenerateDynamicQr([FromBody] TelebirrQrRequestDto req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var res = await _telebirrService.GenerateDynamicQrAsync(tenantId, req);
        return Ok(ApiResponse<TelebirrQrResponseDto>.Ok(res));
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> ProcessWebhook([FromBody] TelebirrCallbackDto callback)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        bool success = await _telebirrService.ProcessTelebirrCallbackAsync(tenantId, callback);
        return Ok(ApiResponse<object>.Ok(new { Success = success, Message = "Telebirr transaction verified and settled." }));
    }

    [HttpGet("check-status/{invoiceId}")]
    public async Task<IActionResult> CheckPaymentStatus(int invoiceId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var inv = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, TotalAmount, PaidAmount, StatusId FROM Invoices WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = invoiceId, TenantId = tenantId });

        if (inv == null) return NotFound(ApiResponse<string>.Fail("Invoice not found."));

        bool isPaid = inv.StatusId == 4 || inv.PaidAmount >= inv.TotalAmount;
        return Ok(ApiResponse<object>.Ok(new
        {
            InvoiceId = invoiceId,
            StatusId = (int)inv.StatusId,
            TotalAmount = (decimal)inv.TotalAmount,
            PaidAmount = (decimal)inv.PaidAmount,
            IsSettled = isPaid
        }));
    }
}

// ============================================================
// TELEMED CONTROLLER
// ============================================================
[ApiController]
[Route("api/v1/[controller]")]
public class TelemedController : ControllerBase
{
    private readonly CMS.Application.Telemedicine.TelemedService _telemedService;
    private readonly CMS.Application.Telemedicine.TelegramBotService _telegramService;
    private readonly CMS.Application.Telemedicine.WhatsAppCloudService _whatsappService;
    private readonly ILogger<TelemedController> _logger;

    public TelemedController(
        CMS.Application.Telemedicine.TelemedService telemedService,
        CMS.Application.Telemedicine.TelegramBotService telegramService,
        CMS.Application.Telemedicine.WhatsAppCloudService whatsappService,
        ILogger<TelemedController> logger)
    {
        _telemedService = telemedService;
        _telegramService = telegramService;
        _whatsappService = whatsappService;
        _logger = logger;
    }

    // GET /api/v1/telemed/sessions?statusId=2
    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions([FromQuery] int? statusId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var sessions = await _telemedService.GetSessionsAsync(tenantId, statusId);
        return Ok(ApiResponse<IEnumerable<CMS.Shared.DTOs.TelemedSessionSummaryDto>>.Ok(sessions));
    }

    // GET /api/v1/telemed/sessions/{id}
    [HttpGet("sessions/{id:int}")]
    public async Task<IActionResult> GetSession(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var session = await _telemedService.GetSessionDetailAsync(tenantId, id);
        if (session == null) return NotFound(ApiResponse<string>.Fail("Session not found."));
        return Ok(ApiResponse<CMS.Shared.DTOs.TelemedSessionSummaryDto>.Ok(session));
    }

    // GET /api/v1/telemed/sessions/{id}/messages
    [HttpGet("sessions/{id:int}/messages")]
    public async Task<IActionResult> GetMessages(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var messages = await _telemedService.GetSessionMessagesAsync(tenantId, id);
        return Ok(ApiResponse<IEnumerable<CMS.Shared.DTOs.TelemedMessageDto>>.Ok(messages));
    }

    // POST /api/v1/telemed/sessions/{id}/messages
    [HttpPost("sessions/{id:int}/messages")]
    public async Task<IActionResult> SendMessage(int id, [FromBody] CMS.Shared.DTOs.SendDoctorMessageRequestDto req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        int doctorStaffId = HttpContext.Items["UserId"] is int uid ? uid : 1;
        req.SessionId = id;
        var msg = await _telemedService.SendDoctorMessageAsync(tenantId, doctorStaffId, req);

        // Forward to Telegram or WhatsApp
        var session = await _telemedService.GetSessionDetailAsync(tenantId, id);
        if (session != null)
        {
            string cleanText = req.ContentText ?? "";
            if (session.Platform == "Telegram" && !string.IsNullOrWhiteSpace(session.PlatformChatId))
            {
                await _telegramService.SendTelegramMessageAsync(tenantId, session.PlatformChatId, cleanText);
            }
            else if (session.Platform == "WhatsApp" && !string.IsNullOrWhiteSpace(session.PatientPhone))
            {
                await _whatsappService.SendWhatsAppTextMessageAsync(tenantId, session.PatientPhone, cleanText);
            }
        }

        return Ok(ApiResponse<CMS.Shared.DTOs.TelemedMessageDto>.Ok(msg));
    }

    // POST /api/v1/telemed/sessions/{id}/call
    [HttpPost("sessions/{id:int}/call")]
    public async Task<IActionResult> InitiateCall(int id, [FromBody] CMS.Shared.DTOs.InitiateTelemedCallRequestDto req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        int doctorStaffId = HttpContext.Items["UserId"] is int uid ? uid : 1;
        req.SessionId = id;
        var videoUrl = await _telemedService.InitiateVideoCallAsync(tenantId, doctorStaffId, req);

        // Forward video room link to patient's Telegram/WhatsApp
        var session = await _telemedService.GetSessionDetailAsync(tenantId, id);
        if (session != null)
        {
            string notice = $"📹 *Dr. Bekele has started your 1-click video consultation room.*\n\nPlease tap the link below to join from your phone:\n🔗 {videoUrl}";
            if (session.Platform == "Telegram" && !string.IsNullOrWhiteSpace(session.PlatformChatId))
            {
                await _telegramService.SendTelegramMessageAsync(tenantId, session.PlatformChatId, notice);
            }
            else if (session.Platform == "WhatsApp" && !string.IsNullOrWhiteSpace(session.PatientPhone))
            {
                await _whatsappService.SendWhatsAppTextMessageAsync(tenantId, session.PatientPhone, notice);
            }
        }

        return Ok(ApiResponse<object>.Ok(new { VideoUrl = videoUrl, Message = "Video call room ready." }));
    }

    // POST /api/v1/telemed/sessions/{id}/complete
    [HttpPost("sessions/{id:int}/complete")]
    public async Task<IActionResult> CompleteConsultation(int id, [FromBody] CMS.Shared.DTOs.CompleteTelemedConsultationRequestDto req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        int doctorStaffId = HttpContext.Items["UserId"] is int uid ? uid : 1;
        req.SessionId = id;
        await _telemedService.CompleteConsultationAsync(tenantId, doctorStaffId, req);

        // Forward completion summary to patient
        var session = await _telemedService.GetSessionDetailAsync(tenantId, id);
        if (session != null && session.Platform == "Telegram" && !string.IsNullOrWhiteSpace(session.PlatformChatId))
        {
            string summary = $"✅ *Consultation Completed by Dr. Bekele*\n\n" +
                $"📋 *Diagnosis:* {req.Diagnosis ?? "Clinical advice provided"}\n" +
                (string.IsNullOrWhiteSpace(req.PrescriptionText) ? "" : $"💊 *Prescription:* {req.PrescriptionText}\n\n") +
                "Thank you for choosing Specialty Clinic Telehealth.";
            await _telegramService.SendTelegramMessageAsync(tenantId, session.PlatformChatId, summary);
        }

        return Ok(ApiResponse<object>.Ok(new { Message = "Consultation completed successfully." }));
    }

    // GET /api/v1/telemed/telegram/webhook  (Telegram webhook verification — not used by Telegram but for admin check)
    [HttpGet("telegram/webhook")]
    public IActionResult TelegramVerify() => Ok("Telegram webhook active.");

    // POST /api/v1/telemed/telegram/webhook  (Inbound Telegram updates)
    [HttpPost("telegram/webhook")]
    public async Task<IActionResult> TelegramInbound([FromBody] System.Text.Json.JsonElement update)
    {
        try
        {
            byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
            _logger.LogInformation(">>> INBOUND TELEGRAM UPDATE: {RawJson}", update.GetRawText());
            await _telegramService.HandleInboundTelegramUpdateAsync(tenantId, update);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "!!! Error processing Telegram webhook update: {Message}", ex.Message);
        }
        return Ok(); // Always return 200 to Telegram
    }

    // GET /api/v1/telemed/whatsapp/webhook  (Meta hub verification challenge)
    [HttpGet("whatsapp/webhook")]
    public IActionResult WhatsAppVerify(
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        // In production, validate verifyToken against ClinicSettings
        if (mode == "subscribe" && !string.IsNullOrEmpty(challenge))
            return Content(challenge, "text/plain");
        return BadRequest("Verification failed.");
    }

    // POST /api/v1/telemed/whatsapp/webhook  (Inbound WhatsApp messages)
    [HttpPost("whatsapp/webhook")]
    public async Task<IActionResult> WhatsAppInbound([FromBody] System.Text.Json.JsonElement payload)
    {
        try
        {
            byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
            await _whatsappService.HandleInboundWhatsAppWebhookAsync(tenantId, payload);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing WhatsApp webhook payload.");
        }
        return Ok(); // Always return 200 to Meta
    }
}
