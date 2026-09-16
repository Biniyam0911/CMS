using CMS.Domain.Interfaces;
using Dapper;
using System.Net.Http.Json;
using System.Text.Json;

namespace CMS.Application.Telemedicine;

public class WhatsAppCloudService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly HttpClient _httpClient;
    private readonly TelemedService _telemedService;

    public WhatsAppCloudService(IDbConnectionFactory dbFactory, HttpClient httpClient, TelemedService telemedService)
    {
        _dbFactory = dbFactory;
        _httpClient = httpClient;
        _telemedService = telemedService;
    }

    public async Task<bool> SendWhatsAppTextMessageAsync(byte tenantId, string recipientPhone, string text)
    {
        try
        {
            using var conn = _dbFactory.CreateConnection();
            var phoneId = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT SettingValue FROM ClinicSettings WHERE SettingKey = 'Telemed.WhatsAppPhoneId' AND TenantId = @TenantId",
                new { TenantId = tenantId }) ?? "10492819230192";

            var token = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT SettingValue FROM ClinicSettings WHERE SettingKey = 'Telemed.WhatsAppApiToken' AND TenantId = @TenantId",
                new { TenantId = tenantId }) ?? "EAAX_TEST_TOKEN";

            if (token.Contains("TEST_TOKEN"))
            {
                Console.WriteLine($"[WHATSAPP OUTBOUND] -> To: {recipientPhone}, Text: {text}");
                return true;
            }

            var url = $"https://graph.facebook.com/v20.0/{phoneId}/messages";
            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

            var payload = new
            {
                messaging_product = "whatsapp",
                recipient_type = "individual",
                to = recipientPhone,
                type = "text",
                text = new { preview_url = true, body = text }
            };

            var res = await _httpClient.PostAsJsonAsync(url, payload);
            return res.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WHATSAPP ERROR] {ex.Message}");
            return false;
        }
    }

    public async Task HandleInboundWhatsAppWebhookAsync(byte tenantId, JsonElement body)
    {
        try
        {
            if (body.TryGetProperty("entry", out var entries) && entries.GetArrayLength() > 0)
            {
                var entry = entries[0];
                if (entry.TryGetProperty("changes", out var changes) && changes.GetArrayLength() > 0)
                {
                    var change = changes[0];
                    var value = change.GetProperty("value");
                    if (value.TryGetProperty("messages", out var msgs) && msgs.GetArrayLength() > 0)
                    {
                        var msg = msgs[0];
                        string fromPhone = msg.GetProperty("from").GetString() ?? "";
                        string text = "";
                        if (msg.TryGetProperty("text", out var textObj))
                        {
                            text = textObj.GetProperty("body").GetString() ?? "";
                        }
                        else
                        {
                            text = "Media message from WhatsApp patient";
                        }

                        // Route to TelemedService
                        await _telemedService.ProcessInboundPatientMessageAsync(tenantId, "WhatsApp", fromPhone, text);

                        // Auto-reply
                        string ack = "Hello from Specialty Clinic Telehealth! Dr. Bekele has received your consultation message in the EMR. We will contact you or launch a video call shortly.";
                        await SendWhatsAppTextMessageAsync(tenantId, fromPhone, ack);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WHATSAPP INBOUND ERROR] {ex.Message}");
        }
    }
}
