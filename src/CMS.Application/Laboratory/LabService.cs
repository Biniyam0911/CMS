using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Laboratory;

public class LabService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;
    private static bool _schemaEnsured = false;
    private static readonly SemaphoreSlim _schemaLock = new(1, 1);

    public LabService(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    public async Task EnsureSchemaAsync(System.Data.IDbConnection? externalConn = null)
    {
        if (_schemaEnsured) return;
        await _schemaLock.WaitAsync();
        try
        {
            if (_schemaEnsured) return;
            using var localConn = externalConn == null ? _dbFactory.CreateConnection() : null;
            var conn = externalConn ?? localConn!;
            var sqlCheck = @"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestCatalog') AND name = 'HasGenderRanges')
                BEGIN
                    ALTER TABLE LabTestCatalog ADD HasGenderRanges BIT NOT NULL CONSTRAINT DF_LabTestCatalog_HasGenderRanges DEFAULT 0;
                END
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestCatalog') AND name = 'MaleNormalRangeLow')
                    ALTER TABLE LabTestCatalog ADD MaleNormalRangeLow DECIMAL(18,4) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestCatalog') AND name = 'MaleNormalRangeHigh')
                    ALTER TABLE LabTestCatalog ADD MaleNormalRangeHigh DECIMAL(18,4) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestCatalog') AND name = 'FemaleNormalRangeLow')
                    ALTER TABLE LabTestCatalog ADD FemaleNormalRangeLow DECIMAL(18,4) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestCatalog') AND name = 'FemaleNormalRangeHigh')
                    ALTER TABLE LabTestCatalog ADD FemaleNormalRangeHigh DECIMAL(18,4) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestCatalog') AND name = 'MaleTextReferenceRange')
                    ALTER TABLE LabTestCatalog ADD MaleTextReferenceRange NVARCHAR(500) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestCatalog') AND name = 'FemaleTextReferenceRange')
                    ALTER TABLE LabTestCatalog ADD FemaleTextReferenceRange NVARCHAR(500) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestParameters') AND name = 'HasGenderRanges')
                BEGIN
                    ALTER TABLE LabTestParameters ADD HasGenderRanges BIT NOT NULL CONSTRAINT DF_LabTestParameters_HasGenderRanges DEFAULT 0;
                END
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestParameters') AND name = 'MaleReferenceLow')
                    ALTER TABLE LabTestParameters ADD MaleReferenceLow DECIMAL(18,4) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestParameters') AND name = 'MaleReferenceHigh')
                    ALTER TABLE LabTestParameters ADD MaleReferenceHigh DECIMAL(18,4) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestParameters') AND name = 'FemaleReferenceLow')
                    ALTER TABLE LabTestParameters ADD FemaleReferenceLow DECIMAL(18,4) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestParameters') AND name = 'FemaleReferenceHigh')
                    ALTER TABLE LabTestParameters ADD FemaleReferenceHigh DECIMAL(18,4) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestParameters') AND name = 'MaleTextReferenceRange')
                    ALTER TABLE LabTestParameters ADD MaleTextReferenceRange NVARCHAR(500) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LabTestParameters') AND name = 'FemaleTextReferenceRange')
                    ALTER TABLE LabTestParameters ADD FemaleTextReferenceRange NVARCHAR(500) NULL;";
            await conn.ExecuteAsync(sqlCheck);
            _schemaEnsured = true;
        }
        catch
        {
            // If DDL fails due to permissions, catch and allow resilient fallback queries
        }
        finally
        {
            _schemaLock.Release();
        }
    }

    public async Task<List<LabTestCatalogDto>> GetTestCatalogAsync(byte tenantId)
    {
        var cacheKey = $"tenant:{tenantId}:lab:catalog";
        var cached = await _cache.GetAsync<List<LabTestCatalogDto>>(cacheKey);
        if (cached != null) return cached;

        using var conn = _dbFactory.CreateConnection();
        await EnsureSchemaAsync(conn);

        List<LabTestCatalogDto> catalog;
        try
        {
            var sql = @"
                SELECT Id, TestCode, TestName, Category, SampleType, TurnaroundMinutes,
                       NormalRangeLow, NormalRangeHigh, Unit, Price, DisplayOrder, TextReferenceRange,
                       HasGenderRanges, MaleNormalRangeLow, MaleNormalRangeHigh,
                       FemaleNormalRangeLow, FemaleNormalRangeHigh,
                       MaleTextReferenceRange, FemaleTextReferenceRange
                FROM LabTestCatalog
                WHERE TenantId = @TenantId AND IsActive = 1
                ORDER BY DisplayOrder ASC, Category ASC, TestName ASC";

            catalog = (await conn.QueryAsync<LabTestCatalogDto>(sql, new { TenantId = tenantId })).ToList();
        }
        catch
        {
            var fallbackSql = @"
                SELECT Id, TestCode, TestName, Category, SampleType, TurnaroundMinutes,
                       NormalRangeLow, NormalRangeHigh, Unit, Price, DisplayOrder, TextReferenceRange
                FROM LabTestCatalog
                WHERE TenantId = @TenantId AND IsActive = 1
                ORDER BY DisplayOrder ASC, Category ASC, TestName ASC";

            catalog = (await conn.QueryAsync<LabTestCatalogDto>(fallbackSql, new { TenantId = tenantId })).ToList();
        }

        List<LabTestParameterDto> allParams;
        try
        {
            var sqlParams = @"
                SELECT p.Id, p.TestCatalogId, p.ParameterCode, p.ParameterName, p.Unit,
                       p.ReferenceLow, p.ReferenceHigh, p.TextReferenceRange, p.DisplayOrder,
                       p.HasGenderRanges, p.MaleReferenceLow, p.MaleReferenceHigh,
                       p.FemaleReferenceLow, p.FemaleReferenceHigh,
                       p.MaleTextReferenceRange, p.FemaleTextReferenceRange
                FROM LabTestParameters p
                JOIN LabTestCatalog c ON c.Id = p.TestCatalogId
                WHERE c.TenantId = @TenantId AND c.IsActive = 1
                ORDER BY p.DisplayOrder, p.Id";

            allParams = (await conn.QueryAsync<LabTestParameterDto>(sqlParams, new { TenantId = tenantId })).ToList();
        }
        catch
        {
            var fallbackParams = @"
                SELECT p.Id, p.TestCatalogId, p.ParameterCode, p.ParameterName, p.Unit,
                       p.ReferenceLow, p.ReferenceHigh, p.TextReferenceRange, p.DisplayOrder
                FROM LabTestParameters p
                JOIN LabTestCatalog c ON c.Id = p.TestCatalogId
                WHERE c.TenantId = @TenantId AND c.IsActive = 1
                ORDER BY p.DisplayOrder, p.Id";

            allParams = (await conn.QueryAsync<LabTestParameterDto>(fallbackParams, new { TenantId = tenantId })).ToList();
        }

        var paramLookup = allParams.GroupBy(p => p.TestCatalogId).ToDictionary(g => g.Key, g => g.ToList());

        var result = catalog.Select(c => c with {
            Parameters = paramLookup.TryGetValue(c.Id, out var plist) ? plist : new List<LabTestParameterDto>()
        }).ToList();

        await _cache.SetAsync(cacheKey, result, TimeSpan.FromHours(2));
        return result;
    }

    public async Task<int> CreateLabOrderAsync(CreateLabOrderDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@TenantId", dto.TenantId);
        p.Add("@PatientId", dto.PatientId);
        p.Add("@EncounterId", dto.EncounterId);
        p.Add("@OrderedBy", dto.OrderedBy);
        p.Add("@Priority", dto.Priority);
        p.Add("@ClinicalInfo", dto.ClinicalInfo);
        p.Add("@TestIds", string.Join(",", dto.TestIds));
        p.Add("@NewOrderId", dbType: System.Data.DbType.Int32, direction: System.Data.ParameterDirection.Output);

        await conn.ExecuteAsync("sp_CreateLabOrder", p, commandType: System.Data.CommandType.StoredProcedure);
        int newOrderId = p.Get<int>("@NewOrderId");

        try
        {
            var isStat = dto.Priority == 1;
            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, @Subject, @Body, @Priority, 'CriticalLabResult', 'LabTechnician,Doctor,Admin', @RefId, 1, GETDATE())",
                new {
                    dto.TenantId,
                    Subject = isStat ? $"STAT Lab Order: #{newOrderId}" : $"New Lab Order: #{newOrderId}",
                    Body = $"Diagnostic lab order #{newOrderId} for patient #{dto.PatientId} ({dto.ClinicalInfo ?? "Laboratory Panel"}). Awaiting phlebotomy/specimen collection.",
                    Priority = isStat ? 1 : 2,
                    RefId = newOrderId
                });
        }
        catch { /* non-blocking notification */ }

        return newOrderId;
    }

    public async Task<int> CollectSampleAsync(int orderId, string barcode, string sampleType, int collectedBy)
    {
        using var conn = _dbFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@OrderId", orderId);
        p.Add("@Barcode", barcode);
        p.Add("@SampleType", sampleType);
        p.Add("@CollectedBy", collectedBy);
        p.Add("@NewSampleId", dbType: System.Data.DbType.Int32, direction: System.Data.ParameterDirection.Output);

        await conn.ExecuteAsync("sp_CollectLabSample", p, commandType: System.Data.CommandType.StoredProcedure);
        return p.Get<int>("@NewSampleId");
    }

    public async Task VerifyResultAsync(int resultId, int verifiedBy)
    {
        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("sp_VerifyLabResult", new { ResultId = resultId, VerifiedBy = verifiedBy }, commandType: System.Data.CommandType.StoredProcedure);
    }

    public async Task<bool> ReverseVerificationAsync(int orderId, int userId)
    {
        using var conn = _dbFactory.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            // Reset verification flag, verifier and timestamp
            await conn.ExecuteAsync(@"
                UPDATE LabResults
                SET IsVerified = 0,
                    VerifiedBy = NULL,
                    VerifiedAt = NULL
                WHERE OrderId = @OrderId",
                new { OrderId = orderId }, transaction: tx);

            // Revert order items to Resulted (4) if results exist, otherwise InProcess (3)
            await conn.ExecuteAsync(@"
                UPDATE LabOrderItems
                SET StatusId = CASE
                    WHEN EXISTS (SELECT 1 FROM LabResults r WHERE r.OrderItemId = LabOrderItems.Id) THEN 4
                    ELSE 3
                END
                WHERE OrderId = @OrderId",
                new { OrderId = orderId }, transaction: tx);

            // Revert overall order to Resulted (4)
            await conn.ExecuteAsync(@"
                UPDATE LabOrders
                SET StatusId = 4,
                    UpdatedAt = GETDATE()
                WHERE Id = @OrderId",
                new { OrderId = orderId }, transaction: tx);

            // Fetch info for notification
            var patInfo = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                SELECT o.OrderNumber, o.TenantId, p.FirstName + ' ' + p.LastName AS PatientName
                FROM LabOrders o
                JOIN Patients p ON p.Id = o.PatientId
                WHERE o.Id = @OrderId",
                new { OrderId = orderId }, transaction: tx);

            if (patInfo != null)
            {
                string orderNo = patInfo.OrderNumber ?? $"LAB-{orderId}";
                string patName = patInfo.PatientName ?? "Patient";
                byte tenantId = (byte)patInfo.TenantId;

                await conn.ExecuteAsync(@"
                    INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                    VALUES (@TenantId, NULL, 3, @Subject, @Body, 2, 'LabVerificationReversed', 'Doctor,Nurse,LabTechnician,Admin', @RefId, 1, GETDATE())",
                    new {
                        TenantId = tenantId,
                        Subject = $"Lab Verification Reversed: {orderNo}",
                        Body = $"Verification for {patName} ({orderNo}) was reversed by laboratory personnel. Order returned to active worklist.",
                        RefId = orderId
                    }, transaction: tx);
            }

            tx.Commit();
            return true;
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }
}
