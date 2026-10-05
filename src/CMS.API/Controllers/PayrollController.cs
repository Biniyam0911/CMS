using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class PayrollController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public PayrollController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    // GET /api/v1/payroll/doctors
    [HttpGet("doctors")]
    public async Task<IActionResult> GetDoctors()
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT 
                d.Id AS DoctorId,
                u.Id AS UserId,
                ISNULL(u.FirstName + ' ' + u.LastName, ISNULL(st.FirstName + ' ' + st.LastName, u.Username)) AS DoctorName,
                ISNULL(sp.Name, ISNULL(st.Department, 'General Practice')) AS Specialty,
                d.LicenseNumber
            FROM Doctors d WITH (NOLOCK)
            JOIN Staff st WITH (NOLOCK) ON st.Id = d.StaffId
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = st.UserId
            LEFT JOIN Specializations sp WITH (NOLOCK) ON sp.Id = d.SpecializationId
            ORDER BY DoctorName";

        var doctors = await conn.QueryAsync<DoctorLookupDto>(sql);
        return Ok(ApiResponse<IEnumerable<DoctorLookupDto>>.Ok(doctors));
    }

    // GET /api/v1/payroll/categories
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        // Fetch distinct payroll-relevant categories and their services from the Services table
        var servicesSql = @"
            SELECT Id, Code, Name, Category, StandardFee AS Price
            FROM Services
            WHERE TenantId = @TenantId
              AND IsActive = 1
              AND Category IN ('Consultation', 'Procedure', 'Facial')
            ORDER BY Category, Name";

        var services = (await conn.QueryAsync<dynamic>(servicesSql, new { TenantId = tenantId })).ToList();

        var grouped = services
            .GroupBy(s => (string)s.Category)
            .Select(g => new
            {
                Category = g.Key,
                Services = g.Select(s => new { s.Id, s.Code, s.Name, s.Price }).ToList()
            })
            .OrderBy(g => g.Category)
            .ToList();

        var allCategories = new[] { "Consultation", "Procedure", "Facial" };
        var result = new List<object>();

        foreach (var cat in allCategories)
        {
            var match = grouped.FirstOrDefault(g => g.Category == cat);
            if (match != null)
            {
                result.Add(match);
            }
            else
            {
                result.Add(new
                {
                    Category = cat,
                    Services = new List<object>()
                });
            }
        }

        return Ok(ApiResponse<object>.Ok(result));
    }

    // GET /api/v1/payroll/services-by-category?category=Consultation
    [HttpGet("services-by-category")]
    public async Task<IActionResult> GetServicesByCategory([FromQuery] string category)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT Id, Code, Name, Category, StandardFee AS Price
            FROM Services
            WHERE TenantId = @TenantId
              AND IsActive = 1
              AND Category = @Category
            ORDER BY Name";

        var services = await conn.QueryAsync<dynamic>(sql, new { TenantId = tenantId, Category = category });
        return Ok(ApiResponse<object>.Ok(services));
    }

    // GET /api/v1/payroll/agreements?doctorId=124
    [HttpGet("agreements")]
    public async Task<IActionResult> GetAgreements([FromQuery] int? doctorId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT 
                pa.Id,
                pa.TenantId,
                pa.DoctorId,
                ISNULL(u.FirstName + ' ' + u.LastName, ISNULL(st.FirstName + ' ' + st.LastName, 'Dr. #' + CAST(pa.DoctorId AS NVARCHAR))) AS DoctorName,
                pa.Category,
                pa.RateType,   -- 1 = Percentage, 2 = Fixed Amount
                pa.Rate,
                pa.IsActive,
                pa.CreatedAt,
                pa.UpdatedAt
            FROM PayrollAgreements pa WITH (NOLOCK)
            JOIN Doctors d WITH (NOLOCK) ON d.Id = pa.DoctorId
            JOIN Staff st WITH (NOLOCK) ON st.Id = d.StaffId
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = st.UserId
            WHERE pa.TenantId = @TenantId
              AND (@DoctorId IS NULL OR pa.DoctorId = @DoctorId)
            ORDER BY DoctorName, pa.Category";

        var list = await conn.QueryAsync<dynamic>(sql, new { TenantId = tenantId, DoctorId = doctorId });
        return Ok(ApiResponse<object>.Ok(list));
    }

    // POST /api/v1/payroll/agreements
    [HttpPost("agreements")]
    public async Task<IActionResult> SaveAgreements([FromBody] SaveDoctorAgreementsRequest request)
    {
        if (request == null || request.Agreements == null || request.Agreements.Count == 0)
            return BadRequest(ApiResponse<string>.Fail("Agreements list is required."));

        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        // Determine which doctors to apply the agreements to
        List<int> doctorIds;
        if (request.ApplyToAllDoctors)
        {
            var allDoctors = await conn.QueryAsync<int>(@"
                SELECT d.Id FROM Doctors d
                JOIN Staff st ON st.Id = d.StaffId
                WHERE st.IsActive = 1");
            doctorIds = allDoctors.ToList();
        }
        else if (request.DoctorIds != null && request.DoctorIds.Count > 0)
        {
            doctorIds = request.DoctorIds;
        }
        else if (request.DoctorId > 0)
        {
            doctorIds = new List<int> { request.DoctorId };
        }
        else
        {
            return BadRequest(ApiResponse<string>.Fail("Either DoctorId, DoctorIds, or ApplyToAllDoctors=true is required."));
        }

        var upsertSql = @"
            MERGE INTO PayrollAgreements AS target
            USING (SELECT @TenantId AS TenantId, @DoctorId AS DoctorId, @Category AS Category) AS source
            ON (target.TenantId = source.TenantId AND target.DoctorId = source.DoctorId AND target.Category = source.Category)
            WHEN MATCHED THEN
                UPDATE SET 
                    RateType = @RateType,
                    Rate = @Rate,
                    IsActive = @IsActive,
                    UpdatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (TenantId, DoctorId, Category, RateType, Rate, IsActive, CreatedAt, UpdatedAt)
                VALUES (@TenantId, @DoctorId, @Category, @RateType, @Rate, @IsActive, GETDATE(), GETDATE());";

        int savedCount = 0;
        foreach (var docId in doctorIds)
        {
            foreach (var item in request.Agreements)
            {
                if (string.IsNullOrWhiteSpace(item.Category)) continue;

                await conn.ExecuteAsync(upsertSql, new
                {
                    TenantId = tenantId,
                    DoctorId = docId,
                    Category = item.Category.Trim(),
                    RateType = item.RateType == 2 ? (byte)2 : (byte)1,
                    Rate = item.Rate,
                    IsActive = item.IsActive
                });
                savedCount++;
            }
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            Message = $"Payroll agreements saved for {doctorIds.Count} doctor(s). {savedCount} rules applied.",
            DoctorIds = doctorIds,
            AppliedToAll = request.ApplyToAllDoctors
        }));
    }

    // DELETE /api/v1/payroll/agreements/{id}
    [HttpDelete("agreements/{id:int}")]
    public async Task<IActionResult> DeleteAgreement(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync(
            "DELETE FROM PayrollAgreements WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = id, TenantId = tenantId });

        return Ok(ApiResponse<object>.Ok(new { Message = "Agreement deleted." }));
    }

    // GET /api/v1/payroll/calculate?dateFrom=&dateTo=&doctorId=
    [HttpGet("calculate")]
    public async Task<IActionResult> CalculatePayroll(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] int? doctorId = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT 
                d.Id AS DoctorId,
                ISNULL(u.FirstName + ' ' + u.LastName, ISNULL(st.FirstName + ' ' + st.LastName, 'Dr. #' + CAST(d.Id AS NVARCHAR))) AS DoctorName,
                CAST(i.IssueDate AS DATE) AS ServiceDate,
                COALESCE(
                    NULLIF(s.Category, ''),
                    CASE 
                        WHEN ii.Description LIKE '%Consultation%' OR ii.ItemType = 1 THEN 'Consultation'
                        WHEN ii.Description LIKE '%FACIAL%' THEN 'Facial'
                        WHEN ii.Description LIKE '%PRP%' OR ii.Description LIKE '%Steroid%' OR ii.Description LIKE '%Biopsy%' OR ii.Description LIKE '%Cryo%' OR ii.ItemType = 4 THEN 'Procedure'
                        ELSE 'Procedure'
                    END
                ) AS Category,
                ii.Description AS ServiceName,
                ISNULL(ii.Total, 0) AS ServicePrice,
                ISNULL(p.FirstName + ' ' + ISNULL(p.LastName, ''), 'Patient #' + CAST(p.Id AS NVARCHAR)) AS PatientName,
                pa.RateType,
                pa.Rate,
                CASE WHEN pa.Id IS NOT NULL THEN 1 ELSE 0 END AS HasAgreement
            FROM Encounters e WITH (NOLOCK)
            JOIN Doctors d WITH (NOLOCK) ON d.Id = e.DoctorId
            JOIN Staff st WITH (NOLOCK) ON st.Id = d.StaffId
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = st.UserId
            JOIN Patients p WITH (NOLOCK) ON p.Id = e.PatientId
            JOIN Invoices i WITH (NOLOCK) ON (i.EncounterId = e.Id OR (i.EncounterId IS NULL AND i.PatientId = e.PatientId AND CAST(i.IssueDate AS DATE) = CAST(e.EncounterDate AS DATE)))
            JOIN InvoiceItems ii WITH (NOLOCK) ON ii.InvoiceId = i.Id
            LEFT JOIN Services s WITH (NOLOCK) ON s.Id = ii.RefId
            LEFT JOIN PayrollAgreements pa WITH (NOLOCK) ON pa.DoctorId = d.Id 
                AND pa.TenantId = @TenantId 
                AND pa.IsActive = 1
                AND pa.Category = COALESCE(
                    NULLIF(s.Category, ''),
                    CASE 
                        WHEN ii.Description LIKE '%Consultation%' OR ii.ItemType = 1 THEN 'Consultation'
                        WHEN ii.Description LIKE '%FACIAL%' THEN 'Facial'
                        ELSE 'Procedure'
                    END
                )
            WHERE e.TenantId = @TenantId
              AND ii.ItemType IN (1, 4)
              AND (@DoctorId IS NULL OR d.Id = @DoctorId)
              AND (@DateFrom IS NULL OR i.IssueDate >= @DateFrom)
              AND (@DateTo IS NULL OR i.IssueDate <= @DateTo)
            ORDER BY DoctorName, ServiceDate DESC, Category, ServiceName";

        var rows = await conn.QueryAsync<dynamic>(sql, new
        {
            TenantId = tenantId,
            DoctorId = doctorId,
            DateFrom = dateFrom?.Date,
            DateTo = dateTo?.Date
        });

        // Group into hierarchical structure: Doctor -> Date -> Category -> Services
        var doctorGroups = new List<PayrollDoctorGroupDto>();

        foreach (var docGroup in rows.GroupBy(r => (int)r.DoctorId))
        {
            var firstDoc = docGroup.First();
            int docId = (int)firstDoc.DoctorId;
            string docName = (string)firstDoc.DoctorName;

            var dateGroups = new List<PayrollDateGroupDto>();

            foreach (var dateGrp in docGroup.GroupBy(r => ((DateTime)r.ServiceDate).ToString("yyyy-MM-dd")))
            {
                string sDate = dateGrp.Key;
                var categoryGroups = new List<PayrollCategoryGroupDto>();

                foreach (var catGrp in dateGrp.GroupBy(r => (string)r.Category))
                {
                    string catName = catGrp.Key;
                    var services = new List<PayrollServiceItemDto>();

                    foreach (var row in catGrp)
                    {
                        decimal price = (decimal)row.ServicePrice;
                        byte? rateType = row.RateType != null ? (byte)row.RateType : null;
                        decimal? rate = row.Rate != null ? (decimal)row.Rate : null;
                        bool hasAgreement = (int)row.HasAgreement == 1;

                        decimal doctorShare = 0;
                        string rateDisplay = "No agreement (0%)";

                        if (hasAgreement && rate.HasValue)
                        {
                            if (rateType == 2) // Fixed amount
                            {
                                doctorShare = rate.Value;
                                rateDisplay = $"ETB {rate.Value:N2} (Fixed)";
                            }
                            else // Percentage
                            {
                                doctorShare = Math.Round((rate.Value / 100m) * price, 2);
                                rateDisplay = $"{rate.Value:G29}%";
                            }
                        }

                        services.Add(new PayrollServiceItemDto
                        {
                            ServiceName = (string)row.ServiceName,
                            RateType = rateType ?? 1,
                            Rate = rate ?? 0,
                            RateDisplay = rateDisplay,
                            ServicePrice = price,
                            PatientName = (string)row.PatientName,
                            DoctorShare = doctorShare,
                            HasAgreement = hasAgreement
                        });
                    }

                    categoryGroups.Add(new PayrollCategoryGroupDto
                    {
                        CategoryName = catName,
                        Services = services,
                        TotalCount = services.Count,
                        TotalPrice = services.Sum(s => s.ServicePrice),
                        TotalDoctorShare = services.Sum(s => s.DoctorShare)
                    });
                }

                dateGroups.Add(new PayrollDateGroupDto
                {
                    Date = sDate,
                    Categories = categoryGroups,
                    TotalCount = categoryGroups.Sum(c => c.TotalCount),
                    TotalPrice = categoryGroups.Sum(c => c.TotalPrice),
                    TotalDoctorShare = categoryGroups.Sum(c => c.TotalDoctorShare)
                });
            }

            doctorGroups.Add(new PayrollDoctorGroupDto
            {
                DoctorId = docId,
                DoctorName = docName,
                Dates = dateGroups,
                TotalCount = dateGroups.Sum(d => d.TotalCount),
                TotalPrice = dateGroups.Sum(d => d.TotalPrice),
                TotalDoctorShare = dateGroups.Sum(d => d.TotalDoctorShare)
            });
        }

        var result = new PayrollCalculationResponseDto
        {
            Doctors = doctorGroups,
            GrandTotalCount = doctorGroups.Sum(d => d.TotalCount),
            GrandTotalPrice = doctorGroups.Sum(d => d.TotalPrice),
            GrandTotalDoctorShare = doctorGroups.Sum(d => d.TotalDoctorShare)
        };

        return Ok(ApiResponse<PayrollCalculationResponseDto>.Ok(result));
    }
}

