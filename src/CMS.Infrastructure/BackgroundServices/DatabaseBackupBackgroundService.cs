using System.Data;
using CMS.Domain.Interfaces;
using Dapper;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CMS.Infrastructure.BackgroundServices;

public class DatabaseBackupBackgroundService : BackgroundService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ILogger<DatabaseBackupBackgroundService> _logger;
    private static DateTime? _lastExecutedDate = null;

    public DatabaseBackupBackgroundService(
        IDbConnectionFactory dbFactory,
        ILogger<DatabaseBackupBackgroundService> logger)
    {
        _dbFactory = dbFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DatabaseBackupBackgroundService is starting...");

        // Initial brief delay to allow system startup and DB connectivity
        await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndExecuteBackupAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Error while checking or executing scheduled database backup.");
            }

            // Check every 60 seconds
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("DatabaseBackupBackgroundService is stopping.");
    }

    private async Task CheckAndExecuteBackupAsync(CancellationToken cancellationToken)
    {
        using var conn = _dbFactory.CreateConnection();

        // 1. Read schedule configuration from ClinicSettings
        var sqlSettings = @"
            SELECT SettingKey, SettingValue 
            FROM ClinicSettings 
            WHERE TenantId = 1 AND SettingKey IN ('Backup.ScheduleEnabled', 'Backup.Frequency', 'Backup.TimeOfDay');";

        var settings = (await conn.QueryAsync<(string SettingKey, string SettingValue)>(sqlSettings))
            .ToDictionary(x => x.SettingKey, x => x.SettingValue, StringComparer.OrdinalIgnoreCase);

        bool enabled = settings.TryGetValue("Backup.ScheduleEnabled", out var enVal) &&
                       (enVal.Equals("true", StringComparison.OrdinalIgnoreCase) || enVal == "1");

        if (!enabled)
        {
            return;
        }

        string frequency = settings.TryGetValue("Backup.Frequency", out var freqVal) && !string.IsNullOrWhiteSpace(freqVal)
            ? freqVal
            : "Daily";

        string timeOfDayStr = settings.TryGetValue("Backup.TimeOfDay", out var timeVal) && !string.IsNullOrWhiteSpace(timeVal)
            ? timeVal
            : "02:00";

        if (!TimeSpan.TryParse(timeOfDayStr, out var scheduledTime))
        {
            scheduledTime = new TimeSpan(2, 0, 0);
        }

        var now = DateTime.Now;

        // Check frequency condition
        if (frequency.Equals("Weekly", StringComparison.OrdinalIgnoreCase))
        {
            // Weekly: Sunday only
            if (now.DayOfWeek != DayOfWeek.Sunday)
            {
                return;
            }
        }

        // Check if the current time matches the scheduled hour & minute
        if (now.Hour != scheduledTime.Hours || now.Minute != scheduledTime.Minutes)
        {
            return;
        }

        // Guard against duplicate execution within the same day
        if (_lastExecutedDate.HasValue && _lastExecutedDate.Value.Date == now.Date)
        {
            return;
        }

        _logger.LogInformation("Triggering scheduled automated database backup ({Frequency} at {TimeOfDay})...", frequency, timeOfDayStr);

        var backupDir = await GetSqlDefaultBackupDirectoryAsync(conn);
        string timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        string backupFileName = $"ClinicDB_Scheduled_{timestamp}.bak";
        string backupPath = Path.Combine(backupDir, backupFileName);

        var backupSql = @"
            BACKUP DATABASE [ClinicDB] 
            TO DISK = @BackupPath 
            WITH FORMAT, MEDIANAME = 'ClinicDB_Backup', NAME = 'Scheduled Backup of ClinicDB';";

        await conn.ExecuteAsync(backupSql, new { BackupPath = backupPath }, commandTimeout: 600);

        _lastExecutedDate = now;
        _logger.LogInformation("Automated scheduled backup successfully completed: {BackupPath}", backupPath);
    }

    private async Task<string> GetSqlDefaultBackupDirectoryAsync(IDbConnection conn)
    {
        try
        {
            var sql = @"
                DECLARE @backupDir NVARCHAR(400);
                EXEC master.dbo.xp_instance_regread 
                    N'HKEY_LOCAL_MACHINE', 
                    N'Software\Microsoft\MSSQLServer\MSSQLServer', 
                    N'BackupDirectory', 
                    @backupDir OUTPUT;
                SELECT ISNULL(@backupDir, CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(400)));";
            var dir = await conn.ExecuteScalarAsync<string>(sql);
            if (!string.IsNullOrWhiteSpace(dir)) return dir.TrimEnd('\\');
        }
        catch { }
        return @"C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS03\MSSQL\Backup";
    }
}
