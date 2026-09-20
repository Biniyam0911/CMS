import React, { useState, useEffect } from 'react';
import Sidebar, { ModuleKey, MODULE_ITEMS } from './components/Sidebar';
import Header from './components/Header';
import LoginPage from './pages/Auth/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import PatientsPage from './pages/Patients/PatientsPage';
import TriagePage from './pages/Triage/TriagePage';
import EmrSoapPage from './pages/EMR/EmrSoapPage';
import InpatientPage from './pages/Inpatient/InpatientPage';
import AppointmentsPage from './pages/Appointments/AppointmentsPage';
import QueuePage from './pages/Queue/QueuePage';
import LaboratoryPage from './pages/Laboratory/LaboratoryPage';
import PharmacyPage from './pages/Pharmacy/PharmacyPage';
import BillingPage from './pages/Billing/BillingPage';
import ReportBuilderPage from './pages/ReportBuilder/ReportBuilderPage';
import ReportsLibraryPage from './pages/Reports/ReportsLibraryPage';
import PatientPortalPage from './pages/PatientPortal/PatientPortalPage';
import UserManagementPage from './pages/UserManagement/UserManagementPage';
import ServicesPage from './pages/Services/ServicesPage';
import ModuleManagementPage from './pages/ModuleManagement/ModuleManagementPage';
import ApiManagementPage from './pages/ApiManagement/ApiManagementPage';
import SettingsPage from './pages/Settings/SettingsPage';
import IntegrationsPage from './pages/Integrations/IntegrationsPage';
import TelemedQueuePage from './pages/Telemedicine/TelemedQueuePage';
import BottomNav from './components/BottomNav';
import PwaInstallBanner from './components/PwaInstallBanner';
import { initRolePermissions } from './utils/permissions';

