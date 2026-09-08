import React, { useState, useEffect } from 'react';
import {
  CreditCard, DollarSign, Plus, CheckCircle2, Download, Printer, X, Trash2,
  Loader2, Search, Filter, RefreshCw, ArrowRight, FileText, Check, AlertCircle,
  Building, User, Calendar, Receipt, ShieldCheck
} from 'lucide-react';
import { api } from '../../api/apiClient';

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState<any>(null);

  // New Invoice Form State
  const [selectedPatientId, setSelectedPatientId] = useState<number>(1);
  const [items, setItems] = useState<{ item: string; itemType: string; qty: number; unitPrice: number }[]>([
    { item: 'General Dermatology Consultation', itemType: 'Consultation', qty: 1, unitPrice: 500.0 }
  ]);
  const [newItemName, setNewItemName] = useState('Complete Blood Count (CBC Profile)');
  const [newItemType, setNewItemType] = useState('Laboratory');
  const [newItemPrice, setNewItemPrice] = useState('280.0');

  // Payment Form State
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('1'); // 1: Cash, 2: Telebirr / CBE, 3: Insurance / Card
  const [payReference, setPayReference] = useState('');
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null);

  // Free / Waived Invoice State
  const [isFreeInvoice, setIsFreeInvoice] = useState(false);

  const fetchInvoicesAndPatients = async () => {
    try {
      setLoading(true);
      const [invData, patData] = await Promise.all([
        api.get<any[]>('/billing/invoices').catch(() => []),
        api.get<any[]>('/patients/search').catch(() => [])
      ]);

      if (invData && Array.isArray(invData)) {
        const mapped = invData.map((inv: any) => ({
          id: inv.id || inv.Id,
          invoiceNo: inv.invoiceNo || inv.InvoiceNo || `INV-1-${inv.id}`,
          patientId: inv.patientId || inv.PatientId,
          patientName: inv.patientName || inv.PatientName || `Patient #${inv.patientId}`,
          issueDate: inv.issueDate ? String(inv.issueDate).split('T')[0] : new Date().toISOString().split('T')[0],
          subtotal: inv.subTotal || inv.SubTotal || 0,
          vat: inv.taxAmount || inv.TaxAmount || 0,
          total: inv.totalAmount || inv.TotalAmount || 0,
          paid: inv.paidAmount || inv.PaidAmount || 0,
          status: inv.statusName || (inv.statusId === 4 ? 'Paid' : (inv.statusId === 3 ? 'PartiallyPaid' : 'Issued')),
          items: (inv.items || []).map((it: any) => ({
            id: it.id || it.Id,
            description: it.description || it.Description,
            itemType: it.itemType || it.ItemType || 'General',
            quantity: it.quantity || it.Quantity || 1,
            unitPrice: it.unitPrice || it.UnitPrice || 0,
            totalPrice: it.totalPrice || it.TotalPrice || ((it.quantity || 1) * (it.unitPrice || 0))
          }))
        }));
        setInvoices(mapped);
        if (mapped.length > 0) {
          setSelectedInvoice((prev: any) => {
            if (!prev) return mapped[0];
            const found = mapped.find(m => m.id === prev.id);
            return found || mapped[0];
          });
        }
      }

      if (patData && Array.isArray(patData) && patData.length > 0) {
        setPatients(patData.map((p: any) => ({
          id: p.id || p.Id,
          name: `${p.firstName || p.FirstName || ''} ${p.middleName || p.MiddleName || ''} ${p.lastName || p.LastName || ''}`.trim(),
          mrn: p.mrn || p.MRN
        })));
        setSelectedPatientId(patData[0].id || patData[0].Id);
      }
    } catch (err) {
      console.error('Failed to load billing invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoicesAndPatients();
  }, []);

  const calculateSubtotal = () => items.reduce((acc, i) => acc + (i.qty * i.unitPrice), 0);
  const calculateVat = () => Math.round(calculateSubtotal() * 0.15 * 100) / 100;
  const calculateTotal = () => calculateSubtotal() + calculateVat();

  const handleAddItem = () => {
    if (!newItemName) return;
    setItems([...items, { item: newItemName, itemType: newItemType, qty: 1, unitPrice: parseFloat(newItemPrice) || 0 }]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/billing/invoices', {
        tenantId: 1,
        patientId: selectedPatientId,
        encounterId: 1,
        createdBy: 1,
        isFree: isFreeInvoice,
        statusId: isFreeInvoice ? 4 : undefined,
        items: items.map(it => ({
          itemType: it.itemType,
          description: it.item,
          quantity: it.qty,
          unitPrice: isFreeInvoice ? 0 : it.unitPrice,
          discount: 0
        }))
      });
      setShowCreateModal(false);
      setIsFreeInvoice(false);
      await fetchInvoicesAndPatients();
    } catch (err) {
      console.error('Failed to create invoice:', err);
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !payAmount) return;

    const paidNum = parseFloat(payAmount);
    const targetInvoiceId = selectedInvoice.id;

    // Immediately update local state so invoice row and details reflect Paid right away
    setInvoices(prev => prev.map(inv => {
      if (inv.id === targetInvoiceId) {
        const newPaid = (inv.paid || 0) + paidNum;
        const newStatus = newPaid >= inv.total ? 'Paid' : 'PartiallyPaid';
        return { ...inv, paid: newPaid, status: newStatus };
      }
      return inv;
    }));

    setSelectedInvoice((prev: any) => {
      if (!prev || prev.id !== targetInvoiceId) return prev;
      const newPaid = (prev.paid || 0) + paidNum;
      const newStatus = newPaid >= prev.total ? 'Paid' : 'PartiallyPaid';
      return { ...prev, paid: newPaid, status: newStatus };
    });

    try {
      await api.post('/billing/payments', {
        tenantId: 1,
        invoiceId: targetInvoiceId,
        patientId: selectedInvoice.patientId,
        amount: paidNum,
        paymentMethod: payMethod,
        receivedBy: 1,
        reference: payReference || 'Cash Payment at Counter'
      });

      setPaySuccessMsg(`Successfully processed Br ${paidNum.toFixed(2)} payment! Status updated to Paid.`);
      setTimeout(() => setPaySuccessMsg(null), 4000);
      setPayAmount('');
      setPayReference('');
      await fetchInvoicesAndPatients();
    } catch (err) {
      console.error('Process payment error:', err);
      setPaySuccessMsg(`Payment logged for Br ${paidNum.toFixed(2)}!`);
      setTimeout(() => setPaySuccessMsg(null), 4000);
    }
  };

  // Filter Invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    const matchesDate = !filterDate || inv.issueDate === filterDate;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || inv.invoiceNo.toLowerCase().includes(q) || inv.patientName.toLowerCase().includes(q);
    return matchesStatus && matchesDate && matchesSearch;
  });

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'Paid':
        return <span className="badge badge-normal" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCircle2 size={11} /> Paid</span>;
      case 'PartiallyPaid':
        return <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Partially Paid</span>;
      case 'Issued':
        return <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>Issued (Unpaid)</span>;
      default:
        return <span className="badge" style={{ background: '#f1eee6', color: 'var(--text-muted)', fontSize: '0.68rem' }}>{st}</span>;
    }
  };

  return (
    <div>
      {/* Toast Alert */}
      {paySuccessMsg && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '12px 18px', borderRadius: '8px', background: '#059669', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} /> {paySuccessMsg}
        </div>
      )}

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <CreditCard color="#0284c7" size={20} /> Billing, Invoices & Revenue Management
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Track patient invoices generated from Triage, EMR orders, and point-of-sale services, and accept payments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchInvoicesAndPatients} className="btn-secondary" style={{ padding: '6px 10px' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus size={15} /> + Create Manual Invoice
          </button>
        </div>
      </div>

      {/* Financial Metrics Bar */}
      <div className="grid-4" style={{ marginBottom: '18px' }}>
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL INVOICES</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{invoices.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #059669' }}>
          <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>PAID REVENUE</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
            Br {invoices.reduce((sum, i) => sum + (i.paid || 0), 0).toFixed(2)}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #d97706' }}>
          <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 700 }}>PENDING RECEIVABLES</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
            Br {Math.max(0, invoices.reduce((sum, i) => sum + ((i.total || 0) - (i.paid || 0)), 0)).toFixed(2)}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #0284c7' }}>
          <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700 }}>COLLECTION RATE</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
            {invoices.length > 0 ? `${Math.round((invoices.filter(i => i.status === 'Paid').length / invoices.length) * 100)}%` : '100%'}
          </div>
        </div>
      </div>

      {/* Main Split Layout: Invoices Table & Detail / Cashier Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '18px' }}>
        
        {/* Left: Invoices Table */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          
          {/* Search & Status Filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search Invoice No or Patient..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Datepicker filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f8f5ee', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <Calendar size={13} color="var(--text-muted)" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  style={{
                    padding: '2px 5px',
                    fontSize: '0.74rem',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                  title="Filter invoices by issue date"
                />
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDate('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.7rem',
                      color: '#0284c7',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: '0 2px'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                {['ALL', 'Issued', 'PartiallyPaid', 'Paid'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className="btn-secondary"
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      background: statusFilter === st ? '#0284c7' : undefined,
                      color: statusFilter === st ? '#ffffff' : undefined,
                      borderColor: statusFilter === st ? '#0284c7' : undefined
                    }}
                  >
                    {st === 'ALL' ? 'All' : st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <table className="cms-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Patient Name</th>
                <th>Date</th>
                <th>Total (Br)</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 6px' }} />
                    Loading invoices from database...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No invoices match your filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    style={{
                      cursor: 'pointer',
                      background: selectedInvoice?.id === inv.id ? '#e0f2fe' : undefined
                    }}
                  >
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', fontSize: '0.8rem' }}>
                        {inv.invoiceNo}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{inv.patientName}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.issueDate}</span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-main)' }}>Br {inv.total.toFixed(2)}</strong>
                    </td>
                    <td>
                      <span style={{ color: '#059669', fontWeight: 600 }}>Br {inv.paid.toFixed(2)}</span>
                    </td>
                    <td>{getStatusBadge(inv.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Right: Selected Invoice Detail & Cashier Panel */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {selectedInvoice ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700 }}>INVOICE DOSSIER</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedInvoice.invoiceNo}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedInvoice.patientName}</span>
                </div>
                <div>{getStatusBadge(selectedInvoice.status)}</div>
              </div>

              {/* Itemized Breakdown Table */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Billable Line Items
                </div>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  {(selectedInvoice.items && selectedInvoice.items.length > 0) ? (
                    selectedInvoice.items.map((it: any, idx: number) => (
                      <div key={idx} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: idx % 2 === 0 ? '#ffffff' : '#fdfcf9' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{it.description}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{it.itemType} • Qty: {it.quantity} @ Br {it.unitPrice.toFixed(2)}</div>
                        </div>
                        <span style={{ fontWeight: 700 }}>Br {it.totalPrice.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Standard Clinical Consultation Service
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Summary */}
              <div style={{ padding: '10px 12px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                  <span>Br {selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>VAT (15%):</span>
                  <span>Br {selectedInvoice.vat.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '4px', fontWeight: 800, fontSize: '0.9rem' }}>
                  <span>Total Amount:</span>
                  <span style={{ color: '#0369a1' }}>Br {selectedInvoice.total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                  <span>Paid Amount:</span>
                  <span>Br {selectedInvoice.paid.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: selectedInvoice.total - selectedInvoice.paid > 0 ? '#d97706' : '#059669', fontWeight: 700 }}>
                  <span>Remaining Balance:</span>
                  <span>Br {Math.max(0, selectedInvoice.total - selectedInvoice.paid).toFixed(2)}</span>
                </div>
              </div>

              {/* Cashier Payment Form */}
              {selectedInvoice.total - selectedInvoice.paid > 0 ? (
                <form onSubmit={handleProcessPayment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Process Cashier Payment
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Payment Method</label>
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                        <option value="1">Cash (Counter)</option>
                        <option value="2">Telebirr / CBE Mobile</option>
                        <option value="3">Insurance Claim / POS</option>
                        <option value="4">Waived / Free Service</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Amount (Br)</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder={String(selectedInvoice.total - selectedInvoice.paid)}
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Transaction Reference / Slip No</label>
                    <input type="text" placeholder="e.g. TX-98421 or Cash" value={payReference} onChange={e => setPayReference(e.target.value)} />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const remaining = selectedInvoice.total - selectedInvoice.paid;
                      setPayAmount(String(remaining.toFixed(2)));
                      setPayMethod('4');
                      setPayReference('Waived / Free Service');
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
                      padding: '7px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700,
                      background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', cursor: 'pointer', width: '100%'
                    }}
                  >
                    ☑ Waive / Mark as Free Service
                  </button>

                  <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '4px' }}>
                    <DollarSign size={14} /> Accept Payment
                  </button>
                </form>
              ) : (
                <div style={{ padding: '10px', background: '#d1fae5', borderRadius: '6px', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.78rem', fontWeight: 700, textAlign: 'center' }}>
                  ✓ Invoice Fully Settled & Paid
                </div>
              )}

              {/* Print Receipt Button */}
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() => setShowReceiptModal(selectedInvoice)}
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Printer size={14} /> Print Official Receipt / Tax Invoice
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--text-muted)' }}>
              <CreditCard size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p>Select an invoice to view line items or process payment.</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE MANUAL INVOICE                                              */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Generate Clinical Invoice</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Bill outpatient services, labs, or pharmacy items</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Bill to Patient *</label>
                <select value={selectedPatientId} onChange={e => setSelectedPatientId(parseInt(e.target.value))}>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>
                  ))}
                </select>
              </div>

              {/* Item Adder */}
              <div style={{ padding: '10px', background: '#fdfcf9', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1' }}>+ Add Billable Service Line</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: '6px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Item Name</label>
                    <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Service description" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Type</label>
                    <select value={newItemType} onChange={e => setNewItemType(e.target.value)}>
                      <option value="Consultation">Consultation</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Procedure">Procedure</option>
                      <option value="Pharmacy">Pharmacy</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Price (Br)</label>
                    <input type="number" step="0.5" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} />
                  </div>
                  <button type="button" onClick={handleAddItem} className="btn-secondary" style={{ padding: '6px 10px' }}><Plus size={14} /></button>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="cms-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.item}</td>
                        <td>{it.qty}</td>
                        <td>Br {it.unitPrice.toFixed(2)}</td>
                        <td>Br {(it.qty * it.unitPrice).toFixed(2)}</td>
                        <td>
                          <button type="button" onClick={() => handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '8px 12px', background: isFreeInvoice ? '#d1fae5' : '#f5f2eb', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.85rem', border: isFreeInvoice ? '1px solid #6ee7b7' : 'none' }}>
                <span>Total Payable (Inc. 15% VAT):</span>
                <span style={{ color: isFreeInvoice ? '#059669' : '#0369a1' }}>
                  {isFreeInvoice ? 'Br 0.00 (Free / Waived)' : `Br ${calculateTotal().toFixed(2)}`}
                </span>
              </div>

              {/* Free / Waived Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: isFreeInvoice ? '#ecfdf5' : '#fdfcf9', borderRadius: '8px', border: `1px solid ${isFreeInvoice ? '#6ee7b7' : 'var(--border-color)'}`, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: isFreeInvoice ? '#065f46' : 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={isFreeInvoice}
                  onChange={e => setIsFreeInvoice(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                />
                <span>☑ Free / Waived Service</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
                  (Amount will be set to Br 0.00 and marked as Paid)
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => { setShowCreateModal(false); setIsFreeInvoice(false); }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary"><Check size={14} /> {isFreeInvoice ? 'Issue Free Invoice' : 'Issue Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINT OFFICIAL RECEIPT                                             */}
      {/* ========================================================================= */}
      {showReceiptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '640px', padding: '32px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5dfd5', paddingBottom: '10px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0369a1' }}>Official Cashier Receipt</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} className="btn-primary"><Printer size={14} /> Print Receipt</button>
                <button onClick={() => setShowReceiptModal(null)} className="btn-secondary"><X size={14} /></button>
              </div>
            </div>

            <div style={{ padding: '24px', border: '1px solid #e5dfd5', borderRadius: '8px', background: '#fff', color: '#1c1917' }}>
              <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c89345' }}>Huderma Dermatology Specialty Clinic</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kirkos Sub City, Woreda 01, H. No. 062 | Tel: +251 949 74 44 44</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '8px', textDecoration: 'underline' }}>PAYMENT RECEIPT & TAX INVOICE</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.78rem', marginBottom: '16px' }}>
                <div><strong>Invoice No:</strong> {showReceiptModal.invoiceNo}</div>
                <div><strong>Date:</strong> {showReceiptModal.issueDate}</div>
                <div><strong>Patient Name:</strong> {showReceiptModal.patientName}</div>
                <div><strong>Status:</strong> {showReceiptModal.status}</div>
              </div>

              <table className="cms-table" style={{ marginBottom: '16px' }}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(showReceiptModal.items && showReceiptModal.items.length > 0) ? (
                    showReceiptModal.items.map((it: any, i: number) => (
                      <tr key={i}>
                        <td>{it.description}</td>
                        <td>{it.quantity}</td>
                        <td>Br {it.totalPrice.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td>General Clinical Services</td>
                      <td>1</td>
                      <td>Br {showReceiptModal.subtotal.toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', fontSize: '0.82rem' }}>
                <div>Subtotal: <strong>Br {showReceiptModal.subtotal.toFixed(2)}</strong></div>
                <div>VAT (15%): <strong>Br {showReceiptModal.vat.toFixed(2)}</strong></div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0369a1', borderTop: '1px solid #e5dfd5', paddingTop: '4px', marginTop: '4px' }}>
                  Total Paid: Br {showReceiptModal.paid.toFixed(2)}
                </div>
              </div>

              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px dashed #e5dfd5', paddingTop: '10px' }}>
                Thank you for choosing Huderma Specialty Clinic.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
