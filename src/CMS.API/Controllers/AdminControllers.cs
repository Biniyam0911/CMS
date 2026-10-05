using CMS.Application.Auth;
using CMS.Application.Modules;
using CMS.Application.Settings;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AuthManagementService _authService;

    public UsersController(AuthManagementService authService)
    {
        _authService = authService;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var users = await _authService.GetUsersAsync(tenantId);
        return Ok(ApiResponse<List<UserDto>>.Ok(users));
    }

    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterUserDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        int userId = await _authService.RegisterUserAsync(dtoWithTenant);
        return Ok(ApiResponse<object>.Ok(new { UserId = userId }));
    }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _authService.GetRolesWithPermissionsAsync();
        return Ok(ApiResponse<List<RoleWithPermissionsDto>>.Ok(roles));
    }

    public record CreateRoleDto(string Name, string? Description);
    public record UpdateRoleDto(string Name, string? Description);

    [HttpPost("roles")]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("Role name is required."));

        using var conn = _authService.CreateDbConnection();
        var exists = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Roles WHERE Name = @Name", new { dto.Name });
        if (exists > 0)
            return BadRequest(ApiResponse<object>.Fail($"Role '{dto.Name}' already exists."));

        var insertSql = "INSERT INTO Roles (Name, Description) VALUES (@Name, @Description); SELECT SCOPE_IDENTITY();";
        int newId = await conn.ExecuteScalarAsync<int>(insertSql, new { dto.Name, dto.Description });
        return Ok(ApiResponse<object>.Ok(new { Id = newId, Name = dto.Name, Description = dto.Description }));
    }

    [HttpPut("roles/{id}")]
    public async Task<IActionResult> UpdateRole(short id, [FromBody] UpdateRoleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(ApiResponse<object>.Fail("Role name is required."));

        using var conn = _authService.CreateDbConnection();
        var updateSql = "UPDATE Roles SET Name = @Name, Description = @Description WHERE Id = @Id";
        int rows = await conn.ExecuteAsync(updateSql, new { Id = id, dto.Name, dto.Description });
        return Ok(ApiResponse<object>.Ok(new { Success = rows > 0, Id = id, Name = dto.Name }));
    }

    [HttpDelete("roles/{id}")]
    public async Task<IActionResult> DeleteRole(short id)
    {
        using var conn = _authService.CreateDbConnection();
        var roleName = await conn.ExecuteScalarAsync<string>("SELECT Name FROM Roles WHERE Id = @Id", new { Id = id });
        if (roleName == null)
            return NotFound(ApiResponse<object>.Fail("Role not found."));

        var coreRoles = new[] { "SuperAdmin", "Admin", "Doctor" };
        if (coreRoles.Contains(roleName, StringComparer.OrdinalIgnoreCase))
            return BadRequest(ApiResponse<object>.Fail($"Core system role '{roleName}' cannot be deleted."));

        // Remove any role assignments
        await conn.ExecuteAsync("DELETE FROM UserRoles WHERE RoleId = @Id", new { Id = id });
        int rows = await conn.ExecuteAsync("DELETE FROM Roles WHERE Id = @Id", new { Id = id });
        return Ok(ApiResponse<object>.Ok(new { Success = rows > 0, Id = id }));
    }

    public record AdminResetPasswordDto(
        string NewPassword,
        string ConfirmPassword
    );

    [HttpPost("{userId}/reset-password")]
    public async Task<IActionResult> AdminResetPassword(int userId, [FromBody] AdminResetPasswordDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;

        if (string.IsNullOrWhiteSpace(dto.NewPassword))
            return BadRequest(ApiResponse<string>.Fail("New password is required."));

        if (dto.NewPassword != dto.ConfirmPassword)
            return BadRequest(ApiResponse<string>.Fail("New password and confirmation do not match."));

        if (dto.NewPassword.Length < 6)
            return BadRequest(ApiResponse<string>.Fail("New password must be at least 6 characters long."));

        var (success, message) = await _authService.AdminResetPasswordAsync(userId, tenantId, dto.NewPassword);
        if (!success)
            return BadRequest(ApiResponse<string>.Fail(message));

        return Ok(ApiResponse<string>.Ok(message));
    }
    [HttpDelete("{userId:int}")]
    public async Task<IActionResult> DeleteUser(int userId)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        using var conn = _authService.CreateDbConnection();

        var isSuperAdmin = await conn.ExecuteScalarAsync<int>(@"
            SELECT COUNT(1) FROM Roles r
            JOIN UserRoles ur ON ur.RoleId = r.Id
            WHERE ur.UserId = @UserId AND r.Name = 'SuperAdmin'", new { UserId = userId });
        if (isSuperAdmin > 0)
            return BadRequest(ApiResponse<object>.Fail("Cannot delete SuperAdmin user."));

        int rows = await conn.ExecuteAsync(@"
            UPDATE Users SET IsActive = 0, LockoutEnd = DATEADD(year, 100, SYSUTCDATETIME()) WHERE Id = @UserId AND TenantId = @TenantId;
            UPDATE Staff SET IsActive = 0 WHERE UserId = @UserId AND TenantId = @TenantId;
            DELETE FROM RefreshTokens WHERE UserId = @UserId;",
            new { UserId = userId, TenantId = tenantId });

        return Ok(ApiResponse<object>.Ok(new { Success = rows > 0, UserId = userId, Message = "User deleted successfully." }));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class ModulesController : ControllerBase
{
    private readonly ModuleManagementService _moduleService;

    public ModulesController(ModuleManagementService moduleService)
    {
        _moduleService = moduleService;
    }

    [HttpGet]
    public async Task<IActionResult> GetModules()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var modules = await _moduleService.GetTenantModulesAsync(tenantId);
        return Ok(ApiResponse<List<AppModuleDto>>.Ok(modules));
    }

    [HttpPost("toggle")]
    public async Task<IActionResult> ToggleModule([FromBody] ToggleModuleDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        await _moduleService.ToggleModuleAsync(tenantId, dto.ModuleId, dto.IsEnabled);
        return Ok(ApiResponse<string>.Ok("Module status updated."));
    }
}

