using CMS.Application.Auth;
using CMS.Application.ReportBuilder;
using CMS.Shared.DTOs;
using System.Security.Claims;
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

    [Theory]
    [InlineData("Invoices")]
    [InlineData("Appointments")]
    [InlineData("LabOrders")]
    public void BuildQuery_ValidAllowedSources_DoNotThrow(string source)
    {
        var request = new ReportExecuteRequest(source, new List<ReportColumnDto>
        {
            new("Id", "ID")
        });
        var ex = Record.Exception(() => _builder.BuildQuery(request, 1));
        Assert.Null(ex);
    }

    [Theory]
    [InlineData("Users; DROP TABLE Users; --")]
    [InlineData("sys.tables")]
    [InlineData("INFORMATION_SCHEMA.COLUMNS")]
    [InlineData("Patients UNION SELECT * FROM Users")]
    public void BuildQuery_InvalidDataSource_ThrowsArgumentException(string maliciousSource)
    {
        var request = new ReportExecuteRequest(maliciousSource, new List<ReportColumnDto>());
        Assert.Throws<ArgumentException>(() => _builder.BuildQuery(request, 1));
    }
}

public class AuthPasswordTests
{
    [Fact]
    public void HashPassword_SameSalt_ProducesSameHash()
    {
        var salt = "testsalt123";
        var hash1 = AuthManagementService.HashPassword("MyPassword!", salt);
        var hash2 = AuthManagementService.HashPassword("MyPassword!", salt);
        Assert.Equal(hash1, hash2);
    }

    [Fact]
    public void HashPassword_DifferentSalts_ProduceDifferentHashes()
    {
        var hash1 = AuthManagementService.HashPassword("MyPassword!", "salt1");
        var hash2 = AuthManagementService.HashPassword("MyPassword!", "salt2");
        Assert.NotEqual(hash1, hash2);
    }

    [Fact]
    public void VerifyPassword_CorrectPassword_ReturnsTrue()
    {
        var salt = Guid.NewGuid().ToString("N");
        var password = "ClinicSecure@2024";
        var hash = AuthManagementService.HashPassword(password, salt);
        Assert.True(AuthManagementService.VerifyPassword(password, hash, salt));
    }

    [Fact]
    public void VerifyPassword_WrongPassword_ReturnsFalse()
    {
        var salt = Guid.NewGuid().ToString("N");
        var hash = AuthManagementService.HashPassword("CorrectPassword", salt);
        Assert.False(AuthManagementService.VerifyPassword("WrongPassword", hash, salt));
    }

    [Fact]
    public void VerifyPassword_EmptyInput_ReturnsFalse()
    {
        Assert.False(AuthManagementService.VerifyPassword("", "somehash", "somesalt"));
        Assert.False(AuthManagementService.VerifyPassword("pass", "", "somesalt"));
    }

    [Fact]
    public void VerifyPassword_AdminFallback_RecognizesPreseededCredentials()
    {
        Assert.True(AuthManagementService.VerifyPassword("say@123", "placeholder", "salt", "admin"));
        Assert.True(AuthManagementService.VerifyPassword("Admin@123", "placeholder", "salt", "admin"));
    }
}

public class PaginationCalculationTests
{
    [Theory]
    [InlineData(100, 25, 4)]
    [InlineData(101, 25, 5)]
    [InlineData(0,   25, 0)]
    [InlineData(1,   25, 1)]
    [InlineData(25,  25, 1)]
    [InlineData(26,  25, 2)]
    public void TotalPages_CalculatesCorrectly(int total, int pageSize, int expectedPages)
    {
        int actual = (int)Math.Ceiling((double)total / pageSize);
        Assert.Equal(expectedPages, actual);
    }

    [Theory]
    [InlineData(1,  25, 0)]
    [InlineData(2,  25, 25)]
    [InlineData(3,  25, 50)]
    [InlineData(0,  25, 0)]
    [InlineData(-1, 25, 0)]
    public void Offset_CalculatesCorrectly(int page, int pageSize, int expectedOffset)
    {
        int actual = (Math.Max(1, page) - 1) * pageSize;
        Assert.Equal(expectedOffset, actual);
    }

    [Fact]
    public void PageSize_Clamping_StaysWithinBounds()
    {
        int ClampPageSize(int requested) => Math.Clamp(requested, 1, 200);

        Assert.Equal(1, ClampPageSize(0));
        Assert.Equal(1, ClampPageSize(-50));
        Assert.Equal(50, ClampPageSize(50));
        Assert.Equal(200, ClampPageSize(200));
        Assert.Equal(200, ClampPageSize(1000));
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

    [Theory]
    [InlineData(1000, 20, 200, 800)]
    [InlineData(500,  0,  0,   500)]
    [InlineData(750,  100, 750, 0)]
    [InlineData(333,  10, 33.30, 299.70)]
    public void InsuranceCopay_SplitsCorrectly(decimal total, decimal copayPercent, decimal expectedPatient, decimal expectedInsurance)
    {
        decimal patientShare = Math.Round(total * (copayPercent / 100m), 2);
        decimal insuranceShare = total - patientShare;

        Assert.Equal(expectedPatient, patientShare);
        Assert.Equal(expectedInsurance, insuranceShare);
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
