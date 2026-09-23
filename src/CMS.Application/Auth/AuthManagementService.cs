using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CMS.Application.Auth;

public class AuthManagementService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly IConfiguration _config;
    private readonly ICacheService _cache;

    public AuthManagementService(IDbConnectionFactory dbFactory, IConfiguration config, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _config = config;
        _cache = cache;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT u.Id, u.TenantId, u.Username, u.Email, u.PasswordHash, u.Salt,
                   u.FirstName, u.LastName, u.IsActive, u.IsLocked, u.MfaEnabled, u.MfaSecret,
                   STRING_AGG(r.Name, ',') AS Roles
            FROM Users u
            LEFT JOIN UserRoles ur ON ur.UserId = u.Id
            LEFT JOIN Roles r ON r.Id = ur.RoleId
            WHERE u.TenantId = @TenantId AND (u.Username = @Username OR u.Email = @Username)
            GROUP BY u.Id, u.TenantId, u.Username, u.Email, u.PasswordHash, u.Salt,
                     u.FirstName, u.LastName, u.IsActive, u.IsLocked, u.MfaEnabled, u.MfaSecret";

        var user = await conn.QueryFirstOrDefaultAsync<dynamic>(sql, new { request.TenantId, request.Username });
        if (user == null || (bool)user.IsActive == false || (bool)user.IsLocked == true)
            return null;

        // Verify password
        string salt = (string)user.Salt;
        string expectedHash = (string)user.PasswordHash;
        string computedHash = HashPassword(request.Password, salt);

        if (computedHash != expectedHash)
            return null;

        var roles = ((string)(user.Roles ?? "Staff")).Split(',');

        // Resolve DoctorId and StaffId so the frontend correctly identifies the logged-in doctor
        var sqlIds = @"
            SELECT s.Id AS StaffId, d.Id AS DoctorId
            FROM Staff s
            LEFT JOIN Doctors d ON d.StaffId = s.Id
            WHERE s.UserId = @UserId";
        var ids = await conn.QueryFirstOrDefaultAsync<dynamic>(sqlIds, new { UserId = (int)user.Id });
        int? resolvedDoctorId = null;
        int? resolvedStaffId = null;
        if (ids != null)
        {
            try { resolvedDoctorId = (ids.DoctorId == null || ids.DoctorId is DBNull) ? null : (int?)Convert.ToInt32(ids.DoctorId); } catch { }
            try { resolvedStaffId = (ids.StaffId == null || ids.StaffId is DBNull) ? null : (int?)Convert.ToInt32(ids.StaffId); } catch { }
        }

        var userDto = new UserDto(
            (int)user.Id,
            (byte)user.TenantId,
            (string)user.Username,
            (string)user.Email,
            (string)user.FirstName,
            (string)user.LastName,
            roles,
            (bool)user.MfaEnabled,
            DoctorId: resolvedDoctorId,
            StaffId: resolvedStaffId
        );

        var token = GenerateJwtToken(userDto);
        var refreshToken = Guid.NewGuid().ToString("N");

        // Save refresh token
        var sqlToken = @"
            INSERT INTO RefreshTokens (UserId, Token, ExpiresAt)
            VALUES (@UserId, @Token, DATEADD(DAY, 7, GETDATE()))";
        await conn.ExecuteAsync(sqlToken, new { UserId = userDto.Id, Token = refreshToken });

        return new LoginResponse(token, refreshToken, 60, userDto);
    }

    public async Task<List<UserDto>> GetUsersAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT u.Id, u.TenantId, u.Username, u.Email, u.FirstName, u.LastName,
                   u.MfaEnabled, STRING_AGG(r.Name, ',') AS Roles
            FROM Users u
            LEFT JOIN UserRoles ur ON ur.UserId = u.Id
            LEFT JOIN Roles r ON r.Id = ur.RoleId
            WHERE u.TenantId = @TenantId
            GROUP BY u.Id, u.TenantId, u.Username, u.Email, u.FirstName, u.LastName, u.MfaEnabled
            ORDER BY u.LastName, u.FirstName";

        var rows = await conn.QueryAsync<dynamic>(sql, new { TenantId = tenantId });
        return rows.Select(r => new UserDto(
            (int)r.Id, (byte)r.TenantId, (string)r.Username, (string)r.Email,
            (string)r.FirstName, (string)r.LastName,
            ((string)(r.Roles ?? "Staff")).Split(','),
            (bool)r.MfaEnabled
        )).ToList();
    }

    public async Task<int> RegisterUserAsync(RegisterUserDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var salt = Guid.NewGuid().ToString("N");
        var hash = HashPassword(dto.Password, salt);

        var sqlUser = @"
            INSERT INTO Users (TenantId, Username, Email, PasswordHash, Salt, FirstName, LastName, Phone, IsActive)
            VALUES (@TenantId, @Username, @Email, @PasswordHash, @Salt, @FirstName, @LastName, @Phone, 1);
            SELECT SCOPE_IDENTITY();";

        int userId = await conn.ExecuteScalarAsync<int>(sqlUser, new {
            dto.TenantId, dto.Username, dto.Email, PasswordHash = hash, Salt = salt,
            dto.FirstName, dto.LastName, dto.Phone
        });

        foreach (var roleId in dto.RoleIds)
        {
            await conn.ExecuteAsync("INSERT INTO UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId)",
                new { UserId = userId, RoleId = roleId });
        }

        return userId;
    }

    public async Task<List<RoleWithPermissionsDto>> GetRolesWithPermissionsAsync()
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT r.Id, r.Name, r.Description, COUNT(ur.UserId) AS UserCount
            FROM Roles r
            LEFT JOIN UserRoles ur ON ur.RoleId = r.Id
            GROUP BY r.Id, r.Name, r.Description";

        var roles = await conn.QueryAsync<dynamic>(sql);
        return roles.Select(r => new RoleWithPermissionsDto(
            (short)r.Id, (string)r.Name, (string?)r.Description, (int)r.UserCount,
            new[] { "View", "Create", "Edit", "Delete" }
        )).ToList();
    }

    public string GenerateJwtToken(UserDto user)
    {
        var key = _config["Jwt:Key"] ?? "SuperSecretKeyThatIsAtLeast32BytesLongForCMS!";
        var issuer = _config["Jwt:Issuer"] ?? "CMS";
        var audience = _config["Jwt:Audience"] ?? "CMS";

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new("TenantId", user.TenantId.ToString())
        };

        foreach (var role in user.Roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(2),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string HashPassword(string password, string salt)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password + salt));
        return Convert.ToBase64String(bytes);
    }
}