public class SaveDoctorAgreementsRequest
{
    /// <summary>Single doctor (legacy). Use DoctorIds for multi-select.</summary>
    public int DoctorId { get; set; }
    /// <summary>List of specific doctor IDs for multi-doctor agreement.</summary>
    public List<int>? DoctorIds { get; set; }
    /// <summary>When true, agreement applies to ALL active doctors ignoring DoctorId/DoctorIds.</summary>
    public bool ApplyToAllDoctors { get; set; } = false;
    public List<SavePayrollAgreementItemDto> Agreements { get; set; } = new();
}

public class SavePayrollAgreementItemDto
{
    public string Category { get; set; } = string.Empty;
    public byte RateType { get; set; } = 1; // 1 = Percentage, 2 = Fixed
    public decimal Rate { get; set; }
    public bool IsActive { get; set; } = true;
}

public class PayrollCalculationResponseDto
{
    public List<PayrollDoctorGroupDto> Doctors { get; set; } = new();
    public int GrandTotalCount { get; set; }
    public decimal GrandTotalPrice { get; set; }
    public decimal GrandTotalDoctorShare { get; set; }
}

public class PayrollDoctorGroupDto
{
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public List<PayrollDateGroupDto> Dates { get; set; } = new();
    public int TotalCount { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal TotalDoctorShare { get; set; }
}

public class PayrollDateGroupDto
{
    public string Date { get; set; } = string.Empty;
    public List<PayrollCategoryGroupDto> Categories { get; set; } = new();
    public int TotalCount { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal TotalDoctorShare { get; set; }
}

public class PayrollCategoryGroupDto
{
    public string CategoryName { get; set; } = string.Empty;
    public List<PayrollServiceItemDto> Services { get; set; } = new();
    public int TotalCount { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal TotalDoctorShare { get; set; }
}

public class PayrollServiceItemDto
{
    public string ServiceName { get; set; } = string.Empty;
    public byte RateType { get; set; }
    public decimal Rate { get; set; }
    public string RateDisplay { get; set; } = string.Empty;
    public decimal ServicePrice { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public decimal DoctorShare { get; set; }
    public bool HasAgreement { get; set; }
}

public class DoctorLookupDto
{
    public int DoctorId { get; set; }
    public int? UserId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public string? LicenseNumber { get; set; }
}
