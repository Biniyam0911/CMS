import React, { useState, useEffect } from 'react';
import { ListOrdered, Volume2, Monitor, CheckCircle, Play, RefreshCw, UserCheck, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient';
import { playTicketChimeAndSpeech } from '../../utils/audioAnnouncer';

export default function QueuePage() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [activeCounter, setActiveCounter] = useState('Doctor Room 1');
  const [lastCalled, setLastCalled] = useState<{ token: string; counter: string }>({ token: 'A-001', counter: 'Doctor Room 1' });
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const [liveData, counterData] = await Promise.all([
        api.get<any[]>('/queue/live').catch(() => []),
        api.get<any[]>('/queue/counters').catch(() => [])
      ]);

      if (counterData && counterData.length > 0) {
        setCounters(counterData.map((c: any) => ({
          id: c.id || c.Id,
          name: c.counterName || c.CounterName || `Counter ${c.id}`,
          service: c.serviceType || c.ServiceType || 'General'
        })));
        setActiveCounter(counterData[0].counterName || counterData[0].CounterName || 'Doctor Room 1');
      } else {
        setCounters([
          { id: 1, name: 'Doctor Room 1', service: 'General Practice' },
          { id: 2, name: 'Doctor Room 2', service: 'Pediatrics' },
          { id: 3, name: 'Lab Phlebotomy Counter 1', service: 'Laboratory' },
          { id: 4, name: 'Pharmacy Dispensary 1', service: 'Pharmacy' },
          { id: 5, name: 'Billing Cashier 1', service: 'Billing' }
        ]);
      }

      if (liveData && liveData.length > 0) {
        const mapped = liveData.map((q: any) => ({
          id: q.id || q.Id,
          token: q.ticketNo || q.TicketNo || `A-${String(q.id).padStart(3, '0')}`,
          patientName: q.patientName || q.PatientName || `Patient #${q.patientId}`,
          service: q.serviceType || q.ServiceType || 'Consultation',
          counter: q.calledToStation || q.CalledToStation || '-',
          status: q.statusId === 2 ? 'Called' : (q.statusId === 3 ? 'Completed' : 'Waiting'),
          priority: q.priority === 3 ? 'Emergency' : (q.priority === 1 ? 'VIP' : 'Normal')
        }));
        setTokens(mapped);
      } else {
        setTokens([
          { id: 1, token: 'A-001', patientName: 'Yonas Tsegaye', service: 'Consultation', counter: 'Doctor Room 1', status: 'Called', priority: 'Normal' },
          { id: 2, token: 'LAB-002', patientName: 'Tigist Bekele', service: 'Laboratory', counter: 'Lab Counter 1', status: 'Called', priority: 'Emergency' },
          { id: 3, token: 'A-003', patientName: 'Dawit Alemu', service: 'Consultation', counter: '-', status: 'Waiting', priority: 'Normal' },
          { id: 4, token: 'PH-004', patientName: 'Meron Haile', service: 'Pharmacy', counter: '-', status: 'Waiting', priority: 'VIP' }
        ]);
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleCallTicket = async (tokenId: number) => {
    const target = tokens.find(t => t.id === tokenId);
    if (!target) return;

    try {
      await api.post('/queue/call', {
        ticketId: tokenId,
        counterId: 1,
        staffId: 1
      });
    } catch (err) {
      console.error('Call ticket API error:', err);
    }

    setTokens(tokens.map(t => {
      if (t.id === tokenId) {
        const updated = { ...t, status: 'Called', counter: activeCounter };
        setLastCalled({ token: t.token, counter: activeCounter });
        playTicketChimeAndSpeech(t.token, activeCounter);
        return updated;
      }
      return t;
    }));
  };

  const handleCallNextInQueue = () => {
    const nextWaiting = tokens.find(t => t.status === 'Waiting');
    if (nextWaiting) {
      handleCallTicket(nextWaiting.id);
    }
  };

  const handleCompleteTicket = (tokenId: number) => {
    setTokens(tokens.map(t => t.id === tokenId ? { ...t, status: 'Completed' } : t));
  };

  return (
    <div>
      {/* Big TV Screen Announcer Banner with Live Audio Alert */}
      <div style={{ padding: '28px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(59, 130, 246, 0.18))', border: '1px solid rgba(6, 182, 212, 0.4)', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#06b6d4', fontWeight: 700, letterSpacing: '0.1em' }}>NOW CALLING TO COUNTER</span>
          <div style={{ fontSize: '3.6rem', fontWeight: 800, color: '#fff', fontFamily: 'monospace', lineHeight: 1 }}>{lastCalled.token}</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#38bdf8', marginTop: '6px' }}>Proceed to: {lastCalled.counter}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => playTicketChimeAndSpeech(lastCalled.token, lastCalled.counter)}
            className="btn-primary"
            style={{ padding: '12px 20px', borderRadius: '12px' }}
          >
            <Volume2 size={22} /> Re-Announce Audio
          </button>
        </div>
      </div>

      {/* Station Staff Call Controls */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#06b6d4' }}>Active Staff Service Counter:</label>
          <select value={activeCounter} onChange={e => setActiveCounter(e.target.value)} style={{ width: '260px', padding: '8px 12px' }}>
            {counters.map(c => (
              <option key={c.id} value={c.name}>{c.name} ({c.service})</option>
            ))}
          </select>
        </div>

        <button onClick={handleCallNextInQueue} className="btn-primary" style={{ padding: '10px 20px' }}>
          <Play size={16} /> Call Next Waiting Ticket
        </button>
      </div>

      {/* Queue Triage Split Grid */}
      <div className="grid-2">
        {/* Waiting Tickets */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListOrdered color="#06b6d4" size={18} /> Active Waiting Tickets ({tokens.filter(t => t.status === 'Waiting').length})
            </h3>
            {loading && <Loader2 size={16} className="animate-spin" color="#06b6d4" />}
          </div>

          <table className="cms-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Service</th>
                <th>Priority</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tokens.filter(t => t.status === 'Waiting').map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 800, fontSize: '1.1rem', color: '#06b6d4', fontFamily: 'monospace' }}>{t.token}</td>
                  <td style={{ fontWeight: 600 }}>{t.patientName}</td>
                  <td>{t.service}</td>
                  <td>
                    <span className={t.priority === 'Emergency' ? 'badge badge-critical' : (t.priority === 'VIP' ? 'badge badge-warning' : 'badge badge-normal')}>
                      {t.priority}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => handleCallTicket(t.id)} className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                      <Play size={12} /> Call Ticket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Serving / Called Tickets */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Monitor color="#3b82f6" size={18} /> Currently Called / In Consultation
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tokens.filter(t => t.status === 'Called' || t.status === 'InProgress').map(t => (
              <div key={t.id} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#06b6d4', fontFamily: 'monospace' }}>{t.token}</strong> - <span>{t.patientName}</span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Counter: {t.counter} ({t.service})</div>
                </div>
                <button onClick={() => handleCompleteTicket(t.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                  <CheckCircle size={14} /> Checkout
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
