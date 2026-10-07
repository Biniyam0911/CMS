import React, { useState, useEffect, useMemo } from 'react';
import {
  FileHeart, Calendar, Search, RefreshCw, Printer, Download,
  Stethoscope, Activity, Users, DollarSign, ChevronLeft, ChevronRight
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
  serviceName: string;
  fee: number;
  status: string;
}

/** Normalise a raw API row (PascalCase dynamic) to our camelCase interface */
function normalizeRow(r: any): PatientSummaryRecord {
  return {
    encounterId:  r.EncounterId  ?? r.encounterId  ?? 0,
    patientId:    r.PatientId    ?? r.patientId    ?? 0,
    mrn:          r.MRN          ?? r.Mrn          ?? r.mrn          ?? '',
    patientName:  r.PatientName  ?? r.patientName  ?? '',
    gender:       r.Gender       ?? r.gender       ?? '',
    age:          r.Age          ?? r.age          ?? 0,
    visitDate:    r.VisitDate    ?? r.visitDate    ?? '',
    activityType: (r.ActivityType ?? r.activityType ?? 'Consultation') as 'Consultation' | 'Procedure',
    serviceName:  r.ServiceName  ?? r.serviceName  ?? r.ServiceOrDetails ?? r.serviceOrDetails ?? '—',
    fee:          Number(r.Fee   ?? r.fee          ?? 0),
    status:       r.Status       ?? r.status       ?? '',
  };
}

const PAGE_SIZE = 50;

