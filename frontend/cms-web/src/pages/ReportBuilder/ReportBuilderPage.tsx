import React, { useState } from 'react';
import { FileSpreadsheet, Play, Download, Save, Filter, Layers, Database, Check } from 'lucide-react';
import { usePersistentState } from '../../utils/usePersistentState';

export default function ReportBuilderPage() {
  const [selectedSource, setSelectedSource] = useState('Patients');
  const [selectedCols, setSelectedCols] = useState<string[]>(['MRN', 'FirstName', 'LastName', 'PrimaryPhone', 'InsuranceProvider']);

  const [savedTemplates, setSavedTemplates] = usePersistentState('custom_report_templates', [
    { id: 1, name: 'Active Patients & Insurance Summary', source: 'Patients', cols: ['MRN', 'FirstName', 'LastName', 'InsuranceProvider'] },
    { id: 2, name: 'Monthly Financial Invoice Audit', source: 'Invoices', cols: ['InvoiceNo', 'PatientName', 'Total', 'Status'] }
  ]);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [exportedAlert, setExportedAlert] = useState<string | null>(null);

  const sampleData: Record<string, any[]> = {
    Patients: [
      { MRN: 'MRN-000101', FirstName: 'Abebe', LastName: 'Bikila', PrimaryPhone: '+251911223344', InsuranceProvider: 'Nyala Insurance', Gender: 'Male', DateOfBirth: '1985-05-12' },
      { MRN: 'MRN-000102', FirstName: 'Tigist', LastName: 'Assefa', PrimaryPhone: '+251922334455', InsuranceProvider: 'Medhin Care', Gender: 'Female', DateOfBirth: '1992-09-24' },
      { MRN: 'MRN-000103', FirstName: 'Haile', LastName: 'Gebrselassie', PrimaryPhone: '+251933445566', InsuranceProvider: 'Self-Pay', Gender: 'Male', DateOfBirth: '1973-04-18' }
    ],
    Appointments: [
      { AppointmentId: 'APT-001', Doctor: 'Dr. Selamawit T.', Patient: 'Abebe Bikila', Date: '2026-08-31', Time: '09:00 AM', Status: 'Confirmed' },
      { AppointmentId: 'APT-002', Doctor: 'Dr. Yonas K.', Patient: 'Tigist Assefa', Date: '2026-08-31', Time: '10:00 AM', Status: 'CheckedIn' }
    ],
    LabOrders: [
      { OrderNo: 'LAB-1-000042', Patient: 'Haile Gebrselassie', Test: 'CBC Profile', Barcode: 'BC-894210', Status: 'Resulted' },
      { OrderNo: 'LAB-1-000043', Patient: 'Abebe Bikila', Test: 'Serum Potassium', Barcode: 'BC-894211', Status: 'Processing' }
    ],
    Invoices: [
      { InvoiceNo: 'INV-1-20260831001', Patient: 'Abebe Bikila', Subtotal: 'Br 800.00', VAT: 'Br 120.00', Total: 'Br 920.00', Status: 'Paid' },
      { InvoiceNo: 'INV-1-20260831002', Patient: 'Tigist Assefa', Subtotal: 'Br 450.00', VAT: 'Br 67.50', Total: 'Br 517.50', Status: 'PartiallyPaid' }
    ]
  };

  const currentRows = sampleData[selectedSource] || sampleData['Patients'];

  const triggerExport = (format: string) => {
    setExportedAlert(`Report exported as ${format} successfully!`);
    setTimeout(() => setExportedAlert(null), 3000);
  };

  const handleSaveTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName) return;
    const newT = {
      id: savedTemplates.length + 1,
      name: templateName,
      source: selectedSource,
      cols: selectedCols
    };
    setSavedTemplates([...savedTemplates, newT]);
    setShowSaveModal(false);
    setTemplateName('');
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSpreadsheet color="#06b6d4" size={20} /> Custom Drag-and-Drop Report Designer
        </h3>
        {exportedAlert && <span className="badge badge-normal"><Check size={12} /> {exportedAlert}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        {/* Left Query Config Controls */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Select Data Source</label>
          <select value={selectedSource} onChange={e => { setSelectedSource(e.target.value); setSelectedCols(Object.keys(sampleData[e.target.value][0])); }} style={{ marginBottom: '20px' }}>
            <option value="Patients">Patients Registry</option>
            <option value="Appointments">Appointments Schedule</option>
            <option value="LabOrders">Lab Orders & Results</option>
            <option value="Invoices">Invoices & Billing</option>
          </select>

          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Select Output Columns</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {Object.keys(sampleData[selectedSource][0]).map(col => (
              <label key={col} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedCols.includes(col)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedCols([...selectedCols, col]);
                    else setSelectedCols(selectedCols.filter(c => c !== col));
                  }}
                />
                {col}
              </label>
            ))}
          </div>

          <button onClick={() => triggerExport('PDF')} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '10px' }}>
            <Play size={16} /> Execute Query
          </button>
          <button onClick={() => setShowSaveModal(true)} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            <Save size={16} /> Save Custom Template
          </button>
        </div>

        {/* Right Output Table Preview */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '1rem', color: '#06b6d4' }}>Report Live Preview ({currentRows.length} rows returned)</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => triggerExport('PDF')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}><Download size={14} /> Export PDF</button>
              <button onClick={() => triggerExport('Excel (XLSX)')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}><Download size={14} /> Export Excel</button>
              <button onClick={() => triggerExport('CSV')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}><Download size={14} /> Export CSV</button>
            </div>
          </div>

          <table className="cms-table">
            <thead>
              <tr>
                {selectedCols.map(col => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {currentRows.map((row, idx) => (
                <tr key={idx}>
                  {selectedCols.map(col => <td key={col}>{row[col] || '-'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Saved Templates List */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-muted)' }}>Saved Report Templates ({savedTemplates.length})</h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {savedTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedSource(t.source); setSelectedCols(t.cols); }}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  <FileSpreadsheet size={12} color="#06b6d4" /> {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Save Template */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Save Report Template</h3>
            </div>
            <form onSubmit={handleSaveTemplateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Template Name</label>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Monthly Revenue Audit" required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowSaveModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
