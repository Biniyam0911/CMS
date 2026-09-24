using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class ServicesController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public ServicesController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllServices(
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] int limit = 300)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT TOP (@Limit)
                Id,
                Code,
                Name,
                Category,
                Department,
                Price AS StandardFee,
                Taxable,
                IsActive,
                Description
            FROM dbo.Services WITH (NOLOCK)
            WHERE TenantId = @TenantId
              AND (@Category IS NULL OR Category = @Category)
              AND (
                  @Search IS NULL
                  OR Name LIKE '%' + @Search + '%'
                  OR Code LIKE '%' + @Search + '%'
                  OR Department LIKE '%' + @Search + '%'
              )
            ORDER BY Category ASC, Name ASC";

        var services = (await conn.QueryAsync<dynamic>(sql, new {
            TenantId = tenantId,
            Category = string.IsNullOrWhiteSpace(category) || category == "ALL" ? null : category,
            Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            Limit = limit
        })).ToList();

        return Ok(ApiResponse<dynamic>.Ok(services));
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT 
                ROW_NUMBER() OVER (ORDER BY Category) AS Id,
                Category AS Name,
                UPPER(LEFT(Category, 3)) + '-CAT' AS Code,
                Category + ' services and catalog' AS Description,
                COUNT(1) AS ItemCount
            FROM dbo.Services WITH (NOLOCK)
            WHERE TenantId = @TenantId AND IsActive = 1
            GROUP BY Category
            ORDER BY Category ASC";

        var categories = (await conn.QueryAsync<dynamic>(sql, new { TenantId = tenantId })).ToList();
        return Ok(ApiResponse<dynamic>.Ok(categories));
    }

    [HttpGet("consultation")]
    public async Task<IActionResult> GetConsultationServices()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT 
                Id,
                Code,
                Name,
                Price AS Fee,
                Price AS StandardFee,
                Description
            FROM dbo.Services WITH (NOLOCK)
            WHERE TenantId = @TenantId
              AND (Category = 'Consultation' OR Name LIKE '%consultation%')
              AND IsActive = 1
            ORDER BY Price ASC, Name ASC";

        var list = (await conn.QueryAsync<dynamic>(sql, new { TenantId = tenantId })).ToList();
        return Ok(ApiResponse<dynamic>.Ok(list));
    }

    [HttpPost]
    public async Task<IActionResult> CreateService([FromBody] ServiceCreateRequest request)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            INSERT INTO dbo.Services (TenantId, Code, Name, Category, Department, Price, Taxable, IsActive, Description, CreatedAt, UpdatedAt)
            VALUES (@TenantId, @Code, @Name, @Category, @Department, @Price, @Taxable, 1, @Description, GETDATE(), GETDATE());
            SELECT CAST(SCOPE_IDENTITY() AS INT);";

        int newId = await conn.ExecuteScalarAsync<int>(sql, new {
            TenantId = tenantId,
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            Category = request.Category.Trim(),
            Department = request.Department?.Trim() ?? "General Clinical",
            Price = request.StandardFee,
            Taxable = request.Taxable,
            Description = request.Description?.Trim()
        });

        return Ok(ApiResponse<object>.Ok(new { Id = newId, Message = "Service created successfully." }));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateService(int id, [FromBody] ServiceUpdateRequest request)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            UPDATE dbo.Services
            SET Code = @Code,
                Name = @Name,
                Category = @Category,
                Department = @Department,
                Price = @Price,
                Taxable = @Taxable,
                IsActive = @IsActive,
                Description = @Description,
                UpdatedAt = GETDATE()
            WHERE Id = @Id AND TenantId = @TenantId";

        int rows = await conn.ExecuteAsync(sql, new {
            Id = id,
            TenantId = tenantId,
            Code = request.Code.Trim(),
            Name = request.Name.Trim(),
            Category = request.Category.Trim(),
            Department = request.Department?.Trim(),
            Price = request.StandardFee,
            Taxable = request.Taxable,
            IsActive = request.IsActive,
            Description = request.Description?.Trim()
        });

        if (rows == 0) return NotFound(ApiResponse<string>.Fail("Service not found."));
        return Ok(ApiResponse<object>.Ok(new { Success = true, Message = "Service updated successfully." }));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteService(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = "UPDATE dbo.Services SET IsActive = 0, UpdatedAt = GETDATE() WHERE Id = @Id AND TenantId = @TenantId";
        int rows = await conn.ExecuteAsync(sql, new { Id = id, TenantId = tenantId });

        if (rows == 0) return NotFound(ApiResponse<string>.Fail("Service not found."));
        return Ok(ApiResponse<object>.Ok(new { Success = true, Message = "Service deactivated." }));
    }
}

public record ServiceCreateRequest(
    string Code,
    string Name,
    string Category,
    string? Department,
    decimal StandardFee,
    bool Taxable,
    string? Description
);

public record ServiceUpdateRequest(
    string Code,
    string Name,
    string Category,
    string? Department,
    decimal StandardFee,
    bool Taxable,
    bool IsActive,
    string? Description
);
