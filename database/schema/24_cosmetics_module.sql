-- =========================================================================================
-- MIGRATION SCRIPT: 24_cosmetics_module.sql
-- DESCRIPTION: Cosmetics Stock, Item Registration, Cash Sales, and Sales Reporting
-- TENANT ARCHITECTURE: Multi-tenant enabled (TenantId DEFAULT 1)
-- =========================================================================================

USE [ClinicDB];
GO

-- 1. Cosmetics Items & Stock Inventory Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CosmeticsItems')
BEGIN
    CREATE TABLE dbo.CosmeticsItems (
        Id                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TenantId            TINYINT NOT NULL DEFAULT 1,
        Code                NVARCHAR(50) NOT NULL,
        Description         NVARCHAR(255) NOT NULL,
        PurchaseUnitPrice   DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Quantity            DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Margin              DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
        SellingUnitPrice    DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        TotalPurchasePrice  DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        TotalSellingPrice   DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        RegistrationDate    DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        IsActive            BIT NOT NULL DEFAULT 1,
        CreatedAt           DATETIME2(7) NOT NULL DEFAULT GETDATE(),
        UpdatedAt           DATETIME2(7) NULL
    );

    CREATE UNIQUE NONCLUSTERED INDEX UX_CosmeticsItems_Tenant_Code 
        ON dbo.CosmeticsItems(TenantId, Code);
    CREATE NONCLUSTERED INDEX IX_CosmeticsItems_Description 
        ON dbo.CosmeticsItems(TenantId, Description);
    CREATE NONCLUSTERED INDEX IX_CosmeticsItems_Quantity 
        ON dbo.CosmeticsItems(TenantId, Quantity);
END;
GO

-- 2. Cosmetics Sales Master (Transaction / Invoice Header)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CosmeticsSales')
BEGIN
    CREATE TABLE dbo.CosmeticsSales (
        Id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TenantId        TINYINT NOT NULL DEFAULT 1,
        InvoiceNumber   NVARCHAR(50) NOT NULL,
        MobileNo        NVARCHAR(30) NULL,
        FirstName       NVARCHAR(100) NULL,
        MiddleName      NVARCHAR(100) NULL,
        LastName        NVARCHAR(100) NULL,
        FullName        AS (TRIM(CONCAT(FirstName, ' ', MiddleName, ' ', LastName))) PERSISTED,
        IsPlc           BIT NOT NULL DEFAULT 0,
        IsOther         BIT NOT NULL DEFAULT 0,
        TotalAmount     DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PaymentStatus   NVARCHAR(50) NOT NULL DEFAULT 'Paid',
        SaleDate        DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        SaleTime        TIME(0) NOT NULL DEFAULT CAST(GETDATE() AS TIME(0)),
        CreatedBy       INT NULL,
        CreatedByName   NVARCHAR(100) NULL,
        CreatedAt       DATETIME2(7) NOT NULL DEFAULT GETDATE(),
        UpdatedAt       DATETIME2(7) NULL
    );

    CREATE NONCLUSTERED INDEX IX_CosmeticsSales_Tenant_Date 
        ON dbo.CosmeticsSales(TenantId, SaleDate DESC);
    CREATE NONCLUSTERED INDEX IX_CosmeticsSales_Mobile 
        ON dbo.CosmeticsSales(TenantId, MobileNo);
    CREATE NONCLUSTERED INDEX IX_CosmeticsSales_IsPlc 
        ON dbo.CosmeticsSales(TenantId, IsPlc);
    CREATE NONCLUSTERED INDEX IX_CosmeticsSales_Invoice 
        ON dbo.CosmeticsSales(TenantId, InvoiceNumber);
END;
GO

