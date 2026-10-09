import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ListOrdered, Volume2, Monitor, CheckCircle, Play, RefreshCw,
  Activity, FlaskConical, Stethoscope, Clock, ShieldAlert, Loader2,
  Tv, PhoneForwarded, XCircle, RotateCcw, User, UserCheck, Calendar
} from 'lucide-react';
import { api } from '../../api/apiClient';
import { playTicketChimeAndSpeech, extractMrnNumber } from '../../utils/audioAnnouncer';
import WaitingRoomTvScreen from './WaitingRoomTvScreen';

type StationTab = 'doctor' | 'lab' | 'all';
type ViewTab = 'active' | 'completed';

interface QueueItem {
  id: string | number;
  ticketId?: number;
  mrnNumber: string;
  mrn?: string;
  patientId?: number;
  patientName: string;
  service: string;
  serviceCategory: 'Consultation' | 'Procedure' | 'Laboratory' | 'Other';
  counter: string;
  status: 'Waiting' | 'Called' | 'InProgress' | 'Completed';
  priority: string;
  priorityLevel?: number;
  assignedDoctor?: string;
  time: string;
  isDoctorService: boolean;
  isLabService: boolean;
}

interface CompletedTicket {
  id: number;
  patientId: number;
  mrn?: string;
  mrnNumber: string;
  patientName: string;
  serviceType: string;
  counterName: string;
  staffName: string;
  checkInTime: string;
  callTime?: string;
  endTime?: string;
  durationMinutes?: number;
}

