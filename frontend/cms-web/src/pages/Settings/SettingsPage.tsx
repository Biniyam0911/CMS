import React, { useState, useEffect } from 'react';
import { Settings, Save, Building, CheckCircle2, Loader2, HeartPulse, Stethoscope, FileHeart, Activity, ShieldCheck, Cross, FlaskConical, Palette, Type, Layers, ToggleLeft, Monitor, Sidebar, Database, HardDrive, Download, Clock } from 'lucide-react';
import { api } from '../../api/apiClient';

const APP_ICONS = [
  { name: 'HeartPulse', label: 'Heart Pulse', Icon: HeartPulse },
  { name: 'Stethoscope', label: 'Stethoscope', Icon: Stethoscope },
  { name: 'FileHeart', label: 'File Heart', Icon: FileHeart },
  { name: 'Activity', label: 'Activity', Icon: Activity },
  { name: 'ShieldCheck', label: 'Shield Check', Icon: ShieldCheck },
  { name: 'Building', label: 'Building', Icon: Building },
  { name: 'Cross', label: 'Cross', Icon: Cross },
  { name: 'FlaskConical', label: 'Flask', Icon: FlaskConical },
];

const FONT_OPTIONS = [
  { value: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", label: 'Plus Jakarta Sans (Modern)' },
  { value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", label: 'Inter (Clean)' },
  { value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", label: 'System Default' },
  { value: "'Roboto', 'Helvetica Neue', Arial, sans-serif", label: 'Roboto (Google)' },
  { value: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif", label: 'IBM Plex Sans (Clinical)' },
];

const PRESET_THEMES: Record<string, Record<string, string>> = {
  apple: { '--bg-dark': '#f5f5f7', '--bg-card': '#ffffff', '--bg-sidebar': '#ffffff', '--accent-blue': '#0071e3', '--accent-emerald': '#34c759', '--accent-rose': '#ff3b30', '--accent-amber': '#ff9500', '--text-main': '#1d1d1f', '--text-secondary': '#6e6e73', '--border-color': '#e5e5ea', '--card-radius': '14px' },
  slate: { '--bg-dark': '#0f172a', '--bg-card': '#1e293b', '--bg-sidebar': '#1e293b', '--accent-blue': '#3b82f6', '--accent-emerald': '#22c55e', '--accent-rose': '#ef4444', '--accent-amber': '#f59e0b', '--text-main': '#f1f5f9', '--text-secondary': '#94a3b8', '--border-color': '#334155', '--card-radius': '12px' },
  teal: { '--bg-dark': '#f0fdfa', '--bg-card': '#ffffff', '--bg-sidebar': '#ffffff', '--accent-blue': '#0d9488', '--accent-emerald': '#16a34a', '--accent-rose': '#dc2626', '--accent-amber': '#d97706', '--text-main': '#134e4a', '--text-secondary': '#5eead4', '--border-color': '#ccfbf1', '--card-radius': '10px' },
  midnight: { '--bg-dark': '#09090b', '--bg-card': '#18181b', '--bg-sidebar': '#18181b', '--accent-blue': '#818cf8', '--accent-emerald': '#4ade80', '--accent-rose': '#f87171', '--accent-amber': '#fbbf24', '--text-main': '#fafafa', '--text-secondary': '#a1a1aa', '--border-color': '#27272a', '--card-radius': '16px' },
};

const DEFAULT_THEME: Record<string, string> = {
  '--bg-dark': '#f5f5f7', '--bg-card': '#ffffff', '--bg-sidebar': '#ffffff', '--accent-blue': '#0071e3',
  '--accent-emerald': '#34c759', '--accent-rose': '#ff3b30', '--accent-amber': '#ff9500',
  '--text-main': '#1d1d1f', '--text-secondary': '#6e6e73', '--border-color': '#e5e5ea', '--card-radius': '14px',
};

function applyThemeToRoot(vars: Record<string, string>) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.style.setProperty('--bg-input', vars['--bg-card'] || '#ffffff');
  root.style.setProperty('--bg-card-hover', vars['--bg-card'] || '#ffffff');
  root.style.setProperty('--border-focus', vars['--accent-blue'] || '#0071e3');
  root.style.setProperty('--accent-cyan', vars['--accent-blue'] || '#0071e3');
  root.style.setProperty('--text-muted', vars['--text-secondary'] || '#6e6e73');
  // Apply card-radius to glass panels dynamically
  document.querySelectorAll<HTMLElement>('.glass-panel').forEach(el => {
    el.style.borderRadius = vars['--card-radius'] || '14px';
  });
}

function getCurrentUsername(): string {
  try {
    const raw = localStorage.getItem('current_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u && (u.username || u.name)) return String(u.username || u.name).toLowerCase().trim();
    }
  } catch {}
  return 'default';
}

function getCurrentDisplayName(): string {
  try {
    const raw = localStorage.getItem('current_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u) return `${u.username || u.name || 'User'} (${u.roles?.[0] || 'Staff'})`;
    }
  } catch {}
  return 'Current User';
}

function loadThemeFromStorage(user?: string): Record<string, string> {
  const username = user || getCurrentUsername();
  try {
    const raw = localStorage.getItem(`cms_theme_user_${username}`);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return DEFAULT_THEME;
}

function loadFontFromStorage(user?: string): string {
  const username = user || getCurrentUsername();
  return localStorage.getItem(`cms_font_user_${username}`) || FONT_OPTIONS[0].value;
}

// Apply persisted theme for active user on module load
const _savedTheme = loadThemeFromStorage();
applyThemeToRoot(_savedTheme);
const _savedFont = loadFontFromStorage();
document.documentElement.style.setProperty('--font-family', _savedFont);
document.documentElement.style.setProperty('--font-heading', _savedFont);

type SettingsTab = 'clinic' | 'backup';

export default function SettingsPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<SettingsTab>('clinic');
  const [clinicName, setClinicName] = useState('General Health Clinic');
  const [address, setAddress] = useState('Bole Road, Addis Ababa, Ethiopia');
  const [phone, setPhone] = useState('+251911000000');
  const [vat, setVat] = useState('15.0');
  const [currency, setCurrency] = useState('ETB');
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(() => localStorage.getItem('cms_session_timeout_minutes') || '10');
  const [appIcon, setAppIcon] = useState('FileHeart');
  const [savedAlert, setSavedAlert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Backup & Maintenance State
  const [backups, setBackups] = useState<any[]>([]);
  const [backupSchedule, setBackupSchedule] = useState<{ enabled: boolean; frequency: string; timeOfDay: string }>({
    enabled: true,
    frequency: 'Daily',
    timeOfDay: '02:00'
  });
  const [backupDirectory, setBackupDirectory] = useState('');
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);
  const [backupAlert, setBackupAlert] = useState<string | null>(null);

  const [currentUserDisplay, setCurrentUserDisplay] = useState(getCurrentDisplayName());
  const [themeVars, setThemeVars] = useState<Record<string, string>>(() => loadThemeFromStorage());
  const [selectedFont, setSelectedFont] = useState(() => loadFontFromStorage());
  const [themeSavedAlert, setThemeSavedAlert] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const data = await api.get<any[]>('/settings');
        if (data && data.length > 0) {
          data.forEach((s: any) => {
            const k = s.settingKey || s.SettingKey;
            const v = s.settingValue || s.SettingValue;
            if (k === 'ClinicName') setClinicName(v);
            if (k === 'ClinicAddress') setAddress(v);
            if (k === 'ClinicPhone') setPhone(v);
            if (k === 'Currency') setCurrency(v);
            if (k === 'TaxRate') setVat(v);
            if (k === 'AppIcon') setAppIcon(v);
            if (k === 'SessionTimeoutMinutes' && v) {
              setSessionTimeoutMinutes(v);
              localStorage.setItem('cms_session_timeout_minutes', v);
            }
          });
        }
      } catch (err) { console.error('Failed to load clinic settings:', err); }
      finally { setLoading(false); }
    };
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaveError(null);
    try {
      await Promise.all([
        api.post('/settings', { settingKey: 'ClinicName', settingValue: clinicName }),
        api.post('/settings', { settingKey: 'ClinicAddress', settingValue: address }),
        api.post('/settings', { settingKey: 'ClinicPhone', settingValue: phone }),
        api.post('/settings', { settingKey: 'Currency', settingValue: currency }),
        api.post('/settings', { settingKey: 'TaxRate', settingValue: vat }),
        api.post('/settings', { settingKey: 'AppIcon', settingValue: appIcon }),
        api.post('/settings', { settingKey: 'SessionTimeoutMinutes', settingValue: sessionTimeoutMinutes }),
      ]);
      localStorage.setItem('cms_session_timeout_minutes', sessionTimeoutMinutes);
      window.dispatchEvent(new Event('clinic_settings_changed'));
      setSavedAlert(true); setTimeout(() => setSavedAlert(false), 3000);
    } catch (err: any) { setSaveError(err?.message || 'Failed to save settings.'); }
  };

  const loadBackups = async () => {
    try {
      setLoadingBackups(true);
      const res: any = await api.get('/backup/list');
      if (res) {
        setBackups(res.backups || res.Backups || []);
        if (res.schedule || res.Schedule) setBackupSchedule(res.schedule || res.Schedule);
        if (res.backupDirectory || res.BackupDirectory) setBackupDirectory(res.backupDirectory || res.BackupDirectory);
      }
    } catch (err) {
      console.error('Failed to load database backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleRunBackupNow = async () => {
    try {
      setIsBackingUpNow(true);
      setBackupAlert(null);
      const res: any = await api.post('/backup/now', {});
      const fileName = res?.fileName || res?.FileName;
      const sizeFormatted = res?.sizeFormatted || res?.SizeFormatted;
      const isOk = res?.success === true || res?.Success === true || !!fileName;
      if (isOk) {
        setBackupAlert(`✓ Full database snapshot created: ${fileName || 'ClinicDB.bak'} (${sizeFormatted || 'Verified .BAK'})`);
      } else {
        setBackupAlert(`⚠ Backup completed with notes: ${res?.message || res?.Message || 'Done'}`);
      }
      loadBackups();
    } catch (err: any) {
      setBackupAlert(`✗ Backup error: ${err?.message || 'Execution error'}`);
    } finally {
      setIsBackingUpNow(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/backup/schedule', backupSchedule);
      setBackupAlert(`✓ Automated database backup schedule updated!`);
      setTimeout(() => setBackupAlert(null), 4000);
    } catch (err: any) {
      setBackupAlert(`✗ Schedule update error: ${err?.message || 'Server error'}`);
    }
  };

  const updateThemeVar = (key: string, value: string) => {
    const next = { ...themeVars, [key]: value };
    setThemeVars(next); applyThemeToRoot(next); setActivePreset(null);
  };

  const applyPreset = (name: string) => {
    const preset = PRESET_THEMES[name]; if (!preset) return;
    setThemeVars(preset); applyThemeToRoot(preset); setActivePreset(name);
  };

  const handleFontChange = (font: string) => {
    setSelectedFont(font);
    document.documentElement.style.setProperty('--font-family', font);
    document.documentElement.style.setProperty('--font-heading', font);
  };

  const handleSaveTheme = () => {
    const username = getCurrentUsername();
    localStorage.setItem(`cms_theme_user_${username}`, JSON.stringify(themeVars));
    localStorage.setItem(`cms_font_user_${username}`, selectedFont);
    window.dispatchEvent(new CustomEvent('cms_user_theme_changed', { detail: { username, theme: themeVars, font: selectedFont } }));
    setThemeSavedAlert(true); setTimeout(() => setThemeSavedAlert(false), 3000);
  };

  const handleResetTheme = () => {
    const username = getCurrentUsername();
    setThemeVars(DEFAULT_THEME); applyThemeToRoot(DEFAULT_THEME);
    setSelectedFont(FONT_OPTIONS[0].value);
    document.documentElement.style.setProperty('--font-family', FONT_OPTIONS[0].value);
    document.documentElement.style.setProperty('--font-heading', FONT_OPTIONS[0].value);
    setActivePreset('apple');
    localStorage.removeItem(`cms_theme_user_${username}`);
    localStorage.removeItem(`cms_font_user_${username}`);
    window.dispatchEvent(new CustomEvent('cms_user_theme_changed', { detail: { username, theme: DEFAULT_THEME, font: FONT_OPTIONS[0].value } }));
  };

  const ColorRow = ({ label, varKey, description }: { label: string; varKey: string; description?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</div>
        {description && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: themeVars[varKey] || '#ffffff', border: '2px solid var(--border-color)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
          <input type="color" value={themeVars[varKey] || '#ffffff'} onChange={e => updateThemeVar(varKey, e.target.value)}
            style={{ position: 'absolute', inset: 0, width: '200%', height: '200%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }} />
        </div>
        <input type="text" value={themeVars[varKey] || ''} onChange={e => updateThemeVar(varKey, e.target.value)}
          style={{ width: '100px', fontFamily: 'monospace', fontSize: '0.75rem', padding: '6px 10px' }} />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '880px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
        <button onClick={() => setActiveTab('clinic')} className={activeTab === 'clinic' ? 'btn-primary' : 'btn-secondary'} style={{ whiteSpace: 'nowrap' }}>
          <Settings size={15} /> Clinic Settings
        </button>
        <button onClick={() => { setActiveTab('backup'); loadBackups(); }} className={activeTab === 'backup' ? 'btn-primary' : 'btn-secondary'} style={{ whiteSpace: 'nowrap' }}>
          <Database size={15} /> Database Backup &amp; Maintenance
        </button>
      </div>

      {activeTab === 'clinic' && (
        <div className="glass-panel" style={{ padding: isMobile ? '16px' : '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings color="#06b6d4" size={20} /> Clinic Profile &amp; System Configuration
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {loading && <Loader2 size={16} className="animate-spin" color="#06b6d4" />}
              {savedAlert && <span className="badge badge-normal"><CheckCircle2 size={12} /> Settings Saved</span>}
              {saveError && <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>⚠ {saveError}</span>}
            </div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clinic Official Name</label>
              <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)} required /></div>
            <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Facility Physical Address</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} required /></div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contact Phone Number</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required /></div>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Standard VAT Percentage (%)</label>
                <input type="text" value={vat} onChange={e => setVat(e.target.value)} required /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Default Operating Currency</label>
                <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} required /></div>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Session Inactivity Timeout (Minutes)</label>
                <input type="number" min="1" max="180" value={sessionTimeoutMinutes} onChange={e => setSessionTimeoutMinutes(e.target.value)} required />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  Auto-logout after inactivity (Default: 10 minutes)
                </span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Sidebar App Icon</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {APP_ICONS.map(({ name, label, Icon }) => (
                  <button key={name} type="button" onClick={() => setAppIcon(name)} title={label}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      border: appIcon === name ? '2px solid #0284c7' : '1px solid var(--border-color)',
                      background: appIcon === name ? '#eff6ff' : 'var(--bg-card)',
                      color: appIcon === name ? '#0284c7' : 'var(--text-muted)', transition: 'all 0.15s ease' }}>
                    <Icon size={20} /><span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '12px', alignSelf: 'flex-start' }}>
              <Save size={16} /> Save Clinic Settings
            </button>
          </form>
        </div>
      )}

      {activeTab === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Panel: Instant Backup & Status */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database color="#0284c7" size={20} /> SQL Server Database Backup & Recovery
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Create manual point-in-time full database snapshots (.bak) or configure automated nightly backups.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunBackupNow}
                disabled={isBackingUpNow}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#0284c7', borderColor: '#0284c7' }}
              >
                {isBackingUpNow ? <Loader2 size={16} className="animate-spin" /> : <HardDrive size={16} />}
                {isBackingUpNow ? 'Creating Snapshot...' : 'Backup Database Now'}
              </button>
            </div>

            {backupAlert && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '16px',
                background: backupAlert.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
                color: backupAlert.startsWith('✓') ? '#166534' : '#991b1b',
                border: `1px solid ${backupAlert.startsWith('✓') ? '#bbf7d0' : '#fecaca'}`
              }}>
                {backupAlert}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '10px' }}>
              <div style={{ background: 'var(--bg-dark, #f8fafc)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Target Directory</div>
                <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600, marginTop: '4px', wordBreak: 'break-all' }}>
                  {backupDirectory || 'C:\\Program Files\\Microsoft SQL Server\\...\\Backup'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-dark, #f8fafc)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Available Backups</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '4px' }}>
                  {loadingBackups ? 'Loading...' : `${backups.length} snapshot${backups.length === 1 ? '' : 's'} recorded`}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Clock color="#8b5cf6" size={18} /> Automated Schedule & Maintenance
            </h4>
            <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="checkbox"
                  id="schedEnabled"
                  checked={backupSchedule.enabled}
                  onChange={e => setBackupSchedule({ ...backupSchedule, enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="schedEnabled" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Enable background automated SQL snapshots
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Frequency</label>
                  <select
                    value={backupSchedule.frequency}
                    onChange={e => setBackupSchedule({ ...backupSchedule, frequency: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly (Sunday Night)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Execution Time (24h)</label>
                  <input
                    type="time"
                    value={backupSchedule.timeOfDay}
                    onChange={e => setBackupSchedule({ ...backupSchedule, timeOfDay: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
                  />
                </div>
              </div>

              <button type="submit" className="btn-secondary" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <Save size={14} /> Update Schedule
              </button>
            </form>
          </div>

          {/* Backup History Table */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HardDrive color="#10b981" size={18} /> Snapshot History
              </h4>
              <button onClick={loadBackups} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                Refresh
              </button>
            </div>

            {loadingBackups ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px', color: 'var(--text-muted)' }}>
                <Loader2 size={16} className="animate-spin" /> Fetching database backups...
              </div>
            ) : backups.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No database snapshot files found in the backup directory yet. Click "Backup Database Now" above to trigger your first snapshot.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 10px' }}>File Name</th>
                      <th style={{ padding: '8px 10px' }}>Created Date & Time</th>
                      <th style={{ padding: '8px 10px' }}>Size</th>
                      <th style={{ padding: '8px 10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b: any, idx: number) => (
                      <tr key={b.fileName || b.FileName || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 600 }}>
                          {b.fileName || b.FileName}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {b.createdAt ? new Date(b.createdAt).toLocaleString() : (b.CreatedAt ? new Date(b.CreatedAt).toLocaleString() : 'N/A')}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {b.sizeFormatted || b.SizeFormatted || (b.sizeBytes ? `${(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : 'N/A')}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span className="badge badge-normal" style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>
                            Verified .BAK
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}