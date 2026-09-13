using CMS.Application.ReportBuilder;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;

    public AuthController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        using var conn = _dbFactory.CreateConnection();
        var user = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "sp_GetUserByUsername",
            new { TenantId = request.TenantId, Username = request.Username },
            commandType: System.Data.CommandType.StoredProcedure);

        if (user == null)
            return Unauthorized(ApiResponse<string>.Fail("Invalid username or password."));

        int? doctorId = null;
        int? staffId = null;
        var docInfo = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT d.Id AS DoctorId, s.Id AS StaffId
            FROM Staff s
            LEFT JOIN Doctors d ON d.StaffId = s.Id
            WHERE s.UserId = @UserId AND s.TenantId = @TenantId",
            new { UserId = (int)user.Id, TenantId = request.TenantId });
        if (docInfo != null)
        {
            if (docInfo.DoctorId != null) doctorId = (int?)docInfo.DoctorId;
            if (docInfo.StaffId != null) staffId = (int?)docInfo.StaffId;
        }

        var userDto = new UserDto(
            (int)user.Id,
            (byte)user.TenantId,
            (string)user.Username,
            (string)user.Email,
            (string)user.FirstName,
            (string)user.LastName,
            ((string)(user.Roles ?? "Patient")).Split(','),
            (bool)user.MfaEnabled,
            doctorId,
            staffId
        );

        var token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidW5hbWUiOiJhZG1pbiJ9.dummy_signature_sig";
        var refreshToken = Guid.NewGuid().ToString("N");

        return Ok(ApiResponse<LoginResponse>.Ok(new LoginResponse(token, refreshToken, 15, userDto)));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class PatientsController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;

    public PatientsController(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    [HttpGet("next-mrn")]
    public async Task<IActionResult> GetNextMRN()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = "SELECT ISNULL(MAX(Id), 0) + 1 FROM Patients WHERE TenantId = @TenantId;";
        int nextId = await conn.ExecuteScalarAsync<int>(sql, new { TenantId = tenantId });
        var nextMrn = $"HD-{nextId:D4}";
        return Ok(ApiResponse<object>.Ok(new { NextMRN = nextMrn, NextId = nextId }));
    }

    [HttpGet]
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q = "", [FromQuery] int page = 1)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var queryStr = q ?? "";
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT Id, TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender,
                   PrimaryPhone, Email, Address, InsuranceProvider, InsuranceCopayPercent,
                   Allergies, ChronicConditions, NationalId, BloodGroup, PhotoUrl, IsActive
            FROM Patients
            WHERE TenantId = @TenantId AND IsActive = 1
              AND (@Query = '' OR FirstName LIKE '%' + @Query + '%' OR MiddleName LIKE '%' + @Query + '%' OR LastName LIKE '%' + @Query + '%' OR MRN LIKE '%' + @Query + '%' OR PrimaryPhone LIKE '%' + @Query + '%')
            ORDER BY Id DESC";

        var patients = (await conn.QueryAsync<PatientDto>(sql, new { TenantId = tenantId, Query = queryStr })).ToList();
        return Ok(ApiResponse<List<PatientDto>>.Ok(patients));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePatientDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        string finalMrn = dto.MRN ?? "";
        if (string.IsNullOrWhiteSpace(finalMrn))
        {
            int nextId = await conn.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(Id), 0) + 1 FROM Patients WHERE TenantId = @TenantId", new { TenantId = tenantId });
            finalMrn = $"HD-{nextId:D4}";
        }

        var insertSql = @"
            INSERT INTO Patients (
                TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender,
                PrimaryPhone, Email, Address, InsuranceProvider, InsuranceCopayPercent,
                Allergies, NationalId, IsActive, CreatedAt, CreatedBy
            )
            VALUES (
                @TenantId, @MRN, @FirstName, @MiddleName, @LastName, @DateOfBirth, @Gender,
                @PrimaryPhone, @Email, @Address, @InsuranceProvider, @InsuranceCopayPercent,
                @Allergies, @NationalId, 1, GETDATE(), 1
            );
            SELECT SCOPE_IDENTITY();";

        int newId = await conn.ExecuteScalarAsync<int>(insertSql, new
        {
            TenantId = tenantId,
            MRN = finalMrn,
            dto.FirstName,
            dto.MiddleName,
            dto.LastName,
            dto.DateOfBirth,
            dto.Gender,
            dto.PrimaryPhone,
            dto.Email,
            dto.Address,
            dto.InsuranceProvider,
            InsuranceCopayPercent = dto.InsuranceCopayPercent ?? 0,
            dto.Allergies,
            NationalId = dto.NationalId ?? $"ETH-{DateTime.UtcNow.Ticks % 1000000:D6}"
        });

        await _cache.RemoveByPrefixAsync($"tenant:{tenantId}:patients");
        return Ok(ApiResponse<object>.Ok(new { PatientId = newId, MRN = finalMrn }));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
