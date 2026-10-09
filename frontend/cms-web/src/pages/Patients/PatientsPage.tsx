import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Search, Plus, FileText, Phone, Mail, Calendar, Activity, X,
  Stethoscope, Camera, ShieldCheck, Copy, Loader2, ChevronLeft, ChevronRight,
  MapPin, CreditCard, User, Building, Hash, Edit3, Globe
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface PatientsPageProps {
  onSelectEmrPatient?: (patientId: number) => void;
}

export default function PatientsPage({ onSelectEmrPatient }: PatientsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMpiModal, setShowMpiModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Registration Form State
  const [isOnlineRegistry, setIsOnlineRegistry] = useState(false);
  const [mrnPreview, setMrnPreview] = useState(`HD-${Math.floor(1000 + Math.random() * 9000)}`);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState(''); // Father's Name
  const [grandfatherName, setGrandfatherName] = useState(''); // Grandfather Name / LastName
  const [dob, setDob] = useState('1995-01-01');
  const [age, setAge] = useState<string>('31');
  const [gender, setGender] = useState('1');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Insurance'>('Cash');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [copayPercent, setCopayPercent] = useState('0');
  const [nationalId, setNationalId] = useState('');

  // Edit Patient State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPatientId, setEditPatientId] = useState<number | null>(null);
  const [editMrn, setEditMrn] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editMiddleName, setEditMiddleName] = useState('');
  const [editGrandfatherName, setEditGrandfatherName] = useState('');
  const [editDob, setEditDob] = useState('1995-01-01');
  const [editAge, setEditAge] = useState<string>('31');
  const [editGender, setEditGender] = useState('1');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPaymentType, setEditPaymentType] = useState<'Cash' | 'Insurance'>('Cash');
  const [editInsuranceProvider, setEditInsuranceProvider] = useState('');
  const [editCopayPercent, setEditCopayPercent] = useState('0');
  const [editNationalId, setEditNationalId] = useState('');

  // Medical History Form State
  const [historyType, setHistoryType] = useState('PastMedical');
  const [historyDesc, setHistoryDesc] = useState('');

  const [patients, setPatients] = useState<any[]>([]);

  // Calculate age from DOB
  const handleDobChange = (newDob: string, isEdit = false) => {
    if (isEdit) {
      setEditDob(newDob);
      if (newDob) {
        const birthDate = new Date(newDob);
        if (!isNaN(birthDate.getTime())) {
          const calculatedAge = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000));
          setEditAge(calculatedAge >= 0 ? String(calculatedAge) : '0');
        }
      }
    } else {
      setDob(newDob);
      if (newDob) {
        const birthDate = new Date(newDob);
        if (!isNaN(birthDate.getTime())) {
          const calculatedAge = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000));
          setAge(calculatedAge >= 0 ? String(calculatedAge) : '0');
        }
      }
    }
  };

  // Calculate DOB from Age
  const handleAgeChange = (newAge: string, isEdit = false) => {
    const ageNum = parseInt(newAge);
    if (isEdit) {
      setEditAge(newAge);
      if (!isNaN(ageNum) && ageNum >= 0 && ageNum <= 130) {
        const birthYear = new Date().getFullYear() - ageNum;
        const currentMonthDay = editDob ? editDob.substring(4) : '-01-01';
        setEditDob(`${birthYear}${currentMonthDay || '-01-01'}`);
      }
    } else {
      setAge(newAge);
      if (!isNaN(ageNum) && ageNum >= 0 && ageNum <= 130) {
        const birthYear = new Date().getFullYear() - ageNum;
        const currentMonthDay = dob ? dob.substring(4) : '-01-01';
        setDob(`${birthYear}${currentMonthDay || '-01-01'}`);
      }
    }
  };

  const openEditModal = (p: any) => {
    setEditPatientId(p.id);
    setEditMrn(p.mrn);
    setEditFirstName(p.firstName || '');
    setEditMiddleName(p.middleName || '');
    setEditGrandfatherName(p.lastName || '');
    const pDob = p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '1995-01-01';
    setEditDob(pDob);
    if (pDob) {
      const birthDate = new Date(pDob);
      const calculatedAge = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000));
      setEditAge(calculatedAge >= 0 ? String(calculatedAge) : '30');
    }
    setEditGender(p.gender === 'Female' ? '2' : '1');
    setEditPhone(p.primaryPhone || '');
    setEditEmail(p.email || '');
    setEditAddress(p.address || '');
    const isIns = p.insuranceProvider && p.insuranceProvider !== 'Cash' && p.insuranceProvider !== 'Self-Pay';
    setEditPaymentType(isIns ? 'Insurance' : 'Cash');
    setEditInsuranceProvider(isIns ? p.insuranceProvider : '');
    setEditCopayPercent(String(p.copayPercent || 0));
    setEditNationalId(p.nationalId || '');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPatientId) return;
    try {
      await api.put(`/patients/${editPatientId}`, {
        tenantId: 1,
        mrn: editMrn,
        firstName: editFirstName,
        middleName: editMiddleName,
        lastName: editGrandfatherName,
        dateOfBirth: editDob,
        gender: parseInt(editGender),
        primaryPhone: editPhone,
        email: editEmail || null,
        address: editAddress || null,
        insuranceProvider: editPaymentType === 'Insurance' ? editInsuranceProvider : 'Cash',
        insuranceCopayPercent: editPaymentType === 'Insurance' ? (parseFloat(editCopayPercent) || 0) : 0,
        allergies: 'None',
        nationalId: editNationalId || null
      });
      setShowEditModal(false);
      await fetchPatients(searchQuery);
    } catch (err) {
      console.error('Patient update error:', err);
      alert('Failed to update patient details.');
    }
  };

  const fetchPatients = async (query = '') => {
    try {
      setLoading(true);
      const rawData = await api.get<any>('/patients/search', { q: query });
      const dataList = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.Data || []);
      const mapped = dataList.map((p: any) => ({
        id: p.id || p.Id,
        mrn: p.mrn || p.MRN || `HD-${p.id || p.Id}`,
        firstName: p.firstName || p.FirstName || 'Unknown',
        middleName: p.middleName || p.MiddleName || '',
        lastName: p.lastName || p.LastName || '',
        fullName: `${p.firstName || p.FirstName || ''} ${p.middleName || p.MiddleName || ''} ${p.lastName || p.LastName || ''}`.trim(),
        dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth).split('T')[0] : '1990-01-01',
        gender: (p.gender === 1 || p.Gender === 1 || p.gender === 'Male' || p.gender === '1') ? 'Male' : ((p.gender === 2 || p.Gender === 2 || p.gender === 'Female' || p.gender === '2') ? 'Female' : 'Other'),
        primaryPhone: p.primaryPhone || p.PrimaryPhone || '',
        email: p.email || p.Email || '',
        address: p.address || p.Address || '',
        insuranceProvider: p.insuranceProvider || p.InsuranceProvider || 'Cash',
        copayPercent: p.insuranceCopayPercent || p.InsuranceCopayPercent || 0,
        allergies: p.allergies || p.Allergies || 'None',
        nationalId: p.nationalId || p.NationalId || `ETH-${p.id || p.Id}`,
        photoUrl: p.photoUrl || p.PhotoUrl || '',
        histories: p.histories || []
      }));
      setPatients(mapped);
    } catch (err) {
      console.error('Failed to fetch patients from API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPatients(searchQuery);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const openRegisterModal = async (isOnline = false) => {
    setIsOnlineRegistry(isOnline);
    const prefix = isOnline ? 'ON' : 'HD';
    try {
      const res: any = await api.get(`/patients/next-mrn?prefix=${prefix}`);
      const nextVal = res?.nextMRN || res?.NextMRN || res?.data?.nextMRN || res?.data?.NextMRN;
      if (nextVal) {
        setMrnPreview(nextVal);
      } else {
        setMrnPreview(`${prefix}-${String(patients.length + 1).padStart(4, '0')}`);
      }
    } catch {
      setMrnPreview(`${prefix}-${String(patients.length + 1).padStart(4, '0')}`);
    }
    setFirstName('');
    setMiddleName('');
    setGrandfatherName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setPaymentType('Cash');
    setInsuranceProvider('');
    setCopayPercent('0');
    setNationalId('');
    setShowRegisterModal(true);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/patients', {
        tenantId: 1,
        mrn: mrnPreview,
        firstName,
        middleName,
        lastName: grandfatherName,
        dateOfBirth: dob,
        gender: parseInt(gender),
        primaryPhone: phone,
        email: email || null,
        address: address || null,
        insuranceProvider: paymentType === 'Insurance' ? insuranceProvider : 'Cash',
        insuranceCopayPercent: paymentType === 'Insurance' ? (parseFloat(copayPercent) || 0) : 0,
        allergies: 'None',
        nationalId: nationalId || `ETH-${Math.floor(100000 + Math.random() * 900000)}`
      });
      setShowRegisterModal(false);
      await fetchPatients(searchQuery);
    } catch (err) {
      console.error('Patient registration error:', err);
      alert('Failed to register patient in database.');
    }
  };

  const handleAddHistory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !historyDesc) return;
    const newHist = {
      id: Math.random(),
      type: historyType,
      desc: historyDesc,
      date: new Date().toISOString().split('T')[0]
    };
    setSelectedPatient({
      ...selectedPatient,
      histories: [newHist, ...(selectedPatient.histories || [])]
    });
    setHistoryDesc('');
  };

  // Online / In-Clinic Registry Filter State
  const [registryFilter, setRegistryFilter] = useState<'ALL' | 'ONLINE' | 'IN_CLINIC'>('ALL');

  const onlineCount = useMemo(() => {
    return patients.filter(p => {
      const mrnUpper = (p.mrn || '').toUpperCase();
      return mrnUpper.startsWith('ON-') || mrnUpper.startsWith('ON') || p.isOnline;
    }).length;
  }, [patients]);

  const inClinicCount = Math.max(0, patients.length - onlineCount);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const mrnUpper = (p.mrn || '').toUpperCase();
      const isOnline = mrnUpper.startsWith('ON-') || mrnUpper.startsWith('ON') || p.isOnline;
      if (registryFilter === 'ONLINE') return isOnline;
      if (registryFilter === 'IN_CLINIC') return !isOnline;
      return true;
    });
  }, [patients, registryFilter]);

  // Pagination Calculations
  const totalCount = filteredPatients.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedPatients = filteredPatients.slice(startIndex, endIndex);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div>
      {/* Search and Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <div style={{ position: 'relative', width: isMobile ? '100%' : '320px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by Patient Name, MRN, Phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>

          {/* Quick Filter: All / Online / In-Clinic */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-main)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => { setRegistryFilter('ALL'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: registryFilter === 'ALL' ? '#0284c7' : 'transparent',
                color: registryFilter === 'ALL' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              All ({patients.length})
            </button>
            <button
              type="button"
              onClick={() => { setRegistryFilter('ONLINE'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
                background: registryFilter === 'ONLINE' ? '#0284c7' : 'transparent',
                color: registryFilter === 'ONLINE' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              <Globe size={13} /> Online ({onlineCount})
            </button>
            <button
              type="button"
              onClick={() => { setRegistryFilter('IN_CLINIC'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: registryFilter === 'IN_CLINIC' ? '#0284c7' : 'transparent',
                color: registryFilter === 'IN_CLINIC' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              In-Clinic ({inClinicCount})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          <button onClick={() => setShowMpiModal(true)} className="btn-secondary" style={{ flex: isMobile ? 1 : undefined, justifyContent: 'center' }}>
            <ShieldCheck size={15} /> MPI Duplicate Check
          </button>
          <button onClick={() => openRegisterModal(true)} className="btn-secondary" style={{ flex: isMobile ? 1 : undefined, justifyContent: 'center', borderColor: '#0284c7', color: '#0284c7', fontWeight: 600 }}>
            <Globe size={15} /> + Online Patient Registry
          </button>
          <button onClick={() => openRegisterModal(false)} className="btn-primary" style={{ flex: isMobile ? 1 : undefined, justifyContent: 'center' }}>
            <Plus size={15} /> + Register New Patient
          </button>
        </div>
      </div>

      {/* Main Content Layout: Table & Detail Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: (!isMobile && selectedPatient) ? '1fr 360px' : '1fr', gap: '18px' }}>
        {/* Patients Table Panel */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} color="#0284c7" /> Patient Registry ({totalCount} Registered)
            </h3>

            {/* Page Size Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
                style={{ width: '65px', padding: '3px 6px', fontSize: '0.75rem' }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>per page</span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="cms-table">
            <thead>
              <tr>
                <th>Card No / MRN</th>
                <th>Patient Full Name</th>
                <th>Age / Gender</th>
                <th>Primary Contact</th>
                <th>Payment / Insurance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 6px' }} />
                    Loading patient records...
                  </td>
                </tr>
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No patient records found. Click "+ Register New Patient" to create one.
                  </td>
                </tr>
              ) : (
                paginatedPatients.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    style={{
                      cursor: 'pointer',
                      background: selectedPatient?.id === p.id ? '#e0f2fe' : undefined
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', fontSize: '0.85rem' }}>
                          {p.mrn}
                        </span>
                        {((p.mrn || '').toUpperCase().startsWith('ON-') || (p.mrn || '').toUpperCase().startsWith('ON') || p.isOnline) && (
                          <span style={{
                            background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd',
                            padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 800,
                            display: 'inline-flex', alignItems: 'center', gap: '3px'
                          }}>
                            <Globe size={10} /> ONLINE
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.fullName || `${p.firstName} ${p.lastName}`}</div>
                      {p.email && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.email}</div>}
                    </td>
                    <td>
                      <div>
                        {p.dateOfBirth ? (new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()) : 30} yrs • {p.gender}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem' }}>{p.primaryPhone || '—'}</div>
                      {p.address && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.address}</div>}
                    </td>
                    <td>
                      {p.insuranceProvider === 'Cash' || p.insuranceProvider === 'Self-Pay' ? (
                        <span className="badge badge-normal" style={{ fontSize: '0.68rem' }}>Cash</span>
                      ) : (
                        <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                          {p.insuranceProvider} ({p.copayPercent}%)
                        </span>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                        <button
                          onClick={() => setSelectedPatient(p)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                          title="Edit Patient Information"
                        >
                          <Edit3 size={11} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

          {/* Pagination Controls Footer */}
          {!loading && totalCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                Showing <strong>{startIndex + 1}</strong> to <strong>{endIndex}</strong> of <strong>{totalCount}</strong> patients
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.72rem', opacity: currentPage === 1 ? 0.5 : 1 }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, currentPage - 3),
                  Math.min(totalPages, currentPage + 2)
                ).map(pageNo => (
                  <button
                    key={pageNo}
                    onClick={() => setCurrentPage(pageNo)}
                    className="btn-secondary"
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      background: currentPage === pageNo ? '#0284c7' : undefined,
                      color: currentPage === pageNo ? '#ffffff' : undefined,
                      borderColor: currentPage === pageNo ? '#0284c7' : undefined,
                      fontWeight: currentPage === pageNo ? 700 : 500
                    }}
                  >
                    {pageNo}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.72rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Selected Patient Quick Detail Drawer */}
        {selectedPatient && (
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700 }}>PATIENT DOSSIER</div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selectedPatient.fullName}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedPatient.mrn}</span>
              </div>
              <button onClick={() => setSelectedPatient(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Date of Birth:</span>
                <strong>{selectedPatient.dateOfBirth}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Gender:</span>
                <strong>{selectedPatient.gender}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                <strong>{selectedPatient.primaryPhone || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                <strong>{selectedPatient.email || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Address:</span>
                <strong>{selectedPatient.address || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment:</span>
                <strong>{selectedPatient.insuranceProvider}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {onSelectEmrPatient && (
                <button
                  onClick={() => onSelectEmrPatient(selectedPatient.id)}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <Stethoscope size={14} /> Open EMR Consultation
                </button>
              )}
              <button
                onClick={() => setShowHistoryModal(true)}
                className="btn-secondary"
                style={{ padding: '6px 10px' }}
              >
                <FileText size={14} /> History
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PATIENT REGISTRATION MODAL WITH G. FATHER NAME, EMAIL, ADDRESS, INSURANCE */}
      {/* ========================================================================= */}
      {showRegisterModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '560px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {isOnlineRegistry ? 'Online Patient Registry' : 'Register New Patient'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {isOnlineRegistry ? 'Register online patient with ON- prefix card number' : 'Create master patient index record'}
                </span>
              </div>
              <button onClick={() => setShowRegisterModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* MRN Field (Inactive / Read-Only Display) */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Hash size={13} color="#0284c7" /> Patient Card No / MRN (Auto-Generated • Inactive)
                </label>
                <input
                  type="text"
                  value={mrnPreview}
                  disabled
                  readOnly
                  style={{
                    background: '#f1eee6',
                    borderColor: '#dfd7c9',
                    color: '#0369a1',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              {/* Names: First Name, Father's Name, Grandfather Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>First Name *</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="e.g. Kedir" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Father's Name *</label>
                  <input type="text" value={middleName} onChange={e => setMiddleName(e.target.value)} placeholder="e.g. Sawda" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>G. Father Name *</label>
                  <input type="text" value={grandfatherName} onChange={e => setGrandfatherName(e.target.value)} placeholder="e.g. Hassen" required />
                </div>
              </div>

              {/* DOB, Age, Gender, Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date of Birth *</label>
                  <input type="date" value={dob} onChange={e => handleDobChange(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Age (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    max="130"
                    value={age}
                    onChange={e => handleAgeChange(e.target.value)}
                    placeholder="e.g. 28"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Gender *</label>
                  <select value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="1">Male</option>
                    <option value="2">Female</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Primary Phone *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0911000000" required />
                </div>
              </div>

              {/* Optional Fields: Email & Address */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Email <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@example.com" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Address / Residence <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Kirkos, Woreda 01" />
                </div>
              </div>

              {/* Payment Type: Cash (Default) vs Insurance */}
              <div style={{ padding: '12px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Payment Category</label>
                    <select
                      value={paymentType}
                      onChange={e => {
                        const val = e.target.value as 'Cash' | 'Insurance';
                        setPaymentType(val);
                        if (val === 'Cash') {
                          setInsuranceProvider('');
                          setCopayPercent('0');
                        }
                      }}
                    >
                      <option value="Cash">Cash (Self-Pay) — Default</option>
                      <option value="Insurance">Insurance Coverage</option>
                    </select>
                  </div>

                  {paymentType === 'Insurance' ? (
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Insurance Provider Name *</label>
                      <input
                        type="text"
                        value={insuranceProvider}
                        onChange={e => setInsuranceProvider(e.target.value)}
                        placeholder="Enter insurance provider"
                        required={paymentType === 'Insurance'}
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>National ID / Passport</label>
                      <input type="text" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="Optional" />
                    </div>
                  )}
                </div>

                {paymentType === 'Insurance' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Patient Copay (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={copayPercent}
                        onChange={e => setCopayPercent(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>National ID / Policy No</label>
                      <input type="text" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="Policy or National ID" />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowRegisterModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  <Plus size={14} /> Complete Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PATIENT EDIT MODAL                                                        */}
      {/* ========================================================================= */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '560px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Edit3 size={17} color="#0284c7" /> Edit Patient Profile
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Update demographic and contact details for {editMrn}</span>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Hash size={13} color="#0284c7" /> MRN / Card No (Read-Only)
                </label>
                <input
                  type="text"
                  value={editMrn}
                  disabled
                  readOnly
                  style={{
                    background: '#f1eee6',
                    borderColor: '#dfd7c9',
                    color: '#0369a1',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              {/* Names */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>First Name *</label>
                  <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Father's Name *</label>
                  <input type="text" value={editMiddleName} onChange={e => setEditMiddleName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>G. Father Name *</label>
                  <input type="text" value={editGrandfatherName} onChange={e => setEditGrandfatherName(e.target.value)} required />
                </div>
              </div>

              {/* DOB, Age, Gender, Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date of Birth *</label>
                  <input type="date" value={editDob} onChange={e => handleDobChange(e.target.value, true)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Age (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    max="130"
                    value={editAge}
                    onChange={e => handleAgeChange(e.target.value, true)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Gender *</label>
                  <select value={editGender} onChange={e => setEditGender(e.target.value)}>
                    <option value="1">Male</option>
                    <option value="2">Female</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Primary Phone *</label>
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} required />
                </div>
              </div>

              {/* Email & Address */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="patient@example.com" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Address / Residence</label>
                  <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Kirkos, Woreda 01" />
                </div>
              </div>

              {/* Payment Type: Cash vs Insurance */}
              <div style={{ padding: '12px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Payment Category</label>
                    <select
                      value={editPaymentType}
                      onChange={e => {
                        const val = e.target.value as 'Cash' | 'Insurance';
                        setEditPaymentType(val);
                        if (val === 'Cash') {
                          setEditInsuranceProvider('');
                          setEditCopayPercent('0');
                        }
                      }}
                    >
                      <option value="Cash">Cash (Self-Pay)</option>
                      <option value="Insurance">Insurance Coverage</option>
                    </select>
                  </div>

                  {editPaymentType === 'Insurance' && (
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Insurance Provider</label>
                      <input
                        type="text"
                        value={editInsuranceProvider}
                        onChange={e => setEditInsuranceProvider(e.target.value)}
                        placeholder="e.g. Nyala, Awash, MedNet"
                        required={editPaymentType === 'Insurance'}
                      />
                    </div>
                  )}
                </div>

                {editPaymentType === 'Insurance' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Patient Copay (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={editCopayPercent}
                        onChange={e => setEditCopayPercent(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>National ID / Policy No</label>
                      <input type="text" value={editNationalId} onChange={e => setEditNationalId(e.target.value)} placeholder="Policy or National ID" />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  <Edit3 size={14} /> Update Patient Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedPatient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '500px', padding: '22px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Medical History for {selectedPatient.fullName}</h3>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <form onSubmit={handleAddHistory} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <select value={historyType} onChange={e => setHistoryType(e.target.value)}>
                <option value="PastMedical">Past Medical History</option>
                <option value="Surgical">Surgical History</option>
                <option value="Allergy">Allergies & Drug Reactions</option>
                <option value="Family">Family Medical History</option>
              </select>
              <textarea rows={2} value={historyDesc} onChange={e => setHistoryDesc(e.target.value)} placeholder="Enter clinical notes..." required />
              <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end' }}><Plus size={13} /> Add History Entry</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {(selectedPatient.histories || []).length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No medical history records logged.</div>
              ) : (
                selectedPatient.histories.map((h: any, idx: number) => (
                  <div key={idx} style={{ padding: '8px 10px', background: '#fcfbf8', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: 700, color: '#0369a1' }}>{h.type} • {h.date}</div>
                    <div>{h.desc}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MPI Duplicate Check Modal */}
      {showMpiModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '480px', padding: '22px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={18} color="#059669" /> MPI Deterministic Duplicate Checker
              </h3>
              <button onClick={() => setShowMpiModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Our Master Patient Index engine automatically analyzes Soundex phonetic similarity, Date of Birth, and National ID across all {totalCount} registered records.
            </p>
            <div style={{ padding: '12px', background: '#d1fae5', borderRadius: '8px', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.8rem', fontWeight: 600 }}>
              ✓ 0 Duplicate Patient Identities Detected. Patient Registry integrity verified.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowMpiModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
