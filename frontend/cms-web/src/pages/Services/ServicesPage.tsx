import React, { useState, useEffect } from 'react';
import {
  Layers, Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, Filter,
  Tag, DollarSign, Building, FileText, X, Check, ArrowUpDown, Sparkles,
  Percent, ShieldCheck, Stethoscope, FlaskConical, Scissors, Pill, HeartPulse,
  Clock, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface ServiceCategory {
  id: number;
  name: string;
  code: string;
  description: string;
  itemCount: number;
}

interface ClinicalService {
  id: number;
  code: string;
  name: string;
  categoryId: number;
  categoryName: string;
  department: string;
  standardFee: number;
  taxable: boolean;
  isActive: boolean;
  description: string;
}

interface LabParameter {
  id?: number;
  code: string;
  name: string;
  unit: string;
  normalRangeLow: number;
  normalRangeHigh: number;
}

interface LabTestMaster {
  id: number;
  code: string;
  name: string;
  category: string;
  sampleType: string;
  turnaroundMinutes: number;
  price: number;
  fastingRequired: boolean;
  isActive: boolean;
  parameters: LabParameter[];
}

const DEFAULT_CATEGORIES: ServiceCategory[] = [
  { id: 1, name: 'Consultation & Outpatient', code: 'CAT-CON', description: 'Physician clinical consultation, follow-ups and triage', itemCount: 5 },
  { id: 2, name: 'Laboratory Diagnostics', code: 'CAT-LAB', description: 'Clinical biochemistry, hematology, urinalysis and pathology', itemCount: 10 },
  { id: 3, name: 'Procedures & Minor Surgery', code: 'CAT-PROC', description: 'Biopsy, excisions, debridement and wound management', itemCount: 6 },
  { id: 4, name: 'Dermatology & Aesthetics', code: 'CAT-DERM', description: 'Laser therapy, chemical peels, cryotherapy and skin rejuvenation', itemCount: 7 },
  { id: 5, name: 'Nursing & Infusions', code: 'CAT-NURS', description: 'Injections, IV fluid hydration, dressings and vitals', itemCount: 4 },
  { id: 6, name: 'Pharmacy & Consumables', code: 'CAT-PHARM', description: 'Prescriptions, medical supplies and topical formulations', itemCount: 12 }
];

const DEFAULT_SERVICES: ClinicalService[] = [
  { id: 1, code: 'SRV-CON-01', name: 'General Dermatology Consultation', categoryId: 1, categoryName: 'Consultation & Outpatient', department: 'Dermatology', standardFee: 500.0, taxable: false, isActive: true, description: 'Initial comprehensive dermatologist examination' },
  { id: 2, code: 'SRV-CON-02', name: 'Specialist Follow-up Consultation', categoryId: 1, categoryName: 'Consultation & Outpatient', department: 'Dermatology', standardFee: 350.0, taxable: false, isActive: true, description: 'Review and management within 14 days' },
  { id: 3, code: 'SRV-CON-03', name: 'Urgent / STAT Consultation', categoryId: 1, categoryName: 'Consultation & Outpatient', department: 'Dermatology / Triage', standardFee: 650.0, taxable: false, isActive: true, description: 'Same-day urgent assessment' },
  { id: 4, code: 'SRV-CON-04', name: 'Teledermatology Remote Review', categoryId: 1, categoryName: 'Consultation & Outpatient', department: 'Telemedicine', standardFee: 400.0, taxable: false, isActive: true, description: 'Online asynchronous photo review & e-Rx' },
  { id: 5, code: 'SRV-DERM-01', name: 'Skin Punch Biopsy (3-4mm)', categoryId: 3, categoryName: 'Procedures & Minor Surgery', department: 'Dermatology Surgery', standardFee: 750.0, taxable: false, isActive: true, description: 'Diagnostic skin biopsy with local anesthesia' },
  { id: 6, code: 'SRV-DERM-02', name: 'Liquid Nitrogen Cryotherapy (1-3 Lesions)', categoryId: 4, categoryName: 'Dermatology & Aesthetics', department: 'Aesthetics Clinic', standardFee: 450.0, taxable: true, isActive: true, description: 'Cryosurgical destruction of benign skin lesions' },
  { id: 7, code: 'SRV-DERM-03', name: 'Chemical Peel Rejuvenation (Salicylic/Glycolic)', categoryId: 4, categoryName: 'Dermatology & Aesthetics', department: 'Aesthetics Clinic', standardFee: 1200.0, taxable: true, isActive: true, description: 'Acne and hyperpigmentation medical peel' },
  { id: 8, code: 'SRV-DERM-04', name: 'Laser Hair & Pigment Therapy (Per Session)', categoryId: 4, categoryName: 'Dermatology & Aesthetics', department: 'Laser Center', standardFee: 1800.0, taxable: true, isActive: true, description: 'Nd:YAG medical laser session' },
  { id: 12, code: 'SRV-NURS-01', name: 'Intravenous Cannulation & Fluid Hydration', categoryId: 5, categoryName: 'Nursing & Infusions', department: 'Nursing / Day Ward', standardFee: 250.0, taxable: false, isActive: true, description: 'IV placement with 500ml Ringer Lactate' }
];

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<'services' | 'lab_catalog' | 'categories'>('services');

  // Categories State
  const [categories, setCategories] = useState<ServiceCategory[]>(() => {
    try {
      const saved = localStorage.getItem('clinic_categories');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CATEGORIES;
  });

  // Clinical Services State
  const [services, setServices] = useState<ClinicalService[]>(() => {
    try {
      const saved = localStorage.getItem('clinic_services');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SERVICES;
  });

  // Comprehensive Laboratory Tests & Sub-Tests State
  const [labTests, setLabTests] = useState<LabTestMaster[]>([
    {
      id: 1, code: 'CBC-01', name: 'Complete Blood Count (CBC Profile)', category: 'Hematology', sampleType: 'Whole Blood / EDTA', turnaroundMinutes: 60, price: 280.0, fastingRequired: false, isActive: true,
      parameters: [
        { code: 'WBC', name: 'White Blood Cell Count', unit: '10^3/uL', normalRangeLow: 4.5, normalRangeHigh: 11.0 },
        { code: 'RBC', name: 'Red Blood Cell Count', unit: '10^6/uL', normalRangeLow: 4.2, normalRangeHigh: 5.8 },
        { code: 'HGB', name: 'Hemoglobin', unit: 'g/dL', normalRangeLow: 12.0, normalRangeHigh: 17.5 },
        { code: 'HCT', name: 'Hematocrit', unit: '%', normalRangeLow: 37.0, normalRangeHigh: 51.0 },
        { code: 'PLT', name: 'Platelet Count', unit: '10^3/uL', normalRangeLow: 150.0, normalRangeHigh: 450.0 }
      ]
    },
    {
      id: 2, code: 'LFT-01', name: 'Liver Function Tests (LFT Panel)', category: 'Biochemistry', sampleType: 'Serum', turnaroundMinutes: 120, price: 380.0, fastingRequired: true, isActive: true,
      parameters: [
        { code: 'ALT', name: 'Alanine Aminotransferase (ALT/SGPT)', unit: 'U/L', normalRangeLow: 7.0, normalRangeHigh: 56.0 },
        { code: 'AST', name: 'Aspartate Aminotransferase (AST/SGOT)', unit: 'U/L', normalRangeLow: 10.0, normalRangeHigh: 40.0 },
        { code: 'ALP', name: 'Alkaline Phosphatase (ALP)', unit: 'U/L', normalRangeLow: 44.0, normalRangeHigh: 147.0 },
        { code: 'TBIL', name: 'Total Bilirubin', unit: 'mg/dL', normalRangeLow: 0.2, normalRangeHigh: 1.2 },
        { code: 'ALB', name: 'Albumin', unit: 'g/dL', normalRangeLow: 3.4, normalRangeHigh: 5.4 }
      ]
    },
    {
      id: 3, code: 'RFT-01', name: 'Renal Function Tests (RFT / Urea & Creatinine)', category: 'Biochemistry', sampleType: 'Serum', turnaroundMinutes: 120, price: 320.0, fastingRequired: false, isActive: true,
      parameters: [
        { code: 'CREAT', name: 'Serum Creatinine', unit: 'mg/dL', normalRangeLow: 0.6, normalRangeHigh: 1.2 },
        { code: 'BUN', name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', normalRangeLow: 7.0, normalRangeHigh: 20.0 },
        { code: 'EGFR', name: 'Estimated GFR (eGFR)', unit: 'mL/min/1.73m²', normalRangeLow: 90.0, normalRangeHigh: 120.0 }
      ]
    },
    {
      id: 4, code: 'LIPID-01', name: 'Lipid Profile Panel', category: 'Biochemistry', sampleType: 'Serum', turnaroundMinutes: 120, price: 420.0, fastingRequired: true, isActive: true,
      parameters: [
        { code: 'CHOL', name: 'Total Cholesterol', unit: 'mg/dL', normalRangeLow: 125.0, normalRangeHigh: 200.0 },
        { code: 'HDL', name: 'HDL Cholesterol (Good)', unit: 'mg/dL', normalRangeLow: 40.0, normalRangeHigh: 60.0 },
        { code: 'LDL', name: 'LDL Cholesterol (Bad)', unit: 'mg/dL', normalRangeLow: 50.0, normalRangeHigh: 100.0 },
        { code: 'TRIG', name: 'Triglycerides', unit: 'mg/dL', normalRangeLow: 50.0, normalRangeHigh: 150.0 }
      ]
    },
    {
      id: 5, code: 'FBS-01', name: 'Fasting Blood Sugar (FBS)', category: 'Biochemistry', sampleType: 'Fluoride Plasma', turnaroundMinutes: 30, price: 120.0, fastingRequired: true, isActive: true,
      parameters: [
        { code: 'GLU', name: 'Fasting Blood Glucose', unit: 'mg/dL', normalRangeLow: 70.0, normalRangeHigh: 99.0 }
      ]
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | 'ALL'>('ALL');
  const [expandedLabId, setExpandedLabId] = useState<number | null>(1);

  // Filtered lists based on search query and category filter
  const filteredServices = services.filter(s => {
    if (selectedCategoryFilter !== 'ALL' && s.categoryId !== selectedCategoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name?.toLowerCase().includes(q);
      const matchCode = s.code?.toLowerCase().includes(q);
      const matchCat = s.categoryName?.toLowerCase().includes(q);
      const matchDept = s.department?.toLowerCase().includes(q);
      const matchDesc = s.description?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchCat && !matchDept && !matchDesc) return false;
    }
    return true;
  });

  const filteredLabTests = labTests.filter(t => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.name?.toLowerCase().includes(q);
      const matchCode = t.code?.toLowerCase().includes(q);
      const matchCat = t.category?.toLowerCase().includes(q);
      const matchSample = t.sampleType?.toLowerCase().includes(q);
      const matchParams = (t.parameters || []).some(p =>
        p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
      );
      if (!matchName && !matchCode && !matchCat && !matchSample && !matchParams) return false;
    }
    return true;
  });

  const filteredCategories = categories.filter(c => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchCode = c.code?.toLowerCase().includes(q);
      const matchDesc = c.description?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchDesc) return false;
    }
    return true;
  });

  // Modals State
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<ClinicalService | null>(null);

  const [showLabModal, setShowLabModal] = useState(false);
  const [editingLab, setEditingLab] = useState<LabTestMaster | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);

  // Form State for Service
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState(1);
  const [formDepartment, setFormDepartment] = useState('Dermatology');
  const [formStandardFee, setFormStandardFee] = useState('500.0');
  const [formTaxable, setFormTaxable] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formDescription, setFormDescription] = useState('');

  // Form State for Lab Test
  const [labFormCode, setLabFormCode] = useState('');
  const [labFormName, setLabFormName] = useState('');
  const [labFormCat, setLabFormCat] = useState('Biochemistry');
  const [labFormSample, setLabFormSample] = useState('Serum');
  const [labFormTat, setLabFormTat] = useState('60');
  const [labFormPrice, setLabFormPrice] = useState('300.0');
  const [labFormFasting, setLabFormFasting] = useState(false);
  const [labFormParams, setLabFormParams] = useState<LabParameter[]>([
    { code: 'PARAM-1', name: 'Primary Analyte', unit: 'mg/dL', normalRangeLow: 10, normalRangeHigh: 50 }
  ]);

  // Form State for Category
  const [formCatName, setFormCatName] = useState('');
  const [formCatCode, setFormCatCode] = useState('');
  const [formCatDesc, setFormCatDesc] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load backend catalog if available
  useEffect(() => {
    const loadBackendCatalog = async () => {
      try {
        const catData = await api.get<any[]>('/laboratory/catalog').catch(() => []);
        if (catData && catData.length > 0) {
          // Merge with master
        }
      } catch (err) {
        console.error('Failed to load lab catalog:', err);
      }
    };
    loadBackendCatalog();
  }, []);

  const openAddServiceModal = () => {
    setEditingService(null);
    setFormCode(`SRV-${Math.floor(100 + Math.random() * 900)}`);
    setFormName('');
    setFormCategoryId(categories[0]?.id || 1);
    setFormDepartment('Dermatology');
    setFormStandardFee('500.0');
    setFormTaxable(false);
    setFormIsActive(true);
    setFormDescription('');
    setShowServiceModal(true);
  };

  const openEditServiceModal = (srv: ClinicalService) => {
    setEditingService(srv);
    setFormCode(srv.code);
    setFormName(srv.name);
    setFormCategoryId(srv.categoryId);
    setFormDepartment(srv.department);
    setFormStandardFee(String(srv.standardFee));
    setFormTaxable(srv.taxable);
    setFormIsActive(srv.isActive);
    setFormDescription(srv.description);
    setShowServiceModal(true);
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find(c => c.id === formCategoryId) || categories[0];
    const fee = parseFloat(formStandardFee) || 0;

    let updated: ClinicalService[];
    if (editingService) {
      updated = services.map(s => s.id === editingService.id ? {
        ...s,
        code: formCode,
        name: formName,
        categoryId: formCategoryId,
        categoryName: cat.name,
        department: formDepartment,
        standardFee: fee,
        taxable: formTaxable,
        isActive: formIsActive,
        description: formDescription
      } : s);
      showToast(`Updated service: "${formName}"`);
    } else {
      const newSrv: ClinicalService = {
        id: Date.now(),
        code: formCode,
        name: formName,
        categoryId: formCategoryId,
        categoryName: cat.name,
        department: formDepartment,
        standardFee: fee,
        taxable: formTaxable,
        isActive: formIsActive,
        description: formDescription
      };
      updated = [newSrv, ...services];
      showToast(`Created new clinical service: "${formName}"`);
    }
    setServices(updated);
    try {
      localStorage.setItem('clinic_services', JSON.stringify(updated));
    } catch {}
    setShowServiceModal(false);
  };

  const handleDeleteService = (id: number) => {
    if (window.confirm('Are you sure you want to delete this clinical service?')) {
      const updated = services.filter(x => x.id !== id);
      setServices(updated);
      try {
        localStorage.setItem('clinic_services', JSON.stringify(updated));
      } catch {}
      showToast('Clinical service deleted.');
    }
  };

  // Lab Test Handlers
  const openAddLabModal = () => {
    setEditingLab(null);
    setLabFormCode(`LAB-${Math.floor(100 + Math.random() * 900)}`);
    setLabFormName('');
    setLabFormCat('Biochemistry');
    setLabFormSample('Serum');
    setLabFormTat('60');
    setLabFormPrice('300.0');
    setLabFormFasting(false);
    setLabFormParams([
      { code: 'PARAM-1', name: 'Primary Analyte', unit: 'mg/dL', normalRangeLow: 10, normalRangeHigh: 50 }
    ]);
    setShowLabModal(true);
  };

  const openEditLabModal = (t: LabTestMaster) => {
    setEditingLab(t);
    setLabFormCode(t.code);
    setLabFormName(t.name);
    setLabFormCat(t.category);
    setLabFormSample(t.sampleType);
    setLabFormTat(String(t.turnaroundMinutes));
    setLabFormPrice(String(t.price));
    setLabFormFasting(t.fastingRequired);
    setLabFormParams(t.parameters || []);
    setShowLabModal(true);
  };

  const handleAddParamRow = () => {
    setLabFormParams([
      ...labFormParams,
      { code: `PARAM-${labFormParams.length + 1}`, name: 'New Sub-Parameter', unit: 'U/L', normalRangeLow: 0, normalRangeHigh: 100 }
    ]);
  };

  const handleRemoveParamRow = (idx: number) => {
    setLabFormParams(labFormParams.filter((_, i) => i !== idx));
  };

  const handleSaveLabTest = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(labFormPrice) || 0;
    const tatNum = parseInt(labFormTat) || 60;

    if (editingLab) {
      setLabTests(labTests.map(t => t.id === editingLab.id ? {
        ...t,
        code: labFormCode,
        name: labFormName,
        category: labFormCat,
        sampleType: labFormSample,
        turnaroundMinutes: tatNum,
        price: priceNum,
        fastingRequired: labFormFasting,
        parameters: labFormParams
      } : t));
      showToast(`Updated Lab Test: "${labFormName}" with ${labFormParams.length} sub-tests`);
    } else {
      const newTest: LabTestMaster = {
        id: Date.now(),
        code: labFormCode,
        name: labFormName,
        category: labFormCat,
        sampleType: labFormSample,
        turnaroundMinutes: tatNum,
        price: priceNum,
        fastingRequired: labFormFasting,
        isActive: true,
        parameters: labFormParams
      };
      setLabTests([newTest, ...labTests]);
      showToast(`Created Lab Test: "${labFormName}" with ${labFormParams.length} sub-parameters`);
    }
    setShowLabModal(false);
  };

  const handleDeleteLabTest = (id: number) => {
    if (window.confirm('Are you sure you want to delete this Laboratory Test & Sub-tests?')) {
      setLabTests(labTests.filter(t => t.id !== id));
      showToast('Lab Test deleted from catalogue.');
    }
  };

  const openAddCategoryModal = () => {
    setEditingCategory(null);
    setFormCatName('');
    setFormCatCode(`CAT-${Math.floor(10 + Math.random() * 90)}`);
    setFormCatDesc('');
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (cat: ServiceCategory) => {
    setEditingCategory(cat);
    setFormCatName(cat.name);
    setFormCatCode(cat.code);
    setFormCatDesc(cat.description);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    let updated: ServiceCategory[];
    if (editingCategory) {
      updated = categories.map(c => c.id === editingCategory.id ? {
        ...c,
        name: formCatName,
        code: formCatCode,
        description: formCatDesc
      } : c);
      showToast(`Updated category: "${formCatName}"`);
    } else {
      const newCat: ServiceCategory = {
        id: Date.now(),
        name: formCatName,
        code: formCatCode,
        description: formCatDesc,
        itemCount: 0
      };
      updated = [...categories, newCat];
      showToast(`Created new category: "${formCatName}"`);
    }
    setCategories(updated);
    try {
      localStorage.setItem('clinic_categories', JSON.stringify(updated));
    } catch {}
    setShowCategoryModal(false);
  };

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '12px 18px', borderRadius: '8px', background: '#059669', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} /> {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <Layers color="#0284c7" size={20} /> Service Management & Test Catalogues
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Configure clinical consultation tariffs, laboratory test parameters & reference ranges, procedure fees, and service categories.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'services' && (
            <button onClick={openAddServiceModal} className="btn-primary">
              <Plus size={15} /> + Add Clinical Service
            </button>
          )}
          {activeTab === 'lab_catalog' && (
            <button onClick={openAddLabModal} className="btn-primary">
              <FlaskConical size={15} /> + Add Laboratory Test & Analytes
            </button>
          )}
          {activeTab === 'categories' && (
            <button onClick={openAddCategoryModal} className="btn-primary">
              <Tag size={15} /> + Add Service Category
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid-4" style={{ marginBottom: '18px' }}>
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>CLINICAL SERVICES</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{services.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #0284c7' }}>
          <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700 }}>LABORATORY TESTS</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
            {labTests.length} ({labTests.reduce((sum, t) => sum + (t.parameters?.length || 1), 0)} Sub-Tests)
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #059669' }}>
          <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>SERVICE CATEGORIES</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
            {categories.length}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #d97706' }}>
          <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 700 }}>AVG CONSULTATION FEE</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
            Br 475.00
          </div>
        </div>
      </div>

      {/* Tabs for Services, Lab Catalogue, Categories */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('services')}
          className={activeTab === 'services' ? 'btn-primary' : 'btn-secondary'}
        >
          <Layers size={15} /> Clinical Services ({services.length})
        </button>
        <button
          onClick={() => setActiveTab('lab_catalog')}
          className={activeTab === 'lab_catalog' ? 'btn-primary' : 'btn-secondary'}
        >
          <FlaskConical size={15} /> Laboratory Test Catalogue & Sub-Tests ({labTests.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}
        >
          <Tag size={15} /> Service Categories ({categories.length})
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{
        background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '10px',
        border: '1px solid var(--border-color)', marginBottom: '16px',
        display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={
              activeTab === 'services'
                ? "Search clinical services by name, code, category, department..."
                : activeTab === 'lab_catalog'
                ? "Search laboratory tests, codes, categories, specimens, analytes..."
                : "Search service categories by name, code, description..."
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 32px 8px 36px', borderRadius: 8,
              border: '1.5px solid var(--border-color)', background: 'var(--bg-input)',
              fontSize: '0.82rem', color: 'var(--text-main)', boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 10, top: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {activeTab === 'services' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)',
                background: 'var(--bg-input)', fontSize: '0.82rem', color: 'var(--text-main)'
              }}
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Match Count Badge */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>
            {activeTab === 'services' && `Showing ${filteredServices.length} of ${services.length} services`}
            {activeTab === 'lab_catalog' && `Showing ${filteredLabTests.length} of ${labTests.length} tests`}
            {activeTab === 'categories' && `Showing ${filteredCategories.length} of ${categories.length} categories`}
          </span>
          {(searchQuery || selectedCategoryFilter !== 'ALL') && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategoryFilter('ALL'); }}
              style={{
                background: 'none', border: 'none', color: '#0284c7', fontSize: '0.72rem',
                cursor: 'pointer', textDecoration: 'underline', padding: 0
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CLINICAL SERVICES CATALOGUE                                        */}
      {/* ========================================================================= */}
      {activeTab === 'services' && (
        <div className="glass-panel" style={{ padding: '18px' }}>
          {filteredServices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <Search size={32} style={{ margin: '0 auto 8px', opacity: 0.35 }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: 4 }}>
                No clinical services found
              </div>
              <div style={{ fontSize: '0.78rem', marginBottom: 12 }}>
                {searchQuery || selectedCategoryFilter !== 'ALL'
                  ? 'No services match your active search or category filter.'
                  : 'No clinical services configured yet.'}
              </div>
              {(searchQuery || selectedCategoryFilter !== 'ALL') && (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategoryFilter('ALL'); }}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  Clear search &amp; filter
                </button>
              )}
            </div>
          ) : (
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Service Code</th>
                  <th>Service Name</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Standard Fee (Br)</th>
                  <th>Tax</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map(s => (
                  <tr key={s.id}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>{s.code}</span></td>
                    <td><strong>{s.name}</strong></td>
                    <td><span className="badge badge-info">{s.categoryName}</span></td>
                    <td>{s.department}</td>
                    <td><strong style={{ color: '#059669' }}>Br {s.standardFee.toFixed(2)}</strong></td>
                    <td>{s.taxable ? 'VAT 15%' : 'Exempt'}</td>
                    <td><span className="badge badge-normal">Active</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => openEditServiceModal(s)} title="Edit service parameters" className="btn-secondary" style={{ padding: '3px 6px' }}><Edit2 size={12} /></button>
                        <button onClick={() => handleDeleteService(s.id)} title="Delete service" className="btn-secondary" style={{ padding: '3px 6px', color: '#b91c1c' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: COMPLETE LABORATORY TEST CATALOGUE & SUB-TESTS / PARAMETERS        */}
      {/* ========================================================================= */}
      {activeTab === 'lab_catalog' && (
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FlaskConical size={16} color="#0284c7" /> Diagnostic Laboratory Test & Sub-Parameter Directory
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Configure analyte units, normal range thresholds, specimens, TAT and tariffs
              </span>
            </div>
            <button onClick={openAddLabModal} className="btn-primary">
              <Plus size={14} /> + New Lab Test
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredLabTests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <FlaskConical size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                <div style={{ fontSize: '0.9rem' }}>No lab tests match your search.</div>
              </div>
            ) : filteredLabTests.map(test => {
              const isExpanded = expandedLabId === test.id;
              return (
                <div
                  key={test.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: '#ffffff',
                    overflow: 'hidden'
                  }}
                >
                  {/* Test Master Header Row */}
                  <div
                    onClick={() => setExpandedLabId(isExpanded ? null : test.id)}
                    style={{
                      padding: '12px 16px',
                      background: isExpanded ? '#e0f2fe' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <FlaskConical size={18} color="#0284c7" />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', fontSize: '0.85rem' }}>
                            {test.code}
                          </span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{test.name}</strong>
                          <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{test.category}</span>
                          {test.fastingRequired && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Fasting Req.</span>}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Specimen: <strong>{test.sampleType}</strong> • Turnaround: <strong>{test.turnaroundMinutes} Mins</strong> • Sub-Tests: <strong>{test.parameters?.length || 1}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <strong style={{ color: '#059669', fontSize: '0.95rem' }}>Br {test.price.toFixed(2)}</strong>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={e => { e.stopPropagation(); openEditLabModal(test); }}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteLabTest(test.id); }}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem', color: '#b91c1c' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Sub-Parameters Table */}
                  {isExpanded && (
                    <div style={{ padding: '14px 20px', background: '#fcfbf8', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', marginBottom: '8px', textTransform: 'uppercase' }}>
                        Sub-Tests / Analyte Parameters & Biological Reference Ranges:
                      </div>

                      <table className="cms-table" style={{ background: '#ffffff' }}>
                        <thead>
                          <tr>
                            <th>Parameter Code</th>
                            <th>Analyte / Sub-Test Name</th>
                            <th>Measurement Unit</th>
                            <th>Normal Range Low</th>
                            <th>Normal Range High</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(test.parameters || []).map((p, idx) => (
                            <tr key={idx}>
                              <td><span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{p.code}</span></td>
                              <td><strong>{p.name}</strong></td>
                              <td>{p.unit}</td>
                              <td><span style={{ color: '#059669', fontWeight: 600 }}>{p.normalRangeLow}</span></td>
                              <td><span style={{ color: '#059669', fontWeight: 600 }}>{p.normalRangeHigh}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SERVICE CATEGORIES                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div className="glass-panel" style={{ padding: '18px' }}>
          {filteredCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '0.9rem' }}>No categories match your search.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {filteredCategories.map(c => (
                <div key={c.id} style={{ padding: '16px', borderRadius: '8px', background: '#fdfcf9', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>{c.code}</span>
                    <button onClick={() => openEditCategoryModal(c)} className="btn-secondary" style={{ padding: '2px 6px' }}><Edit2 size={11} /></button>
                  </div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '4px' }}>{c.name}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{c.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT LABORATORY TEST & ANALYTE BUILDER                       */}
      {/* ========================================================================= */}
      {showLabModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '680px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  {editingLab ? 'Edit Diagnostic Laboratory Test' : 'Add New Laboratory Test'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Define test tariff, specimen, and sub-parameters</span>
              </div>
              <button onClick={() => setShowLabModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveLabTest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Test Code *</label>
                  <input type="text" value={labFormCode} onChange={e => setLabFormCode(e.target.value)} required style={{ fontFamily: 'monospace', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Test Full Name *</label>
                  <input type="text" value={labFormName} onChange={e => setLabFormName(e.target.value)} placeholder="e.g. Complete Blood Count (CBC)" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category</label>
                  <select value={labFormCat} onChange={e => setLabFormCat(e.target.value)}>
                    <option value="Hematology">Hematology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Clinical Pathology">Clinical Pathology</option>
                    <option value="Immunoassay">Immunoassay</option>
                    <option value="Microbiology">Microbiology</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Specimen Type</label>
                  <input type="text" value={labFormSample} onChange={e => setLabFormSample(e.target.value)} placeholder="Serum / Whole Blood" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Price Tariff (Br) *</label>
                  <input type="number" step="0.5" value={labFormPrice} onChange={e => setLabFormPrice(e.target.value)} required />
                </div>
              </div>

              {/* Sub-Parameters Section */}
              <div style={{ padding: '12px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1' }}>
                    Sub-Parameters & Analytes ({labFormParams.length})
                  </span>
                  <button type="button" onClick={handleAddParamRow} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.7rem' }}>
                    <Plus size={12} /> Add Analyte Row
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {labFormParams.map((p, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 1.4fr 70px 70px 70px auto', gap: '6px', alignItems: 'center' }}>
                      <input type="text" placeholder="Code" value={p.code} onChange={e => { const u = [...labFormParams]; u[idx].code = e.target.value; setLabFormParams(u); }} style={{ fontSize: '0.72rem' }} />
                      <input type="text" placeholder="Analyte Name" value={p.name} onChange={e => { const u = [...labFormParams]; u[idx].name = e.target.value; setLabFormParams(u); }} style={{ fontSize: '0.72rem' }} />
                      <input type="text" placeholder="Unit" value={p.unit} onChange={e => { const u = [...labFormParams]; u[idx].unit = e.target.value; setLabFormParams(u); }} style={{ fontSize: '0.72rem' }} />
                      <input type="number" placeholder="Min" value={p.normalRangeLow} onChange={e => { const u = [...labFormParams]; u[idx].normalRangeLow = parseFloat(e.target.value) || 0; setLabFormParams(u); }} style={{ fontSize: '0.72rem' }} />
                      <input type="number" placeholder="Max" value={p.normalRangeHigh} onChange={e => { const u = [...labFormParams]; u[idx].normalRangeHigh = parseFloat(e.target.value) || 0; setLabFormParams(u); }} style={{ fontSize: '0.72rem' }} />
                      <button type="button" onClick={() => handleRemoveParamRow(idx)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setShowLabModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  <Check size={14} /> {editingLab ? 'Save Lab Test' : 'Create Lab Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CLINICAL SERVICE (Every Parameter Editable)             */}
      {/* ========================================================================= */}
      {showServiceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '640px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {editingService ? `Edit Clinical Service — ${editingService.code}` : 'Add New Clinical Service'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Configure all service parameters: code, name, category, department, standard tariff, tax, and status
                </span>
              </div>
              <button onClick={() => setShowServiceModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveService} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Row 1: Code & Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Service Code *</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    required
                    placeholder="e.g. SRV-CON-01"
                    style={{ fontFamily: 'monospace', fontWeight: 700, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Service Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                    placeholder="e.g. General Dermatology Consultation"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Row 2: Category & Department */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Category *</label>
                  <select
                    value={formCategoryId}
                    onChange={e => setFormCategoryId(Number(e.target.value))}
                    style={{ width: '100%' }}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Department *</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={e => setFormDepartment(e.target.value)}
                    required
                    placeholder="e.g. Dermatology / Triage"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Row 3: Standard Fee & Taxation & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Standard Fee (Br) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formStandardFee}
                    onChange={e => setFormStandardFee(e.target.value)}
                    required
                    style={{ width: '100%', fontWeight: 700, color: '#059669' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tax Treatment</label>
                  <select
                    value={formTaxable ? 'VAT15' : 'EXEMPT'}
                    onChange={e => setFormTaxable(e.target.value === 'VAT15')}
                    style={{ width: '100%' }}
                  >
                    <option value="EXEMPT">Exempt (0% VAT)</option>
                    <option value="VAT15">Taxable (15% VAT)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Active Status</label>
                  <select
                    value={formIsActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={e => setFormIsActive(e.target.value === 'ACTIVE')}
                    style={{ width: '100%' }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive / Disabled</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Description */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Clinical / Billing Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="Detailed description of clinical scope, indications, or billing instructions..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button type="button" onClick={() => setShowServiceModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" style={{ background: '#0284c7', borderColor: '#0284c7' }}>
                  <Check size={14} /> {editingService ? 'Update Clinical Service' : 'Create Clinical Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CATEGORY                                                */}
      {/* ========================================================================= */}
      {showCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '520px', padding: '24px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {editingCategory ? 'Edit Service Category' : 'Add New Service Category'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Group clinical and diagnostic services</span>
              </div>
              <button onClick={() => setShowCategoryModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Category Code *</label>
                <input
                  type="text"
                  value={formCatCode}
                  onChange={e => setFormCatCode(e.target.value)}
                  required
                  placeholder="e.g. CAT-CON"
                  style={{ fontFamily: 'monospace', fontWeight: 700, width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Category Name *</label>
                <input
                  type="text"
                  value={formCatName}
                  onChange={e => setFormCatName(e.target.value)}
                  required
                  placeholder="e.g. Consultation & Outpatient"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  value={formCatDesc}
                  onChange={e => setFormCatDesc(e.target.value)}
                  rows={2}
                  placeholder="Brief description of the service category..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button type="button" onClick={() => setShowCategoryModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  <Check size={14} /> {editingCategory ? 'Save Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
