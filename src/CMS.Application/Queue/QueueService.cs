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

    public async Task<List<ServiceCounterDto>> GetServiceCountersAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT sc.Id, sc.TenantId, sc.CounterNumber, sc.CounterName, sc.ServiceType,
                   sc.CurrentStaffId, s.FirstName + ' ' + s.LastName AS CurrentStaffName, sc.IsActive
            FROM ServiceCounters sc
            LEFT JOIN Staff s ON s.Id = sc.CurrentStaffId
            WHERE sc.TenantId = @TenantId AND sc.IsActive = 1
            ORDER BY sc.CounterNumber";

        return (await conn.QueryAsync<ServiceCounterDto>(sql, new { TenantId = tenantId })).ToList();
    }

    public async Task<List<PatientQueueDto>> GetLiveQueueAsync(byte tenantId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT pq.Id, pq.TenantId, pq.TokenNumber, pq.PatientId, p.FirstName + ' ' + p.LastName AS PatientName,
                   pq.ServiceType, pq.PriorityLevel,
                   CASE pq.PriorityLevel WHEN 1 THEN 'Emergency' WHEN 3 THEN 'VIP' ELSE 'Normal' END AS PriorityName,
                   pq.StatusId,
                   CASE pq.StatusId WHEN 1 THEN 'Waiting' WHEN 2 THEN 'Called' WHEN 3 THEN 'InProgress' WHEN 4 THEN 'Completed' WHEN 5 THEN 'NoShow' ELSE 'Cancelled' END AS StatusName,
                   pq.AssignedCounterId, sc.CounterName, pq.AssignedDoctorId,
                   s.FirstName + ' ' + s.LastName AS DoctorName,
                   pq.EstimatedWaitMin, pq.CheckInTime, pq.CallTime
            FROM PatientQueues pq
            JOIN Patients p ON p.Id = pq.PatientId
            LEFT JOIN ServiceCounters sc ON sc.Id = pq.AssignedCounterId
            LEFT JOIN Doctors d ON d.Id = pq.AssignedDoctorId
            LEFT JOIN Staff s ON s.Id = d.StaffId
            WHERE pq.TenantId = @TenantId AND pq.StatusId IN (1, 2, 3)
            ORDER BY pq.PriorityLevel ASC, pq.CheckInTime ASC";

        return (await conn.QueryAsync<PatientQueueDto>(sql, new { TenantId = tenantId })).ToList();
    }

    public async Task<string> CheckInPatientAsync(CheckInQueueDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var prefix = dto.ServiceType.ToUpperInvariant() switch
        {
            "LABORATORY" => "LAB",
            "PHARMACY" => "PH",
            "BILLING" => "BIL",
            _ => "A"
        };

        var todayCountSql = "SELECT COUNT(1) + 1 FROM PatientQueues WHERE TenantId = @TenantId AND CAST(CheckInTime AS DATE) = CAST(GETDATE() AS DATE)";
        int todaySeq = await conn.ExecuteScalarAsync<int>(todayCountSql, new { dto.TenantId });
        var token = $"{prefix}-{todaySeq:D3}";

        var sql = @"
            INSERT INTO PatientQueues (TenantId, TokenNumber, PatientId, ServiceType, PriorityLevel, StatusId, AssignedDoctorId, Notes)
            VALUES (@TenantId, @TokenNumber, @PatientId, @ServiceType, @PriorityLevel, 1, @AssignedDoctorId, @Notes);
            SELECT SCOPE_IDENTITY();";

        await conn.ExecuteScalarAsync<long>(sql, new {
            dto.TenantId, TokenNumber = token, dto.PatientId, dto.ServiceType,
            dto.PriorityLevel, dto.AssignedDoctorId, dto.Notes
        });

        return token;
    }

    public async Task CallNextTicketAsync(long ticketId, int counterId, int staffId)
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
}
