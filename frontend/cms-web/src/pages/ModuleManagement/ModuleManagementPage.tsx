import React, { useState, useEffect } from 'react';
import { Boxes, Check, Power, Shield, Info, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient';

export default function ModuleManagementPage() {
  const defaultModules = [
    { id: 1, code: 'DASHBOARD', name: 'Executive Dashboard', category: 'Core', isCore: true, isEnabled: true, desc: 'Real-time KPI metrics, active appointments, queue stats, and critical alerts' },
    { id: 2, code: 'PATIENTS', name: 'Patient Management', category: 'Clinical', isCore: true, isEnabled: true, desc: 'Comprehensive patient registry, demographics, medical history timeline, insurance' },
    { id: 3, code: 'EMR', name: 'EMR & SOAP Notes', category: 'Clinical', isCore: true, isEnabled: true, desc: 'Clinical visit documentation, SOAP notes, vital signs, ICD-10 diagnosis, procedure & medical certs' },
    { id: 4, code: 'APPOINTMENTS', name: 'Appointment Scheduling', category: 'Clinical', isCore: true, isEnabled: true, desc: 'Doctor schedule matrix, multi-view calendar, slot reservation, reminders' },
    { id: 5, code: 'QUEUE', name: 'Queue & Counter Triage', category: 'Clinical', isCore: false, isEnabled: true, desc: 'Patient token generation, triage priority queue, TV display screen, counter call dispatch' },
    { id: 6, code: 'LAB', name: 'Laboratory (LIS)', category: 'Clinical', isCore: false, isEnabled: true, desc: 'Test catalog, sample barcoding, analyzer integration (HL7/ASTM), automated result validation' },
    { id: 7, code: 'PHARMACY', name: 'Pharmacy & Dispensary', category: 'Clinical', isCore: false, isEnabled: true, desc: 'Drug formulary, e-prescriptions, stock inventory, batch dispensing logs' },
    { id: 8, code: 'BILLING', name: 'Billing & Financials', category: 'Financial', isCore: true, isEnabled: true, desc: 'Automated invoicing, VAT/tax calculation, payments, insurance claims, financial aging reports' },
    { id: 9, code: 'REPORTS', name: 'Standard Reports Library', category: 'Administrative', isCore: true, isEnabled: true, desc: 'Standard operational reports for clinical volume, financial revenue, lab TAT, pharmacy consumption' },
    { id: 10, code: 'REPORT_BUILDER', name: 'Custom Report Builder', category: 'Administrative', isCore: false, isEnabled: true, desc: 'No-code drag-and-drop query designer with PDF, Excel, and CSV export capabilities' },
    { id: 11, code: 'PATIENT_PORTAL', name: 'Patient Self-Service Portal', category: 'Patient', isCore: false, isEnabled: true, desc: 'Secure web portal for patients to book visits, inspect verified lab results, pay invoices' },
    { id: 12, code: 'USER_MGMT', name: 'User Management & RBAC', category: 'Administrative', isCore: true, isEnabled: true, desc: 'User administration, role builder, permission matrix, session controls, and MFA configuration' },
    { id: 13, code: 'MODULE_MGMT', name: 'Module Manager', category: 'Core', isCore: true, isEnabled: true, desc: 'Enable, disable, and configure system modules per clinic tenant' },
    { id: 14, code: 'API_MGMT', name: 'API & Webhooks', category: 'Administrative', isCore: false, isEnabled: true, desc: 'API key issuance, rate limiting per token, webhook subscription and delivery logging' },
    { id: 15, code: 'SETTINGS', name: 'Admin & System Settings', category: 'Administrative', isCore: true, isEnabled: true, desc: 'Clinic profile, working hours, notification templates, VAT settings, document print templates' },
    { id: 16, code: 'INTEGRATIONS', name: '3rd Party Integrations', category: 'Administrative', isCore: false, isEnabled: true, desc: 'Email (SMTP/SendGrid), SMS (Twilio/Infobip), Payment gateways, Lab analyzers, AI assistant' }
  ];

  const [modules, setModules] = useState<any[]>(defaultModules);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        setLoading(true);
        const data = await api.get<any[]>('/modules');
        if (data && data.length > 0) {
          const merged = defaultModules.map(dm => {
            const found = data.find((m: any) => (m.moduleCode || m.code || m.Code) === dm.code);
            return found ? { ...dm, isEnabled: found.isEnabled !== undefined ? found.isEnabled : dm.isEnabled } : dm;
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

    setModules(modules.map(m => m.id === id ? { ...m, isEnabled: newState } : m));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>System Module Registry & Feature Toggles</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Enable or disable modules for this clinic tenant. Core modules cannot be disabled.</p>
        </div>
        {loading && <Loader2 size={16} className="animate-spin" color="#06b6d4" />}
      </div>

      <div className="grid-3">
        {modules.map(m => (
          <div key={m.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-info">{m.category}</span>
                {m.isCore ? (
                  <span className="badge badge-normal"><Shield size={10} /> Core Module</span>
                ) : (
                  <button
                    onClick={() => toggleModule(m.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: m.isEnabled ? '#34d399' : '#f87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  >
                    <Power size={14} /> {m.isEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                )}
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{m.name}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
