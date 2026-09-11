import React, { useState, useEffect } from 'react';
import Sidebar, { ModuleKey, MODULE_ITEMS } from './components/Sidebar';
import Header from './components/Header';
import LoginPage from './pages/Auth/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import PatientsPage from './pages/Patients/PatientsPage';
import TriagePage from './pages/Triage/TriagePage';
import EmrSoapPage from './pages/EMR/EmrSoapPage';
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

  const [clinicName, setClinicName] = useState('AethelCMS');
  const [appIcon, setAppIcon] = useState('FileHeart');

  const updateFavicon = (iconName: string) => {
    try {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" fill="#0284c7"/><path d="M12 7v10M7 12h10" stroke="#ffffff" stroke-width="2.5"/></svg>`;
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

  // Sync role permissions and branding on startup
  useEffect(() => {
    initRolePermissions();
    loadBranding();
    const handleBrandingChange = () => loadBranding();
    window.addEventListener('clinic_settings_changed', handleBrandingChange);
    return () => window.removeEventListener('clinic_settings_changed', handleBrandingChange);
  }, []);

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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeModule={activeModule}
        userRoles={user?.roles || []}
        clinicName={clinicName}
        appIconName={appIcon}
        onSelectModule={(key) => setActiveModule(key)}
        onLogout={() => {
          setUser(null);
          setToken('');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('current_user');
        }}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', maxHeight: '100vh' }}>
        <Header
          title={currentModuleItem?.label || 'Executive Operations'}
          subtitle={`Module: ${currentModuleItem?.category || 'Core'} | Clinic Tenant #1 | On-Premise MSSQL Server Express`}
          user={user}
          clinicName={clinicName}
        />

        {/* Dynamic Module Views */}
        {activeModule === 'DASHBOARD' && <DashboardPage token={token} onNavigateModule={(key) => setActiveModule(key as ModuleKey)} />}
        {activeModule === 'PATIENTS' && <PatientsPage onSelectEmrPatient={navigateToEmrWithPatient} />}
        {activeModule === 'TRIAGE' && <TriagePage />}
        {activeModule === 'EMR' && <EmrSoapPage selectedPatientId={selectedEmrPatientId} currentUser={user} />}
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
      </main>
    </div>
  );
}
