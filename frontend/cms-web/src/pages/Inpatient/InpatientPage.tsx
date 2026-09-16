import React, { useState, useEffect } from 'react';
import {
  Bed, Users, CheckCircle2, Clock, Plus, LogOut, Activity,
  Stethoscope, ShieldAlert, FileText, ChevronRight, X, Loader2,
  Calendar, AlertTriangle, HeartPulse, Sparkles, RefreshCw
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface Ward {
  id: number;
  name: string;
  wardType: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  isActive: boolean;
}

interface BedItem {
  id: number;
  wardId: number;
  wardName: string;
  bedNumber: string;
  dailyRate: number;
  statusId: number; // 1=Available, 2=Occupied, 3=Maintenance, 4=Cleaning
  statusName: string;
  currentAdmissionId?: number;
  patientId?: number;
  patientName?: string;
  mrn?: string;
  admittedAt?: string;
  doctorName?: string;
}

interface Admission {
  id: number;
  patientId: number;
  patientName: string;
  mrn: string;
  bedId: number;
  bedNumber: string;
  wardName: string;
  doctorId?: number;
  doctorName?: string;
  admittedAt: string;
  admissionReason: string;
  initialDiagnosis?: string;
  statusId: number;
  statusName: string;
  rounds?: any[];
}

export default function InpatientPage() {
  const [activeTab, setActiveTab] = useState<'floorplan' | 'admissions'>('floorplan');
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<BedItem[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<number | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [admitBedId, setAdmitBedId] = useState<number | null>(null);
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);

  // Form states
  const [patients, setPatients] = useState<any[]>([]);
  const [admitPatientId, setAdmitPatientId] = useState<number | ''>('');
  const [admissionReason, setAdmissionReason] = useState('');
  const [initialDiagnosis, setInitialDiagnosis] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Round Form
  const [roundBp, setRoundBp] = useState('120/80');
  const [roundHr, setRoundHr] = useState('74');
  const [roundTemp, setRoundTemp] = useState('36.8');
  const [roundSpo2, setRoundSpo2] = useState('98');
  const [roundNotes, setRoundNotes] = useState('Patient comfortable, afebrile, vitals stable.');
  const [roundFluids, setRoundFluids] = useState('Normal Saline 0.9% @ 80ml/hr');
  const [roundMeds, setRoundMeds] = useState('Ceftriaxone 1g IV BD, Paracetamol 1g PO PRN');

  // Discharge Form
  const [dischargeSummary, setDischargeSummary] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [wardsRes, bedsRes, admRes, patRes] = await Promise.all([
        api.get<Ward[]>('/inpatient/wards').catch(() => []),
        api.get<BedItem[]>('/inpatient/beds').catch(() => []),
        api.get<Admission[]>('/inpatient/admissions?statusId=1').catch(() => []),
        api.get<any[]>('/patients/search').catch(() => [])
      ]);
      setWards(Array.isArray(wardsRes) ? wardsRes : []);
      setBeds(Array.isArray(bedsRes) ? bedsRes : []);
      setAdmissions(Array.isArray(admRes) ? admRes : []);
      setPatients(Array.isArray(patRes) ? patRes : []);
    } catch (err) {
      console.error('Failed to load inpatient data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBeds = selectedWardId === 'ALL'
    ? beds
    : beds.filter(b => b.wardId === selectedWardId);

  const handleOpenAdmit = (bedId?: number) => {
    if (bedId) setAdmitBedId(bedId);
    else {
      const available = beds.find(b => b.statusId === 1);
      if (available) setAdmitBedId(available.id);
    }
    setAdmitPatientId(patients[0]?.id || '');
    setAdmissionReason('');
    setInitialDiagnosis('');
    setShowAdmitModal(true);
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitBedId || !admitPatientId) return;
    try {
      setIsSubmitting(true);
      await api.post('/inpatient/admit', {
        tenantId: 1,
        patientId: Number(admitPatientId),
        bedId: admitBedId,
        admissionReason: admissionReason.trim() || 'Acute medical observation and inpatient treatment',
        initialDiagnosis: initialDiagnosis.trim() || 'Under observation',
        createdBy: 1
      });
      setShowAdmitModal(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to admit patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    try {
      setIsSubmitting(true);
      await api.post('/inpatient/rounds', {
        admissionId: selectedAdmission.id,
        staffName: 'Charge Nurse',
        bloodPressure: roundBp,
        heartRate: parseInt(roundHr) || 72,
        temperature: parseFloat(roundTemp) || 36.6,
        spO2: parseInt(roundSpo2) || 98,
        nursingNotes: roundNotes,
        ivFluids: roundFluids,
        medicationsGiven: roundMeds
      });
      setShowRoundModal(false);
      await loadData();
      const updatedAdmissions = await api.get<Admission[]>('/inpatient/admissions?statusId=1');
      if (Array.isArray(updatedAdmissions)) {
        const found = updatedAdmissions.find(a => a.id === selectedAdmission.id);
        if (found) setSelectedAdmission(found);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to record nursing round');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDischargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    try {
      setIsSubmitting(true);
      const res: any = await api.post('/inpatient/discharge', {
        admissionId: selectedAdmission.id,
        dischargeSummary: dischargeSummary.trim() || 'Patient recovered well. Vital signs stable, prescribed oral discharge medications.'
      });
      alert(`Patient discharged! Stay duration: ${res?.totalStayDays || 1} day(s), Total Bed Charge: Br ${(res?.totalBedCharge || 350).toFixed(2)}.`);
      setShowDischargeModal(false);
      setSelectedAdmission(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to discharge patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (statusId: number) => {
    switch (statusId) {
      case 1: return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'Available' };
      case 2: return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', label: 'Occupied' };
      case 3: return { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'Maintenance' };
      case 4: return { bg: '#fdf4ff', text: '#c026d3', border: '#f5d0fe', label: 'Cleaning' };
      default: return { bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb', label: 'Unknown' };
    }
  };

  const totalBedsCount = beds.length;
  const occupiedCount = beds.filter(b => b.statusId === 2).length;
  const availableCount = beds.filter(b => b.statusId === 1).length;
  const occupancyRate = totalBedsCount > 0 ? Math.round((occupiedCount / totalBedsCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner Metric Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'rgba(0,113,227,0.1)', color: '#0071e3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bed size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Beds</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{totalBedsCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Occupied Beds</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb' }}>{occupiedCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Available Beds</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>{availableCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Occupancy Rate</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#8b5cf6' }}>{occupancyRate}%</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('floorplan')}
            className={activeTab === 'floorplan' ? 'btn-primary' : 'btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          >
            <Bed size={15} /> Ward & Bed Floorplan
          </button>
          <button
            onClick={() => setActiveTab('admissions')}
            className={activeTab === 'admissions' ? 'btn-primary' : 'btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          >
            <Users size={15} /> Active Admissions ({admissions.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadData} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => handleOpenAdmit()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} /> New Inpatient Admission
          </button>
        </div>
      </div>

      {/* Main Panel */}
      {activeTab === 'floorplan' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          {/* Ward filter selector */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter by Ward:</span>
            <button
              onClick={() => setSelectedWardId('ALL')}
              className={selectedWardId === 'ALL' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            >
              All Wards ({beds.length})
            </button>
            {wards.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWardId(w.id)}
                className={selectedWardId === w.id ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
              >
                {w.name} ({w.occupiedBeds}/{w.totalBeds})
              </button>
            ))}
          </div>

          {/* Bed Matrix Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {filteredBeds.map(b => {
              const badge = getStatusColor(b.statusId);
              const isOccupied = b.statusId === 2;
              return (
                <div
                  key={b.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: `1px solid ${b.statusId === 2 ? '#bfdbfe' : 'var(--border-color)'}`,
                    background: b.statusId === 2 ? '#f8faff' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: b.statusId === 2 ? '0 4px 12px rgba(37,99,235,0.06)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace' }}>{b.bedNumber}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{b.wardName}</div>
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: badge.bg,
                      color: badge.text,
                      border: `1px solid ${badge.border}`
                    }}>
                      {badge.label}
                    </span>
                  </div>

                  {isOccupied ? (
                    <div style={{ padding: '10px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={13} /> {b.patientName}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                        MRN: {b.mrn} | {b.doctorName || 'Attending Physician'}
                      </div>
                      {b.admittedAt && (
                        <div style={{ color: '#3b82f6', fontSize: '0.68rem', marginTop: '4px' }}>
                          Admitted: {new Date(b.admittedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                      Ready for Admission (Br {b.dailyRate.toFixed(2)}/day)
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    {isOccupied ? (
                      <button
                        onClick={() => {
                          const adm = admissions.find(a => a.id === b.currentAdmissionId);
                          if (adm) setSelectedAdmission(adm);
                          else setSelectedAdmission({
                            id: b.currentAdmissionId || 0,
                            patientId: b.patientId || 0,
                            patientName: b.patientName || 'Inpatient',
                            mrn: b.mrn || '',
                            bedId: b.id,
                            bedNumber: b.bedNumber,
                            wardName: b.wardName,
                            admittedAt: b.admittedAt || new Date().toISOString(),
                            admissionReason: 'Inpatient observation',
                            statusId: 1,
                            statusName: 'Admitted'
                          });
                        }}
                        className="btn-secondary"
                        style={{ flex: 1, padding: '6px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Activity size={12} /> Chart & Rounds
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenAdmit(b.id)}
                        className="btn-primary"
                        style={{ flex: 1, padding: '6px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Plus size={12} /> Assign Patient
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admissions Tab */}
      {activeTab === 'admissions' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="#0071e3" /> Active Hospitalized Inpatients
          </h4>

          {admissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No active inpatient admissions. All hospital beds are currently vacant.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Patient / MRN</th>
                    <th style={{ padding: '8px 10px' }}>Ward & Bed</th>
                    <th style={{ padding: '8px 10px' }}>Admitted Date</th>
                    <th style={{ padding: '8px 10px' }}>Attending Physician</th>
                    <th style={{ padding: '8px 10px' }}>Admission Diagnosis</th>
                    <th style={{ padding: '8px 10px' }}>Rounds</th>
                    <th style={{ padding: '8px 10px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admissions.map(adm => (
                    <tr key={adm.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{adm.patientName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{adm.mrn}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 600 }}>{adm.wardName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#0071e3', fontFamily: 'monospace' }}>{adm.bedNumber}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        {new Date(adm.admittedAt).toLocaleDateString()} {new Date(adm.admittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px' }}>{adm.doctorName || 'Dr. On Call'}</td>
                      <td style={{ padding: '10px', maxWidth: '200px' }}>
                        <div style={{ fontWeight: 600 }}>{adm.initialDiagnosis || adm.admissionReason}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{adm.admissionReason}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span className="badge badge-info">{adm.rounds?.length || 0} recorded</span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedAdmission(adm)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                          >
                            Open Chart
                          </button>
                          <button
                            onClick={() => { setSelectedAdmission(adm); setShowDischargeModal(true); }}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.72rem', color: '#ef4444', borderColor: '#fca5a5' }}
                          >
                            Discharge
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Drawer: Inpatient Clinical Chart & Nursing Rounds */}
      {selectedAdmission && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 90 }}>
          <div style={{ width: '680px', maxWidth: '100%', background: 'var(--bg-card)', height: '100%', padding: '28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '-8px 0 24px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HeartPulse color="#ef4444" size={20} /> Inpatient Clinical Chart
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedAdmission.patientName} (MRN: {selectedAdmission.mrn}) — {selectedAdmission.wardName}, {selectedAdmission.bedNumber}
                </div>
              </div>
              <button onClick={() => setSelectedAdmission(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Inpatient details card */}
            <div style={{ background: 'var(--bg-dark, #f8fafc)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.78rem' }}>
              <div><strong>Admitted Date:</strong> {new Date(selectedAdmission.admittedAt).toLocaleString()}</div>
              <div><strong>Attending Doctor:</strong> {selectedAdmission.doctorName || 'Dr. Staff'}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Admission Reason:</strong> {selectedAdmission.admissionReason}</div>
              {selectedAdmission.initialDiagnosis && <div style={{ gridColumn: '1 / -1' }}><strong>Initial Diagnosis:</strong> {selectedAdmission.initialDiagnosis}</div>}
            </div>

            {/* Rounds Timeline */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={16} color="#0071e3" /> Nursing Rounds & Vitals Flowsheet
                </h4>
                <button
                  onClick={() => setShowRoundModal(true)}
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} /> Record Round
                </button>
              </div>

              {!selectedAdmission.rounds || selectedAdmission.rounds.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', background: 'var(--bg-dark, #f8fafc)', borderRadius: '8px' }}>
                  No nursing rounds recorded yet. Click "Record Round" to enter vital signs, IV fluids, and nursing observations.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedAdmission.rounds.map(r => (
                    <div key={r.id} style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0071e3' }}>{r.staffName}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(r.roundTime).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', background: 'var(--bg-dark, #f8fafc)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, marginBottom: '8px' }}>
                        <div>BP: <span style={{ color: '#ef4444' }}>{r.bloodPressure || 'N/A'}</span></div>
                        <div>HR: <span style={{ color: '#0284c7' }}>{r.heartRate || 'N/A'} bpm</span></div>
                        <div>Temp: <span style={{ color: '#d97706' }}>{r.temperature || 'N/A'}°C</span></div>
                        <div>SpO2: <span style={{ color: '#059669' }}>{r.spO2 || 'N/A'}%</span></div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginTop: '4px' }}>
                        <strong>Notes:</strong> {r.nursingNotes}
                      </div>
                      {r.ivFluids && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}><strong>IV Fluids:</strong> {r.ivFluids}</div>}
                      {r.medicationsGiven && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}><strong>Medications:</strong> {r.medicationsGiven}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => { setShowDischargeModal(true); }}
                className="btn-secondary"
                style={{ color: '#ef4444', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <LogOut size={14} /> Discharge Inpatient
              </button>
              <button onClick={() => setSelectedAdmission(null)} className="btn-primary">
                Close Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Admission */}
      {showAdmitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '520px', padding: '24px', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bed size={18} color="#0071e3" /> Inpatient Bed Admission
              </h3>
              <button onClick={() => setShowAdmitModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleAdmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Select Patient</label>
                <select
                  value={admitPatientId}
                  onChange={e => setAdmitPatientId(Number(e.target.value))}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Select Bed</label>
                <select
                  value={admitBedId || ''}
                  onChange={e => setAdmitBedId(Number(e.target.value))}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
                >
                  <option value="">-- Choose Bed --</option>
                  {beds.filter(b => b.statusId === 1 || b.id === admitBedId).map(b => (
                    <option key={b.id} value={b.id}>{b.wardName} - {b.bedNumber} (Br {b.dailyRate}/day)</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Admission Clinical Reason</label>
                <textarea
                  rows={2}
                  value={admissionReason}
                  onChange={e => setAdmissionReason(e.target.value)}
                  placeholder="e.g. Severe dehydration requiring IV resuscitation and close observation"
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Initial Working Diagnosis</label>
                <input
                  type="text"
                  value={initialDiagnosis}
                  onChange={e => setInitialDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Gastroenteritis with moderate dehydration"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAdmitModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Confirm Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Nursing Round */}
      {showRoundModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '480px', padding: '24px', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#0071e3" /> Record Inpatient Nursing Round
              </h3>
              <button onClick={() => setShowRoundModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleRecordRound} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Blood Pressure</label>
                  <input type="text" value={roundBp} onChange={e => setRoundBp(e.target.value)} placeholder="120/80" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Heart Rate (bpm)</label>
                  <input type="number" value={roundHr} onChange={e => setRoundHr(e.target.value)} placeholder="72" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Temperature (°C)</label>
                  <input type="number" step="0.1" value={roundTemp} onChange={e => setRoundTemp(e.target.value)} placeholder="36.8" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Oxygen Saturation (SpO2 %)</label>
                  <input type="number" value={roundSpo2} onChange={e => setRoundSpo2(e.target.value)} placeholder="98" required />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nursing Notes / Clinical Observations</label>
                <textarea rows={2} value={roundNotes} onChange={e => setRoundNotes(e.target.value)} required />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>IV Fluids Active Rate</label>
                <input type="text" value={roundFluids} onChange={e => setRoundFluids(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Medications Administered</label>
                <input type="text" value={roundMeds} onChange={e => setRoundMeds(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowRoundModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Saving...' : 'Save Round Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Discharge Inpatient */}
      {showDischargeModal && selectedAdmission && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '500px', padding: '24px', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LogOut size={18} /> Discharge Inpatient Summary
              </h3>
              <button onClick={() => setShowDischargeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', fontSize: '0.78rem', color: '#991b1b', marginBottom: '14px' }}>
              Discharging <strong>{selectedAdmission.patientName}</strong> will vacate bed <strong>{selectedAdmission.bedNumber}</strong> ({selectedAdmission.wardName}) and calculate total bed stay charges.
            </div>

            <form onSubmit={handleDischargeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Clinical Discharge Summary</label>
                <textarea
                  rows={4}
                  value={dischargeSummary}
                  onChange={e => setDischargeSummary(e.target.value)}
                  placeholder="Summarize patient progress, final diagnosis, discharge medications, and follow-up plan..."
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowDischargeModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                  {isSubmitting ? 'Discharging...' : 'Confirm Patient Discharge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
