-- =====================================================================
-- PERFORMANCE OPTIMIZATION INDEXES FOR REAL MIGRATED DATA
-- Execute this script on ClinicDB (both development & production)
-- =====================================================================

USE [ClinicDB];
GO

-- 1. InvoiceItems: Index on InvoiceId (crucial for line item lookups)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InvoiceItems_InvoiceId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_InvoiceItems_InvoiceId 
    ON dbo.InvoiceItems (InvoiceId) 
    INCLUDE (ItemType, Description, Quantity, UnitPrice, Total);
    PRINT 'Created IX_InvoiceItems_InvoiceId';
END
GO

-- 2. Payments: Index on InvoiceId
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Payments_InvoiceId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Payments_InvoiceId 
    ON dbo.Payments (InvoiceId, PaymentMethod);
    PRINT 'Created IX_Payments_InvoiceId';
END
GO

-- 3. Invoices: Index on TenantId + Id DESC
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_Tenant_Id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Invoices_Tenant_Id 
    ON dbo.Invoices (TenantId, Id DESC) 
    INCLUDE (InvoiceNumber, PatientId, IssueDate, TotalAmount, PaidAmount, StatusId);
    PRINT 'Created IX_Invoices_Tenant_Id';
END
GO

-- 4. PatientTriage: Index on Doctor & Status
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PatientTriage_Doctor_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_PatientTriage_Doctor_Status 
    ON dbo.PatientTriage (TenantId, AssignedDoctorId, Status) 
    INCLUDE (PatientId, PriorityLevel, TriagedAt, UpdatedAt);
    PRINT 'Created IX_PatientTriage_Doctor_Status';
END
GO

-- 5. PatientTriage: Index on Status & Priority (Queue)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PatientTriage_Queue')
BEGIN
    CREATE NONCLUSTERED INDEX IX_PatientTriage_Queue 
    ON dbo.PatientTriage (TenantId, Status, PriorityLevel) 
    INCLUDE (PatientId, AssignedDoctorId, TriagedAt, UpdatedAt);
    PRINT 'Created IX_PatientTriage_Queue';
END
GO

-- 6. Patients: Index on TenantId, Active, Id DESC
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Patients_Tenant_Active_Id')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Patients_Tenant_Active_Id 
    ON dbo.Patients (TenantId, IsActive, Id DESC) 
    INCLUDE (MRN, FirstName, MiddleName, LastName, PrimaryPhone, DateOfBirth, Gender);
    PRINT 'Created IX_Patients_Tenant_Active_Id';
END
GO

-- 7. Patients: Filtered Index on Phone
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Patients_Phone')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Patients_Phone 
    ON dbo.Patients (TenantId, PrimaryPhone) 
    WHERE PrimaryPhone IS NOT NULL;
    PRINT 'Created IX_Patients_Phone';
END
GO

-- 8. Notifications: Index on User & Status
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_User_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Notifications_User_Status 
    ON dbo.Notifications (TenantId, StatusId, Priority, CreatedAt DESC) 
    INCLUDE (RecipientUserId, Channel, Subject, Body, NotificationType, RefType, RefId);
    PRINT 'Created IX_Notifications_User_Status';
END
GO

-- 9. Encounters: Index on TenantId, PatientId, Date DESC
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Encounters_Tenant_Patient')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Encounters_Tenant_Patient 
    ON dbo.Encounters (TenantId, PatientId, EncounterDate DESC);
    PRINT 'Created IX_Encounters_Tenant_Patient';
END
GO

-- 10. LabOrders: Index on TenantId, PatientId, Date DESC
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabOrders_Tenant_Patient')
BEGIN
    CREATE NONCLUSTERED INDEX IX_LabOrders_Tenant_Patient 
    ON dbo.LabOrders (TenantId, PatientId, OrderedAt DESC);
    PRINT 'Created IX_LabOrders_Tenant_Patient';
END
GO

-- 11. Prescriptions: Index on TenantId, PatientId, Date DESC
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Prescriptions_Tenant_Patient')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Prescriptions_Tenant_Patient 
    ON dbo.Prescriptions (TenantId, PatientId, PrescribedAt DESC);
    PRINT 'Created IX_Prescriptions_Tenant_Patient';
END
GO

-- 12. PrescriptionItems: Index on PrescriptionId
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PrescriptionItems_PrescriptionId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_PrescriptionItems_PrescriptionId 
    ON dbo.PrescriptionItems (PrescriptionId) 
    INCLUDE (DrugId, Dosage, Frequency, Quantity);
    PRINT 'Created IX_PrescriptionItems_PrescriptionId';
END
GO

-- 13. LabOrderItems: Index on OrderId
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabOrderItems_OrderId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_LabOrderItems_OrderId 
    ON dbo.LabOrderItems (OrderId) 
    INCLUDE (TestId, StatusId);
    PRINT 'Created IX_LabOrderItems_OrderId';
END
GO

-- 14. Diagnoses: Index on EncounterId
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diagnoses_EncounterId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Diagnoses_EncounterId 
    ON dbo.Diagnoses (EncounterId);
    PRINT 'Created IX_Diagnoses_EncounterId';
END
GO

PRINT 'All performance indexes successfully verified/created.';
