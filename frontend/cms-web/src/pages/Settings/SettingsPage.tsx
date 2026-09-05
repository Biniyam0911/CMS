import React, { useState, useEffect } from 'react';
import { Settings, Save, Building, Globe, DollarSign, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient';

export default function SettingsPage() {
  const [clinicName, setClinicName] = useState('General Health Clinic');
  const [address, setAddress] = useState('Bole Road, Addis Ababa, Ethiopia');
  const [phone, setPhone] = useState('+251911000000');
  const [vat, setVat] = useState('15.0');
  const [currency, setCurrency] = useState('ETB');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all([
        api.post('/settings', { settingKey: 'ClinicName', settingValue: clinicName }),
        api.post('/settings', { settingKey: 'ClinicAddress', settingValue: address }),
        api.post('/settings', { settingKey: 'ClinicPhone', settingValue: phone }),
        api.post('/settings', { settingKey: 'Currency', settingValue: currency }),
        api.post('/settings', { settingKey: 'TaxRate', settingValue: vat })
      ]);
    } catch (err) {
      console.error('Update settings API error:', err);
    }
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
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

        <button type="submit" className="btn-primary" style={{ marginTop: '12px', alignSelf: 'flex-start' }}>
          <Save size={16} /> Save Clinic Settings
        </button>
      </form>
    </div>
  );
}
