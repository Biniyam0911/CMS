import React, { useState, useEffect } from 'react';
import { Boxes, Check, Power, Shield, Info, Loader2, Search, Filter, Sparkles } from 'lucide-react';
import { api } from '../../api/apiClient';

interface AppModuleItem {
  id: number;
  code: string;
  name: string;
  category: string;
  isCore: boolean;
  isEnabled: boolean;
  desc: string;
  features: string[];
}

export default function ModuleManagementPage() {
  const defaultModules: AppModuleItem[] = [
    {
      id: 1,
      code: 'DASHBOARD',
      name: 'Executive Operations Dashboard',
      category: 'Core',
      isCore: true,
      isEnabled: true,
      desc: 'Real-time clinical KPI metrics, active appointments, queue stats, departmental revenue, and critical alerts.',
      features: ['KPI Cards', 'Live Revenue Metrics', 'Active Queue Roster', 'System Health Status']
    },
    {
      id: 2,
      code: 'PATIENTS',
      name: 'Patient Registry & Demographics',
      category: 'Clinical',
      isCore: true,
      isEnabled: true,
      desc: 'Comprehensive patient master index, demographics, national ID, contact details, emergency contacts, and insurance profile.',
      features: ['Patient Search', 'MRN Generation', 'Insurance Tagging', 'Medical History Timeline']
    },
    {
      id: 3,
      code: 'TRIAGE',
      name: 'Triage & Nursing Assessment',
      category: 'Clinical',
      isCore: true,
      isEnabled: true,
      desc: 'Vital signs evaluation, MEWS early warning scoring, vital signs trending graph, chief complaints, and triage room assignment.',
      features: ['MEWS Scoring', 'Vital Signs Trending', 'Emergency Priority Flagging', 'Fast-Track Routing']
    },
    {
      id: 4,
      code: 'EMR',
      name: 'EMR, SOAP Notes & DICOM PACS',
      category: 'Clinical',
      isCore: true,
      isEnabled: true,
      desc: 'Clinical consultation visit notes, SOAP documentation, ICD-10 diagnosis coding, e-prescriptions, and integrated 2D DICOM PACS radiology viewer.',
      features: ['SOAP Documentation', 'ICD-10 Catalog', 'DICOM PACS Viewer', 'Caliper Measurements', 'Window/Level Presets']
    },
    {
      id: 5,
      code: 'INPATIENT',
      name: 'Inpatient (IPD) & Bed Management',
      category: 'Clinical',
      isCore: false,
      isEnabled: true,
      desc: 'Hospital ward floorplan visualization, bed availability, patient admission, clinical nursing round flowsheets, and automated daily bed charges.',
      features: ['Ward Floorplan', 'Bed Occupancy Matrix', 'Quick Admission Workflow', 'Nursing Flowsheet', 'Discharge & Bed Release']
    },
    {
      id: 6,
      code: 'APPOINTMENTS',
      name: 'Appointment Scheduling',
      category: 'Clinical',
      isCore: true,
      isEnabled: true,
      desc: 'Physician schedule matrix, multi-view booking calendar, time slot reservation, and automated SMS appointment reminders.',
      features: ['Doctor Schedules', 'Calendar Views', 'Slot Reservation', 'Automated SMS Reminders']
    },
    {
      id: 7,
      code: 'QUEUE',
      name: 'Queue Board & Public TV Display',
      category: 'Clinical',
      isCore: false,
      isEnabled: true,
      desc: 'Patient token generation, cross-department priority queues, counter call dispatch, audio chime speech broadcast, and fullscreen waiting room TV screen.',
      features: ['Token Dispatcher', 'Audio Chime & Speech', 'Waiting Room TV Display', '2x2 Dept Matrix', 'Marquee Announcements']
    },
    {
      id: 8,
      code: 'LAB',
      name: 'Laboratory Information System (LIS)',
      category: 'Clinical',
      isCore: false,
      isEnabled: true,
      desc: 'Diagnostic test catalog, specimen barcoding, automated analyzer integration (HL7/ASTM), result validation, and critical value alerts.',
      features: ['Diagnostic Catalog', 'Specimen Phlebotomy', 'HL7/ASTM Feeds', 'Critical Value Alerts', 'Verified Lab Reports']
    },
    {
      id: 9,
      code: 'PHARMACY',
      name: 'Pharmacy & Dispensary',
      category: 'Clinical',
      isCore: false,
      isEnabled: true,
      desc: 'Medication formulary, doctor e-prescription queue, stock inventory, batch dispensing logs, and expiry tracking.',
      features: ['Drug Formulary', 'E-Prescription Dispensing', 'Stock Inventory', 'Batch Tracking']
    },
    {
      id: 10,
      code: 'BILLING',
      name: 'Billing, Fiscal & Telebirr QR',
      category: 'Financial',
      isCore: true,
      isEnabled: true,
      desc: 'Invoicing, split insurance/TPA co-pay claims, ERCA e-tax certified fiscal receipts with QR, and Telebirr / CBE Birr dynamic QR mobile payments.',
      features: ['Itemized Invoicing', 'TPA Insurance Co-Pay Split', 'ERCA Fiscal Receipt & QR', 'Telebirr Dynamic QR', 'CBE Birr USSD']
    },
    {
      id: 11,
      code: 'REPORTS',
      name: 'Standard Reports Library',
      category: 'Analytics',
      isCore: true,
      isEnabled: true,
      desc: 'Operational reports for clinical volume, revenue trends, lab turnaround time, pharmacy stock consumption, and insurance claims summary.',
      features: ['Financial Revenue Ledger', 'Clinical Volume Reports', 'Lab TAT Metrics', 'Pharmacy Audit']
    },
    {
      id: 12,
      code: 'REPORT_BUILDER',
      name: 'Custom Report Builder',
      category: 'Analytics',
      isCore: false,
      isEnabled: true,
      desc: 'Drag-and-drop report query designer with custom aggregation filters, chart visuals, and PDF/Excel export capabilities.',
      features: ['Custom Data Queries', 'Filter Builder', 'Chart Visuals', 'Excel / PDF Export']
    },
    {
      id: 13,
      code: 'PATIENT_PORTAL',
      name: 'Patient Self-Service Portal',
      category: 'Portals',
      isCore: false,
      isEnabled: true,
      desc: 'Secure portal for patients to book outpatient visits, view verified lab results, inspect prescriptions, and settle invoices online.',
      features: ['Online Booking', 'Lab Results Viewer', 'Prescription History', 'Digital Receipts']
    },
    {
      id: 14,
      code: 'SERVICE_MGMT',
      name: 'Service & Fee Catalog',
      category: 'Administrative',
      isCore: false,
      isEnabled: true,
      desc: 'Centralized catalog for consultation charges, diagnostic test pricing, surgical procedures, and departmental fee schedules.',
      features: ['Clinical Procedure Catalog', 'Fee Schedule', 'Diagnostics Pricing', 'Departmental Categorization']
    },
    {
      id: 15,
      code: 'USER_MGMT',
      name: 'User Accounts, Staff & RBAC',
      category: 'Administrative',
      isCore: true,
      isEnabled: true,
      desc: 'User administration, role-based access control (RBAC), granular module permission matrix, staff credentials, and HIPAA compliance audit trail.',
      features: ['Staff Directory', 'Role Permission Editor', 'HIPAA Audit Trail', 'Role Notification Rules']
    },
    {
      id: 16,
      code: 'MODULE_MGMT',
      name: 'Module Manager',
      category: 'Core',
      isCore: true,
      isEnabled: true,
      desc: 'Enable, disable, and configure system modules and clinical feature sets per clinic tenant.',
      features: ['Module Toggle', 'Core Protection', 'Tenant Feature Registry']
    },
    {
      id: 17,
      code: 'API_MGMT',
      name: 'API Keys & Webhooks',
      category: 'Administrative',
      isCore: false,
      isEnabled: true,
      desc: 'API key issuance, rate limiting per token, webhook subscription and delivery logging for external system integrations.',
      features: ['API Key Provisioning', 'Rate Limiting', 'Webhook Subscriptions', 'Delivery Logs']
    },
    {
      id: 18,
      code: 'SETTINGS',
      name: 'Clinic & System Settings',
      category: 'Administrative',
      isCore: true,
      isEnabled: true,
      desc: 'Clinic branding, operating hours, notification templates, VAT configuration, and official print header customizer.',
      features: ['Clinic Branding & Logo', 'Working Hours', 'Tax / VAT Settings', 'Print Templates']
    },
    {
      id: 19,
      code: 'INTEGRATIONS',
      name: '3rd Party Integrations',
      category: 'Administrative',
      isCore: false,
      isEnabled: true,
      desc: 'Ethio Telecom & Africa\'s Talking SMS gateway, Telebirr payment webhooks, HL7/ASTM analyzer TCP feeds, and OpenAI clinical summarizer.',
      features: ['Ethio Telecom SMS Gateway', 'SMS Delivery Logs', 'Telebirr Mobile Webhook', 'HL7 / ASTM TCP Feeds']
    }
  ];

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [modules, setModules] = useState<AppModuleItem[]>(defaultModules);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  useEffect(() => {
    const fetchModules = async () => {
      try {
        setLoading(true);
        const data = await api.get<any[]>('/modules');
        if (data && data.length > 0) {
          const merged = defaultModules.map(dm => {
            const found = data.find((m: any) => (m.moduleCode || m.code || m.Code) === dm.code);
            return found
              ? {
                  ...dm,
                  id: found.id || found.Id || dm.id,
                  isEnabled: found.isEnabled !== undefined ? found.isEnabled : dm.isEnabled
                }
              : dm;
          });
          setModules(merged);
        }
      } catch (err) {
        console.error('Failed to load modules:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchModules();
  }, []);

  const toggleModule = async (id: number) => {
    const target = modules.find(m => m.id === id);
    if (!target || target.isCore) return;
    const newState = !target.isEnabled;

    try {
      await api.post('/modules/toggle', { moduleId: id, isEnabled: newState });
    } catch (err) {
      console.error('Toggle module error:', err);
    }

    setModules(modules.map(m => (m.id === id ? { ...m, isEnabled: newState } : m)));
  };

  const categories = ['ALL', 'Clinical', 'Financial', 'Core', 'Analytics', 'Administrative', 'Portals'];

  const filteredModules = modules.filter(m => {
    const matchesCategory = selectedCategory === 'ALL' || m.category.toLowerCase() === selectedCategory.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      m.name.toLowerCase().includes(query) ||
      m.code.toLowerCase().includes(query) ||
      m.desc.toLowerCase().includes(query) ||
      m.features.some(f => f.toLowerCase().includes(query));
    return matchesCategory && matchesQuery;
  });

  const totalModules = modules.length;
  const enabledCount = modules.filter(m => m.isEnabled).length;
  const coreCount = modules.filter(m => m.isCore).length;

  return (
    <div>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <Boxes color="#0284c7" size={22} /> System Module Registry & Feature Engine
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Configure and toggle system features, clinical workflows, billing gateways, and external integrations for this clinic tenant.
          </p>
        </div>
        {loading && <Loader2 size={18} className="animate-spin" color="#0284c7" />}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid-3" style={{ marginBottom: '20px' }}>
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL SYSTEM MODULES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0369a1', marginTop: '2px' }}>{totalModules}</div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7' }}>
            <Boxes size={20} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '3px solid #059669' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669' }}>ACTIVE & ENABLED</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>{enabledCount}</div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', background: '#d1fae5', color: '#059669' }}>
            <Power size={20} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '3px solid #6366f1' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4f46e5' }}>PROTECTED CORE MODULES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4f46e5', marginTop: '2px' }}>{coreCount}</div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5' }}>
            <Shield size={20} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search module, feature, or keyword..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Module Grid */}
      <div className="grid-3">
        {filteredModules.map(m => (
          <div
            key={m.id}
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
              opacity: m.isEnabled ? 1 : 0.65,
              transition: 'opacity 0.2s ease',
              border: m.isEnabled ? '1px solid var(--border-color)' : '1px dashed #cbd5e1'
            }}
          >
            <div>
              {/* Category & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{m.category}</span>
                {m.isCore ? (
                  <span className="badge badge-normal" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Shield size={11} /> Core (Always On)
                  </span>
                ) : (
                  <button
                    onClick={() => toggleModule(m.id)}
                    style={{
                      background: m.isEnabled ? '#ecfdf5' : '#fef2f2',
                      border: `1px solid ${m.isEnabled ? '#10b981' : '#f87171'}`,
                      borderRadius: '6px',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      color: m.isEnabled ? '#047857' : '#b91c1c',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.74rem',
                      fontWeight: 700
                    }}
                  >
                    <Power size={13} /> {m.isEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                )}
              </div>

              {/* Module Title */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-main)' }}>{m.name}</h4>
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#0284c7', fontWeight: 600 }}>
                {m.code}
              </span>

              {/* Description */}
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                {m.desc}
              </p>

              {/* Feature Tags */}
              {m.features && m.features.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '12px' }}>
                  {m.features.map((f, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #e2e8f0',
                        fontWeight: 600
                      }}
                    >
                      • {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

