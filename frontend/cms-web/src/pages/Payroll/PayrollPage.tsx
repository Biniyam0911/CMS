import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Calendar, Users, ChevronDown, ChevronRight,
  Save, RefreshCw, CheckCircle2, AlertCircle, Percent,
  Coins, Filter, Layers, Download, Check, Sparkles
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface DoctorItem {
  doctorId: number;
  doctorName: string;
  specialty?: string;
  licenseNumber?: string;
}

interface ServiceItem {
  serviceName: string;
  rateType: number; // 1 = %, 2 = Fixed
  rate: number;
  rateDisplay: string;
  servicePrice: number;
  patientName: string;
  doctorShare: number;
  hasAgreement: boolean;
}

interface CategoryGroup {
  categoryName: string;
  services: ServiceItem[];
  totalCount: number;
  totalPrice: number;
  totalDoctorShare: number;
}

interface DateGroup {
  date: string;
  categories: CategoryGroup[];
  totalCount: number;
  totalPrice: number;
  totalDoctorShare: number;
}

interface DoctorGroup {
  doctorId: number;
  doctorName: string;
  dates: DateGroup[];
  totalCount: number;
  totalPrice: number;
  totalDoctorShare: number;
}

interface PayrollCalculationData {
  doctors: DoctorGroup[];
  grandTotalCount: number;
  grandTotalPrice: number;
  grandTotalDoctorShare: number;
}

