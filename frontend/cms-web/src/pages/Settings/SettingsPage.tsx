import React, { useState, useEffect } from 'react';
import { Settings, Save, Building, CheckCircle2, Loader2, HeartPulse, Stethoscope, FileHeart, Activity, ShieldCheck, Cross, FlaskConical, Palette, Type, Layers, ToggleLeft, Monitor, Sidebar } from 'lucide-react';
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

type SettingsTab = 'clinic' | 'theme';
type ThemeSection = 'background' | 'typography' | 'colors' | 'cards' | 'controls' | 'header' | 'sidebar';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('clinic');
  const [clinicName, setClinicName] = useState('General Health Clinic');
  const [address, setAddress] = useState('Bole Road, Addis Ababa, Ethiopia');
  const [phone, setPhone] = useState('+251911000000');
  const [vat, setVat] = useState('15.0');
  const [currency, setCurrency] = useState('ETB');
  const [appIcon, setAppIcon] = useState('FileHeart');
  const [savedAlert, setSavedAlert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [currentUserDisplay, setCurrentUserDisplay] = useState(getCurrentDisplayName());
  const [themeVars, setThemeVars] = useState<Record<string, string>>(() => loadThemeFromStorage());
  const [selectedFont, setSelectedFont] = useState(() => loadFontFromStorage());
  const [themeSavedAlert, setThemeSavedAlert] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [themeSection, setThemeSection] = useState<ThemeSection>('background');

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
      ]);
      window.dispatchEvent(new Event('clinic_settings_changed'));
      setSavedAlert(true); setTimeout(() => setSavedAlert(false), 3000);
    } catch (err: any) { setSaveError(err?.message || 'Failed to save settings.'); }
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

  const themeSectionItems: { key: ThemeSection; label: string; Icon: any }[] = [
    { key: 'background', label: 'System Background', Icon: Monitor },
    { key: 'typography', label: 'Typography', Icon: Type },
    { key: 'colors', label: 'Colors', Icon: Palette },
    { key: 'cards', label: 'Cards & Glass', Icon: Layers },
    { key: 'controls', label: 'Controls', Icon: ToggleLeft },
    { key: 'header', label: 'Header', Icon: Monitor },
    { key: 'sidebar', label: 'Sidebar', Icon: Sidebar },
  ];

  return (
    <div style={{ maxWidth: '880px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('clinic')} className={activeTab === 'clinic' ? 'btn-primary' : 'btn-secondary'}>
          <Settings size={15} /> Clinic Settings
        </button>
        <button onClick={() => setActiveTab('theme')} className={activeTab === 'theme' ? 'btn-primary' : 'btn-secondary'}>
          <Palette size={15} /> Theme & Appearance
        </button>
      </div>

      {activeTab === 'clinic' && (
        <div className="glass-panel" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings color="#06b6d4" size={20} /> Clinic Profile & System Configuration
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contact Phone Number</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required /></div>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Standard VAT Percentage (%)</label>
                <input type="text" value={vat} onChange={e => setVat(e.target.value)} required /></div>
            </div>
            <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Default Operating Currency</label>
              <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} required /></div>
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

      {activeTab === 'theme' && (
        <div>
          <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette color="#af52de" size={18} /> Personal Theme & Appearance Customization
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Preferences are saved per-user for <strong>{currentUserDisplay}</strong>. Your customized colors and typography will not affect other clinic users.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {themeSavedAlert && <span className="badge badge-normal"><CheckCircle2 size={12} /> Theme Saved</span>}
              <button onClick={handleResetTheme} className="btn-secondary" style={{ fontSize: '0.78rem' }}>Reset to Default</button>
              <button onClick={handleSaveTheme} className="btn-primary" style={{ background: '#af52de', borderColor: '#af52de' }}>
                <Save size={15} /> Save Theme
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '18px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '12px' }}>Quick Presets</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[
                { key: 'apple', label: 'Apple Light', bg: '#f5f5f7', accent: '#0071e3' },
                { key: 'slate', label: 'Slate Dark', bg: '#0f172a', accent: '#3b82f6' },
                { key: 'teal', label: 'Clinical Teal', bg: '#f0fdfa', accent: '#0d9488' },
                { key: 'midnight', label: 'Midnight', bg: '#09090b', accent: '#818cf8' },
              ].map(p => (
                <button key={p.key} onClick={() => applyPreset(p.key)} style={{
                  display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 18px',
                  borderRadius: '10px', cursor: 'pointer', minWidth: '110px',
                  border: activePreset === p.key ? `2px solid ${p.accent}` : '1px solid var(--border-color)',
                  background: p.bg, color: p.accent, transition: 'all 0.15s ease',
                  boxShadow: activePreset === p.key ? `0 0 0 3px ${p.accent}22` : 'none'
                }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.accent }} />
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.accent + '55' }} />
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.accent + '22' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {themeSectionItems.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setThemeSection(key)}
                className={themeSection === key ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>

            {themeSection === 'background' && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>System Background Colors</div>
                <ColorRow label="Page Background" varKey="--bg-dark" description="Main app canvas behind all panels" />
                <ColorRow label="Card / Panel Background" varKey="--bg-card" description="Glass panels, modals, tables" />
                <ColorRow label="Sidebar Background" varKey="--bg-sidebar" description="Left navigation sidebar background" />
                <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(0,113,227,0.04)', borderRadius: '10px', border: '1px solid rgba(0,113,227,0.12)' }}>
                  <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#0071e3', marginBottom: '8px' }}>Live Preview</div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1, height: '52px', borderRadius: '8px', background: themeVars['--bg-dark'], border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Page BG</div>
                    <div style={{ flex: 1, height: '52px', borderRadius: '8px', background: themeVars['--bg-card'], border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Card BG</div>
                    <div style={{ width: '80px', height: '52px', borderRadius: '8px', background: themeVars['--bg-sidebar'], border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sidebar</div>
                  </div>
                </div>
              </div>
            )}

            {themeSection === 'typography' && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>Typography & Font Settings</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {FONT_OPTIONS.map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px',
                      border: selectedFont === opt.value ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                      cursor: 'pointer', background: selectedFont === opt.value ? 'rgba(0,113,227,0.04)' : 'transparent' }}>
                      <input type="radio" name="font" checked={selectedFont === opt.value} onChange={() => handleFontChange(opt.value)} style={{ width: 'auto' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', fontFamily: opt.value }}>{opt.label}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: opt.value, marginTop: '2px' }}>
                          The quick brown fox — MRN-000123 — Br 250.00
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ padding: '14px 16px', background: 'rgba(0,113,227,0.04)', borderRadius: '10px', border: '1px solid rgba(0,113,227,0.12)' }}>
                  <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#0071e3', marginBottom: '8px' }}>Live Type Preview</div>
                  <div style={{ fontFamily: selectedFont }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Patient Health Records</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Encounter notes, prescriptions, and billing documents use this typeface.</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>MRN-000123 · Addis Ababa · 2026-09-11 · Br 250.00</div>
                  </div>
                </div>
              </div>
            )}

            {themeSection === 'colors' && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>System Accent Colors</div>
                <ColorRow label="Primary Blue (Buttons & Links)" varKey="--accent-blue" description="Main CTA color: buttons, active tabs, focus rings" />
                <ColorRow label="Success Green" varKey="--accent-emerald" description="Paid, Dispensed, Completed status indicators" />
                <ColorRow label="Warning Amber" varKey="--accent-amber" description="Pending, In-Progress, Warning states" />
                <ColorRow label="Danger Red" varKey="--accent-rose" description="Critical alerts, delete actions, emergency indicators" />
                <ColorRow label="Main Text Color" varKey="--text-main" description="Primary text on headings and content" />
                <ColorRow label="Secondary Text Color" varKey="--text-secondary" description="Labels, supporting information" />
                <ColorRow label="Border Color" varKey="--border-color" description="Table dividers, card borders, input outlines" />
              </div>
            )}

            {themeSection === 'cards' && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>Cards & Glass Panel Style</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Border Radius</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Corner rounding for cards, modals, panels</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['6px', '10px', '14px', '18px', '24px'].map(r => (
                      <button key={r} onClick={() => updateThemeVar('--card-radius', r)}
                        style={{ padding: '6px 10px', borderRadius: r, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                          border: themeVars['--card-radius'] === r ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                          background: themeVars['--card-radius'] === r ? 'rgba(0,113,227,0.08)' : 'var(--bg-card)',
                          color: themeVars['--card-radius'] === r ? 'var(--accent-blue)' : 'var(--text-main)' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <ColorRow label="Card / Panel Background" varKey="--bg-card" description="Glass panel fill color" />
                <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(0,113,227,0.04)', borderRadius: '10px', border: '1px solid rgba(0,113,227,0.12)' }}>
                  <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#0071e3', marginBottom: '10px' }}>Live Card Preview</div>
                  <div style={{ background: themeVars['--bg-card'], border: `1px solid ${themeVars['--border-color']}`, borderRadius: themeVars['--card-radius'] || '14px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>Sample Panel</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>This is how glass panels will appear throughout the app.</div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                      <span className="badge badge-normal">Active</span>
                      <span className="badge badge-warning">Pending</span>
                      <span className="badge badge-critical">Alert</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {themeSection === 'controls' && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>Input & Button Controls</div>
                <ColorRow label="Primary Button Color" varKey="--accent-blue" description="Background for btn-primary buttons" />
                <ColorRow label="Input Background" varKey="--bg-card" description="Input fields, dropdowns, and textarea backgrounds" />
                <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(0,113,227,0.04)', borderRadius: '10px', border: '1px solid rgba(0,113,227,0.12)' }}>
                  <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#0071e3', marginBottom: '10px' }}>Live Controls Preview</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input type="text" placeholder="Sample text input..." style={{ maxWidth: '300px' }} readOnly />
                    <div style={{ display: 'flex', gap: '8px' }}><button className="btn-primary">Primary Button</button><button className="btn-secondary">Secondary Button</button></div>
                    <select style={{ maxWidth: '220px' }}><option>Sample Dropdown Option</option></select>
                  </div>
                </div>
              </div>
            )}

            {themeSection === 'header' && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>Header / Navigation Bar</div>
                <ColorRow label="Header Background" varKey="--bg-card" description="Topbar backdrop (uses card background with glass blur)" />
                <ColorRow label="Header Border" varKey="--border-color" description="Bottom separator line of the header" />
                <ColorRow label="Accent / Badge Color" varKey="--accent-blue" description="Clinic icon badge and active state highlights" />
                <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(0,113,227,0.04)', borderRadius: '10px', border: '1px solid rgba(0,113,227,0.12)' }}>
                  <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#0071e3', marginBottom: '10px' }}>Live Header Preview</div>
                  <div style={{ background: themeVars['--bg-card'] || '#ffffff', borderBottom: `1px solid ${themeVars['--border-color'] || '#e5e5ea'}`, borderRadius: '10px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: themeVars['--accent-blue'] || '#0071e3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <HeartPulse size={16} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: themeVars['--text-main'] || '#1d1d1f' }}>Clinic Name</div>
                      <div style={{ fontSize: '0.7rem', color: themeVars['--text-secondary'] || '#6e6e73' }}>Patient Records</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {themeSection === 'sidebar' && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>Sidebar Navigation</div>
                <ColorRow label="Sidebar Background" varKey="--bg-sidebar" description="Left navigation sidebar background color" />
                <ColorRow label="Active Nav Item Accent" varKey="--accent-blue" description="Selected menu item highlight color" />
                <ColorRow label="Divider / Border Color" varKey="--border-color" description="Category separators and item hover borders" />
                <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(0,113,227,0.04)', borderRadius: '10px', border: '1px solid rgba(0,113,227,0.12)' }}>
                  <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#0071e3', marginBottom: '10px' }}>Live Sidebar Preview</div>
                  <div style={{ width: '180px', background: themeVars['--bg-sidebar'] || '#ffffff', border: `1px solid ${themeVars['--border-color'] || '#e5e5ea'}`, borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {['Dashboard', 'Patients', 'Pharmacy', 'Laboratory'].map((item, i) => (
                      <div key={item} style={{ padding: '8px 10px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                        background: i === 0 ? `${themeVars['--accent-blue'] || '#0071e3'}18` : 'transparent',
                        color: i === 0 ? (themeVars['--accent-blue'] || '#0071e3') : (themeVars['--text-secondary'] || '#6e6e73'),
                        display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? (themeVars['--accent-blue'] || '#0071e3') : 'transparent' }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}