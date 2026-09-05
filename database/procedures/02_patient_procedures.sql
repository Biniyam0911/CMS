-- ============================================================
-- Stored Procedures — Patients
-- ============================================================
USE ClinicDB;
GO

-- sp_CreatePatient
CREATE OR ALTER PROCEDURE sp_CreatePatient
    @TenantId           TINYINT,
    @MRN                VARCHAR(20),
    @FirstName          NVARCHAR(100),
    @MiddleName         NVARCHAR(100) = NULL,
    @LastName           NVARCHAR(100),
    @DateOfBirth        DATE,
    @Gender             TINYINT,
    @NationalId         NVARCHAR(50) = NULL,
    @BloodGroup         VARCHAR(5) = NULL,
    @PrimaryPhone       VARCHAR(20),
    @SecondaryPhone     VARCHAR(20) = NULL,
    @Email              NVARCHAR(200) = NULL,
    @Address            NVARCHAR(500) = NULL,
    @City               NVARCHAR(100) = NULL,
    @InsuranceProvider  NVARCHAR(100) = NULL,
    @InsurancePolicyNo  NVARCHAR(100) = NULL,
    @EmergencyName      NVARCHAR(200) = NULL,
    @EmergencyPhone     VARCHAR(20) = NULL,
    @EmergencyRelation  NVARCHAR(50) = NULL,
    @Allergies          NVARCHAR(1000) = NULL,
    @CreatedBy          INT,
    @NewId              INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF EXISTS (SELECT 1 FROM Patients WHERE TenantId = @TenantId AND MRN = @MRN)
            THROW 50001, 'MRN already exists for this tenant.', 1;

        INSERT INTO Patients (
            TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender,
            NationalId, BloodGroup, PrimaryPhone, SecondaryPhone, Email, Address, City,
            InsuranceProvider, InsurancePolicyNo, EmergencyName, EmergencyPhone,
            EmergencyRelation, Allergies, CreatedBy, CreatedAt
        ) VALUES (
            @TenantId, @MRN, @FirstName, @MiddleName, @LastName, @DateOfBirth, @Gender,
            @NationalId, @BloodGroup, @PrimaryPhone, @SecondaryPhone, @Email, @Address, @City,
            @InsuranceProvider, @InsurancePolicyNo, @EmergencyName, @EmergencyPhone,
            @EmergencyRelation, @Allergies, @CreatedBy, GETDATE()
        );
        SET @NewId = SCOPE_IDENTITY();
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH;
END;
GO

-- sp_UpdatePatient
CREATE OR ALTER PROCEDURE sp_UpdatePatient
    @Id                 INT,
    @TenantId           TINYINT,
    @FirstName          NVARCHAR(100),
    @MiddleName         NVARCHAR(100) = NULL,
    @LastName           NVARCHAR(100),
    @DateOfBirth        DATE,
    @Gender             TINYINT,
    @PrimaryPhone       VARCHAR(20),
    @SecondaryPhone     VARCHAR(20) = NULL,
    @Email              NVARCHAR(200) = NULL,
    @Address            NVARCHAR(500) = NULL,
    @City               NVARCHAR(100) = NULL,
    @InsuranceProvider  NVARCHAR(100) = NULL,
    @InsurancePolicyNo  NVARCHAR(100) = NULL,
    @EmergencyName      NVARCHAR(200) = NULL,
    @EmergencyPhone     VARCHAR(20) = NULL,
    @EmergencyRelation  NVARCHAR(50) = NULL,
    @Allergies          NVARCHAR(1000) = NULL,
    @ChronicConditions  NVARCHAR(1000) = NULL,
    @Notes              NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Patients SET
        FirstName = @FirstName, MiddleName = @MiddleName, LastName = @LastName,
        DateOfBirth = @DateOfBirth, Gender = @Gender, PrimaryPhone = @PrimaryPhone,
        SecondaryPhone = @SecondaryPhone, Email = @Email, Address = @Address, City = @City,
        InsuranceProvider = @InsuranceProvider, InsurancePolicyNo = @InsurancePolicyNo,
        EmergencyName = @EmergencyName, EmergencyPhone = @EmergencyPhone,
        EmergencyRelation = @EmergencyRelation, Allergies = @Allergies,
        ChronicConditions = @ChronicConditions, Notes = @Notes,
        UpdatedAt = GETDATE()
    WHERE Id = @Id AND TenantId = @TenantId;
END;
GO

-- sp_SearchPatients (Full-Text + regular)
CREATE OR ALTER PROCEDURE sp_SearchPatients
    @TenantId   TINYINT,
    @Query      NVARCHAR(200),
    @PageNumber INT = 1,
    @PageSize   INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
    DECLARE @IsExact BIT = 0;

    -- Try exact MRN first
    IF EXISTS (SELECT 1 FROM Patients WHERE TenantId = @TenantId AND MRN = @Query)
    BEGIN
        SELECT Id, TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender,
               PrimaryPhone, Email, IsActive, CreatedAt
        FROM Patients
        WHERE TenantId = @TenantId AND MRN = @Query AND IsActive = 1;
        RETURN;
    END

    -- Full-text + LIKE fallback
    SELECT p.Id, p.TenantId, p.MRN, p.FirstName, p.MiddleName, p.LastName,
           p.DateOfBirth, p.Gender, p.PrimaryPhone, p.Email, p.IsActive, p.CreatedAt
    FROM Patients p
    WHERE p.TenantId = @TenantId AND p.IsActive = 1
      AND (CONTAINS(p.*, @Query)
           OR p.MRN LIKE '%' + @Query + '%'
           OR p.NationalId LIKE @Query + '%'
           OR p.PrimaryPhone LIKE @Query + '%')
    ORDER BY p.LastName, p.FirstName
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- sp_GetNextMRN  
CREATE OR ALTER PROCEDURE sp_GetNextMRN
    @TenantId   TINYINT,
    @MRN        VARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Max INT;
    SELECT @Max = ISNULL(MAX(CAST(SUBSTRING(MRN, PATINDEX('%[0-9]%', MRN), LEN(MRN)) AS INT)), 0)
    FROM Patients WHERE TenantId = @TenantId;
    SET @MRN = 'MRN-' + RIGHT('000000' + CAST(@Max + 1 AS VARCHAR), 6);
END;
GO
