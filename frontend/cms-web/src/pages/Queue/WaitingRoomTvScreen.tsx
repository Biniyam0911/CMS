import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Tv, Maximize2, Minimize2, X, Clock, Wifi, Activity,
  Volume2, VolumeX, Search, Play, RefreshCw, Stethoscope, FlaskConical,
  Globe, Film, FolderOpen, ArrowLeft, ArrowRight, RotateCw, ExternalLink, Music, HeartPulse
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

type TvMediaTab = 'youtube' | 'browser' | 'mediaplayer';

function parseYouTubeEmbedUrl(input: string, muted: boolean): string {
  const trimmed = (input || '').trim();
  const muteParam = muted ? '1' : '0';
  const base = 'https://www.youtube-nocookie.com/embed';
  const extra = `autoplay=1&mute=${muteParam}&controls=1&rel=0&modestbranding=1`;

  if (!trimmed || trimmed === 'default') {
    return `${base}?listType=search&list=relaxing+clinic+waiting+room+music&${extra}`;
  }

  // Direct 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `${base}/${trimmed}?${extra}`;
  }

  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return `${base}/${shortMatch[1]}?${extra}`;

  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return `${base}/${watchMatch[1]}?${extra}`;

  // youtube.com/embed/ID
  const embedMatch = trimmed.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return `${base}/${embedMatch[1]}?${extra}`;

  // Treat as search query
  return `${base}?listType=search&list=${encodeURIComponent(trimmed)}&${extra}`;
}

