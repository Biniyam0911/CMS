import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, UserPlus, Key, Lock, Check, X, Shield, RefreshCw,
  Loader2, Users, CheckCircle2, RotateCcw, Save, Eye, Layers, Settings,
  Edit3, Stethoscope, Briefcase, Bell, Send, Volume2, Flame, Pill, FlaskConical, DollarSign, Search,
  Plus, Trash2
} from 'lucide-react';
import { api } from '../../api/apiClient';
import { MODULE_ITEMS, ModuleKey } from '../../components/Sidebar';
import {
  getRolePermissions,
  initRolePermissions,
  saveRolePermissions,
  DEFAULT_ROLE_PERMISSIONS,
  RolePermissionMap
} from '../../utils/permissions';
import {
  NOTIFICATION_EVENTS,
  getRoleNotificationRules,
  saveRoleNotificationRules,
  DEFAULT_ROLE_RULES,
  RoleNotificationMatrix
} from '../../utils/notificationRules';

export default function UserManagementPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'permissions' | 'notifications' | 'audit'>('users');

  // HIPAA Compliance Audit State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditTableFilter, setAuditTableFilter] = useState('');
  const [auditOpFilter, setAuditOpFilter] = useState('');

  // Users & Staff State
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State for Users
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');

  // Search for Notifications
  const [notifSearchQuery, setNotifSearchQuery] = useState('');

  // Modal States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<any>(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<any>(null);
  const [showEditStaffModal, setShowEditStaffModal] = useState<any>(null);

  // Reset Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('Admin@123');
  const [newRoleId, setNewRoleId] = useState(3);

  // Role Permissions Editor State
  const [rolePermissions, setRolePermissions] = useState<RolePermissionMap>(getRolePermissions());
  const [selectedRole, setSelectedRole] = useState<string>('Doctor');
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [permSearchQuery, setPermSearchQuery] = useState('');

  // Notification Manager State
  const [notificationRules, setNotificationRules] = useState<RoleNotificationMatrix>(getRoleNotificationRules());
  const [testEventType, setTestEventType] = useState<string>('EmergencyTriage');
  const [testTargetRole, setTestTargetRole] = useState<string>('All');
  const [testMessage, setTestMessage] = useState<string>('Emergency: Vital signs critical. Immediate attention requested in Triage Room 1.');
  const [testSending, setTestSending] = useState(false);

  const handleToggleNotificationRole = (eventKey: string, roleName: string) => {
    const currentRoles = notificationRules[eventKey] || DEFAULT_ROLE_RULES[eventKey] || [];
    let updated: string[];
    if (currentRoles.includes(roleName)) {
      updated = currentRoles.filter(r => r !== roleName);
    } else {
      updated = [...currentRoles, roleName];
    }
    setNotificationRules({
      ...notificationRules,
      [eventKey]: updated
    });
  };

  const handleSaveNotificationRules = async () => {
    saveRoleNotificationRules(notificationRules);
    try {
      await api.post('/notifications/rules', { settingKey: 'Notification.RoleRules', settingValue: JSON.stringify(notificationRules) });
    } catch {}
    setSaveSuccessToast('✓ Role notification rules saved successfully to database and active clinic profile!');
    setTimeout(() => setSaveSuccessToast(null), 4000);
  };

  const handleResetNotificationDefaults = () => {
    setNotificationRules(DEFAULT_ROLE_RULES);
  };

  const handleSendTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestSending(true);
    const eventDef = NOTIFICATION_EVENTS.find(ev => ev.key === testEventType);
    const subject = eventDef?.name || 'Clinical Alert';
    const notifItem = {
      id: Date.now(),
      subject,
      body: testMessage,
      priority: eventDef?.category === 'Critical' ? 1 : 2,
      notificationType: testEventType,
      statusId: 1,
      createdAt: new Date().toISOString(),
      targetRole: testTargetRole
    };

    try {
      await api.post('/notifications/broadcast', {
        subject,
        body: testMessage,
        notificationType: testEventType,
        targetRole: testTargetRole === 'All' ? null : testTargetRole,
        priority: eventDef?.category === 'Critical' ? 1 : 2
      });
    } catch {}

    // Dispatch locally so UI immediately fires Toast and increments Bell
    window.dispatchEvent(new CustomEvent('cms_new_notification', { detail: notifItem }));
    setTestSending(false);
    setSaveSuccessToast(`✓ Test alert "${subject}" sent to ${testTargetRole}!`);
    setTimeout(() => setSaveSuccessToast(null), 4000);
  };

  // Role CRUD Modal States
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<{ id: number; name: string; description: string } | null>(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);

  const baseRoles = [
    { name: 'SuperAdmin', desc: 'Full unrestricted clinical, financial, and system administrative authority' },
    { name: 'Admin', desc: 'Clinic operations, user accounts, and financial/billing manager' },
    { name: 'Doctor', desc: 'Physicians: EMR consultation notes, triage queue, lab orders & prescriptions' },
    { name: 'Nurse', desc: 'Patient vitals triage, inpatient ward beds, appointment check-in & token queue management' },
    { name: 'LabTechnician', desc: 'Specimen processing, analyte result entry & LIS machine integrations' },
    { name: 'Pathologist', desc: 'Senior clinical pathologist: Laboratory test result verification, critical alerts & LIS diagnostic reports' },
    { name: 'Radiologist', desc: 'Radiology specialist: EMR consultation notes, PACS DICOM imaging viewer, calipers & diagnostic imaging reports' },
    { name: 'Pharmacist', desc: 'Medication formulary, stock inventory & prescription dispensing' },
    { name: 'BillingOfficer', desc: 'Invoices, insurance claims, cashier receipts, ERCA fiscal tax receipts & Telebirr QR payments' },
    { name: 'Receptionist', desc: 'Front desk patient registration, appointment booking & check-in' }
  ];

  // Dynamic roles list automatically incorporating any created roles
  const availableRolesList = React.useMemo(() => {
    const list = [...baseRoles];
    const existingNames = new Set(list.map(r => r.name.toLowerCase()));
    for (const r of roles) {
      const rName = r.name || r.roleName;
      if (rName && !existingNames.has(rName.toLowerCase())) {
        list.push({
          name: rName,
          desc: r.description || `${rName} custom clinical or operational role`
        });
        existingNames.add(rName.toLowerCase());
      }
    }
    return list;
  }, [roles]);

  const handleOpenAddRole = () => {
    setRoleFormName('');
    setRoleFormDesc('');
    setShowAddRoleModal(true);
  };

  const handleOpenEditRole = (r: any) => {
    setEditingRole(r);
    setRoleFormName(r.name);
    setRoleFormDesc(r.description || '');
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormName.trim()) return;
    try {
      setRoleSaving(true);
      if (editingRole) {
        await api.put(`/users/roles/${editingRole.id}`, {
          name: roleFormName.trim(),
          description: roleFormDesc.trim()
        });
        setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, name: roleFormName.trim(), description: roleFormDesc.trim() } : r));
        setEditingRole(null);
        setSaveSuccessToast(`✓ Role "${roleFormName}" updated successfully!`);
      } else {
        const created: any = await api.post('/users/roles', {
          name: roleFormName.trim(),
          description: roleFormDesc.trim()
        });
        const newId = created?.id || created?.roleId || Date.now();
        setRoles(prev => [...prev, { id: newId, name: roleFormName.trim(), description: roleFormDesc.trim() }]);
        setShowAddRoleModal(false);
        setSaveSuccessToast(`✓ Role "${roleFormName}" created! Automatically available across Permissions and Notifications.`);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to save role');
    } finally {
      setRoleSaving(false);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    }
  };

  const handleDeleteRole = async (r: any) => {
    const coreRoles = ['superadmin', 'admin', 'doctor'];
    if (coreRoles.includes(r.name.toLowerCase())) {
      alert(`Cannot delete core system role "${r.name}".`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the role "${r.name}"? Users with this role should be reassigned.`)) return;

    try {
      await api.delete(`/users/roles/${r.id}`);
      setRoles(prev => prev.filter(item => item.id !== r.id));
      setSaveSuccessToast(`✓ Role "${r.name}" deleted successfully.`);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to delete role');
    }
  };

  const handleDeleteUser = async (u: any) => {
    const isSuperAdmin = (u.roles || []).some((r: any) =>
      (typeof r === 'string' ? r : r.name || '').toLowerCase() === 'superadmin'
    );
    if (isSuperAdmin) {
      alert(`Cannot delete SuperAdmin user "${u.username}".`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete user "${u.username || u.name}"? This will deactivate the user account and revoke access.`)) return;

    try {
      await api.delete(`/users/${u.id}`);
      setUsers(prev => prev.filter(item => item.id !== u.id));
      setSaveSuccessToast(`✓ User "${u.username || u.name}" deleted successfully.`);
      setTimeout(() => setSaveSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to delete user');
    }
  };

  const fetchUsersAndRoles = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData, staffData, specData] = await Promise.all([
        api.get<any[]>('/users').catch(() => []),
        api.get<any[]>('/users/roles').catch(() => []),
        api.get<any[]>('/staff/all').catch(() => []),
        api.get<any[]>('/staff/specializations').catch(() => [])
      ]);

      if (specData && Array.isArray(specData)) {
        setSpecializations(specData.map((s: any) => ({
          id: s.id || s.Id,
          code: s.specializationCode || s.code || s.Code,
          name: s.specializationName || s.name || s.Name
        })));
      }

      if (staffData && Array.isArray(staffData)) {
        setStaffList(staffData);
      }

      if (rolesData && rolesData.length > 0) {
        setRoles(rolesData.map((r: any) => ({
          id: r.id || r.Id || r.roleId,
          name: r.name || r.Name || r.roleName || 'Staff',
          description: r.description || r.Description || ''
        })));
      } else {
        setRoles([
          { id: 1, name: 'SuperAdmin', description: 'Full unrestricted clinical, financial, and system administrative authority' },
          { id: 2, name: 'Admin', description: 'Clinic operations, user accounts, and financial/billing manager' },
          { id: 3, name: 'Doctor', description: 'Physicians: EMR consultation notes, triage queue, lab orders & prescriptions' },
          { id: 4, name: 'Nurse', description: 'Patient vitals triage, inpatient ward beds, appointment check-in & token queue management' },
          { id: 5, name: 'LabTechnician', description: 'Specimen processing, analyte result entry & LIS machine integrations' },
          { id: 6, name: 'Pharmacist', description: 'Medication formulary, stock inventory & prescription dispensing' },
          { id: 7, name: 'BillingOfficer', description: 'Invoices, insurance claims, cashier receipts & ERCA tax receipts' },
          { id: 8, name: 'Receptionist', description: 'Front desk patient registration, appointment booking & check-in' }
        ]);
      }

      if (usersData && usersData.length > 0) {
        const mapped = usersData.map((u: any) => {
          const matchedStaff = (staffData || []).find((s: any) => s.userId === (u.id || u.Id) || s.UserId === (u.id || u.Id));
          return {
            id: u.id || u.Id,
            username: u.username || u.Username,
            firstName: u.firstName || u.FirstName || '',
            lastName: u.lastName || u.LastName || '',
            name: `${u.firstName || u.FirstName || ''} ${u.lastName || u.LastName || ''}`.trim() || u.username,
            email: u.email || u.Email,
            phone: u.phone || u.Phone || (matchedStaff ? matchedStaff.phone : ''),
            roles: Array.isArray(u.roles) ? u.roles : (u.roles ? [u.roles] : ['Staff']),
            mfaEnabled: Boolean(u.mfaEnabled || u.MfaEnabled),
            status: (u.isActive === false || (matchedStaff && matchedStaff.isActive === false)) ? 'Inactive' : 'Active',
            staff: matchedStaff || null
          };
        });
        setUsers(mapped);
      } else {
        setUsers([
          { id: 1, username: 'admin', firstName: 'System', lastName: 'Admin', name: 'System Admin', email: 'admin@clinic.com', roles: ['SuperAdmin', 'Admin'], mfaEnabled: false, status: 'Active' },
          { id: 2, username: 'dr.abebe', firstName: 'Abebe', lastName: 'Bekele', name: 'Dr. Abebe Bekele', email: 'dr.abebe@clinic.com', roles: ['Doctor'], mfaEnabled: false, status: 'Active' },
          { id: 3, username: 'dr.tigist', firstName: 'Tigist', lastName: 'Haile', name: 'Dr. Tigist Haile', email: 'dr.tigist@clinic.com', roles: ['Doctor'], mfaEnabled: false, status: 'Active' },
          { id: 4, username: 'nurse.hana', firstName: 'Hana', lastName: 'Girma', name: 'Hana Girma', email: 'hana@clinic.com', roles: ['Nurse'], mfaEnabled: false, status: 'Active' },
          { id: 5, username: 'labtech.daniel', firstName: 'Daniel', lastName: 'Tadesse', name: 'Daniel Tadesse', email: 'daniel@clinic.com', roles: ['LabTechnician'], mfaEnabled: false, status: 'Active' }
        ]);
      }
    } catch (err) {
      console.error('Failed to load users & staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const params: any = {};
      if (auditTableFilter) params.tableName = auditTableFilter;
      if (auditOpFilter) params.operation = auditOpFilter;
      const res = await api.get<any[]>('/audit/logs', params);
      setAuditLogs(res || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleOpenEditStaffModal = (user: any) => {
    const s = user.staff;
    const isDoc = (user.roles || []).includes('Doctor') || (s && s.doctorId);
    setShowEditStaffModal({
      userId: user.id,
      staffId: s ? (s.id || s.Id) : user.id,
      title: s?.title || (isDoc ? 'Dr.' : 'Mr.'),
      firstName: user.firstName || (user.name ? user.name.split(' ')[0] : ''),
      lastName: user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
      email: user.email || '',
      phone: user.phone || s?.phone || '',
      department: s?.department || (isDoc ? 'Clinical Consultation' : 'Administration'),
      primaryRoleId: s?.primaryRoleId || 3,
      isActive: user.status === 'Active',
      licenseNumber: s?.licenseNumber || (isDoc ? `LIC-${user.id}` : ''),
      specializationId: s ? Number(s.specializationId || s.SpecializationId || 1) : 1,
      subSpecialization: s?.subSpecialization || s?.SubSpecialization || '',
      isDoctor: isDoc
    });
  };

  const handleUpdateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditStaffModal) return;
    try {
      const payload = {
        id: showEditStaffModal.staffId,
        userId: showEditStaffModal.userId,
        title: showEditStaffModal.title,
        firstName: showEditStaffModal.firstName,
        lastName: showEditStaffModal.lastName,
        email: showEditStaffModal.email,
        phone: showEditStaffModal.phone,
        primaryRoleId: Number(showEditStaffModal.primaryRoleId) || 3,
        department: showEditStaffModal.department,
        isActive: Boolean(showEditStaffModal.isActive),
        licenseNumber: showEditStaffModal.licenseNumber,
        specializationId: showEditStaffModal.isDoctor ? Number(showEditStaffModal.specializationId) : null,
        subSpecialization: showEditStaffModal.subSpecialization
      };

      await api.put(`/staff/${showEditStaffModal.staffId}`, payload);
      setSaveSuccessToast(`✓ Staff profile for ${showEditStaffModal.firstName} ${showEditStaffModal.lastName} updated successfully!`);
      setShowEditStaffModal(null);
      await fetchUsersAndRoles();
      setTimeout(() => setSaveSuccessToast(null), 4000);
    } catch (err) {
      console.error('Failed to update staff:', err);
      alert('Failed to update staff profile.');
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
    initRolePermissions().then(perms => {
      setRolePermissions(perms);
    });
  }, []);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', {
        tenantId: 1,
        username: newUsername,
        email: newEmail,
        password: newPasswordInput,
        firstName: newFirstName,
        lastName: newLastName,
        roleIds: [newRoleId]
      });
      await fetchUsersAndRoles();
    } catch (err) {
      console.error('Add user error:', err);
      const newU = {
        id: users.length + 1,
        username: newUsername,
        name: `${newFirstName} ${newLastName}`.trim(),
        email: newEmail,
        roles: [roles.find(r => r.id === newRoleId)?.name || 'Doctor'],
        mfaEnabled: false,
        status: 'Active'
      };
      setUsers([...users, newU]);
    }
    setShowAddUserModal(false);
    setNewUsername(''); setNewFirstName(''); setNewLastName(''); setNewEmail('');
  };

  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (newPassword !== confirmPassword) {
      setResetError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    try {
      setIsResetting(true);
      await api.post(`/users/${showResetPasswordModal.id}/reset-password`, {
        newPassword,
        confirmPassword
      });
      setResetSuccess(true);
      setTimeout(() => {
        setResetSuccess(false);
        setShowResetPasswordModal(null);
        setNewPassword('');
        setConfirmPassword('');
        setResetError(null);
      }, 1500);
    } catch (err: any) {
      let errorMsg = err?.message || 'Failed to reset password on server.';
      errorMsg = errorMsg.replace(/^API\s+[A-Z]+\s+[^\s]+\s+failed\s*\(\d+\):\s*/i, '').trim();
      setResetError(errorMsg);
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleMfa = (userId: number) => {
    setUsers(users.map(u => u.id === userId ? { ...u, mfaEnabled: !u.mfaEnabled } : u));
  };

  // Role Permissions Handlers
  const currentRoleAllowedModules = rolePermissions[selectedRole] || [];

  const handleToggleModuleForRole = (moduleKey: ModuleKey) => {
    const current = rolePermissions[selectedRole] || [];
    let updated: ModuleKey[];
    if (current.includes(moduleKey)) {
      updated = current.filter(k => k !== moduleKey);
    } else {
      updated = [...current, moduleKey];
    }
    setRolePermissions({
      ...rolePermissions,
      [selectedRole]: updated
    });
  };

  const handleSelectAllForRole = () => {
    setRolePermissions({
      ...rolePermissions,
      [selectedRole]: MODULE_ITEMS.map(m => m.key)
    });
  };

  const handleClearAllForRole = () => {
    setRolePermissions({
      ...rolePermissions,
      [selectedRole]: []
    });
  };

  const handleResetRoleDefaults = () => {
    const defaultForRole = DEFAULT_ROLE_PERMISSIONS[selectedRole] || [];
    setRolePermissions({
      ...rolePermissions,
      [selectedRole]: defaultForRole
    });
  };

  const handleSavePermissions = async () => {
    await saveRolePermissions(rolePermissions);
    setSaveSuccessToast(`✓ Permissions for role "${selectedRole}" saved to database and active clinic profile!`);
    setTimeout(() => setSaveSuccessToast(null), 4000);
  };

  const MODULE_FEATURE_HIGHLIGHTS: Record<string, { desc: string; tags: string[] }> = {
    DASHBOARD: { desc: 'Executive KPI cards, revenue metrics, and operational overview', tags: ['KPIs', 'Live Revenue', 'System Health'] },
    PATIENTS: { desc: 'Patient master index, demographics, MRN, and medical history', tags: ['Demographics', 'MRN Generation', 'Insurance'] },
    TRIAGE: { desc: 'Nursing vitals, MEWS early warning scoring, and vitals trending', tags: ['MEWS Score', 'Vitals Trends', 'Emergency Priority'] },
    EMR: { desc: 'SOAP clinical visit notes, ICD-10 coding, and 2D DICOM PACS radiology viewer', tags: ['SOAP Notes', 'DICOM PACS Viewer', 'Caliper Measurements', 'ICD-10'] },
    INPATIENT: { desc: 'Ward floorplans, bed availability, patient admission, and nursing rounds', tags: ['Ward Floorplan', 'Bed Occupancy', 'Nursing Flowsheet', 'Discharge'] },
    APPOINTMENTS: { desc: 'Physician calendars, slot reservation, and automated SMS reminders', tags: ['Doctor Matrix', 'Slot Reservation', 'SMS Alerts'] },
    QUEUE: { desc: 'Token dispatching, counter calling, and waiting room TV screen with voice chime', tags: ['Waiting Room TV Display', 'Voice Chime', 'Multi-Counter Calling'] },
    LAB: { desc: 'Diagnostic test catalog, HL7/ASTM analyzer feeds, and critical value alerts', tags: ['HL7 / ASTM Feeds', 'Specimen Phlebotomy', 'Verified Reports'] },
    PHARMACY: { desc: 'Formulary, e-prescription queue, stock inventory, and batch dispensing', tags: ['E-Prescriptions', 'Inventory', 'Batch Logs'] },
    BILLING: { desc: 'Invoicing, TPA insurance split-claims, ERCA fiscal receipts, and Telebirr QR', tags: ['ERCA Fiscal QR', 'Telebirr Dynamic QR', 'TPA Co-Pay Split'] },
    REPORTS: { desc: 'Operational revenue, clinical volume, lab TAT, and pharmacy consumption', tags: ['Revenue Reports', 'Clinical Analytics', 'TAT Logs'] },
    REPORT_BUILDER: { desc: 'Drag-and-drop query designer with PDF, Excel, and CSV export', tags: ['Custom Designer', 'Excel / PDF Export'] },
    PATIENT_PORTAL: { desc: 'Self-service portal for appointments, lab results, and invoice payment', tags: ['Online Booking', 'Results Download', 'Online Payment'] },
    SERVICE_MGMT: { desc: 'Centralized catalog for consultation charges, diagnostics, and procedure fees', tags: ['Fee Schedules', 'Procedure Catalog', 'Pricing Rules'] },
    USER_MGMT: { desc: 'Staff directory, role permission matrix, and HIPAA compliance audit trail', tags: ['RBAC Matrix', 'Staff Directory', 'HIPAA Logs'] },
    MODULE_MGMT: { desc: 'Enable, disable, and configure system modules per clinic tenant', tags: ['Module Registry', 'Feature Toggles'] },
    API_MGMT: { desc: 'API key issuance, rate limiting per token, and webhook subscription logs', tags: ['API Keys', 'Webhook Logs'] },
    SETTINGS: { desc: 'Clinic profile, working hours, notification templates, and VAT configuration', tags: ['Clinic Branding', 'VAT Rates', 'Print Headers'] },
    INTEGRATIONS: { desc: 'Ethio Telecom SMS gateway, Telebirr webhooks, and analyzer TCP feeds', tags: ['Ethio Telecom SMS', 'Telebirr Mobile Webhook', 'HL7 Port 2575'] }
  };

  const handleGrantPreset = (presetKeys: ModuleKey[]) => {
    const current = rolePermissions[selectedRole] || [];
    const merged = Array.from(new Set([...current, ...presetKeys]));
    setRolePermissions({
      ...rolePermissions,
      [selectedRole]: merged
    });
  };

  // Group modules by category
  const categories = Array.from(new Set(MODULE_ITEMS.map(m => m.category)));

  // Collect unique role options for filter dropdown
  const rolesListOptions = Array.from(new Set(
    users.flatMap(u => u.roles || [])
      .concat(roles.map((r: any) => r.name || r))
      .concat(availableRolesList.map(r => r.name))
  )).filter(Boolean).sort();

  // Filter users by search query, role, and status
  const filteredUsers = users.filter(u => {
    // 1. Text Query Search (name, username, email, phone, roles)
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase().trim();
      const matchUsername = (u.username || '').toLowerCase().includes(q);
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchPhone = (u.phone || '').toLowerCase().includes(q);
      const matchRoles = (u.roles || []).some((r: string) => r.toLowerCase().includes(q));
      if (!matchUsername && !matchName && !matchEmail && !matchPhone && !matchRoles) {
        return false;
      }
    }

    // 2. Role Filter
    if (userRoleFilter !== 'ALL') {
      const hasRole = (u.roles || []).some((r: string) => r.toLowerCase() === userRoleFilter.toLowerCase());
      if (!hasRole) return false;
    }

    // 3. Status Filter
    if (userStatusFilter !== 'ALL') {
      if ((u.status || '').toLowerCase() !== userStatusFilter.toLowerCase()) return false;
    }

    return true;
  });

  // Filter notification events by keyword
  const filteredNotificationEvents = NOTIFICATION_EVENTS.filter(ev => {
    if (!notifSearchQuery.trim()) return true;
    const q = notifSearchQuery.toLowerCase().trim();
    return (
      ev.name.toLowerCase().includes(q) ||
      ev.description.toLowerCase().includes(q) ||
      ev.category.toLowerCase().includes(q) ||
      ev.targetModule.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Toast */}
      {saveSuccessToast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '12px 18px', borderRadius: '8px', background: '#059669', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} /> {saveSuccessToast}
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Staff Accounts & Role Permission Access Control</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Manage clinic users, roles, and configure which roles can view each module and page</p>
        </div>
        {activeTab === 'users' && (
          <button onClick={() => setShowAddUserModal(true)} className="btn-primary">
            <UserPlus size={16} /> Add Staff Account
          </button>
        )}
        {activeTab === 'roles' && (
          <button onClick={handleOpenAddRole} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add New Role
          </button>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
        <button
          onClick={() => setActiveTab('users')}
          className={activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <Users size={16} /> User Directory & Accounts ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={activeTab === 'roles' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <Key size={16} /> Roles Management ({roles.length})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <ShieldCheck size={16} /> Role Permission Editor (Module Visibility)
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <Bell size={16} /> Notification Manager (Role Alerts)
        </button>
        <button
          onClick={() => {
            setActiveTab('audit');
            loadAuditLogs();
          }}
          className={activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <Shield size={16} color="#0284c7" /> Compliance &amp; Access Audit Trail (HIPAA)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: USERS DIRECTORY                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="glass-panel" style={{ padding: isMobile ? '16px 12px' : '24px' }}>
          {/* Header & Refresh */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ fontWeight: 700, margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>System Users Directory</h4>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Showing <strong style={{ color: 'var(--text-main)' }}>{filteredUsers.length}</strong> of {users.length} registered clinic staff accounts
                {(userSearchQuery || userRoleFilter !== 'ALL' || userStatusFilter !== 'ALL') && (
                  <span style={{ marginLeft: '6px', color: '#0284c7', fontWeight: 600 }}>(Filtered)</span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={fetchUsersAndRoles}
                disabled={loading}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
                title="Refresh user directory"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '18px',
            flexWrap: 'wrap',
            background: 'var(--bg-subtle, #f8fafc)',
            padding: '12px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search staff by name, @username, email, phone, role..."
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 36px',
                  fontSize: '0.84rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: '#ffffff',
                  outline: 'none'
                }}
              />
              {userSearchQuery && (
                <button
                  type="button"
                  onClick={() => setUserSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Role Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Role:
              </label>
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Roles ({users.length})</option>
                {rolesListOptions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Status:
              </label>
              <select
                value={userStatusFilter}
                onChange={e => setUserStatusFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Status</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>

            {/* Clear All Filters Button */}
            {(userSearchQuery || userRoleFilter !== 'ALL' || userStatusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setUserSearchQuery('');
                  setUserRoleFilter('ALL');
                  setUserStatusFilter('ALL');
                }}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#dc2626'
                }}
                title="Reset all search filters"
              >
                <RotateCcw size={12} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email &amp; Phone</th>
                  <th>Assigned Roles</th>
                  <th>MFA Security</th>
                  <th>Account Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700, color: '#0284c7' }}>@{u.username}</td>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>
                      <div>{u.email}</div>
                      {u.phone && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          📞 {u.phone}
                        </div>
                      )}
                    </td>
                    <td>
                      {(u.roles || []).map((r: string) => (
                        <span key={r} className="badge badge-info" style={{ marginRight: '4px' }}>
                          {r}
                        </span>
                      ))}
                    </td>
                    <td>
                      <button onClick={() => handleToggleMfa(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <span className={u.mfaEnabled ? 'badge badge-normal' : 'badge badge-warning'}>
                          {u.mfaEnabled ? 'TOTP Enabled' : 'Disabled'}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={u.status === 'Active' ? 'badge badge-normal' : 'badge badge-danger'}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button onClick={() => handleOpenEditStaffModal(u)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Edit3 size={12} /> Edit Staff
                        </button>
                        <button onClick={() => setShowRoleModal(u)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                          Edit Roles
                        </button>
                        <button onClick={() => setShowResetPasswordModal(u)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#c2410c' }}>
                          <Lock size={12} /> Reset
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '3px' }}
                          title="Delete User"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94a3b8'
                        }}>
                          <Search size={22} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                          No staff accounts found
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, maxWidth: '420px' }}>
                          No users matched your search criteria {userSearchQuery ? `"${userSearchQuery}"` : ''}
                          {userRoleFilter !== 'ALL' ? ` with role "${userRoleFilter}"` : ''}
                          {userStatusFilter !== 'ALL' ? ` with status "${userStatusFilter}"` : ''}.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setUserSearchQuery('');
                            setUserRoleFilter('ALL');
                            setUserStatusFilter('ALL');
                          }}
                          className="btn-secondary"
                          style={{ marginTop: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <RotateCcw size={13} />
                          <span>Clear Search Filters</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ROLES MANAGEMENT (CRUD ROLES)                                        */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="glass-panel" style={{ padding: isMobile ? '16px 12px' : '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ fontWeight: 700, margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>Clinical &amp; Operational Roles Directory</h4>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Create, update, and manage staff roles. Dynamic roles are automatically reflected in the Role &amp; Permission Editor and Notification Manager.
              </p>
            </div>
            <button onClick={handleOpenAddRole} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={15} /> Add New Role
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>ID</th>
                  <th style={{ width: '180px' }}>Role Name</th>
                  <th>Description / Purpose</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Active Staff</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(r => {
                  const staffCount = users.filter(u => (u.roleName || '').toLowerCase() === (r.name || '').toLowerCase()).length;
                  const isCore = ['superadmin', 'admin', 'doctor'].includes((r.name || '').toLowerCase());

                  return (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{r.id}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                          {r.name}
                        </span>
                        {isCore && (
                          <span style={{ marginLeft: '6px', fontSize: '0.65rem', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                            Core
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        {r.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Standard operational role</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: staffCount > 0 ? '#ecfdf5' : '#f1f5f9', color: staffCount > 0 ? '#059669' : '#64748b' }}>
                          {staffCount} {staffCount === 1 ? 'user' : 'users'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditRole(r)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Edit Role details"
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          {!isCore ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(r)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#ef4444', borderColor: '#fca5a5' }}
                              title="Delete Role"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '4px 6px', fontStyle: 'italic' }}>Protected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROLE PERMISSION EDITOR (MODULE & PAGE VISIBILITY MATRIX)           */}
      {/* ========================================================================= */}
      {activeTab === 'permissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Role Selector Card */}
          <div className="glass-panel" style={{ padding: '18px 22px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              1. Select Role to Edit Module & Page Permissions
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {availableRolesList.map(r => {
                const isSelected = selectedRole === r.name;
                const allowedCount = (rolePermissions[r.name] || []).length;
                return (
                  <button
                    key={r.name}
                    onClick={() => setSelectedRole(r.name)}
                    className={isSelected ? 'btn-primary' : 'btn-secondary'}
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      fontWeight: isSelected ? 700 : 500
                    }}
                  >
                    <Shield size={14} />
                    {r.name}
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      {allowedCount} modules
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Role Summary Banner & Quick Presets */}
            <div style={{ padding: '14px 18px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.95rem' }}>{selectedRole} Role</span>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {availableRolesList.find(r => r.name === selectedRole)?.desc}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={handleSelectAllForRole} className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.72rem' }}>
                    Select All
                  </button>
                  <button onClick={handleClearAllForRole} className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.72rem' }}>
                    Clear All
                  </button>
                  <button onClick={handleResetRoleDefaults} className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RotateCcw size={12} /> Reset to Defaults
                  </button>
                  <button onClick={handleSavePermissions} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Save size={14} /> Save Permissions
                  </button>
                </div>
              </div>

              {/* Quick Preset Action Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>QUICK SUITE PRESETS:</span>
                <button
                  onClick={() => handleGrantPreset(['PATIENTS', 'TRIAGE', 'EMR', 'INPATIENT', 'APPOINTMENTS', 'QUEUE', 'LAB', 'PHARMACY'])}
                  style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Grant Clinical Suite (EMR, IPD, Triage, Appointments)
                </button>
                <button
                  onClick={() => handleGrantPreset(['BILLING', 'REPORTS', 'REPORT_BUILDER'])}
                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Grant Financial &amp; Cashier Suite (Billing, ERCA, Telebirr, Reports)
                </button>
                <button
                  onClick={() => handleGrantPreset(['TRIAGE', 'INPATIENT', 'QUEUE', 'APPOINTMENTS'])}
                  style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Grant Nursing Suite (Triage, Wards, Bed Care, Queue)
                </button>
              </div>
            </div>
          </div>

          {/* Module Filter Search */}
          <div style={{ position: 'relative', width: isMobile ? '100%' : '320px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search module permissions..."
              value={permSearchQuery}
              onChange={e => setPermSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: permSearchQuery ? '32px' : '10px', width: '100%' }}
            />
            {permSearchQuery && (
              <button
                type="button"
                onClick={() => setPermSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Clear module search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Module Grid by Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {categories.map(cat => {
              const catModules = MODULE_ITEMS.filter(m => {
                const matchesCat = m.category === cat;
                const q = permSearchQuery.toLowerCase().trim();
                const matchesQ = !q || m.label.toLowerCase().includes(q) || m.key.toLowerCase().includes(q);
                return matchesCat && matchesQ;
              });

              if (catModules.length === 0) return null;

              return (
                <div key={cat} className="glass-panel" style={{ padding: isMobile ? '16px 12px' : '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {cat} Modules
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {catModules.filter(m => currentRoleAllowedModules.includes(m.key)).length} of {catModules.length} enabled
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {catModules.map(moduleItem => {
                      const Icon = moduleItem.icon;
                      const isChecked = currentRoleAllowedModules.includes(moduleItem.key);
                      const meta = MODULE_FEATURE_HIGHLIGHTS[moduleItem.key];
                      return (
                        <div
                          key={moduleItem.key}
                          onClick={() => handleToggleModuleForRole(moduleItem.key)}
                          style={{
                            padding: '14px 16px',
                            borderRadius: '8px',
                            background: isChecked ? '#f0f9ff' : '#ffffff',
                            border: isChecked ? '1.5px solid #0284c7' : '1px solid var(--border-color)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '6px',
                                  background: isChecked ? '#e0f2fe' : '#f5f3ee',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: isChecked ? '#0284c7' : 'var(--text-muted)'
                                }}
                              >
                                <Icon size={18} />
                              </div>
                              <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: isChecked ? '#0369a1' : 'var(--text-main)' }}>
                                  {moduleItem.label}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                  {moduleItem.key}
                                </div>
                              </div>
                            </div>

                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent div
                              style={{ cursor: 'pointer', width: '17px', height: '17px' }}
                            />
                          </div>

                          {/* Feature Description & Tags */}
                          {meta && (
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '2px' }}>
                              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                                {meta.desc}
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {meta.tags.map((t, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: '0.62rem',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: isChecked ? '#e0f2fe' : '#f1f5f9',
                                      color: isChecked ? '#0369a1' : '#475569',
                                      fontWeight: 600
                                    }}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Save Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button onClick={handleResetRoleDefaults} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <RotateCcw size={14} /> Reset {selectedRole} to Defaults
            </button>
            <button onClick={handleSavePermissions} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={15} /> Save All Role Permissions
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: NOTIFICATION MANAGER (ROLE SUBSCRIPTIONS & ALERT DISPATCHER)       */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div>
          {/* Top Panel: Header & Actions */}
          <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <Bell color="#0071e3" size={18} /> Role Notification & Clinical Alert Subscriptions
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Define exactly which roles receive real-time alerts in the top notification bell, floating toasts, and audio chimes.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleResetNotificationDefaults} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <RotateCcw size={14} /> Reset Defaults
              </button>
              <button onClick={handleSaveNotificationRules} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Save size={15} /> Save Notification Rules
              </button>
            </div>
          </div>

          {/* Main Matrix Table */}
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ fontWeight: 700, fontSize: '0.92rem', margin: 0 }}>Role-to-Alert Subscription Matrix</h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Click any checkbox to enable or disable notification delivery for that role.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30', fontWeight: 600 }}>
                  ● Critical Priority
                </span>
                <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(0, 113, 227, 0.1)', color: '#0071e3', fontWeight: 600 }}>
                  ● Routine Alert
                </span>
              </div>
            </div>

            {/* Notification Events Search Bar */}
            <div style={{ position: 'relative', width: isMobile ? '100%' : '320px', marginBottom: '16px' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search notification events & modules..."
                value={notifSearchQuery}
                onChange={e => setNotifSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', paddingRight: notifSearchQuery ? '32px' : '10px', width: '100%', fontSize: '0.82rem' }}
              />
              {notifSearchQuery && (
                <button
                  type="button"
                  onClick={() => setNotifSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Clear notification search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <table className="cms-table" style={{ width: '100%', minWidth: '820px' }}>
              <thead>
                <tr>
                  <th style={{ width: '280px' }}>Notification Event &amp; Scope</th>
                  <th style={{ width: '90px' }}>Target</th>
                  {availableRolesList.map(r => (
                    <th key={r.name} style={{ textAlign: 'center', fontSize: '0.75rem', padding: '8px 4px' }}>
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredNotificationEvents.map(ev => {
                  const subscribedRoles = notificationRules[ev.key] || DEFAULT_ROLE_RULES[ev.key] || [];
                  return (
                    <tr key={ev.key}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '6px',
                              background: `${ev.color}15`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '2px'
                            }}
                          >
                            <Bell size={14} color={ev.color} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                              {ev.name}
                            </div>
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                              {ev.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.67rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: 'var(--bg-dark)',
                            color: 'var(--text-secondary)',
                            fontFamily: 'monospace'
                          }}
                        >
                          {ev.targetModule}
                        </span>
                      </td>
                      {availableRolesList.map(r => {
                        const isSubscribed = subscribedRoles.includes(r.name);
                        return (
                          <td key={r.name} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <input
                              type="checkbox"
                              checked={isSubscribed}
                              onChange={() => handleToggleNotificationRole(ev.key, r.name)}
                              style={{
                                width: '17px',
                                height: '17px',
                                cursor: 'pointer',
                                accentColor: '#0071e3'
                              }}
                              title={`Toggle ${r.name} for ${ev.name}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {filteredNotificationEvents.length === 0 && (
                  <tr>
                    <td colSpan={2 + availableRolesList.length} style={{ textAlign: 'center', padding: '36px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Search size={20} color="var(--text-muted)" />
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          No notification events found
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                          No alerts match "{notifSearchQuery}".
                        </p>
                        <button
                          type="button"
                          onClick={() => setNotifSearchQuery('')}
                          className="btn-secondary"
                          style={{ marginTop: '4px', fontSize: '0.75rem' }}
                        >
                          Clear Search
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Test Alert Dispatcher Panel */}
          <div className="glass-panel" style={{ padding: isMobile ? '16px 14px' : '24px' }}>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={16} color="#0071e3" /> Send & Test Live Clinical Notification
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Instantly broadcast a real-time notification to test delivery in the header bell and floating toast banner.
            </p>

            <form onSubmit={handleSendTestNotification} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 2fr auto', gap: '14px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  Alert Category / Event Type
                </label>
                <select
                  value={testEventType}
                  onChange={e => {
                    setTestEventType(e.target.value);
                    const found = NOTIFICATION_EVENTS.find(ev => ev.key === e.target.value);
                    if (found) setTestMessage(found.description);
                  }}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                >
                  {NOTIFICATION_EVENTS.map(ev => (
                    <option key={ev.key} value={ev.key}>{ev.name} ({ev.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  Target Role Audience
                </label>
                <select
                  value={testTargetRole}
                  onChange={e => setTestTargetRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                >
                  <option value="All">All Subscribed Roles</option>
                  {availableRolesList.map(r => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  Notification Message Body
                </label>
                <input
                  type="text"
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  placeholder="Enter message text..."
                  required
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                />
              </div>

              <button
                type="submit"
                disabled={testSending}
                className="btn-primary"
                style={{ padding: '9px 18px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', justifyContent: 'center' }}
              >
                {testSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Send Live Alert
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: COMPLIANCE & ACCESS AUDIT TRAIL (HIPAA IMMUTABLE LOGS)             */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header & Filter Bar */}
          <div className="glass-panel" style={{ padding: isMobile ? '16px 14px' : '18px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} color="#0284c7" />
                <h3 style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  HIPAA &amp; Privacy Immutable Access Audit Trail
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Chronological record of patient medical record access, clinical alterations, billing updates, and credential events.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
              <select
                value={auditTableFilter}
                onChange={e => setAuditTableFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.78rem', flex: isMobile ? 1 : 'initial' }}
              >
                <option value="">All Entities / Tables</option>
                <option value="Patients">Patients</option>
                <option value="Encounters">Encounters / EMR Notes</option>
                <option value="Prescriptions">Prescriptions</option>
                <option value="LabOrders">Lab Orders</option>
                <option value="Invoices">Invoices &amp; Payments</option>
                <option value="Users">User Accounts</option>
              </select>

              <select
                value={auditOpFilter}
                onChange={e => setAuditOpFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.78rem', flex: isMobile ? 1 : 'initial' }}
              >
                <option value="">All Operations</option>
                <option value="I">Insert / Create (I)</option>
                <option value="U">Update / Edit (U)</option>
                <option value="D">Delete / Archive (D)</option>
                <option value="V">View / Read Chart (V)</option>
              </select>

              <button
                type="button"
                onClick={loadAuditLogs}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <RefreshCw size={13} className={loadingAudit ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="glass-panel" style={{ padding: isMobile ? '14px 10px' : '20px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            {loadingAudit ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                Loading cryptographic access audit logs...
              </div>
            ) : auditLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No audit log entries found matching criteria. Actions taken by practitioners across EMR, billing, and pharmacy will log here.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="cms-table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>Log ID</th>
                      <th>Timestamp (UTC)</th>
                      <th>User / Actor</th>
                      <th>IP Address</th>
                      <th>Target Entity</th>
                      <th>Record ID</th>
                      <th>Operation</th>
                      <th>Changes / Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => {
                      const opBadge =
                        log.operation === 'I' ? { text: 'INSERT', bg: '#dcfce7', col: '#15803d' } :
                        log.operation === 'U' ? { text: 'UPDATE', bg: '#e0f2fe', col: '#0369a1' } :
                        log.operation === 'D' ? { text: 'DELETE', bg: '#fee2e2', col: '#991b1b' } :
                        { text: 'ACCESS', bg: '#fef3c7', col: '#92400e' };

                      return (
                        <tr key={log.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{log.id}</td>
                          <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {log.changedAt ? new Date(log.changedAt).toLocaleString() : 'Recent'}
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                            {log.userName || `User #${log.changedBy || 1}`}
                          </td>
                          <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{log.ipAddress || '127.0.0.1'}</td>
                          <td style={{ fontWeight: 600 }}>{log.tableName}</td>
                          <td style={{ fontFamily: 'monospace' }}>{log.recordId}</td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, background: opBadge.bg, color: opBadge.col }}>
                              {opBadge.text}
                            </span>
                          </td>
                          <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            {log.newValues || log.oldValues || 'Action recorded successfully.'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add User */}
      {showAddUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: isMobile ? '8px' : '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: isMobile ? '16px' : '28px', background: '#fff', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add New Staff User Account</h3>
              <button onClick={() => setShowAddUserModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>First Name</label>
                  <input type="text" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last Name</label>
                  <input type="text" value={newLastName} onChange={e => setNewLastName(e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Username</label>
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required placeholder="e.g. dr.tigist" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email Address</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="staff@clinic.com" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Initial Password</label>
                <input type="password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} required minLength={6} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Primary Role</label>
                <select value={newRoleId} onChange={e => setNewRoleId(Number(e.target.value))}>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowAddUserModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create User Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {showResetPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: isMobile ? '8px' : '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: isMobile ? '16px' : '28px', background: '#fff', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Reset Password: {showResetPasswordModal.username}</h3>
              <button onClick={() => setShowResetPasswordModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {resetSuccess ? (
              <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#059669', textAlign: 'center', fontWeight: 600 }}>
                <Check size={20} style={{ margin: '0 auto 6px' }} /> Password reset successfully!
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {resetError && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <X size={14} />
                    <span>{resetError}</span>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" disabled={isResetting} onClick={() => { setShowResetPasswordModal(null); setResetError(null); }} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={isResetting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isResetting && <Loader2 size={14} className="animate-spin" />}
                    {isResetting ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Edit Roles */}
      {showRoleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: isMobile ? '8px' : '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: isMobile ? '16px' : '28px', background: '#fff', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Edit Assigned Roles: {showRoleModal.name}</h3>
              <button onClick={() => setShowRoleModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Select one or multiple roles for this user. Changes are saved directly to the database.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0 20px', maxHeight: '280px', overflowY: 'auto' }}>
              {roles.map(r => {
                const hasRole = (showRoleModal.roles || []).includes(r.name);
                return (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px', background: hasRole ? '#f0fdf4' : 'transparent', border: hasRole ? '1px solid #bbf7d0' : '1px solid transparent' }}>
                    <input
                      type="checkbox"
                      checked={hasRole}
                      onChange={() => {
                        const updated = hasRole
                          ? (showRoleModal.roles || []).filter((x: string) => x !== r.name)
                          : [...(showRoleModal.roles || []), r.name];
                        setShowRoleModal({ ...showRoleModal, roles: updated });
                      }}
                    />
                    <span style={{ fontWeight: hasRole ? 600 : 400, color: hasRole ? '#15803d' : 'inherit' }}>{r.name}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowRoleModal(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    const targetId = showRoleModal.id;
                    const assignedRoles = showRoleModal.roles || [];
                    await api.put(`/users/${targetId}/roles`, { roles: assignedRoles });
                    setUsers(users.map(u => u.id === targetId ? { ...u, roles: assignedRoles } : u));
                    setShowRoleModal(null);
                    setSaveSuccessToast(`✓ Successfully updated and saved roles for ${showRoleModal.name}!`);
                    setTimeout(() => setSaveSuccessToast(null), 4000);
                  } catch (err: any) {
                    alert(err?.response?.data?.message || err?.message || 'Failed to save roles');
                  }
                }}
                className="btn-primary"
              >
                Save Roles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Staff Profile & Specialization */}
      {showEditStaffModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, overflowY: 'auto', padding: isMobile ? '8px' : '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: isMobile ? '16px' : '26px', background: '#fff', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1' }}>
                <Edit3 size={18} /> Edit Staff Profile & Specialization
              </h3>
              <button onClick={() => setShowEditStaffModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleUpdateStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '120px 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Title</label>
                  <select value={showEditStaffModal.title} onChange={e => setShowEditStaffModal({ ...showEditStaffModal, title: e.target.value })}>
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Pharm.">Pharm.</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>First Name</label>
                  <input type="text" value={showEditStaffModal.firstName} onChange={e => setShowEditStaffModal({ ...showEditStaffModal, firstName: e.target.value })} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Last Name</label>
                  <input type="text" value={showEditStaffModal.lastName} onChange={e => setShowEditStaffModal({ ...showEditStaffModal, lastName: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email Address</label>
                  <input type="email" value={showEditStaffModal.email} onChange={e => setShowEditStaffModal({ ...showEditStaffModal, email: e.target.value })} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Phone Number</label>
                  <input type="text" value={showEditStaffModal.phone} onChange={e => setShowEditStaffModal({ ...showEditStaffModal, phone: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Department</label>
                  <input type="text" value={showEditStaffModal.department} onChange={e => setShowEditStaffModal({ ...showEditStaffModal, department: e.target.value })} placeholder="e.g. Dermatology, Pediatrics" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Primary Role</label>
                  <select value={showEditStaffModal.primaryRoleId} onChange={e => {
                    const rId = Number(e.target.value);
                    const isDocRole = rId === 3 || roles.find(r => r.id === rId)?.name === 'Doctor';
                    setShowEditStaffModal({ ...showEditStaffModal, primaryRoleId: rId, isDoctor: isDocRole || showEditStaffModal.isDoctor });
                  }}>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Specialization Section */}
              <div style={{ border: '1px solid #e0f2fe', background: '#f0f9ff', padding: '14px', borderRadius: '8px', marginTop: '4px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Stethoscope size={16} /> Clinical Specialization & Credentials
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>Medical Specialization (Catalog)</label>
                    <select
                      value={showEditStaffModal.specializationId || 1}
                      onChange={e => setShowEditStaffModal({ ...showEditStaffModal, specializationId: Number(e.target.value) })}
                      style={{ background: '#fff' }}
                    >
                      {specializations.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>Medical License Number</label>
                    <input
                      type="text"
                      value={showEditStaffModal.licenseNumber}
                      onChange={e => setShowEditStaffModal({ ...showEditStaffModal, licenseNumber: e.target.value })}
                      placeholder="e.g. LIC-ET-4892"
                      style={{ background: '#fff' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>Sub-Specialization (Optional)</label>
                  <input
                    type="text"
                    value={showEditStaffModal.subSpecialization}
                    onChange={e => setShowEditStaffModal({ ...showEditStaffModal, subSpecialization: e.target.value })}
                    placeholder="e.g. Pediatric Dermatology"
                    style={{ background: '#fff' }}
                  />
                </div>
              </div>

              {/* Status toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showEditStaffModal.isActive}
                  onChange={e => setShowEditStaffModal({ ...showEditStaffModal, isActive: e.target.checked })}
                />
                Account Active & Available for Clinical Assignment
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <button type="button" onClick={() => setShowEditStaffModal(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Save size={15} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Role */}
      {(showAddRoleModal || editingRole) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="#0284c7" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                  {editingRole ? `Edit Role: ${editingRole.name}` : 'Add New Custom Role'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddRoleModal(false); setEditingRole(null); }}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Role Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={roleFormName}
                  onChange={e => setRoleFormName(e.target.value)}
                  placeholder="e.g. Optometrist, Anesthesiologist, WardSupervisor"
                  required
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Name used in permission assignment and system audit logs.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Role Description & Scope
                </label>
                <textarea
                  rows={3}
                  value={roleFormDesc}
                  onChange={e => setRoleFormDesc(e.target.value)}
                  placeholder="Describe duties, departmental access, and operational scope..."
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '0.74rem', color: '#0369a1' }}>
                💡 <strong>Dynamic Sync:</strong> Once created, this role will immediately appear in the <strong>Role Permission Editor</strong> (to configure allowed modules) and the <strong>Notification Manager</strong> (to configure event subscriptions).
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddRoleModal(false); setEditingRole(null); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleSaving}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {roleSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
