using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Queue;

public class QueueService
{
    private readonly IDbConnectionFactory _dbFactory;

    public QueueService(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    private async Task SeedDefaultCountersIfEmptyAsync(System.Data.IDbConnection conn, byte tenantId)
    {
        var count = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM ServiceCounters WHERE TenantId = @TenantId",
            new { TenantId = tenantId });

        if (count == 0)
        {
            var seedSql = @"
                INSERT INTO ServiceCounters (TenantId, CounterNumber, CounterName, ServiceType, IsActive, CreatedAt)
                VALUES 
                    (@TenantId, 'DOC-1', 'Doctor Room 1', 'Consultation & Procedure', 1, GETDATE()),
                    (@TenantId, 'DOC-2', 'Doctor Room 2', 'Consultation & Procedure', 1, GETDATE()),
                    (@TenantId, 'DOC-3', 'Doctor Room 3', 'Consultation & Procedure', 1, GETDATE()),
                    (@TenantId, 'PROC-1', 'Minor Procedure Room', 'Clinical Procedure', 1, GETDATE()),
                    (@TenantId, 'LAB-1', 'Lab Phlebotomy Counter 1', 'Sample Collection', 1, GETDATE()),
                    (@TenantId, 'LAB-2', 'Lab Phlebotomy Counter 2', 'Sample Collection', 1, GETDATE()),
                    (@TenantId, 'RES-1', 'Lab Results Desk', 'Lab Results', 1, GETDATE());";

            await conn.ExecuteAsync(seedSql, new { TenantId = tenantId });
        }
    }

    public async Task<List<ServiceCounterDto>> GetServiceCountersAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        await SeedDefaultCountersIfEmptyAsync(conn, tenantId);

        var sql = @"
            SELECT sc.Id, sc.TenantId, sc.CounterNumber, sc.CounterName, sc.ServiceType,
                   sc.CurrentStaffId, s.FirstName + ' ' + s.LastName AS CurrentStaffName, sc.IsActive
            FROM ServiceCounters sc WITH (NOLOCK)
            LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = sc.CurrentStaffId
            WHERE sc.TenantId = @TenantId AND sc.IsActive = 1
            ORDER BY sc.CounterNumber";

