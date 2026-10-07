import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, Search, RefreshCw, ChevronDown, ChevronRight,
  FlaskConical, Activity, Bell, BellRing, Check, Clock, AlertTriangle,
  FileText, User, Calendar, Loader2, ArrowUpDown
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface NurseOrderItem {
  id: string | number;
  orderNumber: string;
  orderType: 'LAB' | 'PROCEDURE';
  patientId: number;
  patientName: string;
  mrn?: string;
  orderDate: string;
  attendingDoctor?: string;
  status: string;
  priority?: string | number;
  isPaid?: boolean;
  clinicalInfo?: string;
  lineItems: {
    id: string | number;
    code: string;
    name: string;
    category?: string;
    sampleType?: string;
    status: string;
    result?: string;
    unit?: string;
    refRange?: string;
    flag?: string;
  }[];
}

export default function NurseOrdersFollowupPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<NurseOrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LAB' | 'PROCEDURE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string | number>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Late orders tracking synchronized via localStorage and window events
  const [lateOrders, setLateOrders] = useState<Record<string, { patientName: string; orderNo?: string; flaggedAt?: string }>>(() => {
    try {
      const s = localStorage.getItem('cms_late_lab_orders');
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [labRes, procRes] = await Promise.all([
        api.get<any[]>('/laboratory/orders').catch(() => []),
        api.get<any[]>('/procedures/queue').catch(() => [])
      ]);

      const mappedList: NurseOrderItem[] = [];

      // 1. Group raw laboratory order rows by order ID
      const rawLabs = Array.isArray(labRes) ? labRes : [];
      const labGroupMap = new Map<string, any>();

      rawLabs.forEach((l: any) => {
        const ordId = l.orderId || l.OrderId || l.id || l.Id;
        const ordKey = String(ordId);
        if (!labGroupMap.has(ordKey)) {
          labGroupMap.set(ordKey, {
            id: ordId,
            orderNumber: String(l.orderNumber || l.OrderNumber || `LAB-${ordId}`),
            orderType: 'LAB' as const,
            patientId: Number(l.patientId || l.PatientId || 0),
            patientName: String(l.patientName || l.PatientName || 'Patient'),
            mrn: l.mrn || l.MRN || '',
            orderDate: l.orderedAt || l.OrderedAt || l.orderDate || new Date().toISOString(),
            attendingDoctor: l.orderedByName || l.DoctorName || 'Attending Physician',
            status: l.statusName || l.StatusName || (l.itemStatus === 5 ? 'Approved' : l.itemStatus === 1 ? 'Ordered' : 'In Process'),
            priority: l.priority || l.Priority || 2,
            isPaid: Boolean(l.isPaid ?? l.IsPaid ?? true),
            clinicalInfo: l.clinicalInfo || l.ClinicalInfo || '',
            lineItems: []
          });
        }

        const currentGroup = labGroupMap.get(ordKey);
        const testCode = l.testCode || l.TestCode || 'LAB-TEST';
        const testName = l.testName || l.TestName || l.clinicalInfo || 'Laboratory Test';
        const lineStatus = l.statusName || l.StatusName || (l.itemStatus === 5 ? 'Approved' : 'In Process');

        currentGroup.lineItems.push({
          id: l.itemId || l.ItemId || Math.random(),
          code: testCode,
          name: testName,
          category: l.category || l.Category || 'Diagnostic',
          sampleType: l.sampleType || l.SampleType || 'Blood / Serum',
          status: lineStatus,
          result: l.numericValue ? `${l.numericValue} ${l.resultUnit || l.unit || ''}`.trim() : (l.textValue || ''),
          unit: l.resultUnit || l.unit || '',
          refRange: l.resultRefRange || l.referenceRange || '',
          flag: l.resultFlag || l.flag || 'Normal'
        });

        // Overall status escalation
        if (currentGroup.lineItems.some((i: any) => i.status === 'Approved' || i.status === 'Completed')) {
          currentGroup.status = 'Approved';
        } else if (currentGroup.lineItems.some((i: any) => i.status === 'InProcess' || i.status === 'Collected')) {
          currentGroup.status = 'In Process';
        }
      });

      labGroupMap.forEach(ord => mappedList.push(ord));

      // 2. Map procedure orders
      const rawProcs = Array.isArray(procRes) ? procRes : [];
      rawProcs.forEach((p: any) => {
        const procId = p.id || p.Id;
        mappedList.push({
          id: procId,
          orderNumber: `PROC-${procId}`,
          orderType: 'PROCEDURE',
          patientId: Number(p.patientId || p.PatientId || 0),
          patientName: String(p.patientName || p.PatientName || 'Patient'),
          mrn: p.mrn || p.MRN || '',
          orderDate: p.createdAt || p.CreatedAt || new Date().toISOString(),
          attendingDoctor: p.doctorName || p.DoctorName || 'Attending Physician',
          status: p.statusName || p.StatusName || 'Ordered',
          clinicalInfo: p.clinicalNotes || p.ClinicalNotes || '',
          lineItems: [
            {
              id: procId,
              code: p.procedureCode || p.ProcedureCode || 'CLIN-PROC',
              name: p.procedureName || p.ProcedureName || 'Clinical Procedure',
              category: 'Nursing / Minor Procedure',
              status: p.statusName || p.StatusName || 'Ordered',
              result: p.procedureResult || p.ProcedureResult || ''
            }
          ]
        });
      });

      // Sort newest orders first
      mappedList.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      setOrders(mappedList);
    } catch (err) {
      console.error('Failed to fetch nurse orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Listen for late order changes
  useEffect(() => {
    const handleSync = () => {
      try {
        const s = localStorage.getItem('cms_late_lab_orders');
        setLateOrders(s ? JSON.parse(s) : {});
      } catch {}
    };
    window.addEventListener('cms_late_lab_order_flagged', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('cms_late_lab_order_flagged', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const toggleExpand = (id: string | number) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedOrderIds(new Set(orders.map(o => o.id)));
  };

  const collapseAll = () => {
    setExpandedOrderIds(new Set());
  };

  // Flag or Unflag lab order as late
  const handleToggleLateFlag = (order: NurseOrderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.orderType !== 'LAB') return;

    const ordKey = String(order.orderNumber);
    const patName = order.patientName;
    const isCurrentlyLate = !!(lateOrders[ordKey] || lateOrders[String(order.id)] || lateOrders[patName]);

    const updated = { ...lateOrders };
    if (isCurrentlyLate) {
      delete updated[ordKey];
      delete updated[String(order.id)];
      delete updated[patName];
      localStorage.setItem('cms_late_lab_orders', JSON.stringify(updated));
      setLateOrders(updated);
      window.dispatchEvent(new CustomEvent('cms_late_lab_order_flagged', { detail: { orderNumber: ordKey, patientName: patName, action: 'cleared' } }));
      setToastMessage(`✓ Cleared late notice for patient ${patName} (${ordKey})`);
    } else {
      updated[ordKey] = { patientName: patName, orderNo: ordKey, flaggedAt: new Date().toISOString() };
      updated[String(order.id)] = { patientName: patName, orderNo: ordKey, flaggedAt: new Date().toISOString() };
      updated[patName] = { patientName: patName, orderNo: ordKey, flaggedAt: new Date().toISOString() };
      localStorage.setItem('cms_late_lab_orders', JSON.stringify(updated));
      setLateOrders(updated);
      window.dispatchEvent(new CustomEvent('cms_late_lab_order_flagged', { detail: { orderNumber: ordKey, patientName: patName, action: 'flagged' } }));
      setToastMessage(`🔔 Sent alert to Laboratory: patient ${patName} order is late!`);
    }

    setTimeout(() => setToastMessage(null), 5000);
  };

  const isOrderLate = (order: NurseOrderItem) => {
    if (order.orderType !== 'LAB') return false;
    return !!(
      lateOrders[String(order.orderNumber)] ||
      lateOrders[String(order.id)] ||
      (order.patientName && lateOrders[order.patientName])
    );
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Type filter
      if (typeFilter !== 'ALL' && o.orderType !== typeFilter) return false;

      // Status filter
      if (statusFilter === 'PENDING') {
        const s = o.status.toLowerCase();
        if (s !== 'ordered' && s !== 'pending') return false;
      } else if (statusFilter === 'IN_PROGRESS') {
        const s = o.status.toLowerCase();
        if (s !== 'inprocess' && s !== 'in process' && s !== 'collected' && s !== 'scheduled') return false;
      } else if (statusFilter === 'COMPLETED') {
        const s = o.status.toLowerCase();
        if (s !== 'approved' && s !== 'completed' && s !== 'verified') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = o.patientName?.toLowerCase().includes(q);
        const matchNum = o.orderNumber?.toLowerCase().includes(q);
        const matchMrn = o.mrn?.toLowerCase().includes(q);
        const matchItem = o.lineItems.some(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
        if (!matchName && !matchNum && !matchMrn && !matchItem) return false;
      }

      return true;
    });
  }, [orders, typeFilter, statusFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: orders.length,
      labs: orders.filter(o => o.orderType === 'LAB').length,
      procs: orders.filter(o => o.orderType === 'PROCEDURE').length,
      pending: orders.filter(o => ['ordered', 'pending'].includes(o.status.toLowerCase())).length,
      inProgress: orders.filter(o => ['inprocess', 'in process', 'collected', 'scheduled'].includes(o.status.toLowerCase())).length,
      completed: orders.filter(o => ['approved', 'completed', 'verified'].includes(o.status.toLowerCase())).length,
      lateCount: orders.filter(o => isOrderLate(o)).length
    };
  }, [orders, lateOrders]);

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Toast Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          background: '#1e293b',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.86rem',
          borderLeft: '4px solid #ef4444'
        }}>
          <BellRing size={16} color="#ef4444" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7' }}>
              <ClipboardList size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Nurse Orders Follow-up &amp; Status Report
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Read-only clinical order tracker to monitor real-time laboratory investigations and nursing procedures.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={fetchOrders}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={expandAll}
            className="btn-secondary"
            style={{ fontSize: '0.82rem' }}
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="btn-secondary"
            style={{ fontSize: '0.82rem' }}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #0284c7' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Orders</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0', color: 'var(--text-main)' }}>{counts.total}</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active tracked</span>
        </div>
        <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #0891b2' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Laboratory Orders</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0', color: '#0891b2' }}>{counts.labs}</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Diagnostic panels</span>
        </div>
        <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #7c3aed' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Procedures</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0', color: '#7c3aed' }}>{counts.procs}</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Minor interventions</span>
        </div>
        <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pending / In Progress</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0', color: '#f59e0b' }}>{counts.pending + counts.inProgress}</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Awaiting completion</span>
        </div>
        <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Completed / Approved</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0', color: '#10b981' }}>{counts.completed}</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Verified for clinic</span>
        </div>
        <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Flagged Late (Lab)</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '2px 0', color: '#ef4444' }}>{counts.lateCount}</div>
          <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>Active bell alerts</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by Patient Name, MRN, Order #, or Test Name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '32px', fontSize: '0.82rem', height: '36px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Order Type Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '2px' }}>
            <button
              onClick={() => setTypeFilter('ALL')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: typeFilter === 'ALL' ? '#0284c7' : 'transparent',
                color: typeFilter === 'ALL' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              All Types ({orders.length})
            </button>
            <button
              onClick={() => setTypeFilter('LAB')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: typeFilter === 'LAB' ? '#0891b2' : 'transparent',
                color: typeFilter === 'LAB' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              Laboratory ({counts.labs})
            </button>
            <button
              onClick={() => setTypeFilter('PROCEDURE')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: typeFilter === 'PROCEDURE' ? '#7c3aed' : 'transparent',
                color: typeFilter === 'PROCEDURE' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              Procedures ({counts.procs})
            </button>
          </div>

          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ height: '36px', fontSize: '0.8rem', padding: '0 10px', borderRadius: '8px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending / Ordered</option>
            <option value="IN_PROGRESS">In Progress / Collected</option>
            <option value="COMPLETED">Completed / Approved</option>
          </select>
        </div>
      </div>

      {/* Orders Table Panel */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <span>Loading orders for follow-up...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
            <ClipboardList size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No orders match the current filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="cms-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}></th>
                  <th style={{ width: '130px' }}>Order Ref / Type</th>
                  <th>Patient Name &amp; MRN</th>
                  <th>Order Date</th>
                  <th>Attending Physician</th>
                  <th>Summary Items</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Late Alert</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => {
                  const isExpanded = expandedOrderIds.has(o.id);
                  const isLate = isOrderLate(o);
                  const isCompleted = ['approved', 'completed', 'verified'].includes(o.status.toLowerCase());
                  const isInProgress = ['inprocess', 'in process', 'collected', 'scheduled'].includes(o.status.toLowerCase());

                  return (
                    <React.Fragment key={String(o.id)}>
                      <tr
                        onClick={() => toggleExpand(o.id)}
                        style={{
                          cursor: 'pointer',
                          background: isLate ? '#fff1f2' : (isExpanded ? '#f8fafc' : undefined),
                          borderLeft: isLate ? '4px solid #ef4444' : undefined
                        }}
                      >
                        {/* Expand toggle */}
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>

                        {/* Order Number & Type Badge */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <strong style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: o.orderType === 'LAB' ? '#0284c7' : '#7c3aed' }}>
                              {o.orderNumber}
                            </strong>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              width: 'fit-content',
                              background: o.orderType === 'LAB' ? '#e0f2fe' : '#f3e8ff',
                              color: o.orderType === 'LAB' ? '#0369a1' : '#6b21a8'
                            }}>
                              {o.orderType === 'LAB' ? 'Laboratory' : 'Procedure'}
                            </span>
                          </div>
                        </td>

                        {/* Patient info */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ fontSize: '0.88rem' }}>{o.patientName}</strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              MRN: {o.mrn || `HD-${o.patientId}`}
                            </span>
                            {isLate && (
                              <span style={{ color: '#dc2626', fontWeight: 'bold', fontStyle: 'italic', fontSize: '0.75rem', marginTop: '2px' }}>
                                patient {o.patientName} order is late
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Order Date */}
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {o.orderDate ? String(o.orderDate).split('T')[0] : 'N/A'}
                        </td>

                        {/* Attending Doctor */}
                        <td style={{ fontSize: '0.82rem' }}>
                          {o.attendingDoctor || 'Attending Physician'}
                        </td>

                        {/* Summary Items */}
                        <td style={{ fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                            {o.lineItems.map(i => i.name).slice(0, 2).join(', ')}
                          </span>
                          {o.lineItems.length > 2 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '4px' }}>
                              +{o.lineItems.length - 2} more
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: isCompleted ? '#dcfce7' : isInProgress ? '#e0f2fe' : '#fef3c7',
                            color: isCompleted ? '#15803d' : isInProgress ? '#0369a1' : '#92400e'
                          }}>
                            {isCompleted ? <Check size={11} /> : <Clock size={11} />}
                            {o.status}
                          </span>
                        </td>

                        {/* Bell Action Button (For Lab Orders) */}
                        <td style={{ textAlign: 'center' }}>
                          {o.orderType === 'LAB' ? (
                            <button
                              onClick={(e) => handleToggleLateFlag(o, e)}
                              title={isLate ? "Order flagged as late (click to dismiss alert)" : "Flag as late: notifies Laboratory module in red bold italic"}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: isLate ? '1px solid #ef4444' : '1px solid var(--border-color)',
                                background: isLate ? '#fee2e2' : '#f8fafc',
                                color: isLate ? '#dc2626' : '#64748b',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {isLate ? <BellRing size={14} color="#dc2626" /> : <Bell size={14} />}
                              <span>{isLate ? 'Late !' : 'Bell'}</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Line Items Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ padding: '0', background: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '0.8rem', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Order Line Items &amp; Clinical Progress ({o.lineItems.length})
                                </strong>
                                {o.clinicalInfo && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <strong>Clinical Notes:</strong> {o.clinicalInfo}
                                  </span>
                                )}
                              </div>

                              <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border-color)', color: '#475569', textAlign: 'left' }}>
                                      <th style={{ padding: '8px 12px' }}>Code</th>
                                      <th style={{ padding: '8px 12px' }}>Investigation / Procedure Item</th>
                                      <th style={{ padding: '8px 12px' }}>Category</th>
                                      <th style={{ padding: '8px 12px' }}>Specimen / Target</th>
                                      <th style={{ padding: '8px 12px' }}>Status</th>
                                      <th style={{ padding: '8px 12px' }}>Result / Reading</th>
                                      <th style={{ padding: '8px 12px' }}>Ref Range</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {o.lineItems.map((item, idx) => (
                                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>
                                          {item.code}
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                          {item.name}
                                        </td>
                                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                          {item.category || 'Clinical'}
                                        </td>
                                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                          {item.sampleType || 'Standard'}
                                        </td>
                                        <td style={{ padding: '8px 12px' }}>
                                          <span style={{
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            background: item.status === 'Approved' || item.status === 'Completed' ? '#dcfce7' : '#f1f5f9',
                                            color: item.status === 'Approved' || item.status === 'Completed' ? '#15803d' : '#475569'
                                          }}>
                                            {item.status}
                                          </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: item.result ? 700 : 400, color: item.result ? '#0f172a' : 'var(--text-muted)' }}>
                                          {item.result || 'Pending Result'}
                                        </td>
                                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                          {item.refRange || '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {isLate && (
                                <div style={{
                                  background: '#fee2e2',
                                  border: '1px solid #fca5a5',
                                  borderRadius: '6px',
                                  padding: '8px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '0.8rem',
                                  color: '#b91c1c'
                                }}>
                                  <AlertTriangle size={15} />
                                  <span>
                                    <strong>Late Notice Active:</strong> Laboratory module displays: <em style={{ fontWeight: 800 }}>patient {o.patientName} order is late</em>
                                  </span>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
