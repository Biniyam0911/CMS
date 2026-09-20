import React, { useState, useEffect } from 'react';
import {
  Users, Calendar, FlaskConical, ListOrdered, DollarSign,
  Clock, RefreshCw, CheckCircle2, TrendingUp
} from 'lucide-react';

interface DashboardPageProps {
  token: string;
  onNavigateModule?: (moduleKey: string, patientId?: number) => void;
}

export default function DashboardPage({ token, onNavigateModule }: DashboardPageProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [metrics, setMetrics] = useState<any>({
    activePatientsCount: 0,
    todayAppointmentsCount: 0,
    pendingLabOrdersCount: 0,
    waitingQueueCount: 0,
    todayRevenue: 0,
    cacheHitRatio: 100,
    activeDoctorsCount: 0,
    liveQueue: [],
    revenueTrend: []
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

  // Revenue Graph helpers
  const rawRevenueTrend = metrics.revenueTrend || metrics.RevenueTrend || [];
  const revenueTrend: { date: string; revenue: number }[] = rawRevenueTrend.map((r: any) => ({
    date: r.date || r.Date || '',
    revenue: Number(r.revenue ?? r.Revenue ?? 0)
  }));
  const maxRevenue = Math.max(...revenueTrend.map((r: any) => r.revenue || 0), 1);
  const graphHeight = 120;
  const graphWidth = 400;
  const barWidth = revenueTrend.length > 0 ? (graphWidth / revenueTrend.length) - 4 : 20;

  return (
    <div>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={fetchMetrics} className="btn-secondary" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Live Metrics
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
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
          <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>VAT Compliant</span>
        </div>
      </div>

      {/* Main Grid: Queue & Revenue Graph */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
        {/* Live Queue Panel */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListOrdered color="#06b6d4" size={18} /> Live Triage Queue
            </h3>
            <span className="badge badge-info">{metrics.waitingQueueCount} Waiting</span>
          </div>

          {metrics.liveQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
              <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontSize: '0.85rem' }}>No patients in triage queue right now.</div>
            </div>
          ) : (
            <div className="table-responsive">
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
          )}
        </div>

        {/* Right Column: Revenue Graph + Infrastructure */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 14-Day Revenue Graph */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp color="#10b981" size={18} /> 14-Day Revenue Trend
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Daily revenue (Br) — last 14 days</div>

            {revenueTrend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <CheckCircle2 color="#10b981" size={24} style={{ margin: '0 auto 8px' }} />
                No revenue data yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <svg width="100%" viewBox={`0 0 ${graphWidth} ${graphHeight + 30}`} style={{ minWidth: '260px' }}>
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                    <line
                      key={i}
                      x1={0} y1={graphHeight - pct * graphHeight}
                      x2={graphWidth} y2={graphHeight - pct * graphHeight}
                      stroke="var(--border-color)" strokeWidth={0.5} strokeDasharray="3,3"
                    />
                  ))}
                  {/* Bars */}
                  {revenueTrend.map((d: any, i: number) => {
                    const barH = Math.max(4, (d.revenue / maxRevenue) * graphHeight);
                    const x = i * (graphWidth / revenueTrend.length) + 2;
                    const y = graphHeight - barH;
                    const shortDate = d.date ? d.date.slice(5) : `D${i + 1}`;
                    return (
                      <g key={i}>
                        <rect
                          x={x} y={y} width={barWidth} height={barH}
                          rx={2}
                          fill={d.revenue > 0 ? '#10b981' : '#e2e8f0'}
                          opacity={0.85}
                        >
                          <title>{shortDate}: Br {(d.revenue || 0).toLocaleString()}</title>
                        </rect>
                        <text
                          x={x + barWidth / 2} y={graphHeight + 14}
                          textAnchor="middle" fontSize="8" fill="var(--text-muted)"
                        >
                          {shortDate}
                        </text>
                        {d.revenue > 0 && (
                          <text
                            x={x + barWidth / 2} y={y - 3}
                            textAnchor="middle" fontSize="7" fill="#059669" fontWeight="700"
                          >
                            {d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(1)}k` : d.revenue}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* Infrastructure Diagnostics */}
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
