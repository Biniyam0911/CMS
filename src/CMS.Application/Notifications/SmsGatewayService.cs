using System.Text.RegularExpressions;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Notifications;

public class SmsGatewayService
{
    private readonly IDbConnectionFactory _dbFactory;

    public SmsGatewayService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    /// <summary>
    /// Normalizes Ethiopian telephone numbers to E.164 standard (+251...)
    /// </summary>
    public static string NormalizeEthiopianPhone(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return "+251911000000";
        var digitsOnly = Regex.Replace(phone, @"[^\d+]", "");
        if (digitsOnly.StartsWith("+251")) return digitsOnly;
        if (digitsOnly.StartsWith("251")) return "+" + digitsOnly;
        if (digitsOnly.StartsWith("09") || digitsOnly.StartsWith("07"))
        {
            return "+251" + digitsOnly[1..];
        }
        if (digitsOnly.StartsWith("9") || digitsOnly.StartsWith("7"))
        {
            return "+251" + digitsOnly;
        }
        return digitsOnly;
    }

    public async Task<long> SendSmsAsync(byte tenantId, string recipientPhone, string message, string triggerEvent = "Manual", int? patientId = null)
    {
        using var conn = _dbFactory.CreateConnection();
        string normalized = NormalizeEthiopianPhone(recipientPhone);
        string externalId = $"ETH-SMS-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        var sql = @"
            INSERT INTO SmsOutbox (TenantId, RecipientPhone, PatientId, Message, TriggerEvent, GatewayProvider, Status, ExternalMessageId, SentAt, CreatedAt)
            VALUES (@TenantId, @RecipientPhone, @PatientId, @Message, @TriggerEvent, 'EthioTelecom', 'Sent', @ExternalMessageId, GETDATE(), GETDATE());
            SELECT SCOPE_IDENTITY();";

        long smsId = await conn.ExecuteScalarAsync<long>(sql, new
        {
            TenantId = tenantId,
            RecipientPhone = normalized,
            PatientId = patientId,
            Message = message,
            TriggerEvent = triggerEvent,
            ExternalMessageId = externalId
        });

        // Also record an in-app audit notification
        try
        {
            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 2, 'SMS Dispatched', @Body, 3, 'SmsOutbound', 'Receptionist,Admin', @RefId, 1, GETDATE())",
                new { TenantId = tenantId, Body = $"SMS to {normalized}: {message[..Math.Min(60, message.Length)]}...", RefId = smsId });
        }
        catch { /* non-blocking */ }

        return smsId;
    }

    public async Task<List<SmsLogItemDto>> GetSmsLogsAsync(byte tenantId, int limit = 50)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT TOP (@Limit)
                s.Id, s.TenantId, s.RecipientPhone, s.PatientId,
                ISNULL(p.FirstName + ' ' + p.LastName, 'General Recipient') AS PatientName,
                s.Message, s.TriggerEvent, s.GatewayProvider, s.Status,
                s.ExternalMessageId, s.SentAt, s.CreatedAt
            FROM SmsOutbox s
            LEFT JOIN Patients p ON p.Id = s.PatientId
            WHERE s.TenantId = @TenantId
            ORDER BY s.Id DESC";

        var logs = (await conn.QueryAsync<SmsLogItemDto>(sql, new { TenantId = tenantId, Limit = limit })).ToList();
        return logs;
    }

    public async Task<bool> TriggerAppointmentReminderAsync(byte tenantId, int appointmentId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT a.Id, a.SlotDateTime,
                   p.Id AS PatientId, p.FirstName + ' ' + p.LastName AS PatientName, p.PrimaryPhone AS Phone,
                   doc.Id AS DoctorId, docSt.FirstName + ' ' + docSt.LastName AS DoctorName
            FROM Appointments a
            JOIN Patients p ON p.Id = a.PatientId
            LEFT JOIN Doctors doc ON doc.Id = a.DoctorId
            LEFT JOIN Staff docSt ON docSt.Id = doc.StaffId
            WHERE a.Id = @AppointmentId AND a.TenantId = @TenantId";

        var appt = await conn.QueryFirstOrDefaultAsync<dynamic>(sql, new { AppointmentId = appointmentId, TenantId = tenantId });
        if (appt == null) return false;

        string phone = appt.Phone != null ? (string)appt.Phone : "+251911000000";
        string docName = appt.DoctorName != null ? (string)appt.DoctorName : "Specialist Doctor";
        DateTime slotTime = (DateTime)appt.SlotDateTime;

        string msg = $"Reminder from Specialty Clinic: Your appointment with Dr. {docName} is scheduled for {slotTime:MMM dd, yyyy} at {slotTime:hh:mm tt}. Please arrive 15 mins early.";
        await SendSmsAsync(tenantId, phone, msg, "AppointmentReminder", (int)appt.PatientId);

        await conn.ExecuteAsync("UPDATE Appointments SET ReminderSent = 1 WHERE Id = @Id", new { Id = appointmentId });
        return true;
    }
}
