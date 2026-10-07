using System.Diagnostics;
using System.Text.RegularExpressions;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

public record CustomQueryRequest(string Query);

[ApiController]
[Route("api/v1/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public ReportsController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpPost("custom-query")]
    public async Task<IActionResult> ExecuteCustomQuery([FromBody] CustomQueryRequest req)
    {
        if (string.IsNullOrWhiteSpace(req?.Query))
            return BadRequest(ApiResponse<object>.Fail("Query string cannot be empty."));

        string rawQuery = req.Query.Trim();

        // 1. Must start with SELECT or WITH (for CTEs)
        if (!Regex.IsMatch(rawQuery, @"^(SELECT|WITH)\b", RegexOptions.IgnoreCase))
        {
            return BadRequest(ApiResponse<object>.Fail("Only read-only SELECT or WITH statements are allowed."));
        }

        // 2. Disallow harmful tokens / DDL / DML / multiple statements with semicolons
        string forbiddenPattern = @"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|MERGE|SHUTDOWN|BACKUP|RESTORE)\b|;--|/\*";
        if (Regex.IsMatch(rawQuery, forbiddenPattern, RegexOptions.IgnoreCase))
        {
            return BadRequest(ApiResponse<object>.Fail("Prohibited SQL keyword or token detected. Queries must be strictly read-only."));
        }

        try
        {
            using var conn = _dbFactory.CreateConnection();
            var sw = Stopwatch.StartNew();

            var rows = (await conn.QueryAsync(rawQuery)).Take(1000).ToList();
            sw.Stop();

            var columns = new List<string>();
            var resultRows = new List<Dictionary<string, object?>>();

            if (rows.Count > 0)
            {
                var firstRow = (IDictionary<string, object>)rows[0];
                columns = firstRow.Keys.ToList();

                foreach (var row in rows)
                {
                    var dict = new Dictionary<string, object?>();
                    var rowDict = (IDictionary<string, object>)row;
                    foreach (var col in columns)
                    {
                        dict[col] = rowDict.ContainsKey(col) ? rowDict[col] : null;
                    }
                    resultRows.Add(dict);
                }
            }

            return Ok(ApiResponse<object>.Ok(new
            {
                Columns = columns,
                Rows = resultRows,
                TotalCount = resultRows.Count,
                ExecutionTimeMs = sw.ElapsedMilliseconds
            }));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<object>.Fail($"SQL Execution Error: {ex.Message}"));
        }
    }

    [HttpGet("datasources")]
    public async Task<IActionResult> GetDataSources()
    {
        var descriptions = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Patients"] = "Patient demographic registry and card records",
            ["Appointments"] = "Patient clinic bookings and scheduling records",
            ["PatientTriage"] = "Vital signs triage and doctor queue tickets",
            ["Encounters"] = "Clinical consultation encounters and SOAP notes",
            ["Invoices"] = "Financial invoices and billing charges",
            ["InvoiceItems"] = "Itemized billing lines and clinical services",
            ["LabOrders"] = "Diagnostic laboratory examination requests",
            ["LabResults"] = "Analyte test values, reference ranges, and flags",
            ["DrugFormulary"] = "Dispensary stock formulary and medication pricing",
            ["Doctors"] = "Physicians with license and clinical specialization",
            ["Staff"] = "Clinic practitioners and administrative personnel",
            ["Users"] = "User accounts and system access",
            ["Specializations"] = "Medical specialty catalog",
            ["Diagnoses"] = "Clinical encounter diagnoses and ICD coding",
            ["ProcedureOrders"] = "Clinical minor surgeries and ordered procedures",
            ["Prescriptions"] = "Doctor issued prescription orders",
            ["PrescriptionItems"] = "Prescription medication items and dosages"
        };

        var priorityList = new List<string>
        {
            "Patients", "Invoices", "InvoiceItems", "Encounters", "Appointments",
            "PatientTriage", "LabOrders", "LabResults", "DrugFormulary", "Doctors",
            "Staff", "Users", "Specializations", "Diagnoses", "ProcedureOrders"
        };

        try
        {
            using var conn = _dbFactory.CreateConnection();
            var sql = @"
                SELECT 
                    t.name AS TableName,
                    c.name AS ColumnName
                FROM sys.tables t
                INNER JOIN sys.columns c ON t.object_id = c.object_id
                WHERE t.is_ms_shipped = 0 
                  AND t.name NOT LIKE '__%' 
                  AND t.name NOT LIKE 'sys%'
                  AND t.name NOT LIKE 'Map_%'
                  AND t.name NOT LIKE 'MigrationLog%'
                ORDER BY t.name, c.column_id;";

            var rows = await conn.QueryAsync<dynamic>(sql);
            if (rows != null && rows.Any())
            {
                var grouped = rows
                    .GroupBy(r => (string)r.TableName)
                    .Select(g =>
                    {
                        var name = g.Key;
                        var desc = descriptions.ContainsKey(name) ? descriptions[name] : $"Database table [{name}]";
                        var priority = priorityList.IndexOf(name);
                        return new
                        {
                            Name = name,
                            Description = desc,
                            Columns = g.Select(c => (string)c.ColumnName).ToArray(),
                            Priority = priority >= 0 ? priority : 999
                        };
                    })
                    .OrderBy(t => t.Priority)
                    .ThenBy(t => t.Name)
                    .Select(t => new
                    {
                        t.Name,
                        t.Description,
                        t.Columns
                    })
                    .ToList();

                return Ok(ApiResponse<object>.Ok(grouped));
            }
        }
        catch (Exception)
        {
            // Fallback to static catalog if catalog query fails
        }

        var tables = new[]
        {
            new {
                Name = "Patients",
                Description = "Patient demographic registry and card records",
                Columns = new[] { "Id", "MRN", "FirstName", "MiddleName", "LastName", "Gender", "DateOfBirth", "PrimaryPhone", "InsuranceProvider", "CreatedAt" }
            },
            new {
                Name = "Appointments",
                Description = "Patient clinic bookings and scheduling records",
                Columns = new[] { "Id", "PatientId", "DoctorId", "SlotDateTime", "StatusId", "Notes", "CreatedAt" }
            },
            new {
                Name = "PatientTriage",
                Description = "Vital signs triage and doctor queue tickets",
                Columns = new[] { "Id", "PatientId", "QueueId", "SystolicBP", "DiastolicBP", "HeartRate", "Temperature", "OxygenSaturation", "Bmi", "ChiefComplaint", "Status", "TriagedAt" }
            },
            new {
                Name = "Encounters",
                Description = "Clinical consultation encounters and SOAP notes",
                Columns = new[] { "Id", "PatientId", "DoctorId", "EncounterDate", "ChiefComplaint", "HistoryOfIllness", "PhysicalExam", "Assessment", "Plan", "CreatedAt" }
            },
            new {
                Name = "Invoices",
                Description = "Financial invoices and billing charges",
                Columns = new[] { "Id", "InvoiceNumber", "PatientId", "EncounterId", "SubTotal", "TaxAmt", "TotalAmount", "PaidAmount", "StatusId", "IssueDate" }
            },
            new {
                Name = "InvoiceItems",
                Description = "Billing itemized charges and services",
                Columns = new[] { "Id", "InvoiceId", "ItemType", "Description", "Quantity", "UnitPrice", "Total" }
            },
            new {
                Name = "LabOrders",
                Description = "Diagnostic laboratory examination requests",
                Columns = new[] { "Id", "PatientId", "OrderedBy", "OrderNumber", "OrderedAt", "StatusId" }
            },
            new {
                Name = "LabResults",
                Description = "Analyte test values, reference ranges, and flags",
                Columns = new[] { "Id", "OrderId", "OrderItemId", "TestId", "PatientId", "NumericValue", "TextValue", "Unit", "Flag", "ReferenceRange", "IsVerified", "EnteredAt" }
            },
            new {
                Name = "DrugFormulary",
                Description = "Dispensary stock formulary and medication pricing",
                Columns = new[] { "Id", "GenericName", "BrandName", "DrugClass", "Form", "Strength", "StockQuantity", "MinStockLevel", "CostPrice", "SellingPrice", "UnitPrice" }
            },
            new {
                Name = "Staff",
                Description = "Clinic practitioners and administrative personnel",
                Columns = new[] { "Id", "UserId", "StaffCode", "Title", "FirstName", "LastName", "Phone", "Email", "Department", "PrimaryRoleId", "IsActive" }
            },
            new {
                Name = "Doctors",
                Description = "Physicians with license and clinical specialization",
                Columns = new[] { "Id", "StaffId", "LicenseNumber", "SpecializationId", "SubSpecialization", "ConsultationFee", "IsAvailable" }
            },
            new {
                Name = "Specializations",
                Description = "Medical specialty catalog",
                Columns = new[] { "Id", "Name", "Code" }
            }
        };

        return Ok(ApiResponse<object>.Ok(tables));
    }

    [HttpGet("sales")]
    public async Task<IActionResult> GetSalesReport(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? receptionist = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT 
                i.InvoiceNumber AS InvoiceNo,
                ISNULL(p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName, 'Patient') AS PatientName,
                ISNULL(u.FirstName + ' ' + u.LastName, ISNULL(u.Username, 'Reception Staff')) AS Receptionist,
                ISNULL(doc.Title + ' ' + doc.FirstName + ' ' + doc.LastName, 'Attending Doctor') AS DoctorName,
                FORMAT(CAST(i.IssueDate AS DATE), 'yyyy-MM-dd') AS IssueDate,
                i.SubTotal,
                ISNULL(i.TaxAmt, 0) AS TaxAmount,
                ISNULL(i.DiscountAmt, 0) AS DiscountAmount,
                i.TotalAmount,
                CASE 
                    WHEN i.TotalAmount = 0 THEN 0
                    WHEN EXISTS (
                        SELECT 1 FROM Payments pm 
                        WHERE pm.InvoiceId = i.Id 
                          AND (pm.PaymentMethod = 4 OR pm.Reference LIKE '%Waiv%' OR pm.Reference LIKE '%Free%')
                    ) THEN 0
                    ELSE ISNULL(i.PaidAmount, 0)
                END AS PaidAmount,
                CASE i.StatusId
                    WHEN 1 THEN 'Draft'
                    WHEN 2 THEN 'Issued'
                    WHEN 3 THEN 'PartiallyPaid'
                    WHEN 4 THEN 'Paid'
                    WHEN 5 THEN 'Void'
                    ELSE ISNULL(s.Name, 'Paid') END AS Status,
                CASE 
                    WHEN i.TotalAmount = 0 THEN CAST(1 AS BIT)
                    WHEN EXISTS (
                        SELECT 1 FROM Payments pm 
                        WHERE pm.InvoiceId = i.Id 
                          AND (pm.PaymentMethod = 4 OR pm.Reference LIKE '%Waiv%' OR pm.Reference LIKE '%Free%')
                    ) THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END AS IsWaived
            FROM Invoices i WITH (NOLOCK)
            LEFT JOIN Patients p WITH (NOLOCK) ON p.Id = i.PatientId
            LEFT JOIN InvoiceStatuses s WITH (NOLOCK) ON s.Id = i.StatusId
            LEFT JOIN Users u WITH (NOLOCK) ON u.Id = i.CreatedBy
            LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = i.DoctorId
            LEFT JOIN Staff doc WITH (NOLOCK) ON doc.Id = d.StaffId
            WHERE i.TenantId = @TenantId
              AND i.TotalAmount > 0
              AND (@DateFrom IS NULL OR CAST(i.IssueDate AS DATE) >= @DateFrom)
              AND (@DateTo IS NULL OR CAST(i.IssueDate AS DATE) <= @DateTo)
              AND (@Receptionist IS NULL OR @Receptionist = 'ALL' OR u.Username = @Receptionist OR ISNULL(u.FirstName + ' ' + u.LastName, '') = @Receptionist)
            ORDER BY i.IssueDate DESC, i.Id DESC";

        var rows = await conn.QueryAsync<dynamic>(sql, new {
            TenantId = tenantId,
            DateFrom = dateFrom?.Date,
            DateTo = dateTo?.Date,
            Receptionist = string.IsNullOrWhiteSpace(receptionist) || receptionist == "ALL" ? null : receptionist
        });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("age-stratified")]
    public async Task<IActionResult> GetAgeStratifiedReport(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? gender = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            WITH PatientVisits AS (
                SELECT DISTINCT 
                    p.Id, 
                    p.DateOfBirth, 
                    p.Gender,
                    DATEDIFF(YEAR, p.DateOfBirth, GETDATE()) - 
                    CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.DateOfBirth, GETDATE()), p.DateOfBirth) > GETDATE() THEN 1 ELSE 0 END AS Age
                FROM Patients p WITH (NOLOCK)
                JOIN Encounters e WITH (NOLOCK) ON e.PatientId = p.Id
                WHERE p.TenantId = @TenantId
                  AND (@DateFrom IS NULL OR CAST(e.EncounterDate AS DATE) >= @DateFrom)
                  AND (@DateTo IS NULL OR CAST(e.EncounterDate AS DATE) <= @DateTo)
                  AND (@Gender IS NULL OR @Gender = 'ALL' OR 
                       (@Gender = 'Male' AND p.Gender = 1) OR 
                       (@Gender = 'Female' AND p.Gender = 2))
            )
            SELECT 
                AgeGroup,
                AgeBracket,
                SUM(CASE WHEN Gender = 1 THEN 1 ELSE 0 END) AS MaleCount,
                SUM(CASE WHEN Gender = 2 THEN 1 ELSE 0 END) AS FemaleCount,
                COUNT(1) AS Count
            FROM (
                SELECT 
                    CASE 
                        WHEN Age < 1 THEN '<1'
                        WHEN Age BETWEEN 1 AND 4 THEN '1-4'
                        WHEN Age BETWEEN 5 AND 14 THEN '5-14'
                        WHEN Age BETWEEN 15 AND 29 THEN '15-29'
                        WHEN Age BETWEEN 30 AND 64 THEN '30-64'
                        ELSE '>=65'
                    END AS AgeGroup,
                    CASE 
                        WHEN Age < 1 THEN '< 1 Year (Infant)'
                        WHEN Age BETWEEN 1 AND 4 THEN '1 - 4 Years (Toddler)'
                        WHEN Age BETWEEN 5 AND 14 THEN '5 - 14 Years (Child)'
                        WHEN Age BETWEEN 15 AND 29 THEN '15 - 29 Years (Youth)'
                        WHEN Age BETWEEN 30 AND 64 THEN '30 - 64 Years (Adult)'
                        ELSE '>= 65 Years (Senior)'
                    END AS AgeBracket,
                    CASE 
                        WHEN Age < 1 THEN 1
                        WHEN Age BETWEEN 1 AND 4 THEN 2
                        WHEN Age BETWEEN 5 AND 14 THEN 3
                        WHEN Age BETWEEN 15 AND 29 THEN 4
                        WHEN Age BETWEEN 30 AND 64 THEN 5
                        ELSE 6
                    END AS SortOrder,
                    Gender
                FROM PatientVisits
            ) t
            GROUP BY AgeGroup, AgeBracket, SortOrder
            ORDER BY SortOrder";

        var rows = await conn.QueryAsync<dynamic>(sql, new {
            TenantId = tenantId,
            DateFrom = dateFrom?.Date,
            DateTo = dateTo?.Date,
            Gender = string.IsNullOrWhiteSpace(gender) || gender == "ALL" ? null : gender
        });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("sex-stratified")]
    public async Task<IActionResult> GetSexStratifiedReport(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? gender = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT 
                CASE p.Gender WHEN 1 THEN 'Male' WHEN 2 THEN 'Female' ELSE 'Other / Unspecified' END AS Gender,
                COUNT(DISTINCT p.Id) AS Count
            FROM Patients p WITH (NOLOCK)
            JOIN Encounters e WITH (NOLOCK) ON e.PatientId = p.Id
            WHERE p.TenantId = @TenantId
              AND (@DateFrom IS NULL OR CAST(e.EncounterDate AS DATE) >= @DateFrom)
              AND (@DateTo IS NULL OR CAST(e.EncounterDate AS DATE) <= @DateTo)
              AND (@Gender IS NULL OR @Gender = 'ALL' OR 
                   (@Gender = 'Male' AND p.Gender = 1) OR 
                   (@Gender = 'Female' AND p.Gender = 2))
            GROUP BY p.Gender
            ORDER BY Count DESC";

        var rows = await conn.QueryAsync<dynamic>(sql, new {
            TenantId = tenantId,
            DateFrom = dateFrom?.Date,
            DateTo = dateTo?.Date,
            Gender = string.IsNullOrWhiteSpace(gender) || gender == "ALL" ? null : gender
        });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("doctor-performance")]
    public async Task<IActionResult> GetDoctorPerformanceReport(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? doctor = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            WITH DocEncounters AS (
                SELECT 
                    e.DoctorId,
                    e.PatientId,
                    e.EncounterDate
                FROM Encounters e WITH (NOLOCK)
                WHERE e.TenantId = @TenantId
                  AND (@DateFrom IS NULL OR CAST(e.EncounterDate AS DATE) >= @DateFrom)
                  AND (@DateTo IS NULL OR CAST(e.EncounterDate AS DATE) <= @DateTo)
            ),
            ConsultationCounts AS (
                SELECT 
                    DoctorId, 
                    COUNT(1) AS Consultations
                FROM DocEncounters
                GROUP BY DoctorId
            ),
            DocProcedures AS (
                SELECT 
                    de.DoctorId,
                    COUNT(1) AS Procedures,
                    ISNULL(SUM(ii.Total), 0) AS ProcedureRevenue
                FROM DocEncounters de
                JOIN Invoices i WITH (NOLOCK) ON i.PatientId = de.PatientId AND i.IssueDate = de.EncounterDate
                JOIN InvoiceItems ii WITH (NOLOCK) ON ii.InvoiceId = i.Id AND ii.ItemType = 4
                GROUP BY de.DoctorId
            ),
            DocConsultationRevenue AS (
                SELECT 
                    de.DoctorId,
                    ISNULL(SUM(ii.Total), 0) AS ConsultationRevenue
                FROM DocEncounters de
                JOIN Invoices i WITH (NOLOCK) ON i.PatientId = de.PatientId AND i.IssueDate = de.EncounterDate
                JOIN InvoiceItems ii WITH (NOLOCK) ON ii.InvoiceId = i.Id AND ii.ItemType = 1
                GROUP BY de.DoctorId
            )
            SELECT 
                u.Id AS UserId,
                d.Id AS DoctorId,
                ISNULL(u.FirstName + ' ' + u.LastName, u.Username) AS DoctorName,
                ISNULL(sp.Name, ISNULL(st.Department, 'General Practice')) AS Specialty,
                ISNULL(cc.Consultations, 0) AS Consultations,
                ISNULL(dp.Procedures, 0) AS Procedures,
                ISNULL(dp.ProcedureRevenue, 0) AS ProcedureRevenue,
                ISNULL(cr.ConsultationRevenue, 0) + ISNULL(dp.ProcedureRevenue, 0) AS TotalRevenue
            FROM Users u WITH (NOLOCK)
            JOIN UserRoles ur WITH (NOLOCK) ON ur.UserId = u.Id
            JOIN Roles r WITH (NOLOCK) ON r.Id = ur.RoleId
            LEFT JOIN Staff st WITH (NOLOCK) ON st.UserId = u.Id
            LEFT JOIN Doctors d WITH (NOLOCK) ON d.StaffId = st.Id
            LEFT JOIN Specializations sp WITH (NOLOCK) ON sp.Id = d.SpecializationId
            LEFT JOIN ConsultationCounts cc ON cc.DoctorId = d.Id
            LEFT JOIN DocProcedures dp ON dp.DoctorId = d.Id
            LEFT JOIN DocConsultationRevenue cr ON cr.DoctorId = d.Id
            WHERE (r.Name LIKE '%Doctor%' OR r.Name LIKE '%Physician%')
              AND (@Doctor IS NULL OR @Doctor = 'ALL' OR u.Username = @Doctor OR ISNULL(u.FirstName + ' ' + u.LastName, '') = @Doctor)
            ORDER BY TotalRevenue DESC, Consultations DESC";

        var rows = await conn.QueryAsync<dynamic>(sql, new {
            TenantId = tenantId,
            DateFrom = dateFrom?.Date,
            DateTo = dateTo?.Date,
            Doctor = string.IsNullOrWhiteSpace(doctor) || doctor == "ALL" ? null : doctor
        });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("diagnosis")]
    public async Task<IActionResult> GetDiagnosisReport(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? category = null,
        [FromQuery] int limit = 50)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT TOP (@Limit)
                ISNULL(NULLIF(d.DiagnosisCode, 'LEGACY'), 'CLINICAL') AS Code,
                d.DiagnosisText AS Description,
                ISNULL(dc.Category, 'Dermatology & General Clinical') AS Category,
                COUNT(1) AS Count
            FROM Diagnoses d WITH (NOLOCK)
            JOIN Encounters e WITH (NOLOCK) ON e.Id = d.EncounterId
            LEFT JOIN DiagnosisCodes dc WITH (NOLOCK) ON dc.Code = d.DiagnosisCode
            WHERE e.TenantId = @TenantId
              AND (@DateFrom IS NULL OR CAST(e.EncounterDate AS DATE) >= @DateFrom)
              AND (@DateTo IS NULL OR CAST(e.EncounterDate AS DATE) <= @DateTo)
              AND (@Category IS NULL OR @Category = 'ALL' OR dc.Category LIKE '%' + @Category + '%' OR d.DiagnosisText LIKE '%' + @Category + '%')
            GROUP BY ISNULL(NULLIF(d.DiagnosisCode, 'LEGACY'), 'CLINICAL'), d.DiagnosisText, ISNULL(dc.Category, 'Dermatology & General Clinical')
            ORDER BY Count DESC";

        var rows = await conn.QueryAsync<dynamic>(sql, new {
            TenantId = tenantId,
            DateFrom = dateFrom?.Date,
            DateTo = dateTo?.Date,
            Category = string.IsNullOrWhiteSpace(category) || category == "ALL" ? null : category,
            Limit = limit <= 0 ? 50 : limit
        });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("procedures")]
    public async Task<IActionResult> GetProcedureReport(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? category = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT 
                ii.Description AS ProcedureName,
                CASE 
                    WHEN ii.Description LIKE '%FACIAL%' THEN 'Facial Aesthetics'
                    WHEN ii.Description LIKE '%PRP%' THEN 'PRP Regenerative'
                    WHEN ii.Description LIKE '%Steroid%' THEN 'Intralesional Injection'
                    WHEN ii.Description LIKE '%Electro%' THEN 'Electrotherapy'
                    WHEN ii.Description LIKE '%Acne%' OR ii.Description LIKE '%Scar%' THEN 'Acne & Scarring'
                    WHEN ii.Description LIKE '%Cryo%' THEN 'Cryosurgery'
                    WHEN ii.Description LIKE '%pigment%' THEN 'Laser & Pigment'
                    WHEN ii.Description LIKE '%Finasteride%' OR ii.Description LIKE '%Minoxidil%' THEN 'Hair Restoration'
                    ELSE 'Clinical Procedure'
                END AS Category,
                COUNT(1) AS OrderCount,
                CAST(AVG(ii.UnitPrice) AS DECIMAL(10,2)) AS UnitPrice,
                SUM(ii.Total) AS TotalRevenue
            FROM InvoiceItems ii WITH (NOLOCK)
            JOIN Invoices i WITH (NOLOCK) ON i.Id = ii.InvoiceId
            WHERE i.TenantId = @TenantId
              AND (i.StatusId = 4 OR i.PaidAmount >= i.TotalAmount)
              AND i.TotalAmount > 0
              AND (
                  ii.ItemType = 3
                  OR EXISTS (SELECT 1 FROM Services s WITH (NOLOCK) WHERE s.Name = ii.Description AND s.Category IN ('Procedure', 'Facial'))
                  OR ii.Description LIKE '%PRP%'
                  OR ii.Description LIKE '%FACIAL%'
                  OR ii.Description LIKE '%Treatment%'
                  OR ii.Description LIKE '%Cryo%'
                  OR ii.Description LIKE '%Electro%'
                  OR ii.Description LIKE '%Biopsy%'
                  OR ii.Description LIKE '%Injection%'
                  OR ii.Description LIKE '%Scar%'
                  OR ii.Description LIKE '%Steroid%'
                  OR ii.Description LIKE '%Peel%'
              )
              AND (@DateFrom IS NULL OR CAST(i.IssueDate AS DATE) >= @DateFrom)
              AND (@DateTo IS NULL OR CAST(i.IssueDate AS DATE) <= @DateTo)
            GROUP BY ii.Description
            HAVING (@Category IS NULL OR @Category = 'ALL' OR 
                    (CASE 
                        WHEN ii.Description LIKE '%FACIAL%' THEN 'Facial Aesthetics'
                        WHEN ii.Description LIKE '%PRP%' THEN 'PRP Regenerative'
                        WHEN ii.Description LIKE '%Steroid%' THEN 'Intralesional Injection'
                        WHEN ii.Description LIKE '%Electro%' THEN 'Electrotherapy'
                        WHEN ii.Description LIKE '%Acne%' OR ii.Description LIKE '%Scar%' THEN 'Acne & Scarring'
                        WHEN ii.Description LIKE '%Cryo%' THEN 'Cryosurgery'
                        WHEN ii.Description LIKE '%pigment%' THEN 'Laser & Pigment'
                        WHEN ii.Description LIKE '%Finasteride%' OR ii.Description LIKE '%Minoxidil%' THEN 'Hair Restoration'
                        ELSE 'Clinical Procedure'
                    END) = @Category)
            ORDER BY OrderCount DESC";

        var rows = await conn.QueryAsync<dynamic>(sql, new {
            TenantId = tenantId,
            DateFrom = dateFrom?.Date,
            DateTo = dateTo?.Date,
            Category = string.IsNullOrWhiteSpace(category) || category == "ALL" ? null : category
        });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("receptionists")]
    public async Task<IActionResult> GetReceptionists()
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT DISTINCT
                u.Id,
                u.Username,
                ISNULL(u.FirstName + ' ' + u.LastName, u.Username) AS FullName,
                r.Name AS RoleName
            FROM Users u WITH (NOLOCK)
            JOIN UserRoles ur WITH (NOLOCK) ON ur.UserId = u.Id
            JOIN Roles r WITH (NOLOCK) ON r.Id = ur.RoleId
            WHERE r.Name LIKE '%Reception%' OR r.Name LIKE '%Cashier%'
            ORDER BY FullName";

        var rows = await conn.QueryAsync<dynamic>(sql);
        return Ok(ApiResponse<object>.Ok(rows));
    }
    [HttpGet("my-patient-summary")]
    public async Task<IActionResult> GetMyPatientSummary(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] int? doctorId = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        // 1. Resolve target Doctor ID
        int? targetDoctorId = doctorId;
        if (!targetDoctorId.HasValue || targetDoctorId.Value <= 0)
        {
            int? currentUserId = null;
            var claimVal = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(claimVal, out int parsedId))
                currentUserId = parsedId;

            string? currentUsername = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;

            targetDoctorId = await conn.QueryFirstOrDefaultAsync<int?>(@"
                SELECT TOP 1 d.Id
                FROM Doctors d WITH (NOLOCK)
                JOIN Staff st WITH (NOLOCK) ON st.Id = d.StaffId
                LEFT JOIN Users u WITH (NOLOCK) ON u.Id = st.UserId
                WHERE (@UserId IS NOT NULL AND st.UserId = @UserId)
                   OR (@Username IS NOT NULL AND u.Username = @Username)",
                new { UserId = currentUserId, Username = currentUsername });
        }

        if (!targetDoctorId.HasValue)
        {
            targetDoctorId = await conn.QueryFirstOrDefaultAsync<int?>("SELECT TOP 1 Id FROM Doctors ORDER BY Id ASC");
        }

        if (!targetDoctorId.HasValue)
            return Ok(ApiResponse<object>.Ok(new List<object>()));

        // 2. Fetch doctor procedures and consultations
        var sql = @"
            WITH DocConsultations AS (
                SELECT 
                    e.Id AS EncounterId,
                    e.PatientId,
                    p.MRN,
                    p.FirstName + ' ' + p.LastName AS PatientName,
                    CASE p.Gender WHEN 1 THEN 'Male' WHEN 2 THEN 'Female' ELSE 'Other' END AS Gender,
                    DATEDIFF(YEAR, p.DateOfBirth, GETDATE()) - 
                    CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.DateOfBirth, GETDATE()), p.DateOfBirth) > GETDATE() THEN 1 ELSE 0 END AS Age,
                    FORMAT(CAST(e.EncounterDate AS DATE), 'yyyy-MM-dd') AS VisitDate,
                    'Consultation' AS ActivityType,
                    ISNULL(ci.Description, 'Consultation') AS ServiceName,
                    ISNULL(ci.Total, ISNULL(inv.TotalAmount, 0)) AS Fee,
                    ISNULL(invS.Name, 'Completed') AS Status
                FROM Encounters e WITH (NOLOCK)
                JOIN Patients p WITH (NOLOCK) ON p.Id = e.PatientId
                LEFT JOIN Invoices inv WITH (NOLOCK) ON inv.EncounterId = e.Id
                LEFT JOIN InvoiceItems ci WITH (NOLOCK) ON ci.InvoiceId = inv.Id AND ci.ItemType = 1
                LEFT JOIN InvoiceStatuses invS WITH (NOLOCK) ON invS.Id = inv.StatusId
                WHERE e.TenantId = @TenantId
                  AND e.DoctorId = @TargetDoctorId
                  AND (@DateFrom IS NULL OR CAST(e.EncounterDate AS DATE) >= @DateFrom)
                  AND (@DateTo IS NULL OR CAST(e.EncounterDate AS DATE) <= @DateTo)
            ),
            DocProcedures AS (
                -- Procedures from InvoiceItems (ItemType = 4) linked to doctor's encounters
                SELECT 
                    e.Id AS EncounterId,
                    e.PatientId,
                    p.MRN,
                    p.FirstName + ' ' + p.LastName AS PatientName,
                    CASE p.Gender WHEN 1 THEN 'Male' WHEN 2 THEN 'Female' ELSE 'Other' END AS Gender,
                    DATEDIFF(YEAR, p.DateOfBirth, GETDATE()) - 
                    CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.DateOfBirth, GETDATE()), p.DateOfBirth) > GETDATE() THEN 1 ELSE 0 END AS Age,
                    FORMAT(CAST(COALESCE(inv.IssueDate, e.EncounterDate) AS DATE), 'yyyy-MM-dd') AS VisitDate,
                    'Procedure' AS ActivityType,
                    pii.Description AS ServiceName,
                    pii.Total AS Fee,
                    ISNULL(invS.Name, 'Completed') AS Status
                FROM InvoiceItems pii WITH (NOLOCK)
                JOIN Invoices inv WITH (NOLOCK) ON inv.Id = pii.InvoiceId
                JOIN Encounters e WITH (NOLOCK) ON e.Id = inv.EncounterId
                JOIN Patients p WITH (NOLOCK) ON p.Id = e.PatientId
                LEFT JOIN InvoiceStatuses invS WITH (NOLOCK) ON invS.Id = inv.StatusId
                WHERE pii.ItemType = 4
                  AND e.TenantId = @TenantId
                  AND e.DoctorId = @TargetDoctorId
                  AND (@DateFrom IS NULL OR CAST(COALESCE(inv.IssueDate, e.EncounterDate) AS DATE) >= @DateFrom)
                  AND (@DateTo IS NULL OR CAST(COALESCE(inv.IssueDate, e.EncounterDate) AS DATE) <= @DateTo)

                UNION ALL

                -- Procedures from ProcedureOrders table if any are recorded there
                SELECT 
                    po.Id AS EncounterId,
                    po.PatientId,
                    p.MRN,
                    p.FirstName + ' ' + p.LastName AS PatientName,
                    CASE p.Gender WHEN 1 THEN 'Male' WHEN 2 THEN 'Female' ELSE 'Other' END AS Gender,
                    DATEDIFF(YEAR, p.DateOfBirth, GETDATE()) - 
                    CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.DateOfBirth, GETDATE()), p.DateOfBirth) > GETDATE() THEN 1 ELSE 0 END AS Age,
                    FORMAT(CAST(po.CreatedAt AS DATE), 'yyyy-MM-dd') AS VisitDate,
                    'Procedure' AS ActivityType,
                    po.ProcedureName AS ServiceName,
                    0 AS Fee,
                    CASE po.StatusId WHEN 2 THEN 'Completed' WHEN 3 THEN 'Cancelled' ELSE 'Ordered' END AS Status
                FROM ProcedureOrders po WITH (NOLOCK)
                JOIN Patients p WITH (NOLOCK) ON p.Id = po.PatientId
                WHERE po.TenantId = @TenantId
                  AND po.OrderedBy = @TargetDoctorId
                  AND (@DateFrom IS NULL OR CAST(po.CreatedAt AS DATE) >= @DateFrom)
                  AND (@DateTo IS NULL OR CAST(po.CreatedAt AS DATE) <= @DateTo)
            )
            SELECT * FROM (
                SELECT * FROM DocConsultations
                UNION ALL
                SELECT * FROM DocProcedures
            ) combined
            ORDER BY VisitDate DESC";

        var rows = await conn.QueryAsync<dynamic>(sql, new {
            TenantId = tenantId,
            TargetDoctorId = targetDoctorId.Value,
            DateFrom = dateFrom?.Date,
            DateTo = dateTo?.Date
        });

        return Ok(ApiResponse<object>.Ok(rows));
    }
}
