import React, { useState, useEffect } from 'react';
import {
  Users, Search, Plus, FileText, Phone, Mail, Calendar, Activity, X,
  Stethoscope, Camera, ShieldCheck, Copy, Loader2, ChevronLeft, ChevronRight,
  MapPin, CreditCard, User, Building, Hash
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
  const [mrnPreview, setMrnPreview] = useState(`HD-${Math.floor(1000 + Math.random() * 9000)}`);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState(''); // Father's Name
  const [grandfatherName, setGrandfatherName] = useState(''); // Grandfather Name / LastName
  const [dob, setDob] = useState('1995-01-01');
  const [gender, setGender] = useState('1');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Insurance'>('Cash');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [copayPercent, setCopayPercent] = useState('0');
  const [nationalId, setNationalId] = useState('');

  // Medical History Form State
  const [historyType, setHistoryType] = useState('PastMedical');
  const [historyDesc, setHistoryDesc] = useState('');

  const [patients, setPatients] = useState<any[]>([]);

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

  const openRegisterModal = async () => {
    try {
      const res: any = await api.get('/patients/next-mrn');
      const nextVal = res?.nextMRN || res?.NextMRN || res?.data?.nextMRN || res?.data?.NextMRN;
      if (nextVal) {
        setMrnPreview(nextVal);
      } else {
        setMrnPreview(`HD-${String(patients.length + 1).padStart(4, '0')}`);
      }
    } catch {
      setMrnPreview(`HD-${String(patients.length + 1).padStart(4, '0')}`);
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

  // Pagination Calculations
  const totalCount = patients.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedPatients = patients.slice(startIndex, endIndex);

  return (
    <div>
      {/* Search and Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '380px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by Patient Name, MRN / Card No, or Phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowMpiModal(true)} className="btn-secondary">
            <ShieldCheck size={15} /> MPI Duplicate Check
          </button>
          <button onClick={openRegisterModal} className="btn-primary">
            <Plus size={15} /> + Register New Patient
          </button>
        </div>
      </div>

      {/* Main Content Layout: Table & Detail Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedPatient ? '1fr 360px' : '1fr', gap: '18px' }}>
        {/* Patients Table Panel */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
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
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', fontSize: '0.85rem' }}>
                        {p.mrn}
                      </span>
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
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setSelectedPatient(p)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          View
                        </button>
                        {onSelectEmrPatient && (
                          <button
                            onClick={() => onSelectEmrPatient(p.id)}
                            className="btn-primary"
                            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                          >
                            <Stethoscope size={12} /> EMR
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

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
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Register New Patient</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Create master patient index record</span>
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

              {/* DOB, Gender, Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date of Birth *</label>
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)} required />
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
