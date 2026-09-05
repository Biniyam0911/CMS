-- ============================================================
-- 20 - Pharmacy Pricing (Cost vs Selling) & Batch Inventory Schema
-- ============================================================
USE ClinicDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DrugFormulary') AND name = 'CostPrice')
BEGIN
    ALTER TABLE DrugFormulary ADD CostPrice DECIMAL(10,2) NOT NULL DEFAULT 0.00;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DrugFormulary') AND name = 'SellingPrice')
BEGIN
    ALTER TABLE DrugFormulary ADD SellingPrice DECIMAL(10,2) NOT NULL DEFAULT 0.00;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DrugFormulary') AND name = 'BatchNumber')
BEGIN
    ALTER TABLE DrugFormulary ADD BatchNumber VARCHAR(50) NULL DEFAULT 'BATCH-2026-A';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DrugFormulary') AND name = 'ExpiryDate')
BEGIN
    ALTER TABLE DrugFormulary ADD ExpiryDate DATE NULL DEFAULT '2028-12-31';
END
GO

CREATE TABLE PharmacyRestockLogs (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    DrugId          INT             NOT NULL,
    BatchNumber     VARCHAR(50)     NOT NULL,
    QuantityAdded   INT             NOT NULL,
    UnitCostPrice   DECIMAL(10,2)   NOT NULL,
    UnitSellingPrice DECIMAL(10,2)  NOT NULL,
    ExpiryDate      DATE            NOT NULL,
    SupplierName    NVARCHAR(100)   NULL,
    RestockedBy     INT             NOT NULL,
    RestockedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_PharmacyRestockLogs PRIMARY KEY (Id),
    CONSTRAINT FK_PharmacyRestock_Drug FOREIGN KEY (DrugId) REFERENCES DrugFormulary(Id) ON DELETE CASCADE
);
GO
