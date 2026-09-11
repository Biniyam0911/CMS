using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Dashboard;

public class DashboardService
{
    private readonly IDbConnectionFactory _dbFactory;

    public DashboardService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<DashboardMetricsDto> GetMetricsAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sqlCounts = @"
            SELECT 
                (SELECT COUNT(1) FROM Patients WHERE TenantId = @TenantId AND IsActive = 1) AS PatientCount,
                (SELECT COUNT(1) FROM Appointments WHERE TenantId = @TenantId AND CAST(SlotDateTime AS DATE) = CAST(GETDATE() AS DATE)) AS ApptCount,
                (SELECT COUNT(1) FROM LabOrders WHERE TenantId = @TenantId AND StatusId < 4) AS LabCount,
                (SELECT COUNT(1) FROM PatientTriage WHERE TenantId = @TenantId AND (Status IN ('Waiting', 'Triaged', 'AssignedToDoctor') OR CAST(TriagedAt AS DATE) = CAST(GETDATE() AS DATE))) AS QueueCount,
                (SELECT ISNULL(SUM(PaidAmount), 0) FROM Invoices WHERE TenantId = @TenantId AND CAST(IssueDate AS DATE) = CAST(GETDATE() AS DATE)) AS Revenue,
                (SELECT COUNT(1) FROM Doctors d JOIN Staff s ON s.Id = d.StaffId WHERE s.TenantId = @TenantId AND d.IsAvailable = 1) AS DocCount";

        var counts = await conn.QueryFirstOrDefaultAsync<dynamic>(sqlCounts, new { TenantId = tenantId });
        int patientCount = (int)(counts?.PatientCount ?? 0);
        int apptCount = (int)(counts?.ApptCount ?? 0);
        int labCount = (int)(counts?.LabCount ?? 0);
        int queueCount = (int)(counts?.QueueCount ?? 0);
        decimal revenue = (decimal)(counts?.Revenue ?? 0m);
        int docCount = (int)(counts?.DocCount ?? 0);

        var sqlCriticals = @"
            SELECT TOP 5 ca.Id, p.FirstName + ' ' + p.LastName AS PatientName, t.TestName,
                         ca.AlertValue, ca.AlertFlag, ca.CreatedAt
            FROM LabCriticalAlerts ca
            JOIN Patients p ON p.Id = ca.PatientId
            JOIN LabOrders o ON o.Id = ca.OrderId
            JOIN LabOrderItems oi ON oi.OrderId = o.Id
            JOIN LabTestCatalog t ON t.Id = oi.TestId
            WHERE p.TenantId = @TenantId AND ca.IsAcknowledged = 0
            ORDER BY ca.CreatedAt DESC";

        var criticals = (await conn.QueryAsync<dynamic>(sqlCriticals, new { TenantId = tenantId })).ToList();

        var sqlQueueList = @"
            SELECT TOP 15 
                t.Id, t.TenantId,
                ISNULL(q.TokenNumber, 'TRG-' + CAST(t.Id AS VARCHAR)) AS TokenNumber,
                t.PatientId,
                p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS PatientName,
                ISNULL(t.TriageCategory, 'General Consultation') AS ServiceType,
                t.PriorityLevel,
                CASE t.PriorityLevel WHEN 1 THEN 'Emergency' WHEN 2 THEN 'Urgent' ELSE 'Normal' END AS PriorityName,
                1 AS StatusId,
                t.Status AS StatusName,
                0 AS AssignedCounterId,
                ISNULL(r.RoomName, 'Room 101') AS CounterName,
                t.AssignedDoctorId,
                ISNULL(s.FirstName + ' ' + s.LastName, 'Attending Doctor') AS DoctorName,
                10 AS EstimatedWaitMin,
                t.TriagedAt AS CheckInTime,
                t.UpdatedAt AS CallTime
            FROM PatientTriage t
            JOIN Patients p ON p.Id = t.PatientId
            LEFT JOIN PatientQueues q ON q.Id = t.QueueId
            LEFT JOIN Doctors d ON d.Id = t.AssignedDoctorId
            LEFT JOIN Staff s ON s.Id = d.StaffId
            LEFT JOIN ConsultationRooms r ON r.Id = t.AssignedRoomId
            WHERE t.TenantId = @TenantId
              AND (t.Status IN ('Waiting', 'Triaged', 'AssignedToDoctor') OR CAST(t.TriagedAt AS DATE) = CAST(GETDATE() AS DATE))
            ORDER BY t.PriorityLevel ASC, t.TriagedAt DESC";

        var queueList = (await conn.QueryAsync<PatientQueueDto>(sqlQueueList, new { TenantId = tenantId })).ToList();

        // 14-day daily revenue trend
        var sqlRevenue = @"
            SELECT 
                FORMAT(CAST(IssueDate AS DATE), 'yyyy-MM-dd') AS [Date],
                ISNULL(SUM(PaidAmount), 0) AS Revenue,
                COUNT(1) AS InvoicesCount
            FROM Invoices
            WHERE TenantId = @TenantId AND IssueDate >= DATEADD(DAY, -14, GETDATE())
            GROUP BY CAST(IssueDate AS DATE)
            ORDER BY CAST(IssueDate AS DATE) ASC;";

        var revenueTrend = (await conn.QueryAsync<dynamic>(sqlRevenue, new { TenantId = tenantId })).ToList();

        return new DashboardMetricsDto(
            patientCount, apptCount, labCount, queueCount, revenue, 98.4, docCount,
            queueList, criticals, new List<dynamic>(), revenueTrend
        );
    }
}
