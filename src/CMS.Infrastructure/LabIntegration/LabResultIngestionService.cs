using System.Data;
using CMS.Domain.Entities;
using CMS.Domain.Interfaces;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CMS.Infrastructure.LabIntegration;

public class LabResultIngestionService : ILabResultIngestionService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly IHl7Adapter _hl7Adapter;
    private readonly ILogger<LabResultIngestionService> _logger;
    private readonly IConfiguration _config;

    public LabResultIngestionService(
        IDbConnectionFactory dbFactory,
        IHl7Adapter hl7Adapter,
        ILogger<LabResultIngestionService> logger,
        IConfiguration config)
    {
        _dbFactory = dbFactory;
        _hl7Adapter = hl7Adapter;
        _logger = logger;
        _config = config;
    }

    private int ResolveTenantId(IDbConnection conn, string remoteEndPoint, int? explicitTenantId = null)
    {
        if (explicitTenantId.HasValue && explicitTenantId.Value > 0)
            return explicitTenantId.Value;

        if (!string.IsNullOrEmpty(remoteEndPoint))
        {
            if (int.TryParse(remoteEndPoint, out int portOnly))
            {
                var portTenant = _config?.GetValue<int?>($"Lis:TenantMapping:{portOnly}") ?? _config?.GetValue<int?>($"Lis:PortTenantMapping:{portOnly}");
                if (portTenant.HasValue && portTenant.Value > 0) return portTenant.Value;
            }
            else if (remoteEndPoint.Contains(':'))
            {
                var parts = remoteEndPoint.Split(':');
                if (parts.Length > 1 && int.TryParse(parts[1], out int port))
                {
                    var portTenant = _config?.GetValue<int?>($"Lis:TenantMapping:{port}") ?? _config?.GetValue<int?>($"Lis:PortTenantMapping:{port}");
                    if (portTenant.HasValue && portTenant.Value > 0) return portTenant.Value;
                }
            }
        }

        var configTenant = _config?.GetValue<int?>("Lis:TenantId") ?? _config?.GetValue<int?>("TenantId");
        if (configTenant.HasValue && configTenant.Value > 0)
            return configTenant.Value;

        try
        {
            var dbTenant = conn.QueryFirstOrDefault<int?>("SELECT TOP 1 Id FROM Tenants WHERE IsActive = 1 ORDER BY Id");
            if (dbTenant.HasValue && dbTenant.Value > 0)
                return dbTenant.Value;
        }
        catch
        {
            // fallback
        }

        return 1;
    }

    public async Task<bool> IngestHl7ResultAsync(string rawHl7, string remoteEndPoint = "", int? tenantId = null)
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

            // 2. Unrecognized sample/barcode: Quarantine into UnassignedLabResults instead of misassigning
            if (target == null)
            {
                _logger.LogWarning("No matching LabOrder found for specimen barcode/sample '{SampleId}'. Quarantining result.", sampleId);

                try
                {
                    int resolvedTenantId = ResolveTenantId(conn, remoteEndPoint, tenantId);

                    await conn.ExecuteAsync(@"
                        INSERT INTO UnassignedLabResults (
                            TenantId, SampleId, RemoteEndPoint, RawMessage, PrimaryNumeric, SummaryText, Flag, IsCritical, ReceivedAt, Status
                        ) VALUES (
                            @TenantId, @SampleId, @RemoteEndPoint, @RawMessage, @PrimaryNumeric, @SummaryText, @Flag, @IsCritical, GETDATE(), 'PendingReview'
                        )",
                        new {
                            TenantId = resolvedTenantId,
                            SampleId = sampleId ?? "UNKNOWN",
                            RemoteEndPoint = remoteEndPoint ?? "",
                            RawMessage = rawHl7,
                            PrimaryNumeric = parsed.PrimaryNumeric,
                            SummaryText = parsed.SummaryText ?? "",
                            Flag = parsed.OverallFlag ?? "Normal",
                            parsed.IsCritical
                        });

                    await conn.ExecuteAsync(@"
                        INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                        VALUES (@TenantId, NULL, 3, @Subject, @Body, 1, 'UnassignedLabResult', 'LabTechnician,Admin', NULL, 1, GETDATE())",
                        new {
                            TenantId = resolvedTenantId,
                            Subject = $"LIS Quarantine: Unrecognized Sample '{sampleId}'",
                            Body = $"Analyzer at {remoteEndPoint} transmitted lab results for sample/barcode '{sampleId}', but no matching order exists. Quarantined in UnassignedLabResults."
                        });

                    return true;
                }
                catch (Exception qEx)
                {
                    _logger.LogError(qEx, "Failed to quarantine unassigned lab result");
                    return false;
                }
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
            string safeUnit = "";
            string safeFlag = string.IsNullOrWhiteSpace(parsed.OverallFlag) ? "Normal" : (parsed.OverallFlag.Length > 20 ? parsed.OverallFlag[..20] : parsed.OverallFlag);
            string safeRefRange = string.IsNullOrWhiteSpace(refRange) ? "" : (refRange.Length > 100 ? refRange[..100] : refRange);
            string safeTextValue = parsed.SummaryText ?? "";

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
                        TextValue = safeTextValue,
                        Unit = safeUnit,
                        Flag = safeFlag,
                        ReferenceRange = safeRefRange,
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
                        TextValue = safeTextValue,
                        Unit = safeUnit,
                        Flag = safeFlag,
                        ReferenceRange = safeRefRange,
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
