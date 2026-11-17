import React, { useState } from 'react';
import {
  Baby, AlertTriangle, ShieldAlert, Calendar, Clock, HeartPulse,
  TrendingUp, Users, CheckCircle2, ChevronRight, Search,
  FileText, Activity, Sparkles, Filter
} from 'lucide-react';
import { AncDashboardDto, AncEpisodeSummaryDto } from './ancTypes';

interface AncDashboardViewProps {
  dashboard: AncDashboardDto | null;
  loading: boolean;
  onSelectPatient: (patientId: number, episodeId?: number) => void;
  onOpenNewRegistration: () => void;
  onOpenReports?: () => void;
}

export default function AncDashboardView({
  dashboard,
  loading,
  onSelectPatient,
  onOpenNewRegistration,
  onOpenReports
}: AncDashboardViewProps) {
  const [filterTrimester, setFilterTrimester] = useState<number | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OVERDUE' | 'HIGH_RISK'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  if (loading || !dashboard) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #0071e3', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading ANC clinical intelligence dashboard...</p>
      </div>
    );
  }

  // Filter episodes
  const filteredEpisodes = dashboard.activePregnanciesList.filter(ep => {
    if (filterTrimester !== 'ALL' && ep.currentTrimester !== filterTrimester) return false;
    if (filterStatus === 'OVERDUE' && !ep.isOverdueWarning && !ep.requiresOverdueReview) return false;
    if (filterStatus === 'HIGH_RISK' && !ep.clinicalAlerts.some(a => a.severity === 'critical')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = ep.episodeNumber.toLowerCase().includes(q);
      return matchNum;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Banner & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #0071e3 0%, #30b0c7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(0, 113, 227, 0.25)' }}>
              <Baby size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Antenatal Care (ANC) Management
              </h2>
              <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Longitudinal pregnancy lifecycle, clinical intelligence, and follow-up worklist
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Overdue & Clinical Alert Banners */}
      {(dashboard.requiringReview43wCount > 0 || dashboard.overdueWarning42wCount > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {dashboard.requiringReview43wCount > 0 && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.9rem' }}>
                    43-Week Review Threshold Flagged ({dashboard.requiringReview43wCount} {dashboard.requiringReview43wCount === 1 ? 'Patient' : 'Patients'})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                    Pregnancy has reached or exceeded 43 completed gestational weeks. Hospital policy requires authorized clinical review and closure.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilterStatus('OVERDUE')}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                Inspect Patients
              </button>
            </div>
          )}

          {dashboard.overdueWarning42wCount > 0 && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 6px rgba(217, 119, 6, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.875rem' }}>
                    Overdue Pregnancy Warning: 42 Completed Weeks ({dashboard.overdueWarning42wCount} {dashboard.overdueWarning42wCount === 1 ? 'Patient' : 'Patients'})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#b45309' }}>
                    Patient is post-term. Heightened fetal surveillance, biophysical profile, and induction planning indicated.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilterStatus('OVERDUE')}
                style={{
                  background: '#d97706',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                View
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        {/* Card 1: Total Active */}
        <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0, 113, 227, 0.1)', color: '#0071e3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Baby size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Pregnancies
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.15 }}>
              {dashboard.totalActivePregnancies}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '3px', fontWeight: 500 }}>
              +{dashboard.newRegistrationsThisMonth} registered this month
            </div>
          </div>
        </div>

        {/* Card 2: Follow-ups Today */}
        <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(52, 199, 89, 0.1)', color: '#34c759', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HeartPulse size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Follow-ups Today
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.15 }}>
              {dashboard.followUpVisitsToday}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Documented encounters
            </div>
          </div>
        </div>

        {/* Card 3: Upcoming Appointments */}
        <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(88, 86, 214, 0.1)', color: '#5856d6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Upcoming Visits
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.15 }}>
              {dashboard.upcomingAppointmentsCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: dashboard.overdueAppointmentsCount > 0 ? '#dc2626' : 'var(--text-secondary)', marginTop: '3px', fontWeight: dashboard.overdueAppointmentsCount > 0 ? 600 : 400 }}>
              {dashboard.overdueAppointmentsCount > 0 ? `${dashboard.overdueAppointmentsCount} defaulted / missed` : 'On schedule'}
            </div>
          </div>
        </div>

        {/* Card 4: High-Risk Alert */}
        <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              High-Risk Alerts
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', lineHeight: 1.15 }}>
              {dashboard.highRiskCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Severe BP, danger signs, post-term
            </div>
          </div>
        </div>
      </div>

      {/* Trimester Stratification Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={17} color="#0071e3" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Gestational Trimester Distribution
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Active Cohort: {dashboard.totalActivePregnancies} Patients
          </span>
        </div>

        {/* Segmented Progress Bar */}
        <div style={{ display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden', background: '#e5e5ea', marginBottom: '12px' }}>
          <div
            style={{
              width: `${(dashboard.firstTrimesterCount / Math.max(1, dashboard.totalActivePregnancies)) * 100}%`,
              background: '#30b0c7',
              transition: 'width 0.4s ease'
            }}
            title={`1st Trimester: ${dashboard.firstTrimesterCount}`}
          />
          <div
            style={{
              width: `${(dashboard.secondTrimesterCount / Math.max(1, dashboard.totalActivePregnancies)) * 100}%`,
              background: '#0071e3',
              transition: 'width 0.4s ease'
            }}
            title={`2nd Trimester: ${dashboard.secondTrimesterCount}`}
          />
          <div
            style={{
              width: `${(dashboard.thirdTrimesterCount / Math.max(1, dashboard.totalActivePregnancies)) * 100}%`,
              background: '#5856d6',
              transition: 'width 0.4s ease'
            }}
            title={`3rd Trimester: ${dashboard.thirdTrimesterCount}`}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', fontSize: '0.8rem' }}>
          <button
            type="button"
            onClick={() => setFilterTrimester(filterTrimester === 1 ? 'ALL' : 1)}
            style={{
              background: filterTrimester === 1 ? 'rgba(48, 176, 199, 0.15)' : 'transparent',
              border: '1px solid #30b0c7',
              borderRadius: '8px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#30b0c7' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>1st Trimester (1–13w):</span>
            <span style={{ fontWeight: 800, color: '#30b0c7' }}>{dashboard.firstTrimesterCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTrimester(filterTrimester === 2 ? 'ALL' : 2)}
            style={{
              background: filterTrimester === 2 ? 'rgba(0, 113, 227, 0.15)' : 'transparent',
              border: '1px solid #0071e3',
              borderRadius: '8px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0071e3' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>2nd Trimester (14–27w):</span>
            <span style={{ fontWeight: 800, color: '#0071e3' }}>{dashboard.secondTrimesterCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTrimester(filterTrimester === 3 ? 'ALL' : 3)}
            style={{
              background: filterTrimester === 3 ? 'rgba(88, 86, 214, 0.15)' : 'transparent',
              border: '1px solid #5856d6',
              borderRadius: '8px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5856d6' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>3rd Trimester (28w+):</span>
            <span style={{ fontWeight: 800, color: '#5856d6' }}>{dashboard.thirdTrimesterCount}</span>
          </button>

          {filterTrimester !== 'ALL' && (
            <button
              type="button"
              onClick={() => setFilterTrimester('ALL')}
              style={{ background: 'none', border: 'none', color: '#0071e3', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear Trimester Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout: Active Pregnancy Registry & Today's Worklist */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '18px' }}>
        {/* Column 1: Active Pregnancies List */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Active ANC Patient Register
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Displaying {filteredEpisodes.length} active episodes
              </p>
            </div>

            {/* Filter tags */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: filterStatus === 'ALL' ? '#0071e3' : '#fff',
                  color: filterStatus === 'ALL' ? '#fff' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('HIGH_RISK')}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: filterStatus === 'HIGH_RISK' ? '#ff3b30' : '#fff',
                  color: filterStatus === 'HIGH_RISK' ? '#fff' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                High Risk
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('OVERDUE')}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: filterStatus === 'OVERDUE' ? '#f59e0b' : '#fff',
                  color: filterStatus === 'OVERDUE' ? '#fff' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Overdue (42w+)
              </button>
            </div>
          </div>

          {/* Quick Search inside active list */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by episode number (e.g. ANC-2026-0001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '8px 10px' }}>Episode #</th>
                  <th style={{ padding: '8px 10px' }}>Gravida/Para</th>
                  <th style={{ padding: '8px 10px' }}>Gestational Age</th>
                  <th style={{ padding: '8px 10px' }}>Established EDD</th>
                  <th style={{ padding: '8px 10px' }}>Alerts</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEpisodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No active pregnancy episodes match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredEpisodes.map(ep => {
                    const hasCrit = ep.clinicalAlerts.some(a => a.severity === 'critical');
                    const hasWarn = ep.clinicalAlerts.some(a => a.severity === 'warning');

                    return (
                      <tr
                        key={ep.id}
                        className="glass-panel-hover"
                        style={{ borderBottom: '1px solid #f0f0f4', cursor: 'pointer' }}
                        onClick={() => onSelectPatient(ep.patientId, ep.id)}
                      >
                        <td style={{ padding: '10px', fontWeight: 700, color: '#0071e3' }}>
                          {ep.episodeNumber}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                          G{ep.gravidity} P{ep.parity}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: ep.currentGestationalWeeks >= 42 ? '#fee2e2' : 'rgba(0, 113, 227, 0.1)',
                            color: ep.currentGestationalWeeks >= 42 ? '#dc2626' : '#0071e3'
                          }}>
                            {ep.gestationalAgeFormatted}
                          </span>
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-main)', fontWeight: 500 }}>
                          {new Date(ep.establishedEdd).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {hasCrit ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>
                              <ShieldAlert size={13} /> {ep.clinicalAlerts.filter(a => a.severity === 'critical').length} Urgent
                            </span>
                          ) : hasWarn ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '0.72rem', fontWeight: 600 }}>
                              <AlertTriangle size={13} /> Overdue
                            </span>
                          ) : (
                            <span style={{ color: '#16a34a', fontSize: '0.72rem', fontWeight: 600 }}>
                              Normal
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPatient(ep.patientId, ep.id);
                            }}
                            className="btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            Open Workspace
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column 2: Today's ANC Follow-up Worklist & Clinical Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Worklist Card */}
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#5856d6" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Upcoming Follow-up Worklist
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', background: 'rgba(88, 86, 214, 0.1)', color: '#5856d6', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>
                {dashboard.todayWorklist.length} Scheduled
              </span>
            </div>

            {dashboard.todayWorklist.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No appointments scheduled for upcoming days.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {dashboard.todayWorklist.map(appt => (
                  <div
                    key={appt.id}
                    onClick={() => onSelectPatient(appt.patientId, appt.episodeId)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--text-main)' }}>
                        {appt.patientName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        MRN: {appt.patientMrn} • {appt.doctorName}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0071e3' }}>
                        {new Date(appt.appointmentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {appt.remarks || 'Routine ANC'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Urgent Alerts List */}
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="#dc2626" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Urgent Clinical Intelligence Alerts
              </h3>
            </div>

            {dashboard.urgentAlerts.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#16a34a', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> All active pregnancies within safe clinical parameters.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dashboard.urgentAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: alert.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                      border: `1px solid ${alert.severity === 'critical' ? '#fecaca' : '#fde68a'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem', color: alert.severity === 'critical' ? '#991b1b' : '#92400e' }}>
                      {alert.severity === 'critical' ? <ShieldAlert size={14} /> : <AlertTriangle size={14} />}
                      {alert.title}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: alert.severity === 'critical' ? '#b91c1c' : '#b45309', lineHeight: 1.35 }}>
                      {alert.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
