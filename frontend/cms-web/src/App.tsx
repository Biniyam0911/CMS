import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
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
import PayrollPage from './pages/Payroll/PayrollPage';
import ReportBuilderPage from './pages/ReportBuilder/ReportBuilderPage';
import ReportsLibraryPage from './pages/Reports/ReportsLibraryPage';
import DedicatedReportPage from './pages/Reports/DedicatedReportPage';
import PatientPortalPage from './pages/PatientPortal/PatientPortalPage';
import UserManagementPage from './pages/UserManagement/UserManagementPage';
import ServicesPage from './pages/Services/ServicesPage';
import ModuleManagementPage from './pages/ModuleManagement/ModuleManagementPage';
import ApiManagementPage from './pages/ApiManagement/ApiManagementPage';
import SettingsPage from './pages/Settings/SettingsPage';
import IntegrationsPage from './pages/Integrations/IntegrationsPage';
import TelemedQueuePage from './pages/Telemedicine/TelemedQueuePage';
import ChangePasswordPage from './pages/Auth/ChangePasswordPage';
import ChapaPaymentReturnPage from './pages/Billing/ChapaPaymentReturnPage';
import BottomNav from './components/BottomNav';
import PwaInstallBanner from './components/PwaInstallBanner';
import { initRolePermissions, hasModuleAccess } from './utils/permissions';

