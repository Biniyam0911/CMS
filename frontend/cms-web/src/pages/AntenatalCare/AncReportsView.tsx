import React, { useState, useEffect } from 'react';
import {
  FileText, Calendar, Filter, Download, Printer, RefreshCw,
  Search, AlertTriangle, ShieldAlert, CheckCircle2, User,
  Stethoscope, Activity, TrendingUp, Users, Baby, ChevronDown, ChevronUp,
  X, Eye, ExternalLink, HeartPulse, Clock, FlaskConical, ShieldCheck
} from 'lucide-react';
import {
  AncReportResultDto, AncPatientCheckDto, AncWorkspaceDetailDto, AncEpisodeSummaryDto
} from './ancTypes';
import { api } from '../../api/apiClient';

interface AncReportsViewProps {
  onBackToDashboard?: () => void;
  onOpenPatientWorkspace?: (patientId: number) => void;
}

interface ReportOption {
  key: string;
  title: string;
  description: string;
  category: 'Registers' | 'Clinical Safety' | 'Outcomes & Labs' | 'Management';
  badgeType: 'badge-info' | 'badge-normal' | 'badge-warning' | 'badge-critical';
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    key: 'ACTIVE_REGISTER',
    title: '1. Active Pregnancy Register',
    description: 'Current cohort of all open active pregnancies, gestational age, and next visit dates.',
    category: 'Registers',
    badgeType: 'badge-info'
  },
  {
    key: 'FIRST_REGISTRATION',
    title: '2. First ANC Registrations',
    description: 'Initial intake encounters, baseline risk assessment, gravidity, parity, and LMP/dating.',
    category: 'Registers',
    badgeType: 'badge-info'
  },
  {
    key: 'FOLLOW_UP',
    title: '3. Follow-up Visits Register',
    description: 'Chronological follow-up encounters, vital signs, fundal height, FHR, and danger signs.',
    category: 'Registers',
    badgeType: 'badge-normal'
  },
  {
    key: 'TRIMESTER_DISTRIBUTION',
    title: '4. Trimester & GA Breakdown',
    description: 'Statistical distribution of active cohort across First, Second, and Third trimesters.',
    category: 'Management',
    badgeType: 'badge-info'
  },
  {
    key: 'MISSED_APPOINTMENTS',
    title: '5. Defaulted & Missed Visits',
    description: 'Worklist of patients who missed their scheduled ANC visit for tracing and outreach.',
    category: 'Clinical Safety',
    badgeType: 'badge-warning'
  },
  {
    key: 'HIGH_RISK_REGISTER',
    title: '6. High-Risk Pregnancy Register',
    description: 'Flagged for severe hypertension (BP >= 140/90), danger signs, age <18 / >35, or grand multipara.',
    category: 'Clinical Safety',
    badgeType: 'badge-critical'
  },
  {
    key: 'OVERDUE_PREGNANCIES',
    title: '7. Overdue Pregnancies (42w & 43w)',
    description: 'Cohort tracking for 42-week post-term warning and 43-week mandatory authorized clinical review.',
    category: 'Clinical Safety',
    badgeType: 'badge-critical'
  },
  {
    key: 'PREGNANCY_OUTCOME',
    title: '8. Pregnancy Deliveries & Outcomes',
    description: 'Closed pregnancy episodes, delivery modes, birth weights, maternal and neonatal outcomes.',
    category: 'Outcomes & Labs',
    badgeType: 'badge-normal'
  },
  {
    key: 'LAB_COMPLETION',
    title: '9. Lab & Investigation Status',
    description: 'Tracking status of routine antenatal investigations (Blood Group, Hb, HIV, RPR, Urinalysis).',
    category: 'Outcomes & Labs',
    badgeType: 'badge-info'
  },
  {
    key: 'PMTCT_HIV',
    title: '10. PMTCT / HIV Maternal Care',
    description: 'Confidential PMTCT metrics, maternal testing, partner testing, ART linkage, and CD4 tracking.',
    category: 'Outcomes & Labs',
    badgeType: 'badge-warning'
  },
  {
    key: 'CLINICIAN_WORKLOAD',
    title: '11. Clinician Productivity',
    description: 'Distribution of active registrations, encounters conducted, and deliveries recorded per doctor.',
    category: 'Management',
    badgeType: 'badge-info'
  },
  {
    key: 'CONTINUITY_COHORT',
    title: '12. ANC Continuity (4-Visit Cohort)',
    description: 'WHO/MOH quality metric evaluating completion rates from ANC 1 through ANC 4+ contacts.',
    category: 'Management',
    badgeType: 'badge-normal'
  }
];

