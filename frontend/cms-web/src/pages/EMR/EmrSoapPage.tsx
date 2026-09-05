import React, { useState, useEffect } from 'react';
import {
  Stethoscope, Award, Activity, Save, Plus, Search, User, FileText,
  CheckCircle, AlertCircle, Printer, X, Trash2, Heart, Thermometer, Gauge,
  FlaskConical, History, Calendar, Check, Send, AlertTriangle, ShieldAlert, Loader2,
  ChevronDown, ChevronRight, ShoppingCart, Pill, Scissors, Clock, ArrowRight,
  Sparkles, CheckSquare, Layers, FileCheck, ShieldCheck, CreditCard, Eye,
  ChevronLeft, Users, ChevronUp, DollarSign
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface EmrSoapPageProps {
  selectedPatientId?: number | null;
  currentUser?: any;
}

// Order Catalogue Types
interface LabTestItem {
  id: string;
  code: string;
  name: string;
  category: string;
  specimen: string;
  fasting: boolean;
  tat: string;
  price: number;
  subParams: string[];
}

interface ProcedureItem {
  id: string;
  code: string;
  name: string;
  category: string;
  duration: string;
  anesthesia: string;
  defaultSite: string;
  price: number;
}

interface MedicationItem {
  id: string;
  name: string;
  class: string;
  defaultDosage: string;
  defaultRoute: string;
  defaultFreq: string;
  defaultDuration: string;
  defaultDurationDays: number;
  defaultQty: number;
  unitPrice: number;
  instructions: string;
  warnings?: string;
}

// Basket Order Item
interface BasketItem {
  id: string;
  type: 'LAB' | 'PROCEDURE' | 'RX' | 'CERT';
  title: string;
  code: string;
  price: number;
  paramsSummary: string;
  details: any;
}

export default function EmrSoapPage({ selectedPatientId, currentUser }: EmrSoapPageProps) {
  // Only 4 subtabs: consultation, cert, history, results
  const [activeSubTab, setActiveSubTab] = useState<'consultation' | 'cert' | 'history' | 'results'>('consultation');
  const [loading, setLoading] = useState(true);

  // Doctor Selector State for Multi-Doctor EMR
  const initialDoctorId = currentUser?.doctorId ||
    (currentUser?.username?.toLowerCase().includes('tigist') ? 2 :
    (currentUser?.username?.toLowerCase().includes('abebe') ? 1 : 2));

  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(initialDoctorId);
  const [availableDoctors, setAvailableDoctors] = useState<{ id: number; name: string; specialization?: string }[]>([
    { id: 2, name: 'Dr. Tigist Haile', specialization: 'Dermatology' },
    { id: 1, name: 'Dr. Abebe Bekele', specialization: 'Senior Consultant Dermatology' }
  ]);

  // Date Selector State for Logged-In Doctor Queue
  const [consultDate, setConsultDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Patients Assigned to Doctor Queue
  const [patients, setPatients] = useState<any[]>([]);
  const [activePatient, setActivePatient] = useState<any>(null);
  // Maps patientId -> true if they have a paid invoice today
  const [patientPaymentMap, setPatientPaymentMap] = useState<Record<number, boolean>>({});

  // ==========================================
  // BLANK CONSULTATION FIELDS IN EXACT ORDER
  // ==========================================
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [history, setHistory] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [icdCode, setIcdCode] = useState('L20.9');
  const [plan, setPlan] = useState('');
  const [medications, setMedications] = useState<any[]>([]);

  // Quick Medication Input State
  const [newDrugName, setNewDrugName] = useState('Hydrocortisone 1% Cream');
  const [newDosage, setNewDosage] = useState('Apply thin layer');
  const [newQty, setNewQty] = useState(1);
  const [newFreq, setNewFreq] = useState('Twice Daily (BID)');
  const [newDuration, setNewDuration] = useState('7 Days');

  // Vitals State
  const [bpSys, setBpSys] = useState('120');
  const [bpDia, setBpDia] = useState('80');
  const [temp, setTemp] = useState('36.8');
  const [hr, setHr] = useState('74');
  const [spo2, setSpo2] = useState('99');
  const [weight, setWeight] = useState('70');
  const [height, setHeight] = useState('170');
  const [isSaved, setIsSaved] = useState(false);

  // HUDERMA Medical Certificate State
  const [certDiagnosis, setCertDiagnosis] = useState('');
  const [daysExcused, setDaysExcused] = useState(5);
  const [recommendation, setRecommendation] = useState('Strict rest, avoid sun & heat exposure, and apply prescribed topical medication.');
  const [certExamDate, setCertExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [certDoctorName, setCertDoctorName] = useState('Dr. Tigist Haile');
  const [certDoctorTitle, setCertDoctorTitle] = useState('Dermatology Specialist');

  const getDoctorInitials = (name: string) => {
    if (!name) return 'DR';
    const clean = name.replace(/^Dr\.?\s+/i, '').trim();
    const parts = clean.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  };

  // Synchronize available doctors from backend API
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await api.get<any[]>('/staff/doctors');
        if (res && Array.isArray(res) && res.length > 0) {
          const docs = res.map((d: any) => ({
            id: d.id || d.Id,
            name: d.doctorName || d.DoctorName || `Doctor ${d.id}`,
            specialization: d.specializationName || d.SpecializationName || 'Dermatology'
          }));
          setAvailableDoctors(docs);
        }
      } catch (e) {
        console.warn('Using default doctor list:', e);
      }
    };
    fetchDoctors();
  }, []);

  // Update selectedDoctorId when currentUser changes
  useEffect(() => {
    if (currentUser?.doctorId) {
      setSelectedDoctorId(currentUser.doctorId);
    } else if (currentUser?.username?.toLowerCase().includes('tigist')) {
      setSelectedDoctorId(2);
    } else if (currentUser?.username?.toLowerCase().includes('abebe')) {
      setSelectedDoctorId(1);
    }
  }, [currentUser]);

  // Update certDoctorName and certDoctorTitle when selectedDoctorId changes
  useEffect(() => {
    const doc = availableDoctors.find(d => d.id === selectedDoctorId);
    if (doc) {
      setCertDoctorName(doc.name);
      setCertDoctorTitle(doc.specialization ? `${doc.specialization} Specialist` : 'Dermatologist');
    } else if (selectedDoctorId === 2) {
      setCertDoctorName('Dr. Tigist Haile');
      setCertDoctorTitle('Dermatology Specialist');
    } else if (selectedDoctorId === 1) {
      setCertDoctorName('Dr. Abebe Bekele');
      setCertDoctorTitle('Senior Consultant Dermatologist');
    }
  }, [selectedDoctorId, availableDoctors]);

  const [issuedCerts, setIssuedCerts] = useState<any[]>([]);
  const [expandedCertId, setExpandedCertId] = useState<number | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<any>(null);

  // ==========================================
  // REAL PATIENT HISTORY BROWSER STATE
  // ==========================================
  const [historyEncounters, setHistoryEncounters] = useState<any[]>([]);
  const [historyLabOrders, setHistoryLabOrders] = useState<any[]>([]);
  const [historyPrescriptions, setHistoryPrescriptions] = useState<any[]>([]);
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'NOTES' | 'LABS' | 'RX' | 'CERTS' | 'BILLING'>('ALL');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ==========================================
  // RESULTS TAB STATE
  // ==========================================
  const [patientLabResults, setPatientLabResults] = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // ==========================================
  // ORDER MODAL STATE
  // ==========================================
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<{ lab: boolean; proc: boolean; rx: boolean; cert: boolean }>({
    lab: true,
    proc: false,
    rx: false,
    cert: false
  });
  const [selectedOrderItem, setSelectedOrderItem] = useState<{ type: 'LAB' | 'PROCEDURE' | 'RX' | 'CERT'; item: any } | null>(null);
  const [checkedCatalogItems, setCheckedCatalogItems] = useState<{ [key: string]: { type: 'LAB' | 'PROCEDURE' | 'RX'; item: any } }>({});
  const [orderBasket, setOrderBasket] = useState<BasketItem[]>([]);
  const [orderDispatchedToast, setOrderDispatchedToast] = useState<string | null>(null);

  // Order Parameters
  const [orderLabPriority, setOrderLabPriority] = useState('Routine');
  const [orderLabIndication, setOrderLabIndication] = useState('Diagnostic workup');
  const [orderLabFasting, setOrderLabFasting] = useState(false);

  const [orderProcUrgency, setOrderProcUrgency] = useState('Routine');
  const [orderProcSite, setOrderProcSite] = useState('Affected area');
  const [orderProcAnesthesia, setOrderProcAnesthesia] = useState('Local Anesthesia (Lidocaine 2%)');
  const [orderProcNotes, setOrderProcNotes] = useState('Perform procedure as indicated');

  const [orderRxDosage, setOrderRxDosage] = useState('1 Tablet');
  const [orderRxRoute, setOrderRxRoute] = useState('Oral');
  const [orderRxFreq, setOrderRxFreq] = useState('Once Daily (OD)');
  const [orderRxDuration, setOrderRxDuration] = useState('7 Days');
  const [orderRxQty, setOrderRxQty] = useState(14);
  const [orderRxTiming, setOrderRxTiming] = useState('Take after meals');

  // CATALOG DATA DEFINITIONS WITH PRICING
  const labCatalogue: LabTestItem[] = [
    { id: 'CBC', code: 'CBC-01', name: 'Complete Blood Count (CBC Profile)', category: 'Hematology', specimen: 'Whole Blood / EDTA', fasting: false, tat: '1 Hour', price: 280.0, subParams: ['WBC Count', 'Hemoglobin (HGB)', 'Hematocrit (HCT)', 'Platelet Count (PLT)', 'RBC Indices'] },
    { id: 'LFT', code: 'LFT-01', name: 'Liver Function Tests (LFT Panel)', category: 'Biochemistry', specimen: 'Serum', fasting: true, tat: '2 Hours', price: 380.0, subParams: ['ALT (SGPT)', 'AST (SGOT)', 'Alkaline Phosphatase', 'Total Bilirubin', 'Direct Bilirubin', 'Total Protein', 'Albumin'] },
    { id: 'RFT', code: 'RFT-01', name: 'Renal Function Tests (RFT / Urea & Creatinine)', category: 'Biochemistry', specimen: 'Serum', fasting: false, tat: '2 Hours', price: 320.0, subParams: ['Serum Creatinine', 'Blood Urea Nitrogen (BUN)', 'eGFR', 'Uric Acid'] },
    { id: 'FBS', code: 'FBS-01', name: 'Fasting Blood Sugar (FBS)', category: 'Biochemistry', specimen: 'Fluoride Plasma', fasting: true, tat: '30 Mins', price: 120.0, subParams: ['Glucose Fasting'] },
    { id: 'LIPID', code: 'LIPID-01', name: 'Lipid Profile Panel', category: 'Biochemistry', specimen: 'Serum', fasting: true, tat: '2 Hours', price: 420.0, subParams: ['Total Cholesterol', 'HDL Cholesterol', 'LDL Cholesterol', 'Triglycerides'] },
    { id: 'UA', code: 'UA-01', name: 'Urinalysis Complete', category: 'Clinical Pathology', specimen: 'Midstream Urine', fasting: false, tat: '45 Mins', price: 150.0, subParams: ['Urine pH', 'Specific Gravity', 'Protein', 'Glucose', 'Microscopic RBC/WBC'] },
    { id: 'THYROID', code: 'THY-01', name: 'Thyroid Panel (TSH, Free T3, Free T4)', category: 'Immunoassay', specimen: 'Serum', fasting: false, tat: '4 Hours', price: 560.0, subParams: ['TSH', 'Free T3', 'Free T4'] },
    { id: 'CRP', code: 'CRP-01', name: 'C-Reactive Protein (CRP Quantitative)', category: 'Immunology', specimen: 'Serum', fasting: false, tat: '1 Hour', price: 240.0, subParams: ['CRP Level'] }
  ];

  const procedureCatalogue: ProcedureItem[] = [
    { id: 'BIOPSY', code: 'CPT-11100', name: 'Skin Punch / Shave Biopsy (3-4mm)', category: 'Minor Surgery', duration: '20 Mins', anesthesia: 'Local Anesthesia (Lidocaine 2%)', defaultSite: 'Lesion Site', price: 750.0 },
    { id: 'CRYO', code: 'CPT-17000', name: 'Liquid Nitrogen Cryotherapy (1-3 Lesions)', category: 'Aesthetics / Surgery', duration: '15 Mins', anesthesia: 'None Required', defaultSite: 'Target Lesions', price: 450.0 },
    { id: 'PEEL', code: 'CPT-15788', name: 'Chemical Peel Rejuvenation (Salicylic/Glycolic)', category: 'Dermatology Aesthetics', duration: '30 Mins', anesthesia: 'None Required', defaultSite: 'Facial', price: 1200.0 },
    { id: 'LASER', code: 'CPT-17106', name: 'Laser Hair & Pigment Therapy (Per Session)', category: 'Laser Center', duration: '40 Mins', anesthesia: 'Topical EMLA Cream', defaultSite: 'Treatment Area', price: 1800.0 },
    { id: 'WOUND', code: 'CPT-12001', name: 'Minor Wound Debridement & Suturing', category: 'Minor Surgery', duration: '30 Mins', anesthesia: 'Local Anesthesia (Lidocaine 2%)', defaultSite: 'Affected Area', price: 500.0 },
    { id: 'ID', code: 'CPT-10060', name: 'Abscess Incision & Drainage (I&D)', category: 'Minor Surgery', duration: '25 Mins', anesthesia: 'Local Anesthesia (Lidocaine 2%)', defaultSite: 'Abscess Site', price: 450.0 }
  ];

  const medicationCatalogue: MedicationItem[] = [
    { id: 'HYDRO', name: 'Hydrocortisone 1% Cream (15g Tube)', class: 'Topical Corticosteroid', defaultDosage: 'Apply thin layer', defaultRoute: 'Topical', defaultFreq: 'Twice Daily (BID)', defaultDuration: '7 Days', defaultDurationDays: 7, defaultQty: 1, unitPrice: 85.0, instructions: 'Apply to affected skin. Avoid eye area.' },
    { id: 'CLOTR', name: 'Clotrimazole 1% Topical Cream (20g)', class: 'Antifungal', defaultDosage: 'Apply thin layer', defaultRoute: 'Topical', defaultFreq: 'Twice Daily (BID)', defaultDuration: '14 Days', defaultDurationDays: 14, defaultQty: 1, unitPrice: 95.0, instructions: 'Continue 1 week after resolution of rash' },
    { id: 'CETIR', name: 'Cetirizine 10mg Tablet', class: 'Antihistamine', defaultDosage: '1 Tablet (10mg)', defaultRoute: 'Oral', defaultFreq: 'Once Daily at Bedtime (OD)', defaultDuration: '10 Days', defaultDurationDays: 10, defaultQty: 10, unitPrice: 6.0, instructions: 'Take at night with water' },
    { id: 'DOXY', name: 'Doxycycline 100mg Capsule', class: 'Tetracycline Antibiotic', defaultDosage: '1 Capsule (100mg)', defaultRoute: 'Oral', defaultFreq: 'Twice Daily (BID)', defaultDuration: '14 Days', defaultDurationDays: 14, defaultQty: 28, unitPrice: 12.0, instructions: 'Take with full glass of water. Avoid sun.' },
    { id: 'AMOX', name: 'Amoxicillin 500mg Capsule', class: 'Penicillin Antibiotic', defaultDosage: '1 Capsule (500mg)', defaultRoute: 'Oral', defaultFreq: 'Three Times Daily (TID)', defaultDuration: '7 Days', defaultDurationDays: 7, defaultQty: 21, unitPrice: 12.0, instructions: 'Complete full 7-day course. Take after meals.' },
    { id: 'PARA', name: 'Paracetamol 500mg Tablet', class: 'Analgesic / Antipyretic', defaultDosage: '1-2 Tablets (500-1000mg)', defaultRoute: 'Oral', defaultFreq: 'Three Times Daily (TID) PRN', defaultDuration: '5 Days', defaultDurationDays: 5, defaultQty: 20, unitPrice: 4.0, instructions: 'Take as needed for pain or fever. Max 4g daily.' }
  ];

  const changeDateByDays = (days: number) => {
    const current = new Date(consultDate);
    current.setDate(current.getDate() + days);
    setConsultDate(current.toISOString().split('T')[0]);
  };

  // Load assigned patients for logged-in doctor on consultDate
  useEffect(() => {
    const loadEmrPatients = async () => {
      try {
        setLoading(true);
        const [assigned, allInvoices] = await Promise.all([
          api.get<any[]>(`/triage/doctor/${selectedDoctorId}`, { date: consultDate }).catch(() => []),
          api.get<any[]>('/billing/invoices').catch(() => [])
        ]);
        if (assigned && Array.isArray(assigned) && assigned.length > 0) {
          const mapped = assigned.map((p: any) => ({
            id: p.patientId || p.PatientId || p.id || p.Id,
            mrn: p.mrn || p.MRN || `HD-${p.patientId || p.id}`,
            name: p.patientName || p.PatientName || 'Assigned Patient',
            age: p.dateOfBirth ? (new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()) : 30,
            gender: p.gender === 1 || p.Gender === 1 ? 'Male' : 'Female',
            blood: p.bloodGroup || p.BloodGroup || 'O+',
            allergies: p.allergies || p.Allergies || 'None',
            insurance: p.insuranceProvider || p.InsuranceProvider || 'Cash'
          }));
          setPatients(mapped);
          const target = mapped.find((p: any) => p.id === selectedPatientId) || mapped[0];
          setActivePatient(target);

          // Build payment map: patientId -> true if has paid invoice on consultDate
          const payMap: Record<number, boolean> = {};
          if (allInvoices && Array.isArray(allInvoices)) {
            allInvoices.forEach((inv: any) => {
              const pid = Number(inv.patientId || inv.PatientId);
              const invDate = (inv.issueDate || inv.IssueDate || '').split('T')[0];
              const isPaid = (inv.statusId || inv.StatusId) === 4 || (inv.statusName || inv.StatusName) === 'Paid';
              if (isPaid && invDate === consultDate) {
                payMap[pid] = true;
              }
            });
          }
          setPatientPaymentMap(payMap);
        } else {
          setPatients([]);
          setActivePatient(null);
          setPatientPaymentMap({});
        }
      } catch (err) {
        console.error('Failed to load doctor assigned patients:', err);
        setPatients([]);
        setActivePatient(null);
      } finally {
        setLoading(false);
      }
    };
    loadEmrPatients();
  }, [consultDate, selectedPatientId, selectedDoctorId]);

  // Load patient clinical data when activePatient changes (starts blank for clean new consult)
  useEffect(() => {
    if (!activePatient) return;

    setChiefComplaint('');
    setHistory('');
    setPhysicalExam('');
    setDiagnosis('');
    setPlan('');
    setMedications([]);
    setCertDiagnosis('');

    const loadPatientClinical = async () => {
      try {
        const [encounters, certs, triageVitals] = await Promise.all([
          api.get<any[]>(`/encounters/patient/${activePatient.id}`).catch(() => []),
          api.get<any[]>(`/medicalcertificates/patient/${activePatient.id}`).catch(() => []),
          api.get<any>(`/triage/patient/${activePatient.id}/latest`).catch(() => null)
        ]);

        if (triageVitals) {
          if (triageVitals.systolicBP) setBpSys(String(triageVitals.systolicBP));
          if (triageVitals.diastolicBP) setBpDia(String(triageVitals.diastolicBP));
          if (triageVitals.heartRate) setHr(String(triageVitals.heartRate));
          if (triageVitals.temperature) setTemp(String(triageVitals.temperature));
          if (triageVitals.oxygenSaturation) setSpo2(String(triageVitals.oxygenSaturation));
          if (triageVitals.weightKg) setWeight(String(triageVitals.weightKg));
          if (triageVitals.heightCm) setHeight(String(triageVitals.heightCm));
          if (triageVitals.chiefComplaint) setChiefComplaint(triageVitals.chiefComplaint);
        }

        if (encounters && encounters.length > 0) {
          const latest = encounters[0];
          if (latest.chiefComplaint) setChiefComplaint(latest.chiefComplaint);
          if (latest.historyOfIllness) setHistory(latest.historyOfIllness);
          if (latest.physicalExam) setPhysicalExam(latest.physicalExam);
          if (latest.assessment) {
            setDiagnosis(latest.assessment);
            setCertDiagnosis(latest.assessment);
          }
          if (latest.soapPlan) setPlan(latest.soapPlan);
        }

        if (certs && certs.length > 0) {
          const mappedCerts = certs.map((c: any) => ({
            id: c.id || c.Id,
            certNo: c.certificateNo || c.CertificateNo || `HD-MC-${c.id}`,
            patientName: activePatient.name,
            cardNo: activePatient.mrn,
            age: activePatient.age,
            examinedOn: c.startDate ? String(c.startDate).split('T')[0] : new Date().toISOString().split('T')[0],
            diagnosis: c.diagnosisSummary || 'Dermatological condition',
            recommendation: c.recommendation || 'Clinical rest and prescribed medication',
            daysExcused: c.daysExcused || 5,
            doctorName: 'Dr. Kebede Biniyam',
            doctorTitle: 'Dermatology Specialist'
          }));
          setIssuedCerts(mappedCerts);
          setExpandedCertId(mappedCerts[0].id);
        } else {
          setIssuedCerts([]);
          setExpandedCertId(null);
        }
      } catch (err) {
        console.error('Failed to load patient clinical data:', err);
      }
    };
    loadPatientClinical();
  }, [activePatient]);

  // Load Real Patient History when history subtab is active
  const loadFullPatientHistory = async () => {
    if (!activePatient) return;
    setLoadingHistory(true);
    const patId = Number(activePatient.id || activePatient.Id);
    try {
      const [encs, labRes, rxs, invs, certs] = await Promise.all([
        api.get<any[]>(`/encounters/patient/${patId}`).catch(() => []),
        api.get<any[]>(`/laboratory/patient/${patId}`).catch(() => 
          api.get<any[]>(`/laboratory/orders?patientId=${patId}`).catch(() =>
            api.get<any[]>('/laboratory/worklist').catch(() => [])
          )
        ),
        api.get<any[]>('/pharmacy/prescriptions').catch(() => []),
        api.get<any[]>('/billing/invoices').catch(() => []),
        api.get<any[]>(`/medicalcertificates/patient/${patId}`).catch(() => [])
      ]);

      setHistoryEncounters(encs || []);

      let rawLabs = Array.isArray(labRes) ? labRes : [];
      if (rawLabs.length === 0) {
        const wl = await api.get<any[]>('/laboratory/worklist').catch(() => []);
        rawLabs = (wl || []).filter((l: any) => Number(l.patientId || l.PatientId) === patId);
      }
      const mappedLabs = rawLabs
        .filter((l: any) => !l.patientId && !l.PatientId ? true : Number(l.patientId || l.PatientId) === patId)
        .map((l: any) => ({
          id: l.id || l.orderId || l.OrderId,
          orderNumber: l.orderNumber || l.OrderNumber || `LAB-${l.orderId || l.id}`,
          patientId: l.patientId || l.PatientId || patId,
          orderDate: l.orderedAt || l.OrderedAt || l.orderDate || new Date().toISOString(),
          clinicalInfo: l.testName || l.TestName || l.clinicalInfo || l.ClinicalInfo || 'Diagnostic Lab Order',
          statusName: l.statusName || l.StatusName || (l.itemStatus === 1 ? 'Ordered' : 'Completed')
        }));
      setHistoryLabOrders(mappedLabs);

      setHistoryPrescriptions((rxs || []).filter((r: any) => (r.patientId || r.PatientId) === patId));
      setHistoryInvoices((invs || []).filter((i: any) => (i.patientId || i.PatientId) === patId));
    } catch (err) {
      console.error('Failed to fetch patient history records:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'history') {
      loadFullPatientHistory();
    }
  }, [activeSubTab, activePatient]);

  const loadPatientResults = async () => {
    if (!activePatient) return;
    setLoadingResults(true);
    const patId = Number(activePatient.id || activePatient.Id);
    try {
      const results = await api.get<any[]>(`/laboratory/patient/${patId}/results`).catch(() => []);
      const mapped = (results || []).map((r: any) => ({
        id: r.id || r.Id,
        testName: r.testName || r.TestName || r.clinicalInfo || 'Lab Test',
        orderNumber: r.orderNumber || r.OrderNumber || `LAB-${r.orderId}`,
        enteredAt: r.enteredAt || r.EnteredAt || r.orderedAt || new Date().toISOString(),
        numericValue: r.numericValue || r.NumericValue || r.textValue || r.TextValue || '—',
        unit: r.unit || r.Unit || '',
        flag: r.flag || r.Flag || '',
        referenceRange: r.referenceRange || r.ReferenceRange || '',
        isVerified: r.isVerified || r.IsVerified || false,
        isCritical: r.isCritical || r.IsCritical || false
      }));
      // Sort newest first
      mapped.sort((a: any, b: any) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime());
      setPatientLabResults(mapped);
    } catch (err) {
      console.error('Failed to load patient results:', err);
      setPatientLabResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'results') {
      loadPatientResults();
    }
  }, [activeSubTab, activePatient]);

  const handleAddMedication = () => {
    if (!newDrugName) return;
    setMedications([
      ...medications,
      {
        drugName: newDrugName,
        dosage: newDosage,
        qty: newQty,
        frequency: newFreq,
        duration: newDuration
      }
    ]);
  };

  const handleRemoveMedication = (idx: number) => {
    setMedications(medications.filter((_, i) => i !== idx));
  };

  const handleSaveConsultation = async () => {
    if (!activePatient) return;
    try {
      const res = await api.post('/encounters', {
        tenantId: 1,
        patientId: activePatient.id,
        doctorId: selectedDoctorId,
        chiefComplaint: chiefComplaint,
        historyOfIllness: history,
        physicalExam: physicalExam,
        assessment: diagnosis,
        plan: plan,
        soapPlan: plan,
        vitalSigns: JSON.stringify({ bp: `${bpSys}/${bpDia}`, hr, temp, spo2, weight }),
        createdBy: currentUser?.id || 1,
        isFinalized: true
      });

      // Update local history encounters immediately so user sees saved note
      const newEnc = {
        id: (res as any)?.encounterId || (res as any)?.data?.encounterId || Date.now(),
        patientId: activePatient.id,
        doctorName: certDoctorName || 'Attending Doctor',
        encounterDate: new Date().toISOString().split('T')[0],
        chiefComplaint: chiefComplaint,
        historyOfIllness: history,
        physicalExam: physicalExam,
        assessment: diagnosis,
        plan: plan,
        vitalSigns: JSON.stringify({ bp: `${bpSys}/${bpDia}`, hr, temp, spo2, weight })
      };
      setHistoryEncounters(prev => [newEnc, ...prev]);

      setIsSaved(true);
      setOrderDispatchedToast('✓ Clinical Consultation Note Saved to EHR Database!');
      setTimeout(() => {
        setIsSaved(false);
        setOrderDispatchedToast(null);
      }, 4000);
      loadFullPatientHistory();
    } catch (err: any) {
      console.error('Save consultation error:', err);
      setIsSaved(false);
      setOrderDispatchedToast(`Failed to save clinical note: ${err.message || 'Server error'}`);
      setTimeout(() => setOrderDispatchedToast(null), 4000);
    }
  };

  const toggleNode = (node: 'lab' | 'proc' | 'rx' | 'cert') => {
    setExpandedNodes(prev => ({ ...prev, [node]: !prev[node] }));
  };

  const handleSelectCatalogItem = (type: 'LAB' | 'PROCEDURE' | 'RX' | 'CERT', item: any) => {
    setSelectedOrderItem({ type, item });
    if (type === 'LAB') {
      setOrderLabPriority('Routine');
      setOrderLabIndication('Clinical diagnostic evaluation');
      setOrderLabFasting(item.fasting || false);
    } else if (type === 'PROCEDURE') {
      setOrderProcUrgency('Routine');
      setOrderProcSite(item.defaultSite || 'Affected Area');
      setOrderProcAnesthesia(item.anesthesia || 'Local Anesthesia');
      setOrderProcNotes(`Perform ${item.name} as indicated.`);
    } else if (type === 'RX') {
      setOrderRxDosage(item.defaultDosage);
      setOrderRxRoute(item.defaultRoute);
      setOrderRxFreq(item.defaultFreq);
      setOrderRxDuration(item.defaultDuration);
      setOrderRxQty(item.defaultQty);
      setOrderRxTiming(item.instructions);
    }
  };

  const handleAddToBasket = () => {
    if (!selectedOrderItem) return;
    const { type, item } = selectedOrderItem;
    let newBasketItem: BasketItem;

    if (type === 'LAB') {
      newBasketItem = {
        id: `lab-${item.id}-${Date.now()}`,
        type: 'LAB',
        title: item.name,
        code: item.code,
        price: item.price,
        paramsSummary: `Priority: ${orderLabPriority} | Specimen: ${item.specimen} ${orderLabFasting ? '| Fasting' : ''}`,
        details: { priority: orderLabPriority, indication: orderLabIndication, fasting: orderLabFasting, subParams: item.subParams }
      };
    } else if (type === 'PROCEDURE') {
      newBasketItem = {
        id: `proc-${item.id}-${Date.now()}`,
        type: 'PROCEDURE',
        title: item.name,
        code: item.code,
        price: item.price,
        paramsSummary: `Urgency: ${orderProcUrgency} | Site: ${orderProcSite} | Anesthesia: ${orderProcAnesthesia}`,
        details: { urgency: orderProcUrgency, site: orderProcSite, anesthesia: orderProcAnesthesia, notes: orderProcNotes }
      };
    } else if (type === 'RX') {
      newBasketItem = {
        id: `rx-${item.id}-${Date.now()}`,
        type: 'RX',
        title: item.name,
        code: item.class,
        price: item.unitPrice * orderRxQty,
        paramsSummary: `${orderRxDosage} - ${orderRxRoute} - ${orderRxFreq} for ${orderRxDuration} (Qty: ${orderRxQty})`,
        details: { dosage: orderRxDosage, route: orderRxRoute, freq: orderRxFreq, duration: orderRxDuration, qty: orderRxQty, timing: orderRxTiming }
      };
    } else {
      // CERT
      newBasketItem = {
        id: `cert-${Date.now()}`,
        type: 'CERT',
        title: 'Official Medical Certificate (Huderma)',
        code: 'MC-HUDERMA',
        price: 0,
        paramsSummary: `Dx: ${certDiagnosis || diagnosis || 'Dermatitis'} | Rest: ${daysExcused} Days`,
        details: {
          certNo: `HD-MC-${new Date().getFullYear()}-00${issuedCerts.length + 1}`,
          patientName: activePatient.name.toUpperCase(),
          cardNo: activePatient.mrn,
          age: activePatient.age,
          examinedOn: certExamDate,
          diagnosis: certDiagnosis || diagnosis,
          recommendation: recommendation,
          daysExcused: daysExcused,
          doctorName: certDoctorName,
          doctorTitle: certDoctorTitle
        }
      };
    }

    setOrderBasket(prev => [...prev, newBasketItem]);
  };

  const handleRemoveFromBasket = (id: string) => {
    setOrderBasket(prev => prev.filter(x => x.id !== id));
  };

  // MULTISELECT ORDERING HELPER FUNCTIONS
  const toggleCheckItem = (type: 'LAB' | 'PROCEDURE' | 'RX', item: any) => {
    const key = `${type}:${item.id}`;
    setCheckedCatalogItems(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { type, item };
      }
      return next;
    });
  };

  const handleToggleSelectAll = (type: 'LAB' | 'PROCEDURE' | 'RX', itemsList: any[]) => {
    const allChecked = itemsList.every(i => !!checkedCatalogItems[`${type}:${i.id}`]);
    setCheckedCatalogItems(prev => {
      const next = { ...prev };
      if (allChecked) {
        itemsList.forEach(i => delete next[`${type}:${i.id}`]);
      } else {
        itemsList.forEach(i => {
          next[`${type}:${i.id}`] = { type, item: i };
        });
      }
      return next;
    });
  };

  const handleAddAllCheckedToBasket = () => {
    const itemsToAdd = Object.values(checkedCatalogItems);
    if (itemsToAdd.length === 0) return;

    const newBasketItems: BasketItem[] = itemsToAdd.map(({ type, item }, idx) => {
      if (type === 'LAB') {
        return {
          id: `lab-${item.id}-${Date.now()}-${idx}`,
          type: 'LAB',
          title: item.name,
          code: item.code,
          price: item.price,
          paramsSummary: `Priority: Routine | Specimen: ${item.specimen}`,
          details: { priority: 'Routine', indication: 'Clinical evaluation', fasting: item.fasting || false, subParams: item.subParams }
        };
      } else if (type === 'PROCEDURE') {
        return {
          id: `proc-${item.id}-${Date.now()}-${idx}`,
          type: 'PROCEDURE',
          title: item.name,
          code: item.code,
          price: item.price,
          paramsSummary: `Urgency: Routine | Site: ${item.defaultSite || 'Affected Area'}`,
          details: { urgency: 'Routine', site: item.defaultSite || 'Affected Area', anesthesia: item.anesthesia, notes: 'Perform as indicated' }
        };
      } else {
        return {
          id: `rx-${item.id}-${Date.now()}-${idx}`,
          type: 'RX',
          title: item.name,
          code: item.class,
          price: item.unitPrice * (item.defaultQty || 1),
          paramsSummary: `${item.defaultDosage || '1 Tab'} - ${item.defaultRoute || 'Oral'} - ${item.defaultFreq || 'OD'} (Qty: ${item.defaultQty || 1})`,
          details: { dosage: item.defaultDosage, route: item.defaultRoute, freq: item.defaultFreq, duration: item.defaultDuration, qty: item.defaultQty, timing: item.instructions }
        };
      }
    });

    setOrderBasket(prev => [...prev, ...newBasketItems]);
    const addedCount = itemsToAdd.length;
    setCheckedCatalogItems({});
    setOrderDispatchedToast(`Added ${addedCount} order items to basket!`);
    setTimeout(() => setOrderDispatchedToast(null), 3000);
  };

  // MULTI-DISCIPLINARY DISPATCH + DATABASE BILLING INVOICE INSERTION
  const handleSubmitAllOrders = async () => {
    let currentBasket = [...orderBasket];
    if (currentBasket.length === 0 && selectedOrderItem) {
      // Auto-add active configured item so the user doesn't lose what they entered
      const { type, item } = selectedOrderItem;
      let newBasketItem: BasketItem;
      if (type === 'LAB') {
        newBasketItem = {
          id: `lab-${item.id}-${Date.now()}`,
          type: 'LAB',
          title: item.name,
          code: item.code,
          price: item.price,
          paramsSummary: `Priority: ${orderLabPriority} | Specimen: ${item.specimen}`,
          details: { priority: orderLabPriority, indication: orderLabIndication, fasting: orderLabFasting, subParams: item.subParams }
        };
      } else if (type === 'PROCEDURE') {
        newBasketItem = {
          id: `proc-${item.id}-${Date.now()}`,
          type: 'PROCEDURE',
          title: item.name,
          code: item.code,
          price: item.price,
          paramsSummary: `Urgency: ${orderProcUrgency} | Site: ${orderProcSite}`,
          details: { urgency: orderProcUrgency, site: orderProcSite, anesthesia: orderProcAnesthesia, notes: orderProcNotes }
        };
      } else if (type === 'RX') {
        newBasketItem = {
          id: `rx-${item.id}-${Date.now()}`,
          type: 'RX',
          title: item.name,
          code: item.class,
          price: item.unitPrice * orderRxQty,
          paramsSummary: `${orderRxDosage} - ${orderRxRoute} - ${orderRxFreq} for ${orderRxDuration} (Qty: ${orderRxQty})`,
          details: { dosage: orderRxDosage, route: orderRxRoute, freq: orderRxFreq, duration: orderRxDuration, qty: orderRxQty, timing: orderRxTiming }
        };
      } else {
        newBasketItem = {
          id: `cert-${Date.now()}`,
          type: 'CERT',
          title: 'Official Medical Certificate (Huderma)',
          code: 'MC-HUDERMA',
          price: 0,
          paramsSummary: `Dx: ${certDiagnosis || diagnosis || 'Dermatitis'} | Rest: ${daysExcused} Days`,
          details: {
            certNo: `HD-MC-${new Date().getFullYear()}-00${issuedCerts.length + 1}`,
            patientName: (activePatient?.name || 'PATIENT').toUpperCase(),
            cardNo: activePatient?.mrn || 'MRN-001',
            age: activePatient?.age || 30,
            examinedOn: certExamDate,
            diagnosis: certDiagnosis || diagnosis,
            recommendation: recommendation,
            daysExcused: daysExcused,
            doctorName: certDoctorName,
            doctorTitle: certDoctorTitle
          }
        };
      }
      currentBasket = [newBasketItem];
      setOrderBasket(currentBasket);
    }

    if (currentBasket.length === 0) return;
    const patId = Number(activePatient?.id || activePatient?.Id || activePatient?.patientId || 1);

    try {
      // 1. Dispatch Laboratory Orders
      const labItems = currentBasket.filter(x => x.type === 'LAB');
      if (labItems.length > 0) {
        const testIdMap: Record<string, number> = {
          'CBC': 1, 'CBC-01': 1,
          'LFT': 2, 'LFT-01': 2,
          'RFT': 3, 'RFT-01': 3,
          'FBS': 4, 'FBS-01': 4,
          'HBA1C': 5,
          'LIPID': 6, 'LIPID-01': 6,
          'UA': 7, 'UA-01': 7,
          'MALARIA': 8,
          'PREG': 9,
          'ESR': 10
        };
        const testIds = labItems.map(item => {
          const match = Object.keys(testIdMap).find(k => item.code?.toUpperCase().includes(k) || item.title?.toUpperCase().includes(k));
          return match ? testIdMap[match] : 1;
        });

        try {
          await api.post('/laboratory/orders', {
            tenantId: 1,
            patientId: patId,
            encounterId: null,
            orderedBy: selectedDoctorId || 1,
            priority: 2,
            clinicalInfo: labItems.map(l => `${l.title} (${l.paramsSummary})`).join('; '),
            testIds: testIds.length > 0 ? testIds : [1]
          });
        } catch (labErr) {
          console.warn('Lab order backend dispatch error:', labErr);
        }

        setHistoryLabOrders(prev => [
          ...labItems.map((l, i) => ({
            id: Date.now() + i,
            orderNumber: `LAB-${Date.now() + i}`,
            patientId: patId,
            clinicalInfo: l.title,
            statusName: 'Processing',
            orderDate: new Date().toISOString()
          })),
          ...prev
        ]);
      }

      // 2. Dispatch Pharmacy Prescriptions
      const rxItems = currentBasket.filter(x => x.type === 'RX');
      if (rxItems.length > 0) {
        setMedications(prev => [
          ...prev,
          ...rxItems.map(x => ({
            drugName: x.title,
            dosage: x.details.dosage,
            qty: x.details.qty,
            frequency: x.details.freq,
            duration: x.details.duration
          }))
        ]);

        try {
          await api.post('/pharmacy/prescriptions', {
            tenantId: 1,
            patientId: patId,
            doctorId: selectedDoctorId || 1,
            encounterId: null,
            diagnosis: diagnosis || 'Clinical Encounter',
            items: rxItems.map(r => ({
              drugId: 1,
              dosage: r.details.dosage || '1 Tablet',
              frequency: r.details.freq || 'OD',
              duration: r.details.duration || '7 Days',
              quantity: Number(r.details.qty) || 1,
              instructions: `${r.title} - ${r.details.timing || 'Take as directed'}`
            }))
          });
        } catch (rxErr) {
          console.warn('Prescription backend dispatch error:', rxErr);
        }

        setHistoryPrescriptions(prev => [
          {
            id: Date.now(),
            patientId: patId,
            prescribedAt: new Date().toISOString(),
            items: rxItems.map(r => ({
              drugName: r.title,
              dosage: r.details.dosage,
              frequency: r.details.freq,
              duration: r.details.duration
            }))
          },
          ...prev
        ]);
      }

      // 3. Dispatch Clinical Procedures
      const procItems = currentBasket.filter(x => x.type === 'PROCEDURE');
      if (procItems.length > 0) {
        for (const p of procItems) {
          try {
            await api.post('/procedures', {
              tenantId: 1,
              patientId: patId,
              doctorId: selectedDoctorId || 1,
              procedureName: p.title,
              procedureCode: p.code,
              notes: p.paramsSummary,
              priority: 'Routine'
            });
          } catch (pErr) {
            console.warn('Procedure order error:', pErr);
          }
        }
      }

      // 4. Dispatch Medical Certificates
      const certItems = currentBasket.filter(x => x.type === 'CERT');
      for (const c of certItems) {
        const certObj = c.details;
        await api.post('/medicalcertificates', {
          tenantId: 1,
          patientId: patId,
          doctorId: selectedDoctorId,
          certificateType: 'Medical Certificate',
          diagnosisSummary: certObj.diagnosis,
          recommendation: certObj.recommendation,
          startDate: certObj.examinedOn,
          endDate: new Date(Date.now() + certObj.daysExcused * 86400000).toISOString().split('T')[0],
          daysExcused: certObj.daysExcused
        }).catch(() => {});
        setIssuedCerts(prev => [certObj, ...prev]);
        setExpandedCertId(certObj.id || 1);
      }

      // 5. Database Billing Invoice Creation for Billable Items
      const billableItems = currentBasket.filter(x => x.price > 0).map(item => ({
        itemType: item.type === 'LAB' ? 'Laboratory' : (item.type === 'PROCEDURE' ? 'Procedure' : 'Pharmacy'),
        description: `${item.title} (${item.code})`,
        quantity: item.type === 'RX' ? Number(item.details.qty) || 1 : 1,
        unitPrice: item.type === 'RX' ? Math.round((item.price / (Number(item.details.qty) || 1)) * 100) / 100 : item.price,
        discount: 0
      }));

      let createdInvoiceNo = `INV-${new Date().toISOString().split('T')[0]}-${Math.floor(1000 + Math.random() * 9000)}`;
      if (billableItems.length > 0) {
        try {
          const invRes = await api.post('/billing/invoices', {
            tenantId: 1,
            patientId: patId,
            encounterId: null,
            createdBy: 1,
            items: billableItems
          });
          if ((invRes as any)?.invoiceNo) createdInvoiceNo = (invRes as any).invoiceNo;
        } catch (invErr) {
          console.warn('Billing invoice creation error:', invErr);
        }

        const totalBilled = billableItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
        setHistoryInvoices(prev => [
          {
            id: Date.now(),
            invoiceNo: createdInvoiceNo,
            patientId: patId,
            totalAmount: totalBilled * 1.15,
            paidAmount: 0,
            statusName: 'Issued',
            issueDate: new Date().toISOString()
          },
          ...prev
        ]);
      }

      // Append to Clinical Plan
      const newPlanLines: string[] = [];
      if (rxItems.length > 0) {
        newPlanLines.push(`• Prescribed: ${rxItems.map(x => `${x.title} (${x.details.dosage} ${x.details.freq} x ${x.details.duration})`).join(', ')}`);
      }
      if (labItems.length > 0) {
        newPlanLines.push(`• Labs Ordered: ${labItems.map(x => x.title).join(', ')}`);
      }
      if (procItems.length > 0) {
        newPlanLines.push(`• Procedures Ordered: ${procItems.map(x => x.title).join(', ')}`);
      }
      if (certItems.length > 0) {
        newPlanLines.push(`• Medical Certificate Issued: ${certItems.map(x => `${x.details.daysExcused} Days Rest`).join(', ')}`);
      }

      if (newPlanLines.length > 0) {
        setPlan(prev => prev ? `${prev}\n\n[Clinical Orders Dispatched]:\n${newPlanLines.join('\n')}` : `[Clinical Orders Dispatched]:\n${newPlanLines.join('\n')}`);
      }

      const totalBilled = currentBasket.reduce((sum, i) => sum + i.price, 0);
      setOrderBasket([]);
      setSelectedOrderItem(null);
      setShowOrderModal(false);
      setOrderDispatchedToast(
        totalBilled > 0
          ? `Dispatched ${currentBasket.length} order(s) & created invoice of Br ${totalBilled.toFixed(2)} in Billing!`
          : `Dispatched ${currentBasket.length} order(s) successfully!`
      );
      setTimeout(() => setOrderDispatchedToast(null), 5000);
    } catch (err: any) {
      console.error('Dispatch orders error:', err);
      setOrderDispatchedToast(`Order dispatch error: ${err.message || 'Server error'}`);
      setTimeout(() => setOrderDispatchedToast(null), 5000);
    }
  };

  const handleIssueCertificateDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCert = {
      id: issuedCerts.length + 1,
      certNo: `HD-MC-${new Date().getFullYear()}-00${issuedCerts.length + 1}`,
      patientName: activePatient.name.toUpperCase(),
      cardNo: activePatient.mrn,
      age: activePatient.age,
      examinedOn: certExamDate,
      diagnosis: certDiagnosis || diagnosis || 'Dermatitis',
      recommendation: recommendation,
      daysExcused: daysExcused,
      doctorName: certDoctorName,
      doctorTitle: certDoctorTitle
    };

    try {
      await api.post('/medicalcertificates', {
        tenantId: 1,
        patientId: activePatient.id,
        doctorId: selectedDoctorId,
        certificateType: 'Medical Certificate',
        diagnosisSummary: newCert.diagnosis,
        recommendation: newCert.recommendation,
        startDate: newCert.examinedOn,
        endDate: new Date(Date.now() + daysExcused * 86400000).toISOString().split('T')[0],
        daysExcused
      }).catch(() => {});
    } catch (err) {
      console.error('Issue certificate error:', err);
    }

    setIssuedCerts([newCert, ...issuedCerts]);
    setExpandedCertId(newCert.id);
  };

  return (
    <div>
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #huderma-printable-certificate, #huderma-printable-certificate * { visibility: visible; }
          #huderma-printable-certificate {
            position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 24px;
            background: #ffffff !important; box-shadow: none !important; border: none !important;
          }
        }
      `}</style>

      {/* Toast Alert */}
      {orderDispatchedToast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '12px 18px', borderRadius: '8px', background: '#059669', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <CheckCircle size={18} /> {orderDispatchedToast}
        </div>
      )}

      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '18px', background: '#ffffff', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
              {getDoctorInitials(certDoctorName)}
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700, letterSpacing: '0.04em' }}>ATTENDING PHYSICIAN CONSULTATION</div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{certDoctorName} ({certDoctorTitle})</h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowOrderModal(true)}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                fontWeight: 700,
                fontSize: '0.835rem',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px'
              }}
            >
              <ShoppingCart size={16} /> + Order (Lab, Rx, Procedures, Certificate)
            </button>
          </div>
        </div>

        {/* Loaded Patient Profile Bar */}
        {activePatient && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0eae1', fontSize: '0.8rem', flexWrap: 'wrap' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Card No:</span> <strong style={{ color: '#0369a1', fontFamily: 'monospace' }}>{activePatient.mrn}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Patient Name:</span> <strong style={{ color: 'var(--text-main)' }}>{activePatient.name}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Age/Gender:</span> <strong>{activePatient.age} yrs / {activePatient.gender}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Blood:</span> <strong style={{ color: '#e11d48' }}>{activePatient.blood}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Allergies:</span> <span className="badge badge-critical">{activePatient.allergies}</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Payment:</span> <span className="badge badge-info">{activePatient.insurance}</span></div>
          </div>
        )}
      </div>

      {/* Sub Tabs */}
      {/* isEditingClosed: if consultDate is before today, past-note editing is locked */}
      {(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const isEditingClosed = consultDate < todayStr;
        return (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setActiveSubTab('consultation')} className={activeSubTab === 'consultation' ? 'btn-primary' : 'btn-secondary'}>
              <Stethoscope size={15} /> Consultation Note &amp; EMR
            </button>
            <button onClick={() => setActiveSubTab('cert')} className={activeSubTab === 'cert' ? 'btn-primary' : 'btn-secondary'}>
              <Award size={15} /> Medical Certificates ({issuedCerts.length})
            </button>
            <button onClick={() => setActiveSubTab('history')} className={activeSubTab === 'history' ? 'btn-primary' : 'btn-secondary'}>
              <History size={15} /> Patient Comprehensive EHR &amp; History
            </button>
            <button onClick={() => setActiveSubTab('results')} className={activeSubTab === 'results' ? 'btn-primary' : 'btn-secondary'}>
              <FlaskConical size={15} /> Lab &amp; Procedure Results
            </button>
            {isEditingClosed && activeSubTab === 'consultation' && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                <AlertTriangle size={13} color="#f59e0b" />
                Past date — existing notes are read-only. You can still submit a new note.
              </div>
            )}
          </div>
        );
      })()}


      {/* ========================================================================= */}
      {/* 1. CONSULTATION VIEW (Chief Complaint, History, Exam, Diagnosis, Plan, Rx) */}
      {/* ========================================================================= */}
      {activeSubTab === 'consultation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '18px' }}>
          
          {/* LEFT: DOCTOR'S ASSIGNED PATIENT QUEUE WITH DATE SELECTOR */}
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '82vh', overflowY: 'auto' }}>
            
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Doctor Consultation Queue
            </div>

            {/* Attending Doctor Badge / Status (Dropdown removed per user request) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attending Doctor:</span>
                <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700 }}>{patients.length} Patient{patients.length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                {availableDoctors.find(d => d.id === selectedDoctorId)?.name || (selectedDoctorId === 2 ? 'Dr. Tigist Haile' : 'Dr. Abebe Bekele')}
                {availableDoctors.find(d => d.id === selectedDoctorId)?.specialization && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    ({availableDoctors.find(d => d.id === selectedDoctorId)?.specialization})
                  </span>
                )}
              </div>
            </div>

            {/* Single Date Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Consultation Date:</span>
                <button
                  type="button"
                  onClick={() => setConsultDate(new Date().toISOString().split('T')[0])}
                  className="btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '0.68rem' }}
                >
                  Today
                </button>
              </div>

              <input
                type="date"
                value={consultDate}
                onChange={e => setConsultDate(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '0.78rem', textAlign: 'center', width: '100%', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              />
            </div>

            {/* Assigned Patients List for Doctor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {patients.length === 0 ? (
                <div style={{ padding: '18px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', background: '#fdfcf9', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                  No patients assigned to {certDoctorName} on {consultDate}.
                </div>
              ) : (
                patients.map(p => {
                  const isSelected = activePatient?.id === p.id;
                  const isPaid = patientPaymentMap[p.id] === true;
                  // Selected takes blue, otherwise green/red based on payment
                  const bgColor = isSelected ? '#e0f2fe' : (isPaid ? '#f0fdf4' : '#fef2f2');
                  const borderColor = isSelected ? '#0284c7' : (isPaid ? '#86efac' : '#fca5a5');
                  const borderWidth = isSelected ? '1.5px' : '1px';
                  return (
                    <div
                      key={p.id}
                      onClick={() => setActivePatient(p)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: bgColor,
                        border: `${borderWidth} solid ${borderColor}`,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.78rem',
                        transition: 'all 0.1s'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: isSelected ? '#0369a1' : 'var(--text-main)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {p.mrn} • {p.age}y {p.gender}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                        <span className={isSelected ? 'badge badge-info' : 'badge badge-normal'} style={{ fontSize: '0.65rem' }}>
                          {isSelected ? 'Active' : 'Queued'}
                        </span>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: isPaid ? '#dcfce7' : '#fee2e2', color: isPaid ? '#166534' : '#991b1b' }}>
                          {isPaid ? '✓ PAID' : '✗ UNPAID'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: EXACT ORDERED CLINICAL FIELDS */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {(() => {
              const todayStr = new Date().toISOString().split('T')[0];
              const isEditingClosed = consultDate < todayStr;
              const readOnlyStyle = isEditingClosed ? { background: '#f8f5ee', color: 'var(--text-muted)', cursor: 'not-allowed' } : {};
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                        Clinical Note Entry — {activePatient?.name}
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Card No: {activePatient?.mrn}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {isSaved && <span className="badge badge-normal"><CheckCircle size={11} /> Saved to Database</span>}
                      {!isEditingClosed && (
                        <button onClick={handleSaveConsultation} className="btn-primary">
                          <Save size={15} /> Save Consultation
                        </button>
                      )}
                      {isEditingClosed && (
                        <button onClick={handleSaveConsultation} className="btn-secondary" style={{ borderColor: '#f59e0b', color: '#92400e' }}>
                          <Save size={15} /> Submit New Note
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditingClosed && (
                    <div style={{ padding: '8px 12px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                      ⚠️ Viewing historical notes for <strong>{consultDate}</strong>. Existing notes are read-only. Clear fields below to submit a new note for this encounter date.
                    </div>
                  )}

                  {/* FIELD 1: CHIEF COMPLAINT */}
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      1. Chief Complaint
                    </label>
                    <textarea
                      rows={2}
                      value={chiefComplaint}
                      onChange={e => !isEditingClosed && setChiefComplaint(e.target.value)}
                      readOnly={isEditingClosed}
                      placeholder="Enter patient's primary reason for consultation and symptoms..."
                      style={isEditingClosed ? readOnlyStyle : {}}
                    />
                  </div>

                  {/* FIELD 2: HISTORY */}
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      2. History (HPI &amp; Past Medical History)
                    </label>
                    <textarea
                      rows={3}
                      value={history}
                      onChange={e => !isEditingClosed && setHistory(e.target.value)}
                      readOnly={isEditingClosed}
                      placeholder="Enter history of present illness, symptom onset, progression, relevant past medical history, and allergies..."
                      style={isEditingClosed ? readOnlyStyle : {}}
                    />
                  </div>

                  {/* FIELD 3: PHYSICAL EXAMINATION */}
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      3. Physical Examination
                    </label>
                    <textarea
                      rows={3}
                      value={physicalExam}
                      onChange={e => !isEditingClosed && setPhysicalExam(e.target.value)}
                      readOnly={isEditingClosed}
                      placeholder="Enter clinical examination findings, skin lesion descriptions, anatomical distribution, morphology, and vitals..."
                      style={isEditingClosed ? readOnlyStyle : {}}
                    />
                  </div>

                  {/* FIELD 4: DIAGNOSIS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        ICD-10 Code
                      </label>
                      <input
                        type="text"
                        value={icdCode}
                        onChange={e => !isEditingClosed && setIcdCode(e.target.value)}
                        readOnly={isEditingClosed}
                        placeholder="e.g. L20.9"
                        style={{ fontFamily: 'monospace', fontWeight: 700, ...(isEditingClosed ? readOnlyStyle : {}) }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        4. Diagnosis
                      </label>
                      <input
                        type="text"
                        value={diagnosis}
                        onChange={e => {
                          if (!isEditingClosed) {
                            setDiagnosis(e.target.value);
                            setCertDiagnosis(e.target.value);
                          }
                        }}
                        readOnly={isEditingClosed}
                        placeholder="e.g. Acute Atopic Dermatitis & Contact Dermatosis"
                        required
                        style={isEditingClosed ? readOnlyStyle : {}}
                      />
                    </div>
                  </div>

                  {/* FIELD 5: PLAN */}
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      5. Plan &amp; Treatment Instructions
                    </label>
                    <textarea
                      rows={3}
                      value={plan}
                      onChange={e => !isEditingClosed && setPlan(e.target.value)}
                      readOnly={isEditingClosed}
                      placeholder="Enter clinical treatment instructions, ordered investigations, patient education, follow-up date..."
                      style={isEasingClosed ? readOnlyStyle : {}}
                    />
                  </div>
                </>
              );
            })()}

            {/* FIELD 6: MEDICATION DETAILS (Drug Name, Dosage, Qty, Frequency, Duration) */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700 }}>
                  6. Medication Details (Prescriptions)
                </label>
                <button onClick={() => setShowOrderModal(true)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.72rem' }}>
                  <ShoppingCart size={13} /> Open Full Order Hub
                </button>
              </div>

              {/* Medication Table */}
              <table className="cms-table" style={{ marginBottom: '12px' }}>
                <thead>
                  <tr>
                    <th>Drug Name</th>
                    <th>Dosage</th>
                    <th>Qty</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {medications.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '14px', color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                        No medications prescribed yet. Add below or click Open Full Order Hub.
                      </td>
                    </tr>
                  ) : (
                    medications.map((m, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{m.drugName}</td>
                        <td>{m.dosage}</td>
                        <td style={{ fontWeight: 700 }}>{m.qty}</td>
                        <td>{m.frequency}</td>
                        <td>{m.duration}</td>
                        <td>
                          <button onClick={() => handleRemoveMedication(idx)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Inline Quick Medication Adder */}
              <div style={{ padding: '10px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1.4fr 1fr 70px 1.1fr 1fr auto', gap: '6px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Drug Name</label>
                  <input type="text" value={newDrugName} onChange={e => setNewDrugName(e.target.value)} placeholder="Drug Name" />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Dosage</label>
                  <input type="text" value={newDosage} onChange={e => setNewDosage(e.target.value)} placeholder="Dosage" />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Qty</label>
                  <input type="number" min={1} value={newQty} onChange={e => setNewQty(parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Frequency</label>
                  <input type="text" value={newFreq} onChange={e => setNewFreq(e.target.value)} placeholder="Frequency" />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Duration</label>
                  <input type="text" value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="Duration" />
                </div>
                <button onClick={handleAddMedication} className="btn-primary" style={{ padding: '7px 10px' }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MEDICAL CERTIFICATES (Vertically Expandable Accordion & Direct Issue)  */}
      {/* ========================================================================= */}
      {activeSubTab === 'cert' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px' }}>
          
          {/* Direct Issue Form */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={16} color="#c89345" /> Issue New Certificate
            </h3>

            <form onSubmit={handleIssueCertificateDirect} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Card No. (MRN)</label>
                  <input type="text" value={activePatient?.mrn} readOnly style={{ background: '#f5f2eb', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Age</label>
                  <input type="number" value={activePatient?.age} readOnly style={{ background: '#f5f2eb', fontWeight: 600 }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Patient Full Name</label>
                <input type="text" value={activePatient?.name} readOnly style={{ background: '#f5f2eb', fontWeight: 700, textTransform: 'uppercase' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Examined On (Date)</label>
                <input type="date" value={certExamDate} onChange={e => setCertExamDate(e.target.value)} required />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700 }}>Diagnosis (Auto from Consultation)</label>
                <textarea
                  rows={2}
                  value={certDiagnosis || diagnosis}
                  onChange={e => setCertDiagnosis(e.target.value)}
                  placeholder="Diagnosis summary"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Dr's Recommendation</label>
                <textarea
                  rows={2}
                  value={recommendation}
                  onChange={e => setRecommendation(e.target.value)}
                  placeholder="Clinical recommendation"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Rest Recommended (Days)</label>
                <input type="number" value={daysExcused} onChange={e => setDaysExcused(parseInt(e.target.value) || 1)} min={1} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attending Doctor</label>
                  <input type="text" value={certDoctorName} onChange={e => setCertDoctorName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Designation</label>
                  <input type="text" value={certDoctorTitle} onChange={e => setCertDoctorTitle(e.target.value)} />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #c89345, #b47a32)',
                  borderColor: '#c89345',
                  justifyContent: 'center',
                  marginTop: '8px',
                  padding: '9px',
                  fontWeight: 700
                }}
              >
                <Award size={15} /> Save & Issue Certificate
              </button>
            </form>
          </div>

          {/* Vertically Expandable Previous Medical Certificates Accordion */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Previously Issued Certificates for {activePatient?.name}</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click any certificate below to expand full sheet & print</span>
              </div>
            </div>

            {issuedCerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No medical certificates recorded for this patient. Issue one using the form on the left or via the Order Hub.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {issuedCerts.map(c => {
                  const isExpanded = expandedCertId === c.id;
                  return (
                    <div
                      key={c.id}
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#ffffff',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Accordion Card Header */}
                      <div
                        onClick={() => setExpandedCertId(isExpanded ? null : c.id)}
                        style={{
                          padding: '12px 16px',
                          background: isExpanded ? '#fbf8f2' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Award size={18} color="#c89345" />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                              {c.certNo} • {c.examinedOn}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              <strong>Dx:</strong> {c.diagnosis} • <strong>Rest:</strong> {c.daysExcused} Days
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setShowPrintModal(c);
                            }}
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                          >
                            <Printer size={12} /> Print PDF
                          </button>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {/* Accordion Expanded Official Huderma View */}
                      {isExpanded && (
                        <div style={{ padding: '24px 28px', background: '#ffffff', borderTop: '1px solid #f0eae1' }}>
                          <div
                            style={{
                              border: '1px solid #e5dfd5',
                              borderRadius: '8px',
                              padding: '28px 32px',
                              color: '#1c1917',
                              fontFamily: "'Plus Jakarta Sans', Arial, sans-serif"
                            }}
                          >
                            {/* Logo & Bilingual Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                              <div style={{ width: '180px' }}>
                                <img src="/huderma_logo.png" alt="Huderma" style={{ width: '100%', maxHeight: '60px', objectFit: 'contain' }} />
                                <div style={{ fontSize: '0.6rem', color: '#c89345', fontWeight: 700, letterSpacing: '0.15em', marginTop: '2px', textAlign: 'center' }}>
                                  LOVE YOUR SKIN
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', fontSize: '0.72rem', lineHeight: 1.35 }}>
                                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#c89345' }}>Huderma Dermatology Specialty Clinic</div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#c89345', marginBottom: '4px' }}>ሁደርማ የቆዳ ልዩ ክሊኒክ</div>
                                <div style={{ fontSize: '0.68rem', color: '#44403c' }}>
                                  Kirkos Sub City, Woreda 01, H. No. 062 | Tel: +251 949 74 44 44
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: 'center', margin: '18px 0 16px' }}>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, textDecoration: 'underline', color: '#000' }}>
                                Medical Certificate
                              </h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.82rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '18px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                                  <span style={{ fontWeight: 600 }}>Card No.</span>
                                  <span style={{ flex: 1, borderBottom: '1.5px dashed #000', fontWeight: 700, fontFamily: 'monospace' }}>
                                    {c.cardNo}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                                  <span style={{ fontWeight: 600 }}>Age</span>
                                  <span style={{ flex: 1, borderBottom: '1.5px dashed #000', fontWeight: 700 }}>
                                    {c.age}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '18px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                                  <span style={{ fontWeight: 600 }}>Fullname</span>
                                  <span style={{ flex: 1, borderBottom: '1.5px dashed #000', fontWeight: 800, textTransform: 'uppercase' }}>
                                    {c.patientName}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                                  <span style={{ fontWeight: 600 }}>Examined on</span>
                                  <span style={{ flex: 1, borderBottom: '1.5px dashed #000', fontWeight: 600 }}>
                                    {c.examinedOn}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                                <span style={{ fontWeight: 600 }}>Diagnosis</span>
                                <span style={{ flex: 1, borderBottom: '1.5px dashed #000', fontWeight: 700 }}>
                                  {c.diagnosis}
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontWeight: 600 }}>Dr's Recommendation</span>
                                <div style={{ borderBottom: '1.5px dashed #000', padding: '0 4px 2px', fontWeight: 600 }}>
                                  {c.recommendation}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                                <span style={{ fontWeight: 600 }}>Rest Recommended</span>
                                <span style={{ width: '60px', borderBottom: '1.5px dashed #000', fontWeight: 800, textAlign: 'center' }}>
                                  {c.daysExcused}
                                </span>
                                <span style={{ fontWeight: 600 }}>Days</span>
                              </div>
                            </div>

                            <div style={{ marginTop: '28px' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{c.doctorName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#57534e' }}>{c.doctorTitle}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PATIENT COMPREHENSIVE EHR & HISTORY (Real Notes, Labs, Rx, Invoices)   */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          
          {/* Header & Filter Chips */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px' }}>
                <History color="#0284c7" size={18} /> Comprehensive Medical Record & History — {activePatient?.name}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Card No: {activePatient?.mrn}</span>
            </div>

            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: 'All Records' },
                { key: 'NOTES', label: `Consultations (${historyEncounters.length})` },
                { key: 'LABS', label: `Lab Orders (${historyLabOrders.length})` },
                { key: 'RX', label: `Prescriptions (${historyPrescriptions.length})` },
                { key: 'CERTS', label: `Certificates (${issuedCerts.length})` },
                { key: 'BILLING', label: `Invoices (${historyInvoices.length})` }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setHistoryFilter(f.key as any)}
                  className="btn-secondary"
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    background: historyFilter === f.key ? '#0284c7' : undefined,
                    color: historyFilter === f.key ? '#ffffff' : undefined,
                    borderColor: historyFilter === f.key ? '#0284c7' : undefined
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 6px' }} />
              Fetching clinical history records...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Encounters & Notes */}
              {(historyFilter === 'ALL' || historyFilter === 'NOTES') && historyEncounters.map((enc, idx) => (
                <div key={`enc-${idx}`} style={{ padding: '14px', borderRadius: '8px', background: '#fdfcf9', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>Consultation Encounter</span>
                      <strong style={{ fontSize: '0.82rem' }}>{enc.doctorName || 'Dr. Kebede Biniyam'}</strong>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{enc.encounterDate ? String(enc.encounterDate).split('T')[0] : 'Recorded'}</span>
                  </div>
                  {enc.chiefComplaint && <div style={{ fontSize: '0.78rem', marginBottom: '3px' }}><strong>Chief Complaint:</strong> {enc.chiefComplaint}</div>}
                  {enc.historyOfIllness && <div style={{ fontSize: '0.78rem', marginBottom: '3px' }}><strong>History:</strong> {enc.historyOfIllness}</div>}
                  {enc.physicalExam && <div style={{ fontSize: '0.78rem', marginBottom: '3px' }}><strong>Physical Exam:</strong> {enc.physicalExam}</div>}
                  {enc.assessment && <div style={{ fontSize: '0.78rem', marginBottom: '3px', color: '#0369a1' }}><strong>Diagnosis:</strong> {enc.assessment}</div>}
                  {enc.soapPlan && <div style={{ fontSize: '0.78rem', color: '#059669' }}><strong>Plan:</strong> {enc.soapPlan}</div>}
                </div>
              ))}

              {/* Lab Orders */}
              {(historyFilter === 'ALL' || historyFilter === 'LABS') && historyLabOrders.map((lab, idx) => (
                <div key={`lab-${idx}`} style={{ padding: '14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="badge badge-normal" style={{ fontSize: '0.68rem' }}>Laboratory Order #{lab.orderNumber || lab.id}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lab.orderDate ? String(lab.orderDate).split('T')[0] : 'Ordered'}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{lab.clinicalInfo || 'Diagnostic Lab Order'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {lab.statusName || 'Completed / Verified'}</div>
                </div>
              ))}

              {/* Prescriptions */}
              {(historyFilter === 'ALL' || historyFilter === 'RX') && historyPrescriptions.map((rx, idx) => (
                <div key={`rx-${idx}`} style={{ padding: '14px', borderRadius: '8px', background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Prescription #{rx.id}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{rx.prescribedAt ? String(rx.prescribedAt).split('T')[0] : 'Prescribed'}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>
                    {(rx.items || []).map((it: any, i: number) => (
                      <div key={i} style={{ fontWeight: 600 }}>• {it.drugName} ({it.dosage} - {it.frequency} x {it.duration})</div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Certificates */}
              {(historyFilter === 'ALL' || historyFilter === 'CERTS') && issuedCerts.map((cert, idx) => (
                <div key={`cert-${idx}`} style={{ padding: '14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fef3c7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="badge badge-info" style={{ fontSize: '0.68rem', background: '#c89345', color: '#fff' }}>Medical Certificate {cert.certNo}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cert.examinedOn}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Dx: {cert.diagnosis} ({cert.daysExcused} Days Excused)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cert.recommendation}</div>
                </div>
              ))}

              {/* Invoices */}
              {(historyFilter === 'ALL' || historyFilter === 'BILLING') && historyInvoices.map((inv, idx) => (
                <div key={`inv-${idx}`} style={{ padding: '14px', borderRadius: '8px', background: '#fdfcf9', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="badge badge-normal" style={{ fontSize: '0.68rem' }}>Invoice #{inv.invoiceNo || inv.id}</span>
                    <strong style={{ fontSize: '0.85rem', color: '#0369a1' }}>Br {(inv.totalAmount || inv.total || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {inv.statusName || inv.status || 'Issued'} • Paid: Br {(inv.paidAmount || inv.paid || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ORDER MODAL (Including Medical Certificate Node)                          */}
      {/* ========================================================================= */}
      {showOrderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: '#f6f2e9', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '7px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <ShoppingCart size={17} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>Clinical Order Hub — {activePatient?.name}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Card No: {activePatient?.mrn}</span>
                </div>
              </div>
              <button onClick={() => setShowOrderModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, overflow: 'hidden' }}>
              {/* Tree */}
              <div style={{ borderRight: '1px solid var(--border-color)', padding: '14px', overflowY: 'auto', maxHeight: '55vh', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fbf9f4' }}>
                
                {/* Lab Node */}
                <div style={{ borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <button onClick={() => toggleNode('lab')} style={{ width: '100%', padding: '9px 12px', background: expandedNodes.lab ? '#e0f2fe' : '#ffffff', border: 'none', color: '#0369a1', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><FlaskConical size={14} color="#0284c7" /><span>Laboratory Diagnostic Tests ({labCatalogue.length})</span></div>
                    {expandedNodes.lab ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expandedNodes.lab && (
                    <div style={{ padding: '4px 6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px 5px', borderBottom: '1px solid #f0ece1', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>Multi-select tests:</span>
                        <button
                          type="button"
                          onClick={() => handleToggleSelectAll('LAB', labCatalogue)}
                          style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {labCatalogue.every(t => !!checkedCatalogItems[`LAB:${t.id}`]) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      {labCatalogue.map(test => {
                        const isChecked = !!checkedCatalogItems[`LAB:${test.id}`];
                        return (
                          <div
                            key={test.id}
                            onClick={() => handleSelectCatalogItem('LAB', test)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '5px',
                              background: selectedOrderItem?.type === 'LAB' && selectedOrderItem.item.id === test.id ? '#e0f2fe' : (isChecked ? '#f0f9ff' : 'transparent'),
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.75rem'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleCheckItem('LAB', test);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600 }}>{test.name}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{test.specimen} • Br {test.price.toFixed(2)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Procedure Node */}
                <div style={{ borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <button onClick={() => toggleNode('proc')} style={{ width: '100%', padding: '9px 12px', background: expandedNodes.proc ? '#ede9fe' : '#ffffff', border: 'none', color: '#6d28d9', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Scissors size={14} color="#7c3aed" /><span>Clinical Procedures ({procedureCatalogue.length})</span></div>
                    {expandedNodes.proc ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expandedNodes.proc && (
                    <div style={{ padding: '4px 6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px 5px', borderBottom: '1px solid #f0ece1', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>Multi-select procedures:</span>
                        <button
                          type="button"
                          onClick={() => handleToggleSelectAll('PROCEDURE', procedureCatalogue)}
                          style={{ background: 'none', border: 'none', color: '#6d28d9', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {procedureCatalogue.every(p => !!checkedCatalogItems[`PROCEDURE:${p.id}`]) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      {procedureCatalogue.map(proc => {
                        const isChecked = !!checkedCatalogItems[`PROCEDURE:${proc.id}`];
                        return (
                          <div
                            key={proc.id}
                            onClick={() => handleSelectCatalogItem('PROCEDURE', proc)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '5px',
                              background: selectedOrderItem?.type === 'PROCEDURE' && selectedOrderItem.item.id === proc.id ? '#ede9fe' : (isChecked ? '#faf5ff' : 'transparent'),
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.75rem'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleCheckItem('PROCEDURE', proc);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600 }}>{proc.name}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{proc.category} • Br {proc.price.toFixed(2)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Prescription Node */}
                <div style={{ borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <button onClick={() => toggleNode('rx')} style={{ width: '100%', padding: '9px 12px', background: expandedNodes.rx ? '#d1fae5' : '#ffffff', border: 'none', color: '#065f46', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Pill size={14} color="#059669" /><span>Prescriptions (E-Rx) ({medicationCatalogue.length})</span></div>
                    {expandedNodes.rx ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expandedNodes.rx && (
                    <div style={{ padding: '4px 6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px 5px', borderBottom: '1px solid #f0ece1', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>Multi-select meds:</span>
                        <button
                          type="button"
                          onClick={() => handleToggleSelectAll('RX', medicationCatalogue)}
                          style={{ background: 'none', border: 'none', color: '#059669', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {medicationCatalogue.every(m => !!checkedCatalogItems[`RX:${m.id}`]) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      {medicationCatalogue.map(med => {
                        const isChecked = !!checkedCatalogItems[`RX:${med.id}`];
                        return (
                          <div
                            key={med.id}
                            onClick={() => handleSelectCatalogItem('RX', med)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '5px',
                              background: selectedOrderItem?.type === 'RX' && selectedOrderItem.item.id === med.id ? '#d1fae5' : (isChecked ? '#f0fdf4' : 'transparent'),
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.75rem'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleCheckItem('RX', med);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600 }}>{med.name}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{med.class} • Br {med.unitPrice.toFixed(2)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Medical Certificate Node */}
                <div style={{ borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <button onClick={() => { toggleNode('cert'); handleSelectCatalogItem('CERT', { name: 'Medical Certificate (Huderma)' }); }} style={{ width: '100%', padding: '9px 12px', background: selectedOrderItem?.type === 'CERT' ? '#fef3c7' : '#ffffff', border: 'none', color: '#c89345', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Award size={14} color="#c89345" /><span>Medical Certificate (Huderma)</span></div>
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Batch Add Checked Items Action Box */}
                {Object.keys(checkedCatalogItems).length > 0 && (
                  <div style={{ marginTop: 'auto', padding: '10px 12px', background: '#e0f2fe', borderRadius: '8px', border: '1px solid #7dd3fc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0369a1' }}>
                        ✓ {Object.keys(checkedCatalogItems).length} Items Selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setCheckedCatalogItems({})}
                        style={{ background: 'none', border: 'none', color: '#b91c1c', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Clear
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAllCheckedToBasket}
                      className="btn-primary"
                      style={{ padding: '8px 12px', fontSize: '0.78rem', background: '#0284c7', justifyContent: 'center', fontWeight: 700 }}
                    >
                      <ShoppingCart size={14} /> + Add All {Object.keys(checkedCatalogItems).length} to Basket
                    </button>
                  </div>
                )}
              </div>

              {/* Parameter Editor */}
              <div style={{ padding: '18px 20px', overflowY: 'auto', maxHeight: '55vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#ffffff' }}>
                {selectedOrderItem ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '14px' }}>
                      <div>
                        <span className="badge badge-info">{selectedOrderItem.type}</span>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>{selectedOrderItem.item.name}</h3>
                      </div>
                      <button onClick={handleAddToBasket} className="btn-primary"><Plus size={15} /> Add to Basket</button>
                    </div>

                    {selectedOrderItem.type === 'CERT' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div><label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Card No</label><input type="text" value={activePatient?.mrn} readOnly /></div>
                          <div><label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Examined On</label><input type="date" value={certExamDate} onChange={e => setCertExamDate(e.target.value)} /></div>
                        </div>
                        <div><label style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700 }}>Diagnosis (Auto from EMR)</label><input type="text" value={certDiagnosis || diagnosis} onChange={e => setCertDiagnosis(e.target.value)} /></div>
                        <div><label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Dr's Recommendation</label><input type="text" value={recommendation} onChange={e => setRecommendation(e.target.value)} /></div>
                        <div style={{ width: '130px' }}><label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rest (Days)</label><input type="number" min={1} value={daysExcused} onChange={e => setDaysExcused(parseInt(e.target.value) || 1)} /></div>
                      </div>
                    )}

                    {selectedOrderItem.type === 'RX' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dosage</label><input type="text" value={orderRxDosage} onChange={e => setOrderRxDosage(e.target.value)} /></div>
                          <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Route</label><input type="text" value={orderRxRoute} onChange={e => setOrderRxRoute(e.target.value)} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '10px' }}>
                          <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Frequency</label><input type="text" value={orderRxFreq} onChange={e => setOrderRxFreq(e.target.value)} /></div>
                          <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Duration</label><input type="text" value={orderRxDuration} onChange={e => setOrderRxDuration(e.target.value)} /></div>
                          <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty</label><input type="number" value={orderRxQty} onChange={e => setOrderRxQty(parseInt(e.target.value) || 1)} /></div>
                        </div>
                      </div>
                    )}

                    {selectedOrderItem.type === 'LAB' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Priority</label><select value={orderLabPriority} onChange={e => setOrderLabPriority(e.target.value)}><option value="Routine">Routine</option><option value="STAT">STAT</option></select></div>
                        <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clinical Indication</label><input type="text" value={orderLabIndication} onChange={e => setOrderLabIndication(e.target.value)} /></div>
                      </div>
                    )}

                    {selectedOrderItem.type === 'PROCEDURE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Urgency</label><select value={orderProcUrgency} onChange={e => setOrderProcUrgency(e.target.value)}><option value="Routine">Routine</option><option value="STAT">STAT</option></select></div>
                        <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Instructions</label><input type="text" value={orderProcNotes} onChange={e => setOrderProcNotes(e.target.value)} /></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    <ShoppingCart size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                    <p>Select any item from the catalog on the left to configure parameters.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 20px', background: '#f8f5ee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflowX: 'auto', marginRight: '14px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>BASKET ({orderBasket.length}):</span>
                {orderBasket.map(b => (
                  <div key={b.id} style={{ padding: '3px 8px', borderRadius: '5px', background: '#e0f2fe', border: '1px solid #bae6fd', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <strong>{b.title}</strong>
                    <button onClick={() => handleRemoveFromBasket(b.id)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}><X size={11} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowOrderModal(false)} className="btn-secondary">Close</button>
                <button
                  onClick={handleSubmitAllOrders}
                  disabled={orderBasket.length === 0 && !selectedOrderItem}
                  className="btn-primary"
                  title={orderBasket.length === 0 && !selectedOrderItem ? 'Select or add an order to basket first' : 'Submit orders and bill'}
                >
                  <Send size={14} /> Submit & Bill Orders
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '740px', maxHeight: '95vh', overflowY: 'auto', padding: '32px', background: '#ffffff', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5dfd5', paddingBottom: '12px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0369a1' }}>Official Medical Certificate Document</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => window.print()} className="btn-primary" style={{ background: '#c89345', borderColor: '#c89345' }}>
                  <Printer size={15} /> Print Certificate / Save as PDF
                </button>
                <button onClick={() => setShowPrintModal(null)} className="btn-secondary"><X size={15} /> Close</button>
              </div>
            </div>

            <div id="huderma-printable-certificate" style={{ background: '#ffffff', border: '1px solid #d6cec2', padding: '40px 48px', color: '#1c1917', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                <div style={{ width: '220px' }}>
                  <img src="/huderma_logo.png" alt="Huderma" style={{ width: '100%', maxHeight: '76px', objectFit: 'contain' }} />
                  <div style={{ fontSize: '0.68rem', color: '#c89345', fontWeight: 700, letterSpacing: '0.15em', marginTop: '2px', textAlign: 'center' }}>LOVE YOUR SKIN</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.78rem', lineHeight: 1.35 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#c89345' }}>Huderma Dermatology Specialty Clinic</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#c89345', marginBottom: '4px' }}>ሁደርማ የቆዳ ልዩ ክሊኒክ</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '8px', textAlign: 'left', fontSize: '0.75rem', color: '#292524' }}>
                    <div><div>Kirkos Sub City, Woreda 01, H. No. 062</div><div>ቂርቆስ ክፍለ ከተማ/ ወረዳ 01 ቤ.ቁ 062</div></div>
                    <div style={{ textAlign: 'right' }}><div>hudermacare@gmail.com</div><div>www.huderma.com</div><div>+251 949 74 44 44</div><div>+251 949 54 44 44</div></div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '32px 0 28px' }}>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: '6px', color: '#000000' }}>Medical Certificate</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', fontSize: '0.92rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '28px', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}><span style={{ fontWeight: 600, minWidth: '70px' }}>Card No.</span><span style={{ flex: 1, borderBottom: '1.5px dashed #000', padding: '0 8px 2px', fontWeight: 700, fontFamily: 'monospace' }}>{showPrintModal.cardNo || activePatient?.mrn}</span></div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}><span style={{ fontWeight: 600, minWidth: '40px' }}>Age</span><span style={{ flex: 1, borderBottom: '1.5px dashed #000', padding: '0 8px 2px', fontWeight: 700 }}>{showPrintModal.age || activePatient?.age}</span></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '28px', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}><span style={{ fontWeight: 600, minWidth: '70px' }}>Fullname</span><span style={{ flex: 1, borderBottom: '1.5px dashed #000', padding: '0 8px 2px', fontWeight: 800, textTransform: 'uppercase' }}>{showPrintModal.patientName || activePatient?.name}</span></div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}><span style={{ fontWeight: 600, minWidth: '100px' }}>Examined on</span><span style={{ flex: 1, borderBottom: '1.5px dashed #000', padding: '0 8px 2px', fontWeight: 600 }}>{showPrintModal.examinedOn || certExamDate}</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}><span style={{ fontWeight: 600, minWidth: '70px' }}>Diagnosis</span><span style={{ flex: 1, borderBottom: '1.5px dashed #000', padding: '0 8px 2px', fontWeight: 700 }}>{showPrintModal.diagnosis || certDiagnosis || diagnosis}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><span style={{ fontWeight: 600 }}>Dr's Recommendation</span><div style={{ borderBottom: '1.5px dashed #000', padding: '0 8px 4px', fontWeight: 600, minHeight: '28px' }}>{showPrintModal.recommendation || recommendation}</div></div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}><span style={{ fontWeight: 600, minWidth: '150px' }}>Rest Recommended</span><span style={{ width: '90px', borderBottom: '1.5px dashed #000', padding: '0 8px 2px', fontWeight: 800, textAlign: 'center' }}>{showPrintModal.daysExcused || daysExcused}</span><span style={{ fontWeight: 600 }}>Days</span></div>
              </div>

              <div style={{ marginTop: '54px', paddingTop: '10px' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{showPrintModal.doctorName || certDoctorName}</div>
                <div style={{ fontSize: '0.82rem', color: '#57534e', fontWeight: 600 }}>{showPrintModal.doctorTitle || certDoctorTitle}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
