-- ============================================================
-- 04 - Staff & Doctors
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE Specializations (
    Id      SMALLINT        NOT NULL IDENTITY(1,1),
    Name    NVARCHAR(100)   NOT NULL,
    Code    VARCHAR(10)     NOT NULL,
    CONSTRAINT PK_Specializations PRIMARY KEY (Id),
    CONSTRAINT UQ_Specializations_Code UNIQUE (Code)
);
GO

INSERT INTO Specializations (Name, Code) VALUES
('General Practice',    'GP'),
('Internal Medicine',   'IM'),
('Pediatrics',          'PED'),
('Obstetrics & Gynecology', 'OBG'),
('Surgery',             'SUR'),
('Cardiology',          'CAR'),
('Orthopedics',         'ORT'),
('Dermatology',         'DER'),
('Psychiatry',          'PSY'),
('Ophthalmology',       'OPH'),
('ENT',                 'ENT'),
('Radiology',           'RAD'),
('Laboratory Medicine', 'LAB'),
('Emergency Medicine',  'EM'),
('Anesthesiology',      'ANE');
GO

CREATE TABLE Staff (
    Id                  INT             NOT NULL IDENTITY(1,1),
    TenantId            TINYINT         NOT NULL DEFAULT 1,
    UserId              INT             NOT NULL,
    StaffCode           VARCHAR(20)     NOT NULL,
    Title               VARCHAR(20)     NULL,   -- Dr., Mr., Mrs., etc.
    FirstName           NVARCHAR(100)   NOT NULL,
    LastName            NVARCHAR(100)   NOT NULL,
    Phone               VARCHAR(20)     NULL,
    Email               NVARCHAR(200)   NULL,
    PrimaryRoleId       SMALLINT        NOT NULL,
    Department          NVARCHAR(100)   NULL,
    JoinDate            DATE            NULL,
    IsActive            BIT             NOT NULL DEFAULT 1,
    CreatedAt           DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2       NULL,
    CONSTRAINT PK_Staff PRIMARY KEY (Id),
    CONSTRAINT UQ_Staff_TenantCode UNIQUE (TenantId, StaffCode),
    CONSTRAINT FK_Staff_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Staff_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_Staff_Roles FOREIGN KEY (PrimaryRoleId) REFERENCES Roles(Id)
);
GO

CREATE TABLE Doctors (
    Id                  INT             NOT NULL IDENTITY(1,1),
    StaffId             INT             NOT NULL,
    LicenseNumber       VARCHAR(50)     NOT NULL,
    SpecializationId    SMALLINT        NOT NULL,
    SubSpecialization   NVARCHAR(100)   NULL,
    Biography           NVARCHAR(2000)  NULL,
    ConsultationFee     DECIMAL(10,2)   NULL,
    IsAvailable         BIT             NOT NULL DEFAULT 1,
    CONSTRAINT PK_Doctors PRIMARY KEY (Id),
    CONSTRAINT UQ_Doctors_License UNIQUE (LicenseNumber),
    CONSTRAINT FK_Doctors_Staff FOREIGN KEY (StaffId) REFERENCES Staff(Id),
    CONSTRAINT FK_Doctors_Specializations FOREIGN KEY (SpecializationId) REFERENCES Specializations(Id)
);
GO

CREATE TABLE DoctorSchedules (
    Id          INT         NOT NULL IDENTITY(1,1),
    DoctorId    INT         NOT NULL,
    DayOfWeek   TINYINT     NOT NULL,   -- 1=Mon ... 7=Sun
    StartTime   TIME        NOT NULL,
    EndTime     TIME        NOT NULL,
    SlotMinutes TINYINT     NOT NULL DEFAULT 15,
    IsActive    BIT         NOT NULL DEFAULT 1,
    CONSTRAINT PK_DoctorSchedules PRIMARY KEY (Id),
    CONSTRAINT FK_DoctorSchedules_Doctors FOREIGN KEY (DoctorId) REFERENCES Doctors(Id),
    CONSTRAINT CHK_DoctorSchedules_Day CHECK (DayOfWeek BETWEEN 1 AND 7),
    CONSTRAINT CHK_DoctorSchedules_Time CHECK (StartTime < EndTime)
);
GO

CREATE INDEX IX_Staff_TenantId ON Staff (TenantId);
CREATE INDEX IX_Doctors_SpecializationId ON Doctors (SpecializationId);
GO
