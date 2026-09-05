-- ============================================================
-- Stored Procedures — Appointments
-- ============================================================
USE ClinicDB;
GO

-- sp_CreateAppointment
CREATE OR ALTER PROCEDURE sp_CreateAppointment
    @TenantId       TINYINT,
    @PatientId      INT,
    @DoctorId       INT,
    @SlotDateTime   DATETIME2,
    @DurationMin    TINYINT = 15,
    @Reason         NVARCHAR(500) = NULL,
    @BookedBy       INT,
    @NewId          INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Conflict check
        IF EXISTS (
            SELECT 1 FROM Appointments
            WHERE TenantId = @TenantId AND DoctorId = @DoctorId
              AND SlotDateTime = @SlotDateTime AND StatusId NOT IN (6,7)  -- not Cancelled/NoShow
        )
            THROW 50010, 'This time slot is already booked.', 1;

        INSERT INTO Appointments (TenantId, PatientId, DoctorId, SlotDateTime, DurationMinutes, ReasonForVisit, BookedBy, StatusId)
        VALUES (@TenantId, @PatientId, @DoctorId, @SlotDateTime, @DurationMin, @Reason, @BookedBy, 1);
        SET @NewId = SCOPE_IDENTITY();
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO

-- sp_UpdateAppointmentStatus
CREATE OR ALTER PROCEDURE sp_UpdateAppointmentStatus
    @Id         INT,
    @TenantId   TINYINT,
    @StatusId   TINYINT,
    @Notes      NVARCHAR(1000) = NULL,
    @CancelReason NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Appointments SET
        StatusId = @StatusId,
        Notes = COALESCE(@Notes, Notes),
        CancelledAt = CASE WHEN @StatusId = 6 THEN GETDATE() ELSE NULL END,
        CancelReason = CASE WHEN @StatusId = 6 THEN @CancelReason ELSE NULL END,
        UpdatedAt = GETDATE()
    WHERE Id = @Id AND TenantId = @TenantId;
END;
GO

-- sp_GetDoctorAvailableSlots
CREATE OR ALTER PROCEDURE sp_GetDoctorAvailableSlots
    @DoctorId   INT,
    @Date       DATE,
    @TenantId   TINYINT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @DayOfWeek TINYINT = DATEPART(WEEKDAY, @Date);
    -- Convert SQL DayOfWeek (1=Sun) to our schema (1=Mon)
    SET @DayOfWeek = CASE @DayOfWeek WHEN 1 THEN 7 ELSE @DayOfWeek - 1 END;

    -- Generate all slots for the day
    ;WITH Slots AS (
        SELECT
            DATEADD(MINUTE, n.Number * s.SlotMinutes, CAST(@Date AS DATETIME2) + CAST(s.StartTime AS DATETIME2)) AS SlotTime,
            s.SlotMinutes
        FROM DoctorSchedules s
        CROSS JOIN (
            SELECT TOP 100 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS Number
            FROM sys.objects
        ) n
        WHERE s.DoctorId = @DoctorId AND s.DayOfWeek = @DayOfWeek AND s.IsActive = 1
          AND DATEADD(MINUTE, n.Number * s.SlotMinutes, s.StartTime) < s.EndTime
    )
    SELECT
        sl.SlotTime,
        CASE WHEN a.Id IS NULL THEN 1 ELSE 0 END AS IsAvailable
    FROM Slots sl
    LEFT JOIN Appointments a ON a.DoctorId = @DoctorId
        AND a.SlotDateTime = sl.SlotTime
        AND a.TenantId = @TenantId
        AND a.StatusId NOT IN (6,7)
    ORDER BY sl.SlotTime;
END;
GO

-- sp_GetUpcomingAppointmentReminders  
CREATE OR ALTER PROCEDURE sp_GetUpcomingAppointmentReminders
    @HoursAhead INT = 24
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        a.Id, a.PatientId, a.DoctorId, a.SlotDateTime,
        p.FirstName + ' ' + p.LastName AS PatientName,
        p.PrimaryPhone AS PatientPhone,
        p.Email AS PatientEmail,
        d.Id AS DoctorStaffId,
        s.FirstName + ' ' + s.LastName AS DoctorName
    FROM Appointments a
    JOIN Patients p ON p.Id = a.PatientId
    JOIN Doctors d ON d.Id = a.DoctorId
    JOIN Staff s ON s.Id = d.StaffId
    WHERE a.StatusId IN (1,2)
      AND a.ReminderSent = 0
      AND a.SlotDateTime BETWEEN GETDATE() AND DATEADD(HOUR, @HoursAhead, GETDATE());
END;
GO
