-- ============================================================
-- 19 - Lab Parameters & Profile Sub-Tests Schema
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE LabTestParameters (
    Id              INT             NOT NULL IDENTITY(1,1),
    TestCatalogId   INT             NOT NULL,
    ParameterCode   VARCHAR(50)     NOT NULL,
    ParameterName   NVARCHAR(100)   NOT NULL,
    Unit            VARCHAR(30)     NOT NULL,
    ReferenceLow    DECIMAL(10,2)   NULL,
    ReferenceHigh   DECIMAL(10,2)   NULL,
    TextReferenceRange NVARCHAR(200) NULL, -- for qualitative tests e.g. 'Negative'
    DisplayOrder    INT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_LabTestParameters PRIMARY KEY (Id),
    CONSTRAINT FK_LabTestParam_Catalog FOREIGN KEY (TestCatalogId) REFERENCES LabTestCatalog(Id) ON DELETE CASCADE
);
GO

-- Seed parameters for CBC (Complete Blood Count)
DECLARE @CbcId INT = (SELECT Id FROM LabTestCatalog WHERE TestCode = 'CBC-01');
IF @CbcId IS NOT NULL
BEGIN
    INSERT INTO LabTestParameters (TestCatalogId, ParameterCode, ParameterName, Unit, ReferenceLow, ReferenceHigh, DisplayOrder) VALUES
    (@CbcId, 'WBC', 'White Blood Cell Count', '10^3/uL', 4.50, 11.00, 1),
    (@CbcId, 'RBC', 'Red Blood Cell Count', '10^6/uL', 4.20, 5.80, 2),
    (@CbcId, 'HGB', 'Hemoglobin', 'g/dL', 12.00, 17.50, 3),
    (@CbcId, 'HCT', 'Hematocrit', '%', 37.00, 51.00, 4),
    (@CbcId, 'PLT', 'Platelet Count', '10^3/uL', 150.00, 450.00, 5);
END
GO

-- Seed parameters for LFT (Liver Function Test)
DECLARE @LftId INT = (SELECT Id FROM LabTestCatalog WHERE TestCode = 'LFT-01');
IF @LftId IS NOT NULL
BEGIN
    INSERT INTO LabTestParameters (TestCatalogId, ParameterCode, ParameterName, Unit, ReferenceLow, ReferenceHigh, DisplayOrder) VALUES
    (@LftId, 'ALT', 'Alanine Aminotransferase', 'U/L', 7.00, 56.00, 1),
    (@LftId, 'AST', 'Aspartate Aminotransferase', 'U/L', 10.00, 40.00, 2),
    (@LftId, 'ALP', 'Alkaline Phosphatase', 'U/L', 44.00, 147.00, 3),
    (@LftId, 'TBIL', 'Total Bilirubin', 'mg/dL', 0.10, 1.20, 4);
END
GO
