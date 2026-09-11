import React, { useState, useEffect } from 'react';
import { Pill, CheckCircle, Package, AlertTriangle, Plus, RefreshCw, X, Search, Edit3, DollarSign, TrendingUp, ShieldAlert, FileText, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient';

export default function PharmacyPage() {
  const [activeSubTab, setActiveSubTab] = useState<'prescriptions' | 'inventory' | 'narcotics' | 'restock'>('prescriptions');
  const [loading, setLoading] = useState(true);

  // Formulary Inventory State with FEFO Expiry & Controlled Status
  const [drugs, setDrugs] = useState<any[]>([]);

  // Prescriptions Queue State
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  // Narcotics Serialized Logbook State
  const [narcoticLogs, setNarcoticLogs] = useState<any[]>([
    { id: 1, serialNo: 'NARCO-LOG-2026-0042', drug: 'Morphine Sulphate 10mg/ml Ampule', patient: 'Haile Gebrselassie', doctor: 'Dr. Abebe Bekele', pharmacist: 'Pharmacist Worku', qty: 1, date: '2026-08-31 10:15 AM' }
  ]);

  // Add Drug Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [genericName, setGenericName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [form, setForm] = useState('Tablet');
  const [strength, setStrength] = useState('');
  const [initialStock, setInitialStock] = useState('100');
  const [minStock, setMinStock] = useState('50');
  const [costPrice, setCostPrice] = useState('10.0');
  const [sellingPrice, setSellingPrice] = useState('15.0');
  const [batchNo, setBatchNo] = useState('BATCH-2026-NEW');
  const [isControlled, setIsControlled] = useState(false);

  // Restock Pricing Modal State
  const [showRestockModal, setShowRestockModal] = useState<any>(null);
  const [restockQty, setRestockQty] = useState('100');
  const [restockCost, setRestockCost] = useState('10.0');
  const [restockSelling, setRestockSelling] = useState('15.0');
  const [restockBatch, setRestockBatch] = useState('BATCH-2026-RESTOCK');
  const [restockExpiry, setRestockExpiry] = useState('2028-12-31');

  // Direct Order (OTC) Modal State
  const [showDirectOrderModal, setShowDirectOrderModal] = useState(false);
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [doPatientId, setDoPatientId] = useState('');
  const [doPatientName, setDoPatientName] = useState('');
  const [doSelectedDrug, setDoSelectedDrug] = useState<any>(null);
  const [doQty, setDoQty] = useState('1');
  const [doSubmitting, setDoSubmitting] = useState(false);

  const loadPharmacyData = async () => {
    try {
      setLoading(true);
      const [formularyData, prescriptionsData, allPatients] = await Promise.all([
        api.get<any[]>('/pharmacy/formulary').catch(() => []),
        api.get<any[]>('/pharmacy/prescriptions').catch(() => []),
        api.get<any[]>('/patients').catch(() => [])
      ]);

      if (allPatients && Array.isArray(allPatients)) {
        setPatientsList(allPatients);
      }

      if (formularyData && formularyData.length > 0) {
        const mappedDrugs = formularyData.map((d: any) => ({
          id: d.id || d.Id,
          code: d.drugCode || d.DrugCode || `DRUG-00${d.id || d.Id}`,
          generic: d.genericName || d.GenericName,
          brand: d.brandName || d.BrandName || d.genericName || d.GenericName,
          form: d.dosageForm || d.DosageForm || 'Tablet',
          strength: d.strength || d.Strength || '',
          stock: d.currentStock || d.CurrentStock || 0,
          minStock: d.minStockLevel || d.MinStockLevel || 20,
          costPrice: d.costPrice || d.CostPrice || 10.0,
          sellingPrice: d.sellingPrice || d.SellingPrice || d.unitPrice || d.UnitPrice || 15.0,
          batchNo: d.batchNumber || d.BatchNumber || 'BATCH-2026-A',
          expiryDate: d.expiryDate ? String(d.expiryDate).split('T')[0] : '2028-12-31',
          isControlled: Boolean(d.isControlled || d.IsControlled)
        }));
        setDrugs(mappedDrugs);
      } else {
        setDrugs([
          { id: 1, code: 'AMOX500', generic: 'Amoxicillin', brand: 'Amoxil', form: 'Capsule', strength: '500mg', stock: 200, minStock: 20, costPrice: 8.5, sellingPrice: 15.0, batchNo: 'BATCH-A-001', expiryDate: '2027-06-30', isControlled: false },
          { id: 2, code: 'PARA500', generic: 'Paracetamol', brand: 'Panadol', form: 'Tablet', strength: '500mg', stock: 500, minStock: 50, costPrice: 2.0, sellingPrice: 5.0, batchNo: 'BATCH-P-001', expiryDate: '2027-12-31', isControlled: false },
          { id: 3, code: 'MORPH10', generic: 'Morphine Sulphate', brand: 'MST', form: 'Injection', strength: '10mg/ml', stock: 30, minStock: 5, costPrice: 80.0, sellingPrice: 120.0, batchNo: 'BATCH-MO-001', expiryDate: '2027-01-31', isControlled: true }
        ]);
      }

      if (prescriptionsData && prescriptionsData.length > 0) {
        const mappedPrescriptions = prescriptionsData.map((p: any) => {
          const firstItem = (p.items && p.items[0]) || { drugName: 'Medication', quantity: 10, id: p.id };
          return {
            id: p.id || p.Id,
            itemId: firstItem.id || p.id,
            patientName: p.patientName || p.PatientName || `Patient #${p.patientId}`,
            mrn: p.mrn || p.Mrn || `MRN-000${p.patientId || 101}`,
            doctorName: p.doctorName || p.DoctorName || 'Dr. Attending',
            date: p.prescribedAt ? String(p.prescribedAt).split('T')[0] : '2026-08-31',
            drug: `${firstItem.drugName || 'Medication'} ${firstItem.dosage || ''}`.trim(),
            qty: firstItem.quantity || 10,
            status: p.statusId === 2 ? 'Dispensed' : 'Pending',
            isPaid: p.isPaid || p.IsPaid || false,
            isControlled: (firstItem.drugName || '').toLowerCase().includes('morphine') || (firstItem.drugName || '').toLowerCase().includes('tramadol')
          };
        });
        setPrescriptions(mappedPrescriptions);
      } else {
        setPrescriptions([
          { id: 201, itemId: 201, patientName: 'Abebe Bikila', mrn: 'MRN-000101', doctorName: 'Dr. Abebe Bekele', date: '2026-08-31', drug: 'Paracetamol 500mg', qty: 20, status: 'Pending', isControlled: false },
          { id: 202, itemId: 202, patientName: 'Tigist Assefa', mrn: 'MRN-000102', doctorName: 'Dr. Tigist Haile', date: '2026-08-31', drug: 'Amoxicillin 500mg', qty: 15, status: 'Dispensed', isControlled: false },
          { id: 203, itemId: 203, patientName: 'Haile Gebrselassie', mrn: 'MRN-000103', doctorName: 'Dr. Abebe Bekele', date: '2026-08-31', drug: 'Morphine Sulphate 10mg/ml', qty: 1, status: 'Pending', isControlled: true }
        ]);
      }
    } catch (err) {
      console.error('Failed to load pharmacy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPharmacyData();
  }, []);

  const handleDispense = async (pItem: any) => {
    try {
      await api.post('/pharmacy/dispense', {
        prescriptionId: pItem.id,
        itemId: pItem.itemId || pItem.id,
        dispensedBy: 1,
        batchNumber: 'BATCH-2026-A'
      });
    } catch (err) {
      console.error('Dispense API error:', err);
    }

    setPrescriptions(prescriptions.map(p => p.id === pItem.id ? { ...p, status: 'Dispensed' } : p));
    setDrugs(drugs.map(d => {
      if (pItem.drug.toLowerCase().includes(d.generic.toLowerCase())) {
        return { ...d, stock: Math.max(0, d.stock - pItem.qty) };
      }
      return d;
    }));

    if (pItem.isControlled) {
      const newLog = {
        id: narcoticLogs.length + 1,
        serialNo: `NARCO-LOG-2026-00${narcoticLogs.length + 43}`,
        drug: pItem.drug,
        patient: pItem.patientName,
        doctor: pItem.doctorName,
        pharmacist: 'Pharmacist Worku',
        qty: pItem.qty,
        date: new Date().toLocaleString()
      };
      setNarcoticLogs([newLog, ...narcoticLogs]);
    }
  };

  const handleOpenRestockModal = (drug: any) => {
    setShowRestockModal(drug);
    setRestockCost(drug.costPrice.toString());
    setRestockSelling(drug.sellingPrice.toString());
    setRestockBatch(`BATCH-2026-${Math.floor(100 + Math.random() * 900)}`);
  };

  const handleAddDrugSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = drugs.length + 1;
    const newD = {
      id: newId,
      code: `DRUG-00${newId}`,
      generic: genericName,
      brand: brandName || genericName,
      form,
      strength,
      stock: parseInt(initialStock) || 0,
      minStock: parseInt(minStock) || 20,
      costPrice: parseFloat(costPrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      batchNo,
      expiryDate: '2028-12-31',
      isControlled
    };
    setDrugs([...drugs, newD]);
    setShowAddModal(false);
    setGenericName(''); setBrandName(''); setStrength('');
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRestockModal) return;
    const qty = parseInt(restockQty) || 0;
    const cPrice = parseFloat(restockCost) || showRestockModal.costPrice;
    const sPrice = parseFloat(restockSelling) || showRestockModal.sellingPrice;

    try {
      await api.post('/pharmacy/restock', {
        drugId: showRestockModal.id,
        quantityAdded: qty,
        unitCostPrice: cPrice,
        unitSellingPrice: sPrice,
        batchNumber: restockBatch,
        expiryDate: restockExpiry,
        supplierName: 'National Pharmaceuticals'
      });
    } catch (err) {
      console.error('Restock API error:', err);
    }

    setDrugs(drugs.map(d => d.id === showRestockModal.id ? {
      ...d,
      stock: d.stock + qty,
      costPrice: cPrice,
      sellingPrice: sPrice,
      batchNo: restockBatch,
      expiryDate: restockExpiry
    } : d));

    setShowRestockModal(null);
    setRestockQty('100');
  };

  const lowStockCount = drugs.filter(d => d.stock <= d.minStock).length;

  const handleDirectOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doSelectedDrug || !doPatientId) return;
    setDoSubmitting(true);
    const qty = parseInt(doQty) || 1;
    const unitPrice = doSelectedDrug.sellingPrice || 0;
    const vatPct = 15;
    const subtotal = qty * unitPrice;
    const vatAmt = subtotal * (vatPct / 100);
    const total = subtotal + vatAmt;
    try {
      await api.post('/billing/invoices', {
        patientId: parseInt(doPatientId),
        issueDate: new Date().toISOString().split('T')[0],
        items: [{
          itemType: 'Medication',
          itemName: `${doSelectedDrug.generic} ${doSelectedDrug.strength || ''}`.trim(),
          quantity: qty,
          unitPrice,
          discount: 0
        }],
        subtotal,
        vatAmount: vatAmt,
        totalAmount: total,
        notes: `OTC Direct Order — ${doPatientName || 'Walk-in Patient'}`
      });
      alert(`Direct order invoiced: ${doSelectedDrug.generic} x${qty} = Br ${total.toFixed(2)} (incl. VAT)`);
      setShowDirectOrderModal(false);
      setDoPatientId(''); setDoPatientName(''); setDoSelectedDrug(null); setDoQty('1');
    } catch (err) {
      console.error('Direct order failed:', err);
      alert('Failed to create invoice. Please try again.');
    } finally {
      setDoSubmitting(false);
    }
  };


  return (
    <div>
      {/* Top Banner & Sub Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setActiveSubTab('prescriptions')} className={activeSubTab === 'prescriptions' ? 'btn-primary' : 'btn-secondary'}>
            <Pill size={16} /> Dispensary Queue ({prescriptions.filter(p => p.status === 'Pending').length})
          </button>
          <button onClick={() => setActiveSubTab('inventory')} className={activeSubTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}>
            <Package size={16} /> Inventory & FEFO Expiry ({drugs.length})
            {lowStockCount > 0 && <span className="badge badge-critical" style={{ marginLeft: '6px' }}>{lowStockCount} Low</span>}
          </button>
          <button onClick={() => setActiveSubTab('narcotics')} className={activeSubTab === 'narcotics' ? 'btn-primary' : 'btn-secondary'}>
            <ShieldAlert size={16} /> Narcotics Logbook ({narcoticLogs.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeSubTab === 'inventory' && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              <Plus size={16} /> Add New Drug Item
            </button>
          )}
          {activeSubTab === 'prescriptions' && (
            <button onClick={() => setShowDirectOrderModal(true)} className="btn-primary" style={{ background: '#059669', borderColor: '#059669' }}>
              <Plus size={16} /> New Direct Order (OTC)
            </button>
          )}
        </div>
      </div>


      {/* SUB TAB 1: FEFO Prescriptions Queue */}
      {activeSubTab === 'prescriptions' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Pill color="#06b6d4" size={18} /> Dispensary Requisition Worklist (First Expired, First Out Priority)
            </h3>
            {loading && <Loader2 size={16} className="animate-spin" color="#06b6d4" />}
          </div>
          <table className="cms-table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>MRN</th>
                <th>Prescribing Doctor</th>
                <th>Medication</th>
                <th>Quantity</th>
                <th>Payment</th>
                <th>Substance Class</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.patientName}</td>
                  <td style={{ fontFamily: 'monospace', color: '#06b6d4' }}>{p.mrn}</td>
                  <td>{p.doctorName}</td>
                  <td>{p.drug}</td>
                  <td style={{ fontWeight: 700 }}>{p.qty}</td>
                  <td>
                    {p.isPaid ? (
                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#d1fae5', color: '#065f46', fontSize: '0.72rem', fontWeight: 700 }}>✓ Paid — Ready</span>
                    ) : (
                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#fef9c3', color: '#92400e', fontSize: '0.72rem', fontWeight: 700 }}>⏳ Awaiting Payment</span>
                    )}
                  </td>
                  <td>
                    {p.isControlled ? (
                      <span className="badge badge-critical">Controlled (Rx Only)</span>
                    ) : (
                      <span className="badge badge-normal">Standard</span>
                    )}
                  </td>
                  <td>
                    <span className={p.status === 'Dispensed' ? 'badge badge-normal' : 'badge badge-warning'}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    {p.status === 'Pending' ? (
                      p.isPaid ? (
                        <button onClick={() => handleDispense(p)} className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                          Dispense Drug
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#92400e', fontStyle: 'italic' }}>Awaiting payment at cashier</span>
                      )
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#34d399' }}><CheckCircle size={14} /> Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB TAB 2: Inventory & FEFO Expiry */}
      {activeSubTab === 'inventory' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package color="#10b981" size={18} /> Pharmacy Inventory, FEFO Expiry Tracking & Pricing
            </h3>
            {loading && <Loader2 size={16} className="animate-spin" color="#06b6d4" />}
          </div>

          <table className="cms-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Generic Name (Brand)</th>
                <th>Batch #</th>
                <th>Expiry Date (FEFO)</th>
                <th>Current Stock</th>
                <th>Unit Cost</th>
                <th>Selling Price</th>
                <th>Control</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {drugs.map(d => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'monospace', color: '#06b6d4', fontWeight: 700 }}>{d.code}</td>
                  <td style={{ fontWeight: 600 }}>
                    {d.generic} <small style={{ color: 'var(--text-muted)' }}>({d.brand})</small>
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{d.batchNo}</td>
                  <td style={{ fontWeight: 600, color: '#fbbf24' }}>{d.expiryDate}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: d.stock <= d.minStock ? '#f87171' : '#34d399' }}>
                      {d.stock} units
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>Br {Number(d.costPrice).toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: '#38bdf8' }}>Br {Number(d.sellingPrice).toFixed(2)}</td>
                  <td>
                    {d.isControlled ? (
                      <span className="badge badge-critical">Controlled</span>
                    ) : (
                      <span className="badge badge-normal">Standard</span>
                    )}
                  </td>
                  <td>
                    <button onClick={() => handleOpenRestockModal(d)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                      + Restock & FEFO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB TAB 3: Narcotics Audit Logbook */}
      {activeSubTab === 'narcotics' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f87171', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={20} /> Serialized Controlled Substances & Narcotics Register
          </h3>
          <table className="cms-table">
            <thead>
              <tr>
                <th>Serial Log #</th>
                <th>Controlled Substance</th>
                <th>Patient Name</th>
                <th>Prescribing Doctor</th>
                <th>Dispensing Pharmacist</th>
                <th>Quantity</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {narcoticLogs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontFamily: 'monospace', color: '#f87171', fontWeight: 700 }}>{l.serialNo}</td>
                  <td style={{ fontWeight: 600 }}>{l.drug}</td>
                  <td>{l.patient}</td>
                  <td>{l.doctor}</td>
                  <td>{l.pharmacist}</td>
                  <td style={{ fontWeight: 700 }}>{l.qty}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{l.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add New Drug Item */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '520px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Add Medication to Formulary</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleAddDrugSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Generic Name</label>
                  <input type="text" value={genericName} onChange={e => setGenericName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Brand Name</label>
                  <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dosage Form</label>
                  <select value={form} onChange={e => setForm(e.target.value)}>
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Inhaler">Inhaler</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Strength</label>
                  <input type="text" value={strength} onChange={e => setStrength(e.target.value)} placeholder="e.g. 500mg" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unit Cost Price (Br)</label>
                  <input type="number" step="0.1" value={costPrice} onChange={e => setCostPrice(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unit Selling Price (Br)</label>
                  <input type="number" step="0.1" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="controlled" checked={isControlled} onChange={e => setIsControlled(e.target.checked)} />
                <label htmlFor="controlled" style={{ fontSize: '0.85rem', color: '#f87171' }}>Controlled Substance / Narcotic (Requires audit logbook)</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add to Formulary</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Restock & FEFO Expiry Update */}
      {showRestockModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Restock & FEFO Batch Pricing</h3>
              <button onClick={() => setShowRestockModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#06b6d4', marginBottom: '16px', fontWeight: 600 }}>
              {showRestockModal.generic} ({showRestockModal.strength})
            </p>

            <form onSubmit={handleRestockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quantity Received (Units)</label>
                <input type="number" value={restockQty} onChange={e => setRestockQty(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Updated Cost Price</label>
                  <input type="number" step="0.1" value={restockCost} onChange={e => setRestockCost(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Updated Selling Price</label>
                  <input type="number" step="0.1" value={restockSelling} onChange={e => setRestockSelling(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Batch / Lot Number</label>
                  <input type="text" value={restockBatch} onChange={e => setRestockBatch(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FEFO Expiry Date</label>
                  <input type="date" value={restockExpiry} onChange={e => setRestockExpiry(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowRestockModal(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Apply Restock & Batch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Direct Order (OTC Medication Sale) */}
      {showDirectOrderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '520px', padding: '28px', background: '#ffffff', color: '#1c1917' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                <Plus size={18} color="#059669" /> New Direct Dispensary Order (OTC)
              </h3>
              <button onClick={() => setShowDirectOrderModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleDirectOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Patient Name</label>
                  <input
                    type="text"
                    value={doPatientName}
                    onChange={e => setDoPatientName(e.target.value)}
                    placeholder="e.g. Abebe Bekele"
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>MRN / Patient ID (Optional)</label>
                  <input
                    type="text"
                    value={doPatientId}
                    onChange={e => setDoPatientId(e.target.value)}
                    placeholder="e.g. MRN-00123 or leave blank"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Select Medication (from Formulary Inventory)</label>
                <select
                  value={doSelectedDrug ? doSelectedDrug.id : ''}
                  onChange={e => {
                    const d = drugs.find(dr => String(dr.id) === e.target.value);
                    setDoSelectedDrug(d || null);
                  }}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  <option value="">-- Choose Drug --</option>
                  {drugs.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.generic} {d.strength} ({d.form}) — In Stock: {d.stock} — Br {d.sellingPrice?.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Dispense Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max={doSelectedDrug ? doSelectedDrug.stock : 999}
                    value={doQty}
                    onChange={e => setDoQty(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Unit Selling Price</label>
                  <input
                    type="text"
                    readOnly
                    value={doSelectedDrug ? `Br ${doSelectedDrug.sellingPrice?.toFixed(2)}` : '—'}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#64748b' }}
                  />
                </div>
              </div>

              {doSelectedDrug && (
                <div style={{ padding: '12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span>
                    <strong>Br {((parseInt(doQty) || 1) * (doSelectedDrug.sellingPrice || 0)).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Estimated VAT (15%):</span>
                    <span>Br {(((parseInt(doQty) || 1) * (doSelectedDrug.sellingPrice || 0)) * 0.15).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '4px', color: '#0369a1', fontSize: '0.9rem' }}>
                    <span>Total Invoiced:</span>
                    <strong>Br {(((parseInt(doQty) || 1) * (doSelectedDrug.sellingPrice || 0)) * 1.15).toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" onClick={() => setShowDirectOrderModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={doSubmitting || !doSelectedDrug || !doPatientId}
                  className="btn-primary"
                  style={{ background: '#059669', borderColor: '#059669' }}
                >
                  {doSubmitting ? 'Invoicing...' : 'Create Invoice & Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