export default function MyPatientSummaryPage() {
  const [loading, setLoading]           = useState(true);
  const [data, setData]                 = useState<PatientSummaryRecord[]>([]);
  const [searchQuery, setSearchQuery]   = useState('');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'Consultation' | 'Procedure'>('ALL');
  const [currentPage, setCurrentPage]   = useState(1);

  // Date Filter State — no all_time option
  const [datePreset, setDatePreset] = useState<
    'this_month' | 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_year' | 'custom'
  >('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  // Doctor display name from session
  const currentUser = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('current_user') || localStorage.getItem('current_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const doctorDisplayName = currentUser?.name ||
    (`${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim()) ||
    (currentUser?.username ? `Dr. ${currentUser.username}` : 'Attending Doctor');

  // Date range calculation
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().split('T')[0];
    switch (datePreset) {
      case 'today': { const t = toISO(now); return { dateFrom: t, dateTo: t }; }
      case 'yesterday': { const y = new Date(now); y.setDate(y.getDate() - 1); const s = toISO(y); return { dateFrom: s, dateTo: s }; }
      case 'last_7_days':  { const p = new Date(now); p.setDate(p.getDate() - 6);  return { dateFrom: toISO(p), dateTo: toISO(now) }; }
      case 'last_30_days': { const p = new Date(now); p.setDate(p.getDate() - 29); return { dateFrom: toISO(p), dateTo: toISO(now) }; }
      case 'this_month':   return { dateFrom: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: toISO(now) };
      case 'this_year':    return { dateFrom: toISO(new Date(now.getFullYear(), 0, 1)), dateTo: toISO(now) };
      default: return {
        dateFrom: customFrom || toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        dateTo:   customTo   || toISO(now),
      };
    }
  }, [datePreset, customFrom, customTo]);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const params: any = { dateFrom, dateTo };
      if (currentUser?.doctorId) params.doctorId = currentUser.doctorId;
      const res = await api.get<any[]>('/reports/my-patient-summary', params);
      const raw: any[] = Array.isArray(res) ? res : ((res as any)?.data ?? []);
      setData(raw.map(normalizeRow));
    } catch (err) {
      console.error('Failed to load my patient summary report:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [dateFrom, dateTo]);

  // Metrics from full data (unfiltered)
  const metrics = useMemo(() => ({
    totalVisits:   data.length,
    consultations: data.filter(d => d.activityType === 'Consultation').length,
    procedures:    data.filter(d => d.activityType === 'Procedure').length,
    totalRevenue:  data.reduce((s, d) => s + (Number(d.fee) || 0), 0),
  }), [data]);

  // Filtered rows (activity + search)
  const filteredData = useMemo(() => {
    return data.filter(r => {
      const matchActivity = activityFilter === 'ALL' || r.activityType === activityFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        r.patientName.toLowerCase().includes(q) ||
        r.mrn.toLowerCase().includes(q) ||
        (r.serviceName || '').toLowerCase().includes(q);
      return matchActivity && matchQuery;
    });
  }, [data, activityFilter, searchQuery]);

  // Pagination
  const totalPages  = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safePage    = Math.min(currentPage, totalPages);
  const pagedData   = filteredData.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const goToPage = (p: number) => setCurrentPage(Math.max(1, Math.min(totalPages, p)));

  // Reset page when filter / search changes
  useEffect(() => { setCurrentPage(1); }, [activityFilter, searchQuery]);

  // CSV export
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = ['ID', 'MRN', 'Patient Name', 'Gender', 'Age', 'Visit Date', 'Type', 'Service Name', 'Status'];
    const rows = filteredData.map(r => [
      r.encounterId, r.mrn,
      `"${r.patientName.replace(/"/g, '""')}"`,
      r.gender, r.age, r.visitDate, r.activityType,
      `"${(r.serviceName || '').replace(/"/g, '""')}"`,
      r.status,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url;
    a.download = `My_Patient_Summary_${dateFrom}_to_${dateTo}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '8px', background: '#e0f2fe', borderRadius: '8px', color: '#0369a1' }}>
            <Stethoscope size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>My Patient Summary</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Consultations &amp; procedures by <strong>{doctorDisplayName}</strong>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => window.print()} className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 14px' }}>
            <Printer size={15} /> Print
          </button>
          <button onClick={handleExportCSV} disabled={filteredData.length === 0} className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 14px' }}>
            <Download size={15} /> Export CSV
          </button>
          <button onClick={fetchData} className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 14px' }}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Date Filter Toolbar */}
      <div style={{ padding: '14px 18px', marginBottom: '20px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            <Calendar size={15} /> Date Range:
          </div>
          <select value={datePreset} onChange={e => setDatePreset(e.target.value as any)}
            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fdfcf9' }}>
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
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
            </div>
          )}
          <span style={{ fontSize: '0.78rem', color: '#0369a1', background: '#e0f2fe', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
            {dateFrom} → {dateTo}
          </span>
        </div>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search patient, MRN, service name..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        {[
          { label: 'Total Visits',      value: metrics.totalVisits,   icon: <Users size={18} color="#0284c7" />,  color: '#0284c7',  sub: 'Total visits in period',           border: 'none' },
          { label: 'Consultations',     value: metrics.consultations,  icon: <FileHeart size={18} color="#059669" />, color: '#059669', sub: 'Clinical consultations',         border: '4px solid #059669' },
          { label: 'Procedures',        value: metrics.procedures,     icon: <Activity size={18} color="#d97706" />,  color: '#d97706', sub: 'Clinical procedures performed', border: '4px solid #d97706' },
        ].map(card => (
          <div key={card.label} style={{ padding: '16px 20px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: card.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: card.color, textTransform: 'uppercase' }}>{card.label}</span>
              {card.icon}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>{card.value}</div>
            <div style={{ fontSize: '0.72rem', color: card.color, marginTop: '2px' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Activity Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        {(['ALL', 'Consultation', 'Procedure'] as const).map(f => (
          <button key={f} onClick={() => setActivityFilter(f)}
            className={activityFilter === f ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}>
            {f === 'ALL' ? `All Activities (${data.length})` : f === 'Consultation' ? `Consultations (${metrics.consultations})` : `Procedures (${metrics.procedures})`}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Showing {filteredData.length > 0 ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredData.length)} of ` : ''}{filteredData.length} records
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Loading patient summary report...
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No records found for this period.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  {['Date', 'Patient', 'MRN', 'Age / Sex', 'Type', 'Service Name', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap',
                      textAlign: h === 'Status' ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedData.map((row, idx) => (
                  <tr key={`${row.activityType}-${row.encounterId}-${idx}`}
                    style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{row.visitDate}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{row.patientName}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#0369a1', fontWeight: 600 }}>{row.mrn}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {row.age > 0 ? `${row.age} yrs` : '—'} / {row.gender || '—'}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                        background: row.activityType === 'Consultation' ? '#ecfdf5' : '#fffbeb',
                        color:      row.activityType === 'Consultation' ? '#047857' : '#b45309',
                        border:     row.activityType === 'Consultation' ? '1px solid #a7f3d0' : '1px solid #fde68a',
                      }}>{row.activityType}</span>
                    </td>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--text-main)', maxWidth: '300px' }}>
                      {row.serviceName}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                        background: row.status === 'Completed' ? '#ecfdf5' : '#eff6ff',
                        color:      row.status === 'Completed' ? '#047857' : '#1d4ed8',
                      }}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '14px', borderTop: '1px solid var(--border-color)' }}>
            <button onClick={() => goToPage(1)} disabled={safePage === 1} className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem', minWidth: '32px' }}>«</button>
            <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1} className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ChevronLeft size={13} /> Prev
            </button>

            {/* Page number pills */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || (p >= safePage - 2 && p <= safePage + 2))
              .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e${i}`} style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>…</span>
                ) : (
                  <button key={p} onClick={() => goToPage(p as number)}
                    className={safePage === p ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '4px 10px', fontSize: '0.75rem', minWidth: '32px' }}>{p}</button>
                )
              )}

            <button onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages} className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Next <ChevronRight size={13} />
            </button>
            <button onClick={() => goToPage(totalPages)} disabled={safePage === totalPages} className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem', minWidth: '32px' }}>»</button>
          </div>
        )}
      </div>
    </div>
  );
}
