import React from 'react';
import { BarChart3, Download, Play, FileText } from 'lucide-react';

export default function ReportsLibraryPage() {
  const reports = [
    { title: 'Monthly Clinical Consultation Volume', category: 'Clinical', desc: 'Aggregated breakdown of patient visits per doctor and department' },
    { title: 'Financial Revenue & VAT Summary', category: 'Financial', desc: 'Daily, weekly, and monthly invoice totals with 15% VAT breakdown' },
    { title: 'Laboratory Test Turnaround Time (TAT)', category: 'Laboratory', desc: 'Average completion time from sample collection to pathologist verification' },
    { title: 'Drug Consumption & Inventory Expiry', category: 'Pharmacy', desc: 'Stock depletion rates, low-stock warnings, and controlled drug logs' }
  ];

  return (
    <div>
      <div className="grid-2">
        {reports.map((r, idx) => (
          <div key={idx} className="glass-panel glass-panel-hover" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <span className="badge badge-info" style={{ marginBottom: '8px' }}>{r.category}</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '6px 0' }}>{r.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.desc}</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}><Play size={14} /> Run Report</button>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}><Download size={14} /> PDF</button>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}><Download size={14} /> Excel</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
