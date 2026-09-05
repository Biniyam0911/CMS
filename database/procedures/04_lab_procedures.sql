-- ============================================================
-- Stored Procedures — Laboratory
-- ============================================================
USE ClinicDB;
GO

-- sp_CreateLabOrder
CREATE OR ALTER PROCEDURE sp_CreateLabOrder
    @TenantId       TINYINT,
    @PatientId      INT,
    @EncounterId    INT = NULL,
    @OrderedBy      INT,
    @Priority       TINYINT = 2,
    @ClinicalInfo   NVARCHAR(500) = NULL,
    @TestIds        NVARCHAR(MAX),   -- comma-separated TestIds: '1,2,5'
    @NewOrderId     INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Generate order number
        DECLARE @OrderNum VARCHAR(30);
        DECLARE @Seq INT;
        SELECT @Seq = ISNULL(MAX(Id), 0) + 1 FROM LabOrders WHERE TenantId = @TenantId;
        SET @OrderNum = 'LAB-' + CAST(@TenantId AS VARCHAR) + '-' + RIGHT('000000' + CAST(@Seq AS VARCHAR), 6);

        INSERT INTO LabOrders (TenantId, OrderNumber, PatientId, EncounterId, OrderedBy, Priority, ClinicalInfo)
        VALUES (@TenantId, @OrderNum, @PatientId, @EncounterId, @OrderedBy, @Priority, @ClinicalInfo);
        SET @NewOrderId = SCOPE_IDENTITY();

        -- Insert order items from comma-separated list
        INSERT INTO LabOrderItems (OrderId, TestId, StatusId)
        SELECT @NewOrderId, CAST(value AS INT), 1
        FROM STRING_SPLIT(@TestIds, ',')
        WHERE LTRIM(RTRIM(value)) <> '';

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

-- sp_CollectLabSample
CREATE OR ALTER PROCEDURE sp_CollectLabSample
    @OrderId        INT,
    @Barcode        VARCHAR(50),
    @SampleType     NVARCHAR(50),
    @Volume         VARCHAR(20) = NULL,
    @CollectedBy    INT,
    @NewSampleId    INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        INSERT INTO LabSamples (OrderId, Barcode, SampleType, Volume, CollectedBy)
        VALUES (@OrderId, @Barcode, @SampleType, @Volume, @CollectedBy);
        SET @NewSampleId = SCOPE_IDENTITY();

        UPDATE LabOrders SET StatusId = 2, UpdatedAt = GETDATE() WHERE Id = @OrderId;  -- Collected
        UPDATE LabOrderItems SET StatusId = 2 WHERE OrderId = @OrderId;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

-- sp_EnterLabResult
CREATE OR ALTER PROCEDURE sp_EnterLabResult
    @OrderItemId    INT,
    @NumericValue   DECIMAL(12,4) = NULL,
    @TextValue      NVARCHAR(500) = NULL,
    @EnteredBy      INT,
    @SourceType     TINYINT = 1,   -- 1=Manual 2=HL7 3=ASTM
    @RawMessage     NVARCHAR(MAX) = NULL,
    @NewResultId    INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @TestId INT, @OrderId INT, @PatientId INT;
        DECLARE @NLow DECIMAL(12,4), @NHigh DECIMAL(12,4), @CLow DECIMAL(12,4), @CHigh DECIMAL(12,4);
        DECLARE @Unit VARCHAR(30), @RefRange NVARCHAR(100);

        SELECT @TestId = oi.TestId, @OrderId = oi.OrderId
        FROM LabOrderItems oi WHERE oi.Id = @OrderItemId;

        SELECT @PatientId = PatientId FROM LabOrders WHERE Id = @OrderId;

        SELECT @NLow = NormalRangeLow, @NHigh = NormalRangeHigh,
               @CLow = CriticalLow, @CHigh = CriticalHigh, @Unit = Unit
        FROM LabTestCatalog WHERE Id = @TestId;

        SET @RefRange = CAST(ISNULL(@NLow, '?') AS VARCHAR) + ' - ' + CAST(ISNULL(@NHigh, '?') AS VARCHAR) + ' ' + ISNULL(@Unit, '');

        -- Determine flag
        DECLARE @Flag VARCHAR(5) = 'Normal';
        DECLARE @IsCritical BIT = 0;
        IF @NumericValue IS NOT NULL
        BEGIN
            IF   @NumericValue <= ISNULL(@CLow, -999999999)   SET @Flag = 'LL';
            ELIF @NumericValue >= ISNULL(@CHigh, 999999999)    SET @Flag = 'HH';
            ELIF @NumericValue <  ISNULL(@NLow, -999999999)   SET @Flag = 'L';
            ELIF @NumericValue >  ISNULL(@NHigh, 999999999)   SET @Flag = 'H';
            IF @Flag IN ('LL','HH') SET @IsCritical = 1;
        END;

        INSERT INTO LabResults (OrderItemId, OrderId, TestId, PatientId, NumericValue, TextValue,
                                Unit, Flag, ReferenceRange, IsCritical, EnteredBy, SourceType, RawMessage)
        VALUES (@OrderItemId, @OrderId, @TestId, @PatientId, @NumericValue, @TextValue,
                @Unit, @Flag, @RefRange, @IsCritical, @EnteredBy, @SourceType, @RawMessage);
        SET @NewResultId = SCOPE_IDENTITY();

        -- Update item status to Resulted
        UPDATE LabOrderItems SET StatusId = 4 WHERE Id = @OrderItemId;

        -- If all items resulted, update order status
        IF NOT EXISTS (SELECT 1 FROM LabOrderItems WHERE OrderId = @OrderId AND StatusId < 4)
            UPDATE LabOrders SET StatusId = 4, UpdatedAt = GETDATE() WHERE Id = @OrderId;

        -- Auto-create critical alert if needed
        IF @IsCritical = 1
        BEGIN
            DECLARE @DoctorId INT;
            SELECT @DoctorId = OrderedBy FROM LabOrders WHERE Id = @OrderId;
            INSERT INTO LabCriticalAlerts (ResultId, OrderId, PatientId, DoctorId, AlertValue, AlertFlag)
            VALUES (@NewResultId, @OrderId, @PatientId, @DoctorId,
                    CAST(ISNULL(@NumericValue, @TextValue) AS NVARCHAR(100)), @Flag);
        END;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

