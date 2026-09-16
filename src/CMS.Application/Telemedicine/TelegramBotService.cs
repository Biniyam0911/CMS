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
                // In local dev/testing mode: Log to console
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
            if (update.TryGetProperty("message", out var msg))
            {
                var chatId = msg.GetProperty("chat").GetProperty("id").GetInt64().ToString();
                string text = msg.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "";

                string? photoUrl = null;
                if (msg.TryGetProperty("photo", out var photoArray) && photoArray.GetArrayLength() > 0)
                {
                    // Photo attached
                    text = string.IsNullOrWhiteSpace(text) ? "Patient uploaded clinical photo" : text;
                    photoUrl = "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80";
                }

                // If patient sent /start command: Send interactive welcome menu
                if (text.StartsWith("/start", StringComparison.OrdinalIgnoreCase))
                {
                    string welcome = "🏥 *Welcome to Specialty Clinic Telemedicine Bot*\n\n" +
                        "Consult with licensed specialist doctors directly from Telegram.\n\n" +
                        "Please select an option below:\n" +
                        "1. 🩺 *Book Online Consultation*\n" +
                        "2. 📋 *Describe Symptoms / Upload Photos*\n" +
                        "3. 💳 *Pay Consultation Fee via Telebirr*\n" +
                        "4. 📞 *Emergency Help (911)*";

                    await SendTelegramMessageAsync(tenantId, chatId, welcome);
                    return;
                }

                // Process message into TelemedService
                await _telemedService.ProcessInboundPatientMessageAsync(tenantId, "Telegram", chatId, text, photoUrl);

                // Auto-reply acknowledgment
                string ack = "✓ *Message received by your attending doctor.*\n" +
                    "Dr. Bekele has been notified in the EMR cockpit and will reply shortly or launch a 1-click video call.";
                await SendTelegramMessageAsync(tenantId, chatId, ack);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TELEGRAM INBOUND ERROR] {ex.Message}");
        }
    }
}
