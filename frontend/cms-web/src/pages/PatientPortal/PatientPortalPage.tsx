import React, { useState, useEffect } from 'react';
import { Globe, Calendar, FlaskConical, CreditCard, User, Download, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient';

export default function PatientPortalPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<'appts' | 'labs' | 'billing'>('labs');
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<any>({ name: 'Yonas Tsegaye', mrn: 'MRN-001' });
  const [verifiedLabs, setVerifiedLabs] = useState<any[]>([
    { testName: 'Complete Blood Count (CBC Profile)', date: '2026-08-28', status: 'Verified', result: 'WBC 6.8, HGB 14.2 g/dL, PLT 240', doctor: 'Dr. Abebe Bekele' },
    { testName: 'Fasting Blood Sugar (FBS)', date: '2026-08-20', status: 'Verified', result: '95 mg/dL (Normal)', doctor: 'Dr. Tigist Haile' }
  ]);
  const [myAppts, setMyAppts] = useState<any[]>([
    { doctor: 'Dr. Abebe Bekele', spec: 'General Practice', date: '2026-08-31', time: '08:00 AM', status: 'Confirmed' }
  ]);
  const [myInvoices, setMyInvoices] = useState<any[]>([
    { invoiceNo: 'INV-1-20260831001', date: '2026-08-31', total: 920.0, paid: 920.0, status: 'Paid' }
  ]);

  useEffect(() => {
    const fetchPortalData = async () => {
      try {
        setLoading(true);
        const [patientsData, apptsData, invoicesData] = await Promise.all([
          api.get<any[]>('/patients/search').catch(() => []),
          api.get<any[]>('/appointments/doctor/1').catch(() => []),
          api.get<any[]>('/billing/invoices').catch(() => [])
        ]);

        if (patientsData && patientsData.length > 0) {
          const p = patientsData[0];
          setProfile({
            name: `${p.firstName || p.FirstName} ${p.lastName || p.LastName}`.trim(),
            mrn: p.mrn || p.MRN
          });
        }

        if (apptsData && apptsData.length > 0) {
          setMyAppts(apptsData.map((a: any) => ({
            doctor: a.doctorName || 'Dr. Abebe Bekele',
            spec: 'General Practice',
            date: a.slotDateTime ? String(a.slotDateTime).split('T')[0] : '2026-08-31',
            time: a.slotDateTime ? new Date(a.slotDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM',
            status: a.statusId === 2 ? 'Confirmed' : 'Scheduled'
          })));
        }

        if (invoicesData && invoicesData.length > 0) {
          setMyInvoices(invoicesData.map((inv: any) => ({
            invoiceNo: inv.invoiceNo || inv.InvoiceNo || `INV-1-${inv.id}`,
            date: inv.issueDate ? String(inv.issueDate).split('T')[0] : '2026-08-31',
            total: inv.totalAmount || inv.TotalAmount || 0,
            paid: inv.paidAmount || inv.PaidAmount || 0,
            status: inv.statusName || (inv.statusId === 4 ? 'Paid' : 'Issued')
          })));
        }
      } catch (err) {
        console.error('Failed to load patient portal data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortalData();
  }, []);

  return (
    <div>
      {/* Patient Header Banner */}
      <div className="glass-panel" style={{ padding: isMobile ? '16px' : '24px', marginBottom: '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '12px', background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', color: '#fff', flexShrink: 0 }}>
            {profile.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 700 }}>Welcome, {profile.name}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MRN: {profile.mrn} | Patient Self-Service Portal</p>
          </div>
        </div>
        {loading && <Loader2 size={18} className="animate-spin" color="#06b6d4" />}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
        <button onClick={() => setActiveTab('labs')} className={activeTab === 'labs' ? 'btn-primary' : 'btn-secondary'} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          <FlaskConical size={14} /> Verified Lab Results
        </button>
        <button onClick={() => setActiveTab('appts')} className={activeTab === 'appts' ? 'btn-primary' : 'btn-secondary'} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          <Calendar size={14} /> My Appointments ({myAppts.length})
        </button>
        <button onClick={() => setActiveTab('billing')} className={activeTab === 'billing' ? 'btn-primary' : 'btn-secondary'} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          <CreditCard size={14} /> My Invoices ({myInvoices.length})
        </button>
      </div>

      {activeTab === 'labs' && (
        <div className="glass-panel" style={{ padding: isMobile ? '16px 12px' : '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FlaskConical color="#06b6d4" size={18} /> Verified Diagnostic Lab Reports
          </h3>
          <div className="table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Date Verified</th>
                  <th>Result Findings</th>
                  <th>Ordering Doctor</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {verifiedLabs.map((l, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{l.testName}</td>
                    <td>{l.date}</td>
                    <td style={{ color: '#38bdf8', fontWeight: 600 }}>{l.result}</td>
                    <td>{l.doctor}</td>
                    <td>
                      <button onClick={() => window.print()} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                        <Download size={12} /> Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'appts' && (
        <div className="glass-panel" style={{ padding: isMobile ? '16px 12px' : '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar color="#3b82f6" size={18} /> Scheduled Clinical Visits
          </h3>
          <div className="table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {myAppts.map((a, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{a.doctor}</td>
                    <td><span className="badge badge-info">{a.spec}</span></td>
                    <td>{a.date}</td>
                    <td style={{ fontFamily: 'monospace', color: '#06b6d4' }}>{a.time}</td>
                    <td><span className="badge badge-normal">{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="glass-panel" style={{ padding: isMobile ? '16px 12px' : '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard color="#10b981" size={18} /> Financial Invoices & Receipts
          </h3>
          <div className="table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Total Billed</th>
                  <th>Amount Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {myInvoices.map((inv, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: '#06b6d4', fontFamily: 'monospace' }}>{inv.invoiceNo}</td>
                    <td>{inv.date}</td>
                    <td>Br {Number(inv.total).toFixed(2)}</td>
                    <td style={{ color: '#34d399', fontWeight: 600 }}>Br {Number(inv.paid).toFixed(2)}</td>
                    <td><span className="badge badge-normal">{inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
