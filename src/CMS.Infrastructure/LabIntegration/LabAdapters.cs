using CMS.Domain.Entities;
using CMS.Domain.Enums;
using CMS.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using NHapi.Base.Parser;

namespace CMS.Infrastructure.LabIntegration;

public class Hl7Adapter : IHl7Adapter
{
    private readonly ILogger<Hl7Adapter> _logger;
    private readonly PipeParser _parser;

    public Hl7Adapter(ILogger<Hl7Adapter> logger)
    {
        _logger = logger;
        _parser = new PipeParser();
    }

    public Task<LabResult?> ParseOruMessageAsync(string hl7RawMessage)
    {
        try
        {
            var parsed = ParseFullOruMessage(hl7RawMessage);
            var result = new LabResult
            {
                SourceType = (byte)LabResultSource.HL7,
                RawMessage = hl7RawMessage,
                NumericValue = parsed.PrimaryNumeric,
                TextValue = parsed.SummaryText,
                Unit = parsed.PrimaryUnit ?? "CBC",
                Flag = parsed.OverallFlag,
                ReferenceRange = parsed.Parameters.FirstOrDefault(p => p.NumericValue == parsed.PrimaryNumeric)?.ReferenceRange ?? "",
                IsCritical = parsed.IsCritical,
                EnteredAt = DateTime.UtcNow
            };
            return Task.FromResult<LabResult?>(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HL7 ORU parsing error");
            return Task.FromResult<LabResult?>(null);
        }
    }

    public ParsedHl7Result ParseFullOruMessage(string rawHl7)
    {
        var cleanHl7 = rawHl7.Trim('\x0B', '\x1C', '\x0D', '\x0A', ' ');
        var lines = cleanHl7.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        string? sampleId = null;
        string? msgControlId = null;
        string? sendingApp = null;
        string? sendingFacility = null;
        DateTime? obsDateTime = null;
        var parameters = new List<ParsedLabParameter>();

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("MSH|"))
            {
                var parts = trimmed.Split('|');
                if (parts.Length > 2) sendingApp = parts[2];
                if (parts.Length > 3) sendingFacility = parts[3];
                if (parts.Length > 9) msgControlId = parts[9];
            }
            else if (trimmed.StartsWith("PID|"))
            {
                var parts = trimmed.Split('|');
                if (parts.Length > 3 && !string.IsNullOrWhiteSpace(parts[3]) && sampleId == null)
                {
                    var idParts = parts[3].Split('^');
                    var pidVal = idParts[0].Trim();
                    if (!string.IsNullOrEmpty(pidVal)) sampleId = pidVal;
                }
            }
            else if (trimmed.StartsWith("OBR|"))
            {
                var parts = trimmed.Split('|');
                // OBR-2 is Placer Order Number, OBR-3 is Filler Order Number (Sample ID)
                if (parts.Length > 3 && !string.IsNullOrWhiteSpace(parts[3]))
                {
                    sampleId = parts[3].Trim();
                }
                else if (parts.Length > 2 && !string.IsNullOrWhiteSpace(parts[2]) && sampleId == null)
                {
                    sampleId = parts[2].Trim();
                }

                if (parts.Length > 7 && !string.IsNullOrWhiteSpace(parts[7]))
                {
                    var dtStr = parts[7].Trim();
                    if (dtStr.Length >= 8 && DateTime.TryParseExact(dtStr[..Math.Min(14, dtStr.Length)],
                        new[] { "yyyyMMddHHmmss", "yyyyMMddHHmm", "yyyyMMdd" },
                        System.Globalization.CultureInfo.InvariantCulture,
                        System.Globalization.DateTimeStyles.None, out var dt))
                    {
                        obsDateTime = dt;
                    }
                }
            }
            else if (trimmed.StartsWith("OBX|"))
            {
                var parts = trimmed.Split('|');
                if (parts.Length > 5)
                {
                    var ident = parts[3];
                    var identParts = ident.Split('^');
                    var code = identParts.Length > 0 ? identParts[0].Trim() : "";
                    var name = identParts.Length > 1 && !string.IsNullOrWhiteSpace(identParts[1]) ? identParts[1].Trim() : code;

                    var rawVal = parts[5].Trim();
                    var unit = parts.Length > 6 ? parts[6].Trim() : "";
                    var refRange = parts.Length > 7 ? parts[7].Trim() : "";
                    var flag = parts.Length > 8 ? parts[8].Trim() : "Normal";

                    decimal? numVal = null;
                    string? textVal = rawVal;

                    if (rawVal == "***")
                    {
                        numVal = null;
                        textVal = "***";
                        if (string.IsNullOrEmpty(flag) || flag == "Normal") flag = "L~A";
                    }
                    else if (decimal.TryParse(rawVal, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var n))
                    {
                        numVal = n;
                    }

                    // Normalize parameter codes for Hematology panels
                    var paramCode = name.ToUpperInvariant() switch
                    {
                        var s when s.Contains("WBC") => "WBC",
                        var s when s.Contains("RBC") => "RBC",
                        var s when s.Contains("HGB") || s.Contains("HEMOGLOBIN") => "HGB",
                        var s when s.Contains("HCT") || s.Contains("HEMATOCRIT") => "HCT",
                        var s when s.Contains("PLT") || s.Contains("PLATELET") => "PLT",
                        var s when s.Contains("MCV") => "MCV",
                        var s when s.Contains("MCH") && !s.Contains("MCHC") => "MCH",
                        var s when s.Contains("MCHC") => "MCHC",
                        var s when s.Contains("RDW-CV") || s.Contains("RDW_CV") => "RDW-CV",
                        var s when s.Contains("RDW-SD") || s.Contains("RDW_SD") => "RDW-SD",
                        var s when s.Contains("MPV") => "MPV",
                        var s when s.Contains("PDW") => "PDW",
                        var s when s.Contains("PCT") => "PCT",
                        var s when s.Contains("LYM%") || s.Contains("LYMPH%") => "LYM%",
                        var s when s.Contains("MID%") || s.Contains("MON%") => "MID%",
                        var s when s.Contains("GRAN%") || s.Contains("NEU%") => "GRAN%",
                        var s when s.Contains("LYM#") || s.Contains("LYMPH#") => "LYM#",
                        var s when s.Contains("MID#") || s.Contains("MON#") => "MID#",
                        var s when s.Contains("GRAN#") || s.Contains("NEU#") => "GRAN#",
                        _ => name
                    };

                    bool isCrit = flag.Contains("HH") || flag.Contains("LL") || flag.Contains("Critical");
                    if (numVal.HasValue)
                    {
                        if (paramCode == "WBC" && (numVal < 1.0m || numVal > 30.0m)) isCrit = true;
                        if (paramCode == "HGB" && numVal < 6.0m) isCrit = true;
                        if (paramCode == "PLT" && numVal < 40.0m) isCrit = true;
                    }

                    parameters.Add(new ParsedLabParameter(
                        paramCode,
                        name,
                        numVal,
                        textVal,
                        unit,
                        refRange,
                        string.IsNullOrWhiteSpace(flag) ? "Normal" : flag,
                        isCrit
                    ));
                }
            }
        }

