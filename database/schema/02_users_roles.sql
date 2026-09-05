-- ============================================================
-- 02 - Users, Roles, UserRoles
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE Roles (
    Id          SMALLINT        NOT NULL IDENTITY(1,1),
    Name        NVARCHAR(50)    NOT NULL,
    Description NVARCHAR(200)   NULL,
    CONSTRAINT PK_Roles PRIMARY KEY (Id),
    CONSTRAINT UQ_Roles_Name UNIQUE (Name)
);
GO

INSERT INTO Roles (Name, Description) VALUES
('SuperAdmin',    'Full system access'),
('Admin',         'Clinic administration'),
('Doctor',        'Physician / Medical doctor'),
('Nurse',         'Nursing staff'),
('Receptionist',  'Front desk / appointment booking'),
('LabTechnician', 'Laboratory technician'),
('Pathologist',   'Lab result verification'),
('Pharmacist',    'Pharmacy / dispensing'),
('Patient',       'Self-service patient portal');
GO

CREATE TABLE Users (
    Id                  INT             NOT NULL IDENTITY(1,1),
    TenantId            TINYINT         NOT NULL DEFAULT 1,
    Username            NVARCHAR(100)   NOT NULL,
    Email               NVARCHAR(200)   NOT NULL,
    PasswordHash        NVARCHAR(500)   NOT NULL,
    Salt                NVARCHAR(100)   NOT NULL,
    FirstName           NVARCHAR(100)   NOT NULL,
    LastName            NVARCHAR(100)   NOT NULL,
    Phone               VARCHAR(20)     NULL,
    IsActive            BIT             NOT NULL DEFAULT 1,
    IsLocked            BIT             NOT NULL DEFAULT 0,
    FailedLoginAttempts TINYINT         NOT NULL DEFAULT 0,
    LockoutEnd          DATETIME2       NULL,
    MfaEnabled          BIT             NOT NULL DEFAULT 0,
    MfaSecret           NVARCHAR(200)   NULL,   -- TOTP secret (encrypted)
    LastLoginAt         DATETIME2       NULL,
    CreatedAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2       NULL,
    CONSTRAINT PK_Users PRIMARY KEY (Id),
    CONSTRAINT UQ_Users_Username UNIQUE (TenantId, Username),
    CONSTRAINT UQ_Users_Email UNIQUE (TenantId, Email),
    CONSTRAINT FK_Users_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
GO

CREATE TABLE UserRoles (
    UserId      INT         NOT NULL,
    RoleId      SMALLINT    NOT NULL,
    AssignedAt  DATETIME2   NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);
GO

CREATE TABLE RefreshTokens (
    Id          BIGINT          NOT NULL IDENTITY(1,1),
    UserId      INT             NOT NULL,
    Token       NVARCHAR(500)   NOT NULL,
    ExpiresAt   DATETIME2       NOT NULL,
    IsRevoked   BIT             NOT NULL DEFAULT 0,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    RevokedAt   DATETIME2       NULL,
    CONSTRAINT PK_RefreshTokens PRIMARY KEY (Id),
    CONSTRAINT UQ_RefreshTokens_Token UNIQUE (Token),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_RefreshTokens_Token ON RefreshTokens (Token) WHERE IsRevoked = 0;
CREATE INDEX IX_Users_TenantId ON Users (TenantId);
GO
