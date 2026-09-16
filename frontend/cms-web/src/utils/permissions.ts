import { ModuleKey } from '../components/Sidebar';

export interface RolePermissionMap {
  [roleName: string]: ModuleKey[];
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMap = {
  SuperAdmin: [
    'DASHBOARD', 'PATIENTS', 'TRIAGE', 'EMR', 'INPATIENT', 'APPOINTMENTS', 'QUEUE', 'TELEMED',
    'LAB', 'PHARMACY', 'BILLING', 'REPORTS', 'REPORT_BUILDER',
    'PATIENT_PORTAL', 'SERVICE_MGMT', 'USER_MGMT', 'MODULE_MGMT', 'API_MGMT',
    'SETTINGS', 'INTEGRATIONS'
  ],
  Admin: [
    'DASHBOARD', 'PATIENTS', 'TRIAGE', 'EMR', 'INPATIENT', 'APPOINTMENTS', 'QUEUE', 'TELEMED',
    'LAB', 'PHARMACY', 'BILLING', 'REPORTS', 'REPORT_BUILDER',
    'SERVICE_MGMT', 'USER_MGMT', 'SETTINGS', 'INTEGRATIONS'
  ],
  Doctor: [
    'DASHBOARD', 'PATIENTS', 'TRIAGE', 'EMR', 'INPATIENT', 'APPOINTMENTS', 'QUEUE', 'TELEMED',
    'LAB', 'PHARMACY', 'REPORTS'
  ],
  Nurse: [
    'DASHBOARD', 'PATIENTS', 'TRIAGE', 'INPATIENT', 'APPOINTMENTS', 'QUEUE'
  ],
  LabTechnician: [
    'DASHBOARD', 'PATIENTS', 'LAB', 'QUEUE', 'INTEGRATIONS'
  ],
  Pharmacist: [
    'DASHBOARD', 'PATIENTS', 'PHARMACY', 'BILLING', 'QUEUE'
  ],
  BillingOfficer: [
    'DASHBOARD', 'PATIENTS', 'BILLING', 'QUEUE', 'REPORTS'
  ],
  Receptionist: [
    'DASHBOARD', 'PATIENTS', 'TRIAGE', 'APPOINTMENTS', 'QUEUE', 'BILLING'
  ],
  Radiologist: [
    'DASHBOARD', 'PATIENTS', 'EMR', 'QUEUE', 'REPORTS'
  ],
  Pathologist: [
    'DASHBOARD', 'PATIENTS', 'LAB', 'QUEUE', 'REPORTS'
  ]
};

export const PERMISSION_STORAGE_KEY = 'role_permissions_v1';

export function getRolePermissions(): RolePermissionMap {
  try {
    const saved = localStorage.getItem(PERMISSION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_ROLE_PERMISSIONS, ...parsed };
    }
  } catch (err) {
    console.error('Error loading role permissions from cache:', err);
  }
  return DEFAULT_ROLE_PERMISSIONS;
}

export async function initRolePermissions(): Promise<RolePermissionMap> {
  try {
    const res = await fetch('/api/v1/settings');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const found = json.data.find((s: any) => s.settingKey === 'RolePermissions' || s.SettingKey === 'RolePermissions');
        if (found && (found.settingValue || found.SettingValue)) {
          const remotePerms = JSON.parse(found.settingValue || found.SettingValue);
          const merged = { ...DEFAULT_ROLE_PERMISSIONS, ...remotePerms };
          localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify(merged));
          window.dispatchEvent(new Event('role_permissions_changed'));
          return merged;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch role permissions from backend, using cached/default:', err);
  }
  return getRolePermissions();
}

export async function saveRolePermissions(perms: RolePermissionMap): Promise<void> {
  try {
    // 1. Save to localStorage immediately for instant local UI responsiveness
    localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify(perms));
    window.dispatchEvent(new Event('role_permissions_changed'));

    // 2. Persist to backend ClinicSettings table
    await fetch('/api/v1/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settingKey: 'RolePermissions',
        settingValue: JSON.stringify(perms)
      })
    });
  } catch (err) {
    console.error('Error persisting role permissions to backend:', err);
  }
}

export function hasModuleAccess(userRoles: string[] = [], moduleKey: ModuleKey): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  
  // SuperAdmin has access to all modules
  if (userRoles.some(r => r.trim().toLowerCase() === 'superadmin')) return true;

  const permissions = getRolePermissions();
  for (const rawRole of userRoles) {
    const role = rawRole.trim();
    // Check direct match or case-insensitive match in permission keys
    const matchKey = Object.keys(permissions).find(k => k.toLowerCase() === role.toLowerCase()) || role;
    const allowed = permissions[matchKey];
    if (allowed && allowed.includes(moduleKey)) {
      return true;
    }
  }
  return false;
}