        // Determine primary numeric (WBC or HGB)
        var primaryParam = parameters.FirstOrDefault(p => p.Code == "WBC")
            ?? parameters.FirstOrDefault(p => p.Code == "HGB")
            ?? parameters.FirstOrDefault(p => p.NumericValue.HasValue);

        decimal? primaryNumeric = primaryParam?.NumericValue;
        string? primaryUnit = primaryParam?.Unit;

        // Compile Summary Text: e.g. "WBC: 0.06 10^3/μL (L~A) | RBC: 4.5 | HGB: 14.2 ..."
        var summaryParts = parameters
            .Where(p => !p.Name.Contains("Mode") && !p.Name.Contains("Group") && !p.Name.Contains("Age"))
            .Select(p => $"{p.Code}: {p.TextValue} {p.Unit}{(string.IsNullOrWhiteSpace(p.Flag) || p.Flag == "Normal" || p.Flag == "OK" ? "" : $" ({p.Flag})")}".Trim());

        string summaryText = string.Join(" | ", summaryParts);
        if (string.IsNullOrWhiteSpace(summaryText) && parameters.Count > 0)
        {
            summaryText = string.Join(" | ", parameters.Select(p => $"{p.Name}: {p.TextValue}"));
        }

        bool hasCritical = parameters.Any(p => p.IsCritical);
        bool hasAbnormal = parameters.Any(p => p.Flag.Contains("L") || p.Flag.Contains("H") || p.Flag.Contains("A") || p.Flag.Contains("Error"));
        string overallFlag = hasCritical ? "Critical" : (hasAbnormal ? "Abnormal" : "Normal");

