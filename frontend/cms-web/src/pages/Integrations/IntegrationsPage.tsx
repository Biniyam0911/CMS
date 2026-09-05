import React, { useState, useEffect } from 'react';
import { Plug, CheckCircle2, AlertCircle, RefreshCw, X, Save, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient';

export default function IntegrationsPage() {
  const defaultIntegrations = [
    { code: 'SMTP', name: 'Standard SMTP Mailer', type: 'Email', status: 'Healthy', active: true, config: 'Host: localhost, Port: 25' },
    { code: 'AFRICASTALKING', name: "Africa's Talking SMS Gateway", type: 'SMS', status: 'Healthy', active: true, config: 'ApiKey: at_live_89421' },
    { code: 'HL7_TCP', name: 'HL7 MLLP Analyzer Feeds (Port 2575)', type: 'LabInstrument', status: 'Healthy', active: true, config: 'TCP Port: 2575, MLLP Framing' },
    { code: 'ASTM_TCP', name: 'ASTM E1381 Analyzer Feeds (Port 2576)', type: 'LabInstrument', status: 'Healthy', active: true, config: 'TCP Port: 2576, Serial/Ethernet' },
    { code: 'OPENAI', name: 'OpenAI Clinical Assistant & Summarizer', type: 'AI', status: 'Healthy', active: true, config: 'ApiKey: sk-proj-123' },
    { code: 'TELEBIRR', name: 'TeleBirr Mobile Gateway', type: 'Payment', status: 'Healthy', active: true, config: 'AppId: TB_LIVE_9941' }
  ];

  const [integrations, setIntegrations] = useState<any[]>(defaultIntegrations);
  const [loading, setLoading] = useState(true);

  const [showConfigModal, setShowConfigModal] = useState<any>(null);
  const [configText, setConfigText] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        setLoading(true);
        const data = await api.get<any[]>('/integrations');
        if (data && data.length > 0) {
          const mapped = data.map((it: any) => ({
            code: it.integrationType || it.IntegrationType || it.providerName || 'CUSTOM',
            name: it.providerName || it.ProviderName || 'Integration Provider',
            type: it.integrationType || it.IntegrationType || 'General',
            status: it.isEnabled !== false ? 'Healthy' : 'Disabled',
            active: Boolean(it.isEnabled !== false),
            config: it.configJson || it.ConfigJson || 'Config: Enabled'
          }));
          setIntegrations(mapped);
        }
      } catch (err) {
        console.error('Failed to load integrations:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchIntegrations();
  }, []);

  const handleOpenConfig = (item: any) => {
    setShowConfigModal(item);
    setConfigText(item.config);
    setIsEnabled(item.active);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showConfigModal) return;

    try {
      await api.post('/integrations/update', {
        integrationType: showConfigModal.type,
        providerName: showConfigModal.name,
        isEnabled,
        configJson: configText
      });
    } catch (err) {
      console.error('Update integration error:', err);
    }

    setIntegrations(integrations.map(i => i.code === showConfigModal.code ? {
      ...i,
      active: isEnabled,
      config: configText,
      status: isEnabled ? 'Healthy' : 'Disabled'
    } : i));
    setShowConfigModal(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>3rd Party Integration Providers</h3>
        {loading && <Loader2 size={16} className="animate-spin" color="#06b6d4" />}
      </div>

      <div className="grid-3">
        {integrations.map((item, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="badge badge-info">{item.type}</span>
                <span className={item.active ? 'badge badge-normal' : 'badge badge-warning'}>
                  {item.active ? 'Active' : 'Disabled'}
                </span>
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{item.name}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Code: {item.code}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <span style={{ fontSize: '0.75rem', color: item.status === 'Healthy' ? '#34d399' : 'var(--text-muted)' }}>
                ● {item.status}
              </span>
              <button onClick={() => handleOpenConfig(item)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Configure Integration */}
      {showConfigModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Configure {showConfigModal.name}</h3>
              <button onClick={() => setShowConfigModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="intActiveCheck" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} style={{ width: 'auto' }} />
                <label htmlFor="intActiveCheck" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Enable Integration Provider</label>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Credentials / Settings String</label>
                <textarea rows={3} value={configText} onChange={e => setConfigText(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowConfigModal(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary"><Save size={16} /> Save Credentials</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
