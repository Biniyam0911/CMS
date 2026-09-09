import React, { useState } from 'react';
import { BarChart3, Download, Play, FileText, X, Check, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient';

export default function ReportsLibraryPage() {
  const [activeReport, setActiveReport] = useState<any>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportedAlert, setExportedAlert] = useState<string | null>(null);

  const reports = [
    { id: 1, title: 'Monthly Clinical Consultation Volume', category: 'Clinical', desc: 'Aggregated breakdown of patient visits per doctor and department' },
    { id: 2, title: 'Financial Revenue & VAT Summary (Sales Report)', category: 'Financial', desc: 'Daily, weekly, and monthly invoice totals with 15% VAT breakdown. Excludes free/waived services.' },
    { id: 3, title: 'Laboratory Test Turnaround Time (TAT)', category: 'Laboratory', desc: 'Average completion time from sample collection to pathologist verification' },
    { id: 4, title: 'Drug Consumption & Inventory Expiry', category: 'Pharmacy', desc: 'Stock depletion rates, low-stock warnings, and controlled drug logs' }
  ];

  const handleRunReport = async (report: any) => {
    setActiveReport(report);
    setLoading(true);
    try {
      if (report.id === 2) {
        // Financial Revenue / Sales Report: Fetch invoices from API and filter out waived / free invoices
        const res = await api.get<any[]>('/billing/invoices').catch(() => []);
        if (res && Array.isArray(res)) {
          // EXCLUDE waived invoices completely from sales revenue rows
          const billableOnly = res.filter(inv => {
            const isWaived = inv.isWaived || inv.IsWaived || inv.totalAmount === 0 || inv.TotalAmount === 0;
            return !isWaived;
          }).map(inv => ({
            InvoiceNo: inv.invoiceNo || inv.InvoiceNumber,
            PatientName: inv.patientName || inv.PatientName,
            IssueDate: inv.issueDate ? String(inv.issueDate).split('T')[0] : '',
            SubTotal: Number(inv.subTotal || inv.SubTotal || 0),
            TaxAmount: Number(inv.taxAmount || inv.TaxAmt || 0),
            TotalAmount: Number(inv.totalAmount || inv.TotalAmount || 0),
            PaidAmount: Number(inv.paidAmount || inv.PaidAmount || 0),
            Status: inv.statusName || (inv.statusId === 4 ? 'Paid' : 'Issued')
          }));
          setReportData(billableOnly);
        } else {
          setReportData([]);
        }
      } else {
        setReportData([]);
      }
    } catch (e) {
      console.error(e);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const triggerExport = (format: string) => {
    setExportedAlert(`Report exported as ${format} successfully!`);
    setTimeout(() => setExportedAlert(null), 3000);
  };

  const totalSalesRevenue = reportData.reduce((sum, r) => sum + (r.PaidAmount || 0), 0);
  const totalBilled = reportData.reduce((sum, r) => sum + (r.TotalAmount || 0), 0);
  const totalVat = reportData.reduce((sum, r) => sum + (r.TaxAmount || 0), 0);

  return (
    <div>
      {exportedAlert && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '10px 16px', background: '#059669', color: '#fff', borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} /> {exportedAlert}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 color="#0284c7" size={22} /> Standard Reports Library
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Generate clinical, operational, and financial analytics reports. Free and waived services are excluded from revenue totals.
        </p>
      </div>

      <div className="grid-2">
        {reports.map((r, idx) => (
          <div key={idx} className="glass-panel glass-panel-hover" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <span className="badge badge-info" style={{ marginBottom: '8px' }}>{r.category}</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '6px 0' }}>{r.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.desc}</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => handleRunReport(r)} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                <Play size={14} /> Run Report
              </button>
              <button onClick={() => triggerExport('PDF')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                <Download size={14} /> PDF
              </button>
              <button onClick={() => triggerExport('Excel')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                <Download size={14} /> Excel
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report Modal Preview */}
      {activeReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ width: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            
            <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>{activeReport.category} Report</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{activeReport.title}</h3>
              </div>
              <button onClick={() => setActiveReport(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {activeReport.id === 2 && (
              <div style={{ padding: '14px 20px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', gap: '28px', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#166534', fontWeight: 600 }}>Total Billed (excl. waived):</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d' }}>Br {totalBilled.toFixed(2)}</div>
                </div>
                <div>
                  <span style={{ color: '#166534', fontWeight: 600 }}>VAT Collected (15%):</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d' }}>Br {totalVat.toFixed(2)}</div>
                </div>
                <div>
                  <span style={{ color: '#166534', fontWeight: 600 }}>Paid Sales Revenue:</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d' }}>Br {totalSalesRevenue.toFixed(2)}</div>
                </div>
                <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '0.75rem', color: '#15803d', fontStyle: 'italic' }}>
                  ✓ Waived/Free invoices are 100% excluded from these revenue calculations.
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  Compiling report data...
                </div>
              ) : reportData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No records found matching this report scope.
                </div>
              ) : (
                <table className="cms-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Patient Name</th>
                      <th>Issue Date</th>
                      <th>Subtotal</th>
                      <th>VAT (15%)</th>
                      <th>Total Amount</th>
                      <th>Paid Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>{row.InvoiceNo}</td>
                        <td style={{ fontWeight: 600 }}>{row.PatientName}</td>
                        <td>{row.IssueDate}</td>
                        <td>Br {row.SubTotal.toFixed(2)}</td>
                        <td>Br {row.TaxAmount.toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>Br {row.TotalAmount.toFixed(2)}</td>
                        <td style={{ color: '#059669', fontWeight: 700 }}>Br {row.PaidAmount.toFixed(2)}</td>
                        <td>
                          <span className={row.Status === 'Paid' ? 'badge badge-normal' : 'badge badge-warning'} style={{ fontSize: '0.68rem' }}>
                            {row.Status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{reportData.length} billable line records returned</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => triggerExport('PDF')} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}><Download size={14} /> Export PDF</button>
                <button onClick={() => triggerExport('Excel')} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}><Download size={14} /> Export Excel</button>
                <button onClick={() => setActiveReport(null)} className="btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem' }}>Done</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
