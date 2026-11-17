import React, { useState, useEffect } from 'react';
import {
  Baby, LayoutDashboard, Stethoscope, FileText, Search, User,
  Plus, RefreshCw, AlertCircle, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { api } from '../../api/apiClient';
import {
  AncPatientCheckDto, AncWorkspaceDetailDto, AncRegisterEpisodeRequest,
  AncCreateEncounterRequest, AncCloseEpisodeRequest, AncUltrasoundDto,
  AncPmtctDto, AncLabExaminationDto, AncDiagnosisDto, AncAppointmentDto,
  AncDashboardDto, AncEpisodeSummaryDto, AncUpdateEpisodeBaselineRequest
} from './ancTypes';
import AncDashboardView from './AncDashboardView';
import AncWorkspaceView from './AncWorkspaceView';
import AncReportsView from './AncReportsView';

export type AncViewMode = 'DASHBOARD' | 'WORKSPACE' | 'REPORTS';

export const AntenatalCarePage: React.FC = () => {
  const [viewMode, setViewMode] = useState<AncViewMode>('DASHBOARD');
  const [activePatientCheck, setActivePatientCheck] = useState<AncPatientCheckDto | null>(null);
  const [workspaceDetail, setWorkspaceDetail] = useState<AncWorkspaceDetailDto | null>(null);
  const [isNewRegistrationMode, setIsNewRegistrationMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<AncDashboardDto | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Patient Search Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadDashboardData = async () => {
    try {
      const res = await api.get<AncDashboardDto>('/anc/dashboard');
      setDashboardData(res);
    } catch (err) {
      console.warn('Failed to load ANC dashboard data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Search patients across hospital registry with MRN normalization
  useEffect(() => {
    if (!isSearchModalOpen) return;
    const q = patientSearchQuery.trim();
    const handler = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res: any = await api.get('/patients/search', { q, limit: 30 });
        const list = Array.isArray(res) ? res : (res?.data || res?.Data || []);
        setSearchResults(list);
      } catch (err) {
        console.warn('Patient search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [patientSearchQuery, isSearchModalOpen]);

  // Select patient and check active ANC pregnancy status
  const handleSelectPatient = async (patientId: number) => {
    setIsSearchModalOpen(false);
    setLoading(true);
    try {
      const checkRes = await api.get<AncPatientCheckDto>(`/anc/patient-check/${patientId}`);
      setActivePatientCheck(checkRes);

      if (checkRes.hasActivePregnancy && checkRes.activeEpisode) {
        // Active pregnancy exists -> Load existing episode workspace
        const epDetail = await api.get<AncWorkspaceDetailDto>(`/anc/episodes/${checkRes.activeEpisode.id}`);
        setWorkspaceDetail(epDetail);
        setIsNewRegistrationMode(false);
        setViewMode('WORKSPACE');
        showToast(
          `Active pregnancy episode ${checkRes.activeEpisode.episodeNumber} detected for ${checkRes.fullName}. Unified workspace loaded.`,
          'success'
        );
      } else {
        // No active pregnancy -> Prepare new registration template preserving patient MRN and demographics
        const blankWorkspace: AncWorkspaceDetailDto = {
          patient: checkRes,
          episode: {
            id: 0,
            patientId: checkRes.patientId,
            episodeNumber: `ANC-${new Date().getFullYear()}-NEW`,
            registrationDate: new Date().toISOString(),
            gravidity: 1,
            parity: 0,
            approvedDatingMethod: 'LMP',
            establishedEdd: new Date(Date.now() + 280 * 86400000).toISOString(),
            currentGestationalWeeks: 6,
            currentGestationalDays: 0,
            gestationalAgeFormatted: '6 weeks + 0 days',
            currentTrimester: 1,
            trimesterFormatted: 'First Trimester',
            progressPercentage: 15,
            daysRemaining: 238,
            isOverdueWarning: false,
            requiresOverdueReview: false,
            status: 'Active',
            completedVisitsCount: 0,
            isCycleRegular: true,
            clinicalAlerts: []
          },
          previousPregnancies: [],
          encounters: [],
          ultrasounds: [],
          labExaminations: [],
          diagnoses: [],
          appointments: [],
          auditLogs: []
        };
        setWorkspaceDetail(blankWorkspace);
        setIsNewRegistrationMode(true);
        setViewMode('WORKSPACE');
        showToast(
          `No active pregnancy for ${checkRes.fullName}. Ready to initiate new pregnancy episode registration.`,
          'info'
        );
      }
    } catch (err: any) {
      console.error('Error during ANC patient check:', err);
      showToast(err?.message || 'Failed to check ANC status for patient.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open an existing episode by episodeId
  const handleOpenEpisode = async (episodeId: number) => {
    setLoading(true);
    try {
      const epDetail = await api.get<AncWorkspaceDetailDto>(`/anc/episodes/${episodeId}`);
      setWorkspaceDetail(epDetail);
      setActivePatientCheck(epDetail.patient);
      setIsNewRegistrationMode(false);
      setViewMode('WORKSPACE');
    } catch (err: any) {
      console.error('Error loading ANC episode:', err);
      showToast(err?.message || 'Failed to load ANC episode.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Refresh current workspace
  const handleRefreshWorkspace = async () => {
    if (!workspaceDetail?.episode?.id) return;
    setLoading(true);
    try {
      const epDetail = await api.get<AncWorkspaceDetailDto>(`/anc/episodes/${workspaceDetail.episode.id}`);
      setWorkspaceDetail(epDetail);
      setActivePatientCheck(epDetail.patient);
    } catch (err: any) {
      showToast(err?.message || 'Failed to refresh workspace.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Action Handlers
  const handleSaveNewEpisode = async (req: AncRegisterEpisodeRequest) => {
    setLoading(true);
    try {
      const created = await api.post<AncEpisodeSummaryDto>('/anc/episodes', req);
      showToast(`Pregnancy episode ${created.episodeNumber} successfully registered!`, 'success');
      await handleOpenEpisode(created.id);
    } catch (err: any) {
      showToast(err?.message || 'Failed to register pregnancy episode.', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEncounter = async (req: AncCreateEncounterRequest) => {
    setLoading(true);
    try {
      await api.post('/anc/encounters', req);
      showToast('Encounter saved successfully.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save encounter.', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeEncounter = async (encounterId: number) => {
    setLoading(true);
    try {
      await api.post(`/anc/encounters/${encounterId}/finalize`, {});
      showToast('Encounter finalized successfully.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to finalize encounter.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUltrasound = async (dto: AncUltrasoundDto) => {
    setLoading(true);
    try {
      await api.post(`/anc/episodes/${dto.episodeId}/ultrasounds`, dto);
      showToast('Ultrasound scan recorded.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save ultrasound.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePmtct = async (dto: AncPmtctDto) => {
    setLoading(true);
    try {
      await api.post(`/anc/episodes/${dto.episodeId}/pmtct`, dto);
      showToast('Confidential PMTCT record updated.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update PMTCT record.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLab = async (dto: AncLabExaminationDto) => {
    setLoading(true);
    try {
      await api.post(`/anc/episodes/${dto.episodeId}/labs`, dto);
      showToast('Laboratory examination recorded.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save laboratory record.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDiagnosis = async (dto: AncDiagnosisDto) => {
    setLoading(true);
    try {
      await api.post(`/anc/episodes/${dto.episodeId}/diagnoses`, dto);
      showToast('Diagnosis added.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add diagnosis.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleAppointment = async (dto: AncAppointmentDto) => {
    setLoading(true);
    try {
      await api.post(`/anc/episodes/${dto.episodeId}/appointments`, dto);
      showToast('ANC appointment scheduled.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to schedule appointment.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseEpisode = async (req: AncCloseEpisodeRequest) => {
    setLoading(true);
    try {
      await api.post(`/anc/episodes/${req.episodeId}/close`, req);
      showToast('Pregnancy episode successfully closed with delivery outcome recorded.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to close episode.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOverdueReview = async (reviewNotes: string) => {
    if (!workspaceDetail?.episode?.id) return;
    setLoading(true);
    try {
      await api.post(`/anc/episodes/${workspaceDetail.episode.id}/overdue-review`, {
        episodeId: workspaceDetail.episode.id,
        reviewNotes
      });
      showToast('Authorized clinical review confirmed.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to record overdue review.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDating = async (
    method: string,
    lmp?: string,
    usDate?: string,
    usWeeks?: number,
    usDays?: number
  ) => {
    if (!workspaceDetail?.episode?.id) return;
    setLoading(true);
    try {
      await api.put(`/anc/episodes/${workspaceDetail.episode.id}/dating`, {
        episodeId: workspaceDetail.episode.id,
        datingMethod: method,
        lmpDate: lmp ? new Date(lmp).toISOString() : null,
        initialUltrasoundDate: usDate ? new Date(usDate).toISOString() : null,
        initialGestationalWeeks: usWeeks,
        initialGestationalDays: usDays
      });
      showToast('Pregnancy dating updated successfully.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update dating.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBaseline = async (req: AncUpdateEpisodeBaselineRequest) => {
    if (!workspaceDetail?.episode?.id) return;
    setLoading(true);
    try {
      await api.put(`/anc/episodes/${workspaceDetail.episode.id}/baseline`, req);
      showToast('Baseline registration parameters updated successfully.', 'success');
      await handleRefreshWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update registration parameters.', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Filter patients locally to support normalized search (e.g. '270606' matching 'HD-270606')
  const normalizedQuery = patientSearchQuery.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const displayResults = searchResults.filter((p: any) => {
    if (!normalizedQuery) return true;
    const mrnClean = String(p.mrn || p.MRN || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameClean = String(p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).toLowerCase().replace(/[^a-z0-9]/g, '');
    const phoneClean = String(p.primaryPhone || p.phone || '').replace(/[^0-9]/g, '');
    return mrnClean.includes(normalizedQuery) || nameClean.includes(normalizedQuery) || phoneClean.includes(normalizedQuery);
  });

  return (
    <div style={{ padding: '0 24px 60px 24px', maxWidth: '1440px', margin: '0 auto', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 3000,
            padding: '12px 18px',
            borderRadius: '10px',
            background: toastMessage.type === 'success' ? '#edf9f0' : toastMessage.type === 'error' ? '#fdf2f2' : '#f0f7ff',
            color: toastMessage.type === 'success' ? '#1b7339' : toastMessage.type === 'error' ? '#c81e1e' : '#1c64f2',
            border: `1px solid ${toastMessage.type === 'success' ? '#bcf0da' : toastMessage.type === 'error' ? '#f8b4b4' : '#b4c6fc'}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.825rem',
            fontWeight: 600
          }}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '6px', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Application Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 0 14px 0',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        {/* Left: Module Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0071e3 0%, #30b0c7 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 113, 227, 0.25)'
            }}
          >
            <Baby size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Antenatal Care (ANC)
              </h1>
              <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                Clinical Lifecycle
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Continuous Pregnancy Episodes • Evidence-Based Care • Unified Workspace
            </p>
          </div>
        </div>

        {/* Center: Apple-style Segmented Control */}
        <div
          style={{
            background: '#e5e5ea',
            padding: '3px',
            borderRadius: '10px',
            display: 'inline-flex',
            gap: '3px'
          }}
        >
          <button
            onClick={() => setViewMode('DASHBOARD')}
            style={{
              background: viewMode === 'DASHBOARD' ? '#ffffff' : 'transparent',
              color: viewMode === 'DASHBOARD' ? '#0071e3' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '7px',
              padding: '6px 14px',
              fontWeight: viewMode === 'DASHBOARD' ? 600 : 500,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: viewMode === 'DASHBOARD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutDashboard size={14} />
            Dashboard
          </button>
          <button
            onClick={() => {
              if (workspaceDetail) {
                setViewMode('WORKSPACE');
              } else {
                setIsSearchModalOpen(true);
              }
            }}
            style={{
              background: viewMode === 'WORKSPACE' ? '#ffffff' : 'transparent',
              color: viewMode === 'WORKSPACE' ? '#0071e3' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '7px',
              padding: '6px 14px',
              fontWeight: viewMode === 'WORKSPACE' ? 600 : 500,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: viewMode === 'WORKSPACE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Stethoscope size={14} />
            Clinical Workspace
          </button>
          <button
            onClick={() => setViewMode('REPORTS')}
            style={{
              background: viewMode === 'REPORTS' ? '#ffffff' : 'transparent',
              color: viewMode === 'REPORTS' ? '#0071e3' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '7px',
              padding: '6px 14px',
              fontWeight: viewMode === 'REPORTS' ? 600 : 500,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: viewMode === 'REPORTS' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={14} />
            Reports & Registers
          </button>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              setPatientSearchQuery('');
              setIsSearchModalOpen(true);
            }}
            className="btn-secondary"
            style={{ padding: '7px 14px', fontSize: '0.8rem' }}
          >
            <Search size={14} style={{ color: '#0071e3' }} />
            <span>{activePatientCheck ? `${activePatientCheck.fullName} (${activePatientCheck.mrn})` : 'Search Patient / MRN'}</span>
          </button>

          <button
            onClick={() => {
              setPatientSearchQuery('');
              setIsSearchModalOpen(true);
            }}
            className="btn-primary"
            style={{ padding: '7px 16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} />
            <span>Register New Pregnancy</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main>
        {viewMode === 'DASHBOARD' && (
          <AncDashboardView
            dashboard={dashboardData}
            loading={loading}
            onSelectPatient={(patientId: number, episodeId?: number) => {
              if (episodeId) {
                handleOpenEpisode(episodeId);
              } else {
                handleSelectPatient(patientId);
              }
            }}
            onOpenNewRegistration={() => {
              setPatientSearchQuery('');
              setIsSearchModalOpen(true);
            }}
            onOpenReports={() => setViewMode('REPORTS')}
          />
        )}

        {viewMode === 'WORKSPACE' && workspaceDetail && (
          <AncWorkspaceView
            workspace={workspaceDetail}
            isNewRegistrationMode={isNewRegistrationMode}
            onRefresh={handleRefreshWorkspace}
            onSaveNewEpisode={handleSaveNewEpisode}
            onCreateEncounter={handleCreateEncounter}
            onFinalizeEncounter={handleFinalizeEncounter}
            onAddUltrasound={handleAddUltrasound}
            onSavePmtct={handleSavePmtct}
            onAddLab={handleAddLab}
            onAddDiagnosis={handleAddDiagnosis}
            onScheduleAppointment={handleScheduleAppointment}
            onCloseEpisode={handleCloseEpisode}
            onApproveOverdueReview={handleApproveOverdueReview}
            onUpdateDating={handleUpdateDating}
            onUpdateBaseline={handleUpdateBaseline}
            onPrintSummary={() => setViewMode('REPORTS')}
          />
        )}

        {viewMode === 'WORKSPACE' && !workspaceDetail && (
          <div className="glass-panel" style={{ maxWidth: '480px', margin: '80px auto', textAlign: 'center', padding: '40px 24px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(0, 113, 227, 0.1)',
                color: '#0071e3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <Stethoscope size={28} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              No Active ANC Patient Selected
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Please select a registered patient by MRN or Name to inspect their pregnancy episodes or begin an initial ANC intake.
            </p>
            <button
              onClick={() => {
                setPatientSearchQuery('');
                setIsSearchModalOpen(true);
              }}
              className="btn-primary"
              style={{ margin: '0 auto' }}
            >
              <Search size={14} /> Find Patient by MRN / Name
            </button>
          </div>
        )}

        {viewMode === 'REPORTS' && (
          <AncReportsView
            onBackToDashboard={() => setViewMode('DASHBOARD')}
            onOpenPatientWorkspace={(patientId) => handleSelectPatient(patientId)}
          />
        )}
      </main>

      {/* PATIENT SEARCH MODAL (Elegantly Centered Apple HIG Dialog) */}
      {isSearchModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2500,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSearchModalOpen(false);
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '560px',
              maxWidth: '100%',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fbfbfd'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={16} style={{ color: '#0071e3' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                  Select Patient for Antenatal Care
                </h3>
              </div>
              <button
                onClick={() => setIsSearchModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Search Input */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', background: '#ffffff' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
                <input
                  type="text"
                  value={patientSearchQuery}
                  onChange={(e) => setPatientSearchQuery(e.target.value)}
                  placeholder="Type MRN (e.g. 270606), First Name, Last Name, or Phone..."
                  autoFocus
                  style={{ paddingLeft: '34px' }}
                />
              </div>
            </div>

            {/* Results List */}
            <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '10px 14px' }}>
              {isSearching ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#0071e3' }} />
                  Searching patient database...
                </div>
              ) : displayResults.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <User size={24} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                  <p style={{ fontWeight: 600, margin: '0 0 4px 0', color: 'var(--text-main)' }}>No patients found</p>
                  <p style={{ margin: 0 }}>Try typing a name or numeric MRN like 270606.</p>
                </div>
              ) : (
                displayResults.map((patient: any) => {
                  const pid = patient.id || patient.Id;
                  const mrn = patient.mrn || patient.MRN || `HD-${pid}`;
                  const name = patient.fullName || `${patient.firstName || patient.FirstName} ${patient.lastName || patient.LastName}`.trim();
                  const age = patient.ageYears || patient.age || '-';
                  const gender = patient.gender || patient.Gender || 'F';
                  const phone = patient.primaryPhone || patient.phone || '-';

                  return (
                    <div
                      key={pid}
                      onClick={() => handleSelectPatient(pid)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        border: '1px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f5f7';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                            {name}
                          </span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#e5e5ea',
                              color: 'var(--text-secondary)',
                              fontWeight: 600
                            }}
                          >
                            {mrn}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                          <span>{age} yrs</span>
                          <span>•</span>
                          <span>{gender}</span>
                          <span>•</span>
                          <span>{phone}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                background: '#fbfbfd',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>Selecting a patient detects active episodes automatically.</span>
              <button onClick={() => setIsSearchModalOpen(false)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AntenatalCarePage;
