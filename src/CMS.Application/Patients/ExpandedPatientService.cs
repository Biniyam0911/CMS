using CMS.Domain.Interfaces;
using CMS.Shared.DTOs;
using Dapper;

namespace CMS.Application.Patients;

public class ExpandedPatientService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICacheService _cache;

    public ExpandedPatientService(IDbConnectionFactory dbFactory, ICacheService cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    public async Task<PatientDetailDto?> GetPatientDetailAsync(byte tenantId, int patientId)
    {
        using var conn = _dbFactory.CreateConnection();
        var sqlPatient = @"
            SELECT Id, TenantId, MRN, FirstName, MiddleName, LastName, DateOfBirth, Gender,
                   BloodGroup, MaritalStatus, PrimaryPhone, SecondaryPhone, Email, Address, City,
                   EmergencyName, EmergencyPhone, EmergencyRelation, InsuranceProvider,
                   InsurancePolicyNo, Allergies, ChronicConditions, Notes, IsActive
            FROM Patients
            WHERE TenantId = @TenantId AND Id = @PatientId";

        var p = await conn.QueryFirstOrDefaultAsync<dynamic>(sqlPatient, new { TenantId = tenantId, PatientId = patientId });
        if (p == null) return null;

        var sqlHistory = @"
            SELECT Id, PatientId, HistoryType, Description, OnsetDate, Status, Notes, RecordedAt
            FROM PatientMedicalHistories
            WHERE PatientId = @PatientId
            ORDER BY RecordedAt DESC";

        var histories = (await conn.QueryAsync<PatientMedicalHistoryDto>(sqlHistory, new { PatientId = patientId })).ToList();

        var sqlEncounters = @"
            SELECT e.Id, e.PatientId, p.FirstName + ' ' + p.LastName AS PatientName,
                   e.DoctorId, s.FirstName + ' ' + s.LastName AS DoctorName,
                   e.EncounterDate, e.ChiefComplaint, e.HistoryOfIllness,
                   e.PhysicalExam, e.Assessment, e.Plan, e.VitalSigns,
                   e.IsFinalized, e.FinalizedAt
            FROM Encounters e
            JOIN Patients p ON p.Id = e.PatientId
            JOIN Doctors d ON d.Id = e.DoctorId
            JOIN Staff s ON s.Id = d.StaffId
            WHERE e.TenantId = @TenantId AND e.PatientId = @PatientId
            ORDER BY e.EncounterDate DESC";

        var encounters = (await conn.QueryAsync<EncounterDto>(sqlEncounters, new { TenantId = tenantId, PatientId = patientId })).ToList();

        return new PatientDetailDto(
            (int)p.Id, (byte)p.TenantId, (string)p.MRN, (string)p.FirstName, (string?)p.MiddleName, (string)p.LastName,
            (DateTime)p.DateOfBirth, (int)p.Gender, (string?)p.BloodGroup, (string?)p.MaritalStatus?.ToString(),
            (string)p.PrimaryPhone, (string?)p.SecondaryPhone, (string?)p.Email, (string?)p.Address, (string?)p.City,
            (string?)p.EmergencyName, (string?)p.EmergencyPhone, (string?)p.EmergencyRelation,
            (string?)p.InsuranceProvider, (string?)p.InsurancePolicyNo, (string?)p.Allergies,
            (string?)p.ChronicConditions, (string?)p.Notes, (bool)p.IsActive,
            histories, encounters
        );
    }

    public async Task<int> AddMedicalHistoryAsync(CreatePatientHistoryDto dto)
    {
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO PatientMedicalHistories (PatientId, HistoryType, Description, OnsetDate, Notes)
            VALUES (@PatientId, @HistoryType, @Description, @OnsetDate, @Notes);
            SELECT SCOPE_IDENTITY();";

        return await conn.ExecuteScalarAsync<int>(sql, dto);
    }
}
