using System.Net;

namespace CMS.Shared.Helpers;

public static class ClientIpResolver
{
    public static string NormalizeIp(string? rawIp)
    {
        if (string.IsNullOrWhiteSpace(rawIp))
            return "unknown";

        string trimmed = rawIp.Trim();

        // 1. Bracketed IPv6 with port: [2001:db8::1]:8080 -> 2001:db8::1
        if (trimmed.StartsWith('[') && trimmed.Contains(']'))
        {
            int closeBracket = trimmed.IndexOf(']');
            string ipInside = trimmed.Substring(1, closeBracket - 1);
            if (IPAddress.TryParse(ipInside, out var parsedV6))
            {
                return parsedV6.ToString();
            }
        }

        // 2. IPv4 with port: 192.168.1.1:5000 -> 192.168.1.1
        // Only strip port if there is exactly one colon (IPv4:port) and the prefix is a valid IP
        int colonCount = trimmed.Count(c => c == ':');
        if (colonCount == 1)
        {
            int colonIndex = trimmed.IndexOf(':');
            string hostPart = trimmed.Substring(0, colonIndex);
            if (IPAddress.TryParse(hostPart, out var parsedV4))
            {
                return parsedV4.ToString();
            }
        }

        // 3. Direct IP address parse (handles standard IPv4 or unbracketed standard IPv6)
        if (IPAddress.TryParse(trimmed, out var parsedDirect))
        {
            return parsedDirect.ToString();
        }

        return trimmed;
    }

    public static string ExtractClientIp(string? forwardedFor, string? realIp, IPAddress? remoteIpAddress)
    {
        if (!string.IsNullOrWhiteSpace(forwardedFor))
        {
            var parts = forwardedFor.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 0 && !string.IsNullOrWhiteSpace(parts[0]))
            {
                return NormalizeIp(parts[0]);
            }
        }

        if (!string.IsNullOrWhiteSpace(realIp))
        {
            return NormalizeIp(realIp);
        }

        return remoteIpAddress != null ? remoteIpAddress.ToString() : "unknown";
    }
}
