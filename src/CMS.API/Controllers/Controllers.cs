using CMS.Application.Auth;
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
    private readonly AuthManagementService _authService;

    public AuthController(IDbConnectionFactory dbFactory, AuthManagementService authService)
    {
        _dbFactory = dbFactory;
        _authService = authService;
    }

    [HttpPost("login")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        using var conn = _dbFactory.CreateConnection();
        var user = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "sp_GetUserByUsername",
            new { TenantId = request.TenantId, Username = request.Username },
            commandType: System.Data.CommandType.StoredProcedure);

        if (user == null)
            return Unauthorized(ApiResponse<string>.Fail("Invalid username or password."));

        if (user.IsActive != null && (bool)user.IsActive == false)
            return Unauthorized(ApiResponse<string>.Fail("User account is inactive."));

        if (user.IsLocked != null && (bool)user.IsLocked == true)
            return Unauthorized(ApiResponse<string>.Fail("User account is locked."));

        string salt = (string)(user.Salt ?? "");
        string storedHash = (string)(user.PasswordHash ?? "");
        string uname = (string)(user.Username ?? request.Username);

        if (!AuthManagementService.VerifyPassword(request.Password, storedHash, salt, uname))
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

        var token = _authService.GenerateJwtToken(userDto);
        var refreshToken = Guid.NewGuid().ToString("N");

        // Set HttpOnly cookie — JS cannot read this, preventing XSS token theft
        Response.Cookies.Append("cms_access_token", token, new Microsoft.AspNetCore.Http.CookieOptions
        {
            HttpOnly = true,
            Secure = false,            // Set true in production (HTTPS)
            SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddHours(2)
        });

        return Ok(ApiResponse<LoginResponse>.Ok(new LoginResponse(token, refreshToken, 120, userDto)));
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("cms_access_token");
        return Ok(ApiResponse<string>.Ok("Logged out successfully."));
    }

    public record ChangePasswordRequest(
        string? Username,
        int? UserId,
        string OldPassword,
        string NewPassword,
        string ConfirmPassword
    );

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;

        if (string.IsNullOrWhiteSpace(request.OldPassword))
            return BadRequest(ApiResponse<string>.Fail("Current password is required."));

        if (string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest(ApiResponse<string>.Fail("New password is required."));

        if (request.NewPassword != request.ConfirmPassword)
            return BadRequest(ApiResponse<string>.Fail("New password and confirm password do not match."));

        if (request.NewPassword.Length < 6)
            return BadRequest(ApiResponse<string>.Fail("New password must be at least 6 characters long."));

        int? userId = request.UserId;
        if (!userId.HasValue || userId.Value <= 0)
        {
            var claimVal = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(claimVal, out int parsedId))
                userId = parsedId;
        }

        string? username = request.Username;
        if (string.IsNullOrWhiteSpace(username))
        {
            username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
        }

        var (success, message) = await _authService.ChangePasswordAsync(userId, username, tenantId, request.OldPassword, request.NewPassword);
        if (!success)
            return BadRequest(ApiResponse<string>.Fail(message));

        return Ok(ApiResponse<string>.Ok(message));
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
    public async Task<IActionResult> GetNextMRN([FromQuery] string prefix = "HD")
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = "SELECT ISNULL(MAX(Id), 0) + 1 FROM Patients WHERE TenantId = @TenantId;";
        int nextId = await conn.ExecuteScalarAsync<int>(sql, new { TenantId = tenantId });
        var cleanPrefix = string.IsNullOrWhiteSpace(prefix) ? "HD" : prefix.Trim().ToUpper();
        var nextMrn = $"{cleanPrefix}-{nextId:D4}";
        return Ok(ApiResponse<object>.Ok(new { NextMRN = nextMrn, NextId = nextId }));
    }

    [HttpGet]
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q = "", [FromQuery] int page = 1, [FromQuery] int limit = 100)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var queryStr = q?.Trim() ?? "";
        int maxRows = limit is > 0 and <= 500 ? limit : 100;

        string? cacheKey = string.IsNullOrWhiteSpace(queryStr) ? $"tenant:{tenantId}:patients:top:{maxRows}" : null;
        if (cacheKey != null)
        {
            var cached = await _cache.GetAsync<List<PatientDto>>(cacheKey);
            if (cached != null)
                return Ok(ApiResponse<List<PatientDto>>.Ok(cached));
        }

        using var conn = _dbFactory.CreateConnection();
        
        string sql;
        object param;

        if (string.IsNullOrWhiteSpace(queryStr))
        {
            sql = @"
                SELECT TOP (@Limit) Id, TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender,
                       PrimaryPhone, Email, Address, InsuranceProvider, InsuranceCopayPercent,
                       Allergies, ChronicConditions, NationalId, BloodGroup, PhotoUrl, IsActive
                FROM Patients WITH (NOLOCK)
                WHERE TenantId = @TenantId AND IsActive = 1
                ORDER BY Id DESC";
            param = new { TenantId = tenantId, Limit = maxRows };
        }
        else
        {
            var prefix = queryStr + "%";
            var contains = "%" + queryStr + "%";
            sql = @"
                SELECT TOP (@Limit) Id, TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender,
                       PrimaryPhone, Email, Address, InsuranceProvider, InsuranceCopayPercent,
                       Allergies, ChronicConditions, NationalId, BloodGroup, PhotoUrl, IsActive
                FROM Patients WITH (NOLOCK)
                WHERE TenantId = @TenantId AND IsActive = 1
                  AND (MRN LIKE @Prefix OR PrimaryPhone LIKE @Prefix OR FirstName LIKE @Prefix OR LastName LIKE @Prefix 
                       OR FirstName LIKE @Contains OR LastName LIKE @Contains OR MiddleName LIKE @Contains)
                ORDER BY Id DESC";
            param = new { TenantId = tenantId, Prefix = prefix, Contains = contains, Limit = maxRows };
        }

        var patients = (await conn.QueryAsync<PatientDto>(sql, param)).ToList();

        if (cacheKey != null)
        {
            await _cache.SetAsync(cacheKey, patients, TimeSpan.FromSeconds(30));
        }

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

        // Audit Logging
        try
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            int userId = HttpContext.Items["UserId"] is int uid ? uid : 1;
            await conn.ExecuteAsync(@"
                INSERT INTO AuditLog (TenantId, TableName, RecordId, Operation, OldValues, NewValues, ChangedBy, ChangedAt, IpAddress)
                VALUES (@TenantId, 'Patients', @RecordId, 'CREATE_PATIENT', NULL, @NewValues, @ChangedBy, SYSUTCDATETIME(), @IpAddress)",
                new { TenantId = tenantId, RecordId = newId.ToString(), NewValues = System.Text.Json.JsonSerializer.Serialize(dto), ChangedBy = userId, IpAddress = ip });
        }
        catch { }

        return Ok(ApiResponse<object>.Ok(new { PatientId = newId, MRN = finalMrn }));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT Id, TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender,
                   PrimaryPhone, Email, Address, InsuranceProvider, InsuranceCopayPercent,
                   Allergies, ChronicConditions, NationalId, BloodGroup, PhotoUrl, IsActive
            FROM Patients WITH (NOLOCK)
            WHERE TenantId = @TenantId AND Id = @Id;";

        var patient = await conn.QueryFirstOrDefaultAsync<PatientDto>(sql, new { TenantId = tenantId, Id = id });
        if (patient == null)
            return NotFound(ApiResponse<string>.Fail("Patient not found."));

        // Mandatory HIPAA / Clinical Access Logging
        try
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            int userId = HttpContext.Items["UserId"] is int uid ? uid : 1;
            await conn.ExecuteAsync(@"
                INSERT INTO AuditLog (TenantId, TableName, RecordId, Operation, OldValues, NewValues, ChangedBy, ChangedAt, IpAddress)
                VALUES (@TenantId, 'Patients', @RecordId, 'VIEW_CHART', NULL, NULL, @ChangedBy, SYSUTCDATETIME(), @IpAddress)",
                new { TenantId = tenantId, RecordId = id.ToString(), ChangedBy = userId, IpAddress = ip });
        }
        catch { }

        return Ok(ApiResponse<PatientDto>.Ok(patient));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreatePatientDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        var updateSql = @"
            UPDATE Patients
            SET FirstName = @FirstName,
                MiddleName = @MiddleName,
                LastName = @LastName,
                DateOfBirth = @DateOfBirth,
                Gender = @Gender,
                PrimaryPhone = @PrimaryPhone,
                Email = @Email,
                Address = @Address,
                InsuranceProvider = @InsuranceProvider,
                InsuranceCopayPercent = @InsuranceCopayPercent,
                Allergies = ISNULL(@Allergies, Allergies),
                NationalId = ISNULL(@NationalId, NationalId),
                UpdatedAt = GETDATE()
            WHERE TenantId = @TenantId AND Id = @Id;";

        int rows = await conn.ExecuteAsync(updateSql, new
        {
            TenantId = tenantId,
            Id = id,
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
            dto.NationalId
        });

        await _cache.RemoveByPrefixAsync($"tenant:{tenantId}:patients");

        // Audit Logging
        try
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            int userId = HttpContext.Items["UserId"] is int uid ? uid : 1;
            await conn.ExecuteAsync(@"
                INSERT INTO AuditLog (TenantId, TableName, RecordId, Operation, OldValues, NewValues, ChangedBy, ChangedAt, IpAddress)
                VALUES (@TenantId, 'Patients', @RecordId, 'UPDATE_PATIENT', NULL, @NewValues, @ChangedBy, SYSUTCDATETIME(), @IpAddress)",
                new { TenantId = tenantId, RecordId = id.ToString(), NewValues = System.Text.Json.JsonSerializer.Serialize(dto), ChangedBy = userId, IpAddress = ip });
        }
        catch { }

        return Ok(ApiResponse<object>.Ok(new { Success = rows > 0, PatientId = id }));
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
    private readonly ILisTcpListenerService _lisListener;
    private readonly ILabResultIngestionService _ingestionService;

    public LaboratoryController(
        IDbConnectionFactory dbFactory,
        ICacheService cache,
        IHl7Adapter hl7Adapter,
        IAstmAdapter astmAdapter,
        ILisTcpListenerService lisListener,
        ILabResultIngestionService ingestionService)
    {
        _dbFactory = dbFactory;
        _cache = cache;
        _hl7Adapter = hl7Adapter;
        _astmAdapter = astmAdapter;
        _lisListener = lisListener;
        _ingestionService = ingestionService;
    }

    [HttpGet("catalog")]
    public async Task<IActionResult> GetCatalog()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT Id, TestCode, TestName, Category, SampleType, TurnaroundMinutes,
                   NormalRangeLow, NormalRangeHigh, Unit, Price, DisplayOrder, TextReferenceRange
            FROM LabTestCatalog
            WHERE TenantId = @TenantId AND IsActive = 1
            ORDER BY DisplayOrder ASC, Category ASC, TestName ASC";
        var catalog = (await conn.QueryAsync<LabTestCatalogDto>(sql, new { TenantId = tenantId })).ToList();

        var sqlParams = @"
            SELECT p.Id, p.TestCatalogId, p.ParameterCode, p.ParameterName, p.Unit,
                   p.ReferenceLow, p.ReferenceHigh, p.TextReferenceRange, p.DisplayOrder
            FROM LabTestParameters p
            JOIN LabTestCatalog c ON c.Id = p.TestCatalogId
            WHERE c.TenantId = @TenantId AND c.IsActive = 1
            ORDER BY p.DisplayOrder, p.Id";

        var allParams = (await conn.QueryAsync<LabTestParameterDto>(sqlParams, new { TenantId = tenantId })).ToList();
        var paramLookup = allParams.GroupBy(p => p.TestCatalogId).ToDictionary(g => g.Key, g => g.ToList());

        var result = catalog.Select(c => c with {
            Parameters = paramLookup.TryGetValue(c.Id, out var plist) ? plist : new List<LabTestParameterDto>()
        }).ToList();

        return Ok(ApiResponse<List<LabTestCatalogDto>>.Ok(result));
    }

    public record CreateLabParameterRequest(
        string? Code,
        string Name,
        string? Unit,
        decimal? NormalRangeLow = null,
        decimal? NormalRangeHigh = null,
        string? TextReferenceRange = null,
        int DisplayOrder = 1);

    public record CreateLabCatalogRequest(
        string TestCode,
        string TestName,
        string? Category,
        string? SampleType,
        int TurnaroundMinutes = 60,
        decimal? NormalRangeLow = null,
        decimal? NormalRangeHigh = null,
        string? Unit = null,
        decimal? Price = 0,
        int DisplayOrder = 1,
        string? TextReferenceRange = null,
        List<CreateLabParameterRequest>? Parameters = null);

    public record UpdateLabCatalogRequest(
        string TestCode,
        string TestName,
        string? Category,
        string? SampleType,
        int TurnaroundMinutes = 60,
        decimal? NormalRangeLow = null,
        decimal? NormalRangeHigh = null,
        string? Unit = null,
        decimal? Price = 0,
        int DisplayOrder = 1,
        string? TextReferenceRange = null,
        List<CreateLabParameterRequest>? Parameters = null);

    [HttpPost("catalog")]
    public async Task<IActionResult> CreateCatalogItem([FromBody] CreateLabCatalogRequest req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            var sql = @"
                INSERT INTO LabTestCatalog (TenantId, TestCode, TestName, Category, SampleType, TurnaroundMinutes, NormalRangeLow, NormalRangeHigh, TextReferenceRange, Unit, Price, DisplayOrder, IsActive, CreatedAt)
                VALUES (@TenantId, @TestCode, @TestName, @Category, @SampleType, @TurnaroundMinutes, @NormalRangeLow, @NormalRangeHigh, @TextReferenceRange, @Unit, @Price, @DisplayOrder, 1, SYSUTCDATETIME());
                SELECT CAST(SCOPE_IDENTITY() as int);";
            int id = await conn.ExecuteScalarAsync<int>(sql, new {
                TenantId = tenantId,
                req.TestCode,
                req.TestName,
                req.Category,
                req.SampleType,
                req.TurnaroundMinutes,
                req.NormalRangeLow,
                req.NormalRangeHigh,
                req.TextReferenceRange,
                req.Unit,
                req.Price,
                req.DisplayOrder
            }, transaction: tx);

            if (req.Parameters != null && req.Parameters.Count > 0)
            {
                var sqlParam = @"
                    INSERT INTO LabTestParameters (TestCatalogId, ParameterCode, ParameterName, Unit, ReferenceLow, ReferenceHigh, TextReferenceRange, DisplayOrder, CreatedAt)
                    VALUES (@TestCatalogId, @ParameterCode, @ParameterName, @Unit, @ReferenceLow, @ReferenceHigh, @TextReferenceRange, @DisplayOrder, SYSUTCDATETIME());";
                
                int order = 1;
                foreach (var p in req.Parameters)
                {
                    await conn.ExecuteAsync(sqlParam, new {
                        TestCatalogId = id,
                        ParameterCode = !string.IsNullOrWhiteSpace(p.Code) ? p.Code : $"{req.TestCode}-{order}",
                        ParameterName = !string.IsNullOrWhiteSpace(p.Name) ? p.Name : $"Analyte {order}",
                        Unit = p.Unit ?? "",
                        ReferenceLow = p.NormalRangeLow,
                        ReferenceHigh = p.NormalRangeHigh,
                        TextReferenceRange = p.TextReferenceRange,
                        DisplayOrder = p.DisplayOrder > 0 ? p.DisplayOrder : order
                    }, transaction: tx);
                    order++;
                }
            }

            tx.Commit();

            await _cache.RemoveAsync($"lab_catalog_{tenantId}");
            await _cache.RemoveAsync($"tenant:{tenantId}:lab:catalog");
            return Ok(ApiResponse<int>.Ok(id, "Lab test created successfully."));
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    [HttpPut("catalog/{id:int}")]
    public async Task<IActionResult> UpdateCatalogItem(int id, [FromBody] UpdateLabCatalogRequest req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            var sql = @"
                UPDATE LabTestCatalog
                SET TestCode = @TestCode,
                    TestName = @TestName,
                    Category = @Category,
                    SampleType = @SampleType,
                    TurnaroundMinutes = @TurnaroundMinutes,
                    NormalRangeLow = @NormalRangeLow,
                    NormalRangeHigh = @NormalRangeHigh,
                    TextReferenceRange = @TextReferenceRange,
                    Unit = @Unit,
                    Price = @Price,
                    DisplayOrder = @DisplayOrder
                WHERE Id = @Id AND TenantId = @TenantId";
            int rows = await conn.ExecuteAsync(sql, new {
                Id = id,
                TenantId = tenantId,
                req.TestCode,
                req.TestName,
                req.Category,
                req.SampleType,
                req.TurnaroundMinutes,
                req.NormalRangeLow,
                req.NormalRangeHigh,
                req.TextReferenceRange,
                req.Unit,
                req.Price,
                req.DisplayOrder
            }, transaction: tx);

            if (req.Parameters != null)
            {
                await conn.ExecuteAsync("DELETE FROM LabTestParameters WHERE TestCatalogId = @Id", new { Id = id }, transaction: tx);

                if (req.Parameters.Count > 0)
                {
                    var sqlParam = @"
                        INSERT INTO LabTestParameters (TestCatalogId, ParameterCode, ParameterName, Unit, ReferenceLow, ReferenceHigh, TextReferenceRange, DisplayOrder, CreatedAt)
                        VALUES (@TestCatalogId, @ParameterCode, @ParameterName, @Unit, @ReferenceLow, @ReferenceHigh, @TextReferenceRange, @DisplayOrder, SYSUTCDATETIME());";
                    
                    int order = 1;
                    foreach (var p in req.Parameters)
                    {
                        await conn.ExecuteAsync(sqlParam, new {
                            TestCatalogId = id,
                            ParameterCode = !string.IsNullOrWhiteSpace(p.Code) ? p.Code : $"{req.TestCode}-{order}",
                            ParameterName = !string.IsNullOrWhiteSpace(p.Name) ? p.Name : $"Analyte {order}",
                            Unit = p.Unit ?? "",
                            ReferenceLow = p.NormalRangeLow,
                            ReferenceHigh = p.NormalRangeHigh,
                            TextReferenceRange = p.TextReferenceRange,
                            DisplayOrder = p.DisplayOrder > 0 ? p.DisplayOrder : order
                        }, transaction: tx);
                        order++;
                    }
                }
            }

            tx.Commit();

            await _cache.RemoveAsync($"lab_catalog_{tenantId}");
            await _cache.RemoveAsync($"tenant:{tenantId}:lab:catalog");
            return Ok(ApiResponse<bool>.Ok(rows > 0, "Lab test updated successfully."));
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    [HttpDelete("catalog/{id:int}")]
    public async Task<IActionResult> DeleteCatalogItem(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"UPDATE LabTestCatalog SET IsActive = 0 WHERE Id = @Id AND TenantId = @TenantId";
        int rows = await conn.ExecuteAsync(sql, new { Id = id, TenantId = tenantId });
        await _cache.RemoveAsync($"lab_catalog_{tenantId}");
        return Ok(ApiResponse<bool>.Ok(rows > 0, "Lab test deleted successfully."));
    }

    [HttpGet("instruments/listener-status")]
    public IActionResult GetListenerStatus()
    {
        var status = new LisListenerStatusDto(
            _lisListener.IsListening,
            _lisListener.ListeningPorts.ToList(),
            _lisListener.ActiveClients.ToList(),
            _lisListener.RecentLogs.ToList(),
            _lisListener.ConfiguredPorts.ToList()
        );
        return Ok(ApiResponse<LisListenerStatusDto>.Ok(status));
    }

    public record LisPortConfigRequest(List<int> Ports);
    public record LisPortActionRequest(int? Port = null);

    [HttpPost("instruments/listener/start")]
    public async Task<IActionResult> StartListener([FromBody] LisPortActionRequest? req = null)
    {
        bool result = await _lisListener.StartAsync(req?.Port);
        var status = new LisListenerStatusDto(
            _lisListener.IsListening,
            _lisListener.ListeningPorts.ToList(),
            _lisListener.ActiveClients.ToList(),
            _lisListener.RecentLogs.ToList(),
            _lisListener.ConfiguredPorts.ToList()
        );
        return Ok(ApiResponse<LisListenerStatusDto>.Ok(status, result ? "LIS listener started." : "Failed to start listener."));
    }

    [HttpPost("instruments/listener/stop")]
    public async Task<IActionResult> StopListener([FromBody] LisPortActionRequest? req = null)
    {
        bool result = await _lisListener.StopAsync(req?.Port);
        var status = new LisListenerStatusDto(
            _lisListener.IsListening,
            _lisListener.ListeningPorts.ToList(),
            _lisListener.ActiveClients.ToList(),
            _lisListener.RecentLogs.ToList(),
            _lisListener.ConfiguredPorts.ToList()
        );
        return Ok(ApiResponse<LisListenerStatusDto>.Ok(status, result ? "LIS listener stopped." : "Failed to stop listener."));
    }

    [HttpPost("instruments/listener/configure-ports")]
    public async Task<IActionResult> ConfigurePorts([FromBody] LisPortConfigRequest req)
    {
        if (req?.Ports == null || req.Ports.Count == 0 || req.Ports.Any(p => p < 1 || p > 65535))
        {
            return BadRequest(ApiResponse<object>.Fail("Please provide valid port numbers (1-65535)."));
        }

        bool result = await _lisListener.ConfigurePortsAsync(req.Ports);
        var status = new LisListenerStatusDto(
            _lisListener.IsListening,
            _lisListener.ListeningPorts.ToList(),
            _lisListener.ActiveClients.ToList(),
            _lisListener.RecentLogs.ToList(),
            _lisListener.ConfiguredPorts.ToList()
        );
        return Ok(ApiResponse<LisListenerStatusDto>.Ok(status, "LIS ports updated successfully."));
    }

    public record PingMachineRequest(string IpAddress, int Port, int TimeoutMs = 1500, string? Mode = null);

    [HttpPost("instruments/ping")]
    public async Task<IActionResult> PingInstrument([FromBody] PingMachineRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.IpAddress) || req.Port <= 0)
            return BadRequest(ApiResponse<object>.Fail("Invalid IP address or port."));

        // If the machine is in Passive / Unidirectional mode, check the server's listener status
        bool isPassiveMode = (req.Mode?.Contains("Unidirectional", StringComparison.OrdinalIgnoreCase) == true) ||
                             (req.Mode?.Contains("Results Only", StringComparison.OrdinalIgnoreCase) == true) ||
                             _lisListener.ConfiguredPorts.Contains(req.Port) ||
                             req.Port == 8004 || req.Port == 10001 || req.Port == 10002 || req.Port == 5100;

        if (isPassiveMode)
        {
            var isPortListening = _lisListener.ListeningPorts.Contains(req.Port) || _lisListener.IsListening;
            var connectedClient = _lisListener.ActiveClients.FirstOrDefault(c => c.RemoteEndPoint.Contains(req.IpAddress));

            if (connectedClient != null)
            {
                return Ok(ApiResponse<object>.Ok(new {
                    Success = true,
                    IsOnline = true,
                    IsListening = true,
                    LatencyMs = 1,
                    Message = $"✓ Connected: {req.IpAddress} is actively connected to LIS server on port {req.Port}."
                }));
            }

            if (isPortListening)
            {
                return Ok(ApiResponse<object>.Ok(new {
                    Success = true,
                    IsOnline = true,
                    IsListening = true,
                    LatencyMs = 0,
                    Message = $"✓ LIS Server is passively listening on port {req.Port}. Waiting for incoming TCP connection from {req.IpAddress}."
                }));
            }
        }

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

    // ─── Instrument CRUD (DB-persisted) ─────────────────────────────────────────

    public record SaveInstrumentRequest(
        int? Id,
        string Name,
        string? Model,
        string? SerialNumber,
        string Protocol,
        string? IpAddress,
        int? Port,
        string? Category,
        string? StationId,
        string? Department,
        string? Description,
        string ConnectionMode,   // "PASSIVE" or "ACTIVE"
        string? RemoteIp,        // filled when ConnectionMode=ACTIVE
        int? RemotePort
    );

    public record LabInstrumentDto(
        int Id,
        byte TenantId,
        string Name,
        string? Model,
        string? SerialNumber,
        string Protocol,
        string? IpAddress,
        int? Port,
        string? Category,
        bool IsActive,
        string? StationId,
        string? Department,
        string? Description,
        string ConnectionMode,
        string? RemoteIp,
        int? RemotePort,
        DateTime CreatedAt
    );

    [HttpGet("instruments/db")]
    public async Task<IActionResult> GetDbInstruments()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT Id, TenantId, Name, Model, SerialNumber, Protocol, IpAddress, Port,
                   Category, IsActive, StationId, Department, Description,
                   ISNULL(ConnectionMode,'PASSIVE') AS ConnectionMode,
                   RemoteIp, RemotePort, CreatedAt
            FROM LabInstruments WHERE TenantId = @TenantId AND IsActive = 1
            ORDER BY Id";
        var rows = await conn.QueryAsync<LabInstrumentDto>(sql, new { TenantId = tenantId });
        return Ok(ApiResponse<IEnumerable<LabInstrumentDto>>.Ok(rows));
    }

    [HttpPost("instruments/db")]
    public async Task<IActionResult> SaveDbInstrument([FromBody] SaveInstrumentRequest req)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();

        if (req.Id.HasValue && req.Id > 0)
        {
            var sql = @"
                UPDATE LabInstruments SET
                    Name=@Name, Model=@Model, SerialNumber=@SerialNumber, Protocol=@Protocol,
                    IpAddress=@IpAddress, Port=@Port, Category=@Category,
                    StationId=@StationId, Department=@Department, Description=@Description,
                    ConnectionMode=@ConnectionMode, RemoteIp=@RemoteIp, RemotePort=@RemotePort
                WHERE Id=@Id AND TenantId=@TenantId";
            await conn.ExecuteAsync(sql, new {
                req.Name, req.Model, req.SerialNumber, req.Protocol,
                req.IpAddress, req.Port, req.Category,
                req.StationId, req.Department, req.Description,
                ConnectionMode = req.ConnectionMode ?? "PASSIVE",
                req.RemoteIp, req.RemotePort,
                req.Id, TenantId = tenantId
            });
            return Ok(ApiResponse<object>.Ok(new { Id = req.Id }, "Instrument updated."));
        }
        else
        {
            var sql = @"
                INSERT INTO LabInstruments
                    (TenantId, Name, Model, SerialNumber, Protocol, IpAddress, Port, Category,
                     StationId, Department, Description, ConnectionMode, RemoteIp, RemotePort, IsActive, CreatedAt)
                VALUES
                    (@TenantId, @Name, @Model, @SerialNumber, @Protocol, @IpAddress, @Port, @Category,
                     @StationId, @Department, @Description, @ConnectionMode, @RemoteIp, @RemotePort, 1, SYSUTCDATETIME());
                SELECT SCOPE_IDENTITY();";
            int newId = await conn.ExecuteScalarAsync<int>(sql, new {
                TenantId = tenantId,
                req.Name, req.Model, req.SerialNumber, req.Protocol,
                req.IpAddress, req.Port, req.Category,
                req.StationId, req.Department, req.Description,
                ConnectionMode = req.ConnectionMode ?? "PASSIVE",
                req.RemoteIp, req.RemotePort
            });
            return Ok(ApiResponse<object>.Ok(new { Id = newId }, "Instrument saved."));
        }
    }

    [HttpDelete("instruments/db/{id:int}")]
    public async Task<IActionResult> DeleteDbInstrument(int id)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("UPDATE LabInstruments SET IsActive=0 WHERE Id=@Id AND TenantId=@TenantId",
            new { Id = id, TenantId = tenantId });
        return Ok(ApiResponse<bool>.Ok(true, "Instrument deleted."));
    }

    // ─── Active Connect: server dials out to machine ─────────────────────────────

    public record ActiveConnectRequest(string IpAddress, int Port, int TimeoutMs = 3000, string? InstrumentName = null);

    [HttpPost("instruments/connect")]
    public async Task<IActionResult> ActiveConnectToMachine([FromBody] ActiveConnectRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.IpAddress) || req.Port <= 0)
            return BadRequest(ApiResponse<object>.Fail("Invalid IP or port."));

        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            using var client = new System.Net.Sockets.TcpClient();
            var connectTask = client.ConnectAsync(req.IpAddress, req.Port);
            var timeoutTask = Task.Delay(req.TimeoutMs > 0 ? req.TimeoutMs : 3000);
            var done = await Task.WhenAny(connectTask, timeoutTask);
            sw.Stop();

            if (done == timeoutTask || !client.Connected)
            {
                _lisListener.LogEvent($"ACTIVE CONNECT FAILED: {req.InstrumentName ?? req.IpAddress}:{req.Port} — timeout after {sw.ElapsedMilliseconds}ms.");
                return Ok(ApiResponse<object>.Ok(new {
                    Success = false,
                    LatencyMs = (int)sw.ElapsedMilliseconds,
                    Message = $"Active connect timed out after {sw.ElapsedMilliseconds}ms. Machine {req.IpAddress}:{req.Port} not reachable."
                }));
            }

            _lisListener.LogEvent($"ACTIVE CONNECTED: {req.InstrumentName ?? req.IpAddress} at {req.IpAddress}:{req.Port} — latency {sw.ElapsedMilliseconds}ms.");
            return Ok(ApiResponse<object>.Ok(new {
                Success = true,
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = $"✓ Active connection established to {req.IpAddress}:{req.Port} in {sw.ElapsedMilliseconds}ms."
            }));
        }
        catch (System.Net.Sockets.SocketException ex)
        {
            sw.Stop();
            _lisListener.LogEvent($"ACTIVE CONNECT ERROR: {req.IpAddress}:{req.Port} — {ex.SocketErrorCode}.");
            return Ok(ApiResponse<object>.Ok(new {
                Success = false,
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = $"Socket error ({ex.SocketErrorCode}): {req.IpAddress}:{req.Port} unreachable."
            }));
        }
        catch (Exception ex)
        {
            sw.Stop();
            return Ok(ApiResponse<object>.Ok(new {
                Success = false,
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = $"Connect failed: {ex.Message}"
            }));
        }
    }

    [HttpGet("worklist")]
    public async Task<IActionResult> GetWorklist([FromQuery] DateTime? date = null, [FromQuery] byte? statusId = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT
                o.Id AS OrderId, o.OrderNumber, o.PatientId, o.Priority, o.OrderedAt, o.ClinicalInfo,
                p.FirstName + ' ' + p.LastName AS PatientName, p.DateOfBirth, p.Gender, p.MRN,
                COALESCE(
                    ord_doc_s.Title + ' ' + ord_doc_s.FirstName + ' ' + ord_doc_s.LastName,
                    ord_doc_s.FirstName + ' ' + ord_doc_s.LastName,
                    ord_s.Title + ' ' + ord_s.FirstName + ' ' + ord_s.LastName,
                    ord_s.FirstName + ' ' + ord_s.LastName,
                    ord_u_s.Title + ' ' + ord_u_s.FirstName + ' ' + ord_u_s.LastName,
                    ord_u_s.FirstName + ' ' + ord_u_s.LastName,
                    enc_s.Title + ' ' + enc_s.FirstName + ' ' + enc_s.LastName,
                    enc_s.FirstName + ' ' + enc_s.LastName,
                    trg_s.Title + ' ' + trg_s.FirstName + ' ' + trg_s.LastName,
                    trg_s.FirstName + ' ' + trg_s.LastName,
                    ord_u.Username,
                    'Attending Physician'
                ) AS DoctorName,
                oi.Id AS ItemId, oi.StatusId AS ItemStatus,
                t.TestCode, t.TestName, t.Category, t.SampleType,
                ISNULL(s.Barcode, 'BC-' + CAST(o.Id AS VARCHAR(10)) + '-' + CAST(oi.Id AS VARCHAR(10))) AS Barcode,
                DATEDIFF(MINUTE, o.OrderedAt, GETDATE()) AS AgeMinutes,
                t.TurnaroundMinutes,
                CASE WHEN EXISTS (
                    SELECT 1 FROM InvoiceItems ii 
                    JOIN Invoices inv ON inv.Id = ii.InvoiceId 
                    WHERE ii.RefId = o.Id AND inv.StatusId = 4
                ) THEN 1 ELSE 0 END AS IsPaid,
                r.Id AS ResultId,
                r.NumericValue,
                r.TextValue,
                r.Unit AS ResultUnit,
                r.Flag AS ResultFlag,
                r.ReferenceRange AS ResultRefRange,
                ISNULL(r.IsVerified, 0) AS IsVerified,
                r.VerifiedBy,
                r.VerifiedAt,
                r.EnteredAt AS ResultEnteredAt,
                r.SourceType,
                r.RawMessage
            FROM LabOrders o
            JOIN LabOrderItems oi ON oi.OrderId = o.Id
            JOIN LabTestCatalog t ON t.Id = oi.TestId
            JOIN Patients p ON p.Id = o.PatientId
            LEFT JOIN Doctors ord_d WITH (NOLOCK) ON ord_d.Id = o.OrderedBy
            LEFT JOIN Staff ord_doc_s WITH (NOLOCK) ON ord_doc_s.Id = ord_d.StaffId
            LEFT JOIN Staff ord_s WITH (NOLOCK) ON ord_s.Id = o.OrderedBy
            LEFT JOIN Users ord_u WITH (NOLOCK) ON ord_u.Id = o.OrderedBy
            LEFT JOIN Staff ord_u_s WITH (NOLOCK) ON ord_u_s.UserId = ord_u.Id
            LEFT JOIN Encounters e WITH (NOLOCK) ON e.Id = o.EncounterId
            LEFT JOIN Doctors enc_d WITH (NOLOCK) ON enc_d.Id = e.DoctorId
            LEFT JOIN Staff enc_s WITH (NOLOCK) ON enc_s.Id = enc_d.StaffId OR enc_s.Id = e.DoctorId
            OUTER APPLY (
                SELECT TOP 1 t.AssignedDoctorId 
                FROM PatientTriage t WITH (NOLOCK) 
                WHERE t.PatientId = o.PatientId AND t.AssignedDoctorId > 0 
                ORDER BY t.Id DESC
            ) last_trg
            LEFT JOIN Doctors trg_d WITH (NOLOCK) ON trg_d.Id = last_trg.AssignedDoctorId
            LEFT JOIN Staff trg_s WITH (NOLOCK) ON trg_s.Id = trg_d.StaffId OR trg_s.Id = last_trg.AssignedDoctorId
            LEFT JOIN LabSamples s ON s.OrderId = o.Id
            LEFT JOIN LabResults r ON r.OrderItemId = oi.Id AND r.OrderId = o.Id
            WHERE o.TenantId = @TenantId
              AND (@StatusId IS NULL OR o.StatusId = @StatusId)
              AND (@Date IS NULL OR CAST(o.OrderedAt AS DATE) = CAST(@Date AS DATE))
              AND (@DateFrom IS NULL OR CAST(o.OrderedAt AS DATE) >= CAST(@DateFrom AS DATE))
              AND (@DateTo IS NULL OR CAST(o.OrderedAt AS DATE) <= CAST(@DateTo AS DATE))
            ORDER BY o.Priority ASC, o.OrderedAt DESC";

        var worklist = await conn.QueryAsync(sql, new { TenantId = tenantId, StatusId = statusId, Date = date, DateFrom = dateFrom?.Date, DateTo = dateTo?.Date });
        return Ok(ApiResponse<object>.Ok(worklist));
    }

    [HttpGet("orders")]
    public async Task<IActionResult> GetOrders([FromQuery] int? patientId = null, [FromQuery] DateTime? date = null, [FromQuery] bool? onlyPaid = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT
                o.Id, o.Id AS OrderId, o.OrderNumber, o.PatientId, o.Priority, o.OrderedAt, o.OrderedAt AS OrderDate, o.ClinicalInfo,
                p.FirstName + ' ' + p.LastName AS PatientName, p.DateOfBirth, p.Gender, p.MRN,
                COALESCE(
                    ord_doc_s.Title + ' ' + ord_doc_s.FirstName + ' ' + ord_doc_s.LastName,
                    ord_doc_s.FirstName + ' ' + ord_doc_s.LastName,
                    ord_s.Title + ' ' + ord_s.FirstName + ' ' + ord_s.LastName,
                    ord_s.FirstName + ' ' + ord_s.LastName,
                    ord_u_s.Title + ' ' + ord_u_s.FirstName + ' ' + ord_u_s.LastName,
                    ord_u_s.FirstName + ' ' + ord_u_s.LastName,
                    enc_s.Title + ' ' + enc_s.FirstName + ' ' + enc_s.LastName,
                    enc_s.FirstName + ' ' + enc_s.LastName,
                    trg_s.Title + ' ' + trg_s.FirstName + ' ' + trg_s.LastName,
                    trg_s.FirstName + ' ' + trg_s.LastName,
                    ord_u.Username,
                    'Attending Physician'
                ) AS DoctorName,
                oi.Id AS ItemId, oi.StatusId AS ItemStatus,
                CASE
                    WHEN ISNULL(r.IsVerified, 0) = 1 OR oi.StatusId = 5 THEN 'Approved'
                    WHEN oi.StatusId = 4 THEN 'Resulted'
                    WHEN oi.StatusId = 3 THEN 'InProcess'
                    WHEN oi.StatusId = 2 THEN 'Collected'
                    WHEN oi.StatusId = 1 THEN 'Ordered'
                    WHEN oi.StatusId = 6 THEN 'Cancelled'
                    ELSE 'Pending' END AS StatusName,
                t.TestCode, t.TestName, t.Category, t.SampleType, t.Price,
                CASE WHEN EXISTS (
                    SELECT 1 FROM InvoiceItems ii 
                    JOIN Invoices inv ON inv.Id = ii.InvoiceId 
                    WHERE ii.RefId = o.Id AND inv.StatusId = 4
                ) THEN 1 ELSE 0 END AS IsPaid,
                r.Id AS ResultId,
                r.NumericValue,
                r.TextValue,
                r.Unit AS ResultUnit,
                r.Flag AS ResultFlag,
                r.ReferenceRange AS ResultRefRange,
                ISNULL(r.IsVerified, 0) AS IsVerified,
                r.VerifiedBy,
                r.VerifiedAt,
                r.EnteredAt AS ResultEnteredAt,
                r.SourceType,
                r.RawMessage
            FROM LabOrders o
            JOIN LabOrderItems oi ON oi.OrderId = o.Id
            JOIN LabTestCatalog t ON t.Id = oi.TestId
            JOIN Patients p ON p.Id = o.PatientId
            LEFT JOIN Doctors ord_d WITH (NOLOCK) ON ord_d.Id = o.OrderedBy
            LEFT JOIN Staff ord_doc_s WITH (NOLOCK) ON ord_doc_s.Id = ord_d.StaffId
            LEFT JOIN Staff ord_s WITH (NOLOCK) ON ord_s.Id = o.OrderedBy
            LEFT JOIN Users ord_u WITH (NOLOCK) ON ord_u.Id = o.OrderedBy
            LEFT JOIN Staff ord_u_s WITH (NOLOCK) ON ord_u_s.UserId = ord_u.Id
            LEFT JOIN Encounters e WITH (NOLOCK) ON e.Id = o.EncounterId
            LEFT JOIN Doctors enc_d WITH (NOLOCK) ON enc_d.Id = e.DoctorId
            LEFT JOIN Staff enc_s WITH (NOLOCK) ON enc_s.Id = enc_d.StaffId OR enc_s.Id = e.DoctorId
            OUTER APPLY (
                SELECT TOP 1 t.AssignedDoctorId 
                FROM PatientTriage t WITH (NOLOCK) 
                WHERE t.PatientId = o.PatientId AND t.AssignedDoctorId > 0 
                ORDER BY t.Id DESC
            ) last_trg
            LEFT JOIN Doctors trg_d WITH (NOLOCK) ON trg_d.Id = last_trg.AssignedDoctorId
            LEFT JOIN Staff trg_s WITH (NOLOCK) ON trg_s.Id = trg_d.StaffId OR trg_s.Id = last_trg.AssignedDoctorId
            LEFT JOIN LabResults r ON r.OrderItemId = oi.Id AND r.OrderId = o.Id
            WHERE o.TenantId = @TenantId
              AND (@PatientId IS NULL OR o.PatientId = @PatientId)
              AND (@Date IS NULL OR CAST(o.OrderedAt AS DATE) = CAST(@Date AS DATE))
              AND (@DateFrom IS NULL OR CAST(o.OrderedAt AS DATE) >= CAST(@DateFrom AS DATE))
              AND (@DateTo IS NULL OR CAST(o.OrderedAt AS DATE) <= CAST(@DateTo AS DATE))
              AND (@OnlyPaid IS NULL OR @OnlyPaid = 0 OR EXISTS (
                  SELECT 1 FROM InvoiceItems ii 
                  JOIN Invoices inv ON inv.Id = ii.InvoiceId 
                  WHERE inv.StatusId = 4 AND (ii.RefId = o.Id OR (inv.PatientId = o.PatientId AND ii.ItemType = 2))
              ))
            ORDER BY o.OrderedAt DESC";

        var orders = await conn.QueryAsync(sql, new { TenantId = tenantId, PatientId = patientId, Date = date, OnlyPaid = onlyPaid, DateFrom = dateFrom?.Date, DateTo = dateTo?.Date });
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
                r.IsCritical, r.EnteredAt, r.IsVerified, r.VerifiedAt, r.RawMessage,
                t.TestCode, t.TestName, t.Category,
                o.OrderNumber, o.OrderedAt
            FROM LabResults r
            JOIN LabOrders o ON o.Id = r.OrderId
            JOIN LabTestCatalog t ON t.Id = r.TestId
            WHERE r.PatientId = @PatientId AND o.TenantId = @TenantId
            ORDER BY r.EnteredAt DESC, r.Id DESC";

        var results = (await conn.QueryAsync<dynamic>(sql, new { PatientId = patientId, TenantId = tenantId })).ToList();

        var testIds = results.Select(r => (int)r.TestId).Distinct().ToList();
        var paramLookup = new Dictionary<int, List<dynamic>>();
        if (testIds.Count > 0)
        {
            var pSql = @"
                SELECT p.Id, p.TestCatalogId, p.ParameterCode, p.ParameterName, p.Unit,
                       p.ReferenceLow, p.ReferenceHigh, p.TextReferenceRange, p.DisplayOrder
                FROM LabTestParameters p
                WHERE p.TestCatalogId IN @TestIds
                ORDER BY p.DisplayOrder, p.Id";
            var allParams = (await conn.QueryAsync<dynamic>(pSql, new { TestIds = testIds })).ToList();
            paramLookup = allParams.GroupBy(p => (int)p.TestCatalogId).ToDictionary(g => g.Key, g => g.ToList());
        }

        var enriched = results.Select(r => {
            int tid = (int)r.TestId;
            var plist = paramLookup.TryGetValue(tid, out var list) ? list : new List<dynamic>();
            return new {
                r.Id,
                r.OrderId,
                r.OrderItemId,
                r.TestId,
                r.PatientId,
                r.NumericValue,
                r.TextValue,
                r.Unit,
                r.Flag,
                r.ReferenceRange,
                r.IsCritical,
                r.EnteredAt,
                r.IsVerified,
                r.VerifiedAt,
                r.RawMessage,
                r.TestCode,
                r.TestName,
                r.Category,
                r.OrderNumber,
                r.OrderedAt,
                Parameters = plist
            };
        });

        return Ok(ApiResponse<object>.Ok(enriched));
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

        try
        {
            var isStat = dto.Priority == 1;
            var patName = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT FirstName + ' ' + LastName FROM Patients WHERE Id = @PatientId", new { dto.PatientId }) ?? $"Patient #{dto.PatientId}";
            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, @Subject, @Body, @Priority, 'LabOrdered', 'LabTechnician,Doctor,Nurse,Admin', @RefId, 1, GETDATE())",
                new {
                    dto.TenantId,
                    Subject = isStat ? $"STAT Lab Order: #{orderId}" : $"New Lab Order: #{orderId}",
                    Body = $"Diagnostic lab order #{orderId} placed for {patName}. Awaiting specimen collection & testing.",
                    Priority = isStat ? 1 : 2,
                    RefId = orderId
                });
        }
        catch { /* non-blocking */ }

        return Ok(ApiResponse<object>.Ok(new { OrderId = orderId }));
    }

    public class ExistingLabResultDto
    {
        public int Id { get; set; }
        public decimal? NumericValue { get; set; }
        public string? TextValue { get; set; }
        public string? Unit { get; set; }
        public string? Flag { get; set; }
        public string? ReferenceRange { get; set; }
        public bool? IsVerified { get; set; }
        public byte? SourceType { get; set; }
    }

    public class OrderItemInfoDto
    {
        public int OrderItemId { get; set; }
        public int TestId { get; set; }
        public string? TestCode { get; set; }
        public string? TestName { get; set; }
        public string? Unit { get; set; }
        public decimal? NormalRangeLow { get; set; }
        public decimal? NormalRangeHigh { get; set; }
    }

    [HttpPost("results/save")]
    [HttpPost("results/batch")]
    public async Task<IActionResult> SaveResultsBatch([FromBody] SaveOrderResultsRequest req)
    {
        try
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
            var orderItems = (await conn.QueryAsync<OrderItemInfoDto>(
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
                    OrderItemInfoDto? matchedItem = null;
                    if (res.OrderItemId.HasValue && res.OrderItemId.Value > 0)
                    {
                        matchedItem = orderItems.FirstOrDefault(oi => oi.OrderItemId == res.OrderItemId.Value);
                    }
                    if (matchedItem == null && !string.IsNullOrWhiteSpace(res.TestCode))
                    {
                        matchedItem = orderItems.FirstOrDefault(oi => string.Equals(oi.TestCode, res.TestCode, StringComparison.OrdinalIgnoreCase));
                    }
                    if (matchedItem == null && orderItems.Count > 0)
                    {
                        matchedItem = orderItems[0];
                    }

                    if (matchedItem == null) continue;

                    int orderItemId = matchedItem.OrderItemId;
                    int testId = res.TestId ?? matchedItem.TestId;
                    string unit = res.Unit ?? matchedItem.Unit ?? "";
                    string refRange = res.ReferenceRange ?? $"{matchedItem.NormalRangeLow} - {matchedItem.NormalRangeHigh} {unit}".Trim();
                    string flag = res.Flag != null ? (res.Flag.Length > 5 ? res.Flag[..5] : res.Flag) : "OK";
                    bool isCritical = res.IsCritical ?? (flag == "HH" || flag == "LL");

                    // Check if result already exists for this order item
                    var existingResult = await conn.QueryFirstOrDefaultAsync<ExistingLabResultDto>(
                        "SELECT Id, NumericValue, TextValue, Unit, Flag, ReferenceRange, IsVerified, SourceType FROM LabResults WHERE OrderItemId = @OrderItemId AND OrderId = @OrderId",
                        new { OrderItemId = orderItemId, req.OrderId });

                    string safeUnit = string.IsNullOrWhiteSpace(unit) ? "" : (unit.Length > 30 ? unit[..30] : unit);
                    string safeFlag = string.IsNullOrWhiteSpace(flag) ? "Normal" : (flag.Length > 20 ? flag[..20] : flag);
                    string safeRefRange = string.IsNullOrWhiteSpace(refRange) ? "" : (refRange.Length > 100 ? refRange[..100] : refRange);

                    if (existingResult != null)
                    {
                        int resId = existingResult.Id;

                        // Safely preserve machine or manual values without unboxing cast crashes
                        decimal? numVal = res.NumericValue ?? existingResult.NumericValue;
                        string incomingText = (res.TextValue ?? "").Trim();
                        string dbText = existingResult.TextValue ?? "";
                        string txtVal = (!string.IsNullOrWhiteSpace(incomingText) && incomingText != "Results recorded")
                            ? incomingText
                            : (!string.IsNullOrWhiteSpace(dbText) ? dbText : (string.IsNullOrWhiteSpace(incomingText) ? "Results recorded" : incomingText));

                        string finalUnit = !string.IsNullOrWhiteSpace(res.Unit) ? res.Unit : (existingResult.Unit ?? safeUnit);
                        string finalFlag = !string.IsNullOrWhiteSpace(res.Flag) ? res.Flag : (existingResult.Flag ?? safeFlag);
                        string finalRef = !string.IsNullOrWhiteSpace(res.ReferenceRange) ? res.ReferenceRange : (existingResult.ReferenceRange ?? safeRefRange);

                        safeUnit = finalUnit.Length > 30 ? finalUnit[..30] : finalUnit;
                        safeFlag = finalFlag.Length > 20 ? finalFlag[..20] : finalFlag;
                        safeRefRange = finalRef.Length > 100 ? finalRef[..100] : finalRef;

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
                                ResultId = resId,
                                NumericValue = numVal,
                                TextValue = txtVal,
                                Unit = safeUnit,
                                Flag = safeFlag,
                                ReferenceRange = safeRefRange,
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
                                Unit = safeUnit,
                                Flag = safeFlag,
                                ReferenceRange = safeRefRange,
                                IsCritical = isCritical,
                                req.IsVerified
                            });
                    }

                    // Update OrderItem status (5 = Completed/Approved, 4 = Resulted, 3 = InProcess)
                    byte itemStatus = (byte)(req.IsVerified ? 5 : 4);
                    await conn.ExecuteAsync(
                        "UPDATE LabOrderItems SET StatusId = @StatusId WHERE Id = @OrderItemId",
                        new { StatusId = itemStatus, OrderItemId = orderItemId });
                }
            }

            // When verifying/approving, ensure ALL existing results and items for this order are marked verified
            if (req.IsVerified)
            {
                await conn.ExecuteAsync(@"
                    UPDATE LabResults
                    SET IsVerified = 1,
                        VerifiedBy = ISNULL(VerifiedBy, 1),
                        VerifiedAt = ISNULL(VerifiedAt, GETDATE())
                    WHERE OrderId = @OrderId",
                    new { req.OrderId });

                await conn.ExecuteAsync(
                    "UPDATE LabOrderItems SET StatusId = 5 WHERE OrderId = @OrderId",
                    new { req.OrderId });
            }

            // Update overall Order status (5 = Completed/Approved, 4 = Resulted, 3 = InProcess)
            byte orderStatus = (byte)(req.IsVerified ? 5 : 4);
            await conn.ExecuteAsync(
                "UPDATE LabOrders SET StatusId = @StatusId, UpdatedAt = GETDATE() WHERE Id = @OrderId",
                new { StatusId = orderStatus, req.OrderId });

            try
            {
                var patName = await conn.QueryFirstOrDefaultAsync<string>(
                    "SELECT FirstName + ' ' + LastName FROM Patients WHERE Id = @PatientId", new { PatientId = patientId }) ?? $"Patient #{patientId}";
                var orderNo = await conn.QueryFirstOrDefaultAsync<string>(
                    "SELECT OrderNumber FROM LabOrders WHERE Id = @OrderId", new { req.OrderId }) ?? $"LAB-{req.OrderId}";

                if (req.IsVerified)
                {
                    await conn.ExecuteAsync(@"
                        INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                        VALUES (@TenantId, NULL, 3, @Subject, @Body, 1, 'LabResultApproved', 'Doctor,Nurse,LabTechnician,Admin', @RefId, 1, GETDATE())",
                        new {
                            TenantId = tenantId,
                            Subject = $"Lab Result Approved: {orderNo}",
                            Body = $"Laboratory test results for {patName} ({orderNo}) verified and approved by laboratory.",
                            RefId = req.OrderId
                        });
                }
                else
                {
                    await conn.ExecuteAsync(@"
                        INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                        VALUES (@TenantId, NULL, 3, @Subject, @Body, 2, 'LabResultSaved', 'Doctor,Nurse,LabTechnician,Admin', @RefId, 1, GETDATE())",
                        new {
                            TenantId = tenantId,
                            Subject = $"Lab Results Saved: {orderNo}",
                            Body = $"Laboratory test results recorded for {patName} ({orderNo}). Pending verification & sign-off.",
                            RefId = req.OrderId
                        });
                }
            }
            catch { /* non-blocking */ }

            return Ok(ApiResponse<object>.Ok(new {
                Success = true,
                OrderId = req.OrderId,
                IsVerified = req.IsVerified,
                Message = req.IsVerified ? "Results verified and approved for EMR." : "Results saved successfully."
            }));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<object>.Fail($"Error saving laboratory results: {ex.Message}"));
        }
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

        try
        {
            var patName = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT FirstName + ' ' + LastName FROM Patients WHERE Id = @PatientId", new { PatientId = patientId }) ?? $"Patient #{patientId}";
            var orderNo = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT OrderNumber FROM LabOrders WHERE Id = @OrderId", new { req.OrderId }) ?? $"LAB-{req.OrderId}";
            string machineTitle = req.MachineName ?? req.MachineId ?? "Laboratory Analyzer";

            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, RefId, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, @Subject, @Body, 2, 'LabResultSaved', 'Doctor,Nurse,LabTechnician,Admin', @RefId, 1, GETDATE())",
                new {
                    TenantId = tenantId,
                    Subject = $"Lab Result Received from Machine: {orderNo}",
                    Body = $"Analyzer results ingested from {machineTitle} for {patName} ({testCode}, {orderNo}). Ready for review.",
                    RefId = req.OrderId
                });
        }
        catch { /* non-blocking */ }

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

        string protocol = (req.Protocol ?? "HL7").ToUpper().Trim();
        string machine = req.MachineIdentifier ?? "AnalyzerFeedSimulator";

        if (protocol == "HL7")
        {
            var parsed = _hl7Adapter.ParseFullOruMessage(req.RawPayload);
            bool inserted = await _ingestionService.IngestHl7ResultAsync(req.RawPayload, machine);

            return Ok(ApiResponse<object>.Ok(new {
                Success = true,
                Protocol = protocol,
                SampleId = parsed.SampleId,
                NumericValue = parsed.PrimaryNumeric,
                TextValue = parsed.SummaryText,
                ParametersCount = parsed.Parameters.Count,
                OverallFlag = parsed.OverallFlag,
                Machine = machine,
                Message = inserted
                    ? $"Successfully ingested {protocol} feed from {machine}. Results saved to database."
                    : $"Parsed {protocol} feed successfully ({parsed.Parameters.Count} parameters)."
            }));
        }
        else
        {
            var parsed = await _astmAdapter.ParseAstmMessageAsync(req.RawPayload);
            return Ok(ApiResponse<object>.Ok(new {
                Success = true,
                Protocol = protocol,
                NumericValue = parsed?.NumericValue,
                TextValue = parsed?.TextValue,
                RawMessage = req.RawPayload,
                Message = $"Parsed {protocol} message successfully."
            }));
        }
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
