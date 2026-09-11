import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, FileHeart, Calendar, ListOrdered, FlaskConical,
  Pill, CreditCard, BarChart3, FileSpreadsheet, Globe, ShieldCheck,
  Boxes, Key, Settings, Plug, LogOut, LucideIcon, HeartPulse, Layers,
  ChevronLeft, ChevronRight, Stethoscope, Activity, Cross, Building
} from 'lucide-react';

import { hasModuleAccess } from '../utils/permissions';

export type ModuleKey =
  | 'DASHBOARD' | 'PATIENTS' | 'TRIAGE' | 'EMR' | 'APPOINTMENTS' | 'QUEUE'
  | 'LAB' | 'PHARMACY' | 'BILLING' | 'REPORTS' | 'REPORT_BUILDER'
  | 'PATIENT_PORTAL' | 'USER_MGMT' | 'SERVICE_MGMT' | 'MODULE_MGMT' | 'API_MGMT'
  | 'SETTINGS' | 'INTEGRATIONS';

interface SidebarProps {
  activeModule: ModuleKey;
  userRoles?: string[];
  clinicName?: string;
  appIconName?: string;
  onSelectModule: (key: ModuleKey) => void;
  onLogout: () => void;
}

export const MODULE_ITEMS: { key: ModuleKey; label: string; category: string; icon: LucideIcon }[] = [
  { key: 'DASHBOARD', label: 'Dashboard', category: 'Core', icon: LayoutDashboard },
  { key: 'PATIENTS', label: 'Patient Registry', category: 'Clinical', icon: Users },
  { key: 'TRIAGE', label: 'Triage & Vitals', category: 'Clinical', icon: HeartPulse },
  { key: 'EMR', label: 'EMR & Consultation', category: 'Clinical', icon: FileHeart },
  { key: 'APPOINTMENTS', label: 'Appointments', category: 'Clinical', icon: Calendar },
  { key: 'QUEUE', label: 'Queue Board', category: 'Clinical', icon: ListOrdered },
  { key: 'LAB', label: 'Laboratory (LIS)', category: 'Clinical', icon: FlaskConical },
  { key: 'PHARMACY', label: 'Dispensary', category: 'Clinical', icon: Pill },
  { key: 'BILLING', label: 'Billing & Invoices', category: 'Financial', icon: CreditCard },
  { key: 'REPORTS', label: 'Standard Reports', category: 'Analytics', icon: BarChart3 },
  { key: 'REPORT_BUILDER', label: 'Report Builder', category: 'Analytics', icon: FileSpreadsheet },
  { key: 'PATIENT_PORTAL', label: 'Patient Portal', category: 'Portals', icon: Globe },
  { key: 'SERVICE_MGMT', label: 'Service Management', category: 'Admin', icon: Layers },
  { key: 'USER_MGMT', label: 'Users & RBAC', category: 'Admin', icon: ShieldCheck },
  { key: 'MODULE_MGMT', label: 'Module Manager', category: 'Admin', icon: Boxes },
  { key: 'API_MGMT', label: 'API & Webhooks', category: 'Admin', icon: Key },
  { key: 'SETTINGS', label: 'Clinic Settings', category: 'Admin', icon: Settings },
  { key: 'INTEGRATIONS', label: 'Integrations', category: 'Admin', icon: Plug },
];

const ICON_MAP: Record<string, LucideIcon> = {
  HeartPulse,
  Stethoscope,
  FileHeart,
  Activity,
  ShieldCheck,
  Building,
  Cross,
  FlaskConical,
};

