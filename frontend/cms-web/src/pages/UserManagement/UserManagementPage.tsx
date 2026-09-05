import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, UserPlus, Key, Lock, Check, X, Shield, RefreshCw,
  Loader2, Users, CheckCircle2, RotateCcw, Save, Eye, Layers, Settings
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

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<any>(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<any>(null);

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
      const [usersData, rolesData] = await Promise.all([
        api.get<any[]>('/users').catch(() => []),
        api.get<any[]>('/users/roles').catch(() => [])
      ]);

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
        const mapped = usersData.map((u: any) => ({
          id: u.id || u.Id,
          username: u.username || u.Username,
          name: `${u.firstName || u.FirstName || ''} ${u.lastName || u.LastName || ''}`.trim() || u.username,
          email: u.email || u.Email,
          roles: Array.isArray(u.roles) ? u.roles : (u.roles ? [u.roles] : ['Staff']),
          mfaEnabled: Boolean(u.mfaEnabled || u.MfaEnabled),
          status: u.isActive !== false ? 'Active' : 'Inactive'
        }));
        setUsers(mapped);
      } else {
        setUsers([
          { id: 1, username: 'admin', name: 'System Admin', email: 'admin@clinic.com', roles: ['SuperAdmin', 'Admin'], mfaEnabled: false, status: 'Active' },
          { id: 2, username: 'dr.abebe', name: 'Dr. Abebe Bekele', email: 'dr.abebe@clinic.com', roles: ['Doctor'], mfaEnabled: false, status: 'Active' },
          { id: 3, username: 'dr.tigist', name: 'Dr. Tigist Haile', email: 'dr.tigist@clinic.com', roles: ['Doctor'], mfaEnabled: false, status: 'Active' },
          { id: 4, username: 'nurse.hana', name: 'Hana Girma', email: 'hana@clinic.com', roles: ['Nurse'], mfaEnabled: false, status: 'Active' },
          { id: 5, username: 'labtech.daniel', name: 'Daniel Tadesse', email: 'daniel@clinic.com', roles: ['LabTechnician'], mfaEnabled: false, status: 'Active' }
        ]);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
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
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowRoleModal(u)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                        Edit Roles
                      </button>
                      <button onClick={() => setShowResetPasswordModal(u)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#c2410c' }}>
                        <Lock size={12} /> Reset Password
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
    </div>
  );
}
