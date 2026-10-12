import React, { useState, useEffect } from 'react';
import {
  X, Check, ShoppingCart, Send, FlaskConical, Stethoscope,
  Scissors, Activity, Search, ShieldCheck, HeartPulse
} from 'lucide-react';
import { api, logAudit } from '../api/apiClient';

interface ClinicalOrderModalProps {
  patient: {
    id: number;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    mrn?: string;
  };
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

interface BasketItem {
  id: string;
  type: 'LAB' | 'PROCEDURE';
  title: string;
  code: string;
  price: number;
  details?: any;
}

export default function ClinicalOrderModal({ patient, onClose, onSuccess }: ClinicalOrderModalProps) {
  const patientId = Number(patient.id || 0);
  const patientName = patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
  const mrn = patient.mrn || `HD-${patientId}`;

  const [activeCategory, setActiveCategory] = useState<string>('LAB');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [labTests, setLabTests] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderBasket, setOrderBasket] = useState<BasketItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [testsRes, servRes, docRes] = await Promise.all([
          api.get<any>('/lab/catalog').catch(() => []),
          api.get<any>('/services?limit=1500').catch(() => []),
          api.get<any>('/staff/doctors').catch(() => [])
        ]);

        const rawTests: any[] = Array.isArray(testsRes) ? testsRes : (testsRes?.data ?? testsRes?.Data ?? []);
        const rawServ: any[] = Array.isArray(servRes) ? servRes : (servRes?.data ?? servRes?.Data ?? []);
        const rawDocs: any[] = Array.isArray(docRes) ? docRes : (docRes?.data ?? docRes?.Data ?? []);

        setLabTests(rawTests.map((t: any) => ({
          id: t.id || t.Id,
          code: t.testCode || t.TestCode || t.code || t.Code || '',
          name: t.testName || t.TestName || t.name || t.Name || 'Lab Test',
          category: t.category || t.Category || 'Laboratory',
          department: t.sampleType || t.SampleType || 'Laboratory',
          price: parseFloat(t.price ?? t.Price ?? 0) || 0
        })));

        setServices(rawServ.map((s: any) => ({
          id: s.id || s.Id,
          code: s.code || s.Code || '',
          name: s.name || s.Name || 'Procedure',
          category: s.category || s.Category || 'General Procedures',
          price: parseFloat(s.price ?? s.Price ?? s.standardFee ?? s.StandardFee ?? 0) || 0
        })));

