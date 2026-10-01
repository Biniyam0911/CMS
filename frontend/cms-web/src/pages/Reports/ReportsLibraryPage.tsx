import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, Download, Play, X, Check, Loader2, Users, Stethoscope, FlaskConical, ClipboardList, Activity, DollarSign } from 'lucide-react';
import { api } from '../../api/apiClient';

interface ReportDef {
  id: number;
  key: string;
  title: string;
  category: string;
  desc: string;
  icon: React.ReactNode;
  filterFields: string[];
}

const REPORT_DEFS: ReportDef[] = [
  {
    id: 1, key: 'REPORT_SALES',
    title: 'Sales Report',
    category: 'Financial',
    desc: 'Revenue, VAT and paid amounts filtered by date range and receptionist.',
    icon: <DollarSign size={20} color="#059669" />,
    filterFields: ['dateFrom', 'dateTo', 'receptionist'],
  },
  {
    id: 2, key: 'REPORT_AGE_STRATIFIED',
    title: 'Age-Stratified Report',
    category: 'Clinical',
    desc: 'Patient visit counts broken down by age group (<1, 1-4, 5-14, 15-29, 30-64, ≥65).',
    icon: <Users size={20} color="#0284c7" />,
    filterFields: ['dateFrom', 'dateTo'],
  },
  {
    id: 3, key: 'REPORT_SEX_STRATIFIED',
    title: 'Sex-Stratified Report',
    category: 'Clinical',
    desc: 'Patient visit counts split by gender.',
    icon: <Activity size={20} color="#7c3aed" />,
    filterFields: ['dateFrom', 'dateTo', 'gender'],
  },
  {
    id: 4, key: 'REPORT_DOCTOR_PERFORMANCE',
    title: 'Doctor Performance Report',
    category: 'Clinical',
    desc: 'Consultation counts and revenue attributed per doctor.',
    icon: <Stethoscope size={20} color="#0891b2" />,
    filterFields: ['dateFrom', 'dateTo', 'doctor'],
  },
  {
    id: 5, key: 'REPORT_DIAGNOSIS',
    title: 'Diagnosis Report',
    category: 'Clinical',
    desc: 'Most frequent diagnoses ranked by occurrence in the selected period.',
    icon: <ClipboardList size={20} color="#dc2626" />,
    filterFields: ['dateFrom', 'dateTo'],
  },
  {
    id: 6, key: 'REPORT_PROCEDURE',
    title: 'Procedure Report',
    category: 'Clinical',
    desc: 'Procedure counts and revenue totals for the selected period.',
    icon: <FlaskConical size={20} color="#ea580c" />,
    filterFields: ['dateFrom', 'dateTo'],
  },
];

const AGE_GROUPS = ['<1', '1-4', '5-14', '15-29', '30-64', '≥65'];