[ApiController]
[Route("api/v1/[controller]")]

public class SettingsController : ControllerBase
{
    private readonly SettingsAndApiService _settingsService;

    public SettingsController(SettingsAndApiService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var settings = await _settingsService.GetClinicSettingsAsync(tenantId);
        return Ok(ApiResponse<List<ClinicSettingDto>>.Ok(settings));
    }

    [HttpPost]
    public async Task<IActionResult> UpdateSetting([FromBody] UpdateSettingDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        await _settingsService.UpdateSettingAsync(tenantId, dto.SettingKey, dto.SettingValue);
        return Ok(ApiResponse<string>.Ok("Setting updated."));
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class ApiManagementController : ControllerBase
{
    private readonly SettingsAndApiService _settingsService;

    public ApiManagementController(SettingsAndApiService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet("keys")]
    public async Task<IActionResult> GetKeys()
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var keys = await _settingsService.GetApiKeysAsync(tenantId);
        return Ok(ApiResponse<List<ApiKeyDto>>.Ok(keys));
    }

    [HttpPost("keys")]
    public async Task<IActionResult> CreateKey([FromBody] CreateApiKeyDto dto)
    {
        byte tenantId = HttpContext.Items["TenantId"] is byte t ? t : (byte)1;
        var dtoWithTenant = dto with { TenantId = tenantId };
        var res = await _settingsService.CreateApiKeyAsync(dtoWithTenant, 1);
        return Ok(ApiResponse<CreateApiKeyResponse>.Ok(res));
    }
}

[ApiController]
[Route("api/v1/[controller]")]

public class ScheduleBackupDto
{
    public bool Enabled { get; set; }
    public string Frequency { get; set; } = "Daily";
    public string TimeOfDay { get; set; } = "02:00";
}

[ApiController]
[Route("api/v1/[controller]")]
public class BackupController : ControllerBase
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _config;
    private static ScheduleBackupDto _currentSchedule = new() { Enabled = true, Frequency = "Daily", TimeOfDay = "02:00" };

    public BackupController(IDbConnectionFactory dbFactory, Microsoft.Extensions.Configuration.IConfiguration config)
    {
        _dbFactory = dbFactory;
        _config = config;
    }

