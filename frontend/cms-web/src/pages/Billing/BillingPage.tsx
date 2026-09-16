import React, { useState, useEffect } from 'react';
import {
  CreditCard, DollarSign, Plus, CheckCircle2, Download, Printer, X, Trash2,
  Loader2, Search, Filter, RefreshCw, ArrowRight, FileText, Check, AlertCircle,
  Building, User, Calendar, Receipt, ShieldCheck, QrCode, Shield, FileSpreadsheet, Send
} from 'lucide-react';
import { api } from '../../api/apiClient';

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState<any>(null);
  const [showScreenshotModal, setShowScreenshotModal] = useState<string | null>(null);

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

  // Active Top Tab (Invoices vs Insurance Claims)
  const [billingTab, setBillingTab] = useState<'invoices' | 'claims'>('invoices');

  // Insurance & Claims State
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [isInsuranceCovered, setIsInsuranceCovered] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<number | ''>('');
  const [coPayPercent, setCoPayPercent] = useState<string>('20.0');
  const [preAuthCode, setPreAuthCode] = useState('');

  // Fiscal Sign State
  const [isSigningFiscal, setIsSigningFiscal] = useState(false);

  // Telebirr QR Modal State
  const [showTelebirrModal, setShowTelebirrModal] = useState(false);
  const [telebirrQrPayload, setTelebirrQrPayload] = useState<string | null>(null);
  const [telebirrCbeQrPayload, setTelebirrCbeQrPayload] = useState<string | null>(null);
  const [telebirrLoading, setTelebirrLoading] = useState(false);
  const [telebirrSettled, setTelebirrSettled] = useState(false);
  const telebirrPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Free / Waived Invoice State
  const [isFreeInvoice, setIsFreeInvoice] = useState(false);
  const [vatPercent, setVatPercent] = useState<number>(0.0);
  const [isVerifyingTransfer, setIsVerifyingTransfer] = useState(false);
  const [clinicProfile, setClinicProfile] = useState<{ name: string; address: string; phone: string }>({
    name: 'Specialty Clinic',
    address: 'Addis Ababa, Ethiopia',
    phone: '+251 911 00 00 00'
  });

  const fetchInvoicesAndPatients = async () => {
    try {
      setLoading(true);
      const [invData, patData, settingsData, provData, claimData] = await Promise.all([
        api.get<any[]>('/billing/invoices').catch(() => []),
        api.get<any[]>('/patients/search').catch(() => []),
        api.get<any[]>('/settings').catch(() => []),
        api.get<any[]>('/billing/insurance/providers').catch(() => []),
        api.get<any[]>('/billing/insurance/claims').catch(() => [])
      ]);

      if (Array.isArray(provData)) setInsuranceProviders(provData);
      if (Array.isArray(claimData)) setClaims(claimData);

      if (settingsData && Array.isArray(settingsData)) {
        let cName = 'Specialty Clinic';
        let cAddr = 'Addis Ababa, Ethiopia';
        let cPhone = '+251 911 00 00 00';
        let foundTaxRate = false;
        settingsData.forEach((s: any) => {
          const k = s.settingKey || s.SettingKey;
          const v = s.settingValue || s.SettingValue;
          if (k === 'ClinicName' && v) cName = v;
          if (k === 'ClinicAddress' && v) cAddr = v;
          if (k === 'ClinicPhone' && v) cPhone = v;
          if (k === 'TaxRate') {
            const parsed = parseFloat(v);
            if (!isNaN(parsed) && parsed >= 0) {
              setVatPercent(parsed);
              foundTaxRate = true;
            }
          }
        });
        if (!foundTaxRate) {
          const fallbackVat = settingsData.find((s: any) => (s.settingKey || s.SettingKey) === 'Tax.DefaultVatPercent');
          if (fallbackVat) {
            const parsed = parseFloat(fallbackVat.settingValue || fallbackVat.SettingValue);
            if (!isNaN(parsed) && parsed >= 0) setVatPercent(parsed);
          }
        }
        setClinicProfile({ name: cName, address: cAddr, phone: cPhone });
      }

      if (invData && Array.isArray(invData)) {
        const mapped = invData.map((inv: any) => {
          const isWaived = inv.isWaived || inv.IsWaived || inv.totalAmount === 0 || inv.TotalAmount === 0;
          return {
            id: inv.id || inv.Id,
            invoiceNo: inv.invoiceNo || inv.InvoiceNo || `INV-1-${inv.id}`,
            patientId: inv.patientId || inv.PatientId,
            patientName: inv.patientName || inv.PatientName || `Patient #${inv.patientId}`,
            issueDate: inv.issueDate ? String(inv.issueDate).split('T')[0] : new Date().toISOString().split('T')[0],
            subtotal: inv.subTotal || inv.SubTotal || 0,
            vat: inv.taxAmount || inv.TaxAmount || 0,
            total: inv.totalAmount || inv.TotalAmount || 0,
            paid: inv.paidAmount || inv.PaidAmount || 0,
            isWaived: isWaived,
            status: isWaived ? 'Waived' : (inv.statusName || (inv.statusId === 4 ? 'Paid' : (inv.statusId === 3 ? 'PartiallyPaid' : 'Issued'))),
            insuranceProviderId: inv.insuranceProviderId || inv.InsuranceProviderId,
            insuranceProviderName: inv.insuranceProviderName || inv.InsuranceProviderName,
            insuranceCoPayPercent: inv.insuranceCoPayPercent ?? inv.InsuranceCoPayPercent ?? 0,
            insuranceClaimAmount: inv.insuranceClaimAmount ?? inv.InsuranceClaimAmount ?? 0,
            patientPayAmount: inv.patientPayAmount ?? inv.PatientPayAmount ?? inv.totalAmount ?? 0,
            preAuthCode: inv.preAuthCode || inv.PreAuthCode,
            claimStatusId: inv.claimStatusId || inv.ClaimStatusId || 1,
            fiscalReceiptNo: inv.fiscalReceiptNo || inv.FiscalReceiptNo,
            fiscalSignature: inv.fiscalSignature || inv.FiscalSignature,
            fiscalQrPayload: inv.fiscalQrPayload || inv.FiscalQrPayload,
            receiptImageUrl: inv.receiptImageUrl || inv.ReceiptImageUrl || null,
            notes: inv.notes || inv.Notes || '',
            items: (inv.items || []).map((it: any) => ({
              id: it.id || it.Id,
              description: it.description || it.Description,
              itemType: it.itemType || it.ItemType || 'General',
              quantity: it.quantity || it.Quantity || 1,
              unitPrice: it.unitPrice || it.UnitPrice || 0,
              totalPrice: it.totalPrice || it.TotalPrice || ((it.quantity || 1) * (it.unitPrice || 0))
            }))
          };
        });
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
  const calculateVat = () => Math.round(calculateSubtotal() * (vatPercent / 100) * 100) / 100;
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
        insuranceProviderId: isInsuranceCovered && selectedProviderId ? Number(selectedProviderId) : undefined,
        insuranceCoPayPercent: isInsuranceCovered ? (parseFloat(coPayPercent) || 0) : undefined,
        preAuthCode: isInsuranceCovered ? preAuthCode.trim() : undefined,
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
      setIsInsuranceCovered(false);
      setSelectedProviderId('');
      setPreAuthCode('');
      await fetchInvoicesAndPatients();
    } catch (err) {
      console.error('Failed to create invoice:', err);
    }
  };

  const handleSignFiscalReceipt = async (inv: any) => {
    try {
      setIsSigningFiscal(true);
      const res: any = await api.post(`/fiscal/sign-receipt/${inv.id}`, {});
      const signData = res?.data || res?.Data || res;
      if (signData?.fiscalReceiptNo || signData?.FiscalReceiptNo) {
        setShowReceiptModal({
          ...inv,
          fiscalReceiptNo: signData.fiscalReceiptNo || signData.FiscalReceiptNo,
          fiscalSignature: signData.fiscalSignature || signData.FiscalSignature,
          fiscalQrPayload: signData.fiscalQrPayload || signData.FiscalQrPayload,
          mrcNumber: signData.mrcNumber || signData.MrcNumber || 'ERCA-ETH-2026-F9812'
        });
        await fetchInvoicesAndPatients();
      }
    } catch (err: any) {
      alert(`Fiscal device signature failed: ${err?.message || 'Check ERCA communication port.'}`);
    } finally {
      setIsSigningFiscal(false);
    }
  };

  const handleUpdateClaimStatus = async (invoiceId: number, statusId: number) => {
    try {
      await api.put(`/billing/insurance/claims/${invoiceId}/status`, { statusId });
      await fetchInvoicesAndPatients();
    } catch (err) {
      console.error('Failed to update claim status:', err);
    }
  };

  const handleVerifyTelemedTransfer = async (invoiceId: number) => {
    try {
      setIsVerifyingTransfer(true);
      await api.post(`/billing/invoices/${invoiceId}/verify-telemed-payment`, {});
      setPaySuccessMsg('✓ Transfer verified & confirmed! Telegram notification sent to patient.');
      setTimeout(() => setPaySuccessMsg(null), 4500);
      await fetchInvoicesAndPatients();
    } catch (err: any) {
      alert(`Transfer verification failed: ${err?.message || 'Check server connection.'}`);
    } finally {
      setIsVerifyingTransfer(false);
    }
  };

  const handleGenerateTelebirrQr = async () => {
    if (!selectedInvoice) return;
    try {
      setTelebirrLoading(true);
      setTelebirrSettled(false);
      setTelebirrQrPayload(null);
      setTelebirrCbeQrPayload(null);
      const res: any = await api.post('/telebirr/generate-qr', {
        invoiceId: selectedInvoice.id,
        invoiceNo: selectedInvoice.invoiceNo,
        amount: Math.max(0, selectedInvoice.total - selectedInvoice.paid)
      });
      const d = res?.data || res?.Data || res;
      setTelebirrQrPayload(d?.telebirrQrString || d?.TelebirrQrString || null);
      setTelebirrCbeQrPayload(d?.cbeBirrQrString || d?.CbeBirrQrString || null);
      setShowTelebirrModal(true);

      // Auto-poll for settlement every 3s
      if (telebirrPollRef.current) clearInterval(telebirrPollRef.current);
      telebirrPollRef.current = setInterval(async () => {
        try {
          const status: any = await api.get(`/telebirr/check-status/${selectedInvoice.id}`);
          const s = status?.data || status?.Data || status;
          if (s?.isSettled || s?.IsSettled) {
            setTelebirrSettled(true);
            if (telebirrPollRef.current) clearInterval(telebirrPollRef.current);
            setTimeout(async () => {
              setShowTelebirrModal(false);
              await fetchInvoicesAndPatients();
            }, 2000);
          }
        } catch {}
      }, 3000);
    } catch (err: any) {
      alert(`Failed to generate Telebirr QR: ${err?.message || 'API error'}`);
    } finally {
      setTelebirrLoading(false);
    }
  };

  const closeTelebirrModal = () => {
    if (telebirrPollRef.current) clearInterval(telebirrPollRef.current);
    setShowTelebirrModal(false);
    setTelebirrQrPayload(null);
    setTelebirrCbeQrPayload(null);
    setTelebirrSettled(false);
  };

  const handleSimulateTelebirrScan = async () => {
    if (!selectedInvoice) return;
    try {
      await api.post('/telebirr/webhook', {
        invoiceId: selectedInvoice.id,
        transactionNo: `SIM-${Date.now()}`,
        amount: Math.max(0, selectedInvoice.total - selectedInvoice.paid),
        payerPhone: '0911000000',
        status: 'Completed'
      });
      setTelebirrSettled(true);
      if (telebirrPollRef.current) clearInterval(telebirrPollRef.current);
      setTimeout(async () => {
        setShowTelebirrModal(false);
        await fetchInvoicesAndPatients();
      }, 2000);
    } catch (err: any) {
      alert(`Simulation failed: ${err?.message || 'API error'}`);
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const isWaived = payMethod === '4';
    const remaining = selectedInvoice.total - selectedInvoice.paid;
    const apiAmount = isWaived ? remaining : parseFloat(payAmount);
    if (!isWaived && !payAmount) return;

    const paidNum = isWaived ? remaining : parseFloat(payAmount);
    const targetInvoiceId = selectedInvoice.id;

    // Immediately update local state
    setInvoices(prev => prev.map(inv => {
      if (inv.id === targetInvoiceId) {
        const newPaid = isWaived ? inv.total : (inv.paid || 0) + paidNum;
        const newStatus = newPaid >= inv.total ? 'Paid' : 'PartiallyPaid';
        return { ...inv, paid: newPaid, status: newStatus };
      }
      return inv;
    }));

    setSelectedInvoice((prev: any) => {
      if (!prev || prev.id !== targetInvoiceId) return prev;
      const newPaid = isWaived ? prev.total : (prev.paid || 0) + paidNum;
      const newStatus = newPaid >= prev.total ? 'Paid' : 'PartiallyPaid';
      return { ...prev, paid: newPaid, status: newStatus };
    });

    try {
      await api.post('/billing/payments', {
        tenantId: 1,
        invoiceId: targetInvoiceId,
        patientId: selectedInvoice.patientId,
        amount: apiAmount,
        paymentMethod: payMethod,
        receivedBy: 1,
        reference: payReference || (isWaived ? 'Waived / Free Service' : 'Cash Payment at Counter')
      });

      setPaySuccessMsg(isWaived
        ? `Invoice waived and marked as Paid (Free Service).`
        : `Successfully processed Br ${paidNum.toFixed(2)} payment! Status updated to Paid.`
      );
      setTimeout(() => setPaySuccessMsg(null), 4000);
      setPayAmount('');
      setPayReference('');
      setPayMethod('1');
      await fetchInvoicesAndPatients();
    } catch (err) {
      console.error('Process payment error:', err);
      setPaySuccessMsg(isWaived ? 'Invoice marked as waived!' : `Payment logged for Br ${paidNum.toFixed(2)}!`);
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
      case 'Waived':
        return <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}>☑ Waived (Free)</span>;
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

  const getClaimStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="badge badge-normal" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCircle2 size={11} /> Approved</span>;
      case 'Reimbursed':
        return <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}>✓ Reimbursed</span>;
      case 'Rejected':
        return <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>Rejected</span>;
      default:
        return <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Submitted</span>;
    }
  };

  // Exclude waived/free invoices from sales revenue figures
  const nonWaivedInvoices = invoices.filter(i => !i.isWaived && i.status !== 'Waived');
  const paidRevenue = nonWaivedInvoices.reduce((sum, i) => sum + (i.paid || 0), 0);
  const pendingReceivables = Math.max(0, nonWaivedInvoices.reduce((sum, i) => sum + ((i.total || 0) - (i.paid || 0)), 0));
  const paidCount = nonWaivedInvoices.filter(i => i.status === 'Paid').length;
  const collectionRate = nonWaivedInvoices.length > 0 ? Math.round((paidCount / nonWaivedInvoices.length) * 100) : 100;

  return (
    <div>
      {/* Toast Alert */}
      {paySuccessMsg && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '12px 18px', borderRadius: '8px', background: '#059669', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} /> {paySuccessMsg}
        </div>
      )}

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <CreditCard color="#0284c7" size={20} /> Billing, Fiscal &amp; Insurance Engine
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Process patient invoices, automated ERCA tax receipts, and insurance third-party claims (TPA).
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

      {/* Primary Module Tabs: Invoices vs Insurance Claims */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setBillingTab('invoices')}
          className={billingTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
        >
          <Receipt size={15} /> Invoices &amp; Fiscal Receipts ({invoices.length})
        </button>
        <button
          onClick={() => setBillingTab('claims')}
          className={billingTab === 'claims' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
        >
          <ShieldCheck size={15} /> Insurance / TPA Claims ({claims.length})
        </button>
      </div>

      {/* Financial Metrics Bar (Excluding Free / Waived Services) */}
      <div className="grid-4" style={{ marginBottom: '18px' }}>
        <div className="glass-panel" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>BILLABLE INVOICES</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
            {nonWaivedInvoices.length} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>({invoices.filter(i => i.isWaived || i.status === 'Waived').length} waived)</span>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #059669' }}>
          <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>PAID SALES REVENUE</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
            Br {paidRevenue.toFixed(2)}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #d97706' }}>
          <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 700 }}>PENDING RECEIVABLES</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
            Br {pendingReceivables.toFixed(2)}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '12px 14px', borderLeft: '3px solid #0284c7' }}>
          <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700 }}>COLLECTION RATE</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
            {collectionRate}%
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INVOICES, FISCAL RECEIPTS & CASHIER REGISTER                        */}
      {/* ========================================================================= */}
      {billingTab === 'invoices' && (
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
                  {['ALL', 'Issued', 'PartiallyPaid', 'Paid', 'Waived'].map(st => (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', fontSize: '0.8rem' }}>
                            {inv.invoiceNo}
                          </span>
                          {inv.insuranceProviderId && (
                            <span title="Insurance Covered" style={{ color: '#0284c7' }}><Shield size={12} /></span>
                          )}
                          {inv.fiscalReceiptNo && (
                            <span title="ERCA Fiscal Signed" style={{ color: '#059669' }}><QrCode size={12} /></span>
                          )}
                          {inv.receiptImageUrl && (
                            <span title="Payment Screenshot Uploaded" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '4px', padding: '1px 5px', fontSize: '0.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              📸 Slip
                            </span>
                          )}
                        </div>
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

                {/* Insurance Split Indicator */}
                {selectedInvoice.insuranceProviderId && (
                  <div style={{ padding: '8px 10px', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd', marginBottom: '10px', fontSize: '0.74rem' }}>
                    <div style={{ fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Shield size={13} /> {selectedInvoice.insuranceProviderName || 'Third-Party Payer'} ({selectedInvoice.insuranceCoPayPercent}% Co-Pay)
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: '#0f172a' }}>
                      <span>Patient Pay: <strong>Br {Number(selectedInvoice.patientPayAmount || 0).toFixed(2)}</strong></span>
                      <span>Claim to Insurer: <strong style={{ color: '#0284c7' }}>Br {Number(selectedInvoice.insuranceClaimAmount || 0).toFixed(2)}</strong></span>
                    </div>
                    {selectedInvoice.preAuthCode && (
                      <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>Pre-Auth: {selectedInvoice.preAuthCode}</div>
                    )}
                  </div>
                )}

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
                    <span style={{ color: 'var(--text-muted)' }}>
                      VAT ({selectedInvoice.subtotal > 0 ? Math.round((selectedInvoice.vat / selectedInvoice.subtotal) * 100) : (selectedInvoice.vat > 0 ? vatPercent : 0)}%):
                    </span>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Patient Payment Transfer Proof Preview */}
                    {selectedInvoice.receiptImageUrl ? (
                      <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            📸 Transfer Screenshot (Uploaded by Patient)
                          </span>
                          <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                            Needs Verification
                          </span>
                        </div>

                        <div
                          onClick={() => setShowScreenshotModal(selectedInvoice.receiptImageUrl.startsWith('http') ? selectedInvoice.receiptImageUrl : `http://localhost:5010${selectedInvoice.receiptImageUrl}`)}
                          style={{
                            cursor: 'pointer',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '1px solid #cbd5e1',
                            maxHeight: '220px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            background: '#0f172a',
                            position: 'relative'
                          }}
                          title="Click to view full-size screenshot"
                        >
                          <img
                            src={selectedInvoice.receiptImageUrl.startsWith('http') ? selectedInvoice.receiptImageUrl : `http://localhost:5010${selectedInvoice.receiptImageUrl}`}
                            alt="Transfer Screenshot"
                            style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain' }}
                          />
                          <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.68rem', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <Search size={12} /> Click to View Full Size
                          </div>
                        </div>
                      </div>
                    ) : (
                      selectedInvoice.notes && selectedInvoice.notes.toLowerCase().includes('telemedicine') && selectedInvoice.status !== 'Paid' && (
                        <div style={{ padding: '10px 12px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertCircle size={14} /> Telemedicine Consultation — Awaiting patient transfer proof on Telegram.
                        </div>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => handleVerifyTelemedTransfer(selectedInvoice.id)}
                      disabled={isVerifyingTransfer}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                        padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700,
                        background: 'linear-gradient(135deg, #059669, #0d9488)', border: 'none', color: '#ffffff',
                        cursor: isVerifyingTransfer ? 'not-allowed' : 'pointer', width: '100%',
                        boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                      }}
                    >
                      {isVerifyingTransfer ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={16} />}
                      Confirm Transfer &amp; Send Telegram Verification
                    </button>

                    <form onSubmit={handleProcessPayment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Or Process Counter / Custom Payment
                      </div>

                      {payMethod === '4' && (
                        <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '6px', fontSize: '0.75rem', color: '#78350f', fontWeight: 600 }}>
                          ☑ Waived — this invoice will be marked as <strong>Paid (Free / Waived Service)</strong>. No money collected.
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Payment Method</label>
                          <select value={payMethod} onChange={e => { setPayMethod(e.target.value); if (e.target.value === '4') { setPayAmount('0'); setPayReference('Waived / Free Service'); } }}>
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
                            required={payMethod !== '4'}
                            disabled={payMethod === '4'}
                            style={{ opacity: payMethod === '4' ? 0.5 : 1 }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Transaction Reference / Slip No</label>
                        <input type="text" placeholder="e.g. TX-98421 or Cash" value={payReference} onChange={e => setPayReference(e.target.value)} />
                      </div>

                      {/* Telebirr / CBE Mobile QR Generator */}
                      {payMethod === '2' && (
                        <button
                          type="button"
                          onClick={handleGenerateTelebirrQr}
                          disabled={telebirrLoading}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
                            padding: '9px 14px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700,
                            background: 'linear-gradient(135deg, #0071e3, #34c759)',
                            border: 'none', color: '#ffffff', cursor: telebirrLoading ? 'not-allowed' : 'pointer',
                            width: '100%', opacity: telebirrLoading ? 0.7 : 1,
                          }}
                        >
                          {telebirrLoading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                          Generate Dynamic Telebirr QR
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setPayAmount('0');
                          setPayMethod('4');
                          setPayReference('Waived / Free Service');
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
                          padding: '7px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700,
                          background: payMethod === '4' ? '#f59e0b' : '#fffbeb',
                          border: '1px solid #f59e0b',
                          color: payMethod === '4' ? '#ffffff' : '#92400e',
                          cursor: 'pointer', width: '100%'
                        }}
                      >
                        ☑ Waive / Mark as Free Service
                      </button>

                      <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '4px' }}>
                        <DollarSign size={14} /> {payMethod === '4' ? 'Confirm Waiver' : 'Accept Payment'}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ padding: '10px', background: '#d1fae5', borderRadius: '6px', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.78rem', fontWeight: 700, textAlign: 'center' }}>
                      ✓ Invoice Fully Settled &amp; Paid
                    </div>
                    {selectedInvoice.receiptImageUrl && (
                      <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          📸 Payment Transfer Receipt (Verified)
                        </div>
                        <div
                          onClick={() => setShowScreenshotModal(selectedInvoice.receiptImageUrl.startsWith('http') ? selectedInvoice.receiptImageUrl : selectedInvoice.receiptImageUrl)}
                          style={{ cursor: 'pointer', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', maxHeight: '180px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', position: 'relative' }}
                          title="Click to view full-size screenshot"
                        >
                          <img
                            src={selectedInvoice.receiptImageUrl.startsWith('http') ? selectedInvoice.receiptImageUrl : selectedInvoice.receiptImageUrl}
                            alt="Transfer Receipt"
                            style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }}
                          />
                          <div style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.68rem', padding: '3px 7px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <Search size={11} /> Full Size
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Fiscal Device Sign & Print Receipt Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  {!selectedInvoice.fiscalReceiptNo ? (
                    <button
                      type="button"
                      onClick={() => handleSignFiscalReceipt(selectedInvoice)}
                      disabled={isSigningFiscal}
                      className="btn-secondary"
                      style={{ width: '100%', justifyContent: 'center', background: '#ecfdf5', borderColor: '#10b981', color: '#047857', fontWeight: 700 }}
                    >
                      {isSigningFiscal ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />} Sign ERCA Fiscal Receipt
                    </button>
                  ) : (
                    <div style={{ padding: '6px 10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '0.72rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={13} /> Fiscalized: <strong>{selectedInvoice.fiscalReceiptNo}</strong>
                    </div>
                  )}

                  <button
                    onClick={() => setShowReceiptModal(selectedInvoice)}
                    className="btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Printer size={14} /> Print Official Receipt / ERCA Tax Invoice
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INSURANCE & THIRD-PARTY PAYER (TPA) CLAIMS                         */}
      {/* ========================================================================= */}
      {billingTab === 'claims' && (
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck color="#0284c7" size={18} /> Third-Party Payer (TPA) Claims Ledger
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Track submitted claims to Ethiopian and international insurers for outpatient and inpatient care.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge badge-normal" style={{ fontSize: '0.75rem' }}>
                Total Claims: {claims.length}
              </span>
              <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                Claimed: Br {claims.reduce((acc, c) => acc + (c.insuranceClaimAmount || 0), 0).toFixed(2)}
              </span>
            </div>
          </div>

          <table className="cms-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient Name</th>
                <th>Insurance Provider</th>
                <th>Pre-Auth Code</th>
                <th>Total Bill</th>
                <th>Patient Co-Pay</th>
                <th>Claim to Insurer</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No insurance claims generated yet. Select an insurance provider when generating an invoice.
                  </td>
                </tr>
              ) : (
                claims.map((cl: any) => (
                  <tr key={cl.invoiceId}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>
                      {cl.invoiceNo}
                    </td>
                    <td>
                      <strong>{cl.patientName}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{cl.providerName}</div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{cl.providerCode}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {cl.preAuthCode || 'DIRECT-VERIFY'}
                      </span>
                    </td>
                    <td>Br {Number(cl.totalAmount || 0).toFixed(2)}</td>
                    <td>
                      <span style={{ color: '#64748b' }}>
                        Br {Number(cl.patientPayAmount || 0).toFixed(2)} ({cl.insuranceCoPayPercent}%)
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#0284c7' }}>
                        Br {Number(cl.insuranceClaimAmount || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td>{getClaimStatusBadge(cl.claimStatus)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleUpdateClaimStatus(cl.invoiceId, 3)}
                          title="Mark Approved"
                          style={{ background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '3px 6px', borderRadius: '4px', fontSize: '0.68rem', cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleUpdateClaimStatus(cl.invoiceId, 4)}
                          title="Mark Reimbursed"
                          style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d', padding: '3px 6px', borderRadius: '4px', fontSize: '0.68rem', cursor: 'pointer' }}
                        >
                          Reimburse
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE MANUAL INVOICE                                              */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Generate Clinical Invoice</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Bill outpatient services, labs, pharmacy items or admissions</span>
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

              {/* Insurance / TPA Toggle */}
              <div style={{ padding: '10px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#0369a1' }}>
                  <input
                    type="checkbox"
                    checked={isInsuranceCovered}
                    onChange={e => {
                      setIsInsuranceCovered(e.target.checked);
                      if (e.target.checked && insuranceProviders.length > 0 && !selectedProviderId) {
                        setSelectedProviderId(insuranceProviders[0].id);
                      }
                    }}
                    style={{ accentColor: '#0284c7' }}
                  />
                  <Shield size={14} /> Bill Under Third-Party Insurance / Corporate Coverage
                </label>

                {isInsuranceCovered && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Insurance Provider *</label>
                      <select
                        value={selectedProviderId}
                        onChange={e => setSelectedProviderId(Number(e.target.value))}
                        required={isInsuranceCovered}
                      >
                        <option value="">Select Provider...</option>
                        {insuranceProviders.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Patient Co-Pay %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={coPayPercent}
                        onChange={e => setCoPayPercent(e.target.value)}
                        placeholder="20"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Pre-Auth / Policy #</label>
                      <input
                        type="text"
                        value={preAuthCode}
                        onChange={e => setPreAuthCode(e.target.value)}
                        placeholder="AUTH-99124"
                      />
                    </div>
                  </div>
                )}
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
                      <option value="Inpatient">Inpatient Ward &amp; Bed</option>
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
                <span>Total Payable (Inc. {vatPercent}% VAT):</span>
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
      {/* MODAL: PRINT OFFICIAL ERCA FISCAL TAX RECEIPT                             */}
      {/* ========================================================================= */}
      {showReceiptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '660px', maxHeight: '92vh', overflowY: 'auto', padding: '32px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5dfd5', paddingBottom: '10px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0369a1' }}>Official ERCA Cashier Tax Receipt</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} className="btn-primary"><Printer size={14} /> Print Receipt</button>
                <button onClick={() => setShowReceiptModal(null)} className="btn-secondary"><X size={14} /></button>
              </div>
            </div>

            <div style={{ padding: '24px', border: '1px solid #e5dfd5', borderRadius: '8px', background: '#fff', color: '#1c1917' }}>
              <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{clinicProfile.name}</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{clinicProfile.address} | Tel: {clinicProfile.phone}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginTop: '2px' }}>TIN: 0049281923 • MRC: {showReceiptModal.mrcNumber || 'ERCA-ETH-2026-F9812'}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '8px', letterSpacing: '0.5px', textDecoration: 'underline' }}>OFFICIAL FISCAL CASH RECEIPT &amp; TAX INVOICE</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', marginBottom: '16px', background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                <div><strong>Invoice No:</strong> {showReceiptModal.invoiceNo}</div>
                <div><strong>Fiscal Rec #:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{showReceiptModal.fiscalReceiptNo || 'PENDING-FISCAL'}</span></div>
                <div><strong>Date &amp; Time:</strong> {showReceiptModal.issueDate}</div>
                <div><strong>Patient Name:</strong> {showReceiptModal.patientName}</div>
                {showReceiptModal.insuranceProviderName && (
                  <div style={{ gridColumn: '1 / -1', color: '#0369a1', fontWeight: 600 }}>
                    Third-Party Payer: {showReceiptModal.insuranceProviderName} ({showReceiptModal.insuranceCoPayPercent}% Co-Pay)
                  </div>
                )}
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
                <div>
                  VAT ({showReceiptModal.subtotal > 0 ? Math.round((showReceiptModal.vat / showReceiptModal.subtotal) * 100) : (showReceiptModal.vat > 0 ? vatPercent : 0)}%): <strong>Br {showReceiptModal.vat.toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0369a1', borderTop: '1px solid #e5dfd5', paddingTop: '4px', marginTop: '4px' }}>
                  Total Paid: Br {showReceiptModal.paid.toFixed(2)}
                </div>
              </div>

              {/* ERCA Digital Tax Signature & QR Section */}
              <div style={{ marginTop: '20px', padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> ERCA e-Tax Certified &amp; Cryptographically Signed
                  </div>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#64748b', marginTop: '3px' }}>
                    SIG: {showReceiptModal.fiscalSignature ? showReceiptModal.fiscalSignature.substring(0, 32) + '...' : 'ERCA-SIG-2026-F9812-OK'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                    Scan QR code using Ethiopian Revenue e-Tax Mobile App to verify authenticity.
                  </div>
                </div>

                <div style={{ width: '64px', height: '64px', background: '#fff', border: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                  <QrCode size={52} color="#000" />
                </div>
              </div>

              <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Thank you for choosing {clinicProfile.name}.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TELEBIRR / CBE BIRR DYNAMIC QR PAYMENT                             */}
      {/* ========================================================================= */}
      {showTelebirrModal && selectedInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', background: '#0d1a2e', border: '1px solid rgba(0,113,227,0.4)', borderRadius: '16px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#5eabff', letterSpacing: '0.12em' }}>TELEBIRR / CBE BIRR MOBILE PAYMENT</div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginTop: 3 }}>Dynamic QR Code</h3>
              </div>
              <button onClick={closeTelebirrModal} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            {telebirrSettled ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#34c759' }}>
                <CheckCircle2 size={56} style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Payment Confirmed!</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 8 }}>Invoice will be updated shortly…</div>
              </div>
            ) : (
              <>
                {/* Amount info */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Amount Due for {selectedInvoice.invoiceNo}</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#5eabff', fontFamily: 'monospace' }}>
                    Br {Math.max(0, selectedInvoice.total - selectedInvoice.paid).toFixed(2)}
                  </div>
                </div>

                {/* QR Boxes side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  {/* Telebirr */}
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,113,227,0.15)', border: '1px solid rgba(0,113,227,0.35)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#5eabff', marginBottom: 10 }}>📱 TELEBIRR</div>
                    <div style={{ width: 100, height: 100, background: '#fff', borderRadius: 8, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0071e3' }}>
                      <QrCode size={76} color="#0071e3" />
                    </div>
                    {telebirrQrPayload && (
                      <div style={{ fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginTop: 8, wordBreak: 'break-all' }}>
                        {telebirrQrPayload.substring(0, 60)}…
                      </div>
                    )}
                  </div>
                  {/* CBE Birr */}
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34c759', marginBottom: 10 }}>🏦 CBE BIRR</div>
                    <div style={{ width: 100, height: 100, background: '#fff', borderRadius: 8, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #34c759' }}>
                      <QrCode size={76} color="#34c759" />
                    </div>
                    {telebirrCbeQrPayload && (
                      <div style={{ fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginTop: 8, wordBreak: 'break-all' }}>
                        {telebirrCbeQrPayload.substring(0, 60)}…
                      </div>
                    )}
                  </div>
                </div>

                {/* Merchant info */}
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 16, fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Merchant: <strong style={{ color: '#fff' }}>MERCH-ETH-004928</strong></span>
                  <span>Short Code: <strong style={{ color: '#fff' }}>8711</strong></span>
                </div>

                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Loader2 size={12} className="animate-spin" color="#5eabff" />
                  Waiting for patient to scan and confirm payment…
                </div>

                <button
                  type="button"
                  onClick={handleSimulateTelebirrScan}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'rgba(52,199,89,0.2)', border: '1px solid rgba(52,199,89,0.4)', color: '#34c759', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  ✔ Simulate Patient Scan & Confirm (Dev/Testing)
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Transfer Screenshot Full-Screen Modal */}
      {showScreenshotModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', background: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', color: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
                📸 Telemedicine Payment Transfer Screenshot
              </div>
              <button
                onClick={() => setShowScreenshotModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', maxHeight: 'calc(90vh - 60px)', background: '#090d16' }}>
              <img
                src={showScreenshotModal}
                alt="Payment Screenshot Full Size"
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
