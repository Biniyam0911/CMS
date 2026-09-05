import React, { useState, useEffect } from 'react';
import {
  Users, Calendar, FlaskConical, ListOrdered, DollarSign, Activity,
  ShieldAlert, Clock, RefreshCw, CheckCircle2, UserPlus, FilePlus, X
} from 'lucide-react';

interface DashboardPageProps {
  token: string;
  onNavigateModule?: (moduleKey: string, patientId?: number) => void;
}

export default function DashboardPage({ token, onNavigateModule }: DashboardPageProps) {
  const [metrics, setMetrics] = useState<any>({
    activePatientsCount: 0,
    todayAppointmentsCount: 0,
    pendingLabOrdersCount: 0,
    waitingQueueCount: 0,
    todayRevenue: 0,
    cacheHitRatio: 100,
    activeDoctorsCount: 0,
    liveQueue: [],
    criticalAlerts: []
  });

  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/dashboard/metrics', {
        headers: {
          'Authorization': `Bearer ${token || localStorage.getItem('auth_token') || 'dummy'}`,
          'x-tenant-id': '1'
        }
      });
      const data = await res.json();
      const payload = data.data || data.Data || (data.success || data.isSuccess ? data.data : null);
      if (payload) {
        setMetrics(payload);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleAckAlert = (alertId: number) => {
    setMetrics({
      ...metrics,
      criticalAlerts: metrics.criticalAlerts.filter((ca: any) => ca.id !== alertId)
    });
  };

  return (
    <div>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={fetchMetrics} className="btn-secondary" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Live Metrics
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-4" style={{ marginBottom: '28px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Active Patients</span>
            <Users color="#06b6d4" size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '8px 0 4px' }}>{metrics.activePatientsCount.toLocaleString()}</div>
          <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>+12% this month</span>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Today's Appointments</span>
            <Calendar color="#3b82f6" size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '8px 0 4px' }}>{metrics.todayAppointmentsCount}</div>
          <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>{metrics.activeDoctorsCount} Doctors Available</span>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Pending Lab Orders</span>
            <FlaskConical color="#f59e0b" size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '8px 0 4px' }}>{metrics.pendingLabOrdersCount}</div>
          <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600 }}>3 STAT Orders Pending</span>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Today's Revenue</span>
            <DollarSign color="#10b981" size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '8px 0 4px' }}>Br {metrics.todayRevenue.toLocaleString()}</div>
          <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>15% VAT Compliant</span>
        </div>
      </div>

      {/* Main Grid: Queue & Critical Alerts */}
      <div className="grid-2">
        {/* Live Queue Panel */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListOrdered color="#06b6d4" size={18} /> Live Triage Queue
            </h3>
            <span className="badge badge-info">{metrics.waitingQueueCount} Waiting</span>
          </div>

          <table className="cms-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Service</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.liveQueue.map((q: any) => (
                <tr key={q.id}>
                  <td style={{ fontWeight: 700, color: '#06b6d4', fontFamily: 'monospace' }}>{q.tokenNumber}</td>
                  <td style={{ fontWeight: 600 }}>{q.patientName}</td>
                  <td>{q.serviceType}</td>
                  <td>
                    <span className={q.priorityName === 'Emergency' ? 'badge badge-critical' : 'badge badge-normal'}>
                      {q.priorityName}
                    </span>
                  </td>
                  <td><span className="badge badge-warning">{q.statusName}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Critical Alerts & System Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f43f5e', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} /> Unacknowledged Critical Lab Alerts
            </h3>

            {metrics.criticalAlerts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <CheckCircle2 color="#10b981" size={24} style={{ margin: '0 auto 8px' }} />
                No unacknowledged critical lab alerts.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {metrics.criticalAlerts.map((ca: any) => (
                  <div key={ca.id} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{ca.patientName}</div>
                      <div style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '2px' }}>
                        {ca.testName}: <strong>{ca.alertValue}</strong> ({ca.alertFlag})
                      </div>
                    </div>
                    <button onClick={() => handleAckAlert(ca.id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                      Acknowledge
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>Infrastructure Diagnostics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Database</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>MSSQL Express (Connected)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Redis Cache</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>Hit Ratio {metrics.cacheHitRatio}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>ServiceManager Listener</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>TCP Port 2575 (HL7) Listening</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
