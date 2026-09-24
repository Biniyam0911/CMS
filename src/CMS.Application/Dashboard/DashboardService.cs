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
        var todayStart = DateTime.Today;
        var tomorrowStart = todayStart.AddDays(1);
        using var conn = _dbFactory.CreateConnection();
        var sqlCounts = @"
            SELECT 
                (SELECT COUNT(1) FROM Patients WITH (NOLOCK) WHERE TenantId = @TenantId AND IsActive = 1) AS PatientCount,
                (SELECT COUNT(1) FROM Appointments WITH (NOLOCK) WHERE TenantId = @TenantId AND SlotDateTime >= @TodayStart AND SlotDateTime < @TomorrowStart) AS ApptCount,
                (SELECT COUNT(1) FROM LabOrders WITH (NOLOCK) WHERE TenantId = @TenantId AND StatusId < 4) AS LabCount,
                (SELECT COUNT(1) FROM PatientTriage WITH (NOLOCK) WHERE TenantId = @TenantId AND (Status IN ('Waiting', 'Triaged', 'AssignedToDoctor') OR (TriagedAt >= @TodayStart AND TriagedAt < @TomorrowStart))) AS QueueCount,
                (SELECT ISNULL(SUM(PaidAmount), 0) FROM Invoices WITH (NOLOCK) WHERE TenantId = @TenantId AND IssueDate >= @TodayStart AND IssueDate < @TomorrowStart) AS Revenue,
                (SELECT COUNT(1) FROM Doctors d WITH (NOLOCK) JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId WHERE s.TenantId = @TenantId AND d.IsAvailable = 1) AS DocCount";

        var counts = await conn.QueryFirstOrDefaultAsync<dynamic>(sqlCounts, new { 
            TenantId = tenantId,
            TodayStart = todayStart,
            TomorrowStart = tomorrowStart
        });
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
                CAST(t.Id AS BIGINT) AS Id,
                CAST(t.TenantId AS TINYINT) AS TenantId,
                CAST(ISNULL(q.TokenNumber, 'TRG-' + CAST(t.Id AS VARCHAR)) AS NVARCHAR(50)) AS TokenNumber,
                CAST(t.PatientId AS INT) AS PatientId,
                CAST(p.FirstName + ' ' + ISNULL(p.MiddleName + ' ', '') + p.LastName AS NVARCHAR(150)) AS PatientName,
                CAST(ISNULL(t.TriageCategory, 'General Consultation') AS NVARCHAR(100)) AS ServiceType,
                CAST(ISNULL(t.PriorityLevel, 3) AS TINYINT) AS PriorityLevel,
                CAST(CASE t.PriorityLevel WHEN 1 THEN 'Emergency' WHEN 2 THEN 'Urgent' ELSE 'Normal' END AS NVARCHAR(50)) AS PriorityName,
                CAST(1 AS TINYINT) AS StatusId,
                CAST(t.Status AS NVARCHAR(50)) AS StatusName,
                CAST(0 AS INT) AS AssignedCounterId,
                CAST(ISNULL(r.RoomName, 'Room 101') AS NVARCHAR(100)) AS CounterName,
                CAST(t.AssignedDoctorId AS INT) AS AssignedDoctorId,
                CAST(ISNULL(s.FirstName + ' ' + s.LastName, 'Attending Doctor') AS NVARCHAR(150)) AS DoctorName,
                CAST(10 AS INT) AS EstimatedWaitMin,
                t.TriagedAt AS CheckInTime,
                CAST(t.UpdatedAt AS DATETIME) AS CallTime
            FROM PatientTriage t WITH (NOLOCK)
            JOIN Patients p WITH (NOLOCK) ON p.Id = t.PatientId
            LEFT JOIN PatientQueues q WITH (NOLOCK) ON q.Id = t.QueueId
            LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = t.AssignedDoctorId
            LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
            LEFT JOIN ConsultationRooms r WITH (NOLOCK) ON r.Id = t.AssignedRoomId
            WHERE t.TenantId = @TenantId
              AND t.Status IN ('Waiting', 'Triaged', 'AssignedToDoctor')
              AND t.TriagedAt >= @TodayStart AND t.TriagedAt < @TomorrowStart
            ORDER BY t.PriorityLevel ASC, t.TriagedAt DESC";

        var queueList = (await conn.QueryAsync<PatientQueueDto>(sqlQueueList, new { 
            TenantId = tenantId,
            TodayStart = todayStart,
            TomorrowStart = tomorrowStart
        })).ToList();

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