interface AgreementItemState {
  category: string;
  rateType: 1 | 2; // 1: %, 2: Fixed
  rate: number;
  isSelected: boolean;
}

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<'PAYROLL' | 'AGREEMENTS'>('PAYROLL');

  // Common State
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Tab 1: Calculated Payroll State
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [payrollData, setPayrollData] = useState<PayrollCalculationData | null>(null);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [expandedDoctors, setExpandedDoctors] = useState<Record<number, boolean>>({});
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Tab 2: Agreement Setup State
  const [setupDoctorId, setSetupDoctorId] = useState<number | ''>('');
  const [agreementsList, setAgreementsList] = useState<AgreementItemState[]>([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [savingAgreements, setSavingAgreements] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // Load Doctors
  const loadDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const docsRes = await api.get<any[]>('/api/v1/payroll/doctors');
      const rawDocs = (docsRes as any)?.data || (docsRes as any)?.Data || docsRes || [];
      const mappedDocs: DoctorItem[] = (Array.isArray(rawDocs) ? rawDocs : []).map((d: any) => ({
        doctorId: d.doctorId ?? d.DoctorId ?? d.id,
        doctorName: d.doctorName ?? d.DoctorName ?? 'Doctor',
        specialty: d.specialty ?? d.Specialty ?? 'General Practice',
        licenseNumber: d.licenseNumber ?? d.LicenseNumber
      }));
      setDoctors(mappedDocs);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Load Categories
  const loadCategories = async () => {
    try {
      const catsRes = await api.get<string[]>('/api/v1/payroll/categories');
      const rawCats = (catsRes as any)?.data || (catsRes as any)?.Data || catsRes || [];
      if (Array.isArray(rawCats) && rawCats.length > 0) {
        setCategories(rawCats);
      } else {
        setCategories([
          'Consultation', 'Facial Aesthetics', 'PRP Regenerative',
          'Intralesional Injection', 'Electrotherapy', 'Acne & Scarring',
          'Cryosurgery', 'Laser & Pigment', 'Hair Restoration',
          'Minor Procedure', 'General Service'
        ]);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      setCategories([
        'Consultation', 'Facial Aesthetics', 'PRP Regenerative',
        'Intralesional Injection', 'Electrotherapy', 'Acne & Scarring',
        'Cryosurgery', 'Laser & Pigment', 'Hair Restoration',
        'Minor Procedure', 'General Service'
      ]);
    }
  };

  // Initial Load
  useEffect(() => {
    loadDoctors();
    loadCategories();
  }, []);

  // When switching to Agreements tab, ensure doctors are loaded
  useEffect(() => {
    if (activeTab === 'AGREEMENTS' && doctors.length === 0) {
      loadDoctors();
    }
  }, [activeTab]);

  // Fetch Calculated Payroll
  const fetchPayroll = async () => {
    setLoadingPayroll(true);
    try {
      const params: Record<string, any> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (selectedDoctorId !== 'ALL') params.doctorId = selectedDoctorId;

      const res = await api.get<PayrollCalculationData>('/api/v1/payroll/calculate', params);
      const data = (res as any)?.data || (res as any)?.Data || res;
      setPayrollData(data);

      // Auto-expand top doctor and recent date for convenience
      if (data && data.doctors && data.doctors.length > 0) {
        const docExp: Record<number, boolean> = {};
        const dateExp: Record<string, boolean> = {};
        const catExp: Record<string, boolean> = {};

        data.doctors.forEach((d: DoctorGroup, docIdx: number) => {
          if (docIdx === 0 || data.doctors.length === 1) {
            docExp[d.doctorId] = true;
            if (d.dates && d.dates.length > 0) {
              const firstDate = d.dates[0];
              const dateKey = `${d.doctorId}_${firstDate.date}`;
              dateExp[dateKey] = true;
              if (firstDate.categories && firstDate.categories.length > 0) {
                firstDate.categories.forEach((c: CategoryGroup) => {
                  catExp[`${dateKey}_${c.categoryName}`] = true;
                });
              }
            }
          }
        });

        setExpandedDoctors(docExp);
        setExpandedDates(dateExp);
        setExpandedCategories(catExp);
      }
    } catch (err) {
      console.error('Failed to calculate payroll:', err);
    } finally {
      setLoadingPayroll(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'PAYROLL') {
      fetchPayroll();
    }
  }, [activeTab]);

  // Expand / Collapse Handlers
  const toggleDoctor = (doctorId: number) => {
    setExpandedDoctors(prev => ({ ...prev, [doctorId]: !prev[doctorId] }));
  };

  const toggleDate = (key: string) => {
    setExpandedDates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    if (!payrollData?.doctors) return;
    const docExp: Record<number, boolean> = {};
    const dateExp: Record<string, boolean> = {};
    const catExp: Record<string, boolean> = {};

    payrollData.doctors.forEach(d => {
      docExp[d.doctorId] = true;
      d.dates.forEach(dt => {
        const dateKey = `${d.doctorId}_${dt.date}`;
        dateExp[dateKey] = true;
        dt.categories.forEach(c => {
          catExp[`${dateKey}_${c.categoryName}`] = true;
        });
      });
    });

    setExpandedDoctors(docExp);
    setExpandedDates(dateExp);
    setExpandedCategories(catExp);
  };

  const collapseAll = () => {
    setExpandedDoctors({});
    setExpandedDates({});
    setExpandedCategories({});
  };

  // Tab 2: Load Agreements when Doctor is selected
  useEffect(() => {
    if (activeTab !== 'AGREEMENTS' || !setupDoctorId) return;

    const loadDoctorAgreements = async () => {
      setLoadingAgreements(true);
      setSaveSuccessMsg(null);
      try {
        const res = await api.get<any[]>('/api/v1/payroll/agreements', { doctorId: setupDoctorId });
        const existing = (res as any)?.data || (res as any)?.Data || res || [];

        const existingMap = new Map<string, { rateType: 1 | 2; rate: number; isActive: boolean }>();
        existing.forEach((item: any) => {
          const cat = item.category ?? item.Category;
          const rt = (item.rateType ?? item.RateType) === 2 ? 2 : 1;
          const r = Number(item.rate ?? item.Rate ?? 0);
          const active = item.isActive ?? item.IsActive ?? true;
          if (cat) existingMap.set(cat, { rateType: rt, rate: r, isActive: active });
        });

        // Merge standard categories + any custom in DB
        const allCats = Array.from(new Set([...categories, ...Array.from(existingMap.keys())]));

        const initializedList: AgreementItemState[] = allCats.map(cat => {
          const found = existingMap.get(cat);
          return {
            category: cat,
            rateType: found?.rateType ?? 1,
            rate: found?.rate ?? 0,
            isSelected: !!found && found.isActive
          };
        });

        setAgreementsList(initializedList);
      } catch (err) {
        console.error('Failed to load agreements for doctor:', err);
      } finally {
        setLoadingAgreements(false);
      }
    };

    loadDoctorAgreements();
  }, [setupDoctorId, activeTab, categories]);

  // Update Agreement Row
  const updateAgreementRow = (category: string, field: keyof AgreementItemState, value: any) => {
    setAgreementsList(prev =>
      prev.map(row => (row.category === category ? { ...row, [field]: value } : row))
    );
  };

  // Quick Action: Set uniform rate for all selected
  const applyUniformRate = (rate: number, rateType: 1 | 2) => {
    setAgreementsList(prev =>
      prev.map(row => ({
        ...row,
        isSelected: true,
        rate,
        rateType
      }))
    );
  };

  // Add Custom Category
  const handleAddCustomCategory = () => {
    if (!customCategoryInput.trim()) return;
    const cat = customCategoryInput.trim();
    if (agreementsList.some(r => r.category.toLowerCase() === cat.toLowerCase())) {
      alert('Category already exists in the list.');
      return;
    }
    setAgreementsList(prev => [
      ...prev,
      { category: cat, rateType: 1, rate: 30, isSelected: true }
    ]);
    setCustomCategoryInput('');
  };

  // Save Doctor Agreements
  const handleSaveAgreements = async () => {
    if (!setupDoctorId) {
      alert('Please select a doctor first.');
      return;
    }

    setSavingAgreements(true);
    setSaveSuccessMsg(null);
    try {
      const payload = {
        doctorId: Number(setupDoctorId),
        agreements: agreementsList.map(a => ({
          category: a.category,
          rateType: a.rateType,
          rate: Number(a.rate) || 0,
          isActive: a.isSelected
        }))
      };

      await api.post('/api/v1/payroll/agreements', payload);
      setSaveSuccessMsg('Doctor agreements saved successfully! Future calculations will apply these rates.');
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Failed to save agreements:', err);
      alert('Failed to save agreements. Please try again.');
    } finally {
      setSavingAgreements(false);
    }
  };

  // CSV Export
  const exportToCsv = () => {
    if (!payrollData?.doctors || payrollData.doctors.length === 0) {
      alert('No payroll data available to export.');
      return;
    }

    const rows: string[][] = [
      ['Doctor', 'Date', 'Category', 'Service Name', 'Patient Name', 'Rate Agreement', 'Service Price (ETB)', "Doctor's Share (ETB)"]
    ];

    payrollData.doctors.forEach(doc => {
      doc.dates.forEach(dt => {
        dt.categories.forEach(cat => {
          cat.services.forEach(s => {
            rows.push([
              doc.doctorName,
              dt.date,
              cat.categoryName,
              `"${s.serviceName.replace(/"/g, '""')}"`,
              `"${s.patientName.replace(/"/g, '""')}"`,
              s.rateDisplay,
              s.servicePrice.toFixed(2),
              s.doctorShare.toFixed(2)
            ]);
          });
        });
      });
    });

    // Grand total row
    rows.push([]);
    rows.push(['GRAND TOTAL', '', '', `${payrollData.grandTotalCount} Services`, '', '', payrollData.grandTotalPrice.toFixed(2), payrollData.grandTotalDoctorShare.toFixed(2)]);

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payroll_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '0 4px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Page Title & Module Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', padding: '6px', borderRadius: '10px', background: 'linear-gradient(135deg, #0071e3 0%, #34c759 100%)', color: '#fff' }}>
              <Coins size={24} />
            </span>
            Doctor Payroll & Commissions
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Automated doctor revenue share calculation grouped hierarchically by Doctor, Date, Category, and Service
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.04)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('PAYROLL')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '9px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'PAYROLL' ? '#0071e3' : 'transparent',
              color: activeTab === 'PAYROLL' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'PAYROLL' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'none'
            }}
          >
            <DollarSign size={16} />
            Calculated Payroll
          </button>

          <button
            onClick={() => setActiveTab('AGREEMENTS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '9px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'AGREEMENTS' ? '#0071e3' : 'transparent',
              color: activeTab === 'AGREEMENTS' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'AGREEMENTS' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'none'
            }}
          >
            <Layers size={16} />
            Agreement Setup
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: CALCULATED PAYROLL */}
      {/* ============================================================== */}
      {activeTab === 'PAYROLL' && (
        <div>
          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '14px', marginBottom: '20px', border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
              {/* Date From */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Date From
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Date To */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    outline: 'none'
                  }}
                />
              </div>

              {/* Doctor Dropdown Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Filter by Doctor
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={e => setSelectedDoctorId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    outline: 'none',
                    minWidth: '220px'
                  }}
                >
                  <option value="ALL">All Doctors ({doctors.length})</option>
                  {doctors.map(doc => (
                    <option key={doc.doctorId} value={doc.doctorId}>
                      {doc.doctorName} {doc.specialty ? `(${doc.specialty})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDateFrom(today);
                    setDateTo(today);
                  }}
                  style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setDateFrom(d.toISOString().split('T')[0]);
                    setDateTo(new Date().toISOString().split('T')[0]);
                  }}
                  style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - 1);
                    setDateFrom(d.toISOString().split('T')[0]);
                    setDateTo(new Date().toISOString().split('T')[0]);
                  }}
                  style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Last Month
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={fetchPayroll}
                disabled={loadingPayroll}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '9px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={15} className={loadingPayroll ? 'animate-spin' : ''} />
                {loadingPayroll ? 'Calculating...' : 'Calculate'}
              </button>

              <button
                type="button"
                onClick={exportToCsv}
                disabled={!payrollData || payrollData.grandTotalCount === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '9px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Quick Expand/Collapse Controls & Summary Header */}
          {payrollData && payrollData.doctors.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  View Controls:
                </span>
                <button
                  type="button"
                  onClick={expandAll}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#0071e3'
                  }}
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Collapse All
                </button>
              </div>

              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Showing <strong style={{ color: 'var(--text-main)' }}>{payrollData.doctors.length}</strong> doctor(s) •{' '}
                <strong style={{ color: 'var(--text-main)' }}>{payrollData.grandTotalCount}</strong> total services
              </div>
            </div>
          )}

          {/* Payroll Tree Hierarchy */}
          {loadingPayroll ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '14px' }}>
              <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 14px auto', color: '#0071e3' }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Calculating Doctor Payroll...
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Querying completed encounters, billing invoices, and active rate agreements
              </p>
            </div>
          ) : !payrollData || payrollData.doctors.length === 0 ? (
            <div className="glass-panel" style={{ padding: '50px 20px', textAlign: 'center', borderRadius: '14px', border: '1px dashed var(--border-color)' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 12px auto', color: '#ff9500' }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                No Payroll Records Found
              </h3>
              <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '480px', marginInline: 'auto' }}>
                No encounters or invoice items match the selected date range ({dateFrom} to {dateTo}) and doctor filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDateFrom('2024-01-01');
                  setDateTo(new Date().toISOString().split('T')[0]);
                  setSelectedDoctorId('ALL');
                }}
                className="btn-primary"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Expand Date Range to All Time
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {payrollData.doctors.map(doctor => {
                const isDocExpanded = !!expandedDoctors[doctor.doctorId];

                return (
                  <div
                    key={doctor.doctorId}
                    className="glass-panel"
                    style={{
                      borderRadius: '14px',
                      border: '1px solid var(--border-color)',
                      overflow: 'hidden',
                      background: 'var(--bg-card)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                    }}
                  >
                    {/* Level 1: DOCTOR HEADER (Expandable) */}
                    <div
                      onClick={() => toggleDoctor(doctor.doctorId)}
                      style={{
                        padding: '14px 20px',
                        background: isDocExpanded ? 'rgba(0, 113, 227, 0.05)' : 'transparent',
                        borderBottom: isDocExpanded ? '1px solid var(--border-color)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        userSelect: 'none',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ color: '#0071e3', display: 'flex', alignItems: 'center' }}>
                          {isDocExpanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
                        </div>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e1f0ff', color: '#0071e3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                          <Users size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            {doctor.doctorName}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            ID #{doctor.doctorId} • {doctor.dates.length} Active Date(s) • {doctor.totalCount} Services
                          </div>
                        </div>
                      </div>

                      {/* Doctor Totals Summary */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            Total Revenue
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            ETB {doctor.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', padding: '6px 14px', borderRadius: '10px', background: 'rgba(52, 199, 89, 0.12)', border: '1px solid rgba(52, 199, 89, 0.3)' }}>
                          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#1b873f', fontWeight: 800 }}>
                            Doctor's Share (Salary)
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#166534' }}>
                            ETB {doctor.totalDoctorShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Level 2: DATES (when Doctor is expanded) */}
                    {isDocExpanded && (
                      <div style={{ padding: '12px 18px', background: 'var(--bg-dark)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {doctor.dates.map(dateGroup => {
                            const dateKey = `${doctor.doctorId}_${dateGroup.date}`;
                            const isDateExpanded = !!expandedDates[dateKey];

                            return (
                              <div
                                key={dateKey}
                                style={{
                                  borderRadius: '10px',
                                  border: '1px solid var(--border-color)',
                                  overflow: 'hidden',
                                  background: 'var(--bg-card)'
                                }}
                              >
                                {/* Date Header */}
                                <div
                                  onClick={() => toggleDate(dateKey)}
                                  style={{
                                    padding: '10px 16px',
                                    background: isDateExpanded ? 'rgba(0,0,0,0.03)' : 'transparent',
                                    borderBottom: isDateExpanded ? '1px solid var(--border-color)' : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    userSelect: 'none'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ color: 'var(--text-secondary)' }}>
                                      {isDateExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    </div>
                                    <Calendar size={16} style={{ color: '#0071e3' }} />
                                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                      {dateGroup.date}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                      {dateGroup.totalCount} service{dateGroup.totalCount !== 1 ? 's' : ''}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', gap: '18px', fontSize: '0.85rem' }}>
                                    <div>
                                      <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>Price:</span>
                                      <strong>ETB {dateGroup.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                    <div>
                                      <span style={{ color: '#166534', marginRight: '6px', fontWeight: 600 }}>Doctor's Share:</span>
                                      <strong style={{ color: '#166534' }}>ETB {dateGroup.totalDoctorShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                  </div>
                                </div>

                                {/* Level 3: CATEGORIES (when Date is expanded) */}
                                {isDateExpanded && (
                                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.015)' }}>
                                    {dateGroup.categories.map(catGroup => {
                                      const catKey = `${dateKey}_${catGroup.categoryName}`;
                                      const isCatExpanded = !!expandedCategories[catKey];

                                      return (
                                        <div
                                          key={catKey}
                                          style={{
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            overflow: 'hidden',
                                            background: 'var(--bg-card)'
                                          }}
                                        >
                                          {/* Category Header */}
                                          <div
                                            onClick={() => toggleCategory(catKey)}
                                            style={{
                                              padding: '8px 14px',
                                              background: isCatExpanded ? 'rgba(0, 113, 227, 0.04)' : 'transparent',
                                              borderBottom: isCatExpanded ? '1px solid var(--border-color)' : 'none',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              userSelect: 'none'
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <div style={{ color: 'var(--text-secondary)' }}>
                                                {isCatExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                              </div>
                                              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                                {catGroup.categoryName}
                                              </span>
                                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: '8px' }}>
                                                {catGroup.totalCount} item{catGroup.totalCount !== 1 ? 's' : ''}
                                              </span>
                                            </div>

                                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem' }}>
                                              <div>
                                                <span style={{ color: 'var(--text-secondary)', marginRight: '4px' }}>Subtotal:</span>
                                                <strong>ETB {catGroup.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                              </div>
                                              <div>
                                                <span style={{ color: '#166534', marginRight: '4px', fontWeight: 600 }}>Doctor:</span>
                                                <strong style={{ color: '#166534' }}>ETB {catGroup.totalDoctorShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Level 4: SERVICE ROWS (when Category is expanded) */}
                                          {isCatExpanded && (
                                            <div style={{ overflowX: 'auto' }}>
                                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
                                                <thead>
                                                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    <th style={{ padding: '8px 14px', fontWeight: 700 }}>Service Description</th>
                                                    <th style={{ padding: '8px 14px', fontWeight: 700 }}>Agreement Rate</th>
                                                    <th style={{ padding: '8px 14px', fontWeight: 700, textAlign: 'right' }}>Price of Service</th>
                                                    <th style={{ padding: '8px 14px', fontWeight: 700 }}>Patient Name</th>
                                                    <th style={{ padding: '8px 14px', fontWeight: 700, textAlign: 'right' }}>Doctor's Share</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {catGroup.services.map((svc, svcIdx) => (
                                                    <tr
                                                      key={svcIdx}
                                                      style={{
                                                        borderBottom: svcIdx < catGroup.services.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                        transition: 'background 0.15s'
                                                      }}
                                                    >
                                                      <td style={{ padding: '8px 14px', fontWeight: 600, color: 'var(--text-main)' }}>
                                                        {svc.serviceName}
                                                      </td>
                                                      <td style={{ padding: '8px 14px' }}>
                                                        <span
                                                          style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.76rem',
                                                            fontWeight: 700,
                                                            background: svc.hasAgreement ? 'rgba(0, 113, 227, 0.08)' : 'rgba(255, 149, 0, 0.1)',
                                                            color: svc.hasAgreement ? '#0071e3' : '#b45309'
                                                          }}
                                                        >
                                                          {svc.rateType === 1 ? <Percent size={11} /> : <Coins size={11} />}
                                                          {svc.rateDisplay}
                                                        </span>
                                                      </td>
                                                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                                                        ETB {svc.servicePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                      </td>
                                                      <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                                                        {svc.patientName}
                                                      </td>
                                                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>
                                                        ETB {svc.doctorShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                      </td>
                                                    </tr>
                                                  ))}

                                                  {/* Category Count & Sum Row */}
                                                  <tr style={{ background: 'rgba(0, 113, 227, 0.04)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                                                    <td style={{ padding: '8px 14px', color: 'var(--text-main)' }}>
                                                      Category Summary: {catGroup.categoryName} ({catGroup.totalCount} item{catGroup.totalCount !== 1 ? 's' : ''})
                                                    </td>
                                                    <td style={{ padding: '8px 14px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                                      Count: {catGroup.totalCount}
                                                    </td>
                                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-main)' }}>
                                                      ETB {catGroup.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td style={{ padding: '8px 14px' }}></td>
                                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#166534', fontSize: '0.9rem' }}>
                                                      ETB {catGroup.totalDoctorShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* GRAND TOTAL SUMMARY BAR AT BOTTOM */}
              <div
                className="glass-panel"
                style={{
                  marginTop: '10px',
                  padding: '18px 24px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.08) 0%, rgba(52, 199, 89, 0.12) 100%)',
                  border: '2px solid rgba(0, 113, 227, 0.25)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 800 }}>
                    Payroll Grand Totals (Filtered Range)
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                    {payrollData.grandTotalCount} Total Services across {payrollData.doctors.length} Doctor(s)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      Grand Total Service Revenue
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      ETB {payrollData.grandTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', padding: '10px 18px', borderRadius: '12px', background: '#34c759', color: '#ffffff', boxShadow: '0 4px 14px rgba(52, 199, 89, 0.35)' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 800, opacity: 0.9 }}>
                      Grand Total Doctor Share (Salary Payout)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                      ETB {payrollData.grandTotalDoctorShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: AGREEMENT SETUP */}
      {/* ============================================================== */}
      {activeTab === 'AGREEMENTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Doctor Selection Card */}
          <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} color="#0071e3" />
                  Select Doctor for Agreement Setup
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Configure commission percentage or fixed fee for each procedure category or service
                </p>
              </div>

              <div style={{ minWidth: '300px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={setupDoctorId}
                  onChange={e => setSetupDoctorId(e.target.value ? Number(e.target.value) : '')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '2px solid #0071e3',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxShadow: '0 2px 8px rgba(0, 113, 227, 0.15)'
                  }}
                >
                  <option value="">
                    {loadingDoctors ? 'Loading doctors list...' : `-- Choose a Doctor to Configure (${doctors.length} available) --`}
                  </option>
                  {doctors.map(doc => (
                    <option key={doc.doctorId} value={doc.doctorId}>
                      {doc.doctorName} {doc.specialty ? `• ${doc.specialty}` : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={loadDoctors}
                  title="Reload Doctors List"
                  disabled={loadingDoctors}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <RefreshCw size={16} className={loadingDoctors ? 'animate-spin' : ''} color="#0071e3" />
                </button>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {saveSuccessMsg && (
            <div style={{ padding: '12px 18px', borderRadius: '10px', background: 'rgba(52, 199, 89, 0.15)', border: '1px solid #34c759', color: '#166534', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '0.9rem' }}>
              <CheckCircle2 size={20} color="#166534" />
              {saveSuccessMsg}
            </div>
          )}

          {/* Category Configuration Table */}
          {!setupDoctorId ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '14px', border: '1px dashed var(--border-color)' }}>
              <Users size={48} style={{ margin: '0 auto 14px auto', color: '#0071e3', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                No Doctor Selected
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Please select a doctor from the dropdown above to view and customize their payroll agreements.
              </p>
            </div>
          ) : loadingAgreements ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '14px' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#0071e3' }} />
              <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Loading doctor's agreement profile...</div>
            </div>
          ) : (
            <div className="glass-panel" style={{ borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', overflow: 'hidden' }}>
              {/* Quick Preset Toolbar */}
              <div style={{ padding: '14px 20px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Quick Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => applyUniformRate(30, 1)}
                    style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Set All to 30%
                  </button>
                  <button
                    type="button"
                    onClick={() => applyUniformRate(40, 1)}
                    style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Set All to 40%
                  </button>
                  <button
                    type="button"
                    onClick={() => applyUniformRate(50, 1)}
                    style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Set All to 50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgreementsList(prev => prev.map(r => ({ ...r, isSelected: true })))}
                    style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid #0071e3', color: '#0071e3', background: 'transparent', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Select All
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <strong>{agreementsList.filter(a => a.isSelected).length}</strong> of {agreementsList.length} categories active
                  </span>
                </div>
              </div>

              {/* Table of Categories and Rates */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 18px', width: '48px', textAlign: 'center' }}>Active</th>
                      <th style={{ padding: '12px 18px', fontWeight: 700 }}>Service Category / Procedure</th>
                      <th style={{ padding: '12px 18px', fontWeight: 700, width: '220px' }}>Agreement Type</th>
                      <th style={{ padding: '12px 18px', fontWeight: 700, width: '220px' }}>Rate Value</th>
                      <th style={{ padding: '12px 18px', fontWeight: 700, width: '260px' }}>Sample Calculation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agreementsList.map((row, idx) => {
                      const isSelected = row.isSelected;
                      const samplePrice = 1000;
                      const sampleDoctorShare = row.rateType === 1
                        ? (Number(row.rate || 0) / 100) * samplePrice
                        : Number(row.rate || 0);

                      return (
                        <tr
                          key={row.category}
                          style={{
                            borderBottom: idx < agreementsList.length - 1 ? '1px solid var(--border-color)' : 'none',
                            background: isSelected ? 'transparent' : 'rgba(0,0,0,0.02)',
                            opacity: isSelected ? 1 : 0.65,
                            transition: 'all 0.2s'
                          }}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => updateAgreementRow(row.category, 'isSelected', e.target.checked)}
                              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0071e3' }}
                            />
                          </td>

                          {/* Category Name */}
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                              {row.category}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Standard clinical category
                            </div>
                          </td>

                          {/* Rate Type Selector */}
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                disabled={!isSelected}
                                onClick={() => updateAgreementRow(row.category, 'rateType', 1)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: row.rateType === 1 ? '2px solid #0071e3' : '1px solid var(--border-color)',
                                  background: row.rateType === 1 ? 'rgba(0, 113, 227, 0.1)' : 'var(--bg-card)',
                                  color: row.rateType === 1 ? '#0071e3' : 'var(--text-secondary)',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  cursor: isSelected ? 'pointer' : 'default'
                                }}
                              >
                                <Percent size={13} />
                                Percentage
                              </button>

                              <button
                                type="button"
                                disabled={!isSelected}
                                onClick={() => updateAgreementRow(row.category, 'rateType', 2)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: row.rateType === 2 ? '2px solid #34c759' : '1px solid var(--border-color)',
                                  background: row.rateType === 2 ? 'rgba(52, 199, 89, 0.1)' : 'var(--bg-card)',
                                  color: row.rateType === 2 ? '#166534' : 'var(--text-secondary)',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  cursor: isSelected ? 'pointer' : 'default'
                                }}
                              >
                                <Coins size={13} />
                                Fixed Fee
                              </button>
                            </div>
                          </td>

                          {/* Rate Value Input */}
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="0"
                                max={row.rateType === 1 ? '100' : '100000'}
                                step={row.rateType === 1 ? '1' : '50'}
                                disabled={!isSelected}
                                value={row.rate}
                                onChange={e => updateAgreementRow(row.category, 'rate', parseFloat(e.target.value) || 0)}
                                style={{
                                  width: '120px',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-card)',
                                  color: 'var(--text-main)',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                  outline: 'none'
                                }}
                              />
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {row.rateType === 1 ? '%' : 'ETB'}
                              </span>
                            </div>
                          </td>

                          {/* Live Preview */}
                          <td style={{ padding: '12px 18px' }}>
                            {isSelected ? (
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                For 1,000 ETB price: <strong style={{ color: '#166534' }}>ETB {sampleDoctorShare.toFixed(2)}</strong> doctor share
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600 }}>
                                Agreement disabled (0 ETB)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Custom Category Row */}
              <div style={{ padding: '14px 20px', background: 'rgba(0,0,0,0.015)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Add Custom Category / Service:
                </span>
                <input
                  type="text"
                  placeholder="e.g., Hydrafacial, Hair Transplant..."
                  value={customCategoryInput}
                  onChange={e => setCustomCategoryInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCustomCategory();
                  }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    width: '280px',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  + Add to List
                </button>
              </div>

              {/* Bottom Save Action Bar */}
              <div style={{ padding: '18px 24px', background: 'rgba(0,0,0,0.03)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Agreements will take effect immediately upon saving
                </span>
                <button
                  type="button"
                  onClick={handleSaveAgreements}
                  disabled={savingAgreements}
                  className="btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 113, 227, 0.3)'
                  }}
                >
                  <Save size={18} />
                  {savingAgreements ? 'Saving Agreements...' : 'Save Doctor Agreements'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
