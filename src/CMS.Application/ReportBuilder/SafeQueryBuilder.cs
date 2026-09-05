using System.Text;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.ReportBuilder;

public class SafeQueryBuilder
{
    private static readonly Dictionary<string, (string TableName, Dictionary<string, string> AllowedColumns)> Whitelist = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Patients"] = ("Patients", new(StringComparer.OrdinalIgnoreCase)
        {
            ["Id"] = "Id", ["MRN"] = "MRN", ["FirstName"] = "FirstName", ["LastName"] = "LastName",
            ["DateOfBirth"] = "DateOfBirth", ["Gender"] = "Gender", ["PrimaryPhone"] = "PrimaryPhone",
            ["Email"] = "Email", ["City"] = "City", ["InsuranceProvider"] = "InsuranceProvider", ["CreatedAt"] = "CreatedAt"
        }),
        ["Appointments"] = ("Appointments", new(StringComparer.OrdinalIgnoreCase)
        {
            ["Id"] = "Id", ["SlotDateTime"] = "SlotDateTime", ["DurationMinutes"] = "DurationMinutes",
            ["StatusId"] = "StatusId", ["ReasonForVisit"] = "ReasonForVisit", ["BookedAt"] = "BookedAt"
        }),
        ["LabOrders"] = ("LabOrders", new(StringComparer.OrdinalIgnoreCase)
        {
            ["Id"] = "Id", ["OrderNumber"] = "OrderNumber", ["Priority"] = "Priority",
            ["OrderedAt"] = "OrderedAt", ["StatusId"] = "StatusId"
        }),
        ["Invoices"] = ("Invoices", new(StringComparer.OrdinalIgnoreCase)
        {
            ["Id"] = "Id", ["InvoiceNumber"] = "InvoiceNumber", ["IssueDate"] = "IssueDate",
            ["SubTotal"] = "SubTotal", ["TaxAmt"] = "TaxAmt", ["TotalAmount"] = "TotalAmount",
            ["PaidAmount"] = "PaidAmount", ["StatusId"] = "StatusId"
        })
    };

    public (string Sql, DynamicParameters Parameters) BuildQuery(ReportExecuteRequest request, byte tenantId)
    {
        if (!Whitelist.TryGetValue(request.DataSource, out var tableInfo))
            throw new ArgumentException($"Data source '{request.DataSource}' is not in the allowed whitelist.");

        var selectedCols = new List<string>();
        foreach (var col in request.Columns.Where(c => c.Visible))
        {
            if (tableInfo.AllowedColumns.TryGetValue(col.Field, out var dbCol))
            {
                var alias = !string.IsNullOrWhiteSpace(col.Alias) ? $" AS [{col.Alias}]" : "";
                selectedCols.Add($"[{dbCol}]{alias}");
            }
        }

        if (selectedCols.Count == 0)
            selectedCols.Add("*");

        var sql = new StringBuilder($"SELECT {string.Join(", ", selectedCols)} FROM [{tableInfo.TableName}] WHERE [TenantId] = @TenantId");
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", tenantId);

        if (request.Filters != null)
        {
            int paramIndex = 0;
            foreach (var filter in request.Filters)
            {
                if (tableInfo.AllowedColumns.TryGetValue(filter.Field, out var dbCol))
                {
                    paramIndex++;
                    var paramName = $"@p{paramIndex}";
                    switch (filter.Operator.ToUpperInvariant())
                    {
                        case "=":
                            sql.Append($" AND [{dbCol}] = {paramName}");
                            parameters.Add(paramName, filter.Value);
                            break;
                        case "!=":
                            sql.Append($" AND [{dbCol}] <> {paramName}");
                            parameters.Add(paramName, filter.Value);
                            break;
                        case "LIKE":
                            sql.Append($" AND [{dbCol}] LIKE {paramName}");
                            parameters.Add(paramName, $"%{filter.Value}%");
                            break;
                        case ">":
                            sql.Append($" AND [{dbCol}] > {paramName}");
                            parameters.Add(paramName, filter.Value);
                            break;
                        case "<":
                            sql.Append($" AND [{dbCol}] < {paramName}");
                            parameters.Add(paramName, filter.Value);
                            break;
                    }
                }
            }
        }

        if (request.Sorts != null && request.Sorts.Count > 0)
        {
            var sortClauses = new List<string>();
            foreach (var sort in request.Sorts)
            {
                if (tableInfo.AllowedColumns.TryGetValue(sort.Field, out var dbCol))
                {
                    var dir = sort.Direction.Equals("DESC", StringComparison.OrdinalIgnoreCase) ? "DESC" : "ASC";
                    sortClauses.Add($"[{dbCol}] {dir}");
                }
            }
            if (sortClauses.Count > 0)
                sql.Append($" ORDER BY {string.Join(", ", sortClauses)}");
        }
        else
        {
            sql.Append(" ORDER BY [Id] DESC");
        }

        var offset = (request.PageNumber - 1) * request.PageSize;
        sql.Append($" OFFSET {offset} ROWS FETCH NEXT {request.PageSize} ROWS ONLY");

        return (sql.ToString(), parameters);
    }
}
