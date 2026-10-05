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
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = WindowsServiceHelpers.IsWindowsService() ? AppContext.BaseDirectory : default
});

builder.Host.UseWindowsService();

string logPath = Path.Combine(AppContext.BaseDirectory, "logs", "cms_api_.log");
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(logPath, rollingInterval: RollingInterval.Day, shared: true, flushToDiskInterval: TimeSpan.FromSeconds(1))
    .CreateLogger();

builder.Host.UseSerilog();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=localhost\\sqlexpress;Database=ClinicDB;User Id=sa;Password=say@123;TrustServerCertificate=True;";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();

builder.Services.AddMemoryCache();

// Redis is optional — if not available the API falls back to high-speed in-memory cache
var redisConnStr = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";
try
{
    var redisOptions = ConfigurationOptions.Parse(redisConnStr);
    redisOptions.AbortOnConnectFail = true;   // fail fast so we know immediately
    redisOptions.ConnectTimeout = 5000;        // 5 seconds — enough for Memurai on Windows
    redisOptions.SyncTimeout = 5000;
    redisOptions.ReconnectRetryPolicy = new ExponentialRetry(1000);
    var mux = ConnectionMultiplexer.Connect(redisOptions);
    // Ping to confirm the connection is actually usable (not just "opened")
    var db = mux.GetDatabase();
    db.Ping();
    Log.Information("Cache: Using Redis at {RedisEndpoint}", redisConnStr);
    builder.Services.AddSingleton<IConnectionMultiplexer>(mux);
    builder.Services.AddSingleton<ICacheService, RedisCacheService>();
}
catch (Exception ex)
{
    Log.Warning("Cache: Redis unavailable ({Message}). Using MemoryCacheService fallback", ex.Message);
    builder.Services.AddSingleton<ICacheService, MemoryCacheService>();
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
builder.Services.AddScoped<CMS.Application.Billing.ChapaPaymentService>();
builder.Services.AddHttpClient("Chapa", client =>
{
    client.BaseAddress = new Uri("https://api.chapa.co/");
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddScoped<CMS.Application.Telemedicine.TelemedService>();
builder.Services.AddHttpClient<CMS.Application.Telemedicine.TelegramBotService>();
builder.Services.AddHttpClient<CMS.Application.Telemedicine.WhatsAppCloudService>();

builder.Services.AddSignalR();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwtKeyBytes = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "SuperSecretKeyThatIsAtLeast32BytesLongForCMS!");
        var signingKeyWithKid = new SymmetricSecurityKey(jwtKeyBytes) { KeyId = "cms-hmac-key-v1" };
        var signingKeyWithoutKid = new SymmetricSecurityKey(jwtKeyBytes);

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "CMS",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "CMS",
            IssuerSigningKey = signingKeyWithKid,
            IssuerSigningKeys = new SecurityKey[] { signingKeyWithKid, signingKeyWithoutKid },
            IssuerSigningKeyResolver = (token, securityToken, kid, validationParameters) =>
            {
                if (string.IsNullOrEmpty(kid))
                    return new SecurityKey[] { signingKeyWithoutKid };
                return new SecurityKey[] { signingKeyWithKid, signingKeyWithoutKid };
            }
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                // Priority 1: HttpOnly cookie (secure — JS cannot read this)
                if (context.Request.Cookies.TryGetValue("cms_access_token", out var cookieToken)
                    && !string.IsNullOrEmpty(cookieToken))
                {
                    context.Token = cookieToken;
                    return Task.CompletedTask;
                }

                // Priority 2: Authorization header (for backward-compat / API clients)
                var authHeader = context.Request.Headers.Authorization.ToString();
                if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    var bearerToken = authHeader["Bearer ".Length..].Trim();
                    if (!bearerToken.Contains("dummy_signature"))
                        context.Token = bearerToken;
                    else
                        context.NoResult(); // Ignore stale legacy tokens
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddControllers(options =>
{
    // Global policy: every endpoint requires authentication by default.
    // Public endpoints (login) are decorated with [AllowAnonymous].
    var policy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    options.Filters.Add(new Microsoft.AspNetCore.Mvc.Authorization.AuthorizeFilter(policy));
});
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
app.UseMiddleware<TenantMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");

try
{
    Log.Information("CMS API Host starting...");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "CMS API Host terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