-- sp_VerifyLabResult
CREATE OR ALTER PROCEDURE sp_VerifyLabResult
    @ResultId   INT,
    @VerifiedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE LabResults SET
        IsVerified = 1,
        VerifiedBy = @VerifiedBy,
        VerifiedAt = GETDATE()
    WHERE Id = @ResultId;
END;
GO

-- sp_AcknowledgeCriticalAlert
CREATE OR ALTER PROCEDURE sp_AcknowledgeCriticalAlert
    @AlertId        INT,
    @AcknowledgedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE LabCriticalAlerts SET
        IsAcknowledged = 1,
        AcknowledgedBy = @AcknowledgedBy,
        AcknowledgedAt = GETDATE()
    WHERE Id = @AlertId;
END;
GO

-- sp_GetLabWorklist
CREATE OR ALTER PROCEDURE sp_GetLabWorklist
    @TenantId   TINYINT,
    @StatusId   TINYINT = 2  -- Default: Collected (ready to process)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        o.Id AS OrderId, o.OrderNumber, o.Priority, o.OrderedAt,
        p.FirstName + ' ' + p.LastName AS PatientName, p.DateOfBirth,
        oi.Id AS ItemId, oi.StatusId AS ItemStatus,
        t.TestCode, t.TestName, t.Category, t.SampleType,
        s.Barcode,
        DATEDIFF(MINUTE, o.OrderedAt, GETDATE()) AS AgeMinutes,
        t.TurnaroundMinutes
    FROM LabOrders o
    JOIN LabOrderItems oi ON oi.OrderId = o.Id
    JOIN LabTestCatalog t ON t.Id = oi.TestId
    JOIN Patients p ON p.Id = o.PatientId
    LEFT JOIN LabSamples s ON s.OrderId = o.Id
    WHERE o.TenantId = @TenantId AND o.StatusId = @StatusId
    ORDER BY o.Priority ASC, o.OrderedAt ASC;
END;
GO

-- sp_GetUnacknowledgedCriticalAlerts
CREATE OR ALTER PROCEDURE sp_GetUnacknowledgedCriticalAlerts
    @TenantId TINYINT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        ca.Id, ca.OrderId, ca.PatientId, ca.DoctorId,
        ca.AlertValue, ca.AlertFlag, ca.CreatedAt, ca.NotifyCount,
        p.FirstName + ' ' + p.LastName AS PatientName,
        t.TestName,
        s.FirstName + ' ' + s.LastName AS DoctorName
    FROM LabCriticalAlerts ca
    JOIN Patients p ON p.Id = ca.PatientId
    JOIN LabOrders o ON o.Id = ca.OrderId
    JOIN LabOrderItems oi ON oi.OrderId = ca.OrderId
    JOIN LabTestCatalog t ON t.Id = oi.TestId
    JOIN Doctors d ON d.Id = ca.DoctorId
    JOIN Staff s ON s.Id = d.StaffId
    WHERE p.TenantId = @TenantId AND ca.IsAcknowledged = 0
    ORDER BY ca.AlertFlag DESC, ca.CreatedAt ASC;  -- HH first
END;
GO
