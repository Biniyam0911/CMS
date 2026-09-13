using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Laboratory;

public class LabService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;

    public LabService(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    public async Task<List<LabTestCatalogDto>> GetTestCatalogAsync(byte tenantId)
    {
        var cacheKey = $"tenant:{tenantId}:lab:catalog";
        var cached = await _cache.GetAsync<List<LabTestCatalogDto>>(cacheKey);
        if (cached != null) return cached;

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT Id, TestCode, TestName, Category, SampleType, TurnaroundMinutes,
                   NormalRangeLow, NormalRangeHigh, Unit, Price
            FROM LabTestCatalog
            WHERE TenantId = @TenantId AND IsActive = 1
            ORDER BY Category, TestName";

        var catalog = (await conn.QueryAsync<LabTestCatalogDto>(sql, new { TenantId = tenantId })).ToList();
        await _cache.SetAsync(cacheKey, catalog, TimeSpan.FromHours(2));
        return catalog;
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
}
