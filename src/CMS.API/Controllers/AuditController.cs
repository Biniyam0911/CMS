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
    public async Task<IActionResult> GetLogs([FromQuery] string? tableName, [FromQuery] string? operation, [FromQuery] int? userId, [FromQuery] DateTime? date)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT TOP 200
                a.Id, a.TenantId, a.TableName, a.RecordId, a.Operation,
                a.OldValues, a.NewValues, a.ChangedBy,
                ISNULL(u.Username, 'System / Dr. Tigist') AS UserName,
                a.ChangedAt, a.IpAddress
            FROM AuditLog a
            LEFT JOIN Users u ON u.Id = a.ChangedBy
            WHERE a.TenantId = @TenantId
              AND (@TableName IS NULL OR a.TableName = @TableName)
              AND (@Operation IS NULL OR a.Operation = @Operation)
              AND (@UserId IS NULL OR a.ChangedBy = @UserId)
              AND (@Date IS NULL OR CAST(a.ChangedAt AS DATE) = CAST(@Date AS DATE))
            ORDER BY a.ChangedAt DESC";

        var list = (await conn.QueryAsync<AuditDto>(sql, new {
            TenantId = tenantId,
            TableName = string.IsNullOrWhiteSpace(tableName) ? null : tableName,
            Operation = string.IsNullOrWhiteSpace(operation) ? null : operation,
            UserId = userId,
            Date = date
        })).ToList();

        return Ok(ApiResponse<List<AuditDto>>.Ok(list));
    }

    [HttpPost("log")]
    public async Task<IActionResult> LogAccess([FromBody] CreateAuditEntryDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        
        // Extract authenticated UserId if available from context
        int changedBy = dto.ChangedBy ?? (HttpContext.Items["UserId"] is int uid ? uid : 1);

        var sql = @"
            INSERT INTO AuditLog (TenantId, TableName, RecordId, Operation, OldValues, NewValues, ChangedBy, ChangedAt, IpAddress)
            VALUES (@TenantId, @TableName, @RecordId, @Operation, @OldValues, @NewValues, @ChangedBy, SYSUTCDATETIME(), @IpAddress);
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
