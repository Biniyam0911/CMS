/**
 * =========================================================================================
 * HEALTHCARELINK CLINIC MANAGEMENT SYSTEM (CMS) - SIDEBAR COMPONENT
 * =========================================================================================
 * Clean, modern HealthcareLink UI styling with preserved original module names & categories:
 * - Brand header with teal/cyan medical cross
 * - Facility / Clinic card
 * - Standalone active Dashboard item (soft pastel blue pill)
 * - Category groups: CLINICAL, FINANCIAL, REPORTS, PORTALS, ADMIN
 * - Restored original menu titles (Triage & Vitals, EMR & Consultation, Patient Registry, etc.)
 * - Pinned bottom Account section (Change Password, Sign Out)
 * =========================================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, FileHeart, Calendar, ListOrdered, FlaskConical,
  Pill, CreditCard, BarChart3, FileSpreadsheet, Globe, ShieldCheck,
  Boxes, Key, Settings, Plug, LogOut, LucideIcon, HeartPulse, Layers,
  ChevronLeft, ChevronRight, Stethoscope, Activity, Building2, Bed, Video, X, KeyRound,
  DollarSign, Coins, Palette, ClipboardList, Baby, Sparkles, Package
} from 'lucide-react';

import { hasModuleAccess } from '../utils/permissions';
import './Sidebar.css';

export type ModuleKey =
  | 'DASHBOARD' | 'PATIENTS' | 'TRIAGE' | 'EMR' | 'ANC' | 'INPATIENT' | 'APPOINTMENTS' | 'QUEUE'
  | 'FACIAL' | 'COSMETICS' | 'LAB' | 'PHARMACY' | 'BILLING' | 'PAYROLL' | 'REPORTS' | 'REPORT_BUILDER'
  | 'REPORT_SALES' | 'REPORT_COSMETICS_SALES' | 'REPORT_AGE_STRATIFIED' | 'REPORT_SEX_STRATIFIED' | 'REPORT_DOCTOR_PERFORMANCE' | 'REPORT_DIAGNOSIS' | 'REPORT_PROCEDURE' | 'REPORT_MY_PATIENT_SUMMARY' | 'REPORT_NURSE_ORDERS' | 'REPORT_FACIAL_PLC' | 'REPORT_FACIAL_OTHER'
  | 'PATIENT_PORTAL' | 'USER_MGMT' | 'SERVICE_MGMT' | 'MODULE_MGMT' | 'API_MGMT'
  | 'SETTINGS' | 'APPEARANCE' | 'INTEGRATIONS' | 'AUDIT_LOG' | 'TELEMED' | 'CHANGE_PASSWORD';

interface SidebarProps {
  activeModule: ModuleKey;
  userRoles?: string[];
  clinicName?: string;
  appIconName?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onSelectModule: (key: ModuleKey) => void;
  onLogout: () => void;
}

export const MODULE_ITEMS: { key: ModuleKey; label: string; category: string; icon: LucideIcon }[] = [
  // Standalone Core
  { key: 'DASHBOARD', label: 'Dashboard', category: 'Core', icon: LayoutDashboard },

  // Clinical
  { key: 'PATIENTS', label: 'Patient Registry', category: 'Clinical', icon: Users },
  { key: 'TRIAGE', label: 'Triage & Vitals', category: 'Clinical', icon: HeartPulse },
  { key: 'EMR', label: 'EMR & Consultation', category: 'Clinical', icon: FileHeart },
  { key: 'FACIAL', label: 'Facial', category: 'Clinical', icon: Sparkles },
  { key: 'COSMETICS', label: 'Cosmetics', category: 'Clinical', icon: Package },
  { key: 'ANC', label: 'Antenatal Care (ANC)', category: 'Clinical', icon: Baby },
  { key: 'INPATIENT', label: 'Inpatient & Beds', category: 'Clinical', icon: Bed },
  { key: 'APPOINTMENTS', label: 'Appointments', category: 'Clinical', icon: Calendar },
  { key: 'QUEUE', label: 'Queue Board', category: 'Clinical', icon: ListOrdered },
  { key: 'TELEMED', label: 'Telemedicine', category: 'Clinical', icon: Video },
  { key: 'LAB', label: 'Laboratory (LIS)', category: 'Clinical', icon: FlaskConical },
  { key: 'PHARMACY', label: 'Dispensary', category: 'Clinical', icon: Pill },

  // Financial
  { key: 'BILLING', label: 'Billing & Invoices', category: 'Financial', icon: CreditCard },
  { key: 'PAYROLL', label: 'Doctor Payroll', category: 'Financial', icon: Coins },

  // Reports
  { key: 'REPORT_SALES', label: 'Sales Report', category: 'Reports', icon: DollarSign },
  { key: 'REPORT_COSMETICS_SALES', label: 'Cosmetics Sales Report', category: 'Reports', icon: Package },
  { key: 'REPORT_FACIAL_PLC', label: 'Facial PLC Report', category: 'Reports', icon: Sparkles },
  { key: 'REPORT_FACIAL_OTHER', label: 'Other Facial Report', category: 'Reports', icon: Activity },
  { key: 'REPORT_AGE_STRATIFIED', label: 'Age Stratified Report', category: 'Reports', icon: BarChart3 },
  { key: 'REPORT_SEX_STRATIFIED', label: 'Sex Stratified Report', category: 'Reports', icon: Users },
  { key: 'REPORT_DOCTOR_PERFORMANCE', label: 'Doctor Performance', category: 'Reports', icon: Stethoscope },
  { key: 'REPORT_MY_PATIENT_SUMMARY', label: 'My Patient Summary', category: 'Reports', icon: FileHeart },
  { key: 'REPORT_DIAGNOSIS', label: 'Diagnosis Report', category: 'Reports', icon: FileHeart },
  { key: 'REPORT_PROCEDURE', label: 'Procedure Report', category: 'Reports', icon: Activity },
  { key: 'REPORT_NURSE_ORDERS', label: 'Nurse Order Follow-up', category: 'Reports', icon: ClipboardList },
  { key: 'REPORT_BUILDER', label: 'Report Builder', category: 'Reports', icon: FileSpreadsheet },

  // Portals
  { key: 'PATIENT_PORTAL', label: 'Patient Portal', category: 'Portals', icon: Globe },

  // Admin
  { key: 'SERVICE_MGMT', label: 'Service Management', category: 'Admin', icon: Layers },
  { key: 'USER_MGMT', label: 'Users & RBAC', category: 'Admin', icon: ShieldCheck },
  { key: 'AUDIT_LOG', label: 'Audit Log', category: 'Admin', icon: ShieldCheck },
  { key: 'MODULE_MGMT', label: 'Module Manager', category: 'Admin', icon: Boxes },
  { key: 'API_MGMT', label: 'API & Webhooks', category: 'Admin', icon: Key },
  { key: 'SETTINGS', label: 'Clinic Settings', category: 'Admin', icon: Settings },
  { key: 'APPEARANCE', label: 'Appearance', category: 'Admin', icon: Palette },
  { key: 'INTEGRATIONS', label: 'Integrations', category: 'Admin', icon: Plug },
];

export default function Sidebar({
  activeModule,
  userRoles = ['SuperAdmin'],
  clinicName: propClinicName,
  appIconName: propAppIconName,
  isMobileOpen = false,
  onCloseMobile,
  onSelectModule,
  onLogout
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [, setVersion] = useState(0);
  const [clinicName, setClinicName] = useState(() => {
    try {
      return localStorage.getItem('cms_clinic_name') || propClinicName || 'General Health Clinic';
    } catch {
      return propClinicName || 'General Health Clinic';
    }
  });
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (propClinicName) setClinicName(propClinicName);
  }, [propClinicName]);

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
          if (k === 'ClinicName' && v) {
            setClinicName(v);
            try { localStorage.setItem('cms_clinic_name', v); } catch {}
          }
        });
      } else if (payload && typeof payload === 'object') {
        const name = payload.ClinicName || payload.clinicName;
        if (name) {
          setClinicName(name);
          try { localStorage.setItem('cms_clinic_name', name); } catch {}
        }
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

  const [pinnedReports, setPinnedReports] = useState<any[]>(() => {
    try {
      const s = localStorage.getItem('pinned_custom_reports');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleReportsChanged = () => {
      try {
        const s = localStorage.getItem('pinned_custom_reports');
        setPinnedReports(s ? JSON.parse(s) : []);
      } catch {}
    };
    window.addEventListener('sidebar_reports_changed', handleReportsChanged);
    return () => window.removeEventListener('sidebar_reports_changed', handleReportsChanged);
  }, []);

  const visibleItems = MODULE_ITEMS.filter(item => hasModuleAccess(userRoles, item.key));

  const dashboardItem = visibleItems.find(i => i.key === 'DASHBOARD');
  const clinicalItems = visibleItems.filter(i => i.category === 'Clinical');
  const financialItems = visibleItems.filter(i => i.category === 'Financial');
  const reportsItems = visibleItems.filter(i => i.category === 'Reports');
  const portalsItems = visibleItems.filter(i => i.category === 'Portals');
  const adminItems = visibleItems.filter(i => i.category === 'Admin');

  const handleItemClick = (key: ModuleKey) => {
    onSelectModule(key);
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const effectiveCollapsed = isMobile ? false : isCollapsed;

  const renderSection = (title: string, items: typeof MODULE_ITEMS, extraChildren?: React.ReactNode) => {
    if (items.length === 0 && !extraChildren) return null;
    return (
      <div style={{ marginBottom: '6px' }}>
        {!effectiveCollapsed ? (
          <div className="sidebar-group-header">{title}</div>
        ) : (
          <div className="sidebar-group-divider" />
        )}
        <div className="sidebar-group-list">
          {items.map(item => {
            const Icon = item.icon;
            const isActive = activeModule === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`sidebar-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => handleItemClick(item.key)}
                title={effectiveCollapsed ? item.label : undefined}
              >
                <Icon size={18} className="nav-icon" />
                {!effectiveCollapsed && <span className="nav-label">{item.label}</span>}
              </button>
            );
          })}
          {extraChildren}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobile && isMobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 8999,
            transition: 'opacity 0.25s ease'
          }}
        />
      )}

      <aside
        className={`healthcare-sidebar ${effectiveCollapsed ? 'sidebar-collapsed' : ''}`}
        style={{
          width: isMobile ? '280px' : (effectiveCollapsed ? '72px' : '250px'),
          minWidth: isMobile ? '280px' : (effectiveCollapsed ? '72px' : '250px'),
          maxWidth: isMobile ? '85vw' : undefined,
          transition: isMobile 
            ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' 
            : 'width 0.2s ease, min-width 0.2s ease',
          position: isMobile ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          transform: isMobile ? (isMobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          boxShadow: isMobile && isMobileOpen ? '10px 0 35px rgba(0, 0, 0, 0.15)' : 'none'
        }}
      >
        {/* Brand Header */}
        <div className="sidebar-brand-wrapper">
          <div 
            className="sidebar-brand-identity"
            onClick={() => handleItemClick('DASHBOARD')}
            title={clinicName}
          >
            <div className="sidebar-brand-cross-icon" />
            {!effectiveCollapsed && (
              <h1 className="sidebar-brand-title" title={clinicName}>
                {clinicName}
              </h1>
            )}
          </div>

          {/* Desktop collapse toggle or Mobile close button */}
          {isMobile ? (
            <button
              onClick={onCloseMobile}
              className="sidebar-collapse-btn"
              title="Close Navigation"
            >
              <X size={18} />
            </button>
          ) : (
            !effectiveCollapsed && (
              <button
                onClick={() => setIsCollapsed(true)}
                className="sidebar-collapse-btn"
                title="Collapse Sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            )
          )}
        </div>

        {/* Facility / Clinic Card */}
        <div className="sidebar-facility-card" title={clinicName}>
          <div className="sidebar-facility-icon-badge">
            <Building2 size={18} />
          </div>
          {!effectiveCollapsed && (
            <div className="sidebar-facility-info">
              <div className="sidebar-facility-name">{clinicName}</div>
              <div className="sidebar-facility-badge">Clinical Operating System</div>
            </div>
          )}
        </div>

        {/* Expand button when collapsed on desktop */}
        {!isMobile && effectiveCollapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
            <button
              onClick={() => setIsCollapsed(false)}
              className="sidebar-collapse-btn"
              style={{ width: '34px', height: '34px' }}
              title="Expand Sidebar"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Navigation Groups Container */}
        <div className="sidebar-nav-container">
          {/* 1. Standalone Dashboard Item */}
          {dashboardItem && (
            <div style={{ marginBottom: '8px' }}>
              <button
                type="button"
                className={`sidebar-nav-link ${activeModule === 'DASHBOARD' ? 'active' : ''}`}
                onClick={() => handleItemClick('DASHBOARD')}
                title={effectiveCollapsed ? 'Dashboard' : undefined}
              >
                <LayoutDashboard size={18} className="nav-icon" />
                {!effectiveCollapsed && <span className="nav-label">Dashboard</span>}
              </button>
            </div>
          )}

          {/* 2. CLINICAL Group */}
          {renderSection('CLINICAL', clinicalItems)}

          {/* 3. FINANCIAL Group */}
          {renderSection('FINANCIAL', financialItems)}

          {/* 4. REPORTS Group */}
          {renderSection(
            'REPORTS',
            reportsItems,
            pinnedReports.map(prep => (
              <button
                key={`pinned-${prep.id}`}
                type="button"
                className="sidebar-nav-link"
                style={{ background: 'rgba(2, 132, 199, 0.05)', color: '#0284c7' }}
                onClick={() => {
                  onSelectModule('REPORT_BUILDER');
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('open_custom_report', { detail: prep }));
                  }, 50);
                  if (isMobile && onCloseMobile) onCloseMobile();
                }}
                title={effectiveCollapsed ? `Custom: ${prep.name}` : undefined}
              >
                <FileSpreadsheet size={18} className="nav-icon" style={{ color: '#0284c7' }} />
                {!effectiveCollapsed && <span className="nav-label">{prep.name}</span>}
              </button>
            ))
          )}

          {/* 5. PORTALS Group */}
          {renderSection('PORTALS', portalsItems)}

          {/* 6. ADMIN Group */}
          {renderSection('ADMIN', adminItems)}
        </div>

        {/* Bottom Section (Account & Sign Out) */}
        <div className="sidebar-utilities-section">
          {hasModuleAccess(userRoles, 'CHANGE_PASSWORD') && (
            <button
              type="button"
              className={`sidebar-nav-link ${activeModule === 'CHANGE_PASSWORD' ? 'active' : ''}`}
              onClick={() => handleItemClick('CHANGE_PASSWORD')}
              title={effectiveCollapsed ? 'Change Password' : undefined}
            >
              <KeyRound size={18} className="nav-icon" />
              {!effectiveCollapsed && <span className="nav-label">Change Password</span>}
            </button>
          )}

          <button
            type="button"
            className="sidebar-nav-link sidebar-signout-link"
            onClick={onLogout}
            title={effectiveCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={18} className="nav-icon" />
            {!effectiveCollapsed && <span className="nav-label">Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
