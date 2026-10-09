import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Tv, Maximize2, Minimize2, X, Clock, Wifi, Activity,
  Volume2, VolumeX, Search, Play, RefreshCw, Stethoscope, FlaskConical, ExternalLink
} from 'lucide-react';
import { api } from '../../api/apiClient';
import { playTicketChimeAndSpeech, extractMrnNumber } from '../../utils/audioAnnouncer';

interface TvScreenProps {
  onExit: () => void;
}

interface CalledTicketInfo {
  mrnNumber: string;
  patientName: string;
  service: string;
  counter: string;
  callTime?: string;
  isDoctor?: boolean;
  isProcedure?: boolean;
  isLab?: boolean;
}

interface YouTubeTarget {
  type: 'video' | 'search' | 'home';
  target: string;
}

function parseYouTubeTarget(input: string): YouTubeTarget {
  const trimmed = (input || '').trim();
  if (
    !trimmed ||
    trimmed === 'https://www.youtube.com' ||
    trimmed === 'https://www.youtube.com/' ||
    trimmed === 'http://www.youtube.com' ||
    trimmed === 'youtube.com' ||
    trimmed === 'https://youtube.com'
  ) {
    return { type: 'home', target: '' };
  }
  // Direct video id match (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', target: trimmed };
  }
  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return { type: 'video', target: shortMatch[1] };
  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return { type: 'video', target: watchMatch[1] };
  // youtube.com/embed/ID
  const embedMatch = trimmed.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return { type: 'video', target: embedMatch[1] };
  // Search query match from URL
  const searchMatch = trimmed.match(/[?&]search_query=([^&]+)/);
  if (searchMatch) return { type: 'search', target: decodeURIComponent(searchMatch[1]) };

  // Treat any other string as a direct YouTube search query
  return { type: 'search', target: trimmed };
}

