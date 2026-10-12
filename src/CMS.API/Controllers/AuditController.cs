using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

public record CreateAuditEntryDto(
    string TableName,
    string RecordId,
    string Operation,
    string? OldValues = null,
    string? NewValues = null,
    int? ChangedBy = null
);

public class AuditDto
{
    public long Id { get; set; }
    public byte TenantId { get; set; }
    public string TableName { get; set; } = string.Empty;
    public string RecordId { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public int? ChangedBy { get; set; }
    public string? UserName { get; set; }
    public DateTime ChangedAt { get; set; }
    public string? IpAddress { get; set; }
}

[ApiController]
[Route("api/v1/[controller]")]
public class AuditController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public AuditController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpGet("logs")]
    public async Task<IActionResult> GetLogs(
        [FromQuery] string? tableName,
        [FromQuery] string? operation,
        [FromQuery] int? userId,
        [FromQuery] DateTime? date,
        [FromQuery] string? keyword,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 200) pageSize = 25;
        int offset = (page - 1) * pageSize;

        var whereSql = @"
            FROM AuditLog a
            LEFT JOIN Users u ON u.Id = a.ChangedBy
            LEFT JOIN Staff st ON st.UserId = u.Id
            WHERE a.TenantId = @TenantId
              AND (@TableName IS NULL OR a.TableName = @TableName)
              AND (@Operation IS NULL OR a.Operation LIKE '%' + @Operation + '%')
              AND (@UserId IS NULL OR a.ChangedBy = @UserId)
              AND (@Date IS NULL OR CAST(a.ChangedAt AS DATE) = CAST(@Date AS DATE))
              AND (@DateFrom IS NULL OR a.ChangedAt >= @DateFrom)
              AND (@DateTo IS NULL OR a.ChangedAt < DATEADD(day,1,CAST(@DateTo AS DATE)))
              AND (@Keyword IS NULL OR
                   a.RecordId LIKE '%' + @Keyword + '%' OR
                   a.IpAddress LIKE '%' + @Keyword + '%' OR
                   a.Operation LIKE '%' + @Keyword + '%' OR
                   COALESCE(
                     NULLIF(TRIM(ISNULL(st.FirstName,'')+' '+ISNULL(st.LastName,'')), ''),
                     NULLIF(TRIM(ISNULL(u.FirstName,'')+' '+ISNULL(u.LastName,'')), ''),
                     u.Username, ''
                   ) LIKE '%' + @Keyword + '%')";

        var countSql = "SELECT COUNT(*) " + whereSql;
        var dataSql = @"
            SELECT
                a.Id, a.TenantId, a.TableName, a.RecordId, a.Operation,
                a.OldValues, a.NewValues, a.ChangedBy,
                COALESCE(
                    NULLIF(TRIM(ISNULL(st.FirstName, '') + ' ' + ISNULL(st.LastName, '')), ''),
                    NULLIF(TRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, '')), ''),
                    u.Username, 'System Administrator'
                ) AS UserName,
                a.ChangedAt, a.IpAddress " + whereSql + @"
            ORDER BY a.ChangedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";

        var sqlParams = new {
            TenantId = tenantId,
            TableName = string.IsNullOrWhiteSpace(tableName) ? null : tableName,
            Operation = string.IsNullOrWhiteSpace(operation) ? null : operation,
            UserId = userId,
            Date = date,
            DateFrom = dateFrom,
            DateTo = dateTo,
            Keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword,
            Offset = offset,
            PageSize = pageSize
        };

        int total = await conn.ExecuteScalarAsync<int>(countSql, sqlParams);
        var list = (await conn.QueryAsync<AuditDto>(dataSql, sqlParams)).ToList();

        return Ok(new {
            Success = true,
            Data = list,
            Meta = new { Total = total, Page = page, PageSize = pageSize, TotalPages = (int)Math.Ceiling((double)total / pageSize) }
        });
    }

    [HttpPost("log")]
    public async Task<IActionResult> LogAccess([FromBody] CreateAuditEntryDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        
        // Extract authenticated UserId if available from context, fallback to 1
        int changedBy = (dto.ChangedBy.HasValue && dto.ChangedBy.Value > 0)
            ? dto.ChangedBy.Value
            : (HttpContext.Items["UserId"] is int uid && uid > 0 ? uid : 1);

        var sql = @"
            INSERT INTO AuditLog (TenantId, TableName, RecordId, Operation, OldValues, NewValues, ChangedBy, ChangedAt, IpAddress)
            VALUES (@TenantId, @TableName, @RecordId, @Operation, @OldValues, @NewValues, @ChangedBy, GETDATE(), @IpAddress);
            SELECT SCOPE_IDENTITY();";

        long newId = await conn.ExecuteScalarAsync<long>(sql, new {
            TenantId = tenantId,
            dto.TableName,
            dto.RecordId,
            dto.Operation,
            dto.OldValues,
            dto.NewValues,
            ChangedBy = changedBy,
            IpAddress = ip
        });

        return Ok(ApiResponse<object>.Ok(new { LogId = newId, Message = "Audit log recorded." }));
    }
}