        setDoctors(rawDocs);
        if (rawDocs.length > 0) {
          setSelectedDoctorId(Number(rawDocs[0].id || rawDocs[0].doctorId || 0));
        }
      } catch (err) {
        console.error('Error fetching order catalog data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Group services by category
  const groupedServices: Record<string, any[]> = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    (services || []).forEach(s => {
      const cat = s.category || 'General Procedures';
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    });
    return map;
  }, [services]);

  const categories = React.useMemo(() => {
    const keys = Object.keys(groupedServices);
    return ['LAB', ...keys];
  }, [groupedServices]);

  const toggleItemInBasket = (item: BasketItem) => {
    setOrderBasket(prev => {
      const exists = prev.some(b => b.id === item.id);
      if (exists) {
        return prev.filter(b => b.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const isChecked = (id: string) => orderBasket.some(b => b.id === id);

  const totalCost = orderBasket.reduce((sum, item) => sum + (item.price || 0), 0);

  const handleSubmitAllOrders = async () => {
    if (orderBasket.length === 0) return;
    try {
      setSubmitting(true);
      const doctorId = selectedDoctorId || (doctors.length > 0 ? doctors[0].id : 1);

      // 1. Dispatch Laboratory Orders
      const labItems = orderBasket.filter(x => x.type === 'LAB');
      let batchedLabOrderId = 0;
      if (labItems.length > 0) {
        const testIds = labItems.map(l => l.details?.testId).filter(Boolean);
        if (testIds.length > 0) {
          const labRes: any = await api.post('/laboratory/orders', {
            tenantId: 1,
            patientId,
            encounterId: null,
            orderedBy: doctorId,
            priority: 2,
            clinicalInfo: labItems.map(l => l.title).join(', '),
            testIds
          }).catch(err => {
            console.warn('Lab order error:', err);
            return null;
          });
          batchedLabOrderId = Number(labRes?.orderId || labRes?.OrderId || 0);
        }
      }

      // 2. Dispatch Procedures
      const procItems = orderBasket.filter(x => x.type === 'PROCEDURE');
      for (const p of procItems) {
        await api.post('/procedures', {
          tenantId: 1,
          encounterId: null,
          patientId,
          orderedBy: doctorId,
          procedureName: p.title,
          procedureCode: p.code,
          clinicalNotes: 'Order placed from Patient Registry'
        }).catch(err => console.warn('Procedure error:', err));
      }

      // 3. Create Billing Invoice for all billable items
      const billable = orderBasket.filter(b => b.price > 0).map(b => ({
        itemType: b.type === 'LAB' ? 'Laboratory' : 'Procedure',
        description: `${b.title} (${b.code})`,
        quantity: 1,
        unitPrice: b.price,
        discount: 0,
        refId: b.type === 'LAB' && batchedLabOrderId > 0 ? batchedLabOrderId : null
      }));

      if (billable.length > 0) {
        await api.post('/billing/invoices', {
          tenantId: 1,
          patientId,
          encounterId: null,
          createdBy: doctorId,
          items: billable
        }).catch(err => console.warn('Invoice creation error:', err));
      }

      // 4. Audit Log
      await logAudit({
        tableName: 'Orders',
        recordId: patientId,
        operation: 'DISPATCH_CLINICAL_ORDERS',
        oldValues: null,
        newValues: {
          patientId,
          mrn,
          itemsCount: orderBasket.length,
          totalPrice: totalCost,
          items: orderBasket.map(b => b.title)
        }
      });

      if (onSuccess) {
        onSuccess(`✓ Dispatched ${orderBasket.length} order(s) for ${patientName} (Total: Br ${totalCost.toFixed(2)})`);
      }
      onClose();
    } catch (err: any) {
      alert(`Order dispatch error: ${err.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div style={{ width: '1160px', maxWidth: '98vw', height: '90vh', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 65px rgba(0,0,0,0.35)', border: '1px solid #cbd5e1' }}>

        {/* HEADER */}
        <div style={{ flexShrink: 0, padding: '12px 20px', background: 'linear-gradient(135deg,#0369a1,#0284c7)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={19} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Clinical Order Hub — {patientName}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)' }}>MRN: <strong>{mrn}</strong> · Select category & check items to order directly</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {orderBasket.length > 0 && (
              <span style={{ padding: '4px 12px', borderRadius: '20px', background: '#f59e0b', color: '#fff', fontSize: '0.76rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Check size={13} /> {orderBasket.length} Selected · Br {totalCost.toFixed(2)}
              </span>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '7px', padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={18} color="#fff" />
            </button>
          </div>
        </div>

        {/* 3-PANEL BODY */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* LEFT: Category Sidebar */}
          <div style={{ width: '240px', flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Order Categories
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              <button
                type="button"
                onClick={() => { setActiveCategory('LAB'); setSearchQuery(''); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeCategory === 'LAB' ? '#e0f2fe' : 'transparent',
                  color: activeCategory === 'LAB' ? '#0369a1' : '#334155',
                  fontWeight: activeCategory === 'LAB' ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '4px'
                }}
              >
                <FlaskConical size={16} color={activeCategory === 'LAB' ? '#0284c7' : '#64748b'} />
                <span>Laboratory Tests</span>
              </button>

              {Object.keys(groupedServices).map(catName => (
                <button
                  key={catName}
                  type="button"
                  onClick={() => { setActiveCategory(catName); setSearchQuery(''); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeCategory === catName ? '#e0e7ff' : 'transparent',
                    color: activeCategory === catName ? '#4338ca' : '#334155',
                    fontWeight: activeCategory === catName ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: '4px'
                  }}
                >
                  <Stethoscope size={16} color={activeCategory === catName ? '#6366f1' : '#64748b'} />
                  <span>{catName}</span>
                </button>
              ))}
            </div>
          </div>

          {/* MIDDLE: Catalog Items List */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', minWidth: 0 }}>
            {/* Filter bar */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff' }}>
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                placeholder={`Search in ${activeCategory === 'LAB' ? 'Laboratory Tests' : activeCategory}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.82rem', color: '#1e293b' }}
              />
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Loading items...</div>
              ) : activeCategory === 'LAB' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                  {labTests
                    .filter(t => !q || (t.name || t.testName || '').toLowerCase().includes(q) || (t.code || t.testCode || '').toLowerCase().includes(q))
                    .map(t => {
                      const id = `LAB-${t.id || t.testId}`;
                      const checked = isChecked(id);
                      const title = t.name || t.testName || 'Test';
                      const code = t.code || t.testCode || 'LAB';
                      const price = Number(t.price || t.cost || 0);

                      return (
                        <div
                          key={id}
                          onClick={() => toggleItemInBasket({ id, type: 'LAB', title, code, price, details: { testId: t.id || t.testId } })}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: `1.5px solid ${checked ? '#0284c7' : '#e2e8f0'}`,
                            background: checked ? '#f0f9ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <input type="checkbox" checked={checked} readOnly style={{ cursor: 'pointer' }} />
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{title}</div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{code}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1' }}>
                            Br {price.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                  {(groupedServices[activeCategory] || [])
                    .filter(s => !q || (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q))
                    .map(s => {
                      const id = `PROC-${s.id}`;
                      const checked = isChecked(id);
                      const title = s.name || 'Procedure';
                      const code = s.code || 'PROC';
                      const price = Number(s.price || s.basePrice || 0);

                      return (
                        <div
                          key={id}
                          onClick={() => toggleItemInBasket({ id, type: 'PROCEDURE', title, code, price, details: { serviceId: s.id } })}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: `1.5px solid ${checked ? '#6366f1' : '#e2e8f0'}`,
                            background: checked ? '#eef2ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <input type="checkbox" checked={checked} readOnly style={{ cursor: 'pointer' }} />
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{title}</div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{code}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4338ca' }}>
                            Br {price.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Selected Basket Panel */}
          <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                Order Basket ({orderBasket.length})
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Attending Physician</label>
                <select
                  value={selectedDoctorId}
                  onChange={e => setSelectedDoctorId(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', background: '#fff' }}
                >
                  {doctors.map(d => (
                    <option key={d.id || d.doctorId} value={d.id || d.doctorId}>
                      {d.doctorName || d.name || `Dr. Staff #${d.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {orderBasket.length === 0 ? (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                  No items selected yet. Click any test or procedure to add.
                </div>
              ) : (
                orderBasket.map(b => (
                  <div key={b.id} style={{ padding: '8px 10px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{b.type} · Br {b.price.toFixed(2)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleItemInBasket(b)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Actions */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Total Estimated:</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0369a1' }}>Br {totalCost.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={handleSubmitAllOrders}
                disabled={orderBasket.length === 0 || submitting}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: orderBasket.length === 0 || submitting ? '#94a3b8' : '#0284c7',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: orderBasket.length === 0 || submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Send size={15} />
                {submitting ? 'Dispatching...' : `Dispatch Orders (${orderBasket.length})`}
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