-- 3. Cosmetics Sale Items (Line Items)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CosmeticsSaleItems')
BEGIN
    CREATE TABLE dbo.CosmeticsSaleItems (
        Id                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TenantId            TINYINT NOT NULL DEFAULT 1,
        SaleId              INT NOT NULL,
        ItemId              INT NULL,
        ItemCode            NVARCHAR(50) NOT NULL,
        ItemDescription     NVARCHAR(255) NOT NULL,
        Quantity            DECIMAL(18,2) NOT NULL DEFAULT 1.00,
        UnitPrice           DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        TotalPrice          DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PurchaseUnitPrice   DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        CreatedAt           DATETIME2(7) NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_CosmeticsSaleItems_Sale FOREIGN KEY (SaleId) REFERENCES dbo.CosmeticsSales(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CosmeticsSaleItems_Item FOREIGN KEY (ItemId) REFERENCES dbo.CosmeticsItems(Id) ON DELETE SET NULL
    );

    CREATE NONCLUSTERED INDEX IX_CosmeticsSaleItems_SaleId 
        ON dbo.CosmeticsSaleItems(SaleId);
    CREATE NONCLUSTERED INDEX IX_CosmeticsSaleItems_ItemId 
        ON dbo.CosmeticsSaleItems(ItemId);
END;
GO

-- 4. Seed Cosmetics Stock items directly matching the screenshot
IF NOT EXISTS (SELECT 1 FROM dbo.CosmeticsItems WHERE TenantId = 1)
BEGIN
    INSERT INTO dbo.CosmeticsItems (TenantId, Code, Description, PurchaseUnitPrice, Quantity, Margin, SellingUnitPrice, TotalPurchasePrice, TotalSellingPrice, RegistrationDate, IsActive)
    VALUES
    (1, 'ECR02', 'Eucerin pigment control SPF', 5128.20, 15.00, 1.56, 8000.00, 76923.00, 120000.00, '2024-09-17', 1),
    (1, 'ECR03', 'Eucerin Pigment control Tinted SPF', 5128.20, 9.00, 1.56, 8000.00, 46153.80, 72000.00, '2024-09-17', 1),
    (1, 'ECR04', 'Eucerin Day cream', 5128.20, 15.00, 1.56, 8000.00, 76923.00, 120000.00, '2024-09-17', 1),
    (1, 'ECR05', 'Eucerin Night cream', 5128.20, 15.00, 1.56, 8000.00, 76923.00, 120000.00, '2024-09-17', 1),
    (1, 'ECR06', 'Eucerin Face Wash', 2884.62, 15.00, 1.56, 4500.00, 43269.30, 67500.00, '2024-09-17', 1),
    (1, 'LRP01', 'Laroche mela B3 serums', 5128.20, 15.00, 1.56, 8000.00, 76923.00, 120000.00, '2024-09-17', 1),
    (1, 'LRP02', 'Laroche serums', 3846.15, 15.00, 1.56, 6000.00, 57692.25, 90000.00, '2024-09-17', 1),
    (1, 'LRP03', 'Laroche invisible fluid SPF', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1),
    (1, 'LRP04', 'Laroche tinted fluid SPF', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1),
    (1, 'LRP05', 'Laroche Oil control fluid SPF', 3205.13, 12.00, 1.56, 5000.00, 38461.56, 60000.00, '2024-09-17', 1),
    (1, 'LRP06', 'Laroche Oil control gel SPF', 3205.13, 12.00, 1.56, 5000.00, 38461.56, 60000.00, '2024-09-17', 1),
    (1, 'LRP07', 'Laroche Cream Hydrante SPF', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1),
    (1, 'LRP08', 'Laroche cream Hydrante Tinted SPF', 3205.13, 12.00, 1.56, 5000.00, 38461.56, 60000.00, '2024-09-17', 1),
    (1, 'LRP09', 'Laroche pigment correct SPF', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1),
    (1, 'LRP10', 'Laroche kids SPF', 3205.13, 14.00, 1.56, 5000.00, 44871.82, 70000.00, '2024-09-17', 1),
    (1, 'LRP11', 'Laroche Face moisturizer', 3205.13, 13.00, 1.56, 5000.00, 41666.69, 65000.00, '2024-09-17', 1),
    (1, 'LRP12', 'Laroche Face moisturizer UV', 3205.13, 14.00, 1.56, 5000.00, 44871.82, 70000.00, '2024-09-17', 1),
    (1, 'LRP13', 'Laroche Matte miosutrizer', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1),
    (1, 'LRP14', 'Laroche lipkar cream', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1),
    (1, 'LRP15', 'Laroche lipkar wash', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1),
    (1, 'LRP16', 'Laroche tolerine foaming cleanser', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1),
    (1, 'LRP17', 'Laroche tolerine hydrating gentle cleanser', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1),
    (1, 'LRP18', 'Laroche effaclar wash', 3205.13, 11.00, 1.56, 5000.00, 35256.43, 55000.00, '2024-09-17', 1),
    (1, 'LRP19', 'Laroche Tinted mineral SPF', 3205.13, 15.00, 1.56, 5000.00, 48076.95, 75000.00, '2024-09-17', 1);
END;
GO

-- 5. Seed initial sales records for reporting
IF NOT EXISTS (SELECT 1 FROM dbo.CosmeticsSales WHERE TenantId = 1)
BEGIN
    DECLARE @SaleId1 INT, @SaleId2 INT;

    INSERT INTO dbo.CosmeticsSales (TenantId, InvoiceNumber, MobileNo, FirstName, MiddleName, LastName, IsPlc, TotalAmount, PaymentStatus, SaleDate, SaleTime, CreatedByName)
    VALUES (1, 'CS-2026-0001', '0911223344', 'Selamawit', 'Tadesse', 'Bekele', 1, 16000.00, 'Paid', CAST(GETDATE() AS DATE), '10:30:00', 'Cashier');
    SET @SaleId1 = SCOPE_IDENTITY();

    INSERT INTO dbo.CosmeticsSaleItems (TenantId, SaleId, ItemId, ItemCode, ItemDescription, Quantity, UnitPrice, TotalPrice, PurchaseUnitPrice)
    VALUES (1, @SaleId1, 1, 'ECR02', 'Eucerin pigment control SPF', 2.00, 8000.00, 16000.00, 5128.20);

    INSERT INTO dbo.CosmeticsSales (TenantId, InvoiceNumber, MobileNo, FirstName, MiddleName, LastName, IsPlc, TotalAmount, PaymentStatus, SaleDate, SaleTime, CreatedByName)
    VALUES (1, 'CS-2026-0002', '0922334455', 'Abebe', 'Kebede', 'Haile', 0, 10000.00, 'Paid', CAST(GETDATE() AS DATE), '11:15:00', 'Cashier');
    SET @SaleId2 = SCOPE_IDENTITY();

    INSERT INTO dbo.CosmeticsSaleItems (TenantId, SaleId, ItemId, ItemCode, ItemDescription, Quantity, UnitPrice, TotalPrice, PurchaseUnitPrice)
    VALUES (1, @SaleId2, 8, 'LRP03', 'Laroche invisible fluid SPF', 2.00, 5000.00, 10000.00, 3205.13);
END;
GO
