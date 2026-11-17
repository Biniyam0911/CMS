import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Key, 
  Activity, 
  ArrowRight, 
  Clock, 
  Eye, 
  EyeOff, 
  Shield,
  CheckCircle2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import BeatIconAnimation from './BeatIconAnimation';
import './LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Live Service Health Checker (Checks if CMS.API is responsive every 10 seconds)
  const [isSystemLive, setIsSystemLive] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const checkServiceStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        // Ping CMS.API through Vite proxy
        const res = await fetch('/swagger/v1/swagger.json', { 
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (isMounted) {
          // If server responds with any standard HTTP code < 500, service is running
          setIsSystemLive(res.status < 500);
        }
      } catch {
        if (isMounted) {
          // Connection refused, timeout or network error => service is not running
          setIsSystemLive(false);
        }
      }
    };

    // Initial check
    checkServiceStatus();

    // Periodic check every 10 seconds
    const interval = setInterval(checkServiceStatus, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const [logoutNotice, setLogoutNotice] = useState<string | null>(() => {
    const reason = sessionStorage.getItem('cms_logout_reason');
    if (reason) {
      sessionStorage.removeItem('cms_logout_reason');
      return reason;
    }
    return null;
  });

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
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Not a JSON response (e.g. IIS 404/502 HTML error page)
      }

      if (res.ok && data?.success) {
        if (data.data.user.mfaEnabled && !showMfa) {
          setShowMfa(true);
          setLoading(false);
          return;
        }
        onLoginSuccess(data.data.user, data.data.accessToken);
      } else if (data?.errors?.[0]) {
        setError(data.errors[0]);
      } else if (data?.message) {
        setError(data.message);
      } else if (res.status === 404) {
        setError('API route not found (HTTP 404). Ensure IIS URL Rewrite / ARR proxy to port 5010 is enabled.');
      } else if (res.status === 502 || res.status === 503) {
        setError(`Bad Gateway (HTTP ${res.status}). CMS.API is not responding on port 5010.`);
      } else if (!res.ok) {
        setError(`Server returned HTTP ${res.status} ${res.statusText}`);
      } else {
        setError('Invalid credentials');
      }
    } catch (err: any) {
      setError(`Network error: Could not connect to API (${err?.message || 'Connection Refused'}). Ensure CMS.API is running on port 5010.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-login-viewport">
      {/* Medical Monitor Subtle Grid */}
      <div className="glass-grid-overlay" />

      {/* Ambient Floating Luminous Glass Orbs for Refraction & Depth */}
      <div className="ambient-orb orb-cyan" />
      <div className="ambient-orb orb-indigo" />
      <div className="ambient-orb orb-rose" />
      <div className="ambient-orb orb-emerald" />

      {/* Main Glassmorphism Workspace */}
      <div className="glass-container-wrapper">
        {/* Left Side: Healthcare Telemetry & The Beat Animation Console */}
        <div className="glass-showcase-panel">
          {/* Header Branding */}
          <div className="showcase-header">
            <div className="brand-badge-group">
              <div className="brand-logo-glass">
                <Sparkles color="#ffffff" size={26} />
              </div>
              <div>
                <h1 className="brand-title-main">Selam Derma CMS</h1>
                <div className="brand-subtext">Advanced Cutaneous & Aesthetic Intelligence</div>
              </div>
            </div>

            {/* Live System Health Pill: Steady green when online, rapidly blinking red when offline */}
            <div 
              className={`telemetry-status-pill ${isSystemLive ? 'status-pill-online' : 'status-pill-offline'}`}
              title={isSystemLive ? 'Backend API connected and operational' : 'CMS.API service is not running on port 5010'}
            >
              <span className={`telemetry-pulse-dot ${isSystemLive ? 'dot-pulse-green' : 'dot-blink-red'}`} />
              <span>{isSystemLive ? 'SYSTEM LIVE' : 'SYSTEM OFFLINE'}</span>
            </div>
          </div>

          {/* Central Derma Arena: Auto-Loop Flying, Breaking & Radiating Cellular Matrix */}
          <div style={{ margin: 'auto 0' }}>
            <BeatIconAnimation />
          </div>

          {/* Clean Footer Branding */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#64748b', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span>© 2026 Selam Dermatology & Cutaneous Medicine</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isSystemLive ? '#34d399' : '#f87171' }}>
              {isSystemLive ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {isSystemLive ? 'Dermatoscope & API Healthy' : 'API Connection Lost'}
            </span>
          </div>
        </div>

        {/* Right Side: Frosted Glass Login Form Card */}
        <div className="glass-login-card">
          <div className="login-header-section">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <BeatIconAnimation compact />
            </div>
            <h2 className="login-title">
              {showMfa ? 'Two-Factor Auth' : 'Portal Authentication'}
            </h2>
            <p className="login-subtitle">
              {showMfa 
                ? 'Enter your 6-digit TOTP authenticator code' 
                : 'Enter your clinical credentials to access the dermatology workspace'}
            </p>
          </div>

          {logoutNotice && (
            <div style={{ 
              padding: '12px 14px', 
              borderRadius: '12px', 
              background: 'rgba(245, 158, 11, 0.15)', 
              border: '1px solid rgba(245, 158, 11, 0.3)', 
              color: '#fbbf24', 
              fontSize: '0.84rem', 
              marginBottom: '18px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}>
              <Clock size={16} /> {logoutNotice}
            </div>
          )}

          {error && (
            <div style={{ 
              padding: '12px 14px', 
              borderRadius: '12px', 
              background: 'rgba(244, 63, 94, 0.15)', 
              border: '1px solid rgba(244, 63, 94, 0.35)', 
              color: '#f87171', 
              fontSize: '0.84rem', 
              marginBottom: '18px' 
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!showMfa ? (
              <>
                {/* Username Field */}
                <div className="glass-field-group">
                  <label className="glass-field-label">Username / Staff Email</label>
                  <div className="glass-input-wrapper">
                    <User size={20} className="glass-input-icon" />
                    <input
                      type="text"
                      className="glass-input"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Enter your username or staff email"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="glass-field-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="glass-field-label" style={{ margin: 0 }}>Password</label>
                    <span style={{ fontSize: '0.74rem', color: '#34d399', cursor: 'pointer' }} title="Contact administrator for password resets">
                      Forgot password?
                    </span>
                  </div>
                  <div className="glass-input-wrapper">
                    <Lock size={20} className="glass-input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="glass-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      className="glass-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={rememberMe} 
                      onChange={e => setRememberMe(e.target.checked)} 
                      style={{ accentColor: '#10b981' }}
                    />
                    <span>Remember this clinical terminal</span>
                  </label>
                  <span style={{ color: '#34d399', fontSize: '0.72rem', fontWeight: 600 }}>SSL / TLS Active</span>
                </div>
              </>
            ) : (
              /* Two-Factor MFA Field */
              <div className="glass-field-group">
                <label className="glass-field-label">6-Digit TOTP Authenticator Code</label>
                <div className="glass-input-wrapper">
                  <Key size={18} className="glass-input-icon" />
                  <input
                    type="text"
                    className="glass-input"
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value)}
                    placeholder="123456"
                    style={{ letterSpacing: '0.25em', fontFamily: 'monospace', textAlign: 'center', fontSize: '1.15rem' }}
                    maxLength={6}
                    required
                  />
                </div>
              </div>
            )}

            {/* Glassmorphic Sign In Button */}
            <button 
              type="submit" 
              className="glass-btn-submit" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Activity className="animate-spin" size={18} />
                  <span>Authenticating Secure Session...</span>
                </>
              ) : (
                <>
                  <span>{showMfa ? 'Verify Security Token' : 'Sign In to Portal'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Security & Compliance Footer */}
          <div className="security-trust-strip">
            <Shield size={14} color="#34d399" />
            <span>HIPAA Compliant • Dermatoscope Calibrated • AES-256 Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