export default function App() {
  const [user, setUser] = useState<{ id?: number; username: string; roles: string[]; tenantId: number; doctorId?: number; staffId?: number; name?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('current_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [activeModule, setActiveModule] = useState<ModuleKey>('DASHBOARD');
  const [selectedEmrPatientId, setSelectedEmrPatientId] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [clinicName, setClinicName] = useState('AethelCMS');
  const [appIcon, setAppIcon] = useState('FileHeart');

  const ICON_SVG_PATHS: Record<string, string> = {
    HeartPulse: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>`,
    Stethoscope: `<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>`,
    FileHeart: `<path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M10.29 10.7a2.43 2.43 0 0 0-2.66-.52c-.29.12-.56.3-.78.53l-.35.34-.35-.34a2.43 2.43 0 0 0-2.65-.53c-.3.12-.56.3-.79.53-.95.94-1 2.53.2 3.74L6.5 18l3.6-3.55c1.2-1.21 1.14-2.8.19-3.75z"/>`,
    Activity: `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`,
    ShieldCheck: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`,
    Building: `<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>`,
    Cross: `<path d="M12 6v12M6 12h12"/>`,
    FlaskConical: `<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>`
  };

  const updateFavicon = (iconName: string) => {
    try {
      const inner = ICON_SVG_PATHS[iconName] || ICON_SVG_PATHS['FileHeart'];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#0071e3"/><g transform="translate(4, 4)" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">${inner}</g></svg>`;
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    } catch {}
  };

  const loadBranding = async () => {
    try {
      const res = await fetch('/api/v1/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'x-tenant-id': '1'
        }
      });
      const data = await res.json();
      const payload = data?.Data || data?.data || data;
      let name = '';
      let icon = '';
      if (Array.isArray(payload)) {
        payload.forEach((s: any) => {
          const k = s.settingKey || s.SettingKey;
          const v = s.settingValue || s.SettingValue;
          if (k === 'ClinicName' && v) name = v;
          if (k === 'AppIcon' && v) icon = v;
        });
      }
      if (name) {
        setClinicName(name);
        document.title = `${name} — CMS`;
      }
      if (icon) {
        setAppIcon(icon);
        updateFavicon(icon);
      }
    } catch {}
  };

  const DEFAULT_THEME_VARS: Record<string, string> = {
    '--bg-dark': '#f5f5f7', '--bg-card': '#ffffff', '--bg-sidebar': '#ffffff', '--accent-blue': '#0071e3',
    '--accent-emerald': '#34c759', '--accent-rose': '#ff3b30', '--accent-amber': '#ff9500',
    '--text-main': '#1d1d1f', '--text-secondary': '#6e6e73', '--border-color': '#e5e5ea', '--card-radius': '14px'
  };
  const DEFAULT_FONT = "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const applyUserTheme = (username?: string) => {
    const uKey = username ? username.toLowerCase().trim() : (function() {
      try {
        const saved = localStorage.getItem('current_user');
        if (saved) {
          const u = JSON.parse(saved);
          if (u && (u.username || u.name)) return String(u.username || u.name).toLowerCase().trim();
        }
      } catch {}
      return 'default';
    })();

    let theme = DEFAULT_THEME_VARS;
    let font = DEFAULT_FONT;
    try {
      const rawTheme = localStorage.getItem(`cms_theme_user_${uKey}`);
      if (rawTheme) theme = { ...DEFAULT_THEME_VARS, ...JSON.parse(rawTheme) };
      const savedFont = localStorage.getItem(`cms_font_user_${uKey}`);
      if (savedFont) font = savedFont;
    } catch {}

    const root = document.documentElement;
    Object.entries(theme).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty('--bg-input', theme['--bg-card'] || '#ffffff');
    root.style.setProperty('--bg-card-hover', theme['--bg-card'] || '#ffffff');
    root.style.setProperty('--border-focus', theme['--accent-blue'] || '#0071e3');
    root.style.setProperty('--accent-cyan', theme['--accent-blue'] || '#0071e3');
    root.style.setProperty('--text-muted', theme['--text-secondary'] || '#6e6e73');
    root.style.setProperty('--font-family', font);
    root.style.setProperty('--font-heading', font);
  };

  // Sync role permissions, branding and per-user theme on startup
  useEffect(() => {
    initRolePermissions();
    loadBranding();
    applyUserTheme(user?.username);

    const handleBrandingChange = () => loadBranding();
    const handleUserThemeChange = () => applyUserTheme(user?.username);

    window.addEventListener('clinic_settings_changed', handleBrandingChange);
    window.addEventListener('cms_user_theme_changed', handleUserThemeChange);

    return () => {
      window.removeEventListener('clinic_settings_changed', handleBrandingChange);
      window.removeEventListener('cms_user_theme_changed', handleUserThemeChange);
    };
  }, [user]);

  if (!user || !token) {
    return (
      <LoginPage
        onLoginSuccess={(u, t) => {
          setUser(u);
          setToken(t);
          localStorage.setItem('auth_token', t);
          localStorage.setItem('current_user', JSON.stringify(u));
          initRolePermissions();
          loadBranding();
          applyUserTheme(u.username);
        }}
      />
    );
  }

  const navigateToEmrWithPatient = (patientId: number) => {
    setSelectedEmrPatientId(patientId);
    setActiveModule('EMR');
  };

  const currentModuleItem = MODULE_ITEMS.find(m => m.key === activeModule);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <PwaInstallBanner />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar Navigation */}
        <Sidebar
          activeModule={activeModule}
          userRoles={user?.roles || []}
          clinicName={clinicName}
          appIconName={appIcon}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onSelectModule={(key) => {
            setActiveModule(key);
            setIsMobileMenuOpen(false);
          }}
          onLogout={() => {
            setUser(null);
            setToken('');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('current_user');
            applyUserTheme('default');
          }}
        />

        {/* Main Content Area */}
        <main
          style={{
            flex: 1,
            padding: isMobile ? '12px 12px 84px 12px' : '28px 32px',
            overflowY: 'auto',
            maxHeight: isMobile ? '100vh' : '100vh',
            minWidth: 0
          }}
        >
          <Header
            title={currentModuleItem?.label || 'Executive Operations'}
            subtitle={`Module: ${currentModuleItem?.category || 'Core'} | Clinic Tenant #1 | On-Premise MSSQL Server Express`}
            user={user}
            clinicName={clinicName}
            appIconName={appIcon}
            onNavigateModule={(key) => setActiveModule(key)}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />

          {/* Dynamic Module Views */}
          {activeModule === 'DASHBOARD' && <DashboardPage token={token} onNavigateModule={(key) => setActiveModule(key as ModuleKey)} />}
          {activeModule === 'PATIENTS' && <PatientsPage onSelectEmrPatient={navigateToEmrWithPatient} />}
          {activeModule === 'TRIAGE' && <TriagePage />}
          {activeModule === 'EMR' && <EmrSoapPage selectedPatientId={selectedEmrPatientId} currentUser={user} />}
          {activeModule === 'INPATIENT' && <InpatientPage />}
          {activeModule === 'APPOINTMENTS' && <AppointmentsPage />}
          {activeModule === 'QUEUE' && <QueuePage />}
          {activeModule === 'LAB' && <LaboratoryPage />}
          {activeModule === 'PHARMACY' && <PharmacyPage />}
          {activeModule === 'BILLING' && <BillingPage />}
          {activeModule === 'REPORTS' && <ReportsLibraryPage />}
          {activeModule === 'REPORT_BUILDER' && <ReportBuilderPage />}
          {activeModule === 'PATIENT_PORTAL' && <PatientPortalPage />}
          {activeModule === 'SERVICE_MGMT' && <ServicesPage />}
          {activeModule === 'USER_MGMT' && <UserManagementPage />}
          {activeModule === 'MODULE_MGMT' && <ModuleManagementPage />}
          {activeModule === 'API_MGMT' && <ApiManagementPage />}
          {activeModule === 'SETTINGS' && <SettingsPage />}
          {activeModule === 'INTEGRATIONS' && <IntegrationsPage />}
          {activeModule === 'TELEMED' && <TelemedQueuePage />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeModule={activeModule}
        onSelectModule={(key) => {
          setActiveModule(key);
          setIsMobileMenuOpen(false);
        }}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />
    </div>
  );
}
