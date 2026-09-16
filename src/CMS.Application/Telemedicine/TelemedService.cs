using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using System.Net.Http.Json;
using System.Text.Json;

namespace CMS.Application.Telemedicine;

public class TelemedService
{
    private static readonly HttpClient _httpClient = new();
    private readonly IDbConnectionFactory _dbFactory;

    public TelemedService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<decimal> GetTelemedConsultationFeeAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var feeStr = await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT SettingValue FROM ClinicSettings WHERE SettingKey = 'Telemed.StandardConsultationFee' AND TenantId = @TenantId",
            new { TenantId = tenantId });

        if (decimal.TryParse(feeStr, out var fee))
            return fee;

        return 1000.00m;
    }

    public async Task<int> CreateTelemedicineInvoiceAsync(byte tenantId, int patientId, int? doctorId, decimal amount, string sessionNumber)
    {
        using var conn = _dbFactory.CreateConnection();

        string invNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
        
        // Dynamic VAT rate from ClinicSettings (TaxRate key, stored as percent e.g. "0" = 0%, "15" = 15%)
        decimal vatRate = 0.0m;
        try
        {
            var taxRateStr = await conn.ExecuteScalarAsync<string?>(@"
                SELECT TOP 1 SettingValue FROM ClinicSettings 
                WHERE TenantId = @TenantId AND SettingKey = 'TaxRate'",
                new { TenantId = tenantId });

            if (string.IsNullOrWhiteSpace(taxRateStr))
            {
                taxRateStr = await conn.ExecuteScalarAsync<string?>(@"
                    SELECT TOP 1 SettingValue FROM ClinicSettings 
                    WHERE TenantId = @TenantId AND SettingKey = 'Tax.DefaultVatPercent'",
                    new { TenantId = tenantId });
            }

            if (!string.IsNullOrWhiteSpace(taxRateStr) && decimal.TryParse(taxRateStr, out var parsed))
            {
                vatRate = parsed / 100m;
            }
        }
        catch {}

        decimal subTotal = amount;
        decimal tax = Math.Round(subTotal * vatRate, 2);
        decimal total = subTotal + tax;

        // Create an issued unpaid invoice (StatusId = 2: Issued / Pending Payment)
        var invoiceSql = @"
            INSERT INTO Invoices (
                TenantId, InvoiceNumber, PatientId, EncounterId, StatusId, IssueDate, DueDate,
                SubTotal, DiscountAmt, TaxAmt, TotalAmount, PaidAmount, InsuranceClaim,
                InsuranceCoPayPercent, InsuranceClaimAmount, PatientPayAmount, ClaimStatusId,
                CreatedBy, Notes, CreatedAt
            )
            OUTPUT INSERTED.Id
            VALUES (
                @TenantId, @InvoiceNumber, @PatientId, NULL, 2, CAST(GETDATE() AS DATE), CAST(GETDATE() AS DATE),
                @SubTotal, 0, @TaxAmt, @TotalAmount, 0, 0,
                0.00, 0.00, @TotalAmount, 1,
                1, @Notes, GETDATE()
            );";

        int invoiceId = await conn.QuerySingleAsync<int>(invoiceSql, new
        {
            TenantId = tenantId,
            InvoiceNumber = invNumber,
            PatientId = patientId,
            SubTotal = subTotal,
            TaxAmt = tax,
            TotalAmount = total,
            Notes = $"Telemedicine Consultation Fee - Session {sessionNumber}"
        });

        // Insert Item line (ItemType = 1: Consultation)
        var itemSql = @"
            INSERT INTO InvoiceItems (
                InvoiceId, ItemType, Description, Quantity, UnitPrice, Discount, Total, RefId
            )
            VALUES (
                @InvoiceId, 1, @Description, 1, @UnitPrice, 0, @UnitPrice, @DoctorId
            );";

        await conn.ExecuteAsync(itemSql, new
        {
            InvoiceId = invoiceId,
            Description = "Telemedicine Video/Online Specialist Consultation",
            UnitPrice = subTotal,
            DoctorId = doctorId
        });

        return invoiceId;
    }

    public async Task<List<TelemedSessionSummaryDto>> GetSessionsAsync(byte tenantId, int? statusId = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT 
                s.Id, s.TenantId, s.SessionNumber, s.PatientId,
                p.FirstName + ' ' + p.LastName AS PatientName,
                p.PrimaryPhone AS PatientPhone,
                p.MRN,
                s.DoctorId,
                docSt.FirstName + ' ' + docSt.LastName AS DoctorName,
                s.Platform, s.PlatformChatId, s.ConsultationType,
                s.StatusId, s.ChiefComplaint, s.TriageNotes,
                s.ConsultationFee, s.IsPaid, s.PaymentReference, s.RoomUrl,
                s.ScheduledStartTime, s.ActualStartTime, s.EndTime, s.CreatedAt,
                (SELECT COUNT(*) FROM TelemedMessages m WHERE m.SessionId = s.Id) AS MessageCount,
                (SELECT COUNT(*) FROM TelemedMessages m WHERE m.SessionId = s.Id AND m.SenderType = 'Patient' AND m.IsReadByDoctor = 0) AS UnreadCount
            FROM TelemedSessions s
            JOIN Patients p ON p.Id = s.PatientId
            LEFT JOIN Doctors doc ON doc.Id = s.DoctorId
            LEFT JOIN Staff docSt ON docSt.Id = doc.StaffId
            WHERE s.TenantId = @TenantId
              AND (@StatusId IS NULL OR s.StatusId = @StatusId)
            ORDER BY 
                CASE WHEN s.StatusId = 3 THEN 1 WHEN s.StatusId = 2 THEN 2 WHEN s.StatusId = 1 THEN 3 ELSE 4 END,
                s.Id DESC";

        var list = (await conn.QueryAsync<TelemedSessionSummaryDto>(sql, new { TenantId = tenantId, StatusId = statusId })).ToList();
        return list;
    }

    public async Task<TelemedSessionSummaryDto?> GetSessionDetailAsync(byte tenantId, int sessionId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT 
                s.Id, s.TenantId, s.SessionNumber, s.PatientId,
                p.FirstName + ' ' + p.LastName AS PatientName,
                p.PrimaryPhone AS PatientPhone,
                p.MRN,
                s.DoctorId,
                docSt.FirstName + ' ' + docSt.LastName AS DoctorName,
                s.Platform, s.PlatformChatId, s.ConsultationType,
                s.StatusId, s.ChiefComplaint, s.TriageNotes,
                s.ConsultationFee, s.IsPaid, s.PaymentReference, s.RoomUrl,
                s.ScheduledStartTime, s.ActualStartTime, s.EndTime, s.CreatedAt,
                (SELECT COUNT(*) FROM TelemedMessages m WHERE m.SessionId = s.Id) AS MessageCount,
                (SELECT COUNT(*) FROM TelemedMessages m WHERE m.SessionId = s.Id AND m.SenderType = 'Patient' AND m.IsReadByDoctor = 0) AS UnreadCount
            FROM TelemedSessions s
            JOIN Patients p ON p.Id = s.PatientId
            LEFT JOIN Doctors doc ON doc.Id = s.DoctorId
            LEFT JOIN Staff docSt ON docSt.Id = doc.StaffId
            WHERE s.TenantId = @TenantId AND s.Id = @SessionId";

        return await conn.QueryFirstOrDefaultAsync<TelemedSessionSummaryDto>(sql, new { TenantId = tenantId, SessionId = sessionId });
    }

    public async Task<List<TelemedMessageDto>> GetSessionMessagesAsync(byte tenantId, int sessionId)
    {
        using var conn = _dbFactory.CreateConnection();
        
        await conn.ExecuteAsync(@"
            UPDATE TelemedMessages 
            SET IsReadByDoctor = 1 
            WHERE SessionId = @SessionId AND TenantId = @TenantId AND SenderType = 'Patient' AND IsReadByDoctor = 0",
            new { SessionId = sessionId, TenantId = tenantId });

        var sql = @"
            SELECT 
                m.Id, m.SessionId, m.SenderType, m.SenderStaffId,
                st.FirstName + ' ' + st.LastName AS SenderStaffName,
                m.SenderPatientId,
                p.FirstName + ' ' + p.LastName AS SenderPatientName,
                m.MessageType, m.ContentText, m.MediaUrl, m.MediaFileName, m.MediaMimeType,
                m.PlatformMessageId, m.IsReadByDoctor, m.IsDeliveredToPatient, m.SentAt
            FROM TelemedMessages m
            LEFT JOIN Staff st ON st.Id = m.SenderStaffId
            LEFT JOIN Patients p ON p.Id = m.SenderPatientId
            WHERE m.SessionId = @SessionId AND m.TenantId = @TenantId
            ORDER BY m.SentAt ASC";

        var messages = (await conn.QueryAsync<TelemedMessageDto>(sql, new { SessionId = sessionId, TenantId = tenantId })).ToList();
        return messages;
    }

    public async Task<TelemedMessageDto> SendDoctorMessageAsync(byte tenantId, int doctorStaffId, SendDoctorMessageRequestDto req)
    {
        using var conn = _dbFactory.CreateConnection();

        var session = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, Platform, PlatformChatId, StatusId FROM TelemedSessions WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = req.SessionId, TenantId = tenantId });

        if (session == null)
            throw new InvalidOperationException("Telemedicine session not found.");

        var insertSql = @"
            INSERT INTO TelemedMessages (
                TenantId, SessionId, SenderType, SenderStaffId, MessageType,
                ContentText, MediaUrl, MediaFileName, IsReadByDoctor, IsDeliveredToPatient, SentAt
            )
            VALUES (
                @TenantId, @SessionId, 'Doctor', @StaffId, @MessageType,
                @ContentText, @MediaUrl, @MediaFileName, 1, 1, GETDATE()
            );
            SELECT CAST(SCOPE_IDENTITY() AS INT);";

        int msgId = await conn.QuerySingleAsync<int>(insertSql, new
        {
            TenantId = tenantId,
            SessionId = req.SessionId,
            StaffId = doctorStaffId,
            MessageType = req.MessageType,
            ContentText = req.ContentText,
            MediaUrl = req.MediaUrl,
            MediaFileName = req.MediaFileName
        });

        if (session.StatusId == 2)
        {
            await conn.ExecuteAsync(
                "UPDATE TelemedSessions SET StatusId = 3, ActualStartTime = ISNULL(ActualStartTime, GETDATE()), UpdatedAt = GETDATE() WHERE Id = @Id",
                new { Id = req.SessionId });
        }

        var st = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT FirstName + ' ' + LastName AS Name FROM Staff WHERE Id = @Id", new { Id = doctorStaffId });
        return new TelemedMessageDto
        {
            Id = msgId,
            SessionId = req.SessionId,
            SenderType = "Doctor",
            SenderStaffId = doctorStaffId,
            SenderStaffName = st?.Name ?? "Attending Doctor",
            MessageType = req.MessageType,
            ContentText = req.ContentText,
            MediaUrl = req.MediaUrl,
            MediaFileName = req.MediaFileName,
            IsReadByDoctor = true,
            IsDeliveredToPatient = true,
            SentAt = DateTime.UtcNow
        };
    }

    public async Task<string> InitiateVideoCallAsync(byte tenantId, int doctorStaffId, InitiateTelemedCallRequestDto req)
    {
        using var conn = _dbFactory.CreateConnection();

        var session = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, SessionNumber, Platform, PlatformChatId, StatusId FROM TelemedSessions WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = req.SessionId, TenantId = tenantId });

        if (session == null)
            throw new InvalidOperationException("Telemedicine session not found.");

        string roomName = $"CMS-Telemed-{session.SessionNumber}";
        string roomUrl = $"https://meet.jit.si/{roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false";

        await conn.ExecuteAsync(
            "UPDATE TelemedSessions SET RoomUrl = @RoomUrl, StatusId = 3, ActualStartTime = ISNULL(ActualStartTime, GETDATE()), UpdatedAt = GETDATE() WHERE Id = @Id",
            new { RoomUrl = roomUrl, Id = req.SessionId });

        var st = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT FirstName + ' ' + LastName AS Name FROM Staff WHERE Id = @Id", new { Id = doctorStaffId });
        string docName = st?.Name ?? "The Doctor";
        string callNotice = $"📹 {docName} has initiated a 100% free and secure video consultation room. Please tap the link below to join from your smartphone or browser:\n\n🔗 {roomUrl}\n\n(No account or app download required.)";

        await SendDoctorMessageAsync(tenantId, doctorStaffId, new SendDoctorMessageRequestDto
        {
            SessionId = req.SessionId,
            MessageType = "VideoLink",
            ContentText = callNotice,
            MediaUrl = roomUrl
        });

        return roomUrl;
    }

    public async Task<bool> CompleteConsultationAsync(byte tenantId, int doctorStaffId, CompleteTelemedConsultationRequestDto req)
    {
        using var conn = _dbFactory.CreateConnection();

        var session = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, PatientId, SessionNumber, Platform, PlatformChatId FROM TelemedSessions WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = req.SessionId, TenantId = tenantId });

        if (session == null) return false;

        await conn.ExecuteAsync(@"
            UPDATE TelemedSessions 
            SET StatusId = 4, 
                DoctorNotes = @DoctorNotes,
                EndTime = GETDATE(),
                UpdatedAt = GETDATE()
            WHERE Id = @Id AND TenantId = @TenantId",
            new { req.DoctorNotes, Id = req.SessionId, TenantId = tenantId });

        string summaryNotice = $"✅ Clinical consultation successfully completed by your physician.\n\n" +
            $"📋 Diagnosis: {req.Diagnosis ?? "Clinical advice & home care regimen provided"}\n" +
            (string.IsNullOrWhiteSpace(req.PrescriptionText) ? "" : $"💊 Prescribed Medication:\n{req.PrescriptionText}\n\n") +
            $"Your digital prescription and official clinic record have been archived. Thank you for using Specialty Clinic Telehealth.";

        await SendDoctorMessageAsync(tenantId, doctorStaffId, new SendDoctorMessageRequestDto
        {
            SessionId = req.SessionId,
            MessageType = "Prescription",
            ContentText = summaryNotice
        });

        return true;
    }

    public async Task<int> ProcessInboundPatientMessageAsync(byte tenantId, string platform, string platformChatId, string text, string? mediaUrl = null, string? mediaFileName = null, string? mediaMime = null, int? explicitPatientId = null, int? selectedDoctorId = null)
    {
        using var conn = _dbFactory.CreateConnection();

        int patientId;
        if (explicitPatientId.HasValue && explicitPatientId.Value > 0)
        {
            patientId = explicitPatientId.Value;
        }
        else
        {
            var identity = await conn.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT PatientId FROM PatientSocialIdentities WHERE Platform = @Platform AND ExternalPlatformId = @ChatId AND TenantId = @TenantId",
                new { Platform = platform, ChatId = platformChatId, TenantId = tenantId });

            if (identity != null && identity.PatientId != null)
            {
                patientId = (int)identity.PatientId;
            }
            else
            {
                var p = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT TOP 1 Id FROM Patients WHERE TenantId = @TenantId ORDER BY Id ASC", new { TenantId = tenantId });
                patientId = p != null ? (int)p.Id : 1;
            }
        }

        decimal consultationFee = await GetTelemedConsultationFeeAsync(tenantId);

        var session = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT TOP 1 Id, StatusId, DoctorId 
            FROM TelemedSessions 
            WHERE TenantId = @TenantId AND PatientId = @PatientId AND StatusId IN (1, 2, 3)
            ORDER BY Id DESC",
            new { TenantId = tenantId, PatientId = patientId });

        int sessionId;
        if (session != null)
        {
            sessionId = (int)session.Id;
            if (selectedDoctorId.HasValue && selectedDoctorId.Value > 0 && session.DoctorId != selectedDoctorId.Value)
            {
                await conn.ExecuteAsync("UPDATE TelemedSessions SET DoctorId = @DoctorId WHERE Id = @Id", new { DoctorId = selectedDoctorId.Value, Id = sessionId });
            }
        }
        else
        {
            int assignedDocId = selectedDoctorId ?? 1;
            string sessNum = $"TEL-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";

            // Check if an invoice already exists for this patient today
            var existingInvoice = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                SELECT TOP 1 Id, StatusId, TotalAmount, InvoiceNumber FROM Invoices
                WHERE TenantId = @TenantId AND PatientId = @PatientId 
                  AND Notes LIKE '%Telemedicine%'
                  AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                ORDER BY Id DESC",
                new { TenantId = tenantId, PatientId = patientId });

            int? invId = existingInvoice != null ? (int?)existingInvoice.Id : null;
            bool isPaid = existingInvoice != null && (int)existingInvoice.StatusId == 4;
            string? payRef = isPaid ? (string)existingInvoice.InvoiceNumber : null;

            sessionId = await conn.QuerySingleAsync<int>(@"
                INSERT INTO TelemedSessions (
                    TenantId, SessionNumber, PatientId, DoctorId, Platform, PlatformChatId,
                    StatusId, ChiefComplaint, ConsultationFee, IsPaid, InvoiceId, PaymentReference, CreatedAt, UpdatedAt
                )
                VALUES (
                    @TenantId, @SessionNumber, @PatientId, @DoctorId, @Platform, @ChatId,
                    2, @Complaint, @Fee, @IsPaid, @InvoiceId, @PaymentReference, GETDATE(), GETDATE()
                );
                SELECT CAST(SCOPE_IDENTITY() AS INT);",
                new
                {
                    TenantId = tenantId,
                    SessionNumber = sessNum,
                    PatientId = patientId,
                    DoctorId = assignedDocId,
                    Platform = platform,
                    ChatId = platformChatId,
                    Fee = consultationFee,
                    IsPaid = isPaid ? 1 : 0,
                    InvoiceId = invId,
                    PaymentReference = payRef,
                    Complaint = text.Length > 100 ? text.Substring(0, 100) : text
                });

            // ONLY create invoice if none existed!
            if (!invId.HasValue)
            {
                try
                {
                    int newInvId = await CreateTelemedicineInvoiceAsync(tenantId, patientId, assignedDocId, consultationFee, sessNum);
                    await conn.ExecuteAsync("UPDATE TelemedSessions SET InvoiceId = @InvoiceId WHERE Id = @SessionId", new { InvoiceId = newInvId, SessionId = sessionId });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[INVOICE CREATION ERROR] {ex.Message}");
                }
            }
        }

        string msgType = !string.IsNullOrWhiteSpace(mediaUrl) ? "Image" : "Text";

        int msgId = await conn.QuerySingleAsync<int>(@"
            INSERT INTO TelemedMessages (
                TenantId, SessionId, SenderType, SenderPatientId, MessageType,
                ContentText, MediaUrl, MediaFileName, MediaMimeType, IsReadByDoctor, IsDeliveredToPatient, SentAt
            )
            VALUES (
                @TenantId, @SessionId, 'Patient', @PatientId, @MessageType,
                @ContentText, @MediaUrl, @MediaFileName, @MediaMimeType, 0, 1, GETDATE()
            );
            SELECT CAST(SCOPE_IDENTITY() AS INT);",
            new
            {
                TenantId = tenantId,
                SessionId = sessionId,
                PatientId = patientId,
                MessageType = msgType,
                ContentText = text,
                MediaUrl = mediaUrl,
                MediaFileName = mediaFileName,
                MediaMimeType = mediaMime
            });

        return msgId;
    }

    public async Task<bool> SendTelegramNotificationAsync(byte tenantId, string chatId, string text)
    {
        try
        {
            using var conn = _dbFactory.CreateConnection();
            var token = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT SettingValue FROM ClinicSettings WHERE SettingKey = 'Telemed.TelegramBotToken' AND TenantId = @TenantId",
                new { TenantId = tenantId }) ?? "8215614286:AAH-0jSn8wCK5-wctKskfSY6v_OLUhOMgtk";

            var url = $"https://api.telegram.org/bot{token}/sendMessage";
            var payload = new Dictionary<string, object>
            {
                ["chat_id"] = chatId,
                ["text"] = text,
                ["parse_mode"] = "Markdown"
            };

            var res = await _httpClient.PostAsJsonAsync(url, payload);
            if (!res.IsSuccessStatusCode)
            {
                payload.Remove("parse_mode");
                await _httpClient.PostAsJsonAsync(url, payload);
            }
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TELEGRAM NOTIFICATION ERROR] {ex.Message}");
            return false;
        }
    }

    public async Task<bool> NotifyPaymentVerifiedAsync(byte tenantId, int invoiceId)
    {
        using var conn = _dbFactory.CreateConnection();

        // 1. Fetch invoice, patient, and doctor details
        var invData = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT i.Id, i.InvoiceNumber, i.TotalAmount, i.PatientId,
                   ii.RefId AS DoctorId,
                   st.FirstName AS DoctorFirstName, st.LastName AS DoctorLastName,
                   p.FirstName AS PatientFirstName, p.LastName AS PatientLastName
            FROM Invoices i
            JOIN Patients p ON p.Id = i.PatientId
            LEFT JOIN InvoiceItems ii ON ii.InvoiceId = i.Id AND ii.ItemType = 1
            LEFT JOIN Doctors d ON d.Id = ii.RefId
            LEFT JOIN Staff st ON st.Id = d.StaffId
            WHERE i.Id = @InvoiceId AND i.TenantId = @TenantId",
            new { InvoiceId = invoiceId, TenantId = tenantId });

        if (invData == null) return false;

        int patientId = (int)invData.PatientId;
        int? doctorId = invData.DoctorId != null ? (int?)invData.DoctorId : null;
        string doctorName = (invData.DoctorFirstName != null)
            ? $"Dr. {invData.DoctorFirstName} {invData.DoctorLastName}"
            : "your attending doctor";

        // 2. Find linked Telegram identity
        var identity = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT ExternalPlatformId AS ChatId, RegistrationState, TempData
            FROM PatientSocialIdentities
            WHERE TenantId = @TenantId AND PatientId = @PatientId AND Platform = 'Telegram'",
            new { TenantId = tenantId, PatientId = patientId });

        if (identity == null) return false;

        string chatId = identity.ChatId as string ?? "";
        if (string.IsNullOrWhiteSpace(chatId)) return false;

        // 3. Update PatientSocialIdentities to REGISTERED
        await conn.ExecuteAsync(@"
            UPDATE PatientSocialIdentities
            SET RegistrationState = 'REGISTERED', LastInteractionAt = GETDATE()
            WHERE TenantId = @TenantId AND Platform = 'Telegram' AND ExternalPlatformId = @ChatId",
            new { TenantId = tenantId, ChatId = chatId });

        // 4. Activate telemed session in waiting room / active queue and link to invoice
        var existingSession = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT TOP 1 Id FROM TelemedSessions
            WHERE TenantId = @TenantId AND (InvoiceId = @InvoiceId OR (PatientId = @PatientId AND StatusId IN (1, 2, 3)))
            ORDER BY Id DESC",
            new { TenantId = tenantId, InvoiceId = invoiceId, PatientId = patientId });

        int activeSessionId;
        if (existingSession != null)
        {
            activeSessionId = (int)existingSession.Id;
            await conn.ExecuteAsync(@"
                UPDATE TelemedSessions
                SET IsPaid = 1,
                    StatusId = CASE WHEN StatusId = 1 THEN 2 ELSE StatusId END,
                    InvoiceId = @InvoiceId,
                    PaymentReference = @InvoiceNumber,
                    UpdatedAt = GETDATE()
                WHERE Id = @SessionId",
                new { InvoiceId = invoiceId, InvoiceNumber = (string)invData.InvoiceNumber, SessionId = activeSessionId });
        }
        else
        {
            // Fallback if session was not pre-created: create it linked to THIS invoice, already marked Paid!
            string sessNum = $"TEL-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
            activeSessionId = await conn.QuerySingleAsync<int>(@"
                INSERT INTO TelemedSessions (
                    TenantId, SessionNumber, PatientId, DoctorId, Platform, PlatformChatId,
                    StatusId, ChiefComplaint, ConsultationFee, IsPaid, InvoiceId, PaymentReference, CreatedAt, UpdatedAt
                )
                VALUES (
                    @TenantId, @SessionNumber, @PatientId, @DoctorId, 'Telegram', @ChatId,
                    2, 'Telemedicine Specialist Consultation', @Fee, 1, @InvoiceId, @InvoiceNumber, GETDATE(), GETDATE()
                );
                SELECT CAST(SCOPE_IDENTITY() AS INT);",
                new
                {
                    TenantId = tenantId,
                    SessionNumber = sessNum,
                    PatientId = patientId,
                    DoctorId = doctorId ?? 1,
                    ChatId = chatId,
                    Fee = (decimal)invData.TotalAmount,
                    InvoiceId = invoiceId,
                    InvoiceNumber = (string)invData.InvoiceNumber
                });
        }

        // Post confirmation system message to the session messages
        await conn.ExecuteAsync(@"
            INSERT INTO TelemedMessages (
                TenantId, SessionId, SenderType, SenderPatientId, MessageType,
                ContentText, IsReadByDoctor, IsDeliveredToPatient, SentAt
            )
            VALUES (
                @TenantId, @SessionId, 'System', @PatientId, 'Text',
                @ContentText, 0, 1, GETDATE()
            )",
            new
            {
                TenantId = tenantId,
                SessionId = activeSessionId,
                PatientId = patientId,
                ContentText = $"Payment of Br {invData.TotalAmount:F2} confirmed by clinic billing for invoice {invData.InvoiceNumber}. Consultation room is now ACTIVE."
            });

        // 5. Send Telegram verification message to patient
        string confirmMsg = "✅ *Transfer Receipt Verified & Payment Confirmed!*\n\n" +
            $"🧾 *Invoice:* `{invData.InvoiceNumber}` (Status: *PAID* — Br {invData.TotalAmount:F2})\n" +
            $"👨‍⚕️ *Attending Physician:* *{doctorName}*\n\n" +
            "━━━━━━━━━━━━━━━━━━━\n" +
            "🎉 Your telemedicine consultation room is now *ACTIVE*.\n" +
            $"{doctorName} has been notified in the clinic EMR cockpit and will reply to your messages or initiate a secure 1-click video call.";

        await SendTelegramNotificationAsync(tenantId, chatId, confirmMsg);
        return true;
    }
}
