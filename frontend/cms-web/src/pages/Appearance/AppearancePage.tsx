import React, { useState, useEffect } from 'react';
import {
  Palette, Sun, Moon, Type, Layout, Sliders, CheckCircle2,
  RotateCcw, Save, Eye, Layers, ShieldCheck, UserCheck, Upload,
  Image as ImageIcon, Sparkles, Check, Globe, Laptop
} from 'lucide-react';

export const PRESET_THEMES: Record<string, Record<string, string>> = {
  'Classic Clinical': {
    '--bg-dark': '#f5f5f7', '--bg-card': '#ffffff', '--bg-sidebar': '#ffffff', '--accent-blue': '#0071e3',
    '--accent-emerald': '#34c759', '--accent-rose': '#ff3b30', '--accent-amber': '#ff9500',
    '--text-main': '#1d1d1f', '--text-secondary': '#6e6e73', '--border-color': '#e5e5ea', '--card-radius': '14px'
  },
  'Clean Light': {
    '--bg-dark': '#f8fafc', '--bg-card': '#ffffff', '--bg-sidebar': '#f1f5f9', '--accent-blue': '#2563eb',
    '--accent-emerald': '#16a34a', '--accent-rose': '#dc2626', '--accent-amber': '#d97706',
    '--text-main': '#0f172a', '--text-secondary': '#64748b', '--border-color': '#e2e8f0', '--card-radius': '10px'
  },
  'Royal Sapphire': {
    '--bg-dark': '#f0f4f8', '--bg-card': '#ffffff', '--bg-sidebar': '#0f172a', '--accent-blue': '#1d4ed8',
    '--accent-emerald': '#059669', '--accent-rose': '#e11d48', '--accent-amber': '#d97706',
    '--text-main': '#0f172a', '--text-secondary': '#475569', '--border-color': '#cbd5e1', '--card-radius': '12px'
  },
  'Warm Ivory': {
    '--bg-dark': '#faf8f5', '--bg-card': '#ffffff', '--bg-sidebar': '#fdfbf7', '--accent-blue': '#0284c7',
    '--accent-emerald': '#10b981', '--accent-rose': '#f43f5e', '--accent-amber': '#f59e0b',
    '--text-main': '#292524', '--text-secondary': '#78716c', '--border-color': '#e7e5e4', '--card-radius': '12px'
  },
  'Modern Dark': {
    '--bg-dark': '#0f172a', '--bg-card': '#1e293b', '--bg-sidebar': '#090d16', '--accent-blue': '#38bdf8',
    '--accent-emerald': '#34d399', '--accent-rose': '#f87171', '--accent-amber': '#fbbf24',
    '--text-main': '#f8fafc', '--text-secondary': '#94a3b8', '--border-color': '#334155', '--card-radius': '12px'
  },
  'Forest Emerald': {
    '--bg-dark': '#f0fdf4', '--bg-card': '#ffffff', '--bg-sidebar': '#14532d', '--accent-blue': '#059669',
    '--accent-emerald': '#10b981', '--accent-rose': '#e11d48', '--accent-amber': '#d97706',
    '--text-main': '#064e3b', '--text-secondary': '#374151', '--border-color': '#bbf7d0', '--card-radius': '12px'
  }
};

export const DEFAULT_THEME: Record<string, string> = PRESET_THEMES['Classic Clinical'];