export default function Sidebar({
  activeModule,
  userRoles = ['SuperAdmin'],
  clinicName: propClinicName,
  appIconName: propAppIconName,
  onSelectModule,
  onLogout
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [, setVersion] = useState(0);
  const [clinicName, setClinicName] = useState(propClinicName || 'AethelCMS');
  const [appIconName, setAppIconName] = useState(propAppIconName || 'FileHeart');

  useEffect(() => {
    if (propClinicName) setClinicName(propClinicName);
    if (propAppIconName) setAppIconName(propAppIconName);
  }, [propClinicName, propAppIconName]);

  const loadClinicBranding = async () => {
    try {
      const res = await fetch('/api/v1/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'x-tenant-id': '1'
        }
      });
      const data = await res.json();
      const payload = data?.Data || data?.data || data;
      if (Array.isArray(payload)) {
        payload.forEach((s: any) => {
          const k = s.settingKey || s.SettingKey;
          const v = s.settingValue || s.SettingValue;
          if (k === 'ClinicName' && v) setClinicName(v);
          if (k === 'AppIcon' && v) setAppIconName(v);
        });
      } else if (payload && typeof payload === 'object') {
        const name = payload.ClinicName || payload.clinicName;
        const icon = payload.AppIcon || payload.appIcon;
        if (name) setClinicName(name);
        if (icon) setAppIconName(icon);
      }
    } catch { /* keep defaults */ }
  };

  useEffect(() => {
    const handlePermChange = () => setVersion(v => v + 1);
    window.addEventListener('role_permissions_changed', handlePermChange);
    return () => window.removeEventListener('role_permissions_changed', handlePermChange);
  }, []);

  useEffect(() => {
    loadClinicBranding();
    const handleBrandingChange = () => loadClinicBranding();
    window.addEventListener('clinic_settings_changed', handleBrandingChange);
    return () => window.removeEventListener('clinic_settings_changed', handleBrandingChange);
  }, []);

  const AppLogoIcon = ICON_MAP[appIconName] || FileHeart;
  const visibleItems = MODULE_ITEMS.filter(item => hasModuleAccess(userRoles, item.key));
  const categories = Array.from(new Set(visibleItems.map(i => i.category)));

  return (
    <aside
      style={{
        width: isCollapsed ? '64px' : '230px',
        minWidth: isCollapsed ? '64px' : '230px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease'
      }}
    >
      <div
        style={{
          padding: isCollapsed ? '14px 10px' : '14px 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <div
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              width: '32px', height: '32px', minWidth: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(2,132,199,0.3)', cursor: 'pointer'
            }}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <AppLogoIcon color="#fff" size={17} />
          </div>
          {!isCollapsed && (
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <h2
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  lineHeight: 1.2,
                  whiteSpace: 'normal',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
                title={clinicName}
              >
                {clinicName}
              </h2>
              <span style={{ fontSize: '0.62rem', color: '#0369a1', fontWeight: 700, letterSpacing: '0.04em' }}>
                CLINICAL SUITE
              </span>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Collapse Sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, padding: isCollapsed ? '10px 6px' : '12px 8px', display: 'flex', flexDirection: 'column', gap: isCollapsed ? '8px' : '14px' }}>
        {categories.map(cat => (
          <div key={cat}>
            {!isCollapsed ? (
              <div style={{ padding: '0 8px 4px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {cat}
              </div>
            ) : (
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 6px 6px' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {visibleItems.filter(i => i.category === cat).map(item => {
                const Icon = item.icon;
                const isActive = activeModule === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onSelectModule(item.key)}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      gap: '9px', padding: isCollapsed ? '9px' : '7px 10px',
                      borderRadius: '6px',
                      background: isActive ? '#ffffff' : 'transparent',
                      border: isActive ? '1px solid #d0c7b7' : '1px solid transparent',
                      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                      color: isActive ? '#0369a1' : 'var(--text-secondary)',
                      fontWeight: isActive ? 700 : 500, fontSize: '0.8rem',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s ease'
                    }}
                  >
                    <Icon size={isCollapsed ? 18 : 15} color={isActive ? '#0284c7' : 'var(--text-muted)'} />
                    {!isCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {isCollapsed && (
        <div style={{ padding: '6px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setIsCollapsed(false)}
            style={{ background: '#ffffff', border: '1px solid var(--border-color)', color: '#0369a1', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px' }}
            title="Expand Sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div style={{ padding: isCollapsed ? '10px 6px' : '12px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={onLogout}
          title={isCollapsed ? 'Sign Out' : undefined}
          style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '8px', width: '100%', padding: isCollapsed ? '9px' : '7px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid transparent', color: '#b91c1c', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
        >
          <LogOut size={isCollapsed ? 18 : 15} color="#b91c1c" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
