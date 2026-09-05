-- ============================================================
-- 13 - Queue Management Schema
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE ServiceCounters (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    CounterNumber   VARCHAR(20)     NOT NULL,
    CounterName     NVARCHAR(100)   NOT NULL,  -- 'Reception 1', 'Doctor Room 3', 'Lab Phlebotomy', 'Pharmacy Counter 2'
    ServiceType     NVARCHAR(50)    NOT NULL,  -- 'Registration', 'Consultation', 'Laboratory', 'Pharmacy', 'Billing'
    CurrentStaffId  INT             NULL,
    IsActive        BIT             NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_ServiceCounters PRIMARY KEY (Id),
    CONSTRAINT FK_ServiceCounters_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);
GO

CREATE TABLE PatientQueues (
    Id              BIGINT          NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    TokenNumber     VARCHAR(20)     NOT NULL,  -- 'A-101', 'LAB-012', 'PH-045'
    PatientId       INT             NOT NULL,
    ServiceType     NVARCHAR(50)    NOT NULL,
    PriorityLevel   TINYINT         NOT NULL DEFAULT 2, -- 1=Emergency, 2=Normal, 3=VIP/Elderly
    StatusId        TINYINT         NOT NULL DEFAULT 1, -- 1=Waiting, 2=Called, 3=InProgress, 4=Completed, 5=NoShow, 6=Cancelled
    AssignedCounterId INT           NULL,
    AssignedDoctorId  INT           NULL,
    EstimatedWaitMin INT            NULL DEFAULT 15,
    CheckInTime     DATETIME2       NOT NULL DEFAULT GETDATE(),
    CallTime        DATETIME2       NULL,
    StartTime       DATETIME2       NULL,
    EndTime         DATETIME2       NULL,
    Notes           NVARCHAR(500)   NULL,
    CONSTRAINT PK_PatientQueues PRIMARY KEY (Id),
    CONSTRAINT FK_PatientQueues_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_PatientQueues_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_PatientQueues_Counters FOREIGN KEY (AssignedCounterId) REFERENCES ServiceCounters(Id)
);
GO

CREATE INDEX IX_PatientQueues_Active ON PatientQueues (TenantId, StatusId, PriorityLevel ASC, CheckInTime ASC);
CREATE INDEX IX_PatientQueues_Patient ON PatientQueues (PatientId, CheckInTime DESC);
GO
