using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Pharmacy;

public class PharmacyService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;

    public PharmacyService(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    public async Task<List<DrugFormularyDto>> GetFormularyAsync(byte tenantId)
    {
        var cacheKey = $"tenant:{tenantId}:pharmacy:formulary";
        var cached = await _cache.GetAsync<List<DrugFormularyDto>>(cacheKey);
        if (cached != null) return cached;

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT Id, TenantId, GenericName, BrandName, DrugClass, Form, Form AS DosageForm,
                   Strength, Unit, StockQuantity, StockQuantity AS CurrentStock, MinStockLevel,
                   CostPrice, SellingPrice, UnitPrice, BatchNumber, ExpiryDate, IsControlled, IsActive
            FROM DrugFormulary
            WHERE TenantId = @TenantId AND IsActive = 1
            ORDER BY GenericName";

        var drugs = (await conn.QueryAsync<DrugFormularyDto>(sql, new { TenantId = tenantId })).ToList();
        await _cache.SetAsync(cacheKey, drugs, TimeSpan.FromMinutes(15));
        return drugs;
    }

    public async Task<int> CreatePrescriptionAsync(CreatePrescriptionDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sqlHeader = @"
            INSERT INTO Prescriptions (TenantId, EncounterId, PatientId, DoctorId, StatusId)
            OUTPUT INSERTED.Id
            VALUES (@TenantId, @EncounterId, @PatientId, @DoctorId, 1);";

        var pId = await conn.ExecuteScalarAsync<int>(sqlHeader, dto);

        if (dto.Items != null && dto.Items.Count > 0)
        {
            var sqlItem = @"
                INSERT INTO PrescriptionItems (PrescriptionId, DrugId, Dosage, Frequency, Duration, Quantity, Instructions, StatusId)
                VALUES (@PrescriptionId, @DrugId, @Dosage, @Frequency, @Duration, @Quantity, @Instructions, 1);";

            foreach (var item in dto.Items)
            {
                await conn.ExecuteAsync(sqlItem, new {
                    PrescriptionId = pId, item.DrugId, item.Dosage, item.Frequency,
                    item.Duration, item.Quantity, item.Instructions
                });
            }
        }

        return pId;
    }

    public async Task RestockDrugAsync(byte tenantId, RestockDrugDto dto, int staffId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sqlUpdate = @"
            UPDATE DrugFormulary
            SET CurrentStock = CurrentStock + @QuantityAdded,
                CostPrice = @UnitCostPrice,
                SellingPrice = @UnitSellingPrice,
                BatchNumber = @BatchNumber,
                ExpiryDate = @ExpiryDate
            WHERE TenantId = @TenantId AND Id = @DrugId;";

        await conn.ExecuteAsync(sqlUpdate, new {
            dto.QuantityAdded, dto.UnitCostPrice, dto.UnitSellingPrice,
            dto.BatchNumber, dto.ExpiryDate, TenantId = tenantId, dto.DrugId
        });

        var sqlLog = @"
            INSERT INTO PharmacyRestockLogs (TenantId, DrugId, BatchNumber, QuantityAdded, UnitCostPrice, UnitSellingPrice, ExpiryDate, SupplierName, RestockedBy)
            VALUES (@TenantId, @DrugId, @BatchNumber, @QuantityAdded, @UnitCostPrice, @UnitSellingPrice, @ExpiryDate, @SupplierName, @RestockedBy);";

        await conn.ExecuteAsync(sqlLog, new {
            TenantId = tenantId, dto.DrugId, dto.BatchNumber, dto.QuantityAdded,
            dto.UnitCostPrice, dto.UnitSellingPrice, dto.ExpiryDate, dto.SupplierName, RestockedBy = staffId
        });

        // Invalidate Redis cache
        await _cache.RemoveAsync($"tenant:{tenantId}:pharmacy:formulary");
    }

    public async Task<List<PrescriptionDto>> GetPrescriptionsAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT pr.Id, pr.TenantId, pr.EncounterId, pr.PatientId,
                   p.FirstName + ' ' + p.LastName AS PatientName,
                   pr.DoctorId, u.FirstName + ' ' + u.LastName AS DoctorName,
                   pr.PrescribedAt, pr.StatusId
            FROM Prescriptions pr
            JOIN Patients p ON p.Id = pr.PatientId
            JOIN Doctors d ON d.Id = pr.DoctorId
            JOIN Staff s ON s.Id = d.StaffId
            JOIN Users u ON u.Id = s.UserId
            WHERE pr.TenantId = @TenantId
            ORDER BY pr.PrescribedAt DESC";

        var list = (await conn.QueryAsync<dynamic>(sql, new { TenantId = tenantId })).ToList();
        var result = new List<PrescriptionDto>();

        foreach (var p in list)
        {
            var itemsSql = @"
                SELECT pi.Id, pi.PrescriptionId, pi.DrugId, d.GenericName AS DrugName,
                       pi.Dosage, pi.Frequency, ISNULL(pi.Duration, '') AS Duration,
                       pi.Quantity, ISNULL(pi.Instructions, '') AS Instructions
                FROM PrescriptionItems pi
                JOIN DrugFormulary d ON d.Id = pi.DrugId
                WHERE pi.PrescriptionId = @PrescriptionId";
            var items = (await conn.QueryAsync<PrescriptionItemDto>(itemsSql, new { PrescriptionId = (int)p.Id })).ToList();

            result.Add(new PrescriptionDto(
                (int)p.Id, (byte)p.TenantId, (int)p.EncounterId, (int)p.PatientId,
                (string)p.PatientName, (int)p.DoctorId, (string)p.DoctorName,
                (DateTime)p.PrescribedAt, (byte)p.StatusId, items
            ));
        }

        return result;
    }

    public async Task DispenseDrugAsync(DispenseDrugDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE PrescriptionItems SET StatusId = 2 WHERE Id = @ItemId;
            UPDATE DrugFormulary SET StockQuantity = CASE WHEN StockQuantity >= pi.Quantity THEN StockQuantity - pi.Quantity ELSE 0 END
            FROM DrugFormulary d
            JOIN PrescriptionItems pi ON pi.DrugId = d.Id
            WHERE pi.Id = @ItemId;";

        await conn.ExecuteAsync(sql, new { dto.ItemId });
    }
}
