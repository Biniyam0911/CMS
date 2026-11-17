import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, Search, Plus, Calendar, User, Phone, Check, X,
  Printer, Trash2, RefreshCw, Loader2, ArrowUpDown, FileText,
  DollarSign, Activity, ChevronRight, Filter, Download
} from 'lucide-react';
import { api, logAudit } from '../../api/apiClient';

interface FacialService {
  id: number;
  code: string;
  name: string;
  price: number;
  department?: string;
  description?: string;
}

interface Doctor {
  id: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  specialization?: string;
}

interface FacialRegistration {
  id: number;
  registrationNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  age?: number;
  gender?: string;
  mobile?: string;
  serviceId?: number;
  procedureType: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  doctorId?: number;
  doctorName?: string;
  isPlc: boolean;
  isOther: boolean;
  notes?: string;
  status: string;
  registrationDate: string;
  registrationTime: string;
  createdAt: string;
}

export default function FacialPage() {
  const [activeTab, setActiveTab] = useState<'register' | 'view'>('register');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Form Fields State
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [mobile, setMobile] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<number | ''>('');
  const [procedureType, setProcedureType] = useState('');
  const [customProcedure, setCustomProcedure] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discount, setDiscount] = useState('0');
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | ''>('');
  const [doctorName, setDoctorName] = useState('');
  const [isPlc, setIsPlc] = useState(false);
  const [isOther, setIsOther] = useState(false);
  const [notes, setNotes] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Data
  const [facialServices, setFacialServices] = useState<FacialService[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [registrations, setRegistrations] = useState<FacialRegistration[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // View & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PLC' | 'OTHER'>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Auto-dismiss toasts
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  useEffect(() => {
    if (errorToast) {
      const t = setTimeout(() => setErrorToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorToast]);

  // Load Facial Services and Doctors
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [servicesRes, doctorsRes] = await Promise.all([
          api.get<any>('/facial/services').catch(() => api.get<any>('/services?category=Facial&limit=100')),
          api.get<any>('/doctors').catch(() => [])
        ]);

        const svcList: any[] = Array.isArray(servicesRes)
          ? servicesRes
          : (servicesRes?.data || servicesRes?.Data || []);
        
        if (svcList.length > 0) {
          setFacialServices(svcList.map(s => ({
            id: s.id || s.Id,
            code: s.code || s.Code || '',
            name: s.name || s.Name || '',
            price: parseFloat(s.price ?? s.Price ?? 0) || 0,
            department: s.department || s.Department || '',
            description: s.description || s.Description || ''
          })));
        }

        const docList: any[] = Array.isArray(doctorsRes)
          ? doctorsRes
          : (doctorsRes?.data || doctorsRes?.Data || []);

        if (docList.length > 0) {
          const mappedDocs = docList.map(d => {
            const name = d.name || d.Name || `${d.firstName || d.FirstName || ''} ${d.lastName || d.LastName || ''}`.trim() || `Dr. #${d.id || d.Id}`;
            return {
              id: d.id || d.Id,
              name: name.startsWith('Dr.') ? name : `Dr. ${name}`,
              specialization: d.specialization || d.Specialization || 'Dermatology & Aesthetics'
            };
          });
          setDoctors(mappedDocs);
          if (mappedDocs.length > 0) {
            setSelectedDoctorId(mappedDocs[0].id);
            setDoctorName(mappedDocs[0].name);
          }
        }
      } catch (err) {
        console.warn('Initial facial data loading warning:', err);
      }
    };

    loadInitialData();
    loadRegistrations();
  }, []);

  // Fetch registrations
  const loadRegistrations = async () => {
    setLoadingList(true);
    try {
      const res: any = await api.get<any>('/facial/registrations?limit=300');
      const list = Array.isArray(res) ? res : (res?.data || res?.Data || []);
      setRegistrations(list);
    } catch (err) {
      console.warn('Failed to load facial registrations:', err);
    } finally {
      setLoadingList(false);
    }
  };

  // When procedure dropdown changes, auto-fill procedureType and unitPrice
  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value ? Number(e.target.value) : '';
    setSelectedServiceId(sId);

    if (sId === '') {
      setProcedureType('');
      setUnitPrice(0);
      recalcTotal(0, quantity, discount);
      return;
    }

    const found = facialServices.find(s => s.id === sId);
    if (found) {
      setProcedureType(found.name);
      setUnitPrice(found.price);
      recalcTotal(found.price, quantity, discount);
    }
  };

  // Recalculate total price: (unitPrice * qty) - discount
  const recalcTotal = (priceVal: number, qtyVal: string, discVal: string) => {
    const q = Math.max(1, parseInt(qtyVal) || 1);
    const d = Math.max(0, parseFloat(discVal) || 0);
    const total = Math.max(0, (priceVal * q) - d);
    setTotalPrice(total);
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuantity(val);
    recalcTotal(unitPrice, val, discount);
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDiscount(val);
    recalcTotal(unitPrice, quantity, val);
  };

  const handleDoctorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dId = e.target.value ? Number(e.target.value) : '';
    setSelectedDoctorId(dId);
    const doc = doctors.find(d => d.id === dId);
    setDoctorName(doc?.name || '');
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activeProcedure = isOther && customProcedure.trim() 
      ? customProcedure.trim() 
      : procedureType.trim();

    if (!firstName.trim() || !lastName.trim()) {
      setErrorToast('Please enter both Firstname and Lastname.');
      return;
    }

    if (!activeProcedure) {
      setErrorToast('Please select or specify a Procedure Type.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        age: age ? parseInt(age) : null,
        gender: gender || null,
        mobile: mobile.trim() || null,
        serviceId: typeof selectedServiceId === 'number' ? selectedServiceId : null,
        procedureType: activeProcedure,
        quantity: Math.max(1, parseInt(quantity) || 1),
        unitPrice: unitPrice || 0,
        discount: Math.max(0, parseFloat(discount) || 0),
        totalPrice: totalPrice,
        doctorId: typeof selectedDoctorId === 'number' ? selectedDoctorId : null,
        doctorName: doctorName.trim() || null,
        isPlc,
        isOther,
        notes: notes.trim() || null
      };

      const res: any = await api.post('/facial/registrations', payload);
      const regNumber = res?.data?.registrationNumber || res?.registrationNumber || 'Saved';

      setSuccessToast(`Registration saved successfully! Ticket #: ${regNumber}`);
      await logAudit({
        tableName: 'FacialRegistrations',
        recordId: regNumber,
        operation: 'FACIAL_REGISTRATION',
        oldValues: null,
        newValues: payload
      });

      // Reset form
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setAge('');
      setGender('');
      setMobile('');
      setSelectedServiceId('');
      setProcedureType('');
      setCustomProcedure('');
      setQuantity('1');
      setUnitPrice(0);
      setDiscount('0');
      setTotalPrice(0);
      setIsPlc(false);
      setIsOther(false);
      setNotes('');

      // Refresh list
      loadRegistrations();
    } catch (err: any) {
      console.error('Failed to save facial registration:', err);
      setErrorToast(err?.message || 'Failed to save registration. Please check fields and retry.');
    } finally {
      setSaving(false);
    }
  };

  // Delete registration
  const handleDeleteRegistration = async (id: number, regNo: string) => {
    if (!window.confirm(`Are you sure you want to delete Facial record ${regNo}?`)) return;
    try {
      await api.delete(`/facial/registrations/${id}`);
      setRegistrations(prev => prev.filter(r => r.id !== id));
      setSuccessToast(`Record ${regNo} deleted successfully.`);
    } catch (err: any) {
      alert('Failed to delete: ' + (err?.message || 'Server error'));
    }
  };

  // Filtered registrations for View tab
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(r => {
      // Type filter
      if (filterType === 'PLC' && !r.isPlc) return false;
      if (filterType === 'OTHER' && !r.isOther) return false;

      // Date range filter
      if (filterDateFrom && r.registrationDate < filterDateFrom) return false;
      if (filterDateTo && r.registrationDate > filterDateTo) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = (r.fullName || '').toLowerCase().includes(q);
        const matchReg = (r.registrationNumber || '').toLowerCase().includes(q);
        const matchMob = (r.mobile || '').toLowerCase().includes(q);
        const matchProc = (r.procedureType || '').toLowerCase().includes(q);
        const matchDoc = (r.doctorName || '').toLowerCase().includes(q);
        if (!matchName && !matchReg && !matchMob && !matchProc && !matchDoc) return false;
      }

      return true;
    });
  }, [registrations, filterType, filterDateFrom, filterDateTo, searchTerm]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalCount = registrations.length;
    const plcCount = registrations.filter(r => r.isPlc).length;
    const otherCount = registrations.filter(r => r.isOther).length;
    const totalRev = registrations.reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
    const plcRev = registrations.filter(r => r.isPlc).reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
    const otherRev = registrations.filter(r => r.isOther).reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0);
    return { totalCount, plcCount, otherCount, totalRev, plcRev, otherRev };
  }, [registrations]);

  // Export table data to CSV
  const exportToCsv = () => {
    if (filteredRegistrations.length === 0) {
      alert('No records available to export.');
      return;
    }
    const headers = ['Reg Number', 'Date', 'Client Name', 'Age', 'Gender', 'Mobile', 'Procedure', 'Qty', 'Unit Price', 'Discount', 'Total Price', 'Doctor', 'PLC', 'Other', 'Notes'];
    const rows = filteredRegistrations.map(r => [
      `"${r.registrationNumber}"`,
      `"${r.registrationDate}"`,
      `"${r.fullName}"`,
      r.age ?? '',
      `"${r.gender || ''}"`,
      `"${r.mobile || ''}"`,
      `"${r.procedureType}"`,
      r.quantity,
      r.unitPrice.toFixed(2),
      r.discount.toFixed(2),
      r.totalPrice.toFixed(2),
      `"${r.doctorName || ''}"`,
      r.isPlc ? 'YES' : 'NO',
      r.isOther ? 'YES' : 'NO',
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Facial_Transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1380px', margin: '0 auto', padding: isMobile ? '12px' : '20px' }}>
      
      {/* Toast Alerts */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          background: '#10b981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 700,
          fontSize: '0.88rem'
        }}>
          <Check size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          background: '#ef4444',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 700,
          fontSize: '0.88rem'
        }}>
          <X size={18} />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Main Container matching screenshot structure */}
      <div style={{
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #d1d5db',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden'
      }}>

        {/* Tab Header bar with "Client Registration and View" style */}
        <div style={{
          background: '#f3f4f6',
          borderBottom: '1px solid #d1d5db',
          padding: '8px 14px 0 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div
              onClick={() => setActiveTab('register')}
              style={{
                background: activeTab === 'register' ? '#ffffff' : '#e5e7eb',
                border: '1px solid #d1d5db',
                borderBottom: activeTab === 'register' ? '1px solid #ffffff' : '1px solid #d1d5db',
                borderRadius: '6px 6px 0 0',
                padding: '7px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: activeTab === 'register' ? '#111827' : '#4b5563',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-1px'
              }}
            >
              <span>Client Registration and View</span>
              <span
                onClick={(e) => { e.stopPropagation(); setActiveTab('view'); }}
                title="Switch to View"
                style={{
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '1px 3px',
                  borderRadius: '3px'
                }}
              >
                ×
              </span>
            </div>

            <div
              onClick={() => setActiveTab('view')}
              style={{
                background: activeTab === 'view' ? '#ffffff' : '#e5e7eb',
                border: '1px solid #d1d5db',
                borderBottom: activeTab === 'view' ? '1px solid #ffffff' : '1px solid #d1d5db',
                borderRadius: '6px 6px 0 0',
                padding: '7px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: activeTab === 'view' ? '#111827' : '#4b5563',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-1px'
              }}
            >
              <FileText size={14} color="#6b7280" />
              <span>All Registered Transactions ({registrations.length})</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: '#6b7280', fontWeight: 600 }}>
              Facial Aesthetics Module
            </span>
            <button
              type="button"
              onClick={loadRegistrations}
              title="Refresh Records"
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#4b5563'
              }}
            >
              <RefreshCw size={13} className={loadingList ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* TAB 1: REGISTRATION FORM (Identical to screenshot layout) */}
        {activeTab === 'register' && (
          <div style={{ padding: isMobile ? '16px' : '26px 36px 36px 36px', background: '#fafafa' }}>
            <form onSubmit={handleSubmit}>
              
              {/* Form Grid: 2 Columns */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                columnGap: '48px',
                rowGap: '18px'
              }}>
                
                {/* ---------------- LEFT COLUMN ---------------- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Firstname */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Firstname
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Firstname..."
                      required
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#111827',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                    />
                  </div>

                  {/* LastName */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      LastName
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Lastname..."
                      required
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#111827',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Procedure Type (Dropdown fetching from Category = 'Facial') */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
                        Procedure Type
                      </label>
                      <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                        ({facialServices.length} Facial Services available)
                      </span>
                    </div>

                    {!isOther ? (
                      <select
                        value={selectedServiceId}
                        onChange={handleServiceChange}
                        required={!isOther}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '9px 12px',
                          background: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          color: '#111827',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Select Procedure Type...</option>
                        {facialServices.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.code ? `[${s.code}] ` : ''}{s.name} — Br {s.price.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          type="text"
                          value={customProcedure}
                          onChange={e => setCustomProcedure(e.target.value)}
                          placeholder="Type Other / Custom Procedure Name..."
                          required={isOther}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '9px 12px',
                            background: '#fffbeb',
                            border: '1px solid #f59e0b',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            color: '#111827',
                            outline: 'none'
                          }}
                        />
                        <select
                          value={selectedServiceId}
                          onChange={handleServiceChange}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '6px 10px',
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            color: '#6b7280',
                            outline: 'none'
                          }}
                        >
                          <option value="">Or optionally link to standard service pricing...</option>
                          {facialServices.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} (Br {s.price.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Mobile */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Mobile
                    </label>
                    <input
                      type="text"
                      value={mobile}
                      onChange={e => setMobile(e.target.value)}
                      placeholder="Mobile Number..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#111827',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#111827',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Select Gender...</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Checkboxes: PLC and Other */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '28px', marginTop: '6px' }}>
                    
                    {/* PLC Checkbox */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: isPlc ? '#0284c7' : '#374151'
                    }}>
                      <input
                        type="checkbox"
                        checked={isPlc}
                        onChange={e => setIsPlc(e.target.checked)}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: '#0284c7'
                        }}
                      />
                      <span>PLC</span>
                    </label>

                    {/* Other Checkbox */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: isOther ? '#d97706' : '#374151'
                    }}>
                      <input
                        type="checkbox"
                        checked={isOther}
                        onChange={e => {
                          const checked = e.target.checked;
                          setIsOther(checked);
                          if (!checked) setCustomProcedure('');
                        }}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: '#d97706'
                        }}
                      />
                      <span>Other</span>
                    </label>

                  </div>

                </div>

                {/* ---------------- RIGHT COLUMN ---------------- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Middlename */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Middlename
                    </label>
                    <input
                      type="text"
                      value={middleName}
                      onChange={e => setMiddleName(e.target.value)}
                      placeholder="Middlename"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#111827',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Age */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Age
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      placeholder="Age..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#111827',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={handleQtyChange}
                      placeholder="Quantity..."
                      required
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#111827',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Discount */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Discount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discount}
                      onChange={handleDiscountChange}
                      placeholder="0"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#111827',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Total Price */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Total Price (Br)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={totalPrice}
                      onChange={e => setTotalPrice(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        background: '#f9fafb',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: '#047857',
                        outline: 'none'
                      }}
                    />
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '3px' }}>
                      Unit Price: Br {unitPrice.toFixed(2)} × Qty: {quantity || 1} - Disc: Br {discount || 0}
                    </div>
                  </div>

                  {/* Doctor */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Doctor
                    </label>
                    {doctors.length > 0 ? (
                      <select
                        value={selectedDoctorId}
                        onChange={handleDoctorChange}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '9px 12px',
                          background: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          color: '#111827',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Select Doctor / Practitioner...</option>
                        {doctors.map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={doctorName}
                        onChange={e => setDoctorName(e.target.value)}
                        placeholder="Attending Doctor / Aesthetician..."
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '9px 12px',
                          background: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          color: '#111827',
                          outline: 'none'
                        }}
                      />
                    )}
                  </div>

                </div>

              </div>

              {/* Action Buttons: Save Button exactly on the bottom right */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '32px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: saving ? '#9ca3af' : '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '8px 46px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: '#374151',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => {
                    if (!saving) (e.currentTarget.style.background = '#f3f4f6');
                  }}
                  onMouseOut={(e) => {
                    if (!saving) (e.currentTarget.style.background = '#ffffff');
                  }}
                >
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </span>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* TAB 2: VIEW ALL TRANSACTIONS */}
        {activeTab === 'view' && (
          <div style={{ padding: '20px 24px' }}>
            
            {/* Quick KPI Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ padding: '14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Total Facial Clients</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{summaryMetrics.totalCount}</div>
                <div style={{ fontSize: '0.7rem', color: '#0284c7' }}>Br {summaryMetrics.totalRev.toLocaleString()} gross</div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600 }}>PLC Transactions</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1d4ed8', marginTop: '2px' }}>{summaryMetrics.plcCount}</div>
                <div style={{ fontSize: '0.7rem', color: '#2563eb' }}>Br {summaryMetrics.plcRev.toLocaleString()} revenue</div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', background: '#fef3c7', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>Other Transactions</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309', marginTop: '2px' }}>{summaryMetrics.otherCount}</div>
                <div style={{ fontSize: '0.7rem', color: '#d97706' }}>Br {summaryMetrics.otherRev.toLocaleString()} revenue</div>
              </div>

              <div style={{ padding: '14px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '0.72rem', color: '#065f46', fontWeight: 600 }}>Total Revenue</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857', marginTop: '2px' }}>Br {summaryMetrics.totalRev.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: '#059669' }}>Across all procedures</div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search client, mobile, ticket #..."
                    style={{
                      padding: '7px 10px 7px 32px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.8rem',
                      width: '240px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setFilterType('ALL')}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      background: filterType === 'ALL' ? '#374151' : '#ffffff',
                      color: filterType === 'ALL' ? '#ffffff' : '#4b5563',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    All ({registrations.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('PLC')}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderLeft: '1px solid #d1d5db',
                      background: filterType === 'PLC' ? '#0284c7' : '#ffffff',
                      color: filterType === 'PLC' ? '#ffffff' : '#0369a1',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    PLC Only ({summaryMetrics.plcCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('OTHER')}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderLeft: '1px solid #d1d5db',
                      background: filterType === 'OTHER' ? '#d97706' : '#ffffff',
                      color: filterType === 'OTHER' ? '#ffffff' : '#b45309',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Other Only ({summaryMetrics.otherCount})
                  </button>
                </div>
              </div>

              {/* Date Filters & Export */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.76rem'
                  }}
                  title="Date From"
                />
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>to</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.76rem'
                  }}
                  title="Date To"
                />

                <button
                  type="button"
                  onClick={exportToCsv}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    color: '#374151',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>

            </div>

            {/* Transactions Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Ticket #</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Date & Time</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Client Name</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Age/Sex</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Mobile</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Procedure</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Qty</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Total Price</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Doctor</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Flags</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#374151', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                        No facial client records match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRegistrations.map((r, i) => (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: i % 2 === 0 ? '#ffffff' : '#fafafa'
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace', color: '#0284c7' }}>
                          {r.registrationNumber}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                          <div>{r.registrationDate}</div>
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{r.registrationTime || ''}</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#111827' }}>
                          {r.fullName}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#4b5563' }}>
                          {r.age ? `${r.age} yrs` : '—'} · {r.gender || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#4b5563' }}>
                          {r.mobile || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>
                          {r.procedureType}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#4b5563' }}>
                          {r.quantity}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#047857' }}>
                          Br {Number(r.totalPrice).toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#4b5563' }}>
                          {r.doctorName || '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {r.isPlc && (
                              <span style={{
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                PLC
                              </span>
                            )}
                            {r.isOther && (
                              <span style={{
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                OTHER
                              </span>
                            )}
                            {!r.isPlc && !r.isOther && (
                              <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Standard</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteRegistration(r.id, r.registrationNumber)}
                            title="Delete / Reverse Record"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
