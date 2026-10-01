import React, { useState, useEffect } from 'react';
import {
  Users, Calendar, FlaskConical, ListOrdered, DollarSign,
  Clock, RefreshCw, CheckCircle2, TrendingUp, BarChart3,
  Activity, ArrowUpRight
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
    malePatientsCount: 0,
    femalePatientsCount: 0,
    todayAppointmentsCount: 0,
    pendingLabOrdersCount: 0,
    waitingQueueCount: 0,
    todayRevenue: 0,
    cacheHitRatio: 100,
    activeDoctorsCount: 0,
    liveQueue: [],
    revenueTrend: [],
    topServices: [],
    patientVisitGrowth: []
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

  // 30-Day Patient Visit Growth helpers
  const rawVisitGrowth = metrics.patientVisitGrowth || metrics.PatientVisitGrowth || [];
  const visitGrowth: { date: string; visitCount: number }[] = rawVisitGrowth.map((v: any) => ({
    date: v.date || v.Date || '',
    visitCount: Number(v.visitCount ?? v.VisitCount ?? v.visitsCount ?? v.VisitsCount ?? 0)
  }));
  const maxVisits = Math.max(...visitGrowth.map(v => v.visitCount), 1);
  const totalVisits30Days = visitGrowth.reduce((acc, curr) => acc + curr.visitCount, 0);

  // 30-Day Best Performing Services helpers
  const rawTopServices = metrics.topServices || metrics.TopServices || [];
  const topServices: { serviceName: string; unitsSold: number; totalRevenue: number }[] = rawTopServices.map((s: any) => ({
    serviceName: s.serviceName || s.ServiceName || 'Clinical Service',
    unitsSold: Number(s.unitsSold ?? s.UnitsSold ?? 0),
    totalRevenue: Number(s.totalRevenue ?? s.TotalRevenue ?? 0)
  }));
  const maxServiceRevenue = Math.max(...topServices.map(s => s.totalRevenue), 1);

  return (
    <div>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Clinical & Operational Dashboard</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Real-time clinic activity, 30-day analytics, and live service growth indicators</p>
        </div>
        <button onClick={fetchMetrics} className="btn-secondary" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Live Metrics
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* Active Patients */}
        <div
          className="glass-panel"
          style={{ padding: '18px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
          onClick={() => onNavigateModule?.('patients')}
          title="Click to view Patients Registry"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Active Patients</span>
            <Users color="#06b6d4" size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0 2px' }}>
            {(metrics.activePatientsCount || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
            View Registry <ArrowUpRight size={12} />
          </span>
        </div>

        {/* Total Male Patients (Clickable) */}
        <div
          className="glass-panel"
          style={{ padding: '18px', cursor: 'pointer', borderLeft: '3px solid #0284c7', transition: 'transform 0.15s, box-shadow 0.15s' }}
          onClick={() => onNavigateModule?.('patients')}
          title="Click to view Male Patients in Patient Registry"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Male Patients</span>
            <Users color="#0284c7" size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0 2px', color: '#0284c7' }}>
            {(metrics.malePatientsCount || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
            Filter Males <ArrowUpRight size={12} />
          </span>
        </div>

        {/* Total Female Patients (Clickable) */}
        <div
          className="glass-panel"
          style={{ padding: '18px', cursor: 'pointer', borderLeft: '3px solid #ec4899', transition: 'transform 0.15s, box-shadow 0.15s' }}
          onClick={() => onNavigateModule?.('patients')}
          title="Click to view Female Patients in Patient Registry"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Female Patients</span>
            <Users color="#ec4899" size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0 2px', color: '#db2777' }}>
            {(metrics.femalePatientsCount || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#db2777', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
            Filter Females <ArrowUpRight size={12} />
          </span>
        </div>

        {/* Today's Appointments */}
        <div
          className="glass-panel"
          style={{ padding: '18px', cursor: 'pointer' }}
          onClick={() => onNavigateModule?.('appointments')}
          title="Click to view Appointments Schedule"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Today's Appts</span>
            <Calendar color="#3b82f6" size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0 2px' }}>
            {metrics.todayAppointmentsCount || 0}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600 }}>
            {metrics.activeDoctorsCount || 0} Doctors Live
          </span>
        </div>

        {/* Pending Lab Orders */}
        <div
          className="glass-panel"
          style={{ padding: '18px', cursor: 'pointer' }}
          onClick={() => onNavigateModule?.('laboratory')}
          title="Click to view Laboratory Worklist"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pending Labs</span>
            <FlaskConical color="#f59e0b" size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0 2px' }}>
            {metrics.pendingLabOrdersCount || 0}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
            Lab Worklist <ArrowUpRight size={12} />
          </span>
        </div>

        {/* Today's Revenue */}
        <div
          className="glass-panel"
          style={{ padding: '18px', cursor: 'pointer' }}
          onClick={() => onNavigateModule?.('billing')}
          title="Click to view Invoices & Billing"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Today's Revenue</span>
            <DollarSign color="#10b981" size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0 2px' }}>
            Br {(metrics.todayRevenue || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
            Billing Ledger <ArrowUpRight size={12} />
          </span>
        </div>
      </div>

      {/* Top Grid: 14-Day Revenue Trend & Live Triage Queue */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* 14-Day Revenue Graph */}
        <div
          className="glass-panel"
          style={{ padding: '24px', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }}
          onClick={() => onNavigateModule?.('billing')}
          title="Click to view Billing & Invoices"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp color="#10b981" size={18} /> 14-Day Revenue Trend
            </h3>
            <span className="badge badge-normal" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Billing <ArrowUpRight size={12} />
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Daily revenue (Br) — last 14 days • Click to view Billing</div>

          {revenueTrend.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <CheckCircle2 color="#10b981" size={24} style={{ margin: '0 auto 8px' }} />
              No revenue data recorded yet.
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

        {/* Live Queue Panel */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <ListOrdered color="#06b6d4" size={18} /> Live Triage Queue
            </h3>
            <span className="badge badge-info">{metrics.waitingQueueCount || 0} Waiting</span>
          </div>

          {(metrics.liveQueue || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontSize: '0.85rem' }}>No patients currently waiting in triage queue.</div>
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="cms-table" style={{ margin: 0 }}>
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
      </div>

      {/* 30-Day Clickable Analytics Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* CLICKABLE CHART 1: Best Performing Services (Past 30 Days) */}
        <div
          className="glass-panel"
          style={{ padding: '24px', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s', border: '1px solid var(--border-color)' }}
          onClick={() => onNavigateModule?.('billing')}
          title="Click to open Billing & Cashier for detailed invoice breakdown"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 color="#0284c7" size={18} /> Best Performing Services (Past 30 Days)
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Top clinical services by revenue & utilization • Click to open Billing
              </p>
            </div>
            <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Billing <ArrowUpRight size={12} />
            </span>
          </div>

          {topServices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <BarChart3 size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div>No service invoice transactions recorded in the past 30 days.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topServices.slice(0, 6).map((service, sIdx) => {
                const pct = Math.max(5, (service.totalRevenue / maxServiceRevenue) * 100);
                return (
                  <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
                          {sIdx + 1}
                        </span>
                        {service.serviceName}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {service.unitsSold} units
                        </span>
                        <strong style={{ color: '#059669', fontFamily: 'monospace' }}>
                          Br {service.totalRevenue.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: sIdx === 0 ? 'linear-gradient(90deg, #0284c7, #38bdf8)' : (sIdx === 1 ? '#0ea5e9' : '#94a3b8'),
                          borderRadius: '4px',
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CLICKABLE CHART 2: Patient Consultation Growth Graph (Past 30 Days) */}
        <div
          className="glass-panel"
          style={{ padding: '24px', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s', border: '1px solid var(--border-color)' }}
          onClick={() => onNavigateModule?.('emr')}
          title="Click to open EMR Consultation to review patient visits"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity color="#10b981" size={18} /> Patient Consultation Growth (Past 30 Days)
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Daily consultation volume: <strong style={{ color: '#059669' }}>{totalVisits30Days} consultations</strong> total • Click to open EMR
              </p>
            </div>
            <span className="badge badge-normal" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              EMR <ArrowUpRight size={12} />
            </span>
          </div>

          {visitGrowth.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Activity size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div>No consultation visits logged in the past 30 days.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <svg width="100%" viewBox="0 0 440 150" style={{ minWidth: '280px' }}>
                {/* Horizontal reference grid lines */}
                {[0, 0.33, 0.66, 1].map((pct, idx) => (
                  <line
                    key={idx}
                    x1={0}
                    y1={120 - pct * 110}
                    x2={440}
                    y2={120 - pct * 110}
                    stroke="var(--border-color)"
                    strokeWidth={0.5}
                    strokeDasharray="3,3"
                  />
                ))}

                {/* Bars for daily consultation growth */}
                {visitGrowth.map((item, idx) => {
                  const bWidth = Math.max(6, (440 / visitGrowth.length) - 3);
                  const x = idx * (440 / visitGrowth.length) + 2;
                  const bHeight = Math.max(3, (item.visitCount / maxVisits) * 110);
                  const y = 120 - bHeight;
                  const shortDate = item.date ? item.date.slice(5) : `D${idx + 1}`;

                  return (
                    <g key={idx}>
                      <rect
                        x={x}
                        y={y}
                        width={bWidth}
                        height={bHeight}
                        rx={2}
                        fill={item.visitCount > 0 ? '#10b981' : '#e2e8f0'}
                        opacity={0.88}
                      >
                        <title>{item.date}: {item.visitCount} consultations</title>
                      </rect>
                      {/* Show date label on every 5th bar */}
                      {(idx % 5 === 0 || idx === visitGrowth.length - 1) && (
                        <text
                          x={x + bWidth / 2}
                          y={136}
                          textAnchor="middle"
                          fontSize="8"
                          fill="var(--text-muted)"
                        >
                          {shortDate}
                        </text>
                      )}
                      {item.visitCount > 0 && (
                        <text
                          x={x + bWidth / 2}
                          y={y - 3}
                          textAnchor="middle"
                          fontSize="7"
                          fill="#059669"
                          fontWeight="700"
                        >
                          {item.visitCount}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Infrastructure Diagnostics */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px' }}>Infrastructure Diagnostics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px', fontSize: '0.85rem' }}>
          <div style={{ padding: '12px 16px', background: 'rgba(52, 211, 153, 0.08)', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '4px' }}>Database Engine</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>MSSQL Server Express (Connected)</span>
          </div>
          <div style={{ padding: '12px 16px', background: 'rgba(52, 211, 153, 0.08)', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '4px' }}>Cache Subsystem</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>Hit Ratio {metrics.cacheHitRatio}%</span>
          </div>
          <div style={{ padding: '12px 16px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '4px' }}>LIS Analyzer Feed</span>
            <span style={{ color: '#0284c7', fontWeight: 700 }}>TCP Port 2575 (HL7 MLLP) Listening</span>
          </div>
        </div>
      </div>
    </div>
  );
}
