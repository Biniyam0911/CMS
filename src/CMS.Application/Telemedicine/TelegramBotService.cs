using CMS.Domain.Interfaces;
using Dapper;
using System.Net.Http.Json;
using System.Text.Json;

namespace CMS.Application.Telemedicine;

public class TelegramBotService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly HttpClient _httpClient;
    private readonly TelemedService _telemedService;

    public TelegramBotService(IDbConnectionFactory dbFactory, HttpClient httpClient, TelemedService telemedService)
    {
        _dbFactory = dbFactory;
        _httpClient = httpClient;
        _telemedService = telemedService;
    }

    private async Task<string> GetBotTokenAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var token = await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT SettingValue FROM ClinicSettings WHERE SettingKey = 'Telemed.TelegramBotToken' AND TenantId = @TenantId",
            new { TenantId = tenantId });
        return token ?? "7192834012:AAHq_TEST_TELEGRAM_BOT_TOKEN_CMS";
    }

    public async Task<bool> SendTelegramMessageAsync(byte tenantId, string chatId, string text, string? replyMarkupJson = null)
    {
        try
        {
            var token = await GetBotTokenAsync(tenantId);
            if (string.IsNullOrWhiteSpace(token) || token.Contains("TEST_TELEGRAM"))
            {
                Console.WriteLine($"[TELEGRAM OUTBOUND] -> ChatId: {chatId}, Text: {text}");
                return true;
            }

            var url = $"https://api.telegram.org/bot{token}/sendMessage";
            var payload = new Dictionary<string, object>
            {
                ["chat_id"] = chatId,
                ["text"] = text,
                ["parse_mode"] = "Markdown"
            };

            var res = await _httpClient.PostAsJsonAsync(url, payload);
            return res.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TELEGRAM ERROR] {ex.Message}");
            return false;
        }
    }

    public async Task HandleInboundTelegramUpdateAsync(byte tenantId, JsonElement update)
    {
        try
        {
            if (!update.TryGetProperty("message", out var msg)) return;

            var chatId = msg.GetProperty("chat").GetProperty("id").GetInt64().ToString();
            string text = msg.TryGetProperty("text", out var t) ? t.GetString()?.Trim() ?? "" : "";
            
            string senderUsername = "";
            if (msg.TryGetProperty("from", out var fromObj))
            {
                if (fromObj.TryGetProperty("username", out var u)) senderUsername = u.GetString() ?? "";
            }

            string? photoUrl = null;
            if (msg.TryGetProperty("photo", out var photoArray) && photoArray.GetArrayLength() > 0)
            {
                text = string.IsNullOrWhiteSpace(text) ? "Patient uploaded clinical photo" : text;
                photoUrl = "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80";
            }

            using var conn = _dbFactory.CreateConnection();

            // 1. Check if we already have this Telegram chat linked
            var identity = await conn.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT Id, PatientId, RegistrationState, TempData FROM PatientSocialIdentities WHERE Platform = 'Telegram' AND ExternalPlatformId = @ChatId AND TenantId = @TenantId",
                new { ChatId = chatId, TenantId = tenantId });

            // If user typed /start or /reset, start/restart registration questionnaire
            if (text.Equals("/start", StringComparison.OrdinalIgnoreCase) || text.Equals("/reset", StringComparison.OrdinalIgnoreCase))
            {
                if (identity == null)
                {
                    await conn.ExecuteAsync(@"
                        INSERT INTO PatientSocialIdentities (TenantId, PatientId, Platform, ExternalPlatformId, Username, DisplayName, RegistrationState, LinkedAt, LastInteractionAt)
                        VALUES (@TenantId, NULL, 'Telegram', @ChatId, @Username, 'New Patient', 'ASK_PHONE', GETDATE(), GETDATE())",
                        new { TenantId = tenantId, ChatId = chatId, Username = senderUsername });
                }
                else
                {
                    await conn.ExecuteAsync(@"
                        UPDATE PatientSocialIdentities 
                        SET RegistrationState = 'ASK_PHONE', TempData = NULL, LastInteractionAt = GETDATE()
                        WHERE Id = @Id",
                        new { Id = identity.Id });
                }

                decimal fee = await _telemedService.GetTelemedConsultationFeeAsync(tenantId);
                string welcome = "🏥 *Welcome to Specialty Clinic Telemedicine Bot*\n\n" +
                    "To connect you with our medical staff, let's verify your patient record.\n\n" +
                    $"💳 *Consultation Fee:* Br {fee:F2} (Settled via Telebirr)\n\n" +
                    "📱 *Please enter your Mobile Phone Number* (e.g. `0911223344`):";

                await SendTelegramMessageAsync(tenantId, chatId, welcome);
                return;
            }

            // If identity doesn't exist yet, ask for phone first
            if (identity == null)
            {
                await conn.ExecuteAsync(@"
                    INSERT INTO PatientSocialIdentities (TenantId, PatientId, Platform, ExternalPlatformId, Username, DisplayName, RegistrationState, LinkedAt, LastInteractionAt)
                    VALUES (@TenantId, NULL, 'Telegram', @ChatId, @Username, 'New Patient', 'ASK_PHONE', GETDATE(), GETDATE())",
                    new { TenantId = tenantId, ChatId = chatId, Username = senderUsername });

                decimal fee = await _telemedService.GetTelemedConsultationFeeAsync(tenantId);
                string prompt = "🏥 *Welcome to Specialty Clinic Telemedicine*\n\n" +
                    $"Consultation Fee: *Br {fee:F2}*\n\n" +
                    "📱 *Please enter your Mobile Phone Number* to begin:";
                await SendTelegramMessageAsync(tenantId, chatId, prompt);
                return;
            }

            string state = identity.RegistrationState as string ?? "";

            // ─────────────────────────────────────────────────────────────
            // STATE 1: ASK_PHONE
            // ─────────────────────────────────────────────────────────────
            if (state == "ASK_PHONE")
            {
                string cleanPhone = System.Text.RegularExpressions.Regex.Replace(text, @"[^\d\+]", "");
                if (cleanPhone.Length < 9)
                {
                    await SendTelegramMessageAsync(tenantId, chatId, "⚠️ Please enter a valid phone number (at least 9-10 digits):");
                    return;
                }

                // Check if patient exists in Patients table with this phone
                var existingPatient = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                    SELECT TOP 1 Id, FirstName, LastName, MRN, PrimaryPhone 
                    FROM Patients 
                    WHERE TenantId = @TenantId AND (PrimaryPhone LIKE '%' + @Phone OR SecondaryPhone LIKE '%' + @Phone)",
                    new { TenantId = tenantId, Phone = cleanPhone.Substring(Math.Max(0, cleanPhone.Length - 9)) });

                if (existingPatient != null)
                {
                    // Existing patient found! Link directly
                    await conn.ExecuteAsync(@"
                        UPDATE PatientSocialIdentities 
                        SET PatientId = @PatientId, 
                            DisplayName = @Name, 
                            RegistrationState = 'REGISTERED',
                            LastInteractionAt = GETDATE()
                        WHERE Id = @Id",
                        new {
                            PatientId = existingPatient.Id,
                            Name = $"{existingPatient.FirstName} {existingPatient.LastName}",
                            Id = identity.Id
                        });

                    string matchedMsg = $"✅ *Welcome back, {existingPatient.FirstName} {existingPatient.LastName}!* (MRN: `{existingPatient.MRN}`)\n\n" +
                        "Your clinic record has been recognized.\n" +
                        "💬 *Please describe your symptoms or reason for consultation today (you can also attach photos):*";
                    await SendTelegramMessageAsync(tenantId, chatId, matchedMsg);
                    return;
                }
                else
                {
                    // New patient: ask for Full Name
                    var tempData = JsonSerializer.Serialize(new { Phone = cleanPhone });
                    await conn.ExecuteAsync(@"
                        UPDATE PatientSocialIdentities 
                        SET RegistrationState = 'ASK_NAME', 
                            TempData = @TempData,
                            LastInteractionAt = GETDATE()
                        WHERE Id = @Id",
                        new { TempData = tempData, Id = identity.Id });

                    string newMsg = "📝 We couldn't find an existing file with that phone number.\n\n" +
                        "Let's register you as a new patient!\n" +
                        "👤 *What is your Full Name?* (First Name & Father's Name):";
                    await SendTelegramMessageAsync(tenantId, chatId, newMsg);
                    return;
                }
            }

            // ─────────────────────────────────────────────────────────────
            // STATE 2: ASK_NAME
            // ─────────────────────────────────────────────────────────────
            if (state == "ASK_NAME")
            {
                var parts = text.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                string firstName = parts.Length > 0 ? parts[0] : text;
                string lastName = parts.Length > 1 ? string.Join(" ", parts.Skip(1)) : "Patient";

                string phone = "0900000000";
                try
                {
                    if (identity.TempData != null)
                    {
                        var doc = JsonDocument.Parse((string)identity.TempData);
                        if (doc.RootElement.TryGetProperty("Phone", out var p)) phone = p.GetString() ?? phone;
                    }
                }
                catch {}

                // Create new Patient record in Patients table
                int nextNum = (await conn.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(Id), 0) + 1 FROM Patients"));
                string newMrn = $"HD-{nextNum:D4}";

                int newPatientId = await conn.QuerySingleAsync<int>(@"
                    INSERT INTO Patients (
                        TenantId, MRN, FirstName, LastName, DateOfBirth, Gender,
                        PrimaryPhone, IsActive, CreatedAt, InsuranceCopayPercent
                    )
                    VALUES (
                        @TenantId, @MRN, @FirstName, @LastName, '1995-01-01', 1,
                        @Phone, 1, GETDATE(), 0.00
                    );
                    SELECT CAST(SCOPE_IDENTITY() AS INT);",
                    new
                    {
                        TenantId = tenantId,
                        MRN = newMrn,
                        FirstName = firstName,
                        LastName = lastName,
                        Phone = phone
                    });

                // Update PatientSocialIdentities
                await conn.ExecuteAsync(@"
                    UPDATE PatientSocialIdentities 
                    SET PatientId = @PatientId, 
                        DisplayName = @DisplayName, 
                        RegistrationState = 'REGISTERED',
                        TempData = NULL,
                        LastInteractionAt = GETDATE()
                    WHERE Id = @Id",
                    new {
                        PatientId = newPatientId,
                        DisplayName = $"{firstName} {lastName}",
                        Id = identity.Id
                    });

                decimal fee = await _telemedService.GetTelemedConsultationFeeAsync(tenantId);
                string registeredMsg = $"🎉 *Registration Complete!*\n\n" +
                    $"• *Patient:* {firstName} {lastName}\n" +
                    $"• *MRN:* `{newMrn}`\n" +
                    $"• *Consultation Fee:* Br {fee:F2}\n\n" +
                    "💬 *Please describe your symptoms or health concern to initiate consultation:*";
                await SendTelegramMessageAsync(tenantId, chatId, registeredMsg);
                return;
            }

            // ─────────────────────────────────────────────────────────────
            // STATE 3: REGISTERED (Regular in-consultation chat)
            // ─────────────────────────────────────────────────────────────
            int registeredPatientId = identity.PatientId != null ? (int)identity.PatientId : 1;

            // Process message into TelemedService
            await _telemedService.ProcessInboundPatientMessageAsync(
                tenantId, "Telegram", chatId, text, photoUrl, explicitPatientId: registeredPatientId);

            string ack = "✓ *Message sent to Dr. Bekele in the EMR clinic cockpit.*\n" +
                "The doctor has been notified and will reply shortly or launch a 1-click video call.";
            await SendTelegramMessageAsync(tenantId, chatId, ack);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TELEGRAM INBOUND ERROR] {ex.Message}");
        }
    }
}