export default function App() {
  const [user, setUser] = useState<{ id?: number; username: string; roles: string[]; tenantId: number; doctorId?: number; staffId?: number; name?: string; firstName?: string; lastName?: string } | null>(() => {
    try {
      // Use sessionStorage — cleared on tab/browser close, not accessible cross-tab
      const saved = sessionStorage.getItem('current_user') || localStorage.getItem('current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && !parsed.name && (parsed.firstName || parsed.username)) {
          parsed.name = parsed.firstName ? `${parsed.firstName} ${parsed.lastName || ''}`.trim() : parsed.username;
        }
        return parsed;
      }
    } catch {}
    return null;
  });
  // Token is now an HttpOnly cookie managed by the server. We keep a minimal in-memory
  // indicator so App.tsx knows whether to show login or not.
  const [token, setToken] = useState<string | null>(() => {
    // If we have a saved user, assume the cookie is still valid (server will 401 if not)
    return sessionStorage.getItem('current_user') || localStorage.getItem('current_user') ? 'cookie' : null;
  });
  const [activeModule, setActiveModule] = useState<ModuleKey>('DASHBOARD');
  const [selectedEmrPatientId, setSelectedEmrPatientId] = useState<number | null>(null);
  const [disabledModules, setDisabledModules] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cms_disabled_modules');
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  // Session Inactivity Timeout State
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutSecondsRemaining, setTimeoutSecondsRemaining] = useState(60);

  const handleLogout = (reason?: string) => {
    // Tell backend to clear the HttpOnly cookie
    fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    setToken(null);
    setActiveModule('DASHBOARD');
    setSelectedEmrPatientId(null);
    // Clear both storage locations
    sessionStorage.removeItem('current_user');
    localStorage.removeItem('current_user');
    localStorage.removeItem('auth_token'); // Legacy cleanup
    applyUserTheme('default');
    setShowTimeoutWarning(false);
    if (reason) {
      sessionStorage.setItem('cms_logout_reason', reason);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for session expiry from apiClient (401 response)
  useEffect(() => {
    const onExpired = () => handleLogout('Your session has expired. Please log in again.');
    window.addEventListener('cms_session_expired', onExpired);
    return () => window.removeEventListener('cms_session_expired', onExpired);
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
          if (k === 'SessionTimeoutMinutes' && v) {
            localStorage.setItem('cms_session_timeout_minutes', v);
          }
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
    const handleModuleStateChange = () => {
      try {
        const saved = localStorage.getItem('cms_disabled_modules');
        setDisabledModules(saved ? new Set<string>(JSON.parse(saved)) : new Set<string>());
      } catch {}
    };

    window.addEventListener('clinic_settings_changed', handleBrandingChange);
    window.addEventListener('cms_user_theme_changed', handleUserThemeChange);
    window.addEventListener('module_state_changed', handleModuleStateChange);

    return () => {
      window.removeEventListener('clinic_settings_changed', handleBrandingChange);
      window.removeEventListener('cms_user_theme_changed', handleUserThemeChange);
      window.removeEventListener('module_state_changed', handleModuleStateChange);
    };
  }, [user]);

  // Idle Inactivity Tracker for Configurable Session Timeout
  useEffect(() => {
    if (!user || !token) return;

    let lastActivity = Date.now();
    const updateActivity = () => {
      lastActivity = Date.now();
      setShowTimeoutWarning(prev => (prev ? false : prev));
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(ev => window.addEventListener(ev, updateActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const configuredMinutes = Math.max(1, Number(localStorage.getItem('cms_session_timeout_minutes') || '10'));
      const timeoutMs = configuredMinutes * 60 * 1000;
      const warningThresholdMs = timeoutMs - (60 * 1000); // 60s before timeout
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= timeoutMs) {
        handleLogout(`Your session expired due to ${configuredMinutes} minutes of inactivity.`);
      } else if (elapsed >= warningThresholdMs && timeoutMs > 60000) {
        setShowTimeoutWarning(true);
        setTimeoutSecondsRemaining(Math.max(1, Math.ceil((timeoutMs - elapsed) / 1000)));
      } else {
        setShowTimeoutWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, updateActivity));
      clearInterval(checkInterval);
    };
  }, [user, token]);

  // Public route: Chapa payment return / receipt page (accessible without login)
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/payment/chapa/return')) {
    return <ChapaPaymentReturnPage />;
  }

  if (!user || !token) {
    return (
      <LoginPage
        onLoginSuccess={(u, t) => {
          const normalizedUser = {
            ...u,
            name: u.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username)
          };
          setUser(normalizedUser);
          // Token is in the HttpOnly cookie set by the server — we use 'cookie' as a presence indicator
          setToken('cookie');
          // Store user profile in sessionStorage and localStorage for multi-tab support
          sessionStorage.setItem('current_user', JSON.stringify(normalizedUser));
          localStorage.setItem('current_user', JSON.stringify(normalizedUser));
          // Clean up any legacy localStorage auth token
          localStorage.removeItem('auth_token');
          initRolePermissions();
          loadBranding();
          applyUserTheme(normalizedUser.username);

          // Navigate to the first module this user is allowed to access
          const firstAllowed = MODULE_ITEMS.find(
            m => m.key !== 'CHANGE_PASSWORD' && hasModuleAccess(normalizedUser.roles, m.key)
          );
          setActiveModule(firstAllowed ? firstAllowed.key : 'DASHBOARD');
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
          onLogout={() => handleLogout()}
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
          {/* Module Disabled Guard — show blocked screen if module is toggled off in Module Manager */}
          {disabledModules.has(activeModule) ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '18px', textAlign: 'center' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fca5a5' }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px' }}>Module Disabled</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0, maxWidth: '360px', lineHeight: 1.6 }}>
                  The <strong>{currentModuleItem?.label || activeModule}</strong> module has been disabled by your system administrator.<br />
                  Please contact your administrator to re-enable it.
                </p>
              </div>
              <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#94a3b8', padding: '4px 10px', background: '#f1f5f9', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                MODULE CODE: {activeModule}
              </span>
            </div>
          ) : activeModule === 'DASHBOARD' ? <DashboardPage token={token} onNavigateModule={(key) => setActiveModule(key as ModuleKey)} /> : null}

          {!disabledModules.has(activeModule) && activeModule === 'PATIENTS' && <PatientsPage onSelectEmrPatient={navigateToEmrWithPatient} />}
          {!disabledModules.has(activeModule) && activeModule === 'TRIAGE' && <TriagePage />}
          {!disabledModules.has(activeModule) && activeModule === 'EMR' && <EmrSoapPage selectedPatientId={selectedEmrPatientId} currentUser={user} />}
          {!disabledModules.has(activeModule) && activeModule === 'INPATIENT' && <InpatientPage />}
          {!disabledModules.has(activeModule) && activeModule === 'APPOINTMENTS' && <AppointmentsPage />}
          {!disabledModules.has(activeModule) && activeModule === 'QUEUE' && <QueuePage />}
          {!disabledModules.has(activeModule) && activeModule === 'LAB' && <LaboratoryPage />}
          {!disabledModules.has(activeModule) && activeModule === 'PHARMACY' && <PharmacyPage />}
          {!disabledModules.has(activeModule) && activeModule === 'BILLING' && <BillingPage />}
          {!disabledModules.has(activeModule) && activeModule === 'PAYROLL' && <PayrollPage />}
          {!disabledModules.has(activeModule) && activeModule === 'REPORTS' && <ReportsLibraryPage />}
          {!disabledModules.has(activeModule) && activeModule === 'REPORT_SALES' && <DedicatedReportPage reportType="REPORT_SALES" />}
          {!disabledModules.has(activeModule) && activeModule === 'REPORT_AGE_STRATIFIED' && <DedicatedReportPage reportType="REPORT_AGE_STRATIFIED" />}
          {!disabledModules.has(activeModule) && activeModule === 'REPORT_SEX_STRATIFIED' && <DedicatedReportPage reportType="REPORT_SEX_STRATIFIED" />}
          {!disabledModules.has(activeModule) && activeModule === 'REPORT_DOCTOR_PERFORMANCE' && <DedicatedReportPage reportType="REPORT_DOCTOR_PERFORMANCE" />}
          {!disabledModules.has(activeModule) && activeModule === 'REPORT_DIAGNOSIS' && <DedicatedReportPage reportType="REPORT_DIAGNOSIS" />}
          {!disabledModules.has(activeModule) && activeModule === 'REPORT_PROCEDURE' && <DedicatedReportPage reportType="REPORT_PROCEDURE" />}
          {!disabledModules.has(activeModule) && activeModule === 'REPORT_BUILDER' && <ReportBuilderPage />}
          {!disabledModules.has(activeModule) && activeModule === 'PATIENT_PORTAL' && <PatientPortalPage />}
          {!disabledModules.has(activeModule) && activeModule === 'SERVICE_MGMT' && <ServicesPage />}
          {!disabledModules.has(activeModule) && activeModule === 'USER_MGMT' && <UserManagementPage />}
          {activeModule === 'MODULE_MGMT' && <ModuleManagementPage />}
          {!disabledModules.has(activeModule) && activeModule === 'API_MGMT' && <ApiManagementPage />}
          {activeModule === 'SETTINGS' && <SettingsPage />}
          {!disabledModules.has(activeModule) && activeModule === 'INTEGRATIONS' && <IntegrationsPage />}
          {!disabledModules.has(activeModule) && activeModule === 'TELEMED' && <TelemedQueuePage />}
          {activeModule === 'CHANGE_PASSWORD' && <ChangePasswordPage currentUser={user} />}
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

      {/* Session Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(5px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '16px',
            padding: '26px 28px',
            maxWidth: '430px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            border: '2px solid #f59e0b',
            textAlign: 'center'
          }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Clock size={28} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
              Inactivity Session Timeout
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px 0', lineHeight: 1.45 }}>
              You have been inactive. For clinical data security and patient privacy, your session will automatically close in:
            </p>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#dc2626', fontFamily: 'monospace', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>
              {timeoutSecondsRemaining}s
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowTimeoutWarning(false)}
                className="btn-primary"
                style={{ flex: 1, padding: '10px 16px', fontWeight: 700 }}
              >
                Stay Logged In
              </button>
              <button
                type="button"
                onClick={() => handleLogout('Logged out by user.')}
                className="btn-secondary"
                style={{ flex: 1, padding: '10px 16px' }}
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
