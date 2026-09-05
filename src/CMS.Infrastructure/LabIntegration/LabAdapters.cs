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
            _logger.LogInformation("Parsing HL7 ORU_R01 message");
            var message = _parser.Parse(hl7RawMessage);
            
            // Basic extraction of raw payload for HL7 ORU message
            var lines = hl7RawMessage.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines)
            {
                if (line.StartsWith("OBX|"))
                {
                    var parts = line.Split('|');
                    if (parts.Length > 5)
                    {
                        var rawValue = parts[5];
                        decimal.TryParse(rawValue, out var numericVal);

                        return Task.FromResult<LabResult?>(new LabResult
                        {
                            SourceType = (byte)LabResultSource.HL7,
                            RawMessage = hl7RawMessage,
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
            _logger.LogError(ex, "HL7 ORU parsing error");
        }
        return Task.FromResult<LabResult?>(null);
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