export default function WaitingRoomTvScreen({ onExit }: TvScreenProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Media Tabs: 'youtube' | 'browser' | 'mediaplayer'
  const [activeMediaTab, setActiveMediaTab] = useState<TvMediaTab>(
    () => (localStorage.getItem('cms_tv_active_tab') as TvMediaTab) || 'youtube'
  );

  // YouTube State
  const [youtubeQuery, setYoutubeQuery] = useState(() => localStorage.getItem('cms_tv_yt_query') || 'relaxing clinic music');
  const [isYoutubeMuted, setIsYoutubeMuted] = useState(true);
  const [youtubeEmbedSrc, setYoutubeEmbedSrc] = useState(() =>
    parseYouTubeEmbedUrl(localStorage.getItem('cms_tv_yt_query') || 'relaxing clinic music', true)
  );

  // Browser State
  const [browserUrl, setBrowserUrl] = useState(() => localStorage.getItem('cms_tv_browser_url') || 'https://www.wikipedia.org');
  const [browserInput, setBrowserInput] = useState(() => localStorage.getItem('cms_tv_browser_url') || 'https://www.wikipedia.org');
  const [browserKey, setBrowserKey] = useState(0);

  // Media Player State
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [localMediaName, setLocalMediaName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  // Queue State
  const [lastCalled, setLastCalled] = useState<CalledTicketInfo | null>(() => {
    try {
      const stored = localStorage.getItem('cms_queue_current_called');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [doctorQueue, setDoctorQueue] = useState<any[]>([]);
  const [labQueue, setLabQueue] = useState<any[]>([]);
  const [isPulsing, setIsPulsing] = useState(false);
  const prevCalledNumberRef = useRef<string | null>(lastCalled?.mrnNumber || null);

  // Clock interval
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Screen WakeLock to prevent TV display from sleeping
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
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

  const handleTabChange = (tab: TvMediaTab) => {
    setActiveMediaTab(tab);
    localStorage.setItem('cms_tv_active_tab', tab);
  };

  // YouTube Helpers
  const handleApplyYouTube = (queryOrUrl?: string) => {
    const q = queryOrUrl !== undefined ? queryOrUrl : youtubeQuery;
    setYoutubeQuery(q);
    localStorage.setItem('cms_tv_yt_query', q);
    setYoutubeEmbedSrc(parseYouTubeEmbedUrl(q, isYoutubeMuted));
  };

  const toggleYoutubeMute = () => {
    const nextMuted = !isYoutubeMuted;
    setIsYoutubeMuted(nextMuted);
    setYoutubeEmbedSrc(parseYouTubeEmbedUrl(youtubeQuery, nextMuted));
  };

  // Browser Navigation Helpers
  const handleNavigateBrowser = (urlToGo: string) => {
    let clean = urlToGo.trim();
    if (clean && !clean.startsWith('http://') && !clean.startsWith('https://')) {
      if (clean.includes('.') && !clean.includes(' ')) {
        clean = 'https://' + clean;
      } else {
        clean = `https://www.google.com/search?q=${encodeURIComponent(clean)}`;
      }
    }
    setBrowserUrl(clean);
    setBrowserInput(clean);
    localStorage.setItem('cms_tv_browser_url', clean);
    setBrowserKey(k => k + 1);
  };

  // Local Media Picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localMediaUrl) URL.revokeObjectURL(localMediaUrl);
    const objUrl = URL.createObjectURL(file);
    setLocalMediaUrl(objUrl);
    setLocalMediaName(file.name);
  };

  useEffect(() => {
    return () => {
      if (localMediaUrl) URL.revokeObjectURL(localMediaUrl);
    };
  }, [localMediaUrl]);

  // Main Queue Fetching
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
        if (!d) return true;
        const dt = new Date(d);
        return !isNaN(dt.getTime()) &&
          dt.getFullYear() === now.getFullYear() &&
          dt.getMonth() === now.getMonth() &&
          dt.getDate() === now.getDate();
      };

      // 1. Live PatientQueues tickets
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

      // 2. Triage Consultation Queue
      const rawTriage = Array.isArray(triageData) ? triageData : (triageData?.data || []);
      const triageTickets = rawTriage
        .filter((t: any) => isToday(t.triagedAt || t.createdAt))
        .map((t: any, idx: number) => {
          const mrnNum = extractMrnNumber(t.mrn || t.MRN, t.patientId || t.id);
          const tid = t.id || t.Id || t.triageId || t.TriageId || mrnNum;
          return {
            id: tid ? `trg-${tid}-${idx}` : `trg-row-${idx}`,
            mrnNumber: mrnNum,
            patientName: t.patientName || t.PatientName || `Patient #${mrnNum}`,
            service: 'Consultation',
            counter: t.assignedDoctorName ? `Dr. ${t.assignedDoctorName}` : 'Doctor Room',
            status: 'Waiting',
            isProcedure: false,
            isLab: false
          };
        });

      // 3. Clinical Procedure Queue
      const rawProc = Array.isArray(procData) ? procData : (procData?.data || []);
      const procTickets = rawProc
        .filter((p: any) => isToday(p.createdAt || p.orderedAt))
        .map((p: any, idx: number) => {
          const mrnNum = extractMrnNumber(p.mrn || p.MRN, p.patientId || p.id);
          const pid = p.id || p.Id || p.orderId || p.OrderId || mrnNum;
          return {
            id: pid ? `prc-${pid}-${idx}` : `prc-row-${idx}`,
            mrnNumber: mrnNum,
            patientName: p.patientName || p.PatientName || `Patient #${mrnNum}`,
            service: p.procedureName || 'Clinical Procedure',
            counter: p.doctorName ? `Dr. ${p.doctorName}` : 'Procedure Room',
            status: 'Waiting',
            isProcedure: true,
            isLab: false
          };
        });

      // 4. Lab Queue
      const rawLab = Array.isArray(labData) ? labData : (labData?.data || []);
      const labTickets = rawLab
        .filter((l: any) => isToday(l.orderedAt || l.createdAt))
        .map((l: any, idx: number) => {
          const mrnNum = extractMrnNumber(l.mrn || l.MRN, l.patientId || l.id);
          const isResultReady = l.itemStatus === 4 || l.itemStatus === 5 || l.status === 'Completed' || l.status === 'Approved';
          const lid = l.id || l.Id || l.orderId || l.OrderId || l.orderItemId || l.OrderItemId || mrnNum;
          return {
            id: lid ? `lab-${lid}-${idx}` : `lab-row-${idx}`,
            mrnNumber: mrnNum,
            patientName: l.patientName || l.PatientName || `Patient #${mrnNum}`,
            service: isResultReady ? 'Lab Results Ready' : 'Phlebotomy / Sample Collection',
            counter: isResultReady ? 'Lab Results Counter' : 'Lab Phlebotomy Counter',
            status: 'Waiting',
            isProcedure: false,
            isLab: true
          };
        });

      // Check DB for active Called ticket
      const activeDbCalled = liveTickets.find((t: any) => t.status === 'Called');
      let localCalled: CalledTicketInfo | null = null;
      try {
        const stored = localStorage.getItem('cms_queue_current_called');
        if (stored) localCalled = JSON.parse(stored);
      } catch {}

      const resolved = activeDbCalled
        ? {
            mrnNumber: activeDbCalled.mrnNumber,
            patientName: activeDbCalled.patientName,
            service: activeDbCalled.service,
            counter: activeDbCalled.counter,
            isDoctor: !activeDbCalled.isLab,
            isProcedure: activeDbCalled.isProcedure,
            isLab: activeDbCalled.isLab
          }
        : localCalled;

      if (resolved && resolved.mrnNumber !== prevCalledNumberRef.current) {
        prevCalledNumberRef.current = resolved.mrnNumber;
        setLastCalled(resolved);
        setIsPulsing(true);
        playTicketChimeAndSpeech(resolved.mrnNumber, resolved.counter, resolved.patientName);
        setTimeout(() => setIsPulsing(false), 5000);
      }

      // Build Doctor Queue (Consultation & Procedure) — INCLUDE both Called and Waiting!
      const seenDoctorMrns = new Set<string>();
      const combinedDoctorList: any[] = [];
      [
        ...liveTickets.filter((t: any) => !t.isLab),
        ...procTickets,
        ...triageTickets
      ].forEach((item: any) => {
        if (!seenDoctorMrns.has(item.mrnNumber)) {
          seenDoctorMrns.add(item.mrnNumber);
          combinedDoctorList.push(item);
        }
      });

      // Build Lab Queue — INCLUDE both Called and Waiting!
      const seenLabMrns = new Set<string>();
      const combinedLabList: any[] = [];
      [
        ...liveTickets.filter((t: any) => t.isLab),
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
  }, []);

  // Polling every 4 seconds
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 4000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Instant Cross-Tab Sync via BroadcastChannel & Storage Event
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('cms_queue_events');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'CALL_PATIENT' && ev.data?.ticket) {
          const t = ev.data.ticket;
          const called: CalledTicketInfo = {
            mrnNumber: t.mrnNumber,
            patientName: t.patientName,
            service: t.service,
            counter: t.counter,
            isLab: t.isLabService,
            isProcedure: t.serviceCategory === 'Procedure',
            isDoctor: !t.isLabService
          };
          prevCalledNumberRef.current = called.mrnNumber;
          setLastCalled(called);
          setIsPulsing(true);
          playTicketChimeAndSpeech(called.mrnNumber, called.counter, called.patientName);
          setTimeout(() => setIsPulsing(false), 5000);
        }
        fetchQueue();
      };
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cms_queue_last_event' || e.key === 'cms_queue_current_called') {
        if (e.key === 'cms_queue_current_called' && e.newValue) {
          try {
            const called: CalledTicketInfo = JSON.parse(e.newValue);
            prevCalledNumberRef.current = called.mrnNumber;
            setLastCalled(called);
            setIsPulsing(true);
            playTicketChimeAndSpeech(called.mrnNumber, called.counter, called.patientName);
            setTimeout(() => setIsPulsing(false), 5000);
          } catch {}
        }
        fetchQueue();
      }
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
      background: 'linear-gradient(165deg, #022018 0%, #064030 50%, #032b20 100%)',
      color: '#ffffff', display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
      overflow: 'hidden', userSelect: 'none'
    }}>
      {/* TOP HEADER BAR */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 24px',
        background: 'rgba(0, 0, 0, 0.4)',
        borderBottom: '1px solid rgba(52, 199, 89, 0.25)',
        backdropFilter: 'blur(10px)',
        height: '62px', boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
          }}>
            <Tv size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '0.04em', color: '#ecfdf5' }}>
              HUDERMA SPECIALIZED CLINIC &amp; CENTRAL LABORATORY — LIVE QUEUE
            </div>
            <div style={{ fontSize: '0.7rem', color: '#a7f3d0', marginTop: 1 }}>
              Smart Waiting Room Display • Real-Time Audio Announcer
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
            <Wifi size={14} color="#34d399" />
            <span>Wi-Fi: <strong style={{ color: '#34d399' }}>HudermaGuest</strong></span>
          </div>

          <div style={{
            padding: '5px 14px', borderRadius: 20,
            background: totalWaiting > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${totalWaiting > 0 ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
            fontSize: '0.8rem', fontWeight: 800, color: totalWaiting > 0 ? '#6ee7b7' : 'rgba(255,255,255,0.5)'
          }}>
            <Activity size={13} style={{ display: 'inline', marginRight: 6 }} />
            {totalWaiting} Patients In Queue
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'monospace', lineHeight: 1, color: '#f0fdf4' }}>
              {fmtTime(currentTime)}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#a7f3d0', marginTop: 2 }}>
              {fmtDate(currentTime)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '7px 12px', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <button
              onClick={onExit}
              style={{
                background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: 8, padding: '7px 12px', color: '#fca5a5', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600
              }}
            >
              <X size={14} /> Exit
            </button>
          </div>
        </div>
      </div>

      {/* MAIN SCREEN SPLIT: 60% MEDIA / WEB | 40% QUEUE BOARD */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ======================================================== */}
        {/* LEFT 60%: MEDIA / BROWSER PANEL                          */}
        {/* ======================================================== */}
        <div style={{
          flex: '0 0 60%', width: '60%', display: 'flex', flexDirection: 'column',
          borderRight: '2px solid rgba(52, 199, 89, 0.25)',
          background: '#01140e', position: 'relative'
        }}>
          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'rgba(0, 0, 0, 0.5)', borderBottom: '1px solid rgba(52, 199, 89, 0.2)'
          }}>
            <button
              onClick={() => handleTabChange('youtube')}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                background: activeMediaTab === 'youtube' ? '#10b981' : 'rgba(255,255,255,0.06)',
                color: activeMediaTab === 'youtube' ? '#022018' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.2s'
              }}
            >
              <Play size={13} fill={activeMediaTab === 'youtube' ? '#022018' : 'currentColor'} /> YouTube &amp; Music
            </button>

            <button
              onClick={() => handleTabChange('browser')}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                background: activeMediaTab === 'browser' ? '#10b981' : 'rgba(255,255,255,0.06)',
                color: activeMediaTab === 'browser' ? '#022018' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.2s'
              }}
            >
              <Globe size={13} /> Web Browser
            </button>

            <button
              onClick={() => handleTabChange('mediaplayer')}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                background: activeMediaTab === 'mediaplayer' ? '#10b981' : 'rgba(255,255,255,0.06)',
                color: activeMediaTab === 'mediaplayer' ? '#022018' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.2s'
              }}
            >
              <Film size={13} /> Local Media Player
            </button>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: YOUTUBE & AMBIENT STREAM (NEVER REFUSES TO CONNECT)*/}
          {/* ======================================================== */}
          {activeMediaTab === 'youtube' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
              {/* YouTube Control Bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                background: 'rgba(0, 0, 0, 0.65)', borderBottom: '1px solid rgba(52, 199, 89, 0.15)',
                fontSize: '0.78rem'
              }}>
                <form
                  onSubmit={(e) => { e.preventDefault(); handleApplyYouTube(); }}
                  style={{ flex: 1, display: 'flex', gap: 6 }}
                >
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(52, 199, 89, 0.3)',
                    borderRadius: 6, padding: '4px 10px'
                  }}>
                    <Search size={13} color="#34d399" />
                    <input
                      type="text"
                      value={youtubeQuery}
                      onChange={(e) => setYoutubeQuery(e.target.value)}
                      placeholder="Search YouTube or paste video URL (e.g. relaxing music, nature 4k)..."
                      style={{
                        flex: 1, background: 'transparent', border: 'none',
                        color: '#fff', fontSize: '0.76rem', outline: 'none'
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      background: '#10b981', border: 'none', borderRadius: 6, padding: '5px 14px',
                      color: '#022018', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem',
                      display: 'flex', alignItems: 'center', gap: 5
                    }}
                  >
                    <Search size={12} /> Play
                  </button>
                </form>

                {/* Preset Pills */}
                <button
                  onClick={() => handleApplyYouTube('relaxing clinic waiting room music')}
                  style={{
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '5px 9px', color: '#a7f3d0', cursor: 'pointer',
                    fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                  }}
                  title="Play Clinic Relaxing Music"
                >
                  <Music size={11} /> Relaxing Music
                </button>

                <button
                  onClick={() => handleApplyYouTube('health wellness medical tips')}
                  style={{
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '5px 9px', color: '#a7f3d0', cursor: 'pointer',
                    fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                  }}
                  title="Play Health & Medical Education"
                >
                  <HeartPulse size={11} /> Health Tips
                </button>

                {/* Mute Toggle */}
                <button
                  onClick={toggleYoutubeMute}
                  style={{
                    background: isYoutubeMuted ? 'rgba(255,255,255,0.08)' : 'rgba(16, 185, 129, 0.25)',
                    border: `1px solid ${isYoutubeMuted ? 'rgba(255,255,255,0.2)' : '#10b981'}`,
                    borderRadius: 6, padding: '5px 10px', color: isYoutubeMuted ? '#94a3b8' : '#34d399',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 700
                  }}
                  title={isYoutubeMuted ? 'Unmute Video Audio' : 'Mute Video Audio'}
                >
                  {isYoutubeMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  {isYoutubeMuted ? 'Muted' : 'Sound On'}
                </button>
              </div>

              {/* YouTube Embedded Iframe */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <iframe
                  key={youtubeEmbedSrc}
                  src={youtubeEmbedSrc}
                  title="Waiting Room YouTube Stream"
                  style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: GENERAL WEB BROWSER                              */}
          {/* ======================================================== */}
          {activeMediaTab === 'browser' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                background: 'rgba(0, 0, 0, 0.65)', borderBottom: '1px solid rgba(52, 199, 89, 0.15)',
                fontSize: '0.78rem'
              }}>
                <form
                  onSubmit={(e) => { e.preventDefault(); handleNavigateBrowser(browserInput); }}
                  style={{ flex: 1, display: 'flex', gap: 6 }}
                >
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(52, 199, 89, 0.3)',
                    borderRadius: 6, padding: '4px 10px'
                  }}>
                    <Globe size={13} color="#34d399" />
                    <input
                      type="text"
                      value={browserInput}
                      onChange={(e) => setBrowserInput(e.target.value)}
                      placeholder="Type web address (e.g. wikipedia.org, cnn.com, clinic portal)..."
                      style={{
                        flex: 1, background: 'transparent', border: 'none',
                        color: '#fff', fontSize: '0.76rem', outline: 'none'
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      background: '#10b981', border: 'none', borderRadius: 6, padding: '5px 14px',
                      color: '#022018', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem',
                      display: 'flex', alignItems: 'center', gap: 5
                    }}
                  >
                    Go
                  </button>
                </form>

                <button
                  onClick={() => setBrowserKey(k => k + 1)}
                  style={{
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '5px 8px', color: '#fff', cursor: 'pointer'
                  }}
                  title="Reload webpage"
                >
                  <RotateCw size={13} />
                </button>

                <a
                  href={browserUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '5px 10px', color: '#a7f3d0', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', whiteSpace: 'nowrap'
                  }}
                  title="Open site in full browser tab"
                >
                  <ExternalLink size={12} /> Open in Tab
                </a>
              </div>

              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <iframe
                  key={browserKey}
                  src={browserUrl}
                  title="Waiting Room Web Browser"
                  style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: LOCAL MEDIA PLAYER                                */}
          {/* ======================================================== */}
          {activeMediaTab === 'mediaplayer' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                background: 'rgba(0, 0, 0, 0.65)', borderBottom: '1px solid rgba(52, 199, 89, 0.15)'
              }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: '#10b981', border: 'none', borderRadius: 7, padding: '7px 16px',
                    color: '#022018', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem',
                    display: 'flex', alignItems: 'center', gap: 7
                  }}
                >
                  <FolderOpen size={14} /> Browse &amp; Open Video / Audio File
                </button>

                {localMediaName && (
                  <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🎬 Playing: {localMediaName}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                {localMediaUrl ? (
                  <video
                    ref={videoPlayerRef}
                    src={localMediaUrl}
                    controls
                    autoPlay
                    loop
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 24 }}>
                    <Film size={54} color="#10b981" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0fdf4', marginBottom: 6 }}>
                      No Local Media File Loaded
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#a7f3d0', maxWidth: 420, marginBottom: 20 }}>
                      Click <strong>Browse &amp; Open Video / Audio File</strong> to select and stream clinic informational videos, promotional content, or relaxing media from your computer.
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'rgba(16, 185, 129, 0.18)', border: '1px solid #10b981',
                        borderRadius: 8, padding: '9px 20px', color: '#34d399', cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 7
                      }}
                    >
                      <FolderOpen size={15} /> Select Media File
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* RIGHT 40%: QUEUE BOARD (NOW CALLING & FULL SCROLL LISTS)  */}
        {/* ======================================================== */}
        <div style={{
          flex: '0 0 40%', width: '40%', display: 'flex', flexDirection: 'column',
          background: 'rgba(1, 25, 17, 0.95)', overflow: 'hidden'
        }}>

          {/* HERO BANNER: NOW CALLING */}
          <div style={{
            padding: '20px 18px',
            borderBottom: '2px solid rgba(52, 199, 89, 0.25)',
            background: isPulsing
              ? 'radial-gradient(ellipse at top, rgba(16, 185, 129, 0.35) 0%, rgba(2, 32, 24, 0.95) 75%)'
              : 'radial-gradient(ellipse at top, rgba(6, 78, 59, 0.25) 0%, rgba(2, 32, 24, 0.95) 75%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            position: 'relative', transition: 'background 0.3s ease'
          }}>
            <div style={{
              fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.22em',
              color: '#34d399', marginBottom: 6, textTransform: 'uppercase'
            }}>
              — NOW CALLING —
            </div>

            {lastCalled ? (
              <>
                {/* Large MRN Number */}
                <div style={{
                  fontSize: '5.2rem', fontWeight: 900, fontFamily: 'monospace',
                  lineHeight: 1, color: '#ffffff',
                  textShadow: isPulsing
                    ? '0 0 35px #10b981, 0 0 65px rgba(52, 211, 153, 0.8)'
                    : '0 0 20px rgba(16, 185, 129, 0.45)',
                  transition: 'text-shadow 0.3s ease',
                  textAlign: 'center', margin: '2px 0 6px'
                }}>
                  #{lastCalled.mrnNumber}
                </div>

                <div style={{
                  fontSize: '1.35rem', fontWeight: 800, color: '#f0fdf4',
                  textAlign: 'center', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {lastCalled.patientName}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20,
                    background: lastCalled.isLab ? 'rgba(175, 82, 222, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                    border: `1px solid ${lastCalled.isLab ? '#af52de' : '#10b981'}`,
                    fontSize: '0.78rem', fontWeight: 800,
                    color: lastCalled.isLab ? '#e9d5ff' : '#a7f3d0'
                  }}>
                    {lastCalled.isLab ? '🔬 Laboratory' : (lastCalled.isProcedure ? '💉 Procedure' : '🩺 Consultation')}
                  </span>

                  <span style={{
                    padding: '4px 14px', borderRadius: 20,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(5, 150, 105, 0.4))',
                    border: '1px solid #10b981',
                    fontSize: '0.86rem', fontWeight: 900, color: '#ecfdf5'
                  }}>
                    ➜ {lastCalled.counter}
                  </span>
                </div>

                {isPulsing && (
                  <div style={{
                    marginTop: 8, fontSize: '0.8rem', fontWeight: 900, color: '#34d399',
                    letterSpacing: '0.08em', animation: 'tvBlink 0.6s steps(1) infinite'
                  }}>
                    🔊 PLEASE PROCEED TO STATION
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
                <Clock size={36} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div style={{ fontSize: '0.88rem' }}>Awaiting first patient call...</div>
              </div>
            )}
          </div>

          {/* LOWER SECTION: UPCOMING QUEUE MATRIX (FULLY SCROLLABLE, NO SLICE) */}
          <div style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr 1fr', overflow: 'hidden' }}>

            {/* ROW 1: DOCTOR ROOMS (CONSULTATION & PROCEDURE) */}
            <div style={{
              padding: '10px 14px', display: 'flex', flexDirection: 'column',
              borderBottom: '1px solid rgba(52, 199, 89, 0.2)', overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                paddingBottom: 6, borderBottom: '2px solid rgba(16, 185, 129, 0.3)'
              }}>
                <Stethoscope size={16} color="#34d399" />
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.04em' }}>
                  DOCTOR ROOMS (CONSULTATION &amp; PROCEDURE)
                </span>
                <span style={{
                  marginLeft: 'auto', padding: '2px 8px', borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981',
                  fontSize: '0.7rem', fontWeight: 800, color: '#6ee7b7'
                }}>
                  {doctorQueue.length} Waiting
                </span>
              </div>

              {/* Scrollable list */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {doctorQueue.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.76rem', paddingTop: 16 }}>
                    No patients currently waiting for doctor consultation or procedure
                  </div>
                ) : (
                  doctorQueue.map((t, idx) => {
                    const isCalled = lastCalled && (
                      String(lastCalled.mrnNumber).trim() === String(t.mrnNumber).trim()
                    );
                    return (
                      <div
                        key={t.id ? `doc-${t.id}-${idx}` : `doc-row-${idx}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 10px', borderRadius: 7,
                          background: isCalled
                            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.35) 0%, rgba(6, 78, 59, 0.6) 100%)'
                            : idx === 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                          border: isCalled
                            ? '2px solid #34d399'
                            : `1px solid ${idx === 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.06)'}`,
                          boxShadow: isCalled ? '0 0 16px rgba(16, 185, 129, 0.5)' : 'none',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem',
                          color: isCalled ? '#34d399' : idx === 0 ? '#6ee7b7' : '#ffffff', minWidth: 65
                        }}>
                          #{t.mrnNumber}
                        </span>
                        <span style={{
                          fontSize: '0.78rem', fontWeight: isCalled ? 800 : 500,
                          color: isCalled ? '#ffffff' : '#e2e8f0', flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {t.patientName}
                        </span>
                        {isCalled ? (
                          <span style={{
                            fontSize: '0.62rem', fontWeight: 900, color: '#022018',
                            background: '#34d399', padding: '2px 8px', borderRadius: 4,
                            whiteSpace: 'nowrap', letterSpacing: '0.04em'
                          }}>
                            📢 NOW CALLING
                          </span>
                        ) : (
                          <>
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                              background: t.isProcedure ? 'rgba(6, 182, 212, 0.25)' : 'rgba(16, 185, 129, 0.2)',
                              color: t.isProcedure ? '#22d3ee' : '#a7f3d0'
                            }}>
                              {t.isProcedure ? 'Procedure' : 'Consultation'}
                            </span>
                            {idx === 0 && (
                              <span style={{ fontSize: '0.62rem', color: '#34d399', fontWeight: 800 }}>NEXT›</span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ROW 2: CENTRAL LABORATORY (PHLEBOTOMY & RESULTS) */}
            <div style={{
              padding: '10px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                paddingBottom: 6, borderBottom: '2px solid rgba(175, 82, 222, 0.35)'
              }}>
                <FlaskConical size={16} color="#c084fc" />
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#c084fc', letterSpacing: '0.04em' }}>
                  CENTRAL LABORATORY (PHLEBOTOMY &amp; RESULTS)
                </span>
                <span style={{
                  marginLeft: 'auto', padding: '2px 8px', borderRadius: 12,
                  background: 'rgba(175, 82, 222, 0.2)', border: '1px solid #af52de',
                  fontSize: '0.7rem', fontWeight: 800, color: '#d8b4fe'
                }}>
                  {labQueue.length} Waiting
                </span>
              </div>

              {/* Scrollable list */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {labQueue.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.76rem', paddingTop: 16 }}>
                    No patients currently waiting in laboratory queue
                  </div>
                ) : (
                  labQueue.map((l, idx) => {
                    const isCalled = lastCalled && (
                      String(lastCalled.mrnNumber).trim() === String(l.mrnNumber).trim()
                    );
                    return (
                      <div
                        key={l.id ? `lab-${l.id}-${idx}` : `lab-row-${idx}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 10px', borderRadius: 7,
                          background: isCalled
                            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.35) 0%, rgba(6, 78, 59, 0.6) 100%)'
                            : idx === 0 ? 'rgba(175, 82, 222, 0.18)' : 'rgba(255,255,255,0.03)',
                          border: isCalled
                            ? '2px solid #34d399'
                            : `1px solid ${idx === 0 ? 'rgba(175, 82, 222, 0.45)' : 'rgba(255,255,255,0.06)'}`,
                          boxShadow: isCalled ? '0 0 16px rgba(16, 185, 129, 0.5)' : 'none',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem',
                          color: isCalled ? '#34d399' : idx === 0 ? '#c084fc' : '#ffffff', minWidth: 65
                        }}>
                          #{l.mrnNumber}
                        </span>
                        <span style={{
                          fontSize: '0.78rem', fontWeight: isCalled ? 800 : 500,
                          color: isCalled ? '#ffffff' : '#e2e8f0', flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {l.patientName}
                        </span>
                        {isCalled ? (
                          <span style={{
                            fontSize: '0.62rem', fontWeight: 900, color: '#022018',
                            background: '#34d399', padding: '2px 8px', borderRadius: 4,
                            whiteSpace: 'nowrap', letterSpacing: '0.04em'
                          }}>
                            📢 NOW CALLING
                          </span>
                        ) : (
                          <>
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                              background: l.service.includes('Result') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                              color: l.service.includes('Result') ? '#4ade80' : '#c084fc'
                            }}>
                              {l.service.includes('Result') ? 'Results' : 'Sample Collection'}
                            </span>
                            {idx === 0 && (
                              <span style={{ fontSize: '0.62rem', color: '#c084fc', fontWeight: 800 }}>NEXT›</span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* BOTTOM MARQUEE TICKER */}
      <div style={{
        borderTop: '1px solid rgba(52, 199, 89, 0.2)',
        background: 'rgba(0, 0, 0, 0.65)', padding: '6px 0', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', gap: '80px', whiteSpace: 'nowrap',
          animation: 'tvMarquee 38s linear infinite', fontSize: '0.76rem',
          color: 'rgba(167, 243, 208, 0.85)', fontWeight: 600, paddingLeft: '100%'
        }}>
          {[
            '🏥 Welcome to Huderma Specialized Clinic & Central Laboratory — Dedicated to Excellence in Healthcare.',
            '🔔 Please listen for your Card Number announcement and proceed to the indicated station.',
            '📶 Free High-Speed Wi-Fi: HudermaGuest (No password required).',
            '💉 Clinical Procedures & Minor Surgeries: Located in Minor Procedure Room.',
            '🔬 Laboratory Blood & Sample Collection: Counters 1 & 2 • Central Diagnostic Wing.',
            '📋 Medical Records, Invoicing & Pharmacy: Reception Front Desk.',
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
