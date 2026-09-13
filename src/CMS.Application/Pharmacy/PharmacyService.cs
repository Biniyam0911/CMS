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

        try
        {
            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, 'New Prescription Issued', 'Prescription #' + CAST(@PrescriptionId AS VARCHAR) + ' issued for patient #' + CAST(@PatientId AS VARCHAR) + '. Ready for pharmacy fulfillment.', 2, 'NewPrescription', 'Pharmacist,Doctor,Admin', @PrescriptionId, 1, GETDATE())",
                new { dto.TenantId, PrescriptionId = pId, dto.PatientId });
        }
        catch { /* non-blocking notification */ }

        return pId;
    }

    public async Task RestockDrugAsync(byte tenantId, RestockDrugDto dto, int staffId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sqlUpdate = @"
            UPDATE DrugFormulary
            SET StockQuantity = StockQuantity + @QuantityAdded,
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
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN,
                   pr.PrescribedBy AS DoctorId,
                   ISNULL(s.FirstName + ' ' + s.LastName, ISNULL(u.FirstName + ' ' + u.LastName, 'Attending Doctor')) AS DoctorName,
                   pr.PrescribedAt,
                   CAST(CASE WHEN pr.IsDispensed = 1 THEN 4 ELSE 1 END AS TINYINT) AS StatusId,
                   CASE 
                       WHEN EXISTS (
                           SELECT 1 FROM InvoiceItems ii 
                           JOIN Invoices inv ON inv.Id = ii.InvoiceId 
                           WHERE (ii.RefId = pr.Id OR inv.EncounterId = pr.EncounterId)
                             AND inv.PaidAmount >= inv.TotalAmount AND inv.TotalAmount > 0
                       ) THEN 1 
                       WHEN EXISTS (
                           SELECT 1 FROM Invoices inv
                           WHERE inv.PatientId = pr.PatientId AND (inv.EncounterId = pr.EncounterId OR CAST(inv.IssueDate AS DATE) = CAST(pr.PrescribedAt AS DATE)) AND inv.PaidAmount >= inv.TotalAmount AND inv.TotalAmount > 0
                       ) THEN 1
                       ELSE 0 
                   END AS IsPaid
            FROM Prescriptions pr
            JOIN Patients p ON p.Id = pr.PatientId
            LEFT JOIN Users u ON u.Id = pr.PrescribedBy
            LEFT JOIN Staff s ON s.UserId = u.Id
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
                (string)p.PatientName, (int)(p.DoctorId ?? 1), (string)(p.DoctorName ?? "Attending Doctor"),
                (DateTime)p.PrescribedAt, (byte)p.StatusId, items,
                (int)p.IsPaid == 1, (string?)p.MRN
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

        try
        {
            var lowStock = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                SELECT TOP 1 d.GenericName, d.StockQuantity, d.MinStockLevel
                FROM DrugFormulary d
                JOIN PrescriptionItems pi ON pi.DrugId = d.Id
                WHERE pi.Id = @ItemId AND d.StockQuantity <= d.MinStockLevel",
                new { dto.ItemId });

            if (lowStock != null)
            {
                await conn.ExecuteAsync(@"
                    INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, StatusId, CreatedAt)
                    VALUES (1, NULL, 3, 'Formulary Drug Low Stock: ' + @GenericName, 'Medication ' + @GenericName + ' stock is low (' + CAST(@StockQuantity AS VARCHAR) + ' units remaining). Reorder recommended.', 2, 'MedicationLowStock', 'Pharmacist,Admin', 1, GETDATE())",
                    new { GenericName = (string)lowStock.GenericName, StockQuantity = (int)lowStock.StockQuantity });
            }
        }
        catch { /* non-blocking notification */ }
    }
}
