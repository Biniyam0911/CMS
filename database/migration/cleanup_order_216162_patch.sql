-- =====================================================================
-- Patch: Cleanup Order #216162 erroneous values and clean extracted text
-- =====================================================================

IF EXISTS (SELECT 1 FROM sys.databases WHERE name = 'ClinicDB')
BEGIN
    USE [ClinicDB];

    -- 1. Clean up CBC result (OrderItemId = 177119) with clean extracted values and no units/flags
    UPDATE LabResults
    SET TextValue = 'WBC: 7.39 | LYM#: 2.33 | MID#: 0.41 | GRAN#: 4.65 | LYM%: 31.5 | MID%: 5.5 | GRAN%: 63.0 | RBC: 4.97 | HGB: 14.8 | HCT: 43.4 | MCV: 87.2 | MCH: 29.8 | MCHC: 34.2 | RDW-CV: 12.4 | RDW-SD: 36.2 | PLT: 263 | MPV: 9.7 | PDW: 16.1 | PCT: 0.254 | P-LCC: 61 | P-LCR: 23.1',
        NumericValue = 7.39,
        Unit = '',
        Flag = 'Normal'
    WHERE OrderId = 216162 AND OrderItemId = 177119;

    -- 2. Clean up HCG result (OrderItemId = 177120)
    UPDATE LabResults
    SET TextValue = 'Negative',
        NumericValue = NULL,
        Unit = '',
        Flag = 'Normal'
    WHERE OrderId = 216162 AND OrderItemId = 177120;

    -- 3. Remove fake contaminated results for non-resulted tests in Order 216162
    DELETE FROM LabResults
    WHERE OrderId = 216162 AND OrderItemId IN (177110, 177111, 177112, 177113, 177114, 177115, 177116, 177117, 177118);

    UPDATE LabOrderItems
    SET StatusId = 2
    WHERE OrderId = 216162 AND Id IN (177110, 177111, 177112, 177113, 177114, 177115, 177116, 177117, 177118);

    UPDATE LabOrderItems
    SET StatusId = 3
    WHERE OrderId = 216162 AND Id IN (177119, 177120);

    UPDATE LabOrders
    SET StatusId = 2
    WHERE Id = 216162;

    PRINT 'Order #216162 cleanup applied successfully.';
END
GO
