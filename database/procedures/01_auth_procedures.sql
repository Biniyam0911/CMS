-- ============================================================
-- Stored Procedures — Authentication
-- ============================================================
USE ClinicDB;
GO

-- sp_GetUserByUsername
CREATE OR ALTER PROCEDURE sp_GetUserByUsername
    @TenantId   TINYINT,
    @Username   NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.Id, u.TenantId, u.Username, u.Email, u.PasswordHash, u.Salt,
           u.FirstName, u.LastName, u.Phone, u.IsActive, u.IsLocked,
           u.FailedLoginAttempts, u.LockoutEnd, u.MfaEnabled, u.MfaSecret,
           u.LastLoginAt,
           STRING_AGG(r.Name, ',') AS Roles
    FROM Users u
    LEFT JOIN UserRoles ur ON ur.UserId = u.Id
    LEFT JOIN Roles r ON r.Id = ur.RoleId
    WHERE u.TenantId = @TenantId AND u.Username = @Username
    GROUP BY u.Id, u.TenantId, u.Username, u.Email, u.PasswordHash, u.Salt,
             u.FirstName, u.LastName, u.Phone, u.IsActive, u.IsLocked,
             u.FailedLoginAttempts, u.LockoutEnd, u.MfaEnabled, u.MfaSecret, u.LastLoginAt;
END;
GO

-- sp_RecordSuccessfulLogin
CREATE OR ALTER PROCEDURE sp_RecordSuccessfulLogin
    @UserId BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users SET
        LastLoginAt = GETDATE(),
        FailedLoginAttempts = 0,
        IsLocked = 0,
        LockoutEnd = NULL,
        UpdatedAt = GETDATE()
    WHERE Id = @UserId;
END;
GO

-- sp_RecordFailedLogin
CREATE OR ALTER PROCEDURE sp_RecordFailedLogin
    @UserId BIGINT,
    @MaxAttempts TINYINT = 5,
    @LockoutMinutes INT = 30
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Attempts TINYINT;
    SELECT @Attempts = FailedLoginAttempts + 1 FROM Users WHERE Id = @UserId;
    UPDATE Users SET
        FailedLoginAttempts = @Attempts,
        IsLocked = CASE WHEN @Attempts >= @MaxAttempts THEN 1 ELSE 0 END,
        LockoutEnd = CASE WHEN @Attempts >= @MaxAttempts THEN DATEADD(MINUTE, @LockoutMinutes, GETDATE()) ELSE NULL END,
        UpdatedAt = GETDATE()
    WHERE Id = @UserId;
END;
GO

-- sp_SaveRefreshToken
CREATE OR ALTER PROCEDURE sp_SaveRefreshToken
    @UserId     INT,
    @Token      NVARCHAR(500),
    @ExpiresAt  DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    -- Rotate: revoke all previous tokens
    UPDATE RefreshTokens SET IsRevoked = 1, RevokedAt = GETDATE()
    WHERE UserId = @UserId AND IsRevoked = 0;
    -- Insert new
    INSERT INTO RefreshTokens (UserId, Token, ExpiresAt)
    VALUES (@UserId, @Token, @ExpiresAt);
END;
GO

-- sp_RevokeRefreshToken
CREATE OR ALTER PROCEDURE sp_RevokeRefreshToken
    @Token NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE RefreshTokens SET IsRevoked = 1, RevokedAt = GETDATE()
    WHERE Token = @Token;
END;
GO
