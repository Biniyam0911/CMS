using System.Text;
using CMS.API.Hubs;
using CMS.API.Middleware;
using CMS.Application.Appointments;
using CMS.Application.Auth;
using CMS.Application.Billing;
using CMS.Application.Dashboard;
using CMS.Application.Encounters;
using CMS.Application.Laboratory;
using CMS.Application.Modules;
using CMS.Application.Notifications;
using CMS.Application.PatientPortal;
using CMS.Application.Patients;
using CMS.Application.Pharmacy;
using CMS.Application.Queue;
using CMS.Application.ReportBuilder;
using CMS.Application.Settings;
using CMS.Application.StaffServices;
using CMS.Domain.Interfaces;
using CMS.Infrastructure.Cache;
using CMS.Infrastructure.Data;
using CMS.Infrastructure.LabIntegration;
using CMS.Infrastructure.Notifications;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/cms_api_.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=localhost\\sqlexpress;Database=ClinicDB;User Id=sa;Password=say@123;TrustServerCertificate=True;";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();

// Redis is optional — if not available the API falls back to a no-op in-memory cache
var redisConnStr = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";
try
{
    var redisOptions = ConfigurationOptions.Parse(redisConnStr);
    redisOptions.AbortOnConnectFail = false;
    redisOptions.ConnectTimeout = 2000;
    redisOptions.SyncTimeout = 2000;
    var mux = ConnectionMultiplexer.Connect(redisOptions);
    if (mux.IsConnected)
    {
        builder.Services.AddSingleton<IConnectionMultiplexer>(mux);
        builder.Services.AddSingleton<ICacheService, RedisCacheService>();
    }
    else
    {
        builder.Services.AddSingleton<ICacheService, NoOpCacheService>();
    }
}
catch
{
    // Redis unavailable — use no-op cache so the API still starts
    builder.Services.AddSingleton<ICacheService, NoOpCacheService>();
}

// Domain & Application services across all 16 modules
builder.Services.AddTransient<INotificationProvider, SmtpEmailProvider>();
builder.Services.AddTransient<IHl7Adapter, Hl7Adapter>();
builder.Services.AddTransient<IAstmAdapter, AstmAdapter>();
builder.Services.AddTransient<ILabResultIngestionService, LabResultIngestionService>();

// Passive TCP Server for LIS Analyzers (e.g. ZYBIO Z3 on port 5100 / 2575)
builder.Services.AddSingleton<LisTcpListenerService>();
builder.Services.AddSingleton<ILisTcpListenerService>(sp => sp.GetRequiredService<LisTcpListenerService>());
builder.Services.AddHostedService<LisTcpListenerService>(sp => sp.GetRequiredService<LisTcpListenerService>());


builder.Services.AddScoped<AuthManagementService>();
builder.Services.AddScoped<StaffAndDoctorService>();
builder.Services.AddScoped<AppointmentService>();
builder.Services.AddScoped<EncounterService>();
builder.Services.AddScoped<ExpandedPatientService>();
builder.Services.AddScoped<SoapAndClinicalService>();
builder.Services.AddScoped<LabService>();
builder.Services.AddScoped<PharmacyService>();
builder.Services.AddScoped<BillingService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<ReportExportService>();
builder.Services.AddScoped<ReportTemplateService>();
builder.Services.AddScoped<PatientPortalService>();
builder.Services.AddScoped<QueueService>();
builder.Services.AddScoped<ModuleManagementService>();
builder.Services.AddScoped<SettingsAndApiService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<CMS.Application.Notifications.SmsGatewayService>();
builder.Services.AddScoped<CMS.Application.Billing.TelebirrPaymentService>();
builder.Services.AddScoped<CMS.Application.Telemedicine.TelemedService>();
builder.Services.AddHttpClient<CMS.Application.Telemedicine.TelegramBotService>();
builder.Services.AddHttpClient<CMS.Application.Telemedicine.WhatsAppCloudService>();

builder.Services.AddSignalR();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "CMS",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "CMS",
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "SuperSecretKeyThatIsAtLeast32BytesLongForCMS!"))
            {
                KeyId = "cms-hmac-key-v1"
            }
        };
    });

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo {
        Title = "Clinic Management System (CMS) API",
        Version = "v1",
        Description = "Enterprise REST API for 16 Clinical, Financial, Administrative, and Integration modules"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter token directly.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", p =>
        p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<TenantMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "CMS API v1");
    });
}

app.UseStaticFiles();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();
