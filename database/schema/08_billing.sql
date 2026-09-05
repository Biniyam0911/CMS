-- ============================================================
-- 08 - Billing & Payments
-- ============================================================
USE ClinicDB;
GO

CREATE TABLE InvoiceStatuses (
    Id TINYINT NOT NULL, Name NVARCHAR(30) NOT NULL,
    CONSTRAINT PK_InvoiceStatuses PRIMARY KEY (Id)
);
INSERT INTO InvoiceStatuses VALUES (1,'Draft'),(2,'Issued'),(3,'PartiallyPaid'),(4,'Paid'),(5,'Void'),(6,'Written Off');
GO

CREATE TABLE Invoices (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    InvoiceNumber   VARCHAR(30)     NOT NULL,
    PatientId       INT             NOT NULL,
    EncounterId     INT             NULL,
    StatusId        TINYINT         NOT NULL DEFAULT 1,
    IssueDate       DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    DueDate         DATE            NULL,
    SubTotal        DECIMAL(12,2)   NOT NULL DEFAULT 0,
    DiscountAmt     DECIMAL(12,2)   NOT NULL DEFAULT 0,
    TaxAmt          DECIMAL(12,2)   NOT NULL DEFAULT 0,
    TotalAmount     DECIMAL(12,2)   NOT NULL DEFAULT 0,
    PaidAmount      DECIMAL(12,2)   NOT NULL DEFAULT 0,
    InsuranceClaim  DECIMAL(12,2)   NOT NULL DEFAULT 0,
    Notes           NVARCHAR(500)   NULL,
    CreatedBy       INT             NOT NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT PK_Invoices PRIMARY KEY (Id),
    CONSTRAINT UQ_Invoices_Number UNIQUE (TenantId, InvoiceNumber),
    CONSTRAINT FK_Invoices_Tenants   FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Invoices_Patients  FOREIGN KEY (PatientId) REFERENCES Patients(Id),
    CONSTRAINT FK_Invoices_Encounters FOREIGN KEY (EncounterId) REFERENCES Encounters(Id),
    CONSTRAINT FK_Invoices_Status    FOREIGN KEY (StatusId) REFERENCES InvoiceStatuses(Id)
);
GO

CREATE TABLE InvoiceItems (
    Id          INT             NOT NULL IDENTITY(1,1),
    InvoiceId   INT             NOT NULL,
    ItemType    TINYINT         NOT NULL,  -- 1=Consultation 2=Lab 3=Drug 4=Procedure 5=Other
    Description NVARCHAR(200)   NOT NULL,
    Quantity    DECIMAL(10,2)   NOT NULL DEFAULT 1,
    UnitPrice   DECIMAL(10,2)   NOT NULL DEFAULT 0,
    Discount    DECIMAL(10,2)   NOT NULL DEFAULT 0,
    Total       DECIMAL(10,2)   NOT NULL DEFAULT 0,
    RefId       INT             NULL,   -- FK to LabOrder / PrescriptionItem / etc.
    CONSTRAINT PK_InvoiceItems PRIMARY KEY (Id),
    CONSTRAINT FK_InvoiceItems_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id) ON DELETE CASCADE
);
GO

CREATE TABLE Payments (
    Id              INT             NOT NULL IDENTITY(1,1),
    TenantId        TINYINT         NOT NULL DEFAULT 1,
    InvoiceId       INT             NOT NULL,
    PatientId       INT             NOT NULL,
    Amount          DECIMAL(12,2)   NOT NULL,
    PaymentMethod   TINYINT         NOT NULL,  -- 1=Cash 2=Card 3=Insurance 4=BankTransfer 5=Mobile
    PaymentDate     DATETIME2       NOT NULL DEFAULT GETDATE(),
    Reference       VARCHAR(100)    NULL,
    ReceivedBy      INT             NOT NULL,
    Notes           NVARCHAR(300)   NULL,
    CONSTRAINT PK_Payments PRIMARY KEY (Id),
    CONSTRAINT FK_Payments_Tenants  FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT FK_Payments_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(Id),
    CONSTRAINT FK_Payments_Patients FOREIGN KEY (PatientId) REFERENCES Patients(Id)
);
GO

CREATE INDEX IX_Invoices_PatientId ON Invoices (PatientId, IssueDate DESC);
CREATE INDEX IX_Invoices_Status ON Invoices (StatusId, TenantId);
CREATE INDEX IX_Payments_InvoiceId ON Payments (InvoiceId);
GO