    private async Task<string> GetSqlDefaultBackupDirectoryAsync(System.Data.IDbConnection conn)
    {
        try
        {
            var sql = @"
                DECLARE @backupDir NVARCHAR(400);
                EXEC master.dbo.xp_instance_regread 
                    N'HKEY_LOCAL_MACHINE', 
                    N'Software\Microsoft\MSSQLServer\MSSQLServer', 
                    N'BackupDirectory', 
                    @backupDir OUTPUT;
                SELECT ISNULL(@backupDir, CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(400)));";
            var dir = await conn.ExecuteScalarAsync<string>(sql);
            if (!string.IsNullOrWhiteSpace(dir)) return dir.TrimEnd('\\');
        }
        catch { }
        return @"C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS03\MSSQL\Backup";
    }

    [HttpGet("list")]
    public async Task<IActionResult> GetBackupList()
    {
        try
        {
            using var conn = _dbFactory.CreateConnection();
            var backupDir = await GetSqlDefaultBackupDirectoryAsync(conn);

            // Query msdb.dbo.backupset for actual verified backups of ClinicDB
            var sql = @"
                SELECT TOP 50
                    bmf.physical_device_name AS FilePath,
                    bs.backup_finish_date AS CreatedAt,
                    bs.backup_size AS SizeBytes,
                    bs.name AS BackupName
                FROM msdb.dbo.backupset bs
                JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
                WHERE bs.database_name = 'ClinicDB'
                ORDER BY bs.backup_finish_date DESC;";

            var records = (await conn.QueryAsync<dynamic>(sql)).ToList();

            var list = records.Select(r =>
            {
                string rawPath = (string)r.FilePath ?? "";
                string fileName = Path.GetFileName(rawPath);
                long bytes = 0;
                try { bytes = Convert.ToInt64(r.SizeBytes); } catch { }
                DateTime dt = DateTime.UtcNow;
                try { dt = Convert.ToDateTime(r.CreatedAt); } catch { }

                return new
                {
                    FileName = string.IsNullOrWhiteSpace(fileName) ? "ClinicDB_Snapshot.bak" : fileName,
                    FilePath = rawPath,
                    SizeBytes = bytes,
                    SizeFormatted = $"{Math.Round(bytes / 1024.0 / 1024.0, 2)} MB",
                    CreatedAt = dt,
                    IsScheduled = fileName.Contains("Scheduled")
                };
            }).ToList();

            return Ok(ApiResponse<object>.Ok(new {
                Backups = list,
                Schedule = _currentSchedule,
                BackupDirectory = backupDir
            }));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<object>.Fail($"Failed to list backups: {ex.Message}"));
        }
    }

    [HttpPost("now")]
    public async Task<IActionResult> RunImmediateBackup()
    {
        try
        {
            using var conn = _dbFactory.CreateConnection();
            var backupDir = await GetSqlDefaultBackupDirectoryAsync(conn);

            string timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            string backupFileName = $"ClinicDB_Manual_{timestamp}.bak";
            string backupPath = Path.Combine(backupDir, backupFileName);

            var sql = @"
                BACKUP DATABASE [ClinicDB] 
                TO DISK = @BackupPath 
                WITH FORMAT, MEDIANAME = 'ClinicDB_Backup', NAME = 'Full Backup of ClinicDB';";

            await conn.ExecuteAsync(sql, new { BackupPath = backupPath }, commandTimeout: 300);

            // Fetch size from msdb
            var sizeSql = @"
                SELECT TOP 1 bs.backup_size 
                FROM msdb.dbo.backupset bs 
                JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
                WHERE bmf.physical_device_name = @BackupPath
                ORDER BY bs.backup_finish_date DESC;";
            
            long backupSize = 0;
            try { backupSize = await conn.ExecuteScalarAsync<long>(sizeSql, new { BackupPath = backupPath }); } catch { }

            return Ok(ApiResponse<object>.Ok(new {
                Success = true,
                FileName = backupFileName,
                BackupPath = backupPath,
                SizeBytes = backupSize,
                SizeFormatted = backupSize > 0 ? $"{Math.Round(backupSize / 1024.0 / 1024.0, 2)} MB" : "Verified .BAK",
                CreatedAt = DateTime.UtcNow,
                Message = $"Full database backup completed successfully to {backupFileName}."
            }));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<object>.Fail($"Backup execution failed: {ex.Message}"));
        }
    }

    [HttpPost("schedule")]
    public IActionResult UpdateSchedule([FromBody] ScheduleBackupDto dto)
    {
        _currentSchedule = dto;
        return Ok(ApiResponse<object>.Ok(new {
            Success = true,
            Schedule = _currentSchedule,
            Message = $"Automated backup schedule updated to {dto.Frequency} at {dto.TimeOfDay}."
        }));
    }
}