export default function QueuePage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Current Logged-in User & Role Detection
  const currentUser = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('current_user') || localStorage.getItem('current_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const userRoles: string[] = useMemo(() => {
    if (!currentUser) return ['Staff'];
    if (Array.isArray(currentUser.roles)) return currentUser.roles;
    if (currentUser.role) return [currentUser.role];
    return ['Staff'];
  }, [currentUser]);

  const isDoctor = useMemo(() =>
    userRoles.some(r => r.toLowerCase().includes('doc')) || !!currentUser?.doctorId,
    [userRoles, currentUser]
  );

  const isLabTech = useMemo(() =>
    userRoles.some(r => r.toLowerCase().includes('lab')),
    [userRoles]
  );

  const isAdmin = useMemo(() =>
    userRoles.some(r => r.toLowerCase().includes('admin') || r.toLowerCase().includes('manager')),
    [userRoles]
  );

  // Default active station based on permissions
  const [activeStation, setActiveStation] = useState<StationTab>(() => {
    if (isDoctor && !isAdmin) return 'doctor';
    if (isLabTech && !isAdmin) return 'lab';
    return 'doctor'; // Default to Doctor station
  });

  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('active');
  const [tvMode, setTvMode] = useState(false);

  // Station Room / Counter State
  const [counters, setCounters] = useState<any[]>([]);
  const [activeCounter, setActiveCounter] = useState(() =>
    localStorage.getItem('cms_queue_active_counter') || (isLabTech && !isDoctor ? 'Lab Phlebotomy Counter 1' : 'Doctor Room 1')
  );

  // Queues & Completed Data
  const [activeWaitingList, setActiveWaitingList] = useState<QueueItem[]>([]);
  const [currentCalled, setCurrentCalled] = useState<QueueItem | null>(null);
  const [completedTickets, setCompletedTickets] = useState<CompletedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter counters by current station
  const stationCounters = useMemo(() => {
    if (counters.length === 0) {
      if (activeStation === 'lab') {
        return ['Lab Phlebotomy Counter 1', 'Lab Phlebotomy Counter 2', 'Lab Results Desk'];
      }
      return ['Doctor Room 1', 'Doctor Room 2', 'Doctor Room 3', 'Minor Procedure Room'];
    }

    if (activeStation === 'lab') {
      const filtered = counters.filter(c => (c.service || '').toLowerCase().includes('lab') || (c.name || '').toLowerCase().includes('lab'));
      return filtered.length > 0 ? filtered.map(c => c.name) : ['Lab Phlebotomy Counter 1', 'Lab Phlebotomy Counter 2', 'Lab Results Desk'];
    }

    if (activeStation === 'doctor') {
      const filtered = counters.filter(c => !(c.service || '').toLowerCase().includes('lab') && !(c.name || '').toLowerCase().includes('lab'));
      return filtered.length > 0 ? filtered.map(c => c.name) : ['Doctor Room 1', 'Doctor Room 2', 'Doctor Room 3', 'Minor Procedure Room'];
    }

    return counters.map(c => c.name);
  }, [counters, activeStation]);

  // Adjust counter if not in active station counters
  useEffect(() => {
    if (stationCounters.length > 0 && !stationCounters.includes(activeCounter)) {
      setActiveCounter(stationCounters[0]);
    }
  }, [stationCounters, activeCounter]);

  const handleCounterChange = (counterName: string) => {
    setActiveCounter(counterName);
    localStorage.setItem('cms_queue_active_counter', counterName);
  };

  // Broadcast event across browser tabs / TV monitors
  const broadcastQueueEvent = (actionType: string, ticket?: any) => {
    try {
      const bc = new BroadcastChannel('cms_queue_events');
      bc.postMessage({ type: actionType, ticket, timestamp: Date.now() });
      bc.close();
    } catch {}
    localStorage.setItem('cms_queue_last_event', Date.now().toString());
  };

  // Main Queue Fetching
  const fetchAllQueues = useCallback(async () => {
    try {
      setLoading(true);
      const todayIsoDate = new Date().toISOString().split('T')[0];

      const [liveData, counterData, triageData, labData, procData, compData] = await Promise.all([
        api.get<any[]>(`/queue/live?date=${todayIsoDate}`).catch(() => []),
        api.get<any[]>('/queue/counters').catch(() => []),
        api.get<any>(`/triage/queue?date=${todayIsoDate}`).catch(() => []),
        api.get<any>(`/lab/orders?date=${todayIsoDate}`).catch(() => api.get<any>(`/lab/worklist?date=${todayIsoDate}`).catch(() => [])),
        api.get<any>(`/procedures/queue?date=${todayIsoDate}`).catch(() => []),
        api.get<any>(`/queue/completed?date=${todayIsoDate}`).catch(() => [])
      ]);

      const now = new Date();
      const isToday = (d: any) => {
        if (!d) return true;
        const dt = new Date(d);
        return !isNaN(dt.getTime()) &&
          dt.getFullYear() === now.getFullYear() &&
          dt.getMonth() === now.getMonth() &&
          dt.getDate() === now.getDate();
      };

      // Set Counters
      if (counterData && Array.isArray(counterData) && counterData.length > 0) {
        setCounters(counterData.map((c: any) => ({
          id: c.id || c.Id,
          name: c.counterName || c.CounterName || `Counter ${c.id}`,
          service: c.serviceType || c.ServiceType || 'General'
        })));
      }

      // Set Completed Tickets
      const rawComp = Array.isArray(compData) ? compData : ((compData as any)?.data || []);
      setCompletedTickets(rawComp.map((c: any) => ({
        id: c.id || c.Id,
        patientId: c.patientId || c.PatientId,
        mrn: c.mrn || c.MRN,
        mrnNumber: extractMrnNumber(c.mrnNumber || c.MrnNumber || c.mrn || c.MRN, c.patientId || c.id),
        patientName: c.patientName || c.PatientName || 'Patient',
        serviceType: c.serviceType || c.ServiceType || 'Consultation',
        counterName: c.counterName || c.CounterName || '-',
        staffName: c.staffName || c.StaffName || '-',
        checkInTime: c.checkInTime || c.CheckInTime,
        callTime: c.callTime || c.CallTime,
        endTime: c.endTime || c.EndTime,
        durationMinutes: c.durationMinutes ?? c.DurationMinutes ?? 0
      })));

      // 1. Process Live PatientQueues tickets
      const rawLive = Array.isArray(liveData) ? liveData : ((liveData as any)?.data || []);
      const liveList: QueueItem[] = rawLive.map((q: any) => {
        const mrnNum = extractMrnNumber(q.mrnNumber || q.MrnNumber || q.mrn || q.MRN, q.patientId || q.id);
        const sType = q.serviceType || q.ServiceType || 'Consultation';
        const isProc = sType.toLowerCase().includes('procedure');
        const isLb = sType.toLowerCase().includes('lab') || sType.toLowerCase().includes('phleb');
        return {
          id: q.id || q.Id,
          ticketId: q.id || q.Id,
          mrnNumber: mrnNum,
          mrn: q.mrn || q.MRN,
          patientId: q.patientId || q.PatientId,
          patientName: q.patientName || q.PatientName || `Patient #${mrnNum}`,
          service: sType,
          serviceCategory: isProc ? 'Procedure' : (isLb ? 'Laboratory' : 'Consultation'),
          counter: q.counterName || q.CounterName || '-',
          status: (q.statusId ?? q.StatusId) === 2 ? 'Called' : 'Waiting',
          priority: q.priorityName || (q.priorityLevel === 1 ? 'Emergency' : (q.priorityLevel === 3 ? 'VIP' : 'Normal')),
          priorityLevel: q.priorityLevel || 2,
          assignedDoctor: q.doctorName || q.DoctorName || '-',
          time: q.checkInTime || q.CheckInTime || '',
          isDoctorService: !isLb,
          isLabService: isLb
        };
      });

      // 2. Process Triage Queue (Doctor Consultation)
      const rawTriage = Array.isArray(triageData) ? triageData : (triageData?.data || []);
      const triageList: QueueItem[] = rawTriage
        .filter((t: any) => isToday(t.triagedAt || t.createdAt))
        .map((t: any, idx: number) => {
          const mrnNum = extractMrnNumber(t.mrn || t.MRN, t.patientId || t.id);
          const tid = t.id || t.Id || t.triageId || t.TriageId || mrnNum;
          return {
            id: tid ? `trg-${tid}-${idx}` : `trg-row-${idx}`,
            ticketId: undefined,
            mrnNumber: mrnNum,
            mrn: t.mrn || t.MRN,
            patientId: t.patientId || t.PatientId,
            patientName: t.patientName || t.PatientName || `Patient #${mrnNum}`,
            service: 'Consultation',
            serviceCategory: 'Consultation',
            counter: t.assignedDoctorName ? `Dr. ${t.assignedDoctorName}` : 'Doctor Room',
            status: 'Waiting',
            priority: t.priorityLevel === 1 ? 'Emergency' : (t.priorityLevel === 2 ? 'Urgent' : 'Normal'),
            priorityLevel: t.priorityLevel || 2,
            assignedDoctor: t.assignedDoctorName || 'Attending Doctor',
            time: t.triagedAt || t.createdAt || '',
            isDoctorService: true,
            isLabService: false
          };
        });

      // 3. Process Procedure Queue (Merged Doctor)
      const rawProc = Array.isArray(procData) ? procData : (procData?.data || []);
      const procList: QueueItem[] = rawProc
        .filter((p: any) => isToday(p.createdAt || p.orderedAt))
        .map((p: any, idx: number) => {
          const mrnNum = extractMrnNumber(p.mrn || p.MRN, p.patientId || p.id);
          const pid = p.id || p.Id || p.orderId || p.OrderId || mrnNum;
          return {
            id: pid ? `prc-${pid}-${idx}` : `prc-row-${idx}`,
            ticketId: undefined,
            mrnNumber: mrnNum,
            mrn: p.mrn || p.MRN,
            patientId: p.patientId || p.PatientId,
            patientName: p.patientName || p.PatientName || `Patient #${mrnNum}`,
            service: p.procedureName || 'Clinical Procedure',
            serviceCategory: 'Procedure',
            counter: p.doctorName ? `Dr. ${p.doctorName}` : 'Minor Procedure Room',
            status: 'Waiting',
            priority: 'Normal',
            priorityLevel: 2,
            assignedDoctor: p.doctorName || 'Attending Physician',
            time: p.createdAt || p.orderedAt || '',
            isDoctorService: true,
            isLabService: false
          };
        });

      // 4. Process Lab Queue (Phlebotomy & Results)
      const rawLab = Array.isArray(labData) ? labData : (labData?.data || []);
      const labList: QueueItem[] = rawLab
        .filter((l: any) => isToday(l.orderedAt || l.createdAt))
        .map((l: any, idx: number) => {
          const mrnNum = extractMrnNumber(l.mrn || l.MRN, l.patientId || l.id);
          const isResultReady = l.itemStatus === 4 || l.itemStatus === 5 || l.status === 'Completed' || l.status === 'Approved';
          const lid = l.id || l.Id || l.orderId || l.OrderId || l.orderItemId || l.OrderItemId || mrnNum;
          return {
            id: lid ? `lab-${lid}-${idx}` : `lab-row-${idx}`,
            ticketId: undefined,
            mrnNumber: mrnNum,
            mrn: l.mrn || l.MRN,
            patientId: l.patientId || l.PatientId,
            patientName: l.patientName || l.PatientName || `Patient #${mrnNum}`,
            service: isResultReady ? 'Lab Results Ready' : `${l.testName || 'Diagnostic Test'} (Phlebotomy)`,
            serviceCategory: 'Laboratory',
            counter: isResultReady ? 'Lab Results Desk' : 'Lab Phlebotomy Counter 1',
            status: 'Waiting',
            priority: l.priority === 1 ? 'Emergency' : 'Normal',
            priorityLevel: l.priority === 1 ? 1 : 2,
            assignedDoctor: '-',
            time: l.orderedAt || l.createdAt || '',
            isDoctorService: false,
            isLabService: true
          };
        });

      // Find if any ticket is currently Called
      const activeCalledTicket = liveList.find(t => t.status === 'Called');
      if (activeCalledTicket) {
        setCurrentCalled(activeCalledTicket);
      }

      // Deduplicate waiting list across streams
      const seenMrns = new Set<string>();
      if (activeCalledTicket) seenMrns.add(activeCalledTicket.mrnNumber);

      const combinedWaiting: QueueItem[] = [];
      [
        ...liveList.filter(t => t.status === 'Waiting'),
        ...procList,
        ...triageList,
        ...labList
      ].forEach(item => {
        if (!seenMrns.has(item.mrnNumber)) {
          seenMrns.add(item.mrnNumber);
          combinedWaiting.push(item);
        }
      });

      // Sort by Priority (1=Emergency first), then by time
      combinedWaiting.sort((a, b) => {
        if ((a.priorityLevel || 2) !== (b.priorityLevel || 2)) {
          return (a.priorityLevel || 2) - (b.priorityLevel || 2);
        }
        return 0;
      });

      setActiveWaitingList(combinedWaiting);
    } catch (err) {
      console.error('Failed to load queue board data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllQueues();
  }, [fetchAllQueues]);

  // Real-time broadcast sync across tabs
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('cms_queue_events');
      bc.onmessage = () => fetchAllQueues();
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cms_queue_last_event') fetchAllQueues();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      bc?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, [fetchAllQueues]);

  // Filter waiting list for current station
  const stationWaitingList = useMemo(() => {
    if (activeStation === 'doctor') {
      const doctorFiltered = activeWaitingList.filter(t => t.isDoctorService);
      // If logged-in user is a doctor (not admin), only show their assigned patients
      if (isDoctor && !isAdmin && currentUser) {
        const doctorName = currentUser.name || currentUser.firstName || currentUser.lastName || '';
        const doctorId = currentUser.doctorId || currentUser.id;
        const myPatients = doctorFiltered.filter(t => {
          if (!t.assignedDoctor || t.assignedDoctor === '-') return true; // Show unassigned too
          const aDoc = (t.assignedDoctor || '').toLowerCase();
          const myName = doctorName.toLowerCase();
          return aDoc.includes(myName) || myName.includes(aDoc) ||
            (doctorId && (aDoc.includes(String(doctorId)) || t.assignedDoctor === String(doctorId)));
        });
        // If filter yields nothing (assignedDoctor not populated), show all doctor items
        return myPatients.length > 0 ? myPatients : doctorFiltered;
      }
      return doctorFiltered;
    }
    if (activeStation === 'lab') {
      // Lab is always open to all staff — no doctor filter applied
      return activeWaitingList.filter(t => t.isLabService);
    }
    return activeWaitingList;
  }, [activeWaitingList, activeStation, isDoctor, isAdmin, currentUser]);

  // Helper to ensure a ticket exists in PatientQueues before calling
  const ensureQueueTicket = async (item: QueueItem): Promise<number> => {
    if (item.ticketId) return item.ticketId;
    try {
      const res: any = await api.post('/queue/checkin', {
        patientId: item.patientId || 1,
        serviceType: item.service,
        priorityLevel: item.priorityLevel || 2,
        notes: `Summoned from ${item.serviceCategory}`
      });
      if (res?.data?.ticketId || res?.ticketId) {
        return res?.data?.ticketId || res?.ticketId;
      }
      const liveData: any = await api.get('/queue/live');
      const liveList = Array.isArray(liveData) ? liveData : (liveData?.data || []);
      const found = liveList.find((l: any) =>
        extractMrnNumber(l.mrnNumber || l.MrnNumber || l.mrn || l.MRN, l.patientId) === item.mrnNumber
      );
      return found ? (found.id || found.Id) : (Date.now() % 100000);
    } catch (err) {
      console.warn('ensureQueueTicket fallback:', err);
      return Date.now() % 100000;
    }
  };

  // ACTION: CALL SPECIFIC TICKET
  const handleCallTicket = async (ticket: QueueItem) => {
    try {
      setActionLoading(true);

      const updatedTicket: QueueItem = {
        ...ticket,
        status: 'Called',
        counter: activeCounter
      };

      // 1. Set current called state for immediate UI response (Announcement is played on TV Display)
      setCurrentCalled(updatedTicket);

      // 3. Save to localStorage for instant cross-tab TV display sync
      const calledPayload = {
        mrnNumber: updatedTicket.mrnNumber,
        patientName: updatedTicket.patientName,
        service: updatedTicket.service,
        counter: activeCounter,
        isLab: updatedTicket.isLabService,
        isProcedure: updatedTicket.serviceCategory === 'Procedure',
        callTime: new Date().toISOString()
      };
      localStorage.setItem('cms_queue_current_called', JSON.stringify(calledPayload));

      // 4. Broadcast event across tabs
      broadcastQueueEvent('CALL_PATIENT', updatedTicket);

      // 5. Fail-safe backend sync
      try {
        const ticketDbId = await ensureQueueTicket(ticket);
        const staffId = currentUser?.id || 1;
        const counterId = counters.find(c => c.name === activeCounter)?.id || 1;

        await api.post('/queue/call', {
          ticketId: ticketDbId,
          counterId: counterId,
          staffId: staffId,
          stationType: activeStation
        }).catch(() => {});

        setCurrentCalled(prev => prev ? { ...prev, ticketId: ticketDbId } : prev);
      } catch (dbErr) {
        console.warn('Queue call backend sync failed:', dbErr);
      }

      await fetchAllQueues();
    } catch (err) {
      console.error('Call ticket failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ACTION: RECALL SPECIFIC TICKET
  const handleRecallTicket = async (ticket: QueueItem) => {
    try {
      setActionLoading(true);
      const updatedTicket: QueueItem = {
        ...ticket,
        status: 'Called',
        counter: activeCounter
      };

      // 1. Set current called state for immediate UI response (Announcement is played on TV Display)
      setCurrentCalled(updatedTicket);
      localStorage.setItem('cms_queue_current_called', JSON.stringify({
        mrnNumber: updatedTicket.mrnNumber,
        patientName: updatedTicket.patientName,
        service: updatedTicket.service,
        counter: activeCounter,
        isLab: updatedTicket.isLabService,
        isProcedure: updatedTicket.serviceCategory === 'Procedure',
        callTime: new Date().toISOString()
      }));

      // 3. Broadcast recall
      broadcastQueueEvent('RECALL_PATIENT', updatedTicket);

      // 4. Backend sync
      if (ticket.ticketId) {
        const staffId = currentUser?.id || 1;
        const counterId = counters.find(c => c.name === activeCounter)?.id || 1;
        await api.post('/queue/recall', {
          ticketId: ticket.ticketId,
          counterId: counterId,
          staffId: staffId
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Recall failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ACTION: COMPLETE SPECIFIC TICKET
  const handleCompleteTicket = async (ticket: QueueItem) => {
    try {
      setActionLoading(true);
      const staffId = currentUser?.id || 1;

      if (ticket.ticketId) {
        await api.post('/queue/complete', {
          ticketId: ticket.ticketId,
          staffId: staffId
        }).catch(() => {});
      }

      broadcastQueueEvent('COMPLETE_PATIENT', ticket);

      if (currentCalled?.mrnNumber === ticket.mrnNumber) {
        setCurrentCalled(null);
        localStorage.removeItem('cms_queue_current_called');
      }

      await fetchAllQueues();
    } catch (err) {
      console.error('Complete failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ACTION: CANCEL SPECIFIC TICKET
  const handleCancelTicket = async (ticket: QueueItem) => {
    if (!confirm(`Cancel or mark No-Show for Patient #${ticket.mrnNumber} (${ticket.patientName})?`)) return;

    try {
      setActionLoading(true);
      const staffId = currentUser?.id || 1;

      if (ticket.ticketId) {
        await api.post('/queue/cancel', {
          ticketId: ticket.ticketId,
          staffId: staffId,
          reason: 'No-Show / Cancelled at station'
        }).catch(() => {});
      }

      broadcastQueueEvent('CANCEL_PATIENT', ticket);

      if (currentCalled?.mrnNumber === ticket.mrnNumber) {
        setCurrentCalled(null);
        localStorage.removeItem('cms_queue_current_called');
      }

      await fetchAllQueues();
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ACTION: NEXT BUTTON
  const handleCallNext = async () => {
    if (stationWaitingList.length === 0) return;
    const nextTicket = stationWaitingList[0];
    await handleCallTicket(nextTicket);
  };

  return (
    <div>
      {/* FULL-SCREEN 60/40 WAITING ROOM TV SCREEN OVERLAY */}
      {tvMode && <WaitingRoomTvScreen onExit={() => setTvMode(false)} />}

      {/* TOP STATION CALLING HERO BANNER */}
      <div style={{
        padding: '24px 28px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.08), rgba(52, 199, 89, 0.08))',
        border: '1px solid rgba(0, 113, 227, 0.22)',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: '0.78rem', color: '#0071e3', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              CURRENTLY CALLING PATIENT
            </span>
            <span style={{
              fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12,
              background: 'rgba(0,113,227,0.12)', color: '#0071e3', fontWeight: 700
            }}>
              Station: {activeCounter}
            </span>
          </div>

          {currentCalled ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <span style={{
                  fontSize: 'clamp(2.4rem, 5vw, 3.6rem)', fontWeight: 900,
                  fontFamily: 'monospace', color: 'var(--text-main)', lineHeight: 1.1
                }}>
                  #{currentCalled.mrnNumber}
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {currentCalled.patientName}
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                <span>Service: <strong style={{ color: 'var(--text-main)' }}>{currentCalled.service}</strong></span>
                <span>•</span>
                <span>Proceed to: <strong style={{ color: '#0071e3' }}>{activeCounter}</strong></span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: '1rem', fontStyle: 'italic' }}>
              No patient currently called at this station. Click <strong>Next</strong> to summon the next patient.
            </div>
          )}
        </div>

        {/* Top Controls: Next, Launch TV, Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* NEXT BUTTON */}
          <button
            onClick={handleCallNext}
            disabled={stationWaitingList.length === 0 || actionLoading}
            className="btn-primary"
            style={{
              padding: '11px 20px', borderRadius: '12px', fontSize: '0.92rem',
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7,
              background: '#0071e3', borderColor: '#0071e3',
              opacity: stationWaitingList.length === 0 ? 0.6 : 1
            }}
            title="Call next waiting patient in line"
          >
            <Play size={16} fill="#fff" />
            <span>Next Patient ({stationWaitingList.length})</span>
          </button>

          {/* TV DISPLAY BUTTON */}
          <button
            onClick={() => setTvMode(true)}
            style={{
              padding: '11px 18px', borderRadius: '12px', fontSize: '0.88rem',
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7,
              background: 'linear-gradient(135deg, #022018, #064030)',
              color: '#34d399', border: '1px solid #10b981', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(6, 64, 48, 0.3)'
            }}
            title="Launch full-screen waiting room TV display"
          >
            <Tv size={16} color="#34d399" /> TV Display (Hospital Green)
          </button>

          {/* REFRESH BUTTON */}
          <button
            onClick={fetchAllQueues}
            className="btn-secondary"
            style={{ padding: '11px 13px', borderRadius: '12px' }}
            title="Refresh Queue"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* CONTROL & SWITCHER BAR */}
      <div className="glass-panel" style={{
        padding: '16px 20px', marginBottom: '20px', display: 'flex',
        justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
        flexWrap: 'wrap', gap: '14px', flexDirection: isMobile ? 'column' : 'row'
      }}>
        {/* Left: Active Station Room Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Active Room / Counter:
            </label>
            <select
              value={activeCounter}
              onChange={e => handleCounterChange(e.target.value)}
              style={{
                minWidth: '220px', padding: '8px 12px', borderRadius: '8px',
                border: '1px solid var(--border-color)', fontWeight: 600, fontSize: '0.85rem'
              }}
            >
              {stationCounters.map((name, idx) => (
                <option key={idx} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Station Switcher Tabs (Permission Protected) */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-main)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            {(isDoctor || isAdmin) && (
              <button
                onClick={() => setActiveStation('doctor')}
                style={{
                  padding: '6px 14px', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 700,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  background: activeStation === 'doctor' ? '#0071e3' : 'transparent',
                  color: activeStation === 'doctor' ? '#fff' : 'var(--text-secondary)'
                }}
              >
                <Stethoscope size={14} /> Doctor Station (Consultation &amp; Procedure)
              </button>
            )}

            {(isLabTech || isAdmin) && (
              <button
                onClick={() => setActiveStation('lab')}
                style={{
                  padding: '6px 14px', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 700,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  background: activeStation === 'lab' ? '#af52de' : 'transparent',
                  color: activeStation === 'lab' ? '#fff' : 'var(--text-secondary)'
                }}
              >
                <FlaskConical size={14} /> Laboratory Station (Phlebotomy &amp; Results)
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setActiveStation('all')}
                style={{
                  padding: '6px 14px', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 700,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  background: activeStation === 'all' ? '#334155' : 'transparent',
                  color: activeStation === 'all' ? '#fff' : 'var(--text-secondary)'
                }}
              >
                <ListOrdered size={14} /> All Stations ({activeWaitingList.length})
              </button>
            )}
          </div>
        </div>

        {/* Right: View Mode Tabs (Active Queue vs Completed Calls) */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveViewTab('active')}
            className={activeViewTab === 'active' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Clock size={15} /> Active Waiting Queue ({stationWaitingList.length})
          </button>
          <button
            onClick={() => setActiveViewTab('completed')}
            className={activeViewTab === 'completed' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CheckCircle size={15} /> Completed Calls Tab ({completedTickets.length})
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: ACTIVE WAITING QUEUE TABLE                       */}
      {/* ======================================================== */}
      {activeViewTab === 'active' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeStation === 'doctor' && <Stethoscope color="#0071e3" size={20} />}
                {activeStation === 'lab' && <FlaskConical color="#af52de" size={20} />}
                {activeStation === 'all' && <ListOrdered color="#334155" size={20} />}
                {activeStation === 'doctor' ? 'Doctor Calling Queue (Consultations & Clinical Procedures)' :
                 activeStation === 'lab' ? 'Laboratory Calling Queue (Phlebotomy / Sample Collection & Results)' :
                 'All Clinic Waiting Patients'} ({stationWaitingList.length})
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '3px' }}>
                Patients identified and summoned by their Medical Record Number (MRN). Order prioritized by urgency and arrival.
              </p>
            </div>
            {loading && <Loader2 size={18} className="animate-spin" color="#0071e3" />}
          </div>

          <div className="table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>MRN Number</th>
                  <th>Patient Name</th>
                  <th>Service Type</th>
                  <th>Category</th>
                  <th>Attending / Doctor</th>
                  <th>Priority</th>
                  <th style={{ width: '280px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stationWaitingList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No patients currently waiting for {activeStation === 'doctor' ? 'doctor consultation or procedure' : activeStation === 'lab' ? 'laboratory tests' : 'clinical stations'}.
                    </td>
                  </tr>
                ) : (
                  stationWaitingList.map((item, idx) => {
                    const isCurrentlyCalled = currentCalled?.mrnNumber === item.mrnNumber;
                    return (
                    <tr key={item.id ? `q-${item.id}-${idx}` : `q-row-${idx}`} style={{
                      background: isCurrentlyCalled ? 'rgba(0,113,227,0.06)' : idx === 0 ? 'rgba(0,113,227,0.02)' : undefined,
                      border: isCurrentlyCalled ? '1px solid rgba(0,113,227,0.3)' : undefined
                    }}>
                      <td>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem',
                          color: '#0071e3', letterSpacing: '0.04em'
                        }}>
                          #{item.mrnNumber}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.patientName}</td>
                      <td style={{ fontSize: '0.85rem' }}>{item.service}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                          background: item.serviceCategory === 'Procedure' ? 'rgba(6,182,212,0.12)' :
                                     item.serviceCategory === 'Laboratory' ? 'rgba(175,82,222,0.12)' : 'rgba(0,113,227,0.12)',
                          color: item.serviceCategory === 'Procedure' ? '#0891b2' :
                                 item.serviceCategory === 'Laboratory' ? '#af52de' : '#0071e3',
                          border: `1px solid ${item.serviceCategory === 'Procedure' ? 'rgba(6,182,212,0.3)' :
                                            item.serviceCategory === 'Laboratory' ? 'rgba(175,82,222,0.3)' : 'rgba(0,113,227,0.3)'}`
                        }}>
                          {item.serviceCategory}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.assignedDoctor}</td>
                      <td>
                        <span className={item.priority === 'Emergency' ? 'badge badge-critical' : (item.priority === 'VIP' || item.priority === 'Urgent' ? 'badge badge-warning' : 'badge badge-normal')}>
                          {item.priority}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* 1. CALL BUTTON */}
                          <button
                            onClick={() => handleCallTicket(item)}
                            disabled={actionLoading}
                            className={isCurrentlyCalled ? "btn-secondary" : "btn-primary"}
                            style={{
                              padding: '5px 11px', fontSize: '0.74rem', borderRadius: 7,
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: isCurrentlyCalled ? '#0284c7' : undefined,
                              color: isCurrentlyCalled ? '#fff' : undefined,
                              fontWeight: 700
                            }}
                            title={`Call patient #${item.mrnNumber} to ${activeCounter}`}
                          >
                            <Play size={11} fill="currentColor" /> {isCurrentlyCalled ? `Calling #${item.mrnNumber}` : `Call #${item.mrnNumber}`}
                          </button>

                          {/* 2. RECALL BUTTON */}
                          <button
                            onClick={() => handleRecallTicket(item)}
                            disabled={actionLoading}
                            className="btn-secondary"
                            style={{
                              padding: '5px 9px', fontSize: '0.74rem', borderRadius: 7,
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              color: '#0284c7', borderColor: 'rgba(2, 132, 199, 0.4)',
                              fontWeight: 600
                            }}
                            title={`Re-announce patient #${item.mrnNumber}`}
                          >
                            <RotateCcw size={11} /> Recall
                          </button>

                          {/* 3. COMPLETE BUTTON */}
                          <button
                            onClick={() => handleCompleteTicket(item)}
                            disabled={actionLoading}
                            className="btn-secondary"
                            style={{
                              padding: '5px 9px', fontSize: '0.74rem', borderRadius: 7,
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              color: '#16a34a', borderColor: '#86efac',
                              fontWeight: 600
                            }}
                            title={`Mark patient #${item.mrnNumber} call completed`}
                          >
                            <CheckCircle size={11} /> Complete
                          </button>

                          {/* 4. CANCEL BUTTON */}
                          <button
                            onClick={() => handleCancelTicket(item)}
                            disabled={actionLoading}
                            className="btn-secondary"
                            style={{
                              padding: '5px 9px', fontSize: '0.74rem', borderRadius: 7,
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              color: '#dc2626', borderColor: '#fca5a5',
                              fontWeight: 600
                            }}
                            title={`Cancel or mark No-Show for patient #${item.mrnNumber}`}
                          >
                            <XCircle size={11} /> Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: COMPLETED CALLS TAB                              */}
      {/* ======================================================== */}
      {activeViewTab === 'completed' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle color="#16a34a" size={20} /> Today's Completed Patient Calls ({completedTickets.length})
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '3px' }}>
                Historical log of all patients summoned and serviced today with timestamps and station attribution.
              </p>
            </div>
            <button
              onClick={fetchAllQueues}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Log
            </button>
          </div>

          <div className="table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>MRN Number</th>
                  <th>Patient Name</th>
                  <th>Service Type</th>
                  <th>Station / Room</th>
                  <th>Attending Staff</th>
                  <th>Called At</th>
                  <th>Completed At</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {completedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No calls marked completed yet today.
                    </td>
                  </tr>
                ) : (
                  completedTickets.map((c, idx) => (
                    <tr key={idx}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#16a34a', fontSize: '1rem' }}>
                          #{c.mrnNumber}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.patientName}</td>
                      <td style={{ fontSize: '0.85rem' }}>{c.serviceType}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                          background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-color)'
                        }}>
                          {c.counterName}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{c.staffName}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {c.callTime ? new Date(c.callTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {c.endTime ? new Date(c.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px',
                          background: (c.durationMinutes || 0) > 30 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                          color: (c.durationMinutes || 0) > 30 ? '#dc2626' : '#16a34a'
                        }}>
                          {c.durationMinutes ? `${c.durationMinutes} min` : '< 1 min'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
