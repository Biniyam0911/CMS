import { ModuleKey } from '../components/Sidebar';

export interface NotificationEventDef {
  key: string;
  name: string;
  category: 'Critical' | 'Clinical' | 'Pharmacy' | 'Billing' | 'System';
  description: string;
  targetModule: ModuleKey;
  defaultRoles: string[];
  color: string;
}

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  {
    key: 'EmergencyTriage',
    name: 'Emergency Triage & Critical Vitals',
    category: 'Critical',
    description: 'Patient vitals flagged as Emergency / Red triage category requiring immediate intervention',
    targetModule: 'TRIAGE',
    defaultRoles: ['SuperAdmin', 'Admin', 'Doctor', 'Nurse'],
    color: '#ff3b30'
  },
  {
    key: 'CriticalLabResult',
    name: 'Critical Laboratory Analyte Alert',
    category: 'Critical',
    description: 'Diagnostic test result outside biological panic reference ranges',
    targetModule: 'LAB',
    defaultRoles: ['SuperAdmin', 'Admin', 'Doctor', 'LabTechnician'],
    color: '#af52de'
  },
  {
    key: 'PatientCheckIn',
    name: 'Patient Checked In & Waiting',
    category: 'Clinical',
    description: 'Patient arrived, ticket assigned, and added to the waiting queue',
    targetModule: 'QUEUE',
    defaultRoles: ['Doctor', 'Nurse', 'Receptionist'],
    color: '#0071e3'
  },
  {
    key: 'NewPrescription',
    name: 'New Prescription Issued',
    category: 'Pharmacy',
    description: 'Doctor issued electronic prescription awaiting pharmacy dispensary fulfillment',
    targetModule: 'PHARMACY',
    defaultRoles: ['Pharmacist', 'Admin'],
    color: '#34c759'
  },
  {
    key: 'MedicationLowStock',
    name: 'Formulary Drug Low Stock Warning',
    category: 'Pharmacy',
    description: 'Medication inventory stock has dropped below minimum safe reorder threshold',
    targetModule: 'PHARMACY',
    defaultRoles: ['Pharmacist', 'Admin', 'SuperAdmin'],
    color: '#ff9500'
  },
  {
    key: 'InvoicePending',
    name: 'Invoice Issued & Awaiting Payment',
    category: 'Billing',
    description: 'New clinical invoice generated awaiting settlement at cashier counter',
    targetModule: 'BILLING',
    defaultRoles: ['BillingOfficer', 'Admin'],
    color: '#f59e0b'
  },
  {
    key: 'PaymentSettled',
    name: 'Patient Payment Finalized',
    category: 'Billing',
    description: 'Invoice successfully settled in full and official receipt generated',
    targetModule: 'BILLING',
    defaultRoles: ['BillingOfficer', 'Admin', 'SuperAdmin'],
    color: '#10b981'
  },
  {
    key: 'SystemSecurity',
    name: 'Security & Role Privilege Changes',
    category: 'System',
    description: 'User access levels, permissions, or system credentials modified',
    targetModule: 'USER_MGMT',
    defaultRoles: ['SuperAdmin', 'Admin'],
    color: '#6e6e73'
  }
];

export type RoleNotificationMatrix = Record<string, string[]>; // EventKey -> array of RoleNames

export const DEFAULT_ROLE_RULES: RoleNotificationMatrix = {
  EmergencyTriage: ['SuperAdmin', 'Admin', 'Doctor', 'Nurse'],
  CriticalLabResult: ['SuperAdmin', 'Admin', 'Doctor', 'LabTechnician'],
  PatientCheckIn: ['Doctor', 'Nurse', 'Receptionist'],
  NewPrescription: ['Pharmacist', 'Admin'],
  MedicationLowStock: ['Pharmacist', 'Admin', 'SuperAdmin'],
  InvoicePending: ['BillingOfficer', 'Admin'],
  PaymentSettled: ['BillingOfficer', 'Admin', 'SuperAdmin'],
  SystemSecurity: ['SuperAdmin', 'Admin']
};

const STORAGE_KEY = 'cms_role_notification_rules';

export function getRoleNotificationRules(): RoleNotificationMatrix {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_ROLE_RULES, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_ROLE_RULES;
}

export function saveRoleNotificationRules(rules: RoleNotificationMatrix): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  window.dispatchEvent(new CustomEvent('cms_notification_rules_changed', { detail: rules }));
}

export function isUserSubscribedToEvent(eventKey: string, userRoles: string[]): boolean {
  if (userRoles.includes('SuperAdmin')) return true;
  const rules = getRoleNotificationRules();
  const subscribedRoles = rules[eventKey] || DEFAULT_ROLE_RULES[eventKey] || [];
  return userRoles.some(r => subscribedRoles.includes(r));
}