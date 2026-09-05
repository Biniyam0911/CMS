-- ============================================================
-- 01 - Tenants (Multi-clinic ready, single-clinic default)
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE Tenants (
    Id          TINYINT         NOT NULL IDENTITY(1,1),
    Name        NVARCHAR(100)   NOT NULL,
    Code        VARCHAR(20)     NOT NULL,
    Address     NVARCHAR(300)   NULL,
    Phone       VARCHAR(20)     NULL,
    Email       NVARCHAR(150)   NULL,
    LogoPath    NVARCHAR(500)   NULL,
    IsActive    BIT             NOT NULL DEFAULT 1,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt   DATETIME2       NULL,
    CONSTRAINT PK_Tenants PRIMARY KEY (Id),
    CONSTRAINT UQ_Tenants_Code UNIQUE (Code)
);
GO

-- Seed: default single clinic tenant
INSERT INTO Tenants (Name, Code, IsActive)
VALUES ('Main Clinic', 'MAIN', 1);
GO
