import React, { useState, useEffect } from 'react';
import { Settings, Save, Building, Globe, DollarSign, CheckCircle2, Loader2, HeartPulse, Stethoscope, FileHeart, Activity, ShieldCheck, Cross, FlaskConical } from 'lucide-react';
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

export default function SettingsPage() {
  const [clinicName, setClinicName] = useState('General Health Clinic');
  const [address, setAddress] = useState('Bole Road, Addis Ababa, Ethiopia');
  const [phone, setPhone] = useState('+251911000000');
  const [vat, setVat] = useState('15.0');
  const [currency, setCurrency] = useState('ETB');
  const [appIcon, setAppIcon] = useState('FileHeart');
  const [savedAlert, setSavedAlert] = useState(false);
  const [loading, setLoading] = useState(true);

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
      } catch (err) {
        console.error('Failed to load clinic settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await Promise.all([
        api.post('/settings', { settingKey: 'ClinicName', settingValue: clinicName }),
        api.post('/settings', { settingKey: 'ClinicAddress', settingValue: address }),
        api.post('/settings', { settingKey: 'ClinicPhone', settingValue: phone }),
        api.post('/settings', { settingKey: 'Currency', settingValue: currency }),
        api.post('/settings', { settingKey: 'TaxRate', settingValue: vat }),
        api.post('/settings', { settingKey: 'AppIcon', settingValue: appIcon }),
      ]);
      // Fire event so Sidebar updates immediately
      window.dispatchEvent(new Event('clinic_settings_changed'));
      setSavedAlert(true);
      setTimeout(() => setSavedAlert(false), 3000);
    } catch (err: any) {
      console.error('Update settings API error:', err);
      setSaveError(err?.message || 'Failed to save settings. Please try again.');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '28px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings color="#06b6d4" size={20} /> Clinic Profile & System Configuration
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {loading && <Loader2 size={16} className="animate-spin" color="#06b6d4" />}
          {savedAlert && <span className="badge badge-normal"><CheckCircle2 size={12} /> Settings Saved to Database</span>}
          {saveError && <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>⚠ {saveError}</span>}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clinic Official Name</label>
          <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)} required />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Facility Physical Address</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)} required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contact Phone Number</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Standard VAT Percentage (%)</label>
            <input type="text" value={vat} onChange={e => setVat(e.target.value)} required />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Default Operating Currency</label>
          <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} required />
        </div>

        {/* App Icon Picker */}
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            Sidebar App Icon
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {APP_ICONS.map(({ name, label, Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => setAppIcon(name)}
                title={label}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                  border: appIcon === name ? '2px solid #0284c7' : '1px solid var(--border-color)',
                  background: appIcon === name ? '#eff6ff' : '#fff',
                  color: appIcon === name ? '#0284c7' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={20} />
                <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '12px', alignSelf: 'flex-start' }}>
          <Save size={16} /> Save Clinic Settings
        </button>
      </form>
    </div>
  );
}
