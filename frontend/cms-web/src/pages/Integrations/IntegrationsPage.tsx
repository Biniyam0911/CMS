import React, { useState, useEffect } from 'react';
import { Plug, CheckCircle2, AlertCircle, RefreshCw, X, Save, Loader2, Send, MessageSquare, Phone } from 'lucide-react';
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

  // SMS Logs State
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [smsLogsLoading, setSmsLogsLoading] = useState(false);
  const [smsLogsError, setSmsLogsError] = useState<string | null>(null);

  // Test SMS Form State
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState<{ success: boolean; msg: string } | null>(null);

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
    fetchSmsLogs();
  }, []);

  const fetchSmsLogs = async () => {
    try {
      setSmsLogsLoading(true);
      setSmsLogsError(null);
      const data: any = await api.get('/sms/logs');
      const rows = Array.isArray(data) ? data : (data?.data || data?.Data || []);
      setSmsLogs(rows.map((r: any) => ({
        id: r.id || r.Id,
        sentAt: r.sentAt || r.SentAt || r.createdAt || r.CreatedAt,
        recipient: r.recipientPhone || r.RecipientPhone || r.phoneNumber || '-',
        patientName: r.patientName || r.PatientName || 'Unknown',
        eventType: r.eventType || r.EventType || 'General',
        messagePreview: (r.messageBody || r.MessageBody || r.message || '').substring(0, 80),
        status: r.status || r.Status || 'Sent',
        provider: r.provider || r.Provider || r.gatewayProvider || 'SMS Gateway',
      })));
    } catch (err: any) {
      setSmsLogsError('Could not load SMS logs. Check API endpoint /sms/logs.');
    } finally {
      setSmsLogsLoading(false);
    }
  };

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

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) return;
    try {
      setIsSendingTestSms(true);
      setTestSmsResult(null);
      await api.post('/sms/send', {
        recipientPhone: testPhone.trim(),
        messageBody: testMessage.trim(),
        eventType: 'TestMessage',
        patientId: null
      });
      setTestSmsResult({ success: true, msg: `SMS dispatched to ${testPhone} via gateway.` });
      setTestPhone('');
      setTestMessage('');
      setTimeout(() => fetchSmsLogs(), 1500);
    } catch (err: any) {
      setTestSmsResult({ success: false, msg: err?.message || 'SMS send failed. Check gateway credentials.' });
    } finally {
      setIsSendingTestSms(false);
      setTimeout(() => setTestSmsResult(null), 5000);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };

  return (
    <div>
      {/* â”€â”€ Integration Cards â”€â”€ */}
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
                â— {item.status}
              </span>
              <button onClick={() => handleOpenConfig(item)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* SMS GATEWAY DELIVERY LOGS                                      */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="glass-panel" style={{ padding: '22px', marginTop: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare color="#0071e3" size={18} /> SMS Gateway Delivery Logs
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Recent outbound SMS messages dispatched via Ethio Telecom / Africa's Talking gateway.
            </p>
          </div>
          <button onClick={fetchSmsLogs} className="btn-secondary" style={{ padding: '5px 10px' }}>
            <RefreshCw size={13} className={smsLogsLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {smsLogsError && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: '0.78rem', color: '#b91c1c', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} /> {smsLogsError}
          </div>
        )}

        <table className="cms-table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Recipient</th>
              <th>Patient</th>
              <th>Event Type</th>
              <th>Message Preview</th>
              <th>Status</th>
              <th>Gateway</th>
            </tr>
          </thead>
          <tbody>
            {smsLogsLoading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                  <Loader2 size={18} className="animate-spin" style={{ margin: '0 auto 6px' }} />
                  Loading SMS logsâ€¦
                </td>
              </tr>
            ) : smsLogs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                  No SMS logs yet. Send a test message below or trigger appointment reminders from the Appointments module.
                </td>
              </tr>
            ) : (
              smsLogs.map((log, i) => (
                <tr key={log.id || i}>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(log.sentAt)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{log.recipient}</td>
                  <td style={{ fontWeight: 600 }}>{log.patientName}</td>
                  <td>
                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{log.eventType}</span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 260 }}>{log.messagePreview}</td>
                  <td>
                    <span className={log.status === 'Sent' || log.status === 'Delivered' ? 'badge badge-normal' : 'badge badge-warning'} style={{ fontSize: '0.65rem' }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.provider}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* SEND TEST SMS FORM                                             */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="glass-panel" style={{ padding: '22px', marginTop: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Send color="#34c759" size={16} /> Send Test SMS Message
        </h3>

        {testSmsResult && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '0.78rem', fontWeight: 600,
            background: testSmsResult.success ? '#d1fae5' : '#fef2f2',
            border: `1px solid ${testSmsResult.success ? '#6ee7b7' : '#fecaca'}`,
            color: testSmsResult.success ? '#065f46' : '#b91c1c',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {testSmsResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {testSmsResult.msg}
          </div>
        )}

        <form onSubmit={handleSendTestSms} style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
              Recipient Phone *
            </label>
            <input
              type="tel"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="09xxxxxxxx or +2519..."
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Test Message *</label>
            <input
              type="text"
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              placeholder="Test SMS from Specialty Clinic CMS gatewayâ€¦"
              required
              maxLength={160}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isSendingTestSms} style={{ padding: '8px 18px', whiteSpace: 'nowrap' }}>
            {isSendingTestSms ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send Test SMS
          </button>
        </form>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Message will be sent via the configured SMS gateway (Africa's Talking / Ethio Telecom) and logged in the table above.
          Max 160 characters per message.
        </div>
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