        return new ParsedHl7Result(
            sampleId,
            msgControlId,
            sendingApp,
            sendingFacility,
            obsDateTime ?? DateTime.UtcNow,
            parameters,
            summaryText,
            primaryNumeric,
            primaryUnit,
            overallFlag,
            hasCritical,
            rawHl7
        );
    }

    public string CreateAckMessage(string rawHl7, bool success = true, string? errorMsg = null)
    {
        var cleanHl7 = rawHl7.Trim('\x0B', '\x1C', '\x0D', '\x0A', ' ');
        var lines = cleanHl7.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        string sendingApp = "Z3";
        string sendingFac = "Zybio";
        string msgControlId = DateTime.UtcNow.ToString("yyyyMMddHHmmss");

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("MSH|"))
            {
                var parts = trimmed.Split('|');
                if (parts.Length > 2 && !string.IsNullOrWhiteSpace(parts[2])) sendingApp = parts[2].Trim();
                if (parts.Length > 3 && !string.IsNullOrWhiteSpace(parts[3])) sendingFac = parts[3].Trim();
                if (parts.Length > 9 && !string.IsNullOrWhiteSpace(parts[9])) msgControlId = parts[9].Trim();
                break;
            }
        }

        string ackCode = success ? "AA" : "AE";
        string text = success ? "Message accepted" : (errorMsg ?? "Processing error");
        string timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");

        return $"MSH|^~\\&|CMS|HUDERMA|{sendingApp}|{sendingFac}|{timestamp}||ACK^R01|{msgControlId}|P|2.3.1\r" +
               $"MSA|{ackCode}|{msgControlId}|{text}\r";
    }

    public string CreateOrmOrderMessage(LabOrder order, Patient patient)
    {
        return $"MSH|^~\\&|CMS|CLINIC|LAB|ANALYZER|{DateTime.UtcNow:yyyyMMddHHmmss}||ORM^O01|{order.OrderNumber}|P|2.3\r" +
               $"PID|1||{patient.MRN}||{patient.LastName}^{patient.FirstName}||{patient.DateOfBirth:yyyyMMdd}|{(patient.Gender == Gender.Male ? "M" : "F")}\r" +
               $"ORC|NW|{order.OrderNumber}|||||{order.Priority}\r";
    }
}

public class AstmAdapter : IAstmAdapter
{
    private readonly ILogger<AstmAdapter> _logger;

    public AstmAdapter(ILogger<AstmAdapter> logger)
    {
        _logger = logger;
    }

    public Task<LabResult?> ParseAstmMessageAsync(string astmRawMessage)
    {
        try
        {
            _logger.LogInformation("Parsing ASTM E1381/LIS2-A2 message");
            var lines = astmRawMessage.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines)
            {
                if (line.StartsWith("R|"))
                {
                    var parts = line.Split('|');
                    if (parts.Length > 3)
                    {
                        var rawValue = parts[3];
                        decimal.TryParse(rawValue, out var numericVal);
                        return Task.FromResult<LabResult?>(new LabResult
                        {
                            SourceType = (byte)LabResultSource.ASTM,
                            RawMessage = astmRawMessage,
                            NumericValue = numericVal != 0 ? numericVal : null,
                            TextValue = numericVal == 0 ? rawValue : null,
                            EnteredAt = DateTime.UtcNow
                        });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ASTM message parsing error");
        }
        return Task.FromResult<LabResult?>(null);
    }
}
