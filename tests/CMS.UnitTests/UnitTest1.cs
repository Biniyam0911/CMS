using CMS.Shared.DTOs;
using Xunit;

namespace CMS.UnitTests;

public class ClinicalDtoAndRuleTests
{
    [Fact]
    public void ApiResponse_Ok_SetsSuccessAndData()
    {
        var response = ApiResponse<string>.Ok("SuccessData");
        Assert.True(response.Success);
        Assert.Equal("SuccessData", response.Data);
        Assert.Null(response.Errors);
    }

    [Fact]
    public void ApiResponse_Fail_SetsFalseAndErrors()
    {
        var response = ApiResponse<string>.Fail("Error1", "Error2");
        Assert.False(response.Success);
        Assert.Null(response.Data);
        Assert.NotNull(response.Errors);
        Assert.Equal(2, response.Errors.Length);
    }

    [Fact]
    public void PaginationMeta_CreatesCorrectMetadata()
    {
        var meta = new PaginationMeta(105, 2, 25, 5);
        Assert.Equal(105, meta.Total);
        Assert.Equal(2, meta.Page);
        Assert.Equal(25, meta.PageSize);
        Assert.Equal(5, meta.TotalPages);
    }

    [Theory]
    [InlineData("120/80", true)]
    [InlineData("140/90", true)]
    [InlineData("", false)]
    [InlineData("invalid", false)]
    public void BloodPressureFormat_Validation_Works(string bp, bool expectedValid)
    {
        bool isValid = System.Text.RegularExpressions.Regex.IsMatch(bp, @"^\d{2,3}/\d{2,3}$");
        Assert.Equal(expectedValid, isValid);
    }
}