export const PRESET_WATERMARKS = [
  { name: 'Caduceus Medical', url: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=400&q=80' },
  { name: 'Hospital Cross', url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=400&q=80' },
  { name: 'Stethoscope Art', url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=400&q=80' }
];

export function applyThemeToRoot(vars: Record<string, string>) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.setProperty('--bg-input', vars['--bg-card'] || '#ffffff');
  root.style.setProperty('--bg-card-hover', vars['--bg-card'] || '#ffffff');
  root.style.setProperty('--border-focus', vars['--accent-blue'] || '#0071e3');
  root.style.setProperty('--accent-cyan', vars['--accent-blue'] || '#0071e3');
  root.style.setProperty('--text-muted', vars['--text-secondary'] || '#6e6e73');
}

export default function AppearancePage() {
  const [currentUser, setCurrentUser] = useState<string>('admin');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('current_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && (u.username || u.name)) setCurrentUser(String(u.username || u.name).toLowerCase().trim());
      }
    } catch {}
  }, []);

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [themeSection, setThemeSection] = useState<'background' | 'typography' | 'colors' | 'cards' | 'sidebar'>('background');
  const [applyToAllUsers, setApplyToAllUsers] = useState<boolean>(false);
  const [savedAlert, setSavedAlert] = useState<string | null>(null);

  // Background Mode: 'color' or 'image'
  const [bgMode, setBgMode] = useState<'color' | 'image'>(() => {
    return localStorage.getItem('cms_bg_mode') === 'image' ? 'image' : 'color';
  });

  const [watermarkUrl, setWatermarkUrl] = useState<string>(() => {
    return localStorage.getItem('cms_watermark_url') || '';
  });

  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(() => {
    const val = parseFloat(localStorage.getItem('cms_watermark_opacity') || '0.10');
    return isNaN(val) ? 0.10 : val;
  });

  const [watermarkSize, setWatermarkSize] = useState<number>(() => {
    const val = parseInt(localStorage.getItem('cms_watermark_size') || '35');
    return isNaN(val) ? 35 : val;
  });

  // Theme Variables
  const [themeVars, setThemeVars] = useState<Record<string, string>>(() => {
    try {
      const uKey = currentUser || 'admin';
      const userRaw = localStorage.getItem(`cms_theme_user_${uKey}`);
      if (userRaw) return { ...DEFAULT_THEME, ...JSON.parse(userRaw) };
      const globalRaw = localStorage.getItem('cms_theme_global');
      if (globalRaw) return { ...DEFAULT_THEME, ...JSON.parse(globalRaw) };
    } catch {}
    return DEFAULT_THEME;
  });

  // Selected Font
  const [fontFamily, setFontFamily] = useState<string>(() => {
    try {
      const uKey = currentUser || 'admin';
      return localStorage.getItem(`cms_font_user_${uKey}`) || localStorage.getItem('cms_font_global') || "'Plus Jakarta Sans', 'Inter', sans-serif";
    } catch {
      return "'Plus Jakarta Sans', 'Inter', sans-serif";
    }
  });

  const updateThemeVar = (key: string, value: string) => {
    const next = { ...themeVars, [key]: value };
    setThemeVars(next);
    applyThemeToRoot(next);
    setActivePreset(null);
  };

  const applyPreset = (name: string) => {
    const preset = PRESET_THEMES[name];
    if (!preset) return;
    setThemeVars(preset);
    applyThemeToRoot(preset);
    setActivePreset(name);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size exceeds 2MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      if (dataUri) {
        setWatermarkUrl(dataUri);
        setBgMode('image');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAppearance = () => {
    // Save watermark configuration
    localStorage.setItem('cms_bg_mode', bgMode);
    localStorage.setItem('cms_watermark_url', watermarkUrl);
    localStorage.setItem('cms_watermark_opacity', String(watermarkOpacity));
    localStorage.setItem('cms_watermark_size', String(watermarkSize));

    if (applyToAllUsers) {
      // Global Clinic-Wide Save
      localStorage.setItem('cms_theme_global', JSON.stringify(themeVars));
      localStorage.setItem('cms_font_global', fontFamily);
      localStorage.setItem('cms_watermark_global', watermarkUrl);
      localStorage.setItem('cms_watermark_opacity_global', String(watermarkOpacity));
      localStorage.setItem('cms_bg_mode_global', bgMode);

      window.dispatchEvent(new CustomEvent('cms_user_theme_changed', {
        detail: {
          global: true,
          theme: themeVars,
          font: fontFamily,
          bgMode,
          watermarkUrl,
          watermarkOpacity,
          watermarkSize
        }
      }));

      setSavedAlert('Appearance applied to ALL clinic users successfully!');
    } else {
      // User-Specific Save
      const uKey = currentUser || 'admin';
      localStorage.setItem(`cms_theme_user_${uKey}`, JSON.stringify(themeVars));
      localStorage.setItem(`cms_font_user_${uKey}`, fontFamily);
      localStorage.setItem(`cms_watermark_user_${uKey}`, watermarkUrl);
      localStorage.setItem(`cms_bg_mode_user_${uKey}`, bgMode);

      window.dispatchEvent(new CustomEvent('cms_user_theme_changed', {
        detail: {
          username: uKey,
          theme: themeVars,
          font: fontFamily,
          bgMode,
          watermarkUrl,
          watermarkOpacity,
          watermarkSize
        }
      }));

      setSavedAlert(`Personal appearance saved for @${currentUser}!`);
    }

    setTimeout(() => setSavedAlert(null), 4000);
  };

  const handleReset = () => {
    setThemeVars(DEFAULT_THEME);
    applyThemeToRoot(DEFAULT_THEME);
    setBgMode('color');
    setWatermarkUrl('');
    setWatermarkOpacity(0.10);
    setWatermarkSize(35);

    const uKey = currentUser || 'admin';
    localStorage.removeItem(`cms_theme_user_${uKey}`);
    localStorage.removeItem(`cms_font_user_${uKey}`);
    localStorage.removeItem(`cms_watermark_user_${uKey}`);
    localStorage.removeItem('cms_bg_mode');
    localStorage.removeItem('cms_watermark_url');

    window.dispatchEvent(new CustomEvent('cms_user_theme_changed', {
      detail: {
        username: uKey,
        theme: DEFAULT_THEME,
        bgMode: 'color',
        watermarkUrl: '',
        watermarkOpacity: 0.10
      }
    }));

    setSavedAlert('Reset to factory default appearance.');
    setTimeout(() => setSavedAlert(null), 3000);
  };

  const renderColorInput = (label: string, varKey: string, desc?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{desc}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: themeVars[varKey] || '#ffffff', border: '1px solid var(--border-color)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
          <input type="color" value={themeVars[varKey] || '#ffffff'} onChange={e => updateThemeVar(varKey, e.target.value)} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
        </div>
        <input type="text" value={themeVars[varKey] || ''} onChange={e => updateThemeVar(varKey, e.target.value)} style={{ width: '85px', fontSize: '0.78rem', fontFamily: 'monospace', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Top Banner & Action Controls */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Palette size={24} color="#af52de" />
              System Theme &amp; Visual Appearance
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              Configure clinical brand colors, typography, and page background watermark
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Scope Toggle: All Users vs Current User */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: applyToAllUsers ? '1.5px solid #0071e3' : '1px solid var(--border-color)',
                background: applyToAllUsers ? 'rgba(0, 113, 227, 0.08)' : 'var(--bg-card)',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <input
                type="checkbox"
                checked={applyToAllUsers}
                onChange={e => setApplyToAllUsers(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#0071e3' }}
              />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: applyToAllUsers ? '#0071e3' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={13} /> Apply to All Users
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                  {applyToAllUsers ? 'Global clinic-wide default' : `Individual user (@${currentUser})`}
                </div>
              </div>
            </label>

            <button onClick={handleReset} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.84rem' }}>
              <RotateCcw size={14} /> Reset
            </button>
            <button
              onClick={handleSaveAppearance}
              className="btn-primary"
              style={{ background: '#af52de', borderColor: '#af52de', padding: '8px 20px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={15} /> Save Appearance
            </button>
          </div>
        </div>

        {savedAlert && (
          <div style={{ marginTop: '14px', padding: '10px 16px', borderRadius: '8px', background: 'rgba(52, 199, 89, 0.15)', border: '1px solid #34c759', color: '#166534', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            {savedAlert}
          </div>
        )}
      </div>

      {/* Preset Themes Selector */}
      <div className="glass-panel" style={{ padding: '18px 22px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 800, marginBottom: '12px' }}>
          One-Click Theme Presets:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
          {Object.entries(PRESET_THEMES).map(([name, vars]) => {
            const isCurrent = activePreset === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => applyPreset(name)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: isCurrent ? '2px solid #0071e3' : '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: isCurrent ? '0 2px 8px rgba(0, 113, 227, 0.15)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: isCurrent ? 800 : 600, color: 'var(--text-main)' }}>{name}</span>
                  {isCurrent && <Check size={14} color="#0071e3" />}
                </div>
                <div style={{ display: 'flex', height: '14px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ flex: 1, background: vars['--bg-dark'] }} />
                  <div style={{ flex: 1, background: vars['--bg-card'] }} />
                  <div style={{ flex: 1, background: vars['--accent-blue'] }} />
                  <div style={{ flex: 1, background: vars['--accent-emerald'] }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px', overflowX: 'auto' }}>
        {[
          { key: 'background', label: 'System Background & Watermark', icon: ImageIcon },
          { key: 'typography', label: 'Typography & Fonts', icon: Type },
          { key: 'colors', label: 'Brand & Status Colors', icon: Palette },
          { key: 'cards', label: 'Cards & Radius', icon: Layout },
          { key: 'sidebar', label: 'Sidebar & Shell', icon: Sliders }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setThemeSection(key as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              borderBottom: themeSection === key ? '2.5px solid #0071e3' : '2.5px solid transparent',
              color: themeSection === key ? '#0071e3' : 'var(--text-secondary)',
              fontWeight: themeSection === key ? 800 : 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}

      {/* 1. SYSTEM BACKGROUND & WATERMARK (CORE USER FEATURE) */}
      {themeSection === 'background' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Mode Selector Card */}
          <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px' }}>
              System Page Background Type:
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {/* Solid Color Mode Option */}
              <div
                onClick={() => setBgMode('color')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: bgMode === 'color' ? '2px solid #0071e3' : '1px solid var(--border-color)',
                  background: bgMode === 'color' ? 'rgba(0, 113, 227, 0.05)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: bgMode === 'color' ? '5px solid #0071e3' : '2px solid var(--border-color)', background: '#fff', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)', display: 'block' }}>Solid Color Background</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                    Clean, flat medical background color without any graphics or watermarks
                  </span>
                </div>
              </div>

              {/* Image Watermark Mode Option */}
              <div
                onClick={() => setBgMode('image')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: bgMode === 'image' ? '2px solid #af52de' : '1px solid var(--border-color)',
                  background: bgMode === 'image' ? 'rgba(175, 82, 222, 0.05)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: bgMode === 'image' ? '5px solid #af52de' : '2px solid var(--border-color)', background: '#fff', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)', display: 'block' }}>Image Watermark Background</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                    Displays a clinic logo or custom image as an elegant, non-intrusive watermark behind all pages
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Color Settings (Always available) */}
          <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Base Background Colors
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
              {renderColorInput('App Main Canvas Background', '--bg-dark', 'The outermost background behind pages')}
              {renderColorInput('Card & Panel Surface Color', '--bg-card', 'Surface color of clinical widgets')}
            </div>
          </div>

          {/* Image & Watermark Configuration (Visible when Image mode selected) */}
          {bgMode === 'image' && (
            <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', border: '1.5px solid #af52de', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 800, color: '#af52de', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={18} /> Watermark Image Configuration
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Upload a clinic logo or enter an image URL to render as a watermark on every page
                </p>
              </div>

              {/* Upload & URL Input Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Upload Clinic Logo / Image File
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: '1px dashed #af52de', background: 'rgba(175, 82, 222, 0.04)', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, color: '#af52de' }}>
                    <Upload size={16} /> Choose Image File (PNG, JPG, SVG)
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                  </label>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Or Enter Image URL
                  </label>
                  <input
                    type="text"
                    value={watermarkUrl}
                    onChange={e => setWatermarkUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Preset Medical Watermarks */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Quick Medical Presets:
                </span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {PRESET_WATERMARKS.map(p => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setWatermarkUrl(p.url)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '7px',
                        border: watermarkUrl === p.url ? '1.5px solid #af52de' : '1px solid var(--border-color)',
                        background: watermarkUrl === p.url ? 'rgba(175, 82, 222, 0.1)' : 'var(--bg-card)',
                        color: watermarkUrl === p.url ? '#af52de' : 'var(--text-main)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                  {watermarkUrl && (
                    <button
                      type="button"
                      onClick={() => setWatermarkUrl('')}
                      style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #ef4444', color: '#ef4444', background: 'transparent', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove Watermark
                    </button>
                  )}
                </div>
              </div>

              {/* Watermark Opacity & Size Sliders */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Watermark Transparency (Opacity)</label>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#af52de' }}>{Math.round(watermarkOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.03"
                    max="0.35"
                    step="0.01"
                    value={watermarkOpacity}
                    onChange={e => setWatermarkOpacity(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#af52de', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Low opacity keeps medical text easy to read</span>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Watermark Size</label>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#af52de' }}>{watermarkSize}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="65"
                    step="5"
                    value={watermarkSize}
                    onChange={e => setWatermarkSize(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#af52de', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Percentage of screen width occupied</span>
                </div>
              </div>

              {/* Live Preview Box */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Live Watermark Canvas Preview:
                </span>
                <div
                  style={{
                    height: '200px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: themeVars['--bg-dark'] || '#f5f5f7',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                  }}
                >
                  {/* Watermark Layer */}
                  {watermarkUrl && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${watermarkUrl})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center center',
                        backgroundSize: `${watermarkSize}% auto`,
                        opacity: watermarkOpacity,
                        pointerEvents: 'none'
                      }}
                    />
                  )}

                  {/* Foreground Sample Card */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      background: themeVars['--bg-card'] || '#ffffff',
                      border: `1px solid ${themeVars['--border-color'] || '#e5e5ea'}`,
                      borderRadius: themeVars['--card-radius'] || '12px',
                      padding: '16px 20px',
                      maxWidth: '360px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: themeVars['--text-main'] || '#1d1d1f' }}>
                      Diagnostic Consultation Note
                    </div>
                    <div style={{ fontSize: '0.75rem', color: themeVars['--text-secondary'] || '#6e6e73', marginTop: '4px' }}>
                      Watermark renders behind patient cards and records without interfering with readability.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. TYPOGRAPHY & FONTS */}
      {themeSection === 'typography' && (
        <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Font Family</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {[
              { label: 'Plus Jakarta Sans (Modern Clean)', font: "'Plus Jakarta Sans', sans-serif" },
              { label: 'Inter (High Legibility)', font: "'Inter', sans-serif" },
              { label: 'System UI (Apple / Segoe UI)', font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
              { label: 'Outfit (Contemporary)', font: "'Outfit', sans-serif" },
              { label: 'Poppins (Soft & Friendly)', font: "'Poppins', sans-serif" }
            ].map(f => (
              <button
                key={f.label}
                type="button"
                onClick={() => {
                  setFontFamily(f.font);
                  document.documentElement.style.setProperty('--font-family', f.font);
                  document.documentElement.style.setProperty('--font-heading', f.font);
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: fontFamily === f.font ? '2px solid #0071e3' : '1px solid var(--border-color)',
                  background: fontFamily === f.font ? 'rgba(0,113,227,0.08)' : 'var(--bg-card)',
                  color: fontFamily === f.font ? '#0071e3' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  fontFamily: f.font,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. BRAND & STATUS COLORS */}
      {themeSection === 'colors' && (
        <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Brand &amp; Status Colors</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
            {renderColorInput('Primary Accent Blue', '--accent-blue', 'Buttons, links, and selected states')}
            {renderColorInput('Success Emerald', '--accent-emerald', 'Paid invoices, verified lab results, active items')}
            {renderColorInput('Danger / STAT Rose', '--accent-rose', 'STAT orders, alerts, critical lab results')}
            {renderColorInput('Warning Amber', '--accent-amber', 'Pending triage, unverified items')}
            {renderColorInput('Primary Text', '--text-main', 'Headings and high-contrast labels')}
            {renderColorInput('Muted Secondary Text', '--text-secondary', 'Timestamps and descriptive captions')}
            {renderColorInput('Border Lines', '--border-color', 'Dividers and table lines')}
          </div>
        </div>
      )}

      {/* 4. CARDS & RADIUS */}
      {themeSection === 'cards' && (
        <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Card Corner Radius</h4>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {['4px', '8px', '12px', '14px', '18px', '24px'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => updateThemeVar('--card-radius', r)}
                style={{
                  padding: '8px 16px',
                  borderRadius: r,
                  border: themeVars['--card-radius'] === r ? '2px solid #0071e3' : '1px solid var(--border-color)',
                  background: themeVars['--card-radius'] === r ? 'rgba(0,113,227,0.08)' : 'var(--bg-card)',
                  color: themeVars['--card-radius'] === r ? '#0071e3' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. SIDEBAR & SHELL */}
      {themeSection === 'sidebar' && (
        <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Sidebar &amp; Shell Colors</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
            {renderColorInput('Sidebar Background', '--bg-sidebar', 'Background color of the navigation bar')}
          </div>
        </div>
      )}

    </div>
  );
}
