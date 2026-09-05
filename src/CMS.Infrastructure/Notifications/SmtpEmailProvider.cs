using System.Net.Mail;
using CMS.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CMS.Infrastructure.Notifications;

public class SmtpEmailProvider : INotificationProvider
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailProvider> _logger;

    public SmtpEmailProvider(IConfiguration config, ILogger<SmtpEmailProvider> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task<bool> SendEmailAsync(string toEmail, string subject, string body)
    {
        try
        {
            var host = _config["Notifications:Email:Host"] ?? "localhost";
            var port = int.Parse(_config["Notifications:Email:Port"] ?? "25");
            using var client = new SmtpClient(host, port);
            using var mail = new MailMessage("noreply@clinic.local", toEmail, subject, body) { IsBodyHtml = true };
            await client.SendMailAsync(mail);
            _logger.LogInformation("Email sent successfully to {ToEmail}", toEmail);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {ToEmail}", toEmail);
            return false;
        }
    }

    public async Task<bool> SendSmsAsync(string phoneNumber, string message)
    {
        try
        {
            _logger.LogInformation("SMS dispatched to {Phone}: {Message}", phoneNumber, message);
            await Task.Delay(50); // Simulated HTTP SMS Gateway request
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send SMS to {Phone}", phoneNumber);
            return false;
        }
    }
}
