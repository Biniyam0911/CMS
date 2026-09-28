import React, { useState } from 'react';
import {
  Lock, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Eye, EyeOff,
  User, Check, X, ArrowRight, Loader2, Sparkles, RefreshCw
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface ChangePasswordPageProps {
  currentUser: any;
}

export default function ChangePasswordPage({ currentUser }: ChangePasswordPageProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const username = currentUser?.username || 'user';
  const displayName = currentUser?.name ||
    (currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : currentUser?.username) ||
    'Authenticated User';
  const email = currentUser?.email || '—';
  const roles = Array.isArray(currentUser?.roles) ? currentUser.roles.join(', ') : (currentUser?.roles || 'Staff');

  // Real-time validation checks
  const isMinLength = newPassword.length >= 6;
  const isMatching = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const isDifferentFromOld = oldPassword.length > 0 && newPassword.length > 0 && oldPassword !== newPassword;
  const isFormValid = oldPassword.length > 0 && isMinLength && isMatching;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!oldPassword) {
      setErrorMessage('Please enter your current (old) password.');
      return;
    }

    if (!isMinLength) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirm password do not match.');
      return;
    }

    if (oldPassword === newPassword) {
      setErrorMessage('New password must be different from your current password.');
      return;
    }

    try {
      setIsLoading(true);
      const res: any = await api.post('/auth/change-password', {
        username: currentUser?.username,
        userId: currentUser?.id,
        oldPassword,
        newPassword,
        confirmPassword
      });

      const message = res?.data || res?.Data || res?.message || 'Password changed successfully!';
      setSuccessMessage(typeof message === 'string' ? message : 'Password has been successfully updated.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const serverError = err?.response?.data?.message || err?.response?.data?.Message || err?.message || 'Failed to change password. Please verify your current password.';
      setErrorMessage(serverError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
            }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                Change Password
              </h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Self-service password update for your personal CMS user account
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Target User Identification Card */}
      <div style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        border: '1px solid #bae6fd',
        borderRadius: '12px',
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#0284c7',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
          }}>
            {username.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0369a1' }}>
                {displayName}
              </span>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: '#0284c7',
                color: '#ffffff'
              }}>
                @{username}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: '#ffffff',
                color: '#0369a1',
                border: '1px solid #bae6fd'
              }}>
                Role: {roles}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
              Account Email: <strong style={{ color: '#0f172a' }}>{email}</strong> • Password changes apply immediately to this account.
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#0284c7',
          background: 'rgba(255, 255, 255, 0.7)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid #bae6fd'
        }}>
          <ShieldCheck size={16} color="#0284c7" />
          <span>Active Session Verified</span>
        </div>
      </div>

      {/* Main Content Grid: Form + Requirements Guide */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Left Card: Password Change Form */}
        <div className="glass-panel" style={{ padding: '24px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="#0284c7" />
            Enter Account Credentials
          </h2>

          {/* Success Banner */}
          {successMessage && (
            <div style={{
              padding: '14px 16px',
              borderRadius: '8px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '18px'
            }}>
              <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0 }} />
              <div>
                <strong>Success!</strong> {successMessage}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div style={{
              padding: '14px 16px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '18px'
            }}>
              <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
              <div>
                <strong>Action Failed:</strong> {errorMessage}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Old (Current) Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Current (Old) Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '9px 40px 9px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={showOldPassword ? 'Hide password' : 'Show password'}
                >
                  {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Required to verify account ownership before updating credentials.
              </span>
            </div>

            {/* 2. New Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                New Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '9px 40px 9px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: `1px solid ${newPassword.length > 0 && !isMinLength ? '#f87171' : 'var(--border-color)'}`,
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 3. Confirm New Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Confirm New Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password to confirm"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '9px 40px 9px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: `1px solid ${confirmPassword.length > 0 ? (isMatching ? '#86efac' : '#f87171') : 'var(--border-color)'}`,
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Match Feedback Badge */}
              {confirmPassword.length > 0 && (
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  marginTop: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: isMatching ? '#16a34a' : '#dc2626'
                }}>
                  {isMatching ? <Check size={14} color="#16a34a" /> : <X size={14} color="#dc2626" />}
                  <span>{isMatching ? 'Passwords match perfectly' : 'Passwords do not match yet'}</span>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={handleResetForm}
                disabled={isLoading}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="btn-primary"
                style={{
                  padding: '8px 20px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: !isFormValid && !isLoading ? 0.6 : 1,
                  cursor: !isFormValid && !isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {isLoading ? 'Updating Credentials...' : 'Save New Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Card: Security & Verification Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Real-time Requirements Checklist */}
          <div className="glass-panel" style={{ padding: '20px', background: '#fdfcf9', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#0284c7" />
              Password Requirements
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isMinLength ? '#16a34a' : 'var(--text-muted)' }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: isMinLength ? '#dcfce7' : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isMinLength ? <Check size={12} color="#16a34a" /> : <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }}></span>}
                </div>
                <span style={{ fontWeight: isMinLength ? 600 : 400 }}>At least 6 characters long</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isMatching ? '#16a34a' : 'var(--text-muted)' }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: isMatching ? '#dcfce7' : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isMatching ? <Check size={12} color="#16a34a" /> : <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }}></span>}
                </div>
                <span style={{ fontWeight: isMatching ? 600 : 400 }}>New password and confirm password match</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isDifferentFromOld ? '#16a34a' : 'var(--text-muted)' }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: isDifferentFromOld ? '#dcfce7' : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isDifferentFromOld ? <Check size={12} color="#16a34a" /> : <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }}></span>}
                </div>
                <span style={{ fontWeight: isDifferentFromOld ? 600 : 400 }}>Different from your old password</span>
              </div>
            </div>
          </div>

          {/* Security Best Practices Notice */}
          <div className="glass-panel" style={{ padding: '18px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              Clinic Security Best Practices
            </h4>
            <ul style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', paddingLeft: '18px', margin: 0, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Never share your clinic credentials with other staff members.</li>
              <li>Each doctor, nurse, cashier, and lab technician should maintain their own personal login.</li>
              <li>System administrators can reset passwords for team members anytime via the <strong>Users &amp; RBAC</strong> page.</li>
              <li>After changing your password, your current session remains active with updated security keys.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