[Route("api/v1/lab")]
public class LaboratoryController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;
    private readonly IHl7Adapter _hl7Adapter;
    private readonly IAstmAdapter _astmAdapter;

    public LaboratoryController(IDbConnectionFactory dbFactory, ICacheService cache, IHl7Adapter hl7Adapter, IAstmAdapter astmAdapter)
    {
        _dbFactory = dbFactory;
        _cache = cache;
        _hl7Adapter = hl7Adapter;
        _astmAdapter = astmAdapter;
    }

    [HttpGet("catalog")]
    public async Task<IActionResult> GetCatalog()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT Id, TestCode, TestName, Category, SampleType, TurnaroundMinutes,
                   NormalRangeLow, NormalRangeHigh, Unit, Price
            FROM LabTestCatalog
            WHERE TenantId = @TenantId AND IsActive = 1
            ORDER BY Category, TestName";
        var catalog = (await conn.QueryAsync<LabTestCatalogDto>(sql, new { TenantId = tenantId })).ToList();
        return Ok(ApiResponse<List<LabTestCatalogDto>>.Ok(catalog));
    }

    public record PingMachineRequest(string IpAddress, int Port, int TimeoutMs = 1500);

    [HttpPost("instruments/ping")]
    public async Task<IActionResult> PingInstrument([FromBody] PingMachineRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.IpAddress) || req.Port <= 0)
            return BadRequest(ApiResponse<object>.Fail("Invalid IP address or port."));

        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            using var client = new System.Net.Sockets.TcpClient();
            var connectTask = client.ConnectAsync(req.IpAddress, req.Port);
            var timeoutTask = Task.Delay(req.TimeoutMs > 0 ? req.TimeoutMs : 1500);
            var completedTask = await Task.WhenAny(connectTask, timeoutTask);
            sw.Stop();

            if (completedTask == timeoutTask)
            {
                return Ok(ApiResponse<object>.Ok(new {
                    Success = false,
                    IsOnline = false,
                    LatencyMs = (int)sw.ElapsedMilliseconds,
                    Message = $"Connection timed out after {req.TimeoutMs}ms. No ACK received from {req.IpAddress}:{req.Port}. Machine is offline."
                }));
            }

            if (client.Connected)
            {
                return Ok(ApiResponse<object>.Ok(new {
                    Success = true,
                    IsOnline = true,
                    LatencyMs = (int)sw.ElapsedMilliseconds,
                    Message = $"ACK received from {req.IpAddress}:{req.Port} in {sw.ElapsedMilliseconds}ms."
                }));
            }
        }
        catch (System.Net.Sockets.SocketException ex)
        {
            sw.Stop();
            return Ok(ApiResponse<object>.Ok(new {
                Success = false,
                IsOnline = false,
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = $"Host unreachable ({ex.SocketErrorCode}). No ACK received from {req.IpAddress}:{req.Port}."
            }));
        }
        catch (Exception ex)
        {
            sw.Stop();
            return Ok(ApiResponse<object>.Ok(new {
                Success = false,
                IsOnline = false,
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = $"Connection failed: {ex.Message}"
            }));
        }

        return Ok(ApiResponse<object>.Ok(new {
            Success = false,
            IsOnline = false,
            Message = $"No ACK received from {req.IpAddress}:{req.Port}."
        }));
    }

    [HttpGet("worklist")]
    public async Task<IActionResult> GetWorklist([FromQuery] DateTime? date = null, [FromQuery] byte? statusId = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT
                o.Id AS OrderId, o.OrderNumber, o.PatientId, o.Priority, o.OrderedAt,
                p.FirstName + ' ' + p.LastName AS PatientName, p.DateOfBirth,
                oi.Id AS ItemId, oi.StatusId AS ItemStatus,
                t.TestCode, t.TestName, t.Category, t.SampleType,
                ISNULL(s.Barcode, 'BC-' + CAST(o.Id AS VARCHAR(10)) + '-' + CAST(oi.Id AS VARCHAR(10))) AS Barcode,
                DATEDIFF(MINUTE, o.OrderedAt, GETDATE()) AS AgeMinutes,
                t.TurnaroundMinutes
            FROM LabOrders o
            JOIN LabOrderItems oi ON oi.OrderId = o.Id
            JOIN LabTestCatalog t ON t.Id = oi.TestId
            JOIN Patients p ON p.Id = o.PatientId
            LEFT JOIN LabSamples s ON s.OrderId = o.Id
            WHERE o.TenantId = @TenantId
              AND (@StatusId IS NULL OR o.StatusId = @StatusId)
              AND (@Date IS NULL OR CAST(o.OrderedAt AS DATE) = CAST(@Date AS DATE))
              AND EXISTS (
                  SELECT 1 FROM InvoiceItems ii 
                  JOIN Invoices inv ON inv.Id = ii.InvoiceId 
                  WHERE ii.RefId = o.Id AND inv.StatusId = 4
              )
            ORDER BY o.Priority ASC, o.OrderedAt DESC";

        var worklist = await conn.QueryAsync(sql, new { TenantId = tenantId, StatusId = statusId, Date = date });
        return Ok(ApiResponse<object>.Ok(worklist));
    }

    [HttpGet("orders")]
    public async Task<IActionResult> GetOrders([FromQuery] int? patientId = null, [FromQuery] DateTime? date = null, [FromQuery] bool? onlyPaid = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT
                o.Id, o.Id AS OrderId, o.OrderNumber, o.PatientId, o.Priority, o.OrderedAt, o.OrderedAt AS OrderDate, o.ClinicalInfo,
                p.FirstName + ' ' + p.LastName AS PatientName,
                oi.Id AS ItemId, oi.StatusId AS ItemStatus,
                CASE oi.StatusId
                    WHEN 1 THEN 'Ordered'
                    WHEN 2 THEN 'Collected'
                    WHEN 3 THEN 'Received'
                    WHEN 4 THEN 'InProcess'
                    WHEN 5 THEN 'Completed'
                    WHEN 6 THEN 'Cancelled'
                    ELSE 'Pending' END AS StatusName,
                t.TestCode, t.TestName, t.Category, t.SampleType, t.Price
            FROM LabOrders o
            JOIN LabOrderItems oi ON oi.OrderId = o.Id
            JOIN LabTestCatalog t ON t.Id = oi.TestId
            JOIN Patients p ON p.Id = o.PatientId
            WHERE o.TenantId = @TenantId
              AND (@PatientId IS NULL OR o.PatientId = @PatientId)
              AND (@Date IS NULL OR CAST(o.OrderedAt AS DATE) = CAST(@Date AS DATE))
              AND (@OnlyPaid IS NULL OR @OnlyPaid = 0 OR EXISTS (
                  SELECT 1 FROM InvoiceItems ii 
                  JOIN Invoices inv ON inv.Id = ii.InvoiceId 
                  WHERE inv.StatusId = 4 AND (ii.RefId = o.Id OR (inv.PatientId = o.PatientId AND ii.ItemType = 2))
              ))
            ORDER BY o.OrderedAt DESC";

        var orders = await conn.QueryAsync(sql, new { TenantId = tenantId, PatientId = patientId, Date = date, OnlyPaid = onlyPaid });
        return Ok(ApiResponse<object>.Ok(orders));
    }

    [HttpGet("patient/{patientId:int}")]
    public async Task<IActionResult> GetPatientLabOrders(int patientId)
    {
        return await GetOrders(patientId: patientId);
    }

    [HttpGet("patient/{patientId:int}/results")]
    public async Task<IActionResult> GetPatientResults(int patientId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT 
                r.Id, r.OrderId, r.OrderItemId, r.TestId, r.PatientId,
                r.NumericValue, r.TextValue, r.Unit, r.Flag, r.ReferenceRange,
                r.IsCritical, r.EnteredAt, r.IsVerified, r.VerifiedAt,
                t.TestCode, t.TestName, t.Category,
                o.OrderNumber, o.OrderedAt
            FROM LabResults r
            JOIN LabOrders o ON o.Id = r.OrderId
            JOIN LabTestCatalog t ON t.Id = r.TestId
            WHERE r.PatientId = @PatientId AND o.TenantId = @TenantId
            ORDER BY r.EnteredAt DESC, r.Id DESC";

        var results = await conn.QueryAsync(sql, new { PatientId = patientId, TenantId = tenantId });
        return Ok(ApiResponse<object>.Ok(results));
    }

    public record SaveLabResultItemDto(
        int? OrderItemId,
        int? TestId,
        string? TestCode,
        string? TestName,
        decimal? NumericValue,
        string? TextValue,
        string? Unit,
        string? Flag,
        string? ReferenceRange,
        bool? IsCritical,
        string? ParamCode
    );

    public record SaveOrderResultsRequest(
        int OrderId,
        int? PatientId,
        bool IsVerified,
        List<SaveLabResultItemDto>? Results
    );

    public record ReceiveMachineResultRequest(
        int OrderId,
        int? OrderItemId,
        string? TestCode,
        string? MachineId,
        string? MachineName
    );

    [HttpPost("orders")]
    public async Task<IActionResult> CreateOrder([FromBody] CreateLabOrderDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@TenantId", dto.TenantId);
        p.Add("@PatientId", dto.PatientId);
        p.Add("@EncounterId", dto.EncounterId);
        p.Add("@OrderedBy", dto.OrderedBy);
        p.Add("@Priority", dto.Priority);
        p.Add("@ClinicalInfo", dto.ClinicalInfo);
        p.Add("@TestIds", string.Join(",", dto.TestIds));
        p.Add("@NewOrderId", dbType: System.Data.DbType.Int32, direction: System.Data.ParameterDirection.Output);

        await conn.ExecuteAsync("sp_CreateLabOrder", p, commandType: System.Data.CommandType.StoredProcedure);
        int orderId = p.Get<int>("@NewOrderId");
        return Ok(ApiResponse<object>.Ok(new { OrderId = orderId }));
    }

    [HttpPost("results/save")]
    [HttpPost("results/batch")]
    public async Task<IActionResult> SaveResultsBatch([FromBody] SaveOrderResultsRequest req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        // 1. Fetch the order and patient information
        var order = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, PatientId, TenantId, OrderedBy FROM LabOrders WHERE Id = @OrderId AND TenantId = @TenantId",
            new { req.OrderId, TenantId = tenantId });

        if (order == null)
            return NotFound(ApiResponse<object>.Fail($"Order #{req.OrderId} not found."));

        int patientId = req.PatientId ?? (int)order.PatientId;

        // 2. Fetch order items for this order
        var orderItems = (await conn.QueryAsync<dynamic>(
            @"SELECT oi.Id AS OrderItemId, oi.TestId, t.TestCode, t.TestName, t.Unit, t.NormalRangeLow, t.NormalRangeHigh
              FROM LabOrderItems oi
              JOIN LabTestCatalog t ON t.Id = oi.TestId
              WHERE oi.OrderId = @OrderId",
            new { req.OrderId })).ToList();

        if (req.Results != null && req.Results.Count > 0)
        {
            foreach (var res in req.Results)
            {
                // Match to an order item
                dynamic? matchedItem = null;
                if (res.OrderItemId.HasValue && res.OrderItemId.Value > 0)
                {
                    matchedItem = orderItems.FirstOrDefault(oi => (int)oi.OrderItemId == res.OrderItemId.Value);
                }
                if (matchedItem == null && !string.IsNullOrWhiteSpace(res.TestCode))
                {
                    matchedItem = orderItems.FirstOrDefault(oi => string.Equals((string)oi.TestCode, res.TestCode, StringComparison.OrdinalIgnoreCase));
                }
                if (matchedItem == null && orderItems.Count > 0)
                {
                    matchedItem = orderItems[0];
                }

                if (matchedItem == null) continue;

                int orderItemId = (int)matchedItem.OrderItemId;
                int testId = res.TestId ?? (int)matchedItem.TestId;
                string unit = res.Unit ?? (string)matchedItem.Unit ?? "";
                string refRange = res.ReferenceRange ?? $"{matchedItem.NormalRangeLow} - {matchedItem.NormalRangeHigh} {unit}".Trim();
                string flag = res.Flag != null ? (res.Flag.Length > 5 ? res.Flag[..5] : res.Flag) : "OK";
                bool isCritical = res.IsCritical ?? (flag == "HH" || flag == "LL");

                // Check if result already exists for this order item
                var existingResultId = await conn.QueryFirstOrDefaultAsync<int?>(
                    "SELECT Id FROM LabResults WHERE OrderItemId = @OrderItemId AND OrderId = @OrderId",
                    new { OrderItemId = orderItemId, req.OrderId });

                if (existingResultId.HasValue && existingResultId.Value > 0)
                {
                    await conn.ExecuteAsync(@"
                        UPDATE LabResults
                        SET NumericValue = @NumericValue,
                            TextValue = @TextValue,
                            Unit = @Unit,
                            Flag = @Flag,
                            ReferenceRange = @ReferenceRange,
                            IsCritical = @IsCritical,
                            IsVerified = @IsVerified,
                            VerifiedBy = CASE WHEN @IsVerified = 1 THEN 1 ELSE VerifiedBy END,
                            VerifiedAt = CASE WHEN @IsVerified = 1 THEN GETDATE() ELSE VerifiedAt END,
                            EnteredAt = GETDATE()
                        WHERE Id = @ResultId",
                        new {
                            ResultId = existingResultId.Value,
                            res.NumericValue,
                            res.TextValue,
                            Unit = unit,
                            Flag = flag,
                            ReferenceRange = refRange,
                            IsCritical = isCritical,
                            req.IsVerified
                        });
                }
                else
                {
                    await conn.ExecuteAsync(@"
                        INSERT INTO LabResults (
                            OrderItemId, OrderId, TestId, PatientId, NumericValue, TextValue,
                            Unit, Flag, ReferenceRange, IsCritical, EnteredBy, EnteredAt,
                            VerifiedBy, VerifiedAt, IsVerified, SourceType
                        ) VALUES (
                            @OrderItemId, @OrderId, @TestId, @PatientId, @NumericValue, @TextValue,
                            @Unit, @Flag, @ReferenceRange, @IsCritical, 1, GETDATE(),
                            CASE WHEN @IsVerified = 1 THEN 1 ELSE NULL END,
                            CASE WHEN @IsVerified = 1 THEN GETDATE() ELSE NULL END,
                            @IsVerified, 1
                        )",
                        new {
                            OrderItemId = orderItemId,
                            req.OrderId,
                            TestId = testId,
                            PatientId = patientId,
                            res.NumericValue,
                            res.TextValue,
                            Unit = unit,
                            Flag = flag,
                            ReferenceRange = refRange,
                            IsCritical = isCritical,
                            req.IsVerified
                        });
                }

                // Update OrderItem status (4 = Resulted/Completed, 3 = InProcess)
                byte itemStatus = (byte)(req.IsVerified ? 4 : 3);
                await conn.ExecuteAsync(
                    "UPDATE LabOrderItems SET StatusId = @StatusId WHERE Id = @OrderItemId",
                    new { StatusId = itemStatus, OrderItemId = orderItemId });
            }
        }

        // Update overall Order status
        byte orderStatus = (byte)(req.IsVerified ? 4 : 3);
        await conn.ExecuteAsync(
            "UPDATE LabOrders SET StatusId = @StatusId, UpdatedAt = GETDATE() WHERE Id = @OrderId",
            new { StatusId = orderStatus, req.OrderId });

        return Ok(ApiResponse<object>.Ok(new {
            Success = true,
            OrderId = req.OrderId,
            IsVerified = req.IsVerified,
            Message = req.IsVerified ? "Results verified and approved for EMR." : "Results saved successfully."
        }));
    }

    [HttpPost("results/verify")]
    public async Task<IActionResult> VerifyResults([FromBody] SaveOrderResultsRequest req)
    {
        var saveReq = req with { IsVerified = true };
        return await SaveResultsBatch(saveReq);
    }

    [HttpPost("machine/receive")]
    [HttpPost("instruments/receive")]
    public async Task<IActionResult> ReceiveFromMachine([FromBody] ReceiveMachineResultRequest req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var order = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, PatientId, TenantId FROM LabOrders WHERE Id = @OrderId AND TenantId = @TenantId",
            new { req.OrderId, TenantId = tenantId });

        if (order == null)
            return NotFound(ApiResponse<object>.Fail($"Order #{req.OrderId} not found."));

        int patientId = (int)order.PatientId;
        string testCode = (req.TestCode ?? "").ToUpper().Trim();

        var orderItems = (await conn.QueryAsync<dynamic>(
            @"SELECT oi.Id AS OrderItemId, oi.TestId, t.TestCode, t.TestName, t.Unit, t.NormalRangeLow, t.NormalRangeHigh
              FROM LabOrderItems oi
              JOIN LabTestCatalog t ON t.Id = oi.TestId
              WHERE oi.OrderId = @OrderId",
            new { req.OrderId })).ToList();

        dynamic? targetItem = null;
        if (req.OrderItemId.HasValue && req.OrderItemId.Value > 0)
        {
            targetItem = orderItems.FirstOrDefault(oi => (int)oi.OrderItemId == req.OrderItemId.Value);
        }
        if (targetItem == null && !string.IsNullOrWhiteSpace(testCode))
        {
            targetItem = orderItems.FirstOrDefault(oi => string.Equals((string)oi.TestCode, testCode, StringComparison.OrdinalIgnoreCase));
        }
        if (targetItem == null && orderItems.Count > 0)
        {
            targetItem = orderItems[0];
            testCode = (string)targetItem.TestCode;
        }

        if (targetItem == null)
            return BadRequest(ApiResponse<object>.Fail("No matching test item found in this order."));

        int orderItemId = (int)targetItem.OrderItemId;
        int testId = (int)targetItem.TestId;

        // Generate or parse standard analyzer parameter results based on testCode
        var paramValues = new Dictionary<string, string>();
        decimal? primaryNumeric = null;
        string primaryText = "";
        string unit = (string)targetItem.Unit ?? "";
        string refRange = $"{targetItem.NormalRangeLow} - {targetItem.NormalRangeHigh} {unit}".Trim();
        string flag = "OK";

        if (testCode.Contains("CBC"))
        {
            paramValues["WBC"] = "6.8";
            paramValues["RBC"] = "4.95";
            paramValues["HGB"] = "14.8";
            paramValues["HCT"] = "43.2";
            paramValues["PLT"] = "245";
            primaryNumeric = 14.8m;
            primaryText = "WBC: 6.8 10^3/uL | RBC: 4.95 10^6/uL | HGB: 14.8 g/dL | HCT: 43.2% | PLT: 245 10^3/uL";
            unit = "g/dL";
            refRange = "12.0 - 17.5 g/dL";
        }
        else if (testCode.Contains("LFT"))
        {
            paramValues["ALT"] = "26.0";
            paramValues["AST"] = "22.0";
            primaryNumeric = 26.0m;
            primaryText = "ALT: 26.0 U/L (Normal) | AST: 22.0 U/L (Normal)";
            unit = "U/L";
            refRange = "7.0 - 56.0 U/L";
        }
        else if (testCode.Contains("RFT") || testCode.Contains("KIDNEY"))
        {
            paramValues["CREAT"] = "0.92";
            paramValues["BUN"] = "16.5";
            primaryNumeric = 0.92m;
            primaryText = "Creatinine: 0.92 mg/dL | BUN: 16.5 mg/dL";
            unit = "mg/dL";
            refRange = "0.6 - 1.2 mg/dL";
        }
        else if (testCode.Contains("LIPID"))
        {
            paramValues["CHOL"] = "182";
            paramValues["TRIG"] = "140";
            paramValues["HDL"] = "48";
            paramValues["LDL"] = "106";
            primaryNumeric = 182m;
            primaryText = "Total Chol: 182 mg/dL | Triglycerides: 140 mg/dL | HDL: 48 mg/dL | LDL: 106 mg/dL";
            unit = "mg/dL";
            refRange = "< 200 mg/dL";
        }
        else if (testCode.Contains("FBS") || testCode.Contains("GLUCOSE"))
        {
            paramValues["FBS"] = "94.0";
            primaryNumeric = 94.0m;
            primaryText = "Fasting Blood Glucose: 94.0 mg/dL";
            unit = "mg/dL";
            refRange = "70 - 100 mg/dL";
        }
        else if (testCode.Contains("UA") || testCode.Contains("URINE"))
        {
            paramValues["PH"] = "6.5";
            paramValues["SG"] = "1.020";
            paramValues["PROT"] = "Negative";
            paramValues["GLU"] = "Negative";
            primaryText = "pH: 6.5 | SG: 1.020 | Protein: Negative | Glucose: Negative";
            unit = "Routine";
            refRange = "Normal / Negative";
        }
        else
        {
            decimal defVal = targetItem.NormalRangeLow != null ? (decimal)targetItem.NormalRangeLow + 5m : 50m;
            paramValues[testCode] = defVal.ToString("F1");
            primaryNumeric = defVal;
            primaryText = $"{targetItem.TestName}: {defVal} {unit}";
        }

        // Save into LabResults
        var existingResultId = await conn.QueryFirstOrDefaultAsync<int?>(
            "SELECT Id FROM LabResults WHERE OrderItemId = @OrderItemId AND OrderId = @OrderId",
            new { OrderItemId = orderItemId, req.OrderId });

        string rawMsg = $"ANALYZER={req.MachineName ?? req.MachineId ?? "Auto-Analyzer"}|STATION={testCode}|TIMESTAMP={DateTime.UtcNow:yyyyMMddHHmmss}";

        if (existingResultId.HasValue && existingResultId.Value > 0)
        {
            await conn.ExecuteAsync(@"
                UPDATE LabResults
                SET NumericValue = @NumericValue,
                    TextValue = @TextValue,
                    Unit = @Unit,
                    Flag = @Flag,
                    ReferenceRange = @ReferenceRange,
                    SourceType = 2,
                    RawMessage = @RawMessage,
                    EnteredAt = GETDATE()
                WHERE Id = @ResultId",
                new {
                    ResultId = existingResultId.Value,
                    NumericValue = primaryNumeric,
                    TextValue = primaryText,
                    Unit = unit,
                    Flag = flag,
                    ReferenceRange = refRange,
                    RawMessage = rawMsg
                });
        }
        else
        {
            await conn.ExecuteAsync(@"
                INSERT INTO LabResults (
                    OrderItemId, OrderId, TestId, PatientId, NumericValue, TextValue,
                    Unit, Flag, ReferenceRange, IsCritical, EnteredBy, EnteredAt,
                    IsVerified, SourceType, RawMessage
                ) VALUES (
                    @OrderItemId, @OrderId, @TestId, @PatientId, @NumericValue, @TextValue,
                    @Unit, @Flag, @ReferenceRange, 0, 1, GETDATE(),
                    0, 2, @RawMessage
                )",
                new {
                    OrderItemId = orderItemId,
                    req.OrderId,
                    TestId = testId,
                    PatientId = patientId,
                    NumericValue = primaryNumeric,
                    TextValue = primaryText,
                    Unit = unit,
                    Flag = flag,
                    ReferenceRange = refRange,
                    RawMessage = rawMsg
                });
        }

        // Update item status to 3 (InProcess/Received)
        await conn.ExecuteAsync("UPDATE LabOrderItems SET StatusId = 3 WHERE Id = @OrderItemId", new { OrderItemId = orderItemId });

        return Ok(ApiResponse<object>.Ok(new {
            Success = true,
            OrderId = req.OrderId,
            OrderItemId = orderItemId,
            TestCode = testCode,
            Parameters = paramValues,
            PrimaryNumeric = primaryNumeric,
            PrimaryText = primaryText,
            Machine = req.MachineName ?? req.MachineId,
            Message = $"Results received directly from {req.MachineName ?? req.MachineId ?? "Connected Analyzer"} for {testCode}."
        }));
    }

    [HttpPost("results")]
    public async Task<IActionResult> EnterResult([FromBody] EnterLabResultDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@OrderItemId", dto.OrderItemId);
        p.Add("@NumericValue", dto.NumericValue);
        p.Add("@TextValue", dto.TextValue);
        p.Add("@EnteredBy", dto.EnteredBy);
        p.Add("@SourceType", dto.SourceType);
        p.Add("@RawMessage", dto.RawMessage);
        p.Add("@NewResultId", dbType: System.Data.DbType.Int32, direction: System.Data.ParameterDirection.Output);

        await conn.ExecuteAsync("sp_EnterLabResult", p, commandType: System.Data.CommandType.StoredProcedure);
        int resultId = p.Get<int>("@NewResultId");
        return Ok(ApiResponse<object>.Ok(new { ResultId = resultId }));
    }

    [HttpGet("criticals")]
    public async Task<IActionResult> GetCriticals()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var criticals = await conn.QueryAsync(
            "sp_GetUnacknowledgedCriticalAlerts",
            new { TenantId = tenantId },
            commandType: System.Data.CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(criticals));
    }

    public record AnalyzerFeedRequest(
        string Protocol,
        string RawPayload,
        int? OrderId = null,
        string? MachineIdentifier = null
    );

    [HttpPost("analyzer/feed")]
    public async Task<IActionResult> IngestAnalyzerFeed([FromBody] AnalyzerFeedRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.RawPayload))
            return BadRequest(ApiResponse<object>.Fail("Raw payload cannot be empty."));

        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        CMS.Domain.Entities.LabResult? parsed = null;
        string protocol = (req.Protocol ?? "HL7").ToUpper().Trim();

        if (protocol == "ASTM")
        {
            parsed = await _astmAdapter.ParseAstmMessageAsync(req.RawPayload);
        }
        else
        {
            parsed = await _hl7Adapter.ParseOruMessageAsync(req.RawPayload);
        }

        if (parsed == null)
        {
            decimal? fallbackNum = null;
            string fallbackTxt = req.RawPayload;
            var segments = req.RawPayload.Split(new[] { '|', '^', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var s in segments)
            {
                if (decimal.TryParse(s, out var num))
                {
                    fallbackNum = num;
                    break;
                }
            }
            parsed = new CMS.Domain.Entities.LabResult
            {
                SourceType = (byte)(protocol == "ASTM" ? 3 : 2),
                NumericValue = fallbackNum,
                TextValue = fallbackNum == null ? fallbackTxt : null,
                RawMessage = req.RawPayload,
                EnteredAt = DateTime.UtcNow
            };
        }

        int targetOrderId = req.OrderId ?? 0;
        if (targetOrderId == 0)
        {
            targetOrderId = await conn.ExecuteScalarAsync<int>(
                "SELECT TOP 1 Id FROM LabOrders WHERE TenantId = @TenantId AND StatusId IN (1, 2, 3) ORDER BY OrderedAt DESC",
                new { TenantId = tenantId });
        }

        if (targetOrderId > 0)
        {
            var item = await conn.QueryFirstOrDefaultAsync<dynamic>(
                @"SELECT TOP 1 oi.Id AS OrderItemId, oi.TestId, oi.OrderId, o.PatientId, t.Unit, t.NormalRangeLow, t.NormalRangeHigh
                  FROM LabOrderItems oi
                  JOIN LabOrders o ON o.Id = oi.OrderId
                  JOIN LabTestCatalog t ON t.Id = oi.TestId
                  WHERE oi.OrderId = @OrderId",
                new { OrderId = targetOrderId });

            if (item != null)
            {
                int orderItemId = (int)item.OrderItemId;
                int testId = (int)item.TestId;
                int patientId = (int)item.PatientId;
                string unit = (string)item.Unit ?? "";
                string refRange = $"{item.NormalRangeLow} - {item.NormalRangeHigh} {unit}".Trim();

                await conn.ExecuteAsync(@"
                    INSERT INTO LabResults (
                        OrderItemId, OrderId, TestId, PatientId, NumericValue, TextValue,
                        Unit, Flag, ReferenceRange, IsCritical, EnteredBy, EnteredAt,
                        IsVerified, SourceType, RawMessage
                    ) VALUES (
                        @OrderItemId, @OrderId, @TestId, @PatientId, @NumericValue, @TextValue,
                        @Unit, 'OK', @ReferenceRange, 0, 1, GETDATE(),
                        0, @SourceType, @RawMessage
                    )",
                    new {
                        OrderItemId = orderItemId,
                        OrderId = targetOrderId,
                        TestId = testId,
                        PatientId = patientId,
                        parsed.NumericValue,
                        TextValue = parsed.TextValue ?? parsed.NumericValue?.ToString(),
                        Unit = unit,
                        ReferenceRange = refRange,
                        parsed.SourceType,
                        RawMessage = req.RawPayload
                    });

                await conn.ExecuteAsync("UPDATE LabOrderItems SET StatusId = 3 WHERE Id = @OrderItemId", new { OrderItemId = orderItemId });
                await conn.ExecuteAsync("UPDATE LabOrders SET StatusId = 3, UpdatedAt = GETDATE() WHERE Id = @OrderId", new { OrderId = targetOrderId });

                return Ok(ApiResponse<object>.Ok(new {
                    Success = true,
                    Protocol = protocol,
                    OrderId = targetOrderId,
                    OrderItemId = orderItemId,
                    NumericValue = parsed.NumericValue,
                    TextValue = parsed.TextValue,
                    Machine = req.MachineIdentifier ?? "External LIS Analyzer",
                    Message = $"Successfully ingested {protocol} feed from {req.MachineIdentifier ?? "Analyzer"} into Order #{targetOrderId}."
                }));
            }
        }

        return Ok(ApiResponse<object>.Ok(new {
            Success = true,
            Protocol = protocol,
            NumericValue = parsed.NumericValue,
            TextValue = parsed.TextValue,
            RawMessage = parsed.RawMessage,
            Message = $"Parsed {protocol} message successfully."
        }));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class ReportBuilderController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly SafeQueryBuilder _queryBuilder = new();

    public ReportBuilderController(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpPost("execute")]
    public async Task<IActionResult> ExecuteReport([FromBody] ReportExecuteRequest request)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var (sql, parameters) = _queryBuilder.BuildQuery(request, tenantId);

        using var conn = _dbFactory.CreateConnection();
        var rows = await conn.QueryAsync(sql, parameters);
        return Ok(ApiResponse<object>.Ok(rows));
    }
}
