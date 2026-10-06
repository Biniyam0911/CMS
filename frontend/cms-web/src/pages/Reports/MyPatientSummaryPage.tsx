import React, { useState, useEffect, useMemo } from 'react';
import {
  FileHeart, Calendar, Search, RefreshCw, Printer, Download,
  Stethoscope, Activity, Users, DollarSign, Filter, ChevronRight
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface PatientSummaryRecord {
  encounterId: number;
  patientId: number;
  mrn: string;
  patientName: string;
  gender: string;
  age: number;
  visitDate: string;
  activityType: 'Consultation' | 'Procedure';
  serviceOrDetails: string;
  diagnosisOrNotes: string;
  fee: number;
  status: string;
}

export default function MyPatientSummaryPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PatientSummaryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'Consultation' | 'Procedure'>('ALL');

  // Date Filter State — NO all_time option as per requirements!
  const [datePreset, setDatePreset] = useState<'this_month' | 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_year' | 'custom'>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Doctor Info from current user
  const currentUser = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('current_user') || localStorage.getItem('current_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const doctorDisplayName = currentUser?.name || currentUser?.firstName
    ? `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.name
    : (currentUser?.username ? `Dr. ${currentUser.username}` : 'Attending Doctor');

  // Date Calculation
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().split('T')[0];

    if (datePreset === 'today') {
      const t = toISO(now);
      return { dateFrom: t, dateTo: t };
    }
    if (datePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toISO(y);
      return { dateFrom: yStr, dateTo: yStr };
    }
    if (datePreset === 'last_7_days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      return { dateFrom: toISO(past), dateTo: toISO(now) };
    }
    if (datePreset === 'this_month') {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: toISO(startMonth), dateTo: toISO(now) };
    }
    if (datePreset === 'last_30_days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 29);
      return { dateFrom: toISO(past), dateTo: toISO(now) };
    }
    if (datePreset === 'this_year') {
      const startYear = new Date(now.getFullYear(), 0, 1);
      return { dateFrom: toISO(startYear), dateTo: toISO(now) };
    }
    return {
      dateFrom: customFrom || toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: customTo || toISO(now)
    };
  }, [datePreset, customFrom, customTo]);

  // Load Report Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {
        dateFrom,
        dateTo
      };
      if (currentUser?.doctorId) {
        params.doctorId = currentUser.doctorId;
      }
      const res = await api.get<PatientSummaryRecord[]>('/reports/my-patient-summary', params);
      const rows = Array.isArray(res) ? res : ((res as any)?.data || []);
      setData(rows);
    } catch (err) {
      console.error('Failed to load my patient summary report:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  // Filtered rows
  const filteredData = useMemo(() => {
    return data.filter(r => {
      const matchActivity = activityFilter === 'ALL' || r.activityType === activityFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        r.patientName.toLowerCase().includes(q) ||
        r.mrn.toLowerCase().includes(q) ||
        (r.serviceOrDetails || '').toLowerCase().includes(q) ||
        (r.diagnosisOrNotes || '').toLowerCase().includes(q);
      return matchActivity && matchQuery;
    });
  }, [data, activityFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalVisits = data.length;
    const consultations = data.filter(d => d.activityType === 'Consultation').length;
    const procedures = data.filter(d => d.activityType === 'Procedure').length;
    const totalRevenue = data.reduce((sum, d) => sum + (Number(d.fee) || 0), 0);
    return { totalVisits, consultations, procedures, totalRevenue };
  }, [data]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = ['Encounter/Order ID', 'MRN', 'Patient Name', 'Gender', 'Age', 'Visit Date', 'Activity Type', 'Service / Details', 'Diagnosis / Notes', 'Fee (ETB)', 'Status'];
    const rows = filteredData.map(r => [
      r.encounterId,
      r.mrn,
      `"${r.patientName.replace(/"/g, '""')}"`,
      r.gender,
      r.age,
      r.visitDate,
      r.activityType,
      `"${(r.serviceOrDetails || '').replace(/"/g, '""')}"`,
      `"${(r.diagnosisOrNotes || '').replace(/"/g, '""')}"`,
      r.fee,
      r.status
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `My_Patient_Summary_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '8px', background: '#e0f2fe', borderRadius: '8px', color: '#0369a1' }}>
              <Stethoscope size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                My Patient Summary
              </h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Clinical consultations &amp; procedures conducted by <strong>{doctorDisplayName}</strong>
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => window.print()}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 14px' }}
          >
            <Printer size={15} /> Print
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredData.length === 0}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 14px' }}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={fetchData}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 14px' }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Date Filter & Preset Toolbar */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            <Calendar size={15} /> Date Range:
          </div>
          <select
            value={datePreset}
            onChange={e => setDatePreset(e.target.value as any)}
            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fdfcf9' }}
          >
            <option value="this_month">This Month</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_year">This Year (YTD)</option>
            <option value="custom">Custom Date Range...</option>
          </select>

          {datePreset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              />
            </div>
          )}

          <span style={{ fontSize: '0.78rem', color: '#0369a1', background: '#e0f2fe', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
            {dateFrom} to {dateTo}
          </span>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search patient, MRN, complaint..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
          />
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Patients</span>
            <Users size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>{metrics.totalVisits}</div>
          <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '2px' }}>Total visits in period</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Consultations</span>
            <FileHeart size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>{metrics.consultations}</div>
          <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '2px' }}>Clinical encounter notes</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: '4px solid #d97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>Procedures</span>
            <Activity size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>{metrics.procedures}</div>
          <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '2px' }}>Clinical procedures performed</div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: '4px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>Total Value</span>
            <DollarSign size={18} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>ETB {metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: '2px' }}>Billed services total</div>
        </div>
      </div>

      {/* Filter Tabs (Activity Type) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        <button
          onClick={() => setActivityFilter('ALL')}
          className={activityFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.78rem', padding: '5px 12px' }}
        >
          All Activities ({data.length})
        </button>
        <button
          onClick={() => setActivityFilter('Consultation')}
          className={activityFilter === 'Consultation' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.78rem', padding: '5px 12px' }}
        >
          Consultations Only ({metrics.consultations})
        </button>
        <button
          onClick={() => setActivityFilter('Procedure')}
          className={activityFilter === 'Procedure' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.78rem', padding: '5px 12px' }}
        >
          Procedures Only ({metrics.procedures})
        </button>
      </div>

      {/* Main Table */}
      <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Loading patient summary report...
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No consultation or procedure records found for this period.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px' }}>Patient</th>
                  <th style={{ padding: '10px 14px' }}>MRN</th>
                  <th style={{ padding: '10px 14px' }}>Age / Sex</th>
                  <th style={{ padding: '10px 14px' }}>Type</th>
                  <th style={{ padding: '10px 14px' }}>Service / Chief Complaint</th>
                  <th style={{ padding: '10px 14px' }}>Clinical Assessment / Notes</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Fee (ETB)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr key={`${row.activityType}-${row.encounterId}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                      {row.visitDate}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {row.patientName}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0369a1', fontWeight: 600 }}>
                      {row.mrn}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                      {row.age} yrs / {row.gender}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: row.activityType === 'Consultation' ? '#ecfdf5' : '#fffbeb',
                        color: row.activityType === 'Consultation' ? '#047857' : '#b45309',
                        border: row.activityType === 'Consultation' ? '1px solid #a7f3d0' : '1px solid #fde68a'
                      }}>
                        {row.activityType}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-main)', maxWidth: '240px' }}>
                      {row.serviceOrDetails}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#475569', maxWidth: '300px' }}>
                      {row.diagnosisOrNotes}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                      {Number(row.fee) > 0 ? Number(row.fee).toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
