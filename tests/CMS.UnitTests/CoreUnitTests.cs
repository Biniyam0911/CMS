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

public class ZybioHl7AdapterTests
{
    [Fact]
    public void ParseFullOruMessage_ZybioPayload_ExtractsParametersAndAck()
    {
        var loggerMock = new Microsoft.Extensions.Logging.Abstractions.NullLogger<CMS.Infrastructure.LabIntegration.Hl7Adapter>();
        var adapter = new CMS.Infrastructure.LabIntegration.Hl7Adapter(loggerMock);

        string sampleZybio =
            "MSH|^~\\&|Z3|Zybio|||19700101013922||ORU^R01|1970010101392247670|P|2.3.1||||||UNICODE\r" +
            "PID|1||^^^^MR||^|||0\r" +
            "PV1|1|0|^^|||||||||||||||||0\r" +
            "OBR|1||1|01001^Automated Count^99MRC|||20260921013054|||||||||||||||||HM||||||||admin\r" +
            "OBX|1|IS|03001^Take Mode^99MRC||O||||||F\r" +
            "OBX|2|IS|03002^Blood Mode^99MRC||W||||||F\r" +
            "OBX|3|IS|03003^Test Mode^99MRC||CBC||||||F\r" +
            "OBX|4|NM|31525-0^Age^LN||-1|yr|||||F\r" +
            "OBX|5|IS|04001^Ref Group^99MRC||1||||||F\r" +
            "OBX|6|NM|6790-2^WBC^LN||0.06|10^3/μL|3.5000-9.5000|L~A|||F\r" +
            "OBX|7|NM|789-8^RBC^LN||4.85|10^6/μL|4.3000-5.8000|Normal|||F\r" +
            "OBX|8|NM|718-7^HGB^LN||14.5|g/dL|13.000-17.500|Normal|||F\r" +
            "OBX|9|NM|777-3^PLT^LN||***|10^3/μL|150.00-450.00|L~A|||F\r";

        var result = adapter.ParseFullOruMessage(sampleZybio);

        Assert.Equal("1", result.SampleId);
        Assert.Equal("1970010101392247670", result.MessageControlId);
        Assert.Equal("Z3", result.SendingApp);
        Assert.Equal("Zybio", result.SendingFacility);

        // Parameters extracted
        var wbc = result.Parameters.FirstOrDefault(p => p.Code == "WBC");
        Assert.NotNull(wbc);
        Assert.Equal(0.06m, wbc.NumericValue);
        Assert.Equal("10^3/μL", wbc.Unit);
        Assert.Equal("L~A", wbc.Flag);

        // Asterisk handled
        var plt = result.Parameters.FirstOrDefault(p => p.Code == "PLT");
        Assert.NotNull(plt);
        Assert.Null(plt.NumericValue);
        Assert.Equal("***", plt.TextValue);

        // Check ACK generation
        string ack = adapter.CreateAckMessage(sampleZybio, success: true);
        Assert.Contains("MSA|AA|1970010101392247670|Message accepted", ack);
        Assert.Contains("MSH|^~\\&|CMS|HUDERMA|Z3|Zybio", ack);
    }
}

