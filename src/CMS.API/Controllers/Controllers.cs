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

    public LaboratoryController(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
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
              AND (
                  EXISTS (
                      SELECT 1 FROM InvoiceItems ii 
                      JOIN Invoices inv ON inv.Id = ii.InvoiceId 
                      WHERE ii.RefId = o.Id AND inv.StatusId = 4
                  )
                  OR EXISTS (
                      SELECT 1 FROM InvoiceItems ii 
                      JOIN Invoices inv ON inv.Id = ii.InvoiceId 
                      WHERE inv.PatientId = o.PatientId 
                        AND ii.ItemType = 2 
                        AND inv.StatusId = 4
                  )
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
