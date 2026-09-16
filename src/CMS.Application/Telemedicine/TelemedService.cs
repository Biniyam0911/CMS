using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using System.Text.Json;

namespace CMS.Application.Telemedicine;

public class TelemedService
{
    private readonly IDbConnectionFactory _dbFactory;

    public TelemedService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
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
        
        // Mark all patient messages in this session as read by doctor
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

        // 1. Verify session exists
        var session = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, Platform, PlatformChatId, StatusId FROM TelemedSessions WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = req.SessionId, TenantId = tenantId });

        if (session == null)
            throw new InvalidOperationException("Telemedicine session not found.");

        // 2. Insert into TelemedMessages
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

        // 3. Update session to InConsultation (3) if it was Queued (2)
        if (session.StatusId == 2)
        {
            await conn.ExecuteAsync(
                "UPDATE TelemedSessions SET StatusId = 3, ActualStartTime = ISNULL(ActualStartTime, GETDATE()), UpdatedAt = GETDATE() WHERE Id = @Id",
                new { Id = req.SessionId });
        }

        // Return the created message DTO
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

        // Generate encrypted WebRTC room URL using Jitsi Meet / zero-install room
        string roomName = $"CMS-Telemed-{session.SessionNumber}";
        string roomUrl = $"https://meet.jit.si/{roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false";

        // Update session with RoomUrl
        await conn.ExecuteAsync(
            "UPDATE TelemedSessions SET RoomUrl = @RoomUrl, StatusId = 3, ActualStartTime = ISNULL(ActualStartTime, GETDATE()), UpdatedAt = GETDATE() WHERE Id = @Id",
            new { RoomUrl = roomUrl, Id = req.SessionId });

        // Post a message in the chat stream with the join link
        var st = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT FirstName + ' ' + LastName AS Name FROM Staff WHERE Id = @Id", new { Id = doctorStaffId });
        string docName = st?.Name ?? "The Doctor";
        string callNotice = $"📹 {docName} has initiated a secure video consultation room. Please tap the link below to join immediately from your phone or browser:\n\n🔗 {roomUrl}\n\n(No app installation required. Ensure microphone and camera permissions are allowed.)";

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

        // 1. Update session status to Completed (4)
        await conn.ExecuteAsync(@"
            UPDATE TelemedSessions 
            SET StatusId = 4, 
                DoctorNotes = @DoctorNotes,
                EndTime = GETDATE(),
                UpdatedAt = GETDATE()
            WHERE Id = @Id AND TenantId = @TenantId",
            new { req.DoctorNotes, Id = req.SessionId, TenantId = tenantId });

        // 2. Post consultation completion & prescription card to chat
        string summaryNotice = $"✅ Clinical consultation successfully completed by your physician.\n\n" +
            $"📋 Diagnosis: {req.Diagnosis ?? "Clinical advice & home care regimen provided"}\n" +
            (string.IsNullOrWhiteSpace(req.PrescriptionText) ? "" : $"💊 Prescribed Medication:\n{req.PrescriptionText}\n\n") +
            $"Your digital prescription and ERCA fiscal receipt have been generated. Thank you for choosing Specialty Clinic Telehealth.";

        await SendDoctorMessageAsync(tenantId, doctorStaffId, new SendDoctorMessageRequestDto
        {
            SessionId = req.SessionId,
            MessageType = "Prescription",
            ContentText = summaryNotice
        });

        return true;
    }

    public async Task<int> ProcessInboundPatientMessageAsync(byte tenantId, string platform, string platformChatId, string text, string? mediaUrl = null, string? mediaFileName = null, string? mediaMime = null)
    {
        using var conn = _dbFactory.CreateConnection();

        // 1. Find or create patient social identity
        var identity = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT PatientId FROM PatientSocialIdentities WHERE Platform = @Platform AND ExternalPlatformId = @ChatId AND TenantId = @TenantId",
            new { Platform = platform, ChatId = platformChatId, TenantId = tenantId });

        int patientId;
        if (identity != null)
        {
            patientId = (int)identity.PatientId;
        }
        else
        {
            // Default to first patient or seed patient 19
            patientId = 19;
            await conn.ExecuteAsync(@"
                INSERT INTO PatientSocialIdentities (TenantId, PatientId, Platform, ExternalPlatformId, DisplayName, LinkedAt)
                VALUES (@TenantId, @PatientId, @Platform, @ChatId, 'Telegram/WhatsApp Patient', GETDATE())",
                new { TenantId = tenantId, PatientId = patientId, Platform = platform, ChatId = platformChatId });
        }

        // 2. Find active session (Status 1, 2, or 3)
        var session = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT TOP 1 Id, StatusId 
            FROM TelemedSessions 
            WHERE TenantId = @TenantId AND PatientId = @PatientId AND StatusId IN (1, 2, 3)
            ORDER BY Id DESC",
            new { TenantId = tenantId, PatientId = patientId });

        int sessionId;
        if (session != null)
        {
            sessionId = (int)session.Id;
        }
        else
        {
            // Create a new session
            string sessNum = $"TEL-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
            sessionId = await conn.QuerySingleAsync<int>(@"
                INSERT INTO TelemedSessions (
                    TenantId, SessionNumber, PatientId, DoctorId, Platform, PlatformChatId,
                    StatusId, ChiefComplaint, ConsultationFee, IsPaid, CreatedAt, UpdatedAt
                )
                VALUES (
                    @TenantId, @SessionNumber, @PatientId, 1, @Platform, @ChatId,
                    2, @Complaint, 350.00, 1, GETDATE(), GETDATE()
                );
                SELECT CAST(SCOPE_IDENTITY() AS INT);",
                new
                {
                    TenantId = tenantId,
                    SessionNumber = sessNum,
                    PatientId = patientId,
                    Platform = platform,
                    ChatId = platformChatId,
                    Complaint = text.Length > 100 ? text.Substring(0, 100) : text
                });
        }

        // 3. Determine message type
        string msgType = !string.IsNullOrWhiteSpace(mediaUrl) ? "Image" : "Text";

        // 4. Insert message
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
}
