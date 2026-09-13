import React, { useState, useEffect } from 'react';
import {
  ListOrdered, Volume2, Monitor, CheckCircle, Play, RefreshCw,
  Activity, FlaskConical, Stethoscope, Clock, ShieldAlert, Loader2, UserCheck
} from 'lucide-react';
import { api } from '../../api/apiClient';
import { playTicketChimeAndSpeech } from '../../utils/audioAnnouncer';

type QueueTab = 'all' | 'triage' | 'lab' | 'procedure';

export default function QueuePage() {
  const [activeTab, setActiveTab] = useState<QueueTab>('all');
  const [tokens, setTokens] = useState<any[]>([]);
  const [triageQueue, setTriageQueue] = useState<any[]>([]);
  const [labQueue, setLabQueue] = useState<any[]>([]);
  const [procedureQueue, setProcedureQueue] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [activeCounter, setActiveCounter] = useState('Doctor Room 1');
  const [lastCalled, setLastCalled] = useState<{ token: string; counter: string; patient?: string }>({
    token: 'A-001',
    counter: 'Doctor Room 1',
    patient: 'Awaiting Next Call'
  });
  const [loading, setLoading] = useState(true);

  const fetchAllQueues = async () => {
    try {
      setLoading(true);
      const todayIsoDate = new Date().toISOString().split('T')[0];

      const [liveData, counterData, triageData, labData, procData] = await Promise.all([
        api.get<any[]>(`/queue/live?date=${todayIsoDate}`).catch(() => []),
        api.get<any[]>('/queue/counters').catch(() => []),
        api.get<any>(`/triage/queue?date=${todayIsoDate}`).catch(() => []),
        api.get<any>(`/lab/orders?date=${todayIsoDate}`).catch(() => api.get<any>(`/lab/worklist?date=${todayIsoDate}`).catch(() => [])),
        api.get<any>(`/procedures/queue?date=${todayIsoDate}`).catch(() => [])
      ]);

      // ---- STRICT LOCAL CALENDAR DAY MATCHING ----
      const now = new Date();
      const todayYear = now.getFullYear();
      const todayMonth = now.getMonth();
      const todayDay = now.getDate();

      const isToday = (dateField: any): boolean => {
        if (!dateField) return false; // Exclude records that do not belong to today
        const d = new Date(dateField);
        if (isNaN(d.getTime())) return false;
        return d.getFullYear() === todayYear && d.getMonth() === todayMonth && d.getDate() === todayDay;
      };

      // Service Counters
      if (counterData && Array.isArray(counterData) && counterData.length > 0) {
        setCounters(counterData.map((c: any) => ({
          id: c.id || c.Id,
          name: c.counterName || c.CounterName || `Counter ${c.id}`,
          service: c.serviceType || c.ServiceType || 'General'
        })));
        setActiveCounter(counterData[0].counterName || counterData[0].CounterName || 'Doctor Room 1');
      } else {
        setCounters([
          { id: 1, name: 'Doctor Room 1', service: 'General Practice' },
          { id: 2, name: 'Triage Station 1', service: 'Nursing Assessment' },
          { id: 3, name: 'Lab Phlebotomy Counter 1', service: 'Laboratory' },
          { id: 4, name: 'Minor Procedure Room', service: 'Clinical Procedures' },
          { id: 5, name: 'Pharmacy Dispensary 1', service: 'Pharmacy' }
        ]);
      }

      // Live Tokens — today only
      const rawTokens = Array.isArray(liveData) ? liveData : ((liveData as any)?.data || (liveData as any)?.Data || []);
      if (rawTokens && rawTokens.length > 0) {
        const todayTokens = rawTokens.filter((q: any) => isToday(q.checkInTime || q.CheckInTime || q.createdAt || q.CreatedAt || q.tokenDate || q.TokenDate));
        setTokens(todayTokens.map((q: any) => ({
          id: q.id || q.Id,
          token: q.tokenNumber || q.TokenNumber || `A-${String(q.id).padStart(3, '0')}`,
          patientName: q.patientName || q.PatientName || `Patient #${q.patientId}`,
          service: q.serviceType || q.ServiceType || 'Consultation',
          counter: q.counterName || q.CounterName || '-',
          status: q.statusName || (q.statusId === 2 ? 'Called' : (q.statusId === 3 ? 'Completed' : 'Waiting')),
          priority: q.priorityName || (q.priorityLevel === 1 ? 'Emergency' : (q.priorityLevel === 3 ? 'VIP' : 'Normal'))
        })));
      } else {
        setTokens([]);
      }

      // Triage Queue — today only
      const rawTriage = Array.isArray(triageData) ? triageData : (triageData?.data || triageData?.Data || []);
      if (rawTriage && rawTriage.length > 0) {
        const todayTriage = rawTriage.filter((t: any) => isToday(t.triagedAt || t.TriagedAt || t.updatedAt || t.UpdatedAt || t.createdAt || t.CreatedAt || t.triageDate || t.TriageDate));
        setTriageQueue(todayTriage.map((t: any) => ({
          id: t.id || t.Id,
          token: t.tokenNumber || t.TokenNumber || `TRG-${t.id || t.Id}`,
          patientId: t.patientId || t.PatientId,
          patientName: t.patientName || t.PatientName || `Patient #${t.patientId}`,
          mrn: t.mrn || t.MRN || `HD-${t.patientId}`,
          category: t.triageCategory || t.TriageCategory || 'General',
          priority: t.priorityLevel === 1 ? 'Emergency' : (t.priorityLevel === 2 ? 'Urgent' : 'Routine'),
          vitals: (t.systolicBP && t.diastolicBP) ? `BP: ${t.systolicBP}/${t.diastolicBP}, HR: ${t.heartRate || '--'}, Temp: ${t.temperature || '--'}°C` : 'Vitals Pending',
          chiefComplaint: t.chiefComplaint || t.ChiefComplaint || 'Routine Triage Assessment',
          doctor: t.assignedDoctorName || t.AssignedDoctorName || 'Attending Physician',
          status: t.status || t.Status || 'Waiting'
        })));
      } else {
        setTriageQueue([]);
      }

      // Laboratory Queue — today only
      const rawLab = Array.isArray(labData) ? labData : (labData?.data || labData?.Data || []);
      if (rawLab && rawLab.length > 0) {
        const todayLab = rawLab.filter((l: any) => isToday(l.orderedAt || l.OrderedAt || l.createdAt || l.CreatedAt));
        setLabQueue(todayLab.map((l: any) => ({
          id: l.id || l.Id || l.orderId || l.OrderId,
          token: l.orderNumber || l.OrderNumber || `LAB-${l.id || l.orderId}`,
          patientId: l.patientId || l.PatientId,
          patientName: l.patientName || l.PatientName || `Patient #${l.patientId}`,
          mrn: l.mrn || l.MRN || `HD-${l.patientId}`,
          testName: l.testName || l.TestName || l.clinicalInfo || 'Diagnostic Test Panel',
          sampleType: l.sampleType || l.SampleType || 'Blood / Serum',
          priority: l.priority === 1 ? 'Emergency / STAT' : 'Routine',
          status: l.itemStatus === 2 ? 'Sample Collected' : (l.itemStatus === 4 ? 'Testing in Progress' : 'Awaiting Phlebotomy')
        })));
      } else {
        setLabQueue([]);
      }

      // Procedure Queue — today only
      const rawProc = Array.isArray(procData) ? procData : (procData?.data || procData?.Data || []);
      if (rawProc && rawProc.length > 0) {
        const todayProc = rawProc.filter((p: any) => isToday(p.createdAt || p.CreatedAt || p.orderedAt || p.OrderedAt));
        setProcedureQueue(todayProc.map((p: any) => ({
          id: p.id || p.Id,
          token: `PRC-${p.id || p.Id}`,
          patientId: p.patientId || p.PatientId,
          patientName: p.patientName || p.PatientName || `Patient #${p.patientId}`,
          mrn: `HD-${p.patientId || p.PatientId}`,
          procedureName: p.procedureName || p.ProcedureName || 'Clinical Procedure',
          procedureCode: p.procedureCode || p.ProcedureCode || 'PROC-GEN',
          notes: p.clinicalNotes || p.ClinicalNotes || 'Ordered clinical minor surgery/procedure',
          doctor: p.doctorName || p.DoctorName || 'Attending Physician',
          status: p.statusName || (p.statusId === 2 ? 'Scheduled' : 'Ordered')
        })));
      } else {
        setProcedureQueue([]);
      }

    } catch (err) {
      console.error('Failed to load queue board data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllQueues();
  }, []);

  const handleCallPatient = (tokenStr: string, patientName: string, serviceStation: string) => {
    const counterToUse = serviceStation || activeCounter;
    setLastCalled({ token: tokenStr, counter: counterToUse, patient: patientName });
    playTicketChimeAndSpeech(tokenStr, counterToUse);

    // Update or insert into serving tickets
    const existing = tokens.find(t => t.token === tokenStr);
    if (existing) {
      setTokens(tokens.map(t => t.token === tokenStr ? { ...t, status: 'Called', counter: counterToUse } : t));
    } else {
      setTokens(prev => [{
        id: Date.now(),
        token: tokenStr,
        patientName: patientName,
        service: counterToUse,
        counter: counterToUse,
        status: 'Called',
        priority: 'Normal'
      }, ...prev]);
    }
  };

  const handleCompleteTicket = (tokenId: number) => {
    setTokens(tokens.map(t => t.id === tokenId ? { ...t, status: 'Completed' } : t));
  };

  return (
    <div>
      {/* Big TV Screen Announcer Banner with Live Audio Broadcast */}
      <div
        style={{
          padding: '24px 28px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.08), rgba(52, 199, 89, 0.08))',
          border: '1px solid rgba(0, 113, 227, 0.2)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: '#0071e3', fontWeight: 700, letterSpacing: '0.08em' }}>
            NOW CALLING TO CLINICAL STATION
          </span>
          <div style={{ fontSize: '3.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace', lineHeight: 1.1 }}>
            {lastCalled.token}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '4px' }}>
            {lastCalled.patient && <span>{lastCalled.patient} — </span>}Proceed to: <strong style={{ color: '#0071e3' }}>{lastCalled.counter}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => playTicketChimeAndSpeech(lastCalled.token, lastCalled.counter)}
            className="btn-primary"
            style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '0.9rem' }}
          >
            <Volume2 size={20} /> Re-Announce Chime
          </button>
          <button
            onClick={fetchAllQueues}
            className="btn-secondary"
            style={{ padding: '12px 18px', borderRadius: '12px' }}
            title="Refresh All Queues"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Counter Selection Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Active Staff Station:
            </label>
            <select value={activeCounter} onChange={e => setActiveCounter(e.target.value)} style={{ width: '240px', padding: '8px 12px' }}>
              {counters.map(c => (
                <option key={c.id} value={c.name}>{c.name} ({c.service})</option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '20px',
            background: 'rgba(0, 113, 227, 0.08)',
            border: '1px solid rgba(0, 113, 227, 0.2)',
            fontSize: '0.78rem',
            color: '#0071e3',
            fontWeight: 600
          }}>
            <Clock size={13} />
            <span>Today's Waiting List: {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Queue Switcher Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('all')}
            className={activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}
          >
            <ListOrdered size={15} /> All Overview ({tokens.filter(t => t.status === 'Waiting').length})
          </button>
          <button
            onClick={() => setActiveTab('triage')}
            className={activeTab === 'triage' ? 'btn-primary' : 'btn-secondary'}
          >
            <Activity size={15} /> Triage Queue ({triageQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('lab')}
            className={activeTab === 'lab' ? 'btn-primary' : 'btn-secondary'}
          >
            <FlaskConical size={15} /> Laboratory Queue ({labQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('procedure')}
            className={activeTab === 'procedure' ? 'btn-primary' : 'btn-secondary'}
          >
            <Stethoscope size={15} /> Procedure Queue ({procedureQueue.length})
          </button>
        </div>
      </div>

      {/* TAB 1: ALL OVERVIEW & GENERAL QUEUE */}
      {activeTab === 'all' && (
        <div className="grid-2">
          {/* Waiting General Tickets */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ListOrdered color="#0071e3" size={18} /> Active Waiting Tickets ({tokens.filter(t => t.status === 'Waiting').length})
              </h3>
              {loading && <Loader2 size={16} className="animate-spin" color="#0071e3" />}
            </div>

            <table className="cms-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Priority</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tokens.filter(t => t.status === 'Waiting').length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No waiting tickets. Check In patients at reception or triage to summon them.
                    </td>
                  </tr>
                ) : (
                  tokens.filter(t => t.status === 'Waiting').map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0071e3', fontFamily: 'monospace' }}>{t.token}</td>
                      <td style={{ fontWeight: 600 }}>{t.patientName}</td>
                      <td>{t.service}</td>
                      <td>
                        <span className={t.priority === 'Emergency' ? 'badge badge-critical' : (t.priority === 'VIP' ? 'badge badge-warning' : 'badge badge-normal')}>
                          {t.priority}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => handleCallPatient(t.token, t.patientName, activeCounter)} className="btn-primary" style={{ padding: '5px 12px', fontSize: '0.75rem' }}>
                          <Play size={12} /> Call Ticket
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Currently Called / Serving */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor color="#34c759" size={18} /> Currently Called / In Consultation ({tokens.filter(t => t.status === 'Called' || t.status === 'InProgress').length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tokens.filter(t => t.status === 'Called' || t.status === 'InProgress').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No patients currently summoned. Call a patient from any queue to begin consultation.
                </div>
              ) : (
                tokens.filter(t => t.status === 'Called' || t.status === 'InProgress').map(t => (
                  <div key={t.id} style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '1rem', color: '#0071e3', fontFamily: 'monospace' }}>{t.token}</strong> — <span style={{ fontWeight: 600 }}>{t.patientName}</span>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Station: {t.counter} ({t.service})</div>
                    </div>
                    <button onClick={() => handleCompleteTicket(t.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                      <CheckCircle size={14} color="#34c759" /> Complete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REAL TRIAGE PATIENTS QUEUE */}
      {activeTab === 'triage' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity color="#0071e3" size={18} /> Triage & Nursing Assessment Queue ({triageQueue.length})
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                Real patient records awaiting vital signs evaluation, nurse assessment, and room assignment.
              </p>
            </div>
            {loading && <Loader2 size={16} className="animate-spin" color="#0071e3" />}
          </div>

          <table className="cms-table">
            <thead>
              <tr>
                <th>Triage Token</th>
                <th>Patient Name</th>
                <th>MRN</th>
                <th>Chief Complaint</th>
                <th>Recorded Vitals</th>
                <th>Priority</th>
                <th>Assigned Doctor</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {triageQueue.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No patients currently waiting in Triage Queue.
                  </td>
                </tr>
              ) : (
                triageQueue.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0071e3' }}>{p.token}</td>
                    <td style={{ fontWeight: 600 }}>{p.patientName}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.mrn}</td>
                    <td>{p.chiefComplaint}</td>
                    <td style={{ fontSize: '0.75rem' }}>{p.vitals}</td>
                    <td>
                      <span className={p.priority === 'Emergency' ? 'badge badge-critical' : (p.priority === 'Urgent' ? 'badge badge-warning' : 'badge badge-normal')}>
                        {p.priority}
                      </span>
                    </td>
                    <td>{p.doctor}</td>
                    <td>
                      <span className="badge badge-warning">{p.status}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleCallPatient(p.token, p.patientName, 'Triage Station 1')}
                        className="btn-primary"
                        style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                      >
                        <Play size={12} /> Call to Triage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: REAL LABORATORY (LIS) QUEUE */}
      {activeTab === 'lab' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FlaskConical color="#af52de" size={18} /> Laboratory Testing & Phlebotomy Queue ({labQueue.length})
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                Real patients with active doctor lab orders awaiting specimen draw or analyzer processing.
              </p>
            </div>
            {loading && <Loader2 size={16} className="animate-spin" color="#0071e3" />}
          </div>

          <table className="cms-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Patient Name</th>
                <th>MRN</th>
                <th>Diagnostic Test</th>
                <th>Sample Type</th>
                <th>Priority</th>
                <th>Queue Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {labQueue.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No patients currently waiting in Laboratory Queue.
                  </td>
                </tr>
              ) : (
                labQueue.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#af52de' }}>{p.token}</td>
                    <td style={{ fontWeight: 600 }}>{p.patientName}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.mrn}</td>
                    <td><strong style={{ color: 'var(--text-main)' }}>{p.testName}</strong></td>
                    <td>{p.sampleType}</td>
                    <td>
                      <span className={p.priority.includes('Emergency') ? 'badge badge-critical' : 'badge badge-normal'}>
                        {p.priority}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info">{p.status}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleCallPatient(p.token, p.patientName, 'Lab Phlebotomy Counter 1')}
                        className="btn-primary"
                        style={{ padding: '5px 12px', fontSize: '0.75rem', background: '#af52de', borderColor: '#af52de' }}
                      >
                        <Play size={12} /> Call to Lab
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: REAL PROCEDURE QUEUE */}
      {activeTab === 'procedure' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Stethoscope color="#ff9500" size={18} /> Clinical Procedure & Minor Surgery Queue ({procedureQueue.length})
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                Real patient procedure orders scheduled for clinical intervention, injections, wound dressing, and minor surgery.
              </p>
            </div>
            {loading && <Loader2 size={16} className="animate-spin" color="#0071e3" />}
          </div>

          <table className="cms-table">
            <thead>
              <tr>
                <th>Procedure ID</th>
                <th>Patient Name</th>
                <th>MRN</th>
                <th>Ordered Procedure</th>
                <th>Clinical Notes</th>
                <th>Ordering Physician</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {procedureQueue.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No patients currently waiting in Procedure Queue.
                  </td>
                </tr>
              ) : (
                procedureQueue.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#ff9500' }}>{p.token}</td>
                    <td style={{ fontWeight: 600 }}>{p.patientName}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.mrn}</td>
                    <td><strong style={{ color: 'var(--text-main)' }}>{p.procedureName}</strong> ({p.procedureCode})</td>
                    <td style={{ fontSize: '0.78rem' }}>{p.notes}</td>
                    <td>{p.doctor}</td>
                    <td>
                      <span className="badge badge-warning">{p.status}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleCallPatient(p.token, p.patientName, 'Minor Procedure Room')}
                        className="btn-primary"
                        style={{ padding: '5px 12px', fontSize: '0.75rem', background: '#ff9500', borderColor: '#ff9500' }}
                      >
                        <Play size={12} /> Call to Procedure
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
