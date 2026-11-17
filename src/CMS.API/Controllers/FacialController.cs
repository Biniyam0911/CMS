using System.Diagnostics;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class FacialController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public FacialController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    /// <summary>
    /// Fetch all active services under 'Facial' category
    /// </summary>
    [HttpGet("services")]
    public async Task<IActionResult> GetFacialServices()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT Id, Code, Name, Price, Department, Description 
            FROM dbo.Services WITH (NOLOCK) 
            WHERE TenantId = @TenantId AND Category = 'Facial' AND IsActive = 1 
            ORDER BY Name ASC";

        var services = (await conn.QueryAsync<dynamic>(sql, new { TenantId = tenantId })).ToList();
        return Ok(ApiResponse<dynamic>.Ok(services));
    }

    /// <summary>
    /// Get paginated and filtered list of Facial registrations
    /// </summary>
    [HttpGet("registrations")]
    public async Task<IActionResult> GetRegistrations(
        [FromQuery] string? search = null,
        [FromQuery] bool? isPlc = null,
        [FromQuery] bool? isOther = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int? doctorId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] int? limit = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        int effectivePageSize = limit.HasValue && limit.Value > 0 ? limit.Value : Math.Clamp(pageSize, 1, 500);
        int effectivePage = Math.Max(1, page);
        int offset = (effectivePage - 1) * effectivePageSize;

        using var conn = _dbFactory.CreateConnection();

        var whereClause = @"
            FROM dbo.FacialRegistrations WITH (NOLOCK)
            WHERE TenantId = @TenantId
              AND (@IsPlc IS NULL OR IsPlc = @IsPlc)
              AND (@IsOther IS NULL OR IsOther = @IsOther)
              AND (@DoctorId IS NULL OR DoctorId = @DoctorId)
              AND (@FromDate IS NULL OR RegistrationDate >= CAST(@FromDate AS DATE))
              AND (@ToDate IS NULL OR RegistrationDate <= CAST(@ToDate AS DATE))
              AND (
                  @Search IS NULL
                  OR FirstName LIKE '%' + @Search + '%'
                  OR MiddleName LIKE '%' + @Search + '%'
                  OR LastName LIKE '%' + @Search + '%'
                  OR FullName LIKE '%' + @Search + '%'
                  OR Mobile LIKE '%' + @Search + '%'
                  OR ProcedureType LIKE '%' + @Search + '%'
                  OR RegistrationNumber LIKE '%' + @Search + '%'
                  OR DoctorName LIKE '%' + @Search + '%'
              )";

        var countSql = "SELECT COUNT(1) " + whereClause;
        var dataSql = @"
            SELECT Id, TenantId, RegistrationNumber, FirstName, MiddleName, LastName, FullName,
                   Age, Gender, Mobile, ServiceId, ProcedureType, Quantity, UnitPrice, Discount,
                   TotalPrice, DoctorId, DoctorName, IsPlc, IsOther, Notes, Status,
                   RegistrationDate, RegistrationTime, CreatedAt " + whereClause + @"
            ORDER BY RegistrationDate DESC, Id DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        var sqlParams = new
        {
            TenantId = tenantId,
            IsPlc = isPlc,
            IsOther = isOther,
            DoctorId = doctorId,
            FromDate = fromDate,
            ToDate = toDate,
            Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            Offset = offset,
            PageSize = effectivePageSize
        };

        int total = await conn.ExecuteScalarAsync<int>(countSql, sqlParams);
        var rows = (await conn.QueryAsync<FacialRegistrationDto>(dataSql, sqlParams)).ToList();

        var meta = new PaginationMeta(total, effectivePage, effectivePageSize, (int)Math.Ceiling((double)total / effectivePageSize));
        return Ok(ApiResponse<List<FacialRegistrationDto>>.Ok(rows, meta));
    }

    /// <summary>
    /// Save a new Facial registration / transaction
    /// </summary>
    [HttpPost("registrations")]
    public async Task<IActionResult> CreateRegistration([FromBody] FacialRegistrationCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FirstName) || string.IsNullOrWhiteSpace(dto.LastName))
            return BadRequest(ApiResponse<object>.Fail("First name and Last name are required."));

        if (string.IsNullOrWhiteSpace(dto.ProcedureType))
            return BadRequest(ApiResponse<object>.Fail("Procedure type is required."));

        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        // Generate registration number (FC-YYYY-XXXX)
        var maxId = await conn.ExecuteScalarAsync<int?>("SELECT MAX(Id) FROM dbo.FacialRegistrations") ?? 0;
        string regNo = $"FC-{DateTime.UtcNow:yyyy}-{(maxId + 1):D4}";

        int qty = dto.Quantity > 0 ? dto.Quantity : 1;
        decimal unitPrice = dto.UnitPrice >= 0 ? dto.UnitPrice : 0;
        decimal discount = dto.Discount >= 0 ? dto.Discount : 0;
        decimal calculatedTotal = Math.Max(0, (unitPrice * qty) - discount);
        decimal finalTotal = dto.TotalPrice > 0 ? dto.TotalPrice : calculatedTotal;

        var sqlInsert = @"
            INSERT INTO dbo.FacialRegistrations (
                TenantId, RegistrationNumber, FirstName, MiddleName, LastName,
                Age, Gender, Mobile, ServiceId, ProcedureType, Quantity, UnitPrice,
                Discount, TotalPrice, DoctorId, DoctorName, IsPlc, IsOther, Notes,
                Status, RegistrationDate, RegistrationTime, CreatedAt
            )
            OUTPUT INSERTED.Id
            VALUES (
                @TenantId, @RegistrationNumber, @FirstName, @MiddleName, @LastName,
                @Age, @Gender, @Mobile, @ServiceId, @ProcedureType, @Quantity, @UnitPrice,
                @Discount, @TotalPrice, @DoctorId, @DoctorName, @IsPlc, @IsOther, @Notes,
                'Completed', CAST(GETDATE() AS DATE), CAST(GETDATE() AS TIME(0)), GETDATE()
            );";

        int newId = await conn.ExecuteScalarAsync<int>(sqlInsert, new
        {
            TenantId = tenantId,
            RegistrationNumber = regNo,
            FirstName = dto.FirstName.Trim(),
            MiddleName = dto.MiddleName?.Trim(),
            LastName = dto.LastName.Trim(),
            Age = dto.Age,
            Gender = dto.Gender?.Trim(),
            Mobile = dto.Mobile?.Trim(),
            ServiceId = dto.ServiceId,
            ProcedureType = dto.ProcedureType.Trim(),
            Quantity = qty,
            UnitPrice = unitPrice,
            Discount = discount,
            TotalPrice = finalTotal,
            DoctorId = dto.DoctorId,
            DoctorName = dto.DoctorName?.Trim(),
            IsPlc = dto.IsPlc,
            IsOther = dto.IsOther,
            Notes = dto.Notes?.Trim()
        });

        return Ok(ApiResponse<object>.Ok(new
        {
            Id = newId,
            RegistrationNumber = regNo,
            Message = "Facial client registration saved successfully."
        }));
    }

    /// <summary>
    /// Delete / Reverse a Facial registration
    /// </summary>
    [HttpDelete("registrations/{id:int}")]
    public async Task<IActionResult> DeleteRegistration(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        int rows = await conn.ExecuteAsync(
            "DELETE FROM dbo.FacialRegistrations WHERE Id = @Id AND TenantId = @TenantId",
            new { Id = id, TenantId = tenantId });

        if (rows == 0) return NotFound(ApiResponse<string>.Fail("Registration not found."));
        return Ok(ApiResponse<object>.Ok(new { Success = true, Message = "Facial registration deleted successfully." }));
    }

    /// <summary>
    /// Dedicated Facial PLC Report (Where IsPlc = 1)
    /// </summary>
    [HttpGet("reports/plc")]
    public async Task<IActionResult> GetPlcReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? search = null,
        [FromQuery] int? doctorId = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sqlData = @"
            SELECT Id, TenantId, RegistrationNumber, FirstName, MiddleName, LastName, FullName,
                   Age, Gender, Mobile, ServiceId, ProcedureType, Quantity, UnitPrice, Discount,
                   TotalPrice, DoctorId, DoctorName, IsPlc, IsOther, Notes, Status,
                   RegistrationDate, RegistrationTime, CreatedAt
            FROM dbo.FacialRegistrations WITH (NOLOCK)
            WHERE TenantId = @TenantId
              AND IsPlc = 1
              AND (@DoctorId IS NULL OR DoctorId = @DoctorId)
              AND (@FromDate IS NULL OR RegistrationDate >= CAST(@FromDate AS DATE))
              AND (@ToDate IS NULL OR RegistrationDate <= CAST(@ToDate AS DATE))
              AND (
                  @Search IS NULL
                  OR FirstName LIKE '%' + @Search + '%'
                  OR LastName LIKE '%' + @Search + '%'
                  OR FullName LIKE '%' + @Search + '%'
                  OR Mobile LIKE '%' + @Search + '%'
                  OR ProcedureType LIKE '%' + @Search + '%'
                  OR RegistrationNumber LIKE '%' + @Search + '%'
                  OR DoctorName LIKE '%' + @Search + '%'
              )
            ORDER BY RegistrationDate DESC, Id DESC";

        var sqlParams = new
        {
            TenantId = tenantId,
            FromDate = fromDate,
            ToDate = toDate,
            Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            DoctorId = doctorId
        };

        var rows = (await conn.QueryAsync<FacialRegistrationDto>(sqlData, sqlParams)).ToList();

        var summary = new FacialReportSummaryDto
        {
            TotalTransactions = rows.Count,
            TotalGrossRevenue = rows.Sum(r => r.UnitPrice * r.Quantity),
            TotalDiscount = rows.Sum(r => r.Discount),
            TotalNetRevenue = rows.Sum(r => r.TotalPrice),
            Procedures = rows
                .GroupBy(r => r.ProcedureType)
                .Select(g => new FacialProcedureBreakdownDto
                {
                    ProcedureType = g.Key,
                    Count = g.Count(),
                    TotalRevenue = g.Sum(x => x.TotalPrice)
                })
                .OrderByDescending(x => x.TotalRevenue)
                .ToList()
        };

        return Ok(ApiResponse<object>.Ok(new { Summary = summary, Rows = rows }));
    }

    /// <summary>
    /// Dedicated Other Facial Report (Where IsOther = 1)
    /// </summary>
    [HttpGet("reports/other")]
    public async Task<IActionResult> GetOtherReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? search = null,
        [FromQuery] int? doctorId = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sqlData = @"
            SELECT Id, TenantId, RegistrationNumber, FirstName, MiddleName, LastName, FullName,
                   Age, Gender, Mobile, ServiceId, ProcedureType, Quantity, UnitPrice, Discount,
                   TotalPrice, DoctorId, DoctorName, IsPlc, IsOther, Notes, Status,
                   RegistrationDate, RegistrationTime, CreatedAt
            FROM dbo.FacialRegistrations WITH (NOLOCK)
            WHERE TenantId = @TenantId
              AND IsOther = 1
              AND (@DoctorId IS NULL OR DoctorId = @DoctorId)
              AND (@FromDate IS NULL OR RegistrationDate >= CAST(@FromDate AS DATE))
              AND (@ToDate IS NULL OR RegistrationDate <= CAST(@ToDate AS DATE))
              AND (
                  @Search IS NULL
                  OR FirstName LIKE '%' + @Search + '%'
                  OR LastName LIKE '%' + @Search + '%'
                  OR FullName LIKE '%' + @Search + '%'
                  OR Mobile LIKE '%' + @Search + '%'
                  OR ProcedureType LIKE '%' + @Search + '%'
                  OR RegistrationNumber LIKE '%' + @Search + '%'
                  OR DoctorName LIKE '%' + @Search + '%'
              )
            ORDER BY RegistrationDate DESC, Id DESC";

        var sqlParams = new
        {
            TenantId = tenantId,
            FromDate = fromDate,
            ToDate = toDate,
            Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            DoctorId = doctorId
        };

        var rows = (await conn.QueryAsync<FacialRegistrationDto>(sqlData, sqlParams)).ToList();

        var summary = new FacialReportSummaryDto
        {
            TotalTransactions = rows.Count,
            TotalGrossRevenue = rows.Sum(r => r.UnitPrice * r.Quantity),
            TotalDiscount = rows.Sum(r => r.Discount),
            TotalNetRevenue = rows.Sum(r => r.TotalPrice),
            Procedures = rows
                .GroupBy(r => r.ProcedureType)
                .Select(g => new FacialProcedureBreakdownDto
                {
                    ProcedureType = g.Key,
                    Count = g.Count(),
                    TotalRevenue = g.Sum(x => x.TotalPrice)
                })
                .OrderByDescending(x => x.TotalRevenue)
                .ToList()
        };

        return Ok(ApiResponse<object>.Ok(new { Summary = summary, Rows = rows }));
    }
}
