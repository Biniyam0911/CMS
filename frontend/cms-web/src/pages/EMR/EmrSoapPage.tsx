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
import { evaluateCdsAlerts, CdsAlert } from '../../utils/cdsRuleEngine';
import { searchIcd10, Icd10Item } from '../../utils/icd10Catalog';
import RadiologyViewerModal, { RadiologyStudy } from '../../components/RadiologyViewerModal';

interface EmrSoapPageProps {
  selectedPatientId?: number | null;
  currentUser?: any;
}

// Order Catalogue Types
export interface ServiceCatalogItem {
  id: number;
  code: string;
  name: string;
  category: string;
  department?: string;
  price: number;
  description?: string;
}

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

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [showMobileQueue, setShowMobileQueue] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Doctor Selector State for Multi-Doctor EMR
  // Use the doctorId from the logged-in user (set by backend at login) — no hardcoded username checks
  const initialDoctorId = (() => {
    if (currentUser?.doctorId) return Number(currentUser.doctorId);
    try {
      const saved = localStorage.getItem('emr_selected_doctor_id');
      if (saved) return Number(saved);
    } catch {}
    return 0;
  })();

  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(initialDoctorId);
  const [availableDoctors, setAvailableDoctors] = useState<{ id: number; name: string; specialization?: string }[]>([]);

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

  // CDS Alert Modal State
  const [cdsAlerts, setCdsAlerts] = useState<CdsAlert[]>([]);
  const [pendingCandidateItem, setPendingCandidateItem] = useState<{ source: 'quick' | 'basket' | 'batch'; data: any } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // ICD-10 Autocomplete State
  const [icdSearchQuery, setIcdSearchQuery] = useState('');
  const [icdSearchResults, setIcdSearchResults] = useState<Icd10Item[]>([]);
  const [showIcdDropdown, setShowIcdDropdown] = useState(false);

  // Vitals Longitudinal History State
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const [loadingVitalsHistory, setLoadingVitalsHistory] = useState(false);

  // Appointment Follow-up Modal State
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [followUpTime, setFollowUpTime] = useState('09:30');
  const [followUpReason, setFollowUpReason] = useState('Follow-up evaluation & treatment review');

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
  const getInitialDoctorName = () => {
    if (currentUser?.firstName) {
      return `Dr. ${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
    }
    if (currentUser?.name) {
      return currentUser.name.startsWith('Dr.') ? currentUser.name : `Dr. ${currentUser.name}`;
    }
    if (currentUser?.username && currentUser.username.toLowerCase() !== 'admin') {
      return `Dr. ${currentUser.username}`;
    }
    return 'Attending Physician';
  };

  const [certDoctorName, setCertDoctorName] = useState<string>(getInitialDoctorName);
  const [certDoctorTitle, setCertDoctorTitle] = useState<string>('General Practitioner');

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
            id: Number(d.id || d.Id),
            name: d.doctorName || d.DoctorName || `Doctor ${d.id}`,
            specialization: d.specializationName || d.SpecializationName || 'General Practice'
          }));
          setAvailableDoctors(docs);

          // 1. If currentUser has doctorId, match it (with type coercion)
          const loggedDocId = Number(currentUser?.doctorId);
          if (loggedDocId > 0) {
            const match = docs.find((d: any) => d.id === loggedDocId);
            if (match) {
              setSelectedDoctorId(match.id);
              try { localStorage.setItem('emr_selected_doctor_id', String(match.id)); } catch {}
              setCertDoctorName(match.name);
              setCertDoctorTitle(match.specialization ? `${match.specialization} Specialist` : 'Physician');
              return;
            }
          }

          // 2. Match by username / first name / last name
          const uname = (currentUser?.username || '').toLowerCase();
          const fname = (currentUser?.firstName || '').toLowerCase();
          const lname = (currentUser?.lastName || '').toLowerCase();
          const nameMatch = docs.find((d: any) => {
            const dName = (d.name || '').toLowerCase();
            const cleanDName = dName.replace(/^dr\.?\s+/i, '');
            return (uname && uname !== 'admin' && (dName.includes(uname) || uname.includes(cleanDName))) ||
                   (fname && fname !== 'admin' && dName.includes(fname)) ||
                   (lname && lname !== 'admin' && dName.includes(lname));
          });
          if (nameMatch) {
            setSelectedDoctorId(nameMatch.id);
            try { localStorage.setItem('emr_selected_doctor_id', String(nameMatch.id)); } catch {}
            setCertDoctorName(nameMatch.name);
            setCertDoctorTitle(nameMatch.specialization ? `${nameMatch.specialization} Specialist` : 'Physician');
            return;
          }

          // 3. Fallback for Admin / Staff: keep saved selection or choose first doctor
          let savedDocId = 0;
          try { savedDocId = Number(localStorage.getItem('emr_selected_doctor_id')); } catch {}
          const savedMatch = docs.find(d => d.id === savedDocId);
          const chosen = savedMatch || docs[0];
          if (chosen) {
            setSelectedDoctorId(chosen.id);
            try { localStorage.setItem('emr_selected_doctor_id', String(chosen.id)); } catch {}
            setCertDoctorName(chosen.name);
            setCertDoctorTitle(chosen.specialization ? `${chosen.specialization} Specialist` : 'Physician');
          }
        }
      } catch (e) {
        console.warn('Could not load doctor list:', e);
      }
    };
    fetchDoctors();
  }, [currentUser]);

  // Update selectedDoctorId when currentUser changes
  useEffect(() => {
    const loggedDocId = Number(currentUser?.doctorId);
    if (loggedDocId > 0) {
      setSelectedDoctorId(loggedDocId);
      try { localStorage.setItem('emr_selected_doctor_id', String(loggedDocId)); } catch {}
    }
  }, [currentUser]);

  // Update certDoctorName and certDoctorTitle when selectedDoctorId changes
  useEffect(() => {
    const doc = availableDoctors.find(d => d.id === selectedDoctorId);
    if (doc) {
      setCertDoctorName(doc.name);
      setCertDoctorTitle(doc.specialization ? `${doc.specialization} Specialist` : 'Physician');
    } else if (currentUser?.firstName) {
      setCertDoctorName(`Dr. ${currentUser.firstName} ${currentUser.lastName || ''}`.trim());
      setCertDoctorTitle('Physician');
    } else if (currentUser?.name) {
      const name = currentUser.name.startsWith('Dr.') ? currentUser.name : `Dr. ${currentUser.name}`;
      setCertDoctorName(name);
      setCertDoctorTitle('Physician');
    } else if (currentUser?.username && currentUser.username.toLowerCase() !== 'admin') {
      setCertDoctorName(`Dr. ${currentUser.username}`);
      setCertDoctorTitle('Physician');
    } else if (availableDoctors.length > 0) {
      setCertDoctorName(availableDoctors[0].name);
      setCertDoctorTitle(availableDoctors[0].specialization ? `${availableDoctors[0].specialization} Specialist` : 'Physician');
    } else {
      setCertDoctorName('Attending Physician');
      setCertDoctorTitle('General Practice');
    }
  }, [selectedDoctorId, availableDoctors, currentUser]);

  const [issuedCerts, setIssuedCerts] = useState<any[]>([]);
  const [expandedCertId, setExpandedCertId] = useState<number | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<any>(null);

  // ==========================================
  // REAL PATIENT HISTORY BROWSER STATE
  // ==========================================
  const [historyEncounters, setHistoryEncounters] = useState<any[]>([]);
  const [historyLabOrders, setHistoryLabOrders] = useState<any[]>([]);
  const [historyPrescriptions, setHistoryPrescriptions] = useState<any[]>([]);
  const [historyProcedures, setHistoryProcedures] = useState<any[]>([]);
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([]);
  const [radiologyStudies, setRadiologyStudies] = useState<RadiologyStudy[]>([]);
  const [selectedDicomStudy, setSelectedDicomStudy] = useState<RadiologyStudy | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'NOTES' | 'VITALS' | 'LABS' | 'RX' | 'PROCEDURES' | 'CERTS' | 'BILLING' | 'RADIOLOGY'>('ALL');
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

  // DYNAMIC SERVICES CATALOG FROM DATABASE (Services Table)
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<{ [cat: string]: boolean }>({});

  // Fetch all active services from backend Services table
  useEffect(() => {
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const data = await api.get<any[]>('/services?limit=1500');
        if (Array.isArray(data) && data.length > 0) {
          const mapped: ServiceCatalogItem[] = data.map((s: any) => ({
            id: s.id || s.Id,
            code: s.code || s.Code || '',
            name: s.name || s.Name || 'Medical Service',
            category: s.category || s.Category || 'General',
            department: s.department || s.Department || '',
            price: parseFloat(s.price ?? s.Price ?? s.standardFee ?? s.StandardFee ?? 0) || 0,
            description: s.description || s.Description || ''
          }));
          setServicesCatalog(mapped);

          // By default expand common clinical procedure categories
          const initialExpanded: { [cat: string]: boolean } = {};
          const uniqueCats = Array.from(new Set(mapped.map(m => m.category)));
          uniqueCats.forEach((c, idx) => {
            const low = c.toLowerCase();
            initialExpanded[c] = idx === 0 || low.includes('proc') || low.includes('facial') || low.includes('consult');
          });
          setExpandedCategories(initialExpanded);
        }
      } catch (err) {
        console.warn('Failed to load services from Services table:', err);
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, []);

  // Group services by category, filtered by search query
  const groupedServices = React.useMemo(() => {
    const query = serviceSearchQuery.trim().toLowerCase();
    const groups: { [cat: string]: ServiceCatalogItem[] } = {};

    for (const svc of servicesCatalog) {
      if (query) {
        const matchesName = (svc.name || '').toLowerCase().includes(query);
        const matchesCode = (svc.code || '').toLowerCase().includes(query);
        const matchesCat = (svc.category || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesCat) continue;
      }
      const cat = svc.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(svc);
    }

    return groups;
  }, [servicesCatalog, serviceSearchQuery]);

  const getCategoryMeta = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('lab')) {
      return { icon: FlaskConical, color: '#0284c7', bg: '#eff6ff', border: '#bae6fd', badge: '#0284c7', type: 'LAB' as const };
    }
    if (c.includes('proc') || c.includes('surg') || c.includes('minor')) {
      return { icon: Scissors, color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', badge: '#7c3aed', type: 'PROCEDURE' as const };
    }
    if (c.includes('facial') || c.includes('aesthet') || c.includes('skin') || c.includes('laser')) {
      return { icon: Sparkles, color: '#d946ef', bg: '#fdf4ff', border: '#f5d0fe', badge: '#d946ef', type: 'PROCEDURE' as const };
    }
    if (c.includes('pharm') || c.includes('drug') || c.includes('med')) {
      return { icon: Pill, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', badge: '#059669', type: 'RX' as const };
    }
    if (c.includes('consult')) {
      return { icon: Stethoscope, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', badge: '#2563eb', type: 'PROCEDURE' as const };
    }
    return { icon: Activity, color: '#475569', bg: '#f8fafc', border: '#e2e8f0', badge: '#475569', type: 'PROCEDURE' as const };
  };

  const handleSelectService = (svc: ServiceCatalogItem) => {
    const meta = getCategoryMeta(svc.category);
    const item = {
      id: String(svc.id),
      code: svc.code,
      name: svc.name,
      category: svc.category,
      price: svc.price,
      specimen: 'Specimen / Blood',
      fasting: false,
      tat: 'Routine',
      subParams: [],
      defaultSite: 'Target Area',
      anesthesia: 'Local Anesthesia / As Required',
      notes: `Perform ${svc.name} as indicated.`,
      defaultDosage: '1 Unit',
      defaultRoute: 'Oral / Topical',
      defaultFreq: 'Once Daily (OD)',
      defaultDuration: '7 Days',
      defaultQty: 1,
      instructions: svc.description || 'Take as directed'
    };
    handleSelectCatalogItem(meta.type, item);
  };

  const toggleCheckService = (svc: ServiceCatalogItem) => {
    const meta = getCategoryMeta(svc.category);
    const item = {
      id: String(svc.id),
      code: svc.code,
      name: svc.name,
      category: svc.category,
      price: svc.price,
      specimen: 'Specimen / Blood',
      defaultSite: 'Target Area',
      anesthesia: 'Local Anesthesia',
      notes: `Perform ${svc.name} as indicated.`,
      defaultDosage: '1 Unit',
      defaultRoute: 'Oral',
      defaultFreq: 'Once Daily (OD)',
      defaultDuration: '7 Days',
      defaultQty: 1,
      instructions: svc.description || 'Take as directed'
    };
    toggleCheckItem(meta.type, item);
  };

  const handleToggleSelectCategory = (catName: string, itemsList: ServiceCatalogItem[]) => {
    const meta = getCategoryMeta(catName);
    const allChecked = itemsList.every(s => !!checkedCatalogItems[`${meta.type}:${s.id}`]);
    setCheckedCatalogItems(prev => {
      const next = { ...prev };
      if (allChecked) {
        itemsList.forEach(s => delete next[`${meta.type}:${s.id}`]);
      } else {
        itemsList.forEach(s => {
          next[`${meta.type}:${s.id}`] = {
            type: meta.type,
            item: {
              id: String(s.id),
              code: s.code,
              name: s.name,
              category: s.category,
              price: s.price,
              specimen: 'Specimen / Blood',
              defaultSite: 'Target Area',
              anesthesia: 'Local Anesthesia',
              notes: `Perform ${s.name} as indicated.`,
              defaultDosage: '1 Unit',
              defaultRoute: 'Oral',
              defaultFreq: 'OD',
              defaultQty: 1,
              instructions: s.description || 'Take as directed'
            }
          };
        });
      }
      return next;
    });
  };

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  const [medicationCatalogue, setMedicationCatalogue] = useState<MedicationItem[]>([
    { id: 'HYDRO', name: 'Hydrocortisone 1% Cream (15g Tube)', class: 'Topical Corticosteroid', defaultDosage: 'Apply thin layer', defaultRoute: 'Topical', defaultFreq: 'Twice Daily (BID)', defaultDuration: '7 Days', defaultDurationDays: 7, defaultQty: 1, unitPrice: 85.0, instructions: 'Apply to affected skin. Avoid eye area.' },
    { id: 'CLOTR', name: 'Clotrimazole 1% Topical Cream (20g)', class: 'Antifungal', defaultDosage: 'Apply thin layer', defaultRoute: 'Topical', defaultFreq: 'Twice Daily (BID)', defaultDuration: '14 Days', defaultDurationDays: 14, defaultQty: 1, unitPrice: 95.0, instructions: 'Continue 1 week after resolution of rash' },
    { id: 'CETIR', name: 'Cetirizine 10mg Tablet', class: 'Antihistamine', defaultDosage: '1 Tablet (10mg)', defaultRoute: 'Oral', defaultFreq: 'Once Daily at Bedtime (OD)', defaultDuration: '10 Days', defaultDurationDays: 10, defaultQty: 10, unitPrice: 6.0, instructions: 'Take at night with water' },
    { id: 'DOXY', name: 'Doxycycline 100mg Capsule', class: 'Tetracycline Antibiotic', defaultDosage: '1 Capsule (100mg)', defaultRoute: 'Oral', defaultFreq: 'Twice Daily (BID)', defaultDuration: '14 Days', defaultDurationDays: 14, defaultQty: 28, unitPrice: 12.0, instructions: 'Take with full glass of water. Avoid sun.' },
    { id: 'AMOX', name: 'Amoxicillin 500mg Capsule', class: 'Penicillin Antibiotic', defaultDosage: '1 Capsule (500mg)', defaultRoute: 'Oral', defaultFreq: 'Three Times Daily (TID)', defaultDuration: '7 Days', defaultDurationDays: 7, defaultQty: 21, unitPrice: 12.0, instructions: 'Complete full 7-day course. Take after meals.' },
    { id: 'PARA', name: 'Paracetamol 500mg Tablet', class: 'Analgesic / Antipyretic', defaultDosage: '1-2 Tablets (500-1000mg)', defaultRoute: 'Oral', defaultFreq: 'Three Times Daily (TID) PRN', defaultDuration: '5 Days', defaultDurationDays: 5, defaultQty: 20, unitPrice: 4.0, instructions: 'Take as needed for pain or fever. Max 4g daily.' }
  ]);

  // Load Real Pharmacy Formulary Drugs from Database
  useEffect(() => {
    const fetchFormulary = async () => {
      try {
        const drugs = await api.get<any[]>('/pharmacy/formulary');
        if (drugs && Array.isArray(drugs) && drugs.length > 0) {
          const mapped: MedicationItem[] = drugs.map((d: any) => {
            const formName = d.form || d.dosageForm || d.Form || 'Tablet';
            const strengthVal = d.strength || d.Strength || '';
            const drugName = d.brandName || d.genericName || d.BrandName || d.GenericName || 'Medication';
            const isTopical = formName.toLowerCase().includes('cream') || formName.toLowerCase().includes('ointment') || formName.toLowerCase().includes('gel');
            const isInjectable = formName.toLowerCase().includes('inj') || formName.toLowerCase().includes('amp');
            const isSuspension = formName.toLowerCase().includes('susp') || formName.toLowerCase().includes('syrup');
            const route = isTopical ? 'Topical' : isInjectable ? 'IV/IM' : 'Oral';
            const price = parseFloat(d.sellingPrice || d.SellingPrice || d.unitPrice || d.UnitPrice) || 15.0;
            const stock = d.stockQuantity ?? d.currentStock ?? d.StockQuantity ?? 0;

            return {
              id: String(d.id || d.Id),
              name: `${drugName} ${strengthVal} (${formName})`.trim(),
              class: d.drugClass || d.DrugClass || (d.isControlled ? 'Controlled Drug' : 'General Prescription'),
              defaultDosage: isTopical ? 'Apply thin layer' : isSuspension ? '5ml' : `1 ${formName} (${strengthVal})`.trim(),
              defaultRoute: route,
              defaultFreq: isTopical ? 'Twice Daily (BID)' : 'Three Times Daily (TID)',
              defaultDuration: '7 Days',
              defaultDurationDays: 7,
              defaultQty: isTopical ? 1 : 10,
              unitPrice: price,
              instructions: `In Stock: ${stock} units · Batch: ${d.batchNumber || 'Standard'}`
            };
          });
          setMedicationCatalogue(mapped);
        }
      } catch (err) {
        console.warn('Using default formulary catalog:', err);
      }
    };
    fetchFormulary();
  }, []);

  const changeDateByDays = (days: number) => {
    const current = new Date(consultDate);
    current.setDate(current.getDate() + days);
    setConsultDate(current.toISOString().split('T')[0]);
  };

  // Load patients assigned to the logged-in doctor on the selected date (defaults to today)
  useEffect(() => {
    const loadEmrPatients = async () => {
      // Guard: do not query if selectedDoctorId is not yet resolved!
      if (!selectedDoctorId || selectedDoctorId <= 0) {
        setPatients([]);
        setActivePatient(null);
        setPatientPaymentMap({});
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch assignments for this doctor on the selected date + date-scoped invoices for payment badge
        const [assigned, allInvoices] = await Promise.all([
          api.get<any[]>(`/triage/doctor/${selectedDoctorId}`, { date: consultDate }).catch(() => []),
          api.get<any[]>('/billing/invoices', { date: consultDate, limit: 100 }).catch(() => [])
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

          // Build payment map: patientId -> true if the patient has a PAID invoice on consultDate
          // Color reflects the consultation payment for that specific date
          const payMap: Record<number, boolean> = {};
          if (allInvoices && Array.isArray(allInvoices)) {
            allInvoices.forEach((inv: any) => {
              const pid = Number(inv.patientId || inv.PatientId);
              const invDate = (inv.issueDate || inv.IssueDate || inv.createdAt || inv.CreatedAt || '').split('T')[0];
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
      const [encs, labRes, rxs, invs, certs, procs, results, vitalsRes, radRes] = await Promise.all([
        api.get<any[]>(`/encounters/patient/${patId}`).catch(() => []),
        api.get<any[]>(`/laboratory/patient/${patId}`).catch(() => []),
        api.get<any[]>(`/pharmacy/prescriptions?patientId=${patId}&limit=100`).catch(() => []),
        api.get<any[]>(`/billing/invoices?patientId=${patId}&limit=100`).catch(() => []),
        api.get<any[]>(`/medicalcertificates/patient/${patId}`).catch(() => []),
        api.get<any[]>(`/procedures/patient/${patId}`).catch(() => []),
        api.get<any[]>(`/laboratory/patient/${patId}/results`).catch(() => []),
        api.get<any[]>(`/triage/patient/${patId}/history`).catch(() => []),
        api.get<any[]>(`/radiology/patient/${patId}`).catch(() => [])
      ]);

      setHistoryEncounters(encs || []);
      setHistoryProcedures(procs || []);

      const rawLabs = Array.isArray(labRes) ? labRes : [];
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

      setHistoryPrescriptions(rxs || []);
      setHistoryInvoices(invs || []);

      const radStudies = Array.isArray(radRes) ? radRes : ((radRes as any)?.data || []);
      setRadiologyStudies(radStudies);

      const mappedResults = (results || []).map((r: any) => ({
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
      setPatientLabResults(mappedResults);
      setVitalsHistory(vitalsRes || []);
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

  const executeAddMedicationDirect = (item: any) => {
    setMedications(prev => [...prev, item]);
  };

  const handleConfirmCdsOverride = () => {
    if (!pendingCandidateItem) return;
    if (pendingCandidateItem.source === 'quick') {
      executeAddMedicationDirect(pendingCandidateItem.data);
    } else if (pendingCandidateItem.source === 'basket') {
      setOrderBasket(prev => [...prev, pendingCandidateItem.data]);
    }
    setCdsAlerts([]);
    setPendingCandidateItem(null);
    setOverrideReason('');
  };

  const handleAddMedication = () => {
    if (!newDrugName) return;
    const newItem = {
      drugName: newDrugName,
      dosage: newDosage,
      qty: newQty,
      frequency: newFreq,
      duration: newDuration
    };

    // Evaluate Clinical Decision Support (CDS) Allergies & Interactions
    const existingRxNames = [
      ...medications.map(m => m.drugName),
      ...orderBasket.filter(b => b.type === 'RX').map(b => b.title),
      ...historyPrescriptions.map(p => p.drugName || p.DrugName || '')
    ];
    const alerts = evaluateCdsAlerts(activePatient?.allergies, existingRxNames, newDrugName);

    if (alerts.length > 0) {
      setCdsAlerts(alerts);
      setPendingCandidateItem({ source: 'quick', data: newItem });
      return;
    }

    executeAddMedicationDirect(newItem);
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

      const existingRxNames = [
        ...medications.map(m => m.drugName),
        ...orderBasket.filter(b => b.type === 'RX').map(b => b.title),
        ...historyPrescriptions.map(p => p.drugName || p.DrugName || '')
      ];
      const alerts = evaluateCdsAlerts(activePatient?.allergies, existingRxNames, item.name);
      if (alerts.length > 0) {
        setCdsAlerts(alerts);
        setPendingCandidateItem({ source: 'basket', data: newBasketItem });
        return;
      }
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
      // Rule: Anything other than consultation, laboratory, prescription and medical certificate orders should be treated as procedures
      const procItems = currentBasket.filter(x => 
        x.type !== 'LAB' && 
        x.type !== 'RX' && 
        x.type !== 'CERT' && 
        (x.type as string) !== 'CONSULTATION'
      );
      if (procItems.length > 0) {
        for (const p of procItems) {
          try {
            await api.post('/procedures', {
              tenantId: 1,
              encounterId: null,
              patientId: patId,
              orderedBy: selectedDoctorId || 1,
              procedureName: p.title,
              procedureCode: p.code,
              clinicalNotes: p.paramsSummary || 'Clinical procedure order'
            });
          } catch (pErr) {
            console.warn('Procedure order error:', pErr);
          }
        }
        setHistoryProcedures(prev => [
          ...procItems.map((p, idx) => ({
            id: Date.now() + idx,
            procedureCode: p.code,
            procedureName: p.title,
            clinicalNotes: p.paramsSummary || 'Clinical procedure order',
            statusName: 'Ordered',
            createdAt: new Date().toISOString()
          })),
          ...prev
        ]);
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
        itemType: item.type === 'LAB' ? 'Laboratory' : (item.type === 'RX' ? 'Pharmacy' : ((item.type as string) === 'CONSULTATION' ? 'Consultation' : 'Procedure')),
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
        <div style={{ display: 'grid', gridTemplateColumns: (!isMobile) ? '290px 1fr' : '1fr', gap: '18px' }}>
          
          {/* LEFT: DOCTOR'S ASSIGNED PATIENT QUEUE WITH DATE SELECTOR */}
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: (isMobile && !showMobileQueue) ? 'auto' : '82vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Doctor Consultation Queue
              </div>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setShowMobileQueue(!showMobileQueue)}
                  className="btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                >
                  {showMobileQueue ? 'Hide Queue' : `View Queue (${patients.length})`}
                </button>
              )}
            </div>

            {(!isMobile || showMobileQueue) && (
              <>
                {/* Attending Doctor Badge / Status (Dropdown removed per user request) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attending Doctor:</span>
                    <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700 }}>{patients.length} Patient{patients.length === 1 ? '' : 's'}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                    {(() => {
                      const doc = availableDoctors.find(d => d.id === selectedDoctorId);
                      if (doc) return doc.name;
                      if (currentUser?.firstName) return `Dr. ${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
                      if (currentUser?.name) return currentUser.name.startsWith('Dr.') ? currentUser.name : `Dr. ${currentUser.name}`;
                      if (currentUser?.username && currentUser.username.toLowerCase() !== 'admin') return `Dr. ${currentUser.username}`;
                      return availableDoctors[0]?.name || 'Attending Physician';
                    })()}
                    {availableDoctors.find(d => d.id === selectedDoctorId)?.specialization && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        ({availableDoctors.find(d => d.id === selectedDoctorId)?.specialization})
                      </span>
                    )}
                  </div>
                </div>

                {/* Consultation Date Selector (for note entry, not for patient filter) */}
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
                          onClick={() => {
                            setActivePatient(p);
                            if (isMobile) setShowMobileQueue(false);
                          }}
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
              </>
            )}

            {isMobile && !showMobileQueue && activePatient && (
              <div style={{ padding: '10px 12px', background: '#e0f2fe', borderRadius: '8px', border: '1.5px solid #0284c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.85rem' }}>Active: {activePatient.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{activePatient.mrn} • {activePatient.age}y {activePatient.gender}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileQueue(true)}
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                >
                  Switch Patient
                </button>
              </div>
            )}
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

                  {/* FIELD 4: DIAGNOSIS & ICD-10 AUTOCOMPLETE */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          ICD-10 Code
                        </label>
                        <input
                          type="text"
                          value={icdCode}
                          onChange={e => {
                            if (!isEditingClosed) {
                              setIcdCode(e.target.value);
                              const hits = searchIcd10(e.target.value);
                              setIcdSearchResults(hits);
                              setShowIcdDropdown(hits.length > 0);
                            }
                          }}
                          readOnly={isEditingClosed}
                          placeholder="e.g. L20.9"
                          style={{ fontFamily: 'monospace', fontWeight: 700, ...(isEditingClosed ? readOnlyStyle : {}) }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          4. Diagnosis (Clinical Assessment)
                        </label>
                        <input
                          type="text"
                          value={diagnosis}
                          onChange={e => {
                            if (!isEditingClosed) {
                              setDiagnosis(e.target.value);
                              setCertDiagnosis(e.target.value);
                              const hits = searchIcd10(e.target.value);
                              setIcdSearchResults(hits);
                              setShowIcdDropdown(hits.length > 0);
                            }
                          }}
                          onFocus={() => {
                            if (!isEditingClosed) {
                              const hits = searchIcd10(diagnosis || icdCode);
                              setIcdSearchResults(hits);
                              setShowIcdDropdown(true);
                            }
                          }}
                          readOnly={isEditingClosed}
                          placeholder="Search ICD-10 diagnosis (e.g., Atopic dermatitis, Eczema, Acne, Tinea...)"
                          required
                          style={isEditingClosed ? readOnlyStyle : {}}
                        />
                      </div>
                      {!isEditingClosed && (
                        <button
                          type="button"
                          onClick={() => {
                            const hits = searchIcd10('');
                            setIcdSearchResults(hits);
                            setShowIcdDropdown(!showIcdDropdown);
                          }}
                          className="btn-secondary"
                          style={{ padding: '8px 12px', fontSize: '0.75rem', height: '36px' }}
                          title="Browse ICD-10 Catalog"
                        >
                          <Search size={14} /> ICD-10
                        </button>
                      )}
                    </div>

                    {/* ICD-10 Search Popover Dropdown */}
                    {showIcdDropdown && !isEditingClosed && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 200,
                          marginTop: '4px',
                          background: '#ffffff',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                          border: '1.5px solid #0284c7',
                          maxHeight: '260px',
                          overflowY: 'auto'
                        }}
                      >
                        <div style={{ padding: '8px 12px', background: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1' }}>
                            ICD-10 Clinical Diagnostic Catalog ({icdSearchResults.length} matches)
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowIcdDropdown(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        {icdSearchResults.length === 0 ? (
                          <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '0.78rem' }}>
                            No matching ICD-10 codes found.
                          </div>
                        ) : (
                          icdSearchResults.map(item => (
                            <div
                              key={item.code}
                              onClick={() => {
                                setIcdCode(item.code);
                                setDiagnosis(`${item.description} [${item.code}]`);
                                setCertDiagnosis(item.description);
                                setShowIcdDropdown(false);
                              }}
                              style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.78rem',
                                transition: 'background 0.1s'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div>
                                <span style={{ fontWeight: 800, color: '#0284c7', fontFamily: 'monospace', marginRight: '8px' }}>
                                  {item.code}
                                </span>
                                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                  {item.description}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                {item.isChronic && (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: '#fef3c7', color: '#b45309' }}>
                                    Chronic
                                  </span>
                                )}
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                  {item.chapter}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* FIELD 5: PLAN */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 700 }}>
                        5. Plan &amp; Treatment Instructions
                      </label>
                      {!isEditingClosed && (
                        <button
                          type="button"
                          onClick={() => setShowFollowUpModal(true)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Calendar size={13} color="#0284c7" /> Schedule Follow-up Visit
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={plan}
                      onChange={e => !isEditingClosed && setPlan(e.target.value)}
                      readOnly={isEditingClosed}
                      placeholder="Enter clinical treatment instructions, ordered investigations, patient education, follow-up date..."
                      style={isEditingClosed ? readOnlyStyle : {}}
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
                            {/* Logo left + Bilingual Header centered */}
                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '20px', borderBottom: '1.5px solid #f0eae1', paddingBottom: '16px', gap: '16px' }}>
                              {/* Left: Logo */}
                              <div style={{ width: '130px', flexShrink: 0 }}>
                                <img src="/huderma_logo.png" alt="Huderma" style={{ width: '100%', maxHeight: '60px', objectFit: 'contain' }} />
                                <div style={{ fontSize: '0.6rem', color: '#c89345', fontWeight: 700, letterSpacing: '0.15em', marginTop: '2px', textAlign: 'center' }}>
                                  LOVE YOUR SKIN
                                </div>
                              </div>

                              {/* Center: Clinic Details */}
                              <div style={{ flex: 1, textAlign: 'center', paddingRight: '130px' }}>
                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#c89345' }}>Huderma Dermatology Specialty Clinic</div>
                                <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#c89345', marginBottom: '4px' }}>ሁደርማ የቆዳ ልዩ ክሊኒክ</div>
                                <div style={{ fontSize: '0.72rem', color: '#44403c', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  <span>Kirkos Sub City, Woreda 01, H. No. 062</span>
                                  <span>•</span>
                                  <span>Tel: +251 949 74 44 44 / +251 949 54 44 44</span>
                                  <span>•</span>
                                  <span>hudermacare@gmail.com</span>
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
                { key: 'VITALS', label: `Vitals & Chronic Trends (${vitalsHistory.length})` },
                { key: 'LABS', label: `Lab Orders (${historyLabOrders.length})` },
                { key: 'PROCEDURES', label: `Procedures (${historyProcedures.length})` },
                { key: 'RX', label: `Prescriptions (${historyPrescriptions.length})` },
                { key: 'CERTS', label: `Certificates (${issuedCerts.length})` },
                { key: 'BILLING', label: `Invoices (${historyInvoices.length})` },
                { key: 'RADIOLOGY', label: `Radiology & PACS (${radiologyStudies.length})` }
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

              {/* VITALS LONGITUDINAL TRENDS & CHRONIC CARE GRAPH */}
              {(historyFilter === 'ALL' || historyFilter === 'VITALS') && (
                <div style={{ padding: '16px 18px', borderRadius: '8px', background: '#f8fafc', border: '1.5px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={18} color="#0284c7" />
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Longitudinal Vitals & Chronic Disease Trajectory</strong>
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{vitalsHistory.length} Recorded Visits</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', fontWeight: 600 }}>
                      <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>● Systolic BP (mmHg)</span>
                      <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>● Diastolic BP (mmHg)</span>
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>● Heart Rate (bpm)</span>
                      <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>● Blood Glucose (mg/dL)</span>
                    </div>
                  </div>

                  {vitalsHistory.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                      No longitudinal triage vitals recorded for this patient yet.
                    </div>
                  ) : (
                    <div>
                      {/* SVG Trend Graph */}
                      <div style={{ background: '#ffffff', borderRadius: '6px', padding: '14px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                        <svg viewBox="0 0 700 160" style={{ width: '100%', height: '160px', overflow: 'visible' }}>
                          {/* Grid lines & Normal Thresholds */}
                          <line x1="40" y1="20" x2="680" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                          <line x1="40" y1="50" x2="680" y2="50" stroke="#fecaca" strokeWidth="1" strokeDasharray="3,3" />
                          <text x="682" y="53" fontSize="9" fill="#ef4444">140 (HTN Stage 1)</text>
                          <line x1="40" y1="75" x2="680" y2="75" stroke="#bbf7d0" strokeWidth="1" strokeDasharray="3,3" />
                          <text x="682" y="78" fontSize="9" fill="#16a34a">120 (Normal BP)</text>
                          <line x1="40" y1="110" x2="680" y2="110" stroke="#bfdbfe" strokeWidth="1" strokeDasharray="3,3" />
                          <text x="682" y="113" fontSize="9" fill="#3b82f6">80 (Normal Dia)</text>
                          <line x1="40" y1="140" x2="680" y2="140" stroke="#f1f5f9" strokeWidth="1" />

                          {(() => {
                            const pts = vitalsHistory.slice(-8); // Show up to last 8 visits
                            const count = pts.length;
                            const stepX = count > 1 ? (620 / (count - 1)) : 310;

                            const getCoords = (val: number | null | undefined, minV = 40, maxV = 180) => {
                              if (val == null) return null;
                              const clamped = Math.max(minV, Math.min(maxV, val));
                              const norm = (clamped - minV) / (maxV - minV);
                              return 140 - norm * 120;
                            };

                            const sysPoints: { x: number; y: number; val: number; date: string }[] = [];
                            const diaPoints: { x: number; y: number; val: number }[] = [];
                            const hrPoints: { x: number; y: number; val: number }[] = [];
                            const gluPoints: { x: number; y: number; val: number }[] = [];

                            pts.forEach((p, idx) => {
                              const x = 50 + idx * stepX;
                              const dStr = p.triagedAt ? String(p.triagedAt).split('T')[0] : `V${idx + 1}`;
                              if (p.systolicBP) {
                                const y = getCoords(p.systolicBP);
                                if (y != null) sysPoints.push({ x, y, val: p.systolicBP, date: dStr });
                              }
                              if (p.diastolicBP) {
                                const y = getCoords(p.diastolicBP);
                                if (y != null) diaPoints.push({ x, y, val: p.diastolicBP });
                              }
                              if (p.heartRate) {
                                const y = getCoords(p.heartRate);
                                if (y != null) hrPoints.push({ x, y, val: p.heartRate });
                              }
                              if (p.bloodGlucose) {
                                const y = getCoords(p.bloodGlucose, 40, 250);
                                if (y != null) gluPoints.push({ x, y, val: p.bloodGlucose });
                              }
                            });

                            return (
                              <>
                                {/* Polyline Systolic */}
                                {sysPoints.length > 1 && (
                                  <polyline
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="2.5"
                                    points={sysPoints.map(p => `${p.x},${p.y}`).join(' ')}
                                  />
                                )}
                                {/* Polyline Diastolic */}
                                {diaPoints.length > 1 && (
                                  <polyline
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth="2"
                                    points={diaPoints.map(p => `${p.x},${p.y}`).join(' ')}
                                  />
                                )}
                                {/* Polyline HR */}
                                {hrPoints.length > 1 && (
                                  <polyline
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2"
                                    strokeDasharray="4,2"
                                    points={hrPoints.map(p => `${p.x},${p.y}`).join(' ')}
                                  />
                                )}
                                {/* Polyline Glucose */}
                                {gluPoints.length > 1 && (
                                  <polyline
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="2"
                                    points={gluPoints.map(p => `${p.x},${p.y}`).join(' ')}
                                  />
                                )}

                                {/* Data Dots & Labels */}
                                {sysPoints.map((pt, i) => (
                                  <g key={`sys-${i}`}>
                                    <circle cx={pt.x} cy={pt.y} r="4" fill="#ef4444" />
                                    <text x={pt.x} y={pt.y - 7} fontSize="10" fontWeight="bold" fill="#ef4444" textAnchor="middle">{pt.val}</text>
                                    <text x={pt.x} y="155" fontSize="9" fill="#64748b" textAnchor="middle">{pt.date}</text>
                                  </g>
                                ))}

                                {diaPoints.map((pt, i) => (
                                  <g key={`dia-${i}`}>
                                    <circle cx={pt.x} cy={pt.y} r="3.5" fill="#3b82f6" />
                                    <text x={pt.x} y={pt.y + 12} fontSize="9" fill="#3b82f6" textAnchor="middle">{pt.val}</text>
                                  </g>
                                ))}

                                {gluPoints.map((pt, i) => (
                                  <g key={`glu-${i}`}>
                                    <circle cx={pt.x} cy={pt.y} r="3" fill="#f59e0b" />
                                  </g>
                                ))}
                              </>
                            );
                          })()}
                        </svg>
                      </div>

                      {/* Longitudinal Vitals Visit Table */}
                      <table className="cms-table" style={{ fontSize: '0.75rem' }}>
                        <thead>
                          <tr>
                            <th>Encounter Date</th>
                            <th>BP (mmHg)</th>
                            <th>HR (bpm)</th>
                            <th>Temp (°C)</th>
                            <th>SpO2</th>
                            <th>Weight / BMI</th>
                            <th>Blood Glucose</th>
                            <th>Triage Acuity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vitalsHistory.map((vh, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{vh.triagedAt ? String(vh.triagedAt).split('T')[0] : 'Encounter'}</td>
                              <td style={{ fontWeight: 700, color: (vh.systolicBP || 0) >= 140 ? '#ef4444' : '#0369a1' }}>
                                {vh.systolicBP || '—'}/{vh.diastolicBP || '—'}
                              </td>
                              <td>{vh.heartRate || '—'} bpm</td>
                              <td>{vh.temperature || '—'} °C</td>
                              <td>{vh.oxygenSaturation ? `${vh.oxygenSaturation}%` : '—'}</td>
                              <td>{vh.weightKg ? `${vh.weightKg} kg (${vh.bmi || '—'})` : '—'}</td>
                              <td style={{ fontWeight: 600, color: (vh.bloodGlucose || 0) > 126 ? '#f59e0b' : 'inherit' }}>
                                {vh.bloodGlucose ? `${vh.bloodGlucose} mg/dL` : '—'}
                              </td>
                              <td>
                                <span className={`badge badge-${(vh.triageCategory || 'Yellow').toLowerCase()}`}>
                                  {vh.triageCategory || 'Routine'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

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

              {/* Lab Orders with Results Table */}
              {(historyFilter === 'ALL' || historyFilter === 'LABS') && historyLabOrders.map((lab, idx) => {
                // Match results from patientLabResults that belong to this order
                const orderResults = patientLabResults.filter(r =>
                  r.orderNumber === lab.orderNumber ||
                  String(r.orderNumber) === String(lab.orderNumber)
                );
                return (
                  <div key={`lab-${idx}`} style={{ borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', overflow: 'hidden' }}>
                    {/* Order Header */}
                    <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-normal" style={{ fontSize: '0.68rem' }}>Laboratory Order #{lab.orderNumber || lab.id}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{lab.clinicalInfo || 'Diagnostic Lab Order'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px',
                          background: lab.statusName === 'Completed' || lab.statusName === 'Verified' ? '#dcfce7' : '#fef3c7',
                          color: lab.statusName === 'Completed' || lab.statusName === 'Verified' ? '#166534' : '#92400e',
                          fontWeight: 700 }}>
                          {lab.statusName || 'Processing'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {lab.orderDate ? String(lab.orderDate).split('T')[0] : 'Ordered'}
                        </span>
                      </div>
                    </div>
                    {/* Results Table */}
                    {orderResults.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: '#dcfce7' }}>
                              <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 700, color: '#166534', borderBottom: '1px solid #bbf7d0' }}>Test Name</th>
                              <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: '#166534', borderBottom: '1px solid #bbf7d0' }}>Result</th>
                              <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: '#166534', borderBottom: '1px solid #bbf7d0' }}>Unit</th>
                              <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: '#166534', borderBottom: '1px solid #bbf7d0' }}>Reference Range</th>
                              <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: '#166534', borderBottom: '1px solid #bbf7d0' }}>Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderResults.map((r, ri) => {
                              const flagColor = r.flag === 'H' || r.flag === 'HH' ? '#dc2626' :
                                               r.flag === 'L' || r.flag === 'LL' ? '#2563eb' : '#059669';
                              const rowBg = r.isCritical ? '#fef2f2' : (ri % 2 === 0 ? '#f0fdf4' : '#ffffff');
                              return (
                                <tr key={ri} style={{ background: rowBg }}>
                                  <td style={{ padding: '6px 12px', fontWeight: 600, borderBottom: '1px solid #e2f5e8' }}>
                                    {r.testName}
                                    {r.isCritical && <span style={{ marginLeft: '6px', fontSize: '0.65rem', padding: '1px 4px', background: '#fee2e2', color: '#991b1b', borderRadius: '3px', fontWeight: 700 }}>CRITICAL</span>}
                                    {r.isVerified && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#059669' }}>✓</span>}
                                  </td>
                                  <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: r.flag ? flagColor : 'var(--text-main)', borderBottom: '1px solid #e2f5e8' }}>
                                    {r.numericValue || '—'}
                                  </td>
                                  <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-muted)', borderBottom: '1px solid #e2f5e8' }}>
                                    {r.unit || '—'}
                                  </td>
                                  <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-muted)', borderBottom: '1px solid #e2f5e8' }}>
                                    {r.referenceRange || '—'}
                                  </td>
                                  <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid #e2f5e8' }}>
                                    {r.flag ? (
                                      <span style={{ padding: '2px 7px', borderRadius: '4px', background: r.flag === 'H' || r.flag === 'HH' ? '#fee2e2' : r.flag === 'L' || r.flag === 'LL' ? '#dbeafe' : '#dcfce7', color: flagColor, fontWeight: 700, fontSize: '0.72rem' }}>
                                        {r.flag}
                                      </span>
                                    ) : <span style={{ color: '#059669', fontSize: '0.72rem' }}>Normal</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '10px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No results entered yet for this order.
                      </div>
                    )}
                  </div>
                );
              })}

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

              {/* Procedures */}
              {(historyFilter === 'ALL' || historyFilter === 'PROCEDURES') && historyProcedures.map((proc: any, idx: number) => {
                const procDate = proc.createdAt ? new Date(proc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                const statusColor = proc.statusName === 'Completed' ? '#059669' : proc.statusName === 'Cancelled' ? '#dc2626' : '#0284c7';
                return (
                  <div key={`proc-${idx}`} style={{ padding: '14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="badge" style={{ fontSize: '0.68rem', background: '#6d28d9', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                        Procedure • {proc.procedureCode || proc.ProcedureCode || ''}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{procDate}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                      {proc.procedureName || proc.ProcedureName || 'Clinical Procedure'}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: statusColor }}>
                        ● {proc.statusName || proc.StatusName || 'Ordered'}
                      </span>
                      {(proc.clinicalNotes || proc.ClinicalNotes) && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Note: {proc.clinicalNotes || proc.ClinicalNotes}
                        </span>
                      )}
                      {(proc.procedureResult || proc.ProcedureResult) && (
                        <span style={{ fontSize: '0.72rem', color: '#0369a1' }}>
                          Result: {proc.procedureResult || proc.ProcedureResult}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

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

              {/* Radiology & PACS DICOM Studies */}
              {(historyFilter === 'ALL' || historyFilter === 'RADIOLOGY') && radiologyStudies.map((study, idx) => (
                <div key={`rad-${idx}`} style={{ padding: '16px', borderRadius: '8px', background: '#f8fafc', border: '1.5px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem', fontWeight: 800 }}>{study.modalityCode || 'CR'}</span>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{study.studyType} — {study.bodyPart}</strong>
                    </div>
                    <button
                      onClick={() => setSelectedDicomStudy(study)}
                      className="btn-primary"
                      style={{ padding: '5px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Eye size={13} /> Launch DICOM PACS Viewer
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                    <strong>Indication:</strong> {study.clinicalIndication || 'Routine radiographic evaluation.'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#0369a1', background: '#f0f9ff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                    <strong>Impression:</strong> {study.impression || 'Clear study. No acute abnormality detected.'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DICOM PACS Viewer Modal */}
      {selectedDicomStudy && (
        <RadiologyViewerModal
          study={selectedDicomStudy}
          onClose={() => setSelectedDicomStudy(null)}
        />
      )}


      {/* ========================================================================= */}
      {/* 4. RESULTS TAB (Lab Results, chronological)                               */}
      {/* ========================================================================= */}
      {activeSubTab === 'results' && (
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FlaskConical size={16} color="#0284c7" /> Lab &amp; Procedure Results
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Patient: {activePatient?.name} — {activePatient?.mrn} | Chronological (newest first)
              </span>
            </div>
            <button onClick={loadPatientResults} className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.75rem' }}>
              <FlaskConical size={13} /> Refresh Results
            </button>
          </div>

          {loadingResults ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              Loading results...
            </div>
          ) : patientLabResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <FlaskConical size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <div style={{ fontWeight: 600 }}>No laboratory results found for {activePatient?.name}</div>
              <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Results will appear here once lab tests are completed and verified.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {patientLabResults.map((r, idx) => {
                const flagColor = r.flag === 'H' || r.flag === 'HH' ? '#dc2626' :
                                  r.flag === 'L' || r.flag === 'LL' ? '#2563eb' : '#059669';
                const entryDate = r.enteredAt ? new Date(r.enteredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                const entryTime = r.enteredAt ? new Date(r.enteredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: r.isCritical ? '#fef2f2' : '#fdfcf9',
                      border: `1px solid ${r.isCritical ? '#fca5a5' : 'var(--border-color)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>{r.testName}</span>
                        {r.isCritical && <span className="badge badge-critical" style={{ fontSize: '0.62rem' }}>⚠ CRITICAL</span>}
                        {r.isVerified && <span className="badge badge-normal" style={{ fontSize: '0.62rem' }}>✓ Verified</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {r.orderNumber} • {entryDate} {entryTime}
                      </div>
                      {r.referenceRange && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Ref: {r.referenceRange}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '80px' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: r.flag ? flagColor : 'var(--text-main)' }}>
                        {r.numericValue} {r.unit}
                      </div>
                      {r.flag && (
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: flagColor }}>
                          {r.flag === 'H' ? '↑ HIGH' : r.flag === 'HH' ? '↑↑ CRITICAL HIGH' : r.flag === 'L' ? '↓ LOW' : r.flag === 'LL' ? '↓↓ CRITICAL LOW' : r.flag}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ORDER MODAL (Including Medical Certificate Node)                          */}
      {/* ========================================================================= */}
      {showOrderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ width: '1060px', height: '88vh', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', border: '1px solid #e2e8f0' }}>

            {/* HEADER */}
            <div style={{ flexShrink: 0, padding: '14px 20px', background: 'linear-gradient(135deg,#0369a1,#0284c7)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Clinical Order Hub — {activePatient?.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)' }}>Card: {activePatient?.mrn} · Select items, configure, then Submit &amp; Bill</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {orderBasket.length > 0 && (
                  <span style={{ padding: '3px 10px', borderRadius: '20px', background: '#f59e0b', color: '#fff', fontSize: '0.72rem', fontWeight: 800 }}>
                    {orderBasket.length} in basket
                  </span>
                )}
                <button onClick={() => setShowOrderModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={18} color="#fff" />
                </button>
              </div>
            </div>

            {/* BODY */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

              {/* LEFT: Catalog */}
              <div style={{ width: '380px', flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, height: '100%' }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Service Catalog</span>
                  <input
                    value={serviceSearchQuery}
                    onChange={e => setServiceSearchQuery(e.target.value)}
                    placeholder="Search services…"
                    style={{ padding: '5px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 400, color: '#1e293b', background: '#fff', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: '1 1 0%', overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>

                  {/* Loading spinner */}
                  {loadingServices && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '8px', color: '#64748b', fontSize: '0.78rem' }}>
                      <div style={{ width: '16px', height: '16px', border: '2px solid #cbd5e1', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Loading services…
                    </div>
                  )}

                  {/* Dynamic grouped services from Services table */}
                  {!loadingServices && Object.entries(groupedServices).map(([catName, items]) => {
                    const meta = getCategoryMeta(catName);
                    const IconComp = meta.icon;
                    const isExpanded = !!expandedCategories[catName];
                    const checkedCount = items.filter(s => !!checkedCatalogItems[`${meta.type}:${s.id}`]).length;
                    const allChecked = items.length > 0 && checkedCount === items.length;
                    return (
                      <div key={catName} style={{ borderRadius: '8px', background: '#fff', border: `1px solid ${meta.border}`, overflow: 'hidden' }}>
                        <button
                          onClick={() => toggleCategoryExpand(catName)}
                          style={{ width: '100%', padding: '10px 12px', background: isExpanded ? meta.bg : '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: meta.color, fontWeight: 700, fontSize: '0.8rem' }}>
                            <IconComp size={14} color={meta.color} />
                            {catName} ({items.length})
                            {checkedCount > 0 && (
                              <span style={{ background: meta.badge, color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700 }}>
                                {checkedCount} ✓
                              </span>
                            )}
                          </div>
                          {isExpanded ? <ChevronDown size={13} color="#64748b" /> : <ChevronRight size={13} color="#64748b" />}
                        </button>
                        {isExpanded && (
                          <div style={{ borderTop: `1px solid ${meta.border}`, maxHeight: '260px', overflowY: 'auto' }}>
                            <div style={{ padding: '3px 10px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1 }}>
                              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>✓ check to multi-select</span>
                              <button type="button" onClick={() => handleToggleSelectCategory(catName, items)} style={{ background: 'none', border: 'none', color: meta.color, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                                {allChecked ? 'Deselect All' : 'Select All'}
                              </button>
                            </div>
                            {items.map(svc => {
                              const isChecked = !!checkedCatalogItems[`${meta.type}:${svc.id}`];
                              const isSelected = selectedOrderItem?.item?.id === String(svc.id);
                              return (
                                <div
                                  key={svc.id}
                                  onClick={() => handleSelectService(svc)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: isSelected ? meta.bg : isChecked ? meta.bg + 'aa' : '#fff', borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => { e.stopPropagation(); toggleCheckService(svc); }}
                                    style={{ flexShrink: 0, width: '14px', height: '14px', cursor: 'pointer' }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.77rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.name}</div>
                                    <div style={{ fontSize: '0.63rem', color: '#94a3b8' }}>{svc.code} · Br {svc.price.toFixed(2)}</div>
                                  </div>
                                  {isSelected && <ChevronRight size={12} color={meta.color} />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Prescriptions */}
                  <div style={{ borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <button onClick={() => toggleNode('rx')} style={{ width: '100%', padding: '10px 12px', background: expandedNodes.rx ? '#f0fdf4' : '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#059669', fontWeight: 700, fontSize: '0.8rem' }}>
                        <Pill size={14} color="#059669" />
                        Prescriptions / E-Rx ({medicationCatalogue.length})
                        {Object.keys(checkedCatalogItems).filter(k => k.startsWith('RX:')).length > 0 && (
                          <span style={{ background: '#059669', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '0.62rem', fontWeight: 700 }}>
                            {Object.keys(checkedCatalogItems).filter(k => k.startsWith('RX:')).length} ✓
                          </span>
                        )}
                      </div>
                      {expandedNodes.rx ? <ChevronDown size={13} color="#64748b" /> : <ChevronRight size={13} color="#64748b" />}
                    </button>
                    {expandedNodes.rx && (
                      <div style={{ borderTop: '1px solid #e2e8f0', maxHeight: '260px', overflowY: 'auto' }}>
                        <div style={{ padding: '3px 10px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1 }}>
                          <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>✓ check to multi-select</span>
                          <button type="button" onClick={() => handleToggleSelectAll('RX', medicationCatalogue)} style={{ background: 'none', border: 'none', color: '#059669', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                            {medicationCatalogue.every(m => !!checkedCatalogItems[`RX:${m.id}`]) ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        {medicationCatalogue.map(med => {
                          const isChecked = !!checkedCatalogItems[`RX:${med.id}`];
                          const isSelected = selectedOrderItem?.type === 'RX' && selectedOrderItem.item.id === med.id;
                          return (
                            <div key={med.id} onClick={() => handleSelectCatalogItem('RX', med)}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: isSelected ? '#dcfce7' : isChecked ? '#f0fdf4' : '#fff', borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}>
                              <input type="checkbox" checked={isChecked} onChange={e => { e.stopPropagation(); toggleCheckItem('RX', med); }} style={{ flexShrink: 0, width: '14px', height: '14px', cursor: 'pointer' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.77rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med.name}</div>
                                <div style={{ fontSize: '0.63rem', color: '#94a3b8' }}>{med.class} · Br {med.unitPrice.toFixed(2)}</div>
                              </div>
                              {isSelected && <ChevronRight size={12} color="#059669" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Medical Certificate */}
                  <div style={{ borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <button onClick={() => { toggleNode('cert'); handleSelectCatalogItem('CERT', { name: 'Medical Certificate (Huderma)' }); }}
                      style={{ width: '100%', padding: '10px 12px', background: selectedOrderItem?.type === 'CERT' ? '#fef9c3' : '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#b45309', fontWeight: 700, fontSize: '0.8rem' }}>
                        <Award size={14} color="#b45309" />
                        Medical Certificate
                      </div>
                      <ChevronRight size={13} color="#64748b" />
                    </button>
                  </div>

                  {/* Batch Add */}
                  {Object.keys(checkedCatalogItems).length > 0 && (
                    <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1d4ed8' }}>✓ {Object.keys(checkedCatalogItems).length} item(s) selected</span>
                        <button type="button" onClick={() => setCheckedCatalogItems({})} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 700 }}>Clear</button>
                      </div>
                      <button type="button" onClick={handleAddAllCheckedToBasket} style={{ padding: '8px', borderRadius: '6px', background: '#1d4ed8', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <ShoppingCart size={13} /> Add All {Object.keys(checkedCatalogItems).length} to Basket
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* RIGHT: Parameter editor */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '8px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedOrderItem ? `Configure: ${selectedOrderItem.item.name}` : 'Order Parameters'}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
                  {selectedOrderItem ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Item header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
                        <div>
                          <span style={{ padding: '2px 9px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, background: selectedOrderItem.type === 'LAB' ? '#dbeafe' : selectedOrderItem.type === 'RX' ? '#dcfce7' : selectedOrderItem.type === 'PROCEDURE' ? '#ede9fe' : '#fef9c3', color: selectedOrderItem.type === 'LAB' ? '#1d4ed8' : selectedOrderItem.type === 'RX' ? '#15803d' : selectedOrderItem.type === 'PROCEDURE' ? '#6d28d9' : '#92400e' }}>
                            {selectedOrderItem.type}
                          </span>
                          <h3 style={{ fontSize: '1.08rem', fontWeight: 800, marginTop: '6px', color: '#0f172a' }}>{selectedOrderItem.item.name}</h3>
                          {selectedOrderItem.item.price && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Br {selectedOrderItem.item.price?.toFixed(2)}</div>}
                        </div>
                        <button onClick={handleAddToBasket} style={{ flexShrink: 0, padding: '9px 18px', borderRadius: '8px', background: '#0284c7', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Plus size={15} /> Add to Basket
                        </button>
                      </div>

                      {/* LAB fields */}
                      {selectedOrderItem.type === 'LAB' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Priority</label>
                            <select value={orderLabPriority} onChange={e => setOrderLabPriority(e.target.value)} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', width: '200px' }}>
                              <option value="Routine">Routine</option>
                              <option value="STAT">STAT (Urgent)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Clinical Indication</label>
                            <input type="text" value={orderLabIndication} onChange={e => setOrderLabIndication(e.target.value)} placeholder="e.g. Routine check, suspected anemia..." style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                      )}

                      {/* PROCEDURE fields */}
                      {selectedOrderItem.type === 'PROCEDURE' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Urgency</label>
                            <select value={orderProcUrgency} onChange={e => setOrderProcUrgency(e.target.value)} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', width: '200px' }}>
                              <option value="Routine">Routine</option>
                              <option value="STAT">STAT (Urgent)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Special Instructions</label>
                            <input type="text" value={orderProcNotes} onChange={e => setOrderProcNotes(e.target.value)} placeholder="Any special instructions..." style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                      )}

                      {/* RX fields */}
                      {selectedOrderItem.type === 'RX' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Dosage</label>
                              <input type="text" value={orderRxDosage} onChange={e => setOrderRxDosage(e.target.value)} placeholder="e.g. 500mg" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Route</label>
                              <input type="text" value={orderRxRoute} onChange={e => setOrderRxRoute(e.target.value)} placeholder="e.g. Oral, IV" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: '12px' }}>
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Frequency</label>
                              <input type="text" value={orderRxFreq} onChange={e => setOrderRxFreq(e.target.value)} placeholder="OD, BID, TID..." style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Duration</label>
                              <input type="text" value={orderRxDuration} onChange={e => setOrderRxDuration(e.target.value)} placeholder="7 Days" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Qty</label>
                              <input type="number" value={orderRxQty} onChange={e => setOrderRxQty(parseInt(e.target.value) || 1)} min={1} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CERT fields */}
                      {selectedOrderItem.type === 'CERT' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Card No</label>
                              <input type="text" value={activePatient?.mrn} readOnly style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#f1f5f9', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Examined On</label>
                              <input type="date" value={certExamDate} onChange={e => setCertExamDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#0369a1', display: 'block', marginBottom: '5px' }}>Diagnosis</label>
                            <input type="text" value={certDiagnosis || diagnosis} onChange={e => setCertDiagnosis(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Dr's Recommendation</label>
                            <input type="text" value={recommendation} onChange={e => setRecommendation(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ width: '140px' }}>
                            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Rest Days</label>
                            <input type="number" min={1} value={daysExcused} onChange={e => setDaysExcused(parseInt(e.target.value) || 1)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', textAlign: 'center', gap: '14px' }}>
                      <ShoppingCart size={52} style={{ opacity: 0.2 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#475569' }}>No item selected</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>Click any service on the left to configure it, then click "Add to Basket"</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* FOOTER */}
            <div style={{ flexShrink: 0, borderTop: '2px solid #e2e8f0', padding: '10px 20px', background: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflowX: 'auto', minWidth: 0 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', flexShrink: 0, textTransform: 'uppercase' }}>Basket ({orderBasket.length}):</span>
                {orderBasket.length === 0 && <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>empty</span>}
                {orderBasket.map(b => (
                  <div key={b.id} style={{ flexShrink: 0, padding: '3px 8px', borderRadius: '6px', background: '#dbeafe', border: '1px solid #93c5fd', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <strong style={{ color: '#1e40af' }}>{b.title}</strong>
                    <button onClick={() => handleRemoveFromBasket(b.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={11} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => setShowOrderModal(false)} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAllOrders}
                  disabled={orderBasket.length === 0 && !selectedOrderItem}
                  style={{ padding: '9px 22px', borderRadius: '8px', background: orderBasket.length === 0 && !selectedOrderItem ? '#94a3b8' : '#0284c7', color: '#fff', border: 'none', cursor: orderBasket.length === 0 && !selectedOrderItem ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '7px' }}
                >
                  <Send size={14} /> Submit &amp; Bill Orders
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
              {/* Logo left + Bilingual Header centered */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '28px', borderBottom: '2px solid #e5dfd5', paddingBottom: '20px', gap: '20px' }}>
                {/* Left: Logo */}
                <div style={{ width: '160px', flexShrink: 0 }}>
                  <img src="/huderma_logo.png" alt="Huderma" style={{ width: '100%', maxHeight: '76px', objectFit: 'contain' }} />
                  <div style={{ fontSize: '0.68rem', color: '#c89345', fontWeight: 700, letterSpacing: '0.15em', marginTop: '2px', textAlign: 'center' }}>LOVE YOUR SKIN</div>
                </div>
                {/* Center: Clinic Details */}
                <div style={{ flex: 1, textAlign: 'center', paddingRight: '160px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#c89345' }}>Huderma Dermatology Specialty Clinic</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#c89345', marginBottom: '6px' }}>ሁደርማ የቆዳ ልዩ ክሊኒክ</div>
                  <div style={{ fontSize: '0.8rem', color: '#292524', display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '4px' }}>
                    <div>Kirkos Sub City, Woreda 01, H. No. 062 (ቂርቆስ ክ/ከተማ ወረዳ 01)</div>
                    <div>•</div>
                    <div>Tel: +251 949 74 44 44 / +251 949 54 44 44</div>
                    <div>•</div>
                    <div>hudermacare@gmail.com | www.huderma.com</div>
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

      {/* ========================================================================= */}
      {/* 5. CLINICAL DECISION SUPPORT (CDS) SAFETY ALERT MODAL                    */}
      {/* ========================================================================= */}
      {cdsAlerts.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ background: '#ffffff', width: '100%', maxWidth: '580px', borderRadius: '12px', border: '2px solid #ef4444', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', background: '#fee2e2', borderBottom: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={24} color="#dc2626" />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>
                  Clinical Decision Support: Safety Warning
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                  Patient: <strong>{activePatient?.name}</strong> • Known Allergies: <strong>{activePatient?.allergies || 'None'}</strong>
                </span>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '60vh', overflowY: 'auto' }}>
              {cdsAlerts.map(alt => (
                <div
                  key={alt.id}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: alt.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                    border: `1.5px solid ${alt.severity === 'CRITICAL' ? '#f87171' : '#fcd34d'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={16} color={alt.severity === 'CRITICAL' ? '#dc2626' : '#d97706'} />
                      <strong style={{ fontSize: '0.85rem', color: alt.severity === 'CRITICAL' ? '#991b1b' : '#92400e' }}>
                        {alt.title}
                      </strong>
                    </div>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: alt.severity === 'CRITICAL' ? '#dc2626' : '#d97706',
                        color: '#ffffff'
                      }}
                    >
                      {alt.severity}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: '#334155', margin: '4px 0 8px' }}>
                    {alt.mechanism}
                  </p>

                  <div style={{ padding: '8px 10px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.74rem', color: '#0f172a' }}>
                    <strong>Clinical Recommendation:</strong> {alt.clinicalRecommendation}
                  </div>
                </div>
              ))}

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Override Justification (Required for Audit Trail if proceeding):
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="e.g. Benefit outweighs risk; desensitization protocol active; monitored administration"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.78rem' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setCdsAlerts([]);
                  setPendingCandidateItem(null);
                  setOverrideReason('');
                }}
                className="btn-secondary"
                style={{ padding: '8px 14px' }}
              >
                Cancel &amp; Select Alternate Drug
              </button>
              <button
                type="button"
                onClick={handleConfirmCdsOverride}
                disabled={!overrideReason.trim()}
                className="btn-primary"
                style={{
                  background: overrideReason.trim() ? '#dc2626' : '#94a3b8',
                  borderColor: overrideReason.trim() ? '#b91c1c' : '#94a3b8',
                  padding: '8px 16px',
                  cursor: overrideReason.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Override Alert &amp; Add Drug
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SCHEDULE FOLLOW-UP APPOINTMENT MODAL (EMR SOAP PLAN)                   */}
      {/* ========================================================================= */}
      {showFollowUpModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ background: '#ffffff', width: '100%', maxWidth: '480px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Schedule Follow-up Visit</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFollowUpModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Patient</label>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{activePatient?.name} ({activePatient?.mrn})</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Attending Doctor</label>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{certDoctorName}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Follow-up Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Slot Time</label>
                  <input
                    type="time"
                    value={followUpTime}
                    onChange={e => setFollowUpTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Reason / Clinical Objective</label>
                <input
                  type="text"
                  value={followUpReason}
                  onChange={e => setFollowUpReason(e.target.value)}
                  placeholder="e.g. Skin biopsy suture removal & biopsy pathology review"
                  required
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowFollowUpModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const slotDateTime = `${followUpDate}T${followUpTime}:00`;
                    await api.post('/appointments', {
                      tenantId: 1,
                      patientId: activePatient.id,
                      doctorId: selectedDoctorId,
                      slotDateTime: slotDateTime,
                      durationMinutes: 30,
                      reasonForVisit: followUpReason
                    });

                    // Append follow-up appointment confirmation line to Clinical Plan
                    setPlan(prev => prev
                      ? `${prev}\n• Scheduled Follow-up Appointment on ${followUpDate} at ${followUpTime} with ${certDoctorName} (${followUpReason})`
                      : `• Scheduled Follow-up Appointment on ${followUpDate} at ${followUpTime} with ${certDoctorName} (${followUpReason})`
                    );

                    setShowFollowUpModal(false);
                    setOrderDispatchedToast(`✓ Follow-up visit booked for ${followUpDate} at ${followUpTime}!`);
                    setTimeout(() => setOrderDispatchedToast(null), 4000);
                  } catch (err: any) {
                    console.error('Book follow-up appointment error:', err);
                    setOrderDispatchedToast(`Appointment booking error: ${err.message || 'Server error'}`);
                    setTimeout(() => setOrderDispatchedToast(null), 4000);
                  }
                }}
                className="btn-primary"
              >
                Confirm &amp; Book Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