        return (await conn.QueryAsync<ServiceCounterDto>(sql, new { TenantId = tenantId })).ToList();
    }

    public async Task<List<PatientQueueDto>> GetLiveQueueAsync(byte tenantId, DateTime? date = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT pq.Id, pq.TenantId,
                   -- Calling Token: strict numeric part of patient's MRN (e.g. HD-9999 -> 9999)
                   COALESCE(NULLIF(REPLACE(REPLACE(REPLACE(p.MRN, 'HD-', ''), 'HD', ''), 'MRN-', ''), ''), CAST(p.Id AS NVARCHAR)) AS TokenNumber,
                   pq.PatientId, p.FirstName + ' ' + p.LastName AS PatientName,
                   pq.ServiceType, pq.PriorityLevel,
                   CASE pq.PriorityLevel WHEN 1 THEN 'Emergency' WHEN 3 THEN 'VIP' ELSE 'Normal' END AS PriorityName,
                   pq.StatusId,
                   CASE pq.StatusId WHEN 1 THEN 'Waiting' WHEN 2 THEN 'Called' WHEN 3 THEN 'InProgress' WHEN 4 THEN 'Completed' WHEN 5 THEN 'NoShow' ELSE 'Cancelled' END AS StatusName,
                   pq.AssignedCounterId, sc.CounterName, pq.AssignedDoctorId,
                   s.FirstName + ' ' + s.LastName AS DoctorName,
                   pq.EstimatedWaitMin, pq.CheckInTime, pq.CallTime,
                   p.MRN,
                   COALESCE(NULLIF(REPLACE(REPLACE(REPLACE(p.MRN, 'HD-', ''), 'HD', ''), 'MRN-', ''), ''), CAST(p.Id AS NVARCHAR)) AS MrnNumber,
                   pq.EndTime
            FROM PatientQueues pq WITH (NOLOCK)
            JOIN Patients p WITH (NOLOCK) ON p.Id = pq.PatientId
            LEFT JOIN ServiceCounters sc WITH (NOLOCK) ON sc.Id = pq.AssignedCounterId
            LEFT JOIN Doctors d WITH (NOLOCK) ON d.Id = pq.AssignedDoctorId
            LEFT JOIN Staff s WITH (NOLOCK) ON s.Id = d.StaffId
            WHERE pq.TenantId = @TenantId AND pq.StatusId IN (1, 2, 3)
              AND (@Date IS NULL OR CAST(pq.CheckInTime AS DATE) = CAST(@Date AS DATE))
            ORDER BY pq.PriorityLevel ASC, pq.CheckInTime ASC";

        return (await conn.QueryAsync<PatientQueueDto>(sql, new { TenantId = tenantId, Date = date })).ToList();
    }

    public async Task<(string TokenNumber, long TicketId)> CheckInPatientAsync(CheckInQueueDto dto)
    {
        using var conn = _dbFactory.CreateConnection();

        // Extract numeric part of patient's MRN for calling token
        var mrn = await conn.ExecuteScalarAsync<string?>(
            "SELECT MRN FROM Patients WITH (NOLOCK) WHERE Id = @PatientId",
            new { dto.PatientId });

        string token;
        if (!string.IsNullOrWhiteSpace(mrn))
        {
            var cleaned = System.Text.RegularExpressions.Regex.Replace(mrn, @"\D", "");
            token = !string.IsNullOrWhiteSpace(cleaned) ? cleaned : dto.PatientId.ToString();
        }
        else
        {
            token = dto.PatientId.ToString();
        }

        var sql = @"
            INSERT INTO PatientQueues (TenantId, TokenNumber, PatientId, ServiceType, PriorityLevel, StatusId, AssignedDoctorId, Notes)
            VALUES (@TenantId, @TokenNumber, @PatientId, @ServiceType, @PriorityLevel, 1, @AssignedDoctorId, @Notes);
            SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

        long ticketId = await conn.ExecuteScalarAsync<long>(sql, new {
            dto.TenantId, TokenNumber = token, dto.PatientId, dto.ServiceType,
            dto.PriorityLevel, dto.AssignedDoctorId, dto.Notes
        });

        try
        {
            await conn.ExecuteAsync(@"
                INSERT INTO Notifications (TenantId, RecipientUserId, Channel, Subject, Body, Priority, NotificationType, RefType, StatusId, CreatedAt)
                VALUES (@TenantId, NULL, 3, 'Patient Arrival: ' + @TokenNumber, 'Patient #' + CAST(@PatientId AS VARCHAR) + ' checked in. MRN Number: ' + @TokenNumber + '.', @PriorityLevel, 'PatientCheckIn', 'Doctor,Nurse,Receptionist', 1, GETDATE())",
                new { dto.TenantId, TokenNumber = token, dto.PatientId, dto.PriorityLevel });
        }
        catch { /* non-blocking notification */ }

        return (token, ticketId);
    }

    public async Task CallNextTicketAsync(long ticketId, int counterId, int staffId, string? stationType = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            -- Move any prior called ticket at this counter to InProgress (3)
            UPDATE PatientQueues
            SET StatusId = 3
            WHERE AssignedCounterId = @CounterId AND StatusId = 2 AND Id != @TicketId;

            UPDATE PatientQueues
            SET StatusId = 2, AssignedCounterId = @CounterId, CallTime = GETDATE()
            WHERE Id = @TicketId;
            
            UPDATE ServiceCounters
            SET CurrentStaffId = @StaffId
            WHERE Id = @CounterId;";

        await conn.ExecuteAsync(sql, new { TicketId = ticketId, CounterId = counterId, StaffId = staffId });
    }

    public async Task RecallTicketAsync(long ticketId, int counterId, int staffId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE PatientQueues
            SET StatusId = 2, AssignedCounterId = @CounterId, CallTime = GETDATE()
            WHERE Id = @TicketId;
            
            UPDATE ServiceCounters
            SET CurrentStaffId = @StaffId
            WHERE Id = @CounterId;";

        await conn.ExecuteAsync(sql, new { TicketId = ticketId, CounterId = counterId, StaffId = staffId });
    }

    public async Task CompleteTicketAsync(long ticketId, int staffId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE PatientQueues
            SET StatusId = 4, EndTime = GETDATE()
            WHERE Id = @TicketId;";

        await conn.ExecuteAsync(sql, new { TicketId = ticketId, StaffId = staffId });
    }

    public async Task CancelTicketAsync(long ticketId, int staffId, string? reason = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE PatientQueues
            SET StatusId = 6, EndTime = GETDATE(),
                Notes = COALESCE(Notes, '') + CASE WHEN @Reason IS NOT NULL THEN ' [Cancelled: ' + @Reason + ']' ELSE ' [Cancelled]' END
            WHERE Id = @TicketId;";

        await conn.ExecuteAsync(sql, new { TicketId = ticketId, StaffId = staffId, Reason = reason });
    }

    public async Task<List<CompletedQueueTicketDto>> GetCompletedQueueAsync(byte tenantId, DateTime? date = null)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT pq.Id, pq.PatientId, p.MRN,
                   COALESCE(NULLIF(REPLACE(REPLACE(REPLACE(p.MRN, 'HD-', ''), 'HD', ''), 'MRN-', ''), ''), CAST(p.Id AS NVARCHAR)) AS MrnNumber,
                   p.FirstName + ' ' + p.LastName AS PatientName,
                   pq.ServiceType,
                   ISNULL(sc.CounterName, 'Station') AS CounterName,
                   ISNULL(st.FirstName + ' ' + st.LastName, 'Attending Staff') AS StaffName,
                   pq.CheckInTime, pq.CallTime, pq.EndTime,
                   CASE WHEN pq.CallTime IS NOT NULL AND pq.EndTime IS NOT NULL 
                        THEN DATEDIFF(MINUTE, pq.CallTime, pq.EndTime)
                        ELSE DATEDIFF(MINUTE, pq.CheckInTime, pq.EndTime) END AS DurationMinutes
            FROM PatientQueues pq WITH (NOLOCK)
            JOIN Patients p WITH (NOLOCK) ON p.Id = pq.PatientId
            LEFT JOIN ServiceCounters sc WITH (NOLOCK) ON sc.Id = pq.AssignedCounterId
            LEFT JOIN Staff st WITH (NOLOCK) ON st.Id = sc.CurrentStaffId
            WHERE pq.TenantId = @TenantId
              AND pq.StatusId = 4
              AND (@Date IS NULL OR CAST(pq.CheckInTime AS DATE) = CAST(@Date AS DATE) OR CAST(pq.EndTime AS DATE) = CAST(@Date AS DATE))
            ORDER BY pq.EndTime DESC";

        return (await conn.QueryAsync<CompletedQueueTicketDto>(sql, new { TenantId = tenantId, Date = date })).ToList();
    }
}
