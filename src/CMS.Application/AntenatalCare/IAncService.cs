using CMS.Shared.DTOs;

namespace CMS.Application.AntenatalCare;

public interface IAncService
{
    Task<AncPatientCheckDto> CheckPatientActivePregnancyAsync(int patientId, int tenantId = 1);
    Task<AncWorkspaceDetailDto> RegisterNewEpisodeAsync(AncRegisterEpisodeRequest request, int userId, int tenantId = 1);
    Task<AncWorkspaceDetailDto> GetWorkspaceDetailsAsync(int episodeId, int userId, bool isAuthorizedPmtct = false, int tenantId = 1);
    Task<AncEncounterDto> CreateEncounterAsync(AncCreateEncounterRequest request, int userId, int tenantId = 1);
    Task<AncEncounterDto> FinalizeEncounterAsync(int encounterId, int userId);
    Task<AncUltrasoundDto> AddUltrasoundRecordAsync(int episodeId, AncUltrasoundDto dto, int userId);
    Task<AncPmtctDto> SavePmtctRecordAsync(int episodeId, AncPmtctDto dto, int userId);
    Task<AncLabExaminationDto> AddLabExaminationAsync(int episodeId, AncLabExaminationDto dto, int userId);
    Task<AncDiagnosisDto> AddDiagnosisAsync(int episodeId, AncDiagnosisDto dto, int userId);
    Task<AncAppointmentDto> ScheduleAppointmentAsync(int episodeId, AncAppointmentDto dto, int userId);
    Task<bool> ApproveOverdueReviewAsync(int episodeId, string reviewNotes, int userId);
    Task<AncOutcomeDto> CloseEpisodeAsync(AncCloseEpisodeRequest request, int userId);
    Task<List<AncEpisodeSummaryDto>> GetPatientPregnancyHistoryAsync(int patientId, int tenantId = 1);
    Task<AncDashboardDto> GetDashboardAsync(int tenantId = 1);
    Task<AncReportResultDto> GenerateReportAsync(AncReportFilterRequest filter, int tenantId = 1);
    Task<AncWorkspaceDetailDto> UpdateDatingAsync(int episodeId, string datingMethod, DateTime? lmp, DateTime? usDate, int? usWeeks, int? usDays, int userId);
    Task<AncWorkspaceDetailDto> UpdateEpisodeBaselineAsync(int episodeId, AncUpdateEpisodeBaselineRequest request, int userId, int tenantId = 1);
}
