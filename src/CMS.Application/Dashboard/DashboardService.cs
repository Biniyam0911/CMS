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
                (SELECT COUNT(1) FROM PatientQueues WHERE TenantId = @TenantId AND StatusId = 1) AS QueueCount,
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
            SELECT TOP 10 pq.Id, pq.TenantId, pq.TokenNumber, pq.PatientId, p.FirstName + ' ' + p.LastName AS PatientName,
                   pq.ServiceType, pq.PriorityLevel, 'Normal' AS PriorityName, pq.StatusId, 'Waiting' AS StatusName,
                   pq.AssignedCounterId, sc.CounterName, pq.AssignedDoctorId, '' AS DoctorName,
                   pq.EstimatedWaitMin, pq.CheckInTime, pq.CallTime
            FROM PatientQueues pq
            JOIN Patients p ON p.Id = pq.PatientId
            LEFT JOIN ServiceCounters sc ON sc.Id = pq.AssignedCounterId
            WHERE pq.TenantId = @TenantId AND pq.StatusId IN (1, 2)
            ORDER BY pq.PriorityLevel ASC, pq.CheckInTime ASC";

        var queueList = (await conn.QueryAsync<PatientQueueDto>(sqlQueueList, new { TenantId = tenantId })).ToList();

        return new DashboardMetricsDto(
            patientCount, apptCount, labCount, queueCount, revenue, 98.4, docCount,
            queueList, criticals, new List<dynamic>()
        );
    }
}
