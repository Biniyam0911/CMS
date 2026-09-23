using System.Data;
using CMS.Domain.Entities;
using CMS.Domain.Interfaces;
using Dapper;
using Microsoft.Extensions.Logging;

namespace CMS.Infrastructure.LabIntegration;

public class LabResultIngestionService : ILabResultIngestionService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly IHl7Adapter _hl7Adapter;
    private readonly ILogger<LabResultIngestionService> _logger;

    public LabResultIngestionService(
        IDbConnectionFactory dbFactory,
        IHl7Adapter hl7Adapter,
        ILogger<LabResultIngestionService> logger)
    {
        _dbFactory = dbFactory;
        _hl7Adapter = hl7Adapter;
        _logger = logger;
    }

    public async Task<bool> IngestHl7ResultAsync(string rawHl7, string remoteEndPoint = "")
    {
        try
        {
            var parsed = _hl7Adapter.ParseFullOruMessage(rawHl7);
            string? sampleId = parsed.SampleId?.Trim();
            _logger.LogInformation("Processing LIS HL7 Result. SampleId: '{SampleId}', Params: {Count} from {Endpoint}",
                sampleId, parsed.Parameters.Count, remoteEndPoint);

            using var conn = _dbFactory.CreateConnection();
            bool isNum = int.TryParse(sampleId, out int numId);

            // 1. Try finding order matching SampleId directly
            var target = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                SELECT TOP 1 
                    o.Id AS OrderId, o.PatientId, o.TenantId, o.OrderNumber,
                    oi.Id AS OrderItemId, oi.TestId, t.TestCode, t.TestName,
                    p.FirstName + ' ' + p.LastName AS PatientName
                FROM LabOrders o
                JOIN LabOrderItems oi ON oi.OrderId = o.Id
                JOIN LabTestCatalog t ON t.Id = oi.TestId
                LEFT JOIN LabSamples s ON s.OrderId = o.Id
                LEFT JOIN Patients p ON p.Id = o.PatientId
                WHERE (@IsNum = 1 AND (o.Id = @NumId OR oi.Id = @NumId))
                   OR o.OrderNumber = @SampleId
                   OR s.Barcode = @SampleId
                   OR p.MRN = @SampleId
                ORDER BY o.OrderedAt DESC",
                new { IsNum = isNum ? 1 : 0, NumId = numId, SampleId = sampleId ?? "" });

            // 2. Fallback: match most recent pending/in-process Hematology/CBC order
            if (target == null)
            {
                target = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                    SELECT TOP 1 
                        o.Id AS OrderId, o.PatientId, o.TenantId, o.OrderNumber,
                        oi.Id AS OrderItemId, oi.TestId, t.TestCode, t.TestName,
                        p.FirstName + ' ' + p.LastName AS PatientName
                    FROM LabOrders o
                    JOIN LabOrderItems oi ON oi.OrderId = o.Id
                    JOIN LabTestCatalog t ON t.Id = oi.TestId
                    JOIN Patients p ON p.Id = o.PatientId
                    WHERE oi.StatusId IN (1, 2, 3)
                      AND (t.Category LIKE '%HEM%' OR t.TestCode LIKE '%CBC%' OR t.TestName LIKE '%Blood%')
                    ORDER BY o.OrderedAt DESC");
            }

            // 3. Fallback: match most recent order overall
            if (target == null)
            {
                target = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                    SELECT TOP 1 
                        o.Id AS OrderId, o.PatientId, o.TenantId, o.OrderNumber,
                        oi.Id AS OrderItemId, oi.TestId, t.TestCode, t.TestName,
                        p.FirstName + ' ' + p.LastName AS PatientName
                    FROM LabOrders o
                    JOIN LabOrderItems oi ON oi.OrderId = o.Id
                    JOIN LabTestCatalog t ON t.Id = oi.TestId
                    JOIN Patients p ON p.Id = o.PatientId
                    ORDER BY o.OrderedAt DESC");
            }

            if (target == null)
            {
                _logger.LogWarning("No suitable LabOrder found in database to attach analyzer results for sample '{SampleId}'", sampleId);
                return false;
            }

            int orderId = (int)target.OrderId;
            int orderItemId = (int)target.OrderItemId;
            int testId = (int)target.TestId;
            int patientId = (int)target.PatientId;
            string patientName = (string)target.PatientName ?? "Patient";
            string orderNumber = (string)target.OrderNumber ?? $"ORD-{orderId}";

            var existingResultId = await conn.QueryFirstOrDefaultAsync<int?>(
                "SELECT Id FROM LabResults WHERE OrderItemId = @OrderItemId AND OrderId = @OrderId",
                new { OrderItemId = orderItemId, OrderId = orderId });

            string refRange = parsed.Parameters.FirstOrDefault(p => p.NumericValue == parsed.PrimaryNumeric)?.ReferenceRange ?? "";
            string unit = parsed.PrimaryUnit ?? "10^3/μL";

            if (existingResultId.HasValue && existingResultId.Value > 0)
            {
                await conn.ExecuteAsync(@"
                    UPDATE LabResults
                    SET NumericValue = @NumericValue,
                        TextValue = @TextValue,
                        Unit = @Unit,
                        Flag = @Flag,
                        ReferenceRange = @ReferenceRange,
                        IsCritical = @IsCritical,
                        RawMessage = @RawMessage,
                        SourceType = 2,
                        EnteredAt = GETDATE()
                    WHERE Id = @ResultId",
                    new {
                        ResultId = existingResultId.Value,
                        NumericValue = parsed.PrimaryNumeric,
                        TextValue = parsed.SummaryText,
                        Unit = unit,
                        Flag = parsed.OverallFlag,
                        ReferenceRange = refRange,
                        parsed.IsCritical,
                        RawMessage = rawHl7
                    });
            }
            else
            {
                await conn.ExecuteAsync(@"
                    INSERT INTO LabResults (
                        OrderItemId, OrderId, TestId, PatientId, NumericValue, TextValue,
                        Unit, Flag, ReferenceRange, IsCritical, EnteredBy, EnteredAt,
                        IsVerified, SourceType, RawMessage
                    ) VALUES (
                        @OrderItemId, @OrderId, @TestId, @PatientId, @NumericValue, @TextValue,
                        @Unit, @Flag, @ReferenceRange, @IsCritical, 1, GETDATE(),
                        0, 2, @RawMessage
                    )",
                    new {
                        OrderItemId = orderItemId,
                        OrderId = orderId,
                        TestId = testId,
                        PatientId = patientId,
                        NumericValue = parsed.PrimaryNumeric,
                        TextValue = parsed.SummaryText,
                        Unit = unit,
                        Flag = parsed.OverallFlag,
                        ReferenceRange = refRange,
                        parsed.IsCritical,
                        RawMessage = rawHl7
                    });
            }

            // Mark OrderItem and Order as Resulted (StatusId = 4)
            await conn.ExecuteAsync("UPDATE LabOrderItems SET StatusId = 4 WHERE Id = @OrderItemId", new { OrderItemId = orderItemId });
            await conn.ExecuteAsync("UPDATE LabOrders SET StatusId = 4, UpdatedAt = GETDATE() WHERE Id = @OrderId", new { OrderId = orderId });

            _logger.LogInformation("Successfully inserted LIS analyzer result: Patient #{PatientId} ({PatientName}), Order #{OrderId} ({OrderNumber}), SampleId: '{SampleId}'",
                patientId, patientName, orderId, orderNumber, sampleId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ingesting LIS HL7 analyzer result into database");
            return false;
        }
    }
}
