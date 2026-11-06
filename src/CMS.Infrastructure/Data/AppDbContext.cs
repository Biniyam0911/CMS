using System.Data;
using CMS.Domain.Entities;
using CMS.Domain.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CMS.Infrastructure.Data;

/// <summary>
/// Factory for instantiating high-performance raw ADO.NET / Dapper connections.
/// Used by services that need raw SQL speed (e.g. reporting, bulk inserts).
/// </summary>
public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? "Server=localhost\\sqlexpress;Database=ClinicDB;User Id=sa;Password=say@123;TrustServerCertificate=True;MultipleActiveResultSets=True;";
    }

    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}

/// <summary>
/// Primary Entity Framework Core Database Context for the CMS.
/// Maps all Domain entities to SQL Server tables, sets relationship constraints, and applies query filters.
/// DEVELOPER NOTE:
/// - When creating a new entity, declare its DbSet here: public DbSet&lt;YourEntity&gt; YourEntities =&gt; Set&lt;YourEntity&gt;();
/// - Configure any specific column mappings, keys, or soft-delete filters in OnModelCreating.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<Encounter> Encounters => Set<Encounter>();
    public DbSet<Diagnosis> Diagnoses => Set<Diagnosis>();
    public DbSet<LabInstrument> LabInstruments => Set<LabInstrument>();
    public DbSet<LabTestCatalog> LabTestCatalogs => Set<LabTestCatalog>();
    public DbSet<LabTestParameter> LabTestParameters => Set<LabTestParameter>();
    public DbSet<LabOrder> LabOrders => Set<LabOrder>();
    public DbSet<LabOrderItem> LabOrderItems => Set<LabOrderItem>();
    public DbSet<LabSample> LabSamples => Set<LabSample>();
    public DbSet<LabResult> LabResults => Set<LabResult>();
    public DbSet<LabCriticalAlert> LabCriticalAlerts => Set<LabCriticalAlert>();
    public DbSet<NotificationItem> Notifications => Set<NotificationItem>();
    public DbSet<ReportTemplate> ReportTemplates => Set<ReportTemplate>();
    public DbSet<ReportDefinition> ReportDefinitions => Set<ReportDefinition>();
    public DbSet<ServiceCounter> ServiceCounters => Set<ServiceCounter>();
    public DbSet<PatientQueue> PatientQueues => Set<PatientQueue>();
    public DbSet<AppModule> AppModules => Set<AppModule>();
    public DbSet<TenantModuleSetting> TenantModuleSettings => Set<TenantModuleSetting>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<WebhookSubscription> WebhookSubscriptions => Set<WebhookSubscription>();
    public DbSet<ClinicSetting> ClinicSettings => Set<ClinicSetting>();
    public DbSet<DocumentTemplate> DocumentTemplates => Set<DocumentTemplate>();
    public DbSet<IntegrationConfig> IntegrationConfigs => Set<IntegrationConfig>();
    public DbSet<MedicalCertificate> MedicalCertificates => Set<MedicalCertificate>();
    public DbSet<ProcedureOrder> ProcedureOrders => Set<ProcedureOrder>();
    public DbSet<PatientMedicalHistory> PatientMedicalHistories => Set<PatientMedicalHistory>();
    public DbSet<CdssDrugInteraction> CdssDrugInteractions => Set<CdssDrugInteraction>();
    public DbSet<PatientProblemList> PatientProblemLists => Set<PatientProblemList>();
    public DbSet<ConsultationRoom> ConsultationRooms => Set<ConsultationRoom>();
    public DbSet<LabChainOfCustody> LabChainOfCustodies => Set<LabChainOfCustody>();
    public DbSet<NarcoticsDispenseLog> NarcoticsDispenseLogs => Set<NarcoticsDispenseLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<UserRole>().HasKey(ur => new { ur.UserId, ur.RoleId });

        modelBuilder.Entity<Patient>().ToTable(tb => tb.IsTemporal());
        modelBuilder.Entity<Encounter>().ToTable(tb => tb.IsTemporal());
        modelBuilder.Entity<LabResult>().ToTable(tb => tb.IsTemporal());

        modelBuilder.Entity<Appointment>()
            .HasIndex(a => new { a.TenantId, a.DoctorId, a.SlotDateTime })
            .IsUnique();
    }
}
