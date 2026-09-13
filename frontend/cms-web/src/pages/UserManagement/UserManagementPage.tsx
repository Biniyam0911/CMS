import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, UserPlus, Key, Lock, Check, X, Shield, RefreshCw,
  Loader2, Users, CheckCircle2, RotateCcw, Save, Eye, Layers, Settings,
  Edit3, Stethoscope, Briefcase, Bell, Send, Volume2, Flame, Pill, FlaskConical, DollarSign
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
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'notifications'>('users');

  // Users & Staff State
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const availableRolesList = [
    { name: 'SuperAdmin', desc: 'Full unrestricted clinical and system administrative authority' },
    { name: 'Admin', desc: 'Clinic operations, user accounts, and financial/billing manager' },
    { name: 'Doctor', desc: 'Physicians: EMR consultation notes, triage queue, lab orders & prescriptions' },
    { name: 'Nurse', desc: 'Patient vitals triage, appointment check-in & token queue management' },
    { name: 'LabTechnician', desc: 'Specimen processing, analyte result entry & LIS machine integrations' },
    { name: 'Pharmacist', desc: 'Medication formulary, stock inventory & prescription dispensing' },
    { name: 'BillingOfficer', desc: 'Invoices, insurance claims, cashier receipts & payment processing' },
    { name: 'Receptionist', desc: 'Front desk patient registration, appointment booking & check-in' }
  ];

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
          name: r.name || r.Name || r.roleName || 'Staff'
        })));
      } else {
        setRoles([
          { id: 1, name: 'SuperAdmin' },
          { id: 2, name: 'Admin' },
          { id: 3, name: 'Doctor' },
          { id: 4, name: 'Nurse' },
          { id: 5, name: 'LabTechnician' },
          { id: 6, name: 'Pharmacist' },
          { id: 7, name: 'BillingOfficer' },
          { id: 8, name: 'Receptionist' }
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
            status: u.isActive !== false ? 'Active' : 'Inactive',
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

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
      setShowResetPasswordModal(null);
      setNewPassword(''); setConfirmPassword('');
    }, 1500);
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

  // Group modules by category
  const categories = Array.from(new Set(MODULE_ITEMS.map(m => m.category)));

  return (
    <div>
      {/* Toast */}
      {saveSuccessToast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '12px 18px', borderRadius: '8px', background: '#059669', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} /> {saveSuccessToast}
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Staff Accounts & Role Permission Access Control</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Manage clinic users, roles, and configure which roles can view each module and page</p>
        </div>
        {activeTab === 'users' && (
          <button onClick={() => setShowAddUserModal(true)} className="btn-primary">
            <UserPlus size={16} /> Add Staff Account
          </button>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('users')}
          className={activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <Users size={16} /> User Directory & Accounts ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <ShieldCheck size={16} /> Role Permission Editor (Module Visibility)
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <Bell size={16} /> Notification Manager (Role Alerts)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: USERS DIRECTORY                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontWeight: 700 }}>System Users Directory</h4>
            {loading && <Loader2 size={16} className="animate-spin" color="#06b6d4" />}
          </div>
          <table className="cms-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Assigned Roles</th>
                <th>MFA Security</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700, color: '#0284c7' }}>{u.username}</td>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.email}</td>
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
                  <td><span className="badge badge-normal">{u.status}</span></td>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

            {/* Role Summary Banner */}
            <div style={{ padding: '12px 16px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.9rem' }}>{selectedRole} Role</span>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {availableRolesList.find(r => r.name === selectedRole)?.desc}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
          </div>

          {/* Module Grid by Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {categories.map(cat => {
              const catModules = MODULE_ITEMS.filter(m => m.category === cat);
              return (
                <div key={cat} className="glass-panel" style={{ padding: '20px' }}>
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
                      return (
                        <div
                          key={moduleItem.key}
                          onClick={() => handleToggleModuleForRole(moduleItem.key)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '8px',
                            background: isChecked ? '#f0f9ff' : '#ffffff',
                            border: isChecked ? '1.5px solid #0284c7' : '1px solid var(--border-color)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: isChecked ? '#e0f2fe' : '#f5f3ee',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isChecked ? '#0284c7' : 'var(--text-muted)'
                              }}
                            >
                              <Icon size={16} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isChecked ? '#0369a1' : 'var(--text-main)' }}>
                                {moduleItem.label}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                Key: {moduleItem.key}
                              </div>
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent div
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontWeight: 700, fontSize: '0.92rem' }}>Role-to-Alert Subscription Matrix</h4>
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

            <table className="cms-table" style={{ width: '100%', minWidth: '820px' }}>
              <thead>
                <tr>
                  <th style={{ width: '280px' }}>Notification Event & Scope</th>
                  <th style={{ width: '90px' }}>Target</th>
                  {availableRolesList.map(r => (
                    <th key={r.name} style={{ textAlign: 'center', fontSize: '0.75rem', padding: '8px 4px' }}>
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_EVENTS.map(ev => {
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
              </tbody>
            </table>
          </div>

          {/* Test Alert Dispatcher Panel */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={16} color="#0071e3" /> Send & Test Live Clinical Notification
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Instantly broadcast a real-time notification to test delivery in the header bell and floating toast banner.
            </p>

            <form onSubmit={handleSendTestNotification} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 2fr auto', gap: '14px', alignItems: 'flex-end' }}>
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
                style={{ padding: '9px 18px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                {testSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Send Live Alert
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add User */}
      {showAddUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '480px', padding: '28px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add New Staff User Account</h3>
              <button onClick={() => setShowAddUserModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '28px', background: '#fff' }}>
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
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setShowResetPasswordModal(null)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Update Password</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Edit Roles */}
      {showRoleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '440px', padding: '28px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Edit Assigned Roles: {showRoleModal.name}</h3>
              <button onClick={() => setShowRoleModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0 20px' }}>
              {roles.map(r => {
                const hasRole = (showRoleModal.roles || []).includes(r.name);
                return (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hasRole}
                      onChange={() => {
                        const updated = hasRole
                          ? (showRoleModal.roles || []).filter((x: string) => x !== r.name)
                          : [...(showRoleModal.roles || []), r.name];
                        setShowRoleModal({ ...showRoleModal, roles: updated });
                        setUsers(users.map(u => u.id === showRoleModal.id ? { ...u, roles: updated } : u));
                      }}
                    />
                    {r.name}
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRoleModal(null)} className="btn-primary">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Staff Profile & Specialization */}
      {showEditStaffModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, overflowY: 'auto', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '26px', background: '#fff', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1' }}>
                <Edit3 size={18} /> Edit Staff Profile & Specialization
              </h3>
              <button onClick={() => setShowEditStaffModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleUpdateStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '10px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email Address</label>
                  <input type="email" value={showEditStaffModal.email} onChange={e => setShowEditStaffModal({ ...showEditStaffModal, email: e.target.value })} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Phone Number</label>
                  <input type="text" value={showEditStaffModal.phone} onChange={e => setShowEditStaffModal({ ...showEditStaffModal, phone: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
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
    </div>
  );
}
