using System.Text.Json;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.ReportBuilder;

public record CreateTemplateDto(
    byte TenantId, string Name, string? Description, int OwnerId, bool IsPublic,
    string DataSource, List<ReportColumnDto> Columns, List<ReportFilterDto>? Filters = null,
    List<ReportSortDto>? Sorts = null);

public class ReportTemplateService
{
    private readonly IDbConnectionFactory _dbFactory;

    public ReportTemplateService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<int> SaveTemplateAsync(CreateTemplateDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sqlTpl = @"
            INSERT INTO ReportTemplates (TenantId, Name, Description, OwnerId, IsPublic)
            VALUES (@TenantId, @Name, @Description, @OwnerId, @IsPublic);
            SELECT SCOPE_IDENTITY();";

        int tplId = await conn.ExecuteScalarAsync<int>(sqlTpl, dto);

        var sqlDef = @"
            INSERT INTO ReportDefinitions (TemplateId, DataSource, ColumnsJson, FiltersJson, SortByJson)
            VALUES (@TemplateId, @DataSource, @ColumnsJson, @FiltersJson, @SortByJson)";

        await conn.ExecuteAsync(sqlDef, new {
            TemplateId = tplId,
            dto.DataSource,
            ColumnsJson = JsonSerializer.Serialize(dto.Columns),
            FiltersJson = dto.Filters != null ? JsonSerializer.Serialize(dto.Filters) : null,
            SortByJson = dto.Sorts != null ? JsonSerializer.Serialize(dto.Sorts) : null
        });

        return tplId;
    }
}
