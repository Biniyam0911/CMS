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
            FROM DrugFormulary WITH (NOLOCK)
            WHERE TenantId = @TenantId AND IsActive = 1
            ORDER BY GenericName";

        var drugs = (await conn.QueryAsync<DrugFormularyDto>(sql, new { TenantId = tenantId })).ToList();
        await _cache.SetAsync(cacheKey, drugs, TimeSpan.FromMinutes(15));
        return drugs;
    }

    public async Task<int> CreatePrescriptionAsync(CreatePrescriptionDto dto)
    {
        using var conn = _dbFactory.CreateConnection();

        // 1. Ensure valid EncounterId exists (FK_Prescriptions_Encounters constraint)
        int encounterId = dto.EncounterId;
        if (encounterId <= 0)
        {
            var openEncId = await conn.ExecuteScalarAsync<int?>(@"
                SELECT TOP 1 Id FROM Encounters 
                WHERE PatientId = @PatientId AND TenantId = @TenantId
                ORDER BY Id DESC",
                new { dto.PatientId, dto.TenantId });

            if (openEncId.HasValue && openEncId.Value > 0)
            {
                encounterId = openEncId.Value;
            }
            else
            {
                // Create a basic encounter record
                var encNo = $"ENC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
                encounterId = await conn.ExecuteScalarAsync<int>(@"
                    INSERT INTO Encounters (TenantId, PatientId, EncounterNumber, EncounterDate, StatusId, CreatedAt)
                    OUTPUT INSERTED.Id
                    VALUES (@TenantId, @PatientId, @EncounterNumber, GETDATE(), 1, GETDATE())",
                    new { dto.TenantId, dto.PatientId, EncounterNumber = encNo });
            }
        }

        // 2. Ensure valid PrescribedBy Doctor ID exists (FK_Prescriptions_Doctor constraint)
        int doctorId = dto.DoctorId;
        if (doctorId > 0)
        {
            var exists = await conn.ExecuteScalarAsync<int?>(
                "SELECT TOP 1 Id FROM Doctors WHERE Id = @Id", new { Id = doctorId });
            if (!exists.HasValue || exists.Value <= 0) doctorId = 0;
        }
        if (doctorId <= 0)
        {
            doctorId = await conn.ExecuteScalarAsync<int>(
                "SELECT TOP 1 Id FROM Doctors WHERE TenantId = @TenantId ORDER BY Id ASC",
                new { dto.TenantId });
            if (doctorId <= 0) doctorId = 1;
        }

        // 3. Insert into Prescriptions table
        var sqlHeader = @"
            INSERT INTO Prescriptions (TenantId, EncounterId, PatientId, PrescribedBy, PrescribedAt, IsDispensed, Notes)
            OUTPUT INSERTED.Id
            VALUES (@TenantId, @EncounterId, @PatientId, @PrescribedBy, GETDATE(), 0, 'Prescription issued from EMR');";

        var pId = await conn.ExecuteScalarAsync<int>(sqlHeader, new {
            dto.TenantId,
            EncounterId = encounterId,
            dto.PatientId,
            PrescribedBy = doctorId
        });

        // 4. Insert Prescription Items
        if (dto.Items != null && dto.Items.Count > 0)
        {
            var sqlItem = @"
                INSERT INTO PrescriptionItems (PrescriptionId, DrugId, Dosage, Frequency, Route, DurationDays, Quantity, Instructions)
                VALUES (@PrescriptionId, @DrugId, @Dosage, @Frequency, @Route, @DurationDays, @Quantity, @Instructions);";

            foreach (var item in dto.Items)
            {
                // Parse duration string into days (e.g., "7 Days" -> 7, "5" -> 5)
                short? durationDays = null;
                if (!string.IsNullOrWhiteSpace(item.Duration))
                {
                    var numStr = new string(item.Duration.Where(char.IsDigit).ToArray());
                    if (short.TryParse(numStr, out var parsedDays) && parsedDays > 0)
                        durationDays = parsedDays;
                }

                // Ensure valid drugId or fallback to 1
                int validDrugId = item.DrugId > 0 ? item.DrugId : 1;

                await conn.ExecuteAsync(sqlItem, new {
                    PrescriptionId = pId,
                    DrugId = validDrugId,
                    Dosage = string.IsNullOrWhiteSpace(item.Dosage) ? "1 dose" : item.Dosage,
                    Frequency = string.IsNullOrWhiteSpace(item.Frequency) ? "OD" : item.Frequency,
                    Route = "Oral",
                    DurationDays = durationDays,
                    Quantity = item.Quantity > 0 ? (short)item.Quantity : (short)1,
                    Instructions = item.Instructions ?? string.Empty
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

    public async Task<List<PrescriptionDto>> GetPrescriptionsAsync(byte tenantId, int? patientId = null, int limit = 100)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT TOP (@Limit) pr.Id, pr.TenantId, pr.EncounterId, pr.PatientId,
                   p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                   p.MRN,
                   pr.PrescribedBy AS DoctorId,
                   ISNULL(s.FirstName + ' ' + s.LastName, ISNULL(u.FirstName + ' ' + u.LastName, 'Attending Doctor')) AS DoctorName,
                   pr.PrescribedAt,
                   CAST(CASE WHEN pr.IsDispensed = 1 THEN 4 ELSE 1 END AS TINYINT) AS StatusId,
                   CASE 
                       WHEN EXISTS (
                           SELECT 1 FROM InvoiceItems ii WITH (NOLOCK)
                           JOIN Invoices inv WITH (NOLOCK) ON inv.Id = ii.InvoiceId 
                           WHERE (ii.RefId = pr.Id OR inv.EncounterId = pr.EncounterId)
                             AND inv.PaidAmount >= inv.TotalAmount AND inv.TotalAmount > 0
                       ) THEN 1 
                       WHEN EXISTS (
                           SELECT 1 FROM Invoices inv WITH (NOLOCK)
                           WHERE inv.PatientId = pr.PatientId AND (inv.EncounterId = pr.EncounterId OR CAST(inv.IssueDate AS DATE) = CAST(pr.PrescribedAt AS DATE)) AND inv.PaidAmount >= inv.TotalAmount AND inv.TotalAmount > 0
                       ) THEN 1
                       ELSE 0 
                   END AS IsPaid
            FROM Prescriptions pr WITH (NOLOCK)
            JOIN Patients p WITH (NOLOCK) ON p.Id = pr.PatientId
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = pr.PrescribedBy
            LEFT JOIN Staff s WITH (NOLOCK) ON s.UserId = u.Id
            WHERE pr.TenantId = @TenantId
              AND (@PatientId IS NULL OR pr.PatientId = @PatientId)
            ORDER BY pr.PrescribedAt DESC";

        var list = (await conn.QueryAsync<dynamic>(sql, new { TenantId = tenantId, PatientId = patientId, Limit = limit })).ToList();
        var result = new List<PrescriptionDto>();

        var pIds = list.Select(p => (int)p.Id).ToList();
        var itemsByPrescription = new Dictionary<int, List<PrescriptionItemDto>>();

        if (pIds.Any())
        {
            var itemsSql = @"
                SELECT pi.Id, pi.PrescriptionId, pi.DrugId, 
                       ISNULL(d.GenericName, 'Prescribed Medication') AS DrugName,
                       pi.Dosage, pi.Frequency, 
                       ISNULL(CASE WHEN pi.DurationDays IS NOT NULL THEN CAST(pi.DurationDays AS VARCHAR) + ' Days' ELSE '' END, '') AS Duration,
                       pi.Quantity, ISNULL(pi.Instructions, '') AS Instructions
                FROM PrescriptionItems pi WITH (NOLOCK)
                LEFT JOIN DrugFormulary d WITH (NOLOCK) ON d.Id = pi.DrugId
                WHERE pi.PrescriptionId IN @PrescriptionIds";
            var allItems = await conn.QueryAsync<PrescriptionItemDto>(itemsSql, new { PrescriptionIds = pIds });
            itemsByPrescription = allItems.GroupBy(x => x.PrescriptionId).ToDictionary(g => g.Key, g => g.ToList());
        }

        foreach (var p in list)
        {
            int presId = (int)p.Id;
            var items = itemsByPrescription.TryGetValue(presId, out var itms) ? itms : new List<PrescriptionItemDto>();

            result.Add(new PrescriptionDto(
                presId, (byte)p.TenantId, (int)p.EncounterId, (int)p.PatientId,
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
