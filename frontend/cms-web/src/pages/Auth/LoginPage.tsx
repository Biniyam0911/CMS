import React, { useState } from 'react';
import { ShieldCheck, Lock, User, Key, Activity, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, tenantId: 1 })
      });
      const data = await res.json();
      if (data.success) {
        if (data.data.user.mfaEnabled && !showMfa) {
          setShowMfa(true);
          setLoading(false);
          return;
        }
        onLoginSuccess(data.data.user, data.data.accessToken);
      } else {
        setError(data.errors?.[0] || 'Invalid credentials');
      }
    } catch {
      setError('Connection to API failed. Ensure CMS.API is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'radial-gradient(circle at top right, #0f172a, #090d16)' }}>
      {/* Left Banner */}
      <div style={{ flex: 1, padding: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'between', borderRight: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity color="#fff" size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Aethel Clinic Management</h1>
            <span style={{ fontSize: '0.8rem', color: '#06b6d4', fontWeight: 600 }}>16-Module Multi-Tenant Enterprise System</span>
          </div>
        </div>

        <div style={{ margin: 'auto 0' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2, marginBottom: '16px' }}>
            Next-Generation Healthcare Information Platform
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '540px', lineHeight: 1.6 }}>
            Integrated Electronic Medical Records (EMR), Laboratory LIS (HL7/ASTM), Automated Invoicing, Real-Time Triage Queue, and Dynamic Report Builder.
          </p>

          <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>16/16</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Modules Active</div>
            </div>
            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>TCP 2575</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>HL7 Socket Server</div>
            </div>
            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fbbf24' }}>Redis 7</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cache-Aside Active</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          © 2026 Aethel Health Systems. On-Premise MSSQL Deployment.
        </div>
      </div>

      {/* Right Login Form */}
      <div style={{ width: '480px', padding: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ padding: '36px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '6px' }}>
            {showMfa ? 'Two-Factor Authentication' : 'Sign In to Portal'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
            {showMfa ? 'Enter the 6-digit TOTP code from your authenticator app' : 'Enter your staff username and credentials to access'}
          </p>

          {error && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#f87171', fontSize: '0.85rem', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!showMfa ? (
              <>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Username / Email</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="superadmin"
                      style={{ paddingLeft: '38px' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ paddingLeft: '38px' }}
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>6-Digit MFA Code</label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value)}
                    placeholder="123456"
                    style={{ paddingLeft: '38px', letterSpacing: '0.2em', fontFamily: 'monospace' }}
                    maxLength={6}
                    required
                  />
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ marginTop: '12px', width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
              {loading ? 'Authenticating...' : (showMfa ? 'Verify Code' : 'Sign In')} <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
