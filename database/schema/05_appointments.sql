-- ============================================================
-- 05 - Appointments
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE AppointmentStatuses (
    Id      TINYINT         NOT NULL,
    Name    NVARCHAR(30)    NOT NULL,
    CONSTRAINT PK_AppointmentStatuses PRIMARY KEY (Id)
);
INSERT INTO AppointmentStatuses VALUES
(1,'Scheduled'),(2,'Confirmed'),(3,'CheckedIn'),
(4,'InProgress'),(5,'Completed'),(6,'Cancelled'),(7,'NoShow');
GO

CREATE TABLE Appointments (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    PatientId       INT             NOT NULL,
    DoctorId        INT             NOT NULL,
    SlotDateTime    DATETIME2       NOT NULL,
    DurationMinutes TINYINT         NOT NULL DEFAULT 15,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    ReasonForVisit  NVARCHAR(500)   NULL,
    Notes           NVARCHAR(1000)  NULL,
    BookedBy        INT             NULL,       -- UserId who booked
    BookedAt        DATETIME2       NOT NULL DEFAULT GETDATE(),
    ReminderSent    BIT             NOT NULL DEFAULT 0,
    CancelledAt     DATETIME2       NULL,
    CancelReason    NVARCHAR(300)   NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_Appointments PRIMARY KEY (Id),
    CONSTRAINT UQ_Appointments_DoctorSlot UNIQUE (TenantId, DoctorId, SlotDateTime),
    CONSTRAINT FK_Appointments_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Appointments_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_Appointments_Doctors FOREIGN KEY (DoctorId) REFERENCES Doctors(Id),
    CONSTRAINT FK_Appointments_Status FOREIGN KEY (StatusId) REFERENCES AppointmentStatuses(Id),
    CONSTRAINT FK_Appointments_BookedBy FOREIGN KEY (BookedBy) REFERENCES Users(Id)
);
GO

CREATE INDEX IX_Appointments_DoctorDate ON Appointments (DoctorId, SlotDateTime);
CREATE INDEX IX_Appointments_PatientId ON Appointments (PatientId);
CREATE INDEX IX_Appointments_Status ON Appointments (StatusId, SlotDateTime);
CREATE INDEX IX_Appointments_Reminder ON Appointments (ReminderSent, SlotDateTime) WHERE StatusId IN (1,2) AND ReminderSent = 0;
GO