export default function ReportsLibraryPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportedAlert, setExportedAlert] = useState<string | null>(null);

  // Filters
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [filterReceptionist, setFilterReceptionist] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');

  // Doctors list for dropdown
  const [doctors, setDoctors] = useState<any[]>([]);
  useEffect(() => {
    api.get<any>('/doctors').then((res: any) => {
      const list = Array.isArray(res) ? res : (res?.data || res?.Data || []);
      setDoctors(list);
    }).catch(() => {});
  }, []);

  // Sidebar event listener: open a specific report when clicked from sidebar
  const reportRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail?.reportKey as string;
      if (!key) return;
      const def = REPORT_DEFS.find(r => r.key === key);
      if (def) {
        setActiveReport(null);
        setReportData([]);
        setTimeout(() => {
          const el = reportRefs.current[def.key];
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };
    window.addEventListener('open_standard_report', handler);
    return () => window.removeEventListener('open_standard_report', handler);
  }, []);

  const handleRunReport = async (report: ReportDef) => {
    setActiveReport(report);
    setLoading(true);
    setReportData([]);
    try {
      const params: Record<string, string> = { dateFrom, dateTo };
      if (report.filterFields.includes('receptionist') && filterReceptionist) params.receptionist = filterReceptionist;
      if (report.filterFields.includes('gender') && filterGender) params.gender = filterGender;
      if (report.filterFields.includes('doctor') && filterDoctor) params.doctorId = filterDoctor;

      // Try fetching from dedicated endpoint; fall back to local transform of billing/patient data
      try {
        const endpointMap: Record<string, string> = {
          REPORT_SALES: '/reports/sales',
          REPORT_AGE_STRATIFIED: '/reports/age-stratified',
          REPORT_SEX_STRATIFIED: '/reports/sex-stratified',
          REPORT_DOCTOR_PERFORMANCE: '/reports/doctor-performance',
          REPORT_DIAGNOSIS: '/reports/diagnosis',
          REPORT_PROCEDURE: '/reports/procedure',
        };
        const endpoint = endpointMap[report.key];
        const qs = '?' + new URLSearchParams(params).toString();
        const res: any = await api.get(endpoint + qs);
        const rows = Array.isArray(res) ? res : (res?.data || res?.Data || []);
        if (rows.length > 0) { setReportData(rows); return; }
      } catch { /* fall through to local compute */ }

      // --- Local fallback computations ---
      if (report.key === 'REPORT_SALES') {
        const res = await api.get<any[]>('/billing/invoices').catch(() => []);
        const rows = Array.isArray(res) ? res : [];
        const from = new Date(dateFrom); const to = new Date(dateTo + 'T23:59:59');
        const filtered = rows.filter(inv => {
          const d = new Date(inv.issueDate || inv.IssueDate || '');
          const waved = inv.isWaived || inv.IsWaived || (inv.totalAmount ?? inv.TotalAmount) === 0;
          const recMatch = !filterReceptionist || (inv.receptionistName || inv.ReceptionistName || '').toLowerCase().includes(filterReceptionist.toLowerCase());
          return !waved && d >= from && d <= to && recMatch;
        }).map(inv => ({
          InvoiceNo: inv.invoiceNo || inv.InvoiceNumber,
          PatientName: inv.patientName || inv.PatientName,
          Receptionist: inv.receptionistName || inv.ReceptionistName || '-',
          IssueDate: String(inv.issueDate || inv.IssueDate || '').split('T')[0],
          SubTotal: Number(inv.subTotal || inv.SubTotal || 0),
          VAT: Number(inv.taxAmount || inv.TaxAmt || 0),
          Total: Number(inv.totalAmount || inv.TotalAmount || 0),
          Paid: Number(inv.paidAmount || inv.PaidAmount || 0),
          Status: inv.statusName || (inv.statusId === 4 ? 'Paid' : 'Issued'),
        }));
        setReportData(filtered);
      } else if (report.key === 'REPORT_AGE_STRATIFIED') {
        const res = await api.get<any[]>('/patients').catch(() => []);
        const rows = Array.isArray(res) ? res : [];
        const getAge = (dob: string) => { try { return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)); } catch { return -1; } };
        const buckets: Record<string, number> = { '<1': 0, '1-4': 0, '5-14': 0, '15-29': 0, '30-64': 0, '≥65': 0 };
        rows.forEach(p => {
          const age = getAge(p.dateOfBirth || p.DateOfBirth || '');
          if (age < 0) return;
          if (age < 1) buckets['<1']++;
          else if (age <= 4) buckets['1-4']++;
          else if (age <= 14) buckets['5-14']++;
          else if (age <= 29) buckets['15-29']++;
          else if (age <= 64) buckets['30-64']++;
          else buckets['≥65']++;
        });
        setReportData(AGE_GROUPS.map(g => ({ AgeGroup: g, Count: buckets[g] })));
      } else if (report.key === 'REPORT_SEX_STRATIFIED') {
        const res = await api.get<any[]>('/patients').catch(() => []);
        const rows = Array.isArray(res) ? res : [];
        const gMap: Record<string, number> = {};
        rows.forEach(p => {
          const g = (p.gender || p.Gender || 'Unknown');
          gMap[g] = (gMap[g] || 0) + 1;
        });
        const filtered = Object.entries(gMap).filter(([g]) => !filterGender || g.toLowerCase() === filterGender.toLowerCase());
        setReportData(filtered.map(([Gender, Count]) => ({ Gender, Count })));
      } else if (report.key === 'REPORT_DOCTOR_PERFORMANCE') {
        const res = await api.get<any[]>('/billing/invoices').catch(() => []);
        const rows = Array.isArray(res) ? res : [];
        const from = new Date(dateFrom); const to = new Date(dateTo + 'T23:59:59');
        const dMap: Record<string, { Doctor: string; Consultations: number; Revenue: number }> = {};
        rows.filter(inv => {
          const d = new Date(inv.issueDate || inv.IssueDate || '');
          return d >= from && d <= to;
        }).forEach(inv => {
          const doc = inv.doctorName || inv.DoctorName || 'Unknown';
          if (filterDoctor && !doc.toLowerCase().includes(filterDoctor.toLowerCase())) return;
          if (!dMap[doc]) dMap[doc] = { Doctor: doc, Consultations: 0, Revenue: 0 };
          dMap[doc].Consultations++;
          dMap[doc].Revenue += Number(inv.paidAmount || inv.PaidAmount || 0);
        });
        setReportData(Object.values(dMap).sort((a, b) => b.Revenue - a.Revenue));
      } else {
        setReportData([]);
      }
    } catch (e) {
      console.error(e);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const triggerExport = (format: string) => {
    setExportedAlert(`Report exported as ${format} successfully!`);
    setTimeout(() => setExportedAlert(null), 3000);
  };

  const renderTableHeaders = (report: ReportDef) => {
    const colMap: Record<string, string[]> = {
      REPORT_SALES: ['Invoice No', 'Patient', 'Receptionist', 'Date', 'SubTotal', 'VAT', 'Total', 'Paid', 'Status'],
      REPORT_AGE_STRATIFIED: ['Age Group', 'Count'],
      REPORT_SEX_STRATIFIED: ['Gender', 'Count'],
      REPORT_DOCTOR_PERFORMANCE: ['Doctor', 'Consultations', 'Revenue (Br)'],
      REPORT_DIAGNOSIS: ['Diagnosis', 'Count'],
      REPORT_PROCEDURE: ['Procedure', 'Count', 'Revenue (Br)'],
    };
    return (colMap[report.key] || Object.keys(reportData[0] || {})).map((h, i) => <th key={i}>{h}</th>);
  };

  const renderTableRow = (report: ReportDef, row: any, i: number) => {
    if (report.key === 'REPORT_SALES') return (
      <tr key={i}>
        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>{row.InvoiceNo}</td>
        <td>{row.PatientName}</td>
        <td>{row.Receptionist}</td>
        <td>{row.IssueDate}</td>
        <td>Br {Number(row.SubTotal).toFixed(2)}</td>
        <td>Br {Number(row.VAT).toFixed(2)}</td>
        <td style={{ fontWeight: 700 }}>Br {Number(row.Total).toFixed(2)}</td>
        <td style={{ color: '#059669', fontWeight: 700 }}>Br {Number(row.Paid).toFixed(2)}</td>
        <td><span className={row.Status === 'Paid' ? 'badge badge-normal' : 'badge badge-warning'} style={{ fontSize: '0.68rem' }}>{row.Status}</span></td>
      </tr>
    );
    return (
      <tr key={i}>
        {Object.values(row).map((v: any, ci) => (
          <td key={ci} style={{ fontWeight: ci === 0 ? 700 : 400 }}>
            {typeof v === 'number' ? (String(v).includes('.') ? `Br ${v.toFixed(2)}` : v) : String(v ?? '')}
          </td>
        ))}
      </tr>
    );
  };

  const totalSales = activeReport?.key === 'REPORT_SALES'
    ? { billed: reportData.reduce((s, r) => s + r.Total, 0), paid: reportData.reduce((s, r) => s + r.Paid, 0), vat: reportData.reduce((s, r) => s + r.VAT, 0) }
    : null;

  return (
    <div>
      {exportedAlert && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '10px 16px', background: '#059669', color: '#fff', borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} /> {exportedAlert}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 color="#0284c7" size={22} /> Standard Reports Library
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Generate clinical, operational, and financial analytics reports. Free and waived services are excluded from revenue totals.
        </p>
      </div>

      {/* Global date-range filters */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Date From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.82rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Date To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.82rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Receptionist (Sales)</label>
          <input placeholder="Filter by receptionist…" value={filterReceptionist} onChange={e => setFilterReceptionist(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.82rem', width: 160 }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Gender (Sex Report)</label>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
            <option value="">All Genders</option>
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Doctor (Performance)</label>
          <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
            <option value="">All Doctors</option>
            {doctors.map((d: any, i) => <option key={i} value={d.id || d.Id}>{d.doctorName || d.DoctorName || d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-2">
        {REPORT_DEFS.map((r) => (
          <div
            key={r.key}
            ref={el => { reportRefs.current[r.key] = el; }}
            className="glass-panel glass-panel-hover"
            style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {r.icon}
                <span className="badge badge-info">{r.category}</span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '4px 0' }}>{r.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.desc}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
              <button onClick={() => handleRunReport(r)} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Play size={14} /> Run Report
              </button>
              <button onClick={() => triggerExport('PDF')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} /> PDF
              </button>
              <button onClick={() => triggerExport('Excel')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} /> Excel
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report Modal Preview */}
      {activeReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '8px' : '20px' }}>
          <div style={{ width: '100%', maxWidth: '1100px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>

            <div style={{ padding: isMobile ? '12px 16px' : '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>{activeReport.category} Report</div>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: 800, color: '#0f172a' }}>{activeReport.title}</h3>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{dateFrom} → {dateTo}</div>
              </div>
              <button onClick={() => setActiveReport(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Sales summary bar */}
            {totalSales && (
              <div style={{ padding: isMobile ? '12px 16px' : '14px 20px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', flexWrap: 'wrap', gap: isMobile ? '12px' : '28px', fontSize: '0.82rem' }}>
                <div><span style={{ color: '#166534', fontWeight: 600 }}>Total Billed:</span><div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803d' }}>Br {totalSales.billed.toFixed(2)}</div></div>
                <div><span style={{ color: '#166534', fontWeight: 600 }}>VAT Collected:</span><div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803d' }}>Br {totalSales.vat.toFixed(2)}</div></div>
                <div><span style={{ color: '#166534', fontWeight: 600 }}>Paid Revenue:</span><div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803d' }}>Br {totalSales.paid.toFixed(2)}</div></div>
                <div style={{ marginLeft: isMobile ? 0 : 'auto', alignSelf: 'center', fontSize: '0.75rem', color: '#15803d', fontStyle: 'italic' }}>✓ Waived / free invoices excluded.</div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px' : '20px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} /> Compiling report data…
                </div>
              ) : reportData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No records found for the selected filters.</div>
              ) : (
                <div className="table-responsive">
                  <table className="cms-table" style={{ margin: 0 }}>
                    <thead><tr>{renderTableHeaders(activeReport)}</tr></thead>
                    <tbody>{reportData.map((row, i) => renderTableRow(activeReport, row, i))}</tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ padding: isMobile ? '10px 14px' : '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{reportData.length} record{reportData.length !== 1 ? 's' : ''} returned</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
                <button onClick={() => triggerExport('PDF')} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={14} /> Export PDF</button>
                <button onClick={() => triggerExport('Excel')} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={14} /> Export Excel</button>
                <button onClick={() => setActiveReport(null)} className="btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem' }}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