export const AncReportsView: React.FC<AncReportsViewProps> = ({
  onBackToDashboard,
  onOpenPatientWorkspace
}) => {
  const [selectedReportKey, setSelectedReportKey] = useState<string>('ACTIVE_REGISTER');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<AncReportResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Patient ANC Longitudinal Record Modal State
  const [isPatientRecordModalOpen, setIsPatientRecordModalOpen] = useState<boolean>(false);
  const [isLoadingRecord, setIsLoadingRecord] = useState<boolean>(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [patientRecordData, setPatientRecordData] = useState<{
    patientCheck: AncPatientCheckDto;
    episodes: AncWorkspaceDetailDto[];
  } | null>(null);

  // Referral Summary Generator Modal
  const [isReferralModalOpen, setIsReferralModalOpen] = useState<boolean>(false);
  const [referralFormData, setReferralFormData] = useState({
    patientName: 'HANA W/MARIYAM',
    mrn: 'HD-270606',
    age: 28,
    gravidity: 2,
    parity: 1,
    bloodGroup: 'O Positive',
    gestationalAge: '32 weeks + 4 days',
    trimester: 'Third Trimester',
    edd: '2027-01-03',
    datingMethod: 'LMP (03/28/2026)',
    bp: '120/78 mmHg',
    pulse: '76 bpm',
    weight: '64.5 kg',
    fundalHeight: '32.0 cm',
    fhr: '142 bpm',
    fetalPresentation: 'Cephalic',
    dangerSigns: 'None reported at current encounter',
    labSummary: 'Blood Group O+, Hb 12.1 g/dL, RPR Non-Reactive, HIV Non-Reactive, Urine Protein Negative',
    medications: 'Iron/Folate 60mg/400mcg daily, Tetanus Toxoid completed',
    referralReason: 'Routine Third Trimester Consultation & Advanced Biophysical Profile Scan',
    clinicalNotes: 'Patient clinically stable. Fetal growth concordant with established dates. Pelvic evaluation scheduled.',
    referringDoctor: 'Dr. Sarah Al-Mansoor, MD (Consultant Obstetrician)',
    destinationFacility: 'Tertiary Specialized Maternity Hospital'
  });

  const loadReport = async (reportKey: string = selectedReportKey) => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        reportType: reportKey,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        searchTerm: searchTerm.trim() ? searchTerm.trim() : null
      };

      const res = await api.post<AncReportResultDto>('/anc/reports', payload);
      setReportData(res);
    } catch (err: any) {
      console.error('Failed to load report:', err);
      setError(err?.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(selectedReportKey);
  }, [selectedReportKey]);

  // Export report table as CSV
  const handleExportCsv = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) return;

    const headers = reportData.headers.join(',');
    const rows = reportData.rows.map(row => {
      return reportData.headers.map(h => {
        const val = row[h] !== null && row[h] !== undefined ? String(row[h]).replace(/"/g, '""') : '';
        return `"${val}"`;
      }).join(',');
    }).join('\n');

    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedReportKey}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter rows locally by search input
  const filteredRows = reportData?.rows?.filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(r).some(val => val && String(val).toLowerCase().includes(term));
  }) || [];

  const currentReportMeta = REPORT_OPTIONS.find(r => r.key === selectedReportKey) || REPORT_OPTIONS[0];

  // =========================================================================
  // VIEW ACTION: LOAD & DISPLAY PATIENT'S COMPLETE ANC RECORD GROUPED BY
  // 1. ANC REGISTRATION ID (EPISODE)
  // 2. EPISODES OR FOLLOW-UP VISITS
  // =========================================================================
  const handleViewPatientRecord = async (row: Record<string, any>) => {
    setIsPatientRecordModalOpen(true);
    setIsLoadingRecord(true);
    setRecordError(null);
    setPatientRecordData(null);

    try {
      let patientId: number | null = row['PatientId'] ? Number(row['PatientId']) : null;

      // If patientId not directly on row, resolve via MRN
      if (!patientId) {
        const mrn = row['Patient MRN'] || row['MRN'];
        if (mrn) {
          const res: any = await api.get('/patients/search', { q: mrn, limit: 10 });
          const list = Array.isArray(res) ? res : (res?.data || res?.Data || []);
          const match = list.find((p: any) => p.mrn === mrn || String(p.mrn).includes(mrn) || mrn.includes(String(p.mrn)));
          if (match) {
            patientId = match.id;
          }
        }
      }

      if (!patientId) {
        throw new Error('Unable to identify patient identifier for this record.');
      }

      // 1. Fetch patient demographic & pregnancy status check
      const checkRes = await api.get<AncPatientCheckDto>(`/anc/patient-check/${patientId}`);

      // 2. Collect all episodes (both active and historical)
      const allEpSummaries: AncEpisodeSummaryDto[] = [
        ...(checkRes.activeEpisode ? [checkRes.activeEpisode] : []),
        ...(checkRes.historicalEpisodes || [])
      ];

      // Remove duplicate episode IDs if any
      const uniqueEpisodes = Array.from(new Map(allEpSummaries.map(ep => [ep.id, ep])).values());

      // 3. For each episode, fetch its complete clinical workspace detail (encounters, ultrasounds, labs, outcome)
      const episodeDetails: AncWorkspaceDetailDto[] = await Promise.all(
        uniqueEpisodes.map(ep => api.get<AncWorkspaceDetailDto>(`/anc/episodes/${ep.id}`))
      );

      // Sort episodes by registration date descending (latest first)
      episodeDetails.sort((a, b) => new Date(b.episode.registrationDate).getTime() - new Date(a.episode.registrationDate).getTime());

      setPatientRecordData({
        patientCheck: checkRes,
        episodes: episodeDetails
      });
    } catch (err: any) {
      console.error('Failed to load patient ANC record:', err);
      setRecordError(err?.message || 'Failed to retrieve ANC clinical record for this patient.');
    } finally {
      setIsLoadingRecord(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              Antenatal Clinical Intelligence
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• 12 Standard Clinical Reports</span>
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} style={{ color: '#0071e3' }} />
            ANC Clinical & Operational Reports
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time pregnancy registers, clinical safety thresholds, continuity of care cohorts, and patient ANC records.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsReferralModalOpen(true)}
            className="btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            <Printer size={14} style={{ color: '#0071e3' }} />
            Print Referral Letter
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!reportData || filteredRows.length === 0}
            className="btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={() => loadReport(selectedReportKey)}
            disabled={loading}
            className="btn-primary"
            style={{ fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* 12 Report Selector Grid (Apple Card Grid) */}
      <div className="glass-panel" style={{ padding: '18px 22px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Select Clinical Report:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {REPORT_OPTIONS.map((opt) => {
            const isSelected = selectedReportKey === opt.key;
            return (
              <div
                key={opt.key}
                onClick={() => setSelectedReportKey(opt.key)}
                style={{
                  background: isSelected ? 'rgba(0, 113, 227, 0.05)' : '#ffffff',
                  border: isSelected ? '2px solid #0071e3' : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(0, 113, 227, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#b0b0b8';
                    e.currentTarget.style.background = '#fbfbfd';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = '#ffffff';
                  }
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.825rem', color: isSelected ? '#0071e3' : 'var(--text-main)' }}>
                      {opt.title}
                    </span>
                    <span className={`badge ${opt.badgeType}`} style={{ fontSize: '0.65rem' }}>
                      {opt.category}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {opt.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '360px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by MRN, patient name, doctor..."
              style={{ paddingLeft: '32px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.75rem' }}
            />
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.75rem' }}
            />
            <button onClick={() => loadReport(selectedReportKey)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              Apply Dates
            </button>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Showing <strong style={{ color: 'var(--text-main)' }}>{filteredRows.length}</strong> records
          {reportData?.generatedAt && (
            <span style={{ marginLeft: '8px' }}>
              ({new Date(reportData.generatedAt).toLocaleTimeString()})
            </span>
          )}
        </div>
      </div>

      {/* Summary KPI Stat Cards */}
      {reportData?.summaryMetrics && Object.keys(reportData.summaryMetrics).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {Object.entries(reportData.summaryMetrics).map(([metricKey, metricValue]) => (
            <div key={metricKey} className="glass-panel" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {metricKey}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                {String(metricValue)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Report Table Card */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
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
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
              {reportData?.reportTitle || currentReportMeta.title}
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {currentReportMeta.description}
            </p>
          </div>
          <button onClick={() => window.print()} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.75rem' }}>
            <Printer size={13} /> Print Table
          </button>
        </div>

        {error && (
          <div style={{ margin: '16px', padding: '12px 16px', borderRadius: '8px', background: '#fdf2f2', border: '1px solid #f8b4b4', color: '#c81e1e', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', color: '#0071e3' }} />
            Generating clinical report...
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            <FileText size={32} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
            <p style={{ fontWeight: 600, margin: '0 0 4px 0', color: 'var(--text-main)' }}>No records found</p>
            <p style={{ margin: 0 }}>Try clearing the search query or date range filters.</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ margin: 0 }}>
            <table className="cms-table">
              <thead>
                <tr>
                  {reportData?.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                  {/* Action Column for patient records */}
                  {filteredRows.some(r => r['Patient MRN'] || r['MRN'] || r['Patient Name']) && (
                    <th style={{ textAlign: 'right', minWidth: '150px' }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const hasPatientData = Boolean(row['Patient MRN'] || row['MRN'] || row['Patient Name']);

                  return (
                    <tr key={idx}>
                      {reportData?.headers.map((h) => {
                        const val = row[h];
                        const strVal = val !== null && val !== undefined ? String(val) : '-';

                        const isHighRisk = strVal.includes('High') || strVal.includes('Overdue') || strVal.includes('YES (Abnormal)') || strVal.includes('Reactive');
                        const isWarning = strVal.includes('Warning') || strVal.includes('Pending');
                        const isSuccess = strVal.includes('Finalized') || strVal.includes('Completed') || strVal.includes('Live') || strVal.includes('Active');

                        return (
                          <td key={h}>
                            {isHighRisk ? (
                              <span className="badge badge-critical">{strVal}</span>
                            ) : isWarning ? (
                              <span className="badge badge-warning">{strVal}</span>
                            ) : isSuccess && (h === 'Status' || h === 'Classification') ? (
                              <span className="badge badge-normal">{strVal}</span>
                            ) : (
                              <span style={{ fontFamily: h.includes('MRN') || h.includes('#') ? 'monospace' : 'inherit', fontWeight: h.includes('MRN') ? 600 : 'normal' }}>
                                {strVal}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* ACTION BUTTONS: VIEW ANC RECORD + REFERRAL NOTE */}
                      {filteredRows.some(r => r['Patient MRN'] || r['MRN'] || r['Patient Name']) && (
                        <td style={{ textAlign: 'right' }}>
                          {hasPatientData ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => handleViewPatientRecord(row)}
                                className="btn-primary"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '0.72rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#0071e3',
                                  fontWeight: 600
                                }}
                                title="View Patient ANC Record grouped by Registration ID and Follow-up Visits"
                              >
                                <Eye size={12} /> View
                              </button>
                              <button
                                onClick={() => {
                                  setReferralFormData(prev => ({
                                    ...prev,
                                    patientName: row['Patient Name'] || row['Mother Name'] || prev.patientName,
                                    mrn: row['Patient MRN'] || row['MRN'] || prev.mrn,
                                    gestationalAge: row['Gestational Age'] || row['GA'] || prev.gestationalAge,
                                    edd: row['Established EDD'] || row['EDD'] || prev.edd,
                                    bp: row['Latest BP'] || row['BP'] || prev.bp,
                                    referringDoctor: row['Doctor'] || prev.referringDoctor
                                  }));
                                  setIsReferralModalOpen(true);
                                }}
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                title="Print Referral Letter"
                              >
                                Referral
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PATIENT ANC RECORD MODAL (GROUPED BY 1. REGISTRATION ID & 2. VISITS)      */}
      {/* ========================================================================= */}
      {isPatientRecordModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPatientRecordModalOpen(false);
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '980px',
              maxWidth: '96vw',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 30px 70px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              padding: 0,
              borderRadius: '16px'
            }}
          >
            {/* Modal Header Control Bar */}
            <div
              className="no-print"
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fbfbfd'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0071e3 0%, #30b0c7 100%)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800
                  }}
                >
                  <Baby size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    Patient Antenatal Care (ANC) Clinical Record
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Complete longitudinal history grouped by Pregnancy Registration ID and Follow-up Visits.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => window.print()}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  <Printer size={13} /> Print Record
                </button>
                <button
                  onClick={() => setIsPatientRecordModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '4px 8px'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isLoadingRecord ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#0071e3' }} />
                  Loading patient's ANC pregnancy episodes and encounter records...
                </div>
              ) : recordError ? (
                <div style={{ padding: '16px', borderRadius: '8px', background: '#fdf2f2', border: '1px solid #f8b4b4', color: '#c81e1e', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} />
                  <span>{recordError}</span>
                </div>
              ) : patientRecordData ? (
                <>
                  {/* Patient Demographic Summary Bar */}
                  <div
                    style={{
                      padding: '16px 20px',
                      background: 'rgba(0, 113, 227, 0.04)',
                      border: '1px solid rgba(0, 113, 227, 0.2)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '14px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {patientRecordData.patientCheck.fullName}
                        </span>
                        <span style={{ fontSize: '0.72rem', background: '#0071e3', color: '#ffffff', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          MRN: {patientRecordData.patientCheck.mrn}
                        </span>
                        {patientRecordData.patientCheck.bloodGroup && (
                          <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            Blood: {patientRecordData.patientCheck.bloodGroup}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            background: patientRecordData.patientCheck.hasActivePregnancy ? '#dcfce7' : '#f1f5f9',
                            color: patientRecordData.patientCheck.hasActivePregnancy ? '#15803d' : '#64748b'
                          }}
                        >
                          {patientRecordData.patientCheck.hasActivePregnancy ? 'Active Pregnancy' : 'No Active Pregnancy'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Age: <strong>{patientRecordData.patientCheck.ageYears} yrs</strong> • Phone: <strong>{patientRecordData.patientCheck.primaryPhone || 'N/A'}</strong> • Address: <strong>{patientRecordData.patientCheck.address || 'N/A'}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                        Total Pregnancy Registrations
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0071e3' }}>
                        {patientRecordData.episodes.length} Episodes
                      </div>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* GROUP 1: GROUPED BY ANC REGISTRATION ID (EPISODE #)                      */}
                  {/* ========================================================================= */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    {patientRecordData.episodes.map((epDetail, epIdx) => {
                      const ep = epDetail.episode;
                      const isActive = ep.status === 'Active';

                      return (
                        <div
                          key={ep.id}
                          style={{
                            border: isActive ? '2px solid #0071e3' : '1px solid var(--border-color)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: '#ffffff',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                          }}
                        >
                          {/* 1. ANC REGISTRATION HEADER */}
                          <div
                            style={{
                              padding: '14px 18px',
                              background: isActive ? 'rgba(0, 113, 227, 0.05)' : '#f8fafc',
                              borderBottom: '1px solid var(--border-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Baby size={20} color={isActive ? '#0071e3' : '#64748b'} />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-main)' }}>
                                    ANC Registration ID: {ep.episodeNumber}
                                  </span>
                                  <span
                                    className={`badge ${isActive ? 'badge-normal' : 'badge-info'}`}
                                    style={{ fontSize: '0.68rem' }}
                                  >
                                    {ep.status}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', background: 'rgba(0, 113, 227, 0.1)', color: '#0071e3', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                    {ep.gestationalAgeFormatted}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  Registered on: <strong>{new Date(ep.registrationDate).toLocaleDateString()}</strong> • Gravidity: <strong>G{ep.gravidity}</strong>, Parity: <strong>P{ep.parity}</strong> • Approved Dating: <strong>{ep.approvedDatingMethod}</strong>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setIsPatientRecordModalOpen(false);
                                onOpenPatientWorkspace?.(patientRecordData.patientCheck.patientId);
                              }}
                              className="btn-secondary"
                              style={{ padding: '5px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <ExternalLink size={13} style={{ color: '#0071e3' }} />
                              Open in Clinical Workspace
                            </button>
                          </div>

                          {/* FILLED REGISTRATION BASELINE PARAMETERS */}
                          <div style={{ padding: '16px 18px', background: '#fbfbfd', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={15} color="#0071e3" />
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                  Filled Registration Parameters:
                                </span>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Baseline recorded on {new Date(ep.registrationDate).toLocaleDateString()}
                              </span>
                            </div>

                            {/* 1. Obstetric Score & Core Dating (Grid of Filled Values) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.78rem' }}>
                              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem', fontWeight: 700 }}>OBSTETRIC SCORE (G/P)</span>
                                <strong style={{ fontSize: '0.9rem', color: '#0071e3' }}>Gravida {ep.gravidity}, Para {ep.parity}</strong>
                                {epDetail.initialAssessment && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {[
                                      epDetail.initialAssessment.abortions > 0 ? `Abortions: ${epDetail.initialAssessment.abortions}` : null,
                                      epDetail.initialAssessment.livingChildren > 0 ? `Living: ${epDetail.initialAssessment.livingChildren}` : null,
                                      epDetail.initialAssessment.ectopicPregnancies > 0 ? `Ectopic: ${epDetail.initialAssessment.ectopicPregnancies}` : null,
                                      epDetail.initialAssessment.molarPregnancies > 0 ? `Molar: ${epDetail.initialAssessment.molarPregnancies}` : null
                                    ].filter(Boolean).join(' • ') || 'No reported pregnancy loss'}
                                  </div>
                                )}
                              </div>

                              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem', fontWeight: 700 }}>LAST MENSTRUAL PERIOD (LMP)</span>
                                <strong>{ep.lmpDate ? new Date(ep.lmpDate).toLocaleDateString() : 'N/A / Unknown'}</strong>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  Cycle: <strong>{ep.isCycleRegular ? 'Regular (28-30d)' : 'Irregular'}</strong>
                                </div>
                              </div>

                              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem', fontWeight: 700 }}>ESTABLISHED EDD & DATING</span>
                                <strong style={{ color: '#0071e3', fontSize: '0.88rem' }}>{new Date(ep.establishedEdd).toLocaleDateString()}</strong>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  Source: <strong>{ep.approvedDatingMethod}</strong>
                                </div>
                              </div>

                              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem', fontWeight: 700 }}>GESTATIONAL AGE & VISITS</span>
                                <strong>{ep.gestationalAgeFormatted}</strong>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                                  ({ep.trimesterFormatted})
                                </span>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  Completed Visits: <strong>{epDetail.encounters.length}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Additional Filled Dating Benchmarks */}
                            {(ep.eddLmp || ep.eddUltrasound || ep.initialUltrasoundDate) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.74rem', background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px' }}>
                                {ep.eddLmp && <div>EDD by LMP: <strong>{new Date(ep.eddLmp).toLocaleDateString()}</strong></div>}
                                {ep.eddUltrasound && <div>• EDD by Ultrasound: <strong>{new Date(ep.eddUltrasound).toLocaleDateString()}</strong></div>}
                                {ep.initialUltrasoundDate && <div>• Dating Scan: <strong>{new Date(ep.initialUltrasoundDate).toLocaleDateString()}</strong></div>}
                              </div>
                            )}

                            {/* Clinical Alerts / High Risk Banner if Flagged */}
                            {ep.clinicalAlerts && ep.clinicalAlerts.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {ep.clinicalAlerts.map((alert, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      padding: '8px 12px',
                                      background: alert.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                                      border: alert.severity === 'critical' ? '1px solid #fecaca' : '1px solid #fef3c7',
                                      borderRadius: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      fontSize: '0.75rem',
                                      color: alert.severity === 'critical' ? '#dc2626' : '#b45309'
                                    }}
                                  >
                                    <AlertTriangle size={14} color={alert.severity === 'critical' ? '#dc2626' : '#b45309'} />
                                    <span><strong>{alert.title}:</strong> {alert.message}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* 2. Baseline Medical & Surgical Risks (Show only if filled / positive) */}
                            {(() => {
                              const med = epDetail.initialAssessment?.medicalHistory;
                              const filledRisks: { name: string; remarks?: string }[] = [];
                              if (med) {
                                if (med.hypertension?.status === 'Yes') filledRisks.push({ name: 'Chronic Hypertension', remarks: med.hypertension.remarks });
                                if (med.diabetes?.status === 'Yes') filledRisks.push({ name: 'Pre-existing Diabetes', remarks: med.diabetes.remarks });
                                if (med.renalDisease?.status === 'Yes') filledRisks.push({ name: 'Renal Disease', remarks: med.renalDisease.remarks });
                                if (med.tuberculosis?.status === 'Yes') filledRisks.push({ name: 'Tuberculosis (TB)', remarks: med.tuberculosis.remarks });
                                if (med.drugAllergy?.status === 'Yes') filledRisks.push({ name: 'Drug Allergy', remarks: med.drugAllergy.remarks });
                                if (med.pastSurgicalHistory?.status === 'Yes') filledRisks.push({ name: 'Past Surgeries / C-Section', remarks: med.pastSurgicalHistory.remarks });
                              }

                              if (filledRisks.length === 0) return null;

                              return (
                                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '8px 12px' }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: '4px' }}>
                                    RECORDED BASELINE MEDICAL / SURGICAL RISKS:
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {filledRisks.map((r, i) => (
                                      <span key={i} className="badge badge-warning" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                        <strong>{r.name}</strong>{r.remarks ? `: ${r.remarks}` : ''}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* 3. Baseline Vitals & Anthropometrics (Show only if filled) */}
                            {(() => {
                              const v = epDetail.initialAssessment?.baselineVitals;
                              if (!v || (!v.systolicBp && !v.weight && !v.height && !v.muac)) return null;

                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.75rem', background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Baseline Intake Vitals:</span>
                                  {v.systolicBp && <span>BP: <strong>{v.systolicBp}/{v.diastolicBp} mmHg</strong></span>}
                                  {v.weight && <span>Weight: <strong>{v.weight} kg</strong></span>}
                                  {v.height && <span>Height: <strong>{v.height} cm</strong></span>}
                                  {v.muac && <span>MUAC: <strong>{v.muac} cm</strong></span>}
                                  {v.pulseRate && <span>Pulse: <strong>{v.pulseRate} bpm</strong></span>}
                                </div>
                              );
                            })()}

                            {/* 4. Past Pregnancy & Delivery History Table (Show only if filled) */}
                            {epDetail.previousPregnancies && epDetail.previousPregnancies.length > 0 && (
                              <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '10px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                  <Baby size={14} color="#0071e3" />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                    Prior Deliveries Recorded at Registration ({epDetail.previousPregnancies.length}):
                                  </span>
                                </div>
                                <div className="table-responsive" style={{ margin: 0 }}>
                                  <table className="cms-table" style={{ fontSize: '0.72rem' }}>
                                    <thead>
                                      <tr>
                                        <th>Pregnancy #</th>
                                        <th>Birth Year</th>
                                        <th>GA</th>
                                        <th>Delivery Place</th>
                                        <th>Mode of Delivery</th>
                                        <th>Outcome</th>
                                        <th>Birth Weight</th>
                                        <th>Remarks</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {epDetail.previousPregnancies.map((p, idx) => (
                                        <tr key={p.id || idx}>
                                          <td><strong>#{p.pregnancyNumber || idx + 1}</strong></td>
                                          <td>{p.birthYear || (p.dateOfBirth ? new Date(p.dateOfBirth).getFullYear() : '-')}</td>
                                          <td>{p.gestationalAgeWeeks ? `${p.gestationalAgeWeeks}w` : '-'}</td>
                                          <td>{p.deliveryPlace || '-'}</td>
                                          <td><strong>{p.modeOfDelivery || '-'}</strong></td>
                                          <td>
                                            <span className={`badge ${p.deliveryOutcome === 'Live Birth' ? 'badge-normal' : 'badge-warning'}`} style={{ fontSize: '0.68rem' }}>
                                              {p.deliveryOutcome || 'Live Birth'}
                                            </span>
                                          </td>
                                          <td>{p.birthWeightGrams ? `${p.birthWeightGrams} g` : '-'}</td>
                                          <td>{p.complications || p.remarks || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Delivery Outcome Banner (If Episode Closed) */}
                          {epDetail.outcome && (
                            <div style={{ padding: '12px 18px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#166534' }}>
                              <CheckCircle2 size={16} color="#16a34a" />
                              <span>
                                <strong>Delivery Outcome:</strong> Delivered on <strong>{new Date(epDetail.outcome.deliveryDate).toLocaleDateString()}</strong> ({epDetail.outcome.modeOfDelivery}) at {epDetail.outcome.deliveryPlace}. Outcome: <strong>{epDetail.outcome.pregnancyOutcomeType}</strong>. Baby: <strong>{epDetail.outcome.baby1Sex || 'Newborn'}</strong>, Birth Weight: <strong>{epDetail.outcome.baby1WeightGrams} g</strong>, APGAR: <strong>{epDetail.outcome.baby1Apgar1 ?? 'N/A'}/{epDetail.outcome.baby1Apgar5 ?? 'N/A'}</strong>. Attending: {epDetail.outcome.closingClinicianName || 'Staff'}.
                              </span>
                            </div>
                          )}

                          {/* ========================================================================= */}
                          {/* GROUP 2: EPISODES OR FOLLOW-UP VISITS (UNDER THIS REGISTRATION ID)       */}
                          {/* ========================================================================= */}
                          <div style={{ padding: '16px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                              <HeartPulse size={16} color="#0071e3" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                Follow-up Encounters & Visits ({epDetail.encounters.length}):
                              </span>
                            </div>

                            {epDetail.encounters.length === 0 ? (
                              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                Initial registration documented; no subsequent follow-up visits recorded under this registration ID.
                              </div>
                            ) : (
                              <div className="table-responsive" style={{ margin: 0 }}>
                                <table className="cms-table">
                                  <thead>
                                    <tr>
                                      <th>Visit #</th>
                                      <th>Encounter Date</th>
                                      <th>Gestational Age</th>
                                      <th>Weight</th>
                                      <th>Blood Pressure</th>
                                      <th>Fundal Ht</th>
                                      <th>FHR</th>
                                      <th>Danger Signs</th>
                                      <th>Clinical Assessment / SOAP Plan</th>
                                      <th>Attending Doctor</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {epDetail.encounters.map(enc => (
                                      <tr key={enc.id}>
                                        <td>
                                          <strong style={{ fontFamily: 'monospace' }}>#{enc.encounterNumber}</strong>
                                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{enc.visitCode}</div>
                                        </td>
                                        <td>{new Date(enc.encounterDate).toLocaleDateString()}</td>
                                        <td>
                                          <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                            {enc.gestationalAgeFormatted}
                                          </span>
                                        </td>
                                        <td>{enc.weight ? `${enc.weight} kg` : '-'}</td>
                                        <td>
                                          <strong>{enc.systolicBp ? `${enc.systolicBp}/${enc.diastolicBp}` : '-'}</strong>
                                        </td>
                                        <td>{enc.fundalHeight ? `${enc.fundalHeight} cm` : '-'}</td>
                                        <td>{enc.fetalHeartRate ? `${enc.fetalHeartRate} bpm` : '-'}</td>
                                        <td>
                                          {enc.dangerSigns && enc.dangerSigns.length > 0 ? (
                                            <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
                                              {enc.dangerSigns.join(', ')}
                                            </span>
                                          ) : (
                                            <span style={{ fontSize: '0.72rem', color: '#16a34a' }}>None</span>
                                          )}
                                        </td>
                                        <td style={{ maxWidth: '240px', fontSize: '0.75rem', lineHeight: 1.35 }}>
                                          {enc.assessment && <div><strong>Assessment:</strong> {enc.assessment}</div>}
                                          {enc.plan && <div style={{ color: 'var(--text-secondary)' }}><strong>Plan:</strong> {enc.plan}</div>}
                                          {!enc.assessment && !enc.plan && <span>{enc.clinicalNotes || '-'}</span>}
                                        </td>
                                        <td>{enc.attendingDoctorName}</td>
                                        <td>
                                          <span className={`badge ${enc.isDraft ? 'badge-warning' : 'badge-normal'}`} style={{ fontSize: '0.68rem' }}>
                                            {enc.isDraft ? 'Draft' : 'Finalized'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Ultrasounds & Labs recorded under this Registration */}
                            {(epDetail.ultrasounds.length > 0 || epDetail.labExaminations.length > 0) && (
                              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                                {/* Ultrasounds */}
                                {epDetail.ultrasounds.length > 0 && (
                                  <div style={{ background: '#fbfbfd', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0071e3', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Activity size={13} /> Biometric Ultrasounds ({epDetail.ultrasounds.length}):
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}>
                                      {epDetail.ultrasounds.map(u => (
                                        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>{new Date(u.ultrasoundDate).toLocaleDateString()} (GA: {u.gestationalAgeFormatted}):</span>
                                          <strong>{u.presentation || 'Cephalic'} • {u.placentalLocation || 'Fundal'}</strong>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Labs */}
                                {epDetail.labExaminations.length > 0 && (
                                  <div style={{ background: '#fbfbfd', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0071e3', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <FlaskConical size={13} /> Laboratory Investigations ({epDetail.labExaminations.length}):
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.72rem' }}>
                                      {epDetail.labExaminations.map(l => (
                                        <span key={l.id} style={{ padding: '2px 8px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                                          {l.testType}: <strong>{l.resultValue} {l.unit}</strong>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div
              className="no-print"
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fbfbfd'
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Showing patient's complete ANC longitudinal clinical history grouped by Registration ID.
              </span>
              <button
                onClick={() => setIsPatientRecordModalOpen(false)}
                className="btn-primary"
                style={{ padding: '6px 16px', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL PRINTABLE REFERRAL SUMMARY MODAL (Centered Apple HIG Dialog) */}
      {isReferralModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsReferralModalOpen(false);
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '840px',
              maxWidth: '96vw',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 30px 70px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              padding: 0
            }}
          >
            {/* Modal Top Control Bar (Hidden when printing) */}
            <div
              className="no-print"
              style={{
                padding: '14px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fbfbfd'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={16} style={{ color: '#0071e3' }} />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                  Antenatal Care Clinical Referral Document
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => window.print()}
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                >
                  <Printer size={14} /> Print A4 Document
                </button>
                <button
                  onClick={() => setIsReferralModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Official Hospital Document Layout (Rendered for Screen and Print) */}
            <div style={{ padding: '36px 40px', color: '#1d1d1f', fontSize: '0.825rem', lineHeight: 1.5 }}>
              {/* Document Letterhead */}
              <div style={{ textAlign: 'center', paddingBottom: '18px', borderBottom: '2px solid #1d1d1f', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, color: '#1d1d1f' }}>
                  HUDERMA MATERNITY & CLINICAL HEALTHCARE CENTER
                </h1>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Department of Obstetrics & Gynecology • Antenatal Care Unit
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#777' }}>
                  124 Healthcare Boulevard • Tel: +251 11 654 3210 • Accredited Clinical Services
                </p>
                <div style={{ marginTop: '12px', display: 'inline-block', padding: '4px 16px', background: '#f5f5f7', border: '1px solid #d2d2d7', borderRadius: '20px', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Official Antenatal Consultation & Referral Note
                </div>
              </div>

              {/* Document Metadata Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px', fontSize: '0.78rem' }}>
                <div>Date of Referral: <strong>{new Date().toLocaleDateString()}</strong></div>
                <div>Destination Facility: <strong>{referralFormData.destinationFacility}</strong></div>
                <div>Referring Clinician: <strong>{referralFormData.referringDoctor}</strong></div>
              </div>

              {/* Patient Profile */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px 0', borderBottom: '1px solid #e5e5ea', paddingBottom: '4px' }}>
                  1. Maternal Demographics & Obstetric Parity
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#ffffff', padding: '8px 12px', border: '1px solid #e5e5ea', borderRadius: '6px' }}>
                  <div>Patient Full Name: <strong>{referralFormData.patientName}</strong></div>
                  <div>Hospital MRN: <strong>{referralFormData.mrn}</strong></div>
                  <div>Maternal Age: <strong>{referralFormData.age} yrs</strong></div>
                  <div>Gravida / Para: <strong>G{referralFormData.gravidity} P{referralFormData.parity}</strong></div>
                  <div>Blood Group: <strong>{referralFormData.bloodGroup}</strong></div>
                  <div>Clinical Status: <strong style={{ color: '#16a34a' }}>Active Supervision</strong></div>
                </div>
              </div>

              {/* Pregnancy Dating & Current Gestational Age */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px 0', borderBottom: '1px solid #e5e5ea', paddingBottom: '4px' }}>
                  2. Pregnancy Dating & Gestational Assessment
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#ffffff', padding: '8px 12px', border: '1px solid #e5e5ea', borderRadius: '6px' }}>
                  <div>Current Gestational Age: <strong>{referralFormData.gestationalAge}</strong></div>
                  <div>Trimester: <strong>{referralFormData.trimester}</strong></div>
                  <div>Established EDD: <strong>{referralFormData.edd}</strong></div>
                  <div>Dating Source: <strong>{referralFormData.datingMethod}</strong></div>
                  <div>Fetal Presentation: <strong>{referralFormData.fetalPresentation}</strong></div>
                  <div>Fetal Heart Rate: <strong>{referralFormData.fhr}</strong></div>
                </div>
              </div>

              {/* Clinical Referral Reason */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px 0', borderBottom: '1px solid #e5e5ea', paddingBottom: '4px' }}>
                  3. Reason for Referral & Clinical Findings
                </h4>
                <div style={{ background: '#f8fafc', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#0071e3' }}>
                    Indication: {referralFormData.referralReason}
                  </p>
                  <p style={{ margin: 0, color: '#333' }}>
                    {referralFormData.clinicalNotes}
                  </p>
                </div>
              </div>

              {/* Signatures */}
              <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #d2d2d7', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ borderBottom: '1px solid #333', width: '220px', height: '36px' }} />
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', fontWeight: 700 }}>
                    Attending Obstetrician Signature
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ borderBottom: '1px solid #333', width: '180px', height: '36px' }} />
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', fontWeight: 700 }}>
                    Official Hospital Clinical Stamp
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AncReportsView;
