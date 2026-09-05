using CMS.Application.ReportBuilder;
using CMS.Shared.DTOs;
using Xunit;

namespace CMS.UnitTests;

public class SafeQueryBuilderTests
{
    private readonly SafeQueryBuilder _builder = new();

    [Fact]
    public void BuildQuery_ValidPatientsSource_GeneratesSafeParameterizedSql()
    {
        var request = new ReportExecuteRequest("Patients", new List<ReportColumnDto>
        {
            new("FirstName", "First"),
            new("LastName", "Last")
        }, new List<ReportFilterDto>
        {
            new("FirstName", "=", "Abebe")
        });

        var (sql, parameters) = _builder.BuildQuery(request, 1);

        Assert.Contains("SELECT [FirstName] AS [First], [LastName] AS [Last] FROM [Patients]", sql);
        Assert.Contains("WHERE [TenantId] = @TenantId AND [FirstName] = @p1", sql);
        Assert.Equal(1, (byte)parameters.Get<object>("TenantId"));
        Assert.Equal("Abebe", parameters.Get<string>("p1"));
    }

    [Fact]
    public void BuildQuery_InvalidDataSource_ThrowsArgumentException()
    {
        var request = new ReportExecuteRequest("Users; DROP TABLE Users; --", new List<ReportColumnDto>());

        Assert.Throws<ArgumentException>(() => _builder.BuildQuery(request, 1));
    }
}

public class BillingCalculationTests
{
    [Fact]
    public void Vat15Percent_CalculatesCorrectTotal()
    {
        decimal subTotal = 1000m;
        decimal vatRate = 0.15m;

        decimal tax = subTotal * vatRate;
        decimal total = subTotal + tax;

        Assert.Equal(150m, tax);
        Assert.Equal(1150m, total);
    }
}