function getIframeSrc(type: 'video' | 'search' | 'home', target: string, muted: boolean): string {
  if (type === 'video') {
    return `https://www.youtube-nocookie.com/embed/${target}?autoplay=1&mute=${muted ? 1 : 0}&controls=1&rel=0&modestbranding=1`;
  }
  if (type === 'search') {
    return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(target)}&autoplay=1&mute=${muted ? 1 : 0}&controls=1&rel=0&modestbranding=1`;
  }
  return '';
}

export default function WaitingRoomTvScreen({ onExit }: TvScreenProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Media / YouTube State
  const [youtubeInput, setYoutubeInput] = useState(() => localStorage.getItem('cms_tv_youtube_url') || 'https://www.youtube.com');
  const [activeMedia, setActiveMedia] = useState<YouTubeTarget>(() =>
    parseYouTubeTarget(localStorage.getItem('cms_tv_youtube_url') || 'https://www.youtube.com')
  );
  const [isMuted, setIsMuted] = useState(true);
  const [showBrowserBar, setShowBrowserBar] = useState(true);

  // Queue State
  const [lastCalled, setLastCalled] = useState<CalledTicketInfo | null>(null);
  const [doctorQueue, setDoctorQueue] = useState<any[]>([]); // Merged Consultation & Procedure
  const [labQueue, setLabQueue] = useState<any[]>([]);       // Phlebotomy & Results
  const [isPulsing, setIsPulsing] = useState(false);
  const prevCalledNumberRef = useRef<string | null>(null);

  // Clock interval
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Screen WakeLock to prevent TV from turning off/sleeping
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // WakeLock unsupported or denied
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  // Fullscreen listener
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

  const handleApplyVideo = (urlToSet?: string) => {
    const target = urlToSet !== undefined ? urlToSet : youtubeInput;
    const parsed = parseYouTubeTarget(target);
    setActiveMedia(parsed);
    setYoutubeInput(target);
    localStorage.setItem('cms_tv_youtube_url', target);
  };

  const handleGoHome = () => {
    setActiveMedia({ type: 'home', target: '' });
    setYoutubeInput('https://www.youtube.com');
    localStorage.setItem('cms_tv_youtube_url', 'https://www.youtube.com');
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
        if (!d) return true; // Include if untimed today
        const dt = new Date(d);
        return !isNaN(dt.getTime()) &&
          dt.getFullYear() === now.getFullYear() &&
          dt.getMonth() === now.getMonth() &&
          dt.getDate() === now.getDate();
      };

      // 1. Process Live PatientQueues tickets
      const rawLive = Array.isArray(liveData) ? liveData : ((liveData as any)?.data || []);
      const liveTickets = rawLive.map((q: any) => {
        const mrnNum = extractMrnNumber(q.mrnNumber || q.MrnNumber || q.mrn || q.MRN, q.patientId || q.id);
        const sType = q.serviceType || q.ServiceType || 'Consultation';
        return {
          id: q.id || q.Id,
          mrnNumber: mrnNum,
          patientName: q.patientName || q.PatientName || `Patient #${mrnNum}`,
          service: sType,
          counter: q.counterName || q.CounterName || 'Station 1',
          status: (q.statusId ?? q.StatusId) === 2 ? 'Called' : 'Waiting',
          isProcedure: sType.toLowerCase().includes('procedure'),
          isLab: sType.toLowerCase().includes('lab') || sType.toLowerCase().includes('phleb')
        };
      });

      // 2. Triage Consultation Queue (Doctor)
      const rawTriage = Array.isArray(triageData) ? triageData : (triageData?.data || []);
      const triageTickets = rawTriage
        .filter((t: any) => isToday(t.triagedAt || t.createdAt))
        .map((t: any) => {
          const mrnNum = extractMrnNumber(t.mrn || t.MRN, t.patientId || t.id);
          return {
            id: `trg-${t.id || t.Id}`,
            mrnNumber: mrnNum,
            patientName: t.patientName || t.PatientName || `Patient #${mrnNum}`,
            service: 'Consultation',
            counter: t.assignedDoctorName ? `Dr. ${t.assignedDoctorName}` : 'Doctor Room',
            status: t.status === 'AssignedToDoctor' ? 'Waiting' : 'Waiting',
            isProcedure: false,
            isLab: false
          };
        });

      // 3. Clinical Procedure Queue (Merged Doctor)
      const rawProc = Array.isArray(procData) ? procData : (procData?.data || []);
      const procTickets = rawProc
        .filter((p: any) => isToday(p.createdAt || p.orderedAt))
        .map((p: any) => {
          const mrnNum = extractMrnNumber(p.mrn || p.MRN, p.patientId || p.id);
          return {
            id: `prc-${p.id || p.Id}`,
            mrnNumber: mrnNum,
            patientName: p.patientName || p.PatientName || `Patient #${mrnNum}`,
            service: p.procedureName || 'Clinical Procedure',
            counter: p.doctorName ? `Dr. ${p.doctorName}` : 'Procedure Room',
            status: 'Waiting',
            isProcedure: true,
            isLab: false
          };
        });

      // 4. Lab Queue (Phlebotomy / Sample Collection & Results)
      const rawLab = Array.isArray(labData) ? labData : (labData?.data || []);
      const labTickets = rawLab
        .filter((l: any) => isToday(l.orderedAt || l.createdAt))
        .map((l: any) => {
          const mrnNum = extractMrnNumber(l.mrn || l.MRN, l.patientId || l.id);
          const isResultReady = l.itemStatus === 4 || l.itemStatus === 5 || l.status === 'Completed' || l.status === 'Approved';
          return {
            id: `lab-${l.id || l.orderId}`,
            mrnNumber: mrnNum,
            patientName: l.patientName || l.PatientName || `Patient #${mrnNum}`,
            service: isResultReady ? 'Lab Results Ready' : 'Phlebotomy / Sample Collection',
            counter: isResultReady ? 'Lab Results Counter' : 'Lab Phlebotomy Counter',
            status: 'Waiting',
            isProcedure: false,
            isLab: true
          };
        });

      // Check if any live ticket is currently Called
      const activeCalled = liveTickets.find((t: any) => t.status === 'Called');
      if (activeCalled && activeCalled.mrnNumber !== prevCalledNumberRef.current) {
        prevCalledNumberRef.current = activeCalled.mrnNumber;
        setLastCalled({
          mrnNumber: activeCalled.mrnNumber,
          patientName: activeCalled.patientName,
          service: activeCalled.service,
          counter: activeCalled.counter,
          isDoctor: !activeCalled.isLab,
          isLab: activeCalled.isLab
        });
        setIsPulsing(true);
        playTicketChimeAndSpeech(activeCalled.mrnNumber, activeCalled.counter, activeCalled.patientName);
        setTimeout(() => setIsPulsing(false), 4000);
      } else if (!lastCalled && liveTickets.length > 0) {
        setLastCalled({
          mrnNumber: liveTickets[0].mrnNumber,
          patientName: liveTickets[0].patientName,
          service: liveTickets[0].service,
          counter: liveTickets[0].counter,
          isDoctor: !liveTickets[0].isLab,
          isLab: liveTickets[0].isLab
        });
        prevCalledNumberRef.current = liveTickets[0].mrnNumber;
      }

      // Merged Doctor Queue = Live Doctor Waiting + Triage Waiting + Procedure Waiting (deduplicated by mrnNumber)
      const seenDoctorMrns = new Set<string>();
      const combinedDoctorList: any[] = [];
      [
        ...liveTickets.filter((t: any) => t.status === 'Waiting' && !t.isLab),
        ...procTickets,
        ...triageTickets
      ].forEach((item: any) => {
        if (!seenDoctorMrns.has(item.mrnNumber)) {
          seenDoctorMrns.add(item.mrnNumber);
          combinedDoctorList.push(item);
        }
      });

      // Lab Queue = Live Lab Waiting + Lab Orders Waiting (deduplicated by mrnNumber)
      const seenLabMrns = new Set<string>();
      const combinedLabList: any[] = [];
      [
        ...liveTickets.filter((t: any) => t.status === 'Waiting' && t.isLab),
        ...labTickets
      ].forEach((item: any) => {
        if (!seenLabMrns.has(item.mrnNumber)) {
          seenLabMrns.add(item.mrnNumber);
          combinedLabList.push(item);
        }
      });

      setDoctorQueue(combinedDoctorList);
      setLabQueue(combinedLabList);
    } catch (err) {
      console.error('TV Queue sync error:', err);
    }
  }, [lastCalled]);

  // Polling Interval
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 6000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Instant Cross-Tab Sync via BroadcastChannel & Storage Event
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('cms_queue_events');
      bc.onmessage = () => fetchQueue();
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cms_queue_last_event') fetchQueue();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      bc?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, [fetchQueue]);

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const totalWaiting = doctorQueue.length + labQueue.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(165deg, #090e1a 0%, #0d1728 50%, #0a1120 100%)',
      color: '#ffffff', display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
      overflow: 'hidden', userSelect: 'none'
    }}>
      {/* TOP HEADER BAR */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
        height: '62px', boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #0071e3 0%, #34c759 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,113,227,0.3)'
          }}>
            <Tv size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.98rem', letterSpacing: '0.04em', color: '#f8fafc' }}>
              HUDERMA CLINIC &amp; CENTRAL LABORATORY — LIVE QUEUE
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
              Waiting Room Smart Display • Auto-refreshes in real-time
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
            <Wifi size={14} color="#34c759" />
            <span>Free Guest Wi-Fi: <strong style={{ color: '#34c759' }}>HudermaGuest</strong></span>
          </div>

          <div style={{
            padding: '5px 14px', borderRadius: 20,
            background: totalWaiting > 0 ? 'rgba(0,113,227,0.22)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${totalWaiting > 0 ? 'rgba(0,113,227,0.45)' : 'rgba(255,255,255,0.12)'}`,
            fontSize: '0.8rem', fontWeight: 700, color: totalWaiting > 0 ? '#60a5fa' : 'rgba(255,255,255,0.5)'
          }}>
            <Activity size={13} style={{ display: 'inline', marginRight: 6 }} />
            {totalWaiting} Patients Waiting
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1, color: '#f1f5f9' }}>
              {fmtTime(currentTime)}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {fmtDate(currentTime)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 8, padding: '7px 12px', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <button
              onClick={onExit}
              style={{
                background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 8, padding: '7px 12px', color: '#f87171', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600
              }}
            >
              <X size={14} /> Exit
            </button>
          </div>
        </div>
      </div>

      {/* MAIN SCREEN SPLIT: 60% YOUTUBE/MINI-BROWSER | 40% QUEUE BOARD */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ======================================================== */}
        {/* LEFT 60%: YOUTUBE PLAYER & MINI-BROWSER AREA             */}
        {/* ======================================================== */}
        <div style={{
          flex: '0 0 60%', width: '60%', display: 'flex', flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          background: '#040711', position: 'relative'
        }}>
          {/* Mini-Browser Top Controls Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
            background: 'rgba(15,23,42,0.85)', borderBottom: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.78rem'
          }}>
            {/* YouTube Logo / Home Button */}
            <button
              onClick={handleGoHome}
              title="Return to YouTube Home / Search"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700,
                color: '#ff0000', fontSize: '0.8rem', background: 'transparent',
                border: 'none', cursor: 'pointer', padding: 0
              }}
            >
              <span style={{
                background: '#ff0000', color: '#fff', padding: '2px 6px', borderRadius: 4,
                fontSize: '0.62rem', fontWeight: 900
              }}>▶ LIVE</span>
              <span>YouTube</span>
            </button>

            {/* URL / Search Input */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, padding: '4px 10px'
              }}>
                <Search size={13} color="#94a3b8" />
                <input
                  type="text"
                  value={youtubeInput === 'https://www.youtube.com' ? '' : youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleApplyVideo(); }}
                  placeholder="Search YouTube or paste video URL..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color: '#fff', fontSize: '0.75rem', outline: 'none'
                  }}
                />
              </div>
              <button
                onClick={() => handleApplyVideo()}
                title="Search / Load Video"
                style={{
                  background: '#0071e3', border: 'none', borderRadius: 6, padding: '5px 12px',
                  color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem',
                  display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap'
                }}
              >
                <Search size={12} /> Search
              </button>
            </div>

            {/* Direct Link to YouTube */}
            <a
              href="https://www.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Open YouTube Homepage in new tab"
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, padding: '5px 9px', color: '#cbd5e1', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', whiteSpace: 'nowrap'
              }}
            >
              <ExternalLink size={12} /> youtube.com
            </a>

            {/* Mute/Unmute Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute Video Audio' : 'Mute Video Audio'}
              style={{
                background: isMuted ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.25)',
                border: `1px solid ${isMuted ? 'rgba(255,255,255,0.15)' : 'rgba(34,197,94,0.5)'}`,
                borderRadius: 6, padding: '5px 10px', color: isMuted ? '#94a3b8' : '#4ade80',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 600
              }}
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              {isMuted ? 'Muted' : 'Unmuted'}
            </button>
          </div>

          {/* YouTube Screen (Home/Search or Embedded Player) */}
          {activeMedia.type === 'home' ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(ellipse at center, rgba(30,41,59,0.85) 0%, rgba(3,7,18,0.98) 100%)',
              padding: '30px', textAlign: 'center'
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 72, height: 50, background: '#ff0000', borderRadius: 14, marginBottom: 16,
                boxShadow: '0 8px 24px rgba(255,0,0,0.4)'
              }}>
                <Play size={28} fill="#ffffff" color="#ffffff" style={{ marginLeft: 3 }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>
                YouTube Waiting Room Screen
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: 440, marginBottom: 24, lineHeight: 1.5 }}>
                Search any topic, health tip, relaxing music, or paste a video link to stream on this TV.
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleApplyVideo();
                }}
                style={{ display: 'flex', width: '100%', maxWidth: 460, gap: 8 }}
              >
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8, padding: '8px 14px'
                }}>
                  <Search size={16} color="#94a3b8" />
                  <input
                    type="text"
                    value={youtubeInput === 'https://www.youtube.com' ? '' : youtubeInput}
                    onChange={(e) => setYoutubeInput(e.target.value)}
                    placeholder="Search YouTube (e.g. relaxation music, clinic ambient)..."
                    autoFocus
                    style={{
                      flex: 1, background: 'transparent', border: 'none', color: '#ffffff',
                      fontSize: '0.85rem', outline: 'none'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    background: '#ff0000', border: 'none', borderRadius: 8, padding: '0 20px',
                    color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 4px 14px rgba(255,0,0,0.35)'
                  }}
                >
                  <Search size={14} /> Search
                </button>
              </form>

              <div style={{ marginTop: 22 }}>
                <a
                  href="https://www.youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    color: '#38bdf8', fontSize: '0.78rem', textDecoration: 'none',
                    padding: '6px 14px', borderRadius: 6, background: 'rgba(56,189,248,0.1)',
                    border: '1px solid rgba(56,189,248,0.25)'
                  }}
                >
                  <ExternalLink size={13} /> Open youtube.com in browser
                </a>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
              <iframe
                key={`${activeMedia.type}-${activeMedia.target}-${isMuted ? 'muted' : 'unmuted'}`}
                src={getIframeSrc(activeMedia.type, activeMedia.target, isMuted)}
                title="Waiting Room Video Screen"
                style={{
                  width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* RIGHT 40%: QUEUE BOARD (NOW CALLING & UPCOMING MATRIX)   */}
        {/* ======================================================== */}
        <div style={{
          flex: '0 0 40%', width: '40%', display: 'flex', flexDirection: 'column',
          background: 'rgba(11,18,34,0.92)', overflow: 'hidden'
        }}>

          {/* HERO BANNER: NOW CALLING (Large MRN Number) */}
          <div style={{
            padding: '24px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            background: 'radial-gradient(ellipse at top, rgba(0,113,227,0.18) 0%, rgba(0,0,0,0.3) 70%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            position: 'relative'
          }}>
            <div style={{
              fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.22em',
              color: '#93c5fd', marginBottom: 8, textTransform: 'uppercase'
            }}>
              — NOW CALLING —
            </div>

            {lastCalled ? (
              <>
                {/* Large MRN Number Display */}
                <div style={{
                  fontSize: '5.4rem', fontWeight: 900, fontFamily: 'monospace',
                  lineHeight: 1, color: '#ffffff',
                  textShadow: isPulsing
                    ? '0 0 40px rgba(0,113,227,1), 0 0 80px rgba(52,199,89,0.8)'
                    : '0 0 25px rgba(0,113,227,0.4)',
                  transition: 'text-shadow 0.3s ease',
                  textAlign: 'center', margin: '4px 0 8px'
                }}>
                  #{lastCalled.mrnNumber}
                </div>

                {/* Patient Name */}
                <div style={{
                  fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc',
                  textAlign: 'center', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {lastCalled.patientName}
                </div>

                {/* Service Tag & Destination Counter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20,
                    background: lastCalled.isLab ? 'rgba(175,82,222,0.25)' : 'rgba(0,113,227,0.25)',
                    border: `1px solid ${lastCalled.isLab ? '#af52de' : '#0071e3'}`,
                    fontSize: '0.78rem', fontWeight: 800,
                    color: lastCalled.isLab ? '#d8b4fe' : '#93c5fd'
                  }}>
                    {lastCalled.isLab ? '🔬 Laboratory' : (lastCalled.isProcedure ? '💉 Procedure' : '🩺 Consultation')}
                  </span>

                  <span style={{
                    padding: '4px 14px', borderRadius: 20,
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(0,113,227,0.3))',
                    border: '1px solid rgba(34,197,94,0.6)',
                    fontSize: '0.85rem', fontWeight: 800, color: '#4ade80'
                  }}>
                    ➜ {lastCalled.counter}
                  </span>
                </div>

                {/* Blinking Call Indicator */}
                {isPulsing && (
                  <div style={{
                    marginTop: 10, fontSize: '0.82rem', fontWeight: 800, color: '#22c55e',
                    animation: 'tvBlink 0.6s steps(1) infinite'
                  }}>
                    🔊 PLEASE PROCEED TO STATION
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                <Clock size={38} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div style={{ fontSize: '0.9rem' }}>Awaiting first patient call...</div>
              </div>
            )}
          </div>

          {/* LOWER SECTION: UPCOMING QUEUE MATRIX */}
          <div style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr 1fr', overflow: 'hidden' }}>

            {/* ROW 1: DOCTOR (CONSULTATION & PROCEDURE MERGED) */}
            <div style={{
              padding: '12px 16px', display: 'flex', flexDirection: 'column',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                paddingBottom: 6, borderBottom: '2px solid rgba(0,113,227,0.3)'
              }}>
                <Stethoscope size={16} color="#38bdf8" />
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>
                  DOCTOR ROOMS (CONSULTATION &amp; PROCEDURE)
                </span>
                <span style={{
                  marginLeft: 'auto', padding: '2px 8px', borderRadius: 12,
                  background: 'rgba(0,113,227,0.2)', border: '1px solid rgba(0,113,227,0.4)',
                  fontSize: '0.7rem', fontWeight: 800, color: '#60a5fa'
                }}>
                  {doctorQueue.length} Waiting
                </span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {doctorQueue.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', paddingTop: 14 }}>
                    No patients currently waiting for doctor consultation or procedure
                  </div>
                ) : (
                  doctorQueue.slice(0, 5).map((t, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 10px', borderRadius: 7,
                      background: idx === 0 ? 'rgba(0,113,227,0.18)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${idx === 0 ? 'rgba(0,113,227,0.45)' : 'rgba(255,255,255,0.06)'}`
                    }}>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem',
                        color: idx === 0 ? '#38bdf8' : '#ffffff', minWidth: 65
                      }}>
                        #{t.mrnNumber}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.patientName}
                      </span>
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                        background: t.isProcedure ? 'rgba(6,182,212,0.25)' : 'rgba(59,130,246,0.25)',
                        color: t.isProcedure ? '#22d3ee' : '#93c5fd'
                      }}>
                        {t.isProcedure ? 'Procedure' : 'Consultation'}
                      </span>
                      {idx === 0 && (
                        <span style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: 800 }}>NEXT›</span>
                      )}
                    </div>
                  ))
                )}
                {doctorQueue.length > 5 && (
                  <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', paddingTop: 2 }}>
                    +{doctorQueue.length - 5} more patients waiting in queue…
                  </div>
                )}
              </div>
            </div>

            {/* ROW 2: LABORATORY (PHLEBOTOMY / RESULTS) */}
            <div style={{
              padding: '12px 16px', display: 'flex', flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                paddingBottom: 6, borderBottom: '2px solid rgba(175,82,222,0.3)'
              }}>
                <FlaskConical size={16} color="#c084fc" />
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#c084fc', letterSpacing: '0.04em' }}>
                  CENTRAL LABORATORY (PHLEBOTOMY &amp; RESULTS)
                </span>
                <span style={{
                  marginLeft: 'auto', padding: '2px 8px', borderRadius: 12,
                  background: 'rgba(175,82,222,0.2)', border: '1px solid rgba(175,82,222,0.4)',
                  fontSize: '0.7rem', fontWeight: 800, color: '#c084fc'
                }}>
                  {labQueue.length} Waiting
                </span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {labQueue.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', paddingTop: 14 }}>
                    No patients currently waiting in laboratory queue
                  </div>
                ) : (
                  labQueue.slice(0, 5).map((l, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 10px', borderRadius: 7,
                      background: idx === 0 ? 'rgba(175,82,222,0.18)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${idx === 0 ? 'rgba(175,82,222,0.45)' : 'rgba(255,255,255,0.06)'}`
                    }}>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem',
                        color: idx === 0 ? '#c084fc' : '#ffffff', minWidth: 65
                      }}>
                        #{l.mrnNumber}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.patientName}
                      </span>
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                        background: l.service.includes('Result') ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)',
                        color: l.service.includes('Result') ? '#4ade80' : '#c084fc'
                      }}>
                        {l.service.includes('Result') ? 'Results' : 'Sample Collection'}
                      </span>
                      {idx === 0 && (
                        <span style={{ fontSize: '0.62rem', color: '#c084fc', fontWeight: 800 }}>NEXT›</span>
                      )}
                    </div>
                  ))
                )}
                {labQueue.length > 5 && (
                  <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', paddingTop: 2 }}>
                    +{labQueue.length - 5} more patients waiting in queue…
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* BOTTOM MARQUEE TICKER */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.5)', padding: '6px 0', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', gap: '80px', whiteSpace: 'nowrap',
          animation: 'tvMarquee 38s linear infinite', fontSize: '0.76rem',
          color: 'rgba(255,255,255,0.65)', fontWeight: 500, paddingLeft: '100%'
        }}>
          {[
            '🏥 Welcome to Huderma Specialized Clinic & Central Laboratory — Your health is our top priority.',
            '🔔 Please listen carefully for your MRN Number announcement on the speaker.',
            '📶 Free High-Speed Wi-Fi available: HudermaGuest (No password required).',
            '💉 Clinical Procedures & Minor Surgeries: Located in Procedure Room 1.',
            '🔬 Laboratory Samples: Proceed to Counter 1 or 2 upon your number being called.',
            '📋 Medical Records & Invoicing: Reception Desk • Working Hours: 8:00 AM – 6:30 PM.',
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
