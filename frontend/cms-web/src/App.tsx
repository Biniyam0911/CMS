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
    return {
      id: 1,
      username: 'admin',
      roles: ['SuperAdmin'],
      tenantId: 1
    };
  });
  const [token, setToken] = useState(localStorage.getItem('auth_token') || 'dev_session');
  const [activeModule, setActiveModule] = useState<ModuleKey>('DASHBOARD');
  const [selectedEmrPatientId, setSelectedEmrPatientId] = useState<number | null>(1);

  // Sync role permissions from backend on startup
  useEffect(() => {
    initRolePermissions();
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
