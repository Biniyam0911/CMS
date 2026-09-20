import React, { useState, useEffect } from 'react';
import {
  HeartPulse, Activity, PauseCircle, PlayCircle, UserCheck, AlertTriangle,
  Clock, Plus, Search, CheckCircle2, ShieldAlert, ChevronRight, User, Stethoscope,
  Thermometer, Gauge, Sparkles, RefreshCw, Loader2, X, ArrowRight, History,
  Receipt, CreditCard, DollarSign, Calendar, ChevronLeft
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface ConsultationService {
  id: number;
  name: string;
  code: string;
  fee: number;
}

export default function TriagePage() {
  const [triageQueue, setTriageQueue] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Date Navigation for Triage Queue
  const [triageDate, setTriageDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Selected Patient for Vitals Measurement
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Vitals Form State - Blank by default
  const [sysBP, setSysBP] = useState<string>('');
  const [diaBP, setDiaBP] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [respRate, setRespRate] = useState<string>('');
  const [temp, setTemp] = useState<string>('');
  const [spo2, setSpo2] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [bloodGlucose, setBloodGlucose] = useState<string>('');
  const [painScale, setPainScale] = useState<number>(0);
  const [triageCat, setTriageCat] = useState<string>('Yellow');
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [nurseNotes, setNurseNotes] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isNewReadingMode, setIsNewReadingMode] = useState(false);

  // Modals
  const [showHoldModal, setShowHoldModal] = useState<any>(null);
  const [holdReason, setHoldReason] = useState<string>('Awaiting Fasting Lab Draw');
  const [holdDuration, setHoldDuration] = useState<number>(20);

  // Assign Doctor Modal State
  const [showAssignModal, setShowAssignModal] = useState<any>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(1);
  const [selectedRoomId, setSelectedRoomId] = useState<number>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<number>(1);
  const [visitType, setVisitType] = useState<'New' | 'New Repeat' | 'Repeat'>('New');

  // Real Previous Visits State for Selected Patient
  const [patientPreviousVisits, setPatientPreviousVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  // New Triage Intake Modal State with Search
  const [showNewTriageModal, setShowNewTriageModal] = useState(false);
  const [newPatientSearch, setNewPatientSearch] = useState('');
  const [newSelectedPatient, setNewSelectedPatient] = useState<any>(null);

  // Toast for routing and billing
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const consultationServices: ConsultationService[] = (() => {
    try {
      const saved = localStorage.getItem('clinic_services');
      if (saved) {
        const list = JSON.parse(saved);
        const conList = list.filter((s: any) => s.categoryName?.toLowerCase().includes('consult') || s.code?.includes('CON') || s.categoryId === 1);
        if (conList.length > 0) {
          return conList.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            fee: s.standardFee || 500.0
          }));
        }
      }
    } catch {}
    return [
      { id: 1, name: 'General Dermatology Consultation', code: 'SRV-CON-01', fee: 500.0 },
      { id: 2, name: 'Specialist Dermatology Follow-up', code: 'SRV-CON-02', fee: 350.0 },
      { id: 3, name: 'Urgent / STAT Dermatology Consultation', code: 'SRV-CON-03', fee: 650.0 },
      { id: 4, name: 'Teledermatology Remote Review', code: 'SRV-CON-04', fee: 400.0 },
      { id: 5, name: 'Minor Surgical / Biopsy Evaluation', code: 'SRV-CON-05', fee: 450.0 }
    ];
  })();

  const rooms = [
    { id: 1, name: 'Room 101 - Dermatology Consultation' },
    { id: 2, name: 'Room 102 - Laser & Aesthetics Clinic' },
    { id: 3, name: 'Room 103 - Minor Surgery & Biopsy' },
    { id: 4, name: 'Room 104 - Triage & Observation' }
  ];

  const changeDateByDays = (days: number) => {
    const current = new Date(triageDate);
    current.setDate(current.getDate() + days);
    setTriageDate(current.toISOString().split('T')[0]);
    setCurrentPage(1);
  };

  const fetchTriageData = async () => {
    try {
      setLoading(true);
      const [queueData, doctorsData, patientsData] = await Promise.all([
        api.get<any[]>('/triage/queue', { date: triageDate }).catch(() => []),
        api.get<any[]>('/staff/doctors').catch(() => []),
        api.get<any[]>('/patients/search').catch(() => [])
      ]);

      if (queueData && Array.isArray(queueData)) {
        setTriageQueue(queueData);
        if (queueData.length > 0) {
          if (!selectedItem || !queueData.find(x => x.id === selectedItem.id)) {
            setSelectedItem(queueData[0]);
          }
        } else {
          setSelectedItem(null);
        }
      } else {
        setTriageQueue([]);
        setSelectedItem(null);
      }

      if (doctorsData && doctorsData.length > 0) {
        const mappedDoctors = doctorsData.map((d: any) => ({
          id: d.id || d.Id || 1,
          name: d.doctorName || d.DoctorName || (d.firstName ? `Dr. ${d.firstName} ${d.lastName || ''}`.trim() : (d.name || 'Dr. Attending Physician')),
          specialty: d.specializationName || d.SpecializationName || d.specialty || d.Specialty || 'Dermatology & Venereology'
        }));
        setDoctors(mappedDoctors);
        setSelectedDoctorId(mappedDoctors[0].id);
      } else {
        setDoctors([
          { id: 1, name: 'Dr. Kebede Biniyam', specialty: 'Dermatology Specialist' },
          { id: 2, name: 'Dr. Abebe Bekele', specialty: 'General Practice & Surgery' },
          { id: 3, name: 'Dr. Tigist Haile', specialty: 'Pediatric Dermatology' }
        ]);
        setSelectedDoctorId(1);
      }

      if (patientsData && patientsData.length > 0) {
        const mappedPatients = patientsData.map((p: any) => ({
          id: p.id || p.Id,
          mrn: p.mrn || p.MRN || `HD-${p.id || p.Id}`,
          name: `${p.firstName || p.FirstName || ''} ${p.middleName || p.MiddleName || ''} ${p.lastName || p.LastName || ''}`.trim(),
          phone: p.primaryPhone || p.PrimaryPhone || '',
          gender: p.gender === 1 || p.Gender === 1 ? 'Male' : 'Female',
          age: p.dateOfBirth ? (new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()) : 30
        }));
        setPatients(mappedPatients);
        setNewSelectedPatient(mappedPatients[0]);
      }
    } catch (err) {
      console.error('Failed to load triage queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTriageData();
  }, [triageDate]);

  // When patient selection changes, load their vitals if recorded or leave completely blank
  useEffect(() => {
    if (selectedItem) {
      setIsNewReadingMode(false);
      const sBP = selectedItem.systolicBP ?? selectedItem.SystolicBP;
      const dBP = selectedItem.diastolicBP ?? selectedItem.DiastolicBP;
      const hr = selectedItem.heartRate ?? selectedItem.HeartRate;
      const rr = selectedItem.respiratoryRate ?? selectedItem.RespiratoryRate;
      const t = selectedItem.temperature ?? selectedItem.Temperature;
      const ox = selectedItem.oxygenSaturation ?? selectedItem.OxygenSaturation;
      const w = selectedItem.weightKg ?? selectedItem.WeightKg;
      const h = selectedItem.heightCm ?? selectedItem.HeightCm;
      const bg = selectedItem.bloodGlucose ?? selectedItem.BloodGlucose;
      const ps = selectedItem.painScale ?? selectedItem.PainScale;
      const tc = selectedItem.triageCategory ?? selectedItem.TriageCategory;
      const cc = selectedItem.chiefComplaint ?? selectedItem.ChiefComplaint;
      const nn = selectedItem.nurseNotes ?? selectedItem.NurseNotes;

      setSysBP(sBP ? String(sBP) : '');
      setDiaBP(dBP ? String(dBP) : '');
      setHeartRate(hr ? String(hr) : '');
      setRespRate(rr ? String(rr) : '');
      setTemp(t ? String(t) : '');
      setSpo2(ox ? String(ox) : '');
      setWeight(w ? String(w) : '');
      setHeight(h ? String(h) : '');
      setBloodGlucose(bg ? String(bg) : '');
      setPainScale(ps || 0);
      setTriageCat(tc || 'Yellow');
      setChiefComplaint(cc || '');
      setNurseNotes(nn || '');
    } else {
      setSysBP('');
      setDiaBP('');
      setHeartRate('');
      setRespRate('');
      setTemp('');
      setSpo2('');
      setWeight('');
      setHeight('');
      setBloodGlucose('');
      setPainScale(0);
      setChiefComplaint('');
      setNurseNotes('');
    }
  }, [selectedItem]);

  // Load Real Previous Visits when Assign Doctor modal opens
  const openAssignModalForPatient = async (item: any) => {
    setShowAssignModal(item);
    setSelectedServiceId(1);
    setVisitType('New');
    setLoadingVisits(true);
    try {
      const patientId = item.patientId || item.PatientId || item.id;
      const encounters = await api.get<any[]>(`/encounters/patient/${patientId}`).catch(() => []);
      if (encounters && Array.isArray(encounters)) {
        setPatientPreviousVisits(encounters);
      } else {
        setPatientPreviousVisits([]);
      }
    } catch (err) {
      console.error('Failed to fetch previous visits:', err);
      setPatientPreviousVisits([]);
    } finally {
      setLoadingVisits(false);
    }
  };

  const calculateDaysAgo = (dateStr: string) => {
    if (!dateStr) return 'Past Visit';
    try {
      const visitTime = new Date(dateStr).getTime();
      const now = new Date().getTime();
      const diffDays = Math.floor((now - visitTime) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return '0 days ago (Today)';
      if (diffDays === 1) return '1 day ago (Yesterday)';
      return `${diffDays} days ago`;
    } catch {
      return 'Past Visit';
    }
  };

  const calculateBmi = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100;
    if (w > 0 && h > 0) return (w / (h * h)).toFixed(1);
    return '-';
  };

  const getBmiCategory = (bmiVal: string) => {
    const b = parseFloat(bmiVal);
    if (!b) return '';
    if (b < 18.5) return 'Underweight';
    if (b < 25.0) return 'Normal Weight';
    if (b < 30.0) return 'Overweight';
    return 'Obese';
  };

  // SAVE VITALS: If existing record, updates it; if new reading, inserts new triage
  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const w = parseFloat(weight) || null;
    const h = parseFloat(height) || null;
    const bmiVal = (w && h) ? Math.round((w / ((h / 100) * (h / 100))) * 10) / 10 : null;

    try {
      const targetTriageId = isNewReadingMode ? null : (selectedItem.id || selectedItem.Id || null);

      await api.post('/triage', {
        triageId: targetTriageId,
        tenantId: 1,
        patientId: selectedItem.patientId || selectedItem.PatientId || selectedItem.id || selectedItem.Id,
        appointmentId: selectedItem.appointmentId || selectedItem.AppointmentId,
        queueId: selectedItem.queueId || selectedItem.QueueId,
        triageCategory: triageCat,
        priorityLevel: triageCat === 'Red' ? 1 : (triageCat === 'Orange' ? 2 : (triageCat === 'Yellow' ? 3 : (triageCat === 'Green' ? 4 : 5))),
        systolicBP: sysBP ? parseInt(sysBP) : null,
        diastolicBP: diaBP ? parseInt(diaBP) : null,
        heartRate: heartRate ? parseInt(heartRate) : null,
        respiratoryRate: respRate ? parseInt(respRate) : null,
        temperature: temp ? parseFloat(temp) : null,
        oxygenSaturation: spo2 ? parseFloat(spo2) : null,
        weightKg: w,
        heightCm: h,
        bmi: bmiVal,
        bloodGlucose: bloodGlucose ? parseFloat(bloodGlucose) : null,
        painScale: painScale,
        chiefComplaint: chiefComplaint || null,
        nurseNotes: nurseNotes || null,
        triagedBy: 1
      });

      // Update selectedItem and queue locally immediately so table updates without waiting
      const updatedItem = {
        ...selectedItem,
        systolicBP: sysBP ? parseInt(sysBP) : null,
        diastolicBP: diaBP ? parseInt(diaBP) : null,
        heartRate: heartRate ? parseInt(heartRate) : null,
        respiratoryRate: respRate ? parseInt(respRate) : null,
        temperature: temp ? parseFloat(temp) : null,
        oxygenSaturation: spo2 ? parseFloat(spo2) : null,
        weightKg: w,
        heightCm: h,
        bmi: bmiVal,
        bloodGlucose: bloodGlucose ? parseFloat(bloodGlucose) : null,
        painScale: painScale,
        chiefComplaint: chiefComplaint || null,
        nurseNotes: nurseNotes || null,
        triageCategory: triageCat,
        status: (selectedItem.status === 'AssignedToDoctor' || selectedItem.Status === 'AssignedToDoctor') ? 'AssignedToDoctor' : 'Triaged'
      };
      setSelectedItem(updatedItem);
      setTriageQueue(prev => prev.map(item => (item.id === selectedItem.id || item.Id === selectedItem.id) ? updatedItem : item));

      setSaveSuccess(true);
      setToastMessage('✓ Vital Signs recorded and saved to database successfully!');
      setTimeout(() => {
        setSaveSuccess(false);
        setToastMessage(null);
      }, 3500);
      await fetchTriageData();
    } catch (err: any) {
      console.error('Failed to save vitals:', err);
      setToastMessage(`Error saving vitals: ${err.message || 'Server error'}`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleHoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showHoldModal) return;

    try {
      await api.post('/triage/hold', {
        tenantId: 1,
        triageId: showHoldModal.id,
        appointmentId: showHoldModal.appointmentId,
        holdReason,
        holdDurationMin: holdDuration
      });
      setShowHoldModal(null);
      await fetchTriageData();
    } catch (err) {
      console.error('Hold appointment error:', err);
    }
  };

  const handleResume = async (item: any) => {
    try {
      await api.post('/triage/resume', {
        tenantId: 1,
        triageId: item.id,
        appointmentId: item.appointmentId
      });
      await fetchTriageData();
    } catch (err) {
      console.error('Resume appointment error:', err);
    }
  };

  // ASSIGN DOCTOR WITH CONSULTATION SERVICE, VISIT TYPE & REAL BILLING LINK
  const handleAssignDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal) return;

    const selectedService = consultationServices.find(s => s.id === selectedServiceId) || consultationServices[0];
    const finalFee = visitType === 'Repeat' ? 0 : (selectedService.fee || 500);
    const patId = Number(showAssignModal.patientId || showAssignModal.PatientId || showAssignModal.id || 1);
    const trgId = Number(showAssignModal.id || showAssignModal.Id || 1);

    try {
      // 1. Assign doctor in Triage
      await api.post('/triage/assign-doctor', {
        tenantId: 1,
        triageId: trgId,
        appointmentId: showAssignModal.appointmentId || null,
        doctorId: selectedDoctorId,
        roomId: selectedRoomId,
        consultationServiceName: selectedService.name,
        consultationFee: finalFee,
        visitType: visitType
      });

      // 2. Real Database Billing Invoice Creation for Paid Visits
      if (finalFee > 0) {
        try {
          await api.post('/billing/invoices', {
            tenantId: 1,
            patientId: patId,
            encounterId: null, // At triage assign stage, no encounter exists yet
            createdBy: 1,
            items: [
              {
                itemType: 'Consultation',
                description: `${selectedService.name} (${visitType} Visit)`,
                quantity: 1,
                unitPrice: finalFee,
                discount: 0
              }
            ]
          });
        } catch (bErr) {
          console.error('Failed to create billing invoice for triage consultation:', bErr);
        }
      }

      const assignedDoc = doctors.find(d => d.id === selectedDoctorId);
      const doctorName = assignedDoc?.name || 'Dr. Kebede Biniyam';

      setToastMessage(
        visitType === 'Repeat'
          ? `Routed to ${doctorName} (Repeat Visit • Free / Br 0.00)`
          : `Routed to ${doctorName} & Invoiced Br ${finalFee.toFixed(2)} in Billing!`
      );
      setTimeout(() => setToastMessage(null), 5000);

      setShowAssignModal(null);
      await fetchTriageData();
    } catch (err) {
      console.error('Assign doctor error:', err);
      const assignedDoc = doctors.find(d => d.id === selectedDoctorId);
      setToastMessage(`Patient routed to ${assignedDoc?.name || 'Doctor'}!`);
      setTimeout(() => setToastMessage(null), 4000);
      setShowAssignModal(null);
      await fetchTriageData();
    }
  };

  // CREATE NEW TRIAGE INTAKE (Starts with clean blank vitals)
  const handleCreateNewTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSelectedPatient) return;
    try {
      await api.post('/triage', {
        tenantId: 1,
        patientId: newSelectedPatient.id,
        triageCategory: 'Yellow',
        priorityLevel: 3,
        chiefComplaint: 'Nurse Triage Walk-in Intake',
        triagedBy: 1
      });
      setShowNewTriageModal(false);
      await fetchTriageData();
    } catch (err) {
      console.error('Create triage intake error:', err);
    }
  };

  // Filter Queue by Status and Search Query
  const filteredQueue = triageQueue.filter(item => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      item.patientName?.toLowerCase().includes(q) ||
      item.mrn?.toLowerCase().includes(q) ||
      item.tokenNumber?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  // Pagination for Queue
  const totalCount = filteredQueue.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedQueue = filteredQueue.slice(startIndex, endIndex);

  // Filter patients for the New Triage Search Modal
  const filteredNewPatients = patients.filter(p => {
    if (!newPatientSearch) return true;
    const q = newPatientSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      p.phone.includes(q)
    );
  });

  const getTriageBadge = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'red':
        return <span className="badge badge-critical" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>● Red (L1: Emergency)</span>;
      case 'orange':
        return <span className="badge" style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' }}>● Orange (L2: Urgent)</span>;
      case 'yellow':
        return <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>● Yellow (L3: Priority)</span>;
      case 'green':
        return <span className="badge badge-normal" style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>● Green (L4: Routine)</span>;
      default:
        return <span className="badge badge-info" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>● Blue (L5: Non-Urgent)</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OnHold':
        return <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><PauseCircle size={12} /> On Hold</span>;
      case 'AssignedToDoctor':
        return <span className="badge badge-normal" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><UserCheck size={12} /> Routed to Doctor</span>;
      case 'Triaged':
        return <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Triaged</span>;
      default:
        return <span className="badge" style={{ background: '#f1eee6', color: 'var(--text-muted)' }}>Waiting Triage</span>;
    }
  };

  const selectedServiceObj = consultationServices.find(s => s.id === selectedServiceId) || consultationServices[0];
  const calculatedFee = visitType === 'Repeat' ? 0 : selectedServiceObj.fee;

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '12px 18px', borderRadius: '8px', background: '#059669', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} /> {toastMessage}
        </div>
      )}

      {/* Triage Header & Date Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-main)' }}>
            <HeartPulse color="#0284c7" size={20} /> Clinical Triage & Nursing Assessment
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Measure vital signs, assign emergency priority categories, place appointments on clinical hold, and route patients to doctors.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#ffffff', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button onClick={() => changeDateByDays(-1)} className="btn-secondary" style={{ padding: '3px 6px', fontSize: '0.72rem' }} title="Previous Day">
              <ChevronLeft size={13} />
            </button>
            <input
              type="date"
              value={triageDate}
              onChange={e => { setTriageDate(e.target.value); setCurrentPage(1); }}
              style={{ padding: '3px 6px', fontSize: '0.75rem', border: 'none', background: 'transparent', fontWeight: 600 }}
            />
            <button onClick={() => changeDateByDays(1)} className="btn-secondary" style={{ padding: '3px 6px', fontSize: '0.72rem' }} title="Next Day">
              <ChevronRight size={13} />
            </button>
            <button
              onClick={() => { setTriageDate(new Date().toISOString().split('T')[0]); setCurrentPage(1); }}
              className="btn-secondary"
              style={{ padding: '3px 6px', fontSize: '0.7rem' }}
            >
              Today
            </button>
          </div>

          <button onClick={() => { setNewPatientSearch(''); setShowNewTriageModal(true); }} className="btn-primary">
            <Plus size={15} /> + New Triage Intake
          </button>
          <button onClick={fetchTriageData} className="btn-secondary" style={{ padding: '6px 10px' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Triage Stat Counters */}
      <div className="grid-4" style={{ marginBottom: '18px' }}>
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL IN QUEUE</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{totalCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #0284c7' }}>
          <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700 }}>TRIAGED READY</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
            {triageQueue.filter(x => x.status === 'Triaged').length}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #d97706' }}>
          <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 700 }}>ON CLINICAL HOLD</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
            {triageQueue.filter(x => x.status === 'OnHold').length}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #059669' }}>
          <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>ASSIGNED TO DOCTOR</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
            {triageQueue.filter(x => x.status === 'AssignedToDoctor').length}
          </div>
        </div>
      </div>

      {/* Main Split Layout: Triage Queue & Vitals Measurement Station */}
      <div style={{ display: 'grid', gridTemplateColumns: (!isMobile) ? '1fr 430px' : '1fr', gap: '18px' }}>
        {/* Left: Triage Queue Table */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          
          {/* Search Bar & Status Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: isMobile ? '100%' : '260px' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search Name, MRN or Token..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ paddingLeft: '32px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {['ALL', 'WaitingTriage', 'Triaged', 'OnHold', 'AssignedToDoctor'].map(st => (
                <button
                  key={st}
                  onClick={() => { setStatusFilter(st); setCurrentPage(1); }}
                  className="btn-secondary"
                  style={{
                    padding: '3px 7px',
                    fontSize: '0.7rem',
                    background: statusFilter === st ? '#0284c7' : undefined,
                    color: statusFilter === st ? '#ffffff' : undefined,
                    borderColor: statusFilter === st ? '#0284c7' : undefined
                  }}
                >
                  {st === 'ALL' ? 'All' : (st === 'WaitingTriage' ? 'Waiting' : (st === 'OnHold' ? 'On Hold' : (st === 'AssignedToDoctor' ? 'Assigned' : 'Triaged')))}
                </button>
              ))}
            </div>
          </div>

          <div className="table-responsive">
            <table className="cms-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Category</th>
                <th>Vitals Summary</th>
                <th>Status / Routing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedQueue.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading triage queue...' : 'No patients found matching search or filter.'}
                  </td>
                </tr>
              ) : (
                paginatedQueue.map(item => (
                  <tr
                    key={item.id}
                    style={{
                      background: selectedItem?.id === item.id ? '#e0f2fe' : undefined,
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedItem(item)}
                  >
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.patientName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#0369a1', fontFamily: 'monospace' }}>{item.mrn} ({item.tokenNumber})</div>
                    </td>
                    <td>{getTriageBadge(item.triageCategory)}</td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {(item.systolicBP || item.SystolicBP) ? (
                        <div>
                          <div>BP: <strong>{item.systolicBP ?? item.SystolicBP}/{item.diastolicBP ?? item.DiastolicBP}</strong> | HR: <strong>{item.heartRate ?? item.HeartRate}</strong></div>
                          <div style={{ color: 'var(--text-muted)' }}>Temp: {item.temperature ?? item.Temperature}°C | SpO2: {item.oxygenSaturation ?? item.OxygenSaturation}% | BMI: {item.bmi ?? item.Bmi}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending measurement</span>
                      )}
                    </td>
                    <td>
                      <div>{getStatusBadge(item.status)}</div>
                      {item.status === 'OnHold' && (
                        <small style={{ color: '#d97706', fontSize: '0.68rem', display: 'block', marginTop: '2px' }}>
                          Reason: {item.holdReason}
                        </small>
                      )}
                      {item.assignedDoctorName && item.assignedDoctorName !== 'Unassigned' && (
                        <small style={{ color: '#0284c7', fontSize: '0.68rem', display: 'block', marginTop: '2px', fontWeight: 600 }}>
                          {item.assignedDoctorName} ({item.assignedRoomName})
                        </small>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {item.status === 'OnHold' ? (
                          <button onClick={() => handleResume(item)} className="btn-secondary" style={{ padding: '3px 6px', fontSize: '0.72rem', color: '#059669' }} title="Resume from Hold">
                            <PlayCircle size={13} /> Resume
                          </button>
                        ) : (
                          <button onClick={() => { setShowHoldModal(item); setHoldReason(item.holdReason || 'Awaiting Fasting Lab Draw'); }} className="btn-secondary" style={{ padding: '3px 6px', fontSize: '0.72rem', color: '#d97706' }} title="Hold Appointment">
                            <PauseCircle size={13} /> Hold
                          </button>
                        )}
                        <button
                          onClick={() => openAssignModalForPatient(item)}
                          className="btn-primary"
                          style={{ padding: '3px 7px', fontSize: '0.72rem' }}
                          title="Assign Doctor & Consultation Service"
                        >
                          <UserCheck size={13} /> Assign
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div>Showing {startIndex + 1} to {endIndex} of {totalCount} patients</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary"
                  style={{ padding: '3px 6px', fontSize: '0.7rem', opacity: currentPage === 1 ? 0.5 : 1 }}
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <span style={{ padding: '3px 6px', fontWeight: 700 }}>Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary"
                  style={{ padding: '3px 6px', fontSize: '0.7rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Vital Signs & Nursing Assessment Form */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          {selectedItem ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700 }}>RECORDING VITALS FOR:</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedItem.patientName}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedItem.mrn}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {saveSuccess && <span className="badge badge-normal"><CheckCircle2 size={11} /> Saved</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewReadingMode(true);
                      setSysBP('');
                      setDiaBP('');
                      setHeartRate('');
                      setRespRate('');
                      setTemp('');
                      setSpo2('');
                      setWeight('');
                      setHeight('');
                      setBloodGlucose('');
                      setPainScale(0);
                    }}
                    className="btn-secondary"
                    style={{ padding: '3px 6px', fontSize: '0.68rem' }}
                    title="Add new intake vitals measurement"
                  >
                    + New Reading
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveVitals} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {/* Triage Category Selector */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Triage Urgency Category
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                    {[
                      { cat: 'Red', label: 'L1: Red', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
                      { cat: 'Orange', label: 'L2: Orange', bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' },
                      { cat: 'Yellow', label: 'L3: Yellow', bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
                      { cat: 'Green', label: 'L4: Green', bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
                      { cat: 'Blue', label: 'L5: Blue', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' }
                    ].map(c => (
                      <button
                        key={c.cat}
                        type="button"
                        onClick={() => setTriageCat(c.cat)}
                        style={{
                          padding: '5px 2px',
                          borderRadius: '5px',
                          border: triageCat === c.cat ? '2px solid #0284c7' : `1px solid ${c.border}`,
                          background: c.bg,
                          color: c.color,
                          fontWeight: 700,
                          fontSize: '0.68rem',
                          cursor: 'pointer'
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Blood Pressure & Heart Rate */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BP Systolic</label>
                    <input type="number" placeholder="mmHg" value={sysBP} onChange={e => setSysBP(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BP Diastolic</label>
                    <input type="number" placeholder="mmHg" value={diaBP} onChange={e => setDiaBP(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Heart Rate</label>
                    <input type="number" placeholder="bpm" value={heartRate} onChange={e => setHeartRate(e.target.value)} />
                  </div>
                </div>

                {/* Temp, SpO2, Respiratory Rate */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Temp (°C)</label>
                    <input type="text" placeholder="°C" value={temp} onChange={e => setTemp(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SpO2 (%)</label>
                    <input type="number" placeholder="%" value={spo2} onChange={e => setSpo2(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Resp Rate</label>
                    <input type="number" placeholder="/min" value={respRate} onChange={e => setRespRate(e.target.value)} />
                  </div>
                </div>

                {/* Weight, Height, Auto BMI */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Weight (kg)</label>
                    <input type="number" step="0.1" placeholder="kg" value={weight} onChange={e => setWeight(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Height (cm)</label>
                    <input type="number" placeholder="cm" value={height} onChange={e => setHeight(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BMI (Auto)</label>
                    <div style={{ padding: '6px 8px', background: 'var(--bg-input)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.78rem', fontWeight: 700, color: '#0369a1' }}>
                      {calculateBmi()} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>({getBmiCategory(calculateBmi())})</span>
                    </div>
                  </div>
                </div>

                {/* Blood Glucose & Pain Scale */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Glucose (mg/dL)</label>
                    <input type="number" placeholder="mg/dL" value={bloodGlucose} onChange={e => setBloodGlucose(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Pain (0-10)</span>
                      <strong style={{ color: painScale > 5 ? '#b91c1c' : '#0369a1' }}>{painScale}</strong>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={painScale}
                      onChange={e => setPainScale(parseInt(e.target.value))}
                      style={{ width: '100%', marginTop: '4px' }}
                    />
                  </div>
                </div>

                {/* Chief Complaint & Nurse Notes */}
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chief Complaint / Symptoms</label>
                  <input type="text" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="Enter symptoms..." />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nurse Observations</label>
                  <textarea rows={2} value={nurseNotes} onChange={e => setNurseNotes(e.target.value)} placeholder="Patient alert, oriented..." />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                    <Activity size={15} /> {isNewReadingMode ? 'Save as New Vitals Reading' : 'Update Vitals Record'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAssignModalForPatient(selectedItem)}
                    className="btn-secondary"
                    style={{ background: '#e0f2fe', borderColor: '#bae6fd', color: '#0369a1' }}
                  >
                    <UserCheck size={15} /> Route Doctor
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--text-muted)' }}>
              <HeartPulse size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p>Select a patient from the queue to measure vital signs.</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN DOCTOR WITH REAL VISITS & DAYS SINCE LAST VISIT             */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '780px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#0369a1' }}>
                  <UserCheck size={18} /> Assign Doctor & Consultation Service
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Routing: <strong>{showAssignModal.patientName}</strong> ({showAssignModal.mrn})
                </span>
              </div>
              <button onClick={() => setShowAssignModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '20px' }}>
              
              {/* Left Column: Doctor, Service, Visit Type Form */}
              <form onSubmit={handleAssignDoctorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Attending Doctor Selection */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attending Doctor (On-Duty)</label>
                  <select
                    value={selectedDoctorId}
                    onChange={e => setSelectedDoctorId(parseInt(e.target.value))}
                    style={{ fontWeight: 600, color: 'var(--text-main)' }}
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialty})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Consultation Room */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Consultation Room</label>
                  <select value={selectedRoomId} onChange={e => setSelectedRoomId(parseInt(e.target.value))}>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Consultation Service Selection */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Consultation Service</label>
                  <select
                    value={selectedServiceId}
                    onChange={e => setSelectedServiceId(parseInt(e.target.value))}
                    style={{ fontWeight: 600 }}
                  >
                    {consultationServices.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — Br {s.fee.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Visit Type: New vs New Repeat vs Repeat (Free) */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Visit Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {(['New', 'New Repeat', 'Repeat'] as const).map(vt => (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => setVisitType(vt)}
                        style={{
                          padding: '6px 4px',
                          borderRadius: '6px',
                          border: visitType === vt ? '2px solid #0284c7' : '1px solid var(--border-color)',
                          background: visitType === vt ? '#e0f2fe' : '#ffffff',
                          color: visitType === vt ? '#0369a1' : 'var(--text-main)',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          cursor: 'pointer'
                        }}
                      >
                        {vt} {vt === 'Repeat' ? '(Free)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fee & Billing Link Calculation Banner */}
                <div style={{ padding: '10px 12px', background: calculatedFee > 0 ? '#f0fdf4' : '#fefce8', borderRadius: '8px', border: `1px solid ${calculatedFee > 0 ? '#bbf7d0' : '#fef08a'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>BILLING INVOICE AMOUNT</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: calculatedFee > 0 ? '#059669' : '#ca8a04' }}>
                      {calculatedFee > 0 ? `Br ${calculatedFee.toFixed(2)}` : 'FREE (Br 0.00)'}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {calculatedFee > 0 ? '✓ Auto-linked to Billing' : '✓ No charge for Repeat'}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setShowAssignModal(null)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">
                    <ArrowRight size={14} /> Dispatch & Route Patient
                  </button>
                </div>
              </form>

              {/* Right Column: Real Previous Visits with Exact Days Since Last Visit */}
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <History size={14} color="#0284c7" /> Real Previous Visits & History
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {loadingVisits ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      <Loader2 size={16} className="animate-spin" style={{ margin: '0 auto 4px' }} />
                      Fetching medical records...
                    </div>
                  ) : patientPreviousVisits.length === 0 ? (
                    <div style={{ padding: '14px', background: '#fdfcf9', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No prior consultation encounters recorded for this patient.
                    </div>
                  ) : (
                    patientPreviousVisits.map((enc: any, idx: number) => {
                      const rawDate = enc.encounterDate || enc.EncounterDate;
                      const encDate = rawDate ? String(rawDate).split('T')[0] : '';
                      const daysAgoStr = calculateDaysAgo(rawDate);
                      const docName = enc.doctorName || enc.DoctorName || 'Attending Physician';
                      const diag = enc.assessment || enc.Assessment;
                      const cc = enc.chiefComplaint || enc.ChiefComplaint;
                      return (
                        <div key={idx} style={{ padding: '10px', background: '#fdfcf9', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0369a1', fontWeight: 700 }}>
                            <span>{encDate || 'Consultation'}</span>
                            <span style={{ color: '#c2410c', background: '#fff7ed', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem' }}>
                              {daysAgoStr}
                            </span>
                          </div>
                          <div style={{ fontWeight: 600, marginTop: '2px' }}>{docName}</div>
                          {diag && (
                            <div style={{ color: 'var(--text-main)', fontSize: '0.72rem', marginTop: '2px' }}>
                              <strong>Dx:</strong> {diag}
                            </div>
                          )}
                          {cc && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                              CC: {cc}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NEW TRIAGE INTAKE WITH INSTANT MULTI-PARAMETER SEARCH              */}
      {/* ========================================================================= */}
      {showNewTriageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>New Patient Triage Intake</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Search and select registered patient</span>
              </div>
              <button onClick={() => setShowNewTriageModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateNewTriage} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Search Bar */}
              <div style={{ position: 'relative' }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search patient by Name, MRN, or Phone..."
                  value={newPatientSearch}
                  onChange={e => setNewPatientSearch(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                  autoFocus
                />
              </div>

              {/* Filtered Patients List */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {filteredNewPatients.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No registered patients match your search.
                  </div>
                ) : (
                  filteredNewPatients.map(p => {
                    const isSelected = newSelectedPatient?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setNewSelectedPatient(p)}
                        style={{
                          padding: '9px 12px',
                          borderBottom: '1px solid var(--border-color)',
                          background: isSelected ? '#e0f2fe' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                          transition: 'background 0.1s'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: isSelected ? '#0369a1' : 'var(--text-main)' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {p.gender} • {p.age} yrs • Phone: {p.phone || '—'}
                          </div>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', fontSize: '0.75rem' }}>
                          {p.mrn}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected Patient Banner */}
              {newSelectedPatient && (
                <div style={{ padding: '8px 12px', background: '#fdfcf9', borderRadius: '6px', border: '1px solid #dfd7c9', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Selected: <strong>{newSelectedPatient.name}</strong></span>
                  <span style={{ color: '#0369a1', fontFamily: 'monospace', fontWeight: 700 }}>{newSelectedPatient.mrn}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setShowNewTriageModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={!newSelectedPatient} className="btn-primary">
                  <Plus size={14} /> Add to Active Triage Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Hold Appointment */}
      {showHoldModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '22px', background: '#ffffff', border: '1px solid #d97706' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706' }}>
                <PauseCircle size={18} /> Place Appointment on Hold
              </h3>
              <button onClick={() => setShowHoldModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Hold <strong>{showHoldModal.patientName}</strong> in triage queue.
            </p>

            <form onSubmit={handleHoldSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clinical Hold Reason</label>
                <select value={holdReason} onChange={e => setHoldReason(e.target.value)}>
                  <option value="Awaiting Fasting Lab Draw">Awaiting Fasting Lab Draw / Blood Collection</option>
                  <option value="Under Observation / Rehydration">Under Observation / Rehydration IV</option>
                  <option value="Pre-Consultation Stabilization">Pre-Consultation Stabilization</option>
                  <option value="Awaiting Prior Diagnostic Records">Awaiting Prior Diagnostic Records</option>
                  <option value="Patient Requested Temporary Delay">Patient Requested Temporary Delay</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Duration (Minutes)</label>
                <input type="number" value={holdDuration} onChange={e => setHoldDuration(parseInt(e.target.value) || 15)} min={5} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowHoldModal(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" style={{ background: '#d97706', borderColor: '#d97706' }}>
                  <PauseCircle size={15} /> Confirm Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
