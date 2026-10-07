import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Users, Activity, Stethoscope, ClipboardList,
  FlaskConical, Download, RefreshCw, Check, Loader2, ArrowUpRight
} from 'lucide-react';
import { api } from '../../api/apiClient';
import { ModuleKey } from '../../components/Sidebar';

interface DedicatedReportPageProps {
  reportType: ModuleKey;
}

interface ReportConfig {
  title: string;
  category: string;
  description: string;
  icon: React.ReactNode;
}

const REPORT_CONFIGS: Record<string, ReportConfig> = {
  REPORT_SALES: {
    title: 'Sales & Revenue Report',
    category: 'Financial',
    description: 'Itemized revenue, 15% VAT, and paid collections filtered by date range and cashier/receptionist. Free and waived services are strictly excluded.',
    icon: <DollarSign color="#059669" size={24} />
  },
  REPORT_AGE_STRATIFIED: {
    title: 'Age-Stratified Patient Report',
    category: 'Demographics & Clinical',
    description: 'Patient visit distribution stratified across standard epidemiological age brackets (<1, 1–4, 5–14, 15–29, 30–64, ≥65).',
    icon: <Users color="#0284c7" size={24} />
  },
  REPORT_SEX_STRATIFIED: {
    title: 'Sex-Stratified Patient Report',
    category: 'Demographics & Clinical',
    description: 'Patient registry and visit metrics stratified by gender with comparative proportion metrics.',
    icon: <Activity color="#7c3aed" size={24} />
  },
  REPORT_DOCTOR_PERFORMANCE: {
    title: 'Doctor Performance & Consultation Report',
    category: 'Clinical Operations',
    description: 'Clinical consultation volume, patient encounters, and attributed billing revenue analyzed per practitioner.',
    icon: <Stethoscope color="#0891b2" size={24} />
  },
  REPORT_DIAGNOSIS: {
    title: 'Diagnosis & Morbidity Report',
    category: 'Epidemiology',
    description: 'Ranked clinical diagnosis frequency, ICD-10 codification, and prevalence across patient encounters.',
    icon: <ClipboardList color="#dc2626" size={24} />
  },
  REPORT_PROCEDURE: {
    title: 'Clinical Procedure & Intervention Report',
    category: 'Clinical Operations',
    description: 'Summary of clinical minor surgeries, nursing procedures, and diagnostic interventions with revenue yields.',
    icon: <FlaskConical color="#ea580c" size={24} />
  },
};

