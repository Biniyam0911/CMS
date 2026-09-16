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
        return token ?? "8215614286:AAH-0jSn8wCK5-wctKskfSY6v_OLUhOMgtk";
    }

    public async Task<bool> SendTelegramMessageAsync(byte tenantId, string chatId, string text, object? replyMarkup = null)
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

            if (replyMarkup != null)
            {
                payload["reply_markup"] = replyMarkup;
            }

            var res = await _httpClient.PostAsJsonAsync(url, payload);
            if (!res.IsSuccessStatusCode)
            {
                var errContent = await res.Content.ReadAsStringAsync();
                Console.WriteLine($"[TELEGRAM SEND FAILED] {res.StatusCode}: {errContent}. Retrying as plain text...");
                payload.Remove("parse_mode");
                var resRetry = await _httpClient.PostAsJsonAsync(url, payload);
                if (!resRetry.IsSuccessStatusCode)
                {
                    var retryErr = await resRetry.Content.ReadAsStringAsync();
                    Console.WriteLine($"[TELEGRAM RETRY FAILED] {resRetry.StatusCode}: {retryErr}");
                }
                return resRetry.IsSuccessStatusCode;
            }
            return true;
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
            string? fileId = null;

            if (msg.TryGetProperty("photo", out var photoArray) && photoArray.GetArrayLength() > 0)
            {
                var bestPhoto = photoArray[photoArray.GetArrayLength() - 1];
                if (bestPhoto.TryGetProperty("file_id", out var fid)) fileId = fid.GetString();
                text = string.IsNullOrWhiteSpace(text) ? "Patient uploaded transfer receipt" : text;
            }
            else if (msg.TryGetProperty("document", out var docObj))
            {
                if (docObj.TryGetProperty("mime_type", out var mime) && mime.GetString()?.StartsWith("image/") == true)
                {
                    if (docObj.TryGetProperty("file_id", out var fid)) fileId = fid.GetString();
                    text = string.IsNullOrWhiteSpace(text) ? "Patient uploaded transfer receipt" : text;
                }
            }

            if (!string.IsNullOrWhiteSpace(fileId))
            {
                try
                {
                    var token = await GetBotTokenAsync(tenantId);
                    var getFileUrl = $"https://api.telegram.org/bot{token}/getFile?file_id={fileId}";
                    var fileInfoRes = await _httpClient.GetFromJsonAsync<JsonElement>(getFileUrl);
                    if (fileInfoRes.TryGetProperty("result", out var fileRes) && fileRes.TryGetProperty("file_path", out var filePathProp))
                    {
                        string filePath = filePathProp.GetString()!;
                        string downloadUrl = $"https://api.telegram.org/file/bot{token}/{filePath}";
                        byte[] fileBytes = await _httpClient.GetByteArrayAsync(downloadUrl);

                        string webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "receipts");
                        if (!Directory.Exists(webRoot)) Directory.CreateDirectory(webRoot);

                        string ext = Path.GetExtension(filePath);
                        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
                        string fileName = $"receipt_{chatId}_{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";

                        string fullDiskPath = Path.Combine(webRoot, fileName);
                        await File.WriteAllBytesAsync(fullDiskPath, fileBytes);

                        photoUrl = $"/uploads/receipts/{fileName}";
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[TELEGRAM FILE DOWNLOAD ERROR] {ex.Message}");
                }
            }

            using var conn = _dbFactory.CreateConnection();

            var identity = await conn.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT Id, PatientId, RegistrationState, TempData FROM PatientSocialIdentities WHERE Platform = 'Telegram' AND ExternalPlatformId = @ChatId AND TenantId = @TenantId",
                new { ChatId = chatId, TenantId = tenantId });

            // /start or /reset command
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
                    "Consult with our specialist doctors directly via chat and secure video.\n\n" +
                    $"💳 *Consultation Fee:* Br {fee:F2}\n\n" +
                    "📱 *Please enter your Mobile Phone Number* (e.g. `0911223344`):";

                await SendTelegramMessageAsync(tenantId, chatId, welcome);
                return;
            }

            // If not found, start questionnaire
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

            // Helper to get active doctors from database
            async Task<List<dynamic>> GetDoctorsListAsync()
            {
                var docsSql = @"
                    SELECT d.Id AS DoctorId, st.FirstName, st.LastName, ISNULL(d.SubSpecialization, st.Department) AS Specialty
                    FROM Doctors d
                    JOIN Staff st ON st.Id = d.StaffId
                    WHERE st.IsActive = 1
                    ORDER BY d.Id ASC";
                return (await conn.QueryAsync<dynamic>(docsSql)).ToList();
            }

            // ─────────────────────────────────────────────────────────────
            // STATE 1: ASK_PHONE
            // ─────────────────────────────────────────────────────────────
            if (state == "ASK_PHONE")
            {
                string cleanPhone = System.Text.RegularExpressions.Regex.Replace(text, @"[^\d\+]", "");
                if (cleanPhone.Length < 9)
                {
                    await SendTelegramMessageAsync(tenantId, chatId, "⚠️ Please enter a valid mobile phone number (at least 9-10 digits):");
                    return;
                }

                var existingPatient = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                    SELECT TOP 1 Id, FirstName, LastName, MRN, PrimaryPhone 
                    FROM Patients 
                    WHERE TenantId = @TenantId AND (PrimaryPhone LIKE '%' + @Phone OR SecondaryPhone LIKE '%' + @Phone)",
                    new { TenantId = tenantId, Phone = cleanPhone.Substring(Math.Max(0, cleanPhone.Length - 9)) });

                if (existingPatient != null)
                {
                    // Existing patient found: Link & proceed to Doctor Selection
                    var tempData = JsonSerializer.Serialize(new { Phone = cleanPhone, PatientId = (int)existingPatient.Id });
                    await conn.ExecuteAsync(@"
                        UPDATE PatientSocialIdentities 
                        SET PatientId = @PatientId, 
                            DisplayName = @Name, 
                            RegistrationState = 'SELECT_DOCTOR',
                            TempData = @TempData,
                            LastInteractionAt = GETDATE()
                        WHERE Id = @Id",
                        new {
                            PatientId = existingPatient.Id,
                            Name = $"{existingPatient.FirstName} {existingPatient.LastName}",
                            TempData = tempData,
                            Id = identity.Id
                        });

                    var doctors = await GetDoctorsListAsync();
                    var docLines = string.Join("\n", doctors.Select((d, idx) => $"{idx + 1}️⃣ *Dr. {d.FirstName} {d.LastName}* — {d.Specialty}"));

                    var keyboardButtons = doctors.Select((d, idx) => new[] {
                        new { text = $"{idx + 1}. Dr. {d.FirstName} {d.LastName}" }
                    }).ToArray();

                    var replyMarkup = new {
                        keyboard = keyboardButtons,
                        one_time_keyboard = true,
                        resize_keyboard = true
                    };

                    string matchedMsg = $"✅ *Welcome back, {existingPatient.FirstName} {existingPatient.LastName}!* (MRN: `{existingPatient.MRN}`)\n\n" +
                        "👨‍⚕️ *Available Attending Doctors:*\n" +
                        $"{docLines}\n\n" +
                        "👉 *Tap a doctor button below, or reply with their number (e.g. 1 or 2):*";
                    await SendTelegramMessageAsync(tenantId, chatId, matchedMsg, replyMarkup);
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

                var tempData = JsonSerializer.Serialize(new { Phone = phone, FirstName = firstName, LastName = lastName });
                await conn.ExecuteAsync(@"
                    UPDATE PatientSocialIdentities 
                    SET RegistrationState = 'ASK_AGE', 
                        TempData = @TempData,
                        DisplayName = @DisplayName,
                        LastInteractionAt = GETDATE()
                    WHERE Id = @Id",
                    new { TempData = tempData, DisplayName = $"{firstName} {lastName}", Id = identity.Id });

                await SendTelegramMessageAsync(tenantId, chatId, $"Thank you, *{firstName}*!\n\n🎂 *What is your age in years?* (e.g. `28`):");
                return;
            }

            // ─────────────────────────────────────────────────────────────
            // STATE 3: ASK_AGE
            // ─────────────────────────────────────────────────────────────
            if (state == "ASK_AGE")
            {
                if (!int.TryParse(text, out int age) || age < 0 || age > 120)
                {
                    await SendTelegramMessageAsync(tenantId, chatId, "⚠️ Please enter a valid age in numbers (e.g. `25`):");
                    return;
                }

                // Read temp data
                string phone = "0900000000";
                string firstName = "New";
                string lastName = "Patient";
                try
                {
                    if (identity.TempData != null)
                    {
                        var doc = JsonDocument.Parse((string)identity.TempData);
                        if (doc.RootElement.TryGetProperty("Phone", out var p)) phone = p.GetString() ?? phone;
                        if (doc.RootElement.TryGetProperty("FirstName", out var fn)) firstName = fn.GetString() ?? firstName;
                        if (doc.RootElement.TryGetProperty("LastName", out var ln)) lastName = ln.GetString() ?? lastName;
                    }
                }
                catch {}

                var tempData = JsonSerializer.Serialize(new { Phone = phone, FirstName = firstName, LastName = lastName, Age = age });
                await conn.ExecuteAsync(@"
                    UPDATE PatientSocialIdentities 
                    SET RegistrationState = 'ASK_GENDER', 
                        TempData = @TempData,
                        LastInteractionAt = GETDATE()
                    WHERE Id = @Id",
                    new { TempData = tempData, Id = identity.Id });

                var genderKeyboard = new {
                    keyboard = new[] {
                        new[] { new { text = "👨 Male" }, new { text = "👩 Female" } }
                    },
                    one_time_keyboard = true,
                    resize_keyboard = true
                };

                await SendTelegramMessageAsync(tenantId, chatId, "⚧ *Please select your biological Gender:*", genderKeyboard);
                return;
            }

            // ─────────────────────────────────────────────────────────────
            // STATE 4: ASK_GENDER -> Create Patient & Select Doctor
            // ─────────────────────────────────────────────────────────────
            if (state == "ASK_GENDER")
            {
                byte genderByte = text.Contains("Female", StringComparison.OrdinalIgnoreCase) ? (byte)2 : (byte)1;
                
                string phone = "0900000000";
                string firstName = "New";
                string lastName = "Patient";
                int age = 25;
                try
                {
                    if (identity.TempData != null)
                    {
                        var doc = JsonDocument.Parse((string)identity.TempData);
                        if (doc.RootElement.TryGetProperty("Phone", out var p)) phone = p.GetString() ?? phone;
                        if (doc.RootElement.TryGetProperty("FirstName", out var fn)) firstName = fn.GetString() ?? firstName;
                        if (doc.RootElement.TryGetProperty("LastName", out var ln)) lastName = ln.GetString() ?? lastName;
                        if (doc.RootElement.TryGetProperty("Age", out var a)) age = a.GetInt32();
                    }
                }
                catch {}

                DateTime dob = DateTime.UtcNow.AddYears(-age);
                int nextNum = (await conn.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(Id), 0) + 1 FROM Patients"));
                string newMrn = $"HD-{nextNum:D4}";

                int newPatientId = await conn.QuerySingleAsync<int>(@"
                    INSERT INTO Patients (
                        TenantId, MRN, FirstName, LastName, DateOfBirth, Gender,
                        PrimaryPhone, IsActive, CreatedAt, InsuranceCopayPercent
                    )
                    VALUES (
                        @TenantId, @MRN, @FirstName, @LastName, @DOB, @Gender,
                        @Phone, 1, GETDATE(), 0.00
                    );
                    SELECT CAST(SCOPE_IDENTITY() AS INT);",
                    new
                    {
                        TenantId = tenantId,
                        MRN = newMrn,
                        FirstName = firstName,
                        LastName = lastName,
                        DOB = dob.Date,
                        Gender = genderByte,
                        Phone = phone
                    });

                var tempData = JsonSerializer.Serialize(new { Phone = phone, PatientId = newPatientId });
                await conn.ExecuteAsync(@"
                    UPDATE PatientSocialIdentities 
                    SET PatientId = @PatientId, 
                        RegistrationState = 'SELECT_DOCTOR', 
                        TempData = @TempData,
                        LastInteractionAt = GETDATE()
                    WHERE Id = @Id",
                    new { PatientId = newPatientId, TempData = tempData, Id = identity.Id });

                var doctors = await GetDoctorsListAsync();
                var docLines = string.Join("\n", doctors.Select((d, idx) => $"{idx + 1}️⃣ *Dr. {d.FirstName} {d.LastName}* — {d.Specialty}"));

                var keyboardButtons = doctors.Select((d, idx) => new[] {
                    new { text = $"{idx + 1}. Dr. {d.FirstName} {d.LastName}" }
                }).ToArray();

                var replyMarkup = new {
                    keyboard = keyboardButtons,
                    one_time_keyboard = true,
                    resize_keyboard = true
                };

                string registeredMsg = $"🎉 *Patient Registration Complete!*\n\n" +
                    $"• *Patient:* {firstName} {lastName}\n" +
                    $"• *MRN:* `{newMrn}`\n\n" +
                    "👨‍⚕️ *Available Attending Doctors:*\n" +
                    $"{docLines}\n\n" +
                    "👉 *Tap a doctor button below, or reply with their number (e.g. 1 or 2):*";

                await SendTelegramMessageAsync(tenantId, chatId, registeredMsg, replyMarkup);
                return;
            }

            // ─────────────────────────────────────────────────────────────
            // STATE 5: SELECT_DOCTOR -> Prompt for Transfer Screenshot
            // ─────────────────────────────────────────────────────────────
            if (state == "SELECT_DOCTOR")
            {
                var doctors = await GetDoctorsListAsync();
                int selectedDoctorId = 1;
                string doctorName = "Dr. Abebe Bekele";

                for (int i = 0; i < doctors.Count; i++)
                {
                    var d = doctors[i];
                    string prefix = $"{i + 1}";
                    if (text == prefix || text.StartsWith($"{prefix}.") || text.StartsWith($"{prefix} ") || 
                        text.Contains((string)d.FirstName, StringComparison.OrdinalIgnoreCase) || 
                        text.Contains((string)d.LastName, StringComparison.OrdinalIgnoreCase))
                    {
                        selectedDoctorId = (int)d.DoctorId;
                        doctorName = $"Dr. {d.FirstName} {d.LastName}";
                        break;
                    }
                }

                int patientId = identity.PatientId != null ? (int)identity.PatientId : 1;
                decimal fee = await _telemedService.GetTelemedConsultationFeeAsync(tenantId);

                // Check if an open/pending telemedicine session or invoice already exists for this patient
                var existingPending = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                    SELECT TOP 1 s.Id AS SessionId, s.SessionNumber, s.InvoiceId, i.StatusId AS InvoiceStatusId
                    FROM TelemedSessions s
                    LEFT JOIN Invoices i ON i.Id = s.InvoiceId
                    WHERE s.TenantId = @TenantId AND s.PatientId = @PatientId AND s.StatusId IN (1, 2)
                    ORDER BY s.Id DESC",
                    new { TenantId = tenantId, PatientId = patientId });

                int invoiceId;
                int sessionId;
                string sessNum;

                if (existingPending != null && existingPending.InvoiceId != null && (int?)existingPending.InvoiceStatusId != 4)
                {
                    invoiceId = (int)existingPending.InvoiceId;
                    sessionId = (int)existingPending.SessionId;
                    sessNum = (string)existingPending.SessionNumber;
                    await conn.ExecuteAsync("UPDATE TelemedSessions SET DoctorId = @DoctorId, UpdatedAt = GETDATE() WHERE Id = @Id", new { DoctorId = selectedDoctorId, Id = sessionId });
                }
                else
                {
                    // Pre-create invoice so it immediately appears in Billing
                    sessNum = $"TEL-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
                    invoiceId = await _telemedService.CreateTelemedicineInvoiceAsync(tenantId, patientId, selectedDoctorId, fee, sessNum);

                    // Also create TelemedSession right away linked to this invoice
                    sessionId = await conn.QuerySingleAsync<int>(@"
                        INSERT INTO TelemedSessions (
                            TenantId, SessionNumber, PatientId, DoctorId, Platform, PlatformChatId,
                            StatusId, ChiefComplaint, ConsultationFee, IsPaid, InvoiceId, CreatedAt, UpdatedAt
                        )
                        VALUES (
                            @TenantId, @SessionNumber, @PatientId, @DoctorId, 'Telegram', @ChatId,
                            2, 'Telemedicine Specialist Consultation', @Fee, 0, @InvoiceId, GETDATE(), GETDATE()
                        );
                        SELECT CAST(SCOPE_IDENTITY() AS INT);",
                        new
                        {
                            TenantId = tenantId,
                            SessionNumber = sessNum,
                            PatientId = patientId,
                            DoctorId = selectedDoctorId,
                            ChatId = chatId,
                            Fee = fee,
                            InvoiceId = invoiceId
                        });
                }

                var tempData = JsonSerializer.Serialize(new { 
                    DoctorId = selectedDoctorId, 
                    DoctorName = doctorName,
                    InvoiceId = invoiceId,
                    SessionId = sessionId,
                    SessionNumber = sessNum
                });

                await conn.ExecuteAsync(@"
                    UPDATE PatientSocialIdentities 
                    SET RegistrationState = 'AWAITING_PAYMENT_PROOF', 
                        TempData = @TempData,
                        LastInteractionAt = GETDATE()
                    WHERE Id = @Id",
                    new { TempData = tempData, Id = identity.Id });

                // Temporary keyboard to remove custom keyboards
                var removeKeyboard = new { remove_keyboard = true };

                string paymentPrompt = $"👨‍⚕️ *Assigned Physician:* {doctorName}\n" +
                    $"💳 *Consultation Fee:* Br {fee:F2}\n" +
                    $"🧾 *Invoice Generated:* `INV-{invoiceId:D5}`\n\n" +
                    "━━━━━━━━━━━━━━━━━━━\n" +
                    "💰 *Telebirr / CBE Payment Instructions:*\n" +
                    "• Telebirr Merchant Code: *123456* (Specialty Clinic)\n" +
                    "• CBE Account: *1000234567890*\n\n" +
                    "📸 **Please send a SCREENSHOT of your payment transfer** to proceed with verification:";

                await SendTelegramMessageAsync(tenantId, chatId, paymentPrompt, removeKeyboard);
                return;
            }

            // ─────────────────────────────────────────────────────────────
            // STATE 6: AWAITING_PAYMENT_PROOF (User uploads screenshot/photo)
            // ─────────────────────────────────────────────────────────────
            if (state == "AWAITING_PAYMENT_PROOF")
            {
                int patientId = identity.PatientId != null ? (int)identity.PatientId : 1;
                int doctorId = 1;
                int invoiceId = 0;
                try
                {
                    if (identity.TempData != null)
                    {
                        var doc = JsonDocument.Parse((string)identity.TempData);
                        if (doc.RootElement.TryGetProperty("DoctorId", out var did)) doctorId = did.GetInt32();
                        if (doc.RootElement.TryGetProperty("InvoiceId", out var iid)) invoiceId = iid.GetInt32();
                    }
                }
                catch {}

                if (invoiceId == 0)
                {
                    invoiceId = await conn.QueryFirstOrDefaultAsync<int>(@"
                        SELECT TOP 1 Id FROM Invoices 
                        WHERE PatientId = @PatientId AND StatusId IN (1, 2)
                        ORDER BY Id DESC",
                        new { PatientId = patientId });
                }

                // Save receipt photo to Invoices table so cashier can immediately see the screenshot in Billing
                if (invoiceId > 0 && !string.IsNullOrWhiteSpace(photoUrl))
                {
                    await conn.ExecuteAsync(@"
                        UPDATE Invoices 
                        SET ReceiptImageUrl = @PhotoUrl, UpdatedAt = GETDATE()
                        WHERE Id = @InvoiceId",
                        new { PhotoUrl = photoUrl, InvoiceId = invoiceId });
                }

                // Save state as AWAITING_VERIFICATION (waiting for cashier to mark invoice as paid in Billing)
                await conn.ExecuteAsync(@"
                    UPDATE PatientSocialIdentities 
                    SET RegistrationState = 'AWAITING_VERIFICATION', 
                        LastInteractionAt = GETDATE()
                    WHERE Id = @Id",
                    new { Id = identity.Id });

                // Notify billing officers in Notifications table
                try
                {
                    await conn.ExecuteAsync(@"
                        INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                        VALUES (@TenantId, NULL, 3, 'Telemedicine Transfer Receipt Uploaded', 'Patient #' + CAST(@PatientId AS VARCHAR) + ' uploaded payment transfer screenshot for Invoice #' + CAST(@InvoiceId AS VARCHAR) + '. Please verify and mark as Paid in Billing.', 2, 'PaymentProofSubmitted', 'BillingOfficer,Admin', @InvoiceId, 1, GETDATE())",
                        new { TenantId = tenantId, PatientId = patientId, InvoiceId = invoiceId });
                }
                catch {}

                string ack = "📥 *Payment Transfer Screenshot Received!* 📸\n\n" +
                    "⏳ *Status: Awaiting Clinic Verification*\n" +
                    "Your receipt has been submitted to the clinic billing department for review.\n\n" +
                    "Once our cashier verifies the transfer and marks your invoice as *Paid* in the clinic billing system, you will receive an instant confirmation message here and your attending physician will be notified to begin your consultation.";
                await SendTelegramMessageAsync(tenantId, chatId, ack);
                return;
            }

            // ─────────────────────────────────────────────────────────────
            // STATE 6.5: AWAITING_VERIFICATION (Waiting for Cashier to Mark Paid)
            // ─────────────────────────────────────────────────────────────
            if (state == "AWAITING_VERIFICATION")
            {
                if (!string.IsNullOrWhiteSpace(photoUrl))
                {
                    int patientId = identity.PatientId != null ? (int)identity.PatientId : 1;
                    int invoiceId = await conn.QueryFirstOrDefaultAsync<int>(@"
                        SELECT TOP 1 Id FROM Invoices 
                        WHERE PatientId = @PatientId AND StatusId IN (1, 2)
                        ORDER BY Id DESC",
                        new { PatientId = patientId });

                    if (invoiceId > 0)
                    {
                        await conn.ExecuteAsync(@"
                            UPDATE Invoices 
                            SET ReceiptImageUrl = @PhotoUrl, UpdatedAt = GETDATE()
                            WHERE Id = @InvoiceId",
                            new { PhotoUrl = photoUrl, InvoiceId = invoiceId });
                    }

                    await SendTelegramMessageAsync(tenantId, chatId, "📸 *Updated transfer screenshot received!* Our cashier has been notified.");
                    return;
                }
                string waitMsg = "⏳ *Payment Verification in Progress*\n\n" +
                    "Our billing team is currently reviewing your payment transfer receipt.\n\n" +
                    "As soon as the cashier marks your invoice as *Paid* in the clinic billing system, you will receive an automatic confirmation here and your doctor will join the consultation room.";
                await SendTelegramMessageAsync(tenantId, chatId, waitMsg);
                return;
            }

            // ─────────────────────────────────────────────────────────────
            // STATE 7: REGISTERED (Ongoing live consultation messages)
            // ─────────────────────────────────────────────────────────────
            int registeredPatientId = identity.PatientId != null ? (int)identity.PatientId : 1;

            await _telemedService.ProcessInboundPatientMessageAsync(
                tenantId, "Telegram", chatId, text, photoUrl, explicitPatientId: registeredPatientId);

            string liveAck = "✓ *Message delivered to your doctor in the EMR cockpit.*\n" +
                "The doctor has been notified and will reply shortly or launch a 1-click video call.";
            await SendTelegramMessageAsync(tenantId, chatId, liveAck);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TELEGRAM INBOUND ERROR] {ex}");
        }
    }
}
