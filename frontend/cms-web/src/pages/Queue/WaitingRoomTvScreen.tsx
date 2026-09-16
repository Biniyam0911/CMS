import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tv, Maximize2, Minimize2, X, Clock, Wifi, Activity } from 'lucide-react';
import { api } from '../../api/apiClient';
import { playTicketChimeAndSpeech } from '../../utils/audioAnnouncer';

interface TvScreenProps {
  onExit: () => void;
}

const COLUMNS = [
  { key: 'doctor', label: '🩺 Doctor Rooms', deptColor: '#0071e3' },
  { key: 'triage', label: '⚕️ Triage / Nursing', deptColor: '#ff9500' },
  { key: 'lab', label: '🔬 Lab / Phlebotomy', deptColor: '#af52de' },
  { key: 'procedure', label: '💉 Procedure Room', deptColor: '#06b6d4' },
];

export default function WaitingRoomTvScreen({ onExit }: TvScreenProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastCalled, setLastCalled] = useState<{ token: string; counter: string; patient?: string } | null>(null);
  const [queueByDept, setQueueByDept] = useState<Record<string, any[]>>({
    doctor: [], triage: [], lab: [], procedure: []
  });
  const [isPulsing, setIsPulsing] = useState(false);
  const prevCalledRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const fetchQueue = useCallback(async () => {
    try {
      const todayIsoDate = new Date().toISOString().split('T')[0];
      const [liveData, triageData, labData, procData] = await Promise.all([
        api.get<any[]>(`/queue/live?date=${todayIsoDate}`).catch(() => []),
        api.get<any>(`/triage/queue?date=${todayIsoDate}`).catch(() => []),
        api.get<any>(`/lab/orders?date=${todayIsoDate}`).catch(() =>
          api.get<any>(`/lab/worklist?date=${todayIsoDate}`).catch(() => [])),
        api.get<any>(`/procedures/queue?date=${todayIsoDate}`).catch(() => []),
      ]);

      const now = new Date();
      const isToday = (d: any) => {
        if (!d) return false;
        const dt = new Date(d);
        return !isNaN(dt.getTime()) &&
          dt.getFullYear() === now.getFullYear() &&
          dt.getMonth() === now.getMonth() &&
          dt.getDate() === now.getDate();
      };

      const raw = Array.isArray(liveData) ? liveData : ((liveData as any)?.data || []);
      const doctorTickets = raw
        .filter((q: any) => isToday(q.checkInTime || q.createdAt || q.tokenDate))
        .map((q: any) => ({
          token: q.tokenNumber || q.TokenNumber || `A-${String(q.id).padStart(3, '0')}`,
          patient: (q.patientName || q.PatientName || 'Patient').split(' ')[0],
          priority: q.priorityLevel === 1 ? 'EMRG' : (q.priorityLevel === 3 ? 'VIP' : ''),
          status: (q.statusId ?? q.StatusId) === 2 ? 'Called' : 'Waiting',
        }));

      const calledTicket = doctorTickets.find((t: any) => t.status === 'Called');
      if (calledTicket && calledTicket.token !== prevCalledRef.current) {
        prevCalledRef.current = calledTicket.token;
        setLastCalled({ token: calledTicket.token, counter: 'Doctor Room', patient: calledTicket.patient });
        setIsPulsing(true);
        playTicketChimeAndSpeech(calledTicket.token, 'Doctor Room');
        setTimeout(() => setIsPulsing(false), 3000);
      }
      if (!prevCalledRef.current && doctorTickets.length > 0) {
        setLastCalled({ token: doctorTickets[0].token, counter: 'Doctor Room', patient: doctorTickets[0].patient });
        prevCalledRef.current = doctorTickets[0].token;
      }

      const rawTriage = Array.isArray(triageData) ? triageData : (triageData?.data || []);
      const triageWaiting = rawTriage
        .filter((t: any) => isToday(t.triagedAt || t.createdAt))
        .map((t: any) => ({
          token: t.tokenNumber || `TRG-${t.id}`,
          patient: (t.patientName || `Pt-${t.patientId || t.id}`).split(' ')[0],
          priority: t.priorityLevel === 1 ? 'EMRG' : '',
        }));

      const rawLab = Array.isArray(labData) ? labData : (labData?.data || []);
      const labWaiting = rawLab
        .filter((l: any) => isToday(l.orderedAt || l.createdAt))
        .map((l: any) => ({
          token: l.orderNumber || `LAB-${l.id || l.orderId}`,
          patient: (l.patientName || `Pt-${l.patientId}`).split(' ')[0],
          priority: l.priority === 1 ? 'STAT' : '',
        }));

      const rawProc = Array.isArray(procData) ? procData : (procData?.data || []);
      const procWaiting = rawProc
        .filter((p: any) => isToday(p.createdAt || p.orderedAt))
        .map((p: any) => ({
          token: `PRC-${p.id}`,
          patient: (p.patientName || `Pt-${p.patientId}`).split(' ')[0],
          priority: '',
        }));

      setQueueByDept({
        doctor: doctorTickets.filter((t: any) => t.status === 'Waiting'),
        triage: triageWaiting,
        lab: labWaiting,
        procedure: procWaiting,
      });
    } catch (err) {
      console.error('TV screen poll error:', err);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const totalWaiting = Object.values(queueByDept).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #0a0f1e 0%, #0d1a2e 50%, #0a1020 100%)',
      color: '#ffffff', display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif",
      overflow: 'hidden',
    }}>
      {/* TOP BAR */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 28px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #0071e3, #34c759)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Tv size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.05em' }}>
              SPECIALTY CLINIC — LIVE QUEUE DISPLAY
            </div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
              Waiting Room Public Screen • Auto-refreshes every 10s
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
            <Wifi size={14} color="#34c759" />
            <span>Free Wi-Fi: <strong style={{ color: '#34c759' }}>ClinicGuest</strong></span>
          </div>
          <div style={{
            padding: '4px 14px', borderRadius: 20,
            background: totalWaiting > 0 ? 'rgba(0,113,227,0.25)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${totalWaiting > 0 ? 'rgba(0,113,227,0.5)' : 'rgba(255,255,255,0.15)'}`,
            fontSize: '0.78rem', fontWeight: 700, color: totalWaiting > 0 ? '#5eabff' : 'rgba(255,255,255,0.4)'
          }}>
            <Activity size={12} style={{ display: 'inline', marginRight: 5 }} />
            {totalWaiting} Waiting
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1 }}>
              {fmtTime(currentTime)}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {fmtDate(currentTime)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={toggleFullscreen}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem' }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Exit FS' : 'Fullscreen'}
            </button>
            <button
              onClick={onExit}
              style={{ background: 'rgba(255,59,48,0.2)', border: '1px solid rgba(255,59,48,0.4)', borderRadius: 8, padding: '6px 10px', color: '#ff3b30', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem' }}
            >
              <X size={14} /> Exit
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT: Now Calling */}
        <div style={{
          width: '38%', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 28,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.2)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', width: 340, height: 340, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,113,227,0.15) 0%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }} />

          <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', marginBottom: 16, textAlign: 'center' }}>
            — NOW CALLING —
          </div>

          {lastCalled ? (
            <>
              <div style={{
                fontSize: '7rem', fontWeight: 900, fontFamily: 'monospace',
                lineHeight: 1, color: '#ffffff',
                textShadow: isPulsing
                  ? '0 0 50px rgba(0,113,227,1), 0 0 100px rgba(0,113,227,0.6)'
                  : '0 0 20px rgba(0,113,227,0.35)',
                transition: 'text-shadow 0.4s ease',
                textAlign: 'center',
              }}>
                {lastCalled.token}
              </div>
              {lastCalled.patient && (
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginTop: 8, textAlign: 'center' }}>
                  {lastCalled.patient}
                </div>
              )}
              <div style={{
                marginTop: 20, padding: '10px 28px', borderRadius: 40,
                background: 'linear-gradient(135deg, rgba(0,113,227,0.3), rgba(52,199,89,0.25))',
                border: '1px solid rgba(0,113,227,0.5)',
                fontSize: '1rem', fontWeight: 700, color: '#5eabff',
                textAlign: 'center',
              }}>
                ➜ Proceed to: {lastCalled.counter}
              </div>
              {isPulsing && (
                <div style={{ marginTop: 14, fontSize: '0.85rem', fontWeight: 700, color: '#34c759', animation: 'tvBlink 0.5s steps(1) infinite' }}>
                  🔊 PLEASE PROCEED NOW
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '1.1rem' }}>
              <Clock size={48} style={{ margin: '0 auto 16px', opacity: 0.25 }} />
              Awaiting first patient call…
            </div>
          )}

          <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)' }}>
            Please listen for your token number announcement
          </div>
        </div>

        {/* RIGHT: Queue Matrix */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }}>
          {COLUMNS.map((col, ci) => {
            const tickets = queueByDept[col.key] || [];
            return (
              <div key={col.key} style={{
                padding: '16px 18px',
                borderBottom: ci < 2 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                borderRight: ci % 2 === 0 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                background: 'rgba(255,255,255,0.01)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${col.deptColor}25` }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: col.deptColor }} />
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', color: col.deptColor }}>
                    {col.label}
                  </div>
                  <div style={{ marginLeft: 'auto', padding: '2px 9px', borderRadius: 10, background: `${col.deptColor}20`, border: `1px solid ${col.deptColor}35`, fontSize: '0.68rem', fontWeight: 700, color: col.deptColor }}>
                    {tickets.length}
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {tickets.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: '0.75rem', paddingTop: 16 }}>No patients waiting</div>
                  ) : (
                    tickets.slice(0, 7).map((t: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 7,
                        background: i === 0 ? `${col.deptColor}18` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${i === 0 ? col.deptColor + '35' : 'rgba(255,255,255,0.05)'}`,
                      }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.95rem', color: i === 0 ? col.deptColor : '#fff', minWidth: 64 }}>
                          {t.token}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', flex: 1 }}>{t.patient}</span>
                        {t.priority && (
                          <span style={{ fontSize: '0.55rem', fontWeight: 800, padding: '2px 5px', borderRadius: 4, background: t.priority === 'EMRG' ? '#ff3b30' : (t.priority === 'STAT' ? '#ff9500' : '#5856d6'), color: '#fff' }}>
                            {t.priority}
                          </span>
                        )}
                        {i === 0 && <span style={{ fontSize: '0.6rem', color: col.deptColor, fontWeight: 700 }}>NEXT›</span>}
                      </div>
                    ))
                  )}
                  {tickets.length > 7 && (
                    <div style={{ textAlign: 'center', fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', paddingTop: 3 }}>
                      +{tickets.length - 7} more…
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM MARQUEE */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)', padding: '7px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '80px', whiteSpace: 'nowrap', animation: 'tvMarquee 35s linear infinite', fontSize: '0.76rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, paddingLeft: '100%' }}>
          {[
            '🏥 Welcome to Specialty Clinic — Your health is our priority.',
            '📶 Free Wi-Fi: ClinicGuest (No password required)',
            '🔔 Please listen carefully for your token number to be called.',
            '🚑 In an emergency, notify the triage nurse immediately.',
            '💊 Pharmacy services available at Counter 3.',
            '📞 Reception: +251 911 000 000 • Hours: 8AM – 6PM, Mon–Sat',
          ].map((msg, i) => <span key={i}>{msg}</span>)}
        </div>
      </div>

      <style>{`
        @keyframes tvMarquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        @keyframes tvBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