export default function DedicatedReportPage({ reportType }: DedicatedReportPageProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const config = REPORT_CONFIGS[reportType] || {
    title: 'Clinic Analytics Report',
    category: 'Reports',
    description: 'Operational clinic report data',
    icon: <Activity size={24} />
  };

  // State
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [exportedAlert, setExportedAlert] = useState<string | null>(null);

  // Filter Dropdowns
  const [datePreset, setDatePreset] = useState<'this_month' | 'last_30_days' | 'today' | 'yesterday' | 'last_7_days' | 'last_month' | 'this_year' | 'custom'>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Report Specific Dropdowns
  const [selectedReceptionist, setSelectedReceptionist] = useState<string>('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('ALL');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<string>('ALL');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('ALL');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('ALL');
  const [selectedLimit, setSelectedLimit] = useState<string>('25');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Dynamic Options
  const [doctorsList, setDoctorsList] = useState<{ id: number; name: string }[]>([]);
  const [receptionistsList, setReceptionistsList] = useState<string[]>([]);

  // Compute effective date range based on datePreset dropdown
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().split('T')[0];

    if (datePreset === 'today') {
      const t = toISO(now);
      return { dateFrom: t, dateTo: t };
    }
    if (datePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yt = toISO(y);
      return { dateFrom: yt, dateTo: yt };
    }
    if (datePreset === 'last_7_days') {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 7);
      return { dateFrom: toISO(past7), dateTo: toISO(now) };
    }
    if (datePreset === 'last_30_days') {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      return { dateFrom: toISO(past30), dateTo: toISO(now) };
    }
    if (datePreset === 'last_month') {
      const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: toISO(firstLastMonth), dateTo: toISO(lastLastMonth) };
    }
    if (datePreset === 'this_year') {
      const startYear = new Date(now.getFullYear(), 0, 1);
      return { dateFrom: toISO(startYear), dateTo: toISO(now) };
    }
    if (datePreset === 'custom') {
      return {
        dateFrom: customFrom || toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        dateTo: customTo || toISO(now)
      };
    }
    // Default: 'this_month'
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: toISO(startMonth), dateTo: toISO(now) };
  }, [datePreset, customFrom, customTo]);

  // Load auxiliary lists (doctors with privileges, receptionists with role)
  useEffect(() => {
    // Load doctors from reporting / rbac doctor list
    api.get<any>('/reports/doctor-performance').then((res: any) => {
      const list = Array.isArray(res) ? res : (res?.data || res?.Data || []);
      if (list.length > 0) {
        setDoctorsList(list.map((d: any) => ({
          id: d.userId || d.doctorId || d.id || 0,
          name: d.doctorName || d.DoctorName || d.name || 'Doctor'
        })));
      } else {
        api.get<any>('/doctors').then((dRes: any) => {
          const fallback = Array.isArray(dRes) ? dRes : (dRes?.data || dRes?.Data || []);
          setDoctorsList(fallback.map((d: any) => ({
            id: d.id || d.Id,
            name: d.doctorName || d.DoctorName || d.name || 'Doctor'
          })));
        }).catch(() => {});
      }
    }).catch(() => {
      api.get<any>('/doctors').then((dRes: any) => {
        const fallback = Array.isArray(dRes) ? dRes : (dRes?.data || dRes?.Data || []);
        setDoctorsList(fallback.map((d: any) => ({
          id: d.id || d.Id,
          name: d.doctorName || d.DoctorName || d.name || 'Doctor'
        })));
      }).catch(() => {});
    });

    // Load users with reception role
    api.get<any>('/reports/receptionists').then((res: any) => {
      const list = Array.isArray(res) ? res : (res?.data || res?.Data || []);
      const names = list.map((r: any) => r.fullName || r.FullName || r.username || r.Username).filter(Boolean);
      if (names.length > 0) {
        setReceptionistsList(Array.from(new Set(names)));
      }
    }).catch(() => {});
  }, []);

  // Fetch report data directly from dedicated server-side endpoints
  const fetchData = async () => {
    setLoading(true);
    setData([]);
    try {
      if (reportType === 'REPORT_SALES') {
        const res = await api.get<any>('/reports/sales', {
          dateFrom,
          dateTo,
          receptionist: selectedReceptionist !== 'ALL' ? selectedReceptionist : undefined
        });
        const rows = Array.isArray(res) ? res : (res?.data || res?.Data || []);
        
        let filtered = rows.map((inv: any) => ({
          invoiceNo: inv.invoiceNo || inv.InvoiceNo || `INV-${inv.id}`,
          patientName: inv.patientName || inv.PatientName || 'Patient',
          receptionist: inv.receptionist || inv.Receptionist || 'Reception Staff',
          issueDate: String(inv.issueDate || inv.IssueDate || '').split('T')[0],
          subTotal: Number(inv.subTotal || inv.SubTotal || 0),
          taxAmount: Number(inv.taxAmount || inv.TaxAmount || 0),
          totalAmount: Number(inv.totalAmount || inv.TotalAmount || 0),
          paidAmount: Number(inv.paidAmount || inv.PaidAmount || 0),
          status: inv.status || inv.Status || 'Paid'
        }));

        if (selectedPaymentStatus === 'PAID') {
          filtered = filtered.filter((r: any) => r.status.toLowerCase() === 'paid');
        } else if (selectedPaymentStatus === 'UNPAID') {
          filtered = filtered.filter((r: any) => r.status.toLowerCase() !== 'paid');
        }

        setData(filtered);
      } else if (reportType === 'REPORT_AGE_STRATIFIED') {
        const res = await api.get<any>('/reports/age-stratified', {
          dateFrom,
          dateTo,
          gender: selectedGender !== 'ALL' ? selectedGender : undefined
        });
        const raw = Array.isArray(res) ? res : (res?.data || res?.Data || []);
        const total = raw.reduce((sum: number, r: any) => sum + Number(r.count || r.Count || 0), 0);
        let cumulative = 0;

        const results = raw.map((r: any) => {
          const count = Number(r.count || r.Count || 0);
          const maleCount = Number(r.maleCount || r.MaleCount || 0);
          const femaleCount = Number(r.femaleCount || r.FemaleCount || 0);
          cumulative += count;
          return {
            groupKey: r.ageGroup || r.AgeGroup,
            ageBracket: r.ageBracket || r.AgeBracket,
            maleCount,
            femaleCount,
            count,
            percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0',
            cumulativeCount: cumulative
          };
        }).filter((r: any) => selectedAgeGroup === 'ALL' || r.groupKey === selectedAgeGroup);

        setData(results);
      } else if (reportType === 'REPORT_SEX_STRATIFIED') {
        const res = await api.get<any>('/reports/sex-stratified', {
          dateFrom,
          dateTo,
          gender: selectedGender !== 'ALL' ? selectedGender : undefined
        });
        const raw = Array.isArray(res) ? res : (res?.data || res?.Data || []);
        const total = raw.reduce((sum: number, r: any) => sum + Number(r.count || r.Count || 0), 0);

        const sexRows = raw.map((r: any) => {
          const count = Number(r.count || r.Count || 0);
          const g = r.gender || r.Gender || 'Other';
          return {
            gender: g,
            count,
            percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0',
            description: `${g} clinical encounters in selected period`
          };
        });

        setData(sexRows);
      } else if (reportType === 'REPORT_DOCTOR_PERFORMANCE') {
        const res = await api.get<any>('/reports/doctor-performance', {
          dateFrom,
          dateTo,
          doctor: selectedDoctor !== 'ALL' ? selectedDoctor : undefined
        });
        const raw = Array.isArray(res) ? res : (res?.data || res?.Data || []);
        
        let rows = raw.map((d: any) => ({
          userId: d.userId || d.UserId,
          doctorId: d.doctorId || d.DoctorId,
          doctorName: d.doctorName || d.DoctorName,
          specialty: d.specialty || d.Specialty || 'General Practice',
          consultations: Number(d.consultations || d.Consultations || 0),
          procedures: Number(d.procedures || d.Procedures || 0),
          procedureRevenue: Number(d.procedureRevenue || d.ProcedureRevenue || 0),
          totalRevenue: Number(d.totalRevenue || d.TotalRevenue || 0),
          revenue: Number(d.totalRevenue || d.TotalRevenue || 0)
        }));

        if (selectedSpecialty !== 'ALL') {
          rows = rows.filter((r: any) => r.specialty.toLowerCase().includes(selectedSpecialty.toLowerCase()));
        }

        setData(rows);
      } else if (reportType === 'REPORT_DIAGNOSIS') {
        const res = await api.get<any>('/reports/diagnosis', {
          dateFrom,
          dateTo,
          category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
          limit: parseInt(selectedLimit, 10) || 50
        });
        const raw = Array.isArray(res) ? res : (res?.data || res?.Data || []);
        const rows = raw.map((d: any) => ({
          code: d.code || d.Code || 'CLINICAL',
          description: d.description || d.Description || 'Illness diagnosis',
          category: d.category || d.Category || 'General Clinical',
          count: Number(d.count || d.Count || 0)
        }));

        setData(rows);
      } else if (reportType === 'REPORT_PROCEDURE') {
        const res = await api.get<any>('/reports/procedures', {
          dateFrom,
          dateTo,
          category: selectedCategory !== 'ALL' ? selectedCategory : undefined
        });
        const raw = Array.isArray(res) ? res : (res?.data || res?.Data || []);
        const rows = raw.map((p: any) => ({
          procedureName: p.procedureName || p.ProcedureName,
          category: p.category || p.Category || 'Clinical Procedure',
          orderCount: Number(p.orderCount || p.OrderCount || 0),
          unitPrice: Number(p.unitPrice || p.UnitPrice || 0),
          totalRevenue: Number(p.totalRevenue || p.TotalRevenue || 0)
        }));

        setData(rows);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [
    reportType, dateFrom, dateTo, selectedReceptionist, selectedPaymentStatus,
    selectedAgeGroup, selectedGender, selectedDoctor, selectedSpecialty,
    selectedLimit, selectedCategory
  ]);

  // Export functions
  const exportToCSV = () => {
    if (data.length === 0) return;
    const keys = Object.keys(data[0]);
    const csvContent = [
      keys.join(','),
      ...data.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportedAlert('Report exported to Excel (CSV) successfully!');
    setTimeout(() => setExportedAlert(null), 3000);
  };

  const exportToPrint = () => {
    window.print();
  };

  // KPI Calculations
  const salesSummary = useMemo(() => {
    if (reportType !== 'REPORT_SALES') return null;
    const totalBilled = data.reduce((s, r) => s + (r.totalAmount || 0), 0);
    const totalPaid = data.reduce((s, r) => s + (r.paidAmount || 0), 0);
    const totalVat = data.reduce((s, r) => s + (r.taxAmount || 0), 0);
    return { count: data.length, totalBilled, totalPaid, totalVat };
  }, [reportType, data]);

  const docSummary = useMemo(() => {
    if (reportType !== 'REPORT_DOCTOR_PERFORMANCE') return null;
    const consultations = data.reduce((s, r) => s + (r.consultations || 0), 0);
    const procedures = data.reduce((s, r) => s + (r.procedures || 0), 0);
    const revenue = data.reduce((s, r) => s + (r.totalRevenue || r.revenue || 0), 0);
    const topDoc = data[0]?.doctorName || 'N/A';
    return { doctorsCount: data.length, consultations, procedures, revenue, topDoc };
  }, [reportType, data]);

  const procedureSummary = useMemo(() => {
    if (reportType !== 'REPORT_PROCEDURE') return null;
    const totalOrders = data.reduce((s, r) => s + (r.orderCount || 0), 0);
    const totalRevenue = data.reduce((s, r) => s + (r.totalRevenue || 0), 0);
    return { count: data.length, totalOrders, totalRevenue };
  }, [reportType, data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {exportedAlert && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, padding: '12px 20px', background: '#059669', color: '#fff', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          <Check size={18} /> {exportedAlert}
        </div>
      )}

      {/* Header Panel */}
      <div className="glass-panel no-print" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
            {config.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-info">{config.category}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clinic Tenant #1</span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{config.title}</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0', maxWidth: '720px' }}>
              {config.description}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={fetchData} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button onClick={exportToCSV} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} /> Export CSV / Excel
          </button>
          <button onClick={exportToPrint} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Print / PDF
          </button>
        </div>
      </div>

      {/* ALL FILTERS AS CLEAN DROPDOWNS BAR */}
      <div className="glass-panel no-print" style={{ padding: '18px 22px' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
          Report Filters (Select from dropdowns)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
          
          {/* Universal Date Range Preset Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Date Range</label>
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value as any)}
              style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, minWidth: '160px' }}
            >
              <option value="this_month">This Month (Current)</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year (YTD)</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Custom Date Pickers (only shown if Custom selected) */}
          {datePreset === 'custom' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>From Date</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>To Date</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                />
              </div>
            </>
          )}

          {/* Sales Report: Receptionist & Status Dropdowns */}
          {reportType === 'REPORT_SALES' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Receptionist / Cashier</label>
                <select
                  value={selectedReceptionist}
                  onChange={e => setSelectedReceptionist(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '170px' }}
                >
                  <option value="ALL">All Cashiers / Receptionists</option>
                  {receptionistsList.map((rec, i) => (
                    <option key={i} value={rec}>{rec}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Payment Status</label>
                <select
                  value={selectedPaymentStatus}
                  onChange={e => setSelectedPaymentStatus(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '140px' }}
                >
                  <option value="ALL">All Invoices</option>
                  <option value="PAID">Paid Only</option>
                  <option value="UNPAID">Issued / Unpaid</option>
                </select>
              </div>
            </>
          )}

          {/* Age Stratified Report: Age Group & Gender Dropdowns */}
          {reportType === 'REPORT_AGE_STRATIFIED' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Age Group Filter</label>
                <select
                  value={selectedAgeGroup}
                  onChange={e => setSelectedAgeGroup(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '180px' }}
                >
                  <option value="ALL">All Age Brackets</option>
                  <option value="<1">&lt; 1 Year (Infant)</option>
                  <option value="1-4">1 - 4 Years (Toddler)</option>
                  <option value="5-14">5 - 14 Years (Child)</option>
                  <option value="15-29">15 - 29 Years (Youth)</option>
                  <option value="30-64">30 - 64 Years (Adult)</option>
                  <option value=">=65">≥ 65 Years (Senior)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Gender Breakdown</label>
                <select
                  value={selectedGender}
                  onChange={e => setSelectedGender(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '130px' }}
                >
                  <option value="ALL">All Genders</option>
                  <option value="Male">Male Only</option>
                  <option value="Female">Female Only</option>
                </select>
              </div>
            </>
          )}

          {/* Sex Stratified Report: Gender Dropdown */}
          {reportType === 'REPORT_SEX_STRATIFIED' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Gender Selection</label>
              <select
                value={selectedGender}
                onChange={e => setSelectedGender(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '160px' }}
              >
                <option value="ALL">All Genders (Comparison)</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          )}

          {/* Doctor Performance: Doctor & Specialty Dropdowns */}
          {reportType === 'REPORT_DOCTOR_PERFORMANCE' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Doctor / Practitioner</label>
                <select
                  value={selectedDoctor}
                  onChange={e => setSelectedDoctor(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '180px' }}
                >
                  <option value="ALL">All Attending Doctors</option>
                  {doctorsList.map((d, idx) => (
                    <option key={idx} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Specialization</label>
                <select
                  value={selectedSpecialty}
                  onChange={e => setSelectedSpecialty(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '160px' }}
                >
                  <option value="ALL">All Specialties</option>
                  <option value="General Practice">General Practice</option>
                  <option value="Internal Medicine">Internal Medicine</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Surgery">Surgery</option>
                  <option value="Obstetrics & Gynecology">Obstetrics & Gynecology</option>
                </select>
              </div>
            </>
          )}

          {/* Diagnosis Report: Category & Top Ranking Dropdowns */}
          {reportType === 'REPORT_DIAGNOSIS' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Disease Category</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '160px' }}
                >
                  <option value="ALL">All Diagnostic Categories</option>
                  <option value="Respiratory">Respiratory Conditions</option>
                  <option value="Cardiovascular">Cardiovascular</option>
                  <option value="Digestive">Digestive Disorders</option>
                  <option value="Infectious">Infectious & Parasitic</option>
                  <option value="Endocrine">Endocrine & Metabolic</option>
                  <option value="Musculoskeletal">Musculoskeletal</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Display Ranking</label>
                <select
                  value={selectedLimit}
                  onChange={e => setSelectedLimit(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '140px' }}
                >
                  <option value="10">Top 10 Diagnoses</option>
                  <option value="25">Top 25 Diagnoses</option>
                  <option value="50">Top 50 Diagnoses</option>
                  <option value="100">Top 100 Diagnoses</option>
                </select>
              </div>
            </>
          )}

          {/* Procedure Report: Category Dropdown */}
          {reportType === 'REPORT_PROCEDURE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Procedure Category</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', minWidth: '180px' }}
              >
                <option value="ALL">All Procedure Categories</option>
                <option value="Facial Aesthetics">Facial Aesthetics</option>
                <option value="PRP Regenerative">PRP Regenerative</option>
                <option value="Intralesional Injection">Intralesional Injection</option>
                <option value="Electrotherapy">Electrotherapy</option>
                <option value="Acne & Scarring">Acne & Scarring</option>
                <option value="Cryosurgery">Cryosurgery</option>
                <option value="Laser & Pigment">Laser & Pigment</option>
                <option value="Hair Restoration">Hair Restoration</option>
                <option value="Clinical Procedure">Other Clinical Procedure</option>
              </select>
            </div>
          )}

        </div>
      </div>

      {/* KPI METRIC CARDS ROW */}
      {salesSummary && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Invoices</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: 'var(--text-main)' }}>{salesSummary.count}</div>
            <span style={{ fontSize: '0.72rem', color: '#0284c7' }}>Billable Transactions</span>
          </div>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Billed (Excl. Waived)</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: '#0284c7' }}>Br {salesSummary.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gross Invoiced</span>
          </div>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>VAT Collected (15%)</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: '#eab308' }}>Br {salesSummary.totalVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Value Added Tax</span>
          </div>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Net Paid Sales Revenue</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: '#059669' }}>Br {salesSummary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <span style={{ fontSize: '0.72rem', color: '#059669' }}>✓ Waived / free excluded</span>
          </div>
        </div>
      )}

      {docSummary && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attending Doctors</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: 'var(--text-main)' }}>{docSummary.doctorsCount}</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Active Practitioners</span>
          </div>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Consultations</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: '#0284c7' }}>{docSummary.consultations}</div>
            <span style={{ fontSize: '0.72rem', color: '#0284c7' }}>Encounters Handled</span>
          </div>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Procedures Done</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: '#7c3aed' }}>{docSummary.procedures}</div>
            <span style={{ fontSize: '0.72rem', color: '#7c3aed' }}>Completed Interventions</span>
          </div>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attributed Revenue</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: '#059669' }}>Br {docSummary.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <span style={{ fontSize: '0.72rem', color: '#059669' }}>Total Gross Collections</span>
          </div>
        </div>
      )}

      {procedureSummary && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Distinct Procedures</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: 'var(--text-main)' }}>{procedureSummary.count}</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Procedure Catalog Items</span>
          </div>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Completed Interventions</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: '#0284c7' }}>{procedureSummary.totalOrders}</div>
            <span style={{ fontSize: '0.72rem', color: '#0284c7' }}>Interventions Executed</span>
          </div>
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Procedure Revenue Total</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0', color: '#059669' }}>Br {procedureSummary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <span style={{ fontSize: '0.72rem', color: '#059669' }}>Total Gross Yield</span>
          </div>
        </div>
      )}

      {/* REPORT DATA TABLE */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div className="print-only" style={{ display: 'none', marginBottom: '20px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 4px 0' }}>Huderma Specialty Clinic</h2>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px 0', color: '#0369a1' }}>{config.title}</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
            Period: {dateFrom} to {dateTo} | Generated on: {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Itemized Report Output
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {data.length} record{data.length !== 1 ? 's' : ''} returned for selected criteria
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Compiling report data...</div>
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>No records found</div>
            <div style={{ fontSize: '0.82rem' }}>Try adjusting your date range or filter dropdowns above.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="cms-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  {reportType === 'REPORT_SALES' && (
                    <>
                      <th>Invoice No</th>
                      <th>Patient Name</th>
                      <th>Receptionist / Cashier</th>
                      <th>Issue Date</th>
                      <th style={{ textAlign: 'right' }}>SubTotal (Br)</th>
                      <th style={{ textAlign: 'right' }}>VAT 15% (Br)</th>
                      <th style={{ textAlign: 'right' }}>Total (Br)</th>
                      <th style={{ textAlign: 'right' }}>Paid (Br)</th>
                      <th>Status</th>
                    </>
                  )}
                  {reportType === 'REPORT_AGE_STRATIFIED' && (
                    <>
                      <th>Age Bracket</th>
                      <th style={{ textAlign: 'right' }}>Male Count</th>
                      <th style={{ textAlign: 'right' }}>Female Count</th>
                      <th style={{ textAlign: 'right' }}>Total Count</th>
                      <th style={{ textAlign: 'right' }}>Percentage Share (%)</th>
                      <th style={{ textAlign: 'right' }}>Cumulative Total</th>
                    </>
                  )}
                  {reportType === 'REPORT_SEX_STRATIFIED' && (
                    <>
                      <th>Gender</th>
                      <th style={{ textAlign: 'right' }}>Registered Patients</th>
                      <th style={{ textAlign: 'right' }}>Share of Patient Base (%)</th>
                      <th>Demographic Notes</th>
                    </>
                  )}
                  {reportType === 'REPORT_DOCTOR_PERFORMANCE' && (
                    <>
                      <th>Practitioner Name</th>
                      <th>Specialty / Department</th>
                      <th style={{ textAlign: 'right' }}>Consultations Count</th>
                      <th style={{ textAlign: 'right' }}>Procedures Done</th>
                      <th style={{ textAlign: 'right' }}>Procedure Revenue (Br)</th>
                      <th style={{ textAlign: 'right' }}>Total Attributed Revenue (Br)</th>
                    </>
                  )}
                  {reportType === 'REPORT_DIAGNOSIS' && (
                    <>
                      <th>ICD-10 Code</th>
                      <th>Clinical Diagnosis Description</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Encounter Frequency</th>
                    </>
                  )}
                  {reportType === 'REPORT_PROCEDURE' && (
                    <>
                      <th>Procedure Description</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Total Orders</th>
                      <th style={{ textAlign: 'right' }}>Unit Price (Br)</th>
                      <th style={{ textAlign: 'right' }}>Total Yield (Br)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {reportType === 'REPORT_SALES' && data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{r.invoiceNo}</td>
                    <td style={{ fontWeight: 600 }}>{r.patientName}</td>
                    <td>{r.receptionist}</td>
                    <td>{r.issueDate}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>Br {r.subTotal.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>Br {r.taxAmount.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>Br {r.totalAmount.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>Br {r.paidAmount.toFixed(2)}</td>
                    <td>
                      <span className={r.status === 'Paid' ? 'badge badge-normal' : 'badge badge-warning'}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {reportType === 'REPORT_AGE_STRATIFIED' && data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{r.ageBracket}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{r.maleCount ?? 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ec4899' }}>{r.femaleCount ?? 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>{r.count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.percentage}%</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{r.cumulativeCount}</td>
                  </tr>
                ))}

                {reportType === 'REPORT_SEX_STRATIFIED' && data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: r.gender === 'Male' ? '#0284c7' : '#ec4899' }}>{r.gender}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.percentage}%</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.description}</td>
                  </tr>
                ))}

                {reportType === 'REPORT_DOCTOR_PERFORMANCE' && data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{r.doctorName}</td>
                    <td><span className="badge badge-info">{r.specialty}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{r.consultations}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{r.procedures}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669', fontFamily: 'monospace' }}>Br {(r.procedureRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>Br {(r.totalRevenue || r.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}

                {reportType === 'REPORT_DIAGNOSIS' && data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#dc2626' }}>{r.code}</td>
                    <td style={{ fontWeight: 600 }}>{r.description}</td>
                    <td><span className="badge badge-info">{r.category}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{r.count}</td>
                  </tr>
                ))}

                {reportType === 'REPORT_PROCEDURE' && data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{r.procedureName}</td>
                    <td><span className="badge badge-info">{r.category}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{r.orderCount}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>Br {r.unitPrice.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>Br {r.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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
