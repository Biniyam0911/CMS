using CMS.Domain.Interfaces;
using CMS.Infrastructure.Data;
using CMS.Infrastructure.LabIntegration;
using CMS.Infrastructure.Notifications;
using CMS.ServiceManager.Workers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/service_manager_.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

var host = Host.CreateDefaultBuilder(args)
    .UseWindowsService() // Supports installing as Windows Service daemon
    .UseSerilog()
    .ConfigureServices((hostContext, services) =>
    {
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
        services.AddTransient<INotificationProvider, SmtpEmailProvider>();
        services.AddTransient<IHl7Adapter, Hl7Adapter>();
        services.AddTransient<ILabResultIngestionService, LabResultIngestionService>();

        services.AddHostedService<HealthCheckWorker>();
        services.AddHostedService<NotificationDispatchWorker>();
        services.AddHostedService<LabInstrumentListenerWorker>();
    })
    .Build();

await host.RunAsync();
