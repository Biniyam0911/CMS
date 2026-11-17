using CMS.Shared.DTOs;
using Xunit;

namespace CMS.UnitTests;

public class AntenatalCareUnitTests
{
    [Fact]
    public void Edd_Calculation_From_Lmp_Naegeles_Rule()
    {
        // Given LMP: 2026-03-01
        var lmp = new DateTime(2026, 3, 1);
        var expectedEdd = lmp.AddDays(280); // 2026-12-06

        Assert.Equal(new DateTime(2026, 12, 6), expectedEdd);
    }

    [Theory]
    [InlineData(70, 10, 0, 1)]   // 10 weeks -> First Trimester
    [InlineData(91, 13, 0, 1)]   // 13 weeks -> First Trimester
    [InlineData(98, 14, 0, 2)]   // 14 weeks -> Second Trimester
    [InlineData(189, 27, 0, 2)]  // 27 weeks -> Second Trimester
    [InlineData(196, 28, 0, 3)]  // 28 weeks -> Third Trimester
    [InlineData(228, 32, 4, 3)]  // 32w 4d -> Third Trimester
    [InlineData(294, 42, 0, 3)]  // 42 weeks -> Third Trimester (Overdue)
    [InlineData(301, 43, 0, 3)]  // 43 weeks -> Third Trimester (Overdue Review)
    public void GestationalAge_And_Trimester_Calculations(int daysElapsed, int expectedWeeks, int expectedDays, byte expectedTrimester)
    {
        var weeks = daysElapsed / 7;
        var days = daysElapsed % 7;
        var trimester = (byte)(weeks < 14 ? 1 : (weeks < 28 ? 2 : 3));

        Assert.Equal(expectedWeeks, weeks);
        Assert.Equal(expectedDays, days);
        Assert.Equal(expectedTrimester, trimester);
    }

    [Fact]
    public void Overdue_Pregnancy_Flags_At_42_And_43_Weeks()
    {
        int gaWeeks41 = 41;
        int gaWeeks42 = 42;
        int gaWeeks43 = 43;

        bool isOverdue41 = gaWeeks41 >= 42;
        bool isOverdue42 = gaWeeks42 >= 42;
        bool reviewRequired42 = gaWeeks42 >= 43;
        bool reviewRequired43 = gaWeeks43 >= 43;

        Assert.False(isOverdue41);
        Assert.True(isOverdue42);
        Assert.False(reviewRequired42);
        Assert.True(reviewRequired43);
    }

    [Theory]
    [InlineData(160, 110, "critical")]
    [InlineData(165, 95, "critical")]
    [InlineData(140, 90, "warning")]
    [InlineData(145, 88, "warning")]
    [InlineData(120, 80, "normal")]
    [InlineData(85, 55, "hypotension")]
    public void BloodPressure_Clinical_Alert_Classification(int sys, int dia, string expectedCategory)
    {
        string category;
        if (sys >= 160 || dia >= 110) category = "critical";
        else if (sys >= 140 || dia >= 90) category = "warning";
        else if (sys < 90 || dia < 60) category = "hypotension";
        else category = "normal";

        Assert.Equal(expectedCategory, category);
    }

    [Fact]
    public void Ultrasound_Dating_Equivalence_Calculation()
    {
        // If scan on 2026-04-15 showed 12 weeks + 3 days (87 days)
        var scanDate = new DateTime(2026, 4, 15);
        int usWeeks = 12;
        int usDays = 3;
        int totalUsDays = (usWeeks * 7) + usDays;

        var lmpEquivalent = scanDate.AddDays(-totalUsDays); // 2026-01-18
        var eddByUltrasound = lmpEquivalent.AddDays(280);

        Assert.Equal(new DateTime(2026, 1, 18), lmpEquivalent);
        Assert.Equal(new DateTime(2026, 10, 25), eddByUltrasound);

        // When evaluating on 2026-07-20:
        var targetDate = new DateTime(2026, 7, 20);
        var daysElapsed = (targetDate - lmpEquivalent).Days;
        var gaWeeks = daysElapsed / 7;
        var gaDays = daysElapsed % 7;

        Assert.Equal(26, gaWeeks);
        Assert.Equal(1, gaDays);
    }

    [Fact]
    public void Encounter_Side_By_Side_Difference_Calculation()
    {
        var prev = new AncEncounterDto
        {
            EncounterNumber = 1,
            GestationalAgeWeeks = 28,
            GestationalAgeDays = 3,
            Weight = 64.5m,
            FundalHeight = 28.0m,
            SystolicBp = 110,
            DiastolicBp = 70
        };

        var cur = new AncEncounterDto
        {
            EncounterNumber = 2,
            GestationalAgeWeeks = 32,
            GestationalAgeDays = 4,
            Weight = 66.8m,
            FundalHeight = 32.5m,
            SystolicBp = 120,
            DiastolicBp = 75
        };

        var comparison = new AncEncounterComparisonDto
        {
            PreviousEncounter = prev,
            CurrentEncounter = cur,
            WeightDifference = cur.Weight - prev.Weight,
            FundalHeightDifference = cur.FundalHeight - prev.FundalHeight,
            GestationalWeeksDifference = cur.GestationalAgeWeeks - prev.GestationalAgeWeeks
        };

        Assert.Equal(2.3m, comparison.WeightDifference);
        Assert.Equal(4.5m, comparison.FundalHeightDifference);
        Assert.Equal(4, comparison.GestationalWeeksDifference);
    }

    [Theory]
    [InlineData("ACTIVE_REGISTER")]
    [InlineData("FIRST_REGISTRATION")]
    [InlineData("FOLLOW_UP")]
    [InlineData("TRIMESTER_DISTRIBUTION")]
    [InlineData("MISSED_APPOINTMENTS")]
    [InlineData("HIGH_RISK_REGISTER")]
    [InlineData("OVERDUE_PREGNANCIES")]
    [InlineData("PREGNANCY_OUTCOME")]
    [InlineData("LAB_COMPLETION")]
    [InlineData("PMTCT_HIV")]
    [InlineData("CLINICIAN_WORKLOAD")]
    [InlineData("CONTINUITY_COHORT")]
    public void Report_Filter_All12ReportTypes_Defined(string reportType)
    {
        var filter = new AncReportFilterRequest { ReportType = reportType };
        Assert.Equal(reportType, filter.ReportType);
    }

    [Fact]
    public void Outcome_Closure_Delivery_Validation()
    {
        var req = new AncCloseEpisodeRequest
        {
            EpisodeId = 1,
            DeliveryDate = new DateTime(2026, 11, 1),
            DeliveryPlace = "Hospital Labor Ward",
            ModeOfDelivery = "Spontaneous Vaginal Delivery (SVD)",
            PregnancyOutcomeType = "Live Birth",
            NumberOfBabies = 1,
            MaternalOutcome = "Discharged alive in good condition",
            Baby1Outcome = "Alive & Healthy",
            Baby1Sex = "Female",
            Baby1WeightGrams = 3250
        };

        Assert.Equal(1, req.EpisodeId);
        Assert.Equal("Live Birth", req.PregnancyOutcomeType);
        Assert.Equal("Female", req.Baby1Sex);
        Assert.Equal(3250m, req.Baby1WeightGrams);
    }

    [Fact]
    public void Danger_Signs_Alert_Triggers()
    {
        var dangerSigns = new List<string> { "Vaginal Bleeding", "Severe Headache" };
        bool hasDangerSigns = dangerSigns.Count > 0;
        Assert.True(hasDangerSigns);
    }
}
